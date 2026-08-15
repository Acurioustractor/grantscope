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
