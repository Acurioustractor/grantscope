import { buildAbsoluteAppUrl, getAppUrl } from '@/lib/app-url';

type AlertTrackSource = 'digest' | 'notification';

type AlertTrackParams = {
  source: AlertTrackSource;
  targetPath?: string;
  userId?: string | null;
  alertPreferenceId?: number | null;
  notificationId?: string | null;
  grantId?: string | null;
};

export function normalizeAlertTrackTarget(targetPath?: string | null) {
  if (!targetPath || !targetPath.startsWith('/')) {
    return '/alerts';
  }

  return targetPath;
}

export function buildAlertTrackClickUrl({
  source,
  targetPath = '/alerts',
  userId,
  alertPreferenceId,
  notificationId,
  grantId,
}: AlertTrackParams) {
  const url = new URL('/api/alerts/track/click', getAppUrl());
  url.searchParams.set('source', source);
  url.searchParams.set('target', normalizeAlertTrackTarget(targetPath));
  if (userId) url.searchParams.set('userId', userId);
  if (alertPreferenceId != null) url.searchParams.set('alertId', String(alertPreferenceId));
  if (notificationId) url.searchParams.set('notificationId', notificationId);
  if (grantId) url.searchParams.set('grantId', grantId);
  return url.toString();
}

export function buildAlertTrackOpenUrl({
  source,
  userId,
  alertPreferenceId,
  notificationId,
  grantId,
}: Omit<AlertTrackParams, 'targetPath'>) {
  const url = new URL('/api/alerts/track/open', getAppUrl());
  url.searchParams.set('source', source);
  if (userId) url.searchParams.set('userId', userId);
  if (alertPreferenceId != null) url.searchParams.set('alertId', String(alertPreferenceId));
  if (notificationId) url.searchParams.set('notificationId', notificationId);
  if (grantId) url.searchParams.set('grantId', grantId);
  return url.toString();
}

export function resolveAlertTrackRedirect(targetPath?: string | null) {
  return buildAbsoluteAppUrl(normalizeAlertTrackTarget(targetPath));
}
