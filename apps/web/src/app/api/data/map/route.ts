import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { whitelist } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';
import { NON_RECIPIENT_SQL_ARRAY, STATE_CODES_SQL } from '@/lib/grant-place-capture';

export const dynamic = 'force-dynamic';

const limiter = rateLimit();

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
const METRICS = ['desert_score', 'unplaced_share'] as const;
const ORG_ENTITY_FILTER_SQL = "entity_type NOT IN ('person', 'program')";

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
          AND ${ORG_ENTITY_FILTER_SQL}
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
          AND ${ORG_ENTITY_FILTER_SQL}
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
      capture_lga AS MATERIALIZED (
        -- Place capture at council grain, from v_grant_place_capture. The view holds
        -- the four exclusions (see migrations/2026-08-19-grant-place-capture.sql and
        -- lib/grant-place-capture.ts); do not restate them here.
        --
        -- Denominator is the RESOLVED base — awards whose recipient postcode also
        -- resolves to a single trustworthy council. 6,259 covered awards ($10.69bn)
        -- do not, and counting those as delivered off-site is what turns an 87.3%
        -- national dollar share into 59.6%. Unresolved is not off-site.
        --
        -- Councils under 20 resolved awards report NULL rather than a confident
        -- percentage on noise, which the layer paints as "not measured".
        SELECT delivery_lga AS lga_name, delivery_state AS state,
               count(*)::int AS capture_awards,
               sum(value_aud)::numeric AS capture_dollars,
               CASE WHEN count(*) FILTER (WHERE recipient_lga IS NOT NULL) >= 20
                    THEN ROUND(100.0 * sum(value_aud) FILTER (WHERE captured_locally)
                         / NULLIF(sum(value_aud) FILTER (WHERE recipient_lga IS NOT NULL), 0), 1)
               END AS capture_pct_dollars,
               CASE WHEN count(*) FILTER (WHERE recipient_lga IS NOT NULL) >= 20
                    THEN ROUND(100.0 * count(*) FILTER (WHERE captured_locally)
                         / NULLIF(count(*) FILTER (WHERE recipient_lga IS NOT NULL), 0), 1)
               END AS capture_pct_awards
        FROM v_grant_place_capture
        GROUP BY 1, 2
      ),
      capture_state AS MATERIALIZED (
        -- The same measure at state grain, across nearly the whole register: states
        -- are recorded directly, so none of the postcode exclusions apply. Only the
        -- multi-state, 'National' and 'Overseas' delivery strings drop out, which is
        -- why this covers $200bn where the council path covers $33.75bn.
        SELECT delivery_state AS state,
               ROUND(100.0 * sum(value_aud) FILTER (WHERE recipient_state = delivery_state)
                    / NULLIF(sum(value_aud) FILTER (WHERE recipient_state IN (${STATE_CODES_SQL})), 0), 1)
                 AS state_capture_pct_dollars,
               ROUND(100.0 * count(*) FILTER (WHERE recipient_state = delivery_state)
                    / NULLIF(count(*) FILTER (WHERE recipient_state IN (${STATE_CODES_SQL})), 0), 1)
                 AS state_capture_pct_awards
        FROM grantconnect_awards
        WHERE value_aud > 0
          AND delivery_state IN (${STATE_CODES_SQL})
          AND lower(btrim(recipient_name)) <> ALL (${NON_RECIPIENT_SQL_ARRAY})
        GROUP BY 1
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
             cl.capture_pct_dollars, cl.capture_pct_awards,
             cl.capture_awards, cl.capture_dollars,
             cs.state_capture_pct_dollars, cs.state_capture_pct_awards,
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
      LEFT JOIN capture_lga cl ON cl.lga_name = lc.lga_name AND cl.state = lc.state
      LEFT JOIN capture_state cs ON cs.state = lc.state
      WHERE dd.desert_score IS NOT NULL OR COALESCE(un.unplaced, 0) > 0
      ORDER BY dd.desert_score DESC NULLS LAST`,
      }),
      supabase.rpc('exec_sql', {
        query: `SELECT UPPER(state) AS state,
               COALESCE(lga_source, 'unstamped') AS reason,
               COUNT(*)::int AS n
        FROM gs_entities
        WHERE lga_name IS NULL
          AND ${ORG_ENTITY_FILTER_SQL}
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
      // Null on capture means not measured — no covered awards, or too few
      // resolved ones to report a share. Never coerce it to zero: a blank
      // council has not been shown to keep nothing.
      capture_pct_dollars: number | null;
      capture_pct_awards: number | null;
      capture_awards: number | null;
      capture_dollars: number | null;
      state_capture_pct_dollars: number | null;
      state_capture_pct_awards: number | null;
      unplaced_reasons: Record<string, number> | null;
    }>;

    // The live why-tally rides the summary: (state, reason, n) rows the
    // client scopes to its state filter.
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
