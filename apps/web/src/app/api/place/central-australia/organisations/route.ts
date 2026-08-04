import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Every organisation in Central Australia with each funding channel, plus a
 * coordinate so it can be mapped.
 *
 * Coordinates come from the postcode centroid, not the organisation's address,
 * so everything sharing a postcode lands on the same point. In this region that
 * matters: postcode 0872 covers a vast area, so those markers say "somewhere in
 * the remote centre" rather than a location. The client jitters them apart so
 * they can be clicked, and the page says what the jitter means.
 */

export interface OrgMarker {
  id: string;
  name: string;
  abn: string | null;
  lga: string | null;
  postcode: string | null;
  lat: number;
  lng: number;
  communityControlled: boolean;
  oricStatus: string | null;
  oricSector: string | null;
  incomeBand: string | null;
  employeeBand: string | null;
  contractValue: number;
  grantsReceived: number;
  grantsDeliveredHere: number;
  otherGovtGrants: number;
  philanthropicGrants: number;
  totalTraceable: number;
}

const AREAS = ['Alice Springs', 'Barkly', 'MacDonnell', 'Central Desert', 'Anangu Pitjantjatjara Yankunytjatjara'];

const SELECT_COLS = 'id, canonical_name, abn, lga_name, postcode, community_controlled, oric_status, oric_sector, oric_income_band, oric_employee_band, contract_value, grants_received_value, grants_delivered_here_value, other_govt_grant_value, philanthropic_grant_count, total_traceable_value, state';

export async function GET() {
  const db = getServiceSupabase();

  const [orgsResult, homelandsResult] = await Promise.all([
    // Two plain queries rather than one .or(). Region must be filtered in the
    // query — filtering in JS after a limit silently truncated the region away,
    // because NT and SA hold far more rows than the limit. An .or() with
    // quoted multi-word LGA names returned nothing, so this avoids it.
    db.from('v_org_funding_profile')
      .select(SELECT_COLS)
      .in('lga_name', AREAS)
      .in('state', ['NT', 'SA'])
      .limit(3000),
    db.from('v_org_funding_profile')
      .select(SELECT_COLS)
      .eq('postcode', '0872')
      .limit(1000),
  ]);

  if (orgsResult.error) {
    return NextResponse.json({ error: orgsResult.error.message }, { status: 500 });
  }


  // Merge, de-duplicating the homelands rows that also carry a council.
  const seen = new Set<string>();
  const rowsRaw = [...(orgsResult.data || []), ...(homelandsResult.data || [])]
    .filter(r => {
      const id = String((r as Record<string, unknown>).id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }) as Array<Record<string, unknown>>;

  // Look up only the postcodes in play. PostgREST caps every response at 1,000
  // rows whatever .limit() says, so fetching the whole postcode table returned
  // an arbitrary thousand that held no NT postcodes at all — every organisation
  // was then dropped for having no coordinate.
  const wantedPostcodes = [...new Set(rowsRaw.map(r => r.postcode as string | null).filter(Boolean))] as string[];
  const geoResult = await db
    .from('postcode_geo')
    .select('postcode, latitude, longitude')
    .in('postcode', wantedPostcodes)
    .not('latitude', 'is', null);

  const coords = new Map<string, { lat: number; lng: number }>();
  for (const row of (geoResult.data || []) as Array<{ postcode: string; latitude: number; longitude: number }>) {
    if (!coords.has(row.postcode)) coords.set(row.postcode, { lat: row.latitude, lng: row.longitude });
  }

  const rows = rowsRaw;
  const markers: OrgMarker[] = [];

  for (const row of rows) {
    const lga = row.lga_name as string | null;
    const postcode = row.postcode as string | null;
    const inRegion = (lga && AREAS.includes(lga)) || postcode === '0872';
    if (!inRegion) continue;
    const point = postcode ? coords.get(postcode) : undefined;
    if (!point) continue;

    markers.push({
      id: String(row.id),
      name: String(row.canonical_name),
      abn: (row.abn as string | null) ?? null,
      lga,
      postcode,
      lat: point.lat,
      lng: point.lng,
      communityControlled: row.community_controlled === true,
      oricStatus: (row.oric_status as string | null) ?? null,
      oricSector: (row.oric_sector as string | null) ?? null,
      incomeBand: (row.oric_income_band as string | null) ?? null,
      employeeBand: (row.oric_employee_band as string | null) ?? null,
      contractValue: Number(row.contract_value ?? 0),
      grantsReceived: Number(row.grants_received_value ?? 0),
      grantsDeliveredHere: Number(row.grants_delivered_here_value ?? 0),
      otherGovtGrants: Number(row.other_govt_grant_value ?? 0),
      philanthropicGrants: Number(row.philanthropic_grant_count ?? 0),
      totalTraceable: Number(row.total_traceable_value ?? 0),
    });
  }

  markers.sort((a, b) => b.totalTraceable - a.totalTraceable);

  return NextResponse.json({
    organisations: markers,
    generatedAt: new Date().toISOString(),
  });
}
