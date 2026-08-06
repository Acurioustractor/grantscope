import { NextRequest, NextResponse } from 'next/server';
import { requireOrgAccess } from '../../../_lib/auth';

type Params = { params: Promise<{ orgProfileId: string }> };

// Mint-modal name search (spec §5.1): the GHL contact pool (via the
// ghl_contacts mirror — never GHL live) and CivicGraph person rows, together.
// A GHL hit means CLAIM the contact; a CivicGraph-only hit means create.
export async function GET(request: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 2) return NextResponse.json({ results: [] });
  const like = `%${q.replace(/[%_]/g, '')}%`;

  const [ghl, civic, minted] = await Promise.all([
    auth.serviceDb
      .from('ghl_contacts')
      .select('ghl_id, full_name, email, company_name')
      .ilike('full_name', like)
      .not('ghl_id', 'is', null)
      .limit(8),
    auth.serviceDb
      .from('gs_entities')
      .select('gs_id, canonical_name')
      .eq('entity_type', 'person')
      .ilike('canonical_name', like)
      .limit(8),
    auth.serviceDb.from('act_people').select('ghl_contact_id').eq('org_profile_id', orgProfileId),
  ]);

  const mintedIds = new Set((minted.data ?? []).map((m) => m.ghl_contact_id as string));
  const results = [
    ...(ghl.data ?? [])
      .filter((c) => !mintedIds.has(c.ghl_id as string))
      .map((c) => ({
        source: 'ghl' as const,
        ghlContactId: c.ghl_id as string,
        name: c.full_name as string,
        detail: [c.email, c.company_name].filter(Boolean).join(' · ') || null,
      })),
    ...(civic.data ?? []).map((c) => ({
      source: 'civicgraph' as const,
      ghlContactId: null,
      name: c.canonical_name as string,
      detail: `CivicGraph ${c.gs_id as string}`,
    })),
  ];
  return NextResponse.json({ results });
}
