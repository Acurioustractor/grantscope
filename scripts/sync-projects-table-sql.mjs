#!/usr/bin/env node
/**
 * Generate the SQL that brings the Supabase `projects` table in line with act-global's
 * config/project-codes.json, the one source of truth for project codes (Ben, 2026-09-26).
 *
 * The file wins on: status, name, parent_project and metadata.legacy_codes. Descriptions and tiers are
 * left alone: the table's are richer (its tiers include engine, campaign, community and art, which the
 * file flattens to background; syncing them would have rewritten 48 of 81 on 2026-09-26). New codes take
 * the file's tier. Codes only in the
 * file are inserted under the ACT organisation. Codes only in the table are never deleted (other tables
 * key on project codes): they are set archived, with metadata.merged_into when the file lists them as
 * a legacy code of another project.
 *
 *   node --env-file=.env scripts/sync-projects-table-sql.mjs [--file <path to project-codes.json>] > migration.sql
 * Prints SQL only; apply it as a migration through scripts/db-apply.sh.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

const TABLE_TIERS = new Set(['engine', 'campaign', 'community', 'art', 'ecosystem', 'studio', 'satellite', 'background']);
const q = (v) => (v == null ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

export function plan(fileProjects, tableRows) {
  const table = new Map(tableRows.map((r) => [r.code, r]));
  const legacyOf = new Map();
  for (const [code, p] of Object.entries(fileProjects)) for (const l of p.legacy_codes ?? []) legacyOf.set(l, code);
  const updates = [], inserts = [], retires = [];
  for (const [code, p] of Object.entries(fileProjects)) {
    const t = table.get(code);
    const want = { name: p.name, status: p.status, tier: TABLE_TIERS.has(p.tier) ? p.tier : null, parent: p.parent_project ?? null, legacy: p.legacy_codes ?? [] };
    if (!t) inserts.push({ code, ...want, category: p.category ?? null, description: p.description ?? null });
    else if (t.name !== want.name || t.status !== want.status || (t.parent_project ?? null) !== want.parent
      || JSON.stringify(t.metadata?.legacy_codes ?? []) !== JSON.stringify(want.legacy)) updates.push({ code, ...want });
  }
  for (const t of tableRows) if (!(t.code in fileProjects) && (t.status !== 'archived' || (legacyOf.has(t.code) && !t.metadata?.merged_into))) retires.push({ code: t.code, merged_into: legacyOf.get(t.code) ?? null });
  return { updates, inserts, retires };
}

export function toSql({ updates, inserts, retires }, orgId) {
  const out = [];
  // Parents first: an insert can name a parent that is itself being inserted.
  const ordered = [...inserts].sort((a, b) => (a.parent ? 1 : 0) - (b.parent ? 1 : 0));
  for (const i of ordered) out.push(`INSERT INTO projects (code, name, status, tier, category, description, parent_project, organization_id, act_project_code, metadata)
  VALUES (${q(i.code)}, ${q(i.name)}, ${q(i.status)}, ${q(i.tier)}, ${q(i.category)}, ${q(i.description)}, ${q(i.parent)}, ${q(orgId)}, ${q(i.code)}, jsonb_build_object('legacy_codes', ${q(JSON.stringify(i.legacy))}::jsonb, 'synced_from', 'project-codes.json'));`);
  for (const u of updates) out.push(`UPDATE projects SET name = ${q(u.name)}, status = ${q(u.status)}, parent_project = ${q(u.parent)},
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('legacy_codes', ${q(JSON.stringify(u.legacy))}::jsonb, 'synced_from', 'project-codes.json'), updated_at = now()
  WHERE code = ${q(u.code)};`);
  for (const r of retires) out.push(`UPDATE projects SET status = 'archived', updated_at = now(),
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('retired', 'not in project-codes.json'${r.merged_into ? `, 'merged_into', ${q(r.merged_into)}` : ''})
  WHERE code = ${q(r.code)};`);
  return out.join('\n');
}

async function main() {
  const fileArg = process.argv.indexOf('--file');
  const file = fileArg > -1 ? process.argv[fileArg + 1] : '/Users/benknight/Code/act-global-infrastructure/config/project-codes.json';
  const projects = JSON.parse(readFileSync(file, 'utf8')).projects;
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await db.from('projects').select('code, name, status, tier, parent_project, metadata, organization_id');
  if (error) throw new Error(error.message);
  const orgs = [...new Set(data.map((r) => r.organization_id))];
  if (orgs.length !== 1) throw new Error(`expected one organisation in projects, found ${orgs.length}`);
  const p = plan(projects, data);
  console.error(`updates ${p.updates.length}, inserts ${p.inserts.length} (${p.inserts.map((i) => i.code).join(', ')}), retires ${p.retires.length} (${p.retires.map((r) => r.code + (r.merged_into ? '->' + r.merged_into : '')).join(', ')})`);
  console.log(toSql(p, orgs[0]));
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
