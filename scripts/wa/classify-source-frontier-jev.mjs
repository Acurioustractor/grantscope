#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const OUT = 'data/jev-check/wa-transition-source-routing.json';
const MODEL = 'jev-latest';
const LIMIT = Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? 100);
const db = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const CHOICES = {
  ingest_structured: 'A machine-readable official file or API that can be acquired and schema-profiled now. This choice does not mean its claims are verified beyond the source.',
  extract_documents: 'Official reports or pages whose useful evidence needs structured extraction from HTML, PDF, tables or narrative text.',
  validate_dashboard: 'An interactive dashboard or business-intelligence surface useful for discovery and validation but not yet proven to expose a stable supported bulk feed.',
  test_portal: 'A search or procurement portal that requires a documented feasibility test for pagination, identifiers, detail pages, omissions and change tracking.',
  govern_relationship: 'A source where lawful access is not enough: interpretation or publication depends on community authority, consent, relationship context or human permission.',
  monitor_only: 'A policy, guidance or contextual page best monitored for changes rather than ingested as event-level data.',
};

const EXPECTED = {
  'direct-ingestion': 'ingest_structured',
  'document-extraction': 'extract_documents',
  'dashboard-validation': 'validate_dashboard',
  'portal-feasibility': 'test_portal',
  'relationship-governed': 'govern_relationship',
  'catalogue-discovery': 'monitor_only',
};

async function ask(row) {
  const response = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.JEV_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      state: {
        source_name: row.source_name,
        url: row.target_url,
        evidence_lane: row.metadata?.lane,
        source_says_it_can_prove: row.metadata?.proves,
        source_cannot_prove: row.metadata?.cannot_prove,
      },
      questions: {
        acquisition_route: {
          type: 'choice',
          instructions: 'Choose one acquisition route for this public evidence source. Do not infer community authority, ACCO status, readiness, consent, outcomes or permission to contact.',
          criteria: CHOICES,
        },
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 300)}`);
  const json = await response.json();
  const answer = json.answers?.acquisition_route;
  if (!answer?.choice || !(answer.choice in CHOICES)) throw new Error(`Invalid Jev answer for ${row.source_key}`);
  return {
    source_key: row.source_key,
    source_name: row.source_name,
    declared_data_fit: row.metadata?.data_fit,
    expected_route: EXPECTED[row.metadata?.data_fit] ?? null,
    jev_route: answer.choice,
    confidence: Number(answer.confidence ?? 0),
    probabilities: answer.probabilities ?? null,
    agrees_with_declared_fit: answer.choice === EXPECTED[row.metadata?.data_fit],
    model: json.model ?? MODEL,
    input_tokens: json.usage?.input_tokens ?? null,
  };
}

async function main() {
  if (!process.env.JEV_API_KEY) throw new Error('JEV_API_KEY is required');
  const { data, error } = await db
    .from('source_frontier')
    .select('source_key,source_name,target_url,metadata')
    .like('source_key', 'wa-transition:%')
    .order('priority', { ascending: false })
    .limit(LIMIT);
  if (error) throw error;

  const results = [];
  for (let index = 0; index < data.length; index += 4) {
    results.push(...await Promise.all(data.slice(index, index + 4).map(ask)));
  }
  const summary = {
    generated_at: new Date().toISOString(),
    status: 'review-only',
    rule: 'Jev routes public evidence sources only. It does not decide ACCO identity, authority, readiness, consent, outcomes or outreach.',
    sources: results.length,
    agreement: results.filter((row) => row.agrees_with_declared_fit).length,
    low_confidence: results.filter((row) => row.confidence < 0.8).length,
    results,
  };
  await mkdir('data/jev-check', { recursive: true });
  await writeFile(OUT, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({
    output: OUT,
    sources: summary.sources,
    agreement: summary.agreement,
    disagreements: summary.sources - summary.agreement,
    low_confidence: summary.low_confidence,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : JSON.stringify(error, null, 2));
  process.exit(1);
});
