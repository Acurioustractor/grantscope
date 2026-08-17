import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Entities — CivicGraph' };

/**
 * Entities is the union of the other kinds, so this page is a search and jump-off, not another
 * browser: find any organisation on the graph, then land in the kind browser or atlas page
 * that actually holds its story.
 */

const KINDS: { href: string; label: string; blurb: string }[] = [
  { href: '/dashboard/browse/foundations', label: 'Foundations', blurb: 'who gives, and to whom' },
  { href: '/dashboard/browse/social-enterprises', label: 'Social enterprises', blurb: 'the register and what we know' },
  { href: '/dashboard/browse/charities', label: 'Charities', blurb: 'ACNC register with six years of returns' },
  { href: '/dashboard/browse/grants', label: 'Grant recipients', blurb: 'who receives justice-system grants' },
  { href: '/dashboard/browse/contracts', label: 'Contract suppliers', blurb: 'who wins Commonwealth contracts' },
  { href: '/dashboard/browse/buyers', label: 'Government buyers', blurb: 'which agencies let them' },
  { href: '/dashboard/browse/donations', label: 'Political donors', blurb: 'declared donations only' },
  { href: '/dashboard/people', label: 'People', blurb: 'boards and the money past them' },
  { href: '/dashboard/places', label: 'Places', blurb: 'council areas: money vs disadvantage' },
];

const countEntities = unstable_cache(
  async () => {
    const supabase = getDirectServiceSupabase();
    const { count } = await supabase.from('gs_entities').select('id', { count: 'estimated', head: true });
    return count ?? null;
  },
  ['dash-entities-count'],
  { revalidate: 86400 },
);

interface Hit {
  gs_id: string;
  canonical_name: string;
  abn: string | null;
  entity_type: string | null;
  state: string | null;
}

export default async function EntitiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.trim() : '';

  let hits: Hit[] = [];
  let why: string | null = null;
  const total = await countEntities().catch(() => null);
  if (q.length >= 2) {
    try {
      const supabase = getDirectServiceSupabase();
      const { data, error } = await supabase
        .from('gs_entities')
        .select('gs_id,canonical_name,abn,entity_type,state')
        .ilike('canonical_name', `%${q}%`)
        .limit(20);
      if (error) throw new Error(error.message);
      hits = (data ?? []) as Hit[];
    } catch (e) {
      why = e instanceof Error ? e.message : String(e);
    }
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">Entities</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
        {total ? `${total.toLocaleString('en-AU')} organisations on the graph. ` : ''}
        Search anything, or start from a kind — each kind browser knows its own story.
      </p>

      <form className="mt-4" action="/dashboard/entities">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search any organisation…"
          className="w-full max-w-[420px] bg-white px-3 py-2 font-mono text-[13px] shell-control"
        />
      </form>

      {why ? (
        <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>The search could not run: {why}</p>
      ) : q.length >= 2 ? (
        hits.length === 0 ? (
          <p className="mt-4 text-[13px]" style={{ color: 'var(--shell-muted)' }}>
            Nothing on the graph matches &ldquo;{q}&rdquo; — try fewer words, or a different spelling.
          </p>
        ) : (
          <div className="mt-4 shell-card">
            {hits.map((h) => (
              <div key={h.gs_id} className="flex items-baseline gap-3 px-4 py-2" style={{ borderBottom: '1px solid var(--shell-line)' }}>
                <Link href={`/entity/${h.gs_id}`} className="min-w-0 flex-1 truncate text-[13.5px] font-semibold hover:underline" style={{ color: '#1040C0' }}>
                  {h.canonical_name}
                </Link>
                <span className="shrink-0 font-mono text-[11px]" style={{ color: 'var(--shell-muted)' }}>
                  {[h.entity_type, h.state, h.abn ? `ABN ${h.abn}` : null].filter(Boolean).join(' · ')}
                </span>
              </div>
            ))}
          </div>
        )
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KINDS.map((k) => (
          <Link
            key={k.href}
            href={k.href}
            className="block bg-white p-4"
            style={{ borderRadius: 'var(--shell-r)', border: '1px solid var(--shell-line)' }}
          >
            <div className="font-display text-[15px] font-bold">{k.label}</div>
            <p className="mt-1 text-[12.5px]" style={{ color: 'var(--shell-muted)' }}>{k.blurb}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
