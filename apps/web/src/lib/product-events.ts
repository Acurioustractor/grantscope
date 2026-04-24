import { getServiceSupabase } from '@/lib/supabase';

export type ProductEventType =
  | 'profile_ready'
  | 'first_grant_shortlisted'
  | 'pipeline_started'
  | 'first_alert_created'
  | 'alert_clicked'
  | 'upgrade_prompt_viewed'
  | 'upgrade_cta_clicked'
  | 'checkout_started'
  | 'subscription_trial_started'
  | 'subscription_activated'
  | 'subscription_changed'
  | 'subscription_cancelled'
  | 'billing_portal_opened'
  | 'billing_reminder_clicked'
  | 'billing_reminder_sent';

type ProductEventInput = {
  userId: string;
  orgProfileId?: string | null;
  eventType: ProductEventType;
  metadata?: Record<string, unknown> | null;
};

export async function recordProductEvents(events: ProductEventInput[]) {
  if (events.length === 0) return;

  const db = getServiceSupabase();
  const now = new Date().toISOString();
  const rows = events.map((event) => ({
    user_id: event.userId,
    org_profile_id: event.orgProfileId ?? null,
    event_type: event.eventType,
    metadata: event.metadata ?? {},
    created_at: now,
  }));

  const { error } = await db.from('product_events').insert(rows);
  if (error) {
    console.error('[product-events] insert failed:', error);
  }
}

export async function hasProductEvent(userId: string, eventType: ProductEventType) {
  const db = getServiceSupabase();
  const { count, error } = await db
    .from('product_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', eventType);

  if (error) {
    console.error('[product-events] existence check failed:', error);
    return false;
  }

  return (count ?? 0) > 0;
}
