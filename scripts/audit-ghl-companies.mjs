#!/usr/bin/env node

import fs from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import {
  SpreadsheetFile,
  Workbook,
} from '/Users/benknight/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';

const INPUT = process.argv[2] || '/Users/benknight/Downloads/Companies.csv';
const OUTPUT_DIR = process.argv[3] || 'outputs/ghl-company-audit-2026-07-28';
const BASE = 'https://services.leadconnectorhq.com';
const API_KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;

if (!API_KEY || !LOCATION_ID) throw new Error('Missing GHL_API_KEY or GHL_LOCATION_ID');

const PIPELINES = [
  ['JvBFYpVpyKsw899lkFgj', 'Goods Supporter Journey'],
  ['FjMyJM3YzWQFmKqR9fur', 'Goods Buyer Pipeline'],
  ['UQsrmuqzxMSdCTklxEcG', 'Goods Demand Register'],
];

const clean = (value) => String(value || '').trim();
const normName = (value) => clean(value)
  .toLowerCase()
  .replace(/&/g, 'and')
  .replace(/\b(the|pty|ltd|limited|incorporated|inc)\b/g, '')
  .replace(/[^a-z0-9]/g, '');
const domain = (value) => {
  try {
    const raw = clean(value);
    if (!raw) return '';
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`)
      .hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};
const emailDomain = (value) => clean(value).toLowerCase().split('@')[1] || '';
const isGenericEmail = (value) => /^(info|admin|contact|enquiries|reception|hello|office|mail|generalmanager|governance|accounts|chairman|legalcompliance)@/i.test(clean(value));
const uniq = (values) => [...new Set(values.filter(Boolean))];

async function ghl(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL ${response.status} ${path}: ${text.slice(0, 400)}`);
  return JSON.parse(text);
}

async function allContacts() {
  const rows = [];
  let startAfter;
  let startAfterId;
  for (let page = 0; page < 80; page += 1) {
    const query = new URLSearchParams({ locationId: LOCATION_ID, limit: '100' });
    if (startAfter && startAfterId) {
      query.set('startAfter', String(startAfter));
      query.set('startAfterId', startAfterId);
    }
    const data = await ghl(`/contacts/?${query}`);
    rows.push(...(data.contacts || []));
    if (!data.meta?.nextPage || !data.meta?.startAfterId) break;
    startAfter = data.meta.startAfter;
    startAfterId = data.meta.startAfterId;
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

async function pipelineOpportunities([pipelineId, pipelineName]) {
  const rows = [];
  let path = `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${pipelineId}&limit=100`;
  for (let page = 0; page < 20 && path; page += 1) {
    const data = await ghl(path);
    const current = data.opportunities || [];
    rows.push(...current.map((row) => ({ ...row, pipelineName })));
    if (current.length < 100) break;
    const meta = data.meta || {};
    if (meta.nextPageUrl) path = meta.nextPageUrl.replace(BASE, '');
    else if (meta.startAfter && meta.startAfterId) {
      path = `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${pipelineId}&limit=100`
        + `&startAfter=${encodeURIComponent(meta.startAfter)}&startAfterId=${encodeURIComponent(meta.startAfterId)}`;
    } else break;
  }
  return rows;
}

function connectedGroups(rows) {
  const parent = rows.map((_, index) => index);
  const find = (index) => {
    while (parent[index] !== index) {
      parent[index] = parent[parent[index]];
      index = parent[index];
    }
    return index;
  };
  const union = (a, b) => {
    a = find(a);
    b = find(b);
    if (a !== b) parent[b] = a;
  };
  for (let a = 0; a < rows.length; a += 1) {
    for (let b = a + 1; b < rows.length; b += 1) {
      const sameName = normName(rows[a]['Company Name']) === normName(rows[b]['Company Name']);
      const sameDomain = domain(rows[a].Website)
        && domain(rows[a].Website) === domain(rows[b].Website)
        && (normName(rows[a]['Company Name']).includes(normName(rows[b]['Company Name']))
          || normName(rows[b]['Company Name']).includes(normName(rows[a]['Company Name'])));
      if (sameName || sameDomain) union(a, b);
    }
  }
  const groups = new Map();
  rows.forEach((row, index) => {
    const root = find(index);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(row);
  });
  return [...groups.values()].filter((group) => group.length > 1);
}

function styleTable(sheet, range, widths) {
  sheet.showGridLines = false;
  sheet.freezePanes.freezeRows(1);
  range.format.font = { name: 'Aptos', size: 10, color: '#1F2937' };
  range.format.verticalAlignment = 'top';
  range.format.wrapText = true;
  range.getRow(0).format = {
    fill: '#17324D',
    font: { name: 'Aptos Display', size: 10, bold: true, color: '#FFFFFF' },
    rowHeight: 30,
    verticalAlignment: 'center',
  };
  widths.forEach((width, index) => {
    range.getColumn(index).format.columnWidth = width;
  });
}

function addTable(sheet, name, headers, rows, widths) {
  const matrix = [headers, ...rows];
  const range = sheet.getRangeByIndexes(0, 0, matrix.length, headers.length);
  range.values = matrix;
  styleTable(sheet, range, widths);
  sheet.tables.add(range, true, name);
  return range;
}

async function main() {
  const csv = await fs.readFile(INPUT, 'utf8');
  const companies = parse(csv, { columns: true, skip_empty_lines: true, bom: true });
  const [contacts, ...opportunitySets] = await Promise.all([
    allContacts(),
    ...PIPELINES.map(pipelineOpportunities),
  ]);
  const opportunities = opportunitySets.flat();
  const opportunitiesByContact = new Map();
  for (const opportunity of opportunities) {
    const contactId = opportunity.contact?.id || opportunity.contactId;
    if (!contactId) continue;
    if (!opportunitiesByContact.has(contactId)) opportunitiesByContact.set(contactId, []);
    opportunitiesByContact.get(contactId).push(opportunity);
  }

  const contactsByBusiness = new Map();
  for (const contact of contacts) {
    if (!contact.businessId) continue;
    if (!contactsByBusiness.has(contact.businessId)) contactsByBusiness.set(contact.businessId, []);
    contactsByBusiness.get(contact.businessId).push(contact);
  }

  const audit = companies.map((company) => {
    const linkedContacts = contactsByBusiness.get(company['Company ID']) || [];
    const linkedOpportunities = linkedContacts.flatMap((contact) => opportunitiesByContact.get(contact.id) || []);
    const contactEmails = uniq(linkedContacts.map((contact) => clean(contact.email).toLowerCase()));
    const contactPhones = uniq(linkedContacts.map((contact) => clean(contact.phone)));
    const missing = [
      !clean(company.Website) && 'website',
      !clean(company.Email) && 'company email',
      !clean(company.Phone) && 'company phone',
      !clean(company.Address) && 'address',
    ].filter(Boolean);
    const suggestedEmail = !clean(company.Email)
      ? contactEmails.find(isGenericEmail) || ''
      : '';
    const suggestedPhone = !clean(company.Phone) && linkedContacts.length === 1
      ? contactPhones[0] || ''
      : '';
    return {
      ...company,
      normalizedName: normName(company['Company Name']),
      domain: domain(company.Website),
      contactCount: linkedContacts.length,
      contactEmailCount: contactEmails.length,
      contactPhoneCount: contactPhones.length,
      opportunityCount: linkedOpportunities.length,
      supporterCount: linkedOpportunities.filter((row) => row.pipelineName === 'Goods Supporter Journey').length,
      buyerCount: linkedOpportunities.filter((row) => row.pipelineName === 'Goods Buyer Pipeline').length,
      demandCount: linkedOpportunities.filter((row) => row.pipelineName === 'Goods Demand Register').length,
      missing: missing.join(', '),
      suggestedEmail,
      suggestedPhone,
      enrichmentSource: suggestedEmail || suggestedPhone ? 'Linked GHL contact; verify organisation-level use' : '',
      score: linkedOpportunities.length * 20 + linkedContacts.length * 5
        + ['Website', 'Email', 'Phone', 'Address'].filter((field) => clean(company[field])).length,
    };
  });
  const auditById = new Map(audit.map((row) => [row['Company ID'], row]));

  const duplicateRows = [];
  const duplicateIds = new Set();
  connectedGroups(companies).forEach((group, groupIndex) => {
    const reviewed = group.map((row) => auditById.get(row['Company ID']));
    const canonical = [...reviewed].sort((a, b) => b.score - a.score)[0];
    for (const row of reviewed) {
      duplicateIds.add(row['Company ID']);
      const sharedName = row.normalizedName === canonical.normalizedName;
      const sharedDomain = row.domain && row.domain === canonical.domain;
      duplicateRows.push({
        group: `D${String(groupIndex + 1).padStart(2, '0')}`,
        id: row['Company ID'],
        name: row['Company Name'],
        website: row.Website,
        contacts: row.contactCount,
        opportunities: row.opportunityCount,
        supporter: row.supporterCount,
        buyer: row.buyerCount,
        demand: row.demandCount,
        recommendation: row['Company ID'] === canonical['Company ID'] ? 'KEEP CANONICAL' : 'MERGE AFTER REASSIGNMENT',
        canonicalId: canonical['Company ID'],
        rationale: row['Company ID'] === canonical['Company ID']
          ? 'Best combined relationship coverage and field completeness'
          : `Same organisation (${sharedName ? 'name' : ''}${sharedName && sharedDomain ? ' + ' : ''}${sharedDomain ? 'domain' : ''}); move contacts/opportunities and preserve notes first`,
      });
    }
  });

  const peopleRows = [];
  for (const company of audit) {
    for (const contact of contactsByBusiness.get(company['Company ID']) || []) {
      const linkedOpportunities = opportunitiesByContact.get(contact.id) || [];
      peopleRows.push([
        company['Company ID'],
        company['Company Name'],
        contact.id,
        [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || '',
        contact.email || '',
        contact.phone || '',
        (contact.tags || []).join(', '),
        linkedOpportunities.length,
        uniq(linkedOpportunities.map((row) => row.pipelineName)).join(', '),
        uniq(linkedOpportunities.map((row) => row.name)).join(' | '),
        contact.dateUpdated || contact.updatedAt || '',
      ]);
    }
  }

  const enrichmentRows = audit
    .filter((row) => row.missing)
    .sort((a, b) => b.opportunityCount - a.opportunityCount || b.contactCount - a.contactCount)
    .map((row) => [
      row['Company ID'],
      row['Company Name'],
      row.missing,
      row.Website || '',
      row.Email || '',
      row.Phone || '',
      row.suggestedEmail,
      row.suggestedPhone,
      row.enrichmentSource || 'Official website / ABR / ORIC / ACNC research required',
      row.opportunityCount ? 'High' : row.contactCount ? 'Medium' : 'Low',
      row.opportunityCount,
      row.contactCount,
      'Not started',
    ]);

  const workbook = Workbook.create();
  const summary = workbook.worksheets.add('Executive Summary');
  const companySheet = workbook.worksheets.add('Company Audit');
  const duplicateSheet = workbook.worksheets.add('Duplicate Review');
  const peopleSheet = workbook.worksheets.add('People Links');
  const enrichmentSheet = workbook.worksheets.add('Enrichment Queue');
  const rulesSheet = workbook.worksheets.add('System Rules');

  summary.showGridLines = false;
  summary.getRange('A1:H1').merge();
  summary.getRange('A1').values = [['Goods Company & Relationship Audit']];
  summary.getRange('A1:H1').format = {
    fill: '#17324D',
    font: { name: 'Aptos Display', size: 20, bold: true, color: '#FFFFFF' },
    rowHeight: 42,
    verticalAlignment: 'center',
  };
  summary.getRange('A3:H3').values = [[
    'Companies', 'Duplicate groups', 'Linked companies', 'Linked people',
    'Companies with opportunities', 'Supporter opps', 'Buyer opps', 'Demand opps',
  ]];
  summary.getRange('A4:H4').values = [[
    audit.length,
    new Set(duplicateRows.map((row) => row.group)).size,
    audit.filter((row) => row.contactCount).length,
    peopleRows.length,
    audit.filter((row) => row.opportunityCount).length,
    opportunities.filter((row) => row.pipelineName === 'Goods Supporter Journey').length,
    opportunities.filter((row) => row.pipelineName === 'Goods Buyer Pipeline').length,
    opportunities.filter((row) => row.pipelineName === 'Goods Demand Register').length,
  ]];
  summary.getRange('A3:H3').format = { fill: '#DCE8F2', font: { bold: true, color: '#17324D' }, wrapText: true };
  summary.getRange('A4:H4').format = { font: { size: 18, bold: true, color: '#17324D' }, rowHeight: 34 };
  summary.getRange('A6:H6').merge();
  summary.getRange('A6').values = [['Decision: HighLevel is the operational relationship system. Companies identify organisations; Contacts hold people and communication history; Opportunities hold a specific funding, buyer or demand pathway. Notion remains the strategy and governance layer.']];
  summary.getRange('A6:H6').format = { fill: '#E8F3EC', font: { bold: true, color: '#21543D' }, wrapText: true, rowHeight: 54 };
  summary.getRange('A8:B14').values = [
    ['Priority finding', 'Action'],
    ['Duplicate records split relationships', 'Reassign contacts and opportunities to the canonical Company ID before archiving a duplicate.'],
    ['Company fields are incomplete', 'Enrich organisation-level website, generic email, phone, address and legal identifiers with source and confidence.'],
    ['Most contacts are not linked to a company', `${contacts.filter((row) => !row.businessId).length} of ${contacts.length} live contacts have no businessId; match by verified work-email domain, then manually review.`],
    ['Shared service details are not duplicates', 'Outback Stores-managed community stores can share email/phone/domain but remain separate organisations.'],
    ['Communication belongs to people', 'Keep named emails/phones on Contacts; use Company records for the organisation identity and roll-up views.'],
    ['One opportunity per pathway', 'A company can have several opportunities, but each should represent one concrete supporter, buyer or community-demand pathway.'],
  ];
  summary.getRange('A8:B14').format.wrapText = true;
  summary.getRange('A8:B14').format.autofitRows();
  summary.getRange('A8:B8').format = { fill: '#17324D', font: { bold: true, color: '#FFFFFF' } };
  summary.getRange('A1:H15').format.font = { name: 'Aptos', color: '#1F2937' };
  summary.getRange('A1:H1').format.font = { name: 'Aptos Display', size: 20, bold: true, color: '#FFFFFF' };
  summary.getRange('A:A').format.columnWidth = 29;
  summary.getRange('B:B').format.columnWidth = 72;
  summary.getRange('C:H').format.columnWidth = 18;

  addTable(companySheet, 'CompanyAuditTable', [
    'Company ID', 'Company Name', 'Website', 'Domain', 'Company Email', 'Company Phone',
    'State', 'City', 'Contacts', 'Contact emails', 'Contact phones', 'All opportunities',
    'Supporter', 'Buyer', 'Demand', 'Missing fields', 'Duplicate status', 'Description',
  ], audit.map((row) => [
    row['Company ID'], row['Company Name'], row.Website || '', row.domain, row.Email || '', row.Phone || '',
    row.State || '', row.City || '', row.contactCount, row.contactEmailCount, row.contactPhoneCount,
    row.opportunityCount, row.supporterCount, row.buyerCount, row.demandCount, row.missing,
    duplicateIds.has(row['Company ID']) ? 'Review duplicate group' : 'No duplicate signal',
    row.Description || '',
  ]), [26, 34, 34, 24, 30, 19, 12, 18, 10, 13, 13, 15, 11, 9, 9, 34, 24, 70]);

  addTable(duplicateSheet, 'DuplicateReviewTable', [
    'Group', 'Company ID', 'Company Name', 'Website', 'Contacts', 'Opportunities',
    'Supporter', 'Buyer', 'Demand', 'Recommendation', 'Canonical Company ID', 'Rationale',
  ], duplicateRows.map((row) => [
    row.group, row.id, row.name, row.website || '', row.contacts, row.opportunities,
    row.supporter, row.buyer, row.demand, row.recommendation, row.canonicalId, row.rationale,
  ]), [10, 26, 36, 34, 11, 15, 10, 9, 9, 28, 26, 58]);

  addTable(peopleSheet, 'PeopleLinksTable', [
    'Company ID', 'Company Name', 'Contact ID', 'Person', 'Email', 'Phone', 'Tags',
    'Opportunities', 'Pipelines', 'Opportunity names', 'Last updated',
  ], peopleRows, [26, 34, 26, 26, 34, 20, 52, 14, 30, 58, 25]);

  addTable(enrichmentSheet, 'EnrichmentQueueTable', [
    'Company ID', 'Company Name', 'Missing', 'Current website', 'Current email', 'Current phone',
    'Suggested generic email', 'Suggested phone', 'Source / next research', 'Priority',
    'Opportunities', 'Contacts', 'Review status',
  ], enrichmentRows, [26, 36, 34, 34, 30, 20, 32, 20, 54, 12, 14, 10, 18]);
  enrichmentSheet.getRange(`M2:M${enrichmentRows.length + 1}`).dataValidation = {
    rule: { type: 'list', values: ['Not started', 'Researching', 'Verified', 'Rejected'] },
  };

  addTable(rulesSheet, 'SystemRulesTable', ['Object', 'Purpose', 'Required fields', 'Do not do', 'Primary views'], [
    ['Company', 'One canonical organisation identity', 'Company ID, canonical name, type, website/domain, location, relationship tags, source/confidence', 'Do not store named-person email as the company email; do not merge solely on shared phone/domain', 'All Goods organisations; by organisation type; by place; missing enrichment'],
    ['Contact', 'One real person and their communication timeline', 'Contact ID, name, work email, phone, businessId, role, relationship owner, consent/comms status', 'Do not create placeholder contacts for an organisation; do not leave businessId blank when employer is verified', 'People by company; unlinked work-email contacts; no recent touch; next action due'],
    ['Opportunity', 'One concrete funding, buyer or demand pathway', 'Opportunity ID, contact, pipeline, stage, value, next action/date, place/community, product/category', 'Do not use opportunities as company records; avoid duplicate opportunities for the same pathway', 'Supporter, Buyer and Demand pipeline views; stalled; no next action; by community'],
    ['Conversation', 'Email/SMS/call history attached to the person', 'Contact ID, channel, timestamp, direction, owner', 'Do not duplicate conversation notes into every company field', 'Unread/reply due; last inbound; relationship activity'],
    ['Notion', 'Strategy, governance, research and meeting preparation', 'Links to canonical HighLevel Company/Contact/Opportunity IDs', 'Do not run a second operational pipeline in Notion', 'Command Centre; Community OS; evidence/research'],
    ['Deduplication', 'Preserve one canonical Company ID', 'Exact ID first; verified legal identity; normalized domain/name; linkage counts; review decision', 'Never delete/archive until contacts, opportunities, notes and workflows have been checked', 'Duplicate Review queue'],
    ['Enrichment', 'Add verified organisation-level data', 'Value, source URL/system, checked date, confidence, reviewer', 'Do not infer private contact details or overwrite stronger sourced data', 'High-priority missing fields; stale verification'],
    ['Smart list: companies', 'Operational organisation segments', 'Goods tag + type + place + relationship status + missing-data flags', 'Do not segment only by free-text company name', 'Goods funders; buyers; community partners; Utopia/Maningrida/Alice Springs/Tennant Creek'],
    ['Smart list: contacts', 'People requiring engagement', 'businessId + Goods tag + role + pipeline stage + last activity + next action', 'Do not use email domain alone without review for public domains or service providers', 'Unlinked contacts; warm no-next-action; no touch 30d; QBE hackathon'],
  ], [24, 42, 62, 62, 50]);

  duplicateSheet.getRange(`J2:J${duplicateRows.length + 1}`).conditionalFormats.add('containsText', {
    text: 'MERGE',
    format: { fill: '#FDE8E7', font: { color: '#9F2D20', bold: true } },
  });
  enrichmentSheet.getRange(`J2:J${enrichmentRows.length + 1}`).conditionalFormats.add('containsText', {
    text: 'High',
    format: { fill: '#FDE8E7', font: { color: '#9F2D20', bold: true } },
  });

  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const preview = await workbook.render({ sheetName: 'Executive Summary', autoCrop: 'all', scale: 1, format: 'png' });
  await fs.writeFile(`${OUTPUT_DIR}/executive-summary.png`, new Uint8Array(await preview.arrayBuffer()));
  const output = await SpreadsheetFile.exportXlsx(workbook);
  const outputPath = `${OUTPUT_DIR}/goods-company-relationship-audit.xlsx`;
  await output.save(outputPath);
  const inspection = await workbook.inspect({
    kind: 'workbook,sheet,table',
    maxChars: 8000,
    tableMaxRows: 3,
    tableMaxCols: 8,
  });
  await fs.writeFile(`${OUTPUT_DIR}/inspection.json`, JSON.stringify(inspection, null, 2));
  console.log(JSON.stringify({
    outputPath,
    previewPath: `${OUTPUT_DIR}/executive-summary.png`,
    companies: audit.length,
    duplicateGroups: new Set(duplicateRows.map((row) => row.group)).size,
    duplicateRecords: duplicateRows.length,
    linkedCompanies: audit.filter((row) => row.contactCount).length,
    linkedPeople: peopleRows.length,
    companiesWithOpportunities: audit.filter((row) => row.opportunityCount).length,
    enrichmentQueue: enrichmentRows.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
