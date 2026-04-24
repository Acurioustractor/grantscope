import { buildAbsoluteAppUrl, getAppUrl } from '@/lib/app-url';

type BillingReminderTrackParams = {
  userId?: string | null;
  orgProfileId?: string | null;
  reminderType: string;
  targetPath?: string;
};

export function normalizeBillingReminderTarget(targetPath?: string | null) {
  if (!targetPath || !targetPath.startsWith('/')) {
    return '/profile';
  }

  return targetPath;
}

export function buildBillingReminderClickUrl({
  userId,
  orgProfileId,
  reminderType,
  targetPath = '/profile',
}: BillingReminderTrackParams) {
  const url = new URL('/api/billing/track/click', getAppUrl());
  url.searchParams.set('target', normalizeBillingReminderTarget(targetPath));
  url.searchParams.set('reminderType', reminderType);
  if (userId) url.searchParams.set('userId', userId);
  if (orgProfileId) url.searchParams.set('orgProfileId', orgProfileId);
  return url.toString();
}

export function resolveBillingReminderRedirect(targetPath?: string | null) {
  return buildAbsoluteAppUrl(normalizeBillingReminderTarget(targetPath));
}
