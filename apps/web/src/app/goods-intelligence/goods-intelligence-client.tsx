'use client';

import { useState, useMemo } from 'react';
import type { GoodsIntelligenceData } from './page';
import type { Tier } from '@/lib/subscription';
import ModuleGate from '@/app/components/module-gate';

type View = 'briefing' | 'communities' | 'economics' | 'pipeline' | 'supply';

const VIEWS: { id: View; label: string }[] = [
  { id: 'briefing', label: 'Briefing' },
  { id: 'communities', label: 'Communities' },
  { id: 'economics', label: 'Economics' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'supply', label: 'Supply Chain' },
];

/** Which tiers can access each tab (true = full, 'preview' = limited, false = locked) */
function tabAccess(view: View, tier: Tier): 'full' | 'preview' | 'locked' {
  switch (view) {
    case 'briefing':
      return 'full';
    case 'communities':
      return (['organisation', 'funder', 'enterprise'] as Tier[]).includes(tier) ? 'full' : 'preview';
    case 'economics':
      return (['funder', 'enterprise'] as Tier[]).includes(tier) ? 'full' : 'locked';
    case 'pipeline':
      return (['organisation', 'funder', 'enterprise'] as Tier[]).includes(tier) ? 'full' : 'locked';
    case 'supply':
      return tier === 'enterprise' ? 'full' : 'locked';
  }
}

export default function GoodsIntelligenceClient({ data, tier }: { data: GoodsIntelligenceData; tier: Tier }) {
  const [view, setView] = useState<View>('briefing');

  return (
    <div className="min-h-[calc(100vh-5rem)] -mx-6 -mt-6" style={{ maxWidth: 'none' }}>
      {/* View tabs */}
      <div className="border-b px-6 flex items-center gap-1 h-10" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
        {VIEWS.map(v => {
          const access = tabAccess(v.id, tier);
          const isLocked = access === 'locked';
          return (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className="px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors flex items-center gap-1.5"
              style={{
                color: view === v.id ? 'var(--ws-accent)' : isLocked ? 'var(--ws-text-tertiary)' : 'var(--ws-text-secondary)',
                background: view === v.id ? 'rgba(37,99,235,0.06)' : 'transparent',
              }}
            >
              {v.label}
              {isLocked && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-6" style={{ background: 'var(--ws-surface-0)' }}>
        {view === 'briefing' && <BriefingView data={data} />}
        {view === 'communities' && <CommunitiesView data={data} tier={tier} />}
        {view === 'economics' && (tabAccess('economics', tier) === 'locked' ? <ModuleGate module="supply-chain" currentTier={tier} /> : <EconomicsView products={data.products} />)}
        {view === 'pipeline' && (tabAccess('pipeline', tier) === 'locked' ? <ModuleGate module="procurement" currentTier={tier} /> : <PipelineView data={data} />)}
        {view === 'supply' && (tabAccess('supply', tier) === 'locked' ? <ModuleGate module="supply-chain" currentTier={tier} /> : <CorridorsView corridors={data.corridors} products={data.products} />)}
      </div>
    </div>
  );
}

/* ─── Briefing View ───────────────────────────────────────── */

function BriefingView({ data }: { data: GoodsIntelligenceData }) {
  const t = data.totals;

  return (
    <div className="max-w-4xl space-y-8">
      {/* Hero stats */}
      <div className="flex gap-8 items-baseline flex-wrap">
        <HeroStat label="Communities" value={t.communities.toLocaleString()} />
        <div className="w-px h-10 hidden sm:block" style={{ background: 'var(--ws-border)' }} />
        <HeroStat label="Active assets" value={t.totalAssets.toLocaleString()} />
        <div className="w-px h-10 hidden sm:block" style={{ background: 'var(--ws-border)' }} />
        <HeroStat label="Signals" value={t.signals.toLocaleString()} delta={t.signals > 0 ? `+${t.signals}` : undefined} />
        <div className="w-px h-10 hidden sm:block" style={{ background: 'var(--ws-border)' }} />
        <HeroStat label="Entities matched" value={t.totalEntities.toLocaleString()} />
      </div>

      {/* Dispatches from the field */}
      <Section title="Dispatches from the field" subtitle="Agent activity since last run">
        <div className="space-y-2">
          <Dispatch
            time="06:14"
            agent="Lifecycle Sync"
            message={`Synced ${t.totalAssets} assets from register. ${t.assetsOverdue} overdue for check-in.`}
            action="Review overdue"
          />
          <Dispatch
            time="06:18"
            agent="Supply Chain"
            message={`Calculated delivery economics for all ${t.communities} communities across 12 freight corridors.`}
          />
          <Dispatch
            time="06:22"
            agent="Procurement Matcher"
            message={`Matched ${t.signals} signals to buyers and linked 50 open grants.`}
            action="Review matches"
          />
          <Dispatch
            time="06:25"
            agent="Community Census"
            message={`${t.communities} AGIL locations active. ${t.withPopulation} with population data. ${data.stateSummary.find(s => s.state === 'NT')?.communities || 0} NT communities tracked.`}
          />
        </div>
      </Section>

      {/* Critical action required */}
      {t.signals > 0 && (
        <Section title="Needs your attention" subtitle={`${t.signals} signals requiring human decision`}>
          <div className="space-y-2">
            <Signal
              severity="amber"
              title={`${t.assetsOverdue} assets overdue for check-in`}
              detail="Some assets haven't been checked in over 6 months. Review and schedule community visits."
            />
            <Signal
              severity="red"
              title={`${t.signals} replacement signals pending`}
              detail="Assets past 80% of expected lifespan. Approve procurement or defer."
            />
          </div>
        </Section>
      )}

      {/* The Idiot Index */}
      <Section title="The Idiot Index" subtitle="Delivered cost / material cost — where process inflates atoms">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.products.filter(p => p.status === 'active' || p.status === 'prototype').map(p => (
            <IdiotIndexCard key={p.slug} product={p} />
          ))}
        </div>
      </Section>

      {/* Pipeline flow */}
      <Section title="Deployment pipeline" subtitle="Communities → Buyers → Signals → Orders">
        <PipelineFlow data={data} />
      </Section>
    </div>
  );
}

function HeroStat({ label, value, delta }: { label: string; value: string; delta?: string }) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span className="mono text-3xl font-bold tracking-tight" style={{ letterSpacing: '-0.04em' }}>{value}</span>
        {delta && (
          <span className="text-xs font-medium" style={{ color: 'var(--ws-green)' }}>{delta}</span>
        )}
      </div>
      <div className="text-[11px] uppercase tracking-wide mt-0.5" style={{ color: 'var(--ws-text-tertiary)' }}>{label}</div>
    </div>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--ws-text)' }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--ws-text-tertiary)' }}>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function Dispatch({ time, agent, message, action }: { time: string; agent: string; message: string; action?: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg border" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
      <span className="mono text-[11px] shrink-0 pt-0.5" style={{ color: 'var(--ws-text-tertiary)' }}>{time}</span>
      <span className="text-[11px] font-semibold uppercase tracking-wide shrink-0 w-28" style={{ color: 'var(--ws-accent)' }}>{agent}</span>
      <span className="text-[13px] flex-1" style={{ color: 'var(--ws-text-secondary)' }}>{message}</span>
      {action && (
        <button className="text-[11px] font-medium shrink-0 px-2 py-1 rounded-md" style={{ color: 'var(--ws-accent)', background: 'rgba(37,99,235,0.06)' }}>
          {action}
        </button>
      )}
    </div>
  );
}

function Signal({ severity, title, detail }: { severity: 'red' | 'amber'; title: string; detail: string }) {
  const color = severity === 'red' ? 'var(--ws-red)' : 'var(--ws-amber)';
  const bg = severity === 'red' ? 'rgba(220,38,38,0.04)' : 'rgba(217,119,6,0.04)';
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg border-l-[3px]" style={{ borderColor: color, background: bg }}>
      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: color }} />
      <div className="flex-1">
        <div className="text-[13px] font-semibold" style={{ color: 'var(--ws-text)' }}>{title}</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--ws-text-secondary)' }}>{detail}</div>
      </div>
    </div>
  );
}

function IdiotIndexCard({ product: p }: { product: GoodsIntelligenceData['products'][0] }) {
  const material = Number(p.material_cost_aud);
  const manufacturing = Number(p.manufacturing_cost_aud);
  const wholesale = Number(p.wholesale_price_aud);
  const goodsDelivered = Number(p.goods_delivered_cost_remote);
  const incumbent = Number(p.typical_delivered_cost_remote);
  const idiot = Number(p.idiot_index);
  const saving = Number(p.cost_advantage_pct);

  return (
    <div className="p-5 rounded-lg border" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ws-text-secondary)' }}>{p.name}</div>
          <div className="text-[11px] mt-0.5" style={{ color: 'var(--ws-text-tertiary)' }}>{p.status}</div>
        </div>
        <div className="text-right">
          <div className="mono text-4xl font-bold" style={{ color: 'var(--ws-red)', letterSpacing: '-0.04em' }}>{idiot.toFixed(1)}×</div>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>idiot index</div>
        </div>
      </div>

      {/* Cost waterfall bar */}
      <div className="mt-4 space-y-2">
        <div className="text-[11px] font-medium" style={{ color: 'var(--ws-text-secondary)' }}>Cost waterfall</div>
        <div className="h-6 flex rounded-md overflow-hidden" style={{ background: 'var(--ws-surface-2)' }}>
          <div className="h-full flex items-center justify-center text-[9px] text-white font-medium" style={{ width: `${(material / incumbent) * 100}%`, background: '#A8A29E' }} title={`Material $${material}`}>
            {material > incumbent * 0.05 ? `$${material}` : ''}
          </div>
          <div className="h-full flex items-center justify-center text-[9px] text-white font-medium" style={{ width: `${(manufacturing / incumbent) * 100}%`, background: '#78716C' }} title={`Mfg $${manufacturing}`}>
            {manufacturing > incumbent * 0.05 ? `$${manufacturing}` : ''}
          </div>
          <div className="h-full flex items-center justify-center text-[9px] text-white font-medium" style={{ width: `${((goodsDelivered - wholesale) / incumbent) * 100}%`, background: 'var(--ws-accent)' }} title={`Freight $${goodsDelivered - wholesale}`}>
          </div>
        </div>
        <div className="flex justify-between text-[11px]">
          <span style={{ color: 'var(--ws-accent)' }} className="font-semibold">Goods ${goodsDelivered}</span>
          <span style={{ color: 'var(--ws-red)' }}>Incumbent ${incumbent}</span>
          <span style={{ color: 'var(--ws-green)' }} className="font-semibold">{saving.toFixed(0)}% saving</span>
        </div>
      </div>
    </div>
  );
}

function PipelineFlow({ data }: { data: GoodsIntelligenceData }) {
  const withBuyers = data.communities.filter(c => (c.buyer_entity_count || 0) > 0).length;
  const stages = [
    { label: 'Communities', value: data.totals.communities, filled: true },
    { label: 'With buyers', value: withBuyers, filled: withBuyers > 0 },
    { label: 'Signals', value: data.totals.signals, filled: data.totals.signals > 0 },
    { label: 'Orders', value: 0, filled: false },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <div
            className={`px-4 py-2.5 rounded-lg border text-center min-w-[120px] ${!s.filled ? 'pulse' : ''}`}
            style={{
              borderColor: s.filled ? 'var(--ws-border-strong)' : 'var(--ws-border)',
              borderStyle: s.filled ? 'solid' : 'dashed',
              background: s.filled ? 'var(--ws-surface-1)' : 'transparent',
            }}
          >
            <div className="mono text-lg font-bold" style={{ color: s.filled ? 'var(--ws-text)' : 'var(--ws-text-tertiary)' }}>
              {s.value.toLocaleString()}
            </div>
            <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>{s.label}</div>
          </div>
          {i < stages.length - 1 && (
            <svg width="20" height="12" viewBox="0 0 20 12" fill="none" stroke="var(--ws-border)" strokeWidth="1.5">
              <path d="M0 6h16M14 2l4 4-4 4" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Communities View ─────────────────────────────────────── */

function CommunitiesView({ data, tier }: { data: GoodsIntelligenceData; tier: Tier }) {
  const access = tabAccess('communities', tier);
  const [stateFilter, setStateFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = data.communities;
    if (stateFilter !== 'all') list = list.filter(c => c.state === stateFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.community_name.toLowerCase().includes(q) ||
        (c.postcode && c.postcode.includes(q)) ||
        (c.land_council && c.land_council.toLowerCase().includes(q))
      );
    }
    return list;
  }, [data.communities, stateFilter, search]);

  const previewLimit = access === 'preview' ? 10 : 80;
  const selected = selectedId ? data.communities.find(c => c.id === selectedId) : null;

  return (
    <div className="flex gap-6 max-w-6xl">
      {/* Left — list */}
      <div className="w-[420px] shrink-0 space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          <Chip active={stateFilter === 'all'} onClick={() => setStateFilter('all')}>All ({data.totals.communities})</Chip>
          {data.stateSummary.map(s => (
            <Chip key={s.state} active={stateFilter === s.state} onClick={() => setStateFilter(s.state)}>
              {s.state} ({s.communities})
            </Chip>
          ))}
        </div>
        {access === 'full' && (
          <input
            type="text"
            placeholder="Search community, postcode, land council..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 text-[13px] rounded-lg border outline-none"
            style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}
          />
        )}

        <div className="relative rounded-lg border overflow-hidden max-h-[calc(100vh-200px)] overflow-y-auto" style={{ borderColor: 'var(--ws-border)' }}>
          {filtered.slice(0, previewLimit).map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(c.id)}
              className="w-full text-left px-4 py-2.5 border-b transition-colors"
              style={{
                borderColor: 'var(--ws-border)',
                background: selectedId === c.id ? 'rgba(37,99,235,0.04)' : 'var(--ws-surface-1)',
                borderLeft: selectedId === c.id ? '3px solid var(--ws-accent)' : '3px solid transparent',
              }}
            >
              <div className="flex justify-between items-baseline">
                <span className="text-[13px] font-medium">{c.community_name}</span>
                <span className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>{c.state} {c.postcode || ''}</span>
              </div>
              <div className="flex gap-3 mt-0.5 text-[11px]" style={{ color: 'var(--ws-text-secondary)' }}>
                {c.estimated_population && <span>Pop {c.estimated_population}</span>}
                {c.land_council && <span>{c.land_council}</span>}
                {(c.buyer_entity_count || 0) > 0 && (
                  <span style={{ color: 'var(--ws-accent)' }}>{c.buyer_entity_count} buyers</span>
                )}
              </div>
            </button>
          ))}
          {access === 'full' && filtered.length > previewLimit && (
            <div className="px-4 py-3 text-[11px] text-center" style={{ color: 'var(--ws-text-tertiary)' }}>
              Showing {previewLimit} of {filtered.length}
            </div>
          )}
          {access === 'preview' && (
            <div className="relative">
              <div className="absolute inset-x-0 -top-16 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none" />
              <div className="px-4 py-6 text-center" style={{ background: 'var(--ws-surface-1)' }}>
                <p className="text-[13px] font-medium mb-1" style={{ color: 'var(--ws-text-secondary)' }}>
                  Showing 10 of {filtered.length} communities
                </p>
                <p className="text-[12px] mb-3" style={{ color: 'var(--ws-text-tertiary)' }}>
                  Upgrade to Organisation or above for full access
                </p>
                <a
                  href="/pricing"
                  className="inline-block px-4 py-2 text-[12px] font-semibold rounded-lg"
                  style={{ background: 'var(--ws-text)', color: 'var(--ws-surface-0)' }}
                >
                  View plans
                </a>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right — detail */}
      <div className="flex-1 min-w-0">
        {selected ? (
          <CommunityDetail community={selected} products={data.products} />
        ) : (
          <div className="flex items-center justify-center h-64 text-[13px]" style={{ color: 'var(--ws-text-tertiary)' }}>
            Select a community
          </div>
        )}
      </div>
    </div>
  );
}

function CommunityDetail({ community: c, products }: { community: GoodsIntelligenceData['communities'][0]; products: GoodsIntelligenceData['products'] }) {
  const freightPerKg = Number(c.estimated_freight_cost_per_kg) || 5;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold tracking-tight">{c.community_name}</h2>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--ws-text-secondary)' }}>
          {c.state} {c.postcode || ''} · {c.remoteness || 'Unknown remoteness'}
          {c.agil_code && <span className="ml-2" style={{ color: 'var(--ws-text-tertiary)' }}>AGIL {c.agil_code}</span>}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {c.estimated_population && <MiniStat label="Population" value={c.estimated_population.toLocaleString()} />}
        {c.land_council && <MiniStat label="Land Council" value={c.land_council} />}
        {c.main_language && <MiniStat label="Language" value={c.main_language} />}
        <MiniStat label="Corridor" value={c.freight_corridor || '—'} />
        <MiniStat label="Hub" value={c.nearest_staging_hub || '—'} />
        <MiniStat label="Last mile" value={c.last_mile_method || 'road'} />
        <MiniStat label="$/kg" value={`$${freightPerKg.toFixed(1)}`} />
        <MiniStat label="Buyers" value={String(c.buyer_entity_count || 0)} />
        <MiniStat label="Assets" value={String(c.assets_deployed || 0)} />
      </div>

      <Section title="Delivered economics" subtitle={`Freight: $${freightPerKg.toFixed(1)}/kg via ${c.last_mile_method || 'road'}`}>
        <div className="space-y-3">
          {products.filter(p => p.status === 'active' || p.status === 'prototype').map(p => {
            const freight = freightPerKg * Number(p.weight_kg);
            const goodsDelivered = Number(p.wholesale_price_aud) + freight;
            const incumbentDelivered = Number(p.typical_delivered_cost_remote);
            const saving = incumbentDelivered > 0 ? Math.round(100 * (1 - goodsDelivered / incumbentDelivered)) : 0;

            return (
              <div key={p.slug} className="p-4 rounded-lg border" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-[13px] font-semibold">{p.name}</span>
                  <span className="text-[13px] font-bold" style={{ color: saving > 0 ? 'var(--ws-green)' : 'var(--ws-text-tertiary)' }}>
                    {saving > 0 ? `${saving}% saving` : '—'}
                  </span>
                </div>
                <div className="flex gap-4 text-[11px]">
                  <span>Goods <span className="mono font-semibold" style={{ color: 'var(--ws-accent)' }}>${Math.round(goodsDelivered)}</span></span>
                  <span>Incumbent <span className="mono font-semibold" style={{ color: 'var(--ws-red)' }}>${Math.round(incumbentDelivered)}</span></span>
                  <span style={{ color: 'var(--ws-text-tertiary)' }}>Freight: {Number(p.weight_kg)}kg × ${freightPerKg.toFixed(1)} = ${Math.round(freight)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <div className="text-[11px]" style={{ color: 'var(--ws-text-tertiary)' }}>
        Sources: {(c.data_sources || []).join(', ') || 'agil'}
      </div>
    </div>
  );
}

/* ─── Economics View ──────────────────────────────────────── */

function EconomicsView({ products }: { products: GoodsIntelligenceData['products'] }) {
  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Product Economics</h2>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--ws-text-secondary)' }}>
          The idiot index reveals where process inflates the cost of atoms
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {products.map(p => <IdiotIndexCard key={p.slug} product={p} />)}
      </div>

      <div className="p-5 rounded-lg" style={{ background: 'var(--ws-text)', color: 'var(--ws-surface-0)' }}>
        <h3 className="text-sm font-bold mb-2">What is the idiot index?</h3>
        <p className="text-[13px] leading-relaxed opacity-70">
          SpaceX measures the ratio of what a finished part costs vs. its raw materials. A turbopump costing
          $200,000 from $2,000 of metal has an index of 100×. The Stretch Bed&apos;s 23.5× means every $1 of
          HDPE plastic and steel becomes $23.50 through incumbent supply chains. Goods cuts this through
          vertical integration and direct community delivery.
        </p>
      </div>
    </div>
  );
}

/* ─── Pipeline View ───────────────────────────────────────── */

function PipelineView({ data }: { data: GoodsIntelligenceData }) {
  const withDemand = data.communities.filter(c => (c.demand_beds || 0) > 0 || (c.demand_washers || 0) > 0);

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Procurement Pipeline</h2>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--ws-text-secondary)' }}>
          Signal → Buyer → Funding → Order → Delivery → Lifecycle
        </p>
      </div>

      <PipelineFlow data={data} />

      <Section title="Communities with demand signals">
        {withDemand.length > 0 ? (
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--ws-border)' }}>
            {withDemand.slice(0, 20).map(c => (
              <div key={c.id} className="flex justify-between items-center px-4 py-2.5 border-b" style={{ borderColor: 'var(--ws-border)', background: 'var(--ws-surface-1)' }}>
                <div>
                  <span className="text-[13px] font-medium">{c.community_name}</span>
                  <span className="text-[11px] ml-2" style={{ color: 'var(--ws-text-tertiary)' }}>{c.state}</span>
                </div>
                <div className="flex gap-3 text-[11px]">
                  {(c.demand_beds || 0) > 0 && <span className="font-semibold" style={{ color: 'var(--ws-red)' }}>{c.demand_beds} beds</span>}
                  {(c.demand_washers || 0) > 0 && <span className="font-semibold" style={{ color: 'var(--ws-accent)' }}>{c.demand_washers} washers</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-[13px] rounded-lg border border-dashed" style={{ borderColor: 'var(--ws-border)', color: 'var(--ws-text-tertiary)' }}>
            No demand signals yet — run procurement matcher to generate
          </div>
        )}
      </Section>

      <div className="p-5 rounded-lg border-l-[3px]" style={{ borderColor: 'var(--ws-red)', background: 'rgba(220,38,38,0.03)' }}>
        <div className="mono text-3xl font-bold">{data.totals.signals}</div>
        <div className="text-[13px] mt-1" style={{ color: 'var(--ws-text-secondary)' }}>Active procurement signals awaiting processing</div>
      </div>
    </div>
  );
}

/* ─── Corridors / Supply Chain View ───────────────────────── */

function CorridorsView({ corridors, products }: { corridors: GoodsIntelligenceData['corridors']; products: GoodsIntelligenceData['products'] }) {
  const activeProducts = products.filter(p => p.status === 'active' || p.status === 'prototype');

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h2 className="text-xl font-bold tracking-tight">Supply Chain</h2>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--ws-text-secondary)' }}>
          Freight corridors and delivered economics by route
        </p>
      </div>

      <div className="rounded-lg border overflow-x-auto" style={{ borderColor: 'var(--ws-border)' }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--ws-border)' }}>
              <th className="text-left px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--ws-text-secondary)' }}>Corridor</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--ws-text-secondary)' }}>Communities</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--ws-text-secondary)' }}>Population</th>
              <th className="text-right px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--ws-text-secondary)' }}>$/kg</th>
              {activeProducts.map(p => (
                <th key={p.slug} className="text-right px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide" style={{ color: 'var(--ws-text-secondary)' }}>
                  {p.category}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {corridors.map((c, i) => {
              const freightPerKg = Number(c.avg_freight_cost) || 5;
              return (
                <tr key={c.freight_corridor} style={{ borderBottom: '1px solid var(--ws-border)', background: i % 2 === 0 ? 'var(--ws-surface-1)' : 'var(--ws-surface-2)' }}>
                  <td className="px-4 py-2.5 font-medium">{c.freight_corridor}</td>
                  <td className="px-4 py-2.5 text-right mono">{Number(c.communities)}</td>
                  <td className="px-4 py-2.5 text-right mono" style={{ color: Number(c.total_pop) > 0 ? 'var(--ws-text)' : 'var(--ws-text-tertiary)' }}>
                    {Number(c.total_pop) > 0 ? Number(c.total_pop).toLocaleString() : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right mono">${freightPerKg.toFixed(1)}</td>
                  {activeProducts.map(p => {
                    const delivered = Number(p.wholesale_price_aud) + freightPerKg * Number(p.weight_kg);
                    return (
                      <td key={p.slug} className="px-4 py-2.5 text-right mono font-semibold" style={{ color: 'var(--ws-accent)' }}>
                        ${Math.round(delivered)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Section title="Goods vs. Incumbent">
        <div className="space-y-4">
          {activeProducts.map(p => (
            <div key={p.slug}>
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-[13px] font-semibold">{p.name}</span>
                <span className="text-[13px] font-bold" style={{ color: 'var(--ws-green)' }}>{Number(p.cost_advantage_pct).toFixed(0)}% savings</span>
              </div>
              <div className="flex h-7 rounded-md overflow-hidden">
                <div
                  className="h-full flex items-center px-3 text-[11px] text-white font-medium"
                  style={{ width: `${(Number(p.goods_delivered_cost_remote) / Number(p.typical_delivered_cost_remote)) * 100}%`, background: 'var(--ws-accent)' }}
                >
                  Goods ${Number(p.goods_delivered_cost_remote)}
                </div>
                <div
                  className="h-full flex items-center px-3 text-[11px] font-medium flex-1"
                  style={{ background: 'rgba(220,38,38,0.08)', color: 'var(--ws-red)' }}
                >
                  Incumbent ${Number(p.typical_delivered_cost_remote)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/* ─── Shared Components ───────────────────────────────────── */

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors"
      style={{
        color: active ? 'var(--ws-accent)' : 'var(--ws-text-secondary)',
        background: active ? 'rgba(37,99,235,0.08)' : 'transparent',
        border: `1px solid ${active ? 'var(--ws-accent)' : 'var(--ws-border)'}`,
      }}
    >
      {children}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-lg" style={{ background: 'var(--ws-surface-2)' }}>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: 'var(--ws-text-tertiary)' }}>{label}</div>
      <div className="text-[13px] font-medium truncate mt-0.5">{value}</div>
    </div>
  );
}
