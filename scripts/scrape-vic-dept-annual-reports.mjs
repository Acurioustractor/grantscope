#!/usr/bin/env node
/**
 * Scrape Victorian government department annual reports and extract
 * "Grants and Sponsorships" tables into vic_grants_awarded.
 *
 * Pipeline:
 *   1. Discovery — Firecrawl /map on the dept's annual-reports landing page
 *      (or use --pdf-url to bypass)
 *   2. Fetch — Firecrawl /scrape returns the PDF as markdown (preserves tables)
 *   3. Cache — data/vic-annual-reports/{dept}-{year}.md
 *   4. Section locate — regex for grants-section anchors
 *   5. Chunk + LLM extract — Claude Haiku w/ tool use returns structured rows
 *   6. Insert — bulk upsert into vic_grants_awarded
 *
 * Usage:
 *   node --env-file=.env scripts/scrape-vic-dept-annual-reports.mjs --dept=dffh
 *   node --env-file=.env scripts/scrape-vic-dept-annual-reports.mjs --dept=dpc --year=2023-24
 *   node --env-file=.env scripts/scrape-vic-dept-annual-reports.mjs --pdf-url=<url> --dept=dffh --year=2023-24
 *   node --env-file=.env scripts/scrape-vic-dept-annual-reports.mjs --dept=dffh --dry-run
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
if (!ANTHROPIC_KEY && !process.env.MINIMAX_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY (or MINIMAX_API_KEY for fallback)');
  process.exit(1);
}
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const arg = name => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1] || null;
const flag = name => process.argv.includes(`--${name}`);

const DEPT = arg('dept');
const YEAR = arg('year');
const PDF_URL = arg('pdf-url');
const DRY_RUN = flag('dry-run');
const APPLY = !DRY_RUN;
const MAX_CHUNKS = Number(arg('max-chunks') || 40);
const MODEL = arg('model') || 'claude-haiku-4-5-20251001';

if (!DEPT) {
  console.error('Usage: --dept=<dpc|dffh|djcs|djsir> [--year=2023-24] [--pdf-url=<url>] [--dry-run]');
  process.exit(1);
}

// Department configs — landing pages where annual reports are published
const DEPT_CONFIG = {
  dpc:   { name: 'Department of Premier and Cabinet',          home: 'https://www.dpc.vic.gov.au/about-us', source: 'dpc' },
  dffh:  { name: 'Department of Families, Fairness and Housing', home: 'https://www.dffh.vic.gov.au/publications', source: 'dffh' },
  djcs:  { name: 'Department of Justice and Community Safety', home: 'https://www.justice.vic.gov.au/about-the-department/publications-manuals-and-statistical-reports', source: 'djcs' },
  djsir: { name: 'Department of Jobs, Skills, Industry and Regions', home: 'https://djsir.vic.gov.au/about-us', source: 'djsir' },
};
const cfg = DEPT_CONFIG[DEPT];
if (!cfg) { console.error(`unknown dept: ${DEPT}`); process.exit(1); }

const CACHE_DIR = 'data/vic-annual-reports';
mkdirSync(CACHE_DIR, { recursive: true });

// ── Firecrawl helpers ──────────────────────────────────────────────────────
async function firecrawlMap(url) {
  const res = await fetch('https://api.firecrawl.dev/v1/map', {
    method: 'POST',
    headers: { Authorization: `Bearer ${FIRECRAWL_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, limit: 500 }),
  });
  if (!res.ok) throw new Error(`Firecrawl map ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return (j.links || []).map(l => (typeof l === 'string' ? l : l?.url)).filter(Boolean);
}

async function firecrawlScrape(url) {
  console.log(`  fetching ${url}`);
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
  if (!res.ok) throw new Error(`Firecrawl scrape ${res.status}: ${await res.text()}`);
  const j = await res.json();
  return j?.data?.markdown || j?.markdown || '';
}

// ── PDF discovery ──────────────────────────────────────────────────────────
function looksLikeAnnualReport(url) {
  const u = url.toLowerCase();
  if (!u.endsWith('.pdf')) return false;
  return /annual[-_\s]?report/i.test(u) || /(20\d{2}[-_]\d{2}|fy\d{2})/i.test(u);
}

async function discoverAnnualReportPdfs() {
  console.log(`  discovering annual reports on ${cfg.home}`);
  const urls = await firecrawlMap(cfg.home);
  console.log(`  mapped ${urls.length} urls`);
  const candidates = urls.filter(looksLikeAnnualReport);
  console.log(`  annual-report PDF candidates: ${candidates.length}`);
  candidates.forEach(u => console.log(`    · ${u}`));
  // Prefer most-recent year tag
  candidates.sort((a, b) => {
    const ay = (a.match(/20(\d{2})/g) || ['0']).slice(-1)[0];
    const by = (b.match(/20(\d{2})/g) || ['0']).slice(-1)[0];
    return Number(by) - Number(ay);
  });
  return candidates;
}

// ── Year extraction ────────────────────────────────────────────────────────
function inferYearFromUrl(url) {
  const m = url.match(/(20\d{2})[-_/](?:20)?(\d{2})/);
  if (m) return `${m[1]}-${m[2].slice(-2)}`;
  const single = url.match(/(20\d{2})/g);
  if (single) {
    const y = Number(single[single.length - 1]);
    return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
  }
  return null;
}

// ── Section locate ─────────────────────────────────────────────────────────
// Anchor patterns that signal the start of an actual grants-paid section.
// Match "Appendix N: Grants ...", "Grants and sponsorships", "Grants paid in YYYY", etc.
// PDF→markdown often loses heading levels, so don't require leading '#'.
const GRANTS_ANCHOR_RE = /^(?:#{0,6}\s*)?(?:Appendix\s+\w+:\s*)?(?:Grants?\s+(?:and|&)\s+(?:transfer\s+payments?|sponsorships?|donations?)|Grants?\s+paid(?:\s+in\s+\d{4})?|Output\s+(?:of\s+)?grants|Disclosure\s+of\s+grants(?:\s+and\s+transfer\s+payments?)?|Schedule\s+of\s+grants|Community\s+grants\s+paid)\b/im;

// Lines that mark the END of a grants section (other major appendices/sections)
const SECTION_END_RE = /^(?:#{0,6}\s*)?(?:Appendix\s+\w+:|Section\s+\d+:|Disclosure\s+index|Glossary|Compliance\s+with\s+the|Output\s+performance\s+measures|Index)\b/im;

function locateGrantsSections(md) {
  const lines = md.split('\n');
  const anchors = [];
  for (let i = 0; i < lines.length; i++) {
    if (GRANTS_ANCHOR_RE.test(lines[i])) anchors.push(i);
  }
  if (anchors.length === 0) return [];

  // Filter out anchors that are inside a TOC (no table content within next 200 lines)
  const real = anchors.filter(start => {
    const lookAhead = lines.slice(start + 1, start + 400).join('\n');
    return /\|.*\|.*\|/.test(lookAhead) || /\$\s*[\d,]{4,}/.test(lookAhead);
  });
  if (real.length === 0) return [];

  // Use the last real anchor (the actual appendix is at the end of the doc)
  const sections = [];
  for (let idx = 0; idx < real.length; idx++) {
    const start = real[idx];
    let end = lines.length;
    for (let j = start + 5; j < lines.length; j++) {
      if (SECTION_END_RE.test(lines[j]) && !GRANTS_ANCHOR_RE.test(lines[j])) {
        end = j;
        break;
      }
    }
    sections.push({ start, end, text: lines.slice(start, end).join('\n') });
  }
  return sections;
}

// ── Chunking ───────────────────────────────────────────────────────────────
function chunkText(text, maxChars = 12000) {
  // Split on blank lines, accumulate chunks ≤ maxChars
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

// ── LLM extraction (Anthropic with tool use for structured output) ─────────
const EXTRACTION_TOOL = {
  name: 'record_grants',
  description: 'Record awarded government grants extracted from the document section.',
  input_schema: {
    type: 'object',
    properties: {
      grants: {
        type: 'array',
        description: 'List of grant rows extracted. Empty list if section is not a grants table.',
        items: {
          type: 'object',
          properties: {
            recipient_name: { type: 'string', description: 'Recipient organisation name (cleaned, no totals/subtotals)' },
            program_name: { type: 'string', description: 'Grant program / funding stream name. Empty string if unknown.' },
            amount_aud: { type: 'number', description: 'Grant amount in AUD. Use 0 if unknown.' },
            recipient_abn: { type: 'string', description: '11-digit ABN if printed; empty string otherwise.' },
            region: { type: 'string', description: 'LGA / region / suburb if listed; empty string otherwise.' },
          },
          required: ['recipient_name', 'amount_aud'],
        },
      },
    },
    required: ['grants'],
  },
};

const SYSTEM_PROMPT = `You extract structured grant-recipient data from Victorian government department annual reports.

Input is a chunk of markdown that may contain a "Grants and Sponsorships" / "Grants Paid" / "Output Activity" table.

For each row in the table, return an object: { recipient_name, program_name, amount_aud, recipient_abn, region }.

Rules:
- Skip rows labelled "Total", "Subtotal", "Other", or "Less than $X" aggregates.
- Skip program/section headings — only return actual recipient rows.
- Strip any numbering, footnote markers, asterisks from names.
- Normalize amount to a plain number (e.g. "$123,456.78" → 123456.78).
- If the chunk has no grants table, return an empty array.
- Be exact — do not invent recipients. If a row's recipient or amount is ambiguous, skip it.`;

const MINIMAX_SYSTEM = `${SYSTEM_PROMPT}

Return ONLY valid JSON, no prose, no markdown code fences. Schema:
{"grants": [{"recipient_name": string, "program_name": string, "amount_aud": number, "recipient_abn": string, "region": string}]}
Use empty string for missing program_name/recipient_abn/region. Use empty array if no grants found.`;

async function extractGrantsViaAnthropic(chunk, programContext = '') {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      tools: [EXTRACTION_TOOL],
      tool_choice: { type: 'tool', name: 'record_grants' },
      messages: [
        { role: 'user', content: `Extract grants from this section. Department context: ${cfg.name}.\n\n${programContext ? `Section heading context: ${programContext}\n\n` : ''}<chunk>\n${chunk}\n</chunk>` },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    const err = new Error(`Anthropic ${res.status}: ${body.slice(0, 300)}`);
    err.status = res.status;
    err.creditExhausted = res.status === 400 && /credit balance/i.test(body);
    throw err;
  }
  const data = await res.json();
  const toolUse = data.content?.find(c => c.type === 'tool_use');
  if (!toolUse) {
    console.log(`      no tool_use in response (stop=${data.stop_reason}, content_types=${(data.content || []).map(c => c.type).join(',')})`);
    return [];
  }
  if (data.stop_reason === 'max_tokens') {
    console.log(`      ⚠ truncated at max_tokens — partial grants array`);
  }
  return toolUse.input?.grants || [];
}

async function extractGrantsViaMiniMax(chunk, programContext = '') {
  const { callMiniMaxJSON } = await import('./lib/minimax.mjs');
  const userPrompt = `Extract grants from this Victorian government department annual report section. Department: ${cfg.name}.${programContext ? `\nSection heading context: ${programContext}` : ''}\n\n<chunk>\n${chunk}\n</chunk>`;
  try {
    const { json } = await callMiniMaxJSON({ system: MINIMAX_SYSTEM, user: userPrompt, max_tokens: 12000 });
    const grants = Array.isArray(json) ? json : (json.grants || []);
    return grants.map(g => ({
      recipient_name: g.recipient_name || '',
      program_name: g.program_name || '',
      amount_aud: typeof g.amount_aud === 'number' ? g.amount_aud : Number(g.amount_aud) || 0,
      recipient_abn: g.recipient_abn || '',
      region: g.region || '',
    }));
  } catch (err) {
    console.log(`      MiniMax error: ${err.message.slice(0, 200)}`);
    return [];
  }
}

const PROVIDER = process.env.LLM_PROVIDER || 'auto'; // 'auto' | 'anthropic' | 'minimax'
let anthropicDead = false;

async function extractGrantsFromChunk(chunk, programContext = '') {
  if (PROVIDER === 'minimax' || anthropicDead) {
    return extractGrantsViaMiniMax(chunk, programContext);
  }
  if (PROVIDER === 'anthropic') {
    return extractGrantsViaAnthropic(chunk, programContext);
  }
  // auto: try Anthropic, fall back to MiniMax on credit exhaustion
  try {
    return await extractGrantsViaAnthropic(chunk, programContext);
  } catch (err) {
    if (err.creditExhausted) {
      console.log(`      ⚠ Anthropic credit exhausted — falling back to MiniMax for remainder of run`);
      anthropicDead = true;
      return extractGrantsViaMiniMax(chunk, programContext);
    }
    throw err;
  }
}

// ── Main pipeline ──────────────────────────────────────────────────────────
async function processPdf(pdfUrl, year) {
  const yearStr = year || inferYearFromUrl(pdfUrl) || 'unknown';
  const cachePath = join(CACHE_DIR, `${DEPT}-${yearStr}.md`);

  let md;
  if (existsSync(cachePath)) {
    md = readFileSync(cachePath, 'utf-8');
    console.log(`  cache hit: ${cachePath} (${md.length} chars)`);
  } else {
    md = await firecrawlScrape(pdfUrl);
    if (!md || md.length < 1000) {
      console.log(`  scrape too short (${md?.length ?? 0} chars) — skipping`);
      return { url: pdfUrl, year: yearStr, sections: 0, grants: 0, inserted: 0 };
    }
    writeFileSync(cachePath, md, 'utf-8');
    console.log(`  cached → ${cachePath} (${md.length} chars)`);
  }

  // Locate grant sections
  const sections = locateGrantsSections(md);
  console.log(`  grants sections found: ${sections.length}`);
  if (sections.length === 0) {
    // Fallback: scan whole doc but only chunks containing keywords
    const allChunks = chunkText(md, 12000);
    const grantsChunks = allChunks.filter(c => /grants?\s+(?:and|&)\s+sponsorship|grants?\s+paid|output\s+grants|grants?\s+register|recipient\s+name/i.test(c));
    if (grantsChunks.length === 0) {
      console.log(`  no grants-content chunks — skipping`);
      return { url: pdfUrl, year: yearStr, sections: 0, grants: 0, inserted: 0 };
    }
    console.log(`  fallback: ${grantsChunks.length} keyword-matched chunks`);
    sections.push({ start: 0, end: 0, text: grantsChunks.join('\n\n---\n\n') });
  }

  const allGrants = [];
  for (const sec of sections) {
    const chunks = chunkText(sec.text, 6000);
    console.log(`  section spanning ~${sec.text.length} chars → ${chunks.length} chunks`);
    let chunksProcessed = 0;
    for (const chunk of chunks) {
      if (chunksProcessed >= MAX_CHUNKS) break;
      try {
        const rows = await extractGrantsFromChunk(chunk);
        if (rows.length === 0) {
          console.log(`    chunk ${chunksProcessed + 1}: 0 grants (chars=${chunk.length}, head="${chunk.slice(0, 80).replace(/\n/g, ' ')}...")`);
        }
        if (rows.length) {
          console.log(`    chunk ${chunksProcessed + 1}: ${rows.length} grants`);
          for (const r of rows) {
            const cleanName = (r.recipient_name || '').trim();
            const amt = Number(r.amount_aud) || 0;
            if (!cleanName || cleanName.length < 3 || amt <= 0) continue;
            if (/^(total|subtotal|other|various)/i.test(cleanName)) continue;
            allGrants.push({
              source: cfg.source,
              agency: cfg.name,
              program_name: (r.program_name || '').trim().slice(0, 200) || null,
              recipient_name: cleanName.slice(0, 300),
              recipient_abn: /^\d{11}$/.test((r.recipient_abn || '').replace(/\s/g, ''))
                ? r.recipient_abn.replace(/\s/g, '') : null,
              amount_aud: amt,
              financial_year: yearStr,
              region: (r.region || '').trim().slice(0, 100) || null,
              source_url: pdfUrl,
              raw: { extracted_via: MODEL, dept: DEPT, year: yearStr },
            });
          }
        }
      } catch (err) {
        console.log(`    chunk ${chunksProcessed + 1} extraction error: ${err.message}`);
      }
      chunksProcessed++;
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log(`  total grants extracted: ${allGrants.length}`);

  if (DRY_RUN || !allGrants.length) {
    return { url: pdfUrl, year: yearStr, sections: sections.length, grants: allGrants.length, inserted: 0, sample: allGrants.slice(0, 5) };
  }

  // Bulk upsert
  const BATCH = 200;
  let inserted = 0;
  for (let i = 0; i < allGrants.length; i += BATCH) {
    const batch = allGrants.slice(i, i + BATCH);
    const { error } = await db.from('vic_grants_awarded').upsert(batch, {
      onConflict: 'source,recipient_name,program_name,financial_year,amount_aud',
      ignoreDuplicates: true,
    });
    if (error) {
      console.log(`    batch ${Math.floor(i / BATCH) + 1} error: ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }
  console.log(`  inserted: ${inserted}`);

  // ABN linking
  if (inserted > 0) {
    const { error: linkErr } = await db.rpc('exec_sql', {
      query: `UPDATE vic_grants_awarded vga
              SET gs_entity_id = ge.id
              FROM gs_entities ge
              WHERE ge.abn = vga.recipient_abn
                AND vga.gs_entity_id IS NULL
                AND vga.recipient_abn IS NOT NULL
                AND vga.source = '${cfg.source}'`,
    });
    if (linkErr) console.log(`    ABN link error: ${linkErr.message}`);
  }

  return { url: pdfUrl, year: yearStr, sections: sections.length, grants: allGrants.length, inserted };
}

async function main() {
  const run = await logStart(db, 'scrape-vic-dept-annual-reports', `VIC Dept Annual Report Scraper (${DEPT})`);
  console.log(`=== VIC Dept Annual Report Scraper ===`);
  console.log(`  dept: ${cfg.name} | year: ${YEAR ?? 'discover'} | mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'} | model: ${MODEL}`);

  let pdfUrls;
  if (PDF_URL) {
    pdfUrls = [PDF_URL];
  } else {
    pdfUrls = await discoverAnnualReportPdfs();
    if (YEAR) pdfUrls = pdfUrls.filter(u => u.includes(YEAR));
    pdfUrls = pdfUrls.slice(0, 1); // Default: most recent only
  }
  if (!pdfUrls.length) {
    console.log(`  no PDFs found — pass --pdf-url to override`);
    await logComplete(db, run.id, { items_found: 0, items_new: 0, status: 'success' });
    return;
  }

  let totalSections = 0;
  let totalGrants = 0;
  let totalInserted = 0;
  for (const url of pdfUrls) {
    try {
      const r = await processPdf(url, YEAR);
      totalSections += r.sections;
      totalGrants += r.grants;
      totalInserted += r.inserted;
      if (DRY_RUN && r.sample?.length) {
        console.log(`  sample:`);
        r.sample.forEach(g => console.log(`    · ${g.recipient_name} | ${g.program_name ?? '?'} | $${g.amount_aud}`));
      }
    } catch (err) {
      console.error(`  fatal: ${err.message}`);
    }
  }

  console.log(`\n=== Summary ===`);
  console.log(`  PDFs: ${pdfUrls.length} | sections: ${totalSections} | grants: ${totalGrants} | inserted: ${totalInserted}`);
  await logComplete(db, run.id, {
    items_found: totalGrants,
    items_new: totalInserted,
    status: 'success',
  });
}

main().catch(async err => {
  console.error('Fatal:', err);
  process.exit(1);
});
