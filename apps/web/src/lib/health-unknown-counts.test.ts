import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Admin audit A13. `safe()` in the ops health route returns `{ count: null }` when a query exceeds
 * its timeout. Every consumer used to write `count ?? 0`, so a question we FAILED TO ASK rendered
 * as a confident measurement of zero: /ops/health displayed "HAVE WEBSITE 0" while the table held
 * 5,903 rows, purely because the shared pooler was busy.
 *
 * That is the worst failure mode available to a data-health screen, and it is invisible — no error,
 * no warning, just a wrong number that looks right. These tests guard the shape of the fix rather
 * than the rendering, because the bug was never a rendering bug.
 */

const root = join(__dirname, '..');
const routeRaw = readFileSync(join(root, 'app/api/ops/health/route.ts'), 'utf8');
/** Strip comments before scanning: the fix's own explanatory comment quotes the defect verbatim,
 *  and a test that cannot tell code from prose about code is worse than no test. */
const route = routeRaw
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((line) => !line.trim().startsWith('//'))
  .join('\n');
const client = readFileSync(join(root, 'app/ops/health/health-client.tsx'), 'utf8');

describe('ops health: unknown counts stay unknown', () => {
  it('never coerces a timed-out count to zero in the API', () => {
    // `count ?? 0` is the exact defect. If it comes back, a timeout starts lying again.
    const offenders = route.match(/count \?\? 0/g) ?? [];
    expect(offenders).toHaveLength(0);
  });

  it('passes null through for every count that can time out', () => {
    for (const field of [
      'withDescription',
      'enriched',
      'embedded',
      'open',
      'profiled',
      'withWebsite',
    ]) {
      expect(route).toMatch(new RegExp(`${field}: \\w+\\.count \\?\\? null`));
    }
  });

  it('types those counts as nullable, so a future ?? 0 fails the typecheck', () => {
    expect(client).toMatch(/withWebsite: number \| null/);
    expect(client).toMatch(/profiled: number \| null/);
    expect(client).toMatch(/embedded: number \| null/);
  });

  it('renders unknown as not-measured rather than as a number', () => {
    expect(client).toContain('not measured — query timed out');
  });

  it('admits when the composite score was built on unmeasured inputs', () => {
    expect(client).toContain('function unmeasuredInputs');
    expect(client).toMatch(/Partial score/);
  });
});
