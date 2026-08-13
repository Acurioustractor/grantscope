#!/usr/bin/env node

import 'dotenv/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { aggregateFunders, recipientNeighbourhoodBlocks } from './lib/recipient-neighbourhood.mjs';

const args = process.argv.slice(2);
const getArg = (name, fallback) => args.find(arg => arg.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;
const PROFILE_PATH = getArg('--profile', 'scripts/funding-profiles/goods-on-country.json');
const LIMIT = Number(getArg('--limit', '40'));
const MIN_ANALOGUE_SCORE = Number(getArg('--min-analogue-score', '18'));
const OUTPUT_DIR = getArg('--output-dir', `outputs/funding-research/recipient-neighbourhood-${new Date().toISOString().slice(0, 10)}`);

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const PAGE_SIZE = 1000;
const MAX_RECORDS = Number(getArg('--max-records', '12000'));

const baseSql = `
SELECT
  fg.foundation_id::text,
  fg.foundation_name,
  fg.grantee_name,
  fg.grantee_entity_id::text,
  fg.grant_amount,
  fg.grant_year,
  fg.program_name,
  fg.source_url,
  fg.source_document_url,
  fg.evidence_text,
  ge.sector AS grantee_sector,
  f.website AS foundation_website,
  f.type AS foundation_type,
  f.parent_company,
  f.thematic_focus,
  f.geographic_focus,
  fp.url AS program_url,
  fp.status AS program_status,
  fp.application_mode,
  fp.description AS program_description
FROM foundation_grantees fg
JOIN foundations f ON f.id = fg.foundation_id
LEFT JOIN gs_entities ge ON ge.id = fg.grantee_entity_id
LEFT JOIN LATERAL (
  SELECT p.url, p.status, p.application_mode, p.description
  FROM foundation_programs p
  WHERE p.foundation_id = fg.foundation_id
  ORDER BY (p.status ILIKE '%open%') DESC, p.scraped_at DESC NULLS LAST
  LIMIT 1
) fp ON true
WHERE fg.source_url IS NOT NULL OR fg.source_document_url IS NOT NULL
ORDER BY fg.extracted_at DESC`;

async function loadAnalogueRows() {
  const rows = [];
  for (let offset = 0; offset < MAX_RECORDS; offset += PAGE_SIZE) {
    const query = `${baseSql}\nLIMIT ${PAGE_SIZE} OFFSET ${offset}`;
    const { data, error } = await supabase.rpc('exec_sql', { query });
    if (error) throw new Error(`Analogue query failed at offset ${offset}: ${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

function escapeCell(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
}

function money(value) {
  return value > 0 ? `$${Math.round(value).toLocaleString('en-AU')}` : 'not recorded';
}

function websiteLink(value) {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function renderMarkdown(profile, funders, sourceQueue, monitoredSources, stats) {
  const lines = [
    `# ${profile.projectName} recipient-neighbourhood discovery`,
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '> Report-only discovery. No foundation, opportunity, source-frontier, or Notion records were written.',
    '',
    '## Run summary',
    '',
    `- Analogue grant records examined: ${stats.examined.toLocaleString('en-AU')}`,
    `- Records meeting analogue threshold: ${stats.matched.toLocaleString('en-AU')}`,
    `- Distinct funders surfaced: ${stats.funders.toLocaleString('en-AU')}`,
    `- New or unengaged funders in ranked output: ${stats.unengaged.toLocaleString('en-AU')}`,
    `- Goods trustee/corporate monitors: ${monitoredSources.length.toLocaleString('en-AU')}`,
    '',
    '## Ranked funders',
    '',
    '| Rank | Score | Funder | Doorway | Goods blocks | Best analogue evidence |',
    '|---:|---:|---|---|---|---|',
  ];

  funders.forEach((funder, index) => {
    const samples = funder.analogues.slice(0, 2).map(row => {
      const source = row.source_url || row.source_document_url;
      const label = `${row.grantee_name}${row.program_name ? `: ${row.program_name}` : ''} (${money(row.grant_amount)})`;
      return source ? `[${escapeCell(label)}](${source})` : escapeCell(label);
    }).join('<br>');
    lines.push(`| ${index + 1} | ${funder.score} | ${escapeCell(funder.foundation_name)}${funder.alreadyEngaged ? ' (already engaged)' : ''} | ${escapeCell(funder.doorway)} | ${escapeCell(funder.blockIds.join(', '))} | ${samples} |`);
  });

  lines.push('', '## Source-expansion queue', '',
    'These are official funder surfaces associated with strong analogue evidence but lacking a clearly classified open doorway in the current record.', '',
    '| Priority | Funder | Website | Suggested discovery surfaces |',
    '|---:|---|---|---|');
  sourceQueue.forEach((item, index) => lines.push(
    `| ${index + 1} | ${escapeCell(item.foundation_name)} | ${item.website ? `[official site](${websiteLink(item.website)})` : 'website missing'} | grants; funding; apply; community investment; partnerships; annual report; recipients; sitemap |`
  ));

  lines.push('', '## Trustee and corporate monitors', '',
    '| Priority | Source | Doorway | Geography | Official page |',
    '|---:|---|---|---|---|');
  monitoredSources.forEach((item, index) => lines.push(
    `| ${index + 1} | ${escapeCell(item.source_name)} | ${escapeCell(item.metadata?.doorway ?? 'research')} | ${escapeCell(item.metadata?.place ?? item.metadata?.geography ?? 'national/unknown')} | [official source](${item.target_url}) |`
  ));

  lines.push('', '## Funding-block coverage', '');
  for (const block of recipientNeighbourhoodBlocks) {
    const count = funders.filter(funder => funder.blockIds.includes(block.id)).length;
    lines.push(`- **${block.label}:** ${count} ranked funders`);
  }
  lines.push('', '## Review rule', '',
    'Analogue evidence shows that a funder has supported adjacent work. It does not prove a current open round or Goods eligibility. Verify the official application route, receiving entity, geography, supported costs, and deadline before promotion.');
  return `${lines.join('\n')}\n`;
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  const profile = JSON.parse(await readFile(PROFILE_PATH, 'utf8'));
  const engagedNames = (profile.hardRules?.alreadyEngagedFunders ?? []).flatMap(funder => [funder.name, ...(funder.aliases ?? [])]);
  const data = await loadAnalogueRows();

  const scoredFunders = aggregateFunders(data, engagedNames);
  const matchedRows = scoredFunders.flatMap(funder => funder.analogues).filter(row => row.score >= MIN_ANALOGUE_SCORE);
  const matchedIds = new Set(matchedRows.map(row => `${row.foundation_id}:${row.grantee_name}:${row.program_name ?? ''}`));
  const funders = aggregateFunders(
    data.filter(row => matchedIds.has(`${row.foundation_id}:${row.grantee_name}:${row.program_name ?? ''}`)),
    engagedNames,
  ).slice(0, LIMIT);
  const sourceQueue = funders.filter(funder => !funder.alreadyEngaged && ['relationship_research', 'published_program'].includes(funder.doorway)).slice(0, 20);
  const { data: monitoredSources, error: monitorError } = await supabase
    .from('source_frontier')
    .select('source_key,source_name,target_url,priority,metadata,foundation_id')
    .eq('enabled', true)
    .or('metadata->>trustee_portal.eq.true,metadata->>corporate_community.eq.true')
    .order('priority', { ascending: false });
  if (monitorError) throw new Error(`Monitor query failed: ${monitorError.message}`);
  const stats = {
    examined: data.length,
    matched: matchedRows.length,
    funders: funders.length,
    unengaged: funders.filter(funder => !funder.alreadyEngaged).length,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  const report = renderMarkdown(profile, funders, sourceQueue, monitoredSources ?? [], stats);
  await writeFile(path.join(OUTPUT_DIR, 'report.md'), report);
  await writeFile(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify({ generatedAt: new Date().toISOString(), profile: profile.projectCode, stats, funders, sourceQueue, monitoredSources }, null, 2));

  console.log(report);
  console.log(`Reports written to ${OUTPUT_DIR}/report.md and ${OUTPUT_DIR}/report.json`);
}

main().catch(error => {
  console.error(`FAILED: ${error.message}`);
  process.exitCode = 1;
});
