import {
  freshnessLabel,
  getMvFreshness,
  shouldWarnReader,
  type MvFreshnessRow,
} from '@/lib/mv-freshness';

/**
 * The as-of stamp that belongs beside any figure read from a matview.
 *
 * #314 step 4: a surface whose matview is stale currently serves the number silently, and that is
 * the wrong behaviour. Per disclose-don't-hide, say the as-of date rather than hide the lag — and
 * say it WITH the number, not on a help page, the same rule the Atlas layer registry enforces for
 * caveats.
 *
 * A missing verdict renders as "date unknown", never as nothing. Rendering nothing is the one
 * failure mode that reads as "this number is current".
 */
export function AsOf({ row, className = '' }: { row: MvFreshnessRow | null; className?: string }) {
  const warn = row ? shouldWarnReader(row.freshness) : false;
  const label = row ? freshnessLabel(row) : 'Refresh date unknown';
  return (
    <p
      className={`font-mono text-[11px] uppercase tracking-widest ${
        warn ? 'text-bauhaus-red' : 'text-bauhaus-black/60'
      } ${className}`}
      // The date is part of the claim, so it is announced with it rather than left to a title
      // attribute a screen reader may never reach.
      data-freshness={row?.freshness ?? 'unknown'}
    >
      {label}
    </p>
  );
}

/**
 * Server-component form: fetches the verdict for one matview and renders it.
 *
 * A freshness lookup must never take down the surface it is annotating — an unreadable verdict is
 * "date unknown", which is exactly what `AsOf` renders for a null row.
 */
export async function AsOfMatview({ mvName, className }: { mvName: string; className?: string }) {
  let row: MvFreshnessRow | null = null;
  try {
    row = await getMvFreshness(mvName);
  } catch {
    row = null;
  }
  return <AsOf row={row} className={className} />;
}
