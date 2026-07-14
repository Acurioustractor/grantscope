import { notFound, redirect } from 'next/navigation';
import { isActSlug } from '@/lib/services/fast-local-org';
import { actPlaceFieldHref } from '@/lib/services/act-place-fields';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return {
    title: 'Barkly Regional Field — CivicGraph',
    description: 'A relational field connecting Barkly communities, Regional Deal initiatives, organisations, public evidence, Goods, JusticeHub and consented stories.',
  };
}

export default async function BarklyRegionalFieldPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isActSlug(slug)) notFound();

  redirect(actPlaceFieldHref(slug, 'barkly'));
}
