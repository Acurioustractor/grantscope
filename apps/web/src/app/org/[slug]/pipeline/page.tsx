import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getOrgPipelineData } from '@/lib/services/org-pipeline-service';
import { ACT_FAST_PROFILE, isActSlug } from '@/lib/services/fast-local-org';
import { OrgPipelineKanban } from './pipeline-kanban';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ACT Decisions — Org',
  description: 'Opportunities ACT has consciously accepted for watching or action.',
};

export default async function OrgPipelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const minScoreParam = typeof sp.min === 'string' ? Number(sp.min) : 60;
  const discoveredMinScore = Number.isFinite(minScoreParam) ? minScoreParam : 60;
  const includeHistorical = sp.history === '1';

  const profile = (await getOrgProfileBySlug(slug)) ?? (isActSlug(slug) ? ACT_FAST_PROFILE : null);
  if (!profile) notFound();

  const data = await getOrgPipelineData(slug, discoveredMinScore, includeHistorical);

  if (!data) {
    return (
      <main className="min-h-screen bg-gray-50 text-bauhaus-black">
        <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
          <div className="mx-auto max-w-7xl px-4 py-8">
            <p className="text-sm font-black uppercase tracking-widest text-bauhaus-red">Pipeline</p>
            <h1 className="text-3xl font-black uppercase tracking-wider">{profile.name}</h1>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-10">
          <div className="border-4 border-bauhaus-black bg-white p-8">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
              No pipeline configured
            </div>
            <p className="mt-2 text-sm leading-relaxed text-bauhaus-muted">
              Grant recommendations are currently scored against ACT project codes only. This org
              has no project codes wired into <code className="font-mono">act_grant_recommendations</code>.
            </p>
            <div className="mt-4">
              <Link
                href={`/org/${slug}`}
                className="border-2 border-bauhaus-black bg-white px-3 py-2 text-xs font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const decidedCount = data.cards.filter((c) => c.decision !== 'discovered').length;
  const strongDiscovered = data.cards.filter(
    (c) => c.decision === 'discovered' && c.is_strong_fit,
  ).length;

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-bauhaus-red">Decide and act</p>
              <h1 className="text-3xl font-black uppercase tracking-wider">{profile.name}</h1>
              <p className="mt-2 text-sm leading-relaxed text-gray-300">
                Only verified openings that ACT has deliberately accepted belong here.
                Move each one from watching to action, outcome, or pass.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex gap-2">
                <Link
                  href={`/org/${slug}`}
                  className="border border-white/20 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
                >
                  Dashboard
                </Link>
                <Link
                  href={`/org/${slug}?view=opportunities#opportunities`}
                  className="border border-white/20 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-white hover:text-bauhaus-black"
                >
                  Observatory
                </Link>
              </div>
              <div className="text-[11px] font-mono text-gray-300 text-right">
                {data.cards.length} cards · {strongDiscovered} strong undecided · {decidedCount} decided
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 py-8">
        <OrgPipelineKanban
          slug={slug}
          cards={data.cards}
          projects={data.projects}
          contexts={data.contexts}
          discoveredMinScore={data.discoveredMinScore}
        />
      </div>
    </main>
  );
}
