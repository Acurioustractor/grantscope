#!/usr/bin/env node

/**
 * Newsletter tag cleanup — folds stray newsletter tags into the allowed
 * comms:* set (scripts/lib/ghl-tag-registry.mjs) and removes dead
 * newsletter-stream:* relics.
 *
 *   goods-newsletter    → comms:goods-newsletter
 *   harvest-newsletter  → comms:harvest-newsletter
 *   newsletter          → comms:act-newsletter
 *   comms:newsletter    → comms:act-newsletter
 *   newsletter-stream:* → (removed)
 *
 * DRY RUN by default: writes a per-contact before/after report and touches
 * nothing. Pass --apply to write (Tier 2 — eyeball the report first).
 *
 * Safe rollout (avoid firing GHL tag-added workflow triggers):
 *   --max N          apply to at most N changed contacts (canary batch)
 *   --skip-harvest   leave contacts gaining comms:harvest-newsletter untouched
 *                    (published Harvest workflows exist; their triggers can't
 *                    be inspected via the public API — Ben checks in the UI)
 *
 * Usage: node --env-file=.env scripts/cleanup-newsletter-tags.mjs [--apply] [--max N] [--skip-harvest] [--report <path>]
 */

const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

if (!GHL_API_KEY || !GHL_LOCATION_ID) {
  console.error('FATAL: GHL_API_KEY / GHL_LOCATION_ID not set (run with `node --env-file=.env`)');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const SKIP_HARVEST = process.argv.includes('--skip-harvest');
const maxIdx = process.argv.indexOf('--max');
const MAX = maxIdx > -1 ? Number(process.argv[maxIdx + 1]) : Infinity;
const reportIdx = process.argv.indexOf('--report');
const REPORT_PATH =
  reportIdx > -1 ? process.argv[reportIdx + 1] : 'data/newsletter-tag-cleanup-report.txt';

const RENAMES = new Map([
  ['goods-newsletter', 'comms:goods-newsletter'],
  ['harvest-newsletter', 'comms:harvest-newsletter'],
  ['newsletter', 'comms:act-newsletter'],
  ['comms:newsletter', 'comms:act-newsletter'],
]);
const REMOVE_PREFIXES = ['newsletter-stream:'];

const headers = {
  Authorization: `Bearer ${GHL_API_KEY}`,
  Version: '2021-07-28',
  'Content-Type': 'application/json',
};

async function* allContacts() {
  let startAfterId = null;
  let startAfter = null;
  for (;;) {
    const url = new URL(`${GHL_BASE}/contacts/`);
    url.searchParams.set('locationId', GHL_LOCATION_ID);
    url.searchParams.set('limit', '100');
    if (startAfterId) {
      url.searchParams.set('startAfterId', startAfterId);
      url.searchParams.set('startAfter', String(startAfter));
    }
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GHL contacts HTTP ${res.status}`);
    const data = await res.json();
    const contacts = data.contacts || [];
    if (!contacts.length) return;
    yield* contacts;
    const last = contacts[contacts.length - 1];
    startAfterId = last.id;
    startAfter = last.dateAdded ? new Date(last.dateAdded).getTime() : null;
    if (contacts.length < 100) return;
  }
}

function transformTags(tags) {
  const out = new Set();
  const changes = [];
  // Bare `newsletter` defaults to the ACT list, but a contact whose other tags
  // say Harvest (harvest-website signup, project:act-hv) meant the Harvest one.
  const isHarvest = tags.some((raw) => {
    const t = raw.toLowerCase().trim();
    return t === 'project:act-hv' || t.startsWith('harvest') || t.startsWith('project-harvest');
  });
  for (const raw of tags) {
    const t = raw.toLowerCase().trim();
    if (REMOVE_PREFIXES.some((p) => t.startsWith(p))) {
      changes.push(`- ${raw}`);
      continue;
    }
    if ((t === 'newsletter' || t === 'comms:newsletter') && isHarvest) {
      changes.push(`~ ${raw} → comms:harvest-newsletter`);
      out.add('comms:harvest-newsletter');
      continue;
    }
    const renamed = RENAMES.get(t);
    if (renamed) {
      changes.push(`~ ${raw} → ${renamed}`);
      out.add(renamed);
      continue;
    }
    out.add(raw);
  }
  return { tags: [...out], changes };
}

const fs = await import('node:fs');
const lines = [];
let scanned = 0;
let touched = 0;
let applied = 0;
let failures = 0;
const changeCounts = new Map();

for await (const c of allContacts()) {
  scanned++;
  if (scanned % 500 === 0) console.log(`…${scanned} scanned`);
  const tags = c.tags || [];
  const { tags: newTags, changes } = transformTags(tags);
  if (!changes.length) continue;
  if (SKIP_HARVEST && newTags.includes('comms:harvest-newsletter') && !tags.includes('comms:harvest-newsletter')) {
    continue;
  }
  if (touched >= MAX) continue;
  touched++;
  for (const ch of changes) changeCounts.set(ch, (changeCounts.get(ch) || 0) + 1);
  lines.push(
    `${c.id}  ${c.email || c.phone || '(no contact point)'}\n  before: ${tags.join(', ')}\n  after:  ${newTags.sort().join(', ')}\n  ${changes.join(' · ')}\n`
  );
  if (APPLY) {
    const res = await fetch(`${GHL_BASE}/contacts/${c.id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ tags: newTags }),
    });
    if (res.ok) applied++;
    else {
      failures++;
      console.error(`FAILED ${c.id}: HTTP ${res.status}`);
    }
  }
}

const summary = [
  `${APPLY ? 'APPLY' : 'DRY RUN'} — ${new Date().toISOString()}`,
  `contacts scanned: ${scanned}`,
  `contacts with changes: ${touched}`,
  ...(APPLY ? [`applied: ${applied}`, `failures: ${failures}`] : []),
  '',
  'change totals:',
  ...[...changeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([ch, n]) => `  ${String(n).padStart(5)}  ${ch}`),
  '',
  '=== per-contact detail ===',
  '',
];

fs.writeFileSync(REPORT_PATH, summary.join('\n') + '\n' + lines.join('\n'));
console.log(summary.slice(0, APPLY ? 10 : 8).join('\n'));
console.log(`\nfull report: ${REPORT_PATH}`);
