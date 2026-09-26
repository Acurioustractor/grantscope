#!/usr/bin/env node
/**
 * Which ACT project codes are still alive? Evidence from code, judgement from Jev, final say Ben's.
 *
 * Codes come from both sources of truth that have drifted apart: act-global's config/project-codes.json
 * and the Supabase `projects` table. For each code, code measures when it last showed up in Xero, GHL,
 * the calendar, email and project knowledge, and turns each date into words, because Jev reads dates as
 * text and cannot order them (docs.typesafe.ai jaggedness, verified 2026-09-21). Jev then reads the
 * project's descriptions plus that evidence and picks one of: active, dormant, merged, ended.
 *
 * Read-only: writes one review sheet, nothing to any system.
 *   node --env-file=.env scripts/review-project-codes.mjs [--out thoughts/shared/drafts/...csv]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const FILE = '/Users/benknight/Code/act-global-infrastructure/config/project-codes.json';

/** A date as words Jev can read. Code does the arithmetic. */
export function recency(iso, now = new Date()) {
  if (!iso) return 'never';
  const days = Math.floor((now - new Date(iso)) / 86_400_000);
  if (days < 0) return 'scheduled in the future';
  if (days <= 90) return 'within the last 3 months';
  if (days <= 365) return 'between 3 and 12 months ago';
  if (days <= 730) return 'one to two years ago';
  return 'more than two years ago';
}

const CHOICES = {
  active: 'Still being worked on: recent money, meetings, messages or pipeline activity, or described as current.',
  dormant: 'Still a real project but quiet: no recent activity, not formally closed, could restart.',
  merged: 'Folded into another ACT project, or a duplicate code for a project that has another code.',
  ended: 'Finished, cancelled, a one-off event that is over, a test record, or never really started.',
};

async function main() {
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const sql = async (query) => { const { data, error } = await db.rpc('exec_sql', { query }); if (error) throw new Error(error.message); return data ?? []; };

  const file = JSON.parse(readFileSync(FILE, 'utf8')).projects;
  const table = new Map((await sql(`SELECT code, name, status, description FROM projects`)).map((r) => [r.code, r]));
  const codes = [...new Set([...Object.keys(file), ...table.keys()])].sort();

  const last = async (label, q) => new Map((await sql(q)).map((r) => [r.code, { at: r.at, n: Number(r.n) }]));
  const ev = {
    xero: await last('xero', `SELECT project_code AS code, max(d)::text AS at, count(*) FILTER (WHERE d > now() - interval '365 days') AS n FROM (
            SELECT project_code, date::timestamptz AS d FROM xero_transactions UNION ALL SELECT project_code, date::timestamptz FROM xero_invoices) x
            WHERE project_code IS NOT NULL GROUP BY 1`),
    ghl: await last('ghl', `SELECT project_code AS code, max(greatest(last_stage_change_at, last_status_change_at, ghl_updated_at))::text AS at,
            count(*) FILTER (WHERE status = 'open') AS n FROM ghl_opportunities WHERE sync_status = 'synced' AND project_code IS NOT NULL GROUP BY 1`),
    calendar: await last('calendar', `SELECT project_code AS code, max(start_time) FILTER (WHERE start_time <= now())::text AS at,
            count(*) FILTER (WHERE start_time > now()) AS n FROM calendar_events WHERE project_code IS NOT NULL GROUP BY 1`),
    email: await last('email', `SELECT project_code AS code, max(occurred_at)::text AS at, count(*) FILTER (WHERE occurred_at > now() - interval '365 days') AS n
            FROM communications_history WHERE project_code IS NOT NULL GROUP BY 1`),
    notes: await last('notes', `SELECT project_code AS code, max(created_at)::text AS at, count(*) AS n FROM (
            SELECT project_code, created_at FROM project_knowledge UNION ALL SELECT project_code, created_at FROM memory_episodes) x
            WHERE project_code IS NOT NULL GROUP BY 1`),
  };

  const others = codes.map((c) => `${c} ${file[c]?.name ?? table.get(c)?.name}`).join('; ');
  const rows = [];
  for (let i = 0; i < codes.length; i += 4) {
    rows.push(...await Promise.all(codes.slice(i, i + 4).map(async (code) => {
      const f = file[code], t = table.get(code);
      const evidence = Object.fromEntries(Object.entries(ev).map(([k, m]) => [k, recency(m.get(code)?.at)]));
      const counts = {
        xero_last_year: ev.xero.get(code)?.n ?? 0, ghl_open: ev.ghl.get(code)?.n ?? 0,
        calendar_upcoming: ev.calendar.get(code)?.n ?? 0, emails_last_year: ev.email.get(code)?.n ?? 0,
      };
      const state = {
        code, name: f?.name ?? t?.name,
        status_in_file: f?.status ?? 'not in the file', status_in_table: t?.status ?? 'not in the projects table',
        description: [f?.description, t?.description].filter(Boolean).join(' | ').slice(0, 1200),
        parent_project: f?.parent_project ?? null,
        last_activity: evidence,
        activity_counts: `${counts.xero_last_year} Xero lines in the last year; ${counts.ghl_open} open GHL opportunities; ${counts.calendar_upcoming} upcoming calendar events; ${counts.emails_last_year} emails in the last year`,
        all_act_projects: others,
      };
      const res = await fetch('https://api.typesafe.ai/v1/systemone', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.JEV_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'jev-latest', state, questions: {
          status: { type: 'choice', instructions: 'Is this ACT project code still alive? Judge from the evidence and descriptions.', criteria: CHOICES },
        } }),
        signal: AbortSignal.timeout(60_000),
      });
      const j = await res.json();
      const a = j.answers?.status ?? {};
      return { code, name: state.name, file: state.status_in_file, table: state.status_in_table, ...evidence, ...counts,
        jev: a.choice ?? 'error', confidence: a.confidence ?? 0, model: j.model };
    })));
  }

  const unsure = (r) => r.confidence < 0.8 || (r.jev === 'active') !== (r.file === 'active' || r.table === 'active');
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const cols = ['code', 'name', 'file', 'table', 'jev', 'confidence', 'xero', 'ghl', 'calendar', 'email', 'notes', 'xero_last_year', 'ghl_open', 'calendar_upcoming', 'emails_last_year'];
  const csv = [[...cols, 'ask_ben', 'ben_answer'].join(','), ...rows.map((r) => [...cols.map((c) => q(c === 'confidence' ? Number(r[c]).toFixed(2) : r[c])), unsure(r) ? 'yes' : '', ''].join(','))].join('\n') + '\n';
  const outArg = process.argv.find((a) => a.startsWith('--out='));
  const dest = outArg ? outArg.split('=')[1] : `thoughts/shared/drafts/${new Date().toISOString().slice(0, 10)}-project-code-review.csv`;
  writeFileSync(dest, csv);
  const tally = {}; for (const r of rows) tally[r.jev] = (tally[r.jev] ?? 0) + 1;
  console.log(`${rows.length} codes; Jev (${rows[0]?.model}): ${JSON.stringify(tally)}; ${rows.filter(unsure).length} to ask Ben; ${dest}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e.message); process.exit(1); });
