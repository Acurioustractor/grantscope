import type { Metadata } from 'next';
import Link from 'next/link';
import { getDirectServiceSupabase } from '@/lib/supabase';
import CrossClient from './CrossClient';
import { parseTab, type FlowCell, type JoinCell, type SentinelRow, type Tab } from './types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cross-sections · Clarity',
  description: 'How kinds of organisation move money to each other, and which flows nobody has looked at.',
};

interface Loaded {
  tab: Tab;
  flow: FlowCell[];
  join: JoinCell[];
  sentinels: SentinelRow[];
  /** null when the matview has never been built — a different state from "empty" */
  flowAvailable: boolean;
  flowError: string | null;
}

async function load(tab: Tab): Promise<Loaded> {
  const supabase = getDirectServiceSupabase();

  // The matrix is bounded by construction — 11 x 11 x 10 = 1,210 rows at most —
  // so it ships whole and the client filters in memory. No pagination needed and
  // none pretended.
  const { data: flowRows, error: flowError } = await supabase
    .from('mv_clarity_flow')
    .select(
      'source_type,target_type,relationship_type,edges,edges_with_amount,amount_recorded,' +
        'edges_with_year,distinct_sources,distinct_targets,year_min,year_max',
    )
    .order('edges', { ascending: false })
    .limit(1500);

  const { data: joinRows } = await supabase
    .from('v_clarity_join_matrix')
    .select(
      'src_domain,tgt_domain,edges,declared_edges,measured_edges,best_match_rate,' +
        'worst_match_rate,rows_at_stake',
    );

  const { data: sentinelRows } = await supabase
    .from('clarity_sentinel')
    .select('key,label,description,severity,guards_objects')
    .order('key');

  return {
    tab,
    flow: (flowRows ?? []) as unknown as FlowCell[],
    join: (joinRows ?? []) as unknown as JoinCell[],
    sentinels: (sentinelRows ?? []) as unknown as SentinelRow[],
    flowAvailable: !flowError,
    flowError: flowError?.message ?? null,
  };
}

export default async function CrossPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; rel?: string; cell?: string }>;
}) {
  const sp = await searchParams;
  const tab = parseTab(sp.tab);

  let loaded: Loaded | null = null;
  let error: string | null = null;
  try {
    loaded = await load(tab);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error || !loaded) {
    return (
      <main className="clarity-dark min-h-screen px-5 py-16">
        <div className="mx-auto max-w-3xl border-4 border-bauhaus-red bg-bauhaus-white p-8">
          <h1 className="text-2xl font-black uppercase tracking-widest text-bauhaus-red">
            Cross-sections unavailable
          </h1>
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
      <CrossClient
        tab={tab}
        flow={loaded.flow}
        join={loaded.join}
        sentinels={loaded.sentinels}
        flowAvailable={loaded.flowAvailable}
        flowError={loaded.flowError}
        selectedRel={sp.rel ?? ''}
        selectedCell={sp.cell ?? ''}
      />
    </div>
  );
}
