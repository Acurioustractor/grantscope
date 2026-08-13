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
  abn: null,
  entity_type: 'organisation',
  sector: null,
  state: null,
  postcode: null,
  remoteness: null,
  seifa_irsd_decile: null,
  is_community_controlled: false,
  lga_name: null,
};

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
    return Promise.resolve({ data: null, error: null });
  }

  then<TResult1 = { data: unknown; error: unknown; count?: number }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: unknown; count?: number }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    const data = this.table === 'gs_entities' ? [entity] : [];
    return Promise.resolve({ data, error: null, count: 0 }).then(onfulfilled, onrejected);
  }
}

describe('assembleDueDiligencePack', () => {
  const calls: string[] = [];

  beforeEach(() => {
    calls.length = 0;
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
});
