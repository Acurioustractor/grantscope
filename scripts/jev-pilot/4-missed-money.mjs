#!/usr/bin/env node
/**
 * 4-missed-money.mjs — find open grants the keyword scorers THREW AWAY but that
 * are a real fit for an ACT project.
 *
 * WHY THIS AND NOT MORE ELIGIBILITY WORK. Measured 2026-09-21 against the live
 * database: 383 open grants, 353 scored by the relevance scorers, and only 19
 * tagged to any ACT project. The scorers discard 95% of the open pool before ACT
 * ever sees it, and nobody has ever looked at what they discard — false
 * negatives are invisible by construction. goods-relevance.mjs and
 * project-relevance.mjs are additive keyword sums with thresholds at 50 and 30;
 * project-relevance.mjs:24-29 already documents one misfire in the other
 * direction. So the question worth money is not "are the 19 correct" but
 * "how many of the other 364 should have been in the 19".
 *
 * WHAT JEV IS ASKED. One request per grant carrying six Score questions, one per
 * ACT project, on a four-level rubric. Thematic fit ONLY. Plus one Noul that
 * screens out the scholarship/individual-award noise that fills this table.
 *
 * WHAT STAYS IN CODE, DELIBERATELY. Geography, entity eligibility, deadlines and
 * amounts are NOT asked of JEV. It "reads dates as text, not as ordered
 * quantities", cannot judge whether two values are near each other, and is not a
 * calculator — so those are applied afterwards from the grant's own columns and
 * ACT_PROJECTS' operating areas. This follows typesafe's own composite-scoring
 * guidance: atomic judgements from the model, arithmetic and hard rules in code.
 *
 * OUTPUT is a review list, not a write. Nothing is tagged, nothing is persisted
 * to grant_opportunities. Ben eyeballs it and decides.
 *
 * Usage:
 *   node --env-file=.env scripts/jev-pilot/4-missed-money.mjs --limit=400
 *   node --env-file=.env scripts/jev-pilot/4-missed-money.mjs --all-time   # include closed rounds
 *
 * Writes data/jev-pilot/missed-money.jsonl  (raw, resumable)
 *        data/jev-pilot/missed-money.csv    (the review list)
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const LIMIT = parseInt(arg('limit', '400'), 10);
const CONCURRENCY = parseInt(arg('concurrency', '4'), 10);
const ALL_TIME = process.argv.includes('--all-time');
const MODEL = arg('model', 'jev-latest');

const OUT_PATH = 'data/jev-pilot/missed-money.jsonl';
const CSV_PATH = 'data/jev-pilot/missed-money.csv';
const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

const log = (m) => console.log(`[jev-pilot:missed] ${m}`);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
);

/**
 * What each ACT project actually does, in prose, so the rubric is readable rather
 * than a keyword list. Sourced from ACT_PROJECTS in apps/web/src/lib/act-grant-eligibility.ts
 * (entities + operating area, "Ben's answers of 2026-09-14") and the tier-1 keyword
 * sets in scripts/lib/{goods,project}-relevance.mjs.
 *
 * `area` is applied in CODE after scoring, never asked of the model.
 */
const PROJECTS = {
  goods: {
    label: 'Goods',
    what: 'Goods on Country supplies essential household goods — beds, bedding, mattresses, whitegoods, washing machines, furniture — into remote Aboriginal and Torres Strait Islander communities, alongside community stores, remote housing and community infrastructure. It is Aboriginal-community-controlled in its delivery and works on self-determination and Closing the Gap terms.',
    area: { national: false, states: ['NT', 'QLD', 'WA'] },
  },
  justicehub: {
    label: 'JusticeHub',
    what: 'JusticeHub works on youth justice: justice reinvestment, diversion and diversionary programs, restorative justice, bail support, throughcare, youth mentoring, and reducing youth detention, recidivism and reoffending. It does NOT mean environmental, climate or economic justice.',
    area: { national: true, states: [] },
  },
  'empathy-ledger': {
    label: 'Empathy Ledger',
    what: 'Empathy Ledger is a consent-based storytelling platform: lived-experience and digital storytelling, oral history, narrative evidence, community voice and Indigenous data sovereignty, where the storyteller keeps control of their story. It has nothing to do with accounting or bookkeeping ledgers.',
    area: { national: true, states: [] },
  },
  harvest: {
    label: 'The Harvest',
    what: 'The Harvest is community food work: food security, food relief and rescue, community gardens, community kitchens, urban agriculture and food sovereignty. It does not mean a wine or grape harvest, or a harvest festival.',
    area: { national: false, states: ['QLD'], lga: 'Sunshine Coast' },
  },
  farm: {
    label: 'The Farm',
    what: 'The Farm is regenerative agriculture: regenerative and sustainable farming, agroforestry, landcare, soil health, revegetation, catchment work, farm biodiversity and natural capital. It does not mean a wind farm, solar farm, server farm or fish farm.',
    area: { national: false, states: ['QLD'], lga: 'Sunshine Coast' },
  },
  contained: {
    label: 'Contained',
    what: 'Contained is a shipping-container based touring exhibition: immersive installations and pop-up or mobile exhibitions that travel to communities. It does not mean a study tour, sports tour, concert tour, or tourism operation.',
    area: { national: true, states: [] },
  },
};

// Four ordered levels. Deliberately few — typesafe allows 2-10, and a coarse,
// well-described scale is easier to agree with than a fine one nobody can define.
const LEVELS = [
  'No connection. The grant funds something unrelated to this work.',
  'Adjacent. Same broad sector, but the grant does not fund what this project actually does.',
  'Plausible. This project could write a credible application without stretching the truth.',
  'Strong. The grant\'s stated purpose directly matches what this project does.',
];

function buildQuestions() {
  const questions = {
    fundable_by_an_organisation: {
      type: 'noul',
      instructions: 'Decide whether this is funding an incorporated organisation could apply for to deliver a project.',
      criteria: {
        true: 'An organisation, charity, company or community group could apply for this funding to run a project or deliver services.',
        false: 'This is a scholarship, fellowship, bursary, prize or award for an individual person, a research grant tied to a university position, or a procurement contract rather than a grant.',
      },
    },
  };
  for (const [key, p] of Object.entries(PROJECTS)) {
    questions[`fit_${key}`] = {
      type: 'score',
      instructions: `Rate how well this funding opportunity fits the following project.\n\nPROJECT — ${p.label}: ${p.what}\n\nJudge the THEME AND PURPOSE only. Ignore geography, deadlines, dollar amounts and the applicant's legal structure — those are checked separately.`,
      criteria: LEVELS,
    };
  }
  return questions;
}
const QUESTIONS = buildQuestions();

const readJsonl = (p) => fs.existsSync(p)
  ? fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  : [];

/**
 * Geography gate, in code. Returns true when the grant could reach the project's
 * operating area. Unknown geography passes — we would rather review a grant that
 * turns out to be interstate than silently drop one, which is the exact failure
 * this script exists to find.
 */
function geographyAllows(project, grant) {
  const area = PROJECTS[project].area;
  if (area.national) return true;
  const geo = `${grant.geography || ''} ${grant.state || ''}`.toUpperCase();
  if (!geo.trim()) return true;                       // unknown -> review it
  if (/NATIONAL|AUSTRALIA[- ]WIDE|ALL STATES/.test(geo)) return true;
  return area.states.some(s => geo.includes(s));
}

async function askJev(grant, attempt = 0) {
  // Keep the state tight. "Context rot" is a documented failure mode: unrelated
  // detail in state acts as a distractor, so send the fields that carry purpose
  // and nothing else.
  const state = {
    grant_name: grant.name,
    funder: grant.provider || grant.funder_name || 'unknown',
    description: (grant.description || '').slice(0, 3000),
    categories: grant.categories || [],
    focus_areas: grant.focus_areas || [],
  };

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.JEV_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, state, questions: QUESTIONS }),
    signal: AbortSignal.timeout(60000),
  });
  if (res.status === 429 || res.status === 529) {
    if (attempt >= 4) throw new Error(`${res.status} after retries`);
    await new Promise(r => setTimeout(r, 2 ** attempt * 1000));
    return askJev(grant, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

const csv = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;

async function main() {
  if (!process.env.JEV_API_KEY) { console.error('JEV_API_KEY missing'); process.exit(1); }
  fs.mkdirSync('data/jev-pilot', { recursive: true });

  let q = supabase.from('grant_opportunities')
    .select('id, name, provider, description, categories, focus_areas, geography, url, closes_at, deadline, amount_min, amount_max, aligned_projects, goods_relevance_score, project_relevance, source')
    .limit(LIMIT);
  if (!ALL_TIME) {
    const today = new Date().toISOString().slice(0, 10);
    q = q.or(`closes_at.gte.${today},deadline.gte.${today}`);
  }
  const { data: grants, error } = await q;
  if (error) { console.error(error); process.exit(1); }

  const done = new Set(readJsonl(OUT_PATH).map(r => r.id));
  const todo = (grants || []).filter(g => !done.has(g.id));
  log(`${grants.length} grants in scope; ${done.size} already scored; ${todo.length} to do`);

  const totals = { ok: 0, failed: 0, tokens: 0, ms: [] };
  let cursor = 0;
  async function worker() {
    while (cursor < todo.length) {
      const g = todo[cursor++];
      const t0 = Date.now();
      try {
        const json = await askJev(g);
        const ms = Date.now() - t0;
        const fits = {};
        for (const key of Object.keys(PROJECTS)) {
          const a = json.answers?.[`fit_${key}`];
          fits[key] = { score: a?.score ?? null, confidence: a?.confidence ?? null };
        }
        totals.ok++; totals.tokens += json.usage?.input_tokens || 0; totals.ms.push(ms);
        fs.appendFileSync(OUT_PATH, JSON.stringify({
          id: g.id, name: g.name, provider: g.provider, url: g.url,
          geography: g.geography, source: g.source,
          closes_at: g.closes_at, deadline: g.deadline,
          amount_min: g.amount_min, amount_max: g.amount_max,
          // what the incumbent keyword scorers concluded
          keyword_tags: g.aligned_projects || [],
          keyword_goods_score: g.goods_relevance_score,
          keyword_project_relevance: g.project_relevance,
          // what JEV concluded
          organisation_fundable: json.answers?.fundable_by_an_organisation?.noul ?? null,
          fits,
          usage: json.usage, latency_ms: ms, scored_at: new Date().toISOString(),
        }) + '\n');
        if (totals.ok % 25 === 0) log(`${totals.ok + totals.failed}/${todo.length}…`);
      } catch (e) {
        totals.failed++;
        log(`FAIL ${g.id}: ${String(e.message).slice(0, 100)}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const lat = totals.ms.sort((a, b) => a - b);
  log(`scored ok=${totals.ok} failed=${totals.failed}`);
  if (lat.length) log(`latency p50=${lat[Math.floor(lat.length * 0.5)]}ms p95=${lat[Math.floor(lat.length * 0.95)]}ms`);
  log(`tokens=${totals.tokens.toLocaleString()} -> $${(totals.tokens * 42 / 1e9).toFixed(4)}`);

  // ── the review list ───────────────────────────────────────────────────────
  const all = readJsonl(OUT_PATH);
  const FIT_AT = 2.0;          // "plausible" or better
  const CONF_AT = 0.5;         // typesafe's documented floor for acting at all
  const ORG_AT = 0.5;          // more likely than not an organisation could apply

  const missed = [];
  for (const r of all) {
    if ((r.organisation_fundable ?? 0) < ORG_AT) continue;   // scholarship/award noise
    for (const [key, f] of Object.entries(r.fits)) {
      if (f.score == null || f.score < FIT_AT) continue;
      if ((f.confidence ?? 0) < CONF_AT) continue;
      const keywordTagged = (r.keyword_tags || []).length > 0;
      if (keywordTagged) continue;                            // already visible to ACT
      if (!geographyAllows(key, r)) continue;                 // code, not the model
      missed.push({ ...r, project: key, fit: f.score, conf: f.confidence });
    }
  }
  missed.sort((a, b) => b.fit - a.fit || (b.conf ?? 0) - (a.conf ?? 0));

  // A grant that is "plausible" for three or more of six unrelated projects is a
  // generic community-grants programme, not a fit for any of them. Measured on
  // the first full run: 9 such grants produced 48 of 76 rows — they drown the
  // list. They are kept, but segregated, because a generic small-grants round
  // may still be worth an application; it just is not EVIDENCE of a theme match.
  const projectCount = {};
  for (const m of missed) projectCount[m.id] = (projectCount[m.id] || 0) + 1;
  const isGeneric = (m) => projectCount[m.id] >= 3;
  const focused = missed.filter(m => !isGeneric(m));
  const generic = missed.filter(isGeneric);

  const header = ['kind', 'project', 'fit', 'confidence', 'grant', 'funder', 'closes', 'amount_max', 'geography', 'keyword_goods_score', 'url'];
  const lines = [header.map(csv).join(',')];
  for (const m of [...focused, ...generic]) {
    lines.push([
      isGeneric(m) ? 'generic-programme' : 'candidate',
      PROJECTS[m.project].label, m.fit?.toFixed(2), m.conf?.toFixed(2),
      m.name, m.provider, m.closes_at || m.deadline || '', m.amount_max ?? '',
      m.geography || '', m.keyword_goods_score ?? '', m.url || '',
    ].map(csv).join(','));
  }
  fs.writeFileSync(CSV_PATH, lines.join('\n') + '\n');

  const byProject = {};
  for (const m of focused) byProject[PROJECTS[m.project].label] = (byProject[PROJECTS[m.project].label] || 0) + 1;
  const distinct = new Set(focused.map(m => m.id)).size;

  console.log(`\n${missed.length} rejected-but-plausible rows across ${new Set(missed.map(m => m.id)).size} distinct grants`);
  console.log(`  ${focused.length} rows / ${distinct} grants are project-specific  <- REVIEW THESE`);
  console.log(`  ${generic.length} rows are generic community-grants programmes (>=3 projects each), segregated`);
  console.log(`  by project: ${JSON.stringify(byProject)}`);
  console.log(`  review list: ${CSV_PATH}\n`);
  console.log('Top candidates:');
  for (const m of focused.slice(0, 15)) {
    console.log(`  ${m.fit.toFixed(2)} ${String(PROJECTS[m.project].label).padEnd(15)} ${(m.name || '').slice(0, 62)}`);
  }
  console.log('\nNothing was written to grant_opportunities. This is a review list.');
}

main().catch(e => { console.error(e); process.exit(1); });
