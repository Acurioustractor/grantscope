import { streamText, convertToModelMessages, type UIMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { NextRequest } from 'next/server';
import { requireOrgAccess } from '../../../_lib/auth';
import { NextResponse } from 'next/server';
import {
  getJourney,
  addJourneyMessage,
  matchStepToData,
} from '@/lib/services/journey-service';

export const maxDuration = 60;

type Params = { params: Promise<{ orgProfileId: string }> };

function getTextFromMessage(msg: UIMessage): string {
  if (!msg.parts) return '';
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('');
}

function buildSystemPrompt(journeyContext: string, almaContext: string): string {
  return `You are a Journey Mapping Guide — an expert in service design, human-centred design, and the Australian social sector. You help organisations map the real journeys of the people they serve.

## Your role
- Guide the user through creating persona journey maps: who the person is, what happens to them now (current path), and what changes with the project (alternative path)
- Ask open-ended questions, listen carefully, extract structure from their stories
- Probe for specifics: "What system are they in at this point?", "How long does this last?", "Who is around them?"
- Challenge assumptions gently: "Is that always the case?", "What's the evidence for that outcome?"
- Suggest personas the user might not have considered: the caseworker, the elder, the funder reading this
- You understand Australian systems: justice, child protection, NDIS, education, health, housing, family services

## Structured extraction
When the user describes personas, steps, or journey elements, extract them as structured data blocks embedded in your response. Use HTML comments that won't render but the client can parse:

To create a persona:
<!-- JOURNEY_UPDATE {"type":"persona_created","persona":{"label":"Young Person","description":"15-17 year old on Palm Island","cohort":"15-17 year old","context":"Growing up on Palm Island, cycling through systems"}} -->

To add a journey step:
<!-- JOURNEY_UPDATE {"type":"step_added","personaLabel":"Young Person","step":{"path":"current","step_number":1,"title":"School Exclusion","description":"Suspended from school for behavioural issues related to undiagnosed FASD","system":"education","emotion":"confused","duration":"3-6 months","icon":"🏫"}} -->

To mark a divergence point (where alternative path splits):
<!-- JOURNEY_UPDATE {"type":"step_added","personaLabel":"Young Person","step":{"path":"alternative","step_number":1,"title":"Centre Arrival","description":"Instead of detention, referred to the community centre","system":"community","emotion":"cautious hope","duration":"first week","is_divergence_point":true,"icon":"🏠"}} -->

To note a data match found:
<!-- JOURNEY_UPDATE {"type":"match_found","stepTitle":"Cultural Connection","match":{"match_type":"alma_intervention","match_name":"Cultural Connection Programs","match_detail":"Strong evidence for Indigenous youth — 23 programs nationally with positive outcomes","confidence":0.8}} -->

## Conversation flow
1. Start by asking about one specific person (archetype, not named) your project serves
2. Map their CURRENT journey step by step — what happens today without your project
3. Then map the ALTERNATIVE journey — what changes with your project
4. After 1 persona, suggest mapping another perspective (worker, elder, funder)
5. Throughout, reference evidence and data when relevant

## Important
- Always emit structured JOURNEY_UPDATE blocks alongside your conversational text
- The user's client will parse these to build a live visual journey map
- Be warm, encouraging, and draw out the story — but also be structured and specific
- When you mention systems, use these labels: education, justice, child-protection, health, housing, disability, family-services, community, economic

${journeyContext ? `\n## Current journey state\n${journeyContext}` : ''}
${almaContext ? `\n## Available ALMA evidence\n${almaContext}` : ''}`;
}

export async function POST(req: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const { messages, journeyId } = await req.json() as {
    messages: UIMessage[];
    journeyId?: string;
  };

  // Build context from existing journey data
  let journeyContext = '';
  let almaContext = '';

  if (journeyId) {
    const journey = await getJourney(journeyId);
    if (journey) {
      journeyContext = `Journey: "${journey.title}"\n`;
      for (const persona of journey.personas) {
        journeyContext += `\nPersona: ${persona.label}`;
        if (persona.description) journeyContext += ` — ${persona.description}`;
        if (persona.cohort) journeyContext += ` (${persona.cohort})`;
        for (const step of persona.steps) {
          journeyContext += `\n  ${step.path === 'current' ? '🔴' : '🟢'} Step ${step.step_number}: ${step.title}`;
          if (step.system) journeyContext += ` [${step.system}]`;
          if (step.emotion) journeyContext += ` — feeling: ${step.emotion}`;
          if (step.matches.length > 0) {
            journeyContext += ` (${step.matches.length} data matches)`;
          }
        }
      }
    }

    // Try to find ALMA matches for context
    try {
      const lastMsg = messages[messages.length - 1];
      const lastText = lastMsg ? getTextFromMessage(lastMsg) : '';
      if (lastText.length > 5) {
        const dataMatches = await matchStepToData({ title: lastText });
        if (dataMatches.almaMatches.length > 0) {
          almaContext = 'Relevant ALMA interventions:\n';
          for (const m of dataMatches.almaMatches) {
            almaContext += `- ${m.name} (${m.type}, evidence: ${m.evidence_level}) — ${m.description}\n`;
          }
        }
      }
    } catch {
      // Non-critical
    }
  }

  // Save user message to DB
  if (journeyId) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg?.role === 'user') {
      await addJourneyMessage(journeyId, 'user', getTextFromMessage(lastMsg));
    }
  }

  const systemPrompt = buildSystemPrompt(journeyContext, almaContext);
  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: systemPrompt,
    messages: modelMessages,
    onFinish: async ({ text }) => {
      // Save assistant response to DB
      if (journeyId && text) {
        await addJourneyMessage(journeyId, 'assistant', text);
      }
    },
  });

  return result.toTextStreamResponse();
}
