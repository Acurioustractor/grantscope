/**
 * Supplier copy helpers.
 *
 * Some enterprise descriptions are low-value AI hedges ("activities are not
 * well-documented", "further information is needed") that actively contradict
 * the hard delivery evidence shown alongside them — a triple-proof supplier
 * with $7.8M in contracts should never carry a blurb saying we don't know what
 * it does. We suppress hedge text and let the evidence speak instead.
 */

const HEDGE_PATTERNS: RegExp[] = [
  /not well[\s-]?documented/i,
  /further information is needed/i,
  /(specific )?activities (and services )?are not/i,
  /likely focus(ed|ing)?/i,
  /little (public(ly available)? )?information/i,
  /details? (are|is) not (publicly )?(available|documented)/i,
  /not publicly available/i,
  /unable to determine/i,
  /information (is|remains) (limited|scarce|unclear)/i,
  /no (detailed |specific )?information (is )?available/i,
];

export function isHedgeDescription(desc: string | null | undefined): boolean {
  if (!desc) return false;
  return HEDGE_PATTERNS.some((re) => re.test(desc));
}
