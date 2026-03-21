'use client';

import { useState, useEffect } from 'react';

interface KeyInfo {
  id: string;
  name: string;
  prefix: string;
  rate_limit: number;
  total_requests: number;
  last_used: string | null;
  week_requests: number;
  top_actions: { action: string; count: number }[];
}

interface OrgSummary {
  id: string;
  name: string;
  plan: string | null;
  created_at: string;
  active_keys: number;
  total_keys: number;
  total_requests: number;
  total_errors: number;
  week_requests: number;
  keys: KeyInfo[];
}

interface AdminData {
  totals: {
    total_orgs: number;
    total_active_keys: number;
    total_requests: number;
    week_requests: number;
  };
  orgs: OrgSummary[];
}

export function ApiUsageDashboard() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedOrg, setExpandedOrg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/api-usage')
      .then(r => {
        if (r.status === 403) throw new Error('Admin access required');
        if (!r.ok) throw new Error('Failed to load');
        return r.json();
      })
      .then(d => setData(d))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="border-4 border-bauhaus-black/10 p-12 text-center">
        <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">Loading usage data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border-4 border-bauhaus-red p-8 text-center">
        <span className="text-sm font-black text-bauhaus-red uppercase tracking-widest">{error}</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-8">
      {/* Global stats */}
      <div className="border-4 border-bauhaus-black">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x-4 divide-bauhaus-black">
          {[
            { value: data.totals.total_orgs, label: 'Organisations' },
            { value: data.totals.total_active_keys, label: 'Active Keys' },
            { value: data.totals.total_requests.toLocaleString(), label: 'Total Requests' },
            { value: data.totals.week_requests.toLocaleString(), label: '7-Day Requests' },
          ].map((s, i) => (
            <div key={s.label} className={`p-4 text-center ${i >= 2 ? 'border-t-4 border-bauhaus-black sm:border-t-0' : ''}`}>
              <div className="text-2xl font-black text-bauhaus-black tabular-nums">{s.value}</div>
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-org table */}
      <div className="border-4 border-bauhaus-black">
        <div className="bg-bauhaus-black text-white p-3">
          <h2 className="text-sm font-black uppercase tracking-widest">Usage By Organisation</h2>
        </div>
        {data.orgs.length === 0 ? (
          <div className="p-8 text-center text-sm text-bauhaus-muted font-medium">No organisations with API keys yet.</div>
        ) : (
          <div className="divide-y-2 divide-bauhaus-black/10">
            {data.orgs.map(org => (
              <div key={org.id}>
                <button
                  onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
                  className="w-full p-4 flex items-center gap-4 hover:bg-bauhaus-canvas/50 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-black text-sm text-bauhaus-black truncate">{org.name || 'Unnamed Org'}</span>
                      {org.plan && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-bauhaus-blue/10 text-bauhaus-blue">
                          {org.plan}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-bold text-bauhaus-muted uppercase tracking-widest">
                      <span>{org.active_keys} key{org.active_keys !== 1 ? 's' : ''}</span>
                      <span>{org.total_requests.toLocaleString()} total</span>
                      <span>{org.week_requests.toLocaleString()} this week</span>
                      {org.total_errors > 0 && (
                        <span className="text-bauhaus-red">{org.total_errors} errors</span>
                      )}
                    </div>
                  </div>
                  <span className="text-bauhaus-muted text-xs">{expandedOrg === org.id ? '▲' : '▼'}</span>
                </button>

                {/* Expanded: per-key details */}
                {expandedOrg === org.id && org.keys.length > 0 && (
                  <div className="border-t-2 border-bauhaus-black/10 bg-bauhaus-canvas/30 p-4 space-y-3">
                    {org.keys.map(k => (
                      <div key={k.id} className="border-2 border-bauhaus-black/10 bg-white p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-bold text-xs text-bauhaus-black">{k.name}</span>
                          <code className="text-[10px] font-mono text-bauhaus-muted">{k.prefix}...</code>
                          <span className="text-[10px] font-bold text-bauhaus-muted ml-auto">{k.rate_limit}/min</span>
                        </div>
                        <div className="flex items-center gap-4 text-[10px] font-bold text-bauhaus-muted uppercase tracking-widest mb-2">
                          <span>{(k.total_requests as number).toLocaleString()} total</span>
                          <span>{k.week_requests} this week</span>
                          {k.last_used && <span>Last: {new Date(k.last_used).toLocaleDateString()}</span>}
                        </div>
                        {k.top_actions.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {k.top_actions.map(a => (
                              <span key={a.action} className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-bauhaus-blue/10 text-bauhaus-blue">
                                {a.action}: {a.count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
