import type { Metadata } from 'next';
import Link from 'next/link';
import { getDirectServiceSupabase } from '@/lib/supabase';
import WantsClient from './WantsClient';
import type { WantRow } from './types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The want list · Clarity',
  description: 'Every gap with a price and a payoff. The coverage bar, inverted.',
};

async function load(): Promise<WantRow[]> {
  const supabase = getDirectServiceSupabase();
  const { data, error } = await supabase.from('v_clarity_wants').select('*').limit(500);
  if (error) throw new Error(`v_clarity_wants query failed: ${error.message}`);
  return (data ?? []) as unknown as WantRow[];
}

export default async function WantsPage() {
  let wants: WantRow[] = [];
  let error: string | null = null;

  try {
    wants = await load();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error) {
    return (
      <main className="clarity-dark min-h-screen px-5 py-16">
        <div className="mx-auto max-w-3xl border-4 border-bauhaus-red bg-bauhaus-white p-8">
          <h1 className="text-2xl font-black uppercase tracking-widest text-bauhaus-red">
            The want list is unavailable
          </h1>
          <p className="mt-4 text-sm">
            <code className="font-mono">v_clarity_wants</code> could not be read. It ships in
            migration{' '}
            <code className="font-mono">20260815001700_clarity_house_and_wants.sql</code>.
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
      <WantsClient wants={wants} />
    </div>
  );
}
