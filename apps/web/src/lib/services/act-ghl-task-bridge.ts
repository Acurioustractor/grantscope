// The GHL tasks bridge (#161): due desk work projected as GHL tasks so it
// reaches the phone. Absolute rule: tasks are DISPOSABLE PROJECTIONS, never
// read back — Done happens in the workspace, the bridge then clears its task.
// The bridge only touches tasks it created, tracked in ghl_task_bridge.
import { getServiceSupabase } from '@/lib/supabase';
import type { DueItem } from '@/lib/services/act-desk-digest';

const BASE_URL = 'https://services.leadconnectorhq.com';
// Obligations/asks without a resolvable contact attach to the standing triage
// contact — GHL tasks are contact-scoped, "unattached" doesn't exist in the API.
const TRIAGE_CONTACT_ID = process.env.GHL_TRIAGE_CONTACT_ID || 'uAsIUWBHez3DzVex8rtm';

async function ghl(endpoint: string, options: RequestInit = {}) {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) throw new Error('GHL_API_KEY not set');
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
      ...options.headers,
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GHL ${res.status} on ${endpoint}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

type BridgeRow = {
  source_key: string;
  ghl_task_id: string;
  ghl_contact_id: string;
  title: string;
  due_date: string | null;
};

export type BridgeSyncResult = {
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
  dryRun: boolean;
};

function taskPayload(item: DueItem) {
  return {
    // '[desk]' prefix = the human-visible marker of bridge ownership.
    title: `[desk] ${item.action}`.slice(0, 200),
    body: item.href,
    dueDate: `${item.dueDate ?? new Date().toISOString().slice(0, 10)}T09:00:00+10:00`,
    completed: false,
  };
}

/**
 * One-way sync: one task per due desk row, keyed by source_key. Due date
 * moves → task updates. Row leaves the due window (completed/dropped/pushed
 * out) → task deletes. Hand-made tasks are never touched.
 */
export async function syncGhlTaskBridge(
  orgProfileId: string,
  due: DueItem[],
  opts: { dryRun: boolean }
): Promise<BridgeSyncResult> {
  const db = getServiceSupabase();
  const result: BridgeSyncResult = { created: 0, updated: 0, deleted: 0, errors: [], dryRun: opts.dryRun };

  const { data: existingRows, error } = await db
    .from('ghl_task_bridge')
    .select('source_key, ghl_task_id, ghl_contact_id, title, due_date')
    .eq('org_profile_id', orgProfileId);
  if (error) {
    result.errors.push(`bridge table read failed: ${error.message}`);
    return result;
  }
  const existing = new Map((existingRows as BridgeRow[]).map((r) => [r.source_key, r]));
  const desired = new Map(due.map((d) => [d.key, d]));

  // Create / update.
  for (const item of due) {
    const row = existing.get(item.key);
    const contactId = item.ghlContactId ?? TRIAGE_CONTACT_ID;
    const payload = taskPayload(item);
    try {
      if (!row) {
        result.created += 1;
        if (opts.dryRun) continue;
        const data = await ghl(`/contacts/${contactId}/tasks`, { method: 'POST', body: JSON.stringify(payload) });
        const taskId = data?.task?.id ?? data?.id;
        if (!taskId) throw new Error('task create returned no id');
        await db.from('ghl_task_bridge').insert({
          source_key: item.key,
          org_profile_id: orgProfileId,
          ghl_task_id: taskId,
          ghl_contact_id: contactId,
          title: payload.title,
          due_date: item.dueDate,
        });
      } else if (row.title !== payload.title || row.due_date !== item.dueDate) {
        result.updated += 1;
        if (opts.dryRun) continue;
        await ghl(`/contacts/${row.ghl_contact_id}/tasks/${row.ghl_task_id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        await db
          .from('ghl_task_bridge')
          .update({ title: payload.title, due_date: item.dueDate, updated_at: new Date().toISOString() })
          .eq('source_key', item.key);
      }
    } catch (e) {
      result.errors.push(`${item.key}: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  // Delete tasks whose source row left the due window — stale nags are how
  // task lists die. A 404 (task hand-deleted in GHL) is fine; the row clears.
  for (const row of existing.values()) {
    if (desired.has(row.source_key)) continue;
    result.deleted += 1;
    if (opts.dryRun) continue;
    try {
      await ghl(`/contacts/${row.ghl_contact_id}/tasks/${row.ghl_task_id}`, { method: 'DELETE' });
      await db.from('ghl_task_bridge').delete().eq('source_key', row.source_key);
    } catch (e) {
      result.errors.push(`delete ${row.source_key}: ${e instanceof Error ? e.message : 'failed'}`);
    }
  }

  return result;
}
