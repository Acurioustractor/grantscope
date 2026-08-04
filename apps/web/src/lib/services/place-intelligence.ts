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

const AREA_ORDER = [
  'alice-springs',
  'barkly',
  'macdonnell',
  'central-desert',
  // Last, because it is the residue rather than a place: organisations whose
  // council we still cannot record.
  'remote-unplaced',
];

function num(value: number | string | null): number {
  if (value === null) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const getCentralAustraliaIntelligence = cache(
  async function getCentralAustraliaIntelligence(): Promise<PlaceIntelligence> {
    const db = getServiceSupabase();

    const [snapshotResult, orgsResult, gapResult, deregisteredResult] = await Promise.all([
      // v_lga_place_profile, not place_funding_snapshot. The snapshot was built
      // before councils were reattributed to the shires they serve, so it still
      // credited Alice Springs with $749.4M rather than $688.4M, and its grants
      // figure predates GrantConnect entirely — showing $44.1M where delivered
      // grants are $202.8M.
      db.from('v_lga_place_profile')
        .select('lga_name, state, remoteness, avg_irsd_decile, org_count, community_controlled, without_abn, caring_for_country, employers, contract_count, contract_value_lifetime, contract_value_24m, grants_delivered, grants_delivered_value, local_retention_pct, philanthropic_funders, philanthropic_grants')
        .in('lga_name', ['Alice Springs', 'Barkly', 'MacDonnell', 'Central Desert', 'Anangu Pitjantjatjara Yankunytjatjara'])
        .in('state', ['NT', 'SA']),
      // The homelands organisations, named. They have no council area, so the
      // only honest way to show them is by name — and all of them, not a
      // slice. An alphabetical cap truncates mid-list and quietly drops the
      // Utopia and Urapuntja organisations at the end of the alphabet, which
      // is the same erasure the geocoding bug caused.
      // Deregistered ORIC corporations are excluded. Listing a defunct
      // corporation as a current community organisation misrepresents the
      // community it belonged to, and the first version of this page did
      // exactly that for 57 of them.
      db.from('gs_entities')
        .select('canonical_name, entity_type, is_community_controlled')
        .eq('state', 'NT')
        .eq('postcode', '0872')
        .or('is_community_controlled.eq.true,entity_type.eq.indigenous_corp')
        .or('oric_status.is.null,oric_status.neq.Deregistered')
        .order('canonical_name')
        .limit(300),
      db.from('geo_resolution_gaps')
        .select('postcode, required_source, affected_entities, affected_community_controlled')
        .eq('postcode', '0872')
        .maybeSingle(),
      db.from('gs_entities')
        .select('id', { count: 'exact', head: true })
        .eq('state', 'NT')
        .eq('postcode', '0872')
        .or('is_community_controlled.eq.true,entity_type.eq.indigenous_corp')
        .eq('oric_status', 'Deregistered'),
    ]);

    if (snapshotResult.error) {
      throw new Error(`Place snapshot unavailable: ${snapshotResult.error.message}`);
    }

    const LABELS: Record<string, { label: string; note: string | null }> = {
      'Alice Springs': { label: 'Mparntwe (Alice Springs)', note: null },
      Barkly: { label: 'Barkly, including Tennant Creek', note: 'Includes Tennant Creek, Ali Curung and Ampilatwatja in the Utopia homelands.' },
      MacDonnell: { label: 'MacDonnell', note: 'Includes Papunya, Hermannsburg and Areyonga.' },
      'Central Desert': { label: 'Central Desert', note: 'Includes Yuendumu and Atitjere.' },
      'Anangu Pitjantjatjara Yankunytjatjara': { label: 'APY Lands (South Australia)', note: 'Iwantja, Mimili, Kaltjiti and Pukatja. Their grants are delivered into postcode 0872, which spans seven councils, so most cannot be placed here.' },
    };

    const areas = ((snapshotResult.data || []) as RawProfile[])
      .map(row => ({
        areaKey: row.lga_name,
        areaLabel: LABELS[row.lga_name]?.label ?? row.lga_name,
        areaNote: LABELS[row.lga_name]?.note ?? null,
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
    };
  },
);
