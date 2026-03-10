'use client';

import { useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import Link from 'next/link';

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  permissions: string[];
  rate_limit_per_hour: number;
  enabled: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Form
  const [keyName, setKeyName] = useState('');
  const [rateLimit, setRateLimit] = useState('100');

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const fetchKeys = useCallback(async () => {
    const res = await fetch('/api/keys');
    if (res.ok) {
      const data = await res.json();
      setKeys(data.keys || []);
    }
  }, []);

  useEffect(() => {
    if (user) fetchKeys();
  }, [user, fetchKeys]);

  async function createKey(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    const res = await fetch('/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: keyName || 'Default',
        rate_limit_per_hour: Number(rateLimit) || 100,
        permissions: ['read'],
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setNewKey(data.key.raw_key);
      setShowForm(false);
      setKeyName('');
      fetchKeys();
    }
    setCreating(false);
  }

  async function copyKey() {
    if (newKey) {
      await navigator.clipboard.writeText(newKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[40vh]">
      <div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">Loading...</div>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="border-4 border-bauhaus-black p-12 text-center max-w-md">
          <h1 className="text-3xl font-black uppercase tracking-widest mb-4">Sign In Required</h1>
          <p className="text-bauhaus-muted mb-6">Manage your API keys and account settings.</p>
          <Link href="/auth/login" className="inline-block bg-bauhaus-black text-white px-8 py-3 font-bold uppercase tracking-wider hover:bg-bauhaus-red transition-colors">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
        {/* Header */}
        <h1 className="text-4xl font-black uppercase tracking-widest mb-2">Settings</h1>
        <p className="text-bauhaus-muted mb-8">Account: {user.email}</p>

        {/* API Keys Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-black uppercase tracking-wider">API Keys</h2>
            <button
              onClick={() => { setShowForm(!showForm); setNewKey(null); }}
              className="bg-bauhaus-black text-white px-4 py-2 font-bold uppercase tracking-wider text-sm hover:bg-bauhaus-red transition-colors"
            >
              {showForm ? 'Cancel' : '+ New Key'}
            </button>
          </div>

          {/* New key reveal */}
          {newKey && (
            <div className="border-4 border-green-600 bg-green-50 p-4 mb-4">
              <p className="text-xs font-bold uppercase tracking-wider text-green-800 mb-2">
                Key Created — Copy it now. It will not be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-white border-2 border-green-600 px-3 py-2 font-mono text-sm break-all">
                  {newKey}
                </code>
                <button
                  onClick={copyKey}
                  className="px-4 py-2 bg-green-600 text-white font-bold uppercase text-sm hover:bg-green-700 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <button
                onClick={() => setNewKey(null)}
                className="text-xs text-green-700 mt-2 underline"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Create form */}
          {showForm && (
            <form onSubmit={createKey} className="border-4 border-bauhaus-black p-4 mb-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1">Key Name</label>
                  <input
                    type="text"
                    value={keyName}
                    onChange={e => setKeyName(e.target.value)}
                    placeholder="e.g. Production App"
                    className="w-full border-2 border-bauhaus-black px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-1">Rate Limit / Hour</label>
                  <input
                    type="number"
                    value={rateLimit}
                    onChange={e => setRateLimit(e.target.value)}
                    className="w-full border-2 border-bauhaus-black px-3 py-2"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={creating}
                className="bg-bauhaus-red text-white px-6 py-2 font-bold uppercase tracking-wider hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {creating ? 'Generating...' : 'Generate Key'}
              </button>
            </form>
          )}

          {/* Keys list */}
          {keys.length === 0 ? (
            <div className="border-2 border-dashed border-bauhaus-black/20 p-8 text-center">
              <p className="text-lg font-black uppercase tracking-widest text-gray-400">No API Keys</p>
              <p className="text-bauhaus-muted text-sm mt-1">Create an API key to access CivicGraph data programmatically.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {keys.map(key => (
                <div key={key.id} className="border-2 border-bauhaus-black p-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <code className="font-mono text-sm bg-gray-100 px-2 py-1">{key.key_prefix}...</code>
                    <span className="font-bold text-sm">{key.name}</span>
                    <span className={`text-xs px-2 py-0.5 font-bold uppercase ${
                      key.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {key.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  <div className="text-xs text-bauhaus-muted">
                    {key.rate_limit_per_hour}/hr
                    {key.last_used_at && ` · Last used ${new Date(key.last_used_at).toLocaleDateString()}`}
                    {' · '}Created {new Date(key.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick Links */}
        <section>
          <h2 className="text-2xl font-black uppercase tracking-wider mb-4">Quick Links</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/alerts" className="border-2 border-bauhaus-black p-4 text-center hover:bg-gray-50 transition-colors">
              <p className="font-bold uppercase tracking-wider text-sm">Alerts</p>
              <p className="text-xs text-bauhaus-muted">Grant notifications</p>
            </Link>
            <Link href="/tracker" className="border-2 border-bauhaus-black p-4 text-center hover:bg-gray-50 transition-colors">
              <p className="font-bold uppercase tracking-wider text-sm">My Grants</p>
              <p className="text-xs text-bauhaus-muted">Track applications</p>
            </Link>
            <Link href="/grants" className="border-2 border-bauhaus-black p-4 text-center hover:bg-gray-50 transition-colors">
              <p className="font-bold uppercase tracking-wider text-sm">Search</p>
              <p className="text-xs text-bauhaus-muted">Find grants</p>
            </Link>
            <Link href="/entities" className="border-2 border-bauhaus-black p-4 text-center hover:bg-gray-50 transition-colors">
              <p className="font-bold uppercase tracking-wider text-sm">Entities</p>
              <p className="text-xs text-bauhaus-muted">Organisation dossiers</p>
            </Link>
          </div>
        </section>
    </div>
  );
}
