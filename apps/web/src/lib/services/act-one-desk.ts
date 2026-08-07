// The one-system desk pool: every workable record — funders, grants, buyers —
// merged into a single deadline-first ranked queue. Born from the /prototype-one
// session (2026-08-05): Ben picked the split-desk shape with project and type as
// filters, never places.
import { getFunderScan } from '@/lib/services/goods-funder-scan';
import { getActRelationshipLedger } from '@/lib/services/act-relationship-ledger';
import { getOrgDailyActionStates, type ActDailyActionStatus } from '@/lib/services/act-daily-actions';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsGrantsTriage } from '@/lib/services/goods-grants-triage';
import { getGoodsBuyerPipeline } from '@/lib/services/goods-buyer-pipeline';
import { ghlContactUrl } from '@/lib/ghl-links';
import { actOrgHref } from '@/lib/services/act-org-record';
import { getGoodsCapitalWorkspace } from '@/lib/services/goods-capital-workspace';
import { getDeskObligations } from '@/lib/services/act-obligations';
import { getDeskPeople } from '@/lib/services/act-desk-people';

// Five row kinds (CONTEXT.md: One Desk; widened spec #153). The legacy
// `commitment` kind is gone — committed work IS an Obligation (#150).
export type DeskRecordKind = 'funder' | 'grant' | 'buyer' | 'money' | 'obligation' | 'person';

const PROJECT_LABELS: Record<string, string> = {
  'ACT-GD': 'Goods', 'ACT-EL': 'Empathy Ledger', 'ACT-JH': 'JusticeHub',
  'ACT-HV': 'Harvest', 'ACT-PI': 'Palm Island', 'ACT-MY': 'ACT',
};

export function deskProjectLabel(code: string | null): string {
  if (!code) return 'ACT';
  return PROJECT_LABELS[code] ?? code.replace(/^ACT-/, '');
}

export type DeskRecord = {
  id: string;
  kind: DeskRecordKind;
  project: string;
  name: string;
  /** Warmth / stage / status chip text. */
  signal: string;
  /** The one next move. */
  next: string;
  /** Days until deadline or next action; negative = overdue; null = undated. */
  dueDays: number | null;
  /** Fit or warmth, used to rank undated records. */
  score: number;
  amount: string | null;
  ghlUrl: string | null;
  /** Deep link to the record's full workspace surface. */
  workHref: string | null;
  /** True when this row is a decision due (pursue or pass), not yet an Ask. */
  isDecision?: boolean;
  /** Obligation rows: who the work is owed to. */
  owedTo?: 'funder' | 'community';
  obligationId?: string;
  /** Person rows: warm-via holder (null/absent when warmth is direct). */
  via?: string;
  personId?: string;
  /** Person rows: mirror sync age for the stale badge (data-trust rule). */
  lastSyncedAt?: string | null;
};

/** The primary Target the Asks serve (CONTEXT.md: Target). */
export type DeskTarget = {
  label: string;
  needMinAud: number;
  needMaxAud: number;
  committedAud: number;
  askMadeAud: number;
};

export type DeskHorizon = 'overdue' | 'fortnight' | 'quarter' | 'undated';

export function deskHorizon(r: DeskRecord): DeskHorizon {
  if (r.dueDays == null || r.dueDays > 90) return 'undated';
  if (r.dueDays < 0) return 'overdue';
  if (r.dueDays <= 14) return 'fortnight';
  return 'quarter';
}

function days(iso: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 86_400_000);
}

function urgency(r: DeskRecord): number {
  if (r.dueDays != null) return r.dueDays < 0 ? -1000 + r.dueDays : r.dueDays;
  return 500 - r.score;
}

export type OneDeskPool = {
  /** Ranked records still needing a move today. */
  active: DeskRecord[];
  /** Records marked done/waiting/tomorrow today (same store as the Today queue). */
  handled: Array<{ record: DeskRecord; status: ActDailyActionStatus }>;
  orgProfileId: string | null;
  target: DeskTarget | null;
};

export async function getOneDesk(slug: string): Promise<OneDeskPool> {
  const [pool, capital] = await Promise.all([
    getOneDeskPool(slug),
    getGoodsCapitalWorkspace().catch(() => null),
  ]);
  const target: DeskTarget | null = capital ? {
    label: 'Goods capital plan',
    needMinAud: capital.summary.needMinAud,
    needMaxAud: capital.summary.needMaxAud,
    committedAud: capital.summary.committedAud,
    askMadeAud: capital.summary.askMadeAud,
  } : null;
  const profile = await getOrgProfileBySlug(slug).catch(() => null);
  const states: Record<string, ActDailyActionStatus> = profile
    ? await getOrgDailyActionStates(profile.id).catch(() => ({}))
    : {};
  const active: DeskRecord[] = [];
  const handled: OneDeskPool['handled'] = [];
  for (const r of pool) {
    const status = states[r.id];
    if (status) handled.push({ record: r, status });
    else active.push(r);
  }
  return { active, handled, orgProfileId: profile?.id ?? null, target };
}

export async function getOneDeskPool(slug: string): Promise<DeskRecord[]> {
  const profile = await getOrgProfileBySlug(slug).catch(() => null);
  const [scan, triage, buyers, ledger, obligations, people] = await Promise.all([
    // Portfolio-wide, not Goods-only (audit 2026-08-07): Goods had 10 high-fit
    // funders and the only surface, while Empathy Ledger had 99 and PICC 84 with
    // none. Passing no slug scans every ACT project.
    getFunderScan().catch(() => null),
    getGoodsGrantsTriage({ scope: 'closing' }).catch(() => null),
    getGoodsBuyerPipeline().catch(() => null),
    profile ? getActRelationshipLedger(slug, profile.id).catch(() => null) : null,
    profile ? getDeskObligations(profile.id).catch(() => []) : [],
    profile ? getDeskPeople(profile.id).catch(() => []) : [],
  ]);
  const pool: DeskRecord[] = [];
  // Obligations (ADR 0003, #152): open + (overdue | due ≤ 30d | undated).
  // Undated pin the top of the No-date group, newest-minted first — committed
  // work with no date must never hide (score encodes the pin: 200 - idx keeps
  // their urgency below every fit-ranked undated Signal's).
  const undatedRank = obligations
    .filter((o) => o.dueDays == null)
    .sort((a, b) => b.mintedAt.localeCompare(a.mintedAt))
    .map((o) => o.id);
  for (const o of obligations) {
    pool.push({
      id: `o-${o.id}`, kind: 'obligation', obligationId: o.id,
      project: deskProjectLabel(o.projectCode),
      name: o.title,
      signal: o.sourceAskName ? `minted from ${o.sourceAskName}` : `owed to ${o.owedTo}`,
      next: o.nextAction || 'Set the next action',
      dueDays: o.dueDays,
      score: o.dueDays == null ? 200 - undatedRank.indexOf(o.id) : 0,
      amount: null, ghlUrl: null,
      workHref: o.projectCode === 'ACT-GD' ? `/org/${slug}/goods/we-owe` : null,
      owedTo: o.owedTo,
    });
  }
  // People (ADR 0002 mirror): cultivated humans whose next action / watch is
  // due within 7 days or past. Empty until the #154 mirror ships.
  for (const p of people) {
    pool.push({
      id: `p-${p.id}`, kind: 'person', personId: p.id,
      project: 'ACT',
      name: p.name,
      signal: p.warmth ?? 'cultivated',
      next: p.nextAction,
      dueDays: p.dueDays, score: 0,
      amount: null,
      ghlUrl: ghlContactUrl(p.ghlContactId),
      workHref: `/org/${slug}/people`,
      via: p.via ?? undefined,
      lastSyncedAt: p.lastSyncedAt,
    });
  }
  // Money owed: outstanding invoices become chase records — the old Today
  // queue's "collect" items, so nothing lives only on that screen.
  for (const item of ledger?.items ?? []) {
    if (!item.outstandingTotal || item.outstandingInvoiceCount === 0) continue;
    pool.push({
      id: `m-${item.key}`, kind: 'money', project: 'Goods', name: item.organisation,
      signal: `${item.outstandingInvoiceCount} invoice${item.outstandingInvoiceCount === 1 ? '' : 's'} outstanding`,
      next: item.nextMove || 'Chase payment',
      dueDays: item.oldestOverdueDays > 0 ? -item.oldestOverdueDays : null,
      score: Math.min(99, Math.round(item.outstandingTotal / 1000)),
      amount: `$${Math.round(item.outstandingTotal / 1000)}K`,
      ghlUrl: null, workHref: actOrgHref(slug, item.organisation),
    });
  }
  // The desk contract (CONTEXT.md): committed work or a decision due now.
  // Funders: in GHL = an Ask being worked; not in GHL = decision-due only at
  // fit >= 85 (pursue mints the Ask, pass removes it).
  for (const r of scan?.rows ?? []) {
    if (!r.stage || ['parked', 'declined'].includes(r.stage)) continue;
    const inGhl = r.ghlWarmth !== 'not_in_ghl';
    // Grade A only for undecided funders: recorded grants on file. The old gate
    // was fit >= 85, which admitted 286 rows ranked on placeholder giving values
    // and is most of why 1,005 matches sat untouched at "saved".
    if (!inGhl && r.evidenceGrade !== 'A') continue;
    pool.push({
      id: `f-${r.id}`, kind: 'funder',
      project: r.projectName ?? 'ACT',
      name: r.name,
      signal: inGhl ? r.ghlWarmth : 'recorded grants on file · not yet an Ask',
      next: inGhl ? (r.nextStep || 'Set a next step') : 'Decide: pursue (mint the Ask in GHL) or pass',
      dueDays: null,
      score: r.fitScore ?? 0, amount: null, ghlUrl: ghlContactUrl(r.ghlContactId),
      workHref: inGhl ? actOrgHref(slug, r.name) : `/org/${slug}/goods/foundations/scan`,
      isDecision: !inGhl,
    });
  }
  // Grant Rounds: decision-due when closing within 30 days or fit >= 85;
  // already-in-GHL rounds are Asks being worked.
  for (const g of triage?.grants ?? []) {
    const inGhl = Boolean(g.ghlOpportunityId);
    const decisionDue = (g.daysToDeadline != null && g.daysToDeadline <= 30) || (g.goodsScore ?? 0) >= 85;
    if (!inGhl && !decisionDue) continue;
    pool.push({
      id: `g-${g.id}`, kind: 'grant', project: 'Goods', name: g.name,
      signal: inGhl ? 'in GHL' : 'live round · not yet an Ask',
      next: inGhl ? 'Work the application' : 'Decide: pursue (push to GHL) or pass',
      dueDays: g.daysToDeadline, score: g.goodsScore ?? 0,
      amount: g.amountMax ? `$${Math.round(g.amountMax / 1000)}K` : null,
      ghlUrl: null, workHref: `/org/${slug}/goods/grants`,
      isDecision: !inGhl,
    });
  }
  for (const b of buyers?.rows ?? []) {
    if (!b.isOpen) continue;
    pool.push({
      id: `b-${b.id}`, kind: 'buyer', project: 'Goods', name: b.name,
      signal: `${b.band} ${b.warmth}`, next: b.nextMove,
      dueDays: days(b.nextActionDue), score: b.warmth,
      amount: b.askAmount ? `$${Math.round(b.askAmount / 1000)}K` : null,
      ghlUrl: ghlContactUrl(b.ghlContactId), workHref: actOrgHref(slug, b.name),
    });
  }
  return pool.sort((a, b) => urgency(a) - urgency(b));
}
