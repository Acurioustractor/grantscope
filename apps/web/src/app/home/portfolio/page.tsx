import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { PortfolioClient } from './portfolio-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'My Grantees — Portfolio | CivicGraph',
  description: 'Monitor your grantee portfolio with aggregate funding, risk alerts, and gap analysis.',
};

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '\u2014';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

export default async function PortfolioPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/home/portfolio');

  const db = getServiceSupabase();

  // Get or create default portfolio
  let { data: portfolios } = await db
    .from('funder_portfolios')
    .select('id, name, description')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (!portfolios || portfolios.length === 0) {
    const { data: created } = await db
      .from('funder_portfolios')
      .insert({ user_id: user.id, name: 'My Grantees' })
      .select('id, name, description')
      .single();
    portfolios = created ? [created] : [];
  }

  const portfolio = portfolios[0];
  if (!portfolio) {
    return <div className="p-8">Failed to load portfolio.</div>;
  }

  // Fetch entities in this portfolio
  const { data: entries } = await db
    .from('funder_portfolio_entities')
    .select('id, gs_id, notes, added_at, entity_id')
    .eq('portfolio_id', portfolio.id)
    .order('added_at', { ascending: false });

  let entities: Array<{
    portfolio_entry_id: string;
    gs_id: string;
    notes: string | null;
    added_at: string;
    canonical_name: string;
    abn: string | null;
    entity_type: string;
    state: string | null;
    sector: string | null;
    total_relationships: number;
    total_inbound_amount: number;
    total_outbound_amount: number;
    is_community_controlled: boolean;
    seifa_irsd_decile: number | null;
    has_donations: boolean;
    has_contracts: boolean;
  }> = [];

  if (entries && entries.length > 0) {
    const entityIds = entries.map((e) => e.entity_id);
    const [{ data: entityData }, { data: statsData }, { data: donorContractors }] = await Promise.all([
      db.from('gs_entities')
        .select('id, gs_id, canonical_name, abn, entity_type, sector, state, is_community_controlled, seifa_irsd_decile')
        .in('id', entityIds),
      db.from('mv_gs_entity_stats')
        .select('id, total_relationships, total_inbound_amount, total_outbound_amount')
        .in('id', entityIds),
      db.from('mv_gs_donor_contractors')
        .select('id')
        .in('id', entityIds),
    ]);

    const entityMap = new Map((entityData || []).map((e) => [e.id, e]));
    const statsMap = new Map((statsData || []).map((s) => [s.id, s]));
    const donorSet = new Set((donorContractors || []).map((d) => d.id));

    entities = entries.map((entry) => {
      const e = entityMap.get(entry.entity_id);
      const s = statsMap.get(entry.entity_id);
      return {
        portfolio_entry_id: entry.id,
        gs_id: entry.gs_id,
        notes: entry.notes,
        added_at: entry.added_at,
        canonical_name: e?.canonical_name || entry.gs_id,
        abn: e?.abn || null,
        entity_type: e?.entity_type || 'unknown',
        state: e?.state || null,
        sector: e?.sector || null,
        total_relationships: s?.total_relationships || 0,
        total_inbound_amount: s?.total_inbound_amount || 0,
        total_outbound_amount: s?.total_outbound_amount || 0,
        is_community_controlled: e?.is_community_controlled || false,
        seifa_irsd_decile: e?.seifa_irsd_decile || null,
        has_donations: donorSet.has(entry.entity_id),
        has_contracts: (s?.total_inbound_amount || 0) > 0,
      };
    });
  }

  // Aggregate stats
  const totalInbound = entities.reduce((s, e) => s + e.total_inbound_amount, 0);
  const totalOutbound = entities.reduce((s, e) => s + e.total_outbound_amount, 0);
  const totalRelationships = entities.reduce((s, e) => s + e.total_relationships, 0);
  const riskCount = entities.filter((e) => e.has_donations).length;
  const communityControlled = entities.filter((e) => e.is_community_controlled).length;
  const lowSeifa = entities.filter((e) => (e.seifa_irsd_decile ?? 10) <= 3).length;

  // State distribution
  const byState: Record<string, number> = {};
  for (const e of entities) {
    const st = e.state || 'Unknown';
    byState[st] = (byState[st] || 0) + 1;
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <Link href="/home" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
            &larr; Dashboard
          </Link>
          <h1 className="text-2xl font-black text-bauhaus-black mt-1">{portfolio.name}</h1>
          {portfolio.description && (
            <p className="text-sm text-bauhaus-muted mt-1">{portfolio.description}</p>
          )}
        </div>
        <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">
          Funder Portfolio
        </div>
      </div>

      {/* Aggregate Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-0 mb-8 border-4 border-bauhaus-black">
        <div className="p-4 border-r-2 border-b-2 sm:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Grantees</div>
          <div className="text-2xl font-black text-bauhaus-black">{entities.length}</div>
        </div>
        <div className="p-4 border-r-2 border-b-2 sm:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Total Inbound</div>
          <div className="text-2xl font-black text-bauhaus-black">{fmtMoney(totalInbound)}</div>
        </div>
        <div className="p-4 border-r-2 border-b-2 lg:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Total Outbound</div>
          <div className="text-2xl font-black text-bauhaus-black">{fmtMoney(totalOutbound)}</div>
        </div>
        <div className="p-4 border-r-2 border-b-2 lg:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Relationships</div>
          <div className="text-2xl font-black text-bauhaus-black">{totalRelationships.toLocaleString()}</div>
        </div>
        <div className="p-4 border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Risk Flags</div>
          <div className={`text-2xl font-black ${riskCount > 0 ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>{riskCount}</div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Community Ctrl</div>
          <div className="text-2xl font-black text-green-600">{communityControlled}</div>
        </div>
      </div>

      {/* Coverage insights */}
      {entities.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {/* State distribution */}
          <div className="border-2 border-bauhaus-black p-4">
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-3">Geographic Spread</div>
            {Object.entries(byState).sort((a, b) => b[1] - a[1]).map(([state, count]) => (
              <div key={state} className="flex justify-between text-sm mb-1">
                <span className="font-bold">{state}</span>
                <span className="text-bauhaus-muted">{count}</span>
              </div>
            ))}
          </div>

          {/* SEIFA coverage */}
          <div className="border-2 border-bauhaus-black p-4">
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-3">Disadvantage Coverage</div>
            <div className="text-3xl font-black text-bauhaus-black mb-1">
              {entities.length > 0 ? Math.round((lowSeifa / entities.length) * 100) : 0}%
            </div>
            <div className="text-xs text-bauhaus-muted">
              {lowSeifa} of {entities.length} grantees serve SEIFA decile 1-3 areas
            </div>
          </div>

          {/* Risk summary */}
          <div className="border-2 border-bauhaus-black p-4">
            <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-3">Integrity Alerts</div>
            {riskCount > 0 ? (
              <div>
                <div className="text-3xl font-black text-bauhaus-red mb-1">{riskCount}</div>
                <div className="text-xs text-bauhaus-muted">
                  {riskCount} grantee{riskCount !== 1 ? 's' : ''} flagged as donor-contractor (political donations + government contracts)
                </div>
              </div>
            ) : (
              <div>
                <div className="text-3xl font-black text-green-600 mb-1">0</div>
                <div className="text-xs text-bauhaus-muted">No donor-contractor flags in this portfolio</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Entity list + add entity form */}
      <PortfolioClient
        portfolioId={portfolio.id}
        entities={entities}
      />
    </div>
  );
}
