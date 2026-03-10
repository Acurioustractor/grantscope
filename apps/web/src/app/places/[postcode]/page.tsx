import { getServiceSupabase } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

function formatMoney(amount: number | null): string {
  if (!amount) return '\u2014';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString()}`;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
        {title}
      </h2>
      {children}
    </section>
  );
}

function entityTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    charity: 'Charity', foundation: 'Foundation', company: 'Company',
    government_body: 'Govt', indigenous_corp: 'Indigenous Corp',
    political_party: 'Political', social_enterprise: 'Social Enterprise',
  };
  return labels[type] || type;
}

export default async function PlaceDetailPage({ params }: { params: Promise<{ postcode: string }> }) {
  const { postcode } = await params;
  const supabase = getServiceSupabase();

  // Fetch geo + SEIFA + entities in parallel
  const [{ data: geoData }, { data: seifaData }, { data: entities }] = await Promise.all([
    supabase
      .from('postcode_geo')
      .select('postcode, locality, state, remoteness_2021, sa2_name, sa3_name, lga_name')
      .eq('postcode', postcode)
      .limit(1),
    supabase
      .from('seifa_2021')
      .select('decile_national, score')
      .eq('postcode', postcode)
      .eq('index_type', 'IRSD')
      .limit(1),
    supabase
      .from('gs_entities')
      .select('id, gs_id, canonical_name, entity_type, is_community_controlled, latest_revenue, latest_assets')
      .eq('postcode', postcode)
      .order('latest_revenue', { ascending: false, nullsFirst: false })
      .limit(200),
  ]);

  if (!geoData?.length) notFound();

  const geo = geoData[0];
  const seifa = seifaData?.[0] || null;
  const entityList = entities || [];
  const entityIds = entityList.map(e => e.id);

  // Fetch funding relationships for entities in this postcode
  const recipientFunding = new Map<string, { grants: number; contracts: number; donations: number }>();
  let totalFunding = 0;
  let communityControlledFunding = 0;
  const communityControlledIds = new Set(
    entityList.filter(e => e.is_community_controlled).map(e => e.id)
  );

  if (entityIds.length > 0) {
    for (let i = 0; i < entityIds.length; i += 100) {
      const chunk = entityIds.slice(i, i + 100);
      const { data: rels } = await supabase
        .from('gs_relationships')
        .select('target_entity_id, amount, relationship_type')
        .in('target_entity_id', chunk)
        .in('relationship_type', ['grant', 'contract', 'donation']);

      for (const r of rels || []) {
        const amt = r.amount || 0;
        totalFunding += amt;
        if (communityControlledIds.has(r.target_entity_id)) {
          communityControlledFunding += amt;
        }
        const existing = recipientFunding.get(r.target_entity_id) || { grants: 0, contracts: 0, donations: 0 };
        if (r.relationship_type === 'grant') existing.grants += amt;
        else if (r.relationship_type === 'contract') existing.contracts += amt;
        else existing.donations += amt;
        recipientFunding.set(r.target_entity_id, existing);
      }
    }
  }

  // Fetch justice funding for this postcode
  const { data: justiceFundingData } = await supabase
    .from('justice_funding')
    .select('recipient_name, amount_dollars, program_name, sector')
    .eq('state', geo.state)
    .limit(100);

  const justiceFundingInArea = (justiceFundingData || []).filter(jf => {
    // Match by location or by entity name overlap
    return entityList.some(e =>
      e.canonical_name.toUpperCase().includes(jf.recipient_name?.toUpperCase()?.slice(0, 20) || '')
    );
  });
  const totalJusticeFunding = justiceFundingInArea.reduce((sum, jf) => sum + (jf.amount_dollars || 0), 0);

  // Top recipients
  const topRecipients = entityList
    .map(e => {
      const funding = recipientFunding.get(e.id) || { grants: 0, contracts: 0, donations: 0 };
      return {
        ...e,
        total_funding: funding.grants + funding.contracts + funding.donations,
        grants: funding.grants,
        contracts: funding.contracts,
        donations: funding.donations,
      };
    })
    .sort((a, b) => b.total_funding - a.total_funding)
    .slice(0, 20);

  const communityControlledCount = entityList.filter(e => e.is_community_controlled).length;
  const communityControlledShare = totalFunding > 0
    ? Math.round((communityControlledFunding / totalFunding) * 100)
    : 0;

  // Entity type breakdown
  const byType = new Map<string, number>();
  for (const e of entityList) {
    byType.set(e.entity_type, (byType.get(e.entity_type) || 0) + 1);
  }
  const typeBreakdown = Array.from(byType.entries()).sort((a, b) => b[1] - a[1]);

  // Empathy Ledger storytellers in this area (cross-system bridge)
  interface Storyteller { id: string; full_name: string; bio: string | null; profile_image_url: string | null }
  let storytellers: Storyteller[] = [];
  if (geo.state) {
    const { data: stData } = await supabase
      .from('storytellers')
      .select('id, full_name, bio, profile_image_url, location_id')
      .not('full_name', 'is', null)
      .limit(200);

    if (stData?.length) {
      // Get location IDs that match this state
      const locationIds = stData.filter((s: { location_id: string | null }) => s.location_id).map((s: { location_id: string }) => s.location_id);
      if (locationIds.length > 0) {
        const { data: locs } = await supabase
          .from('locations')
          .select('id, state_province')
          .in('id', locationIds)
          .eq('state_province', geo.state);

        const matchingLocationIds = new Set((locs || []).map((l: { id: string }) => l.id));
        storytellers = (stData as (Storyteller & { location_id: string | null })[])
          .filter(s => s.location_id && matchingLocationIds.has(s.location_id))
          .slice(0, 6);
      }
    }
  }

  // Comparison — find similar postcodes (same remoteness + similar SEIFA)
  let comparisonPostcodes: { postcode: string; locality: string; entity_count: number }[] = [];
  if (seifa && geo.remoteness_2021) {
    const { data: similar } = await supabase
      .from('postcode_geo')
      .select('postcode, locality')
      .eq('remoteness_2021', geo.remoteness_2021)
      .neq('postcode', postcode)
      .limit(50);

    if (similar?.length) {
      const similarPostcodes = similar.map(s => s.postcode);
      // Count entities per similar postcode
      const { data: counts } = await supabase
        .from('gs_entities')
        .select('postcode')
        .in('postcode', similarPostcodes.slice(0, 20));

      const countMap = new Map<string, number>();
      for (const c of counts || []) {
        countMap.set(c.postcode, (countMap.get(c.postcode) || 0) + 1);
      }

      comparisonPostcodes = similar
        .filter(s => countMap.has(s.postcode))
        .map(s => ({
          postcode: s.postcode,
          locality: s.locality || '',
          entity_count: countMap.get(s.postcode) || 0,
        }))
        .sort((a, b) => b.entity_count - a.entity_count)
        .slice(0, 6);
    }
  }

  return (
    <div className="max-w-5xl">
      <Link href="/places" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Community Funding Map
      </Link>

      {/* Header */}
      <div className="mt-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">
          {geo.locality || postcode}, {geo.state}
        </h1>
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <span className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black uppercase tracking-widest">
            {postcode}
          </span>
          {geo.remoteness_2021 && (
            <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${
              geo.remoteness_2021.includes('Very Remote') ? 'border-bauhaus-red bg-error-light text-bauhaus-red' :
              geo.remoteness_2021.includes('Remote') ? 'border-orange-500 bg-orange-50 text-orange-700' :
              'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black'
            }`}>
              {geo.remoteness_2021}
            </span>
          )}
          {seifa && (
            <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${
              seifa.decile_national <= 2 ? 'border-bauhaus-red bg-error-light text-bauhaus-red' :
              seifa.decile_national <= 4 ? 'border-orange-500 bg-orange-50 text-orange-700' :
              'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-black'
            }`}>
              SEIFA Decile {seifa.decile_national}/10
            </span>
          )}
          {geo.lga_name && (
            <span className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-blue/30 bg-blue-50 text-bauhaus-blue uppercase tracking-widest">
              LGA: {geo.lga_name}
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-0 mb-8 border-4 border-bauhaus-black">
        <div className="p-4 border-r-2 border-b-2 sm:border-b-0 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Entities</div>
          <div className="text-2xl font-black text-bauhaus-black">{entityList.length}</div>
        </div>
        <div className="p-4 border-b-2 sm:border-b-0 sm:border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Total Funding</div>
          <div className="text-2xl font-black text-bauhaus-black">{formatMoney(totalFunding)}</div>
        </div>
        <div className="p-4 border-r-2 border-bauhaus-black/10">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Community-Controlled</div>
          <div className="text-2xl font-black text-bauhaus-black">{communityControlledCount}</div>
        </div>
        <div className="p-4">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">CC Funding Share</div>
          <div className={`text-2xl font-black ${communityControlledShare < 30 ? 'text-bauhaus-red' : communityControlledShare < 60 ? 'text-orange-600' : 'text-money'}`}>
            {communityControlledShare}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          {/* Top Recipients */}
          {topRecipients.length > 0 && (
            <Section title="Top Funded Entities">
              <div className="space-y-0">
                {topRecipients.filter(r => r.total_funding > 0).map((r, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <Link href={`/entities/${r.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue truncate block">
                        {r.canonical_name}
                      </Link>
                      <div className="text-[11px] text-bauhaus-muted font-medium">
                        {entityTypeLabel(r.entity_type)}
                        {r.is_community_controlled && (
                          <span className="ml-1 text-money font-black">&middot; Community-Controlled</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4">
                      <div className="font-black text-bauhaus-black">{formatMoney(r.total_funding)}</div>
                      <div className="text-[10px] text-bauhaus-muted font-medium">
                        {r.grants > 0 && `G: ${formatMoney(r.grants)} `}
                        {r.contracts > 0 && `C: ${formatMoney(r.contracts)} `}
                        {r.donations > 0 && `D: ${formatMoney(r.donations)}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Justice Funding */}
          {justiceFundingInArea.length > 0 && (
            <Section title={`Justice Funding (${formatMoney(totalJusticeFunding)})`}>
              <div className="space-y-0">
                {justiceFundingInArea.slice(0, 10).map((jf, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-bauhaus-black text-sm truncate">{jf.recipient_name}</div>
                      <div className="text-[11px] text-bauhaus-muted font-medium">
                        {jf.program_name}
                        {jf.sector && <span> &middot; <span className="capitalize">{jf.sector.replace(/_/g, ' ')}</span></span>}
                      </div>
                    </div>
                    {jf.amount_dollars && (
                      <div className="text-right ml-4">
                        <div className="font-black text-bauhaus-black">{formatMoney(jf.amount_dollars)}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* All Entities */}
          <Section title={`All Entities (${entityList.length})`}>
            <div className="space-y-0">
              {entityList.slice(0, 30).map((e, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-bauhaus-black/5 last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <Link href={`/entities/${e.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue text-sm truncate block">
                      {e.canonical_name}
                    </Link>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    {e.is_community_controlled && (
                      <span className="text-[10px] font-black text-money uppercase tracking-widest">CC</span>
                    )}
                    <span className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest whitespace-nowrap">
                      {entityTypeLabel(e.entity_type)}
                    </span>
                  </div>
                </div>
              ))}
              {entityList.length > 30 && (
                <div className="text-xs font-bold text-bauhaus-muted mt-3">
                  + {entityList.length - 30} more entities
                </div>
              )}
            </div>
          </Section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* SEIFA Context */}
          {seifa && (
            <div className={`border-4 p-4 ${seifa.decile_national <= 3 ? 'border-bauhaus-red bg-error-light' : 'border-bauhaus-black bg-white'}`}>
              <h3 className="text-sm font-black mb-3 pb-2 border-b-4 uppercase tracking-widest"
                style={{ borderColor: seifa.decile_national <= 3 ? '#dc2626' : '#000' }}>
                Disadvantage Index
              </h3>
              <div className="text-center mb-3">
                <div className={`text-4xl font-black ${seifa.decile_national <= 3 ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>
                  {seifa.decile_national}<span className="text-lg text-bauhaus-muted">/10</span>
                </div>
                <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">SEIFA IRSD Decile</div>
              </div>
              <p className="text-[10px] text-bauhaus-muted leading-relaxed">
                {seifa.decile_national <= 2
                  ? 'This area is in the most disadvantaged 20% nationally. Community-controlled funding is critical here.'
                  : seifa.decile_national <= 5
                  ? 'This area has moderate socio-economic disadvantage.'
                  : 'This area has relatively low socio-economic disadvantage.'}
              </p>
            </div>
          )}

          {/* Entity Type Breakdown */}
          <div className="bg-white border-4 border-bauhaus-black p-4">
            <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
              Entity Types
            </h3>
            <dl className="space-y-2">
              {typeBreakdown.map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <dt className="text-xs font-bold text-bauhaus-muted capitalize">{entityTypeLabel(type)}</dt>
                  <dd className="text-sm font-black text-bauhaus-black">{count}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Community-Controlled Gap Alert */}
          {communityControlledCount === 0 && entityList.length > 5 && (
            <div className="bg-error-light border-4 border-bauhaus-red p-4">
              <h3 className="text-sm font-black text-bauhaus-red mb-2 uppercase tracking-widest">
                Gap Alert
              </h3>
              <p className="text-xs font-medium text-bauhaus-black leading-relaxed">
                This postcode has {entityList.length} funded entities but no identified community-controlled organisations receiving funding. This may indicate a gap in community self-determination.
              </p>
            </div>
          )}

          {/* Community Voice (Empathy Ledger cross-system) */}
          {storytellers.length > 0 && (
            <div className="bg-white border-4 border-bauhaus-blue p-4">
              <h3 className="text-sm font-black text-bauhaus-blue mb-3 pb-2 border-b-4 border-bauhaus-blue uppercase tracking-widest">
                Community Voice
              </h3>
              <div className="space-y-3">
                {storytellers.map((st) => (
                  <div key={st.id} className="flex items-start gap-3">
                    {st.profile_image_url && (
                      <img src={st.profile_image_url} alt="" className="w-8 h-8 object-cover border-2 border-bauhaus-black shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-bauhaus-black">{st.full_name}</div>
                      {st.bio && (
                        <p className="text-[11px] text-bauhaus-muted font-medium line-clamp-2 mt-0.5">{st.bio}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-[10px] text-bauhaus-muted leading-relaxed">
                Community voices from Empathy Ledger — lived experience linked to place.
              </div>
            </div>
          )}

          {/* Comparison */}
          {comparisonPostcodes.length > 0 && (
            <div className="bg-white border-4 border-bauhaus-black p-4">
              <h3 className="text-sm font-black text-bauhaus-black mb-3 pb-2 border-b-4 border-bauhaus-black uppercase tracking-widest">
                Similar Areas
              </h3>
              <div className="space-y-2">
                {comparisonPostcodes.map((cp) => (
                  <Link
                    key={cp.postcode}
                    href={`/places/${cp.postcode}`}
                    className="flex justify-between items-center py-1.5 hover:text-bauhaus-blue"
                  >
                    <span className="text-sm font-bold">{cp.locality || cp.postcode}</span>
                    <span className="text-xs font-black text-bauhaus-muted">{cp.entity_count} entities</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
