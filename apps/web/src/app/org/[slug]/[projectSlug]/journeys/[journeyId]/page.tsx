import { notFound } from 'next/navigation';
import Link from 'next/link';
import {
  getOrgProfileBySlug,
  getOrgProjectBySlug,
} from '@/lib/services/org-dashboard-service';
import { getJourney } from '@/lib/services/journey-service';
import { JourneyBuilderClient } from './journey-builder-client';

export default async function JourneyBuilderPage({
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

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black flex flex-col">
      {/* Header */}
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-[1600px] px-4 py-4">
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href={`/org/${slug}`} className="hover:text-white transition-colors">
              {profile.name}
            </Link>
            <span>&rsaquo;</span>
            <Link href={`/org/${slug}/${projectSlug}`} className="hover:text-white transition-colors">
              {project.name}
            </Link>
            <span>&rsaquo;</span>
            <Link href={`/org/${slug}/${projectSlug}/journeys`} className="hover:text-white transition-colors">
              Journeys
            </Link>
            <span>&rsaquo;</span>
            <span className="text-white font-bold">{journey.title}</span>
          </nav>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-bauhaus-red">Journey Builder</p>
              <h1 className="text-xl font-black uppercase tracking-wider">{journey.title}</h1>
            </div>
            <Link
              href={`/org/${slug}/${projectSlug}/journeys/${journeyId}/map`}
              className="text-sm bg-white text-bauhaus-black px-4 py-2 rounded font-bold uppercase tracking-wider hover:bg-gray-100 transition-colors"
            >
              View Map &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Builder (client component) */}
      <JourneyBuilderClient
        orgProfileId={profile.id}
        journeyId={journeyId}
        initialJourney={journey}
      />
    </main>
  );
}
