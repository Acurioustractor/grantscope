'use client';

import { useState } from 'react';

interface Stats {
  foundations: number;
  grants: number;
  profiled: number;
  programs: number;
  communityOrgs: number;
  moneyFlows: number;
}

interface TooltipData {
  title: string;
  lines: string[];
  x: number;
  y: number;
}

const sources = [
  { id: 'acnc', label: 'ACNC Register', sub: '9.9k foundations + 360k financials', live: true, tip: ['Australian Charities & NFP Commission', 'Bulk CSV import of all registered foundations', '360k annual financial statements'] },
  { id: 'gc', label: 'GrantConnect', sub: 'Federal grants (RSS)', live: true, tip: ['Federal government grants via RSS feed', 'Deep scraping with Firecrawl for full details'] },
  { id: 'arc', label: 'ARC Grants', sub: '5.6k research grants', live: true, tip: ['Australian Research Council grants', 'JSON API integration'] },
  { id: 'qld', label: 'QLD + Brisbane', sub: 'CKAN + council scraper', live: true, tip: ['Queensland state grants via CKAN API', 'Brisbane City Council grants (5.5k)', 'QLD Arts data (2.3k)'] },
  { id: 'nsw', label: 'NSW Grants', sub: '1.6k grants (HTTP scrape)', live: true, tip: ['New South Wales state grants', 'Direct HTTP scraping'] },
  { id: 'states', label: 'VIC / WA / SA / TAS / ACT / NT', sub: 'All 6 state scrapers live', live: true, tip: ['All 8 states and territories covered', 'Dedicated Cheerio scraper per portal', '500+ grants across smaller states'] },
  { id: 'dga', label: 'data.gov.au', sub: 'CKAN Search', live: true, tip: ['National open data portal', 'CKAN search API for grant datasets'] },
  { id: 'ai', label: 'AI Web Search', sub: 'LLM-powered discovery', live: true, ai: true, tip: ['AI-powered grant discovery', 'Finds grants not in any registry'] },
  { id: 'asx', label: 'ASX200 Reports', sub: 'Corporate giving', live: false, tip: ['Sustainability report scraping', 'Company-to-foundation mapping', 'Not yet built'] },
];

const engines = [
  { id: 'discovery', label: 'Discovery Engine', sub: '16 source plugins', live: true, tip: ['Multi-source grant discovery', 'Plugin architecture for each source', 'Deduplication + confidence scoring'] },
  { id: 'profiler', label: 'Foundation Profiler', sub: 'AI enrichment (9 LLMs)', live: true, ai: true, tip: ['Scrapes websites via Jina + Firecrawl', 'Extracts: philosophy, focus areas, tips, grants', '9 LLM providers with round-robin fallback', 'MiniMax, Gemini, Groq, DeepSeek + 5 more', '3,700+ foundations profiled so far'] },
  { id: 'community', label: 'Community Profiler', sub: 'Admin burden analysis', live: true, tip: ['Profiles grassroots organizations', 'Estimates admin vs program spend'] },
  { id: 'reports', label: 'Report Builders', sub: '4 analysis engines', live: true, tip: ['Money Flow Sankey diagrams', 'Youth Justice cost comparison', 'Power Analysis (HHI + Gini)', 'Admin burden by org size'] },
];

const agents = [
  { id: 'gm', label: 'Grant Monitor', sub: 'Daily discovery', live: true, tip: ['Runs daily', 'Checks all 6 sources for new grants', 'Logs every run to agent_runs table'] },
  { id: 'fw', label: 'Foundation Watcher', sub: 'Weekly website checks', live: true, tip: ['Weekly check of foundation websites', 'Detects program/deadline changes', 'Re-profiles if significant changes found'] },
  { id: 'sw', label: 'Spend Watcher', sub: 'Quarterly budgets', live: true, tip: ['Tracks government budget allocations', 'Feeds into money_flows table', 'Quarterly cycle'] },
];

function fmt(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`.replace('.0k', 'k');
  return n.toLocaleString();
}

export function ArchitectureDiagram({ stats }: { stats: Stats }) {
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  function showTip(title: string, lines: string[], e: React.MouseEvent) {
    setTooltip({ title, lines, x: e.clientX, y: e.clientY });
  }
  function moveTip(e: React.MouseEvent) {
    if (tooltip) setTooltip({ ...tooltip, x: e.clientX, y: e.clientY });
  }
  function hideTip() { setTooltip(null); }

  const profiledPct = stats.foundations > 0 ? Math.round((stats.profiled / stats.foundations) * 100) : 0;
  const needProfiling = stats.foundations - stats.profiled;

  return (
    <div className="relative">
      {/* CSS for animations */}
      <style>{`
        .flow-line { stroke-dasharray: 8 4; animation: flow 1.5s linear infinite; }
        .flow-rev { stroke-dasharray: 8 4; animation: flow-rev 1.5s linear infinite; }
        @keyframes flow { to { stroke-dashoffset: -24; } }
        @keyframes flow-rev { to { stroke-dashoffset: 24; } }
        .node-g { cursor: pointer; transition: filter 0.15s; }
        .node-g:hover { filter: brightness(1.15) drop-shadow(0 0 6px rgba(255,255,255,0.1)); }
        .planned-node { opacity: 0.4; }
      `}</style>

      {/* Mobile: stacked layout. Desktop: SVG diagram */}

      {/* === MOBILE LAYOUT (< md) === */}
      <div className="md:hidden space-y-6">
        {/* Live stats banner */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-white border border-navy-200 rounded-lg p-3 text-center">
            <div className="text-xl font-extrabold text-money tabular-nums">{fmt(stats.foundations)}</div>
            <div className="text-[10px] text-navy-400">Foundations</div>
          </div>
          <div className="bg-white border border-navy-200 rounded-lg p-3 text-center">
            <div className="text-xl font-extrabold text-link tabular-nums">{fmt(stats.grants)}</div>
            <div className="text-[10px] text-navy-400">Grants</div>
          </div>
          <div className="bg-white border border-navy-200 rounded-lg p-3 text-center">
            <div className="text-xl font-extrabold text-purple tabular-nums">{fmt(stats.profiled)}</div>
            <div className="text-[10px] text-navy-400">AI Profiled</div>
          </div>
        </div>

        {/* Flow steps */}
        <div className="space-y-4">
          <div className="bg-white border border-navy-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-money-light text-money flex items-center justify-center text-xs font-bold">1</span>
              <h3 className="font-bold text-navy-900 text-sm">6 Data Sources</h3>
              <span className="text-[10px] px-1.5 py-0.5 bg-money-light text-money rounded-full font-semibold ml-auto">LIVE</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {sources.filter(s => s.live).map(s => (
                <div key={s.id} className="text-xs bg-navy-50 rounded px-2 py-1.5">
                  <span className="font-medium text-navy-700">{s.label}</span>
                  <span className="text-navy-400 block">{s.sub}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center"><svg width="20" height="24"><path d="M10,0 L10,16 L5,12 M10,16 L15,12" stroke="#059669" fill="none" strokeWidth="2"/></svg></div>

          <div className="bg-white border border-navy-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-purple-light text-purple flex items-center justify-center text-xs font-bold">2</span>
              <h3 className="font-bold text-navy-900 text-sm">Grant Engine</h3>
            </div>
            <div className="space-y-1.5">
              {engines.map(e => (
                <div key={e.id} className="text-xs bg-navy-50 rounded px-2 py-1.5 flex justify-between">
                  <span className="font-medium text-navy-700">{e.label}</span>
                  <span className="text-navy-400">{e.sub}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center"><svg width="20" height="24"><path d="M10,0 L10,16 L5,12 M10,16 L15,12" stroke="#2563eb" fill="none" strokeWidth="2"/></svg></div>

          <div className="bg-white border-2 border-link rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-6 h-6 rounded-full bg-link-light text-link flex items-center justify-center text-xs font-bold">3</span>
              <h3 className="font-bold text-navy-900 text-sm">Supabase Database</h3>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              <div><span className="text-money font-bold tabular-nums">{fmt(stats.foundations)}</span> <span className="text-navy-400">foundations</span></div>
              <div><span className="text-money font-bold tabular-nums">{fmt(stats.grants)}</span> <span className="text-navy-400">grants</span></div>
              <div><span className="text-money font-bold tabular-nums">{fmt(stats.programs)}</span> <span className="text-navy-400">programs</span></div>
              <div><span className="text-money font-bold tabular-nums">{fmt(stats.moneyFlows)}</span> <span className="text-navy-400">money flows</span></div>
            </div>
          </div>

          <div className="flex justify-center"><svg width="20" height="24"><path d="M10,0 L10,16 L5,12 M10,16 L15,12" stroke="#2563eb" fill="none" strokeWidth="2"/></svg></div>

          <div className="bg-white border border-navy-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-6 h-6 rounded-full bg-navy-100 text-navy-600 flex items-center justify-center text-xs font-bold">4</span>
              <h3 className="font-bold text-navy-900 text-sm">Web App + Agents</h3>
            </div>
            <div className="text-xs text-navy-500 space-y-1">
              <div>14 pages &middot; 7 API routes &middot; 4 Living Reports</div>
              <div>3 autonomous agents (daily, weekly, quarterly)</div>
              <div className="text-money font-medium">grantscope.vercel.app</div>
            </div>
          </div>
        </div>
      </div>

      {/* === DESKTOP SVG DIAGRAM (md+) === */}
      <div className="hidden md:block">
        <svg viewBox="0 0 1200 700" className="w-full" style={{ maxWidth: 1200 }}>
          <defs>
            <marker id="ag" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto"><path d="M0,0 L10,3 L0,6" fill="#059669"/></marker>
            <marker id="ab" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto"><path d="M0,0 L10,3 L0,6" fill="#2563eb"/></marker>
            <marker id="ap" viewBox="0 0 10 6" refX="10" refY="3" markerWidth="8" markerHeight="6" orient="auto"><path d="M0,0 L10,3 L0,6" fill="#7c3aed"/></marker>
          </defs>

          {/* Section labels */}
          <text x="80" y="24" className="fill-navy-400 text-[11px] font-semibold uppercase tracking-widest">Data Sources</text>
          <text x="380" y="24" className="fill-navy-400 text-[11px] font-semibold uppercase tracking-widest">Grant Engine</text>
          <text x="380" y="390" className="fill-navy-400 text-[11px] font-semibold uppercase tracking-widest">Database</text>
          <text x="770" y="24" className="fill-navy-400 text-[11px] font-semibold uppercase tracking-widest">Web App</text>
          <text x="770" y="390" className="fill-navy-400 text-[11px] font-semibold uppercase tracking-widest">Agents</text>

          {/* === SOURCES === */}
          {sources.map((s, i) => {
            const y = 40 + i * 62;
            return (
              <g key={s.id} className={`node-g ${!s.live ? 'planned-node' : ''}`}
                onMouseEnter={(e) => showTip(s.label, s.tip, e)}
                onMouseMove={moveTip} onMouseLeave={hideTip}>
                <rect x="20" y={y} width="170" height="48" rx="8"
                  fill="#fff" stroke={!s.live ? '#94a3b8' : s.ai ? '#7c3aed' : '#059669'} strokeWidth="1.5"/>
                <text x="105" y={y + 20} textAnchor="middle" className="fill-navy-900 text-[12px] font-semibold">{s.label}</text>
                <text x="105" y={y + 35} textAnchor="middle" className="fill-navy-400 text-[10px]">{s.sub}</text>
                <circle cx="182" cy={y + 6} r="4" fill={s.live ? '#059669' : '#94a3b8'}/>
              </g>
            );
          })}

          {/* Flow: Sources → Discovery Engine */}
          {sources.filter(s => s.live).map((s, i) => {
            const sy = 64 + sources.indexOf(s) * 62;
            return <line key={s.id} x1="190" y1={sy} x2="270" y2={120} className="flow-line" stroke={s.ai ? '#7c3aed' : '#059669'} strokeWidth="1.2" markerEnd={s.ai ? 'url(#ap)' : 'url(#ag)'}/>;
          })}

          {/* === ENGINES === */}
          {engines.map((eng, i) => {
            const y = 42 + i * 80;
            return (
              <g key={eng.id} className="node-g"
                onMouseEnter={(e) => showTip(eng.label, eng.tip, e)}
                onMouseMove={moveTip} onMouseLeave={hideTip}>
                <rect x="272" y={y} width="200" height="56" rx="10"
                  fill="#fff" stroke={eng.ai ? '#7c3aed' : '#059669'} strokeWidth="2"/>
                <text x="372" y={y + 23} textAnchor="middle" className="fill-navy-900 text-[13px] font-bold">{eng.label}</text>
                <text x="372" y={y + 40} textAnchor="middle" className={eng.ai ? 'fill-purple text-[10px]' : 'fill-navy-400 text-[10px]'}>{eng.sub}</text>
              </g>
            );
          })}

          {/* === DATABASE === */}
          <g className="node-g"
            onMouseEnter={(e) => showTip('Supabase (PostgreSQL)', [
              `${fmt(stats.foundations)} foundations`,
              `${fmt(stats.grants)} grant opportunities`,
              `${fmt(stats.programs)} foundation programs`,
              `${fmt(stats.communityOrgs)} community orgs`,
              `${fmt(stats.moneyFlows)} money flow records`,
              'Plus: agent_runs, government_programs',
            ], e)}
            onMouseMove={moveTip} onMouseLeave={hideTip}>
            <rect x="280" y="410" width="300" height="120" rx="12" fill="#fff" stroke="#2563eb" strokeWidth="2.5"/>
            <text x="430" y="436" textAnchor="middle" className="fill-link text-[15px] font-extrabold">Supabase</text>
            <text x="430" y="452" textAnchor="middle" className="fill-navy-400 text-[10px]">PostgreSQL — live data</text>

            <text x="300" y="474" className="fill-navy-500 text-[10px]">foundations</text>
            <text x="380" y="474" className="fill-money text-[10px] font-bold">{fmt(stats.foundations)}</text>
            <text x="300" y="489" className="fill-navy-500 text-[10px]">grants</text>
            <text x="380" y="489" className="fill-money text-[10px] font-bold">{fmt(stats.grants)}</text>
            <text x="300" y="504" className="fill-navy-500 text-[10px]">programs</text>
            <text x="380" y="504" className="fill-money text-[10px] font-bold">{fmt(stats.programs)}</text>
            <text x="300" y="519" className="fill-navy-500 text-[10px]">community_orgs, money_flows</text>

            <text x="440" y="474" className="fill-navy-400 text-[10px]">profiled</text>
            <text x="440" y="489" className="fill-purple text-[10px] font-bold">{fmt(stats.profiled)} ({profiledPct}%)</text>
            <text x="440" y="504" className="fill-navy-400 text-[10px]">agent_runs</text>
          </g>

          {/* Engine → DB lines */}
          <line x1="372" y1="98" x2="380" y2="408" className="flow-line" stroke="#2563eb" strokeWidth="1.3" markerEnd="url(#ab)"/>
          <line x1="372" y1="178" x2="400" y2="408" className="flow-line" stroke="#2563eb" strokeWidth="1.3" markerEnd="url(#ab)"/>
          <line x1="372" y1="258" x2="420" y2="408" className="flow-line" stroke="#2563eb" strokeWidth="1.3" markerEnd="url(#ab)"/>
          <line x1="372" y1="338" x2="440" y2="408" className="flow-line" stroke="#2563eb" strokeWidth="1.3" markerEnd="url(#ab)"/>

          {/* === WEB APP === */}
          <g className="node-g"
            onMouseEnter={(e) => showTip('Next.js Web App', [
              '14 pages with Tailwind CSS',
              '7 API endpoints',
              'Server-side rendering',
              'Deployed to Vercel',
            ], e)}
            onMouseMove={moveTip} onMouseLeave={hideTip}>
            <rect x="700" y="42" width="230" height="56" rx="10" fill="#fff" stroke="#059669" strokeWidth="2"/>
            <text x="815" y="65" textAnchor="middle" className="fill-navy-900 text-[13px] font-bold">14 Pages + 7 APIs</text>
            <text x="815" y="82" textAnchor="middle" className="fill-navy-400 text-[10px]">Next.js + Tailwind CSS</text>
          </g>

          <g className="node-g"
            onMouseEnter={(e) => showTip('Living Reports', [
              'Youth Justice — $1.3M/child detention',
              'Follow the Dollar — Sankey flow diagrams',
              'Access Gap — Admin burden analysis',
              'Power Dynamics — HHI + Gini inequality',
              'Interactive Recharts visualizations',
            ], e)}
            onMouseMove={moveTip} onMouseLeave={hideTip}>
            <rect x="700" y="116" width="230" height="56" rx="10" fill="#fff" stroke="#059669" strokeWidth="1.5"/>
            <text x="815" y="140" textAnchor="middle" className="fill-navy-900 text-[13px] font-bold">4 Living Reports</text>
            <text x="815" y="157" textAnchor="middle" className="fill-danger text-[9px]">Youth Justice · Money Flow · Power · Access</text>
          </g>

          {/* Vercel */}
          <g className="node-g"
            onMouseEnter={(e) => showTip('Vercel', ['Auto-deploys from GitHub main', 'Server-side rendering', 'Edge network'], e)}
            onMouseMove={moveTip} onMouseLeave={hideTip}>
            <rect x="960" y="56" width="130" height="40" rx="8" fill="#fff" stroke="#94a3b8" strokeWidth="1.5"/>
            <text x="1025" y="78" textAnchor="middle" className="fill-navy-900 text-[12px] font-semibold">Vercel</text>
            <text x="1025" y="91" textAnchor="middle" className="fill-navy-400 text-[9px]">Auto-deploy</text>
          </g>
          <line x1="930" y1="70" x2="958" y2="72" className="flow-line" stroke="#94a3b8" strokeWidth="1" markerEnd="url(#ag)"/>

          {/* Planned: Public API */}
          <g className="node-g planned-node"
            onMouseEnter={(e) => showTip('Public API', ['REST API for third-party access', 'OpenAPI spec, rate limiting', 'Not yet built'], e)}
            onMouseMove={moveTip} onMouseLeave={hideTip}>
            <rect x="700" y="190" width="230" height="45" rx="8" fill="#fff" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3"/>
            <text x="815" y="210" textAnchor="middle" className="fill-navy-400 text-[12px] font-semibold">Public API</text>
            <text x="815" y="226" textAnchor="middle" className="fill-navy-400 text-[10px]">Planned</text>
          </g>

          {/* Planned: Eligibility Matcher */}
          <g className="node-g planned-node"
            onMouseEnter={(e) => showTip('Eligibility Matcher', ['Match orgs to eligible grants', 'Based on focus, size, location', 'Not yet built'], e)}
            onMouseMove={moveTip} onMouseLeave={hideTip}>
            <rect x="500" y="282" width="170" height="45" rx="8" fill="#fff" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3"/>
            <text x="585" y="302" textAnchor="middle" className="fill-navy-400 text-[12px] font-semibold">Eligibility Matcher</text>
            <text x="585" y="318" textAnchor="middle" className="fill-navy-400 text-[10px]">Planned</text>
          </g>

          {/* DB → Web App lines */}
          <line x1="560" y1="450" x2="698" y2="70" className="flow-line" stroke="#2563eb" strokeWidth="1.3" markerEnd="url(#ab)"/>
          <line x1="560" y1="460" x2="698" y2="144" className="flow-line" stroke="#2563eb" strokeWidth="1.3" markerEnd="url(#ab)"/>

          {/* === AGENTS === */}
          {agents.map((a, i) => {
            const y = 410 + i * 55;
            return (
              <g key={a.id} className="node-g"
                onMouseEnter={(e) => showTip(a.label, a.tip, e)}
                onMouseMove={moveTip} onMouseLeave={hideTip}>
                <rect x="700" y={y} width="230" height="42" rx="8" fill="#fff" stroke="#059669" strokeWidth="1.5"/>
                <text x="815" y={y + 18} textAnchor="middle" className="fill-navy-900 text-[12px] font-semibold">{a.label}</text>
                <text x="815" y={y + 33} textAnchor="middle" className="fill-navy-400 text-[10px]">{a.sub}</text>
                <circle cx="922" cy={y + 6} r="4" fill="#059669"/>
              </g>
            );
          })}

          {/* Agent → DB lines */}
          {agents.map((a, i) => {
            const y = 431 + i * 55;
            return <line key={a.id} x1="698" y1={y} x2="562" y2={460 + i * 8} className="flow-rev" stroke="#059669" strokeWidth="1.2" markerEnd="url(#ag)"/>;
          })}

          {/* Coverage summary */}
          <g className="node-g"
            onMouseEnter={(e) => showTip('What\'s Left', [
              `${fmt(needProfiling)} foundations need profiling`,
              '5 state portals need scrapers',
              'ASX200 corporate data not started',
              'Public API not started',
            ], e)}
            onMouseMove={moveTip} onMouseLeave={hideTip}>
            <rect x="700" y="580" width="400" height="75" rx="10" fill="#fff" stroke="#e2e8f0" strokeWidth="1"/>
            <text x="720" y="604" className="fill-money text-[11px] font-bold">{fmt(stats.profiled)}</text>
            <text x="760" y="604" className="fill-navy-400 text-[10px]">profiled ({profiledPct}%)</text>
            <text x="720" y="621" className="fill-warning text-[11px] font-bold">{fmt(needProfiling)}</text>
            <text x="770" y="621" className="fill-navy-400 text-[10px]">need profiling</text>
            <text x="720" y="638" className="fill-navy-400 text-[11px] font-bold">5 states</text>
            <text x="775" y="638" className="fill-navy-400 text-[10px]">need scrapers</text>

            <text x="910" y="604" className="fill-navy-400 text-[11px] font-bold">ASX200</text>
            <text x="960" y="604" className="fill-navy-400 text-[10px]">not started</text>
            <text x="910" y="621" className="fill-navy-400 text-[11px] font-bold">Public API</text>
            <text x="980" y="621" className="fill-navy-400 text-[10px]">not started</text>
            <text x="910" y="638" className="fill-navy-400 text-[11px] font-bold">Matching</text>
            <text x="970" y="638" className="fill-navy-400 text-[10px]">not started</text>
          </g>

          <text x="550" y="670" textAnchor="middle" className="fill-navy-300 text-[10px]">Animated lines show data flow. Dashed borders = planned features.</text>
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-navy-800 border border-navy-600 rounded-lg px-4 py-3 text-sm max-w-xs pointer-events-none shadow-xl"
          style={{ left: Math.min(tooltip.x + 12, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 320), top: tooltip.y + 12 }}
        >
          <div className="font-semibold text-white mb-1">{tooltip.title}</div>
          {tooltip.lines.map((line, i) => (
            <div key={i} className="text-navy-300 text-xs leading-relaxed">{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
