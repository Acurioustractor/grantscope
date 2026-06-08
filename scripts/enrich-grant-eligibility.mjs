#!/usr/bin/env node
/**
 * enrich-grant-eligibility.mjs — fetch each open grant's source page and use an
 * LLM to extract structured eligibility flags, so SE↔grant matching can route
 * by entity type (the Goods twin-engine: DGR-required → Butterfly charity,
 * the rest → Goods on Country Pty Ltd).
 *
 * WHY: the grant_opportunities rows are short scraped stubs — only ~2/385 open
 * rows even mention DGR in the stored text. The eligibility lives on the source
 * page (`url`). Headless Chrome clears the gov/Cloudflare walls; an LLM reads
 * the page and fills dgr_required + accepts_{charity,pty_ltd,sole_trader,
 * unincorporated}. Verdicts cache to JSONL so quota-exhausted runs resume.
 *
 * Writes (only with --apply): dgr_required, accepts_charity, accepts_pty_ltd,
 * accepts_sole_trader, accepts_unincorporated, eligibility_signals_at.
 * NULL = page didn't state it (honest unknown, never forced false).
 *
 * Usage:
 *   node --env-file=.env scripts/enrich-grant-eligibility.mjs --limit=10            # dry run
 *   node --env-file=.env scripts/enrich-grant-eligibility.mjs --limit=400 --apply
 *   node --env-file=.env scripts/enrich-grant-eligibility.mjs --id=<uuid> --apply
 */

import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import fs from 'node:fs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const APPLY = process.argv.includes('--apply');
const LIMIT = parseInt(arg('limit', '10'), 10);
const ONLY_ID = arg('id', null);
const SOURCE = arg('source', null);
const CACHE_PATH = 'data/grant-eligibility-cache.jsonl';

const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const log = (m) => console.log(`[enrich-elig] ${m}`);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ── LLM round-robin (same pattern as classify-directory-se-candidates.mjs) ──
// Order = preference. groq is free+fast (primary); MiniMax-M3 is the main paid fallback
// (reasoning model — needs <think> stripping + extra max_tokens); openai is the reliable
// backstop; gemini is free but flaky on real pages. deepseek/anthropic kept last and
// auto-disable on credit-balance errors (see callLLM). Provider health verified 2026-06-08.
const PROVIDERS = [
  { name: 'groq', baseUrl: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile', envKey: 'GROQ_API_KEY' },
  { name: 'minimax', baseUrl: 'https://api.minimax.io/v1/chat/completions', model: 'MiniMax-M3', envKey: 'MINIMAX_API_KEY', maxTokens: 2000 },
  { name: 'openai', baseUrl: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', envKey: 'OPENAI_API_KEY' },
  { name: 'gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: 'gemini-2.5-flash', envKey: 'GEMINI_API_KEY' },
  { name: 'deepseek', baseUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat', envKey: 'DEEPSEEK_API_KEY' },
  { name: 'anthropic', baseUrl: 'https://api.anthropic.com/v1/messages', model: 'claude-haiku-4-5-20251001', envKey: 'ANTHROPIC_API_KEY', isAnthropic: true },
];
let providerIdx = 0;

function buildPrompt(grant, pageText) {
  return `You read an Australian grant/funding page and extract ELIGIBILITY facts about which ORGANISATION TYPES can apply. Answer ONLY from the text — if something is not stated, use null (do not guess).

Grant: ${grant.name}
Provider: ${grant.provider || 'unknown'}

PAGE TEXT (truncated):
"""
${pageText.slice(0, 6000)}
"""

Return JSON only:
{
  "dgr_required": true | false | null,          // does an applicant need Deductible Gift Recipient (DGR) status / be tax-deductible?
  "accepts_charity": true | false | null,        // can registered charities / not-for-profits / incorporated associations apply?
  "accepts_pty_ltd": true | false | null,        // can for-profit companies / Pty Ltd / businesses apply?
  "accepts_sole_trader": true | false | null,    // can sole traders / individuals trading apply?
  "accepts_unincorporated": true | false | null, // can unincorporated groups apply (often need an auspice)?
  "eligible_summary": "one short sentence on who can apply, quoting the page",
  "confidence": 0.0 to 1.0
}
No commentary outside the JSON.`;
}

async function callLLM(prompt) {
  for (let attempt = 0; attempt < PROVIDERS.length; attempt++) {
    const p = PROVIDERS[(providerIdx + attempt) % PROVIDERS.length];
    if (p.disabled) continue;
    const key = process.env[p.envKey];
    if (!key) continue;
    try {
      const headers = { 'Content-Type': 'application/json' };
      let body;
      if (p.isAnthropic) {
        headers['x-api-key'] = key; headers['anthropic-version'] = '2023-06-01';
        body = JSON.stringify({ model: p.model, max_tokens: 400, messages: [{ role: 'user', content: prompt }] });
      } else {
        headers['Authorization'] = `Bearer ${key}`;
        body = JSON.stringify({ model: p.model, messages: [{ role: 'user', content: prompt }], temperature: 0.1, max_tokens: p.maxTokens || 400, response_format: { type: 'json_object' } });
      }
      const res = await fetch(p.baseUrl, { method: 'POST', headers, body, signal: AbortSignal.timeout(40000) });
      if (!res.ok) {
        const err = await res.text();
        if ([401, 402, 429].includes(res.status) || /quota|rate.?limit|insufficient|unauthor|credit|balance/i.test(err)) { log(`${p.name} unavailable (${res.status}) — disabling`); p.disabled = true; }
        else log(`${p.name} ${res.status}: ${err.slice(0, 80)}`);
        continue;
      }
      const json = await res.json();
      const raw = p.isAnthropic ? (json.content?.[0]?.text || '') : (json.choices?.[0]?.message?.content || '');
      // Strip reasoning-model <think> blocks first (MiniMax-M3 etc. emit them before the JSON,
      // and the reasoning often echoes braces that would poison the greedy {…} match).
      const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json|```/g, '');
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) { log(`${p.name} no JSON`); continue; }
      providerIdx = (providerIdx + attempt) % PROVIDERS.length; // stick with the one that worked
      return { verdict: JSON.parse(m[0]), provider: p.name };
    } catch (e) { log(`${p.name} error: ${String(e.message).slice(0, 80)}`); }
  }
  return null;
}

// ── page fetch via headless Chrome (clears gov/Cloudflare walls) ────────────
async function fetchPageText(browserCtx, url) {
  const page = await browserCtx.newPage();
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 });
    await sleep(1500);
    const title = await page.title();
    if (/just a moment|attention required|access denied/i.test(title)) return { text: '', blocked: true };
    const text = await page.evaluate(() => {
      for (const sel of ['nav', 'header', 'footer', 'script', 'style', '[role=navigation]']) document.querySelectorAll(sel).forEach(e => e.remove());
      const main = document.querySelector('main, [role=main], #content, .content, article');
      const mainText = (main?.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
      const bodyText = (document.body?.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
      // fall back to full body when the main-content region is thin or missing
      return mainText.length >= 400 ? mainText : bodyText;
    });
    return { text, blocked: false };
  } catch (e) { return { text: '', blocked: false, error: String(e.message).slice(0, 80) }; }
  finally { await page.close(); }
}

// ── cache ───────────────────────────────────────────────────────────────────
function loadCache() {
  const map = new Map();
  if (fs.existsSync(CACHE_PATH)) for (const line of fs.readFileSync(CACHE_PATH, 'utf8').split('\n')) {
    if (!line.trim()) continue; try { const o = JSON.parse(line); map.set(o.id, o); } catch {}
  }
  return map;
}
function appendCache(rec) { fs.appendFileSync(CACHE_PATH, JSON.stringify(rec) + '\n'); }

async function main() {
  fs.mkdirSync('data', { recursive: true });
  const cache = loadCache();

  const todayStr = new Date().toISOString().slice(0, 10);
  let q = supabase.from('grant_opportunities')
    .select('id, name, provider, url, closes_at, deadline')
    .not('url', 'is', null)
    .is('eligibility_signals_at', null)
    .neq('source', 'arc-grants')
    // open at the DB level so LIMIT counts open rows, not closed ones
    .or(`closes_at.gte.${todayStr},deadline.gte.${todayStr}`)
    .limit(LIMIT);
  if (SOURCE) q = q.eq('source', SOURCE);
  if (ONLY_ID) q = supabase.from('grant_opportunities').select('id, name, provider, url, closes_at, deadline').eq('id', ONLY_ID);
  const { data: grants, error } = await q;
  if (error) { console.error(error); process.exit(1); }

  // open grants only (unless a specific id was requested)
  const today = new Date().toISOString().slice(0, 10);
  const todo = (grants || []).filter(g => ONLY_ID || (g.closes_at || g.deadline || '9999') >= today);
  log(`${todo.length} grants to enrich (${APPLY ? 'APPLY' : 'dry-run'}); cache has ${cache.size}`);

  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--disable-blink-features=AutomationControlled'] });
  const ctx = await browser.newContext({ locale: 'en-AU', viewport: { width: 1280, height: 900 }, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36' });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });

  const stats = { ok: 0, blocked: 0, empty: 0, cached: 0, dgr: 0 };
  for (const g of todo) {
    let rec = cache.get(g.id);
    if (!rec) {
      const { text, blocked, error: ferr } = await fetchPageText(ctx, g.url);
      if (blocked) { stats.blocked++; log(`✗ blocked: ${g.name.slice(0, 50)}`); continue; }
      if (!text || text.length < 200) { stats.empty++; log(`· thin page (${text.length}b): ${g.name.slice(0, 45)} ${ferr || ''}`); continue; }
      const out = await callLLM(buildPrompt(g, text));
      if (!out) { log(`✗ no LLM verdict: ${g.name.slice(0, 45)}`); continue; }
      rec = { id: g.id, name: g.name, ...out.verdict, provider: out.provider };
      appendCache(rec);
    } else stats.cached++;

    const v = rec;
    stats.ok++;
    if (v.dgr_required === true) stats.dgr++;
    log(`✓ ${g.name.slice(0, 48)} | dgr=${v.dgr_required} charity=${v.accepts_charity} pty=${v.accepts_pty_ltd} sole=${v.accepts_sole_trader} conf=${v.confidence}`);

    if (APPLY) {
      const { error: uerr } = await supabase.from('grant_opportunities').update({
        dgr_required: v.dgr_required,
        accepts_charity: v.accepts_charity,
        accepts_pty_ltd: v.accepts_pty_ltd,
        accepts_sole_trader: v.accepts_sole_trader,
        accepts_unincorporated: v.accepts_unincorporated,
        eligibility_signals_at: new Date().toISOString(),
      }).eq('id', g.id);
      if (uerr) log(`  DB update failed: ${uerr.message}`);
    }
    await sleep(400);
  }

  await browser.close();
  log(`done — ok=${stats.ok} (cached=${stats.cached}) dgr_required=${stats.dgr} blocked=${stats.blocked} empty=${stats.empty}`);
  if (!APPLY) log('dry-run — no DB writes. Re-run with --apply to persist (verdicts are cached, so this is cheap).');
}

main().catch((e) => { console.error(e); process.exit(1); });
