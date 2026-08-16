import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import { getDirectServiceSupabase } from '@/lib/supabase';

export const metadata: Metadata = { title: 'People — CivicGraph' };

const load = unstable_cache(
  async () => {
    const supabase = getDirectServiceSupabase();
    // MAX_PLAUSIBLE_BOARDS: rows above 10 boards are professional-trustee/nominee blocks
    // (the top unfiltered "person" sits on 745 estate trusts) — the person-disambiguation cap
    // is a standing decision (2026-06-19, CAP STAYS), applied here as a read-side filter.
    const { data, error } = await supabase
      .from('mv_board_interlocks')
      .select('person_name_display,board_count,organisations,interlock_score')
      .lte('board_count', 10)
      .order('interlock_score', { ascending: false })
      .limit(15);
    if (error) throw new Error(error.message);
    return data ?? [];
  },
  ['dash-people'],
  { revalidate: 3600 },
);

/**
 * Shell-native People index off the board-interlocks matview. KNOWN LIMIT, stated on screen:
 * names are string-normalised, so common names can collapse several real people into one row —
 * the identity lane's job, not this page's.
 */
export default async function PeoplePage() {
  let rows: Awaited<ReturnType<typeof load>> = [];
  let why: string | null = null;
  try {
    rows = await load();
  } catch (e) {
    why = e instanceof Error ? e.message : String(e);
  }

  return (
    <div className="mx-auto max-w-[1100px] px-6 py-6">
      <h1 className="font-display text-[22px] font-extrabold">People</h1>
      <p className="mt-1 text-[13.5px]" style={{ color: 'var(--shell-muted)' }}>
        People on multiple boards (2–10; more than that is a professional trustee block, excluded), ranked by interlock. Names are matched by string — a common name
        can be several real people; treat high board counts as a lead, not a fact. Person pages
        open on the public atlas.
      </p>
      {why ? (
        <p className="mt-4 text-[13px]" style={{ color: '#D02020' }}>
          Board interlocks could not be read: {why}
        </p>
      ) : (
        <div
          className="mt-5 bg-white p-4"
          style={{ borderRadius: 'var(--shell-r)', border: '1px solid var(--shell-line)' }}
        >
          {rows.map((p, i) => (
            <div
              key={p.person_name_display ?? i}
              className="flex items-baseline gap-3 py-2"
              style={{ borderTop: i === 0 ? undefined : '1px solid var(--shell-line)' }}
            >
              <Link
                href={`/person/${encodeURIComponent((p.person_name_display ?? '').replace(/\s+/g, '-'))}`}
                className="min-w-0 flex-1 truncate text-[13.5px] font-semibold hover:underline"
                style={{ color: '#1040C0' }}
              >
                {p.person_name_display}
              </Link>
              <span className="shrink-0 text-[11.5px]" style={{ color: 'var(--shell-muted)' }}>
                {p.board_count} boards
              </span>
              <span className="shrink-0 truncate font-mono text-[11px]" style={{ color: 'var(--shell-muted)', maxWidth: 340 }}>
                {(p.organisations ?? []).slice(0, 3).join(' · ')}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
