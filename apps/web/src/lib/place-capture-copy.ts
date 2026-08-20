import type { CapturePlace } from '@/lib/grant-place-capture';

/**
 * The decisions the place-capture section makes about what to SAY, separated from how it renders
 * so they can be tested against real shapes rather than asserted in a snapshot.
 *
 * Each one exists because of a measured way the figures mislead — see `app/place/place-capture.tsx`.
 */

/** Below this, the two shares are close enough that spelling out the difference is noise. */
export const DIVERGENCE_POINTS = 10;

/**
 * At or above this share in one award, the dollar figure is substantially about that award.
 * 30% is deliberately well below the 38% floor of the twelve worst-capturing councils measured
 * 2026-08-21, so the warning fires before a place reaches the shape that produced the finding.
 */
export const CONCENTRATION_POINTS = 30;

export type CaptureNote = 'money-leaves' | 'grants-leave' | null;

/**
 * Which sentence to put beside the two percentages, if any.
 *
 * The disagreement between award share and dollar share IS the finding, so it is stated in words.
 * Left to two bare percentages, a reader takes the smaller one as the story.
 */
export function divergenceNote(capture: CapturePlace): CaptureNote {
  const gap = capture.pctAwardsLocal - capture.pctDollarsLocal;
  if (Math.abs(gap) < DIVERGENCE_POINTS) return null;
  return gap > 0 ? 'money-leaves' : 'grants-leave';
}

/**
 * Whether to warn that one award carries the dollar figure.
 *
 * Null concentration means not held, which must not read as "not concentrated" — but there is
 * nothing honest to say about it either, so it does not warn.
 */
export function isConcentrated(capture: CapturePlace): boolean {
  return (capture.biggestAwardShare ?? 0) >= CONCENTRATION_POINTS;
}
