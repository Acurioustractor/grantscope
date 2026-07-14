import { getServiceSupabase } from '@/lib/supabase';

export const ACT_DAILY_ACTION_STATUSES = ['done', 'waiting', 'tomorrow'] as const;

export type ActDailyActionStatus = (typeof ACT_DAILY_ACTION_STATUSES)[number];
export type ActDailyActionStates = Record<string, ActDailyActionStatus>;

export interface ActDailyActionMemoryItem {
  lastStatus: ActDailyActionStatus;
  lastDay: string;
  deferredDays: number;
}

export type ActDailyActionMemory = Record<string, ActDailyActionMemoryItem>;

const RELATIONSHIP_FOLLOW_UP_PREFIX = 'relationship-follow-up:';

export function relationshipFollowUpActionId(followUpId: string): string {
  return `${RELATIONSHIP_FOLLOW_UP_PREFIX}${followUpId}`;
}

export function relationshipFollowUpIdFromAction(actionId: string): string | null {
  return actionId.startsWith(RELATIONSHIP_FOLLOW_UP_PREFIX) ? actionId.slice(RELATIONSHIP_FOLLOW_UP_PREFIX.length) || null : null;
}

interface DailyActionMemoryRow {
  source_thread_id: string | null;
  source_ref: string;
  happened_at: string | null;
  metadata: unknown;
}

export function isActDailyActionStatus(value: unknown): value is ActDailyActionStatus {
  return typeof value === 'string' && ACT_DAILY_ACTION_STATUSES.includes(value as ActDailyActionStatus);
}

export function perthDayKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Perth',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function dailyActionSourceRef(actionId: string, day = perthDayKey()): string {
  return `${day}:${actionId}`;
}

function metadataFor(row: { metadata: unknown }): Record<string, unknown> {
  return row.metadata && typeof row.metadata === 'object'
    ? row.metadata as Record<string, unknown>
    : {};
}

function dayFor(row: Pick<DailyActionMemoryRow, 'source_ref' | 'metadata'>): string | null {
  const metadata = metadataFor(row);
  const value = typeof metadata.day === 'string' ? metadata.day : row.source_ref.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function buildDailyActionMemory(
  rows: DailyActionMemoryRow[],
  beforeDay = perthDayKey(),
): ActDailyActionMemory {
  const byAction = new Map<string, Array<{ day: string; status: ActDailyActionStatus; happenedAt: string }>>();

  for (const row of rows) {
    const actionId = row.source_thread_id;
    const day = dayFor(row);
    const status = metadataFor(row).status;
    if (!actionId || !day || day >= beforeDay || !isActDailyActionStatus(status)) continue;
    const entries = byAction.get(actionId) ?? [];
    entries.push({ day, status, happenedAt: row.happened_at ?? `${day}T00:00:00Z` });
    byAction.set(actionId, entries);
  }

  const memory: ActDailyActionMemory = {};
  for (const [actionId, rawEntries] of byAction) {
    const entries = rawEntries
      .sort((left, right) => right.day.localeCompare(left.day) || right.happenedAt.localeCompare(left.happenedAt))
      .filter((entry, index, all) => all.findIndex((candidate) => candidate.day === entry.day) === index);
    const latest = entries[0];
    if (!latest) continue;

    let deferredDays = 0;
    for (const entry of entries) {
      if (entry.status === 'done') break;
      if (entry.status === 'waiting' || entry.status === 'tomorrow') deferredDays += 1;
    }
    memory[actionId] = { lastStatus: latest.status, lastDay: latest.day, deferredDays };
  }
  return memory;
}

export async function getOrgDailyActionStates(
  orgProfileId: string,
  day = perthDayKey(),
): Promise<ActDailyActionStates> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('opportunity_context_events')
    .select('source_thread_id, metadata')
    .eq('org_profile_id', orgProfileId)
    .eq('source_system', 'civicgraph')
    .eq('source_type', 'daily_action')
    .eq('signal_kind', 'daily_action')
    .like('source_ref', `${day}:%`);

  if (error || !data) return {};

  return data.reduce<ActDailyActionStates>((states, row) => {
    const actionId = typeof row.source_thread_id === 'string' ? row.source_thread_id : null;
    const metadata = metadataFor(row);
    if (actionId && isActDailyActionStatus(metadata.status)) states[actionId] = metadata.status;
    return states;
  }, {});
}

export async function getOrgDailyActionMemory(
  orgProfileId: string,
  beforeDay = perthDayKey(),
): Promise<ActDailyActionMemory> {
  const db = getServiceSupabase();
  const since = new Date(Date.now() - 21 * 86_400_000).toISOString();
  const { data, error } = await db
    .from('opportunity_context_events')
    .select('source_thread_id, source_ref, happened_at, metadata')
    .eq('org_profile_id', orgProfileId)
    .eq('source_system', 'civicgraph')
    .eq('source_type', 'daily_action')
    .eq('signal_kind', 'daily_action')
    .gte('happened_at', since)
    .order('happened_at', { ascending: false });

  if (error || !data) return {};
  return buildDailyActionMemory(data as DailyActionMemoryRow[], beforeDay);
}
