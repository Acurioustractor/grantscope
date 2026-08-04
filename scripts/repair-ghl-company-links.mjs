#!/usr/bin/env node

import 'dotenv/config';
import fs from 'node:fs/promises';
import { parse } from 'csv-parse/sync';

const APPLY = process.argv.includes('--apply');
const SUMMARY_ONLY = process.argv.includes('--summary');
const CSV_PATH = process.argv.find((arg) => arg.startsWith('--csv='))?.slice(6)
  || '/Users/benknight/Downloads/Companies.csv';
const BASE = 'https://services.leadconnectorhq.com';
const KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
if (!KEY || !LOCATION_ID) throw new Error('Missing GHL credentials');

const PIPELINE_IDS = [
  'JvBFYpVpyKsw899lkFgj',
  'FjMyJM3YzWQFmKqR9fur',
  'UQsrmuqzxMSdCTklxEcG',
];

const DUPLICATES = new Map([
  ['6926371491b0ad53349a43aa', '6a67e539e381c61afaaac181'], // Oonchiumpa
  ['6a67e4421c4eb417e702eef0', '69263990fd008eb3c2cf72c8'], // Dusseldorp
  ['692635a51b86984c5fd2fe9e', '6a67e441eb3a62d5ee896d3d'], // Tim Fairfax
  ['692634eb8d0bf5b97d620557', '6a67e440e381c670b0aabf39'], // Snow
  ['6a62c846349c5bea6fb8e1fc', '692634aa17c5e133c8bc3d3d'], // Palm Island Community Company
  ['6a62bcd46bce1244931eb0c5', '6a62bb2663474e28b69d4fe3'], // Maningrida Progress Association
]);

const FREE_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com',
  'bigpond.com', 'bigpond.net.au', 'live.com', 'live.com.au', 'hotmail.com.au',
  'yahoo.com.au', 'me.com', 'protonmail.com',
]);
const SHARED_DOMAINS = new Set(['outbackstores.com.au', 'alpa.asn.au']);
const clean = (value) => String(value || '').trim();
const normalize = (value) => clean(value).toLowerCase()
  .replace(/&/g, 'and')
  .replace(/\b(the|pty|ltd|limited|incorporated|inc|aboriginal corporation|corporation)\b/g, '')
  .replace(/[^a-z0-9]/g, '');
const domain = (value) => {
  try {
    const raw = clean(value);
    if (!raw) return '';
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
};
const emailDomain = (value) => clean(value).toLowerCase().split('@')[1] || '';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ghl(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: '2021-07-28',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL ${response.status} ${path}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
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

async function allGoodsOpportunities() {
  const rows = [];
  for (const pipelineId of PIPELINE_IDS) {
    let path = `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${pipelineId}&limit=100`;
    for (let page = 0; page < 20 && path; page += 1) {
      const data = await ghl(path);
      const current = data.opportunities || [];
      rows.push(...current);
      if (current.length < 100) break;
      const meta = data.meta || {};
      if (meta.nextPageUrl) path = meta.nextPageUrl.replace(BASE, '');
      else if (meta.startAfter && meta.startAfterId) {
        path = `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${pipelineId}&limit=100`
          + `&startAfter=${encodeURIComponent(meta.startAfter)}&startAfterId=${encodeURIComponent(meta.startAfterId)}`;
      } else break;
    }
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

async function main() {
  const companies = parse(await fs.readFile(CSV_PATH, 'utf8'), {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  }).map((row) => ({
    id: row['Company ID'],
    name: row['Company Name'],
    website: row.Website,
    description: row.Description,
  }));
  const companyById = new Map(companies.map((row) => [row.id, row]));
  const [contacts, opportunities] = await Promise.all([allContacts(), allGoodsOpportunities()]);
  const opportunityContactIds = new Set(opportunities.map((row) => row.contact?.id || row.contactId).filter(Boolean));
  const goodsContacts = contacts.filter((contact) => opportunityContactIds.has(contact.id)
    || (contact.tags || []).some((tag) => /goods|community-pilot|funder-network/i.test(tag))
    || /Goods/i.test(clean(contact.source)));

  const byDomain = new Map();
  const byName = new Map();
  for (const company of companies) {
    if (DUPLICATES.has(company.id)) continue;
    const websiteDomain = domain(company.website);
    if (websiteDomain && !SHARED_DOMAINS.has(websiteDomain)) {
      if (!byDomain.has(websiteDomain)) byDomain.set(websiteDomain, []);
      byDomain.get(websiteDomain).push(company);
    }
    const name = normalize(company.name);
    if (name) {
      if (!byName.has(name)) byName.set(name, []);
      byName.get(name).push(company);
    }
  }

  const actions = [];
  const review = [];
  for (const contact of goodsContacts) {
    let target = null;
    let basis = '';
    if (contact.businessId && DUPLICATES.has(contact.businessId)) {
      target = companyById.get(DUPLICATES.get(contact.businessId));
      basis = 'duplicate-company-reassignment';
    } else if (!contact.businessId) {
      const workDomain = emailDomain(contact.email);
      const domainMatches = !FREE_DOMAINS.has(workDomain) && !SHARED_DOMAINS.has(workDomain)
        ? byDomain.get(workDomain) || []
        : [];
      const nameMatches = byName.get(normalize(contact.companyName)) || [];
      if (domainMatches.length === 1) {
        target = domainMatches[0];
        basis = 'unique-work-email-domain';
      } else if (nameMatches.length === 1 && clean(contact.companyName)) {
        target = nameMatches[0];
        basis = 'exact-normalised-company-name';
      } else if (domainMatches.length > 1 || nameMatches.length > 1) {
        review.push({
          contactId: contact.id,
          person: [contact.firstName, contact.lastName].filter(Boolean).join(' '),
          email: contact.email || '',
          companyName: contact.companyName || '',
          reason: 'multiple-company-match',
        });
      }
    }

    const tags = [...new Set([
      ...(contact.tags || []),
      'project:goods-on-country',
      'record:person',
      'source:company-link-repair',
    ])];
    const patch = {
      ...(target ? { businessId: target.id, companyName: target.name } : {}),
      tags,
    };
    const changedLink = target && (contact.businessId !== target.id || contact.companyName !== target.name);
    const changedTags = tags.length !== (contact.tags || []).length;
    if (!changedLink && !changedTags) continue;
    actions.push({
      contactId: contact.id,
      person: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.name || '',
      email: contact.email || '',
      fromBusinessId: contact.businessId || '',
      toBusinessId: target?.id || contact.businessId || '',
      company: target?.name || contact.companyName || '',
      basis: basis || 'goods-contact-tag-standardisation',
      patch,
    });
  }

  let applied = 0;
  const errors = [];
  if (APPLY) {
    for (const action of actions) {
      try {
        await ghl(`/contacts/${action.contactId}`, {
          method: 'PUT',
          body: JSON.stringify(action.patch),
        });
        applied += 1;
        await sleep(20);
      } catch (error) {
        errors.push({ contactId: action.contactId, error: error.message });
      }
    }

    for (const [duplicateId, canonicalId] of DUPLICATES) {
      const duplicate = companyById.get(duplicateId);
      const canonical = companyById.get(canonicalId);
      if (!duplicate || !canonical) continue;
      await ghl(`/businesses/${duplicateId}`, {
        method: 'PUT',
        body: JSON.stringify({
          description: [
            clean(duplicate.description),
            `Duplicate record. Canonical HighLevel Company ID: ${canonicalId} (${canonical.name}).`,
            `Contacts reassigned ${new Date().toISOString().slice(0, 10)}. Do not attach new contacts or opportunities here.`,
          ].filter(Boolean).join(' '),
        }),
      });
      await sleep(20);
    }
  }

  const unlinkedOrganisationCandidates = [...goodsContacts
    .filter((contact) => !contact.businessId && clean(contact.companyName))
    .reduce((groups, contact) => {
      const key = `${normalize(contact.companyName)}|${emailDomain(contact.email)}`;
      if (!groups.has(key)) groups.set(key, {
        companyName: clean(contact.companyName),
        emailDomain: emailDomain(contact.email),
        people: 0,
        opportunityContacts: 0,
      });
      const group = groups.get(key);
      group.people += 1;
      if (opportunityContactIds.has(contact.id)) group.opportunityContacts += 1;
      return groups;
    }, new Map()).values()]
    .sort((a, b) => b.opportunityContacts - a.opportunityContacts || b.people - a.people)
    .slice(0, 80);

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    allContacts: contacts.length,
    goodsContacts: goodsContacts.length,
    goodsOpportunities: opportunities.length,
    actions: actions.length,
    duplicateReassignments: actions.filter((row) => row.basis === 'duplicate-company-reassignment').length,
    newCompanyLinks: actions.filter((row) => ['unique-work-email-domain', 'exact-normalised-company-name'].includes(row.basis)).length,
    tagStandardisations: actions.filter((row) => row.basis === 'goods-contact-tag-standardisation').length,
    applied,
    errors,
    review,
    unlinkedOrganisationCandidates,
    ...(SUMMARY_ONLY ? {} : { actionDetails: actions }),
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
