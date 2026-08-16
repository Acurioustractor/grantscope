import type { Metadata } from 'next';
import { getDirectServiceSupabase } from '@/lib/supabase';
import OwnersClient, { type OwnerRow } from './OwnersClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Owners · Clarity',
  description:
    'Which product owns each object — proposed from measured code references, confirmed by a human.',
};

async function load(): Promise<OwnerRow[]> {
  const supabase = getDirectServiceSupabase();
  const PAGE = 1000;
  const rows: OwnerRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('clarity_object')
      .select('object_key,object_name,object_kind,row_count,owner_app,owner_app_proposed,refs_app,refs_script')
      .order('object_name')
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`owners query failed: ${error.message}`);
    const page = (data ?? []) as unknown as OwnerRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

export default async function OwnersPage() {
  let rows: OwnerRow[] = [];
  let error: string | null = null;
  try {
    rows = await load();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  return (
    <main className="mx-auto max-w-[1180px] px-4 py-8">
      {error ? (
        <p className="border-4 border-bauhaus-red bg-bauhaus-white p-4 font-mono text-[13px]">
          Owners failed to load: {error}
        </p>
      ) : (
        <OwnersClient initial={rows} />
      )}
    </main>
  );
}
