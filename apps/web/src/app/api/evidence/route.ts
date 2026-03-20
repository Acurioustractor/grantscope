import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { getServiceSupabase } from '@/lib/supabase';
import { safe } from '@/lib/services/utils';

export const maxDuration = 30;

const VALID_TOPICS = [
  'youth-justice', 'child-protection', 'ndis', 'family-services',
  'indigenous', 'legal-services', 'diversion', 'prevention',
  'wraparound', 'community-led',
];

const VALID_STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'];

const SYNTHESIS_PROMPT = `You are CivicGraph's evidence analyst. You synthesise data from the Australian Living Map of Alternatives (ALMA), a database of evidence-based justice and community interventions across Australia.

Structure your response with these sections:

## What Works
Summarise the top evidence-backed interventions. Mention specific program names, evidence types (RCT, quasi-experimental, program evaluation), effect sizes where available, and methodology quality. Highlight interventions with cultural authority or community-led approaches.

## Evidence Gaps
Identify where evidence is missing or weak. Which intervention types lack rigorous evaluation? Which geographies or cohorts are under-researched? Note the ratio of program evaluations vs RCTs.

## Funding Alignment
Based on the data, assess whether the best-evidenced programs are the ones receiving funding. Highlight mismatches — effective programs that appear underfunded, or well-funded programs with weak evidence.

## Recommendations
Provide 3-5 specific, actionable recommendations for commissioners, funders, or policy-makers. Reference specific interventions and evidence gaps. Use Australian policy context.

Be direct, specific, and data-driven. Cite intervention names and evidence types. Use Australian English.`;

export async function POST(request: NextRequest) {
  let body: { topic?: string; state?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { topic, state } = body;

  if (!topic || !VALID_TOPICS.includes(topic)) {
    return NextResponse.json({ error: `Invalid topic. Valid: ${VALID_TOPICS.join(', ')}` }, { status: 400 });
  }

  if (state && !VALID_STATES.includes(state)) {
    return NextResponse.json({ error: `Invalid state. Valid: ${VALID_STATES.join(', ')}` }, { status: 400 });
  }

  const supabase = getServiceSupabase();

  // SAFETY: topic and state are validated against VALID_TOPICS/VALID_STATES allowlists above.
  // Do NOT add new interpolated params without adding allowlist validation first.
  const stateFilter = state
    ? `AND (ai.geography ILIKE '%${state}%' OR ge.state = '${state}')`
    : '';

  // Query ALMA data in parallel
  const [interventions, evidence, outcomes, stats] = await Promise.all([
    // Interventions matching topic
    safe(supabase.rpc('exec_sql', {
      query: `SELECT ai.name, ai.type, ai.evidence_level, ai.description,
                ai.cultural_authority, ai.target_cohort, ai.geography,
                ai.portfolio_score::float, ge.canonical_name as org_name, ge.state as org_state
         FROM alma_interventions ai
         LEFT JOIN gs_entities ge ON ge.id = ai.gs_entity_id
         WHERE ai.topics @> ARRAY['${topic}']::text[]
         ${stateFilter}
         ORDER BY ai.portfolio_score DESC NULLS LAST
         LIMIT 50`,
    })),

    // Evidence records for matching interventions (via junction table)
    safe(supabase.rpc('exec_sql', {
      query: `SELECT ae.evidence_type, ae.methodology, ae.sample_size, ae.effect_size,
                ai.name as intervention_name
         FROM alma_evidence ae
         JOIN alma_intervention_evidence aie ON aie.evidence_id = ae.id
         JOIN alma_interventions ai ON ai.id = aie.intervention_id
         ${state ? `LEFT JOIN gs_entities ge ON ge.id = ai.gs_entity_id` : ''}
         WHERE ai.topics @> ARRAY['${topic}']::text[]
         ${stateFilter}
         LIMIT 100`,
    })),

    // Outcomes for matching interventions (via junction table)
    safe(supabase.rpc('exec_sql', {
      query: `SELECT ao.outcome_type, ao.measurement_method, ao.indicators,
                ai.name as intervention_name
         FROM alma_outcomes ao
         JOIN alma_intervention_outcomes aio ON aio.outcome_id = ao.id
         JOIN alma_interventions ai ON ai.id = aio.intervention_id
         ${state ? `LEFT JOIN gs_entities ge ON ge.id = ai.gs_entity_id` : ''}
         WHERE ai.topics @> ARRAY['${topic}']::text[]
         ${stateFilter}
         LIMIT 100`,
    })),

    // Summary stats
    safe(supabase.rpc('exec_sql', {
      query: `SELECT
         (SELECT COUNT(*)::int FROM alma_interventions ai
          ${state ? `LEFT JOIN gs_entities ge ON ge.id = ai.gs_entity_id` : ''}
          WHERE ai.topics @> ARRAY['${topic}']::text[] ${stateFilter}) as interventions,
         (SELECT COUNT(*)::int FROM alma_evidence ae
          JOIN alma_intervention_evidence aie ON aie.evidence_id = ae.id
          JOIN alma_interventions ai ON ai.id = aie.intervention_id
          ${state ? `LEFT JOIN gs_entities ge ON ge.id = ai.gs_entity_id` : ''}
          WHERE ai.topics @> ARRAY['${topic}']::text[] ${stateFilter}) as evidence,
         (SELECT COUNT(*)::int FROM alma_outcomes ao
          JOIN alma_intervention_outcomes aio ON aio.outcome_id = ao.id
          JOIN alma_interventions ai ON ai.id = aio.intervention_id
          ${state ? `LEFT JOIN gs_entities ge ON ge.id = ai.gs_entity_id` : ''}
          WHERE ai.topics @> ARRAY['${topic}']::text[] ${stateFilter}) as outcomes`,
    })),
  ]);

  const statsRow = (stats as Array<{ interventions: number; evidence: number; outcomes: number }> | null)?.[0]
    ?? { interventions: 0, evidence: 0, outcomes: 0 };

  console.log(`[/api/evidence] topic=${topic} state=${state || 'all'} → ${statsRow.interventions} interventions, ${statsRow.evidence} evidence, ${statsRow.outcomes} outcomes`);

  if (statsRow.interventions === 0) {
    return NextResponse.json({ error: 'No interventions found for this topic/state combination' }, { status: 404 });
  }

  // Build context blob for synthesis
  const topicLabel = topic.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
  let context = `# ALMA Evidence Data: ${topicLabel}${state ? ` (${state})` : ''}\n\n`;
  context += `Total: ${statsRow.interventions} interventions, ${statsRow.evidence} evidence records, ${statsRow.outcomes} outcomes measured.\n\n`;

  if (interventions && Array.isArray(interventions)) {
    context += `## Interventions\n`;
    for (const i of interventions) {
      context += `- **${i.name}** (${i.type || 'Unknown type'}): ${i.evidence_level || 'No evidence level'}`;
      if (i.cultural_authority) context += ` | Cultural authority: ${i.cultural_authority}`;
      if (i.target_cohort) context += ` | Cohort: ${i.target_cohort}`;
      if (i.geography) context += ` | Geography: ${i.geography}`;
      if (i.org_name) context += ` | Org: ${i.org_name} (${i.org_state || '?'})`;
      if (i.portfolio_score) context += ` | Score: ${i.portfolio_score}`;
      if (i.description) context += `\n  ${String(i.description).slice(0, 200)}`;
      context += '\n';
    }
  }

  if (evidence && Array.isArray(evidence)) {
    context += `\n## Evidence Records\n`;
    for (const e of evidence) {
      context += `- ${e.intervention_name}: ${e.evidence_type}`;
      if (e.methodology) context += ` | Method: ${e.methodology}`;
      if (e.sample_size) context += ` | N=${e.sample_size}`;
      if (e.effect_size) context += ` | Effect: ${e.effect_size}`;
      context += '\n';
    }
  }

  if (outcomes && Array.isArray(outcomes)) {
    context += `\n## Outcomes Measured\n`;
    for (const o of outcomes) {
      context += `- ${o.intervention_name}: ${o.outcome_type}`;
      if (o.measurement_method) context += ` (${o.measurement_method})`;
      if (o.indicators) context += ` — ${o.indicators}`;
      context += '\n';
    }
  }

  // Stream synthesis via MiniMax (Anthropic-compatible endpoint)
  const minimax = createAnthropic({
    baseURL: 'https://api.minimax.io/anthropic/v1',
    apiKey: process.env.MINIMAX_API_KEY,
  });

  const result = streamText({
    model: minimax('MiniMax-M2'),
    system: SYNTHESIS_PROMPT,
    prompt: context,
  });

  // Build streaming response with stats header
  const stream = result.textStream;
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          controller.enqueue(encoder.encode(chunk));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-evidence-stats': JSON.stringify(statsRow),
    },
  });
}
