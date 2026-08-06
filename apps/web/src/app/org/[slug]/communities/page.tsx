// Communities — the places ACT is deliberately engaged with (CONTEXT.md:
// Community; docs/specs/community-records-spec.md). Hand-minted list, 5–15
// records. Skin: Quiet Ledger.
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isActSlug } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getCommunities } from '@/lib/services/act-communities';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Communities — CivicGraph' };
}

export default async function CommunitiesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isActSlug(slug)) notFound();
  const profile = await getOrgProfileBySlug(slug).catch(() => null);
  const communities = profile ? await getCommunities(profile.id) : [];

  return (
    <main className="min-h-screen bg-ql-surface2 p-6 text-ql-ink">
      <div className="mx-auto max-w-[900px]">
        <div className="font-ql-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-ql-accent">
          {communities.length} communities · hand-minted
        </div>
        <h1 className="mt-1 font-ql-display text-4xl font-semibold">Communities</h1>
        <p className="mt-1.5 text-sm text-ql-text2">
          Places ACT is deliberately engaged with. A Community is minted by decision, never by a dataset.
        </p>

        <div className="mt-5 rounded-lg border border-ql-border bg-ql-surface">
          {communities.map((c) => (
            <Link
              key={c.id}
              href={`/org/${slug}/communities/${c.slug}`}
              className="flex items-center gap-3 border-t border-ql-border/60 px-5 py-3.5 first:border-t-0 hover:bg-ql-surface2"
            >
              <span className="min-w-0 flex-1">
                <span className="font-ql-display text-lg font-semibold">{c.name}</span>
                {c.notes && <span className="ml-2 truncate text-sm text-ql-text2">{c.notes}</span>}
              </span>
              {c.openObligations > 0 && (
                <span className="font-ql-mono text-[10px] font-semibold text-ql-alert">{c.openObligations} owed</span>
              )}
              <span className="font-ql-mono text-[10px] text-ql-muted">{c.linkCount} connections</span>
            </Link>
          ))}
          {communities.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-ql-text2">
              No Communities minted yet. Minting is a decision that ACT is engaged with a place — it happens here, deliberately, not from a dataset.
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
