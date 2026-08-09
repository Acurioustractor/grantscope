import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { whitelist } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const limiter = rateLimit();

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
const METRICS = ['desert_score', 'unplaced_share'] as const;

const schema = z.object({
  state: z.string().optional(),
  metric: z.string().max(50).optional(),
});

export async function GET(request: Request) {
  const limited = limiter(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const parsed = schema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });

  const safeState = whitelist(parsed.data.state?.toUpperCase() ?? null, STATES, null as unknown as typeof STATES[number]);
  const metric = whitelist(parsed.data.metric ?? null, METRICS, 'desert_score');

  try {
    const supabase = getServiceSupabase();

    const stateClause = safeState
      ? `AND UPPER(state) = '${safeState}'`
      : '';

    // Base grain is councils with centroids, not mv_funding_deserts rows: the
    // councils whose organisations we cannot place are exactly the ones most
    // likely to have no MV row (Maralinga Tjarutja has none), and an
    // uncertainty layer that drops the most uncertain councils would be lying.
    //
    // Remoteness comes from the modal ABS class across the council's postcodes.
    // mv_funding_deserts carries one row per remoteness class a council touches
    // and picking the highest desert_score row labelled Brisbane "Remote
    // Australia"; where several rows exist we keep the one matching the modal
    // class and fall back to severity only when none does.
    //
    // Unplaced counts join postcode -> council, so an organisation in a
    // postcode spanning three councils counts toward all three. That is the
    // semantics, not a bug: an organisation that could be in any of them makes
    // each council's picture less certain.
    // Councils without point coordinates stay in the payload with a null
    // lat/lng: the choropleth paints them by boundary-name match, which needs
    // no centroid. Coordinates only drive bounds-fitting and fallback markers.
    //
    // The second query is the live "why" tally: every null-lga row carries
    // exactly one lga_source reason code (the 2026-08 placement migrations
    // stamped them), grouped per state so the caveat card can scope to the
    // state filter. State is null for records that hold no state at all.
    const [councilResult, reasonResult] = await Promise.all([
      supabase.rpc('exec_sql', {
        query: `WITH lga_centroids AS (
        SELECT lga_name, MAX(lga_code) AS lga_code, UPPER(state) as state,
               AVG(latitude::float) as lat,
               AVG(longitude::float) as lng
        FROM postcode_geo
        WHERE lga_name IS NOT NULL ${stateClause}
        GROUP BY lga_name, UPPER(state)
      ),
      modal_remoteness AS (
        SELECT DISTINCT ON (lga_name, UPPER(state))
          lga_name, UPPER(state) AS state, remoteness_2021 AS remoteness
        FROM postcode_geo
        WHERE lga_name IS NOT NULL AND remoteness_2021 IS NOT NULL
        GROUP BY lga_name, UPPER(state), remoteness_2021
        ORDER BY lga_name, UPPER(state), COUNT(*) DESC
      ),
      deduped_deserts AS (
        SELECT DISTINCT ON (dd.lga_name, UPPER(dd.state))
          dd.lga_name, UPPER(dd.state) as state,
          COALESCE(mr.remoteness, dd.remoteness) AS remoteness,
          dd.avg_irsd_decile, dd.avg_irsd_score,
          dd.indexed_entities, dd.community_controlled_entities,
          dd.total_funding_all_sources, dd.desert_score
        FROM mv_funding_deserts dd
        LEFT JOIN modal_remoteness mr
          ON mr.lga_name = dd.lga_name AND mr.state = UPPER(dd.state)
        WHERE dd.desert_score IS NOT NULL
        ORDER BY dd.lga_name, UPPER(dd.state),
                 (dd.remoteness = mr.remoteness) DESC NULLS LAST,
                 dd.desert_score DESC
      ),
      unplaced_pc AS MATERIALIZED (
        SELECT postcode, COALESCE(lga_source, 'unstamped') AS reason, COUNT(*) AS n
        FROM gs_entities
        WHERE lga_name IS NULL AND postcode IS NOT NULL
        GROUP BY 1, 2
      ),
      council_pc AS MATERIALIZED (
        SELECT DISTINCT lga_name, UPPER(state) AS state, postcode
        FROM postcode_geo
        WHERE lga_name IS NOT NULL
      ),
      unplaced AS MATERIALIZED (
        SELECT lga_name, state, SUM(n)::int AS unplaced,
               jsonb_object_agg(reason, n) AS unplaced_reasons
        FROM (
          SELECT cp.lga_name, cp.state, u.reason, SUM(u.n)::int AS n
          FROM council_pc cp
          JOIN unplaced_pc u USING (postcode)
          GROUP BY 1, 2, 3
        ) by_reason
        GROUP BY 1, 2
      ),
      placed AS MATERIALIZED (
        SELECT lga_name, UPPER(state) AS state, COUNT(*)::int AS placed
        FROM gs_entities
        WHERE lga_name IS NOT NULL
        GROUP BY 1, 2
      ),
      justice AS MATERIALIZED (
        SELECT e.lga_name, UPPER(e.state) AS state,
               SUM(jf.amount_dollars)::numeric AS justice_total
        FROM justice_funding jf
        JOIN gs_entities e ON e.id = jf.gs_entity_id
        WHERE e.lga_name IS NOT NULL
        GROUP BY 1, 2
      ),
      grants AS MATERIALIZED (
        SELECT e.lga_name, UPPER(e.state) AS state,
               SUM(ga.value_aud)::numeric AS grants_total
        FROM grantconnect_awards ga
        JOIN gs_entities e ON e.id = ga.gs_entity_id
        WHERE e.lga_name IS NOT NULL
        GROUP BY 1, 2
      ),
      alma AS MATERIALIZED (
        SELECT e.lga_name, UPPER(e.state) AS state,
               COUNT(*)::int AS alma_linked
        FROM alma_interventions ai
        JOIN gs_entities e ON e.id = ai.gs_entity_id
        WHERE e.lga_name IS NOT NULL
        GROUP BY 1, 2
      )
      SELECT lc.lga_name, lc.state, lc.lat, lc.lng, lc.lga_code,
             COALESCE(dd.remoteness, mr.remoteness) AS remoteness,
             dd.avg_irsd_decile, dd.avg_irsd_score,
             dd.indexed_entities, dd.community_controlled_entities,
             dd.total_funding_all_sources, dd.desert_score,
             jt.justice_total AS justice_funding_total,
             gr.grants_total AS grants_awarded_total,
             COALESCE(al.alma_linked, 0) AS alma_linked_count,
             COALESCE(un.unplaced, 0) AS unplaced_count,
             un.unplaced_reasons,
             COALESCE(pl.placed, 0) AS placed_count,
             CASE WHEN COALESCE(un.unplaced, 0) + COALESCE(pl.placed, 0) > 0
                  THEN ROUND(100.0 * COALESCE(un.unplaced, 0)
                       / (COALESCE(un.unplaced, 0) + COALESCE(pl.placed, 0)), 1)
                  ELSE NULL END AS unplaced_share
      FROM lga_centroids lc
      LEFT JOIN deduped_deserts dd ON dd.lga_name = lc.lga_name AND dd.state = lc.state
      LEFT JOIN modal_remoteness mr ON mr.lga_name = lc.lga_name AND mr.state = lc.state
      LEFT JOIN unplaced un ON un.lga_name = lc.lga_name AND un.state = lc.state
      LEFT JOIN placed pl ON pl.lga_name = lc.lga_name AND pl.state = lc.state
      LEFT JOIN justice jt ON jt.lga_name = lc.lga_name AND jt.state = lc.state
      LEFT JOIN grants gr ON gr.lga_name = lc.lga_name AND gr.state = lc.state
      LEFT JOIN alma al ON al.lga_name = lc.lga_name AND al.state = lc.state
      WHERE dd.desert_score IS NOT NULL OR COALESCE(un.unplaced, 0) > 0
      ORDER BY dd.desert_score DESC NULLS LAST`,
      }),
      supabase.rpc('exec_sql', {
        query: `SELECT UPPER(state) AS state,
               COALESCE(lga_source, 'unstamped') AS reason,
               COUNT(*)::int AS n
        FROM gs_entities
        WHERE lga_name IS NULL
        GROUP BY 1, 2`,
      }),
    ]);

    if (councilResult.error) throw councilResult.error;
    if (reasonResult.error) throw reasonResult.error;

    const features = (councilResult.data || []) as Array<{
      lga_name: string; state: string; remoteness: string | null;
      avg_irsd_decile: number | null; desert_score: number | null;
      indexed_entities: number | null; community_controlled_entities: number | null;
      total_funding_all_sources: number | null; lat: number | null; lng: number | null;
      unplaced_count: number; placed_count: number; unplaced_share: number | null;
      justice_funding_total: number | null;
      // Null means no linked awards held; alma is coalesced to 0 because the
      // join ran for every council here — zero is a real answer for it.
      grants_awarded_total: number | null;
      alma_linked_count: number;
      unplaced_reasons: Record<string, number> | null;
    }>;

    // The live why-tally rides the summary: (state, reason, n) rows the
    // client scopes to its state filter. ~40 rows, six reason codes.
    const unplacedReasons = (reasonResult.data || []) as Array<{
      state: string | null; reason: string; n: number;
    }>;

    // Councils with data but no point coordinates render only where a map
    // boundary matches their name; the summary says how many that covers.
    const undrawnLgas = features.filter(f => f.lat === null).length;

    const desertFeatures = features.filter(f => f.desert_score !== null);

    const summary = {
      total_lgas: features.length,
      severe_deserts: desertFeatures.filter(f => Number(f.desert_score) > 100).length,
      avg_desert_score: desertFeatures.length > 0
        ? (desertFeatures.reduce((s, f) => s + Number(f.desert_score), 0) / desertFeatures.length).toFixed(1)
        : '0',
      max_desert_score: desertFeatures.length > 0
        ? Math.max(...desertFeatures.map(f => Number(f.desert_score))).toFixed(1)
        : '0',
      // Councils where at least half the organisations that might be there
      // cannot be placed, with enough of them that it is not small-number
      // noise. No national total: an unplaced organisation counts toward every
      // council sharing its postcode, so summing per-council counts would
      // double-count. High share means every other number here is less certain.
      high_uncertainty_lgas: features.filter(
        f => Number(f.unplaced_share) >= 50 && Number(f.unplaced_count) >= 50
      ).length,
      undrawn_lgas: undrawnLgas,
      unplaced_reasons: unplacedReasons,
    };

    const response = NextResponse.json({ features, summary, metric });
    response.headers.set('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=1200');
    return response;
  } catch (error) {
    console.error('Map data error:', error);
    return NextResponse.json({ error: 'Failed to fetch map data' }, { status: 500 });
  }
}
