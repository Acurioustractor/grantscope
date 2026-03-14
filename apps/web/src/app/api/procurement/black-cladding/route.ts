import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';

/**
 * POST /api/procurement/black-cladding
 *
 * Black cladding risk assessment for Indigenous-classified suppliers.
 * Analyses directorship structures, ownership changes, and entity relationships
 * to flag potential "black cladding" — where non-Indigenous operators create
 * shell partnerships to access IPP procurement.
 *
 * Body: { abns: string[] }
 * Returns risk scores and flags per entity.
 */
export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;

  const body = await request.json();
  const abns: string[] = (body.abns || []).map((a: string) => a.replace(/\s/g, '')).filter((a: string) => /^\d{11}$/.test(a));

  if (!abns.length) {
    return NextResponse.json({ error: 'Provide at least one ABN' }, { status: 400 });
  }
  if (abns.length > 100) {
    return NextResponse.json({ error: 'Maximum 100 ABNs per request' }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // Look up entities
  const entityResult = await supabase
    .from('gs_entities')
    .select('id, gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, is_community_controlled, lga_name, created_at')
    .in('abn', abns);

  const entities = entityResult.data || [];
  const entityIds = entities.map(e => e.id);

  // Get all relationships for these entities (directorships, subsidiaries, etc.)
  const [directorshipsOut, directorshipsIn, subsidiaries, donations] = await Promise.all([
    // Directors OF these entities
    supabase
      .from('gs_relationships')
      .select('source_entity_id, target_entity_id, relationship_type, dataset, year, amount')
      .in('target_entity_id', entityIds)
      .in('relationship_type', ['directorship', 'member_of']),
    // Entities these directors also direct
    supabase
      .from('gs_relationships')
      .select('source_entity_id, target_entity_id, relationship_type, dataset, year')
      .in('source_entity_id', entityIds)
      .eq('relationship_type', 'directorship'),
    // Subsidiary relationships
    supabase
      .from('gs_relationships')
      .select('source_entity_id, target_entity_id, relationship_type')
      .in('source_entity_id', entityIds)
      .eq('relationship_type', 'subsidiary_of'),
    // Political donations FROM these entities
    supabase
      .from('gs_relationships')
      .select('source_entity_id, target_entity_id, relationship_type, amount, year')
      .in('source_entity_id', entityIds)
      .eq('relationship_type', 'donation'),
  ]);

  // Get names for director entities
  const directorEntityIds = [
    ...new Set([
      ...(directorshipsOut.data || []).map(d => d.source_entity_id),
      ...(directorshipsIn.data || []).map(d => d.target_entity_id),
    ]),
  ];

  let directorEntities: Array<Record<string, unknown>> = [];
  if (directorEntityIds.length > 0) {
    const dirResult = await supabase
      .from('gs_entities')
      .select('id, gs_id, canonical_name, entity_type, is_community_controlled')
      .in('id', directorEntityIds.slice(0, 200));
    directorEntities = dirResult.data || [];
  }

  const directorMap = new Map(directorEntities.map(d => [d.id, d]));

  // Build risk assessment per entity
  const assessments = entities.map(entity => {
    const flags: Array<{ flag: string; severity: 'high' | 'medium' | 'low'; detail: string }> = [];
    let riskScore = 0;

    // Check 1: Is this actually classified as Indigenous?
    const isIndigenous = entity.entity_type === 'indigenous_corp';
    if (!isIndigenous) {
      return {
        abn: entity.abn,
        gs_id: entity.gs_id,
        name: entity.canonical_name,
        entity_type: entity.entity_type,
        risk_score: 0,
        risk_level: 'not_applicable' as const,
        flags: [{ flag: 'not_indigenous', severity: 'low' as const, detail: 'Entity not classified as Indigenous — black cladding assessment not applicable' }],
        directors: [],
        related_entities: [],
      };
    }

    // Check 2: Director analysis
    const directors = (directorshipsOut.data || [])
      .filter(d => d.target_entity_id === entity.id)
      .map(d => {
        const director = directorMap.get(d.source_entity_id);
        return {
          entity_id: d.source_entity_id,
          name: director?.canonical_name || 'Unknown',
          entity_type: director?.entity_type || 'unknown',
          is_community_controlled: director?.is_community_controlled || false,
          year: d.year,
        };
      });

    // Flag: Directors that also direct non-Indigenous companies
    const directorOtherEntities = (directorshipsIn.data || [])
      .filter(d => entities.some(e => e.id === d.source_entity_id))
      .map(d => {
        const otherEntity = directorMap.get(d.target_entity_id);
        return {
          entity_id: d.target_entity_id,
          name: otherEntity?.canonical_name || 'Unknown',
          entity_type: otherEntity?.entity_type || 'unknown',
        };
      })
      .filter(d => d.entity_type === 'company');

    if (directorOtherEntities.length > 0) {
      flags.push({
        flag: 'director_crossover',
        severity: 'medium',
        detail: `Director(s) also direct ${directorOtherEntities.length} non-Indigenous companies: ${directorOtherEntities.slice(0, 3).map(d => d.name).join(', ')}`,
      });
      riskScore += 20 * Math.min(directorOtherEntities.length, 3);
    }

    // Check 3: Subsidiary of non-Indigenous entity
    const subs = (subsidiaries.data || []).filter(s => s.source_entity_id === entity.id);
    if (subs.length > 0) {
      flags.push({
        flag: 'subsidiary_structure',
        severity: 'high',
        detail: 'Entity is a subsidiary of another organisation — verify Indigenous ownership at parent level meets 51% threshold',
      });
      riskScore += 30;
    }

    // Check 4: Entity not community controlled
    if (!entity.is_community_controlled) {
      flags.push({
        flag: 'not_community_controlled',
        severity: 'low',
        detail: 'Entity not flagged as community-controlled. Not inherently suspicious but worth verifying governance structure.',
      });
      riskScore += 5;
    }

    // Check 5: Political donations (unusual for genuine Indigenous corps)
    const entityDonations = (donations.data || []).filter(d => d.source_entity_id === entity.id);
    if (entityDonations.length > 0) {
      const totalDonated = entityDonations.reduce((s, d) => s + ((d.amount as number) || 0), 0);
      flags.push({
        flag: 'political_donations',
        severity: 'medium',
        detail: `Entity has made ${entityDonations.length} political donation(s) totalling $${totalDonated.toLocaleString()}. Verify this is consistent with community-led governance.`,
      });
      riskScore += 15;
    }

    // Check 6: Location in major city with no community ties
    if (entity.remoteness === 'Major Cities of Australia' && !entity.is_community_controlled) {
      flags.push({
        flag: 'metro_no_community_ties',
        severity: 'low',
        detail: 'Metro-based entity without community-controlled flag. Not inherently suspicious — many legitimate Indigenous businesses operate in cities.',
      });
      riskScore += 5;
    }

    // Determine risk level
    const riskLevel = riskScore >= 50 ? 'high' : riskScore >= 20 ? 'medium' : 'low';

    return {
      abn: entity.abn,
      gs_id: entity.gs_id,
      name: entity.canonical_name,
      entity_type: entity.entity_type,
      state: entity.state,
      is_community_controlled: entity.is_community_controlled,
      remoteness: entity.remoteness,
      risk_score: Math.min(riskScore, 100),
      risk_level: riskLevel,
      flags,
      directors,
      related_entities: directorOtherEntities.slice(0, 5),
    };
  });

  // Also include ABNs we couldn't find
  const foundAbns = new Set(entities.map(e => e.abn));
  const unmatchedAbns = abns.filter(a => !foundAbns.has(a));

  return NextResponse.json({
    assessments,
    unmatched: unmatchedAbns.map(abn => ({
      abn,
      risk_level: 'unknown',
      detail: 'ABN not found in CivicGraph database — manual verification required',
    })),
    summary: {
      total_assessed: assessments.length,
      high_risk: assessments.filter(a => a.risk_level === 'high').length,
      medium_risk: assessments.filter(a => a.risk_level === 'medium').length,
      low_risk: assessments.filter(a => a.risk_level === 'low').length,
      not_applicable: assessments.filter(a => a.risk_level === 'not_applicable').length,
      unmatched: unmatchedAbns.length,
    },
    generated_at: new Date().toISOString(),
  });
}
