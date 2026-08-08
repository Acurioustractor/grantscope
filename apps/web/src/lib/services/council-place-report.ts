import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';

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

export interface CouncilPlaceReport extends CouncilSummary {
  /** Postcodes the council's own organisations use. */
  postcodes: string[];
  /**
   * Organisations sharing those postcodes that no council can be worked out
   * for. Some belong here and some do not. We cannot tell which.
   */
  unplacedOrgs: Array<{ name: string; communityControlled: boolean }>;
  unplacedTotal: number;
  unplacedCommunityControlled: number;
  /**
   * Localities in those postcodes the national gazetteer cannot resolve —
   * either absent from ABS SAL_2021, or spanning more than one council.
   */
  gazetteerGaps: Array<{ locality: string; straddles: string[] }>;
  computedAt: string;
}

export function councilSlug(lgaName: string): string {
  return lgaName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

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
export const getRemoteCouncils = cache(async function getRemoteCouncils(): Promise<CouncilSummary[]> {
  const db = getServiceSupabase();
  const result = await db.rpc('exec_sql', {
    query: `SELECT lga_name,
                   mode() WITHIN GROUP (ORDER BY state) AS state,
                   mode() WITHIN GROUP (ORDER BY remoteness) AS remoteness,
                   count(*) AS orgs,
                   count(*) FILTER (WHERE is_community_controlled) AS cc
              FROM gs_entities
             WHERE lga_name IS NOT NULL
               AND remoteness IN ('Remote Australia','Very Remote Australia')
             GROUP BY lga_name
            HAVING count(*) FILTER (WHERE is_community_controlled) > 0
             ORDER BY cc DESC`,
  });
  if (!Array.isArray(result.data)) return [];

  return (result.data as Array<Record<string, unknown>>).map(row => ({
    lgaName: String(row.lga_name ?? ''),
    slug: councilSlug(String(row.lga_name ?? '')),
    state: (row.state as string | null) || null,
    remoteness: (row.remoteness as string | null) || null,
    orgCount: num(row.orgs),
    communityControlled: num(row.cc),
  }));
});

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
      postcodes: [],
      unplacedOrgs: [],
      unplacedTotal: 0,
      unplacedCommunityControlled: 0,
      gazetteerGaps: [],
      computedAt: new Date().toISOString(),
    };
  }

  const inPostcodes = quoted(postcodes);
  const [unplacedResult, countResult, gapsResult] = await Promise.all([
    // Community-controlled and Indigenous corporations only. A list of every
    // unplaced business in five postcodes is not a question anyone can answer.
    db.rpc('exec_sql', {
      query: `SELECT canonical_name, is_community_controlled
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

  return {
    ...council,
    postcodes,
    unplacedOrgs: (Array.isArray(unplacedResult.data) ? unplacedResult.data : []).map(entry => {
      const row = entry as Record<string, unknown>;
      return {
        name: String(row.canonical_name ?? ''),
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
