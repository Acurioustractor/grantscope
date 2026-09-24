import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { z } from 'zod';
import { getServiceSupabase } from '@/lib/supabase';
import { whitelist } from '@/lib/sql';
import { rateLimit } from '@/lib/rate-limit';
import { NON_RECIPIENT_SQL_ARRAY, STATE_CODES_SQL } from '@/lib/grant-place-capture';
import { grantFilterSql } from '@/lib/justice-money';

export const dynamic = 'force-dynamic';

const limiter = rateLimit();

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] as const;
const METRICS = ['desert_score', 'unplaced_share'] as const;
const ORG_ENTITY_FILTER_SQL = "entity_type NOT IN ('person', 'program')";

type Feature = {
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
};

type Row = Record<string, unknown> & { lga_name: string; state: string };

const councilKey = (r: { lga_name: string; state: string }) => `${r.lga_name}|${r.state}`;

// Every council-grain part below joins this list, so each returns at most one
// row per council (538) and stays under PostgREST's silent 1,000-row cap:
// gs_entities alone holds 1,091 (lga_name, state) pairs.
function councilsCte(stateClause: string) {
  return `councils AS (
        SELECT DISTINCT lga_name, UPPER(state) AS state
        FROM postcode_geo
        WHERE lga_name IS NOT NULL ${stateClause}
      )`;
}

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
    const { features, unplacedReasons } = await getMapDataCached(safeState ?? null);

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

// Five statements in parallel instead of one. As a single statement this took
// 4.6s warm and 8.0s cold against the 8s statement_timeout on authenticator,
// so /atlas and /reallocation-atlas 500'd whenever the shared database was
// busy (2026-09-24). No part takes more than ~0.6s on its own. A failure
// throws, so unstable_cache never keeps an empty payload.
async function getMapData(safeState: string | null) {
  const supabase = getServiceSupabase();
  const run = async <T,>(query: string): Promise<T[]> => {
    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (error) throw error;
    return (data || []) as T[];
  };

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
  const [base, placement, money, capture, unplacedReasons] = await Promise.all([
    run<Row>(`WITH lga_centroids AS (
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
    capture_state AS (
      -- Place capture at state grain, across nearly the whole register: states
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
    )
    SELECT lc.lga_name, lc.state, lc.lat, lc.lng, lc.lga_code,
           COALESCE(dd.remoteness, mr.remoteness) AS remoteness,
           dd.avg_irsd_decile, dd.avg_irsd_score,
           dd.indexed_entities, dd.community_controlled_entities,
           dd.total_funding_all_sources, dd.desert_score,
           cs.state_capture_pct_dollars, cs.state_capture_pct_awards
    FROM lga_centroids lc
    LEFT JOIN deduped_deserts dd ON dd.lga_name = lc.lga_name AND dd.state = lc.state
    LEFT JOIN modal_remoteness mr ON mr.lga_name = lc.lga_name AND mr.state = lc.state
    LEFT JOIN capture_state cs ON cs.state = lc.state`),

    run<Row>(`WITH ${councilsCte(stateClause)},
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
      WHERE lga_name IS NOT NULL ${stateClause}
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
    )
    SELECT c.lga_name, c.state,
           COALESCE(un.unplaced, 0) AS unplaced_count,
           un.unplaced_reasons,
           COALESCE(pl.placed, 0) AS placed_count,
           CASE WHEN COALESCE(un.unplaced, 0) + COALESCE(pl.placed, 0) > 0
                THEN ROUND(100.0 * COALESCE(un.unplaced, 0)
                     / (COALESCE(un.unplaced, 0) + COALESCE(pl.placed, 0)), 1)
                ELSE NULL END AS unplaced_share
    FROM councils c
    LEFT JOIN unplaced un ON un.lga_name = c.lga_name AND un.state = c.state
    LEFT JOIN placed pl ON pl.lga_name = c.lga_name AND pl.state = c.state
    WHERE un.unplaced IS NOT NULL OR pl.placed IS NOT NULL`),

    run<Row>(`WITH ${councilsCte(stateClause)},
    justice AS MATERIALIZED (
      -- The grant lane only: without it this summed $62.64bn where the grants
      -- to placed organisations are $30.43bn (budgets, aggregates and contract
      -- values ride the same amount column; measured 2026-09-24).
      SELECT e.lga_name, UPPER(e.state) AS state,
             SUM(jf.amount_dollars)::numeric AS justice_total
      FROM justice_funding jf
      JOIN gs_entities e ON e.id = jf.gs_entity_id
      WHERE e.lga_name IS NOT NULL
        AND ${grantFilterSql('jf')}
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
      FROM alma_interventions_valid ai
      JOIN gs_entities e ON e.id = ai.gs_entity_id
      WHERE e.lga_name IS NOT NULL
      GROUP BY 1, 2
    )
    SELECT c.lga_name, c.state,
           jt.justice_total AS justice_funding_total,
           gr.grants_total AS grants_awarded_total,
           al.alma_linked AS alma_linked_count
    FROM councils c
    LEFT JOIN justice jt ON jt.lga_name = c.lga_name AND jt.state = c.state
    LEFT JOIN grants gr ON gr.lga_name = c.lga_name AND gr.state = c.state
    LEFT JOIN alma al ON al.lga_name = c.lga_name AND al.state = c.state
    WHERE jt.justice_total IS NOT NULL OR gr.grants_total IS NOT NULL OR al.alma_linked IS NOT NULL`),

    // Place capture at council grain, from v_grant_place_capture. The view holds
    // the four exclusions (see migrations/2026-08-19-grant-place-capture.sql and
    // lib/grant-place-capture.ts); do not restate them here.
    //
    // Denominator is the RESOLVED base — awards whose recipient postcode also
    // resolves to a single trustworthy council. 6,259 covered awards ($10.69bn)
    // do not, and counting those as delivered off-site is what turns an 87.3%
    // national dollar share into 59.6%. Unresolved is not off-site.
    //
    // Councils under 20 resolved awards report NULL rather than a confident
    // percentage on noise, which the layer paints as "not measured".
    run<Row>(`WITH ${councilsCte(stateClause)}
    SELECT c.lga_name, c.state,
           count(*)::int AS capture_awards,
           sum(v.value_aud)::numeric AS capture_dollars,
           CASE WHEN count(*) FILTER (WHERE v.recipient_lga IS NOT NULL) >= 20
                THEN ROUND(100.0 * sum(v.value_aud) FILTER (WHERE v.captured_locally)
                     / NULLIF(sum(v.value_aud) FILTER (WHERE v.recipient_lga IS NOT NULL), 0), 1)
           END AS capture_pct_dollars,
           CASE WHEN count(*) FILTER (WHERE v.recipient_lga IS NOT NULL) >= 20
                THEN ROUND(100.0 * count(*) FILTER (WHERE v.captured_locally)
                     / NULLIF(count(*) FILTER (WHERE v.recipient_lga IS NOT NULL), 0), 1)
           END AS capture_pct_awards
    FROM v_grant_place_capture v
    JOIN councils c ON c.lga_name = v.delivery_lga AND c.state = v.delivery_state
    GROUP BY 1, 2`),

    // The live "why" tally: every null-lga row carries exactly one lga_source
    // reason code (the 2026-08 placement migrations stamped them), grouped per
    // state so the caveat card can scope to the state filter. State is null for
    // records that hold no state at all.
    run<{ state: string | null; reason: string; n: number }>(`SELECT UPPER(state) AS state,
             COALESCE(lga_source, 'unstamped') AS reason,
             COUNT(*)::int AS n
      FROM gs_entities
      WHERE lga_name IS NULL
        AND ${ORG_ENTITY_FILTER_SQL}
      GROUP BY 1, 2`),
  ]);

  const byCouncil = (rows: Row[]) => new Map(rows.map(r => [councilKey(r), r]));
  const placementBy = byCouncil(placement);
  const moneyBy = byCouncil(money);
  const captureBy = byCouncil(capture);

  const features = base
    .map((b): Feature => {
      const k = councilKey(b);
      const p = placementBy.get(k);
      const m = moneyBy.get(k);
      const c = captureBy.get(k);
      return {
        ...(b as unknown as Feature),
        justice_funding_total: (m?.justice_funding_total ?? null) as number | null,
        grants_awarded_total: (m?.grants_awarded_total ?? null) as number | null,
        alma_linked_count: (m?.alma_linked_count ?? 0) as number,
        capture_pct_dollars: (c?.capture_pct_dollars ?? null) as number | null,
        capture_pct_awards: (c?.capture_pct_awards ?? null) as number | null,
        capture_awards: (c?.capture_awards ?? null) as number | null,
        capture_dollars: (c?.capture_dollars ?? null) as number | null,
        unplaced_count: (p?.unplaced_count ?? 0) as number,
        unplaced_reasons: (p?.unplaced_reasons ?? null) as Record<string, number> | null,
        placed_count: (p?.placed_count ?? 0) as number,
        unplaced_share: (p?.unplaced_share ?? null) as number | null,
      };
    })
    .filter(f => f.desert_score !== null || f.unplaced_count > 0)
    .sort((a, b) => (b.desert_score ?? -Infinity) - (a.desert_score ?? -Infinity));

  return { features, unplacedReasons };
}

// Keyed on the state argument. A thrown query is not cached, so a cold miss
// that fails is retried on the next request rather than served for an hour.
const getMapDataCached = unstable_cache(getMapData, ['api-data-map-v1'], { revalidate: 3600 });
