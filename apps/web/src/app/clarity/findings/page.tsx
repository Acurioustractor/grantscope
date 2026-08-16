import type { Metadata } from 'next';
import { getDirectServiceSupabase } from '@/lib/supabase';
import FindingsClient from './FindingsClient';
import type { FindingRow } from './types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Findings · Clarity',
  description:
    'What the detectors noticed. Machine-proposed, human-adjudicated; unconfirmed never counts as true.',
};

async function load(): Promise<FindingRow[]> {
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase
    .from('clarity_finding')
    .select('*')
    .order('proposed_at', { ascending: false })
    .limit(1000);
  if (error) throw new Error(`clarity_finding query failed: ${error.message}`);
  return (data ?? []) as unknown as FindingRow[];
}

export default async function FindingsPage() {
  let findings: FindingRow[] = [];
  let error: string | null = null;
  try {
    findings = await load();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-8">
      {error ? (
        <p className="border-4 border-bauhaus-red bg-bauhaus-white p-4 font-mono text-[13px]">
          Findings failed to load: {error}
        </p>
      ) : (
        <FindingsClient initial={findings} />
      )}
    </main>
  );
}
