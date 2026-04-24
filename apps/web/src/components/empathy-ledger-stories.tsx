/**
 * EmpathyLedgerStories — reverse link block on CivicGraph entity pages.
 *
 * Fetches stories about this entity from Empathy Ledger and renders a
 * compact sidebar card. Silent no-op unless EL has exposed the endpoint
 * AND the env var is set, so this can ship to production safely before
 * EL is ready.
 *
 * Env var required to activate:
 *   EMPATHY_LEDGER_URL=https://empathyledger.com
 *
 * EL is expected to expose:
 *   GET {EL_URL}/api/stories/by-entity/{identifier}
 *   Response: { stories: Array<{
 *     title: string;
 *     slug: string;
 *     published_at: string;   // ISO
 *     excerpt?: string;
 *     cover_image_url?: string;
 *     url: string;             // absolute link to the story
 *   }> }
 *
 * Identifier is ABN (11 digits) or gs_id, same contract as CivicGraph's
 * own entity endpoint.
 */

import Link from 'next/link';

type EmpathyLedgerStory = {
  title: string;
  slug: string;
  published_at: string;
  excerpt?: string;
  cover_image_url?: string;
  url: string;
};

async function fetchStories(identifier: string): Promise<EmpathyLedgerStory[]> {
  const elUrl = process.env.EMPATHY_LEDGER_URL;
  if (!elUrl) return [];

  try {
    const res = await fetch(
      `${elUrl.replace(/\/$/, '')}/api/stories/by-entity/${encodeURIComponent(identifier)}`,
      {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(3000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data?.stories)) return [];
    return data.stories.slice(0, 4);
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '';
  }
}

export async function EmpathyLedgerStories({
  identifier,
}: {
  identifier: string | null | undefined;
}) {
  if (!identifier) return null;
  const stories = await fetchStories(identifier);
  if (stories.length === 0) return null;

  return (
    <section className="mt-6 border-4 border-bauhaus-black bg-white">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-yellow/20 px-5 py-3">
        <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
          Stories On Empathy Ledger
        </p>
      </div>
      <ul className="divide-y-2 divide-bauhaus-black/10">
        {stories.map((story) => (
          <li key={story.slug} className="px-5 py-3">
            <Link
              href={story.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <p className="text-sm font-black text-bauhaus-black group-hover:text-bauhaus-red transition-colors">
                {story.title}
              </p>
              <p className="mt-1 text-[11px] font-medium text-bauhaus-muted">
                {formatDate(story.published_at)}
                {story.excerpt ? ` — ${story.excerpt}` : ''}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t-4 border-bauhaus-black bg-bauhaus-black px-5 py-2 text-right">
        <Link
          href={`${(process.env.EMPATHY_LEDGER_URL ?? '').replace(/\/$/, '')}/search?q=${encodeURIComponent(identifier)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] font-black uppercase tracking-widest text-white hover:text-bauhaus-yellow"
        >
          All stories on Empathy Ledger &rarr;
        </Link>
      </div>
    </section>
  );
}
