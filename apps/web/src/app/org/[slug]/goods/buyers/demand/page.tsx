import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isActSlug } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsDemandMap, type CommunityRole, type GovBuyer } from '@/lib/services/goods-demand-map';
import { GoodsSubNav } from '../../_components/goods-sub-nav';
import { money } from '@/lib/format';

/**
 * Goods: who buys beds and whitegoods for people in communities.
 * Government purchases on record (vetted by title), then community organisations shaped like the
 * buyers Goods already has. Prison and detention purchases are listed apart, collapsed, pending
 * Ben's call on whether Goods sells into them.
 */

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Who buys beds' };
}

const STATES = ['NT', 'WA', 'QLD', 'SA', 'NSW'] as const;

function GovTable({ buyers, limit }: { buyers: GovBuyer[]; limit: number }) {
  return (
    <div className="border-4 border-bauhaus-black bg-white">
      {buyers.slice(0, limit).map((b) => (
        <details key={`${b.kind}|${b.buyer}`} className="border-b-2 border-bauhaus-black/10 px-4 py-3 last:border-b-0">
          <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-2">
            <span className="font-bold">{b.buyer}</span>
            <span className="text-[12px] text-bauhaus-muted">
              {b.purchases.length} purchase{b.purchases.length === 1 ? '' : 's'} · {b.total > 0 ? money(b.total) : 'no value recorded'} · last {b.last ?? 'undated'}
            </span>
          </summary>
          <ul className="mt-2 space-y-1 text-[12px]">
            {b.purchases.map((p, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2">
                <span>{p.title}</span>
                <span className="text-bauhaus-muted">
                  {p.value != null ? money(p.value) : 'no value'} · {p.date ?? 'undated'} · {p.source === 'austender' ? 'AusTender' : 'QLD tenders'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}

export default async function GoodsDemandPage({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ state?: string; role?: string }>;
}) {
  const { slug } = await params;
  if (!isActSlug(slug)) notFound();
  const { state, role } = await searchParams;
  const profile = await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const map = await getGoodsDemandMap();
  const roles = [...new Set(map.community.map((c) => c.role))] as CommunityRole[];
  const community = map.community.filter((c) => (!state || c.state === state) && (!role || c.role === role));
  const q = (next: { state?: string; role?: string }) => {
    const p = new URLSearchParams();
    const s = 'state' in next ? next.state : state;
    const r = 'role' in next ? next.role : role;
    if (s) p.set('state', s);
    if (r) p.set('role', r);
    const qs = p.toString();
    return `/org/${slug}/goods/buyers/demand${qs ? `?${qs}` : ''}`;
  };
  const chip = (on: boolean) =>
    `border-2 px-2.5 py-1 text-[11px] font-black uppercase tracking-widest ${on ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black/30 bg-white text-bauhaus-black hover:border-bauhaus-black'}`;

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-[1760px] px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods/buyers`} className="hover:text-white">Buyers</Link>
            <span>/</span>
            <span className="text-white">Who buys beds</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Who buys beds</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            Organisations that have bought beds, mattresses or whitegoods for people to live with, and community
            organisations shaped like the ones already buying from Goods.
          </p>
          <div className="print:hidden">
            <GoodsSubNav slug={slug} active="buyers" />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1760px] space-y-8 px-4 py-6">
        <section>
          <h2 className="mb-1 text-lg font-black uppercase tracking-widest">Bought before: {map.household.length} government buyers</h2>
          <p className="mb-3 text-[12px] text-bauhaus-muted">
            Contract titles from AusTender and QLD state tenders, with roadside furniture, hospital beds, houses and office
            fit-outs taken out. WA, SA and NSW state tenders are not in the data, so their absence here says nothing.
          </p>
          <GovTable buyers={map.household} limit={60} />
        </section>

        <section>
          <h2 className="mb-1 text-lg font-black uppercase tracking-widest">Community buyers: {community.length} organisations</h2>
          <p className="mb-3 text-[12px] text-bauhaus-muted">
            Remote and very remote organisations whose name reads as a health service, hostel, housing body, council,
            homeland centre, store, school or aged, women&apos;s or youth service. Ranked by recorded money in across every
            dataset: a sign of budget, not of bed spending. The role is read from the name, so check it before calling.
          </p>
          <div className="mb-3 flex flex-wrap gap-2">
            <Link href={q({ state: undefined })} className={chip(!state)}>All states</Link>
            {STATES.map((s) => <Link key={s} href={q({ state: s })} className={chip(state === s)}>{s}</Link>)}
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <Link href={q({ role: undefined })} className={chip(!role)}>All roles</Link>
            {roles.map((r) => <Link key={r} href={q({ role: r })} className={chip(role === r)}>{r}</Link>)}
          </div>
          <div className="overflow-x-auto border-4 border-bauhaus-black bg-white">
            <table className="w-full text-[12px]">
              <thead className="border-b-2 border-bauhaus-black text-left text-[11px] font-black uppercase tracking-widest">
                <tr><th className="px-3 py-2">Organisation</th><th className="px-3 py-2">Role</th><th className="px-3 py-2">State</th><th className="px-3 py-2">Community controlled</th><th className="px-3 py-2 text-right">Money in (recorded)</th></tr>
              </thead>
              <tbody>
                {community.slice(0, 150).map((c) => (
                  <tr key={c.id} className="border-b border-bauhaus-black/10">
                    <td className="px-3 py-2 font-bold">
                      {c.gsId ? <Link href={`/entity/${c.gsId}`} className="hover:underline">{c.name}</Link> : c.name}
                    </td>
                    <td className="px-3 py-2">{c.role}</td>
                    <td className="px-3 py-2">{c.state ?? '–'}</td>
                    <td className="px-3 py-2">{c.communityControlled ? 'Yes' : '–'}</td>
                    <td className="px-3 py-2 text-right">{money(c.moneyIn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {community.length > 150 && <p className="px-3 py-2 text-[11px] text-bauhaus-muted">Showing 150 of {community.length}. Narrow by state or role.</p>}
          </div>
        </section>

        <section>
          <details>
            <summary className="cursor-pointer text-lg font-black uppercase tracking-widest">
              Prisons and detention: {map.custodial.length} buyers, kept apart
            </summary>
            <p className="my-3 text-[12px] text-bauhaus-muted">
              Corrective services, youth justice and police buy bedding in bulk. Whether Goods sells into them is not decided,
              so they are listed here and nowhere else.
            </p>
            <GovTable buyers={map.custodial} limit={40} />
          </details>
        </section>
      </div>
    </main>
  );
}
