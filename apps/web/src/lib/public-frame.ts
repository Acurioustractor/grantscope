/**
 * Which routes render inside the one public frame (DESIGN.md, 2026-09-24): the root layout's top nav
 * and footer. Everything not listed here does.
 *
 * The root layout and `public-frame.test.ts` both read these lists. Until 2026-09-24 the layout kept
 * its own `pathname.startsWith` chain and the test kept a separate RAIL_ALLOWED list, and they had
 * drifted: the layout also dropped the nav on /pricing, /changes, /feedback, /get-a-report and
 * /account, so a visitor there had no way back to the site but the browser's back button.
 */

/**
 * Signed-in work. Full-bleed, and these are the only routes whose pages may wrap themselves in the
 * black rail (<Shell>). /ops and /admin go as whole groups: when only /ops/health was listed (admin
 * audit A2, 2026-08-18), every other ops screen stacked the public nav on top of the shell.
 */
export const SIGNED_IN_PREFIXES = [
  '/dashboard', '/clarity', '/ops', '/admin', '/alerts', '/tracker', '/foundations/tracker',
] as const;

/** Pages that bring their own frame on purpose: iframe embeds and partner share pages. */
export const OWN_FRAME_PREFIXES = ['/embed', '/share'] as const;

/** ACT's workspace under /org, which applies its own `ws act-workspace` wrapper. */
export const ACT_WORKSPACE_PREFIXES = ['/org/act', '/org/a-curious-tractor', '/org/curious-tractor'] as const;

/** True for `prefix` itself and anything below it, never for a sibling that shares its letters (/tracker vs /trackers). */
export function isUnder(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Routes that render without the root layout's nav and footer. */
export function isChromelessPath(pathname: string): boolean {
  return [...SIGNED_IN_PREFIXES, ...OWN_FRAME_PREFIXES, ...ACT_WORKSPACE_PREFIXES].some((p) => isUnder(pathname, p));
}
