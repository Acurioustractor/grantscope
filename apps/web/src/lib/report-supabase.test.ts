import { afterEach, describe, expect, it } from 'vitest';
import { liveReportsEnabled } from './report-supabase';

const ORIGINAL = process.env.CIVICGRAPH_LIVE_REPORTS;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CIVICGRAPH_LIVE_REPORTS;
  else process.env.CIVICGRAPH_LIVE_REPORTS = ORIGINAL;
});

describe('liveReportsEnabled — the flag that silently blanked 61 public pages', () => {
  it('accepts the exact string', () => {
    process.env.CIVICGRAPH_LIVE_REPORTS = 'true';
    expect(liveReportsEnabled()).toBe(true);
  });

  it("accepts production's actual stored value, which has a trailing newline", () => {
    // This is not hypothetical. `vercel env pull --environment=production` on 2026-08-20 returned
    // CIVICGRAPH_LIVE_REPORTS="true\n". Under the old strict `=== 'true'` this returned false and
    // every report page fell through to the empty-result client with no error raised anywhere.
    process.env.CIVICGRAPH_LIVE_REPORTS = 'true\n';
    expect(liveReportsEnabled()).toBe(true);
  });

  it('tolerates surrounding whitespace generally', () => {
    for (const v of [' true', 'true ', '\ttrue\r\n']) {
      process.env.CIVICGRAPH_LIVE_REPORTS = v;
      expect(liveReportsEnabled()).toBe(true);
    }
  });

  it('stays off for anything that is not true', () => {
    for (const v of ['false', '1', 'yes', 'TRUE', '']) {
      process.env.CIVICGRAPH_LIVE_REPORTS = v;
      expect(liveReportsEnabled()).toBe(false);
    }
  });

  it('stays off when unset', () => {
    delete process.env.CIVICGRAPH_LIVE_REPORTS;
    expect(liveReportsEnabled()).toBe(false);
  });
});
