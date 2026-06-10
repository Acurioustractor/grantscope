import { describe, it, expect } from 'vitest';
import {
  rankConnector,
  bestConnector,
  degreeForConnectors,
  openerRationale,
  toConnectionDoor,
  toConnectionDoors,
  summarizeConnections,
  degreeLabel,
  BOARD_MEMBER_DEGREE,
  type ConnectorInput,
  type TargetInput,
} from '@/lib/services/goods-connection-shared';

function conn(overrides: Partial<ConnectorInput> = {}): ConnectorInput {
  return {
    person: 'Jane Doe',
    role: 'director',
    boardCount: 4,
    interlockScore: 100,
    communityControlled: false,
    bridgesToGoods: null,
    ...overrides,
  };
}

function target(overrides: Partial<TargetInput> = {}): TargetInput {
  return {
    relId: 'r1',
    targetName: 'Acme Foundation',
    relationshipType: 'funder',
    warmth: 50,
    connectors: [],
    ...overrides,
  };
}

describe('rankConnector', () => {
  it('a genuine bridge outranks a higher raw interlock score', () => {
    const bridge = conn({ interlockScore: 10, bridgesToGoods: 'Snow Foundation' });
    const hub = conn({ interlockScore: 999, bridgesToGoods: null });
    expect(rankConnector(bridge)).toBeGreaterThan(rankConnector(hub));
  });

  it('community-controlled outranks a higher raw interlock score (no bridge either side)', () => {
    const community = conn({ interlockScore: 10, communityControlled: true });
    const hub = conn({ interlockScore: 500, communityControlled: false });
    expect(rankConnector(community)).toBeGreaterThan(rankConnector(hub));
  });

  it('falls back to raw interlock score when nothing else distinguishes', () => {
    expect(rankConnector(conn({ interlockScore: 200 }))).toBeGreaterThan(
      rankConnector(conn({ interlockScore: 100 })),
    );
  });
});

describe('bestConnector', () => {
  it('returns null for no connectors', () => {
    expect(bestConnector([])).toBeNull();
  });

  it('picks the bridge even when listed after a stronger-looking hub', () => {
    const hub = conn({ person: 'Hub', interlockScore: 999 });
    const bridge = conn({ person: 'Bridge', interlockScore: 5, bridgesToGoods: 'Snow Foundation' });
    expect(bestConnector([hub, bridge])?.person).toBe('Bridge');
  });
});

describe('degreeForConnectors', () => {
  it('none when empty', () => {
    expect(degreeForConnectors([])).toBe('none');
  });
  it('second when any connector bridges to another Goods relationship', () => {
    expect(degreeForConnectors([conn(), conn({ bridgesToGoods: 'Paul Ramsay Fdn' })])).toBe('second');
  });
  it('board-level when connectors exist but none bridge', () => {
    expect(degreeForConnectors([conn(), conn()])).toBe('board-level');
  });
});

describe('openerRationale', () => {
  it('names the shared Goods org for a bridge', () => {
    expect(openerRationale(conn({ bridgesToGoods: 'Snow Foundation' }))).toBe(
      'also on a board with Snow Foundation',
    );
  });
  it('describes board reach for a plain connector', () => {
    expect(openerRationale(conn({ boardCount: 7, bridgesToGoods: null }))).toBe('director across 7 boards');
  });
  it('stays honest when the board count is thin', () => {
    expect(openerRationale(conn({ boardCount: 1, bridgesToGoods: null }))).toBe(
      'board-level contact at this org',
    );
  });
});

describe('toConnectionDoor', () => {
  it('maps a bridged target to a second-degree door with a bridge opener', () => {
    const d = toConnectionDoor(
      target({ connectors: [conn({ person: 'Nick', bridgesToGoods: 'Snow Foundation' })] }),
    );
    expect(d.degree).toBe('second');
    expect(d.degreeLabel).toBe('2nd · shared board');
    expect(d.opener).toEqual({ person: 'Nick', rationale: 'also on a board with Snow Foundation', isBridge: true });
    expect(d.connectorCount).toBe(1);
  });

  it('maps a connector-only target to a board-level door, opener not a bridge', () => {
    const d = toConnectionDoor(target({ connectors: [conn({ person: 'Alicia', boardCount: 14 })] }));
    expect(d.degree).toBe('board-level');
    expect(d.opener?.isBridge).toBe(false);
    expect(d.opener?.rationale).toBe('director across 14 boards');
  });

  it('maps a target with no connectors to none / null opener', () => {
    const d = toConnectionDoor(target({ connectors: [] }));
    expect(d.degree).toBe('none');
    expect(d.opener).toBeNull();
  });
});

describe('toConnectionDoors', () => {
  it('drops targets with no door, ranks bridges first, respects the cap', () => {
    const targets = [
      target({ relId: 'a', targetName: 'A', connectors: [] }), // dropped
      target({ relId: 'b', targetName: 'B', connectors: [conn(), conn()] }), // board-level, 2 connectors
      target({ relId: 'c', targetName: 'C', connectors: [conn({ bridgesToGoods: 'X' })] }), // bridge
      target({ relId: 'd', targetName: 'D', connectors: [conn()] }), // board-level, 1 connector
    ];
    const doors = toConnectionDoors(targets, 2);
    expect(doors).toHaveLength(2);
    expect(doors[0].relId).toBe('c'); // bridge first
    expect(doors[1].relId).toBe('b'); // then more connectors
  });

  it('is deterministic: ties break on target name', () => {
    const targets = [
      target({ relId: 'z', targetName: 'Zed', warmth: 10, connectors: [conn()] }),
      target({ relId: 'a', targetName: 'Aim', warmth: 10, connectors: [conn()] }),
    ];
    const doors = toConnectionDoors(targets);
    expect(doors.map((d) => d.targetName)).toEqual(['Aim', 'Zed']);
  });
});

describe('summarizeConnections', () => {
  it('counts bridges and board-level doors across all targets', () => {
    const targets = [
      target({ connectors: [conn({ bridgesToGoods: 'X' })] }),
      target({ connectors: [conn()] }),
      target({ connectors: [conn()] }),
      target({ connectors: [] }),
    ];
    expect(summarizeConnections(targets)).toEqual({ bridges: 1, boardLevelDoors: 2, totalDoors: 3 });
  });
});

describe('board member degree (co-owners are first degree, never scored)', () => {
  it('is a static first-degree label, not derived from any graph', () => {
    expect(BOARD_MEMBER_DEGREE.degree).toBe('first');
    expect(degreeLabel('first')).toBe('1st · board');
    expect(BOARD_MEMBER_DEGREE.opener).toBe('Direct (governs Goods)');
  });
});
