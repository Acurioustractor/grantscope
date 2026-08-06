#!/usr/bin/env node

/**
 * Reconcile the act_people mirror against GHL — the system of record for
 * Person relationship state (ADR 0002). On any disagreement GHL wins silently.
 *
 * For each act_people row:
 *   1. GET the GHL contact → warmth (single goods-* tag), name, last touch
 *   2. GET the contact's tasks → the next-action task (ghl_task_id):
 *      - due date moved in GHL      → mirror follows
 *      - completed/deleted in GHL   → mirror clears (Person drops dateless)
 *   3. Contact deleted in GHL       → flag loudly, leave the row (a human
 *      decides; the mirror never deletes People on its own)
 *   4. Stamp last_synced_at (the stale-badge clock on every surface)
 *
 * warm_via is NOT reconciled — the mirror is authoritative for it (GHL has
 * no native home; it only echoes into the task body for phone visibility).
 *
 * Read-only against GHL. Intended for the daily reconcile pass.
 *
 * Usage:
 *   node --env-file=.env scripts/reconcile-act-people-ghl.mjs [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { logStart, logComplete } from './lib/log-agent-run.mjs';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_BASE = 'https://services.leadconnectorhq.com';
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_KEY || !GHL_API_KEY) {
  console.error('FATAL: need SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GHL_API_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const WARMTH_TAGS = ['goods-hot', 'goods-warm', 'goods-steady', 'goods-cooling', 'goods-cold'];

async function ghl(endpoint) {
  const res = await fetch(`${GHL_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${GHL_API_KEY}`, Version: '2021-07-28' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GHL ${res.status} on ${endpoint}: ${await res.text()}`);
  return res.json();
}

function warmthFromTags(tags = []) {
  const tag = tags.find((t) => WARMTH_TAGS.includes(String(t).toLowerCase()));
  return tag ? String(tag).toLowerCase().replace('goods-', '') : null;
}

async function main() {
  const run = await logStart(sb, 'reconcile-act-people', 'Reconcile People mirror vs GHL');

  const { data: people, error } = await sb
    .from('act_people')
    .select('id, name, ghl_contact_id, ghl_task_id, warmth, next_action, review_by');
  if (error) throw new Error(`act_people read failed: ${error.message}`);
  console.log(`${people.length} People to reconcile${DRY_RUN ? ' (dry-run)' : ''}`);

  let updated = 0;
  let missing = 0;
  for (const p of people) {
    try {
      const contactRes = await ghl(`/contacts/${p.ghl_contact_id}`);
      const contact = contactRes?.contact;
      if (!contact) {
        missing += 1;
        console.warn(`MISSING IN GHL: ${p.name} (${p.ghl_contact_id}) — contact deleted? Needs a human call.`);
        continue;
      }

      const patch = { last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      const warmth = warmthFromTags(contact.tags);
      if (warmth && warmth !== p.warmth) patch.warmth = warmth;
      const ghlName = [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim();
      if (ghlName && ghlName !== p.name) patch.name = ghlName;
      const touch = contact.lastActivity || contact.dateUpdated;
      if (touch) patch.last_touch_at = new Date(touch).toISOString();

      if (p.ghl_task_id) {
        const tasksRes = await ghl(`/contacts/${p.ghl_contact_id}/tasks`);
        const task = (tasksRes?.tasks ?? []).find((t) => t.id === p.ghl_task_id);
        if (!task || task.completed) {
          // Completed or deleted on the GHL side: the watch is over. Mirror
          // drops the Person to the dateless tail — a human sets the next one.
          patch.next_action = null;
          patch.review_by = null;
          patch.ghl_task_id = null;
        } else {
          if (task.title && task.title !== p.next_action) patch.next_action = task.title;
          const due = task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : null;
          if (due && due !== p.review_by) patch.review_by = due;
        }
      }

      const changes = Object.keys(patch).filter((k) => !['last_synced_at', 'updated_at'].includes(k));
      if (changes.length > 0) {
        updated += 1;
        console.log(`${p.name}: ${changes.join(', ')}${DRY_RUN ? ' (skipped)' : ''}`);
      }
      if (!DRY_RUN) {
        const { error: upErr } = await sb.from('act_people').update(patch).eq('id', p.id);
        if (upErr) console.error(`  update failed for ${p.name}: ${upErr.message}`);
      }
    } catch (e) {
      console.error(`  ${p.name}: ${e.message}`);
    }
  }

  console.log(`Done: ${updated} updated, ${missing} missing in GHL, ${people.length} scanned`);
  // logStart can return {id:null} under pooler stress — logComplete tolerates it.
  if (run?.id) await logComplete(sb, run.id, { items_found: people.length, items_new: updated });
  return run;
}

main().catch(async (e) => {
  console.error(`FATAL: ${e.message}`);
  process.exit(1);
});
