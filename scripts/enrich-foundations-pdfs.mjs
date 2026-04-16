#!/usr/bin/env node

/**
 * PDF-aware enrichment for foundations still missing notable_grants and/or board_members.
 *
 * Finds annual report PDF links on foundation websites, downloads them (capped),
 * extracts text with pdftotext, and feeds to LLM for structured extraction.
 *
 * Targets only foundations from the Nyinkka/Mukurtu fit≥7 priority list that
 * still have gaps after the HTML scrape + person_roles/gs_relationships backfill.
 *
 * Usage: node --env-file=.env scripts/enrich-foundations-pdfs.mjs [--dry-run] [--limit=30]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { execFileSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { MINIMAX_CHAT_COMPLETIONS_URL } from './lib/minimax.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '30');

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const log = (m) => console.log(`[pdf-enrich] ${m}`);

const PROVIDERS = [
  { name: 'minimax', baseUrl: MINIMAX_CHAT_COMPLETIONS_URL, model: 'MiniMax-M2.7', envKey: 'MINIMAX_API_KEY' },
  { name: 'groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', envKey: 'GROQ_API_KEY' },
  { name: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY' },
  { name: 'anthropic', baseUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-4-5-20251001', envKey: 'ANTHROPIC_API_KEY', isAnthropic: true },
].map(p => ({ ...p, disabled: !process.env[p.envKey] }));

let providerIdx = 0;
const MAX_PDF_BYTES = 25 * 1024 * 1024;

async function fetchText(url, timeoutMs = 15000) {
  try {
    let u = url.trim();
    if (!u.startsWith('http')) u = 'https://' + u;
    const res = await fetch(u, {
      headers: { 'User-Agent': 'GrantScope/1.0 (foundation-enrichment; +https://grantscope.au)' },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    if (!res.ok) return { html: null, finalUrl: u };
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return { html: null, finalUrl: res.url || u };
    const html = await res.text();
    return { html, finalUrl: res.url || u };
  } catch { return { html: null, finalUrl: url }; }
}

function resolveUrl(base, href) {
  try { return new URL(href, base).href; } catch { return null; }
}

async function findPdfLinks(websiteUrl) {
  const paths = ['', '/annual-report', '/annual-reports', '/reports', '/publications', '/our-grants', '/grants', '/impact', '/annual', '/resources', '/about'];
  const pdfs = new Set();
  const candidateTexts = new Map(); // pdf url -> anchor text

  for (const path of paths) {
    const url = websiteUrl.replace(/\/$/, '') + path;
    const { html, finalUrl } = await fetchText(url, 12000);
    if (!html) continue;
    const $ = cheerio.load(html);
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const text = ($(el).text() || '').trim();
      if (!href) return;
      const absolute = resolveUrl(finalUrl, href);
      if (!absolute) return;
      if (/\.pdf(\?|$)/i.test(absolute)) {
        pdfs.add(absolute);
        if (!candidateTexts.has(absolute)) candidateTexts.set(absolute, text);
      }
    });
    await new Promise(r => setTimeout(r, 300));
    if (pdfs.size >= 10) break;
  }

  // Prioritise by likely relevance
  const scored = [...pdfs].map(u => {
    const txt = (candidateTexts.get(u) || '').toLowerCase();
    const full = (u + ' ' + txt).toLowerCase();
    let score = 0;
    if (/annual.?report|report.?20|impact.?report|grant/i.test(full)) score += 5;
    if (/20(23|24|25)/.test(full)) score += 3;
    if (/202[012]/.test(full)) score += 1;
    if (/audit|policy|tax|constitution|privacy/i.test(full)) score -= 4;
    return { url: u, score };
  }).sort((a, b) => b.score - a.score);

  return scored.slice(0, 2).map(x => x.url);
}

async function downloadAndExtract(pdfUrl) {
  try {
    const res = await fetch(pdfUrl, {
      headers: { 'User-Agent': 'GrantScope/1.0 (foundation-enrichment)' },
      signal: AbortSignal.timeout(30000),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const len = parseInt(res.headers.get('content-length') || '0');
    if (len > MAX_PDF_BYTES) { log(`  too large: ${pdfUrl} (${len})`); return null; }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_PDF_BYTES) return null;

    const tmpPath = join(tmpdir(), `fenrich-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    writeFileSync(tmpPath, buf);
    try {
      const txt = execFileSync('pdftotext', ['-layout', '-q', tmpPath, '-'], {
        encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, timeout: 30000,
      });
      return txt.slice(0, 40000);
    } finally {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    }
  } catch (err) {
    log(`  extract failed: ${String(err.message || err).slice(0, 80)}`);
    return null;
  }
}

async function callLLM(prompt) {
  for (let attempt = 0; attempt < PROVIDERS.length; attempt++) {
    const p = PROVIDERS[(providerIdx + attempt) % PROVIDERS.length];
    if (p.disabled) continue;
    const apiKey = process.env[p.envKey];
    if (!apiKey) continue;
    try {
      const headers = { 'Content-Type': 'application/json' };
      let body;
      if (p.isAnthropic) {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
        body = JSON.stringify({ model: p.model, messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 2500 });
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = JSON.stringify({ model: p.model, messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 2500 });
      }
      const res = await fetch(p.baseUrl, { method: 'POST', headers, body, signal: AbortSignal.timeout(90000) });
      if (!res.ok) {
        const err = await res.text();
        if (res.status === 401 || res.status === 429 || res.status === 402 || /invalid|unauthorized|rate_limit|quota|insufficient/i.test(err)) {
          p.disabled = true; continue;
        }
        continue;
      }
      const json = await res.json();
      if (json.base_resp?.status_code && json.base_resp.status_code !== 0) { p.disabled = true; continue; }
      const text = p.isAnthropic ? (json.content?.[0]?.text || '') : (json.choices?.[0]?.message?.content || '');
      providerIdx = (providerIdx + attempt + 1) % PROVIDERS.length;
      return { provider: p.name, text };
    } catch { continue; }
  }
  throw new Error('All LLM providers exhausted');
}

function extractJson(text) {
  const s = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const first = s.indexOf('{');
  if (first < 0) return null;
  let depth = 0, start = -1, end = -1, inStr = false, esc = false;
  for (let i = first; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(s.slice(start, end).replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')); } catch { return null; }
}

async function main() {
  log(`Starting PDF enrichment (limit=${LIMIT}, dry-run=${DRY_RUN})`);
  const run = DRY_RUN ? { id: null } : await logStart(supabase, 'enrich-foundations-pdfs', 'Enrich Foundations PDFs');

  const { data: all } = await supabase
    .from('foundations')
    .select('id, name, website, total_giving_annual, thematic_focus, geographic_focus, board_members, notable_grants')
    .not('website', 'is', null).neq('website', '')
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(3000);

  const scoreOf = (f) => {
    const th = (f.thematic_focus || []).join(',').toLowerCase();
    const gf = (f.geographic_focus || []).join(',').toLowerCase();
    const g = Number(f.total_giving_annual || 0);
    return (/indigenous|aboriginal/.test(th) ? 2 : 0) +
      (/arts|culture/.test(th) ? 2 : 0) +
      (/remote|rural/.test(th) ? 1 : 0) +
      (/nt\b|northern-territory/.test(gf) ? 3 : /national/.test(gf) ? 2 : /remote|regional/.test(gf) ? 2 : 0) +
      (/research/.test(th) ? 1 : 0) +
      (g >= 10_000_000 ? 3 : g >= 1_000_000 ? 2 : g >= 100_000 ? 1 : 0);
  };

  const targets = all
    .map(f => ({ ...f, fit: scoreOf(f) }))
    .filter(f => f.fit >= 7)
    .filter(f => {
      const needBoard = !f.board_members || f.board_members.length === 0;
      const needGrants = !f.notable_grants || f.notable_grants.length === 0;
      return needBoard || needGrants;
    })
    .sort((a, b) => b.fit - a.fit || Number(b.total_giving_annual || 0) - Number(a.total_giving_annual || 0))
    .slice(0, LIMIT);

  log(`${targets.length} foundations in scope`);
  if (DRY_RUN) {
    for (const f of targets) {
      const need = [];
      if (!f.board_members || f.board_members.length === 0) need.push('board');
      if (!f.notable_grants || f.notable_grants.length === 0) need.push('grants');
      log(`  fit=${f.fit} ${f.name} | ${f.website} | needs: ${need.join(',')}`);
    }
    return;
  }

  let pdfsFound = 0, pdfsExtracted = 0, boardAdded = 0, grantsAdded = 0, noPdf = 0;

  for (let i = 0; i < targets.length; i++) {
    const f = targets[i];
    const needBoard = !f.board_members || f.board_members.length === 0;
    const needGrants = !f.notable_grants || f.notable_grants.length === 0;
    log(`[${i + 1}/${targets.length}] ${f.name}`);

    try {
      const pdfUrls = await findPdfLinks(f.website);
      if (!pdfUrls.length) { log(`  no PDFs found`); noPdf++; continue; }
      pdfsFound += pdfUrls.length;
      log(`  ${pdfUrls.length} PDFs: ${pdfUrls.map(u => u.split('/').pop().slice(0, 40)).join(', ')}`);

      const chunks = [];
      for (const url of pdfUrls) {
        const txt = await downloadAndExtract(url);
        if (txt) { pdfsExtracted++; chunks.push(`=== ${url} ===\n${txt.slice(0, 20000)}`); }
        await new Promise(r => setTimeout(r, 500));
      }
      if (!chunks.length) { log(`  no text from PDFs`); continue; }

      const fields = [
        needBoard ? '"board_members": ["Full Name (role if known)", ...] — directors/trustees/board members only. Empty array if not in text.' : null,
        needGrants ? '"notable_grants": ["Recipient — $AMOUNT (YEAR) — brief purpose", ...] — specific named grants with amount if visible. Max 10.' : null,
      ].filter(Boolean).join(',\n  ');

      const prompt = `Extract verifiable facts from this Australian foundation's annual report(s).

Foundation: ${f.name}

Content:
${chunks.join('\n\n').slice(0, 30000)}

Return ONLY compact JSON (no markdown):
{
  ${fields}
}

Rules:
- Only facts explicitly stated. Empty array if not found.
- Strip titles (Mr./Dr./etc). Full names only.
- Grants: prefer "Recipient — $Amount (Year) — purpose".
- Max 15 board, max 10 grants.`;

      const { text, provider } = await callLLM(prompt);
      const parsed = extractJson(text);
      if (!parsed) { log(`  no JSON from ${provider}`); continue; }

      const board = needBoard && Array.isArray(parsed.board_members)
        ? [...new Set(parsed.board_members.map(s => String(s).trim()).filter(s => s.length > 2 && s.length < 200))].slice(0, 15)
        : [];
      const grants = needGrants && Array.isArray(parsed.notable_grants)
        ? [...new Set(parsed.notable_grants.map(s => String(s).trim()).filter(s => s.length > 5 && s.length < 400))].slice(0, 10)
        : [];

      const update = {};
      if (board.length) { update.board_members = board; boardAdded++; }
      if (grants.length) { update.notable_grants = grants; grantsAdded++; }

      if (Object.keys(update).length > 0) {
        update.enriched_at = new Date().toISOString();
        update.enrichment_source = 'pdf-scrape+llm';
        await supabase.from('foundations').update(update).eq('id', f.id);
        log(`  + board=${board.length}, grants=${grants.length} (via ${provider})`);
      } else {
        log(`  nothing extractable from PDFs`);
      }

      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      log(`  error: ${String(err.message || err).slice(0, 120)}`);
      if (err.message === 'All LLM providers exhausted') break;
    }
  }

  log(`\nComplete — boardAdded=${boardAdded}, grantsAdded=${grantsAdded}, pdfsExtracted=${pdfsExtracted}/${pdfsFound}, noPdf=${noPdf}`);
  if (run.id) {
    await logComplete(supabase, run.id, {
      items_found: targets.length, items_new: boardAdded + grantsAdded,
      items_updated: boardAdded + grantsAdded,
      status: 'success', errors: [],
    });
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
