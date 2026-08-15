import type { Metadata } from 'next';
import Link from 'next/link';
import { getDirectServiceSupabase } from '@/lib/supabase';
import ChangesClient from './ChangesClient';
import {
  BASELINES,
  parseBaseline,
  type Baseline,
  type BaselineAvailability,
  type ChangeEvent,
  type ChangesStats,
} from './types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'What changed · Clarity',
  description: 'Every move in the estate since a baseline, and whether anyone explained it.',
};

const WINDOW_DAYS: Record<Baseline, number> = { last: 2, '7d': 7, '30d': 30, '90d': 90 };

async function load(baseline: Baseline) {
  // getDirectServiceSupabase, NOT getServiceSupabase — the latter can return a stub
  // that resolves every query to { data: null }, i.e. a silent empty screen.
  const supabase = getDirectServiceSupabase();
  const since = new Date(Date.now() - WINDOW_DAYS[baseline] * 86_400_000).toISOString();

  // Unexplained criticals first, then newest. The ordering IS the argument: an
  // anomaly nobody has accounted for outranks anything that merely happened.
  const { data: eventRows, error } = await supabase
    .from('v_clarity_changes')
    .select(
      'id,at,event_type,object_key,question_slug,before_value,after_value,delta_pct,' +
        'severity,note,reason,reason_by,reason_at,unexplained,domain,object_kind',
    )
    .gte('at', since)
    .eq('act_business', false)
    .order('unexplained', { ascending: false })
    .order('at', { ascending: false })
    .limit(300);

  if (error) throw new Error(`v_clarity_changes query failed: ${error.message}`);

  // The three seeded 2026-04-02 moves sit outside every window but are the whole
  // point of the screen, so unexplained criticals are always carried in.
  const { data: openRows } = await supabase
    .from('v_clarity_changes')
    .select(
      'id,at,event_type,object_key,question_slug,before_value,after_value,delta_pct,' +
        'severity,note,reason,reason_by,reason_at,unexplained,domain,object_kind',
    )
    .eq('unexplained', true)
    .eq('act_business', false)
    .order('at', { ascending: false })
    .limit(100);

  const byId = new Map<number, ChangeEvent>();
  for (const r of [...(openRows ?? []), ...(eventRows ?? [])] as unknown as ChangeEvent[]) {
    byId.set(r.id, r);
  }
  const events = [...byId.values()].sort((a, b) => {
    if (a.unexplained !== b.unexplained) return a.unexplained ? -1 : 1;
    return a.at < b.at ? 1 : -1;
  });

  // Baseline availability, measured rather than assumed. A baseline with zero
  // covered objects is offered greyed, with the reason on the control itself.
  const availability: BaselineAvailability[] = [];
  let stats: ChangesStats = {
    inWindow: (eventRows ?? []).length,
    unexplained: events.filter((e) => e.unexplained).length,
    moved: 0,
    measurable: 0,
    objects: 0,
    historyBegins: null,
    computedAt: null,
  };

  const { count: objectCount } = await supabase
    .from('clarity_object')
    .select('object_key', { count: 'exact', head: true });
  stats.objects = objectCount ?? 0;

  for (const b of BASELINES) {
    const { count } = await supabase
      .from('clarity_delta')
      .select('object_key', { count: 'exact', head: true })
      .eq('baseline', b)
      .not('baseline_at', 'is', null);
    availability.push({
      baseline: b,
      covered: count ?? 0,
      reason: count ? null : 'history does not reach back this far yet',
    });
  }

  const { data: firstHistory } = await supabase
    .from('clarity_object_history')
    .select('snapshot_at')
    .order('snapshot_at', { ascending: true })
    .limit(1);
  stats.historyBegins = firstHistory?.[0]?.snapshot_at ?? null;

  const { count: movedCount } = await supabase
    .from('clarity_delta')
    .select('object_key', { count: 'exact', head: true })
    .eq('baseline', baseline)
    .not('row_delta_pct', 'is', null)
    .or('row_delta_pct.gt.10,row_delta_pct.lt.-10');
  stats.moved = movedCount ?? 0;

  const { data: computed } = await supabase
    .from('clarity_delta')
    .select('computed_at')
    .eq('baseline', baseline)
    .order('computed_at', { ascending: false })
    .limit(1);
  stats.computedAt = computed?.[0]?.computed_at ?? null;
  stats.measurable = availability.find((a) => a.baseline === baseline)?.covered ?? 0;
  stats = { ...stats, unexplained: events.filter((e) => e.unexplained).length };

  return { events, availability, stats };
}

export default async function ChangesPage({
  searchParams,
}: {
  searchParams: Promise<{ b?: string }>;
}) {
  const { b } = await searchParams;
  const baseline = parseBaseline(b);

  let events: ChangeEvent[] = [];
  let availability: BaselineAvailability[] = [];
  let stats: ChangesStats | null = null;
  let error: string | null = null;

  try {
    ({ events, availability, stats } = await load(baseline));
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error || !stats) {
    return (
      <main className="clarity-dark min-h-screen px-5 py-16">
        <div className="mx-auto max-w-3xl border-4 border-bauhaus-red bg-bauhaus-white p-8">
          <h1 className="text-2xl font-black uppercase tracking-widest text-bauhaus-red">
            No change log
          </h1>
          <p className="mt-4 text-sm text-bauhaus-black">
            <code className="font-mono">v_clarity_changes</code> could not be read. The log is
            written by <code className="font-mono">clarity_compute_deltas()</code>; if the slice-3
            migrations have not been applied, there is nothing to show yet.
          </p>
          <pre className="mt-4 overflow-x-auto border-2 border-bauhaus-muted bg-bauhaus-canvas p-3 font-mono text-xs">
            {error}
          </pre>
          <Link href="/clarity" className="mt-5 inline-block text-sm font-black uppercase underline">
            ← The ledger
          </Link>
        </div>
      </main>
    );
  }

  return (
    <div className="clarity-dark">
      <ChangesClient
        events={events}
        availability={availability}
        stats={stats}
        baseline={baseline}
      />
    </div>
  );
}
