#!/usr/bin/env node

/**
 * Targeted foundation enrichment for the Nyinkka/Mukurtu pipeline.
 *
 * Targets the ~126 foundations scoring ≥7 on the fit rubric
 * (indigenous + arts/culture + NT/remote/national + research + capacity)
 * and fills in the two fields that block fundraising strategy:
 *   - board_members  (for warm-intro mapping via mv_board_interlocks)
 *   - notable_grants (for precedent mirroring in pitch customisation)
 *
 * Only touches foundations where the field is NULL/empty — never overwrites.
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-foundations-targeted.mjs [--dry-run] [--limit=200] [--field=board|grants|both]
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import { MINIMAX_CHAT_COMPLETIONS_URL } from './lib/minimax.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '200');
const FIELD = process.argv.find(a => a.startsWith('--field='))?.split('=')[1] || 'both';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function log(msg) { console.log(`[targeted-enrich] ${msg}`); }

const PROVIDERS = [
  { name: 'minimax', baseUrl: MINIMAX_CHAT_COMPLETIONS_URL, model: 'MiniMax-M2.7', envKey: 'MINIMAX_API_KEY' },
  { name: 'groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', envKey: 'GROQ_API_KEY' },
  { name: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY' },
  { name: 'deepseek', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', envKey: 'DEEPSEEK_API_KEY' },
  { name: 'anthropic', baseUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-4-5-20251001', envKey: 'ANTHROPIC_API_KEY', isAnthropic: true },
].map(p => ({ ...p, disabled: !process.env[p.envKey] }));

let providerIdx = 0;
const RATE_LIMIT_MS = 1500;
const SCRAPE_TIMEOUT_MS = 15000;

// Common paths where trustees/grants are published
const CANDIDATE_PATHS = ['', '/about', '/about-us', '/people', '/team', '/trustees', '/board', '/directors', '/governance', '/grants', '/our-grants', '/funded', '/grantees', '/our-giving', '/annual-report'];

async function scrapePage(baseUrl, path) {
  try {
    let url = baseUrl.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    url = url.replace(/\/$/, '') + path;

    const res = await fetch(url, {
      headers: { 'User-Agent': 'GrantScope/1.0 (foundation-enrichment; +https://grantscope.au)', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS),
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return null;

    const html = await res.text();
    const $ = cheerio.load(html);
    $('script, style, nav, footer, iframe, noscript, svg').remove();
    const text = ($('main').text() || $('article').text() || $('body').text()).replace(/\s+/g, ' ').trim();
    return text.length > 100 ? text.slice(0, 6000) : null;
  } catch { return null; }
}

async function scrapeMultiplePages(websiteUrl) {
  if (!websiteUrl) return null;
  const chunks = [];
  const tried = new Set();
  // Try a handful of the highest-yield pages only (keep bandwidth small)
  const priority = ['', '/about', '/people', '/trustees', '/board', '/governance', '/grants', '/our-grants', '/grantees'];
  for (const path of priority) {
    if (tried.has(path)) continue;
    tried.add(path);
    const text = await scrapePage(websiteUrl, path);
    if (text) chunks.push(`=== Page: ${path || '/'} ===\n${text}`);
    if (chunks.join('\n').length > 10000) break;
    await new Promise(r => setTimeout(r, 400));
  }
  return chunks.length ? chunks.join('\n\n').slice(0, 12000) : null;
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
        body = JSON.stringify({ model: p.model, messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 2000 });
      } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
        body = JSON.stringify({ model: p.model, messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: 2000 });
      }

      const res = await fetch(p.baseUrl, { method: 'POST', headers, body, signal: AbortSignal.timeout(60000) });
      if (!res.ok) {
        const err = await res.text();
        if (res.status === 401 || res.status === 429 || res.status === 402 || /invalid api key|unauthorized|rate_limit|quota|insufficient/i.test(err)) {
          log(`${p.name} disabled (${res.status})`);
          p.disabled = true;
          continue;
        }
        log(`${p.name} ${res.status}: ${err.slice(0, 80)}`);
        continue;
      }
      const json = await res.json();
      if (json.base_resp?.status_code && json.base_resp.status_code !== 0) {
        log(`${p.name} API error — disabling`);
        p.disabled = true;
        continue;
      }
      const text = p.isAnthropic ? (json.content?.[0]?.text || '') : (json.choices?.[0]?.message?.content || '');
      providerIdx = (providerIdx + attempt + 1) % PROVIDERS.length;
      return { provider: p.name, text };
    } catch (err) {
      log(`${p.name} error: ${String(err.message || err).slice(0, 80)}`);
      continue;
    }
  }
  throw new Error('All LLM providers exhausted');
}

function extractJson(text) {
  const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const first = stripped.indexOf('{');
  if (first < 0) return null;
  let depth = 0, start = -1, end = -1, inStr = false, esc = false;
  for (let i = first; i < stripped.length; i++) {
    const ch = stripped[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\' && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}') { depth--; if (depth === 0) { end = i + 1; break; } }
  }
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(stripped.slice(start, end).replace(/,\s*}/g, '}').replace(/,\s*]/g, ']'));
  } catch { return null; }
}

async function enrichFoundation(f, needBoard, needGrants) {
  const scraped = await scrapeMultiplePages(f.website);
  if (!scraped) return { scraped: false, data: null };

  const fieldList = [
    needBoard ? '"board_members": ["Full Name (role if known)", ...]  // trustees, directors, board members, committee members. Include role if visible. Empty array if none found.' : null,
    needGrants ? '"notable_grants": ["Recipient Name — $AMOUNT (YEAR) — brief purpose", ...]  // up to 10 specific named grants with recipient + amount + year if visible. Empty array if none found.' : null,
  ].filter(Boolean).join(',\n  ');

  const prompt = `You are extracting verifiable facts from an Australian philanthropic foundation website.

Foundation: ${f.name}
Website: ${f.website}
${f.acnc_abn ? `ABN: ${f.acnc_abn}` : ''}

Scraped content from multiple pages (about, people, trustees, grants):
---
${scraped}
---

Extract ONLY facts explicitly stated in the scraped content. Never invent names or amounts.

Return ONLY a compact JSON object (no markdown, no preamble):
{
  ${fieldList}
}

Rules:
- If a field's info is not present in the content, return an empty array [] — do not guess.
- Full names only (no "Mr." / "Dr."). Strip titles.
- For grants: prefer format "Recipient — $Amount (Year) — purpose". Include only grants you can verify from the text.
- Max 15 board members, max 10 notable grants.
- If the page lists "our team" but not "trustees/board", include only people explicitly identified as board/trustees/directors.`;

  const { text, provider } = await callLLM(prompt);
  const parsed = extractJson(text);
  if (!parsed) {
    log(`${f.name}: no JSON from ${provider}`);
    return { scraped: true, data: null, provider };
  }

  const boardRaw = Array.isArray(parsed.board_members) ? parsed.board_members : [];
  const grantsRaw = Array.isArray(parsed.notable_grants) ? parsed.notable_grants : [];

  // Sanity cap + dedupe
  const board = [...new Set(boardRaw.map(s => String(s).trim()).filter(s => s.length > 2 && s.length < 200))].slice(0, 15);
  const grants = [...new Set(grantsRaw.map(s => String(s).trim()).filter(s => s.length > 5 && s.length < 400))].slice(0, 10);

  return { scraped: true, data: { board_members: board, notable_grants: grants }, provider };
}

async function main() {
  log(`Starting targeted enrichment (limit=${LIMIT}, field=${FIELD}, dry-run=${DRY_RUN})`);

  const run = DRY_RUN ? { id: null } : await logStart(supabase, 'enrich-foundations-targeted', 'Enrich Foundations (Nyinkka Targeted)');

  // Target: fit_score >= 7 AND (missing board OR missing notable_grants) AND has website
  const fitScoreSql = `
    (CASE WHEN thematic_focus::text ILIKE '%indigenous%' OR thematic_focus::text ILIKE '%aboriginal%' THEN 2 ELSE 0 END) +
    (CASE WHEN thematic_focus::text ILIKE '%arts%' OR thematic_focus::text ILIKE '%culture%' THEN 2 ELSE 0 END) +
    (CASE WHEN thematic_focus::text ILIKE '%remote%' OR thematic_focus::text ILIKE '%rural%' THEN 1 ELSE 0 END) +
    (CASE WHEN geographic_focus::text ILIKE '%NT%' OR geographic_focus::text ILIKE '%northern-territory%' THEN 3
          WHEN geographic_focus::text ILIKE '%National%' OR geographic_focus::text ILIKE '%national%' THEN 2
          WHEN geographic_focus::text ILIKE '%remote%' OR geographic_focus::text ILIKE '%regional%' THEN 2
          ELSE 0 END) +
    (CASE WHEN thematic_focus::text ILIKE '%research%' THEN 1 ELSE 0 END) +
    (CASE WHEN total_giving_annual >= 10000000 THEN 3
          WHEN total_giving_annual >= 1000000 THEN 2
          WHEN total_giving_annual >= 100000 THEN 1
          ELSE 0 END)`;

  // Use RPC if available; else fall back to fetching candidates and scoring client-side.
  // For simplicity here, do a broad fetch and filter in-memory.
  const { data: candidates, error } = await supabase
    .from('foundations')
    .select('id, name, website, acnc_abn, total_giving_annual, thematic_focus, geographic_focus, board_members, notable_grants')
    .not('website', 'is', null)
    .neq('website', '')
    .order('total_giving_annual', { ascending: false, nullsFirst: false })
    .limit(2000);

  if (error) {
    log(`DB error: ${error.message}`);
    if (run.id) await logFailed(supabase, run.id, error.message);
    process.exit(1);
  }

  const scoreOf = (f) => {
    const th = (f.thematic_focus || []).join(',').toLowerCase();
    const gf = (f.geographic_focus || []).join(',').toLowerCase();
    const g = Number(f.total_giving_annual || 0);
    return (
      (/indigenous|aboriginal/.test(th) ? 2 : 0) +
      (/arts|culture/.test(th) ? 2 : 0) +
      (/remote|rural/.test(th) ? 1 : 0) +
      (/nt\b|northern-territory/.test(gf) ? 3 : /national/.test(gf) ? 2 : /remote|regional/.test(gf) ? 2 : 0) +
      (/research/.test(th) ? 1 : 0) +
      (g >= 10_000_000 ? 3 : g >= 1_000_000 ? 2 : g >= 100_000 ? 1 : 0)
    );
  };

  const targets = candidates
    .map(f => ({ ...f, fit: scoreOf(f) }))
    .filter(f => {
      if (f.fit < 7) return false;
      const needBoard = !f.board_members || f.board_members.length === 0;
      const needGrants = !f.notable_grants || f.notable_grants.length === 0;
      if (FIELD === 'board') return needBoard;
      if (FIELD === 'grants') return needGrants;
      return needBoard || needGrants;
    })
    .sort((a, b) => b.fit - a.fit || Number(b.total_giving_annual || 0) - Number(a.total_giving_annual || 0))
    .slice(0, LIMIT);

  log(`Found ${targets.length} foundations in scope (fit≥7, has website, missing ${FIELD})`);

  if (DRY_RUN) {
    log('DRY RUN — first 20:');
    for (const f of targets.slice(0, 20)) {
      const need = [];
      if (!f.board_members || f.board_members.length === 0) need.push('board');
      if (!f.notable_grants || f.notable_grants.length === 0) need.push('grants');
      log(`  fit=${f.fit} | ${f.name} | ${f.website} | needs: ${need.join(',')}`);
    }
    return;
  }

  let boardAdded = 0, grantsAdded = 0, scraped = 0, errors = 0;
  const providerCounts = {};

  for (let i = 0; i < targets.length; i++) {
    const f = targets[i];
    const needBoard = (FIELD === 'board' || FIELD === 'both') && (!f.board_members || f.board_members.length === 0);
    const needGrants = (FIELD === 'grants' || FIELD === 'both') && (!f.notable_grants || f.notable_grants.length === 0);
    if (!needBoard && !needGrants) continue;

    try {
      const { scraped: wasScraped, data, provider } = await enrichFoundation(f, needBoard, needGrants);
      if (wasScraped) scraped++;
      if (provider) providerCounts[provider] = (providerCounts[provider] || 0) + 1;

      if (data) {
        const update = {};
        if (needBoard && data.board_members?.length) { update.board_members = data.board_members; boardAdded++; }
        if (needGrants && data.notable_grants?.length) { update.notable_grants = data.notable_grants; grantsAdded++; }

        if (Object.keys(update).length > 0) {
          update.enriched_at = new Date().toISOString();
          update.enrichment_source = 'targeted-scrape+llm';
          const { error: upErr } = await supabase.from('foundations').update(update).eq('id', f.id);
          if (upErr) { log(`update failed for ${f.name}: ${upErr.message}`); errors++; }
        }
      }

      if ((i + 1) % 10 === 0 || i === targets.length - 1) {
        log(`Progress ${i + 1}/${targets.length} — board+=${boardAdded}, grants+=${grantsAdded}, scraped=${scraped}, errors=${errors}`);
        log(`  Providers: ${Object.entries(providerCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }

      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    } catch (err) {
      errors++;
      log(`Error on ${f.name}: ${err.message}`);
      if (err.message === 'All LLM providers exhausted') { log('All providers exhausted — stopping'); break; }
    }
  }

  log(`\nComplete — boardAdded=${boardAdded}, grantsAdded=${grantsAdded}, scraped=${scraped}, errors=${errors}`);
  log(`Providers: ${Object.entries(providerCounts).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  if (run.id) {
    await logComplete(supabase, run.id, {
      items_found: targets.length,
      items_new: boardAdded + grantsAdded,
      items_updated: boardAdded + grantsAdded,
      status: errors > 0 ? 'partial' : 'success',
      errors: errors > 0 ? [`${errors} enrichment errors`] : [],
    });
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
