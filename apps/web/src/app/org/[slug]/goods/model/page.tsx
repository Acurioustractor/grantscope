import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getGoodsLivingModelSnapshot } from '@/lib/services/goods-living-data-adapter';
import { buildGoodsMatterDesk } from '@/lib/services/goods-matter-desk';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { GoodsLivingModelExplorer } from './goods-living-model-explorer';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return {
    title: 'Goods | Place decision desk',
    description:
      'A place-first decision desk connecting Goods relationships, authority, evidence, economics and next actions.',
  };
}

export default async function GoodsLivingModelPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile =
    shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const snapshot = await getGoodsLivingModelSnapshot();
  const desk = buildGoodsMatterDesk(snapshot);

  return <GoodsLivingModelExplorer snapshot={snapshot} desk={desk} />;
}
