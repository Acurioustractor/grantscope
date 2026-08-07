#!/usr/bin/env node
/**
 * LLM-based auto-classifier for unverified alma_funding_opportunities rows.
 *
 * Sends batches of unclassified grants to Claude Haiku with prompt caching for the
 * classification rubric. Returns one of:
 *   open_grant | invitation_only | award | placeholder | policy_framework | partnership
 *
 * Writes back:
 *   - opportunity_type
 *   - verification_status (open_grant → verified, others → placeholder)
 *   - auto_classify_confidence (0.0-1.0)
 *   - auto_classify_reason (1-line explanation)
 *   - auto_classify_model (claude-haiku-4-5-20251001)
 *   - auto_classify_at
 *
 * Usage:
 *   node --env-file=.env scripts/auto-classify-llm.mjs [--dry-run] [--limit=50] [--min-confidence=0.7]
 *
 * Behavior:
 *   - Rows with confidence >= min-confidence are auto-applied (default 0.7)
 *   - Rows below threshold stay unverified, but confidence/reason are still saved
 *     so the triage UI can show "LLM said X with 0.55 confidence — please review"
 *
 * Cost: Haiku 4.5 input $1/Mtok, output $5/Mtok. ~$0.01 per 100 rows.
 */

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT_ARG = process.argv.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : 300;
const CONF_ARG = process.argv.find((a) => a.startsWith('--min-confidence='));
const MIN_CONFIDENCE = CONF_ARG ? parseFloat(CONF_ARG.split('=')[1]) : 0.7;

const BATCH_SIZE = 25;
const AGENT_ID = 'auto-classify-llm';

/**
 * Providers, cheapest-and-most-available first.
 *
 * This job died silently for three months because it could only talk to one
 * provider and that provider's credit ran out. Classifying a grant into six
 * buckets does not need a frontier model, so the default order prefers free
 * capacity and falls back rather than stopping.
 *
 * Groq, DeepSeek, Ollama and Gemini all speak the OpenAI chat-completions API,
 * so one client covers them; Anthropic keeps its own path for prompt caching.
 *
 *   groq     — free tier, 131k context, fastest of these
 *   gemini   — free tier via the OpenAI-compatible endpoint
 *   ollama   — fully local, no quota, no network, needs `ollama serve`
 *   deepseek — paid but very cheap
 *   anthropic — best quality, needs credit
 */
const PROVIDERS = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.3-70b-versatile',
    keyEnv: 'GROQ_API_KEY',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    model: 'gemini-2.5-flash',
    keyEnv: 'GEMINI_API_KEY',
  },
  ollama: {
    baseUrl: 'http://localhost:11434/v1',
    model: process.env.OLLAMA_CLASSIFY_MODEL || 'gpt-oss:20b',
    keyEnv: null, // local, no key
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyEnv: 'DEEPSEEK_API_KEY',
  },
  anthropic: {
    model: 'claude-haiku-4-5-20251001',
    keyEnv: 'ANTHROPIC_API_KEY',
  },
};

const PROVIDER_ARG = process.argv.find((a) => a.startsWith('--provider='));
const FALLBACK_ORDER = ['groq', 'gemini', 'ollama', 'deepseek', 'anthropic'];

/** Providers that are actually usable right now, in preference order. */
function availableProviders() {
  const requested = PROVIDER_ARG?.split('=')[1];
  if (requested) {
    if (!PROVIDERS[requested]) {
      throw new Error(`Unknown provider "${requested}". Options: ${Object.keys(PROVIDERS).join(', ')}`);
    }
    return [requested];
  }
  return FALLBACK_ORDER.filter((name) => {
    const p = PROVIDERS[name];
    return p.keyEnv === null || Boolean(process.env[p.keyEnv]);
  });
}

let MODEL = PROVIDERS[availableProviders()[0] ?? 'anthropic'].model;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RUBRIC = `You are classifying Australian grant opportunities for "A Curious Tractor" — a regenerative philanthropy operator running 6 projects: ACT-HV (Harvest Witta — regenerative food/farming), ACT-FM (Farm — land healing), ACT-EL (Empathy Ledger — storytelling), ACT-JH (JusticeHub — youth justice), ACT-GD (Goods — community economic infrastructure), ACT-CORE (cross-cutting advisory). Focus areas: Indigenous-led, regenerative, youth justice, community-controlled, place-based, regional.

For each opportunity, output exactly one classification:

- open_grant: Open application round for organisations. Anyone meeting eligibility can apply now. Examples: community grants, council sponsorships, foundation philanthropic rounds, government program rounds with public RFPs.
- invitation_only: Closed to public applications. By invitation, nomination, or named-recipient only. Examples: PRF's named fellowships, Cath Leary Award (no nominations), Ecstra's CAP Money Mentor partnership.
- award: Recognition or individual scholarship/fellowship/prize for a person (not an organisation). Examples: PhD scholarships, school bursaries, journalism prizes, freelance grants, art residencies.
- placeholder: Test data, smoke seed, example.org URLs, "lorem ipsum" content. Not a real grant.
- policy_framework: A scheme/dataset/policy doc — not a grant ACT can apply to. Examples: visa programs, statistical datasets, IPCC reviewer panels, legal services schemes.
- partnership: A formal partnership structure or joint venture, not an open call.

Return STRICT JSON only. No prose, no markdown. Schema:
{"items":[{"id":"<row id>","classification":"<one of above>","confidence":0.0-1.0,"reason":"<one sentence>"}]}

Confidence rules:
- 0.9-1.0: name + funder + description make classification obvious (e.g., "X Scholarship" from a school)
- 0.7-0.89: clear pattern but could swing the other way (e.g., council "Sponsorship Funding" — most likely open_grant)
- 0.5-0.69: ambiguous — could be misclassified
- 0.0-0.49: don't know — needs human review`;

async function loadUnverified() {
  // Pull unverified rows ordered by ones most likely to be high-value (have funder + URL)
  const { data, error } = await supabase
    .from('alma_funding_opportunities')
    .select('id, name, description, funder_name, source_url, focus_areas, keywords, min_grant_amount, max_grant_amount')
    .eq('opportunity_type', 'unverified')
    .is('auto_classify_confidence', null)
    .order('funder_name', { ascending: true })
    .limit(LIMIT);
  if (error) throw error;
  return data ?? [];
}

function formatRowForLLM(row) {
  const fields = [];
  fields.push(`id: ${row.id}`);
  fields.push(`name: ${row.name ?? ''}`);
  if (row.funder_name) fields.push(`funder: ${row.funder_name}`);
  if (row.source_url) fields.push(`url: ${row.source_url}`);
  if (row.description) fields.push(`desc: ${String(row.description).slice(0, 400).replace(/\s+/g, ' ')}`);
  const focus = (row.focus_areas ?? []).slice(0, 6).join(', ');
  if (focus) fields.push(`focus: ${focus}`);
  if (row.min_grant_amount || row.max_grant_amount) {
    fields.push(`amount: ${row.min_grant_amount ?? '—'} to ${row.max_grant_amount ?? '—'}`);
  }
  return fields.join(' | ');
}

function parseItems(raw) {
  let text = raw.trim();
  // Smaller models wrap JSON in markdown, and some prepend a sentence.
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/, '').replace(/```$/, '').trim();
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace > 0 || lastBrace < text.length - 1) {
    if (firstBrace === -1 || lastBrace === -1) throw new Error(`No JSON object in response: ${text.slice(0, 200)}`);
    text = text.slice(firstBrace, lastBrace + 1);
  }
  const parsed = JSON.parse(text);
  if (!parsed.items || !Array.isArray(parsed.items)) {
    throw new Error(`Unexpected response shape: ${text.slice(0, 200)}`);
  }
  return parsed.items;
}

async function classifyWithAnthropic(rows, rowsText, model) {
  const response = await anthropic.messages.create({
    model,
    max_tokens: 4096,
    system: [{ type: 'text', text: RUBRIC, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: `Classify these ${rows.length} grants. Return JSON only.\n\n${rowsText}` }],
  });
  const textBlock = response.content.find((c) => c.type === 'text');
  if (!textBlock) throw new Error('No text in LLM response');
  return { items: parseItems(textBlock.text), usage: response.usage };
}

/** Groq, Gemini, Ollama and DeepSeek all speak this shape. */
async function classifyWithOpenAICompatible(rows, rowsText, provider) {
  const headers = { 'Content-Type': 'application/json' };
  if (provider.keyEnv) headers.Authorization = `Bearer ${process.env[provider.keyEnv]}`;

  const res = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: provider.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: RUBRIC },
        { role: 'user', content: `Classify these ${rows.length} grants. Return JSON only.\n\n${rowsText}` },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  const body = await res.json();
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error(`No content in response: ${JSON.stringify(body).slice(0, 200)}`);
  return {
    items: parseItems(content),
    usage: {
      input_tokens: body.usage?.prompt_tokens ?? 0,
      output_tokens: body.usage?.completion_tokens ?? 0,
    },
  };
}

let activeProvider = null;

async function classifyBatch(rows) {
  const rowsText = rows.map(formatRowForLLM).join('\n');
  // Stick with the first provider that works, so one outage does not cost every
  // batch a retry cascade — but re-enter the chain if the sticky one starts failing.
  const chain = activeProvider ? [activeProvider, ...availableProviders().filter((p) => p !== activeProvider)] : availableProviders();
  if (chain.length === 0) throw new Error('No LLM provider configured. Set GROQ_API_KEY, GEMINI_API_KEY, ANTHROPIC_API_KEY, or run `ollama serve`.');

  const failures = [];
  for (const name of chain) {
    const provider = PROVIDERS[name];
    try {
      const result = name === 'anthropic'
        ? await classifyWithAnthropic(rows, rowsText, provider.model)
        : await classifyWithOpenAICompatible(rows, rowsText, provider);
      if (activeProvider !== name) {
        console.log(`  provider: ${name} (${provider.model})`);
        activeProvider = name;
        MODEL = provider.model;
      }
      return result;
    } catch (err) {
      failures.push(`${name}: ${err.message.slice(0, 140)}`);
    }
  }
  throw new Error(`All providers failed — ${failures.join(' | ')}`);
}

async function run() {
  const runRow = await logStart(supabase, AGENT_ID, 'LLM auto-classify unverified alma rows');
  const runId = runRow?.id ?? null;
  const startedAt = Date.now();

  try {
    const rows = await loadUnverified();
    console.log(`Loaded ${rows.length} unverified rows (limit=${LIMIT})`);

    if (rows.length === 0) {
      console.log('Nothing to classify.');
      if (runId) await logComplete(supabase, runId, { items_found: 0, items_new: 0, items_updated: 0 });
      return;
    }

    let totalInput = 0,
      totalOutput = 0,
      totalCacheRead = 0,
      totalCacheWrite = 0;
    let classified = 0,
      applied = 0,
      lowConfidence = 0,
      errors = 0;

    const counts = {};
    const examples = [];

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const batchNum = i / BATCH_SIZE + 1;
      console.log(`Batch ${batchNum}/${Math.ceil(rows.length / BATCH_SIZE)} (${batch.length} rows)...`);

      let items;
      try {
        const result = await classifyBatch(batch);
        items = result.items;
        totalInput += result.usage.input_tokens ?? 0;
        totalOutput += result.usage.output_tokens ?? 0;
        totalCacheRead += result.usage.cache_read_input_tokens ?? 0;
        totalCacheWrite += result.usage.cache_creation_input_tokens ?? 0;
      } catch (err) {
        console.error(`  Batch ${batchNum} failed: ${err.message}`);
        errors += batch.length;
        continue;
      }

      const byId = new Map(items.map((it) => [it.id, it]));

      for (const row of batch) {
        const decision = byId.get(row.id);
        if (!decision) {
          errors++;
          continue;
        }
        classified++;
        counts[decision.classification] = (counts[decision.classification] ?? 0) + 1;
        if (examples.length < 12) {
          examples.push(
            `  [${decision.confidence.toFixed(2)}] ${decision.classification.padEnd(16)} ${row.name?.slice(0, 60)}`
          );
        }

        // Determine if we apply or leave for human review
        const willApply = decision.confidence >= MIN_CONFIDENCE;
        if (!willApply) lowConfidence++;

        if (DRY_RUN) continue;

        const verificationStatus = willApply
          ? decision.classification === 'open_grant'
            ? 'verified'
            : 'placeholder'
          : 'unverified';
        const newOppType = willApply ? decision.classification : 'unverified';

        const updates = {
          auto_classify_confidence: decision.confidence,
          auto_classify_reason: decision.reason,
          auto_classify_model: MODEL,
          auto_classify_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (willApply) {
          updates.opportunity_type = newOppType;
          updates.verification_status = verificationStatus;
          if (verificationStatus === 'verified') {
            updates.verified_at = new Date().toISOString();
          }
          updates.verification_notes = `[auto-classify-llm ${MODEL} conf=${decision.confidence.toFixed(2)}] ${decision.reason}`;
        }

        const { error } = await supabase
          .from('alma_funding_opportunities')
          .update(updates)
          .eq('id', row.id);
        if (error) {
          console.error(`  Update failed for ${row.id}: ${error.message}`);
          errors++;
        } else if (willApply) {
          applied++;
        }
      }
    }

    const elapsed = (Date.now() - startedAt) / 1000;

    console.log('\n=== Summary ===');
    console.log(`Classified: ${classified}  Applied: ${applied}  Low-confidence (left unverified): ${lowConfidence}  Errors: ${errors}`);
    console.log('Counts by classification:');
    for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
      console.log(`  ${k.padEnd(20)} ${v}`);
    }
    console.log('\nSample decisions:');
    for (const e of examples) console.log(e);
    console.log(`\nTokens — input: ${totalInput}  output: ${totalOutput}  cached read: ${totalCacheRead}  cached write: ${totalCacheWrite}`);
    // Price by the provider that actually ran, not by Haiku regardless. Reporting
    // an Anthropic bill for a free-tier Groq run reads as a real cost and was the
    // kind of misleading signal that let this job's outage hide for three months.
    // USD per million tokens: [input, output, cacheWrite, cacheRead].
    const RATES = {
      anthropic: [1, 5, 1.25, 0.1],
      deepseek: [0.27, 1.1, 0, 0],
      gemini: [0, 0, 0, 0],   // free tier
      groq: [0, 0, 0, 0],     // free tier
      ollama: [0, 0, 0, 0],   // local
    };
    const [rIn, rOut, rCw, rCr] = RATES[activeProvider] ?? RATES.anthropic;
    const cost =
      (totalInput * rIn) / 1_000_000 +
      (totalOutput * rOut) / 1_000_000 +
      (totalCacheWrite * rCw) / 1_000_000 +
      (totalCacheRead * rCr) / 1_000_000;
    const label = cost === 0 ? 'no charge (free tier / local)' : `$${cost.toFixed(4)}`;
    console.log(`Cost via ${activeProvider ?? 'unknown'}: ${label} (elapsed ${elapsed.toFixed(1)}s)`);

    // A run where every batch errored is a failed run, not a successful one that
    // happened to classify nothing. Reporting success here hid a three-month
    // outage: the API key ran out of credit around 2026-05-16, every batch 400'd,
    // and agent_runs kept logging `success` with items_found=300, items_new=0
    // while the unverified backlog grew to 5,436 rows and the ACT feed starved.
    if (classified === 0 && errors > 0) {
      const reason = new Error(
        `auto-classify made no progress: ${errors} row(s) errored, 0 classified. ` +
        `Check the Anthropic API key credit balance.`
      );
      console.error(reason.message);
      if (runId) await logFailed(supabase, runId, reason);
      process.exit(1);
    }

    if (runId) {
      await logComplete(supabase, runId, {
        items_found: rows.length,
        items_new: applied,
        items_updated: classified,
      });
    }
  } catch (err) {
    console.error('auto-classify-llm failed:', err);
    if (runId) await logFailed(supabase, runId, err);
    process.exit(1);
  }
}

run();
