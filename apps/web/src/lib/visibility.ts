/**
 * The visibility vocabulary — one model for the whole system.
 *
 * WHY THIS EXISTS
 *
 * `/atlas` already had a good model: `public` / `org` / `withheld`, with two rules written into
 * `lib/atlas/layers.ts` — withheld renders nowhere, and any org/withheld layer's DATA must be
 * stripped server-side rather than hidden client-side. That model was correct and scoped to map
 * layers, so every other surface invented its own answer: the reports are ungated, `/clarity` is
 * admin-gated, `/org/[slug]` checks an email allowlist, and the consent-governed story tables are
 * protected by nothing but the fact that nobody has pointed a reader at them yet.
 *
 * The result was that visibility got re-decided per screen. This file is the one vocabulary.
 * See `thoughts/shared/plans/clarity-console-part-2.md`.
 *
 * NOT the commercial tier ladder in `lib/subscription.ts`
 * (`community`/`professional`/`organisation`/`funder`/`enterprise`). That is what someone has
 * PAID for. This is what someone is ALLOWED to see. They are different axes and must not be
 * conflated — a funder-tier subscriber still has no business reading a consent-governed story.
 */

/**
 * The clearance a viewer must hold before data may be rendered to them.
 *
 * Ordered least to most restrictive. `operator` is the one addition to the Atlas's three: it
 * covers things true about the ESTATE rather than about the WORLD — unfiled counts, report review
 * status, the 1,151 objects whose usage was never measured. That material is not sensitive, it is
 * simply not about anything; publishing it would be publishing our own to-do list as findings.
 */
export type Visibility = 'public' | 'org' | 'operator' | 'withheld';

export const VISIBILITY_ORDER: readonly Visibility[] = ['public', 'org', 'operator', 'withheld'];

/**
 * The clearance a SURFACE carries. `withheld` is deliberately absent: it is a property data can
 * have and a surface can never have, because a surface that renders withheld data is not a
 * surface, it is a leak.
 */
export type Surface = 'public' | 'org' | 'operator';

export const VISIBILITY_LABEL: Record<Visibility, string> = {
  public: 'Public',
  org: 'Organisation',
  operator: 'Operator',
  withheld: 'Withheld',
};

export const VISIBILITY_MEANING: Record<Visibility, string> = {
  public: 'Anyone may see this.',
  org: 'Only inside a logged-in organisation workspace.',
  operator: 'True about our estate, not about the world. Never published.',
  withheld: 'Rendered nowhere, on any surface, until a consent conversation changes it.',
};

function rank(v: Visibility): number {
  return VISIBILITY_ORDER.indexOf(v);
}

/**
 * THE RULE: a screen may always be more restrictive than its data. It may never be less.
 *
 * That asymmetry is the whole safety property. It means a consent-governed table cannot leak onto
 * a public page no matter who writes that page later — which matters because the stories and the
 * 52.3M rows of public money share one Supabase project, so nothing physical stands between them.
 */
export function canRender(dataFloor: Visibility, surface: Surface): boolean {
  if (dataFloor === 'withheld') return false;
  return rank(dataFloor) <= rank(surface);
}

/**
 * A page that reads many objects inherits the most restrictive of them. Computing this per page
 * is what stops one incidental join from quietly publishing something.
 */
export function mostRestrictive(floors: readonly Visibility[]): Visibility {
  return floors.reduce<Visibility>((worst, f) => (rank(f) > rank(worst) ? f : worst), 'public');
}

/**
 * Throwing guard for server components. Deliberately throws rather than returning empty: a page
 * that silently renders nothing is indistinguishable from a page whose query failed, and the
 * difference between "withheld" and "broken" is exactly the distinction this project refuses to
 * collapse anywhere else.
 */
export function assertRenderable(
  dataFloor: Visibility,
  surface: Surface,
  what: string,
): void {
  if (!canRender(dataFloor, surface)) {
    throw new Error(
      `visibility: refusing to render ${what} (${dataFloor}) on a ${surface} surface. ` +
        `A screen may be stricter than its data, never looser.`,
    );
  }
}

/**
 * The sentence shown in place of withheld content.
 *
 * Absence is always stated, never silent — the same principle as the refusal cards and the
 * `?`-never-`0` rule. The shape of what you cannot see is itself information, and hiding it is
 * the one thing that makes a system untrustworthy.
 */
export function withheldNote(dataFloor: Visibility, surface: Surface, what: string): string | null {
  if (canRender(dataFloor, surface)) return null;
  if (dataFloor === 'withheld') {
    return `${what} is withheld. It is consent-governed, and admin access is not a consent basis.`;
  }
  return `${what} is ${VISIBILITY_LABEL[dataFloor].toLowerCase()}-tier and is not shown on this surface.`;
}

/**
 * Suppression for small counts.
 *
 * The exception that proves the absence-is-stated rule: a count of 1 in a small community is a
 * name. Where a count describes people or places rather than dollars, anything under the threshold
 * reports as suppressed rather than as a number.
 */
export const SMALL_COUNT_THRESHOLD = 5;

export function suppressSmallCount(n: number | null): { show: boolean; label: string } {
  if (n === null) return { show: false, label: '—' };
  if (n === 0) return { show: true, label: '0' };
  if (n < SMALL_COUNT_THRESHOLD) return { show: false, label: `<${SMALL_COUNT_THRESHOLD}` };
  return { show: true, label: String(n) };
}

/**
 * The Atlas's three-tier type is a strict subset of this one, so its registry keeps working
 * unchanged and simply never uses `operator`. This alias exists so the relationship is visible in
 * the type system rather than being a coincidence two files apart.
 */
export type AtlasCompatibleVisibility = Extract<Visibility, 'public' | 'org' | 'withheld'>;
