/**
 * The consequence layer (Ben, 2026-08-17: "still confused how we use all of this to know what's
 * healthy, what's not, and what it influences on the screen").
 *
 * Health without consequence is just more list. This module composes the three facts the
 * catalogue already holds — which app files read which object (scanner), which route a file
 * belongs to, and each object's measured signals — into the answer a person actually wants:
 * per SCREEN, what feeds it and whether that is healthy; per PROBLEM, which screens it touches.
 *
 * Verdicts are derived, thresholds stated, and quiet-by-nature reference data (a 2021 census
 * table) is described as quiet, never called stale-red: staleness only alarms when the object's
 * own freshness probe says it should move.
 */

export interface HealthObject {
  key: string;
  name: string;
  purpose: string | null;
  rowCount: number | null;
  lastWrite: string | null; // yyyy-mm-dd
  orphan: boolean; // confirmed finding
  joinGap: boolean; // confirmed finding
  withheld: boolean; // consent floor
}

export interface SurfaceHealth {
  surface: string;
  label: string;
  family: 'public' | 'shell';
  objectCount: number;
  oldestWrite: { key: string; date: string } | null;
  problems: string[]; // plain sentences
  ok: boolean;
}

/** Route families and plain names for the screens people actually use. Order = display order. */
export const SURFACE_LABELS: [string, string, 'public' | 'shell'][] = [
  ['/', 'The public front page', 'public'],
  ['/reports', 'Public reports', 'public'],
  ['/entity', 'Organisation pages', 'public'],
  ['/person', 'People pages', 'public'],
  ['/places', 'Place pages', 'public'],
  ['/power', 'The power page', 'public'],
  ['/foundations', 'Foundations explorer', 'public'],
  ['/social-enterprises', 'The SE registry', 'public'],
  ['/graph', 'The network graph', 'public'],
  ['/atlas', 'The Atlas', 'public'],
  ['/procurement', 'Procurement tools', 'public'],
  ['/grants', 'Grant search', 'public'],
  ['/dashboard', 'The dashboard', 'shell'],
  ['/search', 'Search', 'shell'],
  ['/tracker', 'Grant tracker', 'shell'],
  ['/alerts', 'Alerts', 'shell'],
  ['/ops/health', 'Data health (ops)', 'shell'],
];

export function routeOfFile(filePath: string): string | null {
  if (!filePath.startsWith('apps/web/src/app/')) return null;
  const rel = filePath.slice('apps/web/src/app/'.length);
  const dir = rel
    .split('/')
    .slice(0, -1)
    .filter((seg) => !seg.startsWith('('));
  if (dir[0] === 'api') return null;
  return '/' + dir.join('/');
}

export function surfaceOfRoute(route: string): string | null {
  for (const [prefix] of SURFACE_LABELS) {
    if (prefix === '/') {
      if (route === '/') return '/';
      continue;
    }
    if (route === prefix || route.startsWith(`${prefix}/`)) return prefix;
  }
  return null;
}

const STALE_DAYS = 90;

export function buildSurfaceHealth(
  refs: { object_key: string; file_path: string }[],
  objects: Map<string, HealthObject>,
  now: Date,
): SurfaceHealth[] {
  const bySurface = new Map<string, Set<string>>();
  for (const r of refs) {
    const route = routeOfFile(r.file_path);
    if (!route) continue;
    const s = surfaceOfRoute(route);
    if (!s) continue;
    if (!bySurface.has(s)) bySurface.set(s, new Set());
    bySurface.get(s)!.add(r.object_key);
  }

  const out: SurfaceHealth[] = [];
  for (const [prefix, label, family] of SURFACE_LABELS) {
    const keys = bySurface.get(prefix);
    if (!keys || keys.size === 0) continue;
    const deps = [...keys].map((k) => objects.get(k)).filter((o): o is HealthObject => !!o);

    let oldest: { key: string; date: string } | null = null;
    const problems: string[] = [];
    let staleCount = 0;
    let withheldCount = 0;

    for (const o of deps) {
      if (o.lastWrite) {
        if (!oldest || o.lastWrite < oldest.date) oldest = { key: o.name, date: o.lastWrite };
        const age = (now.getTime() - new Date(o.lastWrite).getTime()) / 86400000;
        if (age > STALE_DAYS && (o.rowCount ?? 0) > 0) staleCount += 1;
      }
      if (family === 'public' && o.withheld) withheldCount += 1;
    }
    if (staleCount > 0) {
      problems.push(
        `${staleCount} of its data sources have not been written to in ${STALE_DAYS}+ days — quiet, worth knowing, not automatically wrong`,
      );
    }
    if (withheldCount > 0) {
      problems.push(
        `${withheldCount} consent-governed object${withheldCount === 1 ? ' is' : 's are'} mentioned by this screen's code — reviewed on the Surfaces page`,
      );
    }

    out.push({
      surface: prefix,
      label,
      family,
      objectCount: deps.length,
      oldestWrite: oldest,
      problems,
      ok: problems.length === 0,
    });
  }
  return out;
}

export interface AttentionItem {
  severity: 'red' | 'amber';
  what: string; // the problem, plain words
  influences: string[]; // surface labels it touches
  href: string;
}

export function buildAttention(
  refs: { object_key: string; file_path: string }[],
  objects: Map<string, HealthObject>,
  surfaces: SurfaceHealth[],
  opsHealthBroken: boolean,
): AttentionItem[] {
  // object -> surfaces it feeds
  const feeds = new Map<string, Set<string>>();
  const labelOf = new Map(SURFACE_LABELS.map(([p, l]) => [p, l]));
  for (const r of refs) {
    const route = routeOfFile(r.file_path);
    const s = route ? surfaceOfRoute(route) : null;
    if (!s) continue;
    if (!feeds.has(r.object_key)) feeds.set(r.object_key, new Set());
    feeds.get(r.object_key)!.add(labelOf.get(s)!);
  }

  const items: AttentionItem[] = [];
  if (opsHealthBroken) {
    items.push({
      severity: 'red',
      what: 'The ops Data-health screen reports zeros for grants, foundations and the entity graph — its own queries have rotted against the schema, so it currently measures nothing',
      influences: ['Data health (ops)'],
      href: '/ops/health',
    });
  }
  for (const [key, o] of objects) {
    const touched = [...(feeds.get(key) ?? [])];
    if (o.joinGap && touched.length > 0) {
      items.push({
        severity: 'amber',
        what: `${o.name} shares a proven join key with other data but has no edge — screens using it cannot follow the connection`,
        influences: touched,
        href: `/clarity/o/${encodeURIComponent(key)}`,
      });
    }
  }
  // Confirmed orphans holding real rows: not wired to any screen — held value nobody sees.
  for (const [key, o] of objects) {
    if (o.orphan && (o.rowCount ?? 0) > 100) {
      items.push({
        severity: 'amber',
        what: `${o.name} holds ${o.rowCount?.toLocaleString('en-AU')} rows and nothing reads it — value collected and never shown`,
        influences: [],
        href: `/clarity/o/${encodeURIComponent(key)}`,
      });
    }
  }
  items.sort((a, b) => (a.severity === b.severity ? b.influences.length - a.influences.length : a.severity === 'red' ? -1 : 1));
  return items.slice(0, 12);
}
