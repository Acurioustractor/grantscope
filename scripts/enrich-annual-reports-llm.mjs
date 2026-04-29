#!/usr/bin/env node
/**
 * Re-enrich charity_impact_reports rows with LLM-extracted structured data.
 *
 * Why: the original regex extractor missed beneficiary counts, program counts,
 * and good narrative summaries. This script re-fetches each row's source URL via
 * Firecrawl, then asks Claude Haiku via tool-use to return:
 *   - total_beneficiaries (int | null)
 *   - programs_delivered (int | null)
 *   - impact_summary (50-300 chars)
 *   - top_funders_mentioned (string[])
 *   - key_quotes (string[], up to 3)
 *   - programs_mentioned (string[])
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-annual-reports-llm.mjs                 # dry run, all rows
 *   node --env-file=.env scripts/enrich-annual-reports-llm.mjs --apply         # write to DB
 *   node --env-file=.env scripts/enrich-annual-reports-llm.mjs --abn=23684792947
 *   node --env-file=.env scripts/enrich-annual-reports-llm.mjs --year=2021 --apply
 *
 * Reference shape: scripts/scrape-vic-dept-annual-reports.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const FIRECRAWL_KEY = process.env.FIRECRAWL_API_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE creds'); process.exit(1); }
if (!FIRECRAWL_KEY) { console.error('Missing FIRECRAWL_API_KEY'); process.exit(1); }
if (!ANTHROPIC_KEY) { console.error('Missing ANTHROPIC_API_KEY'); process.exit(1); }
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] || null;
const flag = name => process.argv.includes(`--${name}`);

const ABN_FILTER = arg('abn');
const YEAR_FILTER = arg('year') ? Number(arg('year')) : null;
const MIN_CHARS = Number(arg('min-chars') || 500);
const APPLY = flag('apply');
const FORCE_REFETCH = flag('force-refetch');
const MODEL = arg('model') || 'claude-haiku-4-5-20251001';

const CACHE_DIR = 'data/charity-annual-reports';
mkdirSync(CACHE_DIR, { recursive: true });

// ── Firecrawl ───────────────────────────────────────────────────────────────
async function firecrawlScrape(url) {
  console.log(`    fetching ${url}`);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 240_000);
  let res;
  try {
    res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, formats: ['markdown'], waitFor: 2000, timeout: 180_000 }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
  if (!res.ok) throw new Error(`Firecrawl scrape ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const j = await res.json();
  return j?.data?.markdown || j?.markdown || '';
}

// ── Chunking ────────────────────────────────────────────────────────────────
function chunkText(text, maxChars) {
  if (text.length <= maxChars) return [text];
  // Split into 2 chunks roughly evenly on a paragraph boundary near the midpoint
  const blocks = text.split(/\n{2,}/);
  const chunks = [];
  let cur = '';
  for (const b of blocks) {
    if ((cur + '\n\n' + b).length > maxChars && cur) {
      chunks.push(cur);
      cur = b;
    } else {
      cur = cur ? `${cur}\n\n${b}` : b;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

// ── LLM extraction ──────────────────────────────────────────────────────────
const EXTRACTION_TOOL = {
  name: 'record_charity_impact',
  description: 'Record structured impact data extracted from a charity annual report.',
  input_schema: {
    type: 'object',
    properties: {
      total_beneficiaries: {
        type: ['integer', 'null'],
        description: 'Single most representative count of people the charity served / reached / helped during the year. Null if no clear count is stated.',
      },
      programs_delivered: {
        type: ['integer', 'null'],
        description: 'Number of distinct programs, services or initiatives delivered. Null if not stated.',
      },
      impact_summary: {
        type: 'string',
        description: 'A factual 50-300 character summary of the year\'s impact highlights, in plain language. Empty string if document has no impact content.',
      },
      top_funders_mentioned: {
        type: 'array',
        items: { type: 'string' },
        description: 'Government agencies, departments, or major funders cited as funding sources (e.g. "DSS", "NIAA", "Department of Home Affairs", "Victorian Government"). Empty array if none.',
      },
      key_quotes: {
        type: 'array',
        items: { type: 'string' },
        description: 'Up to 3 short verbatim quotes (under 200 chars each) from the CEO, Chair, President or member messages. Empty array if none.',
      },
      programs_mentioned: {
        type: 'array',
        items: { type: 'string' },
        description: 'Names of distinct programs / services / initiatives mentioned. Empty array if none.',
      },
    },
    required: ['total_beneficiaries', 'programs_delivered', 'impact_summary', 'top_funders_mentioned', 'key_quotes', 'programs_mentioned'],
  },
};

const SYSTEM_PROMPT = `You extract structured impact data from Australian charity annual reports and publications.

You will be given a chunk of markdown from one report. Extract:

1. total_beneficiaries — the single best count of people served / reached during the year. Look for phrases like "served X people", "reached X members", "supported X clients", "X participants". Use the largest representative cohort number that's clearly the headline figure. If no clear count, return null.
2. programs_delivered — count of distinct programs, services or initiatives the charity ran. Null if not stated.
3. impact_summary — 50-300 chars of the year's headline impact in plain factual language. Empty string if document is purely policy/advocacy with no impact data.
4. top_funders_mentioned — government agencies / departments / major funders explicitly cited (e.g. "Department of Social Services", "DSS", "NIAA", "Department of Home Affairs", "Victorian Government").
5. key_quotes — up to 3 short verbatim quotes from CEO/Chair/President messages (under 200 chars each). Skip if none.
6. programs_mentioned — names of distinct programs/services.

CRITICAL RULES:
- Do NOT invent numbers. If a beneficiary count is not clearly stated, return null.
- Do NOT extract counts from policy recommendations or population statistics about Australia generally — only counts the charity itself reports about its own work.
- Quotes must be verbatim and properly attributed in the source.
- If the chunk is a policy submission, election platform, or magazine issue with no impact-of-the-charity content, return nulls / empty arrays / empty summary.`;

const MINIMAX_SYSTEM = `${SYSTEM_PROMPT}

Return ONLY valid JSON, no prose, no markdown code fences. Schema:
{"total_beneficiaries": number|null, "programs_delivered": number|null, "impact_summary": string, "top_funders_mentioned": string[], "key_quotes": string[], "programs_mentioned": string[]}`;

async function extractFromChunkAnthropic(chunk, charityName, year) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'record_charity_impact' },
      messages: [
        {
          role: 'user',
          content: `Extract impact data for: ${charityName || 'charity'} (report year ${year}).\n\n<chunk>\n${chunk}\n</chunk>`,
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const e = new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
    e.status = res.status;
    e.creditExhausted = res.status === 400 && /credit balance/i.test(body);
    throw e;
  }
  const data = await res.json();
  const toolUse = data.content?.find(c => c.type === 'tool_use');
  if (!toolUse) {
    console.log(`      no tool_use in response (stop=${data.stop_reason})`);
    return null;
  }
  return toolUse.input || null;
}

async function extractFromChunkMiniMax(chunk, charityName, year) {
  const { callMiniMaxJSON } = await import('./lib/minimax.mjs');
  const userPrompt = `Extract impact data for: ${charityName || 'charity'} (report year ${year}).\n\n<chunk>\n${chunk}\n</chunk>`;
  try {
    const { json } = await callMiniMaxJSON({ system: MINIMAX_SYSTEM, user: userPrompt, max_tokens: 8000 });
    return {
      total_beneficiaries: json.total_beneficiaries ?? null,
      programs_delivered: json.programs_delivered ?? null,
      impact_summary: json.impact_summary || '',
      top_funders_mentioned: Array.isArray(json.top_funders_mentioned) ? json.top_funders_mentioned : [],
      key_quotes: Array.isArray(json.key_quotes) ? json.key_quotes : [],
      programs_mentioned: Array.isArray(json.programs_mentioned) ? json.programs_mentioned : [],
    };
  } catch (err) {
    console.log(`      MiniMax error: ${err.message.slice(0, 200)}`);
    return null;
  }
}

const PROVIDER = process.env.LLM_PROVIDER || 'auto';
let anthropicDead = false;

async function extractFromChunk(chunk, charityName, year) {
  if (PROVIDER === 'minimax' || anthropicDead) {
    return extractFromChunkMiniMax(chunk, charityName, year);
  }
  if (PROVIDER === 'anthropic') {
    return extractFromChunkAnthropic(chunk, charityName, year);
  }
  try {
    return await extractFromChunkAnthropic(chunk, charityName, year);
  } catch (err) {
    if (err.creditExhausted) {
      console.log(`      ⚠ Anthropic credit exhausted — falling back to MiniMax for remainder of run`);
      anthropicDead = true;
      return extractFromChunkMiniMax(chunk, charityName, year);
    }
    throw err;
  }
}

// ── Merge results from multiple chunks ──────────────────────────────────────
function mergeResults(results) {
  const valid = results.filter(Boolean);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];

  // total_beneficiaries: take max non-null
  const benCounts = valid.map(r => r.total_beneficiaries).filter(v => v != null && Number.isFinite(v));
  const total_beneficiaries = benCounts.length ? Math.max(...benCounts) : null;

  // programs_delivered: take max non-null
  const progCounts = valid.map(r => r.programs_delivered).filter(v => v != null && Number.isFinite(v));
  const programs_delivered = progCounts.length ? Math.max(...progCounts) : null;

  // impact_summary: longest non-empty
  const summaries = valid.map(r => (r.impact_summary || '').trim()).filter(Boolean);
  summaries.sort((a, b) => b.length - a.length);
  const impact_summary = summaries[0] || '';

  // arrays: dedupe (case-insensitive), preserve order
  const dedupe = (arr) => {
    const seen = new Set();
    const out = [];
    for (const v of arr) {
      const key = String(v || '').trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(String(v).trim());
    }
    return out;
  };
  const top_funders_mentioned = dedupe(valid.flatMap(r => r.top_funders_mentioned || []));
  const key_quotes = dedupe(valid.flatMap(r => r.key_quotes || [])).slice(0, 3);
  const programs_mentioned = dedupe(valid.flatMap(r => r.programs_mentioned || []));

  return { total_beneficiaries, programs_delivered, impact_summary, top_funders_mentioned, key_quotes, programs_mentioned };
}

// ── Per-row processor ───────────────────────────────────────────────────────
async function processRow(row) {
  console.log(`\n  → row ${row.id}: ABN ${row.abn} year ${row.report_year} (${row.extracted_text_chars} chars)`);
  const cachePath = join(CACHE_DIR, `${row.abn}-${row.report_year}.md`);

  let md;
  if (existsSync(cachePath) && !FORCE_REFETCH) {
    md = readFileSync(cachePath, 'utf-8');
    console.log(`    cache hit: ${cachePath} (${md.length} chars)`);
  } else {
    try {
      md = await firecrawlScrape(row.source_url);
    } catch (err) {
      console.log(`    firecrawl failed: ${err.message}`);
      // Fallback: try the older vic-annual-reports cache (very unlikely to exist for charities)
      const fallback = join('data/vic-annual-reports', `${row.abn}-${row.report_year}.md`);
      if (existsSync(fallback)) {
        md = readFileSync(fallback, 'utf-8');
        console.log(`    using fallback cache ${fallback} (${md.length} chars)`);
      } else {
        return { ok: false, reason: 'fetch_failed' };
      }
    }
    if (!md || md.length < 200) {
      console.log(`    scrape too short (${md?.length ?? 0} chars) — skipping`);
      return { ok: false, reason: 'short_scrape' };
    }
    writeFileSync(cachePath, md, 'utf-8');
    console.log(`    cached → ${cachePath} (${md.length} chars)`);
  }

  // Long docs: split into 2 chunks for the LLM (~50K chars each is safe)
  const chunks = md.length > 20_000 ? chunkText(md, Math.ceil(md.length / 2) + 2000) : [md];
  console.log(`    chunks: ${chunks.length}`);

  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    try {
      const r = await extractFromChunk(chunks[i], row.charity_name, row.report_year);
      if (r) {
        console.log(`    chunk ${i + 1}: ben=${r.total_beneficiaries} prog=${r.programs_delivered} funders=${r.top_funders_mentioned?.length || 0} quotes=${r.key_quotes?.length || 0}`);
        results.push(r);
      }
    } catch (err) {
      console.log(`    chunk ${i + 1} extraction error: ${err.message}`);
    }
    await new Promise(r => setTimeout(r, 300));
  }

  const merged = mergeResults(results);
  if (!merged) {
    console.log(`    no extraction results`);
    return { ok: false, reason: 'no_extraction' };
  }

  // Sanitize impact_summary length
  let summary = (merged.impact_summary || '').trim();
  if (summary.length > 600) summary = summary.slice(0, 600);

  // Additive update: only write a field when the new extraction has real data,
  // so a weak/empty MiniMax run never clobbers an earlier richer extraction.
  const update = {};
  if (Number.isFinite(merged.total_beneficiaries)) update.total_beneficiaries = merged.total_beneficiaries;
  if (Number.isFinite(merged.programs_delivered)) update.programs_delivered = merged.programs_delivered;
  if (summary) update.impact_summary = summary;
  if (merged.top_funders_mentioned?.length) update.top_funders_mentioned = merged.top_funders_mentioned;
  if (merged.key_quotes?.length) update.key_quotes = merged.key_quotes;
  if (merged.programs_mentioned?.length) update.programs_mentioned = merged.programs_mentioned;
  if (Object.keys(update).length === 0) {
    console.log(`    → no extractable fields, skipping update`);
    return { ok: true, update: null, applied: false, reason: 'empty_extraction' };
  }
  update.extraction_model = MODEL;

  console.log(`    → would update fields=[${Object.keys(update).filter(k => k !== 'extraction_model').join(',')}] ben=${update.total_beneficiaries ?? '·'} prog=${update.programs_delivered ?? '·'} funders=${update.top_funders_mentioned?.length ?? 0}`);

  if (!APPLY) return { ok: true, update, applied: false };

  const { error } = await db
    .from('charity_impact_reports')
    .update(update)
    .eq('id', row.id);
  if (error) {
    console.log(`    ✗ DB update failed: ${error.message}`);
    return { ok: false, reason: 'db_error', error: error.message };
  }
  console.log(`    ✓ updated row ${row.id}`);
  return { ok: true, update, applied: true };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const run = await logStart(db, 'enrich-annual-reports-llm', 'Annual Report LLM Enricher');
  console.log(`=== Annual Report LLM Enricher ===`);
  console.log(`  filter: abn=${ABN_FILTER ?? 'all'} year=${YEAR_FILTER ?? 'all'} min_chars=${MIN_CHARS}`);
  console.log(`  mode: ${APPLY ? 'APPLY (writes to DB)' : 'DRY RUN'} | model: ${MODEL}`);

  let q = db
    .from('charity_impact_reports')
    .select('id, abn, charity_name, report_year, source_url, source_type, extracted_text_chars')
    .gt('extracted_text_chars', MIN_CHARS)
    .order('abn')
    .order('report_year', { ascending: false });
  if (ABN_FILTER) q = q.eq('abn', ABN_FILTER);
  if (YEAR_FILTER) q = q.eq('report_year', YEAR_FILTER);

  const { data: rows, error } = await q;
  if (error) {
    console.error(`  query failed: ${error.message}`);
    await logFailed(db, run.id, error);
    process.exit(1);
  }
  console.log(`  rows to process: ${rows.length}`);

  let updated = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const res = await processRow(row);
      if (res.ok && res.applied) updated++;
      else if (!res.ok) failed++;
    } catch (err) {
      console.log(`    fatal: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  rows: ${rows.length} | updated: ${updated} | failed: ${failed} | dry_run_only: ${APPLY ? 0 : rows.length - failed}`);
  await logComplete(db, run.id, {
    items_found: rows.length,
    items_new: updated,
    status: 'success',
  });
}

main().catch(async err => {
  console.error('Fatal:', err);
  process.exit(1);
});
