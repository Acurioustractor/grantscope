#!/usr/bin/env node
/**
 * Bulk-upload JusticeHub knowledge docs directly to Supabase.
 * Bypasses HTTP API — uses service key for direct DB + storage access.
 *
 * Usage: node --env-file=.env scripts/upload-justicehub-knowledge.mjs
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const JH_ROOT = '/Users/benknight/Code/JusticeHub';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// source_type values: foundational, strategic, tactical, dynamic, experimental
const DOCS = [
  // Foundational — core identity and knowledge
  { path: 'docs/knowledge/JUSTICEHUB.md', name: 'JusticeHub — Complete Knowledge Base', type: 'foundational' },
  { path: 'compendium/identity.md', name: 'JusticeHub Identity & Philosophy', type: 'foundational' },
  { path: 'docs/strategic/CORE_GOAL_AND_ALIGNMENT_MAP.md', name: 'Core Goal & Alignment Map', type: 'foundational' },
  // Strategic — vision and plans
  { path: 'docs/vision/ALMA-2.0-VISION.md', name: 'ALMA 2.0 Vision — Community Justice Intelligence', type: 'strategic' },
  { path: 'docs/strategic/STRATEGIC_VISION_2026-2036.md', name: 'Strategic Vision 2026-2036', type: 'strategic' },
  { path: 'docs/strategic/MINDAROO_SIMPLIFIED_PITCH_2026.md', name: 'Mindaroo Fellowship Pitch 2026', type: 'strategic' },
  { path: 'compendium/roadmap.md', name: 'JusticeHub 2026 Roadmap', type: 'strategic' },
  // Tactical — campaigns and systems
  { path: 'compendium/contained-campaign-bible.md', name: 'CONTAINED Campaign Bible', type: 'tactical' },
  { path: 'docs/knowledge/ALMA-COMMUNITY-CONTRIBUTION-SYSTEM.md', name: 'ALMA Community Contribution System', type: 'tactical' },
  { path: 'docs/knowledge/ALMA-DATA-COLLECTION-INFRASTRUCTURE.md', name: 'ALMA Data Collection Infrastructure', type: 'tactical' },
  { path: 'docs/SYSTEM-MAP.md', name: 'JusticeHub System Map', type: 'tactical' },
  // Experimental — research briefs
  { path: 'compendium/contained-research-brief-2026-03-12.md', name: 'CONTAINED Research Brief', type: 'experimental' },
];

async function getJusticeHubOrgId() {
  const { data, error } = await supabase
    .from('org_profiles')
    .select('id')
    .eq('slug', 'justicehub')
    .single();
  if (error) throw new Error(`Failed to find JusticeHub org: ${error.message}`);
  return data.id;
}

async function uploadDoc(doc, orgId) {
  const fullPath = path.join(JH_ROOT, doc.path);
  if (!fs.existsSync(fullPath)) {
    console.log(`  SKIP (not found): ${doc.path}`);
    return false;
  }

  const content = fs.readFileSync(fullPath);
  const timestamp = Date.now();
  const safeName = doc.name.replace(/[^a-zA-Z0-9._-]/g, '_') + '.md';
  const storagePath = `${orgId}/${timestamp}-${safeName}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('org-knowledge')
    .upload(storagePath, content, { contentType: 'text/markdown' });

  if (uploadError) {
    console.log(`  STORAGE ERR: ${doc.name} — ${uploadError.message}`);
    return false;
  }

  // Create knowledge_sources record
  const knowledgeId = `org-${orgId}-${timestamp}`;
  const { data: source, error: sourceError } = await supabase
    .from('knowledge_sources')
    .insert({
      knowledge_id: knowledgeId,
      source_type: doc.type,
      source_name: doc.name,
      source_url: null,
      org_profile_id: orgId,
      storage_path: storagePath,
      authority_level: 1,
    })
    .select('id')
    .single();

  if (sourceError) {
    console.log(`  DB ERR: ${doc.name} — ${sourceError.message}`);
    return false;
  }

  // Queue for extraction (file format, not knowledge classification)
  const { error: queueError } = await supabase
    .from('knowledge_extraction_queue')
    .insert({
      source_type: 'markdown',  // file format for the processor
      source_id: source.id,
      source_url: storagePath,
      source_metadata: { org_profile_id: orgId, original_name: doc.name },
      raw_content: '',
      status: 'pending',
      priority: 5,
    });

  if (queueError) {
    console.log(`  QUEUE WARN: ${doc.name} — ${queueError.message}`);
  }

  console.log(`  OK: ${doc.name} (${(content.length / 1024).toFixed(1)}KB)`);
  return true;
}

async function main() {
  console.log('Finding JusticeHub org profile...');
  const orgId = await getJusticeHubOrgId();
  console.log(`  Found: ${orgId}\n`);

  console.log(`Uploading ${DOCS.length} docs to JusticeHub Knowledge Wiki...\n`);

  let ok = 0;
  for (const doc of DOCS) {
    const success = await uploadDoc(doc, orgId);
    if (success) ok++;
  }

  console.log(`\nDone: ${ok}/${DOCS.length} uploaded successfully.`);
  console.log('Documents are queued for processing — visit the Knowledge Wiki to verify.');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
