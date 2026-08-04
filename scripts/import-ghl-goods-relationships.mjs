#!/usr/bin/env node
/**
 * Import verified Goods funder/program relationships into GHL.
 *
 * Sources reviewed 24 Jul 2026:
 * - Goods × QBE live Notion operating plan and readiness pages
 * - direct Gmail exchanges (not newsletters or inferred addresses)
 *
 * Existing companies/contacts are reused. Existing contact tags are preserved.
 * Dry-run is the default.
 *
 *   node --env-file=.env --env-file=apps/web/.env.local scripts/import-ghl-goods-relationships.mjs
 *   node --env-file=.env --env-file=apps/web/.env.local scripts/import-ghl-goods-relationships.mjs --apply
 */
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
if (!GHL_API_KEY || !GHL_LOCATION_ID) throw new Error('Missing GHL credentials');

const ORGANISATIONS = [
  { name: 'QBE Foundation', website: 'https://www.qbe.com/au/community/qbe-foundation', type: 'corporate-foundation', relationship: 'active-program-partner' },
  { name: 'Social Impact Hub', website: 'https://www.socialimpacthub.org', type: 'program-partner', relationship: 'active-program-partner' },
  { name: 'Snow Foundation', website: 'https://www.snowfoundation.org.au', type: 'foundation', relationship: 'active-funder' },
  { name: 'Tim Fairfax Family Foundation', website: 'https://www.tfff.org.au', type: 'foundation', relationship: 'warm-funder' },
  { name: 'Brian M Davis Charitable Foundation', website: 'https://www.brianmdavis.org.au', type: 'foundation', relationship: 'warm-funder' },
  { name: 'Dusseldorp Forum', website: 'https://www.dusseldorp.org.au', type: 'foundation', relationship: 'active-funder' },
  { name: 'Centrecorp Foundation', website: 'https://www.centrecorp.com.au', type: 'foundation', relationship: 'warm-funder-buyer' },
  { name: 'Sefa', website: 'https://www.sefa.com.au', type: 'social-finance', relationship: 'warm-finance' },
  { name: 'Foundation for Rural & Regional Renewal', website: 'https://frrr.org.au', type: 'foundation', relationship: 'active-funder' },
  { name: 'Minderoo Foundation', website: 'https://www.minderoo.org', type: 'foundation', relationship: 'warm-funder' },
  { name: 'Coolamon Community', website: 'https://coolamoncommunity.org.au', type: 'community-organisation', relationship: 'foundation-introduction' },
];

const PEOPLE = [
  ['Lauren', 'Hicks', 'lauren.hicks@qbe.com', 'QBE Foundation', 'QBE Foundation lead'],
  ['Sarah', 'Bassam', 'sarah.bassam@qbe.com', 'QBE Foundation', 'QBE program contact'],
  ['James', 'Aiken', 'james.aiken@qbe.com', 'QBE Foundation', 'QBE program contact'],
  ['Jay', 'Boolkin', 'jay@socialimpacthub.org', 'Social Impact Hub', 'Catalysing Impact program lead'],
  ['Adam', '', 'adam@socialimpacthub.org', 'Social Impact Hub', 'Catalysing Impact program contact'],
  ['Matt', 'Allen', 'matt.allen@socialimpacthub.org', 'Social Impact Hub', 'Cost advisory lead'],
  ['Malcolm', 'Aikman', 'malcolm.aikman@socialimpacthub.org', 'Social Impact Hub', 'Cost advisory'],
  ['Jessica', 'Mendoza-Roth', 'jessica@socialimpacthub.org', 'Social Impact Hub', 'Program relationship'],
  ['Sally', 'Grimsley-Ballard', 'S.Grimsley-Ballard@snowfoundation.org.au', 'Snow Foundation', 'Goods relationship lead'],
  ['Alexandra', 'Lagelee Kean', 'A.LageleeKean@snowfoundation.org.au', 'Snow Foundation', 'Goods relationship'],
  ['Ashley', 'Machuca', 'A.Machuca@snowfoundation.org.au', 'Snow Foundation', 'Goods relationship'],
  ['Maree', 'Meredith', 'M.Meredith@snowfoundation.org.au', 'Snow Foundation', 'Goods relationship'],
  ['Georgina', 'Byron', 'g.byron@snowfoundation.org.au', 'Snow Foundation', 'Foundation leadership'],
  ['Katie', 'Norman', 'knorman@tfff.org.au', 'Tim Fairfax Family Foundation', 'Goods relationship lead'],
  ['Miranda', 'Campbell', 'miranda.campbell@brianmdavis.org.au', 'Brian M Davis Charitable Foundation', 'Goods relationship'],
  ['Anita', 'Hopkins', 'anita.hopkins@brianmdavis.org.au', 'Brian M Davis Charitable Foundation', 'Goods relationship'],
  ['Rachel', 'Fyfe', 'rachelfyfe@dusseldorp.org.au', 'Dusseldorp Forum', 'Goods relationship lead'],
  ['Jessica', 'Duffy', 'jessicaduffy@dusseldorp.org.au', 'Dusseldorp Forum', 'Goods relationship'],
  ['Randle', 'Walker', 'randle@centrecorp.com.au', 'Centrecorp Foundation', 'Funder and buyer relationship'],
  ['Jodie', 'Tilmouth', 'jodie@centrecorp.com.au', 'Centrecorp Foundation', 'Funder and buyer relationship'],
  ['Joel', 'Bird', 'joel.bird@sefa.com.au', 'Sefa', 'Queensland relationship'],
  ['Steph', 'Pearson', 's.pearson@frrr.org.au', 'Foundation for Rural & Regional Renewal', 'Goods relationship lead'],
  ['Lucy', 'Stronach', 'lstronach@minderoo.org', 'Minderoo Foundation', 'Justice and Goods relationship'],
  ['Evangeline', 'Wood', 'evie@coolamoncommunity.org.au', 'Coolamon Community', 'Snow Foundation introduction'],
  ['Pam', 'Brook', 'pam@coolamoncommunity.org.au', 'Coolamon Community', 'Snow Foundation introduction'],
];

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const clean = (value) => String(value || '').trim() || null;
const domain = (value) => {
  try {
    const raw = String(value || '').trim();
    const host = raw.includes('@') ? raw.split('@').pop() : new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname;
    return host.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function ghl(endpoint, options = {}, version = '2021-07-28') {
  const response = await fetch(`${GHL_BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${GHL_API_KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: version,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL ${response.status} ${endpoint}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

async function allContacts() {
  const rows = [];
  let startAfter;
  let startAfterId;
  for (let page = 0; page < 60; page += 1) {
    const query = new URLSearchParams({ locationId: GHL_LOCATION_ID, limit: '100' });
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
  const [businessData, contacts] = await Promise.all([
    ghl(`/businesses/?locationId=${GHL_LOCATION_ID}&limit=100`),
    allContacts(),
  ]);
  const businesses = businessData.businesses || [];
  const businessByName = new Map(businesses.map((row) => [normalize(row.name), row]));
  const businessById = new Map(businesses.map((row) => [row.id, row]));
  const businessByDomain = new Map(
    businesses.filter((row) => domain(row.website)).map((row) => [domain(row.website), row]),
  );
  const contactByEmail = new Map(contacts.filter((row) => row.email).map((row) => [row.email.toLowerCase(), row]));
  const companyResults = [];
  const contactResults = [];

  for (const organisation of ORGANISATIONS) {
    const organisationEmails = PEOPLE
      .filter((row) => row[3] === organisation.name)
      .map((row) => row[2].toLowerCase());
    const relatedBusiness = organisationEmails
      .map((email) => contactByEmail.get(email))
      .filter((contact) => contact?.businessId)
      .map((contact) => businessById.get(contact.businessId))
      .find(Boolean);
    const existing = businessByName.get(normalize(organisation.name))
      || businessByDomain.get(domain(organisation.website))
      || relatedBusiness;
    const payload = {
      name: organisation.name,
      website: organisation.website,
      country: 'au',
      description: `Goods relationship: ${organisation.relationship}. Organisation type: ${organisation.type}. Sources: direct Gmail relationship and Goods × QBE Notion operating plan; reviewed 24 Jul 2026.`,
    };
    if (existing) {
      const patch = {
        ...(!clean(existing.website) ? { website: organisation.website } : {}),
        ...(!clean(existing.description) ? { description: payload.description } : {}),
      };
      if (APPLY && Object.keys(patch).length) {
        await ghl(`/businesses/${existing.id}`, { method: 'PUT', body: JSON.stringify(patch) });
        await sleep(80);
      }
      companyResults.push({ name: organisation.name, action: Object.keys(patch).length ? 'updated' : 'reused', id: existing.id });
      continue;
    }
    if (APPLY) {
      const data = await ghl('/businesses/', {
        method: 'POST',
        body: JSON.stringify({ locationId: GHL_LOCATION_ID, ...payload }),
      });
      const created = data.business || data;
      businessByName.set(normalize(organisation.name), created);
      companyResults.push({ name: organisation.name, action: 'created', id: created.id });
      await sleep(100);
    } else {
      const dry = { id: `dry:${organisation.name}`, ...payload };
      businessByName.set(normalize(organisation.name), dry);
      companyResults.push({ name: organisation.name, action: 'create' });
    }
  }

  for (const [firstName, lastName, email, companyName, relationship] of PEOPLE) {
    const business = businessByName.get(normalize(companyName));
    const existing = contactByEmail.get(email.toLowerCase());
    const tags = [...new Set([
      ...(existing?.tags || []),
      'project:goods-on-country',
      'role:funder-network',
      'source:gmail-notion-sweep',
      'comms:manual-relationship',
    ])];
    const payload = {
      firstName,
      ...(lastName ? { lastName } : {}),
      email,
      companyName,
      ...(business?.id && !String(business.id).startsWith('dry:') ? { businessId: business.id } : {}),
      tags,
      source: `Goods relationship sweep — ${relationship}`,
    };
    if (existing) {
      const patch = {
        companyName,
        ...(business?.id && !String(business.id).startsWith('dry:') ? { businessId: business.id } : {}),
        tags,
      };
      if (APPLY) {
        await ghl(`/contacts/${existing.id}`, { method: 'PUT', body: JSON.stringify(patch) });
        await sleep(80);
      }
      contactResults.push({ email, companyName, action: 'updated', id: existing.id });
      continue;
    }
    if (APPLY) {
      const { businessId: linkedBusinessId, ...createPayload } = payload;
      const data = await ghl('/contacts/', {
        method: 'POST',
        body: JSON.stringify({ locationId: GHL_LOCATION_ID, ...createPayload }),
      });
      let created = data.contact || data;
      if (linkedBusinessId) {
        const linked = await ghl(`/contacts/${created.id}`, {
          method: 'PUT',
          body: JSON.stringify({ businessId: linkedBusinessId, companyName, tags }),
        });
        created = linked.contact || linked;
      }
      contactResults.push({ email, companyName, action: 'created', id: created.id });
      await sleep(100);
    } else {
      contactResults.push({ email, companyName, action: 'create' });
    }
  }

  const count = (rows, action) => rows.filter((row) => row.action === action).length;
  console.log(JSON.stringify({
    mode: APPLY ? 'apply' : 'dry-run',
    companies: {
      considered: companyResults.length,
      created: count(companyResults, APPLY ? 'created' : 'create'),
      updated: count(companyResults, 'updated'),
      reused: count(companyResults, 'reused'),
    },
    contacts: {
      considered: contactResults.length,
      created: count(contactResults, APPLY ? 'created' : 'create'),
      updated: count(contactResults, 'updated'),
    },
    companyResults,
    contactResults,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
