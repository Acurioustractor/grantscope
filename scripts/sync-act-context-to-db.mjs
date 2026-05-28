#!/usr/bin/env node
/**
 * Sync ACT project context from apps/web/src/lib/opportunity-alignment.ts
 * into the act_grant_recommendation_projects table.
 *
 * This is the migration step that moves ACT context out of TypeScript constants
 * and into the database so the Grant Scout can read it.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-act-context-to-db.mjs --dry-run
 *   node --env-file=.env scripts/sync-act-context-to-db.mjs --apply
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--apply');
const AGENT_ID = 'sync-act-context-to-db';
const AGENT_NAME = 'Sync ACT context to DB';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mirror of ACT_PROJECT_STATES from opportunity-alignment.ts
// Source of truth — if the TS file changes, regenerate this from there.
// 12 canonical ACT projects, 2026-05-22.
const PROJECTS = [
  {
    project_code: 'ACT-IN',
    project_label: 'Infrastructure / ALMA / Wiki / AI systems',
    layer: 'memory',
    readiness: 'active',
    current_state: '$194K and 992 transactions in the operational thesis; core R&D bucket and shared intelligence substrate.',
    intelligence_role: 'Keeps the centre coherent: project codes, wiki, agent workflows, AI context, and system memory.',
    opportunity_alignment: 'Best framed as platform R&D, knowledge infrastructure, governance, and evidence automation.',
    next_question: 'Which opportunity surfaces can pay for the substrate without making it look like generic SaaS?',
    source_doc: 'act-global-infrastructure/wiki/operations/act-operational-thesis.md',
    theme_keywords: ['platform','infrastructure','r&d','knowledge','governance','ai','automation','wiki','data'],
    home_states: ['QLD','NSW'],
    secondary_states: ['VIC','National'],
    dgr_required: false,
    entity_preference: 'sole_trader_then_pty',
    qbe_ready: true,
    in_scope: true,
  },
  {
    project_code: 'ACT-CS',
    project_label: 'CivicGraph / GrantScope',
    layer: 'ledger',
    readiness: 'pitch-ready',
    current_state: 'Recognised in the project truth state as active/pitchable but needing tighter code and public-surface alignment.',
    intelligence_role: 'The civic world model: entity, funding, place, procurement, and opportunity routing.',
    opportunity_alignment: 'The primary wedge for funder evidence, SEQ partner discovery, social procurement, and opportunity matching.',
    next_question: 'Which query mode becomes the first repeatable paid product: opportunity fit, partner map, place evidence, or acquittal proof?',
    source_doc: 'act-global-infrastructure/wiki/concepts/civic-world-model.md',
    theme_keywords: ['civic','data','procurement','transparency','accountability','intelligence','open data'],
    home_states: ['QLD','NSW','VIC'],
    secondary_states: ['National','ACT','WA','SA'],
    dgr_required: false,
    entity_preference: 'sole_trader_then_pty',
    qbe_ready: true,
    in_scope: true,
  },
  {
    project_code: 'ACT-EL',
    project_label: 'Empathy Ledger',
    layer: 'signal',
    readiness: 'live-proof',
    current_state: 'v2 storyteller portal live, verbal consent active, OCAP governance in play, and cross-org photo manager shipped.',
    intelligence_role: 'Turns sovereign human narrative into governed signal rather than extractive story capture.',
    opportunity_alignment: 'Makes applications credible where lived experience, storytelling, consent, and cultural protocol matter.',
    next_question: 'Which funders need Third Reality proof instead of conventional impact reporting?',
    source_doc: 'act-global-infrastructure/wiki/decisions/act-core-facts.md',
    theme_keywords: ['storytelling','lived experience','consent','narrative','cultural','community','voice','indigenous'],
    home_states: ['QLD','NSW'],
    secondary_states: ['VIC','National','NT'],
    dgr_required: false,
    entity_preference: 'sole_trader_then_pty',
    qbe_ready: true,
    in_scope: true,
  },
  {
    project_code: 'ACT-JH',
    project_label: 'JusticeHub',
    layer: 'ledger',
    readiness: 'live-proof',
    current_state: 'Ecosystem-tier project with judges-on-country commitment and most development time historically flowing through ACT-IN.',
    intelligence_role: 'Evidence layer for youth justice alternatives, programs, legal context, and community-led solutions.',
    opportunity_alignment: 'Strong fit for justice, accountability, policy, and community diversion opportunities.',
    next_question: 'Which JusticeHub proof lines can be reused in grant scans without overclaiming or flattening community authority?',
    source_doc: 'act-global-infrastructure/wiki/decisions/act-core-facts.md',
    theme_keywords: ['justice','youth','diversion','community-led','policy','legal','rights','accountability','reinvestment'],
    home_states: ['QLD','NT'],
    secondary_states: ['NSW','VIC','WA','National'],
    dgr_required: false,
    entity_preference: 'sole_trader_then_pty',
    qbe_ready: true,
    in_scope: true,
  },
  {
    project_code: 'ACT-GD',
    project_label: 'Goods on Country',
    layer: 'edge',
    readiness: 'active',
    current_state: '$55K and 197 transactions; Minderoo $900K pitch mid-May, Centrecorp tranche pending, Snow tranche outstanding.',
    intelligence_role: 'Physical proof that community narrative, procurement, design, and delivery data can converge.',
    opportunity_alignment: 'High fit for rural assets, social procurement, Indigenous enterprise, manufacturing, and place-based resilience.',
    next_question: 'Which partner leads can carry capital or infrastructure eligibility while ACT provides design and evidence intelligence?',
    source_doc: 'act-global-infrastructure/wiki/operations/act-operational-thesis.md',
    theme_keywords: ['social procurement','indigenous enterprise','place-based','rural','manufacturing','goods','supply chain','community'],
    home_states: ['QLD','NT'],
    secondary_states: ['NSW','WA','SA','VIC'],
    dgr_required: false,
    entity_preference: 'sole_trader_then_pty',
    qbe_ready: true,
    in_scope: true,
  },
  {
    project_code: 'ACT-HV',
    project_label: 'Harvest',
    layer: 'enterprise',
    readiness: 'decision-needed',
    current_state: '$97K and 119 transactions; lease signing pending and capital improvement fund at $250K.',
    intelligence_role: 'Grounded enterprise pathway and practical revenue loop for the broader ecosystem.',
    opportunity_alignment: 'Relevant for regional enterprise, food systems, place activation, and practical community infrastructure.',
    next_question: 'Which opportunities need the lease/entity decision resolved before ACT can credibly apply?',
    source_doc: 'act-global-infrastructure/wiki/decisions/act-core-facts.md',
    theme_keywords: ['food systems','regional','enterprise','place','agriculture','infrastructure','community'],
    home_states: ['QLD'],
    secondary_states: ['NSW','National'],
    dgr_required: false,
    entity_preference: 'pty_ltd',
    qbe_ready: false,
    in_scope: true,
  },
  {
    project_code: 'ACT-FM',
    project_label: 'Farm / BCV',
    layer: 'enterprise',
    readiness: 'decision-needed',
    current_state: '$55K and 163 transactions; new lease to Pty and farm entity still to be decided.',
    intelligence_role: 'Land, stewardship, enterprise, and grounded experimentation site.',
    opportunity_alignment: 'Fit for land stewardship, regenerative practice, and capital works only after entity/risk structure is clear.',
    next_question: 'What is the right legal and operational wrapper before grants or capital improvements attach?',
    source_doc: 'act-global-infrastructure/wiki/decisions/roadmap-2026.md',
    theme_keywords: ['land','regenerative','stewardship','agriculture','rural','capital works'],
    home_states: ['QLD'],
    secondary_states: ['NSW'],
    dgr_required: false,
    entity_preference: 'pty_ltd',
    qbe_ready: false,
    in_scope: true,
  },
  {
    project_code: 'ACT-PI',
    project_label: 'PICC / Palm Island Community Company work',
    layer: 'edge',
    readiness: 'active',
    current_state: '$66K and 8 transactions; ecosystem-tier project tied to Indigenous partners and place-based delivery.',
    intelligence_role: 'Community authority and place-based proof line for work that must stay consent- and protocol-led.',
    opportunity_alignment: 'Relevant where Palm Island, cultural authority, youth, community infrastructure, or partner-led delivery is central.',
    next_question: 'Which opportunities should be partner-led by community organisations rather than ACT-led?',
    source_doc: 'act-global-infrastructure/wiki/decisions/act-core-facts.md',
    theme_keywords: ['palm island','indigenous','community-led','cultural authority','youth','place-based','partner-led'],
    home_states: ['QLD'],
    secondary_states: ['NT','National'],
    dgr_required: false,
    entity_preference: 'sole_trader_then_pty',
    qbe_ready: false,
    in_scope: true,
  },
  {
    project_code: 'ACT-MY',
    project_label: 'Mounty Yarns',
    layer: 'edge',
    readiness: 'active',
    current_state: '$26K and 42 transactions; active place and partner line in the operational thesis.',
    intelligence_role: 'Regional storytelling and relationship proof, especially around Mount Isa and connected youth/community work.',
    opportunity_alignment: 'Useful for rural, regional, youth, arts, and place-based grant narratives.',
    next_question: 'What reusable evidence pack should GrantScope generate for Mount Isa and related partners?',
    source_doc: 'act-global-infrastructure/wiki/operations/act-operational-thesis.md',
    theme_keywords: ['mount isa','regional','youth','arts','storytelling','place-based','community'],
    home_states: ['QLD'],
    secondary_states: ['NT'],
    dgr_required: false,
    entity_preference: 'sole_trader_then_pty',
    qbe_ready: false,
    in_scope: true,
  },
  {
    project_code: 'ACT-GP',
    project_label: 'Gold.Phone',
    layer: 'signal',
    readiness: 'live-proof',
    current_state: 'Load-bearing work in the project truth state and Third Reality stack.',
    intelligence_role: 'Captures emotional truth and routes it into governed synthesis without turning voice into extractive data.',
    opportunity_alignment: 'Strong for arts, storytelling infrastructure, civic listening, public engagement, and research partnerships.',
    next_question: 'Which opportunities value civic listening as infrastructure rather than as an engagement activity?',
    source_doc: 'act-global-infrastructure/wiki/concepts/third-reality.md',
    theme_keywords: ['arts','storytelling','civic listening','engagement','research','voice','public'],
    home_states: ['QLD','NSW'],
    secondary_states: ['VIC','National'],
    dgr_required: false,
    entity_preference: 'sole_trader_then_pty',
    qbe_ready: true,
    in_scope: true,
  },
  {
    project_code: 'ACT-CN',
    project_label: 'Contained',
    layer: 'surface',
    readiness: 'pitch-ready',
    current_state: 'Public tour/readiness thread in the broader ACT project universe.',
    intelligence_role: 'Immersive public surface where story, evidence, and invitation can travel to partners and communities.',
    opportunity_alignment: 'Relevant to touring, public art, youth justice storytelling, events, and partner activation.',
    next_question: 'Which funder brief needs Contained as the experience layer and CivicGraph as the evidence layer?',
    source_doc: 'act-global-infrastructure/wiki/decisions/roadmap-2026.md',
    theme_keywords: ['touring','public art','youth justice','storytelling','events','immersive','partner activation'],
    home_states: ['QLD','NSW','VIC'],
    secondary_states: ['National'],
    dgr_required: false,
    entity_preference: 'sole_trader_then_pty',
    qbe_ready: false,
    in_scope: true,
  },
  {
    project_code: 'ACT-CORE',
    project_label: 'ACT Core / studio operating model',
    layer: 'memory',
    readiness: 'needs-cleanup',
    current_state: 'Core facts note a 30 June 2026 cutover, new Pty from 1 July, and roughly $507K outstanding receivables.',
    intelligence_role: 'Governance, operating rhythm, player-coach pattern, project code discipline, and founder context transfer.',
    opportunity_alignment: 'Every opportunity needs entity, bank, insurance, IP, and co-contribution readiness checked against this layer.',
    next_question: 'Which blockers must be resolved before large funds such as SEQ IEF or CRC-P are pursued?',
    source_doc: 'act-global-infrastructure/wiki/decisions/act-core-facts.md',
    theme_keywords: ['operating model','governance','studio','foundation','operations','strategy','sustainability'],
    home_states: ['QLD','NSW'],
    secondary_states: ['National'],
    dgr_required: false,
    entity_preference: 'sole_trader_then_pty',
    qbe_ready: true,
    in_scope: true,
  },
];

async function main() {
  const runRow = await logStart(supabase, AGENT_ID, AGENT_NAME);
  const runId = runRow?.id ?? null;
  console.log(`[${AGENT_NAME}] dryRun=${DRY_RUN} projects=${PROJECTS.length}`);

  if (DRY_RUN) {
    console.log(`[${AGENT_NAME}] DRY RUN — would upsert:`);
    for (const p of PROJECTS) {
      console.log(`  ${p.project_code} :: ${p.project_label} :: ${p.readiness}`);
    }
    await logComplete(supabase, runId, { items_found: PROJECTS.length, items_updated: 0 });
    return;
  }

  // Verify expanded columns exist before applying
  const { error: probeErr } = await supabase
    .from('act_grant_recommendation_projects')
    .select('project_code, project_label, layer, dgr_required, entity_preference')
    .limit(1);

  if (probeErr) {
    console.error(`[${AGENT_NAME}] cannot read expanded columns — has the migration been applied?`);
    console.error(`  ${probeErr.message}`);
    await logFailed(supabase, runId, 'migration not applied');
    process.exit(1);
  }

  const rows = PROJECTS.map((p) => ({
    project_code: p.project_code,
    project_label: p.project_label,
    layer: p.layer,
    readiness: p.readiness,
    current_state: p.current_state,
    intelligence_role: p.intelligence_role,
    opportunity_alignment: p.opportunity_alignment,
    next_question: p.next_question,
    source_doc: p.source_doc,
    theme_keywords: p.theme_keywords,
    home_states: p.home_states,
    secondary_states: p.secondary_states,
    dgr_required: p.dgr_required,
    entity_preference: p.entity_preference,
    qbe_ready: p.qbe_ready,
    in_scope: p.in_scope,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('act_grant_recommendation_projects')
    .upsert(rows, { onConflict: 'project_code' });

  if (error) {
    console.error(`[${AGENT_NAME}] upsert error:`, error.message);
    await logFailed(supabase, runId, error.message);
    process.exit(1);
  }

  console.log(`[${AGENT_NAME}] upserted ${rows.length} projects`);
  await logComplete(supabase, runId, { items_found: rows.length, items_updated: rows.length });
}

main().catch((err) => {
  console.error(`[${AGENT_NAME}] fatal:`, err);
  process.exit(1);
});
