import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { KanbanBoard } from './kanban-board';

export const dynamic = 'force-dynamic';

export interface SavedGrantRow {
  id: string;
  grant_id: string;
  stars: number;
  color: string | null;
  stage: string;
  notes: string | null;
  ghl_opportunity_id: string | null;
  updated_at: string;
  grant: {
    id: string;
    name: string;
    provider: string;
    amount_min: number | null;
    amount_max: number | null;
    closes_at: string | null;
    categories: string[];
    url: string | null;
    status: string;
  };
}

export default async function TrackerPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Use service role to bypass RLS — route is already auth-gated by middleware
  const serviceDb = getServiceSupabase();
  const { data } = await serviceDb
    .from('saved_grants')
    .select(`
      *,
      grant:grant_opportunities(id, name, provider, amount_min, amount_max, closes_at, categories, url, status)
    `)
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  const grants = (data || []) as SavedGrantRow[];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-black text-bauhaus-black uppercase tracking-tight">
          Grant Tracker
        </h1>
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-red"
          >
            Sign Out
          </button>
        </form>
      </div>
      <KanbanBoard initialGrants={grants} />
    </div>
  );
}
