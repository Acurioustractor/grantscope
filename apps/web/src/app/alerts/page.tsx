'use client';

import { useEffect, useState, useCallback } from 'react';
import { createSupabaseBrowser } from '@/lib/supabase-browser';
import Link from 'next/link';

interface MatchingGrant {
  id: string;
  name: string;
  provider: string;
  amount_min: number | null;
  amount_max: number | null;
  closes_at: string | null;
  categories: string[];
  url: string | null;
}

interface Alert {
  id: string;
  name: string;
  frequency: string;
  categories: string[];
  focus_areas: string[];
  states: string[];
  min_amount: number | null;
  max_amount: number | null;
  keywords: string[];
  entity_types: string[];
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const FREQUENCIES = ['daily', 'weekly', 'monthly'];
const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];
const CATEGORIES = ['Education', 'Health', 'Environment', 'Arts & Culture', 'Community', 'Indigenous', 'Research', 'Social Services'];

export default function AlertsPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [alertMatches, setAlertMatches] = useState<Record<string, MatchingGrant[]>>({});
  const [matchLoading, setMatchLoading] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState('weekly');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [keywords, setKeywords] = useState('');

  useEffect(() => {
    const supabase = createSupabaseBrowser();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const fetchAlerts = useCallback(async () => {
    const res = await fetch('/api/alerts');
    if (res.ok) {
      const data = await res.json();
      setAlerts(data.alerts || []);
    }
  }, []);

  useEffect(() => {
    if (user) fetchAlerts();
  }, [user, fetchAlerts]);

  async function createAlert(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name || 'My Alert',
        frequency,
        categories: selectedCategories,
        states: selectedStates,
        min_amount: minAmount ? Number(minAmount) : null,
        max_amount: maxAmount ? Number(maxAmount) : null,
        keywords: keywords ? keywords.split(',').map(k => k.trim()).filter(Boolean) : [],
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setName('');
      setFrequency('weekly');
      setSelectedCategories([]);
      setSelectedStates([]);
      setMinAmount('');
      setMaxAmount('');
      setKeywords('');
      fetchAlerts();
    }
    setSaving(false);
  }

  async function toggleAlert(id: string, enabled: boolean) {
    await fetch(`/api/alerts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !enabled }),
    });
    fetchAlerts();
  }

  async function deleteAlert(id: string) {
    if (!confirm('Delete this alert?')) return;
    await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    fetchAlerts();
  }

  async function viewMatches(alertId: string) {
    if (expandedAlert === alertId) {
      setExpandedAlert(null);
      return;
    }
    setExpandedAlert(alertId);
    if (alertMatches[alertId]) return;
    setMatchLoading(alertId);
    const res = await fetch(`/api/alerts/matches?alertId=${alertId}`);
    if (res.ok) {
      const data = await res.json();
      setAlertMatches(prev => ({ ...prev, [alertId]: data.grants || [] }));
    }
    setMatchLoading(null);
  }

  async function trackGrant(grantId: string) {
    await fetch(`/api/tracker/${grantId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'discovered' }),
    });
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
          <p className="text-bauhaus-muted mb-6">Create grant alerts to get notified about new opportunities matching your criteria.</p>
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-black uppercase tracking-widest">Grant Alerts</h1>
            <p className="text-bauhaus-muted mt-1">Get notified when grants match your criteria</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-bauhaus-black text-white px-6 py-3 font-bold uppercase tracking-wider hover:bg-bauhaus-red transition-colors"
          >
            {showForm ? 'Cancel' : '+ New Alert'}
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <form onSubmit={createAlert} className="border-4 border-bauhaus-black p-6 mb-8">
            <h2 className="text-xl font-black uppercase tracking-wider mb-4">New Alert</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Indigenous Health Grants"
                  className="w-full border-2 border-bauhaus-black px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1">Frequency</label>
                <select
                  value={frequency}
                  onChange={e => setFrequency(e.target.value)}
                  className="w-full border-2 border-bauhaus-black px-3 py-2"
                >
                  {FREQUENCIES.map(f => (
                    <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">Categories</label>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategories(prev =>
                      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
                    )}
                    className={`px-3 py-1 border-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                      selectedCategories.includes(cat)
                        ? 'border-bauhaus-red bg-bauhaus-red text-white'
                        : 'border-bauhaus-black hover:bg-gray-100'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider mb-1">States</label>
              <div className="flex flex-wrap gap-2">
                {STATES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedStates(prev =>
                      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
                    )}
                    className={`px-3 py-1 border-2 text-sm font-bold uppercase tracking-wider transition-colors ${
                      selectedStates.includes(s)
                        ? 'border-bauhaus-blue bg-bauhaus-blue text-white'
                        : 'border-bauhaus-black hover:bg-gray-100'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1">Min Amount</label>
                <input
                  type="number"
                  value={minAmount}
                  onChange={e => setMinAmount(e.target.value)}
                  placeholder="$0"
                  className="w-full border-2 border-bauhaus-black px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1">Max Amount</label>
                <input
                  type="number"
                  value={maxAmount}
                  onChange={e => setMaxAmount(e.target.value)}
                  placeholder="No limit"
                  className="w-full border-2 border-bauhaus-black px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider mb-1">Keywords</label>
                <input
                  type="text"
                  value={keywords}
                  onChange={e => setKeywords(e.target.value)}
                  placeholder="housing, climate, youth"
                  className="w-full border-2 border-bauhaus-black px-3 py-2"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="bg-bauhaus-red text-white px-6 py-3 font-bold uppercase tracking-wider hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Alert'}
            </button>
          </form>
        )}

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <div className="border-2 border-dashed border-bauhaus-black/20 p-8 text-center">
            <p className="text-2xl font-black uppercase tracking-widest text-gray-400 mb-2">No Alerts Yet</p>
            <p className="text-bauhaus-muted">Create your first alert to start receiving grant notifications.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map(alert => (
              <div key={alert.id} className="border-2 border-bauhaus-black p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-black uppercase tracking-wider">{alert.name}</h3>
                      <span className={`px-2 py-0.5 text-xs font-bold uppercase ${
                        alert.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {alert.enabled ? 'Active' : 'Paused'}
                      </span>
                      <span className="px-2 py-0.5 text-xs font-bold uppercase bg-bauhaus-blue text-white">
                        {alert.frequency}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-2">
                      {alert.categories?.map(c => (
                        <span key={c} className="px-2 py-0.5 text-xs border border-bauhaus-black">{c}</span>
                      ))}
                      {alert.states?.map(s => (
                        <span key={s} className="px-2 py-0.5 text-xs border border-bauhaus-blue text-bauhaus-blue">{s}</span>
                      ))}
                      {alert.keywords?.map(k => (
                        <span key={k} className="px-2 py-0.5 text-xs bg-gray-100">{k}</span>
                      ))}
                    </div>

                    {(alert.min_amount || alert.max_amount) && (
                      <p className="text-sm text-bauhaus-muted">
                        Amount: {alert.min_amount ? `$${alert.min_amount.toLocaleString()}` : '$0'}
                        {' — '}
                        {alert.max_amount ? `$${alert.max_amount.toLocaleString()}` : 'No limit'}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={() => viewMatches(alert.id)}
                      className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border-2 transition-colors ${
                        expandedAlert === alert.id
                          ? 'border-bauhaus-blue bg-bauhaus-blue text-white'
                          : 'border-bauhaus-blue text-bauhaus-blue hover:bg-blue-50'
                      }`}
                    >
                      {expandedAlert === alert.id ? 'Hide' : 'View Matches'}
                    </button>
                    <button
                      onClick={() => toggleAlert(alert.id, alert.enabled)}
                      className={`px-3 py-1 text-xs font-bold uppercase tracking-wider border-2 transition-colors ${
                        alert.enabled
                          ? 'border-gray-400 text-gray-600 hover:bg-gray-100'
                          : 'border-green-600 text-green-600 hover:bg-green-50'
                      }`}
                    >
                      {alert.enabled ? 'Pause' : 'Enable'}
                    </button>
                    <button
                      onClick={() => deleteAlert(alert.id)}
                      className="px-3 py-1 text-xs font-bold uppercase tracking-wider border-2 border-red-500 text-red-500 hover:bg-red-50 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Matching Grants */}
                {expandedAlert === alert.id && (
                  <div className="mt-3 border-t-2 border-bauhaus-black/10 pt-3">
                    {matchLoading === alert.id ? (
                      <p className="text-xs font-black text-bauhaus-muted uppercase tracking-widest">Loading matches...</p>
                    ) : (alertMatches[alert.id]?.length || 0) === 0 ? (
                      <p className="text-sm text-bauhaus-muted">No matching grants found for this alert&apos;s criteria.</p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-bauhaus-muted mb-2">
                          {alertMatches[alert.id].length} Matching Grant{alertMatches[alert.id].length !== 1 ? 's' : ''}
                        </p>
                        {alertMatches[alert.id].map(grant => (
                          <div key={grant.id} className="flex items-center justify-between border-2 border-gray-200 px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <a href={`/grants/${grant.id}`} className="font-bold text-sm hover:text-bauhaus-blue truncate block">{grant.name}</a>
                              <div className="text-xs text-bauhaus-muted flex items-center gap-2">
                                <span>{grant.provider}</span>
                                {grant.amount_max && <span className="font-black tabular-nums">Up to ${grant.amount_max.toLocaleString()}</span>}
                                {grant.closes_at && (
                                  <span>Closes {new Date(grant.closes_at).toLocaleDateString()}</span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => trackGrant(grant.id)}
                              className="ml-3 px-3 py-1 text-[10px] font-black uppercase tracking-wider border-2 border-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors flex-shrink-0"
                            >
                              Track
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
