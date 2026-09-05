import { describe, expect, it } from 'vitest';
// The helper lives with the agents that call it; the test lives where the gate looks (apps/web/vitest.config.ts only
// collects tests under apps/web). Same arrangement as palette-ratchet.test.ts.
import { dedupeGrantRows, upsertGrantOpportunities } from '../../../../scripts/lib/upsert-grant-opportunities.mjs';

type Row = Record<string, unknown>;

/**
 * Stands in for the grant_opportunities table: `existing` seeds it, selects answer the helper's lookups, and upserts
 * record what was written and with which conflict key.
 */
function fakeTable(existing: Row[] = [], failOn: (rows: Row[]) => string | null = () => null) {
  const writes: Array<{ rows: Row[]; onConflict: string }> = [];
  const api = {
    writes,
    from() {
      const state: { column?: string; values?: unknown[]; source?: unknown; sourceIsNull?: boolean } = {};
      const builder: Record<string, unknown> = {
        select() { return builder; },
        in(column: string, values: unknown[]) { state.column = column; state.values = values; return builder; },
        eq(_c: string, value: unknown) { state.source = value; return builder; },
        is(_c: string, _v: null) { state.sourceIsNull = true; return builder; },
        upsert(rows: Row[], opts: { onConflict: string }) {
          writes.push({ rows, onConflict: opts.onConflict });
          const message = failOn(rows);
          return Promise.resolve({ error: message ? { message } : null });
        },
        then(resolve: (v: { data: Row[]; error: null }) => unknown) {
          const rows = existing.filter((r) => {
            if (!state.column || !state.values?.includes(r[state.column])) return false;
            if (state.sourceIsNull) return r.source == null;
            if (state.source !== undefined) return r.source === state.source;
            return true;
          });
          return Promise.resolve(resolve({ data: rows, error: null }));
        },
      };
      return builder;
    },
  };
  return api;
}

describe('dedupeGrantRows', () => {
  it('keeps the last row for a repeated url, because a later row is the fresher scrape', () => {
    const { rows, dropped } = dedupeGrantRows([
      { url: 'https://x/a', name: 'Old name', source: 's' },
      { url: 'https://x/a', name: 'New name', source: 's' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('New name');
    expect(dropped).toBe(1);
  });

  it('falls back to source and name when a row has no url', () => {
    const { rows } = dedupeGrantRows([
      { name: 'A', source: 's' },
      { name: 'A', source: 's' },
      { name: 'A', source: 'other' },
    ]);
    expect(rows).toHaveLength(2);
  });

  it('treats a blank or whitespace url as absent', () => {
    const { rows } = dedupeGrantRows([{ url: '   ', name: 'A', source: 's' }]);
    expect(rows[0].url).toBeNull();
  });
});

describe('upsertGrantOpportunities', () => {
  it('updates by id when the url already exists under a different source label', async () => {
    // The exact shape that failed 51 VIC runs: same URL, older source label.
    const sb = fakeTable([{ id: 'row-1', url: 'https://x/a', source: 'old label', name: 'Grant A' }]);
    const res = await upsertGrantOpportunities(sb, [{ url: 'https://x/a', source: 'vic-grants-gateway', name: 'Grant A' }]);
    expect(res.written).toBe(1);
    expect(res.failed).toBe(0);
    const write = sb.writes.at(-1)!;
    expect(write.onConflict).toBe('id');
    expect(write.rows[0].id).toBe('row-1');
    expect(write.rows[0].source).toBe('vic-grants-gateway');
  });

  it('updates by id when the name is taken and the url is new', async () => {
    // The mirror-image failure that switching the conflict key to url exposed.
    const sb = fakeTable([{ id: 'row-2', url: 'https://x/old', source: 's', name: 'Grant B' }]);
    const res = await upsertGrantOpportunities(sb, [{ url: 'https://x/new', source: 's', name: 'Grant B' }]);
    expect(res.written).toBe(1);
    expect(sb.writes.at(-1)!.rows[0].id).toBe('row-2');
  });

  it('inserts a genuinely new round', async () => {
    const sb = fakeTable([]);
    const res = await upsertGrantOpportunities(sb, [{ url: 'https://x/new', source: 's', name: 'New' }]);
    expect(res.written).toBe(1);
    expect(sb.writes.at(-1)!.onConflict).toBe('url');
  });

  it('skips and reports a row that resolves to two different existing rows', async () => {
    const sb = fakeTable([
      { id: 'row-a', url: 'https://x/a', source: 's', name: 'Old name' },
      { id: 'row-b', url: 'https://x/b', source: 's', name: 'Taken name' },
    ]);
    const res = await upsertGrantOpportunities(sb, [{ url: 'https://x/a', source: 's', name: 'Taken name' }]);
    expect(res.ambiguous).toBe(1);
    expect(res.written).toBe(0);
    expect(res.errors[0]).toContain('same round');
  });

  it('retries a failed chunk row by row, so one bad row does not cost the whole run', async () => {
    const sb = fakeTable([], (rows) => (rows.some((r) => r.name === 'bad') ? 'duplicate key value violates unique constraint' : null));
    const res = await upsertGrantOpportunities(sb, [
      { url: 'https://x/a', name: 'good', source: 's' },
      { url: 'https://x/b', name: 'bad', source: 's' },
    ]);
    expect(res.written).toBe(1);
    expect(res.failed).toBe(1);
  });
});
