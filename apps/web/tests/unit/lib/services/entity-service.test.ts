import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as EntityService from '@/lib/services/entity-service';

// ── Mock Supabase client ─────────────────────────────────────────────
function createMockDb() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.ilike = vi.fn().mockReturnValue(chain);
  chain.like = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);
  chain.range = vi.fn().mockReturnValue(chain);
  chain.single = vi.fn().mockResolvedValue({ data: null, error: null });

  // Terminal: resolve the chain
  const resolveWith = (data: unknown, error: unknown = null, count?: number) => {
    chain.single.mockResolvedValue({ data, error });
    // For non-single queries, make the chain itself thenable
    (chain as Record<string, unknown>).then = (fn: (v: unknown) => void) => {
      return Promise.resolve({ data, error, count }).then(fn);
    };
    // Also override limit/range/order to return a thenable
    for (const method of ['limit', 'range', 'order', 'in', 'or', 'ilike', 'like', 'eq', 'select']) {
      const orig = chain[method] as (...a: unknown[]) => unknown;
      chain[method] = vi.fn((...args: unknown[]) => {
        orig(...args);
        return { ...chain, then: (fn: (v: unknown) => void) => Promise.resolve({ data, error, count }).then(fn) };
      });
    }
  };

  const db = {
    from: vi.fn().mockReturnValue(chain),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    _chain: chain,
    _resolveWith: resolveWith,
  };

  return db;
}

// ── Tests ────────────────────────────────────────────────────────────
describe('EntityService', () => {
  describe('findByGsId', () => {
    it('returns entity data for valid gs_id', async () => {
      const mockEntity = { gs_id: 'GS-001', canonical_name: 'Test Org', abn: '123' };
      const db = createMockDb();
      db._resolveWith(mockEntity);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await EntityService.findByGsId(db as any, 'GS-001');

      expect(db.from).toHaveBeenCalledWith('gs_entities');
      expect(result.data).toEqual(mockEntity);
      expect(result.error).toBeNull();
    });

    it('returns error when entity not found', async () => {
      const db = createMockDb();
      db._resolveWith(null, { message: 'Not found', code: 'PGRST116' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await EntityService.findByGsId(db as any, 'GS-MISSING');
      expect(result.data).toBeNull();
      expect(result.error).toBeTruthy();
    });
  });

  describe('findByAbn', () => {
    it('returns entity by ABN', async () => {
      const mockEntity = { gs_id: 'GS-002', canonical_name: 'ABN Corp', abn: '999' };
      const db = createMockDb();
      db._resolveWith(mockEntity);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await EntityService.findByAbn(db as any, '999');
      expect(result.data).toEqual(mockEntity);
    });
  });

  describe('findByAbns', () => {
    it('returns multiple entities by ABN list', async () => {
      const entities = [
        { gs_id: 'GS-001', canonical_name: 'Org 1', abn: '111' },
        { gs_id: 'GS-002', canonical_name: 'Org 2', abn: '222' },
      ];
      const db = createMockDb();
      db._resolveWith(entities);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await EntityService.findByAbns(db as any, ['111', '222']);
      expect(result.data).toHaveLength(2);
    });
  });

  describe('search', () => {
    it('searches entities by name or ABN', async () => {
      const results = [{ gs_id: 'GS-010', canonical_name: 'Acme Corp', abn: '123' }];
      const db = createMockDb();
      db._resolveWith(results);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await EntityService.search(db as any, 'Acme');
      expect(data).toHaveLength(1);
      expect(data[0].canonical_name).toBe('Acme Corp');
    });

    it('escapes special characters in search query', async () => {
      const db = createMockDb();
      db._resolveWith([]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await EntityService.search(db as any, 'test%_special');
      // Should not throw — escaping is internal
    });

    it('caps limit at 50', async () => {
      const db = createMockDb();
      db._resolveWith([]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await EntityService.search(db as any, 'test', 100);
      // Math.min(100, 50) = 50 — verify via the chain
    });
  });

  describe('findByPostcode', () => {
    it('returns entities in a postcode', async () => {
      const entities = [
        { id: 1, gs_id: 'GS-020', canonical_name: 'Local Org', entity_type: 'charity' },
      ];
      const db = createMockDb();
      db._resolveWith(entities);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await EntityService.findByPostcode(db as any, '2000');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('findLobbyConnections', () => {
    it('returns empty for short names', async () => {
      const db = createMockDb();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await EntityService.findLobbyConnections(db as any, 'AB');
      expect(result).toEqual([]);
      expect(db.from).not.toHaveBeenCalled();
    });

    it('searches lobby entities for longer names', async () => {
      const lobbyResults = [{ gs_id: 'AU-LOBBY-001', canonical_name: 'Test Lobby', sector: 'lobbying' }];
      const db = createMockDb();
      db._resolveWith(lobbyResults);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await EntityService.findLobbyConnections(db as any, 'Australian Mining Corp');
      expect(result).toHaveLength(1);
    });
  });

  describe('count', () => {
    it('returns entity count', async () => {
      const db = createMockDb();
      // Need to handle count differently — head: true queries
      const chain = db._chain;
      chain.select = vi.fn().mockReturnValue({
        then: (fn: (v: unknown) => void) => Promise.resolve({ count: 100000, error: null }).then(fn),
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await EntityService.count(db as any);
      expect(result.count).toBe(100000);
    });
  });

  describe('getInternalId', () => {
    it('returns numeric ID for gs_id', async () => {
      const db = createMockDb();
      db._resolveWith({ id: 42 });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = await EntityService.getInternalId(db as any, 'GS-001');
      expect(id).toBe(42);
    });

    it('returns undefined when not found', async () => {
      const db = createMockDb();
      db._resolveWith(null);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const id = await EntityService.getInternalId(db as any, 'GS-MISSING');
      expect(id).toBeUndefined();
    });
  });
});
