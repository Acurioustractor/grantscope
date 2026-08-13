#!/usr/bin/env node
/**
 * Narrow Grant Pipeline Tracker pilot sync.
 *
 * Backfills/upserts a fixed pilot set from grant_opportunities into the Notion
 * Grant Pipeline Tracker, keyed by grant_opportunities.id. This intentionally
 * avoids the broad saved_grants and recommendation sync paths.
 *
 * Usage:
 *   node --env-file=.env scripts/sync-grant-pipeline-pilot.mjs
 *   node --env-file=.env scripts/sync-grant-pipeline-pilot.mjs --apply
 *
 * Env:
 *   NOTION_TOKEN
 *   NOTION_GRANT_PIPELINE_DB
 *   NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const argValue = (name) => process.argv.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
const PIPELINE_DB = argValue('--notion-db') || process.env.NOTION_FUNDER_OPPORTUNITIES_DB || process.env.NOTION_GRANT_PIPELINE_DB;
const NOTION_API = 'https://api.notion.com/v1';
const APPLY = process.argv.includes('--apply');
const SYNC_STAGE = process.argv.includes('--sync-stage');
const DRY_RUN = !APPLY;

const PILOT = [
  {
    id: '2a233fa7-4867-4288-a0d3-0ff1eb2d25e9',
    notionPageId: '32aebcf981cf811b8dabe3d69592b924',
    label: 'Business Start-Up Grant - Aboriginal Investment NT',
  },
  {
    id: '478495a0-e727-44b4-a22b-541ca3816c66',
    notionPageId: '32bebcf981cf81789988ebef224eb972',
    label: 'Catalysing Impact - Stage 2 Matched Funding',
  },
  {
    id: '0f774f83-29ff-4f59-8b77-53c29040a214',
    notionPageId: '32bebcf981cf8178995af7224df43023',
    label: 'REAL Innovation Fund - Oonchiumpa Goods EOI',
  },
  {
    id: '06e54747-406d-4d2b-a1c1-2753dbe450e6',
    notionPageId: '32aebcf981cf81d5a076e63a4c5c6773',
    label: 'Snow Foundation - Oonchiumpa Operational Funding Year 1',
  },
  {
    id: 'ef5fe660-2e34-4101-bceb-5ead991bd4a8',
    notionPageId: '3aaebcf981cf81b68cdeef643e03201a',
    label: 'First Nations Clean Energy Advice Grants',
  },
  {
    id: '5e52c7ef-a1b1-4319-b57c-421448dc3f27',
    notionPageId: '31febcf981cf81048e1ee94d3f89f1dd',
    label: 'SEDI Capability Building Grant',
  },
  {
    id: '89e7a97d-6d2d-43d1-8d27-e1d690968702',
    createIfMissing: true,
    label: 'SEDI First Nations Social Enterprise Grants',
  },
];

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

if (!NOTION_TOKEN) {
  console.error('NOTION_TOKEN not set.');
  process.exit(1);
}

if (!PIPELINE_DB) {
  console.error('NOTION_GRANT_PIPELINE_DB not set.');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL)) {
  console.error('Supabase URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

async function notionRequest(method, path, body) {
  const res = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Notion ${res.status}: ${err.slice(0, 800)}`);
  }

  return res.json();
}

function richText(content) {
  if (content == null || content === '') return [];
  return [{ type: 'text', text: { content: String(content).slice(0, 2000) } }];
}

function compactText(parts) {
  return parts
    .flat()
    .filter(Boolean)
    .map((part) => String(part).trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, 2000);
}

function titleProp(content) {
  return { title: richText(content || 'Unnamed grant') };
}

function textProp(content) {
  return { rich_text: richText(content) };
}

function numberProp(value) {
  const numeric = value == null ? null : Number(value);
  return { number: Number.isFinite(numeric) ? numeric : null };
}

function dateProp(dateValue) {
  if (!dateValue) return { date: null };
  return { date: { start: new Date(dateValue).toISOString().slice(0, 10) } };
}

function selectProp(name) {
  return name ? { select: { name } } : { select: null };
}

function urlProp(url) {
  return { url: url || null };
}

function getPlainText(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title?.map((t) => t.plain_text || '').join('') || '';
  if (prop.type === 'rich_text') return prop.rich_text?.map((t) => t.plain_text || '').join('') || '';
  return '';
}

function getSelectName(prop) {
  return prop?.type === 'select' ? prop.select?.name || '' : '';
}

function getPropertyNames(database) {
  return new Set(Object.keys(database.properties || {}));
}

function addIfField(props, fields, name, value) {
  if (fields.has(name)) props[name] = value;
}

function addFirstField(props, fields, names, value) {
  const name = names.find((candidate) => fields.has(candidate));
  if (name) props[name] = value;
}

function identityField(fields) {
  return fields.has('GrantScope ID') ? 'GrantScope ID' : fields.has('Supabase ID') ? 'Supabase ID' : null;
}

function mapStage(row) {
  const status = String(row.application_status || row.status || '').toLowerCase();
  const pipelineStage = String(row.pipeline_stage || '').toLowerCase();

  if (pipelineStage.includes('submitted')) return 'Submitted';
  if (pipelineStage.includes('draft')) return 'Drafting';
  if (pipelineStage.includes('pursu')) return 'Pursuing';
  if (status.includes('review')) return 'Submitted';
  if (status.includes('approved') || status.includes('won')) return 'Approved';
  if (status.includes('lost') || status.includes('declined')) return 'Lost';
  if (status.includes('expired') || status.includes('closed') || status.includes('archive')) return 'Expired';
  if (status.includes('research')) return 'Researching';
  return 'Identified';
}

function buildRequirements(row) {
  return compactText([
    row.requirements_summary,
    row.requirements,
    row.eligibility_criteria ? `Eligibility: ${JSON.stringify(row.eligibility_criteria)}` : null,
    row.categories?.length ? `Categories: ${row.categories.join(', ')}` : null,
    row.focus_areas?.length ? `Focus: ${row.focus_areas.join(', ')}` : null,
  ]);
}

function formatMoney(row, ghl) {
  return row.amount_max ?? row.amount_min ?? ghl?.monetary_value ?? null;
}

function buildProperties({ row, ghl, fields, existingPage, isCreate }) {
  const props = {};
  const existingStage = getSelectName(existingPage?.properties?.Stage);
  const shouldWriteStage = isCreate || SYNC_STAGE || !existingStage;
  const deadline = row.deadline || row.closes_at;
  const project = ghl?.project_code || row.aligned_projects?.[0] || '';

  addFirstField(props, fields, ['Funder / Opportunity', 'Grant Name'], titleProp(row.name));
  addFirstField(props, fields, ['GrantScope ID', 'Supabase ID'], textProp(row.id));
  addFirstField(props, fields, ['Provider', 'Funder'], textProp(row.provider));
  addFirstField(props, fields, ['Amount (AUD)', 'Amount'], numberProp(formatMoney(row, ghl)));
  addFirstField(props, fields, ['Due date', 'Deadline'], dateProp(deadline));
  addIfField(props, fields, 'Application URL', urlProp(row.url));
  addIfField(props, fields, 'Key Requirements', textProp(buildRequirements(row)));
  addIfField(props, fields, 'Project', textProp(project));
  addIfField(props, fields, 'Last Updated', dateProp(new Date().toISOString()));

  if (shouldWriteStage) {
    addIfField(props, fields, 'Stage', selectProp(existingStage || mapStage(row)));
  }

  return props;
}

function buildChildren(row, ghl) {
  const lines = [
    `GrantScope ID: ${row.id}`,
    row.ghl_opportunity_id ? `GHL Opportunity ID: ${row.ghl_opportunity_id}` : 'GHL Opportunity ID: none linked',
    ghl ? `GHL state: ${ghl.pipeline_name || 'unknown pipeline'} / ${ghl.stage_name || 'unknown stage'} / ${ghl.status || 'unknown status'}` : null,
    row.last_verified_at ? `GrantScope last verified: ${row.last_verified_at}` : null,
  ].filter(Boolean);

  return [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: richText(lines.join('\n')) },
    },
  ];
}

async function findPageByGrantScopeId(id, fields) {
  const property = identityField(fields);
  if (!property) throw new Error('Notion database has neither GrantScope ID nor Supabase ID');
  const result = await notionRequest('POST', `/databases/${PIPELINE_DB}/query`, {
    page_size: 10,
    filter: {
      property,
      rich_text: { equals: id },
    },
  });

  return result.results || [];
}

async function getMappedPage(notionPageId) {
  if (!notionPageId) return null;
  try {
    return await notionRequest('GET', `/pages/${notionPageId}`);
  } catch (err) {
    return { error: err.message };
  }
}

async function loadRows() {
  const ids = PILOT.map((item) => item.id);
  const { data, error } = await supabase
    .from('grant_opportunities')
    .select('id, name, description, amount_min, amount_max, deadline, closes_at, provider, url, requirements, requirements_summary, eligibility_criteria, categories, focus_areas, application_status, status, pipeline_stage, aligned_projects, ghl_opportunity_id, last_verified_at, updated_at')
    .in('id', ids);

  if (error) throw new Error(`grant_opportunities read failed: ${error.message}`);

  const rows = new Map((data || []).map((row) => [row.id, row]));
  const missing = ids.filter((id) => !rows.has(id));
  if (missing.length) {
    throw new Error(`Missing pilot grant_opportunities rows: ${missing.join(', ')}`);
  }

  const ghlIds = [...new Set((data || []).map((row) => row.ghl_opportunity_id).filter(Boolean))];
  if (!ghlIds.length) return { rows, ghlById: new Map() };

  const { data: ghlRows, error: ghlError } = await supabase
    .from('ghl_opportunities')
    .select('ghl_id, name, pipeline_name, stage_name, status, monetary_value, project_code, sync_status, last_synced_at, ghl_updated_at')
    .in('ghl_id', ghlIds);

  if (ghlError) throw new Error(`ghl_opportunities read failed: ${ghlError.message}`);

  return {
    rows,
    ghlById: new Map((ghlRows || []).map((row) => [row.ghl_id, row])),
  };
}

async function syncPilot() {
  console.log(`sync-grant-pipeline-pilot ${DRY_RUN ? '[dry-run]' : '[apply]'}${SYNC_STAGE ? ' [sync-stage]' : ''}`);
  console.log(`Pilot rows: ${PILOT.length}`);

  const database = await notionRequest('GET', `/databases/${PIPELINE_DB}`);
  const fields = getPropertyNames(database);
  const { rows, ghlById } = await loadRows();

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;
  let conflicts = 0;

  for (const item of PILOT) {
    const row = rows.get(item.id);
    const ghl = row.ghl_opportunity_id ? ghlById.get(row.ghl_opportunity_id) : null;

    try {
      const pagesById = await findPageByGrantScopeId(item.id, fields);
      const mappedPage = pagesById.length ? null : await getMappedPage(item.notionPageId);

      if (mappedPage?.error) {
        throw new Error(`mapped Notion page unavailable: ${mappedPage.error}`);
      }

      if (pagesById.length > 1) {
        conflicts++;
        console.log(`  [conflict] ${row.name}: ${pagesById.length} pages already have Supabase ID ${item.id}`);
      }

      const page = pagesById[0] || mappedPage;
      const pageId = page?.id;
      const idProperty = identityField(fields);
      const existingSupabaseId = getPlainText(page?.properties?.[idProperty]);
      const existingTitle = getPlainText(page?.properties?.['Funder / Opportunity'] || page?.properties?.['Grant Name']);

      if (page && existingSupabaseId && existingSupabaseId !== item.id && !/^LM\d+$/i.test(existingSupabaseId)) {
        conflicts++;
        console.log(`  [conflict] ${row.name}: mapped page has different Supabase ID ${existingSupabaseId}`);
      }

      if (!page && !item.createIfMissing) {
        skipped++;
        console.log(`  [skip] ${row.name}: no Notion page found and createIfMissing=false`);
        continue;
      }

      const action = page ? 'update' : 'create';
      const properties = buildProperties({
        row,
        ghl,
        fields,
        existingPage: page,
        isCreate: action === 'create',
      });

      if (DRY_RUN) {
        const target = pageId ? `${pageId} (${existingTitle || 'untitled'})` : 'new page';
        console.log(`  [dry] ${action} ${target}`);
        console.log(`        ${row.name}`);
        console.log(`        Supabase ID: ${existingSupabaseId || '(blank)'} -> ${row.id}`);
        console.log(`        GHL: ${row.ghl_opportunity_id || '(none)'}${ghl ? ` / ${ghl.stage_name || 'unknown stage'} / ${ghl.status || 'unknown status'}` : ''}`);
      } else if (action === 'update') {
        await notionRequest('PATCH', `/pages/${pageId}`, { properties });
        updated++;
        console.log(`  [updated] ${row.name}`);
      } else {
        await notionRequest('POST', '/pages', {
          parent: { database_id: PIPELINE_DB },
          properties,
          children: buildChildren(row, ghl),
        });
        created++;
        console.log(`  [created] ${row.name}`);
      }

      if (DRY_RUN) {
        if (action === 'update') updated++;
        else created++;
      }

      await new Promise((resolve) => setTimeout(resolve, 350));
    } catch (err) {
      failed++;
      console.error(`  [failed] ${item.label}: ${err.message}`);
    }
  }

  console.log(`\nDone: created=${created} updated=${updated} skipped=${skipped} conflicts=${conflicts} failed=${failed}`);
  if (DRY_RUN) {
    console.log('Dry-run only. Re-run with --apply to write these pilot rows.');
  }

  return { created, updated, skipped, conflicts, failed };
}

syncPilot()
  .then((result) => {
    process.exit(result.failed ? 1 : 0);
  })
  .catch((err) => {
    console.error(`Sync failed: ${err.message}`);
    process.exit(1);
  });
