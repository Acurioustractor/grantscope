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
  /** ISO date the member was appointed. Null until the migration is applied / set. */
  appointedAt: string | null;
  /** ISO date the member's term ends. Null until the migration is applied / set. */
  termEndsAt: string | null;
  /**
   * Whether the member identifies as Indigenous. Null when not yet recorded
   * (the org_contacts.identifies_indigenous migration is written but not yet
   * applied, so reads coerce a missing field to null, never false).
   */
  identifiesIndigenous: boolean | null;
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

/**
 * An adviser to Goods on Country — QBE Diagnostic Area 07.
 * Advisers are engaged for a task, for a time. They are NEVER a board: not seated,
 * not laddered, not co-owners. The Advisory Circle surface keeps this line explicit.
 * Source: org_contacts (contact_type='advisory'). The contact_type CHECK that allows
 * 'advisory', and the expertise/last_contacted_at/engagement_ask columns, are added
 * by a migration that is written but NOT YET APPLIED, so reads coerce missing fields
 * to null/[] and zero rows is the normal pre-migration state (never an error).
 */
export interface Advisor {
  id: string;
  name: string;
  role: string | null;
  organisation: string | null;
  linkedinUrl: string | null;
  /** Expertise areas, rendered as tags. Empty until recorded. */
  expertise: string[];
  /** ISO date this adviser was last engaged. Null until recorded. */
  lastContactedAt: string | null;
  /** The specific, time-bound ask of this adviser. Null until recorded. */
  engagementAsk: string | null;
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

/** The outcome of resolving a row's rung, distinguishing a bad tier tag from "no rung". */
export interface RungResolution {
  rung: SupporterRung | null;
  /** True when the row carried a `tier:` tag whose value is not a known rung. */
  unrecognisedTier: boolean;
}

/**
 * Resolve a supporter's current rung. An explicit `tier:<rung>` tag is the source
 * of truth and wins (per the belonging model); otherwise the pipeline stage drives.
 * A `tier:` tag whose value is NOT a known rung is flagged as unrecognised rather
 * than silently ignored, so a typo'd tag surfaces instead of dropping the supporter
 * off the ladder without explanation.
 */
export function resolveRung(stage: string | null | undefined, tags: string[] | null | undefined): RungResolution {
  const tierTag = (tags ?? [])
    .map((t) => String(t).toLowerCase())
    .find((t) => t.startsWith('tier:'));
  if (tierTag) {
    const tier = tierTag.slice('tier:'.length);
    if (RUNG_TIERS.has(tier)) return { rung: tier as SupporterRung, unrecognisedTier: false };
    // A tier: tag was set but is not one of the five known rungs. Flag it.
    return { rung: stageToRung(stage), unrecognisedTier: true };
  }
  return { rung: stageToRung(stage), unrecognisedTier: false };
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
  /** Supporters carrying a `tier:` tag whose value is not a known rung. Surfaced, not dropped. */
  unrecognisedTier: number;
}

const EXAMPLE_CAP = 4;

/** Roll a set of supporter rows up into the 5 rungs. Pure + deterministic. */
export function rollupLadder(rows: SupporterLadderRow[]): SupporterLadder {
  const buckets = new Map<SupporterRung, RungRollup>();
  for (const r of BELONGING_RUNGS) {
    buckets.set(r.tier, { tier: r.tier, label: r.label, meaning: r.meaning, count: 0, examples: [] });
  }
  let offLadder = 0;
  let unrecognisedTier = 0;
  for (const row of rows) {
    const { rung, unrecognisedTier: badTier } = resolveRung(row.stage, row.tags);
    if (badTier) unrecognisedTier += 1;
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
  return { rungs, offLadder, total, unrecognisedTier };
}

export interface BoardComposition {
  total: number;
  /** Members whose identifies_indigenous field is non-null (true or false). */
  recorded: number;
  indigenous: number;
  /** Indigenous share of members who have the field set, or null when none is set yet. */
  indigenousPct: number | null;
}

/**
 * Summarise the board for the funder-readiness header. Indigenous % is computed
 * over members where identifies_indigenous is recorded (non-null), never over the
 * whole board, so an un-migrated/unset field reads as "not yet recorded" rather
 * than a misleading 0%.
 */
export function summarizeBoard(members: GovernanceMember[]): BoardComposition {
  const total = members.length;
  let recorded = 0;
  let indigenous = 0;
  for (const m of members) {
    if (m.identifiesIndigenous == null) continue;
    recorded += 1;
    if (m.identifiesIndigenous) indigenous += 1;
  }
  const indigenousPct = recorded > 0 ? Math.round((indigenous / recorded) * 100) : null;
  return { total, recorded, indigenous, indigenousPct };
}
