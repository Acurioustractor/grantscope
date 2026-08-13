import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getServiceSupabase } from '@/lib/supabase';
import { assembleDueDiligencePack } from './due-diligence-service';

vi.mock('@/lib/supabase', () => ({
  getServiceSupabase: vi.fn(),
}));

const entity = {
  id: 'entity-without-stats',
  gs_id: 'AU-ABN-00000000000',
  canonical_name: 'Entity Without Stats',
  abn: '00000000000',
  entity_type: 'organisation',
  sector: null,
  state: null,
  postcode: '2000',
  remoteness: null,
  seifa_irsd_decile: null,
  is_community_controlled: false,
  lga_name: null,
};

let entityQueryError: unknown = null;
let activeQueries = 0;
let maxConcurrentQueries = 0;

class QueryBuilder implements PromiseLike<{ data: unknown; error: unknown; count?: number }> {
  constructor(
    private readonly table: string,
    private readonly calls: string[],
  ) {}

  select() { return this; }
  eq() { return this; }
  neq() { return this; }
  order() { return this; }
  limit() { return this; }
  in() { return this; }

  single() {
    this.calls.push(`${this.table}.single`);
    if (this.table === 'gs_entities') return Promise.resolve({ data: entity, error: null });
    if (this.table === 'mv_gs_entity_stats') {
      return Promise.resolve({ data: null, error: { message: 'Cannot coerce the result to a single JSON object' } });
    }
    return Promise.resolve({ data: null, error: null });
  }

  maybeSingle() {
    this.calls.push(`${this.table}.maybeSingle`);
    if (this.table === 'gs_entities') {
      return Promise.resolve({
        data: entityQueryError ? null : entity,
        error: entityQueryError,
      });
    }
    return Promise.resolve({ data: null, error: null });
  }

  then<TResult1 = { data: unknown; error: unknown; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const data = this.table === 'gs_entities' ? [entity] : [];
    activeQueries += 1;
    maxConcurrentQueries = Math.max(maxConcurrentQueries, activeQueries);
    return new Promise<{ data: unknown; error: unknown; count?: number }>((resolve) => {
      setTimeout(() => {
        activeQueries -= 1;
        resolve({ data, error: null, count: 0 });
      }, 0);
    }).then(onfulfilled, onrejected);
  }
}

describe('assembleDueDiligencePack', () => {
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
    entityQueryError = null;
    activeQueries = 0;
    maxConcurrentQueries = 0;
    vi.mocked(getServiceSupabase).mockReturnValue({
      from: (table: string) => new QueryBuilder(table, calls),
    } as never);
  });

  it('treats a missing optional entity stats row as an empty state', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const pack = await assembleDueDiligencePack(entity.gs_id);

    expect(pack?.stats).toBeNull();
    expect(calls).toContain('mv_gs_entity_stats.maybeSingle');
    expect(calls).not.toContain('mv_gs_entity_stats.single');
    expect(consoleError).not.toHaveBeenCalled();

    consoleError.mockRestore();
  });

  it('coalesces overlapping requests for the same entity', async () => {
    const gsId = 'AU-ABN-11111111111';

    const [first, second] = await Promise.all([
      assembleDueDiligencePack(gsId),
      assembleDueDiligencePack(gsId),
    ]);

    expect(first).toBe(second);
    expect(calls.filter((call) => call === 'gs_entities.maybeSingle')).toHaveLength(1);
  });

  it('does not turn a transient entity query failure into not found', async () => {
    const error = { message: 'Supabase request budget exhausted' };
    entityQueryError = error;

    await expect(assembleDueDiligencePack('AU-ABN-22222222222')).rejects.toBe(error);
  });

  it('limits optional source queries to three concurrent requests', async () => {
    await assembleDueDiligencePack('AU-ABN-33333333333');

    expect(maxConcurrentQueries).toBeLessThanOrEqual(3);
  });
});
