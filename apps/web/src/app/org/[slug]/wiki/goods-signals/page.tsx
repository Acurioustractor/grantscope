import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ACT_FAST_PROFILE, isActSlug, shouldUseFastLocalOrg } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getGoodsSignalsWorkbench, type GoodsSignalRow } from '@/lib/services/goods-signals-workbench';
import { SignalActionButton } from './signal-action-button';

export const revalidate = 300;

function money(n: number | null | undefined) {
  if (!n) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
}

function relDate(iso: string | null | undefined) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return 'closed';
  if (days === 0) return 'today';
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${Math.round(days / 365)}y`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return {
    title: `Goods Signals Workbench - CivicGraph`,
    description: 'Triage demand-unmet and asset end-of-life signals with matched grants, foundations, and local buyers.',
  };
}

export default async function GoodsSignalsWorkbenchPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    view?: 'cards' | 'table' | 'kanban';
    status?: string;
    state?: string;
    priority?: string;
    noise?: string;
    footprint?: string;
    q?: string;
    closing?: string; // 'soon' = within 30 days
    type?: string; // 'demand_unmet' | 'asset_end_of_life'
    limit?: string; // 'all' bypasses the default page size
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const profile = shouldUseFastLocalOrg() && isActSlug(slug)
    ? ACT_FAST_PROFILE
    : await getOrgProfileBySlug(slug);
  if (!profile) notFound();

  const view = sp.view || 'cards';

  // Kanban view always fetches all statuses (each column is a status).
  const statusFilter = view === 'kanban' || sp.status === 'all'
    ? ['new', 'reviewing', 'actioned', 'won', 'lost', 'expired', 'dismissed']
    : sp.status
      ? sp.status.split(',')
      : ['new', 'reviewing'];

  const includeNoise = sp.noise === '1';
  const includeOutOfFootprint = sp.footprint === 'all';
  const searchQuery = (sp.q || '').toLowerCase().trim();
  const closingSoon = sp.closing === 'soon';
  const typeFilter = sp.type;

  const { signals: allSignals, summary } = await getGoodsSignalsWorkbench({
    status: statusFilter,
    priority: sp.priority,
    state: sp.state,
    limit: sp.limit === 'all' ? 2000 : view === 'kanban' ? 400 : 100,
    includeNoise,
    includeOutOfFootprint,
  });

  // In-memory secondary filters (cheap on ~1k rows)
  let signals = allSignals;
  if (searchQuery) {
    signals = signals.filter(s =>
      s.title.toLowerCase().includes(searchQuery) ||
      s.community?.community_name.toLowerCase().includes(searchQuery) ||
      s.community?.postcode?.toLowerCase().includes(searchQuery)
    );
  }
  if (closingSoon) {
    signals = signals.filter(s => s.days_until_deadline !== null && s.days_until_deadline <= 30);
  }
  if (typeFilter) {
    signals = signals.filter(s => s.signal_type === typeFilter);
  }

  const stateChips = Object.entries(summary.by_state).sort((a, b) => b[1] - a[1]);

  return (
    <main className="min-h-screen bg-bauhaus-canvas text-bauhaus-black">
      <div className="border-b-4 border-bauhaus-black bg-bauhaus-black text-white">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-gray-400">
            <Link href={`/org/${slug}`} className="hover:text-white">{profile.name}</Link>
            <span>/</span>
            <Link href={`/org/${slug}/wiki/goods-operating-system`} className="hover:text-white">Goods OS</Link>
            <span>/</span>
            <span className="text-white">Signals Workbench</span>
          </nav>
          <h1 className="text-4xl font-black uppercase tracking-widest">Goods Signals Workbench</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-300">
            Showing top <span className="text-white font-black">{signals.length}</span> of <span className="text-white font-black">{summary.visible}</span> matching signals (sorted by community priority → fit score → deadline). Use filters below to drill in.
            {summary.out_of_footprint_hidden > 0 && <span className="text-bauhaus-yellow"> {summary.out_of_footprint_hidden} out-of-footprint hidden.</span>}
            {summary.noise_hidden > 0 && <span className="text-bauhaus-yellow"> {summary.noise_hidden} noise hidden.</span>}
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6">
        {/* Summary strip */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          <SummaryCell label="Visible" value={signals.length} accent />
          <SummaryCell label="Out-of-footprint hidden" value={summary.out_of_footprint_hidden} />
          <SummaryCell label="Noise hidden" value={summary.noise_hidden} />
          <SummaryCell label="With foundations" value={summary.with_foundations} />
          <SummaryCell label="Likely" value={summary.by_confidence.likely || 0} accent />
          <SummaryCell label="Possible" value={summary.by_confidence.possible || 0} />
        </div>

        {/* Toolbar: view switcher + search */}
        <ToolbarRow slug={slug} sp={sp} view={view} />

        {/* Filter rows */}
        <FilterRows
          slug={slug}
          sp={sp}
          view={view}
          summary={summary}
          stateChips={stateChips}
          includeNoise={includeNoise}
          includeOutOfFootprint={includeOutOfFootprint}
          closingSoon={closingSoon}
          typeFilter={typeFilter}
        />

        {/* View body */}
        {signals.length === 0 ? (
          <div className="border-4 border-bauhaus-black bg-white p-8 text-center text-sm text-bauhaus-black">
            No signals match the current filter.
          </div>
        ) : view === 'table' ? (
          <SignalsTable signals={signals} orgSlug={slug} />
        ) : view === 'kanban' ? (
          <SignalsKanban signals={signals} orgSlug={slug} />
        ) : (
          <div className="space-y-3">
            {signals.map(sig => <SignalCard key={sig.id} signal={sig} orgSlug={slug} />)}
          </div>
        )}

        <div className="mt-8 border-4 border-bauhaus-black bg-bauhaus-yellow p-4 text-xs">
          <p className="font-black uppercase tracking-wider">How matching works</p>
          <p className="mt-2 text-bauhaus-black">
            Grants: score = goods_relevance (50pt cap) + geography fit (state-exact 20, national 12, NULL 4, mismatch 0) + amount fit vs signal.estimated_value (comfortable 15, fits 10, partial 5).
            Foundations: score = thematic overlap with goods themes (10-25 by hit count) + geographic_focus match (state 18, national 10) + size bonus (50M+ = 12, 5M+ = 8).
            Confidence: top-match ≥80 = likely · ≥40 = possible · else none.
          </p>
        </div>
      </div>
    </main>
  );
}

function SummaryCell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`border-4 border-bauhaus-black ${accent ? 'bg-bauhaus-yellow' : 'bg-white'} p-3`}>
      <div className="text-3xl font-black">{value}</div>
      <div className="mt-1 text-[10px] font-black uppercase tracking-widest text-gray-700">{label}</div>
    </div>
  );
}

function FilterPill({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className={`border-2 ${active ? 'border-bauhaus-black bg-bauhaus-black text-white' : 'border-bauhaus-black bg-white text-bauhaus-black hover:bg-bauhaus-canvas'} px-2 py-0.5 font-mono text-[11px] uppercase tracking-wider`}
    >
      {label}
    </Link>
  );
}

function SignalCard({ signal, orgSlug }: { signal: GoodsSignalRow; orgSlug: string }) {
  const priorityBg = signal.priority === 'high' ? 'bg-bauhaus-red text-white' :
    signal.priority === 'medium' ? 'bg-bauhaus-yellow' : 'bg-bauhaus-canvas';
  const confBg = signal.funding_confidence === 'likely' ? 'bg-bauhaus-yellow' :
    signal.funding_confidence === 'possible' ? 'bg-bauhaus-canvas' : 'bg-white';

  return (
    <div className="border-4 border-bauhaus-black bg-white">
      <div className="flex flex-wrap items-start gap-2 border-b-2 border-bauhaus-black p-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className={`${priorityBg} px-2 py-0.5`}>{signal.priority}</span>
            <span className="bg-bauhaus-canvas px-2 py-0.5">{signal.signal_type.replace('_', ' ')}</span>
            <span className={`${confBg} border border-bauhaus-black px-2 py-0.5`}>conf: {signal.funding_confidence || 'none'}</span>
            {signal.community?.state && <span className="bg-bauhaus-black px-2 py-0.5 text-white">{signal.community.state}</span>}
            <span className="bg-white border border-bauhaus-black px-2 py-0.5">fit {signal.fit_score}</span>
            {signal.days_until_deadline !== null && signal.days_until_deadline <= 30 && (
              <span className="bg-bauhaus-red text-white px-2 py-0.5">closes in {signal.days_until_deadline}d</span>
            )}
            {signal.is_noise && <span className="bg-gray-400 text-white px-2 py-0.5">noise</span>}
            <span className="text-gray-500">status: {signal.status}</span>
          </div>
          <div className="mt-1 text-[10px] normal-case text-gray-600 font-normal">{signal.triage_reason}</div>
          <h3 className="mt-1 text-base font-black">
            {signal.community?.id ? (
              <Link href={`/org/${orgSlug}/goods/community/${signal.community.id}`} className="hover:underline hover:text-bauhaus-red">
                {signal.title}
              </Link>
            ) : signal.title}
          </h3>
          {signal.products_needed && signal.products_needed.length > 0 && (
            <div className="mt-1 text-xs text-gray-700">
              Needs: {signal.products_needed.join(', ')}
              {signal.estimated_units ? ` · ${signal.estimated_units} units` : ''}
              {signal.estimated_value ? ` · est. ${money(signal.estimated_value)}` : ''}
            </div>
          )}
        </div>
        <SignalActionButton
          signalId={signal.id}
          grantIds={signal.matched_grants.map(g => g.id)}
          status={signal.status}
          disabled={signal.matched_grants.length === 0}
        />
      </div>

      <div className="grid gap-3 p-3 md:grid-cols-3">
        {/* Buyer */}
        <div className="border-2 border-bauhaus-black p-2">
          <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-600">Local buyer</div>
          {signal.buyer ? (
            <>
              <div className="text-sm font-black">{signal.buyer.entity_name}</div>
              <div className="text-xs text-gray-700">{signal.buyer.buyer_role}</div>
            </>
          ) : (
            <div className="text-xs italic text-gray-500">No local buyer entity mapped</div>
          )}
        </div>

        {/* Grants */}
        <div className="border-2 border-bauhaus-black p-2">
          <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-600">Top grants ({signal.matched_grants.length})</div>
          {signal.matched_grants.length === 0 ? (
            <div className="text-xs italic text-gray-500">No matched grants</div>
          ) : (
            <ul className="space-y-1 text-xs">
              {signal.matched_grants.slice(0, 3).map(g => (
                <li key={g.id} className="border-l-2 border-bauhaus-black pl-2">
                  <Link href={`/grants/${g.id}`} className="font-black hover:underline">{g.name.slice(0, 65)}{g.name.length > 65 ? '…' : ''}</Link>
                  <div className="text-gray-700">
                    {g.provider?.slice(0, 30) || '—'} · {g.geography || '—'} · {money(g.amount_max)} · closes {relDate(g.closes_at)} · score {g.goods_relevance_score}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Foundations */}
        <div className="border-2 border-bauhaus-black p-2">
          <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-gray-600">Top foundations ({signal.matched_foundations.length})</div>
          {signal.matched_foundations.length === 0 ? (
            <div className="text-xs italic text-gray-500">No matched foundations</div>
          ) : (
            <ul className="space-y-1 text-xs">
              {signal.matched_foundations.slice(0, 3).map(f => (
                <li key={f.id} className="border-l-2 border-bauhaus-black pl-2">
                  <div className="font-black">{f.name.slice(0, 55)}{f.name.length > 55 ? '…' : ''}</div>
                  <div className="text-gray-700">
                    {money(f.total_giving_annual)} giving · {(f.geographic_focus || []).slice(0, 2).join(', ') || '—'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ── URL builder: change one filter at a time without growing href-string spaghetti ──
type SearchParams = {
  view?: string;
  status?: string;
  state?: string;
  priority?: string;
  noise?: string;
  footprint?: string;
  q?: string;
  closing?: string;
  type?: string;
  limit?: string;
};

function buildHref(slug: string, sp: SearchParams, overrides: Partial<SearchParams>): string {
  const merged = { ...sp, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v && v !== '') params.set(k, v);
  }
  const qs = params.toString();
  return `/org/${slug}/wiki/goods-signals${qs ? `?${qs}` : ''}`;
}

function ToolbarRow({ slug, sp, view }: { slug: string; sp: SearchParams; view: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <span className="mr-2 text-xs font-black uppercase tracking-wider">View:</span>
        <FilterPill href={buildHref(slug, sp, { view: 'cards' })} active={view === 'cards'} label="Cards" />
        <FilterPill href={buildHref(slug, sp, { view: 'table' })} active={view === 'table'} label="Table" />
        <FilterPill href={buildHref(slug, sp, { view: 'kanban' })} active={view === 'kanban'} label="Kanban" />
      </div>
      <form method="get" action={`/org/${slug}/wiki/goods-signals`} className="flex items-center gap-1">
        {/* preserve other params on submit */}
        {Object.entries(sp).filter(([k]) => k !== 'q').map(([k, v]) =>
          v ? <input key={k} type="hidden" name={k} value={v} /> : null
        )}
        <input
          type="text"
          name="q"
          defaultValue={sp.q || ''}
          placeholder="Search community / postcode…"
          className="border-2 border-bauhaus-black bg-white px-2 py-1 font-mono text-xs w-56"
        />
        <button type="submit" className="border-2 border-bauhaus-black bg-bauhaus-black px-3 py-1 font-mono text-xs font-black uppercase tracking-wider text-white">Go</button>
        {sp.q && (
          <Link href={buildHref(slug, sp, { q: '' })} className="ml-1 border-2 border-bauhaus-black bg-white px-2 py-1 font-mono text-xs uppercase tracking-wider">Clear</Link>
        )}
      </form>
    </div>
  );
}

function FilterRows({
  slug,
  sp,
  view,
  summary,
  stateChips,
  includeNoise,
  includeOutOfFootprint,
  closingSoon,
  typeFilter,
}: {
  slug: string;
  sp: SearchParams;
  view: string;
  summary: any;
  stateChips: [string, number][];
  includeNoise: boolean;
  includeOutOfFootprint: boolean;
  closingSoon: boolean;
  typeFilter: string | undefined;
}) {
  return (
    <div className="mb-4 space-y-2 text-xs">
      {view !== 'kanban' && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-black uppercase tracking-wider">Status:</span>
          <FilterPill
            href={buildHref(slug, sp, { status: '' })}
            active={!sp.status}
            label={`New + Reviewing (${(summary.by_status.new || 0) + (summary.by_status.reviewing || 0)})`}
          />
          <FilterPill href={buildHref(slug, sp, { status: 'new' })} active={sp.status === 'new'} label={`New (${summary.by_status.new || 0})`} />
          <FilterPill href={buildHref(slug, sp, { status: 'reviewing' })} active={sp.status === 'reviewing'} label={`Reviewing (${summary.by_status.reviewing || 0})`} />
          <FilterPill href={buildHref(slug, sp, { status: 'actioned' })} active={sp.status === 'actioned'} label={`Tracked (${summary.by_status.actioned || 0})`} />
          <FilterPill href={buildHref(slug, sp, { status: 'won' })} active={sp.status === 'won'} label={`Won (${summary.by_status.won || 0})`} />
          <FilterPill href={buildHref(slug, sp, { status: 'lost' })} active={sp.status === 'lost'} label={`Lost (${summary.by_status.lost || 0})`} />
          <FilterPill href={buildHref(slug, sp, { status: 'expired' })} active={sp.status === 'expired'} label={`Expired (${summary.by_status.expired || 0})`} />
          <FilterPill href={buildHref(slug, sp, { status: 'dismissed' })} active={sp.status === 'dismissed'} label={`Dismissed (${summary.by_status.dismissed || 0})`} />
          <FilterPill href={buildHref(slug, sp, { status: 'all' })} active={sp.status === 'all'} label="All" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-black uppercase tracking-wider">State:</span>
        <FilterPill href={buildHref(slug, sp, { state: '' })} active={!sp.state} label="All" />
        {stateChips.slice(0, 8).map(([st, n]) => (
          <FilterPill key={st} href={buildHref(slug, sp, { state: st })} active={sp.state === st} label={`${st} (${n})`} />
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-black uppercase tracking-wider">Type:</span>
        <FilterPill href={buildHref(slug, sp, { type: '' })} active={!typeFilter} label="All" />
        <FilterPill href={buildHref(slug, sp, { type: 'demand_unmet' })} active={typeFilter === 'demand_unmet'} label="Demand unmet" />
        <FilterPill href={buildHref(slug, sp, { type: 'asset_end_of_life' })} active={typeFilter === 'asset_end_of_life'} label="Asset EoL" />

        <span className="ml-4 font-black uppercase tracking-wider">Closing:</span>
        <FilterPill href={buildHref(slug, sp, { closing: '' })} active={!closingSoon} label="Any" />
        <FilterPill href={buildHref(slug, sp, { closing: 'soon' })} active={closingSoon} label="Soon (≤30d)" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="font-black uppercase tracking-wider">Footprint:</span>
        <FilterPill href={buildHref(slug, sp, { footprint: '' })} active={!includeOutOfFootprint} label={`Goods states only (-${summary.out_of_footprint_hidden})`} />
        <FilterPill href={buildHref(slug, sp, { footprint: 'all' })} active={includeOutOfFootprint} label="All states" />

        <span className="ml-4 font-black uppercase tracking-wider">Noise:</span>
        <FilterPill href={buildHref(slug, sp, { noise: '' })} active={!includeNoise} label={`Hidden (-${summary.noise_hidden})`} />
        <FilterPill href={buildHref(slug, sp, { noise: '1' })} active={includeNoise} label="Show all" />

        <span className="ml-4 font-black uppercase tracking-wider">Page size:</span>
        <FilterPill href={buildHref(slug, sp, { limit: '' })} active={sp.limit !== 'all'} label="Top fit (fast)" />
        <FilterPill href={buildHref(slug, sp, { limit: 'all' })} active={sp.limit === 'all'} label="All matching (slow)" />
      </div>
    </div>
  );
}

// ── Compact table view ──
function SignalsTable({ signals, orgSlug }: { signals: GoodsSignalRow[]; orgSlug: string }) {
  return (
    <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-bauhaus-black text-white">
          <tr>
            <Th>Community</Th>
            <Th>State</Th>
            <Th>Type</Th>
            <Th align="right">Fit</Th>
            <Th>Top grant</Th>
            <Th align="right">Closes</Th>
            <Th>Buyer</Th>
            <Th>Status</Th>
            <Th align="right">Action</Th>
          </tr>
        </thead>
        <tbody>
          {signals.map((s, i) => {
            const top = s.matched_grants[0];
            return (
              <tr key={s.id} className={i % 2 ? 'bg-bauhaus-canvas' : ''}>
                <Td>
                  <div className="flex items-center gap-1">
                    {s.community?.id ? (
                      <Link href={`/org/${orgSlug}/goods/community/${s.community.id}`} className="font-black hover:underline hover:text-bauhaus-red">
                        {s.community?.community_name || '—'}
                      </Link>
                    ) : s.title}
                    {/\(×\d+\)/.exec(s.title) && (
                      <span className="bg-bauhaus-black px-1 py-0.5 font-mono text-[9px] font-black text-white">{(/\(×(\d+)\)/.exec(s.title) || [])[0]?.replace(/[()]/g, '')}</span>
                    )}
                  </div>
                </Td>
                <Td>{s.community?.state || '—'}</Td>
                <Td>{s.signal_type.replace(/_/g, ' ')}</Td>
                <Td align="right"><span className="font-black">{s.fit_score}</span></Td>
                <Td>
                  {top ? (
                    <div>
                      <div className="font-black truncate max-w-[280px]">{top.name}</div>
                      <div className="text-[10px] text-gray-700">{top.geography || '—'} · {money(top.amount_max)} · score {top.goods_relevance_score}</div>
                    </div>
                  ) : '—'}
                </Td>
                <Td align="right">{relDate(top?.closes_at)}</Td>
                <Td>{s.buyer?.entity_name || <span className="italic text-gray-500">—</span>}</Td>
                <Td>
                  <StatusBadge status={s.status} />
                </Td>
                <Td align="right">
                  <SignalActionButton
                    signalId={s.id}
                    grantIds={s.matched_grants.map(g => g.id)}
                    status={s.status}
                    disabled={s.matched_grants.length === 0}
                  />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <th className={`border-b-2 border-bauhaus-black px-2 py-1.5 text-left font-black uppercase tracking-wider text-[10px] ${align === 'right' ? 'text-right' : ''}`}>{children}</th>;
}
function Td({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return <td className={`border-b border-gray-300 px-2 py-1.5 align-top ${align === 'right' ? 'text-right' : ''}`}>{children}</td>;
}

function StatusBadge({ status }: { status: string }) {
  const cls = status === 'actioned' ? 'bg-bauhaus-yellow'
    : status === 'reviewing' ? 'bg-bauhaus-blue text-white'
    : status === 'dismissed' ? 'bg-gray-300'
    : status === 'won' ? 'bg-green-500 text-white'
    : status === 'lost' || status === 'expired' ? 'bg-gray-400 text-white'
    : 'bg-white border border-bauhaus-black';
  return <span className={`px-2 py-0.5 font-mono text-[10px] font-black uppercase tracking-wider ${cls}`}>{status}</span>;
}

// ── Kanban view: 4 status columns ──
function SignalsKanban({ signals, orgSlug }: { signals: GoodsSignalRow[]; orgSlug: string }) {
  const columns: Array<{ key: string; label: string; statuses: string[]; bg: string }> = [
    { key: 'new', label: 'New', statuses: ['new'], bg: 'bg-white' },
    { key: 'reviewing', label: 'Reviewing', statuses: ['reviewing'], bg: 'bg-bauhaus-blue/10' },
    { key: 'actioned', label: 'Tracked', statuses: ['actioned', 'won'], bg: 'bg-bauhaus-yellow/30' },
    { key: 'dismissed', label: 'Dismissed', statuses: ['dismissed', 'lost', 'expired'], bg: 'bg-gray-200' },
  ];

  const grouped = columns.map(col => ({
    ...col,
    items: signals.filter(s => col.statuses.includes(s.status)),
  }));

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {grouped.map(col => (
        <div key={col.key} className="border-4 border-bauhaus-black bg-bauhaus-canvas">
          <div className={`flex items-center justify-between border-b-2 border-bauhaus-black ${col.bg} px-3 py-2`}>
            <span className="font-black uppercase tracking-widest text-xs">{col.label}</span>
            <span className="font-mono text-xs">{col.items.length}</span>
          </div>
          <div className="max-h-[70vh] overflow-y-auto p-2 space-y-2">
            {col.items.length === 0 ? (
              <div className="py-6 text-center text-[11px] italic text-gray-500">empty</div>
            ) : (
              col.items.slice(0, 80).map(s => <KanbanMiniCard key={s.id} signal={s} orgSlug={orgSlug} />)
            )}
            {col.items.length > 80 && (
              <div className="px-2 py-1 text-[10px] text-gray-600">+ {col.items.length - 80} more (filter to narrow)</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function KanbanMiniCard({ signal, orgSlug }: { signal: GoodsSignalRow; orgSlug: string }) {
  const top = signal.matched_grants[0];
  const priorityDot = signal.priority === 'high' ? 'bg-bauhaus-red' : signal.priority === 'medium' ? 'bg-bauhaus-yellow' : 'bg-gray-400';
  return (
    <div className="border-2 border-bauhaus-black bg-white p-2">
      <div className="mb-1 flex items-center gap-1 text-[9px] font-black uppercase tracking-wider">
        <span className={`${priorityDot} w-2 h-2`}></span>
        <span>{signal.community?.state || '—'}</span>
        <span className="text-gray-500">· fit {signal.fit_score}</span>
        {signal.days_until_deadline !== null && signal.days_until_deadline <= 30 && (
          <span className="ml-auto bg-bauhaus-red px-1 text-white">{signal.days_until_deadline}d</span>
        )}
      </div>
      {signal.community?.id ? (
        <Link href={`/org/${orgSlug}/goods/community/${signal.community.id}`} className="block text-xs font-black hover:text-bauhaus-red">
          {signal.community?.community_name || signal.title}
        </Link>
      ) : (
        <div className="text-xs font-black">{signal.title}</div>
      )}
      {top && (
        <div className="mt-1 text-[10px] text-gray-700 truncate">
          → {top.name}
        </div>
      )}
      {signal.buyer && (
        <div className="mt-0.5 text-[10px] text-gray-600">buyer: {signal.buyer.entity_name}</div>
      )}
      <div className="mt-1">
        <SignalActionButton
          signalId={signal.id}
          grantIds={signal.matched_grants.map(g => g.id)}
          status={signal.status}
          disabled={signal.matched_grants.length === 0}
        />
      </div>
    </div>
  );
}
