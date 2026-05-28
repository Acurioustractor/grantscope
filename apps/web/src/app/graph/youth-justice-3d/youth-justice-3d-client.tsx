'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

type Lane = 'reactive' | 'prevention' | 'community-led' | 'unclassified';

interface ApiNode {
  id: string;
  label: string;
  kind: 'program' | 'recipient';
  lane: Lane;
  funding: number;
  recipients?: number;
  programs?: number;
  grant_count?: number;
  first_year: number | null;
  last_year: number | null;
  degree: number;
  gs_id?: string | null;
  entity_id?: string | null;
  entity_type?: string | null;
  state?: string | null;
  community_controlled?: boolean;
  rawName?: string;
}

interface ApiEdge {
  source: string;
  target: string;
  type: string;
  amount: number;
  grants: number;
  first_year: number | null;
  last_year: number | null;
  lane: Lane;
}

interface ApiResponse {
  nodes: ApiNode[];
  edges: ApiEdge[];
  meta: {
    total_nodes: number;
    total_edges: number;
    program_count: number;
    recipient_count: number;
    year_range: { min: number; max: number };
    lane_totals: Record<Lane, { funding: number; nodes: number }>;
  };
}

type GraphNode = ApiNode & { x?: number; y?: number; z?: number; fz?: number; vx?: number; vy?: number; vz?: number };
type GraphLink = ApiEdge & { source: string | GraphNode; target: string | GraphNode };

const LANE_COLOR: Record<Lane | 'program', string> = {
  reactive: '#D02020',
  prevention: '#1040C0',
  'community-led': '#F0C020',
  unclassified: '#6B7280',
  program: '#F0F0F0',
};

const STATES = ['', 'NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

const Z_SPAN = 800; // total Z range across the year axis

function fmtMoney(v: number): string {
  if (!v) return '$0';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
  return `$${v.toFixed(0)}`;
}

export function YouthJustice3DClient() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [state, setState] = useState<string>('');
  const [minAmount, setMinAmount] = useState<number>(50000);
  const [showProgramLabels, setShowProgramLabels] = useState(true);
  const [colorByLane, setColorByLane] = useState(true);
  const fgRef = useRef<{
    cameraPosition: (pos: { x: number; y: number; z: number }, lookAt?: { x: number; y: number; z: number }, ms?: number) => void;
    d3Force: (name: string) => { strength?: (s: number) => unknown; distance?: (d: number) => unknown } | undefined;
  } | null>(null);

  // Fetch data
  useEffect(() => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (state) params.set('state', state);
    params.set('min_amount', String(minAmount));
    params.set('limit', '2500');

    fetch(`/api/data/graph/youth-justice-3d?${params.toString()}`)
      .then(r => r.json())
      .then((d: ApiResponse | { error: string }) => {
        if ('error' in d) throw new Error(d.error);
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message || 'Failed to load');
        setLoading(false);
      });
  }, [state, minAmount]);

  // Compute Z position per node from first_year
  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] };

    const yMin = data.meta.year_range.min;
    const yMax = data.meta.year_range.max;
    const ySpan = Math.max(1, yMax - yMin);

    const zForYear = (year: number | null): number => {
      if (year == null) return 0;
      const t = (year - yMin) / ySpan; // 0..1
      return (t - 0.5) * Z_SPAN; // centered on origin
    };

    const nodes: GraphNode[] = data.nodes.map(n => {
      const z = zForYear(n.first_year);
      return { ...n, z, fz: z };
    });

    const links: GraphLink[] = data.edges.map(e => ({ ...e }));

    return { nodes, links };
  }, [data]);

  // Re-tune forces once mounted
  useEffect(() => {
    if (!fgRef.current || !data) return;
    const charge = fgRef.current.d3Force('charge');
    const link = fgRef.current.d3Force('link');
    if (charge && 'strength' in charge && typeof charge.strength === 'function') {
      charge.strength(-180);
    }
    if (link && 'distance' in link && typeof link.distance === 'function') {
      link.distance(60);
    }
  }, [data]);

  const flyThroughYears = () => {
    if (!fgRef.current || !data) return;
    // Dolly the camera from "old" end of Z to "new" end over 8s
    const span = Z_SPAN / 2 + 200;
    fgRef.current.cameraPosition({ x: 0, y: 0, z: -span }, { x: 0, y: 0, z: 0 }, 0);
    setTimeout(() => {
      fgRef.current?.cameraPosition({ x: 0, y: 0, z: span * 1.4 }, { x: 0, y: 0, z: 0 }, 8000);
    }, 100);
  };

  const resetView = () => {
    if (!fgRef.current) return;
    fgRef.current.cameraPosition({ x: 250, y: 250, z: 600 }, { x: 0, y: 0, z: 0 }, 1500);
  };

  const handleNodeClick = (node: object) => {
    const n = node as GraphNode;
    if (n.kind === 'recipient' && n.gs_id) {
      window.open(`/entity/${n.gs_id}`, '_blank');
    }
  };

  const nodeColor = (node: object): string => {
    const n = node as GraphNode;
    if (n.kind === 'program') return LANE_COLOR.program;
    if (!colorByLane) return '#888';
    return LANE_COLOR[n.lane] || LANE_COLOR.unclassified;
  };

  const linkColor = (link: object): string => {
    const l = link as GraphLink;
    if (!colorByLane) return 'rgba(180,180,180,0.25)';
    return LANE_COLOR[l.lane] || LANE_COLOR.unclassified;
  };

  const nodeLabel = (node: object) => {
    const n = node as GraphNode;
    return `${n.label} — ${fmtMoney(n.funding)}`;
  };

  const nodeVal = (node: object) => {
    const n = node as GraphNode;
    return Math.max(1, Math.log10(Math.max(1, n.funding)) - 3) * (n.kind === 'program' ? 4 : 2);
  };

  const linkWidth = (link: object) => {
    const l = link as GraphLink;
    return Math.max(0.5, Math.sqrt(Math.max(1, l.amount)) / 800);
  };

  const linkParticles = (link: object) => {
    const l = link as GraphLink;
    return l.amount > 1_000_000 ? 2 : 0;
  };

  const linkParticleSpeed = (link: object) => {
    const l = link as GraphLink;
    return Math.min(0.01, l.amount / 1e10);
  };

  const handleNodeHover = (node: object | null) => {
    setHovered(node ? (node as GraphNode) : null);
  };

  return (
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      {/* Title bar */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-bauhaus-black border-b-4 border-bauhaus-yellow px-6 py-4 flex items-center justify-between pointer-events-none">
        <div className="pointer-events-auto">
          <Link href="/graph" className="text-xs font-mono text-bauhaus-yellow hover:underline">← /graph</Link>
          <h1 className="font-black uppercase tracking-widest text-2xl mt-1">Youth Justice · 3D Network</h1>
          <p className="text-xs font-mono text-zinc-400 mt-1">
            {data
              ? `${data.meta.recipient_count} recipients · ${data.meta.program_count} programs · ${data.meta.year_range.min}–${data.meta.year_range.max} · Z = year of first funding`
              : loading ? 'Loading…' : '—'}
          </p>
        </div>
        <div className="flex gap-2 pointer-events-auto">
          <button
            onClick={flyThroughYears}
            className="border-2 border-bauhaus-yellow bg-bauhaus-yellow text-bauhaus-black font-black uppercase tracking-widest text-xs px-4 py-2 hover:bg-white"
          >
            Fly through years
          </button>
          <button
            onClick={resetView}
            className="border-2 border-white text-white font-black uppercase tracking-widest text-xs px-4 py-2 hover:bg-white hover:text-black"
          >
            Reset view
          </button>
        </div>
      </div>

      {/* Left HUD: filters */}
      <div className="absolute left-4 top-32 z-10 bg-bauhaus-black/90 border-4 border-white p-4 w-64 space-y-4">
        <div>
          <label className="block text-xs font-mono uppercase tracking-widest mb-1 text-bauhaus-yellow">State</label>
          <select
            value={state}
            onChange={e => setState(e.target.value)}
            className="w-full bg-black border-2 border-white text-white font-mono text-sm px-2 py-1"
          >
            {STATES.map(s => (
              <option key={s} value={s}>{s || 'All states'}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-mono uppercase tracking-widest mb-1 text-bauhaus-yellow">
            Min grant: {fmtMoney(minAmount)}
          </label>
          <input
            type="range"
            min={1000}
            max={1000000}
            step={1000}
            value={minAmount}
            onChange={e => setMinAmount(parseInt(e.target.value, 10))}
            className="w-full accent-bauhaus-yellow"
          />
        </div>

        <div className="flex items-center gap-2">
          <input
            id="lane-color"
            type="checkbox"
            checked={colorByLane}
            onChange={e => setColorByLane(e.target.checked)}
            className="accent-bauhaus-yellow"
          />
          <label htmlFor="lane-color" className="text-xs font-mono uppercase tracking-widest">Color by lane</label>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="prog-labels"
            type="checkbox"
            checked={showProgramLabels}
            onChange={e => setShowProgramLabels(e.target.checked)}
            className="accent-bauhaus-yellow"
          />
          <label htmlFor="prog-labels" className="text-xs font-mono uppercase tracking-widest">Program labels</label>
        </div>
      </div>

      {/* Right HUD: legend + lane totals */}
      <div className="absolute right-4 top-32 z-10 bg-bauhaus-black/90 border-4 border-white p-4 w-72">
        <div className="text-xs font-mono uppercase tracking-widest mb-2 text-bauhaus-yellow">Funding by lane</div>
        {data && (['community-led', 'prevention', 'reactive', 'unclassified'] as Lane[]).map(lane => {
          const t = data.meta.lane_totals[lane];
          return (
            <div key={lane} className="flex items-center justify-between gap-2 py-1 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-3 h-3 border border-white"
                  style={{ backgroundColor: LANE_COLOR[lane] }}
                />
                <span className="uppercase tracking-widest">{lane}</span>
              </div>
              <div className="text-right">
                <div className="font-bold">{fmtMoney(t.funding)}</div>
                <div className="text-zinc-500">{t.nodes} orgs</div>
              </div>
            </div>
          );
        })}
        <div className="mt-3 pt-3 border-t border-zinc-700 text-[10px] font-mono text-zinc-500 leading-relaxed">
          Z-axis = year of first funding (deep = old, near = new).<br />
          Drag to rotate · scroll to zoom · click recipient to open entity page.
        </div>
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-bauhaus-black border-4 border-bauhaus-yellow px-4 py-3 max-w-md pointer-events-none"
        >
          <div className="text-[10px] font-mono uppercase tracking-widest text-bauhaus-yellow">
            {hovered.kind} · {hovered.lane}
          </div>
          <div className="font-black text-lg leading-tight mt-1">{hovered.label}</div>
          <div className="text-xs font-mono mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
            <div className="text-zinc-400">Funding</div>
            <div className="text-right font-bold">{fmtMoney(hovered.funding)}</div>
            {hovered.kind === 'recipient' && (
              <>
                <div className="text-zinc-400">Programs</div>
                <div className="text-right">{hovered.programs}</div>
                <div className="text-zinc-400">Grants</div>
                <div className="text-right">{hovered.grant_count}</div>
                {hovered.state && (
                  <>
                    <div className="text-zinc-400">State</div>
                    <div className="text-right">{hovered.state}</div>
                  </>
                )}
                {hovered.community_controlled && (
                  <>
                    <div className="text-zinc-400">Type</div>
                    <div className="text-right text-bauhaus-yellow">Community-controlled</div>
                  </>
                )}
              </>
            )}
            {hovered.kind === 'program' && (
              <>
                <div className="text-zinc-400">Recipients</div>
                <div className="text-right">{hovered.recipients}</div>
              </>
            )}
            <div className="text-zinc-400">Years</div>
            <div className="text-right">
              {hovered.first_year ?? '?'}–{hovered.last_year ?? '?'}
            </div>
          </div>
          {hovered.kind === 'recipient' && hovered.gs_id && (
            <div className="text-[10px] font-mono mt-2 text-zinc-400">Click node → entity page</div>
          )}
        </div>
      )}

      {/* Loading / error */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-bauhaus-black border-4 border-bauhaus-yellow px-6 py-4 font-mono text-sm">Loading 3D graph…</div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="bg-bauhaus-red border-4 border-white text-white px-6 py-4 font-mono text-sm">Error: {error}</div>
        </div>
      )}

      {/* The 3D graph */}
      {data && (
        <ForceGraph3D
          ref={fgRef as never}
          graphData={graphData as never}
          backgroundColor="#000000"
          showNavInfo={false}
          nodeId="id"
          nodeLabel={nodeLabel}
          nodeVal={nodeVal}
          nodeColor={nodeColor}
          nodeOpacity={0.92}
          nodeResolution={12}
          linkSource="source"
          linkTarget="target"
          linkColor={linkColor}
          linkOpacity={0.45}
          linkWidth={linkWidth}
          linkDirectionalParticles={linkParticles}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleSpeed={linkParticleSpeed}
          linkDirectionalParticleColor={linkColor}
          enableNodeDrag={false}
          onNodeHover={handleNodeHover}
          onNodeClick={handleNodeClick}
        />
      )}

      {/* Program labels overlay (kept simple — show top-funding program names as floating chips) */}
      {showProgramLabels && data && (
        <div className="absolute bottom-4 right-4 z-10 bg-bauhaus-black/90 border-4 border-white p-3 max-w-xs">
          <div className="text-[10px] font-mono uppercase tracking-widest text-bauhaus-yellow mb-2">Top programs</div>
          <div className="space-y-1">
            {data.nodes
              .filter(n => n.kind === 'program')
              .sort((a, b) => b.funding - a.funding)
              .slice(0, 6)
              .map(p => (
                <div key={p.id} className="text-[11px] font-mono leading-tight flex justify-between gap-2">
                  <span className="truncate">{p.label}</span>
                  <span className="text-bauhaus-yellow font-bold whitespace-nowrap">{fmtMoney(p.funding)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
