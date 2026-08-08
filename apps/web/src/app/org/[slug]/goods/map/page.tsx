import { notFound } from 'next/navigation';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsDeliveredPoints } from '@/lib/services/goods-atlas-points';
import { getRemoteCouncils } from '@/lib/services/council-place-report';
import { getCanonical } from '@/lib/services/goods-canonical-numbers';
import AtlasClient, { type CouncilPageLink } from '@/app/atlas/atlas-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Goods on the map — CivicGraph',
  description:
    'The org-side Atlas with the Goods-in-community layer enabled: what the asset ' +
    'register can place, over the same public layers everyone sees.',
};

/**
 * The Atlas, org-side, with the Goods layer enabled.
 *
 * This page is the 'org' consent tier in practice: it sits behind the /org
 * middleware login gate, and the Goods points exist only in this server
 * render — the public /atlas fetches nothing Goods-shaped and its bundle
 * carries no Goods figure. Public activation stays per-place and waits on
 * the consent conversation (step 5 of the Atlas plan), by design.
 */
export default async function GoodsAtlasPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const org = await getOrgProfileBySlug(slug);
  if (!org) notFound();

  let points = [] as Awaited<ReturnType<typeof getGoodsDeliveredPoints>>;
  let councilPages: CouncilPageLink[] = [];
  try {
    [points, councilPages] = await Promise.all([
      getGoodsDeliveredPoints(),
      getRemoteCouncils().then(councils =>
        councils.map(c => ({ slug: c.slug, lgaName: c.lgaName, state: c.state }))
      ),
    ]);
  } catch {
    // The map without points still stands; the layer note says what is missing.
  }

  // Canon figures travel server-side only — never in the registry, which
  // ships to public bundles. Claim labels per goods-canonical-numbers.
  const canonBeds = getCanonical('deployed_bed_units');
  const itemised = points.reduce((sum, p) => sum + p.value, 0);
  const layerNote =
    points.length === 0
      ? 'The register feed did not load; no points are drawn.'
      : `The canonical count is ${String(canonBeds?.value ?? '540')} deployed beds (verified ${canonBeds?.asOf ?? '2026-07-25'}); ` +
        `the register itemises ${itemised} units by place across these ${points.length} communities. ` +
        'The gap is mostly Stretch Beds, which the canon counts but the register does not itemise per place.';

  return (
    <AtlasClient
      surface="org"
      councilPages={councilPages}
      pointsByLayer={{ 'goods-delivered': points }}
      layerNotes={{ 'goods-delivered': layerNote }}
      initialLayerKey="goods-delivered"
      backLink={{ href: `/org/${slug}/goods`, label: 'Back to Goods' }}
    />
  );
}
