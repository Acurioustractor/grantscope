/**
 * Goods on Country — Governance (pure, dependency-free helpers).
 *
 * The governance roster is the Indigenous-majority board of The Butterfly Movement
 * Ltd (the Goods charity + DGR home). These people are CO-OWNERS, not supporters.
 * They are NEVER laddered, scored, or funnelled. The supporter belonging ladder
 * (BELONGING_RUNGS) is a separate dimension that applies to funders, members and
 * buyers, and to none of the board.
 *
 * Source of truth: act-global-infrastructure/wiki/decisions/goods-governance-roster.md
 * Synced into org_contacts (contact_type='governance') by
 * scripts/sync-goods-governance-roster.mjs. The notes field carries a small,
 * readable, parseable payload that these helpers decode.
 */

export type GovernanceStatus = 'continuing' | 'transitioning' | 'incoming' | 'unknown';

export interface GovernanceMember {
  id: string;
  name: string;
  role: string | null;
  organisation: string | null;
  linkedinUrl: string | null;
  /** Normalised status for badge/colour. */
  status: GovernanceStatus;
  /** Raw status text (keeps detail like "transitioning (handover 26 Jun 2026)"). */
  statusLabel: string;
  /** Verified cultural authority / role context. Null when unconfirmed. */
  context: string | null;
}

/** Map a raw wiki status string to a normalised status. Unknown is the safe default. */
export function normalizeStatus(raw: string | null | undefined): GovernanceStatus {
  const s = (raw ?? '').toLowerCase();
  if (!s) return 'unknown';
  if (s.includes('transition')) return 'transitioning';
  if (s.includes('incoming') || s.includes('joining') || s.includes('install')) return 'incoming';
  if (s.includes('continu') || s.includes('current') || s.includes('ongoing') || s.includes('serving')) {
    return 'continuing';
  }
  return 'unknown';
}

export interface ParsedGovernanceNotes {
  status: GovernanceStatus;
  /** Raw status text from the `Status:` line, or null. */
  statusLabel: string | null;
  /** Cultural authority / role context from the `Context:` line, or null. */
  context: string | null;
}

/**
 * Decode the notes payload written by the sync script. Format (newline-delimited):
 *   Status: <raw status>
 *   Context: <verified cultural authority / role context>   (optional)
 *   <free-text provenance / co-owner marker>
 * Tolerant of missing lines and of plain free-text notes (returns status 'unknown').
 */
export function parseGovernanceNotes(notes: string | null | undefined): ParsedGovernanceNotes {
  const lines = (notes ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  let statusLabel: string | null = null;
  let context: string | null = null;
  for (const ln of lines) {
    const sm = /^status:\s*(.+)$/i.exec(ln);
    const cm = /^context:\s*(.+)$/i.exec(ln);
    if (sm && statusLabel === null) statusLabel = sm[1].trim();
    else if (cm && context === null) context = cm[1].trim();
  }
  return { status: normalizeStatus(statusLabel), statusLabel, context };
}

export interface BelongingRung {
  tier: 'curious' | 'connected' | 'member' | 'active' | 'steward';
  label: string;
  /** Goods-specific meaning, per the canonical ACT Belonging Model. */
  meaning: string;
}

/**
 * The ACT Belonging Model, 5 rungs, with the Goods-specific meaning of each.
 * Source: act-global-infrastructure/wiki/decisions/act-belonging-model.md.
 * This is the SUPPORTER ladder. It is shown for context only; it never applies
 * to the governance roster above (co-owners are not laddered).
 */
export const BELONGING_RUNGS: readonly BelongingRung[] = [
  { tier: 'curious', label: 'Curious', meaning: 'Aware, in the system, not yet engaged.' },
  { tier: 'connected', label: 'Connected', meaning: 'Receiving the story, warming, opted in.' },
  { tier: 'member', label: 'Member', meaning: 'Committed funder, supporter or buyer.' },
  { tier: 'active', label: 'Active', meaning: 'Repeat giving, deploys beds, refers others.' },
  { tier: 'steward', label: 'Steward', meaning: 'Champion or advisory; backs community ownership.' },
] as const;

export type SupporterRung = BelongingRung['tier'];
const RUNG_TIERS = new Set<string>(BELONGING_RUNGS.map((r) => r.tier));

/**
 * Map a Goods engagement-ladder stage to a belonging rung. The Goods pipeline is
 * more granular than the 5 rungs (the belonging model says stage and tier: tag
 * stay in sync), so the courtship stages collapse to Connected, committed is
 * Member, and repeat is Active. dormant/declined are off the ladder (null).
 * Steward has no pipeline stage; it only comes from an explicit tier:steward tag.
 */
const STAGE_TO_RUNG: Record<string, SupporterRung | null> = {
  identified: 'curious',
  researching: 'connected',
  contacted: 'connected',
  in_conversation: 'connected',
  proposal: 'connected',
  committed: 'member',
  repeat: 'active',
  dormant: null,
  declined: null,
};

export function stageToRung(stage: string | null | undefined): SupporterRung | null {
  if (!stage) return null;
  return STAGE_TO_RUNG[stage.toLowerCase()] ?? null;
}

/**
 * Resolve a supporter's current rung. An explicit `tier:<rung>` tag is the source
 * of truth and wins (per the belonging model); otherwise the pipeline stage drives.
 */
export function resolveRung(stage: string | null | undefined, tags: string[] | null | undefined): SupporterRung | null {
  const tierTag = (tags ?? [])
    .map((t) => String(t).toLowerCase())
    .find((t) => t.startsWith('tier:'));
  if (tierTag) {
    const tier = tierTag.slice('tier:'.length);
    if (RUNG_TIERS.has(tier)) return tier as SupporterRung;
  }
  return stageToRung(stage);
}

export interface SupporterLadderRow {
  stage: string | null;
  tags: string[] | null;
  name: string;
}

export interface RungRollup {
  tier: SupporterRung;
  label: string;
  meaning: string;
  count: number;
  /** Up to a few example display names, for ambient context. */
  examples: string[];
}

export interface SupporterLadder {
  rungs: RungRollup[]; // always all 5, in ladder order
  offLadder: number; // dormant / declined / unmapped
  total: number; // supporters currently on a rung
}

const EXAMPLE_CAP = 4;

/** Roll a set of supporter rows up into the 5 rungs. Pure + deterministic. */
export function rollupLadder(rows: SupporterLadderRow[]): SupporterLadder {
  const buckets = new Map<SupporterRung, RungRollup>();
  for (const r of BELONGING_RUNGS) {
    buckets.set(r.tier, { tier: r.tier, label: r.label, meaning: r.meaning, count: 0, examples: [] });
  }
  let offLadder = 0;
  for (const row of rows) {
    const rung = resolveRung(row.stage, row.tags);
    if (!rung) {
      offLadder += 1;
      continue;
    }
    const b = buckets.get(rung)!;
    b.count += 1;
    if (b.examples.length < EXAMPLE_CAP && row.name) b.examples.push(row.name);
  }
  const rungs = BELONGING_RUNGS.map((r) => buckets.get(r.tier)!);
  const total = rungs.reduce((acc, r) => acc + r.count, 0);
  return { rungs, offLadder, total };
}
