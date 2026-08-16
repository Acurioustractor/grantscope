import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';
import { floorFor } from '../visibility-floor';
import { NOUN_LABEL, type Noun } from '../nouns';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Surfaces · Clarity',
  description: 'What data feeds which user experience — measured from code references.',
};

/**
 * The data→surface contract, measured (phase-2 directive: "use the clarity tool to understand
 * what data goes into which user's experience").
 *
 * Method: the slice-6b scanner records which app file references which object. File paths map to
 * routes; routes map to a chrome family (the shell prefix list below mirrors the root layout's
 * isChromeless — update BOTH or this page lies about family). Objects carry their noun and their
 * consent/visibility floor (visibility-floor.ts).
 *
 * HONESTY RULES, stated on screen too:
 *   - A code reference is a MENTION, not a render. This page produces a review list, never an
 *     accusation.
 *   - A public page reading operator-floor data SERVER-SIDE (an aggregate, a count) is
 *     legitimate — the floor governs row visibility in the catalogue, not server reads. Only
 *     CONSENT-GOVERNED (withheld) objects on public-family routes make the review list.
 */

const SHELL_PREFIXES = [
  '/dashboard', '/search', '/clarity', '/ops/health', '/alerts', '/tracker', '/foundations/tracker',
];

interface RefRow {
  object_key: string;
  file_path: string;
}
interface ObjRow {
  object_key: string;
  object_name: string;
  domain: string | null;
  noun: Noun | null;
}

function routeOf(filePath: string): string | null {
  if (!filePath.startsWith('apps/web/src/app/')) return null;
  const rel = filePath.slice('apps/web/src/app/'.length);
  const dir = rel.split('/').slice(0, -1).filter((seg) => !seg.startsWith('('));
  if (dir[0] === 'api') return null; // API routes serve many surfaces; judged separately
  return '/' + dir.join('/');
}

/** The surface = the first meaningful route segment ('/entity/[gsId]' → '/entity'). */
function surfaceOf(route: string): string {
  const segs = route.split('/').filter(Boolean);
  if (segs.length === 0) return '/';
  if (segs[0] === 'dashboard' && segs[1]) return `/dashboard/${segs[1].startsWith('[') ? '' : segs[1]}`.replace(/\/$/, '');
  if (segs[0] === 'clarity') return '/clarity';
  if (segs[0] === 'reports' && segs[1] === 'theme') return '/reports/theme';
  if (segs[0] === 'foundations' && segs[1] === 'tracker') return '/foundations/tracker';
  if (segs[0] === 'ops') return '/ops/health';
  return `/${segs[0]}`;
}

function familyOf(surface: string): 'shell' | 'public' {
  return SHELL_PREFIXES.some((p) => surface === p || surface.startsWith(`${p}/`)) ? 'shell' : 'public';
}

const load = unstable_cache(
  async () => {
    const supabase = getDirectServiceSupabase();
    const PAGE = 1000;
    const refs: RefRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('clarity_code_ref')
        .select('object_key,file_path')
        .eq('ref_class', 'app')
        .eq('repo', 'civicgraph')
        .like('file_path', 'apps/web/src/app/%')
        .order('id')
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      refs.push(...((data ?? []) as RefRow[]));
      if ((data ?? []).length < PAGE) break;
    }
    const objs: ObjRow[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from('clarity_object')
        .select('object_key,object_name,domain,noun')
        .order('object_key')
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      objs.push(...((data ?? []) as ObjRow[]));
      if ((data ?? []).length < PAGE) break;
    }
    return { refs, objs };
  },
  ['clarity-surfaces'],
  { revalidate: 3600 },
);

export default async function SurfacesPage() {
  let refs: RefRow[] = [];
  let objs: ObjRow[] = [];
  let error: string | null = null;
  try {
    ({ refs, objs } = await load());
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const objByKey = new Map(objs.map((o) => [o.object_key, o]));

  // surface -> { objects: Set, nounCounts, withheldOnPublic: Set }
  const surfaces = new Map<
    string,
    { family: 'shell' | 'public'; objects: Set<string>; nouns: Map<string, number>; withheld: Set<string> }
  >();
  for (const r of refs) {
    const route = routeOf(r.file_path);
    if (!route) continue;
    const s = surfaceOf(route);
    const family = familyOf(s);
    if (!surfaces.has(s)) surfaces.set(s, { family, objects: new Set(), nouns: new Map(), withheld: new Set() });
    const entry = surfaces.get(s)!;
    if (entry.objects.has(r.object_key)) continue;
    entry.objects.add(r.object_key);
    const o = objByKey.get(r.object_key);
    const noun = o?.noun ?? 'unfiled';
    entry.nouns.set(noun, (entry.nouns.get(noun) ?? 0) + 1);
    if (o && family === 'public' && floorFor(o) === 'withheld') entry.withheld.add(r.object_key);
  }

  const rows = [...surfaces.entries()].sort((a, b) => b[1].objects.size - a[1].objects.size);
  const reviewList = rows.filter(([, v]) => v.withheld.size > 0);

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-8">
      <header className="border-4 border-bauhaus-black bg-bauhaus-white p-5">
        <h1 className="font-mono text-2xl font-black">Surfaces</h1>
        <p className="mt-2 max-w-[78ch] text-[14px] leading-relaxed text-neutral-700">
          What data feeds which user experience — measured from the scanner&rsquo;s code
          references, joined to each object&rsquo;s noun and consent floor.{' '}
          <strong>A reference is a mention, not a render</strong>: this page produces a review
          list, never an accusation. A public page computing a server-side aggregate over
          operator-floor data is legitimate; only <strong>consent-governed objects mentioned by
          public-family code</strong> are flagged.
        </p>
        {error ? <p className="mt-2 font-mono text-[12px] text-bauhaus-red">Failed: {error}</p> : null}
      </header>

      {reviewList.length > 0 ? (
        <section className="mt-4 border-4 border-bauhaus-red bg-bauhaus-white">
          <h2 className="border-b-2 border-bauhaus-red px-4 py-2 font-mono text-[11px] font-black uppercase tracking-widest text-bauhaus-red">
            Review — consent-governed objects mentioned by public-family code · {reviewList.length} surfaces
          </h2>
          <p className="border-b border-neutral-200 px-4 py-2 text-[13px] text-neutral-600">
            Caveat before reviewing: <code className="bg-bauhaus-canvas px-1 font-mono text-[0.92em]">stories</code>{' '}
            and <code className="bg-bauhaus-canvas px-1 font-mono text-[0.92em]">quotes</code> are
            common English words and the scanner matches whole words — a marketing sentence
            containing &ldquo;stories&rdquo; counts as a mention of the table. Distinctive names
            (transcripts, storytellers) are the stronger signals; the object page&rsquo;s code-ref
            list shows the exact files.
          </p>
          <ul>
            {reviewList.map(([s, v]) => (
              <li key={s} className="border-b border-neutral-200 px-4 py-2 last:border-b-0">
                <span className="font-mono text-[13px] font-black">{s}</span>
                <span className="ml-3 font-mono text-[12px]">
                  {[...v.withheld].map((k, i) => (
                    <span key={k}>
                      {i > 0 ? ' · ' : ''}
                      <Link href={`/clarity/o/${encodeURIComponent(k)}`} className="text-bauhaus-blue underline">
                        {k}
                      </Link>
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="mt-4 border-4 border-bauhaus-black bg-bauhaus-white p-4">
          <p className="font-mono text-[12px] text-neutral-600">
            No consent-governed object is mentioned by public-family code. Measured, not assumed.
          </p>
        </section>
      )}

      {(['shell', 'public'] as const).map((family) => (
        <section key={family} className="mt-4 border-4 border-bauhaus-black bg-bauhaus-white">
          <h2 className="border-b-2 border-bauhaus-black px-4 py-2 font-mono text-[11px] font-black uppercase tracking-widest">
            {family === 'shell' ? 'App shell surfaces' : 'Public atlas surfaces'} ·{' '}
            {rows.filter(([, v]) => v.family === family).length}
          </h2>
          <ul>
            {rows
              .filter(([, v]) => v.family === family)
              .map(([s, v]) => (
                <li key={s} className="flex flex-wrap items-baseline gap-x-3 border-b border-neutral-200 px-4 py-2 last:border-b-0">
                  <span className="font-mono text-[13px] font-black">{s}</span>
                  <span className="font-mono text-[11px] text-neutral-500">
                    {v.objects.size} objects
                  </span>
                  <span className="text-[12px] text-neutral-600">
                    {[...v.nouns.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([n, c]) => `${NOUN_LABEL[n as Noun] ?? n} ${c}`)
                      .join(' · ')}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
