import type {
  OpportunityIntelligenceResponse,
  OpportunityRoute,
  OpportunitySignal,
} from '@/lib/opportunity-intelligence';

export type ActResourceAttentionQueue =
  | 'newly-observed'
  | 'needs-verification'
  | 'needs-connection'
  | 'needs-decision'
  | 'action-learning';

export interface ActResourceMatterConnection {
  projectId: string;
  projectLabel: string;
  matterId: string;
  matterLabel: string;
  resourceRole: string;
  explanation: string;
  basis: 'recorded' | 'inferred-for-review';
}

export interface ActResourceEvidenceRead {
  officialSource: 'connected' | 'missing';
  deadline: 'current' | 'overdue' | 'undated';
  amount: 'published' | 'not-published';
  sourceConfidence: OpportunitySignal['sourceConfidence'];
  freshness: OpportunitySignal['freshness'];
  gaps: string[];
}

export interface ActResourceDeskItem {
  id: string;
  title: string;
  organisation: string | null;
  amount: string | null;
  deadline: string | null;
  lane: OpportunitySignal['lane'];
  sourceLabel: string;
  source: OpportunitySignal['source'];
  sourceRef: string;
  sourceUrl: string | null;
  routeId: string | null;
  projectCode: string | null;
  projectLabel: string | null;
  pathway: OpportunityRoute['pathway'] | null;
  queue: ActResourceAttentionQueue;
  connections: ActResourceMatterConnection[];
  evidence: ActResourceEvidenceRead;
  humanDecision: 'not-reviewed' | 'watch' | 'pursue' | 'pass' | 'active' | 'learn';
  nextAction: string;
  whyNow: string;
  matterHref: string | null;
}

export interface ActResourceDeskSnapshot {
  generatedAt: string;
  mode: 'read-only';
  items: ActResourceDeskItem[];
  shortlist: ActResourceDeskItem[];
  queueCounts: Record<ActResourceAttentionQueue, number>;
  sourceCount: number;
  projectCount: number;
  decisionCount: number;
  notes: string[];
}

const PROJECT_BY_CODE: Record<string, { id: string; label: string }> = {
  'ACT-GD': { id: 'goods', label: 'Goods' },
  'ACT-JH': { id: 'justicehub', label: 'JusticeHub' },
  'ACT-EL': { id: 'empathy-ledger', label: 'Empathy Ledger' },
  'ACT-CS': { id: 'civicgraph', label: 'CivicGraph' },
  'ACT-IN': { id: 'civicgraph', label: 'CivicGraph' },
  'ACT-HV': { id: 'harvest', label: 'Harvest' },
  'ACT-FM': { id: 'farm', label: 'Farm' },
  'ACT-CN': { id: 'contained', label: 'Contained' },
};

function projectForRoute(route: OpportunityRoute) {
  return PROJECT_BY_CODE[route.project_code] ?? {
    id: route.project.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label: route.project_name || route.project,
  };
}

function goodsMatter(signal: OpportunitySignal) {
  const text = `${signal.title} ${signal.summary}`.toLowerCase();
  if (/utopia|urapuntja|shred|collection/.test(text)) {
    return { id: 'utopia', label: 'Utopia collection and shredding pathway' };
  }
  if (/tennant|warumungu/.test(text)) {
    return { id: 'tennant-creek', label: 'Tennant Creek first operational pilot' };
  }
  if (/palm island|manbarra/.test(text)) {
    return { id: 'palm-island', label: 'Palm Island relationship and pathway' };
  }
  return { id: 'oonchiumpa', label: 'Oonchiumpa production and ownership pathway' };
}

function matterForRoute(route: OpportunityRoute) {
  const project = projectForRoute(route);
  if (project.id === 'goods') return goodsMatter(route.signal);
  if (project.id === 'justicehub') {
    return {
      id: 'qld-kickstarter-evidence',
      label: 'Kickstarter provider evidence library',
    };
  }
  return {
    id: `${project.id}:resource-path`,
    label: `${project.label} resource pathway`,
  };
}

function resourceRole(route: OpportunityRoute) {
  if (route.pathway === 'capital') return 'Capital';
  if (route.pathway === 'procurement' || route.pathway === 'buyer') return 'Earned revenue';
  if (route.pathway === 'relationship') return 'Relationship pathway';
  if (route.pathway === 'foundation') return 'Philanthropic support';
  if (route.pathway === 'grant') return 'Grant funding';
  return 'Resource signal';
}

function deadlineState(deadline: string | null, now: Date): ActResourceEvidenceRead['deadline'] {
  if (!deadline) return 'undated';
  const parsed = new Date(deadline);
  if (Number.isNaN(parsed.getTime())) return 'undated';
  return parsed.getTime() < now.getTime() ? 'overdue' : 'current';
}

function decisionState(signal: OpportunitySignal): ActResourceDeskItem['humanDecision'] {
  if (signal.status === 'no-go' || signal.status === 'lost') return 'pass';
  if (signal.status === 'monitor') return 'watch';
  if (signal.status === 'pursuing') return 'pursue';
  if (signal.status === 'submitted' || signal.status === 'won') return 'active';
  return 'not-reviewed';
}

function attentionQueue(
  route: OpportunityRoute,
  connectionCount: number,
  evidence: ActResourceEvidenceRead,
): ActResourceAttentionQueue {
  if (['pursuing', 'submitted', 'won', 'lost', 'no-go'].includes(route.signal.status)) {
    return 'action-learning';
  }
  if (route.signal.status === 'discovered' && route.signal.evidence.length === 0) {
    return 'newly-observed';
  }
  if (
    evidence.officialSource === 'missing'
    || evidence.deadline === 'overdue'
    || evidence.sourceConfidence === 'low'
    || route.evidence_gaps.length > 0
  ) {
    return 'needs-verification';
  }
  if (connectionCount === 0) return 'needs-connection';
  return 'needs-decision';
}

function routeConnection(route: OpportunityRoute): ActResourceMatterConnection {
  const project = projectForRoute(route);
  const matter = matterForRoute(route);
  return {
    projectId: project.id,
    projectLabel: project.label,
    matterId: matter.id,
    matterLabel: matter.label,
    resourceRole: resourceRole(route),
    explanation: route.why_recommended,
    basis: route.signal.projects.length > 0 ? 'recorded' : 'inferred-for-review',
  };
}

function matterHref(connection: ActResourceMatterConnection | undefined) {
  if (!connection) return null;
  if (connection.projectId === 'goods') return '/org/act/goods/model';
  if (connection.projectId === 'justicehub') return '/org/act/justicehub/model';
  return `/org/act/${connection.projectId}`;
}

function isSyntheticRoute(item: ActResourceDeskItem) {
  return /\b(route|scan|map buyers|research route)\b/i.test(item.title)
    || /^goods (grants|capital|foundations|procurement) route$/i.test(item.title);
}

function shortlistOrder(left: ActResourceDeskItem, right: ActResourceDeskItem) {
  const tier = (item: ActResourceDeskItem) => {
    if (item.queue === 'needs-decision') return 0;
    if (item.evidence.deadline === 'current' && item.evidence.officialSource === 'connected') return 1;
    if (item.evidence.deadline === 'current') return 2;
    if (item.evidence.officialSource === 'connected') return 3;
    return 4;
  };
  const tierDelta = tier(left) - tier(right);
  if (tierDelta !== 0) return tierDelta;
  const gapDelta = left.evidence.gaps.length - right.evidence.gaps.length;
  if (gapDelta !== 0) return gapDelta;
  const leftDate = left.deadline ? new Date(left.deadline).getTime() : Number.POSITIVE_INFINITY;
  const rightDate = right.deadline ? new Date(right.deadline).getTime() : Number.POSITIVE_INFINITY;
  if (leftDate !== rightDate) return leftDate - rightDate;
  return left.title.localeCompare(right.title);
}

export function buildActResourceDesk(
  response: OpportunityIntelligenceResponse,
  now = new Date(),
): ActResourceDeskSnapshot {
  const grouped = new Map<string, OpportunityRoute[]>();
  for (const route of response.routes) {
    const routes = grouped.get(route.signalId) ?? [];
    routes.push(route);
    grouped.set(route.signalId, routes);
  }

  const items = response.signals.map((signal): ActResourceDeskItem => {
    const routes = grouped.get(signal.id) ?? [];
    const connections = routes.map(routeConnection);
    const evidence: ActResourceEvidenceRead = {
      officialSource: signal.sourceUrl ? 'connected' : 'missing',
      deadline: deadlineState(signal.deadline, now),
      amount: signal.amount ? 'published' : 'not-published',
      sourceConfidence: signal.sourceConfidence,
      freshness: signal.freshness,
      gaps: Array.from(new Set(routes.flatMap((route) => route.evidence_gaps))),
    };
    const primaryRoute = routes[0];
    return {
      id: signal.id,
      title: signal.title,
      organisation: signal.organisation,
      amount: signal.amount,
      deadline: signal.deadline,
      lane: signal.lane,
      sourceLabel: signal.sourceLabel,
      source: signal.source,
      sourceRef: signal.sourceRef,
      sourceUrl: signal.sourceUrl,
      routeId: primaryRoute?.id ?? null,
      projectCode: primaryRoute?.project_code ?? null,
      projectLabel: primaryRoute?.project_name ?? null,
      pathway: primaryRoute?.pathway ?? null,
      queue: primaryRoute
        ? attentionQueue(primaryRoute, connections.length, evidence)
        : signal.evidence.length === 0
          ? 'newly-observed'
          : 'needs-connection',
      connections,
      evidence,
      humanDecision: decisionState(signal),
      nextAction: primaryRoute?.next_action ?? 'Connect this resource to a concrete project matter or explicitly set it aside.',
      whyNow: signal.whyNow || primaryRoute?.why_recommended || 'This signal needs a bounded human read before it becomes work.',
      matterHref: matterHref(connections[0]),
    };
  });

  const shortlist = items
    .filter((item) =>
      item.lane === 'grant'
      && !isSyntheticRoute(item)
      && item.humanDecision !== 'pass'
      && item.connections.length > 0
      && (
        item.queue === 'needs-decision'
        || item.evidence.deadline === 'current'
        || item.evidence.officialSource === 'connected'
      ),
    )
    .sort(shortlistOrder)
    .slice(0, 7);

  const queueCounts: Record<ActResourceAttentionQueue, number> = {
    'newly-observed': 0,
    'needs-verification': 0,
    'needs-connection': 0,
    'needs-decision': 0,
    'action-learning': 0,
  };
  for (const item of items) queueCounts[item.queue] += 1;

  return {
    generatedAt: response.generatedAt,
    mode: 'read-only',
    items,
    shortlist,
    queueCounts,
    sourceCount: response.sourceHealth.reduce((sum, source) => sum + source.count, 0),
    projectCount: new Set(items.flatMap((item) => item.connections.map((connection) => connection.projectId))).size,
    decisionCount: response.learningSummary.decisionCount,
    notes: [
      'This desk ignores universal opportunity scores. It organises attention by missing evidence, matter connection and human decision state.',
      'Project and matter connections are proposals for review. They do not establish eligibility, authority or consent.',
      'No external system is changed from this read-only view.',
    ],
  };
}
