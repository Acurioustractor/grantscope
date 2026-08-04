import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { ARCHETYPE_LABELS, getGoodsChannels, type ChannelArchetype, type ChannelRow } from '@/lib/services/goods-channels';
import { GoodsWorkspaceHeader } from '../_components/goods-capital-ui';

export const revalidate = 300;

export async function generateMetadata() {
  return { title: 'Goods Channels - CivicGraph' };
}

function money(v: number | null): string {
  if (!v) return '—';
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}

export default async function GoodsChannelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ archetype?: string; lga?: string; scope?: string; q?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug)
    ? ACT_FAST_PROFILE
    : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const { channels, summary } = await getGoodsChannels({
    archetype: sp.archetype,
    lga: sp.lga,
    scope: sp.scope === 'pipeline' ? 'pipeline' : 'all',
    search: sp.q,
  });

  const base = `/org/${slug}/goods/channels`;
  const href = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { archetype: sp.archetype, lga: sp.lga, scope: sp.scope, q: sp.q, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const archetypeOrder: ChannelArchetype[] = [
    'health_service', 'housing_logistics', 'womens_council', 'community_store', 'land_council', 'other',
  ];

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <GoodsWorkspaceHeader
        slug={slug}
        orgName={profile.name}
        active="channels"
        eyebrow="Demand → channel → home"
        title="Channels"
        description={(
          <>
            Community-controlled organisations in Central Australia that can carry beds and washing machines the last
            mile — health services, housing and outstation logistics, women&apos;s councils and community stores — with
            funding scale as a capacity proxy and the Goods pipeline state alongside.
          </>
        )}
        aside={(
          <div className="border-4 border-white bg-white px-4 py-3 text-bauhaus-black">
            <div className="text-[10px] font-black uppercase tracking-widest text-gray-600">In pipeline</div>
            <div className="mt-1 text-3xl font-black tabular-nums">{summary.in_pipeline} / {summary.total}</div>
            <div className="mt-1 text-[10px] font-bold text-gray-600">channel orgs engaged</div>
          </div>
        )}
      />

      <div className="mx-auto max-w-[1760px] px-4 py-6 space-y-4">
        {/* Archetype cells double as filters */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {archetypeOrder.map((a) => {
            const s = summary.by_archetype[a] || { total: 0, in_pipeline: 0 };
            const active = sp.archetype === a;
            return (
              <Link
                key={a}
                href={href({ archetype: active ? undefined : a })}
                className={`border-4 border-bauhaus-black p-3 transition-colors ${active ? 'bg-bauhaus-black text-white' : 'bg-white hover:bg-bauhaus-yellow'}`}
              >
                <div className="text-2xl font-black tabular-nums">
                  {s.in_pipeline}<span className={active ? 'text-white/50' : 'text-gray-400'}> / {s.total}</span>
                </div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-widest">{ARCHETYPE_LABELS[a]}</div>
              </Link>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-black uppercase tracking-wider">Scope:</span>
          <Pill href={href({ scope: undefined })} active={sp.scope !== 'pipeline'} label={`All ${summary.total}`} />
          <Pill href={href({ scope: 'pipeline' })} active={sp.scope === 'pipeline'} label={`In pipeline (${summary.in_pipeline})`} />
          <span className="ml-4 font-black uppercase tracking-wider">Council:</span>
          <Pill href={href({ lga: undefined })} active={!sp.lga} label="All" />
          {Object.entries(summary.by_lga).sort((x, y) => y[1] - x[1]).map(([lga, n]) => (
            <Pill key={lga} href={href({ lga: sp.lga === lga ? undefined : lga })} active={sp.lga === lga} label={`${lga} (${n})`} />
          ))}
        </div>

        {/* Table */}
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-bauhaus-black text-white">
              <tr>
                <Th>Organisation</Th>
                <Th>Archetype</Th>
                <Th>Council</Th>
                <Th>Size</Th>
                <Th align="right">Traceable funding</Th>
                <Th>Stage</Th>
                <Th align="right">Warmth</Th>
                <Th>Next action</Th>
              </tr>
            </thead>
            <tbody>
              {channels.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">No channels match this filter.</td></tr>
              ) : (
                channels.map((c, i) => <Row key={c.entity_id + (c.goods_relationship_id ?? '')} c={c} alt={i % 2 === 1} />)
              )}
            </tbody>
          </table>
        </div>

        <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          <p className="font-black uppercase tracking-wider">How to read this</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Traceable funding is a capacity proxy from contracts + grants (v_org_funding_profile), not money available to Goods.</li>
            <li>Archetype is classified from the organisation&apos;s name — language-named organisations can land in Other (e.g. Waltja is a women&apos;s-council-type org).</li>
            <li>Blank stage means the organisation is not yet in the Goods pipeline — that is the prospect list, ordered by capacity.</li>
          </ul>
        </div>
      </div>
    </main>
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

function Row({ c, alt }: { c: ChannelRow; alt: boolean }) {
  const stageBg = c.stage === 'repeat' || c.stage === 'committed' ? 'bg-bauhaus-red text-white' :
    c.stage === 'in_conversation' || c.stage === 'proposal' ? 'bg-bauhaus-yellow' :
    c.stage ? 'bg-bauhaus-canvas' : '';
  return (
    <tr className={alt ? 'bg-bauhaus-canvas' : ''}>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top">
        <span className="font-black">{c.canonical_name}</span>
        {c.abn && <div className="font-mono text-[10px] text-gray-500">ABN {c.abn}</div>}
      </td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top">{ARCHETYPE_LABELS[c.channel_archetype]}</td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top">{c.lga_name || '—'}</td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top">{c.oric_size || '—'}</td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top text-right font-mono font-black">{money(c.total_traceable_value)}</td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top">
        {c.stage ? (
          <span className={`${stageBg} px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider`}>{c.stage}</span>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top text-right font-mono">{c.warmth_display ?? '—'}</td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top max-w-72">{c.next_action || '—'}</td>
    </tr>
  );
}
