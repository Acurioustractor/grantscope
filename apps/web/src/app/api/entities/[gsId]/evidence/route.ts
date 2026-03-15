import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { safeOptionalData, safeOptionalCount } from '@/lib/optional-data';

type RouteContext = { params: Promise<{ gsId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const auth = await requireModule('research');
  if (auth.error) return auth.error;

  const { gsId } = await context.params;
  const db = getServiceSupabase();

  // Look up entity
  const { data: entity } = await db
    .from('gs_entities')
    .select('id, gs_id, canonical_name, abn')
    .eq('gs_id', gsId)
    .single();

  if (!entity) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  // JusticeHub org lookup
  interface JHOrg { id: string; name: string; slug: string | null }
  const jhOrgRows = await safeOptionalData(
    db
      .from('organizations')
      .select('id, name, slug')
      .eq('gs_entity_id', entity.id)
      .limit(1),
    [] as JHOrg[],
  );
  const jhOrg = jhOrgRows[0];

  // ALMA interventions + evidence
  interface AlmaIntervention { id: string; name: string; type: string }
  let interventions: AlmaIntervention[] = [];
  let almaEvidenceCount = 0;

  if (jhOrg) {
    const [interventionRows, interventionIds] = await Promise.all([
      safeOptionalData(
        db
          .from('alma_interventions')
          .select('id, name, type')
          .eq('operating_organization_id', jhOrg.id)
          .order('name'),
        [] as AlmaIntervention[],
      ),
      safeOptionalData(
        db
          .from('alma_interventions')
          .select('id')
          .eq('operating_organization_id', jhOrg.id),
        [] as Array<{ id: string }>,
      ),
    ]);
    interventions = interventionRows;

    if (interventionIds.length > 0) {
      almaEvidenceCount = await safeOptionalCount(
        db
          .from('alma_intervention_evidence')
          .select('id', { count: 'exact', head: true })
          .in('intervention_id', interventionIds.map((row) => row.id)),
      );
    }
  }

  // Justice funding
  let justiceFunding: Array<{
    id: string;
    recipient_name: string;
    program_name: string;
    amount_dollars: number | null;
    sector: string | null;
    source: string;
    financial_year: string | null;
    location: string | null;
  }> = [];

  if (entity.abn) {
    const { data } = await db
      .from('justice_funding')
      .select('id, recipient_name, program_name, amount_dollars, sector, source, financial_year, location')
      .eq('recipient_abn', entity.abn)
      .order('amount_dollars', { ascending: false, nullsFirst: false });
    justiceFunding = data || [];
  } else {
    const { data } = await db
      .from('justice_funding')
      .select('id, recipient_name, program_name, amount_dollars, sector, source, financial_year, location')
      .ilike('recipient_name', `%${entity.canonical_name.replace(/[%_]/g, '')}%`)
      .order('amount_dollars', { ascending: false, nullsFirst: false })
      .limit(50);
    justiceFunding = data || [];
  }

  const totalJusticeFunding = justiceFunding.reduce((sum, r) => sum + (r.amount_dollars || 0), 0);

  return NextResponse.json({
    interventions,
    justiceFunding,
    totalJusticeFunding,
    almaEvidenceCount,
    justiceOrgId: jhOrg?.id || null,
    justiceOrgSlug: jhOrg?.slug || null,
  });
}
