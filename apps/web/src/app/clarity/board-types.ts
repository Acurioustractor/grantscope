/**
 * The board's row shape. Unlike the ledger, this is NOT terse-keyed: there are ~26 questions at
 * full registry size, not 1,455 objects, so payload size buys nothing and legibility costs
 * nothing.
 */
export type QuestionState =
  | 'draft'
  | 'answered'
  | 'contested'
  | 'unanswerable'
  | 'refused'
  | 'retired';

export type FormKind =
  | 'scalar'
  | 'ranked_bar'
  | 'stacked_three'
  | 'matrix'
  | 'timeseries'
  | 'refused';

export type Publishable = 'public' | 'shareable' | 'internal';

export interface SentinelFlag {
  tripped: boolean;
  n: number | null;
  share: number | null;
  severity: 'block' | 'warn';
  /** whether this sentinel can block THIS question — see clarity_sentinel.guards_objects */
  blocking?: boolean;
  scope?: 'unscoped' | 'named' | 'ingredient' | 'not-applicable';
  /**
   * Written, per-question reason this tripped sentinel does not block. Set from
   * clarity_sentinel_exemption. Its presence is why `blocking` is false — the flag still records
   * that the defect is real, because an exemption nobody can read is indistinguishable from a
   * guard somebody quietly switched off.
   */
  exempt_reason?: string;
  error?: string;
}

export interface BoardCard {
  slug: string;
  stub: string;
  question: string;
  subject: string;
  state: QuestionState;
  form: FormKind;
  honest_at: string;
  publishable: Publishable;
  verification_stamp: string | null;
  caveat: string;
  exclusions: string;
  claim_phrasing: string;
  forbidden_phrasing: string[];
  uniqueness: number;
  uniqueness_basis: string | null;
  live_rerun_ok: boolean;
  measured_ms: number | null;
  /** Prose condition under which this question refuses to render. Only set on form='refused'. */
  refuses_when: string | null;

  /** null until the runner has ever produced an answer. Renders NEVER RUN, never a zero. */
  headline: string | null;
  headline_sub: string | null;
  headline_num: number | null;
  coverage_num: number | null;
  coverage_den: number | null;
  coverage_label: string | null;
  computed_at: string | null;
  ok: boolean | null;
  error_text: string | null;
  sentinel_flags: Record<string, SentinelFlag> | null;
  duration_ms: number | null;

  ingredient_count: number;
  binding_object: string | null;
  binding_pct: number | null;
  /** Carried on the card so the answer page needs no second round trip. Binding first. */
  ingredients: Ingredient[] | null;
  oldest_ingredient_write: string | null;
  spark: { at: string; h: string | null; n: number | null }[] | null;
  run_count: number;
  row_count: number | null;
}

export interface Ingredient {
  object_key: string;
  join_key: string;
  role: 'spine' | 'fact' | 'reference' | 'filter' | 'denominator';
  is_binding: boolean;
  measured_pct: number | null;
}

/** Every tripped sentinel that can actually block this question. */
export function blockingSentinels(card: Pick<BoardCard, 'sentinel_flags'>): string[] {
  if (!card.sentinel_flags) return [];
  return Object.entries(card.sentinel_flags)
    .filter(([, f]) => f.tripped && f.blocking)
    .map(([k]) => k);
}

/**
 * The coverage line. ALWAYS a fraction, never a bare percent — a percentage with no denominator
 * is the single easiest way to make a partial answer look complete.
 */
export function coverageText(card: Pick<BoardCard, 'coverage_num' | 'coverage_den'>): string | null {
  if (card.coverage_num == null || card.coverage_den == null || !card.coverage_den) return null;
  const pct = (card.coverage_num / card.coverage_den) * 100;
  return `${card.coverage_num.toLocaleString()} of ${card.coverage_den.toLocaleString()} · ${pct.toFixed(1)}%`;
}

/**
 * A refused question renders no chart, no number and no copyable claim. Both the state and the
 * form carry the fact, and they can disagree: a question can be registered `refused` before its
 * form is set, and a `refused` form is meaningless on any other state. Either one is enough.
 */
export function isRefusedCard(
  card: Pick<BoardCard, 'form' | 'state'>,
): boolean {
  return card.form === 'refused' || card.state === 'refused';
}

/**
 * UNVERIFIED and PILOT are stamps that travel with the number. `verified` is the absence of a
 * stamp, not a badge — stamping the normal case teaches readers to ignore stamps. A missing
 * verification_stamp is also unstamped: the registry requires the value where it matters, and a
 * card is not made more trustworthy by a label the author never wrote.
 */
export function stampLabel(
  card: Pick<BoardCard, 'verification_stamp'>,
): 'UNVERIFIED' | 'PILOT' | null {
  const v = card.verification_stamp?.toLowerCase();
  if (v === 'unverified') return 'UNVERIFIED';
  if (v === 'pilot') return 'PILOT';
  return null;
}
