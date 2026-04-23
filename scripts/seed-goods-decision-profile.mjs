#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const GOODS_DECISION_PATCH = {
  operating_thesis:
    'Goods is not just selling products. It is building durable-goods infrastructure for remote communities, proving containerised On-Country manufacturing, and creating a path for community ownership over time. The operating wedge is practical household goods; the deeper play is manufacturing, procurement, and ownership transfer.',
  capital_thesis:
    'The near-term capital job is a blended stack, not a single grant. Goods needs match-ready grant capital, catalytic/recoverable capital, and debt that can bridge production and institutional demand. Snow and QBE are the anchor philanthropic signals, while Minderoo, PFI, SEFA, and IBA sit around the broader stack.',
  procurement_thesis:
    'The procurement play is to use Goods as both a product supplier and a procurement infrastructure layer. That means closing institutional buyers for beds and household goods now, while also building the platform, verification, and compliance routes that let government and corporate buyers shift more spend through Indigenous and social enterprise supply chains.',
  vehicle_strategy:
    'Goods currently trades inside A Curious Tractor Pty Ltd. Philanthropic and match-grant capital can route through the foundation layer where needed, while trading, procurement, and product revenue logic sit in the operating company until a tighter spinout or sub-entity decision is warranted.',
  ownership_pathway:
    'The long-term model is not permanent central control. Goods should keep moving toward community-held manufacturing and ownership, with PICC and other community-controlled partners acting as the legitimacy and transition anchors rather than treating ownership transfer as an afterthought.',
  current_priorities: [
    'Convert the current Snow + QBE momentum into a coherent blended-capital sequence rather than treating each funder separately.',
    'Secure named institutional buyer pathways for beds, health, schools, and remote housing so the capital case is anchored in demand, not only story.',
    'Treat Goods as procurement infrastructure as well as a product business, especially where compliance, reporting, and social procurement verification create leverage.',
    'Keep the ownership-transfer logic visible: production should move toward community-held manufacturing, not permanent centralised control.',
  ],
  proof_points: [
    'QBE and Snow already give Goods a live philanthropic signal, so the capital story is not cold-starting from zero.',
    'Centrecorp and other community-controlled demand pathways show that Goods is anchored in real buyer need, not only speculative future procurement.',
    'Homeland Schools Company provides a named institutional bed pathway that can be used as a concrete procurement proof point.',
    'Oonchiumpa is already framed in the Goods working context as a real Central Australian manufacturing partner, which makes the On-Country production thesis more than a concept.',
    'Goods already operates with live systems across CRM, procurement, grant/workflow tracking, asset operations, and impact infrastructure rather than just a pitch deck stack.',
    'The community-ownership logic is already embedded in the model through PICC and related partner pathways, which strengthens the long-term legitimacy of the enterprise thesis.',
  ],
  readiness_gaps: [
    'Integrated 3-statement financial model to investor standard is still a live gap.',
    'Formal investment memo and tranche-ready data room need to be finished, not implied.',
    'Independent directors and board-strengthening remain important before closing larger catalytic or debt capital.',
    'Community-ownership transition economics are mapped conceptually but not yet modelled tightly enough.',
    'Procurement and buyer pipeline discipline still needs to be more systematic than the current mixed tooling state.',
  ],
  capital_stack: [
    { layer: 'Match grant', source: 'QBE Foundation', amount: 'Up to $200K', status: 'conditional' },
    { layer: 'Grant pipeline', source: 'Snow Foundation R4', amount: '$200K', status: 'pipeline' },
    { layer: 'Catalytic capital', source: 'Minderoo recoverable', amount: '$200K', status: 'warm' },
    { layer: 'Repayable grant', source: 'PFI', amount: '$640K', status: 'submitted' },
    { layer: 'Sub debt', source: 'SEFA working capital', amount: '$300K+', status: 'opening' },
    { layer: 'Senior debt', source: 'IBA business loan', amount: 'Up to $5M', status: 'eligible' },
  ],
  operating_systems: [
    {
      name: 'Goods v2',
      role: 'Weekly cockpit for QBE program, actions, and operating control',
      kind: 'weekly_cockpit',
      status: 'live',
      href: 'https://www.goodsoncountry.com/admin/qbe-program',
      cta_label: 'Open QBE Program',
      external: true,
    },
    {
      name: 'GHL',
      role: 'Relationship ledger for buyers, funders, and partner outreach',
      kind: 'relationship_system',
      status: 'live',
    },
    {
      name: 'CivicGraph / GrantScope',
      role: 'Discovery and ranking layer for funders, buyers, grants, and procurement routes',
      kind: 'discovery_workspace',
      status: 'live',
      href: '/goods-workspace',
      cta_label: 'Open Goods Workspace',
      external: false,
    },
    {
      name: 'Goods Wiki',
      role: 'Source context for strategy, capital reasoning, legal structure, and partner logic',
      kind: 'source_context',
      status: 'live',
    },
    {
      name: 'Empathy Ledger',
      role: 'Proof and impact infrastructure for story-backed evidence and accountability',
      kind: 'proof_system',
      status: 'live',
      href: '/org/act/empathy-ledger',
      cta_label: 'Open Empathy Ledger',
      external: false,
    },
  ],
  procurement_routes: [
    {
      name: 'Remote housing procurement anchor',
      counterpart: 'NT Housing and remote housing providers',
      route_type: 'Government buyer',
      stage: 'priority',
      why_it_matters:
        'Remote housing is the most obvious institutional demand anchor for Goods because the product solves durability and total-cost-of-ownership problems that disposable furniture does not.',
      next_move:
        'Turn the remote housing case into a named procurement path with one or two concrete buyers, not just a sector thesis.',
      evidence:
        'Goods wiki business model notes NT Housing as a qualifying institutional anchor and frames durable furniture as a total-cost-of-ownership solution.',
    },
    {
      name: 'Homeland Schools bed pathway',
      counterpart: 'Homeland Schools Company',
      route_type: 'Education buyer',
      stage: 'warm',
      why_it_matters:
        'Schools are a clean institutional buyer category because the bed need is legible, repeatable, and easier to convert into a direct purchasing story than some broader systems pathways.',
      next_move:
        'Use the schools pathway as a concrete procurement proof point in both buyer and capital conversations.',
      evidence:
        'Goods wiki business model lists Homeland Schools Company with a named 65-bed pathway.',
    },
    {
      name: 'Community-controlled demand anchor',
      counterpart: 'Centrecorp / community-controlled organisations',
      route_type: 'Community buyer',
      stage: 'live',
      why_it_matters:
        'Community-controlled demand proves Goods is not only pitching to abstract institutional buyers. It shows the work already has grounded local demand and a route toward community-held enterprise.',
      next_move:
        'Translate approved or standing-interest demand into a stronger procurement and revenue case for the raise.',
      evidence:
        'Goods wiki business model notes Centrecorp 107 beds approved and strong community-controlled partner demand.',
    },
    {
      name: 'Health and environmental health route',
      counterpart: 'ACCHOs and healthy homes programs',
      route_type: 'Health buyer',
      stage: 'warm',
      why_it_matters:
        'Health services make Goods legible as preventive infrastructure rather than only furniture, especially where sleeping conditions, overcrowding, and environmental health drive avoidable harm.',
      next_move:
        'Package one clear health-service buyer narrative tied to bed deployments and measurable health-enabling outcomes.',
      evidence:
        'Goods wiki business model names health services and healthy homes programs as core customer segments.',
    },
    {
      name: 'Corporate RAP procurement route',
      counterpart: 'BHP, Rio Tinto, Woolworths and similar RAP buyers',
      route_type: 'Corporate procurement',
      stage: 'build',
      why_it_matters:
        'Corporate RAP procurement creates a higher-scale route for Goods as procurement and verification infrastructure, not just a product seller.',
      next_move:
        'Move from generic corporate social procurement language to one or two named procurement teams and a testable offer.',
      evidence:
        'Goods project pipeline already tracks Corporate RAP Procurement as a Goods route, and the wiki positions Goods as Indigenous-led procurement infrastructure.',
    },
    {
      name: 'Procurement platform and compliance layer',
      counterpart: 'QLD Buy Queensland, Federal IPP, VIC SPF, councils and agencies',
      route_type: 'Government platform route',
      stage: 'build',
      why_it_matters:
        'This is the systems-change procurement route: Goods can become the compliance, verification, and transaction layer that helps buyers shift spend through Indigenous and social enterprise supply chains.',
      next_move:
        'Treat this as a platform-commercialisation pathway with one pilot government buyer or council, rather than only a long-horizon idea.',
      evidence:
        'Goods project pipeline already tracks Buy Queensland, Federal IPP, and procurement-compliance SaaS routes as project-specific opportunities.',
    },
  ],
  decision_source_paths: [
    '/Users/benknight/Code/Goods Asset Register/wiki/articles/enterprise/03-business-model.md',
    '/Users/benknight/Code/Goods Asset Register/wiki/articles/enterprise/06-process-and-technology.md',
    '/Users/benknight/Code/Goods Asset Register/wiki/articles/enterprise/10-investors-capital-raising.md',
    '/Users/benknight/Code/Goods Asset Register/wiki/articles/investors/our-investment-needs.md',
  ],
};

async function main() {
  const { data: org, error: orgError } = await db
    .from('org_profiles')
    .select('id')
    .eq('slug', 'act')
    .single();
  if (orgError) throw orgError;

  const { data: project, error: projectError } = await db
    .from('org_projects')
    .select('id, metadata')
    .eq('org_profile_id', org.id)
    .eq('slug', 'goods')
    .single();
  if (projectError) throw projectError;

  const nextMetadata = {
    ...(project.metadata || {}),
    ...GOODS_DECISION_PATCH,
  };

  const { error: updateError } = await db
    .from('org_projects')
    .update({
      metadata: nextMetadata,
      updated_at: new Date().toISOString(),
    })
    .eq('id', project.id);

  if (updateError) throw updateError;

  console.log(
    JSON.stringify(
      {
        project_id: project.id,
        patched_keys: Object.keys(GOODS_DECISION_PATCH),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
