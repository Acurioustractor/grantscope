/**
 * Foundation Watcher Agent
 *
 * Monthly re-scrape of top foundations to detect:
 * - New grant programs
 * - Changed deadlines
 * - Updated giving amounts
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentConfig, AgentRunResult } from './agent-runner.js';

export function createFoundationWatcher(): AgentConfig {
  return {
    id: 'foundation-watcher',
    name: 'Foundation Watcher',
    schedule: 'monthly',
    enabled: true,

    async execute(supabase: SupabaseClient, log: (msg: string) => void): Promise<AgentRunResult> {
      // Get top foundations by giving that haven't been scraped recently
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: foundations, error: fetchError } = await supabase
        .from('foundations')
        .select('id, name, website, total_giving_annual, last_scraped_at')
        .not('website', 'is', null)
        .order('total_giving_annual', { ascending: false, nullsFirst: false })
        .limit(500);

      if (fetchError) {
        return { itemsFound: 0, itemsNew: 0, itemsUpdated: 0, errors: [fetchError.message] };
      }

      if (!foundations?.length) {
        log('No foundations with websites found');
        return { itemsFound: 0, itemsNew: 0, itemsUpdated: 0, errors: [] };
      }

      // Filter to those needing re-scrape
      const stale = foundations.filter(f => {
        if (!f.last_scraped_at) return true;
        return new Date(f.last_scraped_at) < thirtyDaysAgo;
      });

      log(`${stale.length} of ${foundations.length} foundations need re-scraping`);

      let found = 0;
      let updated = 0;
      const errors: string[] = [];

      // Mark them for re-profiling by clearing profile confidence
      // The reprofile-low-confidence script picks these up
      for (const f of stale.slice(0, 100)) { // Batch of 100 per run
        found++;

        const { error } = await supabase
          .from('foundations')
          .update({
            profile_confidence: 'stale',
            updated_at: new Date().toISOString(),
          })
          .eq('id', f.id);

        if (error) {
          errors.push(`Failed to mark ${f.name}: ${error.message}`);
        } else {
          updated++;
        }
      }

      log(`Marked ${updated} foundations for re-profiling`);

      return { itemsFound: found, itemsNew: 0, itemsUpdated: updated, errors };
    },
  };
}
