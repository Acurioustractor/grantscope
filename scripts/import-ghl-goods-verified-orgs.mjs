#!/usr/bin/env node

import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const BASE = 'https://services.leadconnectorhq.com';
const KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
if (!KEY || !LOCATION_ID) throw new Error('Missing GHL credentials');

const ORGANISATIONS = [
  ['Paul Ramsay Foundation', 'paulramsayfoundation.org.au', 'funder'],
  ['QIC', 'qic.com', 'funder-investor'],
  ['Julalikari Council Aboriginal Corporation', 'julalikari.com.au', 'community-partner'],
  ['The Funding Network Australia', 'thefundingnetwork.com.au', 'funder-network'],
  ['The Ian Potter Foundation', 'ianpotter.org.au', 'funder'],
  ['Small Giants Academy', 'smallgiants.com.au', 'supporter-network'],
  ['The Bryan Foundation', 'thebryanfoundation.org.au', 'funder'],
  ['REDARC', 'redarc.com.au', 'corporate-supporter'],
  ['Winning Appliances', 'winning.com.au', 'buyer-partner'],
  ['Josephmark', 'josephmark.com.au', 'strategic-partner'],
  ['Winnunga Nimmityjah Aboriginal Health and Community Services', 'winnunga.org.au', 'community-health-partner'],
  ['East Arnhem Regional Council', 'eastarnhem.nt.gov.au', 'community-government'],
  ['MacDonnell Regional Council', 'macdonnell.nt.gov.au', 'community-government'],
  ['Roper Gulf Regional Council', 'ropergulf.nt.gov.au', 'community-government'],
  ['Victoria Daly Regional Council', 'victoriadaly.nt.gov.au', 'community-government'],
  ['Central Desert Regional Council', 'centraldesert.nt.gov.au', 'community-government'],
];

const clean = (value) => String(value || '').trim();
const normalize = (value) => clean(value).toLowerCase()
  .replace(/&/g, 'and').replace(/\b(the|pty|ltd|limited|incorporated|inc)\b/g, '')
  .replace(/[^a-z0-9]/g, '');
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

async function main() {
  const contacts = await allContacts();
  const results = [];
  for (const [name, domain, relationship] of ORGANISATIONS) {
    const matchedContacts = contacts.filter((contact) => !contact.businessId && (
      emailDomain(contact.email) === domain
      || normalize(contact.companyName) === normalize(name)
    ));
    if (!matchedContacts.length) continue;

    const companyPayload = {
      name,
      website: `https://${domain}`,
      country: 'au',
      description: `Goods relationship: ${relationship}. Verified from work-email domain and official organisation website; reviewed 28 Jul 2026.`,
    };
    let company = null;
    if (APPLY) {
      const created = await ghl('/businesses/', {
        method: 'POST',
        body: JSON.stringify({ locationId: LOCATION_ID, ...companyPayload }),
      });
      company = created.business || created;
      await sleep(80);
    } else {
      company = { id: `dry:${domain}`, ...companyPayload };
    }

    let linked = 0;
    for (const contact of matchedContacts) {
      const tags = [...new Set([
        ...(contact.tags || []),
        'project:goods-on-country',
        'record:person',
        `relationship:${relationship}`,
        'source:verified-org-expansion',
      ])];
      if (APPLY) {
        await ghl(`/contacts/${contact.id}`, {
          method: 'PUT',
          body: JSON.stringify({ businessId: company.id, companyName: name, tags }),
        });
        await sleep(40);
      }
      linked += 1;
    }
    results.push({ name, domain, relationship, companyId: company.id, linkedContacts: linked });
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    organisations: results.length,
    contactsLinked: results.reduce((sum, row) => sum + row.linkedContacts, 0),
    results,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
