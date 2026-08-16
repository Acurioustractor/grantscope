import type { Metadata } from 'next';
import { buildSmallIndex } from './search-index';
import { SearchClient } from './search-client';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Search — CivicGraph',
  description: 'One search across reports, questions, themes, entities, people, places, grants and data objects.',
};

/**
 * One page at /search, grouped by kind, with a shareable URL.
 *
 * Grouped, not one ranked list: a flat list must decide whether /reports/youth-justice beats an
 * organisation named "Youth Justice NSW", and it will get that wrong constantly because they are
 * incomparable. Grouping also lets a group say "no reports match" — which is information.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ q }, index] = await Promise.all([searchParams, buildSmallIndex()]);

  return (
    <div className="max-w-4xl mx-auto">
      <p className="text-sm font-medium mb-6" style={{ color: 'var(--shell-muted)' }}>
        Reports, questions, themes, entities, people, places, grants and data objects — one box.
      </p>
      <SearchClient index={index} initialQuery={q?.trim() ?? ''} />
    </div>
  );
}
