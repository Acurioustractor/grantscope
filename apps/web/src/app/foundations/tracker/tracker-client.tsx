'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { SavedFoundationRow } from './page';

const STAGES = [
  { value: 'discovered', label: 'Discovered' },
  { value: 'researching', label: 'Researching' },
  { value: 'connected', label: 'Connected' },
  { value: 'active_relationship', label: 'Active Relationship' },
];

function formatGiving(amount: number | null): string {
  if (!amount) return 'Unknown';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function typeLabel(type: string | null): string {
  const labels: Record<string, string> = {
    private_ancillary_fund: 'PAF',
    public_ancillary_fund: 'PuAF',
    trust: 'Trust',
    corporate_foundation: 'Corporate',
  };
  return type ? labels[type] || type : 'Foundation';
}

function StarDisplay({ stars }: { stars: number }) {
  return (
    <div className="flex items-center gap-0">
      {[1, 2, 3].map((s) => (
        <svg
          key={s}
          className="w-3.5 h-3.5"
          viewBox="0 0 20 20"
          fill={s <= stars ? '#F0C020' : 'none'}
          stroke={s <= stars ? '#F0C020' : '#D0D0D0'}
          strokeWidth={2}
        >
          <path d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.33L10 13.27l-4.77 2.51.91-5.33L2.27 6.62l5.34-.78L10 1z" />
        </svg>
      ))}
    </div>
  );
}

function FoundationCard({
  item,
  onUpdate,
  onRemove,
}: {
  item: SavedFoundationRow;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
  onRemove: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [localNotes, setLocalNotes] = useState(item.notes ?? '');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleNotesChange(value: string) {
    setLocalNotes(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onUpdate(item.foundation_id, { notes: value });
    }, 800);
  }

  return (
    <div className="bg-white border-4 border-bauhaus-black transition-all hover:-translate-y-0.5 bauhaus-shadow-sm">
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-bauhaus-black text-[15px] truncate">
                {item.foundation.name}
              </h3>
              <StarDisplay stars={item.stars} />
            </div>
            <div className="text-sm text-bauhaus-muted mt-0.5 flex items-center gap-2 flex-wrap font-medium">
              <span className="font-bold">{typeLabel(item.foundation.type)}</span>
              <span className="text-money font-black tabular-nums">
                {formatGiving(item.foundation.total_giving_annual)}/yr
              </span>
            </div>
            {item.notes && !expanded && (
              <p className="text-xs text-bauhaus-muted mt-1 line-clamp-1 font-medium">{item.notes}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <select
              value={item.stage}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                onUpdate(item.foundation_id, { stage: e.target.value });
              }}
              className="text-[11px] font-black uppercase tracking-wider px-2 py-1 border-2 border-bauhaus-black bg-white focus:outline-none"
            >
              {STAGES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <svg
              className={`w-4 h-4 text-bauhaus-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth={3}
            >
              <path strokeLinecap="square" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t-2 border-bauhaus-black/10 pt-3 space-y-3">
          <div>
            <label className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider block mb-1">Notes</label>
            <textarea
              value={localNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add notes..."
              rows={3}
              className="w-full px-3 py-2 text-sm font-medium border-2 border-bauhaus-black bg-white focus:outline-none focus:bg-bauhaus-yellow resize-y"
            />
          </div>
          <div className="flex items-center justify-between">
            <a
              href={`/foundations/${item.foundation_id}`}
              className="text-[11px] font-black text-bauhaus-blue uppercase tracking-wider hover:text-bauhaus-red"
            >
              View Profile &rarr;
            </a>
            <button
              onClick={() => onRemove(item.foundation_id)}
              className="text-[11px] font-black text-bauhaus-muted uppercase tracking-wider hover:text-bauhaus-red transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function FoundationTrackerClient() {
  const [foundations, setFoundations] = useState<SavedFoundationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [starFilter, setStarFilter] = useState(0);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/foundations/saved')
      .then((r) => {
        if (r.status === 401) {
          router.push('/login');
          return [];
        }
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) setFoundations(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [router]);

  function handleUpdate(foundationId: string, updates: Record<string, unknown>) {
    setFoundations((prev) =>
      prev.map((f) =>
        f.foundation_id === foundationId
          ? { ...f, ...updates, stage: (updates.stage as string) ?? f.stage, notes: (updates.notes as string) ?? f.notes }
          : f
      )
    );
    fetch(`/api/foundations/saved/${foundationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }).catch(() => {});
  }

  function handleRemove(foundationId: string) {
    setFoundations((prev) => prev.filter((f) => f.foundation_id !== foundationId));
    fetch(`/api/foundations/saved/${foundationId}`, { method: 'DELETE' }).catch(() => {});
  }

  const filtered = foundations.filter((f) => {
    if (activeTab !== 'all' && f.stage !== activeTab) return false;
    if (starFilter > 0 && f.stars < starFilter) return false;
    if (search && !f.foundation.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const stageCounts = foundations.reduce(
    (acc, f) => {
      acc[f.stage] = (acc[f.stage] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">
          Loading...
        </div>
      </div>
    );
  }

  const tabs = [
    { value: 'all', label: 'All', count: foundations.length },
    ...STAGES.map((s) => ({ value: s.value, label: s.label, count: stageCounts[s.value] || 0 })),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-black text-bauhaus-red uppercase tracking-[0.3em] mb-1">Tracker</p>
          <h1 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">
            My Foundations
          </h1>
        </div>
        <a
          href="/foundations"
          className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:text-bauhaus-red"
        >
          Browse Foundations &rarr;
        </a>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 mb-4 overflow-x-auto border-4 border-bauhaus-black">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2.5 text-[11px] font-black uppercase tracking-widest whitespace-nowrap transition-colors ${
              activeTab === tab.value
                ? 'bg-bauhaus-black text-white'
                : 'bg-white text-bauhaus-black hover:bg-bauhaus-canvas'
            } ${tab.value !== tabs[tabs.length - 1].value ? 'border-r-2 border-bauhaus-black/20' : ''}`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1.5 ${activeTab === tab.value ? 'text-white/60' : 'text-bauhaus-muted'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-0 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search saved foundations..."
          className="flex-1 px-4 py-2.5 border-4 border-bauhaus-black text-sm font-bold bg-white focus:bg-bauhaus-yellow focus:outline-none"
        />
        <select
          value={starFilter}
          onChange={(e) => setStarFilter(Number(e.target.value))}
          className="px-4 py-2.5 border-4 border-l-0 border-bauhaus-black text-sm font-bold bg-white focus:outline-none"
        >
          <option value={0}>All ratings</option>
          <option value={1}>1+ stars</option>
          <option value={2}>2+ stars</option>
          <option value={3}>3 stars</option>
        </select>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-bauhaus-canvas border-4 border-bauhaus-black p-8 text-center">
          <p className="text-sm font-black text-bauhaus-muted uppercase tracking-widest mb-2">
            {foundations.length === 0 ? 'No saved foundations yet' : 'No matches'}
          </p>
          <p className="text-sm text-bauhaus-muted font-medium">
            {foundations.length === 0
              ? 'Star foundations from the directory to start tracking them.'
              : 'Try adjusting your filters.'}
          </p>
          {foundations.length === 0 && (
            <a
              href="/foundations"
              className="inline-block mt-4 px-5 py-2.5 bg-bauhaus-black text-white text-xs font-black uppercase tracking-widest hover:bg-bauhaus-red"
            >
              Browse Foundations
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <FoundationCard
              key={item.id}
              item={item}
              onUpdate={handleUpdate}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
