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
