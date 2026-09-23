import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * ONE public frame (DESIGN.md, 2026-09-24). A visitor sees the root layout's top nav and footer on
 * every public page; the black rail (<Shell>) is for signed-in work only. Until that date the nav's
 * "Funding" link dropped visitors into the rail app, because /grants and six siblings were listed as
 * chromeless and wrapped themselves in <Shell>. These two checks stop that coming back.
 */
const SRC = join(process.cwd(), 'src');

/** Route folders whose pages are signed-in work and may use the rail. */
const RAIL_ALLOWED = [
  'app/dashboard/', 'app/clarity/', 'app/ops/', 'app/admin/', 'app/tracker/', 'app/alerts/',
  'app/foundations/tracker/',
];

/** Public route prefixes that must render inside the root layout's nav and footer. */
const PUBLIC_PREFIXES = [
  '/grants', '/foundations', '/charities', '/social-enterprises', '/allocation', '/search',
  '/entities', '/entity', '/person', '/reports', '/power', '/places', '/graph',
];

function files(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('one public frame', () => {
  it('only signed-in routes import the rail shell', () => {
    const offenders = files(join(SRC, 'app'))
      .filter((f) => readFileSync(f, 'utf8').includes("from '@/components/shell/shell'"))
      .map((f) => relative(SRC, f))
      .filter((f) => !RAIL_ALLOWED.some((prefix) => f.startsWith(prefix)));
    expect(
      offenders,
      'These public pages wrap themselves in <Shell>, the signed-in rail. Use <BrowseScope>\n' +
        '(components/shell/browse-scope.tsx) to keep the shell styles inside the public frame.\n\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });

  it('the root layout does not drop the top nav on a public route', () => {
    const layout = readFileSync(join(SRC, 'app/layout.tsx'), 'utf8');
    const start = layout.indexOf('const isChromeless =');
    expect(start, 'app/layout.tsx no longer defines isChromeless; update this test').toBeGreaterThan(-1);
    const expr = layout.slice(start, layout.indexOf(';', start));
    const listed = PUBLIC_PREFIXES.filter((p) => expr.includes(`'${p}'`) || expr.includes(`'${p}/'`));
    expect(
      listed,
      'app/layout.tsx makes these public routes chromeless, so visitors lose the top nav:\n' + listed.join('\n'),
    ).toEqual([]);
  });
});
