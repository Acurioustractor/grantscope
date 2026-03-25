'use client';

import { useState } from 'react';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────

interface SavedGrant {
  id: string;
  stage: string;
  stars: number;
  color: string;
  notes: string | null;
  updated_at: string;
  grant: {
    id: string;
    name: string;
    provider: string;
    amount_min: number | null;
    amount_max: number | null;
    closes_at: string | null;
    categories: string[];
  } | null;
}

interface SavedFoundation {
  id: string;
  stage: string;
  stars: number;
  notes: string | null;
  updated_at: string;
  foundation: {
    id: string;
    name: string;
    total_giving_annual: number | null;
    thematic_focus: string[];
    geographic_focus: string[];
  } | null;
}

interface EntityWatch {
  id: string;
  entity_id: string;
  gs_id: string;
  canonical_name: string | null;
  watch_types: string[];
  notes: string | null;
  last_change_at: string | null;
  change_summary: Record<string, unknown> | null;
  created_at: string;
}

interface Alert {
  id: string;
  name: string;
  enabled: boolean;
  frequency: string;
  categories: string[];
  focus_areas: string[];
  states: string[];
  min_amount: number | null;
  max_amount: number | null;
  keywords: string[];
  match_count: number | null;
  last_matched_at: string | null;
  last_sent_at: string | null;
  created_at: string;
}

interface Discovery {
  id: string;
  title: string;
  description: string;
  severity: string;
  discovery_type: string;
  entity_ids: string[];
  created_at: string;
}

type Tab = 'grants' | 'foundations' | 'entities' | 'alerts' | 'feed';

interface Props {
  savedGrants: SavedGrant[];
  savedFoundations: SavedFoundation[];
  entityWatches: EntityWatch[];
  alerts: Alert[];
  recentDiscoveries: Discovery[];
}

// ── Helpers ───────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function daysUntil(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = new Date(dateStr).getTime() - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days < 0) return 'Closed';
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STAGE_LABELS: Record<string, string> = {
  discovered: 'Discovered',
  researching: 'Researching',
  preparing: 'Preparing',
  submitted: 'Submitted',
  shortlisted: 'Shortlisted',
  awarded: 'Awarded',
  declined: 'Declined',
  realized: 'Realized',
  connected: 'Connected',
  active_relationship: 'Active',
};

const STAGE_COLORS: Record<string, string> = {
  discovered: 'bg-gray-100 text-gray-600',
  researching: 'bg-blue-50 text-blue-600',
  preparing: 'bg-amber-50 text-amber-600',
  submitted: 'bg-purple-50 text-purple-600',
  shortlisted: 'bg-emerald-50 text-emerald-600',
  awarded: 'bg-green-100 text-green-700',
  declined: 'bg-red-50 text-red-500',
  realized: 'bg-green-100 text-green-700',
  connected: 'bg-blue-50 text-blue-600',
  active_relationship: 'bg-green-100 text-green-700',
};

// ── Component ─────────────────────────────────────────────────────

export function WatchlistClient({ savedGrants, savedFoundations, entityWatches, alerts, recentDiscoveries }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('feed');
  const [watchGsId, setWatchGsId] = useState('');
  const [watches, setWatches] = useState(entityWatches);
  const [adding, setAdding] = useState(false);

  // Filter discoveries to those matching watched entity IDs
  const watchedEntityIds = new Set(watches.map(w => w.entity_id));
  const watchedDiscoveries = recentDiscoveries.filter(d =>
    d.entity_ids?.some(eid => watchedEntityIds.has(eid))
  );
  // Also show all discoveries if no watches yet (onboarding)
  const feedDiscoveries = watches.length > 0 ? watchedDiscoveries : recentDiscoveries.slice(0, 20);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'feed', label: 'Feed', count: feedDiscoveries.length },
    { key: 'entities', label: 'Entities', count: watches.length },
    { key: 'grants', label: 'Grants', count: savedGrants.length },
    { key: 'foundations', label: 'Foundations', count: savedFoundations.length },
    { key: 'alerts', label: 'Alerts', count: alerts.length },
  ];

  async function addWatch() {
    if (!watchGsId.trim()) return;
    setAdding(true);
    try {
      const res = await fetch('/api/watches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gs_id: watchGsId.trim() }),
      });
      if (res.ok) {
        const { watch } = await res.json();
        setWatches([watch, ...watches]);
        setWatchGsId('');
      }
    } finally {
      setAdding(false);
    }
  }

  async function removeWatch(watchId: string) {
    await fetch(`/api/watches/${watchId}`, { method: 'DELETE' });
    setWatches(watches.filter(w => w.id !== watchId));
  }

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-0 border-b-4 border-bauhaus-black mb-6">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
              activeTab === tab.key
                ? 'bg-bauhaus-black text-white'
                : 'bg-white text-bauhaus-muted hover:bg-gray-100'
            }`}
          >
            {tab.label}
            <span className="ml-2 text-[10px]">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Feed tab */}
      {activeTab === 'feed' && (
        <div>
          {feedDiscoveries.length === 0 ? (
            <EmptyState
              icon="📡"
              title="No recent discoveries"
              description={watches.length > 0
                ? 'No changes detected for your watched entities this week.'
                : 'Watch entities to see their discoveries here. Platform-wide discoveries will show when you have no watches.'}
              cta={watches.length === 0 ? { label: 'Browse Entities', href: '/entities' } : undefined}
            />
          ) : (
            <div className="space-y-2">
              {feedDiscoveries.map(d => {
                const severityStyles: Record<string, string> = {
                  critical: 'border-l-4 border-l-bauhaus-red bg-error-light',
                  significant: 'border-l-4 border-l-orange-500 bg-orange-50',
                  notable: 'border-l-4 border-l-bauhaus-blue bg-link-light',
                  info: 'border-l-4 border-l-gray-300',
                };
                return (
                  <div key={d.id} className={`border-2 border-gray-200 p-4 ${severityStyles[d.severity] || ''}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm">{d.title}</div>
                        <div className="text-xs text-bauhaus-muted mt-1 line-clamp-2">{d.description}</div>
                        <div className="flex gap-2 mt-2 flex-wrap">
                          <span className={`text-[10px] px-1.5 py-0.5 font-bold uppercase ${
                            d.severity === 'critical' ? 'bg-bauhaus-red text-white' :
                            d.severity === 'significant' ? 'bg-orange-500 text-white' :
                            d.severity === 'notable' ? 'bg-bauhaus-blue text-white' :
                            'bg-gray-200 text-gray-600'
                          }`}>
                            {d.severity}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600">
                            {d.discovery_type.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      <span className="text-xs text-bauhaus-muted shrink-0">{timeAgo(d.created_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Grants tab */}
      {activeTab === 'grants' && (
        <div className="space-y-2">
          {savedGrants.length === 0 ? (
            <EmptyState
              icon="🎯"
              title="No saved grants"
              description="Save grants from the grant search to track them here."
              cta={{ label: 'Search Grants', href: '/grants' }}
            />
          ) : (
            savedGrants.map(sg => (
              <div key={sg.id} className="border-2 border-gray-200 p-4 hover:border-bauhaus-black transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={sg.grant ? `/grants/${sg.grant.id}` : '#'}
                      className="font-bold text-sm hover:text-bauhaus-red transition-colors line-clamp-1"
                    >
                      {sg.grant?.name || 'Unknown Grant'}
                    </Link>
                    <div className="text-xs text-bauhaus-muted mt-1">
                      {sg.grant?.provider || '—'}
                    </div>
                    {sg.notes && (
                      <div className="text-xs text-gray-500 mt-1 italic line-clamp-1">{sg.notes}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {sg.grant?.closes_at && (
                      <div className={`text-xs font-bold ${daysUntil(sg.grant.closes_at) === 'Closed' ? 'text-red-500' : 'text-bauhaus-muted'}`}>
                        {daysUntil(sg.grant.closes_at)}
                      </div>
                    )}
                    {sg.grant?.amount_max && (
                      <div className="text-xs font-bold text-bauhaus-black">
                        {fmtMoney(sg.grant.amount_max)}
                      </div>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-sm ${STAGE_COLORS[sg.stage] || STAGE_COLORS.discovered}`}>
                      {STAGE_LABELS[sg.stage] || sg.stage}
                    </span>
                    {'⭐'.repeat(sg.stars || 0)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Foundations tab */}
      {activeTab === 'foundations' && (
        <div className="space-y-2">
          {savedFoundations.length === 0 ? (
            <EmptyState
              icon="🏛️"
              title="No saved foundations"
              description="Save foundations to track relationships and giving patterns."
              cta={{ label: 'Browse Foundations', href: '/foundations' }}
            />
          ) : (
            savedFoundations.map(sf => (
              <div key={sf.id} className="border-2 border-gray-200 p-4 hover:border-bauhaus-black transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={sf.foundation ? `/foundations/${sf.foundation.id}` : '#'}
                      className="font-bold text-sm hover:text-bauhaus-red transition-colors line-clamp-1"
                    >
                      {sf.foundation?.name || 'Unknown Foundation'}
                    </Link>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      {sf.foundation?.thematic_focus?.slice(0, 4).map(t => (
                        <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {sf.foundation?.total_giving_annual && (
                      <div className="text-xs font-bold text-bauhaus-black">
                        {fmtMoney(sf.foundation.total_giving_annual)}/yr
                      </div>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-sm ${STAGE_COLORS[sf.stage] || STAGE_COLORS.discovered}`}>
                      {STAGE_LABELS[sf.stage] || sf.stage}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Entities tab */}
      {activeTab === 'entities' && (
        <div>
          {/* Add entity watch form */}
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={watchGsId}
              onChange={e => setWatchGsId(e.target.value)}
              placeholder="Enter GS ID (e.g. AU-ABN-49018049971)"
              className="flex-1 px-3 py-2 border-2 border-gray-200 text-sm focus:border-bauhaus-black outline-none"
              onKeyDown={e => e.key === 'Enter' && addWatch()}
            />
            <button
              onClick={addWatch}
              disabled={adding || !watchGsId.trim()}
              className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors disabled:opacity-50"
            >
              {adding ? 'Adding...' : 'Watch'}
            </button>
          </div>

          {watches.length === 0 ? (
            <EmptyState
              icon="👁️"
              title="No entity watches"
              description="Watch specific entities to get notified when they receive new contracts, grants, or relationships."
            />
          ) : (
            <div className="space-y-2">
              {watches.map(w => (
                <div key={w.id} className="border-2 border-gray-200 p-4 hover:border-bauhaus-black transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/entities/${w.gs_id}`}
                        className="font-bold text-sm hover:text-bauhaus-red transition-colors"
                      >
                        {w.canonical_name || w.gs_id}
                      </Link>
                      <div className="text-xs text-bauhaus-muted mt-1">
                        {w.gs_id}
                      </div>
                      <div className="flex gap-1 mt-2">
                        {w.watch_types.map(t => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-bauhaus-muted">{timeAgo(w.created_at)}</span>
                      <button
                        onClick={() => removeWatch(w.id)}
                        className="text-xs text-red-500 hover:text-red-700 font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Alerts tab */}
      {activeTab === 'alerts' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-xs text-bauhaus-muted">
              Alerts notify you when new grants match your criteria.
            </p>
            <Link
              href="/tracker"
              className="text-xs font-black uppercase tracking-widest text-bauhaus-black hover:text-bauhaus-red"
            >
              Manage in Tracker &rarr;
            </Link>
          </div>

          {alerts.length === 0 ? (
            <EmptyState
              icon="🔔"
              title="No alerts configured"
              description="Set up alerts to get notified when new grants match your interests."
              cta={{ label: 'Go to Tracker', href: '/tracker' }}
            />
          ) : (
            <div className="space-y-2">
              {alerts.map(a => (
                <div key={a.id} className="border-2 border-gray-200 p-4 hover:border-bauhaus-black transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm">{a.name}</div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {a.categories?.map(c => (
                          <span key={c} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">{c}</span>
                        ))}
                        {a.states?.map(s => (
                          <span key={s} className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded">{s}</span>
                        ))}
                        {a.keywords?.map(k => (
                          <span key={k} className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded">&quot;{k}&quot;</span>
                        ))}
                      </div>
                      {a.min_amount || a.max_amount ? (
                        <div className="text-xs text-bauhaus-muted mt-1">
                          Amount: {fmtMoney(a.min_amount)} — {fmtMoney(a.max_amount)}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className={`text-[10px] px-2 py-0.5 font-bold uppercase rounded-sm ${a.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                        {a.enabled ? 'Active' : 'Paused'}
                      </span>
                      <span className="text-[10px] text-bauhaus-muted">{a.frequency}</span>
                      {a.match_count != null && (
                        <span className="text-[10px] text-bauhaus-muted">{a.match_count} matches</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────

function EmptyState({ icon, title, description, cta }: {
  icon: string;
  title: string;
  description: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="border-4 border-dashed border-bauhaus-black/20 p-12 text-center">
      <div className="text-3xl mb-3">{icon}</div>
      <div className="font-bold text-lg mb-1">{title}</div>
      <p className="text-sm text-bauhaus-muted max-w-md mx-auto">{description}</p>
      {cta && (
        <Link
          href={cta.href}
          className="inline-block mt-4 px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
