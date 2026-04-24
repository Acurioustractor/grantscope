import { getServiceSupabase } from '@/lib/supabase';

export type SavedGrantAttributionType =
  | 'notification_clicked'
  | 'digest_clicked'
  | 'scout_auto'
  | 'manual';

export type SavedGrantAttribution = {
  alertPreferenceId: number | null;
  notificationId: string | null;
  attributionType: SavedGrantAttributionType;
  attributedAt: string;
};

type ServiceDb = ReturnType<typeof getServiceSupabase>;

const ATTRIBUTION_EVENT_TYPES: SavedGrantAttributionType[] = [
  'notification_clicked',
  'digest_clicked',
];

export async function resolveRecentAlertAttribution(
  db: ServiceDb,
  userId: string,
  grantId: string,
  lookbackDays: number = 30
): Promise<SavedGrantAttribution | null> {
  const windowStart = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await db
    .from('alert_events')
    .select('alert_preference_id, notification_id, event_type, created_at')
    .eq('user_id', userId)
    .eq('grant_id', grantId)
    .in('event_type', ATTRIBUTION_EVENT_TYPES)
    .not('alert_preference_id', 'is', null)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data?.event_type) {
    return null;
  }

  return {
    alertPreferenceId: data.alert_preference_id ?? null,
    notificationId: data.notification_id ?? null,
    attributionType: data.event_type as SavedGrantAttributionType,
    attributedAt: data.created_at || new Date().toISOString(),
  };
}
