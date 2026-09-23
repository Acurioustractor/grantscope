/**
 * Where a block's figures come from and how fresh they are. Every figure a journalist might quote
 * needs this next to it; the reference sites all state freshness ("Updated 3 months ago").
 */
export function SourceLine({ sources, asOf }: { sources: string | string[]; asOf?: string | Date | null }) {
  const list = Array.isArray(sources) ? sources.filter(Boolean).join(', ') : sources;
  const date = asOf
    ? new Date(asOf).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  return (
    <p className="mt-2 text-xs text-bauhaus-muted">
      Source: {list}
      {date && <> · data as of {date}</>}
    </p>
  );
}
