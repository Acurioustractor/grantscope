'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { formatMoney, relTypeLabel, entityTypeBadge, entityTypeLabel } from '../_lib/formatters';

interface RelationshipRow {
  id: string;
  counterparty_name: string;
  counterparty_gs_id: string;
  counterparty_type: string;
  relationship_type: string;
  amount: number | null;
  year: number | null;
  dataset: string;
  properties: Record<string, string | null>;
}

interface MoneyResponse {
  relationships: RelationshipRow[];
  nextCursor: string | null;
  total: number;
}

const TYPE_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'contract', label: 'Contracts' },
  { key: 'donation', label: 'Donations' },
  { key: 'grant', label: 'Grants' },
] as const;

export function MoneyTab({ gsId, isPremium }: { gsId: string; isPremium: boolean }) {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [rows, setRows] = useState<RelationshipRow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const fetchPage = useCallback(
    async (cursorValue: string | null, type: string, reset: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: '50' });
        if (type !== 'all') params.set('type', type);
        if (cursorValue) params.set('cursor', cursorValue);

        const res = await fetch(`/api/entities/${gsId}/money?${params}`);
        if (!res.ok) throw new Error('Failed to fetch');
        const data: MoneyResponse = await res.json();

        setRows((prev) => (reset ? data.relationships : [...prev, ...data.relationships]));
        setCursor(data.nextCursor);
        setTotal(data.total);
      } finally {
        setInitialized(true);
        setLoading(false);
      }
    },
    [gsId],
  );

  // Load on first render
  if (!initialized && !loading) {
    fetchPage(null, typeFilter, true);
  }

  const handleTypeChange = (type: string) => {
    setTypeFilter(type);
    setRows([]);
    setCursor(null);
    fetchPage(null, type, true);
  };

  return (
    <div>
      {/* Type filter */}
      <div className="flex gap-0 mb-6 border-2 border-bauhaus-black inline-flex">
        {TYPE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => handleTypeChange(f.key)}
            className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-colors ${
              typeFilter === f.key
                ? 'bg-bauhaus-black text-white'
                : 'text-bauhaus-muted hover:text-bauhaus-black hover:bg-bauhaus-canvas'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {total !== null && (
        <p className="text-xs font-bold text-bauhaus-muted mb-4">
          {total.toLocaleString()} total {typeFilter === 'all' ? 'relationships' : typeFilter + 's'}
          {rows.length > 0 && ` — showing ${rows.length.toLocaleString()}`}
        </p>
      )}

      {/* Relationship rows */}
      <div className="space-y-0">
        {rows.map((r, i) => (
          <div key={`${r.id}-${i}`} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {r.counterparty_gs_id ? (
                  <Link href={`/entities/${r.counterparty_gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue truncate">
                    {r.counterparty_name}
                  </Link>
                ) : (
                  <span className="font-bold text-bauhaus-black truncate">{r.counterparty_name}</span>
                )}
                <span className={`text-[9px] font-black px-1.5 py-0.5 border uppercase tracking-widest shrink-0 ${entityTypeBadge(r.counterparty_type)}`}>
                  {entityTypeLabel(r.counterparty_type)}
                </span>
              </div>
              <div className="text-[11px] text-bauhaus-muted font-medium">
                {relTypeLabel(r.relationship_type)}
                {r.properties?.category && <span> &middot; {r.properties.category}</span>}
                {r.year && <span> &middot; {r.year}</span>}
                {r.properties?.procurement_method && <span> &middot; {r.properties.procurement_method}</span>}
              </div>
            </div>
            <div className="text-right ml-4 shrink-0">
              <div className="font-black text-bauhaus-black">{formatMoney(r.amount)}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {initialized && rows.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-bauhaus-muted font-bold">No {typeFilter === 'all' ? '' : typeFilter + ' '}relationships found</p>
        </div>
      )}

      {/* Load more / Premium gate */}
      {cursor && (
        <div className="mt-6 text-center">
          {isPremium ? (
            <button
              onClick={() => fetchPage(cursor, typeFilter, false)}
              disabled={loading}
              className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-blue transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="inline-block px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-blue transition-colors"
            >
              Unlock Full Dossier
            </Link>
          )}
        </div>
      )}

      {loading && rows.length === 0 && (
        <div className="text-center py-12">
          <div className="text-bauhaus-muted font-bold animate-pulse">Loading relationships...</div>
        </div>
      )}
    </div>
  );
}
