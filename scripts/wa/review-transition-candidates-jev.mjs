#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const OUT = 'data/jev-check/wa-transition-candidate-review.json';
const MODEL = 'jev-latest';
const LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? 100);
const db = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const CHOICES = {
  retain_candidate: 'The published contract description clearly concerns delivery of a human service in the assigned service family and should remain in the bounded human-review queue.',
  needs_review: 'The record may concern human-service delivery, but ambiguity, mixed scope, consulting, infrastructure, goods, or insufficient detail requires human inspection.',
  likely_exclude: 'The record is primarily construction, maintenance, technology, goods, administrative support, research, or another non-service purchase and is likely a false positive.',
};

async function ask(row) {
  const response = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.JEV_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      state: {
        source_contract_id: row.source_contract_id,
        title: row.state_tenders.title,
        description: row.state_tenders.description,
        category: row.state_tenders.category,
        buyer: row.state_tenders.buyer_name,
        supplier: row.state_tenders.supplier_name,
        regions: row.state_tenders.regions,
        assigned_service_family: row.service_family,
        rules_status: row.candidate_status,
        positive_signals: row.positive_signals,
        exclusion_signals: row.exclusion_signals,
      },
      questions: {
        routing: {
          type: 'choice',
          instructions: 'Choose one review route using only the published procurement text. Assess whether this is human-service delivery, not whether the supplier is an ACCO or ready to deliver. Do not infer authority, need, outcomes, suitability, consent, or permission to contact.',
          criteria: CHOICES,
        },
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 300)}`);
  const json = await response.json();
  const answer = json.answers?.routing;
  if (!answer?.choice || !(answer.choice in CHOICES)) throw new Error(`Invalid Jev answer for ${row.source_contract_id}`);
  return {
    source_contract_id: row.source_contract_id,
    title: row.state_tenders.title,
    rules_status: row.candidate_status,
    service_family: row.service_family,
    is_kimberley: row.is_kimberley,
    jev_route: answer.choice,
    confidence: Number(answer.confidence ?? 0),
    probabilities: answer.probabilities ?? null,
    model: json.model ?? MODEL,
  };
}

async function main() {
  if (!process.env.JEV_API_KEY) throw new Error('JEV_API_KEY is required');
  const { data, error } = await db
    .from('wa_transition_candidates')
    .select('source_contract_id,service_family,candidate_status,positive_signals,exclusion_signals,is_kimberley,state_tenders!inner(title,description,category,buyer_name,supplier_name,regions)')
    .in('candidate_status', ['candidate', 'review'])
    .order('is_kimberley', { ascending: false })
    .order('relevance_score', { ascending: false })
    .limit(LIMIT);
  if (error) throw error;

  const results = [];
  for (let index = 0; index < data.length; index += 4) {
    results.push(...await Promise.all(data.slice(index, index + 4).map(ask)));
  }
  const summary = {
    generated_at: new Date().toISOString(),
    status: 'review-only',
    rule: 'Jev supplies a bounded second opinion. It does not write review decisions or determine ACCO identity, authority, readiness, consent, outcomes or outreach.',
    records: results.length,
    routes: Object.fromEntries(Object.keys(CHOICES).map((choice) => [choice, results.filter((row) => row.jev_route === choice).length])),
    low_confidence: results.filter((row) => row.confidence < 0.8).length,
    kimberley: results.filter((row) => row.is_kimberley),
    results,
  };
  await mkdir('data/jev-check', { recursive: true });
  await writeFile(OUT, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ output: OUT, records: summary.records, routes: summary.routes, low_confidence: summary.low_confidence, kimberley: summary.kimberley.length }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : JSON.stringify(error, null, 2));
  process.exit(1);
});
