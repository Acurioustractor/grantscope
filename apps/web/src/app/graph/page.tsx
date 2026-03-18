'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface GraphNode {
  id: string;
  label: string;
  type: string;
  state: string | null;
  sector: string | null;
  remoteness: string | null;
  community_controlled: boolean;
  degree: number;
  funding?: number;
  alma_type?: string | null;
  alma_evidence?: string | null;
  x?: number;
  y?: number;
}

interface GraphEdge {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
  amount: number | null;
  dataset: string;
  year: number | null;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  meta: { total_nodes: number; total_edges: number };
}

const TYPE_COLORS: Record<string, string> = {
  charity: '#4ade80',
  foundation: '#60a5fa',
  company: '#a78bfa',
  government_body: '#fbbf24',
  indigenous_corp: '#f87171',
  political_party: '#fb923c',
  social_enterprise: '#2dd4bf',
  trust: '#c084fc',
  person: '#f472b6',
  university: '#38bdf8',
  program: '#f59e0b',
  unknown: '#6b7280',
};

const ALMA_COLORS: Record<string, string> = {
  'Wraparound Support': '#22d3ee',
  'Diversion': '#a78bfa',
  'Community-Led': '#f87171',
  'Justice Reinvestment': '#fb923c',
  'Prevention': '#4ade80',
  'Cultural Connection': '#f472b6',
  'Therapeutic': '#38bdf8',
  'Education/Employment': '#fbbf24',
  'Early Intervention': '#2dd4bf',
  'Family Strengthening': '#c084fc',
};

type Preset = {
  label: string;
  mode: 'hubs' | 'justice';
  type?: string;
  hubs?: number;
  topic?: string;
  desc: string;
};

const PRESETS: Preset[] = [
  { label: 'Youth Justice', mode: 'justice', topic: 'youth-justice', desc: 'Programs funding youth justice services' },
  { label: 'Child Protection', mode: 'justice', topic: 'child-protection', desc: 'Child protection funding flows' },
  { label: 'Indigenous Justice', mode: 'justice', topic: 'indigenous', desc: 'Indigenous justice programs & orgs' },
  { label: 'Diversion Programs', mode: 'justice', topic: 'diversion', desc: 'Diversion & prevention funding' },
  { label: 'Foundation Networks', mode: 'hubs', type: 'foundation', hubs: 30, desc: 'Top foundations and who they fund' },
  { label: 'Full Network', mode: 'hubs', type: '', hubs: 0, desc: 'Top relationships by value' },
];

export default function GraphPage() {
  const [data, setData] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState('Loading graph...');
  const [error, setError] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [activePreset, setActivePreset] = useState(0);
  const [showPanel, setShowPanel] = useState(true);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fgRef = useRef<any>(null);

  useEffect(() => {
    const update = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const fetchGraph = useCallback(async (preset: Preset) => {
    setLoading(true);
    setError(null);
    const start = Date.now();
    const timer = setInterval(() => {
      setLoadingMsg(`Loading ${preset.label}... ${Math.round((Date.now() - start) / 1000)}s`);
    }, 1000);
    setLoadingMsg(`Loading ${preset.label}...`);

    try {
      const params = new URLSearchParams();
      if (preset.mode === 'justice') {
        params.set('mode', 'justice');
        if (preset.topic) params.set('topic', preset.topic);
      } else if (preset.type) {
        params.set('entity_type', preset.type);
        params.set('mode', 'hubs');
        params.set('hubs', String(preset.hubs || 30));
      }
      params.set('limit', '10000');

      const res = await fetch(`/api/data/graph?${params}`);
      clearInterval(timer);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchGraph(PRESETS[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Configure forces + zoom after data
  const isJustice = PRESETS[activePreset]?.mode === 'justice';
  useEffect(() => {
    if (data && fgRef.current) {
      const fg = fgRef.current;
      if (isJustice) {
        // Justice mode: stronger repulsion to separate overlapping program clusters
        fg.d3Force('charge')?.strength(-120).distanceMax(600);
        fg.d3Force('link')?.distance(30).strength(0.5);
        fg.d3Force('center')?.strength(0.03);
      } else {
        fg.d3Force('charge')?.strength(-50).distanceMax(400);
        fg.d3Force('link')?.distance(20).strength(1);
        fg.d3Force('center')?.strength(0.05);
      }
      fg.d3ReheatSimulation();
      setTimeout(() => fg.zoomToFit(400, 50), 2000);
    }
  }, [data, isJustice]);

  const graphData = useMemo(() => {
    if (!data) return { nodes: [], links: [] };
    return {
      nodes: data.nodes.map(n => ({ ...n })),
      links: data.edges.map(e => ({
        source: typeof e.source === 'string' ? e.source : e.source.id,
        target: typeof e.target === 'string' ? e.target : e.target.id,
        type: e.type,
        amount: e.amount,
      })),
    };
  }, [data]);

  // Custom node rendering with glow
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    // ALMA intervention type takes priority for coloring, then entity type
    const color = (node.alma_type && ALMA_COLORS[node.alma_type]) || TYPE_COLORS[node.type] || '#6b7280';
    const deg = node.degree || 0;
    const isProgram = node.type === 'program';
    const size = isProgram
      ? Math.max(6, Math.min(16, Math.sqrt(deg + 1) * 2))
      : Math.max(1.5, Math.min(12, Math.sqrt(deg + 1) * 1.5));
    const x = node.x || 0;
    const y = node.y || 0;

    // Glow for high-degree nodes and programs
    if (deg > 3 || isProgram) {
      const glowSize = size * (isProgram ? 4 : 3);
      const gradient = ctx.createRadialGradient(x, y, size * 0.3, x, y, glowSize);
      gradient.addColorStop(0, color + '55');
      gradient.addColorStop(0.5, color + '18');
      gradient.addColorStop(1, color + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // ALMA ring indicator — shows evidence-backed programs
    if (node.alma_type) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, size + 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Core dot — programs get diamond shape
    if (isProgram) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y - size);
      ctx.lineTo(x + size, y);
      ctx.lineTo(x, y + size);
      ctx.lineTo(x - size, y);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }

    // Hot center for high-degree
    if (deg > 10 || isProgram) {
      ctx.fillStyle = '#ffffffbb';
      ctx.beginPath();
      ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Labels for hubs and programs
    const showLabel = isProgram ? globalScale > 0.15 : (deg > 15 && globalScale > 0.3);
    if (showLabel) {
      const fontSize = Math.max(10, 12 / globalScale);
      ctx.font = `700 ${fontSize}px -apple-system, "SF Pro Text", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#000000bb';
      ctx.fillText(node.label.substring(0, 32), x + 0.5, y + size + 2.5);
      ctx.fillStyle = isProgram ? '#fbbf24dd' : '#ffffffdd';
      ctx.fillText(node.label.substring(0, 32), x, y + size + 2);
    }
  }, []);

  return (
    <div className="fixed inset-0 bg-[#0a0a0f] text-white overflow-hidden">
      {/* Graph canvas */}
      <div className="absolute inset-0">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0a0f]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-[#4ade80]/30 border-t-[#4ade80] rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/60 text-sm font-mono">{loadingMsg}</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0a0a0f]">
            <div className="text-red-400 text-center">
              <p className="text-lg font-bold mb-2">Error</p>
              <p className="text-sm">{error}</p>
              <button onClick={() => fetchGraph(PRESETS[activePreset])} className="mt-4 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded hover:bg-red-500/30 text-sm">
                Retry
              </button>
            </div>
          </div>
        )}
        {!loading && data && dimensions.width > 0 && (
          <ForceGraph2D
            ref={fgRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#0a0a0f"
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              const size = Math.max(5, Math.sqrt(node.degree + 1) * 3);
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(node.x || 0, node.y || 0, size, 0, Math.PI * 2);
              ctx.fill();
            }}
            linkColor={() => isJustice ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}
            linkWidth={isJustice ? 0.5 : 0.3}
            d3AlphaDecay={0.015}
            d3VelocityDecay={0.25}
            warmupTicks={300}
            cooldownTime={12000}
            onNodeHover={(node: any) => setHoveredNode(node as GraphNode | null)} // eslint-disable-line @typescript-eslint/no-explicit-any
            onNodeClick={(node: any) => setSelectedNode(node as GraphNode)} // eslint-disable-line @typescript-eslint/no-explicit-any
            onBackgroundClick={() => setSelectedNode(null)}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />
        )}
      </div>

      {/* Title */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div className="flex items-center justify-between p-4">
          <div className="pointer-events-auto">
            <h1 className="text-lg font-black tracking-widest uppercase text-white/90">CivicGraph</h1>
            {data && (
              <p className="text-xs font-mono text-white/40 mt-0.5">
                {data.meta.total_nodes.toLocaleString()} entities &middot; {data.meta.total_edges.toLocaleString()} relationships
              </p>
            )}
          </div>
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="pointer-events-auto px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs font-mono text-white/60 hover:bg-white/10 transition-colors"
          >
            {showPanel ? 'Hide' : 'Controls'}
          </button>
        </div>
      </div>

      {/* Preset buttons */}
      {showPanel && (
        <div className="absolute top-16 right-4 z-10 w-56 bg-[#12121a]/90 backdrop-blur-xl border border-white/10 rounded-lg p-3 space-y-1.5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">Network View</p>
          {PRESETS.map((preset, i) => (
            <button
              key={preset.label}
              onClick={() => { setActivePreset(i); fetchGraph(preset); }}
              disabled={loading}
              className={`w-full text-left px-3 py-2 rounded text-xs transition-all ${
                activePreset === i
                  ? 'bg-[#4ade80]/15 border border-[#4ade80]/30 text-[#4ade80]'
                  : 'bg-white/5 border border-white/5 text-white/60 hover:bg-white/10 hover:text-white/80'
              } disabled:opacity-40`}
            >
              <div className="font-semibold">{preset.label}</div>
              <div className="text-[10px] text-white/30 mt-0.5">{preset.desc}</div>
            </button>
          ))}
        </div>
      )}

      {/* Legend — context-aware */}
      <div className="absolute bottom-4 left-4 z-10 bg-[#12121a]/80 backdrop-blur border border-white/10 rounded-lg p-3 max-w-xs">
        {PRESETS[activePreset]?.mode === 'justice' ? (
          <>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">Justice Graph</p>
            <div className="space-y-2">
              <div>
                <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Node Shapes</p>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-3 h-3 rotate-45" style={{ backgroundColor: '#f59e0b' }} />
                  <span className="text-[10px] text-white/50">Program (funder)</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#4ade80' }} />
                  <span className="text-[10px] text-white/50">Charity</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#f87171' }} />
                  <span className="text-[10px] text-white/50">Indigenous Corp</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full border border-white/30" style={{ backgroundColor: '#6b7280' }} />
                  <span className="text-[10px] text-white/50">Unlinked Org</span>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase text-white/30 mb-1">ALMA Evidence</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {Object.entries(ALMA_COLORS).slice(0, 6).map(([type, color]) => (
                    <div key={type} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full border-2 shrink-0" style={{ borderColor: color }} />
                      <span className="text-[9px] text-white/40 truncate">{type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">Entity Types</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {Object.entries(TYPE_COLORS).slice(0, 8).map(([type, color]) => (
                <div key={type} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-white/50 capitalize">{type.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Hover tooltip */}
      {hoveredNode && !selectedNode && (
        <div className="absolute bottom-4 right-4 z-10 bg-[#12121a]/90 backdrop-blur-xl border border-white/10 rounded-lg p-3 max-w-xs">
          <p className="text-sm font-bold text-white/90 truncate">{hoveredNode.label}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
              style={{ borderColor: TYPE_COLORS[hoveredNode.type] || '#6b7280', color: TYPE_COLORS[hoveredNode.type] || '#6b7280' }}>
              {hoveredNode.type?.replace(/_/g, ' ')}
            </span>
            {hoveredNode.state && <span className="text-[10px] text-white/40">{hoveredNode.state}</span>}
            <span className="text-[10px] text-white/40">{hoveredNode.degree} connections</span>
          </div>
        </div>
      )}

      {/* Selected node */}
      {selectedNode && (
        <div className="absolute bottom-4 right-4 z-10 bg-[#12121a]/90 backdrop-blur-xl border border-[#4ade80]/30 rounded-lg p-4 max-w-sm">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-bold text-white/90">{selectedNode.label}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full border"
                  style={{ borderColor: TYPE_COLORS[selectedNode.type] || '#6b7280', color: TYPE_COLORS[selectedNode.type] || '#6b7280' }}>
                  {selectedNode.type?.replace(/_/g, ' ')}
                </span>
                {selectedNode.state && <span className="text-[10px] text-white/40">{selectedNode.state}</span>}
              </div>
            </div>
            <button onClick={() => setSelectedNode(null)} className="text-white/30 hover:text-white/60 text-sm ml-2">&times;</button>
          </div>
          <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
            <p className="text-[10px] text-white/40 font-mono">
              {selectedNode.degree} connections
              {selectedNode.sector && ` · ${selectedNode.sector}`}
              {selectedNode.community_controlled && ' · Community Controlled'}
              {selectedNode.remoteness && ` · ${selectedNode.remoteness}`}
            </p>
            {selectedNode.funding != null && selectedNode.funding > 0 && (
              <p className="text-[10px] text-[#fbbf24] font-mono">
                ${(selectedNode.funding / 1e6).toFixed(1)}M funding
              </p>
            )}
            {selectedNode.alma_type && (
              <p className="text-[10px] font-mono" style={{ color: ALMA_COLORS[selectedNode.alma_type] || '#6b7280' }}>
                ALMA: {selectedNode.alma_type}
                {selectedNode.alma_evidence && ` · ${selectedNode.alma_evidence}`}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
