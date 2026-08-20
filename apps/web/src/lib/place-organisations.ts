import { getDirectServiceSupabase } from '@/lib/supabase';

/**
 * The organisations a council actually holds, by name.
 *
 * WHY THIS EXISTS. The council page counted them and never named them. Hope Vale rendered
 * "Placed here: 15 organisations" and then listed 127 organisations it could NOT place, each with
 * a name, a postcode and a correction control. The uncertainty was fully itemised and the
 * certainty was a number. A community reading its own page could not see itself on it.
 *
 * WHAT IT SHOWS PER ORGANISATION. What the register holds and nothing more: the name, what kind of
 * body it is, whether it is community-controlled, whether it is on the ACNC register, and the
 * federal grants and contracts we can tie to it. Every row links to its entity page so the claim
 * is inspectable rather than asserted.
 *
 * ZERO IS NOT "UNFUNDED". Of Hope Vale's 15, four hold recorded federal money and eleven hold none.
 * That eleven is a fact about what a federal register can see — state programs, ILSC and NIAA
 * funding, land-council intermediation and everything delivered through another organisation are
 * all invisible here. The surface must say so beside the zero, or it publishes "unfunded" about
 * organisations that are not.
 *
 * Contracts are matched on ABN, so an organisation with no ABN (ORIC-registered only — 5 of Hope
 * Vale's 15 carry an `AU-ORIC-*` id and no ABN) can never show a contract. That is a limit of the
 * join, not a fact about the organisation, and it is stated rather than left to look like zero.
 */

export interface PlaceOrganisation {
  gsId: string;
  name: string;
  entityType: string | null;
  communityControlled: boolean;
  /** False for ORIC-only registrations, which makes the contract count unmeasurable, not zero. */
  hasAbn: boolean;
  onAcncRegister: boolean;
  grants: number;
  grantDollars: number;
  contracts: number;
}

export interface PlaceOrganisations {
  organisations: PlaceOrganisation[];
  /** EVERY organisation placed here, not just the ones returned. Ashburton holds 151 and the list
   * shows 60; a surface that counted the array would publish "the 60 organisations placed in
   * Ashburton", which is false. The total and the shown count are separate on purpose. */
  total: number;
}

export async function organisationsInPlace(
  lgaName: string,
  limit = 60,
): Promise<PlaceOrganisations> {
  const safe = lgaName.replace(/'/g, "''");
  const cap = Math.max(1, Math.min(300, Math.floor(limit)));
  const db = getDirectServiceSupabase();
  const { data, error } = await db.rpc('exec_sql', {
    query: `
      WITH e AS (
        SELECT id, gs_id, canonical_name, abn, entity_type, is_community_controlled
          FROM gs_entities WHERE lga_name = '${safe}'
      )
      SELECT e.gs_id, e.canonical_name, e.entity_type,
             e.is_community_controlled AS cc,
             (e.abn IS NOT NULL) AS has_abn,
             EXISTS (SELECT 1 FROM acnc_charities a WHERE a.abn = e.abn) AS on_acnc,
             (SELECT count(*) FROM grantconnect_awards g WHERE g.gs_entity_id = e.id)::bigint AS grants,
             (SELECT COALESCE(sum(g.value_aud), 0) FROM grantconnect_awards g WHERE g.gs_entity_id = e.id)::numeric AS grant_dollars,
             (SELECT count(*) FROM austender_contracts c WHERE e.abn IS NOT NULL AND c.supplier_abn = e.abn)::bigint AS contracts
        FROM e
       ORDER BY (SELECT COALESCE(sum(g.value_aud), 0) FROM grantconnect_awards g WHERE g.gs_entity_id = e.id) DESC,
                e.canonical_name
       LIMIT ${cap}`,
  });
  if (error) throw new Error(`place organisations query failed: ${error.message}`);
  const totalResult = await db.rpc('exec_sql', {
    query: `SELECT count(*)::bigint AS total FROM gs_entities WHERE lga_name = '${safe}'`,
  });
  const n = (v: unknown) => Number(v ?? 0) || 0;
  const total = n((totalResult.data as Array<Record<string, unknown>> | null)?.[0]?.total);
  const organisations = ((data ?? []) as Array<Record<string, unknown>>).map(r => ({
    gsId: String(r.gs_id ?? ''),
    name: String(r.canonical_name ?? ''),
    entityType: (r.entity_type as string | null) || null,
    communityControlled: r.cc === true,
    hasAbn: r.has_abn === true,
    onAcncRegister: r.on_acnc === true,
    grants: n(r.grants),
    grantDollars: n(r.grant_dollars),
    contracts: n(r.contracts),
  }));
  return { organisations, total: total || organisations.length };
}

/** Plain words for an `entity_type`, which is a machine value and reads like one. */
export function entityTypeLabel(entityType: string | null): string {
  switch (entityType) {
    case 'indigenous_corp':
      return 'Indigenous corporation';
    case 'charity':
      return 'Charity';
    case 'government_body':
      return 'Government';
    case 'company':
      return 'Company';
    case 'foundation':
      return 'Foundation';
    case 'social_enterprise':
      return 'Social enterprise';
    case null:
      return 'Kind not recorded';
    default:
      // Never invent a label for a value we have not seen: show it, tidied.
      return entityType.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
  }
}
