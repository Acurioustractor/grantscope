#!/usr/bin/env node
/**
 * score-project-rubric.mjs — the SECOND tagging signal for the six ACT projects:
 * a written rubric, scored by JEV, alongside the keyword tiers. Goods joined on
 * 2026-09-24; its keyword tier is scripts/lib/goods-relevance.mjs, which owns the
 * ACT-GD tag, so for Goods this script only ever adds the tag.
 *
 * WHY BOTH. The keyword lists in scripts/lib/project-relevance.mjs find grants
 * whose WORDING matches ours. They cannot find a grant that describes the same
 * work in different words, and that failure is invisible — a threshold scorer
 * never shows you what it rejected. Measured 2026-09-21: 383 open grants, only
 * 19 tagged to any ACT project, and among the rejected 364 were two $5M NSW
 * youth-crime rounds (scored 2/30) and a $20M Victorian bail-and-remand program
 * (8/30). Two of the three were fixable by adding phrases; the third class —
 * "Visions of Australia", whose text reads "development and touring of quality
 * exhibitions" — is not reachable by any substring that does not also drag in
 * craft fairs and orchestra tours. That class is what this script is for.
 *
 * WHAT IS ASKED. One request per grant, carrying one Score question per project
 * on a four-level rubric, plus one Noul that screens out the scholarship and
 * individual-award noise that fills this table.
 *
 * WHAT STAYS IN CODE, DELIBERATELY. Geography, deadlines, amounts and entity
 * eligibility are never asked of the model — it "reads dates as text, not as
 * ordered quantities", cannot judge whether two values are near each other, and
 * is not a calculator. Geography is resolved here from ACT_PROJECTS' operating
 * areas and stored as `geography_excluded`, so the score stays visible while the
 * tag does not fire.
 *
 * WRITES, into the existing project_relevance jsonb (no migration needed):
 *   project_relevance.<project>.rubric = { score, confidence, geography_excluded? }
 *   project_relevance.rubric_meta      = { organisation_fundable, model, scored_at }
 * Tagging is then done by applyProjectTags, which ORs the two signals and records
 * `tagged_by: keyword | rubric | both` so a rubric-only tag is never mistaken for
 * the keyword scorer having started to hallucinate.
 *
 * Usage:
 *   node --env-file=.env scripts/score-project-rubric.mjs --dry-run       # open grants, no writes
 *   node --env-file=.env scripts/score-project-rubric.mjs --apply
 *   node --env-file=.env scripts/score-project-rubric.mjs --apply --all-time --limit=2000
 *
 * Cost, measured: ~1,600 input tokens per grant at $0.042/M => about $0.03 per
 * 400 grants. Scoring all 26,840 rows would be roughly $1.80.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete, logFailed } from './lib/log-agent-run.mjs';
import {
  scoreGrantForProject, applyProjectTags, PROJECT_CODES,
  RUBRIC_FIT_AT, RUBRIC_CONFIDENCE_AT,
} from './lib/project-relevance.mjs';
import { goodsRubricQualifies } from './lib/goods-relevance.mjs';
import { loadWrongProjectVerdicts, humanNoFor, enforceHumanVerdicts } from './lib/human-verdicts.mjs';

const arg = (k, d) => { const a = process.argv.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const APPLY = process.argv.includes('--apply');
const DRY = !APPLY;
const ALL_TIME = process.argv.includes('--all-time');
const LIMIT = parseInt(arg('limit', '400'), 10);
const CONCURRENCY = parseInt(arg('concurrency', '4'), 10);
const MODEL = arg('model', 'jev-latest');
const RESCORE = process.argv.includes('--rescore');

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
const log = (m) => console.log(`[project-rubric] ${m}`);

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Prose descriptions of each project, so the rubric is readable rather than a
 * keyword list. Sourced from ACT_PROJECTS in apps/web/src/lib/act-grant-eligibility.ts
 * ("Ben's answers of 2026-09-14") and the tier-1 sets in project-relevance.mjs.
 * `area` is applied in CODE below, never asked of the model.
 */
const PROJECTS = {
  // Goods joined 2026-09-24. Its tag (ACT-GD) is owned by score-goods-relevance.mjs, so here the
  // rubric only ever ADDS it (see the write below); applyGoodsTag counts this verdict on every pass.
  goods: {
    what: 'Goods on Country supplies essential household goods — beds, bedding, mattresses, whitegoods, washing machines, furniture — into remote Aboriginal and Torres Strait Islander communities, alongside community stores, remote housing and community infrastructure. It is Aboriginal-community-controlled in its delivery and works on self-determination and Closing the Gap terms.',
    area: { national: false, states: ['NT', 'QLD', 'WA'] },
  },
  justicehub: {
    what: 'JusticeHub works on youth justice: justice reinvestment, diversion and diversionary programs, restorative justice, bail support, throughcare, youth mentoring, and reducing youth detention, recidivism and reoffending. It does NOT mean environmental, climate or economic justice.',
    area: { national: true, states: [] },
  },
  'empathy-ledger': {
    what: 'Empathy Ledger is a consent-based storytelling platform: lived-experience and digital storytelling, oral history, narrative evidence, community voice and Indigenous data sovereignty, where the storyteller keeps control of their story. It has nothing to do with accounting or bookkeeping ledgers.',
    area: { national: true, states: [] },
  },
  harvest: {
    what: 'The Harvest is community food work: food security, food relief and rescue, community gardens, community kitchens, urban agriculture and food sovereignty. It does not mean a wine or grape harvest, or a harvest festival.',
    area: { national: false, states: ['QLD'] },
  },
  farm: {
    what: 'The Farm is regenerative agriculture: regenerative and sustainable farming, agroforestry, landcare, soil health, revegetation, catchment work, farm biodiversity and natural capital. It does not mean a wind farm, solar farm, server farm or fish farm.',
    area: { national: false, states: ['QLD'] },
  },
  contained: {
    what: 'Contained is a shipping-container based touring exhibition: immersive installations and pop-up or mobile exhibitions that travel to communities. It does not mean a study tour, sports tour, concert tour, or tourism operation.',
    area: { national: true, states: [] },
  },
};

const LEVELS = [
  'No connection. The grant funds something unrelated to this work.',
  'Adjacent. Same broad sector, but the grant does not fund what this project actually does.',
  'Plausible. This project could write a credible application without stretching the truth.',
  "Strong. The grant's stated purpose directly matches what this project does.",
];

const QUESTIONS = (() => {
  const q = {
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
    q[`fit_${key}`] = {
      type: 'score',
      instructions: `Rate how well this funding opportunity fits the following project.\n\nPROJECT: ${p.what}\n\nJudge the THEME AND PURPOSE only. Ignore geography, deadlines, dollar amounts and the applicant's legal structure — those are checked separately.`,
      criteria: LEVELS,
    };
  }
  return q;
})();

/**
 * Geography gate, in code. Unknown geography PASSES — better a review than a
 * silent drop, since silent drops are the failure this whole script exists to fix.
 *
 * Two rules, in order:
 *  1. Overseas. A grant whose geography names a place and never mentions Australia
 *     is excluded for EVERY project, including the national ones. Found the hard
 *     way: "Mazda Foundation (NZ) Grants" (geography 'NZ') was tagged for Contained,
 *     because Contained is national and the per-project state check never ran.
 *     Note 'International, AU-National, AU-QLD, ...' DOES mention Australia and
 *     correctly survives.
 *  2. Out of state, for the projects scoped to one.
 */
function geographyExcluded(project, grant) {
  const geo = String(grant.geography || '').toUpperCase();
  if (!geo.trim()) return false;

  const mentionsAustralia = /\bAU\b|\bAU-|AUSTRALIA|NATIONAL|ALL STATES/.test(geo);
  if (!mentionsAustralia) return true;

  const area = PROJECTS[project].area;
  if (area.national) return false;
  if (/NATIONAL|AUSTRALIA[- ]WIDE|ALL STATES/.test(geo)) return false;
  return !area.states.some(s => geo.includes(s));
}

/**
 * The questions a row still needs. A row read before Goods joined carries the other five verdicts;
 * it is asked only about Goods, so those verdicts never move (JEV wobbles near the line, and a
 * re-ask could tag and untag a grant across nights).
 */
function questionsFor(grant) {
  const rel = grant.project_relevance || {};
  if (RESCORE || !rel.rubric_meta) return QUESTIONS;
  return Object.fromEntries(Object.keys(PROJECTS)
    .filter((p) => !rel[p]?.rubric)
    .map((p) => [`fit_${p}`, QUESTIONS[`fit_${p}`]]));
}

async function askJev(grant, questions, attempt = 0) {
  // Keep state tight: "context rot" is documented — unrelated detail distracts.
  const state = {
    grant_name: grant.name,
    funder: grant.provider || 'unknown',
    description: String(grant.description || '').slice(0, 3000),
    categories: grant.categories || [],
    focus_areas: grant.focus_areas || [],
  };
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.JEV_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, state, questions }),
    signal: AbortSignal.timeout(60000),
  });
  if (res.status === 429 || res.status === 529) {
    if (attempt >= 4) throw new Error(`${res.status} after retries`);
    await new Promise(r => setTimeout(r, 2 ** attempt * 1000));
    return askJev(grant, questions, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function main() {
  if (!process.env.JEV_API_KEY) { console.error('JEV_API_KEY missing from env'); process.exit(1); }
  // logStart returns a ROW ({ id }), not a bare id, and returns { id: null } when the
  // insert fails under pooler stress. Both logComplete and logFailed no-op on a null id.
  const run = await logStart(supabase, 'score-project-rubric', 'Project rubric scorer (JEV)');
  const runId = run?.id ?? null;

  try {
    let q = supabase.from('grant_opportunities')
      .select('id, name, provider, description, categories, focus_areas, geography, aligned_projects, project_relevance, goods_relevance_score, goods_relevance_signals, source, closes_at, deadline')
      .order('id')
      .limit(LIMIT);
    if (!ALL_TIME) {
      const today = new Date().toISOString().slice(0, 10);
      q = q.or(`closes_at.gte.${today},deadline.gte.${today}`);
    }
    // Unscored rows are chosen in SQL, before the limit. Filtering after it (only) meant that once
    // the open pool passed LIMIT, the nightly run fetched LIMIT already-scored rows and never saw
    // the new ones (2026-09-24: 333 open, so close).
    // A row with no Goods verdict has either never been read, or was read before Goods joined.
    if (!RESCORE) q = q.is('project_relevance->goods->rubric', null);
    const { data: grants, error } = await q;
    if (error) throw error;
    // Ben's "not a fit" passes on the desk: Jev may score those grants, but the rejected tags stay off.
    const verdicts = await loadWrongProjectVerdicts(supabase);
    for (const g of grants) g.human_no = humanNoFor(verdicts, g.id);

    // Incremental by default: skip rows that already carry a rubric verdict.
    //
    // This is LOAD-BEARING, not just a cost saving. JEV's scores wobble slightly
    // between identical runs, and RUBRIC_FIT_AT sits in a region where several
    // grants land within ~0.1 of the line — three dry runs over the same 383 rows
    // produced 8, 9 and 10 tags. Scoring each grant ONCE means a grant cannot tag
    // and untag itself across nightly runs and churn the desk. Use --rescore only
    // deliberately, e.g. after changing the rubric wording or the threshold, and
    // expect a handful of boundary rows to move.
    const todo = RESCORE ? grants : grants.filter(g => !g.project_relevance?.goods?.rubric);
    log(`${grants.length} in scope; ${todo.length} to score (${DRY ? 'DRY RUN' : 'APPLY'})`);

    const stats = { ok: 0, failed: 0, tokens: 0, ms: [], added: [], removed: [],
      goods: { read: 0, fit: 0, alreadyTagged: 0, outsideArea: 0, blocked: 0 } };
    let cursor = 0;

    async function worker() {
      while (cursor < todo.length) {
        const g = todo[cursor++];
        const t0 = Date.now();
        try {
          const questions = questionsFor(g);
          const json = await askJev(g, questions);
          stats.ms.push(Date.now() - t0);
          stats.tokens += json.usage?.input_tokens || 0;

          const at = new Date().toISOString();
          const relevance = { ...(g.project_relevance || {}) };
          if (questions.fundable_by_an_organisation) {
            relevance.rubric_meta = {
              organisation_fundable: json.answers?.fundable_by_an_organisation?.noul ?? null,
              model: json.model || MODEL,
              scored_at: at,
            };
          }
          for (const project of Object.keys(PROJECTS)) {
            if (!questions[`fit_${project}`]) continue;
            const a = json.answers?.[`fit_${project}`];
            relevance[project] = {
              ...(relevance[project] || {}),
              rubric: {
                score: a?.score ?? null,
                confidence: a?.confidence ?? null,
                ...(geographyExcluded(project, g) ? { geography_excluded: true } : {}),
              },
            };
          }

          // Re-run the keyword scorer over the same row so both signals are fresh,
          // then let applyProjectTags OR them together.
          const results = {};
          for (const project of Object.keys(PROJECT_CODES)) results[project] = scoreGrantForProject(project, g);
          const { tagged, changes, relevance: merged } = applyProjectTags({ ...g, project_relevance: relevance }, results, at);

          // Goods: ADD on the rubric, never remove here. score-goods-relevance.mjs owns removal (it also
          // weighs the keyword score and leaves manual rows alone) and ORs this verdict via applyGoodsTag,
          // so its next pass keeps the tag.
          let goodsSignals = null;
          const gr = merged.goods?.rubric;
          if (questions.fit_goods) {
            stats.goods.read++;
            if ((gr?.score ?? 0) >= RUBRIC_FIT_AT && (gr?.confidence ?? 0) >= RUBRIC_CONFIDENCE_AT) {
              stats.goods.fit++;
              if (tagged.includes('ACT-GD')) stats.goods.alreadyTagged++;
              else if (gr.geography_excluded) stats.goods.outsideArea++;
              else if (!goodsRubricQualifies(merged)) stats.goods.blocked++;
            }
          }
          if (goodsRubricQualifies(merged) && !tagged.includes('ACT-GD') && !g.human_no.includes('ACT-GD')) {
            tagged.push('ACT-GD');
            if (!tagged.includes('goods')) tagged.push('goods');
            goodsSignals = {
              ...(g.goods_relevance_signals || {}),
              tagged_by: 'rubric',
              tag_change: { change: 'added', at, previous_score: g.goods_relevance_score ?? null, score: g.goods_relevance_score ?? null, by: 'rubric' },
            };
            stats.added.push(`goods(rubric):${g.name?.slice(0, 55)}`);
          }

          for (const [project, c] of Object.entries(changes)) {
            (c.change === 'added' ? stats.added : stats.removed).push(`${project}(${c.by}):${g.name?.slice(0, 55)}`);
          }

          if (APPLY) {
            const { error: upErr } = await supabase.from('grant_opportunities')
              .update({ project_relevance: merged, aligned_projects: tagged, project_relevance_scored_at: at, ...(goodsSignals ? { goods_relevance_signals: goodsSignals } : {}) })
              .eq('id', g.id);
            if (upErr) throw upErr;
          }
          stats.ok++;
          if (stats.ok % 50 === 0) log(`${stats.ok + stats.failed}/${todo.length}…`);
        } catch (e) {
          stats.failed++;
          log(`FAIL ${g.id}: ${String(e.message).slice(0, 110)}`);
        }
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    const enforced = await enforceHumanVerdicts(supabase, verdicts, { apply: APPLY });

    const lat = stats.ms.sort((a, b) => a - b);
    console.log('\n=== SUMMARY ===');
    console.log(`scored: ${stats.ok}  failed: ${stats.failed}  ${DRY ? '(DRY RUN — nothing written)' : '(applied)'}`);
    if (lat.length) console.log(`latency p50=${lat[Math.floor(lat.length * 0.5)]}ms p95=${lat[Math.floor(lat.length * 0.95)]}ms`);
    console.log(`tokens: ${stats.tokens.toLocaleString()} -> $${(stats.tokens * 42 / 1e9).toFixed(4)}`);
    console.log(`rubric gates: fit>=${RUBRIC_FIT_AT}, confidence>=${RUBRIC_CONFIDENCE_AT}`);
    console.log(`human verdicts: ${verdicts.size} grants carry a "not a fit" pass; tags removed now: ${enforced.length}${enforced.length ? '  ' + enforced.slice(0, 10).join(' · ') : ''}`);
    const gs = stats.goods;
    console.log(`goods: ${gs.read} read, ${gs.fit} rated a fit: ${gs.alreadyTagged} already tagged, ${gs.outsideArea} outside NT/QLD/WA, ${gs.blocked} blocked (organisation-fundable or generic programme)`);
    console.log(`\nTags added (${stats.added.length}):`);
    for (const a of stats.added) console.log(`  + ${a}`);
    if (stats.removed.length) {
      console.log(`\nTags removed (${stats.removed.length}):`);
      for (const r of stats.removed) console.log(`  - ${r}`);
    }

    await logComplete(supabase, runId, { items_found: stats.ok, items_new: stats.added.length });
  } catch (e) {
    await logFailed(supabase, runId, e);
    throw e;
  }
}

main().catch(e => { console.error(e); process.exit(1); });
