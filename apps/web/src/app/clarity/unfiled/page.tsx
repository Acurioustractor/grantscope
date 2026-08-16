import type { Metadata } from 'next';
import { getDirectServiceSupabase } from '@/lib/supabase';
import UnfiledClient, { type UnfiledRow } from './UnfiledClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The unfiled · Clarity',
  description: 'Every object without a confirmed noun. Rules propose; you confirm. The counter is the progress bar.',
};

async function load(): Promise<{ rows: UnfiledRow[]; total: number }> {
  const supabase = getDirectServiceSupabase();
  const PAGE = 1000;
  const rows: UnfiledRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('clarity_object')
      .select('object_key,object_name,object_kind,domain,row_count,purpose,noun_proposed')
      .is('noun', null)
      .order('noun_proposed', { ascending: true, nullsFirst: false })
      .order('object_name')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`unfiled query failed: ${error.message}`);
    const page = (data ?? []) as unknown as UnfiledRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  const { count } = await supabase
    .from('clarity_object')
    .select('object_key', { count: 'exact', head: true });
  return { rows, total: count ?? 1479 };
}

export default async function UnfiledPage() {
  let rows: UnfiledRow[] = [];
  let total = 0;
  let error: string | null = null;
  try {
    ({ rows, total } = await load());
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-8">
      {error ? (
        <p className="border-4 border-bauhaus-red bg-bauhaus-white p-4 font-mono text-[13px]">
          The unfiled failed to load: {error}
        </p>
      ) : (
        <UnfiledClient initial={rows} total={total} />
      )}
    </main>
  );
}
