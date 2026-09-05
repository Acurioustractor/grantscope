#!/usr/bin/env node
/**
 * Build the schema_ownership seed: one row per public relation, owner + consumers + evidence.
 *
 *   node --env-file=.env scripts/build-schema-ownership-seed.mjs [--siblings ~/Code] [--out supabase/migrations/<version>_schema_ownership_seed.sql]
 *
 * Owner is decided in this order, and the rule used is written into the evidence column so a wrong row can be
 * argued with rather than guessed at:
 *   1. an existing schema_ownership row keeps its owner (the 18 hand-declared rows of 2026-08-30)
 *   2. a name-prefix rule (the table below; ACT-private prefixes first because that is the boundary that matters)
 *   3. exactly one repo's migrations CREATE the object
 *   4. exactly one repo's code references the object
 *   5. 'unknown'
 * Consumers are the repos whose code (not migrations, not generated types) references the name.
 *
 * Sibling repos are found next to this one: ../JusticeHub, ../empathy-ledger-v2, ../act-global-infrastructure,
 * "../The Harvest Website", ../act-regenerative-studio. Missing repos are skipped and named in the header.
 * Re-runnable; the output is idempotent SQL (ON CONFLICT keeps the existing owner, refreshes consumers + evidence).
 */
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sibArg = process.argv.indexOf('--siblings');
// Sibling repos: --siblings <dir>, else $ACT_CODE_DIR, else the folder above this repo (wrong inside a scratch worktree).
const PARENT = sibArg > -1 ? path.resolve(process.argv[sibArg + 1]) : (process.env.ACT_CODE_DIR ? path.resolve(process.env.ACT_CODE_DIR) : path.resolve(ROOT, '..'));
const TODAY = new Date().toLocaleDateString('en-CA'); // local date (AEST), not UTC
const outArg = process.argv.indexOf('--out');
const OUT = outArg > -1 ? process.argv[outArg + 1] : `supabase/migrations/${TODAY.replace(/-/g, '')}140000_schema_ownership_seed.sql`;

const REPOS = {
  grantscope: { owner: 'grantscope', code: ['apps/web/src', 'scripts'], ddl: ['supabase/migrations', 'supabase/migrations_history'], root: ROOT },
  justicehub: { owner: 'justicehub', code: ['src', 'scripts'], ddl: ['supabase/migrations'], root: path.join(PARENT, 'JusticeHub') },
  'empathy-ledger': { owner: 'empathy-ledger', code: ['src', 'scripts'], ddl: [], root: path.join(PARENT, 'empathy-ledger-v2') },
  act: { owner: 'act', code: ['scripts', 'apps/command-center/src', 'apps/website/src', 'api'], ddl: ['supabase/migrations'], root: path.join(PARENT, 'act-global-infrastructure') },
  harvest: { owner: 'harvest', code: ['src'], ddl: ['supabase/migrations'], root: path.join(PARENT, 'The Harvest Website') },
  studio: { owner: 'studio', code: ['src', 'scripts'], ddl: ['supabase/migrations'], root: path.join(PARENT, 'act-regenerative-studio') },
};

// First match wins. ACT-private first: that boundary is the one a wrong answer leaks across.
const PREFIX_RULES = [
  [/^(xero_|ghl_|linkedin_|communications_|email_|receipt|act_|project_knowledge|project_pipelines|project_funding_|projects$|imessage|voice_notes|calendar_|financial_|subscriptions$|pending_subscriptions|grant_applications?$|grant_application_|daily_reflections|memory_|archival_|pmpp_|agent_proposals|agent_actions|agent_audit_log|canonical_entities|entity_identifiers|contact_project_links|entity_potential_matches|funder_context_snapshot|coe_|partner_storytellers|goods_|social_posts|newsletter_|supporters|comms_|relationship_health|funding_ghl|meeting|gmail_|dext|money_stack|v_act_|v_goods_|v_project_|v_canonical|v_newsletter|v_contact|v_enriched|v_awaiting|v_need_to|v_activity|v_calendar|v_pending|v_outstanding|v_monthly|v_cashflow|v_data_quality|v_entity_resolution|v_funder_summary|v_funder_next|missing_|unused_|unreconciled|consolidation|accounting_|subscription_|current_knowledge|coordinating|delegated|pending_extractions|pending_proposals|enrichment_ready)/, 'act'],
  [/^(harvest_|app_users$|v_harvest)/, 'harvest'],
  [/^(stories$|storytellers$|media_assets$|media$|transcripts$|galleries|gallery_|quotes$|tour_stories|story_|storyteller_|portraits$|consent_|el_|empathy)/, 'empathy-ledger'],
  [/^(media_items|knowledge_extraction_queue|enrichment_reviews|sprint_snapshots|gmail_auth_tokens|ghl_contact_project_mappings|content_blocks|content_items|wiki_|project_media_links|media_tags|tags$)/, 'studio'],
  [/^(abr_registry|asic_companies|asic_name_lookup|users$)/, 'shared'],
  [/^(alma_|jm_|justice_matrix|jr_|civic_|contained_|campaign_|services$|registered_services|organizations|organization_|public_profiles|profiles$|community_programs|youth_|qld_|coroners|parliament|watchhouse|detention|rogs_|closing_the_gap|ctg_|data_sufficiency|agent_task_queue|hub_|basecamp|justice_|court_|police_|legal_|sentencing|bail_|remand|funding_(programs|sources|awards|outcome|match|relationship|agent)|v_justice|v_state_ecosystem|v_ctg|v_acco|v_indigenous|v_youth|v_chain|v_alma|v_claim|v_data_sufficiency|v_jr_|v_funding_award|v_funding_outcomes|v_funding_pipeline|v_funding_program|mv_intervention|mv_justice|api_pricing|cost_snapshots|llm_usage)/, 'justicehub'],
  [/^(gs_|entity_xref|entity_aliases|acnc_|abr_|asic_|austender|political_|aec_|grantconnect|grant_|foundations$|foundation_|funder_|se_|social_enterprises|ndis_|postcode|seifa|lga_|sa[234]_|place_|mv_|person_|donor_|supplier_|charity_|charities|clarity_|civicscope|source_frontier|agent_runs|agent_registry|agent_schedules|agent_|saved_grants|org_profiles|org_members|org_projects|org_project_|org_contacts|opportunity_|report_|outcome_|governed_proof|evidence_|tracker_|api_keys|api_usage|product_events|page_views|schema_ownership|v_index_cost|v_charity|v_entity|v_funders|v_funder_tag|v_award|v_announced|v_grant_place|v_lga|v_org_funding|v_prf|v_catalog|v_data_catalog|v_data_health|v_mv_refresh|v_ndis|v_acnc|se_directory|canonical_organizations|justice_funding_clean|rankings|power_|influence|board_|nhmrc|research_grants|vic_grants|creative_australia|frrr|hms_|ato_|investor|pricing|briefing|alerts|alert_|watchlist|share_|embed|feedback|report_requests|ben_|answer_bank|grant_answer)/, 'grantscope'],
];

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env)'); process.exit(2); }
const sb = createClient(url, key);
async function sql(q) { const { data, error } = await sb.rpc('exec_sql', { query: q }); if (error) throw new Error(error.message); return data || []; }

const relations = await sql(`SELECT c.relname AS name, c.relkind AS kind, pg_total_relation_size(c.oid) AS bytes
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','m','v') ORDER BY 1`);
const existing = new Map((await sql(`SELECT object, owner, consumers FROM schema_ownership`)).map((r) => [r.object, r]));
const names = relations.map((r) => r.name);
const alternation = `\\b(${names.join('|')})\\b`;

function grepCounts(root, dirs, extra) {
  const present = dirs.map((d) => path.join(root, d)).filter((p) => existsSync(p));
  if (!present.length) return new Map();
  const cmd = `grep -rhoE ${extra} "${alternation}" ${present.map((p) => `'${p.replace(/'/g, "'\\''")}'`).join(' ')} 2>/dev/null | sort | uniq -c`;
  let out = '';
  try { out = execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: '/bin/bash' }); } catch (e) { out = e.stdout || ''; }
  const m = new Map();
  for (const line of out.split('\n')) { const mm = line.trim().match(/^(\d+)\s+(\S+)$/); if (mm) m.set(mm[2], Number(mm[1])); }
  return m;
}
const CODE_INC = `--include='*.ts' --include='*.tsx' --include='*.mjs' --include='*.js' --include='*.py' --exclude='database.types.ts' --exclude='*.d.ts' --exclude-dir=types --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=__tests__`;
const consumers = {}; const creators = {}; const skipped = [];
for (const [repo, cfg] of Object.entries(REPOS)) {
  if (!existsSync(cfg.root)) { skipped.push(repo); continue; }
  consumers[repo] = grepCounts(cfg.root, cfg.code, CODE_INC);
  // DDL creators: CREATE [OR REPLACE] [MATERIALIZED] TABLE|VIEW [IF NOT EXISTS] [public.]name
  const ddlDirs = cfg.ddl.map((d) => path.join(cfg.root, d)).filter((p) => existsSync(p));
  creators[repo] = new Set();
  if (ddlDirs.length) {
    const cmd = `grep -rhoiE "create (or replace )?(materialized )?(table|view)( if not exists)? +(public\\.)?\\"?[a-z_][a-z0-9_]*" ${ddlDirs.map((p) => `'${p}'`).join(' ')} 2>/dev/null | sed -E 's/.* //; s/\\"//g; s/^public\\.//' | tr 'A-Z' 'a-z' | sort -u`;
    let out = ''; try { out = execSync(cmd, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, shell: '/bin/bash' }); } catch (e) { out = e.stdout || ''; }
    for (const n of out.split('\n')) if (n.trim()) creators[repo].add(n.trim());
  }
}

const rows = []; const tally = {}; const ruleTally = {};
for (const r of relations) {
  const cons = Object.keys(consumers).filter((repo) => consumers[repo].has(r.name));
  const made = Object.keys(creators).filter((repo) => creators[repo].has(r.name));
  const refs = Object.keys(consumers).map((repo) => `${repo}:${consumers[repo].get(r.name) || 0}`).join(' ');
  let owner, rule;
  const ex = existing.get(r.name);
  if (ex) { owner = ex.owner; rule = 'declared 2026-08-30 (kept)'; }
  else {
    const hit = PREFIX_RULES.find(([re]) => re.test(r.name));
    if (hit) { owner = hit[1]; rule = 'prefix'; }
    else if (made.length === 1) { owner = REPOS[made[0]].owner; rule = 'sole creator'; }
    else if (cons.length === 1) { owner = REPOS[cons[0]].owner; rule = 'sole consumer'; }
    else { owner = 'unknown'; rule = made.length > 1 ? `creators disagree (${made.join(',')})` : cons.length > 1 ? `consumers disagree (${cons.join(',')})` : 'no evidence'; }
  }
  const consumerOwners = [...new Set(cons.map((repo) => REPOS[repo].owner))];
  if (ex && ex.consumers) for (const c of String(ex.consumers).split(',')) if (c && !consumerOwners.includes(c)) consumerOwners.push(c);
  const consumersStr = consumerOwners.sort().join(',');
  const evidence = `seed ${TODAY}: rule=${rule}; code refs ${refs}; created by ${made.length ? made.join(',') : 'none found'}; kind=${r.kind}; ${Math.round(r.bytes / 1048576)}MB`;
  rows.push({ object: r.name, owner, consumers: consumersStr, evidence });
  tally[owner] = (tally[owner] || 0) + 1; ruleTally[rule.split(' (')[0]] = (ruleTally[rule.split(' (')[0]] || 0) + 1;
}

const esc = (s) => String(s).replace(/'/g, "''");
const header = `-- ${path.basename(OUT)}
-- Generated ${TODAY} by scripts/build-schema-ownership-seed.mjs. NOT applied by the generating session; apply with
-- scripts/db-apply.sh on Ben's verb. Re-run the script rather than hand-editing rows; correct a wrong owner by adding a
-- prefix rule or by editing the row in the database (the ON CONFLICT clause keeps an existing owner).
--
-- ${relations.length} public relations. Owners: ${Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}
-- Rules used: ${Object.entries(ruleTally).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ')}
-- Consumers = repos whose code references the name (generated types excluded). Repos not found on this machine: ${skipped.length ? skipped.join(', ') : 'none'}.
-- The owner CHECK is widened from {justicehub, grantscope, shared, unknown} to add act, empathy-ledger, harvest, studio.

BEGIN;

ALTER TABLE public.schema_ownership DROP CONSTRAINT IF EXISTS schema_ownership_owner_check;
ALTER TABLE public.schema_ownership ADD CONSTRAINT schema_ownership_owner_check
  CHECK (owner = ANY (ARRAY['justicehub','grantscope','shared','unknown','act','empathy-ledger','harvest','studio']));

INSERT INTO public.schema_ownership (object, owner, consumers, evidence, declared_on) VALUES
`;
const values = rows.map((r) => `  ('${esc(r.object)}', '${r.owner}', '${esc(r.consumers)}', '${esc(r.evidence)}', '${TODAY}')`).join(',\n');
const footer = `
ON CONFLICT (object) DO UPDATE SET
  consumers = EXCLUDED.consumers,
  evidence = CASE WHEN schema_ownership.evidence IS NULL OR schema_ownership.evidence = '' THEN EXCLUDED.evidence ELSE schema_ownership.evidence || ' | ' || EXCLUDED.evidence END,
  declared_on = EXCLUDED.declared_on;

COMMIT;

-- Post-check: SELECT owner, count(*) FROM schema_ownership GROUP BY 1 ORDER BY 2 DESC;  -- expect ${relations.length} rows total
`;
writeFileSync(path.join(ROOT, OUT), header + values + footer);
console.log(`wrote ${OUT}: ${rows.length} rows`);
console.log('owners:', tally);
console.log('rules:', ruleTally);
if (skipped.length) console.log('skipped repos:', skipped.join(', '));
