import { getServiceSupabase } from '@/lib/supabase';
import { isGoodsPlacePublic, type AtlasPoint, type AtlasSurface } from '@/lib/atlas/layers';

/**
 * The Goods-in-community points, per surface.
 *
 * Server-side only: this feed is how the Goods consent tiers are actually
 * enforced. The org surface (behind the /org middleware gate) receives every
 * register row. A public surface receives ONLY communities on the per-place
 * consent list (GOODS_PUBLIC_PLACES in the layer registry) — empty until the
 * in-person consent conversation lands, so today the public feed returns
 * nothing and the public payload never contains a Goods figure. Adding a
 * consented place to that list is the whole flip.
 *
 * Source is goods_communities.assets_deployed — the same per-community
 * register the Communities hub tab shows, so the org surface agrees with
 * itself. Its known limits are stated on the layer's caveat: the register
 * itemises fewer units by place than the 540-bed canon
 * (goods-canonical-numbers.ts), and staged-through vs delivered-to is not
 * distinguished.
 */

function titleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/\s+/)
    .map(word => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function num(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export async function getGoodsDeliveredPoints(
  surface: AtlasSurface = 'org'
): Promise<AtlasPoint[]> {
  const db = getServiceSupabase();
  const { data, error } = await db.rpc('exec_sql', {
    query: `SELECT gc.community_name, gc.state,
                   COALESCE(gc.latitude, pg.lat) AS lat,
                   COALESCE(gc.longitude, pg.lng) AS lng,
                   gc.assets_deployed, gc.demand_beds, gc.demand_washers
              FROM goods_communities gc
              LEFT JOIN (
                SELECT postcode, AVG(latitude::float) AS lat, AVG(longitude::float) AS lng
                  FROM postcode_geo
                 GROUP BY postcode
              ) pg ON pg.postcode = gc.postcode
             WHERE gc.assets_deployed > 0
             ORDER BY gc.assets_deployed DESC`,
  });
  if (error || !Array.isArray(data)) return [];

  const points: AtlasPoint[] = [];
  for (const entry of data as Array<Record<string, unknown>>) {
    // Public surfaces receive consented places only — filtered here, on the
    // raw register name, before anything is shaped for the client.
    const rawName = String(entry.community_name ?? '');
    if (surface === 'public' && !isGoodsPlacePublic(rawName)) continue;
    const lat = entry.lat === null ? null : Number(entry.lat);
    const lng = entry.lng === null ? null : Number(entry.lng);
    // A community the register cannot locate cannot be a point; it stays in
    // the Communities tab rather than being pinned somewhere wrong.
    if (lat === null || lng === null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const demandBeds = num(entry.demand_beds);
    const demandWashers = num(entry.demand_washers);
    points.push({
      name: `${titleCase(String(entry.community_name ?? ''))} (${String(entry.state ?? '')})`,
      lat,
      lng,
      value: num(entry.assets_deployed),
      detail: [
        ...(demandBeds > 0 ? [{ label: 'Stated bed demand', value: String(demandBeds) }] : []),
        ...(demandWashers > 0 ? [{ label: 'Stated washer demand', value: String(demandWashers) }] : []),
      ],
    });
  }
  return points;
}
