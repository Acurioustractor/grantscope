import {
  getDirectServiceSupabase,
  getReportSnapshotSupabase,
  getServiceSupabase as getLiveServiceSupabase,
} from '@/lib/supabase';

function isProductionBuild() {
  return process.env.NEXT_PHASE === 'phase-production-build' || process.env.npm_lifecycle_event === 'build';
}

export function getServiceSupabase() {
  if (isProductionBuild() && process.env.CIVICGRAPH_BUILD_LIVE_REPORTS !== 'true') {
    return getReportSnapshotSupabase();
  }

  if (process.env.CIVICGRAPH_LIVE_REPORTS === 'true') {
    return getLiveServiceSupabase();
  }

  return getReportSnapshotSupabase();
}

export function getLiveReportSupabase() {
  return getDirectServiceSupabase();
}
