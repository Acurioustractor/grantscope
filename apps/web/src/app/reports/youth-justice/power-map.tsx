'use client';

import { useState } from 'react';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// PICC Power Map — Governance Network Visualization
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type Node = {
  id: string;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  type: 'person' | 'org' | 'funder' | 'policy';
  funding?: string;
  color: string;
};

type Edge = {
  from: string;
  to: string;
  label: string;
  style?: 'solid' | 'dashed';
};

const NODES: Node[] = [
  // Center: Rachel + PICC
  { id: 'rachel', label: 'Rachel Atkinson', sublabel: 'CEO, Yorta Yorta', x: 450, y: 280, type: 'person', color: '#dc2626' },
  { id: 'picc', label: 'PICC', sublabel: '$20.1M revenue, 197 staff', x: 450, y: 180, type: 'org', funding: '$38.7M tracked', color: '#1a1a1a' },
  { id: 'station', label: 'Station Precinct', sublabel: '30-year lease, Townsville', x: 450, y: 80, type: 'org', color: '#1a1a1a' },

  // Left: Policy bodies
  { id: 'snaicc', label: 'SNAICC', sublabel: 'National Voice for our Children', x: 140, y: 160, type: 'policy', funding: '$9M+ federal', color: '#2563eb' },
  { id: 'qfcfb', label: 'QLD First Children Board', sublabel: 'Co-Chair', x: 100, y: 300, type: 'policy', color: '#2563eb' },
  { id: 'fmqld', label: 'Family Matters QLD', sublabel: 'Co-Chair', x: 160, y: 420, type: 'policy', color: '#2563eb' },
  { id: 'qaihc', label: 'QLD Aboriginal Health Council', sublabel: 'Deputy Chair', x: 100, y: 500, type: 'policy', color: '#2563eb' },

  // Right: Funders
  { id: 'niaa', label: 'NIAA', sublabel: '$4.8M Safety & Wellbeing', x: 760, y: 120, type: 'funder', funding: '$4.8M', color: '#059669' },
  { id: 'dss', label: 'DSS', sublabel: 'Child & Family Programs', x: 800, y: 240, type: 'funder', color: '#059669' },
  { id: 'qld_dcssds', label: 'QLD DCSSDS', sublabel: 'Child Protection, DFV, YJ', x: 780, y: 360, type: 'funder', funding: '$8.5M+', color: '#059669' },
  { id: 'real', label: 'REAL Innovation Fund', sublabel: 'EOI $1.2M submitted', x: 760, y: 460, type: 'funder', color: '#d97706' },

  // Top: Partners
  { id: 'goods', label: 'A Curious Tractor', sublabel: 'Manufacturing partner', x: 280, y: 30, type: 'org', color: '#6b7280' },
  { id: 'tfff', label: 'Tim Fairfax Foundation', sublabel: '$7.7M/yr, QLD/NT focus', x: 640, y: 30, type: 'funder', color: '#d97706' },

  // Bottom: Commissioner
  { id: 'commissioner', label: 'Commissioner Lewis', sublabel: 'ATSI Children\'s Commissioner', x: 300, y: 500, type: 'policy', color: '#7c3aed' },
];

const EDGES: Edge[] = [
  // Rachel's governance connections
  { from: 'rachel', to: 'picc', label: 'CEO' },
  { from: 'rachel', to: 'snaicc', label: 'Board Director' },
  { from: 'rachel', to: 'qfcfb', label: 'Co-Chair' },
  { from: 'rachel', to: 'fmqld', label: 'Co-Chair' },
  { from: 'rachel', to: 'qaihc', label: 'Deputy Chair' },

  // PICC connections
  { from: 'picc', to: 'station', label: '30-yr lease' },
  { from: 'station', to: 'goods', label: 'Consortium' },

  // Funding flows
  { from: 'niaa', to: 'picc', label: '$4.8M' },
  { from: 'niaa', to: 'snaicc', label: '$2.7M', style: 'dashed' },
  { from: 'dss', to: 'snaicc', label: '$1.5M', style: 'dashed' },
  { from: 'dss', to: 'picc', label: 'Next round?', style: 'dashed' },
  { from: 'qld_dcssds', to: 'picc', label: '$8.5M+' },
  { from: 'real', to: 'station', label: '$1.2M EOI', style: 'dashed' },

  // Philanthropic
  { from: 'tfff', to: 'station', label: 'Potential', style: 'dashed' },

  // Policy influence
  { from: 'commissioner', to: 'qfcfb', label: 'QFCC', style: 'dashed' },
  { from: 'commissioner', to: 'dss', label: 'Submission', style: 'dashed' },
];

function getNodeById(id: string): Node | undefined {
  return NODES.find(n => n.id === id);
}

export function PowerMap() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const connectedNodes = hoveredNode
    ? new Set(
        EDGES
          .filter(e => e.from === hoveredNode || e.to === hoveredNode)
          .flatMap(e => [e.from, e.to])
      )
    : null;

  return (
    <section className="mb-10">
      <h2 className="text-xl font-black text-bauhaus-black uppercase tracking-wider mb-1">
        PICC Power Map
      </h2>
      <p className="text-sm text-bauhaus-muted mb-4">
        Rachel Atkinson sits at the intersection of national policy, state governance, and community-controlled service delivery.
        Hover over any node to trace connections.
      </p>

      <div className="border-4 border-bauhaus-black rounded-sm overflow-hidden bg-white">
        <svg viewBox="0 0 900 560" className="w-full h-auto" style={{ minHeight: 400 }}>
          {/* Legend */}
          <g transform="translate(10, 530)">
            <circle cx={8} cy={0} r={5} fill="#dc2626" />
            <text x={18} y={4} className="text-[9px] fill-gray-500" fontFamily="system-ui">Person</text>
            <circle cx={78} cy={0} r={5} fill="#1a1a1a" />
            <text x={88} y={4} className="text-[9px] fill-gray-500" fontFamily="system-ui">Organisation</text>
            <circle cx={178} cy={0} r={5} fill="#2563eb" />
            <text x={188} y={4} className="text-[9px] fill-gray-500" fontFamily="system-ui">Policy Body</text>
            <circle cx={258} cy={0} r={5} fill="#059669" />
            <text x={268} y={4} className="text-[9px] fill-gray-500" fontFamily="system-ui">Funder</text>
            <circle cx={318} cy={0} r={5} fill="#d97706" />
            <text x={328} y={4} className="text-[9px] fill-gray-500" fontFamily="system-ui">Potential</text>
            <line x1={400} y1={0} x2={430} y2={0} stroke="#999" strokeWidth={1.5} />
            <text x={435} y={4} className="text-[9px] fill-gray-500" fontFamily="system-ui">Active</text>
            <line x1={470} y1={0} x2={500} y2={0} stroke="#999" strokeWidth={1.5} strokeDasharray="4,3" />
            <text x={505} y={4} className="text-[9px] fill-gray-500" fontFamily="system-ui">Potential/Indirect</text>
          </g>

          {/* Edges */}
          {EDGES.map((edge, i) => {
            const fromNode = getNodeById(edge.from);
            const toNode = getNodeById(edge.to);
            if (!fromNode || !toNode) return null;

            const isHighlighted = connectedNodes && (connectedNodes.has(edge.from) && connectedNodes.has(edge.to));
            const isDimmed = connectedNodes && !isHighlighted;
            const opacity = isDimmed ? 0.1 : 1;

            // Midpoint for label
            const mx = (fromNode.x + toNode.x) / 2;
            const my = (fromNode.y + toNode.y) / 2;

            return (
              <g key={`edge-${i}`} opacity={opacity}>
                <line
                  x1={fromNode.x}
                  y1={fromNode.y}
                  x2={toNode.x}
                  y2={toNode.y}
                  stroke={isHighlighted ? '#dc2626' : '#d1d5db'}
                  strokeWidth={isHighlighted ? 2 : 1.5}
                  strokeDasharray={edge.style === 'dashed' ? '6,4' : undefined}
                />
                {(isHighlighted || !connectedNodes) && (
                  <g>
                    <rect
                      x={mx - edge.label.length * 3 - 2}
                      y={my - 7}
                      width={edge.label.length * 6 + 4}
                      height={14}
                      fill="white"
                      rx={2}
                    />
                    <text
                      x={mx}
                      y={my + 3}
                      textAnchor="middle"
                      className="text-[8px] fill-gray-400"
                      fontFamily="system-ui"
                      fontWeight={isHighlighted ? 700 : 400}
                    >
                      {edge.label}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {NODES.map((node) => {
            const isHighlighted = connectedNodes ? connectedNodes.has(node.id) : true;
            const isHovered = hoveredNode === node.id;
            const opacity = connectedNodes && !isHighlighted ? 0.15 : 1;

            const isWide = node.type === 'funder' || node.type === 'policy';
            const rx = isWide ? 70 : 55;
            const ry = node.sublabel ? 28 : 20;

            return (
              <g
                key={node.id}
                opacity={opacity}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                className="cursor-pointer"
              >
                {/* Shadow */}
                {isHovered && (
                  <ellipse cx={node.x + 2} cy={node.y + 2} rx={rx + 2} ry={ry + 2} fill="rgba(0,0,0,0.1)" />
                )}

                {/* Background */}
                <ellipse
                  cx={node.x}
                  cy={node.y}
                  rx={rx}
                  ry={ry}
                  fill={node.type === 'person' ? node.color : 'white'}
                  stroke={node.color}
                  strokeWidth={isHovered ? 3 : 2}
                />

                {/* Label */}
                <text
                  x={node.x}
                  y={node.sublabel ? node.y - 4 : node.y + 4}
                  textAnchor="middle"
                  fontFamily="system-ui"
                  fontWeight={800}
                  fontSize={node.id === 'rachel' || node.id === 'picc' ? 11 : 9}
                  fill={node.type === 'person' ? 'white' : node.color}
                >
                  {node.label}
                </text>

                {/* Sublabel */}
                {node.sublabel && (
                  <text
                    x={node.x}
                    y={node.y + 10}
                    textAnchor="middle"
                    fontFamily="system-ui"
                    fontSize={7}
                    fill={node.type === 'person' ? 'rgba(255,255,255,0.8)' : '#9ca3af'}
                  >
                    {node.sublabel}
                  </text>
                )}

                {/* Funding badge */}
                {node.funding && isHighlighted && (
                  <g>
                    <rect
                      x={node.x + rx - 15}
                      y={node.y - ry - 5}
                      width={node.funding.length * 5.5 + 8}
                      height={14}
                      fill={node.color}
                      rx={3}
                    />
                    <text
                      x={node.x + rx - 11}
                      y={node.y - ry + 6}
                      fontFamily="system-ui"
                      fontSize={8}
                      fontWeight={700}
                      fill="white"
                    >
                      {node.funding}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail cards below the map */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <div className="border-2 border-bauhaus-black rounded-sm p-4">
          <h4 className="font-black text-sm uppercase tracking-wider mb-2">Policy Influence</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li><span className="font-bold">SNAICC Board</span> — $9M+ federal contracts, national peak body</li>
            <li><span className="font-bold">QLD First Children Board</span> — shapes Safe and Supported implementation</li>
            <li><span className="font-bold">Family Matters QLD</span> — national campaign to end over-representation</li>
          </ul>
        </div>
        <div className="border-2 border-bauhaus-red rounded-sm p-4">
          <h4 className="font-black text-sm uppercase tracking-wider mb-2 text-bauhaus-red">Funding Flows</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li><span className="font-bold">NIAA 1.3</span> — $4.8M anchor contract (Safety & Wellbeing)</li>
            <li><span className="font-bold">QLD DCSSDS</span> — $8.5M+ (child protection, DFV, youth justice)</li>
            <li><span className="font-bold">REAL Fund</span> — $1.2M EOI submitted (Station Precinct)</li>
          </ul>
        </div>
        <div className="border-2 border-gray-300 rounded-sm p-4">
          <h4 className="font-black text-sm uppercase tracking-wider mb-2">Opportunities</h4>
          <ul className="text-xs text-gray-600 space-y-1">
            <li><span className="font-bold">DSS next round</span> — $9.8M went to 10 ACCOs (July 2025)</li>
            <li><span className="font-bold">Tim Fairfax</span> — $7.7M/yr, QLD/NT, First Nations focus</li>
            <li><span className="font-bold">NIAA 1.1</span> — $221M Jobs, Land & Economy pool</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
