/**
 * Cross-product accountability instrumentation.
 *
 * Every atlas surface — page view, JSON download, API call — fires a fire-and-forget
 * event to empathy-ledger-v2's /api/v1/accountability/events. If that endpoint is
 * not yet live, the event is queued to local `audit_events` for replay.
 *
 * Critical: this MUST be non-blocking. The user-facing render never waits on the
 * provenance call. We catch + log all errors.
 */

import { getDirectServiceSupabase } from '@/lib/supabase';

export type AuditEvent = {
  surface: string;             // 'atlas/funding-deserts', 'api/revolving-door', etc.
  event_type: 'view' | 'download' | 'api_call';
  resource_id?: string | null;
  query?: Record<string, unknown> | null;
  actor_ip?: string | null;
  user_agent?: string | null;
};

const EL_ENDPOINT = process.env.EL_ACCOUNTABILITY_URL ?? 'https://empathy-ledger.au/api/v1/accountability/events';
const EL_TOKEN = process.env.EL_ACCOUNTABILITY_TOKEN ?? '';

export function logAuditEvent(event: AuditEvent): void {
  // Fire-and-forget — never block render
  void doLogAuditEvent(event).catch((err) => {
    // eslint-disable-next-line no-console
    console.warn('[provenance] log failed (non-blocking):', err?.message ?? err);
  });
}

async function doLogAuditEvent(event: AuditEvent): Promise<void> {
  // Try EL endpoint first, with short timeout
  if (EL_TOKEN) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch(EL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${EL_TOKEN}`,
        },
        body: JSON.stringify({
          ...event,
          source_product: 'civicgraph',
          recorded_at: new Date().toISOString(),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) return; // success
    } catch {
      // fall through to local queue
    }
  }

  // Fallback: queue to local audit_events for later replay
  try {
    const supabase = getDirectServiceSupabase();
    await supabase.from('audit_events').insert({
      surface: event.surface,
      event_type: event.event_type,
      resource_id: event.resource_id ?? null,
      query: event.query ?? null,
      actor_ip: event.actor_ip ?? null,
      user_agent: event.user_agent ?? null,
      forwarded: false,
    });
  } catch {
    // Last-resort silent fail — never break the user experience for telemetry.
  }
}
