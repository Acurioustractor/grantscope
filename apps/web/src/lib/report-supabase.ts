import {
  getDirectServiceSupabase,
  getReportSnapshotSupabase,
  getServiceSupabase as getLiveServiceSupabase,
} from '@/lib/supabase';

/**
 * Whether report pages query the live database.
 *
 * TRIMMED, and that is not defensive tidiness. Production has had
 * `CIVICGRAPH_LIVE_REPORTS` set since 2026-04-30, and its stored value is `"true\n"` — with a
 * trailing newline, as pasted. `'true\n' === 'true'` is false, so the strict comparison that used
 * to live here failed, `getReportSnapshotSupabase()` returned its empty-result Proxy, and every
 * report page read nothing. Someone turned these pages on nearly four months ago and a stray
 * newline turned them back off, silently, with no error anywhere.
 *
 * Eight of the 42 production variables carry a trailing newline (measured 2026-08-20 via
 * `vercel env pull`): CIVICGRAPH_LIVE_REPORTS, GEMINI_API_KEY, INVESTOR_PAGE_PASSWORD,
 * MINIMAX_API_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_URL, TELEGRAM_BOT_TOKEN and
 * TELEGRAM_CHAT_ID. So this is a property of how they were entered, not a one-off, and any env
 * value compared with `===` in this codebase has the same bug waiting in it.
 */
export function liveReportsEnabled(): boolean {
  return process.env.CIVICGRAPH_LIVE_REPORTS?.trim() === 'true';
}

export function getServiceSupabase() {
  if (liveReportsEnabled()) {
    return getLiveServiceSupabase();
  }

  return getReportSnapshotSupabase();
}

export function getLiveReportSupabase() {
  return getDirectServiceSupabase();
}
