'use client';

import { useState, useEffect } from 'react';

interface PlaceData {
  sa2_code: string;
  sa2_name: string;
  state: string;
  remoteness: string;
  total_funding: number;
  entity_count: number;
  community_controlled_count: number;
  local_pct: number;
  seifa_decile: number | null;
  top_recipients: Array<{ gs_id: string; name: string; type: string; revenue: number | null }>;
  top_funders: Array<{ name: string; amount: number; type: string }>;
}

function formatDollars(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '$0';
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function seifaLabel(decile: number | null): { text: string; color: string } {
  if (decile === null) return { text: 'Unknown', color: 'text-bauhaus-muted' };
  if (decile <= 2) return { text: 'Most Disadvantaged', color: 'text-red-600' };
  if (decile <= 4) return { text: 'Disadvantaged', color: 'text-orange-600' };
  if (decile <= 6) return { text: 'Middle', color: 'text-bauhaus-muted' };
  if (decile <= 8) return { text: 'Advantaged', color: 'text-green-600' };
  return { text: 'Most Advantaged', color: 'text-green-700' };
}

function entityTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    charity: 'C',
    foundation: 'F',
    company: 'Co',
    government_body: 'G',
    indigenous_corp: 'IC',
    political_party: 'P',
    social_enterprise: 'SE',
    person: 'Pe',
  };
  return icons[type] || '?';
}

interface PlaceDetailProps {
  sa2Code: string | null;
  onClose: () => void;
  onSelectEntity?: (gsId: string) => void;
}

export function PlaceDetail({ sa2Code, onClose, onSelectEntity }: PlaceDetailProps) {
  const [data, setData] = useState<PlaceData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!sa2Code) { setData(null); return; }
    setLoading(true);
    fetch(`/api/power/place/${sa2Code}`)
      .then(r => {
        if (!r.ok) return null;
        return r.json();
      })
      .then(d => {
        if (d && !d.error) {
          setData(d);
        } else {
          setData(null);
        }
        setLoading(false);
      })
      .catch(() => { setData(null); setLoading(false); });
  }, [sa2Code]);

  if (!sa2Code) return null;

  const seifa = data ? seifaLabel(data.seifa_decile) : null;

  return (
    <div className="fixed top-0 right-0 h-full w-full sm:w-[420px] bg-white border-l-4 border-bauhaus-black shadow-[-8px_0_0_0_rgba(0,0,0,0.08)] z-[2000] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b-4 border-bauhaus-black p-4 flex items-start justify-between">
        <div>
          {loading ? (
            <div className="h-6 w-48 bg-bauhaus-canvas animate-pulse" />
          ) : data ? (
            <>
              <h2 className="font-black text-xl text-bauhaus-black">{data.sa2_name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-bauhaus-muted">{data.state}</span>
                {data.remoteness && (
                  <span className="text-[10px] font-black px-2 py-0.5 bg-bauhaus-canvas text-bauhaus-muted uppercase tracking-wider">
                    {data.remoteness}
                  </span>
                )}
                {seifa && (
                  <span className={`text-[10px] font-black px-2 py-0.5 border border-current uppercase tracking-wider ${seifa.color}`}>
                    {seifa.text}
                  </span>
                )}
              </div>
            </>
          ) : (
            <div>
              <h2 className="font-black text-lg text-bauhaus-black">No data available</h2>
              <p className="text-xs text-bauhaus-muted mt-1">This region has no funding records yet.</p>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-bauhaus-black hover:text-white transition-colors border-2 border-bauhaus-black"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
            <path strokeLinecap="square" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {loading && (
        <div className="p-4 space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-bauhaus-canvas animate-pulse" />)}
        </div>
      )}

      {data && !loading && (
        <div className="p-4 space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="border-2 border-bauhaus-black p-3 text-center">
              <div className="text-lg font-black text-bauhaus-blue">{formatDollars(data.total_funding)}</div>
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">Total Funding</div>
            </div>
            <div className="border-2 border-bauhaus-black p-3 text-center">
              <div className="text-lg font-black text-bauhaus-black">{data.entity_count}</div>
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">Entities</div>
            </div>
            <div className="border-2 border-bauhaus-black p-3 text-center">
              <div className="text-lg font-black" style={{ color: data.local_pct >= 50 ? '#059669' : '#D02020' }}>
                {data.local_pct}%
              </div>
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-wider">Local Control</div>
            </div>
          </div>

          {/* Local vs External bar */}
          <div>
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Local vs External Control</div>
            <div className="h-4 flex border-2 border-bauhaus-black overflow-hidden">
              <div
                className="h-full bg-green-500 transition-all"
                style={{ width: `${data.local_pct}%` }}
                title={`${data.local_pct}% community-controlled`}
              />
              <div
                className="h-full bg-red-400"
                style={{ width: `${100 - data.local_pct}%` }}
                title={`${100 - data.local_pct}% external`}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] font-bold text-green-600">Local ({data.community_controlled_count})</span>
              <span className="text-[9px] font-bold text-red-500">External ({data.entity_count - data.community_controlled_count})</span>
            </div>
          </div>

          {/* SEIFA bar */}
          {data.seifa_decile !== null && (
            <div>
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">
                SEIFA Disadvantage Index
              </div>
              <div className="h-3 bg-bauhaus-canvas border-2 border-bauhaus-black relative">
                <div
                  className="absolute top-0 left-0 h-full transition-all"
                  style={{
                    width: `${data.seifa_decile * 10}%`,
                    backgroundColor: data.seifa_decile <= 3 ? '#D02020' : data.seifa_decile <= 6 ? '#F0C020' : '#059669',
                  }}
                />
              </div>
              <div className="flex justify-between mt-0.5">
                <span className="text-[9px] font-bold text-bauhaus-muted">Most Disadvantaged</span>
                <span className="text-[9px] font-bold text-bauhaus-muted">Decile {data.seifa_decile}/10</span>
              </div>
            </div>
          )}

          {/* Top Recipients */}
          {data.top_recipients.length > 0 && (
            <div>
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">
                Top Recipients
              </div>
              <div className="space-y-1">
                {data.top_recipients.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => onSelectEntity?.(r.gs_id)}
                    className="w-full text-left flex items-center gap-2 p-2 hover:bg-bauhaus-canvas transition-colors border border-bauhaus-black/10"
                  >
                    <span className="w-7 h-7 flex items-center justify-center bg-bauhaus-blue text-white text-[10px] font-black flex-shrink-0">
                      {entityTypeIcon(r.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-bauhaus-black truncate">{r.name}</div>
                      <div className="text-[10px] text-bauhaus-muted">
                        {r.type.replace(/_/g, ' ')}
                        {r.revenue ? ` · ${formatDollars(r.revenue)} rev` : ''}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Top Funders */}
          {data.top_funders.length > 0 && (
            <div>
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">
                Top Funders
              </div>
              <div className="space-y-1">
                {data.top_funders.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 border border-bauhaus-black/10">
                    <span className="w-7 h-7 flex items-center justify-center bg-bauhaus-red text-white text-[10px] font-black flex-shrink-0">
                      {entityTypeIcon(f.type)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold text-bauhaus-black truncate">{f.name}</div>
                      <div className="text-[10px] text-bauhaus-muted">
                        {formatDollars(f.amount)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
