import { notFound } from 'next/navigation';
import { getOpportunityIntelligence } from '@/lib/opportunity-intelligence';
import { buildActResourceDesk } from '@/lib/services/act-resource-desk';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { ActResourceDesk } from './resource-desk';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return {
    title: 'ACT | Resource desk',
    description:
      'A cross-project decision desk connecting verified opportunities to real ACT matters and concrete actions.',
  };
}

export default async function ActResourceDeskPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile =
    shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const intelligence = await getOpportunityIntelligence({ limit: 300 });
  return (
    <ActResourceDesk
      snapshot={buildActResourceDesk(intelligence)}
      orgProfileId={profile.id}
    />
  );
}
