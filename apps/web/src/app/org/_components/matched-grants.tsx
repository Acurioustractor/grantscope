'use client';

import { useState } from 'react';

interface MatchedGrant {
  id: string;
  name: string;
  description: string | null;
  amount_min: number | null;
  amount_max: number | null;
  deadline: string | null;
  closes_at: string | null;
  provider: string | null;
  categories: string[] | null;
  url: string | null;
}

function money(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

const TH = 'text-left py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400';
const TH_R = 'text-right py-3 pr-4 font-black uppercase tracking-widest text-[10px] text-gray-400';
const TD = 'py-3 pr-4';
const TD_R = 'py-3 pr-4 text-right';
const THEAD = 'border-b-2 border-gray-200 bg-gray-50/50';
const ROW = (i: number) =>
  `border-b border-gray-100 hover:bg-blue-50/30 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`;

export function MatchedGrantsTable({
  grants,
  orgProfileId,
}: {
  grants: MatchedGrant[];
  orgProfileId: string;
}) {
  const [items, setItems] = useState(grants);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function addToPipeline(grant: MatchedGrant) {
    setAdding(grant.id);
    try {
      const amount = grant.amount_max || grant.amount_min;
      const res = await fetch(`/api/org/${orgProfileId}/pipeline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: grant.name,
          amount_display: amount ? money(amount) : null,
          amount_numeric: amount,
          funder: grant.provider,
          deadline: grant.deadline || grant.closes_at,
          status: 'prospect',
          grant_opportunity_id: grant.id,
          funder_type: 'government',
        }),
      });
      if (res.ok) {
        setAdded(prev => new Set(prev).add(grant.id));
        // Remove from list after a brief delay so user sees the confirmation
        setTimeout(() => {
          setItems(prev => prev.filter(g => g.id !== grant.id));
        }, 1500);
      }
    } catch {
      // silently fail — button will reset
    } finally {
      setAdding(null);
    }
  }

  if (items.length === 0) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse table-fixed">
          <thead>
            <tr className={THEAD}>
              <th className={`${TH} pl-4 w-[28%]`}>Opportunity</th>
              <th className={`${TH} w-[18%]`}>Provider</th>
              <th className={`${TH_R} w-[10%]`}>Amount</th>
              <th className={`${TH} w-[11%]`}>Deadline</th>
              <th className={`${TH} w-[22%]`}>Categories</th>
              <th className={`${TH} w-[11%]`}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((g, i) => {
              const isAdded = added.has(g.id);
              const isAdding = adding === g.id;
              return (
                <tr key={g.id} className={ROW(i)}>
                  <td className={`${TD} pl-4 font-medium`}>
                    {g.url ? (
                      <a href={g.url} target="_blank" rel="noopener noreferrer" className="text-bauhaus-blue hover:underline line-clamp-2">
                        {g.name}
                      </a>
                    ) : <span className="line-clamp-2">{g.name}</span>}
                  </td>
                  <td className={`${TD} text-gray-500 truncate`}>{g.provider}</td>
                  <td className={`${TD_R} font-mono whitespace-nowrap`}>
                    {g.amount_max ? money(g.amount_max) : g.amount_min ? money(g.amount_min) : '—'}
                  </td>
                  <td className={`${TD} text-gray-400 text-xs whitespace-nowrap`}>{g.deadline ?? g.closes_at ?? '—'}</td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-1">
                      {g.categories?.slice(0, 3).map((c, j) => (
                        <span key={j} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 font-medium rounded-sm">{c}</span>
                      ))}
                    </div>
                  </td>
                  <td className={TD}>
                    {isAdded ? (
                      <span className="text-[10px] px-2 py-1 bg-green-100 text-green-700 font-bold rounded-sm">
                        Added
                      </span>
                    ) : (
                      <button
                        onClick={() => addToPipeline(g)}
                        disabled={isAdding}
                        className="text-[10px] px-2 py-1 bg-bauhaus-black text-white font-bold uppercase tracking-wider rounded-sm hover:bg-gray-800 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                      >
                        {isAdding ? '...' : '+ Pipeline'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
