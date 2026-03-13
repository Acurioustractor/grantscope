import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * GET /api/social-enterprises
 *
 * Public API for social enterprise discovery.
 * 10,339 enterprises across Supply Nation, ORIC, Social Traders, Buyability, B Corp, Kinaway.
 *
 * Query params:
 *   q            — text search (name, description)
 *   state        — AU state code (NSW, VIC, QLD, WA, SA, TAS, NT, ACT)
 *   sector       — sector filter (array contains)
 *   source       — source_primary (supply-nation, oric, social-traders, buyability, b-corp)
 *   indigenous   — true to filter Indigenous-owned/controlled enterprises
 *   certification — certification body name (contains)
 *   postcode     — exact postcode
 *   remoteness   — remoteness category (Remote, Very Remote, etc.)
 *   has_abn      — true to only return enterprises with verified ABN
 *   limit        — max results (default 25, max 100)
 *   offset       — pagination offset
 *   sort         — name, newest, state (default: name)
 *   format       — json (default) or csv
 */
export async function GET(request: NextRequest) {
  const auth = await requireModule('research');
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const q = searchParams.get('q') || '';
  const state = searchParams.get('state') || '';
  const sector = searchParams.get('sector') || '';
  const source = searchParams.get('source') || '';
  const indigenous = searchParams.get('indigenous');
  const certification = searchParams.get('certification') || '';
  const postcode = searchParams.get('postcode') || '';
  const remoteness = searchParams.get('remoteness') || '';
  const hasAbn = searchParams.get('has_abn');
  const limit = Math.min(parseInt(searchParams.get('limit') || '25', 10), 100);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const sort = searchParams.get('sort') || 'name';
  const format = searchParams.get('format') || 'json';

  const supabase = getServiceSupabase();
  let query = supabase
    .from('social_enterprises')
    .select('id, name, abn, acn, icn, website, description, org_type, legal_structure, sector, state, city, postcode, geographic_focus, certifications, source_primary, target_beneficiaries, logo_url, business_model, profile_confidence, created_at, updated_at', { count: 'exact' });

  if (q) query = query.or(`name.ilike.%${q}%,description.ilike.%${q}%`);
  if (state) query = query.eq('state', state);
  if (sector) query = query.contains('sector', [sector]);
  if (source) query = query.eq('source_primary', source);
  if (certification) query = query.contains('certifications', [{ body: certification }]);
  if (postcode) query = query.eq('postcode', postcode);
  if (hasAbn === 'true') query = query.not('abn', 'is', null);

  // Indigenous filter: ORIC source or Supply Nation
  if (indigenous === 'true') {
    query = query.or('source_primary.eq.oric,source_primary.eq.supply-nation,source_primary.eq.kinaway');
  }

  // Remoteness filter requires joining via postcode_geo — we'll post-filter
  // For now, handle via subquery if needed

  if (sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (sort === 'state') {
    query = query.order('state', { ascending: true, nullsFirst: false });
  } else {
    query = query.order('name', { ascending: true });
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with entity graph data if ABNs present
  const abns = (data || []).map(d => d.abn).filter(Boolean);
  let entityMap: Record<string, { gs_id: string; remoteness: string | null; seifa_irsd_decile: number | null; is_community_controlled: boolean | null; contract_count?: number }> = {};

  if (abns.length > 0) {
    const { data: entities } = await supabase
      .from('gs_entities')
      .select('abn, gs_id, remoteness, seifa_irsd_decile, is_community_controlled')
      .in('abn', abns);

    if (entities) {
      for (const e of entities) {
        if (e.abn) entityMap[e.abn] = { gs_id: e.gs_id, remoteness: e.remoteness, seifa_irsd_decile: e.seifa_irsd_decile, is_community_controlled: e.is_community_controlled };
      }
    }
  }

  // Enrich results
  const enriched = (data || []).map(se => {
    const entity = se.abn ? entityMap[se.abn] : null;
    return {
      ...se,
      gs_id: entity?.gs_id || null,
      remoteness: entity?.remoteness || null,
      seifa_irsd_decile: entity?.seifa_irsd_decile || null,
      is_community_controlled: entity?.is_community_controlled || false,
      is_indigenous: se.source_primary === 'oric' || se.source_primary === 'supply-nation' || se.source_primary === 'kinaway',
      dossier_url: entity?.gs_id ? `/entities/${entity.gs_id}` : null,
    };
  });

  // Post-filter by remoteness if needed
  let filtered = enriched;
  if (remoteness) {
    filtered = enriched.filter(e => e.remoteness && e.remoteness.toLowerCase().includes(remoteness.toLowerCase()));
  }

  if (format === 'csv') {
    const headers = ['name', 'abn', 'state', 'postcode', 'source', 'sector', 'indigenous', 'remoteness', 'website'];
    const rows = filtered.map(e => [
      `"${(e.name || '').replace(/"/g, '""')}"`,
      e.abn || '',
      e.state || '',
      e.postcode || '',
      e.source_primary || '',
      Array.isArray(e.sector) ? e.sector.join(';') : '',
      e.is_indigenous ? 'Yes' : 'No',
      e.remoteness || '',
      e.website || '',
    ].join(','));

    const csv = [headers.join(','), ...rows].join('\n');
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="social-enterprises.csv"',
      },
    });
  }

  return NextResponse.json({
    data: filtered,
    count: remoteness ? filtered.length : count,
    limit,
    offset,
    meta: {
      total_enterprises: count,
      sources: ['supply-nation', 'oric', 'social-traders', 'buyability', 'b-corp', 'kinaway'],
      last_updated: new Date().toISOString(),
    },
  });
}
