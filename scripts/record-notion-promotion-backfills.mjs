#!/usr/bin/env node

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { promotionKey } from './lib/opportunity-promotion.mjs';

const LINKS = [
  ['06e54747-406d-4d2b-a1c1-2753dbe450e6', '241eb2c5-7097-478a-ae2c-2960a4c7de2d'],
  ['0f774f83-29ff-4f59-8b77-53c29040a214', '392ebcf9-81cf-8146-8af3-efe7c72ed263'],
  ['5e52c7ef-a1b1-4319-b57c-421448dc3f27', '392ebcf9-81cf-8181-a937-d56e6f3d1f69'],
  ['478495a0-e727-44b4-a22b-541ca3816c66', '392ebcf9-81cf-8189-a85c-fbdda8d38f1c'],
  ['2a233fa7-4867-4288-a0d3-0ff1eb2d25e9', '392ebcf9-81cf-81a8-9617-db5db1b890f1'],
  ['ef5fe660-2e34-4101-bceb-5ead991bd4a8', '3aaebcf9-81cf-8184-abc9-dd866e75bc7c'],
];

const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const grantIds = LINKS.map(([grantId]) => grantId);
  const { data: grants, error } = await supabase.from('grant_opportunities')
    .select('id,name,provider,deadline,aligned_projects')
    .in('id', grantIds);
  if (error) throw new Error(error.message);
  const byId = new Map(grants.map(row => [row.id, row]));
  const rows = LINKS.map(([grantId, notionPageId]) => {
    const grant = byId.get(grantId);
    if (!grant) throw new Error(`Missing grant ${grantId}`);
    const projectCode = grant.aligned_projects?.includes('ACT-GD') ? 'ACT-GD' : grant.aligned_projects?.[0] || 'ACT-GD';
    return {
      source_type: 'grant', source_ref: grantId, project_code: projectCode,
      deterministic_key: promotionKey({ projectCode, provider: grant.provider, programId: grant.id, program: grant.name, round: grant.deadline?.slice(0, 4), receivingEntity: 'unassigned' }),
      target_system: 'notion', target_record_id: notionPageId, status: 'linked',
      gate_snapshot: { backfill: true, match_method: 'existing_supabase_uuid', canonical_database: true },
      promoted_at: new Date().toISOString(),
    };
  });
  const { data, error: upsertError } = await supabase.from('opportunity_promotions')
    .upsert(rows, { onConflict: 'source_type,source_ref,project_code,target_system' })
    .select('id,source_ref,target_record_id');
  if (upsertError) throw new Error(upsertError.message);
  console.log(JSON.stringify({ recorded: data.length, links: data }, null, 2));
}

main().catch(error => { console.error(`FAILED: ${error.message}`); process.exitCode = 1; });
