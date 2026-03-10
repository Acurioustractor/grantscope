import { getServiceSupabase } from '@/lib/supabase';

/**
 * Log a Tender Intelligence API call for usage metering.
 * Fire-and-forget — does not block the response.
 */
export function logUsage(params: {
  user_id: string;
  endpoint: 'discover' | 'enrich' | 'compliance' | 'pack';
  filters?: Record<string, unknown>;
  result_count: number;
}) {
  const supabase = getServiceSupabase();
  // Fire and forget — don't await
  supabase
    .from('ti_usage_log')
    .insert({
      user_id: params.user_id,
      endpoint: params.endpoint,
      filters: params.filters || {},
      result_count: params.result_count,
      created_at: new Date().toISOString(),
    })
    .then(() => {});
}
