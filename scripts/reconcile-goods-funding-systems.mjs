#!/usr/bin/env node

import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { canonicalUrl, normaliseIdentityText, promotionKey } from './lib/opportunity-promotion.mjs';

const APPLY = process.argv.includes('--apply');
const argValue = (name) => process.argv.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1);
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_DB = argValue('--notion-db') || process.env.NOTION_FUNDER_OPPORTUNITIES_DB || process.env.NOTION_GRANT_PIPELINE_DB;
const NOTION_API = 'https://api.notion.com/v1';
const OUTPUT = 'outputs/funding-research/cross-system-reconciliation-2026-08-12.json';
const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function notion(method, path, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  let response;
  try {
    response = await fetch(`${NOTION_API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${NOTION_TOKEN}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`Notion ${response.status}: ${(await response.text()).slice(0, 500)}`);
  return response.json();
}

function plain(prop) {
  const values = prop?.title || prop?.rich_text || [];
  return values.map(value => value.plain_text || value.text?.content || '').join('').trim();
}

function url(prop) {
  return prop?.url || null;
}

async function loadNotionPages() {
  const pages = [];
  let cursor;
  do {
    const result = await notion('POST', `/databases/${NOTION_DB}/query`, { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
    pages.push(...(result.results || []));
    cursor = result.has_more ? result.next_cursor : null;
  } while (cursor);
  return pages;
}

async function loadGrantRows() {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('grant_opportunities')
      .select('id,name,provider,program,url,source_id,deadline,closes_at,aligned_projects,last_verified_at,goods_relevance_score,goods_relevance_signals')
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

function uniqueCandidate(page, byUrl, byName) {
  const props = page.properties || {};
  const pageUrl = canonicalUrl(url(props['Application URL']) || url(props['Source URL']));
  if (pageUrl) {
    const matches = byUrl.get(pageUrl) || [];
    if (matches.length === 1) return { candidate: matches[0], method: 'exact_official_url' };
    if (matches.length > 1) return { conflicts: matches, method: 'ambiguous_official_url' };
  }
  const title = normaliseIdentityText(plain(props['Funder / Opportunity']) || plain(props['Grant Name']));
  const matches = byName.get(title) || [];
  if (title && matches.length === 1) return { candidate: matches[0], method: 'exact_normalised_title' };
  if (matches.length > 1) return { conflicts: matches, method: 'ambiguous_title' };
  return { method: 'unmatched' };
}

async function main() {
  if (!NOTION_TOKEN || !NOTION_DB || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing Notion or Supabase configuration');
  const database = await notion('GET', `/databases/${NOTION_DB}`);
  const fields = new Set(Object.keys(database.properties || {}));
  const idField = fields.has('GrantScope ID') ? 'GrantScope ID' : fields.has('Supabase ID') ? 'Supabase ID' : null;
  if (!idField) throw new Error('Notion funding database has no GrantScope ID field');

  const [pages, grants] = await Promise.all([loadNotionPages(), loadGrantRows()]);
  const byUrl = new Map();
  const byName = new Map();
  for (const grant of grants) {
    const grantUrl = canonicalUrl(grant.url);
    if (grantUrl) byUrl.set(grantUrl, [...(byUrl.get(grantUrl) || []), grant]);
    const name = normaliseIdentityText(grant.name);
    if (name) byName.set(name, [...(byName.get(name) || []), grant]);
  }

  const linked = [];
  const conflicts = [];
  const unmatched = [];
  const duplicateGrantScopeIds = new Map();
  const duplicateGhlIds = new Map();

  for (const page of pages) {
    const props = page.properties || {};
    const existingId = plain(props[idField]);
    const ghlId = plain(props['GHL Opportunity ID']);
    if (existingId) duplicateGrantScopeIds.set(existingId, [...(duplicateGrantScopeIds.get(existingId) || []), page.id]);
    if (ghlId) duplicateGhlIds.set(ghlId, [...(duplicateGhlIds.get(ghlId) || []), page.id]);
    if (existingId) continue;

    const match = uniqueCandidate(page, byUrl, byName);
    const title = plain(props['Funder / Opportunity']) || plain(props['Grant Name']);
    if (match.candidate) {
      linked.push({ pageId: page.id, title, grantScopeId: match.candidate.id, method: match.method });
      if (APPLY) {
        await notion('PATCH', `/pages/${page.id}`, { properties: { [idField]: { rich_text: [{ type: 'text', text: { content: match.candidate.id } }] } } });
        const key = promotionKey({ projectCode: 'ACT-GD', provider: match.candidate.provider, programId: match.candidate.id, program: match.candidate.name, round: match.candidate.deadline?.slice(0, 4), receivingEntity: 'unassigned' });
        const { error } = await supabase.from('opportunity_promotions').upsert({
          source_type: 'grant', source_ref: match.candidate.id, project_code: 'ACT-GD', deterministic_key: key,
          target_system: 'notion', target_record_id: page.id, status: 'linked', promoted_at: new Date().toISOString(),
          gate_snapshot: { backfill: true, match_method: match.method },
        }, { onConflict: 'source_type,source_ref,project_code,target_system' });
        if (error) throw new Error(`Promotion ledger: ${error.message}`);
      }
    } else if (match.conflicts) {
      conflicts.push({ pageId: page.id, title, method: match.method, candidates: match.conflicts.map(row => ({ id: row.id, name: row.name, url: row.url })) });
    } else {
      unmatched.push({ pageId: page.id, title, applicationUrl: url(props['Application URL']), sourceUrl: url(props['Source URL']), ghlId });
    }
  }

  const report = {
    generatedAt: new Date().toISOString(), apply: APPLY, notionPages: pages.length, grantRows: grants.length,
    linked, conflicts, unmatched,
    duplicateGrantScopeIds: [...duplicateGrantScopeIds].filter(([, ids]) => ids.length > 1),
    duplicateGhlIds: [...duplicateGhlIds].filter(([, ids]) => ids.length > 1),
  };
  await mkdir('outputs/funding-research', { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ notionPages: pages.length, grantRows: grants.length, linkable: linked.length, conflicts: conflicts.length, unmatched: unmatched.length, duplicateGrantScopeIds: report.duplicateGrantScopeIds.length, duplicateGhlIds: report.duplicateGhlIds.length, applied: APPLY, report: OUTPUT }, null, 2));
}

main().catch(error => { console.error(`FAILED: ${error.message}`); process.exitCode = 1; });
