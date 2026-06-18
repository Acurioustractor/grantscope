#!/usr/bin/env node
/**
 * person-disambig-probe — VERIFICATION GATE for person disambiguation.
 *
 * READ-ONLY. Splits a name-keyed person megamerge into candidate distinct
 * identities via a per-name co-director graph (+ geography), then reports
 * cluster shape, nominee-block detection, and money attribution per cluster.
 *
 * This is the gate that must pass BEFORE building the clustering migration.
 * It writes NOTHING to the database — pure SELECTs via exec_sql.
 *
 * Usage:
 *   node --env-file=.env scripts/person-disambig-probe.mjs                  # validation set
 *   node --env-file=.env scripts/person-disambig-probe.mjs "JANE DOE" ...   # ad-hoc names
 *
 * Signals (verified 2026-06-19): company_abn/acn/entity_id ~100%;
 * appointment_date ~0%, cessation_date 0% (temporal signal is DEAD).
 * So: shared co-directors + geography only.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---- tunable thresholds (the disambiguation contract) ----
const HIGH_DEGREE = 10;   // a co-director on >= this many of the target's boards = "block officer" → glues them all
const MIN_SHARED = 2;     // mid-degree co-directors: a pair of boards needs >= this many shared co-directors to merge
const NOMINEE_MIN = 20;   // a component >= this size with a dominant officer + postcode = trustee/nominee block
const DOMINANCE = 0.5;    // officer/postcode must cover >= this fraction of the component to flag nominee

const esc = (s) => s.replace(/'/g, "''");

async function q(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) throw new Error(error.message + '\n--SQL--\n' + sql);
  return data || [];
}

// exec_sql returns via PostgREST which caps at 1000 rows — page with an inner LIMIT/OFFSET.
// buildSql(limit, offset) must emit a stably-ORDERed query.
async function qPaged(buildSql) {
  const page = 1000; let offset = 0; const all = [];
  for (;;) {
    const rows = await q(buildSql(page, offset));
    all.push(...rows);
    if (rows.length < page) break;
    offset += page;
  }
  return all;
}

class UF {
  constructor() { this.p = new Map(); }
  add(x) { if (!this.p.has(x)) this.p.set(x, x); }
  find(x) {
    let r = x;
    while (this.p.get(r) !== r) r = this.p.get(r);
    while (this.p.get(x) !== r) { const n = this.p.get(x); this.p.set(x, r); x = n; }
    return r;
  }
  union(a, b) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

async function fetchName(name) {
  const n = esc(name);
  // roles + geography (entity_id ~100% populated)
  const roles = await qPaged((lim, off) => `
    SELECT pr.entity_id, pr.company_abn, e.canonical_name, e.entity_type, e.state, e.postcode
    FROM person_roles pr
    JOIN gs_entities e ON e.id = pr.entity_id
    WHERE pr.person_name_normalised = '${n}'
    ORDER BY pr.entity_id LIMIT ${lim} OFFSET ${off}`);
  // co-directors on those boards (this is the big one — must paginate)
  const codir = await qPaged((lim, off) => `
    SELECT pr.entity_id, pr.person_name_normalised AS codir
    FROM person_roles pr
    WHERE pr.entity_id IN (SELECT entity_id FROM person_roles WHERE person_name_normalised = '${n}')
      AND pr.person_name_normalised <> '${n}'
    ORDER BY pr.entity_id, codir LIMIT ${lim} OFFSET ${off}`);
  // money per entity (pre-aggregated in the MV; MAX to de-dup role rows)
  const money = await qPaged((lim, off) => `
    SELECT entity_id,
           MAX(justice_dollars) AS justice, MAX(procurement_dollars) AS procurement, MAX(donation_dollars) AS donation
    FROM mv_person_entity_network WHERE person_name_normalised = '${n}' GROUP BY entity_id
    ORDER BY entity_id LIMIT ${lim} OFFSET ${off}`);
  return { roles, codir, money };
}

function cluster(name, { roles, codir, money }) {
  const geo = new Map();   // entity -> {name,abn,type,state,postcode}
  for (const r of roles) geo.set(r.entity_id, r);
  const mny = new Map();   // entity -> {justice,procurement,donation}
  for (const m of money) mny.set(m.entity_id, m);

  // codir name -> Set(entity) within this target's boards
  const byCodir = new Map();
  for (const { entity_id, codir: c } of codir) {
    if (!byCodir.has(c)) byCodir.set(c, new Set());
    byCodir.get(c).add(entity_id);
  }

  const uf = new UF();
  for (const r of roles) uf.add(r.entity_id);

  // 1) block officers (high degree) glue all their boards together
  const blockOfficers = [];
  for (const [c, set] of byCodir) {
    if (set.size >= HIGH_DEGREE) {
      blockOfficers.push({ name: c, degree: set.size });
      const arr = [...set];
      for (let i = 1; i < arr.length; i++) uf.union(arr[0], arr[i]);
    }
  }
  // 2) mid-degree co-directors: pairs of boards merge only with >= MIN_SHARED corroborating co-directors
  const pairCount = new Map();
  for (const [, set] of byCodir) {
    if (set.size >= HIGH_DEGREE || set.size < 2) continue;
    const arr = [...set];
    for (let i = 0; i < arr.length; i++)
      for (let j = i + 1; j < arr.length; j++) {
        const k = arr[i] < arr[j] ? arr[i] + '|' + arr[j] : arr[j] + '|' + arr[i];
        pairCount.set(k, (pairCount.get(k) || 0) + 1);
      }
  }
  for (const [k, c] of pairCount) if (c >= MIN_SHARED) { const [a, b] = k.split('|'); uf.union(a, b); }

  // assemble components
  const comps = new Map();
  for (const r of roles) {
    const root = uf.find(r.entity_id);
    if (!comps.has(root)) comps.set(root, []);
    comps.get(root).push(r.entity_id);
  }

  const out = [];
  for (const [, ents] of comps) {
    const size = ents.length;
    let justice = 0, procurement = 0, donation = 0;
    const pcCount = new Map(), stateCount = new Map();
    for (const e of ents) {
      const m = mny.get(e); if (m) { justice += +m.justice || 0; procurement += +m.procurement || 0; donation += +m.donation || 0; }
      const g = geo.get(e);
      if (g?.postcode) pcCount.set(g.postcode, (pcCount.get(g.postcode) || 0) + 1);
      if (g?.state) stateCount.set(g.state, (stateCount.get(g.state) || 0) + 1);
    }
    // officers present on >=2 of this component's boards
    const entSet = new Set(ents);
    const officers = [];
    for (const [c, set] of byCodir) {
      let hits = 0; for (const e of set) if (entSet.has(e)) hits++;
      if (hits >= 2) officers.push({ name: c, hits });
    }
    officers.sort((a, b) => b.hits - a.hits);
    const topPc = [...pcCount.entries()].sort((a, b) => b[1] - a[1])[0];
    const topOfficer = officers[0];
    const pcWith = [...pcCount.values()].reduce((a, b) => a + b, 0);
    const isNominee = size >= NOMINEE_MIN
      && topOfficer && topOfficer.hits / size >= DOMINANCE
      && topPc && pcWith > 0 && topPc[1] / size >= DOMINANCE;
    const confidence = isNominee ? 'high' : size > 1 ? 'medium' : 'low';
    out.push({ size, justice, procurement, donation, ents, officers, topPc, topState: [...stateCount.entries()].sort((a, b) => b[1] - a[1])[0], isNominee, confidence, geo });
  }
  out.sort((a, b) => b.size - a.size);
  return { name, total: roles.length, comps: out, blockOfficers, geo, mny };
}

const fmt$ = (n) => n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : n ? `$${n}` : '';

function report(res) {
  const { name, total, comps, blockOfficers } = res;
  const nominees = comps.filter(c => c.isNominee);
  console.log(`\n${'='.repeat(72)}\n${name} — ${total} roles → ${comps.length} identities (${nominees.length} nominee block${nominees.length !== 1 ? 's' : ''})`);
  console.log(`  block officers (>=${HIGH_DEGREE} shared boards): ${blockOfficers.map(o => `${o.name}(${o.degree})`).join(', ') || 'none'}`);
  const singles = comps.filter(c => c.size === 1).length;
  console.log(`  largest=${comps[0]?.size}  multi-board identities=${comps.filter(c => c.size > 1).length}  singletons=${singles}`);
  console.log(`  ── top identities ──`);
  for (const c of comps.slice(0, 8)) {
    const off = c.officers.slice(0, 3).map(o => `${o.name}×${o.hits}`).join(', ');
    const m = [c.justice && `justice ${fmt$(c.justice)}`, c.procurement && `proc ${fmt$(c.procurement)}`, c.donation && `don ${fmt$(c.donation)}`].filter(Boolean).join(' ');
    console.log(`   [${c.confidence}${c.isNominee ? '/NOMINEE' : ''}] n=${c.size} ${c.topState ? c.topState[0] : '?'}/${c.topPc ? c.topPc[0] : '?'}  ${m}`);
    if (off) console.log(`        officers: ${off}`);
    if (c.size <= 3) for (const e of c.ents) { const g = res.geo.get(e); const mm = res.mny.get(e); const mv = mm ? [mm.justice > 0 && fmt$(+mm.justice) + ' just', mm.procurement > 0 && fmt$(+mm.procurement) + ' proc'].filter(Boolean).join(' ') : ''; console.log(`          · ${g?.canonical_name?.slice(0, 60)} (${g?.state || '?'} ${g?.postcode || ''}) ${mv}`); }
  }
  return { name, total, n_ids: comps.length, n_nominee: nominees.length, comps };
}

// ---- assertions (the gate) ----
function check(label, cond) { console.log(`   ${cond ? '✅ PASS' : '❌ FAIL'}  ${label}`); return !!cond; }

function gate(name, r) {
  console.log(`  ── assertions ──`);
  let ok = true;
  if (name === 'MARK SMITH') {
    ok &= check(`massive collapse: ${r.n_ids} identities ≪ 714`, r.n_ids < 100);
    const block = r.comps.find(c => c.isNominee && c.size > 500);
    ok &= check(`one nominee block > 500 boards (got ${block?.size ?? 'none'})`, !!block);
    // money split: SA Aboriginal D&A Council justice $3.45M must NOT be in the nominee block
    const saReal = r.comps.find(c => c.ents.some(e => abnOf(c, e) === '27890475461'));
    ok &= check(`SA justice $3.45M attributed to a NON-nominee identity`, saReal && !saReal.isNominee && saReal.justice > 3e6);
    const gp = r.comps.find(c => c.ents.some(e => abnOf(c, e) === '83090533174'));
    ok &= check(`Garnett Passe procurement sits IN the nominee block`, gp && gp.isNominee);
  } else if (name === 'JODI KENNEDY') {
    const block = r.comps.find(c => c.isNominee && c.size > 200);
    ok &= check(`one nominee block > 200 boards (got ${block?.size ?? 'none'})`, !!block);
  } else if (name === 'THARANI JEGATHEESWARAN') {
    ok &= check(`rare-name control resolves to few identities (got ${r.n_ids}, expect ≤2)`, r.n_ids <= 2);
    ok &= check(`control is NOT flagged nominee`, r.n_nominee === 0);
  }
  return !!ok;
}
// helpers to read an entity's abn within a component
function abnOf(comp, entity_id) { const g = comp.geo.get(entity_id); return g?.company_abn ? String(g.company_abn) : null; }

async function main() {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : ['MARK SMITH', 'JODI KENNEDY', 'THARANI JEGATHEESWARAN'];
  console.log(`person-disambig-probe — READ-ONLY gate`);
  console.log(`thresholds: HIGH_DEGREE=${HIGH_DEGREE} MIN_SHARED=${MIN_SHARED} NOMINEE_MIN=${NOMINEE_MIN} DOMINANCE=${DOMINANCE}`);
  let allOk = true;
  for (const name of names) {
    const data = await fetchName(name);
    const res = cluster(name, data);
    // attach geo/mny to each comp for assertion helpers
    for (const c of res.comps) { c.geo = res.geo; c.mny = res.mny; }
    const summary = report(res);
    allOk = gate(name, summary) && allOk;
  }
  console.log(`\n${allOk ? '✅ GATE PASSED' : '❌ GATE FAILED'}`);
  process.exit(allOk ? 0 : 1);
}

main().catch(e => { console.error(e.message); process.exit(1); });
