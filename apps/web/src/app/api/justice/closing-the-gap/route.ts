import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';

/**
 * GET /api/justice/closing-the-gap
 *
 * Closing the Gap Target 11 dashboard data.
 * Returns state-by-state breakdown of:
 * - Indigenous organisations receiving justice funding
 * - Community-controlled organisations
 * - ALMA interventions (total + JR-specific)
 * - Entity-intervention linkage rates
 */
const getCachedClosingTheGapPayload = unstable_cache(async () => {
  const supabase = getServiceSupabase();

  const { data, error } = await supabase.rpc('closing_the_gap_state_summary');
  if (error) throw new Error(error.message);

  const stateData = data || [];

  return {
    states: stateData,
    target_11: {
      baseline_rate: 31.9,
      target_rate: 22.33,
      target_year: 2031,
      reduction_required: 0.30,
      status: 'off_track',
      note: '15 of 19 Closing the Gap targets are currently off-track (Productivity Commission 2024)',
    },
    generated_at: new Date().toISOString(),
  };
}, ['justice-closing-the-gap-v2'], { revalidate: 900 });

export async function GET() {
  const auth = await requireModule('allocation');
  if (auth.error) return auth.error;

  const response = NextResponse.json(await getCachedClosingTheGapPayload());
  response.headers.set('Cache-Control', 'private, max-age=300, stale-while-revalidate=600');
  return response;
}
