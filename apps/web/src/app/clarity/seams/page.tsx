import type { Metadata } from 'next';
import Link from 'next/link';
import { getDirectServiceSupabase } from '@/lib/supabase';
import SeamsClient from './SeamsClient';
import type { SeamRow } from './types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The seams · Clarity',
  description: 'Every connection in the database, ranked by how much data it is losing right now.',
};

async function load(): Promise<SeamRow[]> {
  const supabase = getDirectServiceSupabase();

  // Broken first, unmeasured last. A catalog that sorts by quality descending
  // buries its own worst finding on page two.
  const { data, error } = await supabase
    .from('v_clarity_seams')
    .select(
      'id,mechanism,src_object,src_column,tgt_object,tgt_column,declared,match_rate,' +
        'match_numerator,match_denominator,match_method,match_measured_at,rows_at_stake,' +
        'grain,note,rows_losing,match_delta,src_domain,tgt_domain',
    )
    .order('rows_losing', { ascending: false, nullsFirst: false })
    .limit(1500);

  if (error) throw new Error(`v_clarity_seams query failed: ${error.message}`);
  return (data ?? []) as unknown as SeamRow[];
}

export default async function SeamsPage() {
  let seams: SeamRow[] = [];
  let error: string | null = null;

  try {
    seams = await load();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error) {
    return (
      <main className="clarity-dark min-h-screen px-5 py-16">
        <div className="mx-auto max-w-3xl border-4 border-bauhaus-red bg-bauhaus-white p-8">
          <h1 className="text-2xl font-black uppercase tracking-widest text-bauhaus-red">
            Seams unavailable
          </h1>
          <p className="mt-4 text-sm">
            <code className="font-mono">v_clarity_seams</code> could not be read. It ships in
            migration <code className="font-mono">20260815001600_clarity_seams.sql</code>.
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
      <SeamsClient seams={seams} />
    </div>
  );
}
