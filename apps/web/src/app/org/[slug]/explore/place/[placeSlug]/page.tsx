import { notFound } from 'next/navigation';
import { ActPlaceFieldWorkspace } from '../../../barkly/barkly-regional-field';
import { ACT_FAST_PROFILE, isActSlug } from '@/lib/services/fast-local-org';
import { loadActPlaceField } from '@/lib/services/act-barkly-field';
import { getActPlaceFieldDefinition } from '@/lib/services/act-place-fields';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ placeSlug: string }>;
}) {
  const { placeSlug } = await params;
  const place = getActPlaceFieldDefinition(placeSlug);
  return {
    title: place ? `${place.name} Place Field — CivicGraph` : 'Place Field — CivicGraph',
    description: place?.description ?? 'A connected ACT investigation of place, people, organisations, work, money, evidence and next moves.',
  };
}

export default async function ActPlaceFieldPage({
  params,
}: {
  params: Promise<{ slug: string; placeSlug: string }>;
}) {
  const { slug, placeSlug } = await params;
  if (!isActSlug(slug)) notFound();

  const place = getActPlaceFieldDefinition(placeSlug);
  if (!place) notFound();

  const storedProfile = await getOrgProfileBySlug(slug);
  const profile = storedProfile ?? ACT_FAST_PROFILE;

  if (place.loader !== 'civicgraph-place-field') notFound();
  const field = await loadActPlaceField(place, profile.id);

  return (
    <ActPlaceFieldWorkspace
      slug={slug}
      place={place}
      field={field}
      empathyLedgerUrl={process.env.EMPATHY_LEDGER_URL ?? null}
    />
  );
}
