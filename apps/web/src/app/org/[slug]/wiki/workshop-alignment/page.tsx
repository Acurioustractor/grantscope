import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import {
  goodsCoreWorkAreas,
  goodsMoneyPileRows,
  goodsOperatingFacts,
  goodsPeoplePileRows,
  goodsTargetPileRows,
} from '@/lib/services/goods-operating-system';
import { MoneyPeopleKanban } from './money-people-kanban';

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (shouldUseFastLocalOrg() && isActSlug(slug)) {
    return {
      title: `Money + People - ${ACT_FAST_PROFILE.name} - CivicGraph`,
      description: 'ACT money, people, targets, and blockers.',
    };
  }
  const profile = await getOrgProfileBySlug(slug);
  return {
    title: profile ? `Money + People - ${profile.name} - CivicGraph` : 'Money + People - CivicGraph',
    description: 'ACT money, people, targets, and blockers.',
  };
}

export default async function WorkshopAlignmentWikiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug)
    ? ACT_FAST_PROFILE
    : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const totals = [
    { label: 'Goods received', value: '$445,685' },
    { label: 'ACT-GD recorded', value: '$537,595' },
    { label: 'Receivables', value: '~$507K' },
    { label: 'Live asks', value: '$2.4M+' },
    { label: 'Minderoo pitch', value: '$900K' },
    { label: 'QBE ask', value: '~$210K' },
    { label: 'REAL EOI', value: '$1.2M' },
    { label: 'PFI path', value: '$640K+' },
  ];

  const actionRows = [
    { label: '1', work: 'Last 50 bed cost sheet', owner: 'Ben', href: `/org/${slug}/goods` },
    { label: '2', work: 'Entity option memo', owner: 'Ben / Nic', href: `/org/${slug}/goods` },
    { label: '3', work: 'QBE pack', owner: 'Ben', href: `/org/${slug}/wiki/sources/catalysing-impact-application-draft-grant-application` },
    { label: '4', work: 'Buyer offer', owner: 'Goods / ACT', href: '/opportunities/ecosystem?project=goods&lane=procurement' },
    { label: '5', work: 'GHL follow-ups', owner: 'Ben', href: `/org/${slug}/contacts` },
  ];

  return (
    <main className="min-h-screen bg-gray-50 text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-white">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <nav className="mb-3 flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500">
            <Link href={`/org/${slug}`} className="hover:text-bauhaus-red">
              {profile.name}
            </Link>
            <span>/</span>
            <span className="text-bauhaus-black">Money + people pile</span>
          </nav>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-4xl font-black uppercase tracking-wide">Money + people pile</h1>
              <div className="mt-2 text-sm font-black uppercase tracking-widest text-bauhaus-red">
                All dollars. All people. Current blockers.
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/org/${slug}/goods`} className="border border-bauhaus-black bg-bauhaus-black px-4 py-3 text-[11px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-red">
                Goods
              </Link>
              <Link href={`/org/${slug}/contacts`} className="border border-bauhaus-blue bg-white px-4 py-3 text-[11px] font-black uppercase tracking-widest text-bauhaus-blue hover:bg-link-light">
                Contacts
              </Link>
              <Link href="/opportunities/ecosystem?project=goods" className="border border-gray-300 bg-white px-4 py-3 text-[11px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas">
                Opportunities
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        <MoneyPeopleKanban
          orgSlug={slug}
          totals={totals}
          operatingFacts={goodsOperatingFacts}
          moneyRows={goodsMoneyPileRows}
          peopleRows={goodsPeoplePileRows}
          targetRows={goodsTargetPileRows}
          blockerRows={goodsCoreWorkAreas}
          actionRows={actionRows}
        />
      </div>
    </main>
  );
}
