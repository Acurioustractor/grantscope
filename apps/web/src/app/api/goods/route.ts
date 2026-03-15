import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/goods — CivicGraph data feed for the Goods project
 *
 * Returns grants, tenders, funders, and deployment priority data
 * pre-filtered for Goods' focus areas: indigenous manufacturing,
 * remote community, circular economy, furniture/beds.
 *
 * Query params:
 *   section  — 'grants' | 'tenders' | 'funders' | 'deployment' | 'procurement' | 'community' | 'all' (default: 'all')
 *   states   — comma-separated state filter (default: NT,WA,QLD,SA)
 *   abns     — comma-separated ABNs for procurement analysis (section=procurement)
 *   limit    — max results per section (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const section = searchParams.get('section') || 'all';
  const states = (searchParams.get('states') || 'NT,WA,QLD,SA').split(',').map(s => s.trim().toUpperCase());
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);

  const supabase = getServiceSupabase();
  const result: Record<string, unknown> = { fetchedAt: new Date().toISOString() };

  try {
    // ── GRANTS: matching Goods focus areas ──────────────────────
    if (section === 'all' || section === 'grants') {
      const goodsKeywords = [
        'indigenous', 'manufacturing', 'remote', 'circular',
        'community', 'furniture', 'infrastructure', 'First Nations',
      ];

      const orFilter = goodsKeywords
        .map(k => `name.ilike.%${k}%`)
        .join(',');

      const { data: grants } = await supabase
        .from('grant_opportunities')
        .select('id, name, provider, program, amount_min, amount_max, closes_at, url, categories, geography, created_at')
        .or(orFilter)
        .order('closes_at', { ascending: true, nullsFirst: false })
        .limit(limit);

      result.grants = grants || [];
      result.grants_count = (grants || []).length;
    }

    // ── TENDERS: suppliers in remote areas with contract history ─
    if (section === 'all' || section === 'tenders') {
      // Find entities in target states with remote/very remote remoteness
      const { data: remoteEntities } = await supabase
        .from('gs_entities')
        .select('gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, latest_revenue')
        .in('state', states)
        .in('entity_type', ['indigenous_corp', 'social_enterprise', 'company'])
        .in('remoteness', ['Very Remote Australia', 'Remote Australia', 'Outer Regional Australia'])
        .order('latest_revenue', { ascending: false, nullsFirst: false })
        .limit(limit * 2);

      // Get contract counts for these entities
      const abns = (remoteEntities || []).filter(e => e.abn).map(e => e.abn);
      let contractMap: Record<string, { count: number; total_value: number }> = {};

      if (abns.length > 0) {
        const { data: contracts } = await supabase
          .from('austender_contracts')
          .select('supplier_abn, contract_value')
          .in('supplier_abn', abns);

        if (contracts) {
          for (const c of contracts) {
            if (!c.supplier_abn) continue;
            if (!contractMap[c.supplier_abn]) contractMap[c.supplier_abn] = { count: 0, total_value: 0 };
            contractMap[c.supplier_abn].count++;
            contractMap[c.supplier_abn].total_value += c.contract_value || 0;
          }
        }
      }

      const tenders = (remoteEntities || []).map(e => ({
        ...e,
        contracts: contractMap[e.abn || ''] || { count: 0, total_value: 0 },
      }));

      // Sort: those with contracts first, then by remoteness
      const remotenessOrder: Record<string, number> = {
        'Very Remote Australia': 0,
        'Remote Australia': 1,
        'Outer Regional Australia': 2,
      };
      tenders.sort((a, b) => {
        if (a.contracts.count !== b.contracts.count) return b.contracts.count - a.contracts.count;
        return (remotenessOrder[a.remoteness || ''] ?? 3) - (remotenessOrder[b.remoteness || ''] ?? 3);
      });

      result.tenders = tenders.slice(0, limit);
      result.tenders_summary = {
        total: tenders.length,
        indigenous: tenders.filter(t => t.entity_type === 'indigenous_corp').length,
        with_contracts: tenders.filter(t => t.contracts.count > 0).length,
        community_controlled: tenders.filter(t => t.is_community_controlled).length,
      };
    }

    // ── FUNDERS: foundations relevant to Goods ──────────────────
    if (section === 'all' || section === 'funders') {
      const { data: funders } = await supabase
        .from('foundations')
        .select('id, name, type, website, total_giving_annual, thematic_focus, geographic_focus, created_at')
        .or('thematic_focus.cs.{indigenous},thematic_focus.cs.{community},thematic_focus.cs.{environment},thematic_focus.cs.{housing},thematic_focus.cs.{social-enterprise}')
        .order('total_giving_annual', { ascending: false, nullsFirst: false })
        .limit(limit);

      result.funders = (funders || []).map(f => ({
        ...f,
        relevance:
          (f.thematic_focus || []).some((t: string) => t === 'indigenous' || t === 'community')
            ? 'high'
            : (f.total_giving_annual || 0) > 1000000
              ? 'medium'
              : 'low',
      }));
      result.funders_count = (funders || []).length;
    }

    // ── DEPLOYMENT: disadvantage-ranked postcodes ───────────────
    if (section === 'all' || section === 'deployment') {
      const { data: fundingData } = await supabase
        .from('mv_funding_by_postcode')
        .select('postcode, state, remoteness, entity_count, total_funding, community_controlled_count, community_controlled_funding, seifa_decile')
        .in('state', states)
        .in('remoteness', ['Very Remote Australia', 'Remote Australia', 'Outer Regional Australia'])
        .order('seifa_decile', { ascending: true, nullsFirst: false })
        .limit(limit * 3);

      const deploymentAreas = (fundingData || []).map(row => {
        const seifaScore = row.seifa_decile ? (10 - row.seifa_decile) * 10 : 50;
        const remotenessScore: Record<string, number> = {
          'Very Remote Australia': 30,
          'Remote Australia': 25,
          'Outer Regional Australia': 15,
        };
        const rScore = remotenessScore[row.remoteness || ''] ?? 10;
        const fundingPenalty = Math.min(20, Math.max(0, 20 - Math.log10(Math.max(1, row.total_funding || 1)) * 3));

        const priority_score = Math.min(100, Math.round(seifaScore + rScore + fundingPenalty));
        const priority_label =
          priority_score >= 75 ? 'critical' :
          priority_score >= 55 ? 'high' :
          priority_score >= 35 ? 'medium' : 'low';

        return {
          postcode: row.postcode,
          state: row.state,
          remoteness: row.remoteness,
          seifa_irsd_decile: row.seifa_decile,
          entity_count: row.entity_count || 0,
          total_funding: row.total_funding || 0,
          community_controlled_count: row.community_controlled_count || 0,
          priority_score,
          priority_label,
        };
      });

      deploymentAreas.sort((a, b) => b.priority_score - a.priority_score);

      result.deployment = deploymentAreas.slice(0, limit);
      result.deployment_summary = {
        total_areas: deploymentAreas.length,
        critical: deploymentAreas.filter(a => a.priority_label === 'critical').length,
        high: deploymentAreas.filter(a => a.priority_label === 'high').length,
        states_covered: [...new Set(deploymentAreas.map(a => a.state))],
      };
    }

    // ── PROCUREMENT: social impact analysis for supplier ABNs ───
    if (section === 'all' || section === 'procurement') {
      const abnParam = searchParams.get('abns') || '';
      const abns = abnParam.split(',').map(a => a.trim()).filter(a => /^\d{11}$/.test(a));

      if (abns.length > 0) {
        const cleanAbns = [...new Set(abns)].slice(0, 200);

        const [entitiesRes, seRes] = await Promise.all([
          supabase
            .from('gs_entities')
            .select('abn, canonical_name, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name')
            .in('abn', cleanAbns),
          supabase
            .from('social_enterprises')
            .select('abn, name, source_primary, certifications, sector')
            .in('abn', cleanAbns)
            .not('abn', 'is', null),
        ]);

        const entityMap = new Map((entitiesRes.data || []).map(e => [e.abn, e]));
        const seMap = new Map((seRes.data || []).map(se => [se.abn, se]));

        const suppliers = cleanAbns.map(abn => {
          const entity = entityMap.get(abn);
          const se = seMap.get(abn);
          return {
            abn,
            name: entity?.canonical_name || se?.name || null,
            matched: !!(entity || se),
            is_indigenous: entity?.entity_type === 'indigenous_corp' ||
              ['supply-nation', 'oric', 'kinaway'].includes(se?.source_primary || ''),
            is_social_enterprise: !!se,
            is_community_controlled: entity?.is_community_controlled || false,
            entity_type: entity?.entity_type || null,
            state: entity?.state || null,
            remoteness: entity?.remoteness || null,
            seifa_irsd_decile: entity?.seifa_irsd_decile || null,
            lga: entity?.lga_name || null,
            certifications: se?.certifications || null,
          };
        });

        const matched = suppliers.filter(s => s.matched);
        result.procurement = {
          suppliers,
          summary: {
            total: cleanAbns.length,
            matched: matched.length,
            match_rate: matched.length / cleanAbns.length,
            indigenous: suppliers.filter(s => s.is_indigenous).length,
            social_enterprise: suppliers.filter(s => s.is_social_enterprise).length,
            community_controlled: suppliers.filter(s => s.is_community_controlled).length,
            by_remoteness: Object.entries(
              matched.reduce((acc, s) => {
                const r = s.remoteness || 'Unknown';
                acc[r] = (acc[r] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            ).map(([remoteness, count]) => ({ remoteness, count })),
          },
        };
      } else if (section === 'procurement') {
        result.procurement = {
          error: 'Provide ABNs as comma-separated query param: ?section=procurement&abns=12345678901,98765432101',
          example: '/api/goods?section=procurement&abns=25009942998,12345678901',
        };
      }
    }

    // ── COMMUNITY: community orgs and mapping ───────────────────
    if (section === 'all' || section === 'community') {
      // Community orgs in target states
      const { data: communityOrgs } = await supabase
        .from('community_orgs')
        .select('id, name, website, domain, geographic_focus, annual_revenue, annual_funding_received, admin_burden_cost, profile_confidence')
        .order('annual_revenue', { ascending: false, nullsFirst: false })
        .limit(limit);

      // Community-controlled entities by state/remoteness
      const { data: ccEntities } = await supabase
        .from('gs_entities')
        .select('gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, seifa_irsd_decile, lga_name, latest_revenue, sector')
        .eq('is_community_controlled', true)
        .in('state', states)
        .order('latest_revenue', { ascending: false, nullsFirst: false })
        .limit(limit);

      // LGA-level funding aggregates for community mapping
      const { data: lgaFunding } = await supabase
        .from('mv_funding_by_lga')
        .select('*')
        .in('state', states)
        .order('total_funding', { ascending: false })
        .limit(limit);

      result.community = {
        community_orgs: communityOrgs || [],
        community_controlled_entities: ccEntities || [],
        lga_funding: lgaFunding || [],
      };
      result.community_summary = {
        orgs_count: (communityOrgs || []).length,
        cc_entities_count: (ccEntities || []).length,
        lgas_with_data: (lgaFunding || []).length,
        by_state: Object.entries(
          (ccEntities || []).reduce((acc, e) => {
            acc[e.state] = (acc[e.state] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).map(([state, count]) => ({ state, count })),
        by_remoteness: Object.entries(
          (ccEntities || []).reduce((acc, e) => {
            const r = e.remoteness || 'Unknown';
            acc[r] = (acc[r] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        ).map(([remoteness, count]) => ({ remoteness, count })),
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
