import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsGrantsTriage, type TriageGrantRow } from '@/lib/services/goods-grants-triage';
import { GoodsSubNav } from '../_components/goods-sub-nav';
import { PushGrantGhlButton } from './push-grant-ghl-button';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods — Grants Triage' };
}

function money(v: number | null): string {
  if (!v || v <= 0) return '—';
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${Math.round(v / 1e3)}K`;
  return `$${Math.round(v)}`;
}

function relAgo(iso: string | null): string {
  if (!iso) return 'never';
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
}

function DeadlinePill({ days }: { days: number | null }) {
  if (days == null) return <span className="text-[10px] font-bold text-gray-400">rolling / undated</span>;
  const cls = days <= 14 ? 'bg-bauhaus-red text-white' : days <= 45 ? 'bg-bauhaus-yellow text-bauhaus-black' : 'bg-bauhaus-canvas text-bauhaus-black border-2 border-bauhaus-black/20';
  return (
    <span className={`px-1.5 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider ${cls}`}>
      {days === 0 ? 'today' : `${days}d`}
    </span>
  );
}

export default async function GoodsGrantsTriagePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ geo?: string; fit?: string; scope?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const minFit = sp.fit === 'high' ? 70 : undefined;
  const { grants, summary, sources } = await getGoodsGrantsTriage({
    geography: sp.geo,
    minFit,
    scope: sp.scope === 'closing' ? 'closing' : 'all',
  });

  const base = `/org/${slug}/goods/grants`;
  const href = (patch: Record<string, string | undefined>) => {
    const merged = { geo: sp.geo, fit: sp.fit, scope: sp.scope, ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const geoOrder = Object.entries(summary.byGeography).sort((a, b) => b[1] - a[1]);
  const staleSources = sources.filter((s) => s.enabled && s.lastRunAt && Date.now() - new Date(s.lastRunAt).getTime() > 3 * 86_400_000);

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Grants Triage</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Grants Triage</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            The <strong className="text-white">live</strong> grant landscape only — {summary.liveTotal.toLocaleString('en-AU')} open,
            ongoing or upcoming opportunities cut from a corpus of {summary.corpusTotal.toLocaleString('en-AU')}, sorted
            deadline-first because grants are deadline-driven, not stage-driven. Scored for Goods fit.
          </p>
          <GoodsSubNav slug={slug} active="grants" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 space-y-4">
        {/* Summary cells */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Cell label="Live opportunities" value={summary.liveTotal} accent />
          <Cell label="Closing ≤ 30 days" value={summary.closingSoon} />
          <Cell label="High fit (70+)" value={summary.highFit} />
          <Cell label="With hard deadline" value={summary.withDeadline} />
        </div>

        {/* Coverage note */}
        <div className="border-4 border-bauhaus-black bg-white p-3 text-xs">
          <span className="font-black uppercase tracking-wider">Coverage:</span>{' '}
          NT is scraped daily via <code className="bg-bauhaus-canvas px-1">scrape-state-grants</code> (NT Grants Directory +
          GrantsNT portal). WA dominates the live set ({summary.byGeography['WA'] ?? 0} rows) because its portal publishes the
          most — volume by state reflects publishing habits, not opportunity. Philanthropic rounds beyond
          <code className="bg-bauhaus-canvas px-1">foundation_program</code> remain the thinnest stream.
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-black uppercase tracking-wider">Scope:</span>
          <Pill href={href({ scope: undefined })} active={sp.scope !== 'closing'} label="All live" />
          <Pill href={href({ scope: 'closing' })} active={sp.scope === 'closing'} label="Closing ≤ 60d" />
          <Pill href={href({ fit: sp.fit === 'high' ? undefined : 'high' })} active={sp.fit === 'high'} label="High fit only (70+)" />
          <span className="ml-4 font-black uppercase tracking-wider">Where:</span>
          <Pill href={href({ geo: undefined })} active={!sp.geo} label="All" />
          {geoOrder.slice(0, 8).map(([g, n]) => (
            <Pill key={g} href={href({ geo: sp.geo === g ? undefined : g })} active={sp.geo === g} label={`${g} (${n})`} />
          ))}
        </div>

        {/* Table */}
        <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-bauhaus-black text-white">
              <tr>
                <Th>Deadline</Th>
                <Th>Grant</Th>
                <Th>Provider</Th>
                <Th align="right">Fit</Th>
                <Th align="right">Amount</Th>
                <Th>Where</Th>
                <Th>Entity fit</Th>
                <Th>Pipeline</Th>
              </tr>
            </thead>
            <tbody>
              {grants.length === 0 ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">Nothing matches this filter.</td></tr>
              ) : (
                grants.map((g, i) => <Row key={g.id} g={g} alt={i % 2 === 1} />)
              )}
            </tbody>
          </table>
        </div>
        {grants.length === 300 && (
          <p className="text-[10px] font-bold text-bauhaus-muted">Showing the first 300 — tighten the filters to see the rest.</p>
        )}

        {/* Source freshness */}
        <div className="border-4 border-bauhaus-black bg-white p-4">
          <div className="text-xs font-black uppercase tracking-widest">What we&apos;re searching &amp; when it last ran</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {sources.map((s) => {
              const stale = s.enabled && s.lastRunAt && Date.now() - new Date(s.lastRunAt).getTime() > 3 * 86_400_000;
              return (
                <div key={s.agentId} className={`border-2 p-2 text-[11px] ${!s.enabled ? 'border-gray-300 bg-gray-100 text-gray-500' : stale ? 'border-bauhaus-red bg-red-50' : 'border-bauhaus-black/30'}`}>
                  <div className="font-mono font-black">{s.agentId}</div>
                  <div className="mt-0.5">
                    {s.enabled ? `every ${s.intervalHours}h` : 'disabled'} · last {relAgo(s.lastRunAt)}
                    {s.lastStatus && <span className={s.lastStatus === 'failed' ? ' text-bauhaus-red font-black' : ''}> · {s.lastStatus}{s.lastItemsNew != null ? ` (+${s.lastItemsNew})` : ''}</span>}
                  </div>
                </div>
              );
            })}
          </div>
          {staleSources.length > 0 && (
            <p className="mt-2 text-[11px] font-bold text-bauhaus-red">{staleSources.length} enabled source{staleSources.length === 1 ? '' : 's'} haven&apos;t run in 3+ days.</p>
          )}
        </div>

        <div className="border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          <p className="font-black uppercase tracking-wider">How to read this</p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li>Only rows with status open / ongoing / upcoming appear — the 26K corpus includes ~16K closed and ~5K unknown rows that inflate raw counts.</li>
            <li><strong>Entity fit</strong>: DGR-gated grants route via Butterfly Movement Ltd; Pty-eligible ones can go through A Curious Tractor Pty Ltd t/a Goods on Country.</li>
            <li>Fit score is model-derived (<code className="bg-white px-1">goods_relevance_score</code>) — verify eligibility before drafting anything.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}

function Cell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`border-4 border-bauhaus-black ${accent ? 'bg-bauhaus-yellow' : 'bg-white'} p-3`}>
      <div className="text-2xl font-black tabular-nums">{value.toLocaleString('en-AU')}</div>
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

function Row({ g, alt }: { g: TriageGrantRow; alt: boolean }) {
  return (
    <tr className={alt ? 'bg-bauhaus-canvas' : ''}>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top whitespace-nowrap"><DeadlinePill days={g.daysToDeadline} /></td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top max-w-96">
        {g.url ? (
          <a href={g.url} target="_blank" rel="noopener noreferrer" className="font-black hover:text-bauhaus-red hover:underline">{g.name}</a>
        ) : (
          <span className="font-black">{g.name}</span>
        )}
        {g.pipelineStage && g.pipelineStage !== 'discovered' && (
          <span className="ml-2 bg-bauhaus-blue px-1.5 py-0.5 font-mono text-[9px] font-black uppercase tracking-wider text-white">{g.pipelineStage}</span>
        )}
      </td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top max-w-56">{g.provider || '—'}</td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top text-right font-mono font-black">{g.goodsScore ?? '—'}</td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top text-right font-mono whitespace-nowrap">
        {g.amountMax ? `${money(g.amountMin)}–${money(g.amountMax)}` : money(g.amountMin)}
      </td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top font-mono">{g.geography}</td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top whitespace-nowrap">
        {g.dgrRequired ? (
          <span className="bg-bauhaus-yellow px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider" title="Route via Butterfly Movement Ltd (Item 1 DGR)">via Butterfly</span>
        ) : g.acceptsPtyLtd ? (
          <span className="bg-bauhaus-canvas px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider border border-bauhaus-black/30" title="A Curious Tractor Pty Ltd t/a Goods on Country">Pty OK</span>
        ) : (
          <span className="text-gray-400">check</span>
        )}
      </td>
      <td className="border-b border-gray-300 px-2 py-1.5 align-top whitespace-nowrap">
        <PushGrantGhlButton g={g} />
      </td>
    </tr>
  );
}
