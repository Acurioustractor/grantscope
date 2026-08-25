import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsCommunitiesHub, type CommunityHubRow } from '@/lib/services/goods-communities-hub';

// This is a live operational register. Caching the route can leave the initial
// HTML on an older component shape than the streamed RSC tree during local
// development, which produces a hydration mismatch as well as stale counts.
export const dynamic = 'force-dynamic';

function relAgo(iso: string | null, nowMs: number): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (isNaN(t)) return '—';
  const days = Math.round((nowMs - t) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
}

export async function generateMetadata() {
  return { title: 'Goods Communities Hub - CivicGraph' };
}

export default async function GoodsCommunitiesHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ scope?: string; state?: string; q?: string; sort?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug)
    ? ACT_FAST_PROFILE
    : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const scope = (sp.scope as 'active' | 'lead' | 'all' | 'with_deployments') || 'active';
  const sort = (sp.sort as 'priority' | 'serve_next') || 'priority';
  const { communities, summary } = await getGoodsCommunitiesHub({
    scope,
    state: sp.state,
    search: sp.q,
    sort,
  });
  const renderedAtMs = Date.now();

  // Sort toggle hrefs that preserve scope / state / search.
  const baseParams = new URLSearchParams();
  if (scope !== 'active') baseParams.set('scope', scope);
  if (sp.state) baseParams.set('state', sp.state);
  if (sp.q) baseParams.set('q', sp.q);
  const sortHref = (s: 'priority' | 'serve_next') => {
    const p = new URLSearchParams(baseParams);
    if (s !== 'priority') p.set('sort', s);
    const qs = p.toString();
    return `/org/${slug}/goods/communities${qs ? `?${qs}` : ''}`;
  };

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-[1760px] px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Communities</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Goods Communities</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            Showing {communities.length} communities. Click any row for the full community detail page (buyers, signals, matched grants, push to GHL).
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-[1760px] px-4 py-6 space-y-4">
        {/* Summary cells */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <Cell label="Communities" value={summary.total} accent />
          <Cell label="Most disadvantaged (≤D3)" value={summary.high_disadvantage} />
          <Cell label="With deployments" value={summary.with_deployments} />
          <Cell label="With open signals" value={summary.with_open_signals} />
          <Cell label="Beds demanded" value={summary.total_beds_demanded} />
          <Cell label="Beds deployed in this view" value={summary.total_beds_deployed} />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-black uppercase tracking-wider">Scope:</span>
          <Pill href={`/org/${slug}/goods/communities`} active={scope === 'active'} label={`Active (lead+active+warm)`} />
          <Pill href={`/org/${slug}/goods/communities?scope=lead`} active={scope === 'lead'} label="Lead only" />
          <Pill href={`/org/${slug}/goods/communities?scope=with_deployments`} active={scope === 'with_deployments'} label="With deployments" />
          <Pill href={`/org/${slug}/goods/communities?scope=all`} active={scope === 'all'} label="All communities" />

          <span className="ml-4 font-black uppercase tracking-wider">State:</span>
          <Pill href={`/org/${slug}/goods/communities${scope !== 'active' ? `?scope=${scope}` : ''}`} active={!sp.state} label="All" />
          {Object.entries(summary.by_state).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([st, n]) => (
            <Pill
              key={st}
              href={`/org/${slug}/goods/communities?state=${st}${scope !== 'active' ? `&scope=${scope}` : ''}`}
              active={sp.state === st}
              label={`${st} (${n})`}
            />
          ))}
        </div>

        {/* Sort */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-black uppercase tracking-wider">Sort:</span>
          <Pill href={sortHref('priority')} active={sort === 'priority'} label="Priority" />
          <Pill href={sortHref('serve_next')} active={sort === 'serve_next'} label="Serve next (SEIFA × unmet beds)" />
        </div>

        {/* Table */}
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-bauhaus-black text-white">
              <tr>
                <Th>Community</Th>
                <Th>State</Th>
                <Th>Region / LC</Th>
                <Th>Priority</Th>
                <Th>Disadv. / Serve</Th>
                <Th align="right">Beds (D / Demand)</Th>
                <Th align="right">Washers (D / Demand)</Th>
                <Th align="right">Open signals</Th>
                <Th align="right">Buyers (GHL)</Th>
                <Th>Last action</Th>
              </tr>
            </thead>
            <tbody>
              {communities.length === 0 ? (
                <tr><td colSpan={10} className="px-3 py-6 text-center text-gray-500">No communities match this filter.</td></tr>
              ) : (
                communities.map((c, i) => <Row key={c.id} c={c} alt={i % 2 === 1} orgSlug={slug} renderedAtMs={renderedAtMs} />)
              )}
            </tbody>
          </table>
        </div>

        <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          <p className="font-black uppercase tracking-wider">Trip prep checklist (next visit)</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Filter to <code className="bg-white px-1">scope=lead</code> for the highest-priority NT/QLD set</li>
            <li>Click any community for buyers, signals, matched grants, and Push-to-GHL</li>
            <li>Sort by demand to surface largest unmet beds first</li>
            <li>Beds-deployed column is sourced from <code className="bg-white px-1">goods_communities.assets_deployed</code>. This counter currently shows 0 or 1 for most rows — the actual Goods asset register isn't yet syncing back. Phase B will add this.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

function Cell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`border-4 border-bauhaus-black ${accent ? 'bg-bauhaus-yellow' : 'bg-white'} p-3`}>
      <div className="text-2xl font-black">{value.toLocaleString('en-AU')}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-700">{label}</div>
    </div>
  );
}

function Pill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`border-2 ${active ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-canvas'} px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider`}
    >
      {label}
    </Link>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`border-b-2 border-bauhaus-black px-2 py-1.5 text-left font-black uppercase tracking-wider text-[10px] ${align === 'right' ? 'text-right' : ''}`}>{children}</th>;
}

function Row({ c, alt, orgSlug, renderedAtMs }: { c: CommunityHubRow; alt: boolean; orgSlug: string; renderedAtMs: number }) {
  const pBg = c.priority === 'lead' ? 'bg-bauhaus-red text-white' :
    c.priority === 'active' ? 'bg-bauhaus-yellow' :
    c.priority === 'warm' ? 'bg-bauhaus-canvas' : 'bg-gray-200';
  const deploymentGapBg = c.demand_beds > 0 && c.assets_deployed === 0 ? 'bg-bauhaus-red text-white' : '';
  const d = c.seifa_irsd_decile;
  const disadvantageBg = d == null ? '' :
    d <= 3 ? 'bg-bauhaus-red text-white' :
    d <= 7 ? 'bg-bauhaus-yellow text-bauhaus-black' :
    'bg-bauhaus-canvas text-bauhaus-black';

  return (
    <tr className={alt ? 'bg-bauhaus-canvas' : ''}>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top">
        <Link href={`/org/${orgSlug}/goods/community/${c.id}`} className="font-black hover:underline hover:text-bauhaus-red">
          {c.community_name}
        </Link>
        {c.postcode && <div className="text-[10px] text-gray-600">{c.postcode}</div>}
      </td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top font-mono">{c.state || '—'}</td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top">
        <div>{c.region_label || '—'}</div>
        {c.land_council && <div className="text-[10px] text-gray-600">{c.land_council}</div>}
      </td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top">
        <span className={`${pBg} px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider`}>{c.priority}</span>
      </td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top">
        {c.seifa_irsd_decile == null ? (
          <span className="text-gray-400">—</span>
        ) : (
          <span
            className={`${disadvantageBg} px-1.5 py-0.5 font-mono text-[10px] font-black`}
            title={`SEIFA IRSD decile ${c.seifa_irsd_decile}/10 (1 = most disadvantaged)`}
          >
            D{c.seifa_irsd_decile}
          </span>
        )}
        {c.serve_next_score > 0 && (
          <div className="mt-0.5 text-[10px] text-gray-600">serve {c.serve_next_score}</div>
        )}
      </td>
      <td className={`border-b border-gray-300 px-2 py-1.5 align-top text-right ${deploymentGapBg}`}>
        <span className="font-black">{c.assets_deployed}</span>
        <span className="text-gray-500"> / {c.demand_beds}</span>
        {c.demand_beds > 0 && (
          <div
            className="mt-1 flex h-1.5 w-16 ml-auto overflow-hidden border border-bauhaus-black/40 bg-white"
            title={`${c.assets_deployed} delivered of ${c.demand_beds} needed`}
          >
            <div className="bg-bauhaus-black" style={{ width: `${Math.min(100, (c.assets_deployed / c.demand_beds) * 100)}%` }} />
            <div className="flex-1 bg-bauhaus-red/60" />
          </div>
        )}
      </td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top text-right">
        <span className="text-gray-500">— / {c.demand_washers}</span>
      </td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top text-right">
        <div className="font-black">{c.open_signals + c.reviewing_signals}</div>
        {c.reviewing_signals > 0 && <div className="text-[10px] text-gray-600">{c.reviewing_signals} reviewing</div>}
      </td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top text-right">
        <span className="font-black">{c.mapped_buyer_count}</span>
        {c.ghl_linked_buyer_count > 0 && <span className="text-bauhaus-yellow bg-bauhaus-black px-1 ml-1 font-mono text-[9px]">{c.ghl_linked_buyer_count}↗</span>}
      </td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top">{relAgo(c.last_action_at, renderedAtMs)}</td>
    </tr>
  );
}
