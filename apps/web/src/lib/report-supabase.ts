import {
  getDirectServiceSupabase,
  getReportSnapshotSupabase,
  getServiceSupabase as getLiveServiceSupabase,
} from '@/lib/supabase';

export function getServiceSupabase() {
  if (process.env.CIVICGRAPH_LIVE_REPORTS === 'true') {
    return getLiveServiceSupabase();
  }

  return getReportSnapshotSupabase();
}

export function getLiveReportSupabase() {
  return getDirectServiceSupabase();
}
