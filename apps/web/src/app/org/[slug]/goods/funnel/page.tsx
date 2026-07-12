import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsFunnel, SPINE, SPINE_LABELS, type PipelineFunnel } from '@/lib/services/goods-funnel';
import { GoodsSubNav } from '../_components/goods-sub-nav';

export const dynamic = 'force-dynamic';

export async function generateMetadata() {
  return { title: 'Goods Funnel — need · procurement · support' };
}

const money = (n: number) => `$${Math.round(n || 0).toLocaleString('en-AU')}`;
const num = (n: number) => (n || 0).toLocaleString('en-AU');
const shortDate = (value: string | null) => value
  ? new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value))
  : 'No activity date';

function Stat({ label, beds, washers, value, accent }: { label: string; beds?: number | null; washers?: number | null; value?: number | null; accent?: boolean }) {
  return (
    <div className={`border-4 ${accent ? 'border-bauhaus-blue bg-link-light' : 'border-bauhaus-black bg-white'} p-3`}>
      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-bauhaus-black">
        {beds != null && <span className="text-lg font-black">{num(beds)} <span className="text-xs font-bold">beds</span></span>}
        {washers != null && <span className="text-sm font-black">{num(washers)} <span className="text-[10px] font-bold">wash</span></span>}
        {value != null && <span className="text-sm font-black text-bauhaus-blue">{money(value)}</span>}
      </div>
    </div>
  );
}

function FunnelColumn({ p }: { p: PipelineFunnel }) {
  const max = Math.max(1, ...SPINE.filter(s => s !== 'dead').map(s => p.spine[s].n));
  return (
    <div className="border-4 border-bauhaus-black bg-white p-3">
      <div className="mb-2">
        <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black">{p.label}</div>
        <div className="text-[11px] text-bauhaus-muted">
          {p.total} open · {p.beds ? `${num(p.beds)} beds · ` : ''}{p.washers ? `${num(p.washers)} wash · ` : ''}{p.value ? money(p.value) : '$0'}
        </div>
      </div>
      <div className="space-y-1">
        {SPINE.map(s => {
          const c = p.spine[s];
          const isDead = s === 'dead';
          const w = isDead ? 0 : Math.round((c.n / max) * 100);
          return (
            <div key={s} className="flex items-center gap-2 text-[11px]">
              <div className="w-16 shrink-0 font-bold uppercase tracking-wide text-bauhaus-muted">{SPINE_LABELS[s]}</div>
              <div className="relative h-5 flex-1 bg-bauhaus-canvas">
                {!isDead && c.n > 0 && <div className="absolute inset-y-0 left-0 bg-bauhaus-blue/70" style={{ width: `${Math.max(w, 6)}%` }} />}
                <div className="absolute inset-0 flex items-center px-1.5 font-black text-bauhaus-black">
                  {c.n > 0 ? (
                    <span>{c.n}{c.beds ? ` · ${num(c.beds)}b` : ''}{c.washers ? ` · ${num(c.washers)}w` : ''}{c.value ? ` · ${money(c.value)}` : ''}</span>
                  ) : <span className="text-bauhaus-muted">—</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type FunnelSearchParams = {
  q?: string;
  role?: string;
  product?: string;
  attention?: string;
  route?: string;
};

export default async function GoodsFunnelPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<FunnelSearchParams> }) {
  const { slug } = await params;
  const filters = await searchParams;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const f = await getGoodsFunnel();
  const query = (filters.q || '').trim().toLowerCase();
  const visibleRelationships = f.relationships.filter(row => {
    if (query && ![row.name, row.organisation, row.email].filter(Boolean).join(' ').toLowerCase().includes(query)) return false;
    if (filters.role && filters.role !== 'all' && row.pipeline !== filters.role) return false;
    if (filters.product === 'beds' && row.beds <= 0) return false;
    if (filters.product === 'washers' && row.washers <= 0) return false;
    if (filters.product === 'unscoped' && (row.beds > 0 || row.washers > 0)) return false;
    if (filters.attention && filters.attention !== 'all' && row.attention !== filters.attention) return false;
    if (filters.route && filters.route !== 'all' && !row.entityRoutes.includes(filters.route as typeof row.entityRoutes[number])) return false;
    return true;
  });
  const moveNow = f.relationships
    .filter(row => row.spineStage !== 'dead' && row.spineStage !== 'closed')
    .slice()
    .sort((a, b) => b.priorityScore - a.priorityScore || (b.updatedAt || '').localeCompare(a.updatedAt || ''))
    .slice(0, 5);
  const cleanupQueue = f.relationships
    .filter(row => row.dataQualityIssues.length > 0)
    .slice()
    .sort((a, b) => a.dataQualityScore - b.dataQualityScore || b.priorityScore - a.priorityScore)
    .slice(0, 8);
  const weekly = {
    replies: f.relationships.filter(row => row.communicationStatus === 'reply evidenced').length,
    contacted: f.relationships.filter(row => row.communicationStatus !== 'no communication evidence').length,
    missingOwners: f.relationships.filter(row => !row.owner).length,
    missingActions: f.relationships.filter(row => !row.nextAction || !row.nextActionAt).length,
    scopedBeds: f.relationships.reduce((sum, row) => sum + row.beds, 0),
    scopedWashers: f.relationships.reduce((sum, row) => sum + row.washers, 0),
    updateReady: f.relationships.filter(row => row.updateReadiness === 'consent evidenced').length,
    vehicleDecisions: f.relationships.filter(row => row.vehicleStatus === 'vehicle decision needed').length,
  };

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/goods`} className="hover:text-white">Goods</Link>
            <span>/</span>
            <span className="text-white">Funnel</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Goods Funnel</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            One need, two funding routes, one delivery, in beds, washing machines and dollars. A community <strong className="text-white">need</strong> is met by a buyer who <strong className="text-white">pays</strong> (procurement) or a funder who <strong className="text-white">donates</strong> (support), both ending in <strong className="text-white">delivery</strong>.
          </p>
          <GoodsSubNav slug={slug} active="funnel" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Cockpit */}
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-black">Cockpit — curated priority slice (active + lead)</div>
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label={`Need (${f.need.communities} communities)`} beds={f.need.beds} washers={f.need.washers} accent />
          <Stat label="Ordered (Buyer)" beds={f.ordered.beds} washers={f.ordered.washers} value={f.ordered.value} />
          <Stat label="Funded (Supporter)" beds={f.funded.beds} washers={f.funded.washers} value={f.funded.value} />
          <Stat label="Delivered" beds={f.delivered.beds} washers={f.delivered.washers} />
          <Stat label="Gap (need − delivered)" beds={f.gap.beds} washers={f.gap.washers} accent />
        </div>
        <p className="mb-6 text-[11px] text-bauhaus-muted">
          Addressable demand (all {num(f.addressable.communities)} communities): {num(f.addressable.beds)} beds · {num(f.addressable.washers)} washers.
          Delivered is a cited constant — {f.delivered.source}.
          {!f.ghlConnected && <span className="text-bauhaus-red"> · GHL not connected in this environment — Ordered/Funded show 0.</span>}
        </p>

        {/* Funnel by pipeline, collapsed to the 5-stage spine */}
        <div className="mb-2 text-xs font-black uppercase tracking-widest text-bauhaus-black">Pipelines — collapsed to the 5-stage spine</div>
        <div className="grid gap-3 lg:grid-cols-3">
          {f.pipelines.length === 0 ? (
            <div className="border-4 border-bauhaus-black bg-white p-6 text-sm text-bauhaus-muted lg:col-span-3">
              No live pipeline data (GHL not connected here). The cockpit above still shows need, delivered and gap from the data model.
            </div>
          ) : (
            f.pipelines.map(p => <FunnelColumn key={p.key} p={p} />)
          )}
        </div>

        <section className="mt-8 border-4 border-bauhaus-black bg-white">
          <div className="border-b-4 border-bauhaus-black bg-bauhaus-black p-4 text-white">
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">Relationship command centre</div>
            <div className="mt-1 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-2xl font-black uppercase tracking-widest">Everyone involved in beds and washing</h2>
                <p className="mt-1 max-w-3xl text-xs leading-relaxed text-gray-300">
                  One row per live GHL opportunity across demand, buyers and supporters. Work the next move here; keep detailed correspondence and ask materials linked to the relationship record.
                </p>
              </div>
              <div className="shrink-0 text-xs font-black uppercase tracking-widest text-white/70">
                {f.relationships.length} active relationships
              </div>
            </div>
          </div>

          {f.relationships.length > 0 && (
            <div className="grid border-b-4 border-bauhaus-black sm:grid-cols-3">
              {[
                ['Consent evidenced', f.relationships.filter(row => row.updateReadiness === 'consent evidenced').length, 'Safe for the relevant public update stream.'],
                ['Consent needed', f.relationships.filter(row => row.updateReadiness === 'consent needed').length, 'Ask before adding to ongoing updates.'],
                ['Operational only', f.relationships.filter(row => row.updateReadiness === 'operational only').length, 'Keep contact tied to delivery or procurement.'],
              ].map(([label, count, detail], index) => (
                <div key={String(label)} className={`p-3 ${index < 2 ? 'border-b-2 border-bauhaus-black sm:border-b-0 sm:border-r-2' : ''}`}>
                  <div className="text-2xl font-black tabular-nums text-bauhaus-black">{count}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">{label}</div>
                  <p className="mt-1 text-[11px] text-bauhaus-muted">{detail}</p>
                </div>
              ))}
            </div>
          )}

          <form method="get" className="border-b-4 border-bauhaus-black bg-white p-4">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
              <label className="xl:col-span-2">
                <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">Search people or organisations</span>
                <input name="q" defaultValue={filters.q || ''} placeholder="Name, organisation or email" className="min-h-11 w-full border-2 border-bauhaus-black bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-bauhaus-blue" />
              </label>
              {[
                ['role', 'Relationship', [['all', 'All roles'], ['demand', 'Demand'], ['buyer', 'Buyers'], ['supporter', 'Supporters']]],
                ['product', 'Product', [['all', 'All products'], ['beds', 'Beds'], ['washers', 'Washing'], ['unscoped', 'Not scoped']]],
                ['attention', 'Attention', [['all', 'All states'], ['overdue', 'Overdue'], ['waiting', 'Waiting'], ['ready', 'Ready'], ['unassigned', 'Unassigned']]],
                ['route', 'Entity route', [['all', 'All routes'], ['commercial procurement', 'Commercial'], ['charity/public benefit', 'Charity'], ['First Nations governance', 'First Nations']]],
              ].map(([name, label, options]) => (
                <label key={String(name)}>
                  <span className="mb-1 block text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">{String(label)}</span>
                  <select name={String(name)} defaultValue={String(filters[name as keyof FunnelSearchParams] || 'all')} className="min-h-11 w-full border-2 border-bauhaus-black bg-white px-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-bauhaus-blue">
                    {(options as string[][]).map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="submit" className="min-h-11 border-2 border-bauhaus-black bg-bauhaus-black px-4 text-[10px] font-black uppercase tracking-widest text-white hover:bg-bauhaus-blue">Apply filters</button>
              <Link href={`/org/${slug}/goods/funnel`} className="inline-flex min-h-11 items-center border-2 border-bauhaus-black bg-white px-4 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-canvas">Clear</Link>
              <span className="text-[11px] font-bold text-bauhaus-muted">Showing {visibleRelationships.length} of {f.relationships.length}</span>
            </div>
          </form>

          {f.relationships.length > 0 && (
            <div className="grid border-b-4 border-bauhaus-black bg-bauhaus-canvas md:grid-cols-4">
              {[
                ['Commercial procurement', f.relationships.filter(row => row.entityRoutes.includes('commercial procurement')).length],
                ['Charity / public benefit', f.relationships.filter(row => row.entityRoutes.includes('charity/public benefit')).length],
                ['First Nations governance', f.relationships.filter(row => row.entityRoutes.includes('First Nations governance')).length],
                ['Vehicle decision needed', f.relationships.filter(row => row.vehicleStatus === 'vehicle decision needed').length],
              ].map(([label, count], index) => (
                <div key={String(label)} className={`p-3 ${index < 3 ? 'border-b-2 border-bauhaus-black md:border-b-0 md:border-r-2' : ''}`}>
                  <div className="text-xl font-black tabular-nums text-bauhaus-black">{count}</div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</div>
                </div>
              ))}
            </div>
          )}

          {f.relationships.length > 0 && (
            <section className="border-b-4 border-bauhaus-black bg-bauhaus-black p-4 text-white">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-yellow">Weekly management snapshot</div>
                  <h3 className="text-xl font-black uppercase tracking-widest">What Ben and Nic need to move</h3>
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50">Generated {shortDate(f.generatedAt)}</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
                {[
                  ['Contacted', weekly.contacted],
                  ['Replies', weekly.replies],
                  ['Beds scoped', weekly.scopedBeds],
                  ['Washers scoped', weekly.scopedWashers],
                  ['Missing owners', weekly.missingOwners],
                  ['Missing actions', weekly.missingActions],
                  ['Update ready', weekly.updateReady],
                  ['Vehicle decisions', weekly.vehicleDecisions],
                ].map(([label, value]) => (
                  <div key={String(label)} className="border border-white/20 bg-white/5 p-2.5">
                    <div className="text-xl font-black tabular-nums text-white">{value}</div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-white/50">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-yellow">Five actions this week</div>
                  <ol className="mt-2 grid gap-2 md:grid-cols-2">
                    {moveNow.map((row, index) => (
                      <li key={`weekly-${row.id}`} className="border border-white/20 bg-white/5 p-2.5 text-[11px] leading-relaxed">
                        <strong className="text-bauhaus-yellow">{index + 1}. {row.owner || 'Assign owner'}:</strong>{' '}
                        {row.nextAction || row.nextMove} <span className="text-white/50">— {row.name}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-yellow">Management read</div>
                  <p className="mt-2 text-xs leading-relaxed text-white/75">
                    {weekly.missingOwners > 0 ? `${weekly.missingOwners} relationships cannot move until an owner is assigned. ` : 'All relationships have owners. '}
                    {weekly.missingActions > 0 ? `${weekly.missingActions} still lack a complete action and due date. ` : 'Every relationship has a dated next action. '}
                    {weekly.vehicleDecisions > 0 ? `${weekly.vehicleDecisions} need a commercial, charity or First Nations governance route before an ask or contract.` : 'Entity routing is clear across the active set.'}
                  </p>
                </div>
              </div>
            </section>
          )}

          {moveNow.length > 0 && (
            <section className="border-b-4 border-bauhaus-black bg-bauhaus-yellow p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Move now</div>
                  <h3 className="text-xl font-black uppercase tracking-widest text-bauhaus-black">Highest-leverage relationship actions</h3>
                </div>
                <p className="max-w-xl text-[11px] leading-relaxed text-bauhaus-black/70">Ranked from action gaps, communication evidence, stage, volume and value. Scores prioritise review; they do not authorise outreach.</p>
              </div>
              <div className="mt-3 grid gap-3 lg:grid-cols-5">
                {moveNow.map((row, index) => (
                  <article key={`priority-${row.id}`} className="border-2 border-bauhaus-black bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl font-black text-bauhaus-red">#{index + 1}</span>
                      <span className="bg-bauhaus-black px-2 py-1 text-[10px] font-black text-white">{row.priorityScore}/100</span>
                    </div>
                    <div className="mt-2 font-black text-bauhaus-black">{row.name}</div>
                    <div className="text-[11px] text-bauhaus-muted">{row.organisation || row.pipelineLabel}</div>
                    <p className="mt-2 text-[11px] font-bold leading-relaxed text-bauhaus-black">{row.nextAction || row.nextMove}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {row.priorityReasons.slice(0, 3).map(reason => <span key={reason} className="bg-bauhaus-canvas px-1.5 py-1 text-[9px] font-black uppercase tracking-wide text-bauhaus-muted">{reason}</span>)}
                    </div>
                    <a href={`#relationship-${row.id}`} className="mt-3 inline-block text-[10px] font-black uppercase tracking-widest text-bauhaus-blue underline">Open relationship</a>
                  </article>
                ))}
              </div>
            </section>
          )}

          {cleanupQueue.length > 0 && (
            <section className="border-b-4 border-bauhaus-black bg-white p-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-red">Cleanup before outreach</div>
                  <h3 className="text-xl font-black uppercase tracking-widest text-bauhaus-black">Relationship data-quality queue</h3>
                </div>
                <div className="text-[11px] font-bold text-bauhaus-muted">Lowest-completeness records first · showing {cleanupQueue.length}</div>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {cleanupQueue.map(row => (
                  <article key={`cleanup-${row.id}`} className="border-2 border-bauhaus-black bg-bauhaus-canvas p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-black text-bauhaus-black">{row.name}</div>
                        <div className="text-[10px] text-bauhaus-muted">{row.organisation || row.pipelineLabel}</div>
                      </div>
                      <span className={`px-2 py-1 text-[10px] font-black ${row.dataQualityScore < 50 ? 'bg-bauhaus-red text-white' : 'bg-bauhaus-yellow text-bauhaus-black'}`}>{row.dataQualityScore}%</span>
                    </div>
                    <ul className="mt-2 space-y-1">
                      {row.dataQualityIssues.slice(0, 4).map(issue => <li key={issue} className="text-[10px] font-bold text-bauhaus-red">• {issue}</li>)}
                    </ul>
                    <a href={`#relationship-${row.id}`} className="mt-3 inline-block text-[10px] font-black uppercase tracking-widest text-bauhaus-blue underline">Review record</a>
                  </article>
                ))}
              </div>
            </section>
          )}

          {f.relationships.length === 0 ? (
            <div className="p-6 text-sm text-bauhaus-muted">
              No live GHL relationship rows are available in this environment. Connect GHL to populate people, stages, quantities and next moves.
            </div>
          ) : visibleRelationships.length === 0 ? (
            <div className="p-6 text-sm text-bauhaus-muted">No relationships match these filters. Clear the filters or broaden the search.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1900px] w-full border-collapse text-left text-xs">
                <thead className="bg-bauhaus-canvas text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                  <tr>
                    <th className="border-b-2 border-bauhaus-black p-3">Person / organisation</th>
                    <th className="border-b-2 border-bauhaus-black p-3">Role</th>
                    <th className="border-b-2 border-bauhaus-black p-3">Products</th>
                    <th className="border-b-2 border-bauhaus-black p-3">Value</th>
                    <th className="border-b-2 border-bauhaus-black p-3">GHL stage</th>
                    <th className="border-b-2 border-bauhaus-black p-3">Communication</th>
                    <th className="border-b-2 border-bauhaus-black p-3">Owner</th>
                    <th className="border-b-2 border-bauhaus-black p-3">Action / due</th>
                    <th className="border-b-2 border-bauhaus-black p-3">Deck</th>
                    <th className="border-b-2 border-bauhaus-black p-3">Updates / charity</th>
                    <th className="border-b-2 border-bauhaus-black p-3">Next move</th>
                    <th className="border-b-2 border-bauhaus-black p-3">Relationship brief</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRelationships
                    .slice()
                    .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''))
                    .map(row => (
                      <tr id={`relationship-${row.id}`} key={row.id} className="scroll-mt-24 border-b border-gray-200 align-top hover:bg-link-light/30">
                        <td className="p-3">
                          <div className="font-black text-bauhaus-black">{row.name}</div>
                          {row.organisation && <div className="mt-0.5 text-bauhaus-muted">{row.organisation}</div>}
                          {row.email && <a className="mt-1 block text-[11px] text-bauhaus-blue underline" href={`mailto:${row.email}`}>{row.email}</a>}
                        </td>
                        <td className="p-3">
                          <span className="inline-flex border border-bauhaus-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest">
                            {row.pipeline === 'buyer' ? 'Buyer' : row.pipeline === 'supporter' ? 'Supporter' : 'Demand'}
                          </span>
                        </td>
                        <td className="p-3 font-bold tabular-nums">
                          {row.beds > 0 || row.washers > 0 ? (
                            <div className="space-y-1">
                              {row.beds > 0 && <div>{num(row.beds)} beds</div>}
                              {row.washers > 0 && <div>{num(row.washers)} washers</div>}
                            </div>
                          ) : <span className="text-bauhaus-muted">Not scoped</span>}
                        </td>
                        <td className="p-3 font-black tabular-nums text-bauhaus-blue">{row.value > 0 ? money(row.value) : '—'}</td>
                        <td className="p-3">
                          <div className="font-black text-bauhaus-black">{row.stage}</div>
                          <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-bauhaus-muted">{SPINE_LABELS[row.spineStage]}</div>
                        </td>
                        <td className="p-3">
                          <div className={`font-black ${row.communicationStatus === 'reply evidenced' ? 'text-green-700' : row.communicationStatus === 'contact recorded' ? 'text-bauhaus-blue' : 'text-bauhaus-muted'}`}>
                            {row.communicationStatus}
                          </div>
                          <div className="mt-1 text-[11px] text-bauhaus-muted">{shortDate(row.lastContactAt)}</div>
                          {row.sourceUrl && (
                            <a href={row.sourceUrl} className="mt-1 inline-block font-black text-bauhaus-blue underline" target="_blank" rel="noreferrer">
                              Open source thread
                            </a>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-bold text-bauhaus-black">{row.owner || <span className="text-bauhaus-red">Owner needed</span>}</div>
                          <span className={`mt-1 inline-flex px-2 py-1 text-[9px] font-black uppercase tracking-wider ${row.attention === 'overdue' || row.attention === 'unassigned' ? 'bg-red-100 text-bauhaus-red' : row.attention === 'waiting' ? 'bg-bauhaus-yellow text-bauhaus-black' : 'bg-green-100 text-green-700'}`}>
                            {row.attention}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="max-w-xs font-bold leading-relaxed text-bauhaus-black">{row.nextAction || 'Action not recorded'}</div>
                          <div className={`mt-1 text-[11px] ${row.attention === 'overdue' ? 'font-black text-bauhaus-red' : 'text-bauhaus-muted'}`}>
                            {row.nextActionAt ? `Due ${shortDate(row.nextActionAt)}` : 'No due date'}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex px-2 py-1 text-[10px] font-black uppercase tracking-wider ${row.deckStatus === 'shared' ? 'bg-green-100 text-green-700' : row.deckStatus === 'ready' ? 'bg-link-light text-bauhaus-blue' : 'bg-gray-100 text-bauhaus-muted'}`}>
                            {row.deckStatus}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {row.supporterUpdates && <span className="bg-link-light px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-blue">Updates</span>}
                            {row.charityRelated && <span className="bg-bauhaus-yellow px-2 py-1 text-[10px] font-black uppercase tracking-wider text-bauhaus-black">Charity</span>}
                            {!row.supporterUpdates && !row.charityRelated && <span className="text-bauhaus-muted">—</span>}
                          </div>
                          <div className={`mt-2 text-[10px] font-black uppercase tracking-wider ${row.updateReadiness === 'consent evidenced' ? 'text-green-700' : row.updateReadiness === 'consent needed' ? 'text-bauhaus-red' : 'text-bauhaus-muted'}`}>
                            {row.updateReadiness}
                          </div>
                          {row.updateTopics.length > 0 && <div className="mt-1 text-[10px] leading-relaxed text-bauhaus-muted">{row.updateTopics.join(' · ')}</div>}
                          <div className="mt-2 border-t border-gray-200 pt-2">
                            {row.entityRoutes.length > 0 ? row.entityRoutes.map(route => (
                              <div key={route} className="text-[9px] font-black uppercase tracking-wider text-bauhaus-black">{route}</div>
                            )) : <div className="text-[9px] font-black uppercase tracking-wider text-bauhaus-red">Vehicle decision needed</div>}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="max-w-xs font-bold leading-relaxed text-bauhaus-black">{row.nextMove}</div>
                        </td>
                        <td className="p-3">
                          <details className="group w-72 border-2 border-bauhaus-black bg-white open:bg-bauhaus-canvas">
                            <summary className="cursor-pointer list-none px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black focus:outline-none focus:ring-2 focus:ring-bauhaus-blue">
                              <span className="group-open:hidden">Open brief +</span>
                              <span className="hidden group-open:inline">Close brief −</span>
                            </summary>
                            <div className="border-t-2 border-bauhaus-black p-3">
                              <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-red">Evidence</div>
                              <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-bauhaus-black">
                                <li>GHL opportunity: <span className="font-mono">{row.id}</span></li>
                                <li>Communication: <strong>{row.communicationStatus}</strong></li>
                                <li>Owner: <strong>{row.owner || 'not assigned'}</strong></li>
                                <li>Ask material: <strong>{row.deckStatus}</strong></li>
                                <li>Products: <strong>{row.beds || 0} beds · {row.washers || 0} washers</strong></li>
                              </ul>

                              <div className="mt-4 text-[9px] font-black uppercase tracking-widest text-bauhaus-blue">Recommended pack</div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                <Link href={`/org/${slug}/goods/pitch`} className="border border-bauhaus-black bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wider hover:bg-link-light">Main deck</Link>
                                <Link href={`/org/${slug}/goods/proof`} className="border border-bauhaus-black bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wider hover:bg-link-light">Proof</Link>
                                {row.pipeline === 'supporter' ? (
                                  <Link href={`/org/${slug}/goods/money`} className="border border-bauhaus-black bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wider hover:bg-link-light">Capital ask</Link>
                                ) : (
                                  <Link href={`/org/${slug}/goods/buyers`} className="border border-bauhaus-black bg-white px-2 py-1 text-[9px] font-black uppercase tracking-wider hover:bg-link-light">Buyer offer</Link>
                                )}
                                {row.charityRelated && <Link href={`/org/${slug}/goods/governance`} className="border border-bauhaus-black bg-bauhaus-yellow px-2 py-1 text-[9px] font-black uppercase tracking-wider">Charity role</Link>}
                              </div>

                              <div className="mt-4 border-t border-gray-300 pt-3">
                                <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-blue">Supporter updates</div>
                                <p className="mt-1 text-[11px] leading-relaxed text-bauhaus-black">
                                  <strong>{row.updateReadiness}.</strong>{' '}
                                  {row.updateReadiness === 'consent evidenced'
                                    ? `Use only for: ${row.updateTopics.join(', ') || 'general Goods progress'}.`
                                    : row.updateReadiness === 'consent needed'
                                      ? 'Request permission before adding this person to ongoing updates.'
                                      : 'Keep this relationship in its operational context unless the person separately opts in.'}
                                </p>
                              </div>

                              <div className="mt-4 border-t border-gray-300 pt-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-red">Data quality</div>
                                  <span className="text-[10px] font-black text-bauhaus-black">{row.dataQualityScore}%</span>
                                </div>
                                {row.dataQualityIssues.length > 0 ? (
                                  <ul className="mt-2 space-y-1">
                                    {row.dataQualityIssues.map(issue => <li key={issue} className="text-[10px] font-bold text-bauhaus-red">• {issue}</li>)}
                                  </ul>
                                ) : <p className="mt-1 text-[10px] font-bold text-green-700">Core relationship fields are complete.</p>}
                              </div>

                              <div className="mt-4 border-t border-gray-300 pt-3">
                                <div className="text-[9px] font-black uppercase tracking-widest text-bauhaus-red">Entity and charity route</div>
                                <p className="mt-1 text-[11px] leading-relaxed text-bauhaus-black">
                                  <strong>{row.vehicleStatus}.</strong>{' '}
                                  {row.entityRoutes.length > 0
                                    ? `Current evidence supports: ${row.entityRoutes.join(', ')}.`
                                    : 'No current tag or pipeline role identifies the correct contracting, charitable or governance vehicle.'}
                                </p>
                                <p className="mt-2 text-[10px] leading-relaxed text-bauhaus-muted">
                                  Public-benefit funding can sit with the charity; product sales, purchase orders and working capital belong with the commercial contracting vehicle; community governance and ownership require the named First Nations partner.
                                </p>
                              </div>

                              <div className="mt-4 space-y-2">
                                {row.sourceUrl && <a href={row.sourceUrl} target="_blank" rel="noreferrer" className="block border-2 border-bauhaus-blue bg-link-light px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-bauhaus-blue">Open Gmail evidence</a>}
                                <Link
                                  href={`/opportunities/ecosystem?project=Goods&source=crm&q=${encodeURIComponent(row.email || row.name)}`}
                                  className="block border-2 border-bauhaus-black bg-bauhaus-black px-3 py-2 text-center text-[9px] font-black uppercase tracking-widest text-white"
                                >
                                  Review before GHL handoff
                                </Link>
                              </div>

                              <p className="mt-3 text-[10px] leading-relaxed text-bauhaus-muted">
                                Confirm the owner, message angle, source evidence and due date before changing GHL or sending outreach.
                              </p>
                            </div>
                          </details>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-8 border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          The 3 GHL pipelines keep their own operational stages (Buyer 12 · Supporter 10 · Demand 4); this view collapses them to a shared spine by stage name. Need comes from <code>goods_communities</code> (the Demand Register tracks relationships, not quantities). As deals get scoped — beds/washers set on their GHL opps — Ordered/Funded fill in and the Gap closes.
        </div>
      </div>
    </main>
  );
}
