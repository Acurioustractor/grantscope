#!/usr/bin/env node
// One-off (and re-runnable) backfill: re-push partnership_inquiries rows
// where ghl_synced_at IS NULL into GoHighLevel.
//
// Usage:
//   node --env-file=.env scripts/backfill-partnership-ghl.mjs            # all pending
//   node --env-file=.env scripts/backfill-partnership-ghl.mjs <inquiry_id> # one row
//
// Mirrors the logic in apps/web/src/lib/services/partnership-ghl.ts —
// kept in plain JS so it runs without the Next.js build pipeline.

import { createClient } from '@supabase/supabase-js';

const GHL_API_URL = 'https://services.leadconnectorhq.com';
const PARTNERSHIP_TYPE_TAGS = {
  foundation_cofund: 'GS-Partner-FoundationCoFund',
  acco_bespoke: 'GS-Partner-ACCO',
  sector_peak: 'GS-Partner-SectorPeak',
  journalist: 'GS-Partner-Journalist',
  researcher: 'GS-Partner-Researcher',
  gov_oversight: 'GS-Partner-GovOversight',
  philanthropic_advisor: 'GS-Partner-PhilanthropicAdvisor',
  board_director: 'GS-Partner-BoardDirector',
  other: 'GS-Partner-Other',
};

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.GHL_API_KEY;
const locationId = process.env.GHL_LOCATION_ID;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing Supabase env'); process.exit(1); }
if (!apiKey || !locationId) { console.error('Missing GHL env'); process.exit(1); }

const targetId = process.argv[2];
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

async function pushOne(row) {
  const [firstName, ...rest] = (row.contact_name || '').split(' ');
  const lastName = rest.join(' ') || undefined;

  const tags = [
    'CivicGraph',
    'GS-Partnership',
    ...(row.partnership_types || []).map(t => PARTNERSHIP_TYPE_TAGS[t]).filter(Boolean),
    row.source_artefact ? `GS-Source-${row.source_artefact}` : null,
    row.budget_band ? `GS-Budget-${row.budget_band}` : null,
    row.timeline ? `GS-Timeline-${row.timeline}` : null,
  ].filter(Boolean);

  const upsertRes = await fetch(`${GHL_API_URL}/contacts/upsert`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Version: '2021-07-28' },
    body: JSON.stringify({
      locationId,
      email: row.contact_email,
      firstName,
      lastName,
      companyName: row.contact_org || undefined,
      phone: row.contact_phone || undefined,
      tags,
      source: row.source_artefact ? `CivicGraph Share Partner Form (${row.source_artefact})` : 'CivicGraph Share Partner Form',
    }),
  });
  if (!upsertRes.ok) {
    const detail = await upsertRes.text().catch(() => '');
    return { ok: false, status: upsertRes.status, detail };
  }
  const { contact } = await upsertRes.json();
  if (!contact?.id) return { ok: false, reason: 'no_contact_id' };

  const lines = [
    `[CivicGraph Partnership Inquiry · ${row.source_artefact || 'general'}]`,
    '',
    `From: ${row.contact_name} <${row.contact_email}>`,
  ];
  if (row.contact_org) lines.push(`Org: ${row.contact_org}${row.contact_role ? ` (${row.contact_role})` : ''}`);
  if (row.contact_phone) lines.push(`Phone: ${row.contact_phone}`);
  if (row.partnership_types?.length) lines.push(`Types: ${row.partnership_types.join(', ')}`);
  if (row.partnership_other) lines.push(`Other: ${row.partnership_other}`);
  if (row.budget_band) lines.push(`Budget: ${row.budget_band}`);
  if (row.timeline) lines.push(`Timeline: ${row.timeline}`);
  lines.push('', '---', '', row.message, '', '---', `Ref: ${row.id.slice(0, 8)}`);

  await fetch(`${GHL_API_URL}/conversations/messages/inbound`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', Version: '2021-07-28' },
    body: JSON.stringify({ type: 'Custom', contactId: contact.id, message: lines.join('\n') }),
  });
  return { ok: true, contactId: contact.id };
}

let q = db.from('partnership_inquiries').select('*').order('submitted_at', { ascending: true }).limit(200);
q = targetId ? q.eq('id', targetId) : q.is('ghl_synced_at', null);
const { data: rows, error } = await q;
if (error) { console.error('DB error:', error.message); process.exit(1); }
if (!rows?.length) { console.log('Nothing to backfill.'); process.exit(0); }

console.log(`Backfilling ${rows.length} row(s)…`);
let ok = 0, fail = 0;
for (const row of rows) {
  const r = await pushOne(row);
  if (r.ok) {
    await db.from('partnership_inquiries').update({ ghl_synced_at: new Date().toISOString(), ghl_contact_id: r.contactId }).eq('id', row.id);
    console.log(`  ✓ ${row.id.slice(0, 8)} ${row.contact_email} → ${r.contactId}`);
    ok++;
  } else {
    console.error(`  ✗ ${row.id.slice(0, 8)} ${row.contact_email} → ${r.status || r.reason || 'failed'} ${r.detail || ''}`);
    fail++;
  }
}
console.log(`\nDone. ${ok} succeeded, ${fail} failed.`);
process.exit(fail ? 1 : 0);
