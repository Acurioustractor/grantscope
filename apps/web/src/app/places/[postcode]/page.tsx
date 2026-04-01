import { getServiceSupabase } from '@/lib/supabase';
import { safeOptionalData } from '@/lib/optional-data';
import { createGovernedProofService } from '@/lib/governed-proof/service';
import { getProofPack } from '@/lib/governed-proof/presentation';
import { getPlaceBrief } from '@/lib/services/place-brief-service';
import { getPlaceDataLayers } from '@/lib/services/place-data-service';
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

function formatPercent(value: number | null | undefined): string {
  if (value == null) return '\u2014';
  return `${Math.round(value)}%`;
}

function districtLabel(name: string): string {
  return name.replace(/~[A-Z]+$/, '');
}

function validNdisDistrict(name: string | null | undefined): name is string {
  if (!name) return false;
  const normalized = districtLabel(name).trim();
  return normalized.length > 0 &&
    normalized !== 'ALL' &&
    normalized !== 'Other' &&
    normalized !== 'Other Territories' &&
    !normalized.toLowerCase().includes('missing') &&
    !normalized.startsWith('OT_');
}

function hasDisabilitySignal(values: Array<string | null | undefined> | null | undefined): boolean {
  if (!values || values.length === 0) return false;
  return values.some((value) => {
    const normalized = String(value || '').toLowerCase();
    return normalized.includes('disab') || normalized.includes('ndis') || normalized.includes('mental illness');
  });
}

interface NdisSupplyRow {
  state_code: string;
  service_district_name: string;
  provider_count: number;
  report_date: string | null;
}

interface NdisConcentrationRow {
  state_code: string;
  service_district_name: string;
  payment_share_top10_pct: number | null;
  payment_band: string | null;
  source_page_url: string | null;
  source_file_url: string | null;
  source_file_title: string | null;
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
  const governedProofService = createGovernedProofService();

  // Fetch geo + SEIFA + entities + social enterprises in parallel
  const [{ data: geoData }, { data: seifaData }, { data: entities }, { data: socialEnterprises }, governedProofBundle, { data: grantData }] = await Promise.all([
    supabase
      .from('postcode_geo')
      .select('postcode, locality, state, remoteness_2021, sa2_code, sa2_name, sa3_name, lga_name, lga_code')
      .eq('postcode', postcode)
      .not('state', 'is', null)
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
    supabase
      .from('social_enterprises')
      .select('id, name, abn, org_type, source_primary, certifications, sector, target_beneficiaries, business_model, website')
      .eq('postcode', postcode)
      .order('name')
      .limit(50),
    governedProofService.getBundleByKey(`place:${postcode}`),
    supabase
      .from('grant_opportunities')
      .select('id, name, amount_min, amount_max, deadline, closes_at, categories, source, program_type')
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(500),
  ]);

  if (!geoData?.length) notFound();

  const geo = geoData[0];
  const stateCode = typeof geo.state === 'string' && geo.state.trim().length > 0 ? geo.state : null;
  const placeTitle = stateCode ? `${geo.locality || postcode}, ${stateCode}` : (geo.locality || postcode);
  const socialEnterprisesHref = stateCode ? `/social-enterprises?state=${encodeURIComponent(stateCode)}` : '/social-enterprises';
  const socialEnterprisesLabel = stateCode ? `Browse all in ${stateCode} \u2192` : 'Browse all enterprises \u2192';
  const seifa = seifaData?.[0] || null;
  const entityList = entities || [];
  const entityIds = entityList.map(e => e.id);

  // Social enterprises: combine postcode matches + ABN matches from entity list
  const seList = socialEnterprises || [];
  const seAbns = new Set(seList.map((se: { abn: string | null }) => se.abn).filter(Boolean));
  const entityAbns = entityList.map(e => (e as unknown as { abn: string | null }).abn).filter(Boolean) as string[];
  // Fetch any additional SEs that match entity ABNs but different postcode
  let additionalSEs: typeof seList = [];
  if (entityAbns.length > 0) {
    const missingAbns = entityAbns.filter(abn => !seAbns.has(abn));
    if (missingAbns.length > 0) {
      const { data: extraSEs } = await supabase
        .from('social_enterprises')
        .select('id, name, abn, org_type, source_primary, certifications, sector, target_beneficiaries, business_model, website')
        .in('abn', missingAbns.slice(0, 50));
      additionalSEs = extraSEs || [];
    }
  }
  const allSocialEnterprises = [...seList, ...additionalSEs];
  const disabilityFocusedSocialEnterprises = allSocialEnterprises.filter((socialEnterprise: {
    target_beneficiaries?: string[] | null;
    sector?: string[] | null;
  }) => hasDisabilitySignal(socialEnterprise.target_beneficiaries) || hasDisabilitySignal(socialEnterprise.sector));

  let ndisStateSupplyTotal: NdisSupplyRow | null = null;
  let ndisStateDistricts: NdisSupplyRow[] = [];
  let ndisStateHotspots: NdisConcentrationRow[] = [];
  let ndisThinDistrictCount = 0;
  let ndisVeryThinDistrictCount = 0;
  let ndisStateDisabilityEnterpriseCount = 0;
  let ndisSourceLink: string | null = null;

  if (stateCode) {
    const [
      { data: ndisStateSupplyData },
      { data: ndisDistrictData },
      { data: ndisConcentrationData },
      { count: stateDisabilityEnterpriseCount },
    ] = await Promise.all([
      supabase
        .from('v_ndis_provider_supply_summary')
        .select('report_date, state_code, service_district_name, provider_count')
        .eq('state_code', stateCode)
        .eq('service_district_name', 'ALL')
        .limit(1),
      supabase
        .from('v_ndis_provider_supply_summary')
        .select('report_date, state_code, service_district_name, provider_count')
        .eq('state_code', stateCode)
        .neq('service_district_name', 'ALL')
        .neq('service_district_name', 'Other')
        .not('service_district_name', 'ilike', '%Missing%')
        .order('provider_count', { ascending: true }),
      supabase
        .from('ndis_market_concentration')
        .select('state_code, service_district_name, payment_share_top10_pct, payment_band, source_page_url, source_file_url, source_file_title')
        .eq('state_code', stateCode)
        .eq('support_class', 'Core')
        .neq('service_district_name', 'ALL')
        .neq('service_district_name', 'Other')
        .not('service_district_name', 'ilike', '%Missing%')
        .not('payment_share_top10_pct', 'is', null)
        .order('payment_share_top10_pct', { ascending: false }),
      supabase
        .from('social_enterprises')
        .select('id', { count: 'exact', head: true })
        .eq('state', stateCode)
        .overlaps('target_beneficiaries', ['People with disabilities', 'people_with_disability']),
    ]);

    ndisStateSupplyTotal = ((ndisStateSupplyData || [])[0] as NdisSupplyRow | undefined) || null;
    ndisStateDistricts = ((ndisDistrictData || []) as NdisSupplyRow[]).filter((row) => validNdisDistrict(row.service_district_name));
    ndisThinDistrictCount = ndisStateDistricts.filter((row) => row.provider_count < 100).length;
    ndisVeryThinDistrictCount = ndisStateDistricts.filter((row) => row.provider_count < 50).length;
    ndisStateDisabilityEnterpriseCount = stateDisabilityEnterpriseCount || 0;

    const districtNameByLabel = new Map<string, string>();
    for (const row of ndisStateDistricts) {
      districtNameByLabel.set(districtLabel(row.service_district_name), row.service_district_name);
    }

    const concentrationByDistrict = new Map<string, NdisConcentrationRow>();
    for (const row of (ndisConcentrationData || []) as NdisConcentrationRow[]) {
      if (!validNdisDistrict(row.service_district_name)) continue;
      const normalizedDistrict = districtLabel(row.service_district_name);
      if (!districtNameByLabel.has(normalizedDistrict)) continue;
      const key = `${row.state_code}:${normalizedDistrict}`;
      const current = concentrationByDistrict.get(key);
      if (!current || (row.payment_share_top10_pct || 0) > (current.payment_share_top10_pct || 0)) {
        concentrationByDistrict.set(key, {
          ...row,
          service_district_name: districtNameByLabel.get(normalizedDistrict) || normalizedDistrict,
        });
      }
    }
    ndisStateHotspots = Array.from(concentrationByDistrict.values())
      .sort((a, b) => (b.payment_share_top10_pct || 0) - (a.payment_share_top10_pct || 0))
      .slice(0, 4);
    ndisSourceLink =
      ndisStateHotspots.find((row) => row.source_file_url || row.source_page_url)?.source_file_url ||
      ndisStateHotspots.find((row) => row.source_page_url)?.source_page_url ||
      null;
  }

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
    const stData = await safeOptionalData(
      supabase
        .from('storytellers')
        .select('id, full_name, bio, profile_image_url, location_id')
        .not('full_name', 'is', null)
        .limit(200),
      [] as Array<Storyteller & { location_id: string | null }>,
    );

    if (stData.length > 0) {
      // Get location IDs that match this state
      const locationIds = stData
        .filter((s) => !!s.location_id)
        .map((s) => s.location_id as string);
      if (locationIds.length > 0) {
        const locs = await safeOptionalData(
          supabase
            .from('locations')
            .select('id, state_province')
            .in('id', locationIds)
            .eq('state_province', geo.state),
          [] as Array<{ id: string; state_province: string | null }>,
        );

        const matchingLocationIds = new Set(locs.map((l: { id: string }) => l.id));
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

  // Place Brief — EL transcripts + ALMA interventions + alignment score
  // Place Data Layers — crime, schools, NDIS participants, DSS payments
  const [placeBrief, dataLayers] = await Promise.all([
    getPlaceBrief(supabase, postcode, geo.locality, geo.state),
    getPlaceDataLayers(supabase, postcode, geo.lga_name, geo.lga_code, geo.state),
  ]);

  // Filter grants relevant to this area (by state match or national scope)
  const now = new Date().toISOString().slice(0, 10);
  const relevantGrants = (grantData || [])
    .filter((g: { deadline?: string | null; closes_at?: string | null }) => {
      const deadline = g.deadline || g.closes_at;
      return !deadline || deadline >= now; // Include grants with no deadline or future deadlines
    })
    .filter((g: { categories?: string[] | null; source?: string | null }) => {
      // Basic relevance: prefer grants that match entity types in this postcode
      return true; // Show all — more sophisticated matching can come later
    })
    .slice(0, 8) as Array<{
      id: string;
      name: string;
      amount_min: number | null;
      amount_max: number | null;
      deadline: string | null;
      closes_at: string | null;
      categories: string[] | null;
      source: string | null;
      program_type: string | null;
    }>;

  const publicGovernedProofBundle =
    governedProofBundle && ['partner', 'public'].includes(governedProofBundle.promotionStatus)
      ? governedProofBundle
      : null;
  const proofPack = publicGovernedProofBundle ? getProofPack(publicGovernedProofBundle) : null;
  const fundingSnapshot = (proofPack?.fundingSnapshot || {}) as Record<string, unknown>;
  const evidenceSnapshot = (proofPack?.evidenceSnapshot || {}) as Record<string, unknown>;
  const voiceSnapshot = (proofPack?.voiceSnapshot || {}) as Record<string, unknown>;
  const strengths = proofPack ? proofPack.strengths.slice(0, 3) : [];

  return (
    <div className="max-w-5xl">
      <Link href="/places" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Community Funding Map
      </Link>

      {/* Header */}
      <div className="mt-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-black text-bauhaus-black">
          {placeTitle}
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
          {geo.sa2_code && (
            <Link
              href={`/power?sa2=${geo.sa2_code}`}
              className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-black bg-bauhaus-canvas text-bauhaus-black uppercase tracking-widest hover:bg-bauhaus-yellow transition-colors"
            >
              View on Power Map
            </Link>
          )}
          {placeBrief.alignment.score > 0 && (
            <span className={`text-[11px] font-black px-2.5 py-1 border-2 uppercase tracking-widest ${
              placeBrief.alignment.score >= 75 ? 'border-money bg-money-light text-money' :
              placeBrief.alignment.score >= 50 ? 'border-bauhaus-blue bg-link-light text-bauhaus-blue' :
              placeBrief.alignment.score >= 25 ? 'border-orange-500 bg-orange-50 text-orange-700' :
              'border-bauhaus-red bg-error-light text-bauhaus-red'
            }`}>
              Alignment {placeBrief.alignment.score}/100
            </span>
          )}
          <a
            href={`/api/places/${postcode}/brief`}
            className="text-[11px] font-black px-2.5 py-1 border-2 border-bauhaus-black bg-bauhaus-black text-white uppercase tracking-widest hover:bg-bauhaus-blue hover:border-bauhaus-blue transition-colors"
          >
            Download Place Brief (PDF)
          </a>
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

      {publicGovernedProofBundle && (
        <div className="mb-8 border-4 border-bauhaus-blue bg-white">
          <div className="grid gap-0 lg:grid-cols-[1.4fr_0.6fr]">
            <div className="p-5 border-b-4 lg:border-b-0 lg:border-r-4 border-bauhaus-blue">
              <div className="flex items-center justify-between gap-4 mb-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.25em] text-bauhaus-blue mb-1">
                    Governed Proof
                  </div>
                  <h2 className="text-xl font-black text-bauhaus-black">
                    This place has a governed proof layer
                  </h2>
                </div>
                <span className="text-[10px] font-black px-2.5 py-1 border-2 border-bauhaus-blue bg-link-light text-bauhaus-blue uppercase tracking-widest">
                  {publicGovernedProofBundle.promotionStatus}
                </span>
              </div>
              <p className="text-sm text-bauhaus-muted leading-relaxed mb-4">
                {proofPack && typeof proofPack.headline === 'string'
                  ? proofPack.headline
                  : `This postcode has a promoted governed-proof bundle joining capital, evidence, and community voice.`}
              </p>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="border-2 border-bauhaus-black p-3 bg-bauhaus-canvas">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">Capital</div>
                  <div className="text-lg font-black text-bauhaus-black">
                    {formatMoney(typeof fundingSnapshot.totalFunding === 'number' ? fundingSnapshot.totalFunding : null)}
                  </div>
                </div>
                <div className="border-2 border-bauhaus-black p-3 bg-bauhaus-canvas">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">Evidence</div>
                  <div className="text-lg font-black text-bauhaus-black">
                    {typeof evidenceSnapshot.interventionCount === 'number' ? evidenceSnapshot.interventionCount : 0} interventions
                  </div>
                </div>
                <div className="border-2 border-bauhaus-black p-3 bg-bauhaus-canvas">
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">Voice</div>
                  <div className="text-lg font-black text-bauhaus-black">
                    {typeof voiceSnapshot.publishableStoryCount === 'number' ? voiceSnapshot.publishableStoryCount : 0} stories
                  </div>
                </div>
              </div>
              {strengths.length > 0 && (
                <div className="mt-4 space-y-1">
                  {strengths.map((strength) => (
                    <div key={String(strength)} className="text-xs font-medium text-bauhaus-black">
                      {'\u25CF'} {String(strength)}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-5 bg-link-light flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-blue mb-2">
                  User Path
                </div>
                <p className="text-sm text-bauhaus-black font-medium leading-relaxed">
                  Start in place context here, then open the governed proof view for a funder-ready summary shaped from GrantScope, JusticeHub, and Empathy Ledger.
                </p>
              </div>
              <Link
                href={`/for/funders/proof/${postcode}`}
                className="mt-4 inline-block px-4 py-3 text-center font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black bg-white hover:bg-bauhaus-yellow transition-colors"
              >
                Open Governed Proof
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Social Enterprise callout */}
      {allSocialEnterprises.length > 0 && (
        <div className="mb-8 border-4 border-bauhaus-blue bg-bauhaus-blue/5 p-4 flex items-center justify-between">
          <div>
            <span className="text-sm font-black text-bauhaus-black">{allSocialEnterprises.length} social & Indigenous enterprises</span>
            <span className="text-sm text-bauhaus-muted font-medium ml-2">operating in this area</span>
          </div>
          <Link href={socialEnterprisesHref} className="text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:underline">
            Browse &rarr;
          </Link>
        </div>
      )}

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

          {/* Evidence-Funding Alignment */}
          {placeBrief.alignment.evidenceCount > 0 && (
            <Section title="Evidence-Funding Alignment">
              <div className="border-4 p-4 mb-4" style={{
                borderColor: placeBrief.alignment.score >= 75 ? '#0f9968' : placeBrief.alignment.score >= 50 ? '#1c47d1' : placeBrief.alignment.score >= 25 ? '#f97316' : '#de1c1e',
              }}>
                <div className="flex items-center gap-4 mb-3">
                  <div className={`text-4xl font-black ${
                    placeBrief.alignment.score >= 75 ? 'text-money' :
                    placeBrief.alignment.score >= 50 ? 'text-bauhaus-blue' :
                    placeBrief.alignment.score >= 25 ? 'text-orange-500' :
                    'text-bauhaus-red'
                  }`}>
                    {placeBrief.alignment.score}<span className="text-lg text-bauhaus-muted">/100</span>
                  </div>
                  <div>
                    <div className="text-sm font-black text-bauhaus-black">{placeBrief.alignment.label}</div>
                    <div className="text-xs text-bauhaus-muted">{placeBrief.alignment.detail}</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-bauhaus-canvas border-2 border-bauhaus-black p-3">
                    <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Interventions</div>
                    <div className="text-xl font-black text-bauhaus-black">{placeBrief.alignment.evidenceCount}</div>
                  </div>
                  <div className="bg-bauhaus-canvas border-2 border-bauhaus-black p-3">
                    <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Funded</div>
                    <div className="text-xl font-black text-money">{placeBrief.alignment.fundedEvidenceCount}</div>
                  </div>
                  <div className="bg-bauhaus-canvas border-2 border-bauhaus-black p-3">
                    <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Voice Records</div>
                    <div className="text-xl font-black text-bauhaus-blue">{placeBrief.alignment.transcriptCount}</div>
                  </div>
                </div>
              </div>

              {/* Interventions list */}
              <div className="space-y-0">
                {placeBrief.interventions.map((intervention, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-bauhaus-black text-sm">{intervention.name}</div>
                      <div className="text-[11px] text-bauhaus-muted font-medium">
                        {intervention.type} &middot; {intervention.evidence_level}
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 uppercase tracking-widest ${
                      intervention.linked
                        ? 'border border-money/30 bg-money-light text-money'
                        : 'border border-bauhaus-red/30 bg-error-light text-bauhaus-red'
                    }`}>
                      {intervention.linked ? 'Funded' : 'Unfunded'}
                    </span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Community Voice — EL Transcripts */}
          {placeBrief.transcripts.length > 0 && (
            <Section title={`Community Voice (${placeBrief.transcripts.length} Transcripts)`}>
              <p className="text-xs text-bauhaus-muted mb-4">
                First-person accounts from Empathy Ledger, recorded in {placeTitle}. These are community members speaking about their lived experience with services and systems.
              </p>
              <div className="space-y-0">
                {placeBrief.transcripts.map((transcript) => (
                  <div key={transcript.id} className="py-4 border-b-2 border-bauhaus-black/5 last:border-b-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-black text-bauhaus-black text-sm">{transcript.storyteller_name}</span>
                      {transcript.has_video && (
                        <span className="text-[10px] font-black px-1.5 py-0.5 border border-bauhaus-blue/30 bg-link-light text-bauhaus-blue uppercase tracking-wider">Video</span>
                      )}
                      <span className="text-[10px] text-bauhaus-muted font-medium">{transcript.word_count.toLocaleString()} words</span>
                    </div>
                    {transcript.title !== transcript.storyteller_name && (
                      <div className="text-xs font-bold text-bauhaus-muted mb-1">{transcript.title}</div>
                    )}
                    {transcript.excerpt && (
                      <p className="text-sm text-bauhaus-black/70 leading-relaxed italic">
                        &ldquo;{transcript.excerpt}&rdquo;
                      </p>
                    )}
                    {transcript.themes && transcript.themes.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {transcript.themes.slice(0, 4).map((theme, ti) => (
                          <span key={ti} className="text-[10px] px-1.5 py-0.5 bg-bauhaus-canvas text-bauhaus-black font-bold border border-bauhaus-black/10">{theme}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}

          {stateCode && (
            <Section title="NDIS Supply & Service Pressure">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <div className="border-2 border-bauhaus-black p-3 bg-bauhaus-canvas">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">State Providers</div>
                  <div className="text-2xl font-black text-bauhaus-black">{ndisStateSupplyTotal?.provider_count?.toLocaleString() || '\u2014'}</div>
                </div>
                <div className="border-2 border-bauhaus-black p-3 bg-bauhaus-canvas">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Thin Districts</div>
                  <div className="text-2xl font-black text-bauhaus-blue">{ndisThinDistrictCount}</div>
                </div>
                <div className="border-2 border-bauhaus-black p-3 bg-bauhaus-canvas">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Very Thin</div>
                  <div className="text-2xl font-black text-bauhaus-red">{ndisVeryThinDistrictCount}</div>
                </div>
                <div className="border-2 border-bauhaus-black p-3 bg-bauhaus-canvas">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Local Disability Delivery</div>
                  <div className="text-2xl font-black text-bauhaus-black">{disabilityFocusedSocialEnterprises.length}</div>
                  <div className="text-[10px] text-bauhaus-muted font-medium mt-1">
                    {ndisStateDisabilityEnterpriseCount.toLocaleString()} disability-focused enterprises in {stateCode}
                  </div>
                </div>
              </div>
              <p className="text-sm text-bauhaus-muted leading-relaxed mb-4">
                NDIS money is not the same thing as healthy service coverage. This view shows whether {placeTitle} sits inside a state market with thin provider supply, captured payment flows, and too few local disability-focused or community-controlled alternatives.
                {totalJusticeFunding > 0 && ` This matters here because ${placeTitle} already shows ${formatMoney(totalJusticeFunding)} in justice-related funding moving through local entities.`}
              </p>
              <div className="grid gap-4 md:grid-cols-2 mb-4">
                <div className="border-2 border-bauhaus-black p-4">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Thinnest Districts In {stateCode}</div>
                  <div className="space-y-2">
                    {ndisStateDistricts.slice(0, 4).map((district) => (
                      <div key={district.service_district_name} className="flex items-center justify-between text-sm">
                        <span className="font-bold text-bauhaus-black">{district.service_district_name}</span>
                        <span className="font-mono font-black text-bauhaus-blue">{district.provider_count.toLocaleString()} providers</span>
                      </div>
                    ))}
                    {ndisStateDistricts.length === 0 && (
                      <div className="text-sm font-medium text-bauhaus-muted">No thin district data available.</div>
                    )}
                  </div>
                </div>
                <div className="border-2 border-bauhaus-black p-4">
                  <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Captured Markets</div>
                  <div className="space-y-2">
                    {ndisStateHotspots.slice(0, 4).map((district) => (
                      <div key={`${district.state_code}:${district.service_district_name}`} className="flex items-center justify-between text-sm">
                        <span className="font-bold text-bauhaus-black">{district.service_district_name}</span>
                        <span className="font-mono font-black text-bauhaus-red">{formatPercent(district.payment_share_top10_pct)}</span>
                      </div>
                    ))}
                    {ndisStateHotspots.length === 0 && (
                      <div className="text-sm font-medium text-bauhaus-muted">No concentration data available.</div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href="/reports/ndis-market" className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-yellow transition-colors">
                  Open NDIS Market
                </Link>
                <Link href="/funding-workspace" className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-money-light transition-colors">
                  Open Funding Workspace
                </Link>
                <Link href="/reports/youth-justice" className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-link-light transition-colors">
                  Compare With Youth Justice
                </Link>
                {ndisSourceLink && (
                  <a href={ndisSourceLink} target="_blank" rel="noopener noreferrer" className="px-3 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-link-light transition-colors">
                    Source Dataset
                  </a>
                )}
              </div>
            </Section>
          )}

          {/* Social Enterprises in Area */}
          {allSocialEnterprises.length > 0 && (
            <Section title={`Social & Indigenous Enterprises (${allSocialEnterprises.length})`}>
              <div className="space-y-0">
                {allSocialEnterprises.map((se: { id: string; name: string; abn: string | null; org_type: string; source_primary: string | null; certifications: Array<{ body: string }> | null; sector: string[] | null; business_model: string | null; website: string | null }) => {
                  const isIndigenous = se.source_primary === 'supply-nation' || se.source_primary === 'oric' || se.source_primary === 'kinaway';
                  const sourceLabels: Record<string, string> = { 'supply-nation': 'Supply Nation', 'oric': 'ORIC', 'social-traders': 'Social Traders', 'buyability': 'BuyAbility', 'b-corp': 'B Corp', 'kinaway': 'Kinaway' };
                  return (
                    <div key={se.id} className="py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-bauhaus-black text-sm">{se.name}</div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {isIndigenous && (
                              <span className="text-[10px] px-1.5 py-0.5 font-black uppercase tracking-wider border border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red">Indigenous</span>
                            )}
                            {se.source_primary && (
                              <span className="text-[10px] px-1.5 py-0.5 font-bold border border-bauhaus-black/20 text-bauhaus-muted">{sourceLabels[se.source_primary] || se.source_primary}</span>
                            )}
                            {se.abn && (
                              <span className="text-[10px] px-1.5 py-0.5 font-bold border border-money/30 text-money">ABN {se.abn}</span>
                            )}
                          </div>
                          {se.business_model && (
                            <p className="text-xs text-bauhaus-muted mt-1 line-clamp-1">{se.business_model}</p>
                          )}
                        </div>
                        {se.website && (
                          <a href={se.website} target="_blank" rel="noopener noreferrer" className="text-[10px] font-black text-bauhaus-blue uppercase tracking-wider hover:underline shrink-0">Web</a>
                        )}
                      </div>
                      {se.sector && se.sector.length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {Array.from(new Set(se.sector)).slice(0, 4).map((s: string, index: number) => (
                            <span key={`${se.id}-${s}-${index}`} className="text-[10px] px-1.5 py-0.5 bg-bauhaus-canvas text-bauhaus-black font-bold border border-bauhaus-black/10 capitalize">{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <Link href={socialEnterprisesHref} className="inline-block mt-3 text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:underline">
                {socialEnterprisesLabel}
              </Link>
            </Section>
          )}

          {/* Grant Opportunities */}
          {relevantGrants.length > 0 && (
            <Section title="Grant Opportunities">
              <p className="text-xs text-bauhaus-muted mb-3">
                Funding opportunities that may be relevant to organisations in {placeTitle}.
              </p>
              <div className="space-y-0">
                {relevantGrants.map((g) => (
                  <div key={g.id} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-bauhaus-black text-sm truncate">{g.name}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {g.source && (
                          <span className="text-[10px] px-1.5 py-0.5 font-bold border border-bauhaus-black/20 text-bauhaus-muted">{g.source}</span>
                        )}
                        {g.program_type && (
                          <span className="text-[10px] px-1.5 py-0.5 font-bold border border-bauhaus-blue/30 text-bauhaus-blue">{g.program_type}</span>
                        )}
                        {g.categories?.slice(0, 2).map((cat, ci) => (
                          <span key={ci} className="text-[10px] px-1.5 py-0.5 bg-bauhaus-canvas text-bauhaus-black font-bold border border-bauhaus-black/10 capitalize">{cat}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      {(g.amount_min || g.amount_max) && (
                        <div className="font-black text-bauhaus-black text-sm">
                          {g.amount_min && g.amount_max
                            ? `${formatMoney(g.amount_min)}–${formatMoney(g.amount_max)}`
                            : formatMoney(g.amount_max || g.amount_min)}
                        </div>
                      )}
                      {(g.deadline || g.closes_at) && (
                        <div className="text-[10px] text-bauhaus-muted font-bold">
                          Closes {g.deadline || g.closes_at}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href={stateCode ? `/grants?state=${encodeURIComponent(stateCode)}` : '/grants'}
                className="inline-block mt-3 text-xs font-black text-bauhaus-blue uppercase tracking-widest hover:underline"
              >
                Browse all grants {stateCode ? `in ${stateCode}` : ''} &rarr;
              </Link>
            </Section>
          )}

          {/* Schools */}
          {dataLayers.schools.length > 0 && (
            <Section title={`Schools (${dataLayers.schools.length})`}>
              <p className="text-xs text-bauhaus-muted mb-3">
                ACARA school profiles in postcode {postcode}. ICSEA measures educational advantage (national avg 1000).
              </p>
              <div className="space-y-0">
                {dataLayers.schools.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-3 border-b-2 border-bauhaus-black/5 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-bauhaus-black text-sm truncate">{s.school_name}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="text-[10px] px-1.5 py-0.5 font-bold border border-bauhaus-black/20 text-bauhaus-muted">{s.school_sector}</span>
                        <span className="text-[10px] px-1.5 py-0.5 font-bold border border-bauhaus-black/20 text-bauhaus-muted">{s.school_type}</span>
                        {s.indigenous_pct != null && s.indigenous_pct > 0 && (
                          <span className={`text-[10px] px-1.5 py-0.5 font-bold border ${s.indigenous_pct >= 30 ? 'border-bauhaus-red text-bauhaus-red' : 'border-bauhaus-black/20 text-bauhaus-muted'}`}>
                            {Math.round(s.indigenous_pct)}% Indigenous
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      {s.icsea_value && (
                        <div className={`font-black text-sm ${s.icsea_value < 900 ? 'text-bauhaus-red' : s.icsea_value < 1000 ? 'text-orange-600' : 'text-bauhaus-black'}`}>
                          ICSEA {s.icsea_value}
                        </div>
                      )}
                      {s.total_enrolments && (
                        <div className="text-[10px] text-bauhaus-muted font-bold">{s.total_enrolments.toLocaleString()} students</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Crime & Safety */}
          {dataLayers.crime && dataLayers.crime.offences.length > 0 && (
            <Section title={`Crime & Safety — ${dataLayers.crime.lga_name} LGA`}>
              <p className="text-xs text-bauhaus-muted mb-3">
                Reported incidents by offence group{dataLayers.crime.year_period ? ` (${dataLayers.crime.year_period})` : ''}. Source: state crime statistics agencies.
              </p>
              <div className="space-y-0">
                {dataLayers.crime.offences.map((o, i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b-2 border-bauhaus-black/5 last:border-b-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-bauhaus-black text-sm">{o.offence_group}</div>
                      {o.rate_per_100k != null && (
                        <div className="text-[10px] text-bauhaus-muted font-bold">{Math.round(o.rate_per_100k)} per 100K</div>
                      )}
                    </div>
                    <div className="text-right ml-4 shrink-0 flex flex-col items-end gap-0.5">
                      <div className="font-black text-bauhaus-black text-sm">{o.total_incidents.toLocaleString()}</div>
                      <div className="flex gap-2">
                        {o.two_year_trend_pct != null && (
                          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${o.two_year_trend_pct > 10 ? 'text-bauhaus-red' : o.two_year_trend_pct < -10 ? 'text-money' : 'text-bauhaus-muted'}`}>
                            {o.two_year_trend_pct > 0 ? '↑' : o.two_year_trend_pct < 0 ? '↓' : '→'}
                            {Math.abs(Math.round(o.two_year_trend_pct))}% 2yr
                          </span>
                        )}
                        {o.ten_year_trend_pct != null && (
                          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${o.ten_year_trend_pct > 20 ? 'text-bauhaus-red' : o.ten_year_trend_pct < -20 ? 'text-money' : 'text-bauhaus-muted'}`}>
                            {o.ten_year_trend_pct > 0 ? '↑' : o.ten_year_trend_pct < 0 ? '↓' : '→'}
                            {Math.abs(Math.round(o.ten_year_trend_pct))}% 10yr
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Social Need — DSS Welfare Payments */}
          {dataLayers.dss_payments.length > 0 && (() => {
            const totalRecipients = dataLayers.dss_payments.reduce((sum, p) => sum + p.recipient_count, 0);
            const totalIndigenous = dataLayers.dss_payments.reduce((sum, p) => sum + (p.indigenous_count || 0), 0);
            const indigenousProportion = totalRecipients > 0 && totalIndigenous > 0
              ? Math.round((totalIndigenous / totalRecipients) * 100)
              : null;
            // Aggregate age bands across all payment types
            const ageUnder25 = dataLayers.dss_payments.reduce((sum, p) => sum + (p.age_under_25 || 0), 0);
            const age2544 = dataLayers.dss_payments.reduce((sum, p) => sum + (p.age_25_44 || 0), 0);
            const age4564 = dataLayers.dss_payments.reduce((sum, p) => sum + (p.age_45_64 || 0), 0);
            const age65plus = dataLayers.dss_payments.reduce((sum, p) => sum + (p.age_65_plus || 0), 0);
            const hasAgeData = (ageUnder25 + age2544 + age4564 + age65plus) > 0;
            const ageTotal = ageUnder25 + age2544 + age4564 + age65plus;
            return (
              <Section title="Social Need">
                <p className="text-xs text-bauhaus-muted mb-3">
                  DSS payment recipients in this area by payment type. Higher counts indicate service demand and community need.
                </p>
                {/* Summary stats */}
                <div className="grid grid-cols-2 gap-0 mb-4 border-4 border-bauhaus-black">
                  <div className="p-3 border-r-2 border-bauhaus-black/10">
                    <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Total Recipients</div>
                    <div className="text-xl font-black text-bauhaus-black">{totalRecipients.toLocaleString()}</div>
                  </div>
                  <div className="p-3">
                    <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">Payment Types</div>
                    <div className="text-xl font-black text-bauhaus-black">{dataLayers.dss_payments.length}</div>
                  </div>
                </div>
                {/* Indigenous proportion */}
                {indigenousProportion != null && (
                  <div className={`mb-4 p-3 border-2 flex items-center justify-between ${indigenousProportion >= 20 ? 'border-bauhaus-red bg-error-light' : 'border-bauhaus-black/20 bg-bauhaus-canvas'}`}>
                    <div className="text-xs font-black uppercase tracking-widest text-bauhaus-black">Indigenous Recipients</div>
                    <div className={`text-lg font-black ${indigenousProportion >= 20 ? 'text-bauhaus-red' : 'text-bauhaus-black'}`}>
                      {indigenousProportion}%
                      <span className="text-[10px] font-bold text-bauhaus-muted ml-1">({totalIndigenous.toLocaleString()})</span>
                    </div>
                  </div>
                )}
                {/* Age distribution */}
                {hasAgeData && (
                  <div className="mb-4 border-2 border-bauhaus-black p-3 bg-bauhaus-canvas">
                    <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-2">Age Distribution</div>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { label: 'Under 25', value: ageUnder25 },
                        { label: '25–44', value: age2544 },
                        { label: '45–64', value: age4564 },
                        { label: '65+', value: age65plus },
                      ].map(({ label, value }) => (
                        <div key={label} className="text-center">
                          <div className="text-sm font-black text-bauhaus-black">{ageTotal > 0 ? Math.round((value / ageTotal) * 100) : 0}%</div>
                          <div className="text-[10px] font-bold text-bauhaus-muted">{label}</div>
                          <div className="text-[10px] font-bold text-bauhaus-black">{value.toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Payment type breakdown */}
                <div className="space-y-0">
                  {dataLayers.dss_payments.slice(0, 10).map((p, i) => {
                    const indigenousPct = p.recipient_count > 0 && p.indigenous_count != null && p.indigenous_count > 0
                      ? Math.round((p.indigenous_count / p.recipient_count) * 100)
                      : null;
                    return (
                      <div key={i} className="flex items-center justify-between py-2.5 border-b-2 border-bauhaus-black/5 last:border-b-0">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-bauhaus-black text-sm">{p.payment_type}</div>
                          {indigenousPct != null && indigenousPct > 0 && (
                            <div className={`text-[10px] font-bold ${indigenousPct >= 20 ? 'text-bauhaus-red' : 'text-bauhaus-muted'}`}>
                              {indigenousPct}% Indigenous
                            </div>
                          )}
                        </div>
                        <div className="text-right ml-4 shrink-0">
                          <div className="font-black text-bauhaus-black text-sm">{p.recipient_count.toLocaleString()}</div>
                          {p.male_count != null && p.female_count != null && (p.male_count + p.female_count) > 0 && (
                            <div className="text-[10px] font-bold text-bauhaus-muted">
                              {Math.round((p.female_count / (p.male_count + p.female_count)) * 100)}% F
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            );
          })()}

          {/* NDIS Participants */}
          {dataLayers.ndis_participants && (
            <Section title="NDIS Participants">
              <div className="border-2 border-bauhaus-black p-4 bg-bauhaus-canvas">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mb-1">{dataLayers.ndis_participants.lga_name} LGA</div>
                    <div className="text-2xl font-black text-bauhaus-black">{dataLayers.ndis_participants.participant_count.toLocaleString()}</div>
                    <div className="text-[10px] font-bold text-bauhaus-muted">active participants</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest">{dataLayers.ndis_participants.reporting_period}</div>
                  </div>
                </div>
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
              <div className="flex items-center justify-between gap-3 mb-3 pb-2 border-b-4 border-bauhaus-blue">
                <h3 className="text-sm font-black text-bauhaus-blue uppercase tracking-widest">
                  Community Voice
                </h3>
                <span className="text-[10px] font-black px-2 py-0.5 border border-bauhaus-blue/30 bg-link-light text-bauhaus-blue uppercase tracking-widest">
                  External Evidence
                </span>
              </div>
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
                External ecosystem evidence via Empathy Ledger, linked to this place by geography rather than direct GrantScope attribution.
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
