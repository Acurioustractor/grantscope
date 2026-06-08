// OP6 — the named list of community-controlled orgs operating in the deepest deserts.
// Shared by /reports/funding-deserts (page) and /api/data/funding-deserts (route) so the
// two never drift. Sourced from mv_entity_power_index (the same source mv_funding_deserts
// counts), so this named list reconciles exactly with community_controlled_entities.
// Joined to the 100 worst-desert LGAs by (lga_name, state).

export interface DesertCommunityOrg {
  gs_id: string | null;
  canonical_name: string;
  entity_type: string | null;
  abn: string | null;
  lga_name: string;
  state: string;
  remoteness: string;
  desert_score: number;
  system_count: number;
  total_dollar_flow: number;
  in_procurement: number;
  in_justice_funding: number;
  in_charity_registry: number;
}

export const DESERT_COMMUNITY_ORGS_SQL = `WITH deserts AS (
  SELECT DISTINCT ON (lga_name, state) lga_name, state, remoteness, desert_score
  FROM mv_funding_deserts WHERE desert_score IS NOT NULL
  ORDER BY lga_name, state, desert_score DESC
), worst AS (
  SELECT lga_name, state, remoteness, desert_score
  FROM deserts ORDER BY desert_score DESC LIMIT 100
)
SELECT e.gs_id, e.canonical_name, e.entity_type, e.abn, e.lga_name, e.state,
  w.remoteness, w.desert_score, e.system_count, e.total_dollar_flow,
  e.in_procurement, e.in_justice_funding, e.in_charity_registry
FROM mv_entity_power_index e
JOIN worst w ON e.lga_name = w.lga_name AND e.state = w.state
WHERE e.is_community_controlled
ORDER BY w.desert_score DESC, e.total_dollar_flow DESC, e.canonical_name`;

export function mapDesertCommunityOrgs(rows: unknown): DesertCommunityOrg[] {
  return ((rows || []) as Record<string, unknown>[]).map((o) => ({
    gs_id: (o.gs_id as string) ?? null,
    canonical_name: String(o.canonical_name ?? ''),
    entity_type: (o.entity_type as string) ?? null,
    abn: (o.abn as string) ?? null,
    lga_name: String(o.lga_name ?? ''),
    state: String(o.state ?? ''),
    remoteness: String(o.remoteness ?? ''),
    desert_score: Number(o.desert_score) || 0,
    system_count: Number(o.system_count) || 0,
    total_dollar_flow: Number(o.total_dollar_flow) || 0,
    in_procurement: Number(o.in_procurement) || 0,
    in_justice_funding: Number(o.in_justice_funding) || 0,
    in_charity_registry: Number(o.in_charity_registry) || 0,
  }));
}
