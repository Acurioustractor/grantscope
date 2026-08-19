import fs from 'node:fs';
import path from 'node:path';

/**
 * The route map is SCANNED, never hand-listed. A hand-maintained index of 302 routes is a
 * document that starts lying the first time someone adds a page — which is precisely how
 * DESIGN.md ended up describing a system the code had moved off.
 */

export type DesignSystem = 'ui' | 'shell' | 'act-workspace' | 'clarity-dark' | 'public';

export interface RouteInfo {
  route: string;
  file: string;
  system: DesignSystem;
  vocab: string[];
  lines: number;
  section: string;
}

/** Which wrapper scope a route renders inside, decided by its path prefix. */
const SCOPES: [string, DesignSystem][] = [
  ['/ui', 'ui'],
  ['/dashboard', 'shell'],
  ['/clarity', 'clarity-dark'],
  ['/org', 'act-workspace'],
];

const TAILWIND_DEFAULT =
  /\b(?:text|bg|border|ring|from|to|via)-(?:gray|slate|zinc|neutral|stone|amber|teal|purple|emerald|indigo|violet|sky|rose|lime|cyan|fuchsia)-\d{2,3}\b/;

function detectVocab(src: string): string[] {
  const v: string[] = [];
  if (/\bbauhaus-/.test(src)) v.push('bauhaus');
  if (/\bshell-|--shell/.test(src)) v.push('shell');
  if (/\bql-/.test(src)) v.push('quiet-ledger');
  if (/\bws-/.test(src)) v.push('workspace');
  if (/--cd-|clarity-dark/.test(src)) v.push('clarity-dark');
  if (/@\/components\/ui\//.test(src)) v.push('shadcn');
  if (TAILWIND_DEFAULT.test(src)) v.push('tailwind-default');
  return v;
}

export function scanRoutes(): RouteInfo[] {
  const appDir = path.join(process.cwd(), 'src', 'app');
  const out: RouteInfo[] = [];

  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && e.name === 'page.tsx')) {
      const rel = path.relative(appDir, dir).split(path.sep).join('/');
      const route = '/' + rel;
      if (!route.startsWith('/api')) {
        const file = path.join(dir, 'page.tsx');
        let src = '';
        try {
          src = fs.readFileSync(file, 'utf8');
        } catch {
          /* unreadable — still list the route */
        }
        const system = SCOPES.find(([p]) => route === p || route.startsWith(p + '/'))?.[1] ?? 'public';
        out.push({
          route: route === '/' ? '/' : route,
          file: 'src/app/' + rel + '/page.tsx',
          system,
          vocab: detectVocab(src),
          lines: src ? src.split('\n').length : 0,
          section: rel === '' ? '(root)' : rel.split('/')[0],
        });
      }
    }
    for (const e of entries) {
      if (e.isDirectory() && e.name !== 'api' && !e.name.startsWith('_')) walk(path.join(dir, e.name));
    }
  };

  walk(appDir);
  // the root page lives directly in app/
  if (fs.existsSync(path.join(appDir, 'page.tsx')) && !out.some((r) => r.route === '/')) {
    const src = fs.readFileSync(path.join(appDir, 'page.tsx'), 'utf8');
    out.unshift({
      route: '/',
      file: 'src/app/page.tsx',
      system: 'public',
      vocab: detectVocab(src),
      lines: src.split('\n').length,
      section: '(root)',
    });
  }
  return out.sort((a, b) => a.route.localeCompare(b.route));
}
