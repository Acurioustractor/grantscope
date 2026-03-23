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
  system_count?: number;
  power_score?: number;
  systems?: string[];
  procurement_dollars?: number;
  justice_dollars?: number;
  donation_dollars?: number;
  total_dollar_flow?: number;
  distinct_govt_buyers?: number;
  distinct_parties_funded?: number;
  ndis_participants?: number;
  ndis_entities?: number;
  ndis_utilisation?: number | null;
  severity?: string;
  seifa_decile?: number | null;
  desert_score?: number | null;
  board_count?: number;
  interlock_score?: number;
  role_types?: string[];
  max_system_count?: number;
  total_power_score?: number;
  foundation_score?: number | null;
  score_tier?: string;
  grantee_count?: number;
  foundation_count?: number;
  is_regranter?: boolean;
  meeting_count?: number;
  minister_count?: number;
  org_count?: number;
  purposes?: string[];
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

// ── Story types ──

type StoryHighlight = 'programs' | 'top-recipients' | 'acco' | 'alma-evidence' | 'foundations' | 'multi-system';

interface Story {
  id: string;
  title: string;
  description: string;
  mode: 'hubs' | 'justice' | 'power' | 'interlocks' | 'ndis' | 'foundations' | 'alma' | 'diary';
  topic?: string;
  minSystems?: number;
  narrative: string;
  highlights: StoryHighlight[];
}

const STORIES: Story[] = [
  {
    id: 'follow-the-money',
    title: 'Follow the Money',
    description: 'See how funding flows from government programs to community organizations',
    mode: 'justice',
    topic: 'youth-justice',
    narrative: '', // computed dynamically
    highlights: ['programs', 'top-recipients'],
  },
  {
    id: 'indigenous-funding',
    title: 'Indigenous Justice Funding',
    description: 'Community-controlled organizations receive 3.2% of procurement dollars despite being over-represented in the system',
    mode: 'justice',
    topic: 'indigenous',
    narrative: '',
    highlights: ['acco'],
  },
  {
    id: 'evidence-gaps',
    title: 'Where\'s the Evidence?',
    description: 'Programs with ALMA evidence rings vs those operating without evaluation',
    mode: 'justice',
    topic: 'youth-justice',
    narrative: '',
    highlights: ['alma-evidence'],
  },
  {
    id: 'alice-springs',
    title: 'Alice Springs Youth Services',
    description: '67% of NT youth spend is reactive — only 9% goes to prevention',
    mode: 'alma',
    narrative: '',
    highlights: ['alma-evidence'],
  },
  {
    id: 'foundation-networks',
    title: 'Foundation Networks',
    description: 'How philanthropic foundations connect through grantees and regranting chains',
    mode: 'foundations',
    narrative: '',
    highlights: ['foundations'],
  },
  {
    id: 'power-concentration',
    title: 'Power Concentration',
    description: 'Entities that appear across multiple systems — contracts, donations, lobbying, funding',
    mode: 'power',
    minSystems: 3,
    narrative: '',
    highlights: ['multi-system'],
  },
  {
    id: 'ministerial-access',
    title: 'Ministerial Access',
    description: 'Which organizations get face time with ministers? Mapped from diary disclosures.',
    mode: 'diary',
    narrative: '',
    highlights: ['top-recipients'],
  },
];

// ── Dynamic insight computation from graph data ──
interface Insight {
  narrative: string;
  stats: { label: string; value: string }[];
  callout?: string;
}

function computeInsights(storyId: string, nodes: GraphNode[], edges: GraphEdge[]): Insight {
  const programs = nodes.filter(n => n.type === 'program');
  const orgs = nodes.filter(n => n.type !== 'program');
  const accos = nodes.filter(n => n.community_controlled || n.type === 'indigenous_corp');
  const withAlma = nodes.filter(n => n.alma_type);
  const totalFunding = orgs.reduce((sum, n) => sum + (n.funding || 0), 0);
  const topByDegree = [...orgs].sort((a, b) => b.degree - a.degree);
  const fmt = (n: number) => n >= 1e9 ? `$${(n/1e9).toFixed(1)}B` : n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${n}`;

  switch (storyId) {
    case 'follow-the-money': {
      const top3 = topByDegree.slice(0, 3);
      const top3Funding = top3.reduce((s, n) => s + (n.funding || 0), 0);
      const top3Share = totalFunding > 0 ? ((top3Funding / totalFunding) * 100).toFixed(0) : '?';
      return {
        narrative: `${programs.length} government programs fund ${orgs.length} organizations. The top 3 recipients capture ${top3Share}% of total funding — a pattern of concentration that limits the reach of community-level services.`,
        stats: [
          { label: 'Programs', value: String(programs.length) },
          { label: 'Recipients', value: String(orgs.length) },
          { label: 'Total funding', value: fmt(totalFunding) },
          { label: 'Top 3 share', value: `${top3Share}%` },
        ],
        callout: top3.length > 0 ? `Largest recipient: ${top3[0].label} (${top3[0].degree} program links)` : undefined,
      };
    }
    case 'indigenous-funding': {
      const accoFunding = accos.reduce((s, n) => s + (n.funding || 0), 0);
      const accoShare = totalFunding > 0 ? ((accoFunding / totalFunding) * 100).toFixed(1) : '?';
      return {
        narrative: `${accos.length} Aboriginal Community-Controlled Organizations (ACCOs) appear in this network, receiving ${accoShare}% of total funding. Despite being central to service delivery and cultural authority, they receive a disproportionately small share.`,
        stats: [
          { label: 'ACCOs', value: String(accos.length) },
          { label: 'ACCO funding', value: fmt(accoFunding) },
          { label: 'ACCO share', value: `${accoShare}%` },
          { label: 'Total orgs', value: String(orgs.length) },
        ],
        callout: accos.length > 0 ? `Over-monitored, under-funded: ACCOs appear in 2.15 avg systems but receive 3.2% of procurement dollars nationally.` : undefined,
      };
    }
    case 'evidence-gaps': {
      const withoutAlma = orgs.filter(n => !n.alma_type);
      const evidenceRate = orgs.length > 0 ? ((withAlma.length / orgs.length) * 100).toFixed(0) : '?';
      const evidenceTypes = new Set(withAlma.map(n => n.alma_type).filter(Boolean));
      return {
        narrative: `Only ${evidenceRate}% of organizations have ALMA (Australian Living Map of Alternatives) evidence records. ${withoutAlma.length} organizations are operating without formal evaluation — a critical gap in understanding what works.`,
        stats: [
          { label: 'With evidence', value: String(withAlma.length) },
          { label: 'Without', value: String(withoutAlma.length) },
          { label: 'Evidence rate', value: `${evidenceRate}%` },
          { label: 'Evidence types', value: String(evidenceTypes.size) },
        ],
        callout: 'Colored rings = evaluated programs. No ring = no formal evidence on record.',
      };
    }
    case 'alice-springs': {
      const interventionTypes = new Set(nodes.filter(n => n.alma_type).map(n => n.alma_type));
      const linked = nodes.filter(n => n.type !== 'intervention_type' && n.degree > 0);
      return {
        narrative: `Alice Springs youth services span ${interventionTypes.size} intervention types with ${nodes.length} nodes in the network. NT Government spends 67% of youth funding on reactive services ($14.77M) and only 9% on prevention ($2.02M) — an inversion of what evidence shows works.`,
        stats: [
          { label: 'Interventions', value: String(linked.length) },
          { label: 'Types', value: String(interventionTypes.size) },
          { label: 'Reactive spend', value: '67%' },
          { label: 'Prevention', value: '9%' },
        ],
        callout: '$1 invested in early intervention saves $2-7 in future crisis costs (SVA/UK NCB).',
      };
    }
    case 'foundation-networks': {
      const foundations = nodes.filter(n => n.type === 'foundation');
      const regranters = nodes.filter(n => n.is_regranter);
      const grantees = nodes.filter(n => n.type !== 'foundation' && !n.is_regranter);
      const highScore = foundations.filter(n => n.score_tier === 'high');
      return {
        narrative: `${foundations.length} foundations distribute funding to ${grantees.length} grantees, with ${regranters.length} regranting intermediaries. ${highScore.length} foundations score 'high' on transparency, need alignment, and evidence backing.`,
        stats: [
          { label: 'Foundations', value: String(foundations.length) },
          { label: 'Grantees', value: String(grantees.length) },
          { label: 'Regranters', value: String(regranters.length) },
          { label: 'High score', value: String(highScore.length) },
        ],
        callout: regranters.length > 0 ? 'Hexagon nodes are regranters — they redistribute funding from larger foundations to smaller grantees.' : undefined,
      };
    }
    case 'power-concentration': {
      const multiSystem = nodes.filter(n => (n.system_count ?? 0) >= 3);
      const elite = nodes.filter(n => (n.system_count ?? 0) >= 5);
      const avgPower = multiSystem.length > 0
        ? (multiSystem.reduce((s, n) => s + (n.power_score || 0), 0) / multiSystem.length).toFixed(1)
        : '0';
      return {
        narrative: `${multiSystem.length} entities span 3+ systems (contracts, donations, lobbying, funding). ${elite.length} are in 5+ systems — the power elite. These cross-system entities wield outsized influence over government policy and spending.`,
        stats: [
          { label: '3+ systems', value: String(multiSystem.length) },
          { label: '5+ systems', value: String(elite.length) },
          { label: 'Avg power score', value: avgPower },
          { label: 'Connections', value: String(edges.length) },
        ],
        callout: elite.length > 0 ? `Top entity: ${elite.sort((a,b) => (b.power_score||0) - (a.power_score||0))[0]?.label}` : undefined,
      };
    }
    case 'ministerial-access': {
      const ministers = nodes.filter(n => n.type === 'minister');
      const meetingOrgs = nodes.filter(n => n.type !== 'minister');
      const topByMeetings = [...meetingOrgs].sort((a, b) => (b.degree || 0) - (a.degree || 0));
      const multiMinister = meetingOrgs.filter(n => (n.minister_count || 0) > 1);
      return {
        narrative: `${ministers.length} ministers disclosed ${edges.length} meeting relationships with ${meetingOrgs.length} organizations. ${multiMinister.length} organizations met with multiple ministers — indicating cross-portfolio influence.`,
        stats: [
          { label: 'Ministers', value: String(ministers.length) },
          { label: 'Organizations', value: String(meetingOrgs.length) },
          { label: 'Meetings', value: String(edges.length) },
          { label: 'Multi-minister', value: String(multiMinister.length) },
        ],
        callout: topByMeetings.length > 0 ? `Most connected: ${topByMeetings[0].label} (${topByMeetings[0].degree} minister links)` : undefined,
      };
    }
    default:
      return { narrative: '', stats: [] };
  }
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
  minister: '#ef4444',
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

// NDIS thin market severity colors
const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',  // red
  severe: '#f97316',    // orange
  moderate: '#fbbf24',  // amber
  adequate: '#4ade80',  // green
};

// Power mode: color by system count (more systems = hotter)
const SYSTEM_COLORS: Record<number, string> = {
  1: '#6b7280',  // gray
  2: '#60a5fa',  // blue
  3: '#4ade80',  // green
  4: '#fbbf24',  // amber
  5: '#f97316',  // orange
  6: '#ef4444',  // red
  7: '#dc2626',  // dark red
};

type Preset = {
  label: string;
  mode: 'hubs' | 'justice' | 'power' | 'interlocks' | 'ndis' | 'foundations' | 'alma' | 'diary';
  type?: string;
  hubs?: number;
  topic?: string;
  state?: string;
  minSystems?: number;
  minBoards?: number;
  minGiving?: number;
  minister?: string;
  desc: string;
};

const SCORE_TIER_COLORS: Record<string, string> = {
  high: '#22c55e',     // green
  medium: '#f59e0b',   // amber
  low: '#6b7280',      // gray
  unscored: '#374151', // dark gray
};

const PRESETS: Preset[] = [
  { label: 'Power Map', mode: 'power', minSystems: 3, desc: 'Entities spanning 3+ systems — who holds cross-system power' },
  { label: 'Power Elite', mode: 'power', minSystems: 4, desc: 'Entities in 4+ systems — the inner circle' },
  { label: 'NDIS Thin Markets', mode: 'ndis', desc: 'Disability provider networks — where are the thin markets?' },
  { label: 'Board Interlocks', mode: 'interlocks', minBoards: 2, desc: 'People sitting on multiple charity boards' },
  { label: 'Youth Justice', mode: 'justice', topic: 'youth-justice', desc: 'Programs funding youth justice services' },
  { label: 'QLD Youth Justice', mode: 'justice', topic: 'youth-justice', state: 'QLD', desc: 'Queensland youth justice funding flows' },
  { label: 'NSW Youth Justice', mode: 'justice', topic: 'youth-justice', state: 'NSW', desc: 'New South Wales youth justice funding flows' },
  { label: 'VIC Youth Justice', mode: 'justice', topic: 'youth-justice', state: 'VIC', desc: 'Victorian youth justice funding flows' },
  { label: 'WA Youth Justice', mode: 'justice', topic: 'youth-justice', state: 'WA', desc: 'Western Australia youth justice funding flows' },
  { label: 'SA Youth Justice', mode: 'justice', topic: 'youth-justice', state: 'SA', desc: 'South Australia youth justice funding flows' },
  { label: 'NT Youth Justice', mode: 'justice', topic: 'youth-justice', state: 'NT', desc: 'Northern Territory youth justice funding flows' },
  { label: 'TAS Youth Justice', mode: 'justice', topic: 'youth-justice', state: 'TAS', desc: 'Tasmanian youth justice funding flows' },
  { label: 'ACT Youth Justice', mode: 'justice', topic: 'youth-justice', state: 'ACT', desc: 'ACT youth justice funding flows' },
  { label: 'Child Protection', mode: 'justice', topic: 'child-protection', desc: 'Child protection funding flows' },
  { label: 'Indigenous Justice', mode: 'justice', topic: 'indigenous', desc: 'Indigenous justice programs & orgs' },
  { label: 'Diversion Programs', mode: 'justice', topic: 'diversion', desc: 'Diversion & prevention funding' },
  { label: 'Alice Springs Youth', mode: 'alma', state: 'Alice Springs', desc: 'Alice Springs youth service interventions — who delivers what' },
  { label: 'Foundation Giving', mode: 'foundations', desc: 'Foundation → grantee flows with scores and regranting chains' },
  { label: 'Top Foundations', mode: 'foundations', minGiving: 5000000, desc: 'Foundations giving $5M+ and their grantee networks' },
  { label: 'Ministerial Diary', mode: 'diary', desc: 'Who ministers meet — org access mapped from diary disclosures' },
  { label: 'Oonchiumpa Ecosystem', mode: 'alma', topic: 'youth-justice', state: 'Alice Springs', desc: 'Oonchiumpa & Alice Springs youth services — ALMA evidence network' },
  { label: 'Full Network', mode: 'hubs', type: '', hubs: 0, desc: 'Top relationships by value' },
];

// ── Helper: determine which nodes to highlight for a story ──
function getHighlightedNodeIds(nodes: GraphNode[], highlights: StoryHighlight[]): Set<string> {
  const ids = new Set<string>();
  for (const h of highlights) {
    switch (h) {
      case 'programs':
        for (const n of nodes) {
          if (n.type === 'program') ids.add(n.id);
        }
        break;
      case 'top-recipients': {
        // Top 20 non-program nodes by degree
        const sorted = [...nodes].filter(n => n.type !== 'program').sort((a, b) => b.degree - a.degree);
        for (const n of sorted.slice(0, 20)) ids.add(n.id);
        break;
      }
      case 'acco':
        for (const n of nodes) {
          if (n.community_controlled || n.type === 'indigenous_corp') ids.add(n.id);
        }
        break;
      case 'alma-evidence':
        for (const n of nodes) {
          if (n.alma_type) ids.add(n.id);
        }
        break;
      case 'foundations':
        for (const n of nodes) {
          if (n.type === 'foundation') ids.add(n.id);
        }
        break;
      case 'multi-system':
        for (const n of nodes) {
          if ((n.system_count ?? 0) >= 3) ids.add(n.id);
        }
        break;
    }
  }
  return ids;
}

// ── Annotation config per story ──
interface Annotation {
  text: string;
  target: 'programs' | 'top-recipients' | 'acco' | 'alma-evidence' | 'foundations' | 'multi-system';
}

function getAnnotationsForStory(storyId: string): Annotation[] {
  switch (storyId) {
    case 'follow-the-money':
      return [
        { text: 'Diamond nodes are government programs — the sources of funding.', target: 'programs' },
        { text: 'The largest circles receive the most grants. A few organizations dominate funding.', target: 'top-recipients' },
      ];
    case 'indigenous-funding':
      return [
        { text: 'Red-ringed nodes are community-controlled organizations — central to service delivery but underfunded.', target: 'acco' },
      ];
    case 'evidence-gaps':
      return [
        { text: 'Colored rings = ALMA evidence. No ring = no formal evaluation on record.', target: 'alma-evidence' },
      ];
    case 'alice-springs':
      return [
        { text: 'Colored rings show intervention type — most services are reactive (Diversion/Therapeutic) not preventive.', target: 'alma-evidence' },
      ];
    case 'foundation-networks':
      return [
        { text: 'Diamond nodes are foundations, colored by score. Hexagons are regranters that redistribute funding.', target: 'foundations' },
      ];
    case 'power-concentration':
      return [
        { text: 'Hotter colors = more systems. These entities appear in contracts, donations, and funding simultaneously.', target: 'multi-system' },
      ];
    case 'ministerial-access':
      return [
        { text: 'Red pentagons are ministers. Lines show disclosed meetings with organizations.', target: 'programs' },
      ];
    default:
      return [];
  }
}

// ── Compute annotation screen positions from graph nodes ──
function computeAnnotationPositions(
  annotations: Annotation[],
  nodes: GraphNode[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fgInstance: any,
): { text: string; x: number; y: number }[] {
  if (!fgInstance) return [];
  const results: { text: string; x: number; y: number }[] = [];
  for (const ann of annotations) {
    // Find representative nodes for this annotation target
    let candidates: GraphNode[] = [];
    switch (ann.target) {
      case 'programs':
        candidates = nodes.filter(n => n.type === 'program' && n.x != null);
        break;
      case 'top-recipients':
        candidates = nodes.filter(n => n.type !== 'program' && n.x != null).sort((a, b) => b.degree - a.degree).slice(0, 5);
        break;
      case 'acco':
        candidates = nodes.filter(n => (n.community_controlled || n.type === 'indigenous_corp') && n.x != null);
        break;
      case 'alma-evidence':
        candidates = nodes.filter(n => n.alma_type && n.x != null);
        break;
      case 'foundations':
        candidates = nodes.filter(n => n.type === 'foundation' && n.x != null);
        break;
      case 'multi-system':
        candidates = nodes.filter(n => (n.system_count ?? 0) >= 4 && n.x != null);
        break;
    }
    if (candidates.length === 0) continue;

    // Compute centroid of candidate nodes
    let cx = 0, cy = 0;
    for (const c of candidates) {
      cx += (c.x || 0);
      cy += (c.y || 0);
    }
    cx /= candidates.length;
    cy /= candidates.length;

    // Convert graph coordinates to screen coordinates
    try {
      const screen = fgInstance.graph2ScreenCoords(cx, cy);
      if (screen && typeof screen.x === 'number' && typeof screen.y === 'number') {
        results.push({ text: ann.text, x: screen.x, y: screen.y });
      }
    } catch {
      // graph2ScreenCoords may not be available yet
    }
  }
  return results;
}

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

  // Story state
  const [showStories, setShowStories] = useState(false);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [annotationPositions, setAnnotationPositions] = useState<{ text: string; x: number; y: number }[]>([]);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GraphNode[]>([]);
  const [searchHighlightId, setSearchHighlightId] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      if (preset.mode === 'power') {
        params.set('mode', 'power');
        params.set('min_systems', String(preset.minSystems || 3));
      } else if (preset.mode === 'ndis') {
        params.set('mode', 'ndis');
      } else if (preset.mode === 'interlocks') {
        params.set('mode', 'interlocks');
        params.set('min_boards', String(preset.minBoards || 2));
      } else if (preset.mode === 'alma') {
        params.set('mode', 'alma');
        if (preset.state) params.set('state', preset.state);
        if (preset.topic) params.set('topic', preset.topic);
      } else if (preset.mode === 'justice') {
        params.set('mode', 'justice');
        if (preset.topic) params.set('topic', preset.topic);
        if (preset.state) params.set('state', preset.state);
      } else if (preset.mode === 'foundations') {
        params.set('mode', 'foundations');
        if (preset.minGiving) params.set('min_giving', String(preset.minGiving));
      } else if (preset.mode === 'diary') {
        params.set('mode', 'diary');
        if (preset.minister) params.set('minister', preset.minister);
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

  // Computed insights state
  const [insights, setInsights] = useState<Insight | null>(null);

  // Story-to-preset mapping: create a Preset from a Story
  const storyToPreset = useCallback((story: Story): Preset => {
    if (story.mode === 'justice') {
      return { label: story.title, mode: 'justice', topic: story.topic, desc: story.description };
    } else if (story.mode === 'power') {
      return { label: story.title, mode: 'power', minSystems: story.minSystems || 3, desc: story.description };
    } else if (story.mode === 'ndis') {
      return { label: story.title, mode: 'ndis', desc: story.description };
    } else if (story.mode === 'foundations') {
      return { label: story.title, mode: 'foundations', desc: story.description };
    } else if (story.mode === 'alma') {
      return { label: story.title, mode: 'alma', state: 'Alice Springs', desc: story.description };
    } else if (story.mode === 'diary') {
      return { label: story.title, mode: 'diary', desc: story.description };
    } else {
      return { label: story.title, mode: 'hubs', type: 'foundation', hubs: 30, desc: story.description };
    }
  }, []);

  // Activate a story: load appropriate graph data and set highlights
  const activateStory = useCallback((index: number) => {
    const story = STORIES[index];
    if (!story) return;
    setActiveStoryIndex(index);
    setSelectedNode(null);
    setSearchHighlightId(null);

    // Load graph data for this story
    const preset = storyToPreset(story);
    fetchGraph(preset);
  }, [fetchGraph, storyToPreset]);

  // When data changes while a story is active, compute highlights + insights
  useEffect(() => {
    if (activeStoryIndex != null && data) {
      const story = STORIES[activeStoryIndex];
      if (story) {
        const ids = getHighlightedNodeIds(data.nodes, story.highlights);
        setHighlightedNodeIds(ids);
        const computed = computeInsights(story.id, data.nodes, data.edges);
        setInsights(computed);
      }
    } else {
      setInsights(null);
    }
  }, [activeStoryIndex, data]);

  // Update annotation positions periodically when story is active
  useEffect(() => {
    if (activeStoryIndex == null || !data) {
      setAnnotationPositions([]);
      return;
    }
    const story = STORIES[activeStoryIndex];
    if (!story) return;

    const annotations = getAnnotationsForStory(story.id);
    if (annotations.length === 0) {
      setAnnotationPositions([]);
      return;
    }

    // Update after graph settles
    const updatePositions = () => {
      if (fgRef.current && data) {
        const positions = computeAnnotationPositions(annotations, data.nodes, fgRef.current);
        setAnnotationPositions(positions);
      }
    };

    // Initial update after a delay for graph to settle
    const initialTimer = setTimeout(updatePositions, 3000);
    // Keep updating for zoom/pan
    const interval = setInterval(updatePositions, 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [activeStoryIndex, data]);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!searchQuery.trim() || !data) {
      setSearchResults([]);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      const q = searchQuery.toLowerCase();
      const results = data.nodes
        .filter(n => n.label.toLowerCase().includes(q))
        .sort((a, b) => b.degree - a.degree)
        .slice(0, 15);
      setSearchResults(results);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, data]);

  // Focus graph on a search result node
  const focusNode = useCallback((node: GraphNode) => {
    setSearchHighlightId(node.id);
    setSearchResults([]);
    setSearchQuery('');
    setSelectedNode(node);
    // Clear story highlights when searching
    if (activeStoryIndex != null) {
      setActiveStoryIndex(null);
      setHighlightedNodeIds(new Set());
      setAnnotationPositions([]);
      setInsights(null);
    }
    if (fgRef.current && node.x != null && node.y != null) {
      fgRef.current.centerAt(node.x, node.y, 800);
      fgRef.current.zoom(3, 800);
    }
  }, [activeStoryIndex]);

  // Initial load — respect ?preset= URL param if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const presetName = params.get('preset');
    if (presetName) {
      const idx = PRESETS.findIndex(p => p.label === presetName);
      if (idx >= 0) {
        setActivePreset(idx);
        fetchGraph(PRESETS[idx]);
        return;
      }
    }
    fetchGraph(PRESETS[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Configure forces + zoom after data
  const activeMode = PRESETS[activePreset]?.mode;
  const storyMode = activeStoryIndex != null ? STORIES[activeStoryIndex]?.mode : null;
  const effectiveMode = storyMode || activeMode;
  const isJustice = effectiveMode === 'justice';
  const isPower = effectiveMode === 'power';
  const isInterlocks = effectiveMode === 'interlocks';
  const isNdis = effectiveMode === 'ndis';
  const isFoundations = effectiveMode === 'foundations';
  useEffect(() => {
    if (data && fgRef.current) {
      const fg = fgRef.current;
      if (isFoundations) {
        // Foundation mode: hub foundations with grantee spokes + regranting chains
        fg.d3Force('charge')?.strength(-150).distanceMax(600);
        fg.d3Force('link')?.distance(35).strength(0.4);
        fg.d3Force('center')?.strength(0.03);
      } else if (isNdis) {
        // NDIS: bipartite LGA hubs + provider spokes — strong repulsion for readability
        fg.d3Force('charge')?.strength(-160).distanceMax(600);
        fg.d3Force('link')?.distance(35).strength(0.45);
        fg.d3Force('center')?.strength(0.03);
      } else if (isInterlocks) {
        // Interlocks: bipartite layout — strong repulsion to spread person clusters
        fg.d3Force('charge')?.strength(-180).distanceMax(700);
        fg.d3Force('link')?.distance(40).strength(0.4);
        fg.d3Force('center')?.strength(0.025);
      } else if (isPower) {
        // Power mode: spread out to show clusters, strong repulsion
        fg.d3Force('charge')?.strength(-200).distanceMax(800);
        fg.d3Force('link')?.distance(50).strength(0.3);
        fg.d3Force('center')?.strength(0.02);
      } else if (isJustice) {
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
  }, [data, isJustice, isPower, isInterlocks, isNdis, isFoundations]);

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

  // Whether highlighting is active (from story or search)
  const hasHighlights = highlightedNodeIds.size > 0 || searchHighlightId != null;

  // Check if a node should be highlighted
  const isNodeHighlighted = useCallback((nodeId: string): boolean => {
    if (searchHighlightId === nodeId) return true;
    if (highlightedNodeIds.has(nodeId)) return true;
    return false;
  }, [searchHighlightId, highlightedNodeIds]);

  // Custom node rendering with glow + highlight support
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const deg = node.degree || 0;
    const isProgram = node.type === 'program';
    const x = node.x || 0;
    const y = node.y || 0;

    // Compute highlight/dim state
    const highlighted = hasHighlights && isNodeHighlighted(node.id);
    const dimmed = hasHighlights && !isNodeHighlighted(node.id);
    const dimAlpha = dimmed ? 0.15 : 1;

    // Search highlight: pulsing ring
    if (searchHighlightId === node.id) {
      const pulseSize = 25;
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
      ctx.stroke();

      // Inner glow
      const gradient = ctx.createRadialGradient(x, y, 5, x, y, pulseSize);
      gradient.addColorStop(0, 'rgba(74, 222, 128, 0.3)');
      gradient.addColorStop(1, 'rgba(74, 222, 128, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, pulseSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Story highlight: subtle ring
    if (highlighted && !searchHighlightId) {
      const ringSize = Math.max(8, Math.sqrt(deg + 1) * 2.5 + 5);
      const gradient = ctx.createRadialGradient(x, y, ringSize * 0.5, x, y, ringSize);
      gradient.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
      gradient.addColorStop(1, 'rgba(251, 191, 36, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, ringSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // Power mode: color by system_count, size by power_score
    if (isPower && node.system_count) {
      const sysCount = node.system_count || 1;
      const powerScore = node.power_score || 1;
      const color = SYSTEM_COLORS[Math.min(sysCount, 7)] || '#6b7280';
      const size = Math.max(3, Math.min(20, Math.sqrt(powerScore) * 1.8));

      // Glow — stronger for higher system count
      const glowSize = size * (2 + sysCount * 0.5);
      const gradient = ctx.createRadialGradient(x, y, size * 0.2, x, y, glowSize);
      gradient.addColorStop(0, color + (dimmed ? '22' : '66'));
      gradient.addColorStop(0.4, color + (dimmed ? '08' : '22'));
      gradient.addColorStop(1, color + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowSize, 0, Math.PI * 2);
      ctx.fill();

      // System ring segments — one arc per system
      if (node.systems && node.systems.length > 1) {
        const systemColors: Record<string, string> = {
          procurement: '#a78bfa', justice: '#4ade80', donations: '#f87171',
          charity: '#60a5fa', foundation: '#fbbf24', alma: '#2dd4bf', ato: '#f472b6',
        };
        const arcPer = (Math.PI * 2) / node.systems.length;
        ctx.lineWidth = 2;
        ctx.globalAlpha = dimAlpha;
        node.systems.forEach((sys: string, i: number) => {
          ctx.strokeStyle = systemColors[sys] || '#6b7280';
          ctx.beginPath();
          ctx.arc(x, y, size + 3, i * arcPer - Math.PI / 2, (i + 1) * arcPer - Math.PI / 2);
          ctx.stroke();
        });
        ctx.globalAlpha = 1;
      }

      // Core
      ctx.globalAlpha = dimAlpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Hot center for high power
      if (powerScore > 10) {
        ctx.globalAlpha = dimAlpha;
        ctx.fillStyle = '#ffffffcc';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Labels — show at lower zoom for high-power entities
      const labelThreshold = sysCount >= 5 ? 0.1 : sysCount >= 4 ? 0.2 : 0.4;
      if (globalScale > labelThreshold && !dimmed) {
        const fontSize = Math.max(10, 12 / globalScale);
        ctx.font = `700 ${fontSize}px -apple-system, "SF Pro Text", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#000000bb';
        ctx.fillText(node.label.substring(0, 36), x + 0.5, y + size + 3.5);
        ctx.fillStyle = color + 'ee';
        ctx.fillText(node.label.substring(0, 36), x, y + size + 3);
      }
      return;
    }

    // Interlocks mode: person nodes = hexagons, org nodes = circles
    if (isInterlocks) {
      const isPerson = node.type === 'person';
      const boardCount = node.board_count || 0;
      const color = isPerson ? '#f472b6' : (TYPE_COLORS[node.type] || '#6b7280');
      const size = isPerson
        ? Math.max(5, Math.min(18, boardCount * 2.5))
        : Math.max(3, Math.min(12, Math.sqrt(deg + 1) * 2));

      // Glow for persons with many boards
      if (isPerson && boardCount >= 3) {
        const glowSize = size * 3;
        const gradient = ctx.createRadialGradient(x, y, size * 0.2, x, y, glowSize);
        gradient.addColorStop(0, '#f472b6' + (dimmed ? '18' : '55'));
        gradient.addColorStop(0.5, '#f472b6' + (dimmed ? '06' : '18'));
        gradient.addColorStop(1, '#f472b6' + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fill();
      }

      // Shape: hexagon for persons, circle for orgs
      ctx.globalAlpha = dimAlpha;
      ctx.fillStyle = color;
      ctx.beginPath();
      if (isPerson) {
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const px = x + size * Math.cos(angle);
          const py = y + size * Math.sin(angle);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else {
        ctx.arc(x, y, size, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.globalAlpha = 1;

      // Hot center for high-interlock persons
      if (isPerson && boardCount >= 5) {
        ctx.globalAlpha = dimAlpha;
        ctx.fillStyle = '#ffffffcc';
        ctx.beginPath();
        ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Community-controlled ring
      if (node.community_controlled) {
        ctx.globalAlpha = dimAlpha;
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // Labels
      const labelThreshold = isPerson ? (boardCount >= 5 ? 0.15 : 0.35) : 0.5;
      if (globalScale > labelThreshold && !dimmed) {
        const fontSize = Math.max(10, 12 / globalScale);
        ctx.font = `700 ${fontSize}px -apple-system, "SF Pro Text", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#000000bb';
        ctx.fillText(node.label.substring(0, 30), x + 0.5, y + size + 2.5);
        ctx.fillStyle = isPerson ? '#f472b6dd' : '#ffffffdd';
        ctx.fillText(node.label.substring(0, 30), x, y + size + 2);
      }
      return;
    }

    // Foundations mode: foundations = diamonds, regranters = hexagons, grantees = circles
    if (isFoundations) {
      const isFoundation = node.type === 'foundation';
      const isRegranter = node.type === 'regranter' || node.is_regranter;
      const tierColor = isFoundation
        ? (SCORE_TIER_COLORS[node.score_tier] || '#60a5fa')
        : isRegranter ? '#f59e0b' : '#6b7280';
      const size = isFoundation
        ? Math.max(8, Math.min(20, Math.sqrt((node.funding || 0) / 100000) * 1.2))
        : isRegranter
          ? Math.max(5, Math.min(14, Math.sqrt(deg + 1) * 2))
          : Math.max(2, Math.min(8, Math.sqrt(deg + 1) * 1.3));

      // Glow for foundations
      if (isFoundation) {
        const glowSize = size * 3;
        const gradient = ctx.createRadialGradient(x, y, size * 0.2, x, y, glowSize);
        gradient.addColorStop(0, tierColor + (dimmed ? '18' : '55'));
        gradient.addColorStop(0.5, tierColor + (dimmed ? '06' : '18'));
        gradient.addColorStop(1, tierColor + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalAlpha = dimAlpha;
      ctx.fillStyle = tierColor;
      ctx.beginPath();
      if (isFoundation) {
        // Diamond shape for foundations
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
      } else if (isRegranter) {
        // Hexagon for regranters
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6;
          const px = x + size * Math.cos(angle);
          const py = y + size * Math.sin(angle);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath();
      } else {
        // Circle for grantees
        ctx.arc(x, y, size, 0, Math.PI * 2);
      }
      ctx.fill();

      // Score ring for foundations with scores
      if (isFoundation && node.foundation_score) {
        const score = Number(node.foundation_score);
        const arcLen = (score / 100) * Math.PI * 2;
        ctx.strokeStyle = tierColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, size + 3, -Math.PI / 2, -Math.PI / 2 + arcLen);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Labels
      const labelThreshold = isFoundation ? 0.15 : isRegranter ? 0.3 : 0.5;
      if (globalScale > labelThreshold && !dimmed) {
        const fontSize = Math.max(10, 12 / globalScale);
        ctx.font = `700 ${fontSize}px -apple-system, "SF Pro Text", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#000000bb';
        ctx.fillText(node.label.substring(0, 30), x + 0.5, y + size + 2.5);
        ctx.fillStyle = tierColor + 'dd';
        ctx.fillText(node.label.substring(0, 30), x, y + size + 2);
      }
      return;
    }

    // NDIS mode: LGA nodes = rounded squares sized by participants, providers = circles
    if (isNdis) {
      const isLga = node.type === 'lga';
      const severityColor = isLga ? (SEVERITY_COLORS[node.severity] || '#6b7280') : (TYPE_COLORS[node.type] || '#a78bfa');

      if (isLga) {
        const participants = node.ndis_participants || 0;
        const size = Math.max(8, Math.min(22, Math.sqrt(participants) * 0.4));

        // Glow — stronger for critical/severe
        const isCritical = node.severity === 'critical' || node.severity === 'severe';
        const glowSize = size * (isCritical ? 3.5 : 2.5);
        const gradient = ctx.createRadialGradient(x, y, size * 0.2, x, y, glowSize);
        gradient.addColorStop(0, severityColor + (dimmed ? '18' : isCritical ? '66' : '44'));
        gradient.addColorStop(0.5, severityColor + (dimmed ? '06' : '18'));
        gradient.addColorStop(1, severityColor + '00');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Rounded square for LGA
        ctx.globalAlpha = dimAlpha;
        ctx.fillStyle = severityColor;
        const r = size * 0.3;
        ctx.beginPath();
        ctx.moveTo(x - size + r, y - size);
        ctx.lineTo(x + size - r, y - size);
        ctx.quadraticCurveTo(x + size, y - size, x + size, y - size + r);
        ctx.lineTo(x + size, y + size - r);
        ctx.quadraticCurveTo(x + size, y + size, x + size - r, y + size);
        ctx.lineTo(x - size + r, y + size);
        ctx.quadraticCurveTo(x - size, y + size, x - size, y + size - r);
        ctx.lineTo(x - size, y - size + r);
        ctx.quadraticCurveTo(x - size, y - size, x - size + r, y - size);
        ctx.fill();

        // Participant count inside
        if (globalScale > 0.2 && participants > 50) {
          const fontSize = Math.max(7, Math.min(10, size * 0.6));
          ctx.font = `700 ${fontSize}px -apple-system, "SF Pro Text", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#000000cc';
          ctx.fillText(participants > 1000 ? `${(participants / 1000).toFixed(0)}K` : String(participants), x, y);
        }
        ctx.globalAlpha = 1;

        // Labels — show at lower zoom for critical LGAs
        const labelThresh = isCritical ? 0.12 : 0.25;
        if (globalScale > labelThresh && !dimmed) {
          const fontSize = Math.max(10, 12 / globalScale);
          ctx.font = `700 ${fontSize}px -apple-system, "SF Pro Text", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#000000bb';
          ctx.fillText(node.label.substring(0, 28), x + 0.5, y + size + 3.5);
          ctx.fillStyle = severityColor + 'dd';
          ctx.fillText(node.label.substring(0, 28), x, y + size + 3);
        }
      } else {
        // Provider node — circle, colored by type
        const provSize = Math.max(2, Math.min(8, Math.sqrt(deg + 1) * 1.5));
        const provColor = node.community_controlled ? '#f87171' : severityColor;

        ctx.globalAlpha = dimAlpha;
        ctx.fillStyle = provColor;
        ctx.beginPath();
        ctx.arc(x, y, provSize, 0, Math.PI * 2);
        ctx.fill();

        // Cross-system ring for multi-system providers
        if (node.system_count && node.system_count >= 2) {
          ctx.strokeStyle = SYSTEM_COLORS[Math.min(node.system_count, 7)] || '#60a5fa';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, provSize + 2, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Community-controlled ring
        if (node.community_controlled) {
          ctx.strokeStyle = '#f87171';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, provSize + 2, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;

        // Labels for high-degree providers
        if (deg > 3 && globalScale > 0.4 && !dimmed) {
          const fontSize = Math.max(9, 11 / globalScale);
          ctx.font = `600 ${fontSize}px -apple-system, "SF Pro Text", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillStyle = '#ffffffaa';
          ctx.fillText(node.label.substring(0, 24), x, y + provSize + 2);
        }
      }
      return;
    }

    // Diary mode: minister nodes as pentagons, org nodes as circles
    const isDiary = effectiveMode === 'diary';
    const isMinister = node.type === 'minister';
    if (isDiary && isMinister) {
      const minColor = '#ef4444';
      const size = Math.max(8, Math.min(20, Math.sqrt(deg + 1) * 3));

      // Red glow
      const gradient = ctx.createRadialGradient(x, y, size * 0.3, x, y, size * 4);
      gradient.addColorStop(0, minColor + (dimmed ? '18' : '55'));
      gradient.addColorStop(0.5, minColor + (dimmed ? '06' : '18'));
      gradient.addColorStop(1, minColor + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, size * 4, 0, Math.PI * 2);
      ctx.fill();

      // Pentagon shape for ministers
      ctx.globalAlpha = dimAlpha;
      ctx.fillStyle = minColor;
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        const px = x + size * Math.cos(angle);
        const py = y + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      // Hot center
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Label
      if (globalScale > 0.3 || deg > 5) {
        ctx.font = `bold ${Math.min(12, 10 / globalScale)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#ffffffcc';
        ctx.fillText(node.label.substring(0, 30), x, y + size + 3);
      }
      return;
    }

    // Default rendering (justice + hub modes)
    const color = (node.alma_type && ALMA_COLORS[node.alma_type]) || TYPE_COLORS[node.type] || '#6b7280';
    const size = isProgram
      ? Math.max(6, Math.min(16, Math.sqrt(deg + 1) * 2))
      : Math.max(1.5, Math.min(12, Math.sqrt(deg + 1) * 1.5));

    // Glow for high-degree nodes and programs
    if (deg > 3 || isProgram) {
      const glowSize = size * (isProgram ? 4 : 3);
      const gradient = ctx.createRadialGradient(x, y, size * 0.3, x, y, glowSize);
      gradient.addColorStop(0, color + (dimmed ? '18' : '55'));
      gradient.addColorStop(0.5, color + (dimmed ? '06' : '18'));
      gradient.addColorStop(1, color + '00');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, glowSize, 0, Math.PI * 2);
      ctx.fill();
    }

    // ALMA ring indicator
    if (node.alma_type) {
      ctx.globalAlpha = dimAlpha;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, size + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Core dot — programs get diamond shape
    ctx.globalAlpha = dimAlpha;
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
    ctx.globalAlpha = 1;

    // Hot center for high-degree
    if (deg > 10 || isProgram) {
      ctx.globalAlpha = dimAlpha;
      ctx.fillStyle = '#ffffffbb';
      ctx.beginPath();
      ctx.arc(x, y, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Labels for hubs and programs (also show for highlighted nodes)
    const showLabel = highlighted || (isProgram ? globalScale > 0.15 : (deg > 15 && globalScale > 0.3));
    if (showLabel && !dimmed) {
      const fontSize = Math.max(10, 12 / globalScale);
      ctx.font = `700 ${fontSize}px -apple-system, "SF Pro Text", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = '#000000bb';
      ctx.fillText(node.label.substring(0, 32), x + 0.5, y + size + 2.5);
      ctx.fillStyle = isProgram ? '#fbbf24dd' : '#ffffffdd';
      ctx.fillText(node.label.substring(0, 32), x, y + size + 2);
    }
  }, [isPower, isInterlocks, isNdis, hasHighlights, isNodeHighlighted, searchHighlightId]);

  // Active story object
  const activeStory = activeStoryIndex != null ? STORIES[activeStoryIndex] : null;

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
            linkColor={(link: any) => isFoundations ? (link.dataset === 'foundation_regranting' ? 'rgba(245,158,11,0.25)' : 'rgba(255,255,255,0.12)') : isNdis ? 'rgba(251,191,36,0.12)' : isInterlocks ? 'rgba(244,114,182,0.15)' : isPower ? 'rgba(255,255,255,0.08)' : isJustice ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)'}
            linkWidth={(link: any) => isFoundations ? (link.dataset === 'foundation_regranting' ? 0.8 : 0.5) : isNdis ? 0.5 : isInterlocks ? 0.6 : isPower ? 0.4 : isJustice ? 0.5 : 0.3}
            d3AlphaDecay={0.015}
            d3VelocityDecay={0.25}
            warmupTicks={300}
            cooldownTime={12000}
            onNodeHover={(node: any) => setHoveredNode(node as GraphNode | null)} // eslint-disable-line @typescript-eslint/no-explicit-any
            onNodeClick={(node: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
              setSelectedNode(node as GraphNode);
              setSearchHighlightId(null);
            }}
            onBackgroundClick={() => {
              setSelectedNode(null);
              setSearchHighlightId(null);
            }}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />
        )}
      </div>

      {/* Story Sidebar — left side */}
      <div
        className={`absolute top-0 left-0 bottom-0 z-30 transition-transform duration-300 ease-in-out ${
          showStories ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: 'min(350px, 85vw)' }}
      >
        <div className="h-full bg-[#0a0a0f]/95 backdrop-blur-xl border-r border-white/10 flex flex-col">
          {/* Sidebar header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 className="text-xs font-black uppercase tracking-widest text-white/80">Stories</h2>
            <button
              onClick={() => setShowStories(false)}
              className="text-white/40 hover:text-white/70 transition-colors text-lg leading-none"
            >
              &times;
            </button>
          </div>

          {/* Search input */}
          <div className="p-3 border-b border-white/10">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search entities..."
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white placeholder-white/30 focus:outline-none focus:border-[#4ade80]/40 focus:bg-white/8 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 text-sm"
                >
                  &times;
                </button>
              )}
            </div>
            {/* Search results dropdown */}
            {searchResults.length > 0 && (
              <div className="mt-1 bg-[#1a1a24] border border-white/10 rounded max-h-48 overflow-y-auto">
                {searchResults.map(node => (
                  <button
                    key={node.id}
                    onClick={() => focusNode(node)}
                    className="w-full text-left px-3 py-2 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                  >
                    <p className="text-xs text-white/80 truncate">{node.label}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] px-1 py-0.5 rounded border"
                        style={{ borderColor: TYPE_COLORS[node.type] || '#6b7280', color: TYPE_COLORS[node.type] || '#6b7280' }}>
                        {node.type?.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[9px] text-white/30">{node.degree} connections</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Story list */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {STORIES.map((story, i) => (
              <button
                key={story.id}
                onClick={() => activateStory(i)}
                disabled={loading}
                className={`w-full text-left p-3 rounded-lg transition-all border ${
                  activeStoryIndex === i
                    ? 'bg-[#fbbf24]/10 border-[#fbbf24]/30'
                    : 'bg-white/3 border-white/5 hover:bg-white/5 hover:border-white/10'
                } disabled:opacity-40`}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                    activeStoryIndex === i ? 'bg-[#fbbf24]' : 'bg-white/20'
                  }`} />
                  <div>
                    <p className={`text-xs font-bold ${
                      activeStoryIndex === i ? 'text-[#fbbf24]' : 'text-white/70'
                    }`}>
                      {story.title}
                    </p>
                    <p className="text-[10px] text-white/40 mt-0.5 leading-relaxed">
                      {story.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Active story narrative with computed insights */}
          {activeStory && (
            <div className="border-t border-white/10 p-4 bg-[#0a0a0f]/80 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-[#fbbf24] rounded-full" />
                <h3 className="text-xs font-black uppercase tracking-widest text-[#fbbf24]">
                  {activeStory.title}
                </h3>
              </div>

              {/* Stat cards */}
              {insights && insights.stats.length > 0 && (
                <div className="grid grid-cols-2 gap-1.5">
                  {insights.stats.map((stat) => (
                    <div key={stat.label} className="bg-white/5 rounded px-2 py-1.5 border border-white/5">
                      <p className="text-[13px] font-bold text-white/90 font-mono">{stat.value}</p>
                      <p className="text-[9px] text-white/40 uppercase tracking-wider">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Dynamic narrative */}
              <p className="text-[11px] text-white/60 leading-relaxed">
                {insights?.narrative || activeStory.description}
              </p>

              {/* Callout */}
              {insights?.callout && (
                <div className="bg-[#fbbf24]/5 border border-[#fbbf24]/15 rounded px-2.5 py-2">
                  <p className="text-[10px] text-[#fbbf24]/80 leading-relaxed">{insights.callout}</p>
                </div>
              )}

              {highlightedNodeIds.size > 0 && (
                <p className="text-[9px] text-white/30 font-mono">
                  {highlightedNodeIds.size} nodes highlighted
                </p>
              )}
            </div>
          )}

          {/* Story navigation: prev/next */}
          <div className="border-t border-white/10 p-3 flex items-center justify-between">
            <button
              onClick={() => {
                const prev = activeStoryIndex != null
                  ? (activeStoryIndex - 1 + STORIES.length) % STORIES.length
                  : STORIES.length - 1;
                activateStory(prev);
              }}
              disabled={loading}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors disabled:opacity-30"
            >
              Prev
            </button>
            <span className="text-[9px] text-white/30 font-mono">
              {activeStoryIndex != null ? `${activeStoryIndex + 1} / ${STORIES.length}` : `${STORIES.length} stories`}
            </span>
            <button
              onClick={() => {
                const next = activeStoryIndex != null
                  ? (activeStoryIndex + 1) % STORIES.length
                  : 0;
                activateStory(next);
              }}
              disabled={loading}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-white/50 hover:bg-white/10 hover:text-white/70 transition-colors disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Annotation overlays — positioned near relevant clusters */}
      {activeStory && annotationPositions.map((ann, i) => {
        // Clamp to viewport with padding
        const clampedX = Math.max(60, Math.min(ann.x, dimensions.width - 260));
        const clampedY = Math.max(80, Math.min(ann.y - 40, dimensions.height - 100));
        return (
          <div
            key={`ann-${i}`}
            className="absolute z-20 pointer-events-none transition-all duration-500"
            style={{
              left: clampedX,
              top: clampedY,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="bg-[#0a0a0f]/85 backdrop-blur border border-[#fbbf24]/20 rounded-lg px-3 py-2 max-w-[220px]">
              <p className="text-[10px] text-white/70 leading-relaxed">{ann.text}</p>
              {/* Arrow pointing down */}
              <div className="absolute left-1/2 -bottom-1.5 -translate-x-1/2 w-3 h-3 bg-[#0a0a0f]/85 border-r border-b border-[#fbbf24]/20 rotate-45" />
            </div>
          </div>
        );
      })}

      {/* Title */}
      <div className="absolute top-0 left-0 right-0 z-10 pointer-events-none">
        <div className="flex items-center justify-between p-4">
          <div className="pointer-events-auto flex items-center gap-3">
            {/* Stories toggle button */}
            <button
              onClick={() => setShowStories(!showStories)}
              className={`px-3 py-1.5 border rounded text-xs font-mono transition-colors ${
                showStories
                  ? 'bg-[#fbbf24]/15 border-[#fbbf24]/30 text-[#fbbf24]'
                  : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
              }`}
            >
              Stories
            </button>
            <div>
              <h1 className="text-lg font-black tracking-widest uppercase text-white/90">CivicGraph</h1>
              {data && (
                <p className="text-xs font-mono text-white/40 mt-0.5">
                  {data.meta.total_nodes.toLocaleString()} entities &middot; {data.meta.total_edges.toLocaleString()} relationships
                </p>
              )}
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-2">
            {/* Clear story/highlight */}
            {(activeStoryIndex != null || searchHighlightId) && (
              <button
                onClick={() => {
                  setActiveStoryIndex(null);
                  setHighlightedNodeIds(new Set());
                  setAnnotationPositions([]);
                  setSearchHighlightId(null);
                  setInsights(null);
                }}
                className="px-3 py-1.5 bg-[#fbbf24]/10 border border-[#fbbf24]/30 rounded text-xs font-mono text-[#fbbf24] hover:bg-[#fbbf24]/20 transition-colors"
              >
                Clear Highlights
              </button>
            )}
            <button
              onClick={() => setShowPanel(!showPanel)}
              className="px-3 py-1.5 bg-white/5 border border-white/10 rounded text-xs font-mono text-white/60 hover:bg-white/10 transition-colors"
            >
              {showPanel ? 'Hide' : 'Controls'}
            </button>
          </div>
        </div>
      </div>

      {/* Preset buttons */}
      {showPanel && (
        <div className="absolute top-16 right-4 z-10 w-56 bg-[#12121a]/90 backdrop-blur-xl border border-white/10 rounded-lg p-3 space-y-1.5">
          <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">Network View</p>
          {PRESETS.map((preset, i) => (
            <button
              key={preset.label}
              onClick={() => {
                setActivePreset(i);
                setActiveStoryIndex(null);
                setHighlightedNodeIds(new Set());
                setAnnotationPositions([]);
                setSearchHighlightId(null);
                setInsights(null);
                fetchGraph(preset);
              }}
              disabled={loading}
              className={`w-full text-left px-3 py-2 rounded text-xs transition-all ${
                activePreset === i && activeStoryIndex == null
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
      <div className={`absolute bottom-4 z-10 bg-[#12121a]/80 backdrop-blur border border-white/10 rounded-lg p-3 max-w-xs transition-all duration-300 ${
        showStories ? 'left-[calc(min(350px,85vw)+16px)]' : 'left-4'
      }`}>
        {isNdis ? (
          <>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">NDIS Thin Markets</p>
            <div className="space-y-2">
              <div>
                <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Market Severity</p>
                {Object.entries(SEVERITY_COLORS).map(([sev, color]) => (
                  <div key={sev} className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="text-[10px] text-white/50 capitalize">{sev}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Node Types</p>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-3 h-3 rounded-sm bg-[#fbbf24]" />
                  <span className="text-[10px] text-white/50">LGA (sized by participants)</span>
                </div>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#a78bfa]" />
                  <span className="text-[10px] text-white/50">NDIS Provider</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-[#f87171]" />
                  <span className="text-[10px] text-white/50">Community Controlled</span>
                </div>
              </div>
            </div>
          </>
        ) : isInterlocks ? (
          <>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">Board Interlocks</p>
            <div className="space-y-2">
              <div>
                <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Node Types</p>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-3 h-3 bg-[#f472b6]" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
                  <span className="text-[10px] text-white/50">Person (hexagon)</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#4ade80]" />
                  <span className="text-[10px] text-white/50">Charity</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#60a5fa]" />
                  <span className="text-[10px] text-white/50">Foundation</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full border-2 border-[#f87171]" />
                  <span className="text-[10px] text-white/50">Community Controlled</span>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Size = Board Seats</p>
                <p className="text-[9px] text-white/30">Larger hexagons = more boards</p>
              </div>
            </div>
          </>
        ) : isPower ? (
          <>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">Power Concentration</p>
            <div className="space-y-2">
              <div>
                <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Systems Present</p>
                {Object.entries(SYSTEM_COLORS).map(([count, color]) => (
                  <div key={count} className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-[10px] text-white/50">{count} system{count !== '1' ? 's' : ''}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Ring = System Type</p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                  {[['procurement', '#a78bfa'], ['justice', '#4ade80'], ['donations', '#f87171'], ['charity', '#60a5fa'], ['foundation', '#fbbf24'], ['alma', '#2dd4bf']].map(([sys, color]) => (
                    <div key={sys} className="flex items-center gap-1">
                      <div className="w-2 h-2 rounded-full border-2 shrink-0" style={{ borderColor: color }} />
                      <span className="text-[9px] text-white/40">{sys}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : isFoundations ? (
          <>
            <p className="text-[10px] font-mono uppercase tracking-wider text-white/40 mb-2">Foundation Networks</p>
            <div className="space-y-2">
              <div>
                <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Node Shapes</p>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-3 h-3 rotate-45" style={{ backgroundColor: '#22c55e' }} />
                  <span className="text-[10px] text-white/50">Foundation (diamond)</span>
                </div>
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-3 h-3 bg-[#f59e0b]" style={{ clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)' }} />
                  <span className="text-[10px] text-white/50">Regranter (hexagon)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#6b7280]" />
                  <span className="text-[10px] text-white/50">Grantee</span>
                </div>
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Foundation Score</p>
                {Object.entries(SCORE_TIER_COLORS).map(([tier, color]) => (
                  <div key={tier} className="flex items-center gap-1.5 mb-0.5">
                    <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                    <span className="text-[10px] text-white/50 capitalize">{tier}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-[9px] font-mono uppercase text-white/30 mb-1">Edge Types</p>
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className="w-4 h-0 border-t border-white/30" />
                  <span className="text-[10px] text-white/40">Direct grant</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-0 border-t border-dashed border-[#f59e0b]/50" />
                  <span className="text-[10px] text-white/40">Regrant chain</span>
                </div>
              </div>
            </div>
          </>
        ) : isJustice ? (
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
            {hoveredNode.ndis_participants && (
              <span className="text-[10px] font-mono" style={{ color: SEVERITY_COLORS[hoveredNode.severity || ''] || '#fbbf24' }}>
                {hoveredNode.ndis_participants.toLocaleString()} participants
              </span>
            )}
            {hoveredNode.board_count && (
              <span className="text-[10px] font-mono text-[#f472b6]">
                {hoveredNode.board_count} boards
              </span>
            )}
            {hoveredNode.system_count && (
              <span className="text-[10px] font-mono" style={{ color: SYSTEM_COLORS[Math.min(hoveredNode.system_count, 7)] }}>
                {hoveredNode.system_count} systems
              </span>
            )}
            {hoveredNode.foundation_score != null && (
              <span className="text-[10px] font-mono" style={{ color: SCORE_TIER_COLORS[hoveredNode.score_tier || 'unscored'] }}>
                Score: {hoveredNode.foundation_score}
              </span>
            )}
            {hoveredNode.is_regranter && (
              <span className="text-[10px] font-mono text-[#f59e0b]">Regranter</span>
            )}
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
            <button onClick={() => { setSelectedNode(null); setSearchHighlightId(null); }} className="text-white/30 hover:text-white/60 text-sm ml-2">&times;</button>
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
            {selectedNode.ndis_participants != null && selectedNode.ndis_participants > 0 && (
              <div className="mt-1 pt-1 border-t border-white/10">
                <p className="text-[10px] font-mono" style={{ color: SEVERITY_COLORS[selectedNode.severity || ''] || '#fbbf24' }}>
                  {selectedNode.ndis_participants.toLocaleString()} NDIS participants · {selectedNode.ndis_entities || 0} providers
                  {selectedNode.severity && ` · ${selectedNode.severity.toUpperCase()}`}
                </p>
                {selectedNode.ndis_utilisation != null && (
                  <p className="text-[9px] text-white/40 font-mono mt-0.5">
                    Avg utilisation: {(selectedNode.ndis_utilisation * 100).toFixed(0)}%
                    {selectedNode.seifa_decile && ` · SEIFA D${selectedNode.seifa_decile}`}
                  </p>
                )}
                {selectedNode.desert_score != null && (
                  <p className="text-[9px] text-[#f97316] font-mono">
                    Desert score: {Math.round(selectedNode.desert_score)}
                  </p>
                )}
              </div>
            )}
            {selectedNode.board_count && (
              <div className="mt-1 pt-1 border-t border-white/10">
                <p className="text-[10px] font-mono text-[#f472b6]">
                  {selectedNode.board_count} board seats
                  {selectedNode.interlock_score ? ` · Score: ${Math.round(selectedNode.interlock_score)}` : ''}
                </p>
                {selectedNode.role_types && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedNode.role_types.map((r: string) => (
                      <span key={r} className="text-[9px] px-1 py-0.5 rounded bg-[#f472b6]/10 text-[#f472b6]/70">{r.replace(/_/g, ' ')}</span>
                    ))}
                  </div>
                )}
                {(selectedNode.procurement_dollars ?? 0) > 0 && (
                  <p className="text-[9px] text-[#a78bfa] font-mono mt-1">
                    Linked procurement: ${((selectedNode.procurement_dollars ?? 0) / 1e6).toFixed(1)}M
                  </p>
                )}
                {(selectedNode.justice_dollars ?? 0) > 0 && (
                  <p className="text-[9px] text-[#4ade80] font-mono">
                    Linked justice: ${((selectedNode.justice_dollars ?? 0) / 1e6).toFixed(1)}M
                  </p>
                )}
              </div>
            )}
            {selectedNode.system_count && selectedNode.systems && (
              <div className="mt-1 pt-1 border-t border-white/10">
                <p className="text-[10px] font-mono" style={{ color: SYSTEM_COLORS[Math.min(selectedNode.system_count, 7)] }}>
                  Power Score: {selectedNode.power_score} · {selectedNode.system_count} systems
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedNode.systems.map((sys: string) => (
                    <span key={sys} className="text-[9px] px-1 py-0.5 rounded bg-white/5 text-white/50">{sys}</span>
                  ))}
                </div>
                {(selectedNode.procurement_dollars ?? 0) > 0 && (
                  <p className="text-[9px] text-[#a78bfa] font-mono mt-1">
                    Procurement: ${((selectedNode.procurement_dollars ?? 0) / 1e6).toFixed(1)}M
                    {(selectedNode.distinct_govt_buyers ?? 0) > 0 && ` · ${selectedNode.distinct_govt_buyers} buyers`}
                  </p>
                )}
                {(selectedNode.justice_dollars ?? 0) > 0 && (
                  <p className="text-[9px] text-[#4ade80] font-mono">
                    Justice funding: ${((selectedNode.justice_dollars ?? 0) / 1e6).toFixed(1)}M
                  </p>
                )}
                {(selectedNode.donation_dollars ?? 0) > 0 && (
                  <p className="text-[9px] text-[#f87171] font-mono">
                    Donations: ${((selectedNode.donation_dollars ?? 0) / 1e3).toFixed(1)}K
                    {(selectedNode.distinct_parties_funded ?? 0) > 0 && ` · ${selectedNode.distinct_parties_funded} parties`}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
