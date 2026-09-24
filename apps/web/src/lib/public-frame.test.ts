import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ACT_WORKSPACE_PREFIXES, OWN_FRAME_PREFIXES, SIGNED_IN_PREFIXES, isChromelessPath, isUnder } from './public-frame';

/**
 * ONE public frame (DESIGN.md, 2026-09-24). A visitor sees the root layout's top nav and footer on
 * every public page; the black rail (<Shell>) is for signed-in work only. Until that date the nav's
 * "Funding" link dropped visitors into the rail app, because /grants and six siblings were listed as
 * chromeless and wrapped themselves in <Shell>. These checks stop that coming back.
 *
 * They read the same lists the layout does (lib/public-frame.ts). The first version kept its own
 * copy of the signed-in routes and searched the layout's source text for route strings, so it
 * could not see /pricing, /changes, /feedback, /get-a-report or /account losing the nav.
 */
const SRC = join(process.cwd(), 'src');

/** Public routes a visitor reaches from the nav, the footer, search or a shared link. */
const PUBLIC_PATHS = [
  '/', '/grants', '/grants/some-grant', '/foundations', '/foundations/some-id', '/charities',
  '/charities/12345678901', '/social-enterprises', '/allocation', '/search', '/entities/GS-1',
  '/entity/GS-1', '/person/Jane%20Citizen', '/reports', '/reports/youth-justice', '/power',
  '/places/0870', '/graph', '/about', '/pricing', '/changes', '/feedback', '/get-a-report',
  '/account', '/procurement', '/giving', '/support',
];

function files(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files(full, out);
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** 'app/foundations/(browse)/tracker/page.tsx' -> '/foundations/tracker/page.tsx' */
function routeOf(rel: string): string {
  return rel.replace(/^app/, '').replace(/\/\([^)]+\)/g, '');
}

describe('one public frame', () => {
  it('keeps every public route in the frame', () => {
    expect(PUBLIC_PATHS.filter(isChromelessPath), 'These public routes render without the top nav').toEqual([]);
  });

  it('takes signed-in work, embeds, share pages and the ACT workspace out of it', () => {
    const outside = [...SIGNED_IN_PREFIXES, ...OWN_FRAME_PREFIXES, ...ACT_WORKSPACE_PREFIXES];
    expect(outside.filter((p) => !isChromelessPath(p) || !isChromelessPath(`${p}/x`))).toEqual([]);
    // A sibling that shares the letters is a different route.
    expect(['/shareholders', '/trackers', '/org/actions'].filter(isChromelessPath)).toEqual([]);
  });

  it('only signed-in routes use the rail shell', () => {
    // Any string naming the module, so a relative path or a dynamic import counts too.
    const shell = /['"][^'"]*components\/shell\/shell['"]/;
    const offenders = files(join(SRC, 'app'))
      .map((f) => relative(SRC, f))
      .filter((rel) => shell.test(readFileSync(join(SRC, rel), 'utf8')))
      .filter((rel) => !SIGNED_IN_PREFIXES.some((p) => isUnder(routeOf(rel), p)));
    expect(
      offenders,
      'These public pages wrap themselves in <Shell>, the signed-in rail. Use <BrowseScope>\n' +
        '(components/shell/browse-scope.tsx) to keep the shell styles inside the public frame.\n\n' +
        offenders.join('\n'),
    ).toEqual([]);
  });

  it('the root layout decides with isChromelessPath and nothing else', () => {
    // Exact, semicolon included: an `|| pathname.startsWith(...)` tacked on would drift from the lists.
    const layout = readFileSync(join(SRC, 'app/layout.tsx'), 'utf8');
    expect(layout.match(/const isChromeless = [^;]*;/g)).toEqual(['const isChromeless = isChromelessPath(pathname);']);
  });

  it('no public layout brings its own <main> or footer', () => {
    const offenders = files(join(SRC, 'app'))
      .map((f) => relative(SRC, f))
      .filter((rel) => rel.endsWith('/layout.tsx') && rel !== 'app/layout.tsx')
      .filter((rel) => !isChromelessPath(routeOf(rel).replace(/\/layout\.tsx$/, '')))
      .filter((rel) => /<(main|footer)[\s>]/.test(readFileSync(join(SRC, rel), 'utf8')));
    expect(offenders, 'The root layout already renders <main> and the footer').toEqual([]);
  });
});
