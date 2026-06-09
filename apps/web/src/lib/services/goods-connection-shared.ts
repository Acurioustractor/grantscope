/**
 * Goods on Country — Connection showcase (pure, dependency-free helpers).
 *
 * Slice 4 of the governance + relationship-intelligence layer: "who can help
 * Goods and how." Turns the warm-intro spine (board-interlock connectors per
 * Goods relationship) into an honest, showcase-ready read of HOW Goods connects
 * to each supporter: the degree, and the single best door to walk through.
 *
 * Honesty matters here (verification discipline). The connectors are multi-board
 * directors associated with the target org, not Goods-side friends. So:
 *   - A connector who ALSO sits on a board with another Goods relationship is a
 *     genuine shared-board bridge -> we call that second degree.
 *   - A connector with no such bridge is a real person on the org's board but
 *     only a board-level door, not a verified personal tie -> we say so plainly.
 *
 * The board roster (co-owners) is NEVER run through this. They are first degree
 * by right (they govern Goods directly); see BOARD_MEMBER_DEGREE below. We do
 * not fuzzy-match governors into the interlock graph: misattributing a board
 * seat to a named co-owner is exactly the disrespect the hard constraint forbids.
 */

export type ConnectionDegree = 'first' | 'second' | 'board-level' | 'none';

/** A single board-interlock connector into a target org (subset of WarmIntroConnector). */
export interface ConnectorInput {
  person: string;
  role: string;
  boardCount: number;
  interlockScore: number;
  communityControlled: boolean;
  /** Name of another Goods relationship this person also bridges to, or null. */
  bridgesToGoods: string | null;
}

/** A target org with its connectors (subset of WarmIntroTarget). */
export interface TargetInput {
  relId: string;
  targetName: string;
  relationshipType: string;
  warmth: number;
  connectors: ConnectorInput[];
}

/** The strongest door to a target, phrased for a human. */
export interface ConnectionOpener {
  person: string;
  /** Why this is the door, in plain language (no fabricated personal ties). */
  rationale: string;
  /** True only for a genuine shared-board bridge to another Goods relationship. */
  isBridge: boolean;
}

export interface ConnectionDoor {
  relId: string;
  targetName: string;
  relationshipType: string;
  degree: ConnectionDegree;
  degreeLabel: string;
  opener: ConnectionOpener | null;
  connectorCount: number;
  warmth: number;
}

/** Board co-owners govern Goods directly. First degree, by right, never scored. */
export const BOARD_MEMBER_DEGREE: { degree: ConnectionDegree; degreeLabel: string; opener: string } = {
  degree: 'first',
  degreeLabel: '1st · board',
  opener: 'Direct (governs Goods)',
};

const DEGREE_LABEL: Record<ConnectionDegree, string> = {
  first: '1st · board',
  second: '2nd · shared board',
  'board-level': 'board-level door',
  none: 'no door yet',
};

export function degreeLabel(degree: ConnectionDegree): string {
  return DEGREE_LABEL[degree];
}

/**
 * Rank a connector as a door. A genuine bridge wins outright; then a
 * community-controlled connector (the work's centre of gravity); then raw
 * board-interlock reach. Mirrors the warm-intro engine's connectorRank so the
 * "best door" here agrees with the warm-intro page.
 */
export function rankConnector(c: ConnectorInput): number {
  return (
    (c.bridgesToGoods ? 1_000_000 : 0) +
    (c.communityControlled ? 100_000 : 0) +
    (Number(c.interlockScore) || 0)
  );
}

/** The single strongest connector for a target, or null when there are none. */
export function bestConnector(connectors: ConnectorInput[]): ConnectorInput | null {
  if (!connectors || connectors.length === 0) return null;
  return connectors.reduce((best, c) => (rankConnector(c) > rankConnector(best) ? c : best));
}

/** Classify the degree from a target's connectors. Pure. */
export function degreeForConnectors(connectors: ConnectorInput[]): ConnectionDegree {
  if (!connectors || connectors.length === 0) return 'none';
  if (connectors.some((c) => !!c.bridgesToGoods)) return 'second';
  return 'board-level';
}

/** Human rationale for a door. Bridges name the shared Goods org; doors stay honest. */
export function openerRationale(c: ConnectorInput): string {
  if (c.bridgesToGoods) return `also on a board with ${c.bridgesToGoods}`;
  const boards = Number(c.boardCount) || 0;
  if (boards >= 2) return `director across ${boards} boards`;
  return 'board-level contact at this org';
}

/** Build the connection door for one target. */
export function toConnectionDoor(target: TargetInput): ConnectionDoor {
  const connectors = target.connectors ?? [];
  const degree = degreeForConnectors(connectors);
  const best = bestConnector(connectors);
  const opener: ConnectionOpener | null = best
    ? { person: best.person, rationale: openerRationale(best), isBridge: !!best.bridgesToGoods }
    : null;
  return {
    relId: target.relId,
    targetName: target.targetName,
    relationshipType: target.relationshipType,
    degree,
    degreeLabel: degreeLabel(degree),
    opener,
    connectorCount: connectors.length,
    warmth: Number(target.warmth) || 0,
  };
}

/**
 * Rank targets into a showcase of the strongest doors: genuine bridges first,
 * then by connector depth, then warmth. Targets with no connectors are dropped.
 * Deterministic (stable tiebreak on targetName) so the page never flickers.
 */
export function toConnectionDoors(targets: TargetInput[], cap = 8): ConnectionDoor[] {
  return (targets ?? [])
    .map(toConnectionDoor)
    .filter((d) => d.degree !== 'none')
    .sort((a, b) => {
      const aBridge = a.degree === 'second' ? 1 : 0;
      const bBridge = b.degree === 'second' ? 1 : 0;
      if (aBridge !== bBridge) return bBridge - aBridge;
      if (a.connectorCount !== b.connectorCount) return b.connectorCount - a.connectorCount;
      if (b.warmth !== a.warmth) return b.warmth - a.warmth;
      return a.targetName.localeCompare(b.targetName);
    })
    .slice(0, cap);
}

export interface ConnectionShowcaseSummary {
  bridges: number;
  boardLevelDoors: number;
  totalDoors: number;
}

/** Count doors by kind across ALL targets (not just the capped showcase). */
export function summarizeConnections(targets: TargetInput[]): ConnectionShowcaseSummary {
  let bridges = 0;
  let boardLevel = 0;
  for (const t of targets ?? []) {
    const degree = degreeForConnectors(t.connectors ?? []);
    if (degree === 'second') bridges += 1;
    else if (degree === 'board-level') boardLevel += 1;
  }
  return { bridges, boardLevelDoors: boardLevel, totalDoors: bridges + boardLevel };
}
