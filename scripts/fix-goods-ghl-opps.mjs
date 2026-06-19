#!/usr/bin/env node
/**
 * fix-goods-ghl-opps.mjs
 *
 * One-off CRM hygiene: rename two Goods opportunities in GoHighLevel so the
 * funder pipeline tells the truth (surfaced by the QBE capital-strategy alignment, 2026-06-19).
 *
 *  1. "Snow Foundation / SEFA — Impact Investment Loan (Goods on Country)"  ($250K, Grants pipeline)
 *     -> "SEFA — Impact Investment Loan (Goods on Country)"
 *     Reason: Snow already has its OWN opp ($402,930, Supporter Journey). The "Snow Foundation /"
 *     prefix conflates a grant with a repayable loan; SEFA is the highest-match-value (repayable) line
 *     and must be trackable on its own.
 *
 *  2. "Paul Ramsay Foundation"  ($0, "Ask made", Goods Supporter Journey)
 *     -> "Paul Ramsay Foundation (Goods: no active ask — PRF relationship via JusticeHub)"
 *     Reason: $0 phantom opp reads as a warm Goods money front; the real PRF money is two JusticeHub lines.
 *
 * RENAME ONLY. No new opps, no deletes, no pipeline/stage moves (left to a human — there is no debt pipeline).
 * All other fields are preserved by reading the opp first and writing it back with only `name` changed.
 *
 * Run (dry-run, read-only, default): node --env-file=.env scripts/fix-goods-ghl-opps.mjs
 * Apply:                             node --env-file=.env scripts/fix-goods-ghl-opps.mjs --apply
 */
const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const APPLY = process.argv.slice(2).includes('--apply');

const TARGETS = [
  {
    id: 'jKKxyTLE2NHbr44uNiEj',
    newName: 'SEFA — Impact Investment Loan (Goods on Country)',
    reason: 'split SEFA repayable line out of the Snow-bundled grant row',
  },
  {
    id: 'nsSkwDuMlfulSzwticWu',
    newName: 'Paul Ramsay Foundation (no active Goods ask; PRF via JusticeHub)',
    reason: 'flag the $0 phantom Goods opp so it stops reading as a warm money front',
  },
];

async function ghl(endpoint, options = {}) {
  if (!GHL_API_KEY) throw new Error('GHL_API_KEY not set');
  const res = await fetch(`${GHL_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`GHL ${res.status} on ${endpoint}: ${await res.text()}`);
  return res.json();
}

console.log(`\n=== fix-goods-ghl-opps.mjs  [${APPLY ? 'APPLY' : 'DRY-RUN (read-only)'}] ===\n`);

for (const t of TARGETS) {
  let o;
  try {
    ({ opportunity: o } = await ghl(`/opportunities/${t.id}`));
  } catch (e) {
    console.log(`Opp ${t.id}  (${t.reason})`);
    console.log(`  NOT FOUND in live GHL (mirror stale / opp removed) — skipping. [${String(e.message).slice(0, 80)}]\n`);
    continue;
  }
  console.log(`Opp ${t.id}  (${t.reason})`);
  console.log(`  pipeline/stage: ${o.pipelineId} / ${o.pipelineStageId}   value: ${o.monetaryValue}   status: ${o.status}`);
  console.log(`  BEFORE: ${JSON.stringify(o.name)}`);
  console.log(`  AFTER:  ${JSON.stringify(t.newName)}`);
  if (o.name === t.newName) { console.log('  (already correct — skipping)\n'); continue; }
  if (!APPLY) { console.log('  (dry-run — no write)\n'); continue; }

  // Preserve all other fields; change name only.
  const payload = {
    pipelineId: o.pipelineId,
    name: t.newName,
    pipelineStageId: o.pipelineStageId,
    status: o.status,
    monetaryValue: o.monetaryValue ?? 0,
  };
  if (o.contactId) payload.contactId = o.contactId;
  if (o.assignedTo) payload.assignedTo = o.assignedTo;
  const upd = await ghl(`/opportunities/${t.id}`, { method: 'PUT', body: JSON.stringify(payload) });
  console.log(`  APPLIED -> name now: ${JSON.stringify(upd?.opportunity?.name ?? t.newName)}\n`);
}

console.log(APPLY ? 'Done. Next GHL->CivicGraph sync (<=12h) will mirror the new names.\n' : 'Dry-run complete. Re-run with --apply to write.\n');
