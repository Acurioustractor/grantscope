#!/usr/bin/env node
/**
 * set-ask-artefact — link a parked Notion artefact to its GHL Ask
 * (wayfinder #162). The /make-the-ask skill's final parking step.
 *
 * Usage:
 *   node --env-file=.env scripts/set-ask-artefact.mjs <ghl_opportunity_id> <notion_url> [--name "Ask — Funder — YYYY-MM"]
 *   node --env-file=.env scripts/set-ask-artefact.mjs <ghl_opportunity_id> --clear
 */
import { createClient } from '@supabase/supabase-js';

const ACT_ORG_PROFILE_ID = '8b6160a1-7eea-4bd2-8404-71c196381de0';

const args = process.argv.slice(2);
const [oppId, url] = args;
const clear = args.includes('--clear');
const nameIdx = args.indexOf('--name');
const askName = nameIdx >= 0 ? args[nameIdx + 1] : null;

if (!oppId || (!clear && !/^https:\/\//.test(url ?? ''))) {
  console.error('usage: set-ask-artefact.mjs <ghl_opportunity_id> <https-url> [--name "..."] | <ghl_opportunity_id> --clear');
  process.exit(1);
}

const db = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

if (clear) {
  const { error } = await db.from('act_ask_artefacts').delete().eq('ghl_opportunity_id', oppId);
  if (error) { console.error(`clear failed: ${error.message}`); process.exit(1); }
  console.log(`cleared artefact link for ${oppId}`);
} else {
  const { error } = await db.from('act_ask_artefacts').upsert({
    ghl_opportunity_id: oppId,
    org_profile_id: ACT_ORG_PROFILE_ID,
    artefact_url: url,
    ask_name: askName,
    set_by: 'make-the-ask',
    set_at: new Date().toISOString(),
  });
  if (error) { console.error(`upsert failed: ${error.message}`); process.exit(1); }
  console.log(`linked ${oppId} → ${url}`);
}
