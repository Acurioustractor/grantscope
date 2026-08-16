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
    <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-3xl font-black uppercase tracking-widest text-bauhaus-black mb-1">Search</h1>
      <p className="text-sm font-medium text-bauhaus-muted mb-6">
        Reports, questions, themes, entities, people, places, grants and data objects — one box.
      </p>
      <SearchClient index={index} initialQuery={q?.trim() ?? ''} />
    </main>
  );
}
