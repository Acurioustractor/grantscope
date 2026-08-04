#!/usr/bin/env node
/**
 * Import the wider, evidence-backed Goods relationship network into GHL.
 *
 * Evidence: direct Gmail participation in Goods threads, reviewed 24 Jul 2026.
 * No outreach is triggered. Existing contacts, tags and companies are preserved.
 *
 * Dry-run:
 *   node --env-file=.env --env-file=apps/web/.env.local scripts/import-ghl-goods-broad-network.mjs
 * Apply:
 *   node --env-file=.env --env-file=apps/web/.env.local scripts/import-ghl-goods-broad-network.mjs --apply
 */
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const BASE = 'https://services.leadconnectorhq.com';
const key = process.env.GHL_API_KEY;
const locationId = process.env.GHL_LOCATION_ID;
if (!key || !locationId) throw new Error('Missing GHL credentials');

const organisations = [
  ['Oranges and Sardines Foundation', 'https://orangessardinesfoundation.org', 'funder'],
  ['University of Melbourne', 'https://unimelb.edu.au', 'research-partner'],
  ['TABOO', 'https://tabooau.co', 'governance-partner'],
  ['Northern Territory Government', 'https://nt.gov.au', 'government'],
  ['Oonchiumpa Consultancy', 'https://oonchiumpa.com.au', 'community-partner'],
  ['Status', 'https://status.net.au', 'governance-support'],
  ['Cape York Partnership', 'https://cyp.org.au', 'advisory-network'],
  ['Local Government Association of the Northern Territory', 'https://lgant.asn.au', 'government-network'],
  ['Austcover', 'https://austcover.com.au', 'service-provider'],
  ['Canberra Airport', 'https://canberraairport.com.au', 'display-and-buyer-partner'],
  ['Social Impact Hub', 'https://socialimpacthub.org', 'program-partner'],
  ['Bright Moon', 'https://brightmoon.au', 'advisory-network'],
  ['University of Tasmania', 'https://utas.edu.au', 'research-partner'],
  ['Monash University', 'https://monash.edu', 'research-partner'],
  ['Australian National University', 'https://anu.edu.au', 'research-partner'],
  ["Children's Ground", 'https://childrensground.org.au', 'community-research-partner'],
  ['University of Queensland', 'https://uq.edu.au', 'research-partner'],
  ['University of Sydney', 'https://sydney.edu.au', 'research-partner'],
  ['Australian Social and Emotional Wellbeing Centre', 'https://asewbc.au', 'research-partner'],
  ['SSP Australia', 'https://ssp-au.com', 'commercial-partner'],
  ['Barkly Regional Council', 'https://barkly.nt.gov.au', 'community-government-partner'],
  ['Self Physio', 'https://selfphysio.com.au', 'governance-network'],
  ['Hospital Research Foundation Group', 'https://hospitalresearch.org.au', 'governance-network'],
  ['Bentleys SA/NT', 'https://adel.bentleys.com.au', 'professional-services'],
  ['Homeland School Company', 'https://homelandschoolcompany.org.au', 'supplier'],
  ['Beko', 'https://beko.com', 'manufacturing-partner'],
  ['Zinus Australia', 'https://zinus.com', 'industry-advisor'],
  ['MinterEllison', 'https://minterellison.com', 'legal-advisor'],
  ['Defy Design', 'https://defydesign.org', 'design-and-manufacturing-partner'],
  ['Orange Sky Australia', 'https://orangesky.org.au', 'sector-partner'],
  ['DeadlyScience', 'https://deadlyscience.org.au', 'advisory-network'],
];

const people = [
  ['Johanna', 'Featherstone', 'jcfa@orangessardinesfoundation.org', 'Oranges and Sardines Foundation', 'funder'],
  ['Tamryn', 'Bennett', 'projects@orangessardinesfoundation.org', 'Oranges and Sardines Foundation', 'funder'],
  ['Victoria', 'Palmer', 'v.palmer@unimelb.edu.au', 'University of Melbourne', 'research-partner'],
  ['Eloise', 'Hall', 'eloise@tabooau.co', 'TABOO', 'governance-partner'],
  ['Philip', 'Orcher', 'phillip.orcher@unimelb.edu.au', 'University of Melbourne', 'research-partner'],
  ['Natalie', 'Frkovic', 'natalie.frkovic@nt.gov.au', 'Northern Territory Government', 'government-buyer'],
  ['Alexandra', 'McGee', 'alexandraemcgee@gmail.com', '', 'governance'],
  ['Kirsty', 'Bloomfield', 'kristy.bloomfield@oonchiumpa.com.au', 'Oonchiumpa Consultancy', 'community-partner'],
  ['John', 'Cranwell', 'john.cranwell@status.net.au', 'Status', 'governance-support'],
  ['Audrey', 'Deemal', 'adeemal@cyp.org.au', 'Cape York Partnership', 'advisor'],
  ['Michelle', 'VanZanden', 'michelle.vanzanden@lgant.asn.au', 'Local Government Association of the Northern Territory', 'government-network'],
  ['Vanessa', 'Jennings', 'vanessa.jennings@austcover.com.au', 'Austcover', 'service-provider'],
  ['Brigitta', 'Hill', 'b.hill@canberraairport.com.au', 'Canberra Airport', 'display-partner'],
  ['Sandra', 'Hill', 's.hill@canberraairport.com.au', 'Canberra Airport', 'display-partner'],
  ['Melissa', 'Evans', 'm.evans@canberraairport.com.au', 'Canberra Airport', 'display-partner'],
  ['Phillip', 'Vernon', 'phillip.vernon@socialimpacthub.org', 'Social Impact Hub', 'mentor'],
  ['Benjamin', 'Abbatangelo', 'bj.abbatangelo@gmail.com', '', 'advisor'],
  ['Collis', "Ta'eed", 'collis@brightmoon.au', 'Bright Moon', 'advisor'],
  ['Amanda', 'Neil', 'amanda.neil@utas.edu.au', 'University of Tasmania', 'research-partner'],
  ['Sandra', 'Eades', 'sandra.eades@monash.edu', 'Monash University', 'research-partner'],
  ['Michelle', 'Banfield', 'michelle.banfield@anu.edu.au', 'Australian National University', 'research-partner'],
  ['Jennifer', 'Bibb', 'bibb.jennifer@unimelb.edu.au', 'University of Melbourne', 'research-partner'],
  ['Jen', 'Lorains', 'jen.lorains@childrensground.org.au', "Children's Ground", 'community-research-partner'],
  ['Veronica', 'Doolan', 'veronica.doolan@childrensground.org.au', "Children's Ground", 'community-research-partner'],
  ['Peter', 'Worthy', 'p.worthy@uq.edu.au', 'University of Queensland', 'research-partner'],
  ['Robert', 'Leidig', 'robertl@nini.au', '', 'research-partner'],
  ['Jioji', 'Ravulo', 'jioji.ravulo@sydney.edu.au', 'University of Sydney', 'research-partner'],
  ['Tui', 'Crumpen', 'tcrumpen@unimelb.edu.au', 'University of Melbourne', 'research-partner'],
  ['Cathy', 'Butterss', 'cathy.butterss@unimelb.edu.au', 'University of Melbourne', 'research-partner'],
  ['Matthew', 'Lewis', 'matthew.lewis@unimelb.edu.au', 'University of Melbourne', 'research-partner'],
  ['Carla', 'Leversedge', 'carlal@asewbc.au', 'Australian Social and Emotional Wellbeing Centre', 'research-partner'],
  ['Tanya', 'Turner', 'tanya.turner@oonchiumpa.com.au', 'Oonchiumpa Consultancy', 'community-partner'],
  ['Monica', 'Muschialli', 'm.muschialli@canberraairport.com.au', 'Canberra Airport', 'display-partner'],
  ['Karlien', 'Bentley', 'k.bentley@canberraairport.com.au', 'Canberra Airport', 'display-partner'],
  ['Jenny', 'Thornhill', 'j.thornhill@canberraairport.com.au', 'Canberra Airport', 'display-partner'],
  ['Jake', 'Hallett', 'jake.hallett@ssp-au.com', 'SSP Australia', 'commercial-partner'],
  ['Barkly Council', 'Reception', 'reception@barkly.nt.gov.au', 'Barkly Regional Council', 'community-entry-point'],
  ['Nawal', 'Church', 'nawal@selfphysio.com.au', 'Self Physio', 'governance-network'],
  ['Briony', 'Marshall', 'bmarshall@hospitalresearch.org.au', 'Hospital Research Foundation Group', 'governance-network'],
  ['Sonia', 'Mascolo', 'smascolo@adel.bentleys.com.au', 'Bentleys SA/NT', 'professional-services'],
  ['Alex', 'Meng', 'alex.meng@homelandschoolcompany.org.au', 'Homeland School Company', 'supplier'],
  ['John', 'Dohler', 'john.dohler@homelandschoolcompany.org.au', 'Homeland School Company', 'supplier'],
  ['Amanda', 'Hart', 'amanda.hart@beko.com', 'Beko', 'manufacturing-partner'],
  ['Murat', 'Dora', 'murat.dora@beko.com', 'Beko', 'manufacturing-partner'],
  ['Daniel', 'Pittman', 'daniel.pittman@zinus.com', 'Zinus Australia', 'industry-advisor'],
  ['Matthew', 'Martin', 'm.martin@zinus.com', 'Zinus Australia', 'industry-partner'],
  ['Keith', 'Rovers', 'keith.rovers@minterellison.com', 'MinterEllison', 'legal-advisor'],
  ['Sam', 'Davies', 'sam@defydesign.org', 'Defy Design', 'design-and-manufacturing-partner'],
  ['Judith', 'Meiklejohn', 'judith@orangesky.org.au', 'Orange Sky Australia', 'advisor'],
  ['DeadlyScience', 'CEO', 'ceo@deadlyscience.org.au', 'DeadlyScience', 'advisor'],
  ['April', 'Long', 'along@srau.org.au', '', 'advisor'],
  ['Shaun', 'Fisher', 'fishers.oysters@gmail.com', '', 'advisor'],
  ['Walking on Country', '', 'walkingoncountry@gmail.com', '', 'advisor'],
  ['Nina', 'Fitzgerald', 'hello@nina-fitzgerald.com', '', 'advisor'],
  ['Susan', 'Clear', 'susan.clear@gmail.com', '', 'advisor'],
];

const norm = (v) => String(v || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const domain = (v) => {
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
  if (!response.ok) throw new Error(`GHL ${response.status} ${endpoint}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

async function allContacts() {
  const byId = new Map();
  let startAfter;
  let startAfterId;
  for (let page = 0; page < 80; page += 1) {
    const q = new URLSearchParams({ locationId, limit: '100' });
    if (startAfterId) {
      q.set('startAfter', String(startAfter));
      q.set('startAfterId', startAfterId);
    }
    const data = await ghl(`/contacts/?${q}`);
    for (const row of data.contacts || []) byId.set(row.id, row);
    if (!data.meta?.nextPage || !data.meta?.startAfterId) break;
    startAfter = data.meta.startAfter;
    startAfterId = data.meta.startAfterId;
  }
  return [...byId.values()];
}

const [companyData, contacts] = await Promise.all([
  ghl(`/businesses/?locationId=${locationId}&limit=100`),
  allContacts(),
]);
const companies = companyData.businesses || [];
const companyByName = new Map(companies.map((x) => [norm(x.name), x]));
const companyByDomain = new Map(companies.filter((x) => x.website).map((x) => [domain(x.website), x]));
const contactByEmail = new Map(contacts.filter((x) => x.email).map((x) => [x.email.toLowerCase(), x]));
const companyResults = [];
const contactResults = [];

for (const [name, website, role] of organisations) {
  let company = companyByName.get(norm(name)) || companyByDomain.get(domain(website));
  if (!company && APPLY) {
    const data = await ghl('/businesses/', {
      method: 'POST',
      body: JSON.stringify({
        locationId,
        name,
        website,
        country: 'au',
        description: `Goods relationship: ${role}. Source: direct Goods email participation; reviewed 24 Jul 2026.`,
      }),
    });
    company = data.business || data;
    companyByName.set(norm(name), company);
    companyByDomain.set(domain(website), company);
  }
  companyResults.push({ name, action: company ? 'ready' : 'would-create', id: company?.id });
}

for (const [firstName, lastName, email, companyName, role] of people) {
  const existing = contactByEmail.get(email.toLowerCase());
  const company = companyName ? companyByName.get(norm(companyName)) : null;
  const tags = [...new Set([
    ...(existing?.tags || []),
    'project:goods-on-country',
    `relationship:${role}`,
    'source:gmail-goods-sweep',
    'comms:manual-relationship',
  ])];
  const payload = {
    firstName,
    lastName,
    email,
    ...(companyName ? { companyName } : {}),
    ...(company?.id ? { businessId: company.id } : {}),
    tags,
    source: `Goods broad relationship sweep — ${role}`,
  };
  if (APPLY) {
    if (existing) {
      await ghl(`/contacts/${existing.id}`, { method: 'PUT', body: JSON.stringify(payload) });
      contactResults.push({ email, action: 'updated', id: existing.id, role });
    } else {
      const { businessId, ...createPayload } = payload;
      const data = await ghl('/contacts/', {
        method: 'POST',
        body: JSON.stringify({ locationId, ...createPayload }),
      });
      const created = data.contact || data;
      if (businessId) {
        await ghl(`/contacts/${created.id}`, {
          method: 'PUT',
          body: JSON.stringify({ businessId, companyName, tags }),
        });
      }
      contactResults.push({ email, action: 'created', id: created.id, role });
    }
  } else {
    contactResults.push({ email, action: existing ? 'would-update' : 'would-create', id: existing?.id, role });
  }
}

console.log(JSON.stringify({
  apply: APPLY,
  companies: {
    total: companyResults.length,
    ready: companyResults.filter((x) => x.id).length,
    wouldCreate: companyResults.filter((x) => !x.id).length,
  },
  contacts: {
    total: contactResults.length,
    created: contactResults.filter((x) => x.action === 'created').length,
    updated: contactResults.filter((x) => x.action === 'updated').length,
    wouldCreate: contactResults.filter((x) => x.action === 'would-create').length,
    wouldUpdate: contactResults.filter((x) => x.action === 'would-update').length,
  },
  contactResults,
}, null, 2));
