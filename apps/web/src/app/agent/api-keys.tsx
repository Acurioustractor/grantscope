'use client';

import { useState, useEffect, useCallback } from 'react';

interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  rate_limit_per_min: number;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  total_requests: number;
  total_errors: number;
}

interface UsageDay {
  day: string;
  requests: number;
  errors: number;
  avg_ms: number;
}

interface UsageData {
  keys: { id: string; name: string; prefix: string; requests: number; errors: number }[];
  totals: { requests: number; errors: number };
  daily: UsageDay[];
}

export function UsageDashboard() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/agent/usage')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setUsage(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!usage || usage.totals.requests === 0) return null;

  const daily = [...usage.daily].sort((a, b) => a.day.localeCompare(b.day)).slice(-14);
  const maxReqs = Math.max(...daily.map(d => d.requests), 1);
  const avgMs = daily.length > 0
    ? Math.round(daily.reduce((s, d) => s + d.avg_ms * d.requests, 0) / Math.max(daily.reduce((s, d) => s + d.requests, 0), 1))
    : 0;

  return (
    <section className="mb-12">
      <h2 className="text-xl font-black text-bauhaus-black mb-4">Usage</h2>
      <div className="border-4 border-bauhaus-black">
        {/* Stats row */}
        <div className="grid grid-cols-3 divide-x-4 divide-bauhaus-black border-b-4 border-bauhaus-black">
          <div className="p-4 text-center">
            <div className="text-2xl font-black text-bauhaus-black tabular-nums">{usage.totals.requests.toLocaleString()}</div>
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Total Requests</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-2xl font-black text-bauhaus-black tabular-nums">{usage.totals.errors.toLocaleString()}</div>
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Errors</div>
          </div>
          <div className="p-4 text-center">
            <div className="text-2xl font-black text-bauhaus-black tabular-nums">{avgMs}ms</div>
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">Avg Response</div>
          </div>
        </div>

        {/* Bar chart - last 14 days */}
        {daily.length > 0 && (
          <div className="p-4">
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-3">Last 14 Days</div>
            <div className="flex items-end gap-1 h-24">
              {daily.map(d => (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                  <div
                    className="w-full bg-bauhaus-blue hover:bg-bauhaus-red transition-colors cursor-default"
                    style={{ height: `${Math.max((d.requests / maxReqs) * 100, 4)}%` }}
                    title={`${d.day}: ${d.requests} requests, ${d.avg_ms}ms avg`}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 hidden group-hover:block bg-bauhaus-black text-white text-[9px] font-bold px-2 py-1 whitespace-nowrap z-10">
                    {d.day.slice(5)}: {d.requests} req, {d.avg_ms}ms
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-bauhaus-muted font-bold">{daily[0]?.day.slice(5)}</span>
              <span className="text-[9px] text-bauhaus-muted font-bold">{daily[daily.length - 1]?.day.slice(5)}</span>
            </div>
          </div>
        )}

        {/* Per-key breakdown */}
        {usage.keys.length > 1 && (
          <div className="border-t-4 border-bauhaus-black p-4">
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">By Key</div>
            <div className="space-y-1">
              {usage.keys.map(k => (
                <div key={k.id} className="flex items-center gap-2 text-xs font-medium text-bauhaus-muted">
                  <code className="text-[10px] font-mono">{k.prefix}...</code>
                  <span className="font-bold text-bauhaus-black">{k.name}</span>
                  <span className="ml-auto tabular-nums">{k.requests.toLocaleString()} req</span>
                  {k.errors > 0 && <span className="text-bauhaus-red tabular-nums">{k.errors} err</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export function ApiKeyManager() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [authed, setAuthed] = useState(true);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/keys');
      if (res.status === 401) {
        setAuthed(false);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setKeys(data.keys || []);
        setAuthed(true);
      } else {
        setError(data.error || 'Failed to load keys');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const createKey = async () => {
    setCreating(true);
    setError('');
    setNewKey(null);
    try {
      const res = await fetch('/api/agent/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: keyName || 'Default' }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewKey(data.key);
        setKeyName('');
        setShowCreate(false);
        fetchKeys();
      } else {
        setError(data.error || 'Failed to create key');
      }
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  };

  const revokeKey = async (id: string) => {
    if (!confirm('Revoke this API key? This cannot be undone.')) return;
    try {
      const res = await fetch(`/api/agent/keys?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchKeys();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to revoke');
      }
    } catch {
      setError('Network error');
    }
  };

  const activeKeys = keys.filter(k => !k.revoked_at);
  const revokedKeys = keys.filter(k => k.revoked_at);

  // Not authenticated — show sign-in prompt
  if (!authed) {
    return (
      <section id="api-keys" className="mb-12 scroll-mt-20">
        <h2 className="text-xl font-black text-bauhaus-black mb-4">API Keys</h2>
        <div className="border-4 border-bauhaus-black p-8 text-center">
          <div className="text-sm text-bauhaus-muted font-medium mb-4">
            Sign in to generate API keys and track usage.
          </div>
          <a
            href="/login"
            className="inline-block px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors"
          >
            Sign In
          </a>
        </div>
      </section>
    );
  }

  return (
    <section id="api-keys" className="mb-12 scroll-mt-20">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-black text-bauhaus-black">API Keys</h2>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="text-xs font-black uppercase tracking-widest px-4 py-2 bg-bauhaus-black text-white border-4 border-bauhaus-black hover:bg-bauhaus-blue transition-colors"
          >
            + New Key
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="border-4 border-bauhaus-red p-3 bg-bauhaus-red/5 mb-4">
          <span className="text-xs font-black text-bauhaus-red uppercase tracking-widest">{error}</span>
        </div>
      )}

      {/* New key revealed (show once) */}
      {newKey && (
        <div className="border-4 border-bauhaus-blue bg-bauhaus-blue/5 p-4 mb-4">
          <div className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-2">
            New API Key Created — Copy Now
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono text-sm text-bauhaus-black bg-white px-3 py-2 border-2 border-bauhaus-black/10 break-all select-all">
              {newKey}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(newKey); }}
              className="text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors shrink-0"
            >
              Copy
            </button>
          </div>
          <div className="text-[10px] text-bauhaus-muted font-bold mt-2">
            This key will not be shown again. Store it securely.
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="border-4 border-bauhaus-black p-4 mb-4">
          <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-3">Create API Key</div>
          <div className="flex gap-2">
            <input
              type="text"
              value={keyName}
              onChange={e => setKeyName(e.target.value)}
              placeholder="Key name (e.g. Production, Staging)"
              className="flex-1 px-3 py-2 border-2 border-bauhaus-black/15 text-sm font-medium outline-none focus:border-bauhaus-black"
            />
            <button
              onClick={createKey}
              disabled={creating}
              className="text-xs font-black uppercase tracking-widest px-4 py-2 bg-bauhaus-black text-white hover:bg-bauhaus-blue transition-colors disabled:opacity-40"
            >
              {creating ? 'Creating...' : 'Create'}
            </button>
            <button
              onClick={() => { setShowCreate(false); setKeyName(''); }}
              className="text-xs font-black uppercase tracking-widest px-3 py-2 border-2 border-bauhaus-black/15 hover:border-bauhaus-black transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="border-4 border-bauhaus-black/10 p-8 text-center">
          <span className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">Loading keys...</span>
        </div>
      )}

      {/* Active keys */}
      {!loading && activeKeys.length > 0 && (
        <div className="border-4 border-bauhaus-black divide-y-2 divide-bauhaus-black/10">
          {activeKeys.map(k => (
            <div key={k.id} className="p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-black text-sm text-bauhaus-black">{k.name}</span>
                  <code className="text-[10px] font-mono text-bauhaus-muted">{k.key_prefix}...</code>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold text-bauhaus-muted uppercase tracking-widest">
                  <span>{k.total_requests.toLocaleString()} requests</span>
                  {k.total_errors > 0 && (
                    <span className="text-bauhaus-red">{k.total_errors} errors</span>
                  )}
                  <span>{k.rate_limit_per_min}/min</span>
                  {k.last_used_at && (
                    <span>Last used {new Date(k.last_used_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => revokeKey(k.id)}
                className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 border-2 border-bauhaus-red/30 text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors shrink-0"
              >
                Revoke
              </button>
            </div>
          ))}
        </div>
      )}

      {/* No keys yet */}
      {!loading && activeKeys.length === 0 && !newKey && (
        <div className="border-4 border-bauhaus-black/10 p-8 text-center">
          <div className="text-sm text-bauhaus-muted font-medium mb-1">No API keys yet</div>
          <div className="text-xs text-bauhaus-muted">Create a key to authenticate your agent requests.</div>
        </div>
      )}

      {/* Revoked keys (collapsed) */}
      {revokedKeys.length > 0 && (
        <details className="mt-4">
          <summary className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest cursor-pointer">
            {revokedKeys.length} revoked key{revokedKeys.length !== 1 ? 's' : ''}
          </summary>
          <div className="mt-2 border-2 border-bauhaus-black/10 divide-y divide-bauhaus-black/5">
            {revokedKeys.map(k => (
              <div key={k.id} className="p-3 flex items-center gap-3 opacity-50">
                <span className="font-bold text-xs text-bauhaus-black">{k.name}</span>
                <code className="text-[10px] font-mono text-bauhaus-muted">{k.key_prefix}...</code>
                <span className="text-[10px] text-bauhaus-muted">
                  Revoked {k.revoked_at ? new Date(k.revoked_at).toLocaleDateString() : ''}
                </span>
                <span className="text-[10px] text-bauhaus-muted">{k.total_requests.toLocaleString()} total requests</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
