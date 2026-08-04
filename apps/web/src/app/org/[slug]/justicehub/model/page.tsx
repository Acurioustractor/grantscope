import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { buildJusticeHubMatterDesk } from '@/lib/services/justicehub-matter-desk';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { JusticeHubMatterDesk } from './justicehub-matter-desk';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return {
    title: 'JusticeHub | Matter desk',
    description:
      'A decision desk connecting JusticeHub public evidence, authority, relationships and concrete actions.',
  };
}

export default async function JusticeHubMatterDeskPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const profile =
    shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  return <JusticeHubMatterDesk desk={buildJusticeHubMatterDesk()} />;
}

