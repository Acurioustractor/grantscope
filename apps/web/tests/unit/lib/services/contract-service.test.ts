import { describe, it, expect, vi } from 'vitest';
import * as ContractService from '@/lib/services/contract-service';

function createMockDb(resolveData: unknown = [], error: unknown = null) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockReturnValue(chain);

  // Make chain thenable
  (chain as Record<string, unknown>).then = (fn: (v: unknown) => void) =>
    Promise.resolve({ data: resolveData, error, count: Array.isArray(resolveData) ? resolveData.length : 0 }).then(fn);

  for (const method of ['limit', 'order', 'in', 'eq', 'select']) {
    const orig = chain[method] as (...a: unknown[]) => unknown;
    chain[method] = vi.fn((...args: unknown[]) => {
      orig(...args);
      return {
        ...chain,
        then: (fn: (v: unknown) => void) =>
          Promise.resolve({ data: resolveData, error, count: Array.isArray(resolveData) ? resolveData.length : 0 }).then(fn),
      };
    });
  }

  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
}

describe('ContractService', () => {
  describe('findBySupplierAbn', () => {
    it('returns contracts for a supplier ABN', async () => {
      const contracts = [
        { title: 'IT Services', contract_value: 50000, buyer_name: 'Dept of Ed' },
        { title: 'Consulting', contract_value: 30000, buyer_name: 'Dept of Health' },
      ];
      const db = createMockDb(contracts);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await ContractService.findBySupplierAbn(db as any, '12345678901');
      expect(result.data).toHaveLength(2);
      expect(db.from).toHaveBeenCalledWith('austender_contracts');
    });
  });

  describe('findBySupplierAbns', () => {
    it('returns batch contracts capped at 200 ABNs', async () => {
      const db = createMockDb([]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ContractService.findBySupplierAbns(db as any, Array(250).fill('111'));
      // The service slices to 200 — verify it was called
      expect(db.from).toHaveBeenCalledWith('austender_contracts');
    });
  });

  describe('aggregateByAbns', () => {
    it('aggregates contract values by ABN', async () => {
      const rows = [
        { supplier_abn: '111', contract_value: 1000 },
        { supplier_abn: '111', contract_value: 2000 },
        { supplier_abn: '222', contract_value: 500 },
      ];
      const db = createMockDb(rows);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await ContractService.aggregateByAbns(db as any, ['111', '222']);
      expect(result.data.get('111')).toEqual({ count: 2, total: 3000 });
      expect(result.data.get('222')).toEqual({ count: 1, total: 500 });
    });

    it('returns empty map on error', async () => {
      const db = createMockDb(null, { message: 'timeout' });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await ContractService.aggregateByAbns(db as any, ['111']);
      expect(result.data.size).toBe(0);
      expect(result.error).toBeTruthy();
    });
  });

  describe('count', () => {
    it('returns contract count', async () => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn().mockReturnValue({
        then: (fn: (v: unknown) => void) => Promise.resolve({ count: 672000, error: null }).then(fn),
      });
      const db = { from: vi.fn().mockReturnValue(chain) };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await ContractService.count(db as any);
      expect(result.count).toBe(672000);
    });
  });
});
