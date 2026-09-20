#!/usr/bin/env node
/**
 * 2-ask-jev.mjs — ask JEV the five eligibility questions, all five in one
 * request per page (fan-out), under either primitive.
 *
 * WHY AT ALL: the incumbent asks one chat model for a JSON object with five
 * true/false/null fields, then regex-slices the JSON back out of free text
 * (enrich-grant-eligibility.mjs:~100), behind a six-provider failover chain.
 * There is no text to parse here, so that whole failure class disappears.
 *
 * TWO QUESTION SETS, AND WHY BOTH ARE HERE:
 *
 *   --primitive=noul (QUESTIONS)  — the obvious first design, and WRONG for this
 *     field set. Noul has two outcomes, so "the page is silent" has to be folded
 *     into `false`. Measured on the first 25 pages: JEV returned dgr_required at
 *     0.03-0.12 on every one (confidently false) where the incumbent returned
 *     null (not stated). Both defensible; different questions; comparison
 *     meaningless. Kept so the mistake stays visible.
 *
 *   --primitive=choice (CHOICE_QUESTIONS) — three options per field, with
 *     not_stated first-class. This matches the column semantics the incumbent
 *     prompt already states ("if something is not stated, use null (do not
 *     guess)"), and Choice returns a confidence, which Noul does not.
 *
 * GATING: noul >=0.85 -> true, <=0.15 -> false, else null. choice -> the mapped
 * flag when confidence >= CHOICE_CONFIDENCE_AT, else null. null already means
 * 'unknown' to act-grant-eligibility.ts:82-88, so the uncertain path needs no UI.
 *
 * No SDK dependency — plain fetch against the documented HTTP endpoint.
 *
 * Usage:
 *   node --env-file=.env scripts/jev-pilot/2-ask-jev.mjs --primitive=choice
 *   node --env-file=.env scripts/jev-pilot/2-ask-jev.mjs --limit=20 --concurrency=4
 *
 * Reads  data/jev-pilot/pages.jsonl
 * Writes data/jev-pilot/jev-verdicts.jsonl, or -choice.jsonl (append-only, resumable)
 */

import fs from 'node:fs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const LIMIT = parseInt(arg('limit', '1000'), 10);
const CONCURRENCY = parseInt(arg('concurrency', '4'), 10);
const MODEL = arg('model', 'jev-latest');

const PRIMITIVE = arg('primitive', 'noul'); // 'noul' | 'choice'
const PAGES_PATH = 'data/jev-pilot/pages.jsonl';
const OUT_PATH = PRIMITIVE === 'choice'
  ? 'data/jev-pilot/jev-verdicts-choice.jsonl'
  : 'data/jev-pilot/jev-verdicts.jsonl';
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

// Same trim the incumbent applies, so neither system sees more of the page.
const PAGE_CHARS = 6000;

// Confidence gates. Deliberately wide — the middle band is the abstention we
// are trying to buy. Tune only after the calibration plot in stage 3.
const TRUE_AT = 0.85;
const FALSE_AT = 0.15;
// Choice carries its own confidence; 0.5 is typesafe's documented floor for
// "do not act below this". Tune after the calibration plot, not before.
const CHOICE_CONFIDENCE_AT = 0.5;

const log = (m) => console.log(`[jev-pilot:ask] ${m}`);

const QUESTIONS = {
  dgr_required: {
    type: 'noul',
    instructions: 'Decide whether this funding page requires applicants to hold DGR (Deductible Gift Recipient) endorsement.',
    criteria: {
      true: 'The page states that applicants must hold DGR status, deductible gift recipient endorsement, Item 1 DGR, or must be able to receive tax-deductible donations.',
      false: 'The page does not state any DGR requirement for applicants, or it explicitly says DGR endorsement is not required.',
    },
  },
  accepts_charity: {
    type: 'noul',
    instructions: 'Decide whether registered charities, not-for-profits or incorporated associations are eligible to apply.',
    criteria: {
      true: 'The page states that registered charities, not-for-profit organisations, or incorporated associations may apply.',
      false: 'The page does not say that such organisations may apply, or it excludes them.',
    },
  },
  accepts_pty_ltd: {
    type: 'noul',
    instructions: 'Decide whether for-profit companies are eligible to apply.',
    criteria: {
      true: 'The page states that for-profit companies, Pty Ltd entities, or businesses may apply.',
      false: 'The page does not say that for-profit companies may apply, or it restricts eligibility to non-profits.',
    },
  },
  accepts_sole_trader: {
    type: 'noul',
    instructions: 'Decide whether sole traders or individuals trading in their own name are eligible to apply.',
    criteria: {
      true: 'The page states that sole traders, individuals, or people trading under their own ABN may apply.',
      false: 'The page does not say that sole traders or individuals may apply, or it requires an incorporated entity.',
    },
  },
  accepts_unincorporated: {
    type: 'noul',
    instructions: 'Decide whether unincorporated community groups are eligible to apply, including where an auspice or sponsoring body is required.',
    criteria: {
      true: 'The page states that unincorporated groups, community groups without legal structure, or auspiced/sponsored applicants may apply.',
      false: 'The page does not say that unincorporated groups may apply, or it requires applicants to be a legal entity.',
    },
  },
};

export const FIELDS = Object.keys(QUESTIONS);

/**
 * CHOICE VARIANT — added after the first 25-page run.
 *
 * The Noul set above cannot express "the page is silent". Its `criteria.false`
 * folds "no requirement stated" together with "explicitly not required", so on
 * all 25 pages JEV returned dgr_required at 0.03-0.12 (confidently false) while
 * the incumbent returned null (not stated). Both defensible, different
 * questions, and the comparison is meaningless as a result.
 *
 * "Not stated" is a first-class answer in this domain — the incumbent prompt
 * says so explicitly ("if something is not stated, use null (do not guess)") and
 * the column semantics depend on it. A three-option Choice models that directly,
 * and unlike Noul it returns a confidence, which is what we wanted to gate on in
 * the first place.
 */
const CHOICE_QUESTIONS = {
  dgr_required: {
    type: 'choice',
    instructions: 'What does this funding page say about whether applicants must hold DGR (Deductible Gift Recipient) endorsement?',
    criteria: {
      required: 'The page states applicants must hold DGR status, Item 1 DGR, deductible gift recipient endorsement, or must be able to receive tax-deductible donations.',
      not_required: 'The page explicitly states that DGR endorsement is not required, or that applicants without DGR may apply.',
      not_stated: 'The page says nothing either way about DGR endorsement.',
    },
  },
  accepts_charity: {
    type: 'choice',
    instructions: 'What does this funding page say about whether registered charities, not-for-profits or incorporated associations may apply?',
    criteria: {
      eligible: 'The page states that registered charities, not-for-profits, or incorporated associations may apply.',
      not_eligible: 'The page states that such organisations may not apply, or restricts eligibility to other kinds of applicant.',
      not_stated: 'The page says nothing either way about whether such organisations may apply.',
    },
  },
  accepts_pty_ltd: {
    type: 'choice',
    instructions: 'What does this funding page say about whether for-profit companies may apply?',
    criteria: {
      eligible: 'The page states that for-profit companies, Pty Ltd entities, or businesses may apply.',
      not_eligible: 'The page states that for-profit companies may not apply, or restricts eligibility to non-profit applicants.',
      not_stated: 'The page says nothing either way about for-profit companies.',
    },
  },
  accepts_sole_trader: {
    type: 'choice',
    instructions: 'What does this funding page say about whether sole traders or individuals may apply?',
    criteria: {
      eligible: 'The page states that sole traders, individuals, or people trading under their own ABN may apply.',
      not_eligible: 'The page states that individuals or sole traders may not apply, or requires an incorporated entity.',
      not_stated: 'The page says nothing either way about sole traders or individuals.',
    },
  },
  accepts_unincorporated: {
    type: 'choice',
    instructions: 'What does this funding page say about whether unincorporated community groups may apply, including under an auspice?',
    criteria: {
      eligible: 'The page states that unincorporated groups, groups without legal structure, or auspiced applicants may apply.',
      not_eligible: 'The page states that unincorporated groups may not apply, or requires applicants to be a legal entity.',
      not_stated: 'The page says nothing either way about unincorporated groups.',
    },
  },
};

// Choice -> the tri-state the column stores. not_stated maps to null, which is
// what act-grant-eligibility.ts:82-88 already renders as 'unknown'.
const CHOICE_TO_FLAG = {
  required: true, not_required: false,
  eligible: true, not_eligible: false,
  not_stated: null,
};

const ACTIVE_QUESTIONS = PRIMITIVE === 'choice' ? CHOICE_QUESTIONS : QUESTIONS;

function readJsonl(path) {
  if (!fs.existsSync(path)) return [];
  return fs.readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

function gate(p) {
  if (p == null) return null;
  if (p >= TRUE_AT) return true;
  if (p <= FALSE_AT) return false;
  return null; // honest unknown — same meaning as the incumbent's null
}

async function askJev(page, attempt = 0) {
  const state = {
    grant_name: page.name,
    funder: page.provider || 'unknown',
    page_text: (page.text || '').slice(0, PAGE_CHARS),
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.JEV_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, state, questions: ACTIVE_QUESTIONS }),
    signal: AbortSignal.timeout(60000),
  });

  if (res.status === 429 || res.status === 529) {
    if (attempt >= 4) throw new Error(`${res.status} after retries`);
    const wait = 2 ** attempt * 1000;
    await new Promise(r => setTimeout(r, wait));
    return askJev(page, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function main() {
  if (!process.env.JEV_API_KEY) { console.error('JEV_API_KEY missing from env'); process.exit(1); }

  const pages = readJsonl(PAGES_PATH).filter(p => p.text && p.text.length >= 200);
  const done = new Set(readJsonl(OUT_PATH).map(r => r.id));
  const todo = pages.filter(p => !done.has(p.id)).slice(0, LIMIT);
  log(`${pages.length} usable pages; ${done.size} already asked; ${todo.length} to do`);
  if (!todo.length) return;

  const totals = { ok: 0, failed: 0, input_tokens: 0, ms: [] };

  // Simple fixed-size worker pool — typesafe's own cookbook uses 4.
  let cursor = 0;
  async function worker() {
    while (cursor < todo.length) {
      const page = todo[cursor++];
      const t0 = Date.now();
      try {
        const json = await askJev(page);
        const ms = Date.now() - t0;
        const probs = {};
        const flags = {};
        const confidence = {};
        for (const field of FIELDS) {
          const a = json.answers?.[field];
          if (PRIMITIVE === 'choice') {
            // Choice returns the label plus per-option probabilities and a
            // confidence. Gate on confidence, not on the winning probability:
            // a 0.4/0.35/0.25 spread has a "winner" that means nothing.
            confidence[field] = a?.confidence ?? null;
            probs[field] = a?.probabilities ?? null;
            flags[field] = (a?.confidence ?? 0) >= CHOICE_CONFIDENCE_AT
              ? (CHOICE_TO_FLAG[a?.choice] ?? null)
              : null;
          } else {
            const p = a?.noul ?? null;
            probs[field] = p;
            flags[field] = gate(p);
          }
        }
        totals.ok++;
        totals.input_tokens += json.usage?.input_tokens || 0;
        totals.ms.push(ms);
        fs.appendFileSync(OUT_PATH, JSON.stringify({
          id: page.id, name: page.name, url: page.url,
          primitive: PRIMITIVE,
          probabilities: probs, flags, confidence,
          usage: json.usage || null, model: json.model || MODEL, latency_ms: ms,
          asked_at: new Date().toISOString(),
        }) + '\n');
        log(`${totals.ok + totals.failed}/${todo.length} ${ms}ms — ${page.name.slice(0, 55)}`);
      } catch (e) {
        totals.failed++;
        log(`FAIL ${page.id}: ${String(e.message).slice(0, 120)}`);
        fs.appendFileSync(OUT_PATH, JSON.stringify({
          id: page.id, name: page.name, url: page.url,
          error: String(e.message).slice(0, 200), asked_at: new Date().toISOString(),
        }) + '\n');
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const sorted = totals.ms.sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  // $42 per billion input tokens, output free (docs.typesafe.ai/models)
  const cost = totals.input_tokens * 42 / 1e9;
  log(`done — ok=${totals.ok} failed=${totals.failed}`);
  log(`latency p50=${p50}ms p95=${p95}ms (concurrency ${CONCURRENCY})`);
  log(`input tokens=${totals.input_tokens.toLocaleString()} -> $${cost.toFixed(4)}`);
}

main().catch(e => { console.error(e); process.exit(1); });
