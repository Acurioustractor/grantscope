'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  enabled: boolean;
  created_at: string;
  last_used_at: string | null;
  rate_limit_per_hour: number;
  expires_at: string | null;
}

interface NewKeyResponse {
  id: string;
  key_prefix: string;
  name: string;
  enabled: boolean;
  created_at: string;
  rate_limit_per_hour: number;
  key: string;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function ApiKeysClient() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKeyResponse, setNewKeyResponse] = useState<NewKeyResponse | null>(null);
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [deletingKeyId, setDeletingKeyId] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
  }, []);

  async function loadKeys() {
    try {
      setLoading(true);
      const res = await fetch('/api/keys');
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to load API keys');
      }
      const data = await res.json();
      setKeys(data.keys);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load API keys');
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    try {
      setCreating(true);
      const res = await fetch('/api/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to create API key');
      }
      const data: NewKeyResponse = await res.json();
      setNewKeyResponse(data);
      setNewKeyName('');
      setShowCreateForm(false);
      await loadKeys();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to create API key');
    } finally {
      setCreating(false);
    }
  }

  async function toggleEnabled(keyId: string, currentlyEnabled: boolean) {
    try {
      const res = await fetch(`/api/keys/${keyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentlyEnabled }),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to update API key');
      }
      await loadKeys();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update API key');
    }
  }

  async function deleteKey(keyId: string) {
    if (!confirm('Are you sure you want to revoke this API key? This cannot be undone.')) return;
    try {
      setDeletingKeyId(keyId);
      const res = await fetch(`/api/keys/${keyId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to delete API key');
      }
      await loadKeys();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete API key');
    } finally {
      setDeletingKeyId(null);
    }
  }

  function copyToClipboard(text: string, keyId: string) {
    navigator.clipboard.writeText(text);
    setCopiedKeyId(keyId);
    setTimeout(() => setCopiedKeyId(null), 2000);
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="text-sm text-bauhaus-muted">Loading API keys...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="p-4 border-4 border-bauhaus-red bg-red-50">
          <div className="text-sm font-black text-bauhaus-red uppercase tracking-widest">Error</div>
          <div className="text-sm mt-1">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <Link href="/home" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-black text-bauhaus-black mt-1">API Keys</h1>
          <p className="text-sm text-bauhaus-muted mt-1">
            Manage programmatic access to CivicGraph data.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-blue transition-colors"
        >
          {showCreateForm ? 'Cancel' : 'Create New Key'}
        </button>
      </div>

      {/* New key display (one-time) */}
      {newKeyResponse && (
        <div className="mb-6 p-4 border-4 border-bauhaus-blue bg-blue-50">
          <div className="text-xs font-black text-bauhaus-blue uppercase tracking-widest mb-2">
            API Key Created
          </div>
          <div className="text-sm font-black text-bauhaus-black mb-2">
            Save this key now. It will not be shown again.
          </div>
          <div className="flex items-center gap-2 mt-3">
            <code className="flex-1 px-3 py-2 bg-white border-2 border-bauhaus-black font-mono text-xs break-all">
              {newKeyResponse.key}
            </code>
            <button
              onClick={() => copyToClipboard(newKeyResponse.key, 'new')}
              className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-blue transition-colors"
            >
              {copiedKeyId === 'new' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <button
            onClick={() => setNewKeyResponse(null)}
            className="mt-3 text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="mb-6 p-4 border-4 border-bauhaus-black">
          <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-3">
            Create New API Key
          </div>
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (e.g., Production, Development)"
            className="w-full px-3 py-2 border-2 border-bauhaus-black text-sm mb-3"
            onKeyDown={(e) => e.key === 'Enter' && createKey()}
          />
          <button
            onClick={createKey}
            disabled={!newKeyName.trim() || creating}
            className="px-4 py-2 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-blue transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Creating...' : 'Create Key'}
          </button>
        </div>
      )}

      {/* API keys list */}
      <div className="border-4 border-bauhaus-black">
        <div className="p-4 bg-bauhaus-canvas border-b-2 border-bauhaus-black">
          <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest">
            Your API Keys ({keys.length})
          </div>
        </div>
        {keys.length === 0 ? (
          <div className="p-8 text-center text-sm text-bauhaus-muted">
            No API keys yet. Create one to get started.
          </div>
        ) : (
          <div className="divide-y-2 divide-bauhaus-black/10">
            {keys.map((key) => (
              <div key={key.id} className="p-4 hover:bg-bauhaus-canvas transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono font-black text-bauhaus-black">
                        {key.key_prefix}...
                      </code>
                      {!key.enabled && (
                        <span className="px-2 py-0.5 bg-bauhaus-muted/20 text-xs font-black text-bauhaus-muted uppercase tracking-widest">
                          Disabled
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-black text-bauhaus-black">{key.name}</div>
                    <div className="text-xs text-bauhaus-muted mt-1">
                      Created {timeAgo(key.created_at)} • Last used {timeAgo(key.last_used_at)} • {key.rate_limit_per_hour.toLocaleString()} req/hr
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleEnabled(key.id, key.enabled)}
                      className="px-3 py-1 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                    >
                      {key.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => deleteKey(key.id)}
                      disabled={deletingKeyId === key.id}
                      className="px-3 py-1 text-xs font-black uppercase tracking-widest border-2 border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors disabled:opacity-50"
                    >
                      {deletingKeyId === key.id ? 'Revoking...' : 'Revoke'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documentation */}
      <div className="mt-8 border-4 border-bauhaus-black">
        <div className="p-4 bg-bauhaus-canvas border-b-2 border-bauhaus-black">
          <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest">
            API Documentation
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <div className="text-sm font-black text-bauhaus-black mb-2">Authentication</div>
            <div className="text-sm text-bauhaus-muted mb-2">
              Include your API key in the Authorization header:
            </div>
            <code className="block px-3 py-2 bg-bauhaus-canvas border-2 border-bauhaus-black font-mono text-xs">
              Authorization: Bearer cg_your_api_key_here
            </code>
          </div>

          <div>
            <div className="text-sm font-black text-bauhaus-black mb-2">Base URL</div>
            <code className="block px-3 py-2 bg-bauhaus-canvas border-2 border-bauhaus-black font-mono text-xs">
              https://civicgraph.app/api
            </code>
          </div>

          <div>
            <div className="text-sm font-black text-bauhaus-black mb-2">Example Request</div>
            <pre className="px-3 py-2 bg-bauhaus-canvas border-2 border-bauhaus-black font-mono text-xs overflow-x-auto">
{`curl https://civicgraph.app/api/data/entities \\
  -H "Authorization: Bearer cg_your_api_key_here"`}
            </pre>
          </div>

          <div>
            <div className="text-sm font-black text-bauhaus-black mb-2">Available Endpoints</div>
            <ul className="text-sm text-bauhaus-muted space-y-1">
              <li><code className="text-xs font-mono">GET /api/data/entities</code> - Search entities</li>
              <li><code className="text-xs font-mono">GET /api/data/relationships</code> - Query relationships</li>
              <li><code className="text-xs font-mono">GET /api/data/grants</code> - List grant opportunities</li>
              <li><code className="text-xs font-mono">GET /api/data/foundations</code> - Search foundations</li>
              <li><code className="text-xs font-mono">GET /api/data/social-enterprises</code> - Query social enterprises</li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-black text-bauhaus-black mb-2">Rate Limits</div>
            <div className="text-sm text-bauhaus-muted">
              Standard keys: 1,000 requests per hour. Contact us for higher limits.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
