#!/usr/bin/env node
// Jev second opinion on supplier identity conflicts the resolver could not settle by rule
// (match_method = 'abn_conflict'). Review-only: writes a JSON file, never a match or a review status.
// Jev labels the relationship; a human confirms. Jev never picks an ABN or merges entities.
//
//   node --env-file=.env scripts/wa/review-supplier-conflicts-jev.mjs            # reads the table
//   node --env-file=.env scripts/wa/review-supplier-conflicts-jev.mjs --input=f  # rows from a file (pre-apply trial)

import { mkdir, readFile, writeFile } from 'node:fs/promises';

const OUT = 'data/jev-check/wa-supplier-conflict-review.json';
const MODEL = 'jev-latest';
const INPUT = process.argv.find((a) => a.startsWith('--input='))?.split('=')[1];

const CHOICES = {
  same_organisation: 'The published supplier and the register legal name describe the same legal organisation; the other candidate is a naming or record error.',
  related_company: 'They are distinct companies in one corporate group (parent, subsidiary, trustee and trust, or trading arm). The contracting party is the register legal name.',
  different_organisation: 'The name-matched candidate is an unrelated organisation that merely shares a name.',
  cannot_tell: 'The published text does not say enough to choose. Needs a human with more sources.',
};

async function loadRows() {
  if (INPUT) return JSON.parse(await readFile(INPUT, 'utf8'));
  const { createClient } = await import('@supabase/supabase-js');
  const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const sql = `SELECT m.supplier_name, count(*) AS lines,
      (SELECT string_agg(g.canonical_name||' ['||coalesce(g.abn,'-')||']', ' | ') FROM gs_entities g WHERE g.id = ANY(m.candidate_entity_ids)) AS name_candidates,
      m.identified_abn AS register_abn,
      (SELECT entity_name FROM mv_abr_name_lookup l WHERE l.abn = m.identified_abn LIMIT 1) AS register_legal_name
    FROM wa_supplier_entity_matches m WHERE m.match_method = 'abn_conflict' AND m.review_status = 'pending'
    GROUP BY 1,3,4,5`;
  const { data, error } = await db.rpc('exec_sql', { query: sql });
  if (error) throw error;
  return data;
}

async function ask(row) {
  const response = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.JEV_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      state: row,
      questions: {
        relationship: {
          type: 'choice',
          instructions: 'The WA award published supplier_name. A name match linked it to name_candidates (each with its ABN); the Australian Business Register has an active ABN whose legal name is register_legal_name. Choose how the name-matched candidate relates to the register organisation, using only these strings. Do not assume Aboriginal or community-controlled status.',
          criteria: CHOICES,
        },
      },
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!response.ok) throw new Error(`${response.status} ${(await response.text()).slice(0, 300)}`);
  const json = await response.json();
  const a = json.answers?.relationship;
  if (!a?.choice || !(a.choice in CHOICES)) throw new Error(`Invalid Jev answer for ${row.supplier_name}`);
  return { ...row, jev_label: a.choice, confidence: Number(a.confidence ?? 0), probabilities: a.probabilities ?? null, model: json.model ?? MODEL };
}

async function main() {
  if (!process.env.JEV_API_KEY) throw new Error('JEV_API_KEY is required');
  const rows = await loadRows();
  const results = [];
  for (let i = 0; i < rows.length; i += 4) results.push(...await Promise.all(rows.slice(i, i + 4).map(ask)));
  const summary = {
    generated_at: new Date().toISOString(),
    status: 'review-only',
    rule: 'Jev labels the relationship between conflicting identities. It does not choose an ABN, merge entities, or write matches or review decisions.',
    source: INPUT ? `file:${INPUT}` : 'wa_supplier_entity_matches abn_conflict',
    records: results.length,
    labels: Object.fromEntries(Object.keys(CHOICES).map((c) => [c, results.filter((r) => r.jev_label === c).length])),
    low_confidence: results.filter((r) => r.confidence < 0.8).length,
    results,
  };
  await mkdir('data/jev-check', { recursive: true });
  await writeFile(OUT, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(JSON.stringify({ output: OUT, records: summary.records, labels: summary.labels, low_confidence: summary.low_confidence }));
}

main().catch((e) => { console.error(e instanceof Error ? e.stack : e); process.exit(1); });
