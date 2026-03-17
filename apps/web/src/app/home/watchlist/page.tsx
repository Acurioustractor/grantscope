import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { WatchlistClient } from './watchlist-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Watchlist — Saved Searches & Entity Watches | CivicGraph',
  description: 'Track grants, foundations, entities, and custom alerts in one unified view.',
};

export default async function WatchlistPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/home/watchlist');

  const db = getServiceSupabase();

  const [
    { data: savedGrants },
    { data: savedFoundations },
    { data: entityWatches },
    { data: alerts },
  ] = await Promise.all([
    db.from('saved_grants')
      .select('id, stage, stars, color, notes, updated_at, grant:grant_opportunities(id, name, provider, amount_min, amount_max, closes_at, categories)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50),
    db.from('saved_foundations')
      .select('id, stage, stars, notes, updated_at, foundation:foundation_id(id, name, total_giving_annual, thematic_focus, geographic_focus)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50),
    db.from('entity_watches')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    db.from('alert_preferences')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <Link href="/home" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-black text-bauhaus-black mt-1">Watchlist</h1>
          <p className="text-sm text-bauhaus-muted mt-1">
            Track grants, foundations, entities, and custom alerts in one view.
          </p>
        </div>
        <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
          Saved Searches & Watches
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-8 border-4 border-bauhaus-black">
        <div className="p-4 border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Saved Grants</div>
          <div className="text-2xl font-black text-bauhaus-black">{savedGrants?.length || 0}</div>
        </div>
        <div className="p-4 border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Saved Foundations</div>
          <div className="text-2xl font-black text-bauhaus-black">{savedFoundations?.length || 0}</div>
        </div>
        <div className="p-4 border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Entity Watches</div>
          <div className="text-2xl font-black text-bauhaus-black">{entityWatches?.length || 0}</div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Active Alerts</div>
          <div className="text-2xl font-black text-bauhaus-black">
            {alerts?.filter((a: { enabled: boolean }) => a.enabled).length || 0}
          </div>
        </div>
      </div>

      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <WatchlistClient
        savedGrants={(savedGrants || []) as any}
        savedFoundations={(savedFoundations || []) as any}
        entityWatches={entityWatches || []}
        alerts={alerts || []}
      />
    </div>
  );
}
