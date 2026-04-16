#!/usr/bin/env -S npx tsx

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { sendGrantAlertDigests } from '../apps/web/src/lib/grant-alert-digests';
import { logComplete, logFailed, logStart } from './lib/log-agent-run.mjs';

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const SPECIFIC_USER = process.argv.find((arg) => arg.startsWith('--user-id='))?.split('=')[1];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const run = await logStart(supabase, 'send-grant-alert-digests', 'Send Grant Alert Digests');

  try {
    const result = await sendGrantAlertDigests({
      userId: SPECIFIC_USER,
      dryRun: DRY_RUN,
      force: FORCE,
    });

    console.log(JSON.stringify(result, null, 2));

    await logComplete(supabase, run.id, {
      items_found: result.grantsIncluded,
      items_new: result.digestsSent,
      items_updated: result.alertsIncluded,
    });
  } catch (error) {
    await logFailed(supabase, run.id, error as Error);
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
