#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import XLSX from 'xlsx';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const SOURCE_PAGE = 'https://www.wa.gov.au/government/publications/western-australian-aboriginal-expenditure-review-2023-24';
const SOURCE_URL = 'https://www.wa.gov.au/system/files/2025-12/aboriginal-expenditure-review-2023-24-program-list.xlsx';
const RAW_PATH = resolve(ROOT, 'data/wa-aer/2023-24/program-list.xlsx');
const PROFILE_PATH = resolve(ROOT, 'data/wa-aer/2023-24/profile.json');
const REPORT_PATH = resolve(ROOT, 'thoughts/shared/research/2026-09-27-wa-aer-program-list-profile.md');
const LOCAL_SOURCE = process.argv.find((arg) => arg.startsWith('--source='))?.slice('--source='.length);

const FIELDS = [
  'expenditure_type',
  'agency',
  'program_name',
  'funding_source',
  'statewide',
  'metro_perth_peel',
  'south_west_great_southern',
  'kimberley',
  'pilbara',
  'mid_west_gascoyne',
  'goldfields_esperance',
  'wheatbelt',
  'ctg_targets',
  'priority_reform_area',
  'wa_government_only',
  'wa_government_external_parties',
  'external_parties_only',
  'aboriginal_organisation_or_acco',
  'aboriginal_organisation_or_acco_only',
];

const BOOLEAN_FIELDS = new Set([
  'statewide',
  'metro_perth_peel',
  'south_west_great_southern',
  'kimberley',
  'pilbara',
  'mid_west_gascoyne',
  'goldfields_esperance',
  'wheatbelt',
  'wa_government_only',
  'wa_government_external_parties',
  'external_parties_only',
  'aboriginal_organisation_or_acco',
  'aboriginal_organisation_or_acco_only',
]);

function marker(value) {
  if (value == null || String(value).trim() === '') return false;
  const normalised = String(value).trim().toLowerCase();
  if (['ü', 'x', 'yes', 'y', 'true', '1', '✓', '✔'].includes(normalised)) return true;
  throw new Error(`Unexpected workbook marker: ${JSON.stringify(value)}`);
}

function clean(value) {
  if (value == null) return null;
  const text = String(value).replace(/\s+/g, ' ').trim();
  return text || null;
}

function countBy(rows, field) {
  return Object.fromEntries(
    [...rows.reduce((counts, row) => {
      const key = row[field] ?? 'Unknown';
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts;
    }, new Map())].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]))),
  );
}

async function acquire() {
  if (LOCAL_SOURCE) return readFile(resolve(LOCAL_SOURCE));
  const response = await fetch(SOURCE_URL, {
    headers: { 'User-Agent': 'CivicGraph/1.0 WA AER evidence ingestor' },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error(`WA AER download failed: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function parse(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', raw: false });
  if (workbook.SheetNames.length !== 1 || workbook.SheetNames[0] !== 'Program List') {
    throw new Error(`Unexpected workbook sheets: ${workbook.SheetNames.join(', ')}`);
  }

  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets['Program List'], {
    header: 1,
    defval: null,
    raw: false,
  });
  const headers = matrix[1]?.map(clean);
  if (headers?.length !== FIELDS.length) {
    throw new Error(`Expected ${FIELDS.length} columns, found ${headers?.length ?? 0}`);
  }

  const rows = matrix.slice(2).filter((row) => row.some((value) => clean(value))).map((values, index) => {
    const row = { source_row: index + 3 };
    for (let column = 0; column < FIELDS.length; column += 1) {
      const field = FIELDS[column];
      row[field] = BOOLEAN_FIELDS.has(field) ? marker(values[column]) : clean(values[column]);
    }
    if (!row.expenditure_type || !row.agency || !row.program_name || !row.funding_source) {
      throw new Error(`Required value missing at workbook row ${row.source_row}`);
    }
    row.program_key = createHash('sha256')
      .update([row.agency, row.program_name, row.expenditure_type, row.funding_source].join('|').toLowerCase())
      .digest('hex')
      .slice(0, 24);
    return row;
  });

  const duplicateKeys = [...rows.reduce((counts, row) => {
    counts.set(row.program_key, (counts.get(row.program_key) ?? 0) + 1);
    return counts;
  }, new Map())].filter(([, count]) => count > 1);

  return { headers, rows, duplicateKeys };
}

function buildProfile(buffer, parsed) {
  const { rows, duplicateKeys } = parsed;
  const regionFields = [...BOOLEAN_FIELDS].filter((field) => !field.startsWith('wa_') && !field.startsWith('external_') && !field.startsWith('aboriginal_'));
  return {
    source_page: SOURCE_PAGE,
    source_url: SOURCE_URL,
    fetched_at: new Date().toISOString(),
    sha256: createHash('sha256').update(buffer).digest('hex'),
    bytes: buffer.length,
    workbook: { sheet: 'Program List', program_rows: rows.length, columns: FIELDS.length },
    validation: {
      required_fields_complete: true,
      unexpected_markers: 0,
      repeated_program_keys: duplicateKeys.map(([program_key, count]) => ({ program_key, count })),
    },
    coverage: {
      agencies: countBy(rows, 'agency'),
      expenditure_types: countBy(rows, 'expenditure_type'),
      funding_sources: countBy(rows, 'funding_source'),
      regions: Object.fromEntries(regionFields.map((field) => [field, rows.filter((row) => row[field]).length])),
      provider_types: {
        wa_government_only: rows.filter((row) => row.wa_government_only).length,
        wa_government_external_parties: rows.filter((row) => row.wa_government_external_parties).length,
        external_parties_only: rows.filter((row) => row.external_parties_only).length,
        aboriginal_organisation_or_acco: rows.filter((row) => row.aboriginal_organisation_or_acco).length,
        aboriginal_organisation_or_acco_only: rows.filter((row) => row.aboriginal_organisation_or_acco_only).length,
      },
      kimberley_programs: rows.filter((row) => row.kimberley).length,
      justice_programs: rows.filter((row) => /justice/i.test(row.agency)).length,
    },
    rows,
  };
}

function markdown(profile) {
  const topAgencies = Object.entries(profile.coverage.agencies).slice(0, 10);
  return `# WA Aboriginal Expenditure Review program-list profile\n\n` +
    `**Evidence status:** verified from the official XLSX. This is a program inventory, not an award, contract, recipient, expenditure-value or ACCO register.\n\n` +
    `- Source page: ${profile.source_page}\n` +
    `- Source file: ${profile.source_url}\n` +
    `- Retrieved: ${profile.fetched_at}\n` +
    `- SHA-256: \`${profile.sha256}\`\n` +
    `- Program rows: ${profile.workbook.program_rows}\n` +
    `- Repeated program keys: ${profile.validation.repeated_program_keys.length}\n\n` +
    `## What the file can establish\n\n` +
    `It identifies WA Government Aboriginal programs, their agency, broad delivery geography, Closing the Gap alignment and whether Aboriginal organisations or ACCOs were involved in delivery. It provides a strong discovery and prioritisation layer for the ACCO Transition Pipeline.\n\n` +
    `It does not name providers, contract values, contract dates, incumbents, procurement identifiers or transition readiness. Those facts must come from Tenders WA, agency disclosures, contracts and human verification.\n\n` +
    `## Coverage\n\n` +
    `- Kimberley programs: ${profile.coverage.kimberley_programs}\n` +
    `- Justice agency programs: ${profile.coverage.justice_programs}\n` +
    `- Aboriginal organisation or ACCO involved: ${profile.coverage.provider_types.aboriginal_organisation_or_acco}\n` +
    `- Aboriginal organisation or ACCO only: ${profile.coverage.provider_types.aboriginal_organisation_or_acco_only}\n\n` +
    `## Largest agency cohorts\n\n` +
    topAgencies.map(([agency, count]) => `- ${agency}: ${count}`).join('\n') + '\n\n' +
    `## Data-fit decision\n\n` +
    `Use this source to discover and classify programs. Do not write its rows into \`state_tenders\` or sum them into justice funding. Preserve the workbook artifact and load the normalised rows into a dedicated WA AER program table after schema review.\n`;
}

async function main() {
  const buffer = await acquire();
  const parsed = parse(buffer);
  const profile = buildProfile(buffer, parsed);
  await mkdir(dirname(RAW_PATH), { recursive: true });
  await mkdir(dirname(REPORT_PATH), { recursive: true });
  await writeFile(RAW_PATH, buffer);
  await writeFile(PROFILE_PATH, `${JSON.stringify(profile, null, 2)}\n`);
  await writeFile(REPORT_PATH, markdown(profile));
  console.log(JSON.stringify({
    raw_path: RAW_PATH,
    profile_path: PROFILE_PATH,
    report_path: REPORT_PATH,
    sha256: profile.sha256,
    rows: profile.workbook.program_rows,
    repeated_program_keys: profile.validation.repeated_program_keys.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(`[wa-aer] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
