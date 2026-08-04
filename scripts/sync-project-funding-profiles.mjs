#!/usr/bin/env node

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');
const GOODS_PROFILE_PATH = new URL('./funding-profiles/goods-on-country.json', import.meta.url);
const REQUIRED_SECTIONS = [
  'identity', 'purpose', 'entities', 'partnerPathways', 'geographies', 'beneficiaries',
  'evidence', 'fundingNeed', 'acceptedInstruments', 'constraints', 'relationships', 'unresolvedDecisions',
];

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function profileHash(profile) {
  return createHash('sha256').update(stableJson(profile)).digest('hex').slice(0, 12);
}

function fundingProfileText(profile) {
  return [
    profile.identity?.projectName,
    ...(profile.identity?.aliases || []),
    profile.purpose?.publicSummary,
    ...(profile.purpose?.outcomes || []),
    ...(profile.geographies || []),
    ...(profile.beneficiaries || []),
    ...(profile.acceptedInstruments || []),
    ...(profile.fundingNeed?.blocks || []).flatMap(block => [block.label, ...(block.keywords || [])]),
  ].filter(Boolean).join('\n').slice(0, 8000);
}

function baselineProfile(project) {
  const aliases = Array.isArray(project.metadata?.aliases) ? project.metadata.aliases : [];
  return {
    schemaVersion: 'project-funding-profile-v1',
    identity: {
      orgProjectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      slug: project.slug,
      aliases,
      category: project.category,
      parentProjectId: project.parent_project_id,
    },
    purpose: {
      publicSummary: project.description || null,
      outcomes: [],
      maturity: project.status,
    },
    entities: [],
    partnerPathways: [],
    geographies: [],
    beneficiaries: [],
    evidence: [],
    fundingNeed: { currency: 'AUD', amountMin: null, amountMax: null, blocks: [] },
    acceptedInstruments: [],
    constraints: [],
    relationships: [],
    unresolvedDecisions: [
      'Confirm applicant and contracting entities.',
      'Confirm delivery places and eligible geographies.',
      'Define costed funding blocks and acceptable instruments.',
      'Attach evidence for outcomes, authority and community benefit.',
    ],
  };
}

function goodsProfile(project, imported) {
  return {
    ...baselineProfile(project),
    ...imported,
    identity: {
      ...baselineProfile(project).identity,
      aliases: ['Goods on Country', 'Goods', ...(imported.aliases || [])],
    },
    purpose: {
      publicSummary: imported.publicSummary,
      outcomes: imported.outcomes || [],
      maturity: project.status,
    },
    partnerPathways: imported.partnerPathways || [],
    beneficiaries: imported.beneficiaries || ['remote Aboriginal communities'],
    evidence: imported.evidence || [],
    acceptedInstruments: [...new Set((imported.entities || []).flatMap(entity => entity.acceptedInstruments || []))],
    constraints: imported.constraints || [
      'Indigenous ownership or control must be verified and never inferred.',
      'Commercial, charitable and community-owned benefit pathways must remain explicit.',
    ],
    relationships: imported.relationships || [],
    unresolvedDecisions: imported.unresolvedDecisions || [
      'Confirm the applicant and partner route for each funding block.',
      'Confirm Indigenous ownership requirements against each opportunity.',
    ],
  };
}

export function validateProfile(profile) {
  const errors = [];
  for (const section of REQUIRED_SECTIONS) {
    if (!(section in profile)) errors.push(`Missing section: ${section}`);
  }
  if (!profile.identity?.orgProjectId) errors.push('Missing canonical org project ID');
  if (!profile.identity?.projectCode) errors.push('Missing canonical project code');
  if (!Array.isArray(profile.unresolvedDecisions)) errors.push('unresolvedDecisions must be an array');
  if (!Array.isArray(profile.fundingNeed?.blocks)) errors.push('fundingNeed.blocks must be an array');
  return errors;
}

function completeness(profile) {
  const hasEntities = profile.entities.length > 0;
  const hasBlocks = profile.fundingNeed.blocks.length > 0;
  const hasGeographies = profile.geographies.length > 0;
  const hasEvidence = profile.evidence.length > 0;
  if (hasEntities && hasBlocks && hasGeographies && hasEvidence && profile.unresolvedDecisions.length === 0) return 'decision_ready';
  if (hasEntities || hasBlocks || hasGeographies || hasEvidence) return 'partial';
  return 'baseline';
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  const supabase = createClient(url, key);

  const [{ data: projects, error }, goodsRaw] = await Promise.all([
    supabase.from('org_projects').select('*').eq('status', 'active').order('sort_order'),
    readFile(GOODS_PROFILE_PATH, 'utf8'),
  ]);
  if (error) throw new Error(`Could not load active projects: ${error.message}`);
  const importedGoods = JSON.parse(goodsRaw);

  const rows = [];
  for (const project of projects || []) {
    const profile = project.code === 'ACT-GD'
      ? goodsProfile(project, importedGoods)
      : baselineProfile(project);
    const errors = validateProfile(profile);
    if (errors.length) throw new Error(`${project.code}: ${errors.join('; ')}`);
    const hash = profileHash(profile);
    rows.push({
      org_project_id: project.id,
      org_profile_id: project.org_profile_id,
      schema_version: 'project-funding-profile-v1',
      profile_version: `${project.code.toLowerCase()}-${hash}`,
      completeness_status: completeness(profile),
      profile,
      embedding_text: fundingProfileText(profile),
      provenance: project.code === 'ACT-GD'
        ? [{ type: 'file', path: 'scripts/funding-profiles/goods-on-country.json' }, { type: 'table', table: 'org_projects', id: project.id }]
        : [{ type: 'table', table: 'org_projects', id: project.id }],
      created_by: 'sync-project-funding-profiles',
      is_current: true,
    });
  }

  console.log(`Validated ${rows.length} active project profiles`);
  console.table(rows.map(row => ({
    project: row.profile.identity.projectName,
    code: row.profile.identity.projectCode,
    completeness: row.completeness_status,
    version: row.profile_version,
    unresolved: row.profile.unresolvedDecisions.length,
  })));

  if (DRY_RUN) return;
  for (const row of rows) {
    const { error: upsertError } = await supabase
      .from('project_funding_profiles')
      .upsert(row, { onConflict: 'org_project_id,profile_version' });
    if (upsertError) throw new Error(`${row.profile.identity.projectCode}: ${upsertError.message}`);
  }
  console.log(`Synchronized ${rows.length} current project funding profiles`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
