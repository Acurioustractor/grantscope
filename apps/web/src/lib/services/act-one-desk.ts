// The one-system desk pool: every workable record — funders, grants, buyers —
// merged into a single deadline-first ranked queue. Born from the /prototype-one
// session (2026-08-05): Ben picked the split-desk shape with project and type as
// filters, never places.
import { getFunderScan } from '@/lib/services/goods-funder-scan';
import { getActRelationshipLedger } from '@/lib/services/act-relationship-ledger';
import { getOrgDailyActionStates, type ActDailyActionStatus } from '@/lib/services/act-daily-actions';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getAllProjectsGrantsTriage, grantDecisionDue, type TaggedBy } from '@/lib/services/act-project-grants-triage';
import { getDeskDecisions, decisionKey, type DeskDecision } from '@/lib/services/act-desk-decisions';
import type { ProjectEligibility } from '@/lib/act-grant-eligibility';
import { money } from '@/lib/format';
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
  'ACT-HV': 'Harvest', 'ACT-FM': 'Farm', 'ACT-CN': 'Contained',
  'ACT-PI': 'Palm Island', 'ACT-MY': 'ACT',
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
  /** Grant rows: pursued, but no live GHL opportunity holds it yet (the push failed or predates the wiring). */
  ghlPending?: boolean;
  /** Obligation rows: who the work is owed to. */
  owedTo?: 'funder' | 'community';
  obligationId?: string;
  /** Person rows: warm-via holder (null/absent when warmth is direct). */
  via?: string;
  personId?: string;
  /** Person rows: mirror sync age for the stale badge (data-trust rule). */
  lastSyncedAt?: string | null;
  /** Grant, funder and buyer rows: the source id the decision record keys on
   *  (grant_opportunities.id, org_project_foundations.id, goods_relationships.id). */
  ref?: string;
  projectCode?: string | null;
  /** The latest Pursue / Pass / Save for later on this row (opportunity_decisions). */
  decision?: DeskDecision;
  /** Grant rows: why it is on the desk and who can apply. */
  grant?: DeskGrantFacts;
};

export type DeskGrantFacts = {
  funder: string | null;
  keyword: number;
  jevScore: number | null;
  jevConfidence: number | null;
  jevOutsideArea: boolean;
  taggedBy: TaggedBy;
  closeDate: string | null;
  amountMin: number | null;
  amountMax: number | null;
  url: string | null;
  eligibility: ProjectEligibility;
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
  /** Saved for later: off the queue until Ben brings them back. */
  saved: DeskRecord[];
  /** Passed: off the queue; a "Wrong project" pass also keeps the tag off in the nightly scorers. */
  passed: DeskRecord[];
  /** Records marked done/waiting/tomorrow today (same store as the Today queue). */
  handled: Array<{ record: DeskRecord; status: ActDailyActionStatus }>;
  orgProfileId: string | null;
  target: DeskTarget | null;
};

export async function getOneDesk(slug: string): Promise<OneDeskPool> {
  const [records, capital] = await Promise.all([
    getDeskRecords(slug),
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
  const saved: DeskRecord[] = [];
  const passed: DeskRecord[] = [];
  const handled: OneDeskPool['handled'] = [];
  for (const r of records) {
    if (r.decision?.state === 'passed') { passed.push(r); continue; }
    if (r.decision?.state === 'saved') { saved.push(r); continue; }
    const status = states[r.id];
    if (status) handled.push({ record: r, status });
    else active.push(r);
  }
  const newestFirst = (a: DeskRecord, b: DeskRecord) => (b.decision?.at ?? '').localeCompare(a.decision?.at ?? '');
  return { active, saved: saved.sort(newestFirst), passed: passed.sort(newestFirst), handled, orgProfileId: profile?.id ?? null, target };
}

/** The ranked queue without saved or passed rows (the digest preview reads this). */
export async function getOneDeskPool(slug: string): Promise<DeskRecord[]> {
  const records = await getDeskRecords(slug);
  return records.filter((r) => r.decision?.state !== 'passed' && r.decision?.state !== 'saved');
}

/** Is there a live decision on the row? An undone decision ('open') counts as none. */
function decided(d: DeskDecision | undefined): boolean {
  return Boolean(d && d.state !== 'open');
}

/** Grant ids with a live decision, and the project codes it was made for. */
function decidedGrants(decisions: Map<string, DeskDecision>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [key, d] of decisions) {
    if (d.state === 'open') continue;
    const [kind, ref, code] = key.split('|');
    if (kind !== 'grant' || !ref || !code) continue;
    if (!out.has(ref)) out.set(ref, new Set());
    out.get(ref)!.add(code);
  }
  return out;
}

async function getDeskRecords(slug: string): Promise<DeskRecord[]> {
  const profile = await getOrgProfileBySlug(slug).catch(() => null);
  // Decisions first: a passed grant may have lost its tag overnight and must still be fetched.
  const decisions = profile
    ? await getDeskDecisions(profile.id).catch(() => new Map<string, DeskDecision>())
    : new Map<string, DeskDecision>();
  const [scan, triage, buyers, ledger, obligations, people] = await Promise.all([
    // Portfolio-wide, not Goods-only (audit 2026-08-07): Goods had 10 high-fit
    // funders and the only surface, while Empathy Ledger had 99 and PICC 84 with
    // none. Passing no slug scans every ACT project.
    getFunderScan().catch(() => null),
    // Widened 2026-09-14 (step 4 of the ACT grants desk build): this used to be
    // getGoodsGrantsTriage, which only ever ranked on goods_relevance_score — every
    // grant row on the desk read "Goods" regardless of which project it actually fit.
    getAllProjectsGrantsTriage(decidedGrants(decisions)).catch(() => []),
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
      amount: money(item.outstandingTotal),
      ghlUrl: null, workHref: actOrgHref(slug, item.organisation),
    });
  }
  // The desk contract (CONTEXT.md): committed work or a decision due now.
  // Funders: in GHL = an Ask being worked; not in GHL = decision-due only at
  // fit >= 85 (pursue mints the Ask, pass removes it).
  for (const r of scan?.rows ?? []) {
    if (!r.stage || ['parked', 'declined'].includes(r.stage)) continue;
    const inGhl = r.ghlWarmth !== 'not_in_ghl';
    const decision = decisions.get(decisionKey('funder', r.id, r.projectCode));
    const pursuing = decision?.state === 'pursuing';
    // Grade A only for undecided funders: recorded grants on file. The old gate
    // was fit >= 85, which admitted 286 rows ranked on placeholder giving values
    // and is most of why 1,005 matches sat untouched at "saved".
    if (!inGhl && r.evidenceGrade !== 'A' && !decided(decision)) continue;
    pool.push({
      id: `f-${r.id}`, kind: 'funder', ref: r.id, projectCode: r.projectCode, decision,
      // One label per project across kinds: org_projects says "The Farm" where grants say "Farm".
      project: r.projectCode ? deskProjectLabel(r.projectCode) : (r.projectName ?? 'ACT'),
      name: r.name,
      signal: inGhl ? r.ghlWarmth : pursuing ? 'pursuing · not yet in GHL' : 'recorded grants on file · not decided',
      next: inGhl ? (r.nextStep || 'Set a next step') : pursuing ? 'Make the Ask in GHL' : 'Pursue or pass',
      dueDays: null,
      score: r.fitScore ?? 0,
      // Real giving from the ACNC AIS (grants made in Australia), never the placeholder size band.
      amount: r.givingAnnual != null ? `${money(r.givingAnnual)} given ${r.givingYear}` : null,
      ghlUrl: ghlContactUrl(r.ghlContactId),
      workHref: inGhl ? actOrgHref(slug, r.name) : `/org/${slug}/goods/foundations/scan`,
      isDecision: !inGhl && !pursuing,
    });
  }
  // Grant Rounds: decision due when closing within 30 days, when the keyword score clears the project's
  // bar, or when Jev calls it a strong fit (grantDecisionDue). Already-in-GHL rounds are Asks being
  // worked. A decided round stays in the pool whatever its score, so Saved and Passed can list it.
  for (const g of triage) {
    const inGhl = Boolean(g.ghlOpportunityId);
    const decision = decisions.get(decisionKey('grant', g.rowId, g.code));
    const pursuing = decision?.state === 'pursuing';
    if (!inGhl && !grantDecisionDue(g) && !decided(decision)) continue;
    pool.push({
      id: `g-${g.id}`, kind: 'grant', ref: g.rowId, projectCode: g.code, decision,
      project: deskProjectLabel(g.code), name: g.name,
      signal: pursuing ? 'pursuing' : inGhl ? 'in GHL' : 'open round · not decided',
      next: pursuing ? (inGhl ? 'Work the application in GHL' : 'Send it to GHL') : inGhl ? 'Work the application' : 'Pursue or pass',
      dueDays: g.daysToDeadline,
      // Undated rows rank on the stronger of the two signals (Jev 0-3 read onto 0-99).
      score: Math.max(g.fitScore, g.jevScore != null ? Math.round(g.jevScore * 33) : 0),
      amount: g.amountMax != null ? money(g.amountMax) : g.amountMin != null ? money(g.amountMin) : null,
      ghlUrl: null, workHref: g.project === 'goods' ? `/org/${slug}/goods/grants` : `/org/${slug}/grants`,
      isDecision: !inGhl && !pursuing,
      ghlPending: pursuing && !inGhl,
      grant: {
        funder: g.provider, keyword: g.fitScore, jevScore: g.jevScore, jevConfidence: g.jevConfidence,
        jevOutsideArea: g.jevOutsideArea, taggedBy: g.taggedBy, closeDate: g.deadline,
        amountMin: g.amountMin, amountMax: g.amountMax, url: g.url, eligibility: g.eligibility,
      },
    });
  }
  for (const b of buyers?.rows ?? []) {
    // Demand-register rows are communities that need beds, not buyers; they buried the six projects.
    if (!b.isOpen || b.isCommunity) continue;
    pool.push({
      id: `b-${b.id}`, kind: 'buyer', ref: b.id, projectCode: 'ACT-GD',
      decision: decisions.get(decisionKey('buyer', b.id, 'ACT-GD')),
      project: 'Goods', name: b.name,
      signal: `${b.band} ${b.warmth}`, next: b.nextMove,
      dueDays: days(b.nextActionDue), score: b.warmth,
      amount: b.askAmount ? money(b.askAmount) : null,
      ghlUrl: ghlContactUrl(b.ghlContactId), workHref: actOrgHref(slug, b.name),
    });
  }
  return pool.sort((a, b) => urgency(a) - urgency(b));
}
