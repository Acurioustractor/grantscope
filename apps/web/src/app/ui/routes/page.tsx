import type { Metadata } from 'next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { scanRoutes, type DesignSystem, type RouteInfo } from './route-scan';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Routes — CivicGraph' };

/**
 * Every route in the app, which design system it renders in, and a live thumbnail.
 *
 * Scanned from the filesystem on each request, so it cannot drift: add a page and it appears
 * here; move a page into a new scope and its badge changes. Thumbnails are iframes inside
 * <details>, so a section costs nothing until it is opened — 300 eager iframes would be
 * unusable.
 */

const SYSTEM_LABEL: Record<DesignSystem, string> = {
  ui: 'shadcn',
  shell: 'softened shell',
  'act-workspace': 'quiet ledger',
  'clarity-dark': 'clarity dark',
  public: 'bauhaus',
};

const SYSTEM_STYLE: Record<DesignSystem, string> = {
  ui: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-900',
  shell: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-900',
  'act-workspace': 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  'clarity-dark': 'bg-zinc-900 text-zinc-100 border-zinc-700',
  public: 'bg-zinc-100 text-zinc-700 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-200 dark:border-zinc-700',
};

function Thumb({ route }: { route: string }) {
  // Parameterised routes cannot be previewed without inventing an id — say so rather than
  // rendering a 404 thumbnail and letting it read as a broken page.
  if (route.includes('[')) {
    return (
      <div className="text-muted-foreground bg-muted/40 flex h-[150px] items-center justify-center rounded-md border p-3 text-center text-xs">
        Dynamic route — needs a real id to preview
      </div>
    );
  }
  return (
    <div className="bg-muted/40 h-[150px] overflow-hidden rounded-md border">
      <iframe
        src={route}
        title={route}
        loading="lazy"
        className="h-[600px] w-[1200px] origin-top-left border-0"
        style={{ transform: 'scale(0.25)' }}
      />
    </div>
  );
}

export default function RoutesPage() {
  const routes = scanRoutes();
  const bySection = new Map<string, RouteInfo[]>();
  for (const r of routes) {
    const list = bySection.get(r.section) ?? [];
    list.push(r);
    bySection.set(r.section, list);
  }
  const sections = [...bySection.entries()].sort((a, b) => b[1].length - a[1].length);

  const count = (s: DesignSystem) => routes.filter((r) => r.system === s).length;
  const mixed = routes.filter((r) => r.vocab.length > 1).length;

  return (
    <div className="ui bg-background text-foreground min-h-screen p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-2">
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-widest">
            scanned from the filesystem · never hand-listed
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Routes</h1>
          <p className="text-muted-foreground max-w-prose text-sm">
            Every page in the app, which design system it renders in, and what it looks like.
            Add a route and it appears here on the next request.
          </p>
        </header>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { k: 'Routes', v: routes.length, s: 'excluding /api' },
            { k: 'shadcn', v: count('ui'), s: 'the new system' },
            { k: 'Bauhaus', v: count('public'), s: 'public pages' },
            { k: 'Quiet Ledger', v: count('act-workspace'), s: '/org/*' },
            { k: 'Softened shell', v: count('shell'), s: '/dashboard/*' },
            { k: 'Mixing', v: mixed, s: '2+ vocabularies' },
          ].map((s) => (
            <Card key={s.k}>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs">{s.k}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{s.v}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-[11px]">{s.s}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Separator />

        <div className="space-y-3">
          {sections.map(([section, rs]) => (
            <details key={section} className="bg-card rounded-xl border">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                <span className="font-medium">/{section === '(root)' ? '' : section}</span>
                <span className="text-muted-foreground text-sm tabular-nums">{rs.length}</span>
                <span className="flex flex-wrap gap-1">
                  {[...new Set(rs.map((r) => r.system))].map((s) => (
                    <Badge key={s} variant="outline" className={SYSTEM_STYLE[s]}>
                      {SYSTEM_LABEL[s]}
                    </Badge>
                  ))}
                </span>
                <span className="text-muted-foreground ml-auto text-xs">expand</span>
              </summary>
              <div className="grid gap-4 border-t p-4 sm:grid-cols-2 lg:grid-cols-3">
                {rs.map((r) => (
                  <div key={r.route} className="space-y-2">
                    <Thumb route={r.route} />
                    <div className="space-y-1">
                      <a href={r.route} className="block truncate font-mono text-xs hover:underline">
                        {r.route}
                      </a>
                      <div className="flex flex-wrap items-center gap-1">
                        <Badge variant="outline" className={SYSTEM_STYLE[r.system]}>
                          {SYSTEM_LABEL[r.system]}
                        </Badge>
                        {r.vocab.map((v) => (
                          <Badge key={v} variant="secondary" className="text-[10px]">
                            {v}
                          </Badge>
                        ))}
                        <span className="text-muted-foreground ml-auto font-mono text-[10px] tabular-nums">
                          {r.lines} ln
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
