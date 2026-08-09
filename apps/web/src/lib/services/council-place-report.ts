import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';
import { placeSlug } from '@/lib/atlas/share';

/**
 * The part of a place report that needs no local knowledge.
 *
 * Four regions were described by hand. Each one took reading organisation names
 * one at a time and knowing that Urapuntja is Utopia, that Ardyaloon is on the
 * Dampier Peninsula, that Pukatja is in South Australia. That does not scale:
 * there are 117 remote councils holding community-controlled organisations and
 * no query knows any of those things.
 *
 * What a query does know is where the register runs out. That part is derived
 * here for every council at once, so a place we have never looked at still gets
 * an honest account of what we cannot tell it — instead of nothing, which is
 * what 113 of them have now.
 *
 * The list of organisations this produces is a question, not an answer. It says
 * "these share your postcodes and we cannot place them", and the only people
 * who can say which are actually theirs are the people there.
 */

export interface CouncilSummary {
  lgaName: string;
  slug: string;
  state: string | null;
  remoteness: string | null;
  orgCount: number;
  communityControlled: number;
}

/**
 * The rest of the picture for a place, and the parts of it we do not hold.
 *
 * Assembled deliberately rather than by joining everything available on
 * postcode. Joining `social_enterprises` that way credited Central Desert with
 * 150 of them, all of which sit in postcode 0872 — a postcode spanning eight
 * councils and a third of the continent. That number would have looked entirely
 * plausible on a page. Anything that cannot be placed honestly is reported as a
 * gap instead of a figure.
 */
export interface PlaceContext {
  /** SEIFA deciles, 1 is the most disadvantaged tenth of Australia. */
  seifa: { irsd: number | null; ieo: number | null; ier: number | null; postcodes: number } | null;
  indigenousCorporations: number;
  communityControlled: number;
  /** Crime rows held for this council. Zero means we hold none, not that there is none. */
  crimeRows: number;
  /**
   * Social enterprises sharing this council's postcodes. Not a count of social
   * enterprises here, and never rendered as one.
   */
  socialEnterprisesInPostcodes: number;
}

export interface CouncilPlaceReport extends CouncilSummary {
  context: PlaceContext;
  /** Postcodes the council's own organisations use. */
  postcodes: string[];
  /**
   * Organisations sharing those postcodes that no council can be worked out
   * for. Some belong here and some do not. We cannot tell which. gs_id and
   * postcode travel with each row so advice gathered in the room can be
   * turned into a keyed verdict later without re-matching by name.
   */
  unplacedOrgs: Array<{ gsId: string; name: string; postcode: string; communityControlled: boolean }>;
  unplacedTotal: number;
  unplacedCommunityControlled: number;
  /**
   * Localities in those postcodes the national gazetteer cannot resolve —
   * either absent from ABS SAL_2021, or spanning more than one council.
   */
  gazetteerGaps: Array<{ locality: string; straddles: string[] }>;
  computedAt: string;
}

// The Atlas builds the same slug client-side (lib/atlas/share.ts); one
// implementation means /atlas links and /place/council/[slug] cannot drift.
export const councilSlug = placeSlug;

function quoted(values: string[]): string {
  return values.map(value => `'${value.replace(/'/g, "''")}'`).join(',');
}

function num(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Every remote council that holds at least one community-controlled
 * organisation.
 *
 * Grouped from gs_entities rather than read from mv_lga_place_profile. The view
 * carries one remoteness per council, so a council it classes as regional drops
 * out even when it holds remote community-controlled organisations — that lost
 * 30 of 117 councils, and the ones it lost are exactly the kind this layer is
 * for. Remoteness is a property of where an organisation is, not of the council
 * containing it.
 *
 * Grouping by name also merges the 7,850 organisations that carry a council
 * with no state at all, which the view splits into a separate row.
 */
// The list moves slowly and the query is a national GROUP BY, so it runs at
// most every 15 minutes per instance, not per pageview. Between refreshes a
// pooler blip serves the stale list instead of failing anyone's page.
const fetchRemoteCouncils = unstable_cache(
  async (): Promise<CouncilSummary[]> => {
    const db = getServiceSupabase();
    // Counts cover EVERY organisation placed under the council, whatever its
    // row-level remoteness — the header "we hold N" must match the Atlas's
    // who's-here, and a placed row with a missing remoteness field is still
    // held (Ceduna read 52 vs the register's 53 until this was split, found
    // 2026-08-10). Remoteness only decides which councils get a page: those
    // holding at least one remote or very-remote community-controlled org.
    const result = await db.rpc('exec_sql', {
      query: `SELECT lga_name,
                   mode() WITHIN GROUP (ORDER BY state) AS state,
                   mode() WITHIN GROUP (ORDER BY remoteness) AS remoteness,
                   count(*) AS orgs,
                   count(*) FILTER (WHERE is_community_controlled) AS cc
              FROM gs_entities
             WHERE lga_name IS NOT NULL
             GROUP BY lga_name
            HAVING count(*) FILTER (
              WHERE is_community_controlled
                AND remoteness IN ('Remote Australia','Very Remote Australia')
            ) > 0
             ORDER BY cc DESC`,
    });
    // A failure must THROW, never return []: an empty list reads as "no such
    // council" downstream, and a pooler timeout was rendering real pages as
    // 404s (Ben hit it live, 2026-08-10). An error page tells the truth.
    if (result.error) {
      throw new Error(`remote councils query failed: ${String(result.error.message ?? result.error)}`);
    }
    if (!Array.isArray(result.data)) {
      throw new Error('remote councils query returned no rowset');
    }

    return (result.data as Array<Record<string, unknown>>).map(row => ({
      lgaName: String(row.lga_name ?? ''),
      slug: councilSlug(String(row.lga_name ?? '')),
      state: (row.state as string | null) || null,
      remoteness: (row.remoteness as string | null) || null,
      orgCount: num(row.orgs),
      communityControlled: num(row.cc),
    }));
  },
  ['remote-councils'],
  { revalidate: 900 }
);

export const getRemoteCouncils = cache(fetchRemoteCouncils);

export const getCouncilPlaceReport = cache(async function getCouncilPlaceReport(
  slug: string,
): Promise<CouncilPlaceReport | null> {
  const councils = await getRemoteCouncils();
  const council = councils.find(entry => entry.slug === slug);
  if (!council) return null;

  const db = getServiceSupabase();
  const lga = council.lgaName.replace(/'/g, "''");

  const postcodeResult = await db.rpc('exec_sql', {
    query: `SELECT DISTINCT postcode FROM gs_entities
             WHERE lga_name = '${lga}' AND postcode IS NOT NULL AND postcode <> ''
             ORDER BY postcode`,
  });
  const postcodes = (Array.isArray(postcodeResult.data) ? postcodeResult.data : [])
    .map(row => String((row as Record<string, unknown>).postcode ?? ''))
    .filter(Boolean);

  if (postcodes.length === 0) {
    return {
      ...council,
      context: {
        seifa: null,
        indigenousCorporations: 0,
        communityControlled: council.communityControlled,
        crimeRows: 0,
        socialEnterprisesInPostcodes: 0,
      },
      postcodes: [],
      unplacedOrgs: [],
      unplacedTotal: 0,
      unplacedCommunityControlled: 0,
      gazetteerGaps: [],
      computedAt: new Date().toISOString(),
    };
  }

  const inPostcodes = quoted(postcodes);
  // Social enterprises join on ABN through gs_entities, never on postcode.
  // Postcode credited Central Desert with 150 of them, all sitting in 0872.
  // The ABN join gives 8. It inherits whatever placement error the entity
  // carries, which is documented, rather than inventing a new one.
  const contextResult = db.rpc('exec_sql', {
    query: `SELECT
              -- SEIFA is keyed on the postcodes ABS assigns to this council,
              -- not the postcodes its organisations are registered in. Those
              -- are different sets, and using the organisations' would put the
              -- registered-address distortion inside a need measure — the one
              -- thing these signals exist to stay clear of.
              (SELECT round(avg(s.decile_national),1) FROM seifa_2021 s
                WHERE s.index_type='IRSD' AND s.postcode IN
                  (SELECT postcode FROM postcode_geo WHERE lga_name='${lga}')) AS irsd,
              (SELECT round(avg(s.decile_national),1) FROM seifa_2021 s
                WHERE s.index_type='IEO' AND s.postcode IN
                  (SELECT postcode FROM postcode_geo WHERE lga_name='${lga}')) AS ieo,
              (SELECT round(avg(s.decile_national),1) FROM seifa_2021 s
                WHERE s.index_type='IER' AND s.postcode IN
                  (SELECT postcode FROM postcode_geo WHERE lga_name='${lga}')) AS ier,
              (SELECT count(DISTINCT s.postcode) FROM seifa_2021 s
                WHERE s.postcode IN
                  (SELECT postcode FROM postcode_geo WHERE lga_name='${lga}')) AS seifa_postcodes,
              (SELECT count(*) FROM gs_entities
                WHERE lga_name='${lga}' AND entity_type='indigenous_corp') AS indigenous_corps,
              (SELECT count(*) FROM gs_entities
                WHERE lga_name='${lga}' AND is_community_controlled) AS community_controlled,
              -- State-qualified: LGA names repeat across states (Bayside is
              -- both NSW and VIC), and counting another state's rows would
              -- claim we hold crime records for this council when we do not.
              (SELECT count(*) FROM crime_stats_lga
                WHERE lga_name='${lga}'${council.state ? ` AND state='${council.state.replace(/'/g, "''")}'` : ''}) AS crime_rows,
              (SELECT count(*) FROM social_enterprises se
                 JOIN gs_entities e ON e.abn = se.abn
                WHERE e.lga_name='${lga}') AS social_enterprises`,
  });

  const [unplacedResult, countResult, gapsResult] = await Promise.all([
    // Community-controlled and Indigenous corporations only. A list of every
    // unplaced business in five postcodes is not a question anyone can answer.
    db.rpc('exec_sql', {
      query: `SELECT gs_id, canonical_name, postcode, is_community_controlled
                FROM gs_entities
               WHERE lga_name IS NULL AND postcode IN (${inPostcodes})
                 AND (is_community_controlled = true OR entity_type = 'indigenous_corp')
                 AND (oric_status IS NULL OR oric_status <> 'Deregistered')
               ORDER BY canonical_name LIMIT 200`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT count(*) AS total,
                     count(*) FILTER (WHERE is_community_controlled) AS cc
                FROM gs_entities
               WHERE lga_name IS NULL AND postcode IN (${inPostcodes})`,
    }),
    // A locality the gazetteer has no row for, or one it maps to more than one
    // council, cannot resolve either way. Both are reported the same because
    // both mean the same thing to a reader: we cannot place this.
    db.rpc('exec_sql', {
      query: `SELECT pg.locality,
                     coalesce(array_agg(DISTINCT al.lga_name) FILTER (WHERE al.lga_name IS NOT NULL), '{}') AS straddles
                FROM (SELECT DISTINCT postcode, locality FROM postcode_geo WHERE postcode IN (${inPostcodes})) pg
                LEFT JOIN abs_locality_lga al ON upper(al.locality) = upper(pg.locality)
               GROUP BY pg.locality
              HAVING count(al.lga_name) = 0 OR count(DISTINCT al.lga_name) > 1
               ORDER BY pg.locality LIMIT 40`,
    }),
  ]);

  const countRow = Array.isArray(countResult.data)
    ? (countResult.data[0] as Record<string, unknown> | undefined)
    : undefined;
  const ctx = Array.isArray((await contextResult).data)
    ? (((await contextResult).data as Array<Record<string, unknown>>)[0] ?? {})
    : {};
  const seifaPostcodes = num(ctx.seifa_postcodes);

  return {
    ...council,
    context: {
      seifa:
        seifaPostcodes > 0
          ? {
              irsd: ctx.irsd === null || ctx.irsd === undefined ? null : num(ctx.irsd),
              ieo: ctx.ieo === null || ctx.ieo === undefined ? null : num(ctx.ieo),
              ier: ctx.ier === null || ctx.ier === undefined ? null : num(ctx.ier),
              postcodes: seifaPostcodes,
            }
          : null,
      indigenousCorporations: num(ctx.indigenous_corps),
      communityControlled: num(ctx.community_controlled),
      crimeRows: num(ctx.crime_rows),
      socialEnterprisesInPostcodes: num(ctx.social_enterprises),
    },
    postcodes,
    unplacedOrgs: (Array.isArray(unplacedResult.data) ? unplacedResult.data : []).map(entry => {
      const row = entry as Record<string, unknown>;
      return {
        gsId: String(row.gs_id ?? ''),
        name: String(row.canonical_name ?? ''),
        postcode: String(row.postcode ?? ''),
        communityControlled: row.is_community_controlled === true,
      };
    }),
    unplacedTotal: num(countRow?.total),
    unplacedCommunityControlled: num(countRow?.cc),
    gazetteerGaps: (Array.isArray(gapsResult.data) ? gapsResult.data : []).map(entry => {
      const row = entry as Record<string, unknown>;
      return {
        locality: String(row.locality ?? ''),
        straddles: Array.isArray(row.straddles) ? (row.straddles as string[]) : [],
      };
    }),
    computedAt: new Date().toISOString(),
  };
});
