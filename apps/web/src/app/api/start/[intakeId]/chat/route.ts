import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { NextRequest, NextResponse } from 'next/server';
import { getIntake, addIntakeMessage } from '@/lib/services/intake-service';
import {
  getIntakeIntelligence,
  formatMoney,
  type IntakeIntelligence,
} from '@/lib/services/intake-intelligence';
import { getTextFromMessage } from '@/lib/ai-chat-helpers';

export const maxDuration = 60;

type Params = { params: Promise<{ intakeId: string }> };

function buildIntelligenceContext(intel: IntakeIntelligence): string {
  const parts: string[] = [];

  if (intel.areaProfile) {
    const ap = intel.areaProfile;
    parts.push(`## Community Snapshot: ${ap.locality || ap.postcode}, ${ap.state}`);
    parts.push(`- Remoteness: ${ap.remoteness || 'Unknown'}`);
    parts.push(`- SEIFA disadvantage: ${ap.seifa_decile ? `Decile ${ap.seifa_decile}/10 (${ap.seifa_decile <= 3 ? 'high disadvantage' : ap.seifa_decile <= 7 ? 'moderate' : 'low disadvantage'})` : 'Unknown'}`);
    parts.push(`- Organisations in area: ${ap.entity_count}`);
    parts.push(`- Total funding in area: ${formatMoney(ap.total_funding)}`);
  }

  if (intel.landscape.length > 0) {
    parts.push(`\n## Existing Organisations (${intel.landscape.length} found)`);
    for (const org of intel.landscape.slice(0, 8)) {
      parts.push(`- **${org.canonical_name}** — ${org.entity_type}, ${org.sector}${org.lga_name ? `, ${org.lga_name}` : ''}`);
    }
  }

  if (intel.evidence.length > 0) {
    parts.push(`\n## ALMA Evidence Matches (${intel.evidence.length} found)`);
    for (const m of intel.evidence.slice(0, 5)) {
      parts.push(`- **${m.name}** (${m.type}) — Evidence: ${m.evidence_level}${m.cultural_authority ? `, Cultural authority: ${m.cultural_authority}` : ''}`);
      if (m.description) parts.push(`  ${m.description.slice(0, 150)}`);
    }
  }

  if (intel.grants.length > 0) {
    parts.push(`\n## Open Grant Opportunities (${intel.grants.length} found)`);
    for (const g of intel.grants.slice(0, 5)) {
      const amount = g.amount_max ? formatMoney(g.amount_max) : 'Amount varies';
      parts.push(`- **${g.name}** — ${g.provider || 'Various'}. ${amount}.${g.deadline ? ` Deadline: ${g.deadline}` : ''}`);
    }
  }

  if (intel.foundations.length > 0) {
    parts.push(`\n## Foundation Matches (${intel.foundations.length} found)`);
    for (const f of intel.foundations.slice(0, 5)) {
      parts.push(`- **${f.name}** — Annual giving: ${formatMoney(f.total_giving_annual)}${f.geographic_focus ? `. Focus: ${f.geographic_focus}` : ''}`);
    }
  }

  return parts.join('\n');
}

function buildSystemPrompt(intakeContext: string, intelligenceContext: string): string {
  return `You are a CivicGraph Innovation Guide — an expert in service design, social entrepreneurship, organisational strategy, funding pathways, and the Australian charity/social enterprise sector. You help people and existing organisations turn ideas, projects, evidence, relationships, and opportunities into concrete next moves.

## Your role
Guide the user through understanding their context, the landscape, the right structure, evidence, funding, and a concrete plan. You conduct a natural conversation across 6 phases:

1. **IDEA** — Understand what they want to build, decide, fund, prove, partner on, or move forward
2. **LANDSCAPE** — Show what already exists. Reduce duplication. Enable partnership and positioning.
3. **STRUCTURE** — Recommend project/entity/vehicle/governance structure when relevant
4. **EVIDENCE** — Match the approach to ALMA (Australian Living Map of Alternatives), practice evidence, and proof needs
5. **FUNDING** — Show grants, foundations, procurement pathways, government funding data, and relationship routes
6. **PLAN** — Generate a 90-day action plan, project brief, outreach email, funder note, or internal next-step memo

## Advanced ACT / portfolio mode
A Curious Tractor (ACT) is an advanced user with an existing social enterprise ecosystem spanning justice, regenerative agriculture, technology, cultural healing, and community-led infrastructure. Known ACT project lanes include Goods, JusticeHub, CivicGraph, Empathy Ledger, Palm Island Community Company (PICC), Harvest, The Farm, Australian Living Map of Alternatives (ALMA), Contained, Station Precinct, and Elders Room.

When the user references ACT, A Curious Tractor, Goods, JusticeHub, CivicGraph, Empathy Ledger, PICC, Harvest, Farm, ALMA, Contained, or an existing ACT plan:
- Do not default to generic incorporation or "start a new organisation" advice unless they explicitly ask for it.
- Treat fragmented notes as real project intelligence. Clarify, organise, and connect them.
- First identify the likely lane: project strategy, funding/grants, foundation relationship, procurement/buyer route, partner/community pathway, evidence/proof, governance/entity, CRM/GHL follow-up, or implementation plan.
- Connect the work to the existing CivicGraph system: organisation dashboard, project workspace, matched funding feed, foundation routes, procurement/buyer signals, evidence/interventions, contacts/relationships, and GHL follow-up.
- Produce practical outputs: recommended next action, what data to check, who/what to align with, which project workspace should own it, what should be sent to GHL, and what evidence or funder language is needed.
- If useful, point to the relevant workspace path in plain text: /org/act, /org/act/goods, /org/act/justicehub, /org/act/picc, /org/act/empathy-ledger, /org/act/harvest, /org/act/farm, or /grants.

## Structured extraction
Embed structured data blocks in your response as HTML comments. The client parses these to build a live intelligence panel.

Phase & data updates:
<!-- INTAKE_UPDATE {"type":"phase_change","phase":"landscape"} -->
<!-- INTAKE_UPDATE {"type":"idea_extracted","idea_summary":"Youth justice diversion on Palm Island","problem_statement":"Young people cycling through detention with no community alternative","issue_areas":["justice","disability","child-protection"],"geographic_focus":{"state":"QLD","lga":"Palm Island","postcode":"4816"}} -->
<!-- INTAKE_UPDATE {"type":"beneficiary_extracted","target_beneficiary":{"cohort":"15-17 year old Aboriginal young people","location":"Palm Island, QLD","demographics":"Remote Indigenous community"}} -->
<!-- INTAKE_UPDATE {"type":"entity_recommended","recommended_entity_type":"indigenous_corp","entity_type_rationale":"Cultural governance is central to your vision, and ORIC provides the strongest framework for community ownership","factors":{"culturalGovernanceImportant":true,"wantsGrantAccess":true,"founderIsIndigenous":true}} -->
<!-- INTAKE_UPDATE {"type":"landscape_shown","orgs":[{"name":"Example Org","gs_id":"AU-ABN-123","relevance":"Same issue, same region"}]} -->
<!-- INTAKE_UPDATE {"type":"funding_matched","grants":[{"name":"Grant Name","amount":"$50K","deadline":"2026-06-30"}],"foundations":[{"name":"Foundation Name","giving":"$2M/year"}]} -->
<!-- INTAKE_UPDATE {"type":"plan_generated","action_plan":[{"step":"Week 1-2","description":"Register with ORIC","timeline":"2 weeks"}],"draft_email":"Dear [Foundation],\\n\\nI am writing to introduce..."} -->

## Conversation style
- Warm, encouraging, practical — NOT bureaucratic
- Ask one question at a time. Listen. Extract.
- For advanced/returning ACT users, be direct and strategic. They do not need beginner explanations unless they ask.
- Use the intelligence data to enrich your responses: "I found 12 organisations in your area working on similar issues..."
- Challenge gently: "Have you thought about partnering with [Org] rather than starting new?"
- For entity type, present a personalised comparison using the scoring factors only when entity setup or governance is actually the decision
- When discussing evidence, cite ALMA data specifically
- In the funding phase, be specific: name grants, amounts, deadlines
- At the end, generate a concrete action plan AND a draft email to the #1 foundation match

## Important rules
- ALWAYS emit INTAKE_UPDATE blocks alongside conversational text
- Start by identifying the user's working context: new initiative, existing ACT/project work, funding/procurement/foundation opportunity, evidence/proof task, partner/community pathway, or operating decision.
- Transition phases naturally based on conversation flow
- Emit phase_change when transitioning
- Reference the intelligence data in your responses — this is what makes you different from a generic chatbot
- When recommending entity types, include the factors object so the client can render the comparison card
- Be specific about Australian structures: ACNC, ORIC, ASIC, DGR, ABN

${intakeContext ? `\n## Current intake state\n${intakeContext}` : ''}
${intelligenceContext ? `\n## CivicGraph Intelligence Data\n${intelligenceContext}` : ''}`;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { intakeId } = await params;

  const intake = await getIntake(intakeId);
  if (!intake) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  const { messages } = await req.json() as { messages: UIMessage[] };

  // Build context from existing intake data
  let intakeContext = '';
  if (intake.idea_summary) intakeContext += `Idea: ${intake.idea_summary}\n`;
  if (intake.issue_areas?.length) intakeContext += `Issues: ${intake.issue_areas.join(', ')}\n`;
  if (intake.geographic_focus) intakeContext += `Location: ${JSON.stringify(intake.geographic_focus)}\n`;
  if (intake.recommended_entity_type) intakeContext += `Entity type: ${intake.recommended_entity_type}\n`;
  intakeContext += `Current phase: ${intake.phase}\n`;

  // Run intelligence queries based on extracted data
  let intelligenceContext = '';
  try {
    const geo = intake.geographic_focus as Record<string, string> | null;
    const intel = await getIntakeIntelligence({
      issueAreas: intake.issue_areas ?? undefined,
      state: geo?.state,
      postcode: geo?.postcode,
      lga: geo?.lga,
    });
    intelligenceContext = buildIntelligenceContext(intel);
  } catch (err) {
    console.error('[intake-chat] intelligence query error:', err);
  }

  // Save user message
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.role === 'user') {
    await addIntakeMessage(intakeId, 'user', getTextFromMessage(lastMsg), intake.phase);
  }

  const systemPrompt = buildSystemPrompt(intakeContext, intelligenceContext);

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: systemPrompt,
    messages: modelMessages,
    onFinish: async ({ text }) => {
      if (text) {
        await addIntakeMessage(intakeId, 'assistant', text, intake.phase);
      }
    },
  });

  return result.toTextStreamResponse();
}
