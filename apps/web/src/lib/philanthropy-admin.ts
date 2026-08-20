import { getDirectServiceSupabase } from '@/lib/supabase';

/**
 * The philanthropy lane, as it actually is.
 *
 * THE ONE THING THIS PAGE EXISTS TO PREVENT. We hold what 98% of foundations SAY and what 0.2% of
 * them DO. Measured 2026-08-21: 11,177 foundations, 10,945 carry a stated theme, and **20 have a
 * single observed grantee**. Any matching, scoring or "top funders" feature built on the stated
 * side is built on self-description at a 500:1 ratio to evidence.
 *
 * AND THE GIVING FIGURES ARE PLACEHOLDERS. Of 10,190 non-null `total_giving_annual` values, 6,942
 * are exactly $25,000, 1,474 are exactly $100,000 and 801 are exactly $500,000 — **90% sitting on
 * three round numbers**. Only 964 distinct values exist across 10,190 rows. Nothing may sort or
 * rank on that column, and this module deliberately exposes the placeholder counts so a surface
 * can show why rather than quietly omitting the field.
 *
 * WHAT IS GENUINELY GOOD HERE. `foundation_category_assignments` (42,599 rows) is real thematic
 * classification with evidence text and a classifier version. `foundation_grantees` is small but
 * observed, and reaches 121 remote and very-remote councils. Those two are the load-bearing
 * assets; everything else is context.
 */

export interface PhilanthropyCensus {
  foundations: number;
  withStatedTheme: number;
  withObservedGrantee: number;
  granteeRows: number;
  foundationsPublishingGrantees: number;
  withDgr: number;
  /** geo_focus coverage by grain — the reason place-level matching is not possible today. */
  geoByType: Array<{ geoType: string; foundations: number; places: number }>;
  themes: Array<{ slug: string; foundations: number }>;
  /** The three round numbers and how many foundations sit on each. */
  givingPlaceholders: Array<{ value: number; foundations: number }>;
  givingDistinctValues: number;
  givingNonNull: number;
}

export interface FoundationRow {
  id: string;
  name: string;
  abn: string | null;
  hasDgr: boolean;
  themes: string[];
  geo: string[];
  observedGrants: number;
  observedDollars: number;
  councilsReached: number;
}

async function run<T>(query: string): Promise<T[]> {
  const { data, error } = await getDirectServiceSupabase().rpc('exec_sql', { query });
  if (error) throw new Error(`philanthropy query failed: ${error.message}`);
  return (data ?? []) as T[];
}

const n = (v: unknown) => Number(v ?? 0) || 0;

export async function philanthropyCensus(): Promise<PhilanthropyCensus> {
  const [totals, geo, themes, placeholders] = await Promise.all([
    run<Record<string, unknown>>(`
      SELECT (SELECT count(*) FROM foundations) AS foundations,
             (SELECT count(DISTINCT foundation_id) FROM foundation_category_assignments) AS themed,
             (SELECT count(DISTINCT f.id) FROM foundations f
                JOIN foundation_grantees g ON lower(btrim(g.foundation_name)) = lower(btrim(f.name))) AS observed,
             (SELECT count(*) FROM foundation_grantees) AS grantee_rows,
             (SELECT count(DISTINCT foundation_name) FROM foundation_grantees) AS publishers,
             (SELECT count(*) FROM foundations WHERE has_dgr) AS dgr,
             (SELECT count(DISTINCT total_giving_annual) FROM foundations WHERE total_giving_annual IS NOT NULL) AS giving_distinct,
             (SELECT count(*) FROM foundations WHERE total_giving_annual IS NOT NULL) AS giving_nonnull`),
    run<Record<string, unknown>>(`
      SELECT geo_type, count(DISTINCT foundation_id) AS foundations, count(DISTINCT geo_name) AS places
        FROM foundation_geo_focus GROUP BY 1 ORDER BY 2 DESC`),
    run<Record<string, unknown>>(`
      SELECT category_slug, count(DISTINCT foundation_id) AS foundations
        FROM foundation_category_assignments GROUP BY 1 ORDER BY 2 DESC`),
    run<Record<string, unknown>>(`
      SELECT total_giving_annual AS value, count(*) AS foundations
        FROM foundations WHERE total_giving_annual IS NOT NULL
       GROUP BY 1 ORDER BY 2 DESC LIMIT 3`),
  ]);
  const t = totals[0] ?? {};
  return {
    foundations: n(t.foundations),
    withStatedTheme: n(t.themed),
    withObservedGrantee: n(t.observed),
    granteeRows: n(t.grantee_rows),
    foundationsPublishingGrantees: n(t.publishers),
    withDgr: n(t.dgr),
    givingDistinctValues: n(t.giving_distinct),
    givingNonNull: n(t.giving_nonnull),
    geoByType: geo.map(g => ({
      geoType: String(g.geo_type ?? ''),
      foundations: n(g.foundations),
      places: n(g.places),
    })),
    themes: themes.map(x => ({ slug: String(x.category_slug ?? ''), foundations: n(x.foundations) })),
    givingPlaceholders: placeholders.map(p => ({ value: n(p.value), foundations: n(p.foundations) })),
  };
}

/**
 * Search foundations by name, theme slug or stated geography.
 *
 * Observed columns come from `foundation_grantees` matched on NAME, because `foundation_grantees`
 * carries no foundation_id. That join is lossy and the surface says so: a foundation whose grantee
 * list is filed under a different spelling of its name reads as having no observed giving.
 */
export async function searchFoundations(query: string, limit = 40): Promise<FoundationRow[]> {
  const q = query.trim().toLowerCase().replace(/'/g, "''");
  if (!q) return [];
  const cap = Math.max(1, Math.min(100, Math.floor(limit)));
  const rows = await run<Record<string, unknown>>(`
    WITH matched AS (
      SELECT DISTINCT f.id, f.name, f.acnc_abn, f.has_dgr
        FROM foundations f
        LEFT JOIN foundation_category_assignments c ON c.foundation_id = f.id
        LEFT JOIN foundation_geo_focus gf ON gf.foundation_id = f.id
       WHERE lower(f.name) LIKE '%${q}%'
          OR lower(c.category_slug) LIKE '%${q}%'
          OR lower(gf.geo_name) LIKE '%${q}%'
       LIMIT ${cap}
    )
    SELECT m.id, m.name, m.acnc_abn, m.has_dgr,
           COALESCE((SELECT array_agg(DISTINCT c.category_slug) FROM foundation_category_assignments c WHERE c.foundation_id = m.id), '{}') AS themes,
           COALESCE((SELECT array_agg(DISTINCT gf.geo_name) FROM foundation_geo_focus gf WHERE gf.foundation_id = m.id), '{}') AS geo,
           (SELECT count(*) FROM foundation_grantees g WHERE lower(btrim(g.foundation_name)) = lower(btrim(m.name)))::bigint AS observed_grants,
           (SELECT COALESCE(sum(g.grant_amount),0) FROM foundation_grantees g WHERE lower(btrim(g.foundation_name)) = lower(btrim(m.name)))::numeric AS observed_dollars,
           (SELECT count(DISTINCT e.lga_name) FROM foundation_grantees g
              JOIN gs_entities e ON e.id = g.grantee_entity_id
             WHERE lower(btrim(g.foundation_name)) = lower(btrim(m.name)) AND e.lga_name IS NOT NULL)::bigint AS councils
      FROM matched m
     ORDER BY (SELECT count(*) FROM foundation_grantees g WHERE lower(btrim(g.foundation_name)) = lower(btrim(m.name))) DESC,
              m.name`);
  return rows.map(r => ({
    id: String(r.id ?? ''),
    name: String(r.name ?? ''),
    abn: (r.acnc_abn as string | null) || null,
    hasDgr: r.has_dgr === true,
    themes: (r.themes as string[] | null) ?? [],
    geo: (r.geo as string[] | null) ?? [],
    observedGrants: n(r.observed_grants),
    observedDollars: n(r.observed_dollars),
    councilsReached: n(r.councils),
  }));
}

export interface PublisherRow {
  foundation: string;
  grants: number;
  withAmount: number;
  dollars: number;
  councils: number;
  remoteCouncils: number;
}

/** The foundations we can actually observe — the short, real list. */
export async function observedPublishers(): Promise<PublisherRow[]> {
  const rows = await run<Record<string, unknown>>(`
    SELECT g.foundation_name AS foundation,
           count(*)::bigint AS grants,
           count(g.grant_amount)::bigint AS with_amount,
           COALESCE(sum(g.grant_amount),0)::numeric AS dollars,
           count(DISTINCT e.lga_name)::bigint AS councils,
           count(DISTINCT e.lga_name) FILTER (
             WHERE e.remoteness IN ('Remote Australia','Very Remote Australia'))::bigint AS remote_councils
      FROM foundation_grantees g
      LEFT JOIN gs_entities e ON e.id = g.grantee_entity_id
     GROUP BY g.foundation_name ORDER BY count(*) DESC`);
  return rows.map(r => ({
    foundation: String(r.foundation ?? ''),
    grants: n(r.grants),
    withAmount: n(r.with_amount),
    dollars: n(r.dollars),
    councils: n(r.councils),
    remoteCouncils: n(r.remote_councils),
  }));
}
