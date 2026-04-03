#!/usr/bin/env node
/**
 * test-local-run.mjs — Quick integration test
 *
 * Tests the full pipeline with a batch of 5 foundations:
 *   1. Checks local LLM is running
 *   2. Pulls 5 real foundations from your DB
 *   3. Runs them through Gemma 4
 *   4. Shows output WITHOUT writing to DB (dry run)
 *   5. Reports tok/s and quality
 *
 * Usage (from grantscope root):
 *   node --env-file=.env scripts/test-local-run.mjs
 *   node --env-file=.env scripts/test-local-run.mjs --apply  # actually write to DB
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const LOCAL_LLM_URL = process.env.LOCAL_LLM_URL || 'http://127.0.0.1:8080/v1/chat/completions';
const LOCAL_LLM_MODEL = process.env.LOCAL_LLM_MODEL || 'gemma4';
const BATCH_SIZE = 5;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const C = {
  bold: '\x1b[1m', green: '\x1b[32m', yellow: '\x1b[33m',
  blue: '\x1b[34m', cyan: '\x1b[36m', dim: '\x1b[2m', red: '\x1b[31m', reset: '\x1b[0m'
};
const ts = () => new Date().toISOString().slice(11, 19);
const log = (msg) => console.log(`${C.dim}[${ts()}]${C.reset} ${msg}`);
const ok  = (msg) => console.log(`${C.green}✓${C.reset} ${msg}`);
const err = (msg) => console.log(`${C.red}✗${C.reset} ${msg}`);
const sep = () => console.log(`${C.dim}${'─'.repeat(60)}${C.reset}`);

// ─── Step 1: Health check ─────────────────────────────────────────────────────

async function checkLLM() {
  console.log(`\n${C.bold}${C.cyan}Step 1: Local LLM Health Check${C.reset}`);
  sep();
  try {
    const healthUrl = LOCAL_LLM_URL.replace('/chat/completions', '/models');
    const res = await fetch(healthUrl, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      const data = await res.json();
      const models = data.data?.map(m => m.id) || ['unknown'];
      ok(`Local LLM running — models: ${models.join(', ')}`);
      return true;
    }
  } catch (e) {
    err(`Local LLM not reachable at ${LOCAL_LLM_URL}`);
    console.log(`\n  Start it with:`);
    console.log(`  ${C.cyan}llama-server -m <gemma4.gguf> --jinja -fa -c 131072 -ngl 99${C.reset}\n`);
    return false;
  }
  return false;
}

// ─── Step 2: Pull foundations ─────────────────────────────────────────────────

async function fetchFoundations() {
  console.log(`\n${C.bold}${C.cyan}Step 2: Fetch ${BATCH_SIZE} Foundations from DB${C.reset}`);
  sep();

  const { data, error } = await supabase
    .from('foundations')
    .select('id, name, acnc_abn, website, total_giving_annual, thematic_focus, description, acnc_data')
    .is('enriched_at', null)
    .not('total_giving_annual', 'is', null)
    .order('total_giving_annual', { ascending: false })
    .limit(BATCH_SIZE);

  if (error) { err(`DB error: ${error.message}`); process.exit(1); }
  if (!data?.length) { err('No unenriched foundations found'); process.exit(1); }

  ok(`Found ${data.length} foundations:`);
  data.forEach((f, i) => {
    const giving = f.total_giving_annual ? `$${Number(f.total_giving_annual).toLocaleString()}/yr` : 'no giving data';
    console.log(`  ${i + 1}. ${C.bold}${f.name}${C.reset} (${f.acnc_data?.State || '?'}) — ${giving}`);
  });
  return data;
}

// ─── Step 3: Build prompt ─────────────────────────────────────────────────────

function buildPrompt(f) {
  const acnc = f.acnc_data || {};
  const purposes = [];
  const purposeMap = {
    'Advancing_Health': 'Health', 'Advancing_Education': 'Education',
    'Advancing_Culture': 'Culture', 'Advancing_natual_environment': 'Environment',
    'Advancing_social_or_public_welfare': 'Social welfare',
    'Promoting_or_protecting_human_rights': 'Human rights',
    'Promoting_reconciliation__mutual_respect_and_tolerance': 'Reconciliation',
  };
  for (const [k, v] of Object.entries(purposeMap)) {
    if (acnc[k] === 'Y') purposes.push(v);
  }
  const beneficiaries = [];
  const bMap = {
    'Youth': 'Youth', 'Children': 'Children', 'Aboriginal_or_TSI': 'Aboriginal & TSI peoples',
    'People_with_Disabilities': 'People with disabilities', 'Financially_Disadvantaged': 'Financially disadvantaged',
    'Rural_Regional_Remote_Communities': 'Rural/remote communities', 'General_Community_in_Australia': 'General community',
  };
  for (const [k, v] of Object.entries(bMap)) {
    if (acnc[k] === 'Y') beneficiaries.push(v);
  }
  const states = ['NSW','VIC','QLD','SA','WA','TAS','NT','ACT'].filter(s => acnc[`Operates_in_${s}`] === 'Y');

  return `You are analysing an Australian philanthropic foundation for a funding transparency database. Return ONLY JSON.

Foundation Name: ${f.name}
ABN: ${f.acnc_abn || 'N/A'}
State: ${f.acnc_data?.State || 'Unknown'}
Annual Giving: ${f.total_giving_annual ? '$' + Number(f.total_giving_annual).toLocaleString() : 'unknown'}
${purposes.length ? 'Purposes: ' + purposes.join(', ') : ''}
${beneficiaries.length ? 'Beneficiaries: ' + beneficiaries.join(', ') : ''}
${states.length ? 'Operates in: ' + states.join(', ') : ''}

Return this JSON (keep descriptions under 300 chars, be specific to Australia):
{
  "description": "2-3 sentences on what this foundation does and who it supports.",
  "thematic_focus": ["area1", "area2"],
  "geographic_focus": ["AU-National" or state code],
  "giving_philosophy": "1-2 sentences on how they approach giving.",
  "wealth_source": "Brief: corporate, family, community, etc."
}`;
}

// ─── Step 4: Call LLM ─────────────────────────────────────────────────────────

async function callLLM(prompt) {
  const t0 = Date.now();
  const res = await fetch(LOCAL_LLM_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: LOCAL_LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
      stream: false,
    }),
    signal: AbortSignal.timeout(90_000),
  });

  if (!res.ok) throw new Error(`LLM returned ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  const elapsed = (Date.now() - t0) / 1000;
  const tokens = data.usage?.completion_tokens || text.split(/\s+/).length;
  const tps = Math.round(tokens / elapsed);
  return { text, tps, elapsed: elapsed.toFixed(1), tokens };
}

// ─── Step 5: Parse result ─────────────────────────────────────────────────────

function parseResult(text) {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0].replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'));
  } catch {
    return null;
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${C.bold}CivicGraph × Local Gemma 4 — Integration Test${C.reset}`);
  console.log(`Mode: ${APPLY ? C.yellow + 'LIVE (writing to DB)' : C.green + 'DRY RUN (no writes)'}${C.reset}`);

  const llmOk = await checkLLM();
  if (!llmOk) process.exit(1);

  const foundations = await fetchFoundations();

  console.log(`\n${C.bold}${C.cyan}Step 3: Enrich with Gemma 4${C.reset}`);
  sep();

  const results = [];
  let totalTps = 0;

  for (let i = 0; i < foundations.length; i++) {
    const f = foundations[i];
    console.log(`\n${C.bold}[${i + 1}/${foundations.length}]${C.reset} ${f.name}`);

    try {
      const prompt = buildPrompt(f);
      log('Calling local LLM...');

      const { text, tps, elapsed, tokens } = await callLLM(prompt);
      totalTps += tps;

      const parsed = parseResult(text);

      if (!parsed) {
        err(`No JSON parsed from response`);
        console.log(`${C.dim}Raw: ${text.slice(0, 200)}${C.reset}`);
        results.push({ foundation: f.name, success: false });
        continue;
      }

      ok(`${tps} tok/s — ${elapsed}s — ${tokens} tokens`);
      console.log(`  ${C.bold}Description:${C.reset} ${parsed.description || '—'}`);
      console.log(`  ${C.bold}Themes:${C.reset}      ${(parsed.thematic_focus || []).join(', ') || '—'}`);
      console.log(`  ${C.bold}Geography:${C.reset}   ${(parsed.geographic_focus || []).join(', ') || '—'}`);
      console.log(`  ${C.bold}Philosophy:${C.reset}  ${parsed.giving_philosophy || '—'}`);
      console.log(`  ${C.bold}Wealth:${C.reset}      ${parsed.wealth_source || '—'}`);

      results.push({ foundation: f.name, success: true, tps, parsed });

      // Optionally write to DB
      if (APPLY && parsed.description) {
        const update = {
          enriched_at: new Date().toISOString(),
          enrichment_source: 'local-gemma4-test',
          description: parsed.description.slice(0, 1500),
        };
        if (parsed.thematic_focus?.length) update.thematic_focus = parsed.thematic_focus;
        if (parsed.geographic_focus?.length) update.geographic_focus = parsed.geographic_focus;
        if (parsed.giving_philosophy) update.giving_philosophy = parsed.giving_philosophy;
        if (parsed.wealth_source) update.wealth_source = parsed.wealth_source;

        const { error: updateErr } = await supabase.from('foundations').update(update).eq('id', f.id);
        if (updateErr) err(`DB write failed: ${updateErr.message}`);
        else ok(`Written to DB`);
      }

      // Pause between calls
      if (i < foundations.length - 1) await new Promise(r => setTimeout(r, 500));

    } catch (e) {
      err(`Failed: ${e.message}`);
      results.push({ foundation: f.name, success: false, error: e.message });
    }
  }

  // ─── Summary ───────────────────────────────────────────────────────────────

  const success = results.filter(r => r.success).length;
  const avgTps = success > 0 ? Math.round(totalTps / success) : 0;
  const estimatedHours = (5950 / (3600 / (1 / (avgTps / 300) + 0.5))).toFixed(1); // ~300 tokens/foundation + 0.5s delay

  console.log(`\n${C.bold}${C.cyan}Summary${C.reset}`);
  sep();
  ok(`${success}/${results.length} foundations enriched successfully`);
  if (avgTps) {
    ok(`Average speed: ${avgTps} tok/s`);
    ok(`Estimated time for all 5,950 foundations: ~${estimatedHours} hours`);
  }

  if (!APPLY) {
    console.log(`\n${C.yellow}Dry run — nothing written to DB.${C.reset}`);
    console.log(`Run with ${C.cyan}--apply${C.reset} to write results to Supabase.`);
  }

  console.log('');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
