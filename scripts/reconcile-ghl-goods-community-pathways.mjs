#!/usr/bin/env node
/**
 * Reconcile live Goods community relationships into the GHL Community Pathways pipeline.
 * Sources: Goods Community OS (Notion) and direct Gmail relationships, reviewed 24 Jul 2026.
 *
 * Dry-run is default; pass --apply to write.
 */
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const BASE = 'https://services.leadconnectorhq.com';
const key = process.env.GHL_API_KEY;
const locationId = process.env.GHL_LOCATION_ID;
if (!key || !locationId) throw new Error('Missing GHL credentials');

const PIPELINE = '0m9teeEQFiq6I7GB5xiP';
const STAGES = {
  invitation: '8ac0d9af-d7fb-4a70-8da1-5ccabbdec32d',
  listening: '86457947-3ec7-41ba-b10b-7b12c88d4fd9',
  modules: 'd7762206-c71a-42a1-af5e-9a3f149a3078',
  review: '8c436143-57b3-4cba-ba8a-490228fe510b',
};
const ASSOCIATIONS = {
  lead: '6a62b8d279c9cb49cd806553',
  delivery: '6a62b8e2c70ef72cda3db7a2',
  governance: '6a62b8e3b3c30a0bdedd2b6e',
  contact: 'OPPORTUNITIES_CONTACTS_ASSOCIATION',
};

const requiredCompanies = [
  ['Palm Island Aboriginal Shire Council', 'https://palmcouncil.qld.gov.au', 'community-government-lead'],
  ['Palm Island Community Company', 'https://picc.com.au', 'community-delivery-partner'],
  ['Wilya Janta', 'https://wilyajanta.org', 'community-governance-partner'],
  ['Red Dust', 'https://reddust.org.au', 'community-delivery-partner'],
];

const requiredPeople = [
  ['Emma', 'Bradbury', 'ceo@palmcouncil.qld.gov.au', '+61427122155', 'Palm Island Aboriginal Shire Council', 'community-government-lead'],
  ['Lucy', 'McGarry', 'lm@wilyajanta.org', '', 'Wilya Janta', 'community-governance-partner'],
  ['Simon', 'Quilty', 'sq@wilyajanta.org', '', 'Wilya Janta', 'community-governance-partner'],
  ['Jimmy', 'Frank', 'jf@wilyajanta.org', '', 'Wilya Janta', 'community-partner'],
  ['Bridgit', 'McMullen', 'bridgit@reddust.org.au', '', 'Red Dust', 'community-delivery-partner'],
  ['Fiona', 'Scicluna', 'fiona@reddust.org.au', '', 'Red Dust', 'community-delivery-partner'],
  ['Matthew', 'Carman', 'mcarman@reddust.org.au', '', 'Red Dust', 'community-delivery-partner'],
  ['Erin', 'Riddell', 'erin@reddust.org.au', '', 'Red Dust', 'community-delivery-partner'],
];

const pathwaySpecs = [
  {
    name: 'Alice Springs / Oonchiumpa — Community Production Pathway',
    stage: STAGES.modules,
    primaryEmail: 'kristy.bloomfield@oonchiumpa.com.au',
    leadCompany: 'Oonchiumpa Consultancy',
    people: ['tanya.turner@oonchiumpa.com.au'],
  },
  {
    name: 'Darwin / East Arnhem — Health Fleet Pathway',
    stage: STAGES.listening,
    primaryEmail: 'madelyn.hay@miwatj.com.au',
    leadCompany: 'Miwatj Health Aboriginal Corporation',
    deliveryCompanies: ['Red Dust'],
    people: ['clara.strowel@miwatj.com.au', 'bridgit@reddust.org.au', 'fiona@reddust.org.au'],
  },
  {
    name: 'Groote Archipelago — Goods Pathway',
    stage: STAGES.listening,
    primaryName: 'simone grimmond',
    leadCompany: 'WHSAC (Groote Archipelago)',
  },
  {
    name: 'Maningrida — Homeland School Goods Pathway',
    stage: STAGES.review,
    primaryEmail: 'alex.meng@homelandschoolcompany.org.au',
    leadCompany: 'Homeland School Company',
    people: ['john.dohler@homelandschoolcompany.org.au', 'nic.sharah@homelandschoolcompany.org.au'],
  },
  {
    name: 'NPY Lands — Community Demand Pathway',
    stage: STAGES.listening,
    primaryEmail: 'enquiries@npywc.org.au',
    leadCompany: "NPY Women's Council",
    peopleByName: ['angela lynch'],
  },
  {
    name: 'Palm Island / Bwgcolman — Council-led Community Pathway',
    stage: STAGES.invitation,
    primaryEmail: 'ceo@palmcouncil.qld.gov.au',
    leadCompany: 'Palm Island Aboriginal Shire Council',
    deliveryCompanies: ['Palm Island Community Company'],
    people: ['narelle@picc.com.au', 'ratkinson@picc.com.au'],
  },
  {
    name: 'Tennant Creek / Wumpurrarni — Community Production Pathway',
    stage: STAGES.listening,
    primaryEmail: 'chair@ourshed.org',
    leadCompany: 'Our Community Shed Inc.',
    deliveryCompanies: ['Anyinginyi Health Aboriginal Corporation'],
    governanceCompanies: ['Wilya Janta'],
    people: ['coordinator@ourshed.org', 'lm@wilyajanta.org', 'sq@wilyajanta.org', 'tony.miles@anyinginyi.com.au'],
  },
  {
    name: 'Utopia / Urapuntja — Local Production and Shredder Pathway',
    stage: STAGES.listening,
    primaryEmail: 'communityprogramsmgr@urapuntja.com.au',
    leadCompany: 'Urapuntja Aboriginal Corporation',
    deliveryCompanies: ['Oonchiumpa Consultancy'],
    people: ['kristy.bloomfield@oonchiumpa.com.au'],
  },
];

const norm = (v) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const websiteDomain = (v) => {
  try { return new URL(v).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
};

async function ghl(endpoint, options = {}) {
  const response = await fetch(`${BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL ${response.status} ${endpoint}: ${text.slice(0, 700)}`);
  return text ? JSON.parse(text) : {};
}

async function allContacts() {
  const rows = new Map();
  let startAfter;
  let startAfterId;
  for (let page = 0; page < 80; page += 1) {
    const query = new URLSearchParams({ locationId, limit: '100' });
    if (startAfterId) {
      query.set('startAfter', String(startAfter));
      query.set('startAfterId', startAfterId);
    }
    const data = await ghl(`/contacts/?${query}`);
    for (const row of data.contacts || []) rows.set(row.id, row);
    if (!data.meta?.nextPage || !data.meta?.startAfterId) break;
    startAfter = data.meta.startAfter;
    startAfterId = data.meta.startAfterId;
  }
  return [...rows.values()];
}

const [companyData, initialContacts, opportunityData] = await Promise.all([
  ghl(`/businesses/?locationId=${locationId}&limit=100`),
  allContacts(),
  ghl(`/opportunities/search?location_id=${locationId}&pipeline_id=${PIPELINE}&limit=100`),
]);
const companies = companyData.businesses || [];
const companyByName = new Map(companies.map((x) => [norm(x.name), x]));
const companyByDomain = new Map(companies.filter((x) => x.website).map((x) => [websiteDomain(x.website), x]));
const contactByEmail = new Map(initialContacts.filter((x) => x.email).map((x) => [x.email.toLowerCase(), x]));
const contactByName = new Map(initialContacts.map((x) => [norm(x.contactName || `${x.firstName || ''} ${x.lastName || ''}`), x]));
const opportunityByName = new Map((opportunityData.opportunities || []).map((x) => [norm(x.name), x]));

for (const [name, website, role] of requiredCompanies) {
  let company = companyByName.get(norm(name)) || companyByDomain.get(websiteDomain(website));
  if (!company && APPLY) {
    const data = await ghl('/businesses/', {
      method: 'POST',
      body: JSON.stringify({
        locationId,
        name,
        website,
        country: 'au',
        description: `Goods relationship: ${role}. Source: Goods Community OS and direct relationship evidence; reviewed 24 Jul 2026.`,
      }),
    });
    company = data.business || data;
    companyByName.set(norm(name), company);
  }
}

for (const [firstName, lastName, email, phone, companyName, role] of requiredPeople) {
  const existing = contactByEmail.get(email.toLowerCase());
  const company = companyByName.get(norm(companyName));
  const tags = [...new Set([
    ...(existing?.tags || []),
    'project:goods-on-country',
    'lane:community',
    `relationship:${role}`,
    'source:gmail-notion-community-sweep',
    'comms:manual-relationship',
  ])];
  const payload = {
    firstName,
    ...(lastName ? { lastName } : {}),
    email,
    ...(phone ? { phone } : {}),
    companyName,
    ...(company?.id ? { businessId: company.id } : {}),
    tags,
  };
  if (APPLY) {
    if (existing) {
      await ghl(`/contacts/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
    } else {
      const { businessId, ...createPayload } = payload;
      const data = await ghl('/contacts/', {
        method: 'POST',
        body: JSON.stringify({ locationId, source: `Goods community sweep — ${role}`, ...createPayload }),
      });
      const created = data.contact || data;
      if (businessId) {
        await ghl(`/contacts/${created.id}`, {
          method: 'PUT',
          body: JSON.stringify({ businessId, companyName, tags }),
        });
      }
      contactByEmail.set(email.toLowerCase(), { ...created, ...payload });
    }
  }
}

// Refresh contacts after company/contact reconciliation.
const contacts = APPLY ? await allContacts() : initialContacts;
for (const contact of contacts) {
  if (contact.email) contactByEmail.set(contact.email.toLowerCase(), contact);
  contactByName.set(norm(contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`), contact);
}

async function relationExists(opportunityId, associationId, firstRecordId, secondRecordId) {
  const data = await ghl(`/associations/relations/${opportunityId}?locationId=${locationId}`);
  return (data.relations || []).some((x) =>
    x.associationId === associationId
    && x.firstRecordId === firstRecordId
    && x.secondRecordId === secondRecordId);
}

async function link(opportunityId, associationId, firstRecordId, secondRecordId) {
  if (await relationExists(opportunityId, associationId, firstRecordId, secondRecordId)) return false;
  if (APPLY) {
    await ghl('/associations/relations', {
      method: 'POST',
      body: JSON.stringify({
        locationId,
        associationId,
        firstRecordId,
        secondRecordId,
        ...(associationId === ASSOCIATIONS.contact ? { pipelineId: PIPELINE } : {}),
      }),
    });
  }
  return true;
}

const results = [];
for (const spec of pathwaySpecs) {
  const primary = spec.primaryEmail
    ? contactByEmail.get(spec.primaryEmail.toLowerCase())
    : contactByName.get(norm(spec.primaryName));
  if (!primary) {
    results.push({ name: spec.name, action: 'blocked', reason: 'primary contact missing' });
    continue;
  }
  let opportunity = opportunityByName.get(norm(spec.name));
  if (!opportunity && APPLY) {
    const data = await ghl('/opportunities/', {
      method: 'POST',
      body: JSON.stringify({
        locationId,
        pipelineId: PIPELINE,
        pipelineStageId: spec.stage,
        name: spec.name,
        status: 'open',
        contactId: primary.id,
        monetaryValue: 0,
      }),
    });
    opportunity = data.opportunity || data;
    opportunityByName.set(norm(spec.name), opportunity);
  }
  if (!opportunity) {
    results.push({ name: spec.name, action: 'would-create', primary: primary.email || primary.contactName });
    continue;
  }
  const changes = [];
  const lead = companyByName.get(norm(spec.leadCompany));
  if (lead && await link(opportunity.id, ASSOCIATIONS.lead, lead.id, opportunity.id)) changes.push(`lead:${lead.name}`);
  for (const companyName of spec.deliveryCompanies || []) {
    const company = companyByName.get(norm(companyName));
    if (company && await link(opportunity.id, ASSOCIATIONS.delivery, company.id, opportunity.id)) changes.push(`delivery:${company.name}`);
  }
  for (const companyName of spec.governanceCompanies || []) {
    const company = companyByName.get(norm(companyName));
    if (company && await link(opportunity.id, ASSOCIATIONS.governance, company.id, opportunity.id)) changes.push(`governance:${company.name}`);
  }
  const secondary = [
    ...(spec.people || []).map((email) => contactByEmail.get(email.toLowerCase())),
    ...(spec.peopleByName || []).map((name) => contactByName.get(norm(name))),
  ].filter(Boolean);
  for (const contact of secondary) {
    if (contact.id === primary.id) continue;
    if (await link(opportunity.id, ASSOCIATIONS.contact, opportunity.id, contact.id)) changes.push(`person:${contact.email || contact.contactName}`);
  }
  results.push({ name: spec.name, action: 'ready', opportunityId: opportunity.id, primary: primary.email || primary.contactName, changes });
}

console.log(JSON.stringify({ apply: APPLY, pathways: results }, null, 2));
