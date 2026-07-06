#!/usr/bin/env node
/**
 * draft-funders-json-from-wins — Phase 7 · Brick 5, the funders.json half.
 *
 * The scorer half of Brick 5 lives in the DB: `won` decisions in
 * `act_grant_recommendation_decisions` feed the `track_record_score` in the
 * `act_grant_recommendations` engine. This is the OTHER half — reflecting those
 * wins into ACT's real funder-relationship ledger,
 * `act-global-infrastructure/wiki/narrative/funders.json`.
 *
 * BOUNDARY (Ben's call, 2026-07-06): this NEVER writes to funders.json. That file
 * is a human-curated relationship system-of-record in a separate repo. This script
 * READS the wins + the current ledger and emits a reviewable PROPOSAL (printed +
 * a markdown file with paste-ready JSON patches). Ben applies + commits by hand.
 *
 * For each funder ACT has a `won` decision with, it proposes one of:
 *   - UPDATE an existing ledger entry: add the project_code to projects_funded,
 *     advance a pre-funded stage → 'active-partner', bump last_communicated_at.
 *   - ADD a new entry — but only for names that look like actual funders. Wins
 *     from commercial customers (Goods/Harvest sales) and community/partner orgs
 *     are surfaced as "review — probably not a philanthropic funder", not drafted
 *     as funder entries, so the ledger stays clean.
 *
 * Usage (read-only, always):
 *   node --env-file=.env scripts/draft-funders-json-from-wins.mjs
 *   node --env-file=.env scripts/draft-funders-json-from-wins.mjs --funders=/path/to/funders.json --out=/path/to/proposal.md
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const argv = process.argv.slice(2);
const argVal = (name, dflt) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : dflt;
};
const FUNDERS_PATH = argVal(
  'funders',
  '/Users/benknight/Code/act-global-infrastructure/wiki/narrative/funders.json',
);
const OUT_PATH = argVal(
  'out',
  'thoughts/shared/plans/funders-json-from-wins.proposal.md',
);

// ── name normalization + classification ──────────────────────────────────────
const norm = (s) =>
  (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[’'`]/g, '')
    .replace(/&/g, ' and ')
    .replace(/\b(pty|proprietary|ltd|limited|inc|incorporated|the)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** A funder we should draft an entry for, vs a customer/partner we should only flag. */
function classify(name) {
  const n = (name || '').toLowerCase();
  if (/\b(foundation|trust|fund\b|philanthrop|grants?)\b/.test(n)) return 'funder';
  if (/\b(government|department|dept|agency|council(?! aboriginal)|authority|commission)\b/.test(n))
    return 'government';
  if (/\b(aboriginal corporation|community company|community shed|health service|services aboriginal)\b/.test(n))
    return 'partner-or-community-org';
  if (/\b(pty|proprietary|ltd|limited|station|properties|holdings|studio|meats|obsession)\b/.test(n))
    return 'likely-customer';
  return 'unclear';
}

function bestMatch(wonName, ledger) {
  const target = norm(wonName);
  if (!target) return null;
  let best = null;
  for (const [slug, entry] of Object.entries(ledger.funders)) {
    for (const cand of [entry.name, slug.replace(/-/g, ' ')]) {
      const c = norm(cand);
      if (!c) continue;
      let score = 0;
      if (c === target) score = 100;
      else if (c.includes(target) || target.includes(c)) {
        // contains match — require the shorter to be a real word run, not 1-2 chars
        const shorter = c.length < target.length ? c : target;
        if (shorter.length >= 6) score = 80;
      }
      if (score > (best?.score ?? 0)) best = { slug, entry, score };
    }
  }
  return best && best.score >= 80 ? best : null;
}

const PRE_FUNDED_STAGES = new Set([
  'cold',
  'warm-cold',
  'warm',
  'ask-pending',
  'term-sheet-pending',
  'procurement-prospect',
  'lapsed',
]);

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // Wins, with the funder name from the alma opportunity + latest decision date.
  const { data: decisions, error } = await supabase
    .from('act_grant_recommendation_decisions')
    .select('project_code, opportunity_id, decided_at, alma_funding_opportunities!inner(funder_name, max_grant_amount)')
    .eq('decision', 'won');
  if (error) {
    console.error('query failed:', error.message);
    process.exit(1);
  }

  // Collapse to one row per funder_name with the set of projects + newest date.
  const byFunder = new Map();
  for (const d of decisions) {
    const fname = d.alma_funding_opportunities?.funder_name;
    if (!fname) continue;
    const key = norm(fname);
    if (!byFunder.has(key)) byFunder.set(key, { name: fname, projects: new Set(), lastAt: null, amount: 0 });
    const rec = byFunder.get(key);
    rec.projects.add(d.project_code);
    if (!rec.lastAt || (d.decided_at && d.decided_at > rec.lastAt)) rec.lastAt = d.decided_at;
    const amt = Number(d.alma_funding_opportunities?.max_grant_amount) || 0;
    if (amt > rec.amount) rec.amount = amt;
  }

  const ledger = JSON.parse(readFileSync(FUNDERS_PATH, 'utf8'));

  const updates = []; // matched existing entries needing a change
  const additions = []; // unmatched, look like real funders → propose new entry
  const flagged = []; // unmatched customers/partners → surface, don't draft

  for (const rec of byFunder.values()) {
    const projects = [...rec.projects].sort();
    const lastAt = rec.lastAt ? rec.lastAt.slice(0, 10) : null;
    const m = bestMatch(rec.name, ledger);
    if (m) {
      const e = m.entry;
      const changes = [];
      const missingProjects = projects.filter((p) => !(e.projects_funded || []).includes(p));
      if (missingProjects.length) changes.push({ field: 'projects_funded', add: missingProjects });
      if (PRE_FUNDED_STAGES.has(e.stage)) changes.push({ field: 'stage', from: e.stage, to: 'active-partner' });
      if (lastAt && (!e.last_communicated_at || lastAt > e.last_communicated_at))
        changes.push({ field: 'last_communicated_at', from: e.last_communicated_at || null, to: lastAt });
      if (changes.length) updates.push({ slug: m.slug, name: e.name, wonAs: rec.name, changes });
    } else {
      const cls = classify(rec.name);
      if (cls === 'funder' || cls === 'government') {
        additions.push({ name: rec.name, projects, lastAt, amount: rec.amount, cls });
      } else {
        flagged.push({ name: rec.name, projects, cls });
      }
    }
  }

  // ── console summary ─────────────────────────────────────────────────────────
  console.log(`=== draft-funders-json-from-wins · ${new Date().toISOString()} ===`);
  console.log(`Wins cover ${byFunder.size} distinct funders. Ledger has ${Object.keys(ledger.funders).length} entries.`);
  console.log(`Proposed: ${updates.length} updates · ${additions.length} new funder entries · ${flagged.length} flagged (not drafted).`);
  console.log(`READ-ONLY. Nothing written to funders.json. Proposal → ${OUT_PATH}\n`);
  for (const u of updates)
    console.log(`  UPDATE ${u.slug}: ${u.changes.map((c) => c.field + (c.add ? ` +${c.add.join(',')}` : ` → ${c.to}`)).join(' · ')}`);
  for (const a of additions) console.log(`  ADD    ${a.name} (${a.cls}) — projects ${a.projects.join(',')}`);
  for (const f of flagged) console.log(`  FLAG   ${f.name} (${f.cls}) — won for ${f.projects.join(',')}, review before adding`);

  // ── proposal file (paste-ready) ─────────────────────────────────────────────
  const slugify = (s) => norm(s).replace(/\s+/g, '-');
  const lines = [];
  lines.push('# funders.json — proposed updates from `won` grant decisions');
  lines.push('');
  lines.push(`_Generated ${new Date().toISOString()} by \`scripts/draft-funders-json-from-wins.mjs\`. Read-only draft — apply by hand in \`act-global-infrastructure\`._`);
  lines.push('');
  lines.push('## 1. Update existing ledger entries');
  if (!updates.length) lines.push('_None — all matched funders already reflect their wins._');
  for (const u of updates) {
    lines.push(`\n### \`${u.slug}\` — ${u.name}  _(won as "${u.wonAs}")_`);
    for (const c of u.changes) {
      if (c.field === 'projects_funded') lines.push(`- \`projects_funded\`: add ${c.add.map((x) => `\`${x}\``).join(', ')}`);
      else lines.push(`- \`${c.field}\`: \`${c.from ?? 'null'}\` → \`${c.to}\``);
    }
  }
  lines.push('');
  lines.push('## 2. New funder entries to consider (looked like real funders)');
  if (!additions.length) lines.push('_None._');
  for (const a of additions) {
    const entry = {
      name: a.name,
      stage: 'active-partner',
      themes: [],
      projects_funded: a.projects,
      last_communicated_at: a.lastAt || undefined,
      source_note: `Added from won grant decision (${a.cls}). Fill themes/contact before relying on it.`,
    };
    lines.push(`\n### \`${slugify(a.name)}\``);
    lines.push('```json');
    lines.push(`"${slugify(a.name)}": ${JSON.stringify(entry, null, 2)}`);
    lines.push('```');
  }
  lines.push('');
  lines.push('## 3. Flagged — a win, but probably NOT a philanthropic funder (do not add without review)');
  if (!flagged.length) lines.push('_None._');
  for (const f of flagged) lines.push(`- **${f.name}** _(${f.cls})_ — won for ${f.projects.join(', ')}. Likely a customer/partner, not a grantmaker.`);
  lines.push('');

  writeFileSync(OUT_PATH, lines.join('\n'));
  console.log(`\nWrote proposal: ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
