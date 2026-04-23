import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

const GOODS_FOUNDATIONS = [
  {
    foundationName: 'The Trustee For The Snow Foundation',
    stage: 'in_conversation',
    engagement_status: 'proposal',
    fit_score: 97,
    fit_summary:
      'Anchor Goods funder with existing trust-based relationship, direct remote community proof, and a current Round 4 scale-up pathway.',
    message_alignment:
      'Frame Goods as Snow’s existing community-backed housing, manufacturing, and health-enabling infrastructure partner, then extend into blended grant + guarantee support for scale.',
    next_step:
      'Confirm Snow Round 4 pathway and test the blended-capital framing: grant for production scale-up plus guarantee/support position alongside QBE and SEFA.',
    next_touch_at: '2026-04-29T10:00:00+10:00',
    next_touch_note: 'Snow follow-up on Round 4, blended capital, and guarantee role.',
    last_interaction_at: '2026-04-18T10:00:00+10:00',
    notes:
      'Verified from Goods wiki and compendium: Snow has provided approximately $193,785 to date, with an additional Round 4 proposal in play and an active strategic relationship via Sally Grimsley-Ballard.',
    research: {
      foundation_thesis:
        'Snow Foundation is the clearest Goods philanthropic fit because it already funds the work, understands the remote community problem, and can credibly back the next production and deployment step.',
      evidence_summary:
        'Existing Snow funding, Tennant Creek deployment proof, and Goods production-scale proposal establish strong evidence for continuing partnership.',
      relationship_path:
        'Existing relationship through Sally Grimsley-Ballard and prior Snow-supported Goods work in Tennant Creek.',
      ask_shape:
        'Blend a scale-up grant with explicit support for the broader raise, including guarantee or signalling value alongside QBE and SEFA.',
      fit_status: 'ready',
      proof_status: 'ready',
      applicant_status: 'ready',
      relationship_status: 'ready',
      ask_status: 'ready',
      missing_items: [],
    },
    interaction: {
      interaction_type: 'proposal',
      summary: 'Snow relationship active with scale-up and blended-capital proposal in play.',
      notes: 'Existing major funder; Goods Round 4 and blended capital follow-up remains active.',
      happened_at: '2026-04-18T10:00:00+10:00',
      status_snapshot: 'proposal',
    },
  },
  {
    foundationName: 'QBE Foundation',
    stage: 'in_conversation',
    engagement_status: 'proposal',
    fit_score: 93,
    fit_summary:
      'Catalytic cohort-backed grant partner with explicit climate resilience and inclusion alignment for Goods.',
    message_alignment:
      'Position Goods as climate-resilient, community-led manufacturing and housing infrastructure, with QBE as the catalytic match grant in the blended stack.',
    next_step:
      'Advance the Catalysing Impact workflow and keep the match-ready materials current so the QBE grant can convert as other capital lands.',
    next_touch_at: '2026-04-24T12:00:00+10:00',
    next_touch_note: 'QBE program session and match-funding progression.',
    last_interaction_at: '2026-04-02T10:00:00+10:00',
    notes:
      'Verified from the QBE program materials in the Goods wiki: Goods is in the Catalysing Impact cohort and is working toward unlocking the QBE match grant.',
    research: {
      foundation_thesis:
        'QBE is not a cold philanthropy target; it is an active catalytic partner tied directly to the current Goods blended-finance round.',
      evidence_summary:
        'Program selection, climate resilience fit, and the QBE match structure make this a live philanthropic pathway rather than a speculative prospect.',
      relationship_path:
        'Active program relationship through the QBE Foundation and Social Impact Hub cohort.',
      ask_shape:
        'Convert the contingent QBE grant by demonstrating the matched capital stack and keeping tranche materials current.',
      fit_status: 'ready',
      proof_status: 'ready',
      applicant_status: 'ready',
      relationship_status: 'ready',
      ask_status: 'ready',
      missing_items: [],
    },
    interaction: {
      interaction_type: 'proposal',
      summary: 'QBE Catalysing Impact relationship is active and tied to the current Goods raise.',
      notes: 'Goods is in the cohort and working toward the QBE match milestone.',
      happened_at: '2026-04-02T10:00:00+10:00',
      status_snapshot: 'proposal',
    },
  },
  {
    foundationName: 'Minderoo Foundation Limited as trustee for The Minderoo Foundation Trust',
    stage: 'priority',
    engagement_status: 'approached',
    fit_score: 91,
    fit_summary:
      'High-conviction systems-change and Indigenous-employment fit, with verified Goods-side warm context and a credible catalytic-capital role.',
    message_alignment:
      'Lead with Indigenous partnership, on-Country manufacturing, employment pathways, and the role Goods can play as scale infrastructure rather than a one-off product project.',
    next_step:
      'Package the recoverable-grant / catalytic-capital case and secure the right program lead or blended-capital conversation at Minderoo.',
    next_touch_at: '2026-05-01T10:00:00+10:00',
    next_touch_note: 'Minderoo catalytic capital outreach and recoverable-grant framing.',
    last_interaction_at: '2026-04-15T10:00:00+10:00',
    notes:
      'Verified from Goods compendium and QBE materials: Minderoo is treated as a warm capital target with substantial prior contact context and a recommended pathway.',
    research: {
      foundation_thesis:
        'Minderoo fits Goods as a scale and systems-change funder that can underwrite Indigenous-led manufacturing and employment infrastructure.',
      evidence_summary:
        'Goods already has strong remote community proof, manufacturing logic, and employment framing that align with Minderoo priorities.',
      relationship_path:
        'Warm pathway documented in Goods materials, including prior communication history and recommendation context.',
      ask_shape:
        'Catalytic or recoverable grant to de-risk the manufacturing and deployment scale-up round.',
      fit_status: 'ready',
      proof_status: 'ready',
      applicant_status: 'ready',
      relationship_status: 'partial',
      ask_status: 'ready',
      missing_items: ['Lock the right Minderoo decision-maker and tighten the current intro path.'],
    },
    interaction: {
      interaction_type: 'email',
      summary: 'Minderoo remains a warm capital pathway for the current Goods scale round.',
      notes: 'Warm context exists, but the exact decision-maker and active meeting path still need tightening.',
      happened_at: '2026-04-15T10:00:00+10:00',
      status_snapshot: 'approached',
    },
  },
  {
    foundationName: 'Paul Ramsay Foundation Limited',
    stage: 'approach_now',
    engagement_status: 'ready_to_approach',
    fit_score: 89,
    fit_summary:
      'Strong systems-change fit for Goods as procurement infrastructure, with an existing ACT pipeline prospect already framed specifically for Goods.',
    message_alignment:
      'Position Goods as systems-change procurement infrastructure that shifts where public and corporate purchasing flows, not just a marketplace product.',
    next_step:
      'Turn the existing Goods-specific Paul Ramsay prospect into a named contact pathway and a concise systems-change outreach brief.',
    next_touch_at: '2026-04-30T10:00:00+10:00',
    next_touch_note: 'Prepare Paul Ramsay systems-change outreach brief for Goods.',
    last_interaction_at: null,
    notes:
      'Verified from ACT pipeline and Goods materials: there is already a Paul Ramsay Goods-specific systems-change prospect in pipeline.',
    research: {
      foundation_thesis:
        'Paul Ramsay is a strong fit when Goods is framed as a systems-change lever for Indigenous enterprise access, procurement reform, and employment pathways.',
      evidence_summary:
        'The Goods procurement and platform case is already articulated in ACT pipeline notes and supported by the project’s Indigenous partnership and systems-change framing.',
      relationship_path:
        'No active relationship recorded yet; likely needs a named intro or target program lead.',
      ask_shape:
        'Discovery brief and relationship-led systems-change ask rather than a generic project grant.',
      fit_status: 'ready',
      proof_status: 'ready',
      applicant_status: 'ready',
      relationship_status: 'partial',
      ask_status: 'ready',
      missing_items: ['Secure the intro path or named Paul Ramsay lead.'],
    },
  },
  {
    foundationName: 'Australian Communities Foundation Limited',
    stage: 'approach_now',
    engagement_status: 'ready_to_approach',
    fit_score: 84,
    fit_summary:
      'Community-led and social-enterprise thematic fit with plausible pooled-giving routes for Goods.',
    message_alignment:
      'Frame Goods as a community-led social-enterprise and Indigenous partnership platform with clear remote infrastructure and employment outcomes.',
    next_step:
      'Turn the current ACT-level ACF prospect into a Goods-specific outreach route or donor-collaborative pathway.',
    next_touch_at: '2026-05-06T10:00:00+10:00',
    next_touch_note: 'Check ACF collective-giving and impact-fund route for Goods.',
    last_interaction_at: null,
    notes:
      'Verified from ACT pipeline and Goods notes: Australian Communities Foundation is already treated as a community-led solutions prospect.',
    research: {
      foundation_thesis:
        'ACF can work as a pooled-giving or impact-fund route for Goods because the project sits at the intersection of community-led enterprise, Indigenous partnership, and remote infrastructure.',
      evidence_summary:
        'The Goods case already aligns with community-led and social-enterprise framing, even though the relationship path is less mature than Snow or QBE.',
      relationship_path:
        'Current route is still generic and needs a more specific donor or fund pathway.',
      ask_shape:
        'Goods-specific community-led social-enterprise framing with a clear capital use and deployment pathway.',
      fit_status: 'ready',
      proof_status: 'partial',
      applicant_status: 'ready',
      relationship_status: 'partial',
      ask_status: 'partial',
      missing_items: ['Sharpen proof pack and donor/introduction route.'],
    },
  },
  {
    foundationName: 'NOVA PERIS FOUNDATION LIMITED',
    stage: 'saved',
    engagement_status: 'researching',
    fit_score: 76,
    fit_summary:
      'Relevant Indigenous economic empowerment fit, especially where Goods intersects with PICC enterprise development, but still earlier than the core stack.',
    message_alignment:
      'Position Goods as Indigenous economic development and micro-enterprise infrastructure rather than a generic marketplace concept.',
    next_step:
      'Clarify whether the best route is through Goods directly or through the PICC-linked enterprise pathway using Goods as the platform.',
    next_touch_at: null,
    next_touch_note: null,
    last_interaction_at: null,
    notes:
      'Verified from the Goods-specific pipeline row already attached to the Goods project.',
    research: {
      foundation_thesis:
        'Nova Peris can be a useful adjunct funder where Goods directly supports Indigenous micro-enterprise growth, especially through PICC-linked activity.',
      evidence_summary:
        'There is thematic alignment, but the vehicle and exact ask still need tightening.',
      relationship_path:
        'No clear relationship path recorded yet.',
      ask_shape:
        'Likely enterprise-development support tied to Indigenous micro-enterprise growth through the Goods platform.',
      fit_status: 'partial',
      proof_status: 'partial',
      applicant_status: 'partial',
      relationship_status: 'missing',
      ask_status: 'partial',
      missing_items: ['Need intro path', 'Need clearer applicant vehicle', 'Need tighter ask shape'],
    },
  },
];

function assert(value, message) {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

async function main() {
  const { data: org, error: orgError } = await db
    .from('org_profiles')
    .select('id, name')
    .eq('slug', 'act')
    .single();
  if (orgError) throw orgError;

  const { data: project, error: projectError } = await db
    .from('org_projects')
    .select('id, name')
    .eq('org_profile_id', org.id)
    .eq('slug', 'goods')
    .single();
  if (projectError) throw projectError;

  const { data: applicantEntity, error: applicantError } = await db
    .from('org_applicant_entities')
    .select('id, name')
    .eq('org_profile_id', org.id)
    .eq('is_default', true)
    .single();
  if (applicantError) throw applicantError;

  const foundationNames = GOODS_FOUNDATIONS.map((item) => item.foundationName);
  const { data: foundations, error: foundationsError } = await db
    .from('foundations')
    .select('id, name')
    .in('name', foundationNames);
  if (foundationsError) throw foundationsError;

  const foundationIdByName = new Map((foundations || []).map((row) => [row.name, row.id]));
  for (const name of foundationNames) {
    assert(foundationIdByName.get(name), `Missing foundation row for "${name}"`);
  }

  const results = [];

  for (const item of GOODS_FOUNDATIONS) {
    const foundationId = assert(foundationIdByName.get(item.foundationName), `Missing foundation row for "${item.foundationName}"`);
    const timestamp = new Date().toISOString();

    const { data: foundationRow, error: foundationError } = await db
      .from('org_project_foundations')
      .upsert(
        {
          org_profile_id: org.id,
          org_project_id: project.id,
          foundation_id: foundationId,
          applicant_entity_id: applicantEntity.id,
          stage: item.stage,
          engagement_status: item.engagement_status,
          engagement_updated_at: timestamp,
          fit_score: item.fit_score,
          fit_summary: item.fit_summary,
          message_alignment: item.message_alignment,
          next_step: item.next_step,
          next_touch_at: item.next_touch_at,
          next_touch_note: item.next_touch_note,
          last_interaction_at: item.last_interaction_at,
          notes: item.notes,
          updated_at: timestamp,
        },
        { onConflict: 'org_project_id,foundation_id' },
      )
      .select('id')
      .single();

    if (foundationError) throw foundationError;

    const { error: researchError } = await db
      .from('org_project_foundation_research')
      .upsert(
        {
          org_profile_id: org.id,
          org_project_id: project.id,
          org_project_foundation_id: foundationRow.id,
          foundation_thesis: item.research.foundation_thesis,
          evidence_summary: item.research.evidence_summary,
          relationship_path: item.research.relationship_path,
          ask_shape: item.research.ask_shape,
          fit_status: item.research.fit_status,
          proof_status: item.research.proof_status,
          applicant_status: item.research.applicant_status,
          relationship_status: item.research.relationship_status,
          ask_status: item.research.ask_status,
          missing_items: item.research.missing_items,
          updated_at: timestamp,
        },
        { onConflict: 'org_project_foundation_id' },
      );

    if (researchError) throw researchError;

    if (item.interaction) {
      const { data: existingInteraction, error: existingInteractionError } = await db
        .from('org_project_foundation_interactions')
        .select('id')
        .eq('org_project_foundation_id', foundationRow.id)
        .eq('interaction_type', item.interaction.interaction_type)
        .eq('summary', item.interaction.summary)
        .eq('happened_at', item.interaction.happened_at)
        .maybeSingle();

      if (existingInteractionError) throw existingInteractionError;

      if (!existingInteraction?.id) {
        const { error: interactionError } = await db
          .from('org_project_foundation_interactions')
          .insert({
            org_profile_id: org.id,
            org_project_id: project.id,
            org_project_foundation_id: foundationRow.id,
            interaction_type: item.interaction.interaction_type,
            summary: item.interaction.summary,
            notes: item.interaction.notes,
            happened_at: item.interaction.happened_at,
            status_snapshot: item.interaction.status_snapshot,
          });

        if (interactionError) throw interactionError;
      }
    }

    results.push({
      foundation: item.foundationName,
      stage: item.stage,
      engagement_status: item.engagement_status,
      fit_score: item.fit_score,
    });
  }

  console.log(
    JSON.stringify(
      {
        org: org.name,
        project: project.name,
        applicant_entity: applicantEntity.name,
        seeded: results,
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
