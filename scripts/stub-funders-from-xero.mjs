#!/usr/bin/env node
/**
 * stub-funders-from-xero — append DATA-ONLY STUB entries to the ACT wiki
 * funders.json for every Xero ACCREC counterparty that isn't yet covered.
 *
 * Why this exists:
 *   - ACT pitches funders via `narrative-draft.mjs --funder <slug>` which
 *     reads from wiki/narrative/funders.json.
 *   - The Xero book of business has 34+ counterparties; the wiki narrative
 *     historically only covered ~15. Pitching the other ~20 fails because
 *     the slug doesn't exist.
 *   - This script reads xero_invoices, slugifies each contact_name, and
 *     appends a `needs-writeup` stub for any missing slug — preserving
 *     hand-written entries untouched.
 *
 * Idempotent: re-running only adds new slugs. Hand-written entries are
 * preserved verbatim. xero_summary on existing stubs is refreshed each
 * run so the financial numbers stay current.
 *
 * Usage:
 *   node --env-file=.env scripts/stub-funders-from-xero.mjs           # dry run, prints diff
 *   node --env-file=.env scripts/stub-funders-from-xero.mjs --apply   # writes funders.json
 *
 * Requires the act-global-infrastructure repo at the path below.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const ACT_INFRA = process.env.ACT_INFRA_PATH || '/Users/benknight/Code/act-global-infrastructure';
const FUNDERS_PATH = resolve(ACT_INFRA, 'wiki/narrative/funders.json');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function fmtMoney(n) {
  return n ? Math.round(Number(n)).toLocaleString() : '0';
}

async function main() {
  if (!existsSync(FUNDERS_PATH)) {
    console.error(`funders.json not found at ${FUNDERS_PATH}`);
    console.error('Set ACT_INFRA_PATH to override.');
    process.exit(1);
  }

  console.log(`Reading ${FUNDERS_PATH}`);
  const existing = JSON.parse(readFileSync(FUNDERS_PATH, 'utf8'));
  const existingSlugs = new Set(Object.keys(existing.funders ?? {}));
  const existingNames = new Set(
    Object.values(existing.funders ?? {}).map((f) => (f.name ?? '').toLowerCase()),
  );

  // Aggregate Xero ACCREC by contact_name
  const { data: xeroRaw } = await supabase
    .from('xero_invoices')
    .select('contact_name, total, status, date')
    .eq('type', 'ACCREC')
    .in('status', ['PAID', 'AUTHORISED']);

  const byContact = new Map();
  for (const row of xeroRaw ?? []) {
    if (!row.contact_name) continue;
    const k = row.contact_name;
    const agg = byContact.get(k) ?? {
      name: k,
      paid_total: 0,
      auth_total: 0,
      last_invoice_date: null,
    };
    if (row.status === 'PAID') agg.paid_total += Number(row.total ?? 0);
    else if (row.status === 'AUTHORISED') agg.auth_total += Number(row.total ?? 0);
    if (row.date && (!agg.last_invoice_date || row.date > agg.last_invoice_date)) {
      agg.last_invoice_date = row.date;
    }
    byContact.set(k, agg);
  }

  // Build proposed updates
  const today = new Date().toISOString().slice(0, 10);
  const additions = [];
  const refreshes = [];

  for (const [name, agg] of byContact) {
    const slug = slugify(name);
    const xeroSummary = {
      paid_total_aud: Math.round(agg.paid_total),
      outstanding_ar_aud: Math.round(agg.auth_total),
      last_invoice_date: agg.last_invoice_date,
    };

    if (existingSlugs.has(slug)) {
      // Refresh xero_summary on existing stub (preserve hand-written content)
      const cur = existing.funders[slug];
      if (cur.needs_writeup) {
        const prevSummary = cur.xero_summary;
        const changed = !prevSummary
          || prevSummary.paid_total_aud !== xeroSummary.paid_total_aud
          || prevSummary.outstanding_ar_aud !== xeroSummary.outstanding_ar_aud
          || prevSummary.last_invoice_date !== xeroSummary.last_invoice_date;
        if (changed) {
          refreshes.push({ slug, name, before: prevSummary, after: xeroSummary });
          if (APPLY) cur.xero_summary = xeroSummary;
        }
      }
      continue;
    }
    if (existingNames.has(name.toLowerCase())) continue; // slugify drift, skip

    const stub = {
      name,
      stage: 'needs-writeup',
      needs_writeup: true,
      themes: [],
      tone: 'TBD — write narrative based on existing Xero relationship history',
      claims_to_lead_with: [],
      framing_notes: `Auto-stubbed from xero_invoices on ${today}. Replace this stub with a hand-written brief: who this is, what we have done together, what we should ask for next. See xero_summary for the relationship financials.`,
      xero_summary: xeroSummary,
    };
    additions.push({ slug, stub });
    if (APPLY) existing.funders[slug] = stub;
  }

  console.log(`\n=== Stub plan ===`);
  console.log(`Xero counterparties: ${byContact.size}`);
  console.log(`Already in wiki:     ${byContact.size - additions.length}`);
  console.log(`New stubs to add:    ${additions.length}`);
  console.log(`Refresh xero_summary: ${refreshes.length}`);
  console.log('');

  if (additions.length > 0) {
    console.log('--- New stubs ---');
    for (const { slug, stub } of additions) {
      console.log(`  + ${slug}  (${stub.name})  paid=$${fmtMoney(stub.xero_summary.paid_total_aud)} auth=$${fmtMoney(stub.xero_summary.outstanding_ar_aud)}`);
    }
  }
  if (refreshes.length > 0) {
    console.log('\n--- Xero summary refreshes ---');
    for (const r of refreshes) {
      console.log(`  ~ ${r.slug}  paid: $${fmtMoney(r.before?.paid_total_aud)} → $${fmtMoney(r.after.paid_total_aud)}`);
    }
  }

  if (!APPLY) {
    console.log('\n[DRY RUN — no changes written. Re-run with --apply to write funders.json.]');
    return;
  }

  // Bump updated date
  existing.updated = today;
  writeFileSync(FUNDERS_PATH, JSON.stringify(existing, null, 2) + '\n', 'utf8');
  console.log(`\nWrote ${FUNDERS_PATH} (${additions.length} new stubs, ${refreshes.length} refreshes).`);
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
