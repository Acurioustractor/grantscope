import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  getOrgProfileBySlug,
  getOrgProjectBySlug,
} from '@/lib/services/org-dashboard-service';
import { getJourneys } from '@/lib/services/journey-service';
import { Section } from '../../../_components/ui';

export const revalidate = 60;

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-300',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  archived: 'bg-amber-50 text-amber-600 border-amber-200',
};

export default async function JourneyListPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string }>;
}) {
  const { slug, projectSlug } = await params;

  const profile = await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const project = await getOrgProjectBySlug(profile.id, projectSlug);
  if (!project) notFound();

  const journeys = await getJourneys(profile.id, project.id);

  const basePath = `/org/${slug}/${projectSlug}/journeys`;

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-3">
            <Link href={`/org/${slug}`} className="hover:text-white transition-colors">
              {profile.name}
            </Link>
            <span>&rsaquo;</span>
            <Link href={`/org/${slug}/${projectSlug}`} className="hover:text-white transition-colors">
              {project.name}
            </Link>
            <span>&rsaquo;</span>
            <span className="text-white font-bold">Journeys</span>
          </nav>
          <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red mb-1">
            Journey Maps
          </p>
          <h1 className="text-3xl font-black uppercase tracking-wider">
            Persona Journeys
          </h1>
          <p className="mt-2 text-sm text-gray-400 max-w-2xl">
            Map the real journeys of the people your project serves. Show what happens today
            versus what changes with your project — backed by evidence and data.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Journey cards */}
        {journeys.length > 0 ? (
          <Section title="Your Journeys">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {journeys.map(j => (
                <Link
                  key={j.id}
                  href={`${basePath}/${j.id}`}
                  className="bg-white border-2 border-gray-200 rounded-lg p-5 hover:border-bauhaus-black hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-sm group-hover:text-bauhaus-red transition-colors">
                      {j.title}
                    </h3>
                    <span className={`text-[10px] px-2 py-0.5 font-bold uppercase border rounded-sm ${STATUS_STYLES[j.status] ?? STATUS_STYLES.draft}`}>
                      {j.status}
                    </span>
                  </div>
                  {j.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">{j.description}</p>
                  )}
                  <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    <span>{j.persona_count} persona{j.persona_count !== 1 ? 's' : ''}</span>
                    <span>{j.step_count} step{j.step_count !== 1 ? 's' : ''}</span>
                    <span>{j.match_count} match{j.match_count !== 1 ? 'es' : ''}</span>
                  </div>
                </Link>
              ))}
            </div>
          </Section>
        ) : (
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
            <p className="text-4xl mb-3">🗺️</p>
            <p className="font-bold text-lg">No journeys yet</p>
            <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
              Create your first journey map to visualise the paths people take through
              systems — and how your project changes those paths.
            </p>
          </div>
        )}

        {/* Create new */}
        <div className="mt-8 text-center">
          <p className="text-xs text-gray-400 mb-2">
            Journey creation is available through the API. Coming soon: in-app creation.
          </p>
        </div>
      </div>
    </main>
  );
}
