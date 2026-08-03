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
  orgCount: number;
  communityControlledCount: number;
  contractCount: number;
  contractValue: number;
  govtGrantCount: number;
  govtGrantValue: number;
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
}

interface RawSnapshot {
  area_key: string;
  area_label: string;
  area_note: string | null;
  org_count: number;
  community_controlled_count: number;
  contract_count: number;
  contract_value: number | string;
  govt_grant_count: number;
  govt_grant_value: number | string;
  philanthropic_funder_count: number;
  philanthropic_grant_count: number;
  lga_resolved: boolean;
  computed_at: string;
}

const AREA_ORDER = ['alice-springs', 'barkly', 'remote-nt', 'macdonnell'];

function num(value: number | string | null): number {
  if (value === null) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const getCentralAustraliaIntelligence = cache(
  async function getCentralAustraliaIntelligence(): Promise<PlaceIntelligence> {
    const db = getServiceSupabase();

    const [snapshotResult, orgsResult, gapResult] = await Promise.all([
      db.from('place_funding_snapshot')
        .select('area_key, area_label, area_note, org_count, community_controlled_count, contract_count, contract_value, govt_grant_count, govt_grant_value, philanthropic_funder_count, philanthropic_grant_count, lga_resolved, computed_at'),
      // The homelands organisations, named. They have no council area, so the
      // only honest way to show them is by name — and all of them, not a
      // slice. An alphabetical cap truncates mid-list and quietly drops the
      // Utopia and Urapuntja organisations at the end of the alphabet, which
      // is the same erasure the geocoding bug caused.
      db.from('gs_entities')
        .select('canonical_name, entity_type, is_community_controlled')
        .eq('state', 'NT')
        .eq('postcode', '0872')
        .or('is_community_controlled.eq.true,entity_type.eq.indigenous_corp')
        .order('canonical_name')
        .limit(300),
      db.from('geo_resolution_gaps')
        .select('postcode, required_source, affected_entities, affected_community_controlled')
        .eq('postcode', '0872')
        .maybeSingle(),
    ]);

    if (snapshotResult.error) {
      throw new Error(`Place snapshot unavailable: ${snapshotResult.error.message}`);
    }

    const areas = ((snapshotResult.data || []) as RawSnapshot[])
      .map(row => ({
        areaKey: row.area_key,
        areaLabel: row.area_label,
        areaNote: row.area_note,
        orgCount: row.org_count,
        communityControlledCount: row.community_controlled_count,
        contractCount: row.contract_count,
        contractValue: num(row.contract_value),
        govtGrantCount: row.govt_grant_count,
        govtGrantValue: num(row.govt_grant_value),
        philanthropicFunderCount: row.philanthropic_funder_count,
        philanthropicGrantCount: row.philanthropic_grant_count,
        lgaResolved: row.lga_resolved,
        computedAt: row.computed_at,
      }))
      .sort((left, right) => AREA_ORDER.indexOf(left.areaKey) - AREA_ORDER.indexOf(right.areaKey));

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
    };
  },
);
