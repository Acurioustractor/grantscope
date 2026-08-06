// GHL write path for People (ADR 0002: GHL owns relationship state — warmth,
// next action, last touch). Server-side only. Every surface write goes here
// FIRST; the mirror updates only after GHL accepts (never mirror-only writes).
//
// Storage mapping (capability audit #144):
//   warmth      → the single goods-* warmth tag (scripts/lib/ghl-tag-registry.mjs
//                 vocabulary: exactly one, REPLACE never append)
//   next action → a contact Task (title + dueDate); its id is kept on the
//                 mirror row (ghl_task_id) so edits update rather than pile up
//   warm via    → written into the task body for phone visibility; the mirror
//                 is authoritative (GHL has no native home for it)

const BASE_URL = 'https://services.leadconnectorhq.com';
const WARMTH_TAG_PREFIX = 'goods-';
const WARMTH_TAGS = ['goods-hot', 'goods-warm', 'goods-steady', 'goods-cooling', 'goods-cold'];

async function ghlFetch(endpoint: string, options: RequestInit = {}) {
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
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GHL API ${res.status}: ${text}`);
  }
  return res.status === 204 ? null : res.json();
}

/** Create a bare person contact. GHL allows name-only creation. */
export async function createPersonContact(opts: { name: string; email?: string | null }): Promise<string> {
  const locationId = process.env.GHL_LOCATION_ID;
  const [firstName, ...rest] = opts.name.trim().split(/\s+/);
  const data = await ghlFetch('/contacts/', {
    method: 'POST',
    body: JSON.stringify({
      locationId,
      firstName,
      lastName: rest.join(' ') || undefined,
      ...(opts.email ? { email: opts.email } : {}),
      tags: ['record:person'],
      source: 'civicgraph-people-mint',
    }),
  });
  const id = data?.contact?.id;
  if (!id) throw new Error('GHL contact create did not return an id');
  return id;
}

/** Replace the contact's warmth tag (exactly one, per the tag registry). */
export async function setWarmthTag(contactId: string, warmth: string): Promise<void> {
  const target = `${WARMTH_TAG_PREFIX}${warmth}`;
  const existing = await ghlFetch(`/contacts/${contactId}`);
  const tags: string[] = existing?.contact?.tags ?? [];
  const staleWarmth = tags.filter((t) => WARMTH_TAGS.includes(t.toLowerCase()) && t.toLowerCase() !== target);
  if (staleWarmth.length > 0) {
    await ghlFetch(`/contacts/${contactId}/tags`, { method: 'DELETE', body: JSON.stringify({ tags: staleWarmth }) });
  }
  if (!tags.some((t) => t.toLowerCase() === target)) {
    await ghlFetch(`/contacts/${contactId}/tags`, { method: 'POST', body: JSON.stringify({ tags: [target] }) });
  }
}

function taskBody(nextAction: string, warmVia: string | null): string {
  return warmVia ? `${nextAction}\nvia ${warmVia}` : nextAction;
}

/** Create or update the contact task holding the next action. Returns task id. */
export async function upsertNextActionTask(
  contactId: string,
  taskId: string | null,
  opts: { nextAction: string; reviewBy: string; warmVia: string | null }
): Promise<string> {
  const payload = {
    title: opts.nextAction.slice(0, 200),
    body: taskBody(opts.nextAction, opts.warmVia),
    dueDate: `${opts.reviewBy}T09:00:00+10:00`,
    completed: false,
  };
  if (taskId) {
    try {
      await ghlFetch(`/contacts/${contactId}/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(payload) });
      return taskId;
    } catch {
      // Task deleted/completed in GHL — fall through and create fresh.
    }
  }
  const data = await ghlFetch(`/contacts/${contactId}/tasks`, { method: 'POST', body: JSON.stringify(payload) });
  const id = data?.task?.id ?? data?.id;
  if (!id) throw new Error('GHL task create did not return an id');
  return id;
}

/** Mark the current next-action task done in GHL (watch completed / released). */
export async function completeNextActionTask(contactId: string, taskId: string): Promise<void> {
  try {
    await ghlFetch(`/contacts/${contactId}/tasks/${taskId}/completed`, {
      method: 'PUT',
      body: JSON.stringify({ completed: true }),
    });
  } catch {
    // Already completed or deleted in GHL — GHL wins, nothing to enforce.
  }
}
