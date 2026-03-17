import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getOrgProfileBySlug,
  getOrgProjectBySlug,
} from '@/lib/services/org-dashboard-service';
import { getJourney } from '@/lib/services/journey-service';
import { JourneyMapReadOnly } from './journey-map-readonly';

export const revalidate = 60;

export default async function JourneyMapPage({
  params,
}: {
  params: Promise<{ slug: string; projectSlug: string; journeyId: string }>;
}) {
  const { slug, projectSlug, journeyId } = await params;

  const profile = await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const project = await getOrgProjectBySlug(profile.id, projectSlug);
  if (!project) notFound();

  const journey = await getJourney(journeyId);
  if (!journey || journey.org_profile_id !== profile.id) notFound();

  const totalSteps = journey.personas.reduce((s, p) => s + p.steps.length, 0);
  const totalMatches = journey.personas.reduce(
    (s, p) => s + p.steps.reduce((ss, st) => ss + st.matches.length, 0),
    0,
  );

  return (
    <main className="min-h-screen bg-white text-bauhaus-black print:bg-white">
      {/* Header — hidden on print */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white print:hidden">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <nav className="flex items-center gap-2 text-sm text-gray-400 mb-1">
                <Link href={`/org/${slug}/${projectSlug}/journeys`} className="hover:text-white transition-colors">
                  &larr; Journeys
                </Link>
              </nav>
              <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">Journey Map</p>
              <h1 className="text-2xl font-black uppercase tracking-wider">{journey.title}</h1>
            </div>
            <Link
              href={`/org/${slug}/${projectSlug}/journeys/${journeyId}`}
              className="text-sm text-gray-400 hover:text-white underline"
            >
              Edit Journey &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block px-8 py-6 border-b-4 border-bauhaus-black">
        <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">Journey Map</p>
        <h1 className="text-2xl font-black uppercase tracking-wider">{journey.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{profile.name} — {project.name}</p>
      </div>

      {/* Stats bar */}
      <div className="mx-auto max-w-7xl px-4 py-4 flex gap-6 text-xs font-bold uppercase tracking-wider text-gray-500 border-b border-gray-200">
        <span>{journey.personas.length} persona{journey.personas.length !== 1 ? 's' : ''}</span>
        <span>{totalSteps} step{totalSteps !== 1 ? 's' : ''}</span>
        <span>{totalMatches} evidence match{totalMatches !== 1 ? 'es' : ''}</span>
      </div>

      {/* Journey map */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        <JourneyMapReadOnly journey={journey} />
      </div>

      {/* Footer */}
      <div className="mx-auto max-w-7xl px-4 py-6 border-t border-gray-200 text-center print:border-t-4 print:border-bauhaus-black">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Powered by CivicGraph — Decision Infrastructure for Government & Social Sector
        </p>
      </div>
    </main>
  );
}
