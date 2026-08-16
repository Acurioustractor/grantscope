/**
 * The findings stream: machine-proposed, human-adjudicated. A finding with no verdict NEVER
 * counts as true — it is a proposal, and proposals age out instead of piling up into another
 * 1,222-row table nobody reads.
 */

/** The age-out window for unconfirmed findings. The plan left N open; 30 is a chosen default,
 *  not a decree — move it here and every surface follows. Age-out is read-side: nothing is
 *  deleted, and a verdict (either way) never expires. */
export const AGE_OUT_DAYS = 30;

export type Detector = 'undiscovered_join' | 'orphan';

export interface FindingRow {
  id: number;
  detector: Detector;
  subject_object_key: string;
  column_name: string;
  title: string;
  evidence: Record<string, unknown>;
  proposed_at: string;
  last_seen_at: string;
  verdict: 'confirmed' | 'dismissed' | null;
  verdict_by: string | null;
  verdict_at: string | null;
  verdict_reason: string | null;
}

export type Bucket = 'open' | 'confirmed' | 'dismissed' | 'aged_out';

export function bucketOf(f: FindingRow, now: Date): Bucket {
  if (f.verdict === 'confirmed') return 'confirmed';
  if (f.verdict === 'dismissed') return 'dismissed';
  const ageMs = now.getTime() - new Date(f.proposed_at).getTime();
  return ageMs > AGE_OUT_DAYS * 24 * 60 * 60 * 1000 ? 'aged_out' : 'open';
}

export const DETECTOR_LABEL: Record<Detector, string> = {
  undiscovered_join: 'undiscovered join',
  orphan: 'orphan',
};
