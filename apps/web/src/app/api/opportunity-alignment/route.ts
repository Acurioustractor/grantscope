import { NextRequest, NextResponse } from 'next/server';
import {
  ACT_DEEP_REVIEW_FINDINGS,
  ACT_KNOWLEDGE_LOOP,
  ACT_OPERATING_LAYERS,
  ACT_POSITION,
  ACT_PROJECT_STATES,
  ACT_ROLE_PATTERNS,
  BFGN_PARTNER_ORGANISATIONS,
  BFGN_MAY_2026_PEOPLE,
  BFGN_MAY_2026_SIGNALS,
  ECOSYSTEM_QUERY_PACKS,
  filterEcosystemOpportunities,
  rankedEcosystemActions,
} from '@/lib/opportunity-alignment';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q') || '';
  const opportunities = filterEcosystemOpportunities(query);

  return NextResponse.json({
    query,
    generated_at: new Date().toISOString(),
    act_position: ACT_POSITION,
    act_operating_layers: ACT_OPERATING_LAYERS,
    act_project_states: ACT_PROJECT_STATES,
    act_role_patterns: ACT_ROLE_PATTERNS,
    act_knowledge_loop: ACT_KNOWLEDGE_LOOP,
    act_deep_review_findings: ACT_DEEP_REVIEW_FINDINGS,
    opportunities,
    partner_organisations: BFGN_PARTNER_ORGANISATIONS,
    next_actions: rankedEcosystemActions(),
    query_packs: ECOSYSTEM_QUERY_PACKS,
    people: BFGN_MAY_2026_PEOPLE,
    ecosystem_signals: BFGN_MAY_2026_SIGNALS,
    query_model: {
      purpose:
        'Turn a pasted opportunity list into an ACT-wide alignment brief that checks project state, governance readiness, live evidence, partners, and next actions.',
      recommended_live_joins: [
        'grant_opportunities by name/provider/topic',
        'org_profiles for ACT portfolio readiness',
        'gs_entities for ABN, LGA, sector, and partner discovery',
        'austender_contracts for delivery/procurement history',
        'foundations and foundation_programs for funder context',
        'mv_gs_entity_stats and materialized place views for evidence packs',
        'Tractorpedia project codes and source pages for canonical project state',
        'Empathy Ledger story/media keys for consent-aware proof',
      ],
    },
  });
}
