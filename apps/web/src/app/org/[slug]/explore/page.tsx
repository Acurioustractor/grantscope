import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { searchActAtlas, type ActAtlasRecordType } from '@/lib/services/act-atlas';
import { ActAtlasExplorer } from './act-atlas-explorer';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return {
    title: 'ACT Atlas — CivicGraph',
    description: 'A unified view of the communities, people, organisations, funding, procurement, and projects connected to ACT.',
  };
}

const RECORD_TYPES: ActAtlasRecordType[] = ['place', 'community', 'person', 'organisation', 'funder', 'project', 'opportunity'];
const STATES = new Set(['ACT', 'NSW', 'NT', 'QLD', 'SA', 'TAS', 'VIC', 'WA']);

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function ActAtlasPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  if (!isActSlug(slug)) notFound();

  const values = await searchParams;
  const query = firstValue(values.q);
  const requestedType = firstValue(values.type) as ActAtlasRecordType;
  const type = RECORD_TYPES.includes(requestedType) ? requestedType : undefined;
  const requestedState = firstValue(values.state).toUpperCase();
  const state = STATES.has(requestedState) ? requestedState : undefined;
  const mode = firstValue(values.mode) === 'map' ? 'map' : 'list';
  const storedProfile = await getOrgProfileBySlug(slug);
  const profile = storedProfile ?? ACT_FAST_PROFILE;
  const data = await searchActAtlas({
    orgProfileId: profile.id,
    slug,
    query,
    type,
    state,
    limit: 16,
  });

  return (
    <ActAtlasExplorer
      slug={slug}
      data={data}
      initialType={type}
      initialState={state}
      initialMode={mode}
    />
  );
}
