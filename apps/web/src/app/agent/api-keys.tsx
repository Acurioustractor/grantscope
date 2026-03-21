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
      <section className="mb-12">
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
    <section className="mb-12">
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
