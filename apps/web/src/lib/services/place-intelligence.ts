import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * Data for the public place pages.
 *
 * These numbers are read by people who live in the places being described, so
 * the caveats are part of the data rather than footnotes bolted on by the view:
 * contract value is by supplier registered address, and philanthropic counts
 * are floors limited by our grant-link coverage. Both travel to the page.
 */

export interface PlaceSnapshot {
  areaKey: string;
  areaLabel: string;
  areaNote: string | null;
  remoteness: string | null;
  irsdDecile: number;
  orgCount: number;
  communityControlledCount: number;
  caringForCountry: number;
  employers: number;
  contractCount: number;
  contractValue: number;
  contractValue24m: number;
  govtGrantCount: number;
  govtGrantValue: number;
  /** Share of delivered grant money held by an organisation based here. */
  localRetentionPct: number | null;
  philanthropicFunderCount: number;
  philanthropicGrantCount: number;
  lgaResolved: boolean;
  computedAt: string;
}

export interface UnplacedOrg {
  name: string;
  entityType: string | null;
  communityControlled: boolean;
}

export interface PlaceIntelligence {
  areas: PlaceSnapshot[];
  /** Organisations we can name but cannot place in a council area. */
  unplacedOrgs: UnplacedOrg[];
  unplacedTotal: number;
  gapNote: string | null;
  /** Share of the region's grant money that carries a delivery location. */
  deliveryCoverage: { knownM: number; unknownM: number; pct: number } | null;
  /** Deregistered corporations withheld from the list, reported rather than hidden. */
  deregisteredExcluded: number;
}

interface RawProfile {
  lga_name: string;
  state: string;
  remoteness: string | null;
  avg_irsd_decile: number | string | null;
  org_count: number;
  community_controlled: number;
  without_abn: number;
  caring_for_country: number;
  employers: number;
  contract_count: number;
  contract_value_lifetime: number | string;
  contract_value_24m: number | string;
  grants_delivered: number;
  grants_delivered_value: number | string;
  local_retention_pct: number | string | null;
  philanthropic_funders: number;
  philanthropic_grants: number;
}

/**
 * A region this service can describe.
 *
 * These were hardcoded to Central Australia. They are configuration now because
 * the same shape holds anywhere: a set of council areas, optionally a postcode
 * whose organisations have no council area at all, and labels that use the
 * names people there actually use.
 */
export interface PlaceRegion {
  key: string;
  lgaNames: string[];
  states: string[];
  /** Organisations here cannot be placed in a council area at all. */
  unplaced: { postcode: string; state: string } | null;
  labels: Record<string, { label: string; note: string | null }>;
}

export const PLACE_REGIONS: Record<string, PlaceRegion> = {
  'central-australia': {
    key: 'central-australia',
    lgaNames: ['Alice Springs', 'Barkly', 'MacDonnell', 'Central Desert', 'Anangu Pitjantjatjara Yankunytjatjara'],
    states: ['NT', 'SA'],
    unplaced: { postcode: '0872', state: 'NT' },
    labels: {
      'Alice Springs': { label: 'Mparntwe (Alice Springs)', note: null },
      Barkly: { label: 'Barkly, including Tennant Creek', note: 'Includes Tennant Creek, Ali Curung and Ampilatwatja in the Utopia homelands.' },
      MacDonnell: { label: 'MacDonnell', note: 'Includes Papunya, Hermannsburg and Areyonga.' },
      'Central Desert': { label: 'Central Desert', note: 'Includes Yuendumu and Atitjere.' },
      'Anangu Pitjantjatjara Yankunytjatjara': { label: 'APY Lands (South Australia)', note: 'Iwantja, Mimili, Kaltjiti and Pukatja. Their grants are delivered into postcode 0872, which spans seven councils, so most cannot be placed here.' },
    },
  },
  // Wirangu country and the Far West Coast. Both council areas are listed
  // because postcode 5690 maps every locality in it, Ceduna township included,
  // to Maralinga Tjarutja. Reading only one of them loses most of the region.
  'far-west-coast': {
    key: 'far-west-coast',
    lgaNames: ['Ceduna', 'Maralinga Tjarutja', 'Streaky Bay'],
    states: ['SA'],
    unplaced: null,
    labels: {
      Ceduna: { label: 'Ceduna (District Council)', note: 'Holds far fewer organisations than the town does, because postcode 5690 attributes most of them to Maralinga Tjarutja.' },
      'Maralinga Tjarutja': { label: 'Maralinga Tjarutja', note: 'Carries Oak Valley, and also most Ceduna township organisations through the postcode 5690 mapping. Read it as the Far West Coast rather than as the Maralinga Tjarutja lands alone.' },
      'Streaky Bay': { label: 'Streaky Bay', note: null },
    },
  },
};

function num(value: number | string | null): number {
  if (value === null) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const getPlaceIntelligence = cache(
  async function getPlaceIntelligence(regionKey: string): Promise<PlaceIntelligence> {
    const region = PLACE_REGIONS[regionKey];
    if (!region) {
      throw new Error(`Unknown place region: ${regionKey}`);
    }
    const db = getServiceSupabase();

    const [snapshotResult, orgsResult, gapResult, deregisteredResult] = await Promise.all([
      // mv_lga_place_profile, not place_funding_snapshot. The underlying view
      // aggregates every LGA in the country before filtering, so reading it in
      // the request path timed out; it is materialized and refreshed after an
      // ingest instead. The snapshot was built
      // before councils were reattributed to the shires they serve, so it still
      // credited Alice Springs with $749.4M rather than $688.4M, and its grants
      // figure predates GrantConnect entirely — showing $44.1M where delivered
      // grants are $202.8M.
      db.from('mv_lga_place_profile')
        .select('lga_name, state, remoteness, avg_irsd_decile, org_count, community_controlled, without_abn, caring_for_country, employers, contract_count, contract_value_lifetime, contract_value_24m, grants_delivered, grants_delivered_value, local_retention_pct, philanthropic_funders, philanthropic_grants')
        .in('lga_name', region.lgaNames)
        .in('state', region.states),
      // The homelands organisations, named. They have no council area, so the
      // only honest way to show them is by name — and all of them, not a
      // slice. An alphabetical cap truncates mid-list and quietly drops the
      // Utopia and Urapuntja organisations at the end of the alphabet, which
      // is the same erasure the geocoding bug caused.
      // Deregistered ORIC corporations are excluded. Listing a defunct
      // corporation as a current community organisation misrepresents the
      // community it belonged to, and the first version of this page did
      // exactly that for 57 of them.
      region.unplaced
        ? db.from('gs_entities')
            .select('canonical_name, entity_type, is_community_controlled')
            .eq('state', region.unplaced.state)
            .eq('postcode', region.unplaced.postcode)
            .or('is_community_controlled.eq.true,entity_type.eq.indigenous_corp')
            .or('oric_status.is.null,oric_status.neq.Deregistered')
            .order('canonical_name')
            .limit(300)
        : Promise.resolve({ data: [], error: null }),
      region.unplaced
        ? db.from('geo_resolution_gaps')
            .select('postcode, required_source, affected_entities, affected_community_controlled')
            .eq('postcode', region.unplaced.postcode)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      region.unplaced
        ? db.from('gs_entities')
            .select('id', { count: 'exact', head: true })
            .eq('state', region.unplaced.state)
            .eq('postcode', region.unplaced.postcode)
            .or('is_community_controlled.eq.true,entity_type.eq.indigenous_corp')
            .eq('oric_status', 'Deregistered')
        : Promise.resolve({ count: 0, error: null }),
    ]);

    if (snapshotResult.error) {
      throw new Error(`Place snapshot unavailable: ${snapshotResult.error.message}`);
    }

    const areas = ((snapshotResult.data || []) as RawProfile[])
      .map(row => ({
        areaKey: row.lga_name,
        areaLabel: region.labels[row.lga_name]?.label ?? row.lga_name,
        areaNote: region.labels[row.lga_name]?.note ?? null,
        remoteness: row.remoteness,
        irsdDecile: num(row.avg_irsd_decile),
        orgCount: row.org_count,
        communityControlledCount: row.community_controlled,
        caringForCountry: row.caring_for_country,
        employers: row.employers,
        contractCount: row.contract_count,
        contractValue: num(row.contract_value_lifetime),
        contractValue24m: num(row.contract_value_24m),
        govtGrantCount: row.grants_delivered,
        govtGrantValue: num(row.grants_delivered_value),
        localRetentionPct: row.local_retention_pct === null ? null : num(row.local_retention_pct),
        philanthropicFunderCount: row.philanthropic_funders,
        philanthropicGrantCount: row.philanthropic_grants,
        lgaResolved: true,
        computedAt: new Date().toISOString(),
      }))
      .sort((left, right) => right.contractValue + right.govtGrantValue - (left.contractValue + left.govtGrantValue));

    const unplacedOrgs = orgsResult.error
      ? []
      : ((orgsResult.data || []) as Array<{
          canonical_name: string;
          entity_type: string | null;
          is_community_controlled: boolean | null;
        }>).map(row => ({
          name: row.canonical_name,
          entityType: row.entity_type,
          communityControlled: row.is_community_controlled === true,
        }));

    // How much of the region's grant money can be placed at all. Most cannot:
    // the agencies funding Indigenous affairs and social services publish a
    // delivery location on almost nothing, so a map of delivered grants shows a
    // small and unrepresentative slice.
    const quoted = (values: string[]) => values.map(value => `'${value.replace(/'/g, "''")}'`).join(',');
    const unplacedClause = region.unplaced
      ? ` OR e.postcode = '${region.unplaced.postcode.replace(/'/g, "''")}'`
      : '';
    const coverageResult = await db.rpc('exec_sql', {
      query: `SELECT round(sum(ga.value_aud) FILTER (WHERE ga.delivery_postcode IS NOT NULL)/1e6,1) AS known_m,
                     round(sum(ga.value_aud) FILTER (WHERE ga.delivery_postcode IS NULL)/1e6,1) AS unknown_m
                FROM grantconnect_awards ga
                JOIN gs_entities e ON e.id = ga.gs_entity_id
               WHERE e.state IN (${quoted(region.states)})
                 AND (e.lga_name IN (${quoted(region.lgaNames)})${unplacedClause})`,
    });
    const covRow = Array.isArray(coverageResult.data) ? coverageResult.data[0] as Record<string, unknown> : null;
    const knownM = num((covRow?.known_m as number | string | null) ?? null);
    const unknownM = num((covRow?.unknown_m as number | string | null) ?? null);
    const coverage = knownM + unknownM > 0
      ? { knownM, unknownM, pct: Math.round((100 * knownM) / (knownM + unknownM)) }
      : null;

    const gap = gapResult.error ? null : (gapResult.data as {
      required_source: string;
      affected_entities: number;
      affected_community_controlled: number;
    } | null);

    return {
      areas,
      unplacedOrgs,
      unplacedTotal: gap?.affected_entities ?? unplacedOrgs.length,
      gapNote: gap
        ? `${gap.affected_community_controlled} of ${gap.affected_entities} organisations here are community-controlled. Placing them in a council area needs the ${gap.required_source}.`
        : null,
      deregisteredExcluded: deregisteredResult.error ? 0 : (deregisteredResult.count ?? 0),
      deliveryCoverage: coverage,
    };
  },
);

export function getCentralAustraliaIntelligence(): Promise<PlaceIntelligence> {
  return getPlaceIntelligence('central-australia');
}

/**
 * Federal grants held by organisations registered in a postcode.
 *
 * The place pages previously read funding from gs_relationships, which does not
 * carry GrantConnect. For Ceduna that showed $7.5M against $215.3M of federal
 * money currently committed to organisations based there, so the page reported
 * roughly three cents in the dollar and read as a place nobody funds.
 *
 * This is keyed on the recipient's registered address, not delivery location.
 * Only 41 of 346 awards in postcode 5690 publish a delivery postcode, so a
 * delivery-keyed figure omits seven awards in eight. Registered address has its
 * own bias in the other direction: an organisation registered here may deliver
 * elsewhere, and a service delivered here may be run from Adelaide. Both
 * caveats travel to the page rather than sitting in this comment.
 */
export interface PostcodeFundingPicture {
  postcode: string;
  awards: number;
  recipients: number;
  lifetimeValue: number;
  activeAwards: number;
  activeValue: number;
  /** Committed money whose agreement ends inside two years. The renewal window. */
  endingWithin24mValue: number;
  /** Awards that publish a delivery location, out of the total. */
  withDeliveryPostcode: number;
  topPrograms: Array<{ agency: string; program: string; awards: number; value: number }>;
  endingSoon: Array<{ recipient: string; agency: string; program: string; value: number; endDate: string }>;
}

export const getPostcodeFundingPicture = cache(
  async function getPostcodeFundingPicture(postcode: string): Promise<PostcodeFundingPicture | null> {
    if (!/^\d{4}$/.test(postcode)) return null;
    const db = getServiceSupabase();

    const [totals, programs, ending] = await Promise.all([
      db.rpc('exec_sql', {
        query: `SELECT count(*) AS awards,
                       count(DISTINCT ga.recipient_abn) AS recipients,
                       coalesce(sum(ga.value_aud),0) AS lifetime_value,
                       count(*) FILTER (WHERE ga.end_date >= current_date) AS active_awards,
                       coalesce(sum(ga.value_aud) FILTER (WHERE ga.end_date >= current_date),0) AS active_value,
                       coalesce(sum(ga.value_aud) FILTER (WHERE ga.end_date >= current_date
                                                            AND ga.end_date < current_date + interval '24 months'),0) AS ending_24m_value,
                       count(*) FILTER (WHERE ga.delivery_postcode IS NOT NULL) AS with_delivery_pc
                  FROM grantconnect_awards ga
                  JOIN gs_entities e ON e.id = ga.gs_entity_id
                 WHERE e.postcode = '${postcode}'`,
      }),
      db.rpc('exec_sql', {
        query: `SELECT ga.agency, ga.grant_program AS program, count(*) AS awards, coalesce(sum(ga.value_aud),0) AS value
                  FROM grantconnect_awards ga
                  JOIN gs_entities e ON e.id = ga.gs_entity_id
                 WHERE e.postcode = '${postcode}' AND ga.grant_program IS NOT NULL
                 GROUP BY 1,2 ORDER BY value DESC LIMIT 8`,
      }),
      db.rpc('exec_sql', {
        query: `SELECT ga.recipient_name AS recipient, ga.agency, ga.grant_program AS program,
                       coalesce(ga.value_aud,0) AS value, ga.end_date::text AS end_date
                  FROM grantconnect_awards ga
                  JOIN gs_entities e ON e.id = ga.gs_entity_id
                 WHERE e.postcode = '${postcode}'
                   AND ga.end_date >= current_date
                   AND ga.end_date < current_date + interval '24 months'
                 ORDER BY ga.value_aud DESC NULLS LAST LIMIT 10`,
      }),
    ]);

    const row = Array.isArray(totals.data) ? totals.data[0] as Record<string, unknown> : null;
    if (!row || num(row.awards as number | string | null) === 0) return null;

    return {
      postcode,
      awards: num(row.awards as number | string | null),
      recipients: num(row.recipients as number | string | null),
      lifetimeValue: num(row.lifetime_value as number | string | null),
      activeAwards: num(row.active_awards as number | string | null),
      activeValue: num(row.active_value as number | string | null),
      endingWithin24mValue: num(row.ending_24m_value as number | string | null),
      withDeliveryPostcode: num(row.with_delivery_pc as number | string | null),
      topPrograms: (Array.isArray(programs.data) ? programs.data : []).map(entry => {
        const record = entry as Record<string, unknown>;
        return {
          agency: String(record.agency ?? ''),
          program: String(record.program ?? ''),
          awards: num(record.awards as number | string | null),
          value: num(record.value as number | string | null),
        };
      }),
      endingSoon: (Array.isArray(ending.data) ? ending.data : []).map(entry => {
        const record = entry as Record<string, unknown>;
        return {
          recipient: String(record.recipient ?? ''),
          agency: String(record.agency ?? ''),
          program: String(record.program ?? ''),
          value: num(record.value as number | string | null),
          endDate: String(record.end_date ?? ''),
        };
      }),
    };
  },
);
