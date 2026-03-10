import { getServiceSupabase } from '@/lib/supabase';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function formatMoney(amount: number | null): string {
  if (!amount) return '\u2014';
  if (amount >= 1_000_000_000_000) return `$${(amount / 1_000_000_000_000).toFixed(1)}T`;
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function formatNum(n: number): string {
  return n.toLocaleString();
}

export default async function InsightsPage() {
  const supabase = getServiceSupabase();

  // Parallel queries for all stats
  const [
    entityCount,
    relationshipCount,
    seCount,
    seBySource,
    entityByType,
    contractStats,
    justiceStats,
    donationStats,
    grantCount,
    foundationCount,
    foundationEnriched,
    communityControlled,
    remoteEntities,
    disadvantagedEntities,
    topLgasBySE,
    seWithContracts,
    coverageStats,
  ] = await Promise.all([
    supabase.from('gs_entities').select('*', { count: 'exact', head: true }),
    supabase.from('gs_relationships').select('*', { count: 'exact', head: true }),
    supabase.from('social_enterprises').select('*', { count: 'exact', head: true }),
    supabase.rpc('exec_sql', { query: `
      SELECT source_primary, COUNT(*)::int as count, COUNT(abn)::int as with_abn
      FROM social_enterprises GROUP BY source_primary ORDER BY count DESC
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT entity_type, COUNT(*)::int as count FROM gs_entities GROUP BY entity_type ORDER BY count DESC
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT COUNT(*)::int as count, COALESCE(SUM(contract_value), 0)::float as total_value FROM austender_contracts
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT COUNT(*)::int as count, COALESCE(SUM(amount_dollars), 0)::float as total_value FROM justice_funding
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT COUNT(*)::int as count, COALESCE(SUM(amount), 0)::float as total_value FROM political_donations
    `}),
    supabase.from('grant_opportunities').select('*', { count: 'exact', head: true }),
    supabase.from('foundations').select('*', { count: 'exact', head: true }),
    supabase.rpc('exec_sql', { query: `SELECT COUNT(*)::int as count FROM foundations WHERE description IS NOT NULL` }),
    supabase.rpc('exec_sql', { query: `SELECT COUNT(*)::int as count FROM gs_entities WHERE is_community_controlled = true` }),
    supabase.rpc('exec_sql', { query: `
      SELECT remoteness, COUNT(*)::int as count FROM gs_entities
      WHERE remoteness IN ('Remote Australia', 'Very Remote Australia')
      GROUP BY remoteness ORDER BY count DESC
    `}),
    supabase.rpc('exec_sql', { query: `SELECT COUNT(*)::int as count FROM gs_entities WHERE seifa_irsd_decile <= 3` }),
    supabase.rpc('exec_sql', { query: `
      SELECT e.lga_name, COUNT(DISTINCT se.id)::int as se_count
      FROM gs_entities e
      JOIN social_enterprises se ON se.abn = e.abn
      WHERE e.lga_name IS NOT NULL AND se.abn IS NOT NULL
      GROUP BY e.lga_name ORDER BY se_count DESC LIMIT 12
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT COUNT(DISTINCT se.abn)::int as count
      FROM social_enterprises se
      INNER JOIN austender_contracts ac ON ac.supplier_abn = se.abn
      WHERE se.abn IS NOT NULL
    `}),
    supabase.rpc('exec_sql', { query: `
      SELECT
        COUNT(*)::int as total,
        COUNT(abn)::int as with_abn,
        COUNT(postcode)::int as with_postcode,
        COUNT(remoteness)::int as with_remoteness,
        COUNT(seifa_irsd_decile)::int as with_seifa,
        COUNT(lga_name)::int as with_lga
      FROM gs_entities
    `}),
  ]);

  const entities = entityCount.count || 0;
  const relationships = relationshipCount.count || 0;
  const socialEnterprises = seCount.count || 0;
  const contracts = contractStats.data?.[0] || { count: 0, total_value: 0 };
  const justice = justiceStats.data?.[0] || { count: 0, total_value: 0 };
  const donations = donationStats.data?.[0] || { count: 0, total_value: 0 };
  const grants = grantCount.count || 0;
  const foundations = foundationCount.count || 0;
  const enrichedFoundations = foundationEnriched.data?.[0]?.count || 0;
  const ccOrgs = communityControlled.data?.[0]?.count || 0;
  const remote = remoteEntities.data || [];
  const disadvantaged = disadvantagedEntities.data?.[0]?.count || 0;
  const totalRemote = remote.reduce((sum: number, r: { count: number }) => sum + r.count, 0);
  const seContracts = seWithContracts.data?.[0]?.count || 0;
  const coverage = coverageStats.data?.[0] || { total: 0, with_abn: 0, with_postcode: 0, with_remoteness: 0, with_seifa: 0, with_lga: 0 };
  const totalMoney = contracts.total_value + justice.total_value + donations.total_value;

  return (
    <div className="max-w-5xl">
      <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Home
      </Link>

      {/* Hero */}
      <div className="mt-4 mb-8">
        <div className="bg-bauhaus-black border-4 border-bauhaus-black p-6 sm:p-8" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
          <p className="text-xs font-black text-bauhaus-yellow uppercase tracking-[0.3em] mb-3">Live Data</p>
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight mb-3">
            State of the Sector
          </h1>
          <p className="text-white/70 font-medium max-w-2xl leading-relaxed">
            Real-time intelligence from {formatNum(entities)} entities, {formatNum(relationships)} relationships, and {formatMoney(totalMoney)} in tracked financial flows. Updated continuously by 45 autonomous agents.
          </p>
        </div>
      </div>

      {/* Top-line numbers */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-8">
        {[
          { label: 'Entities', value: formatNum(entities), sub: 'Organisations tracked' },
          { label: 'Relationships', value: formatNum(relationships), sub: 'Financial connections' },
          { label: 'Money Tracked', value: formatMoney(totalMoney), sub: 'Contracts + donations + justice' },
          { label: 'Social Enterprises', value: formatNum(socialEnterprises), sub: `${seContracts} hold govt contracts` },
        ].map((stat, i) => (
          <div key={i} className={`p-4 sm:p-5 border-4 border-bauhaus-black ${i > 0 ? 'border-l-0' : ''}`}>
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">{stat.label}</div>
            <div className="text-xl sm:text-2xl font-black text-bauhaus-black">{stat.value}</div>
            <div className="text-xs font-bold text-bauhaus-muted mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Money flows */}
      <div className="border-4 border-bauhaus-black mb-8">
        <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
          <h2 className="text-xs font-black uppercase tracking-[0.2em]">Money Flows</h2>
        </div>
        <div className="divide-y-4 divide-bauhaus-black">
          {[
            { label: 'Federal Contracts', value: contracts.total_value, records: contracts.count, color: 'bg-bauhaus-blue', href: '/contracts' },
            { label: 'Political Donations', value: donations.total_value, records: donations.count, color: 'bg-bauhaus-red', href: '/donations' },
            { label: 'Justice Sector Funding', value: justice.total_value, records: justice.count, color: 'bg-bauhaus-yellow', href: null },
            { label: 'Grant Opportunities', value: null, records: grants, color: 'bg-money', href: '/grants' },
          ].map((flow, i) => {
            const barWidth = flow.value && contracts.total_value > 0
              ? Math.max((flow.value / contracts.total_value) * 100, 1)
              : 5;
            return (
              <div key={i} className="p-4 flex items-center gap-4">
                <div className="w-40 text-sm font-bold text-bauhaus-black">{flow.label}</div>
                <div className="flex-1 h-8 bg-bauhaus-canvas border-2 border-bauhaus-black/20 relative">
                  <div className={`h-full ${flow.color}`} style={{ width: `${barWidth}%` }} />
                </div>
                <div className="w-24 text-right">
                  <div className="text-sm font-black">{flow.value ? formatMoney(flow.value) : '\u2014'}</div>
                  <div className="text-[10px] font-bold text-bauhaus-muted">{formatNum(flow.records)} records</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Entity breakdown + Social enterprise sources */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 mb-8">
        <div className="border-4 border-bauhaus-black">
          <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
            <h2 className="text-xs font-black uppercase tracking-[0.2em]">Entity Types</h2>
          </div>
          <div className="p-4 space-y-3">
            {(entityByType.data || []).map((t: { entity_type: string; count: number }) => {
              const barWidth = entities > 0 ? (t.count / entities) * 100 : 0;
              const colors: Record<string, string> = {
                charity: 'bg-bauhaus-blue',
                company: 'bg-bauhaus-black/60',
                foundation: 'bg-money',
                indigenous_corp: 'bg-bauhaus-red',
                social_enterprise: 'bg-bauhaus-yellow',
                government_body: 'bg-bauhaus-blue/40',
                political_party: 'bg-bauhaus-muted',
              };
              return (
                <div key={t.entity_type} className="flex items-center gap-3">
                  <div className="w-32 text-xs font-bold text-bauhaus-muted capitalize truncate">{t.entity_type.replace(/_/g, ' ')}</div>
                  <div className="flex-1 h-5 bg-bauhaus-canvas border border-bauhaus-black/10 relative">
                    <div className={`h-full ${colors[t.entity_type] || 'bg-bauhaus-muted'}`} style={{ width: `${Math.max(barWidth, 0.5)}%` }} />
                  </div>
                  <div className="w-16 text-right text-xs font-black">{formatNum(t.count)}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-4 border-bauhaus-black sm:border-l-0">
          <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
            <h2 className="text-xs font-black uppercase tracking-[0.2em]">Social Enterprise Sources</h2>
          </div>
          <div className="p-4 space-y-3">
            {(seBySource.data || []).map((s: { source_primary: string; count: number; with_abn: number }) => {
              const barWidth = socialEnterprises > 0 ? (s.count / socialEnterprises) * 100 : 0;
              const abnPct = s.count > 0 ? ((s.with_abn / s.count) * 100).toFixed(0) : '0';
              const labels: Record<string, string> = {
                'supply-nation': 'Supply Nation',
                'oric': 'ORIC',
                'social-traders': 'Social Traders',
                'buyability': 'BuyAbility',
                'b-corp': 'B Corp',
                'kinaway': 'Kinaway',
              };
              return (
                <div key={s.source_primary}>
                  <div className="flex items-center gap-3">
                    <div className="w-32 text-xs font-bold text-bauhaus-muted truncate">{labels[s.source_primary] || s.source_primary}</div>
                    <div className="flex-1 h-5 bg-bauhaus-canvas border border-bauhaus-black/10 relative">
                      <div className="h-full bg-bauhaus-red" style={{ width: `${Math.max(barWidth, 1)}%` }} />
                    </div>
                    <div className="w-16 text-right text-xs font-black">{formatNum(s.count)}</div>
                  </div>
                  <div className="ml-[8.5rem] text-[10px] font-bold text-bauhaus-muted mt-0.5">{abnPct}% ABN resolved</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Community + geographic context */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-8">
        {[
          { label: 'Community Controlled', value: formatNum(ccOrgs), sub: 'Indigenous-governed orgs' },
          { label: 'Remote / Very Remote', value: formatNum(totalRemote), sub: `${remote.map((r: { remoteness: string; count: number }) => `${r.count} ${r.remoteness.replace(' Australia', '')}`).join(', ')}` },
          { label: 'Most Disadvantaged', value: formatNum(disadvantaged), sub: 'SEIFA decile 1-3' },
          { label: 'Foundations', value: formatNum(foundations), sub: `${enrichedFoundations} with descriptions` },
        ].map((stat, i) => (
          <div key={i} className={`p-4 border-4 border-bauhaus-black ${i > 0 ? 'border-l-0' : ''} bg-bauhaus-red/5`}>
            <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">{stat.label}</div>
            <div className="text-xl font-black text-bauhaus-black">{stat.value}</div>
            <div className="text-[10px] font-bold text-bauhaus-muted mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Top LGAs by social enterprise */}
      {(topLgasBySE.data || []).length > 0 && (
        <div className="border-4 border-bauhaus-black mb-8">
          <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
            <h2 className="text-xs font-black uppercase tracking-[0.2em]">Top LGAs by Social Enterprise Density</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-0">
            {(topLgasBySE.data || []).map((lga: { lga_name: string; se_count: number }, i: number) => (
              <div key={lga.lga_name} className={`p-3 ${i > 0 ? 'border-l-4 border-bauhaus-black' : ''} ${i >= 4 ? 'border-t-4 border-bauhaus-black' : ''}`}>
                <div className="text-xs font-bold text-bauhaus-muted truncate">{lga.lga_name}</div>
                <div className="text-lg font-black text-bauhaus-black">{lga.se_count}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data coverage */}
      <div className="border-4 border-bauhaus-black mb-8">
        <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
          <h2 className="text-xs font-black uppercase tracking-[0.2em]">Data Coverage</h2>
        </div>
        <div className="p-4 grid grid-cols-2 sm:grid-cols-5 gap-4">
          {[
            { label: 'ABN', pct: coverage.total > 0 ? (coverage.with_abn / coverage.total * 100) : 0 },
            { label: 'Postcode', pct: coverage.total > 0 ? (coverage.with_postcode / coverage.total * 100) : 0 },
            { label: 'Remoteness', pct: coverage.total > 0 ? (coverage.with_remoteness / coverage.total * 100) : 0 },
            { label: 'SEIFA', pct: coverage.total > 0 ? (coverage.with_seifa / coverage.total * 100) : 0 },
            { label: 'LGA', pct: coverage.total > 0 ? (coverage.with_lga / coverage.total * 100) : 0 },
          ].map((c) => (
            <div key={c.label} className="text-center">
              <div className="text-2xl font-black text-bauhaus-black">{c.pct.toFixed(1)}%</div>
              <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mt-1">{c.label}</div>
              <div className="mt-2 h-2 bg-bauhaus-canvas border border-bauhaus-black/10">
                <div className="h-full bg-money" style={{ width: `${c.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="border-4 border-bauhaus-black bg-bauhaus-black p-6 sm:p-8 text-center">
        <h2 className="text-xl font-black text-white mb-3">Open Infrastructure for the Mission Economy</h2>
        <p className="text-white/70 font-medium max-w-xl mx-auto mb-5 leading-relaxed text-sm">
          Every number above is queryable via API. Every entity has a dossier. Every place has a funding map. Built for procurement teams, commissioners, foundations, and communities.
        </p>
        <div className="flex gap-4 justify-center flex-wrap">
          <Link href="/social-enterprises" className="px-6 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest border-2 border-bauhaus-red hover:bg-white hover:text-bauhaus-black transition-colors">
            Browse Enterprises
          </Link>
          <Link href="/procurement" className="px-6 py-3 bg-bauhaus-blue text-white font-black text-xs uppercase tracking-widest border-2 border-bauhaus-blue hover:bg-white hover:text-bauhaus-black transition-colors">
            Procurement Analyser
          </Link>
          <Link href="/places" className="px-6 py-3 bg-transparent text-white font-black text-xs uppercase tracking-widest border-2 border-white/30 hover:border-white transition-colors">
            Place Intelligence
          </Link>
        </div>
      </div>
    </div>
  );
}
