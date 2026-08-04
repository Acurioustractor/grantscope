#!/usr/bin/env node
/**
 * Connect the reviewed four-community Goods pilot in HighLevel.
 *
 * Existing companies and contacts are reused. Existing contact tags are
 * preserved. Dry-run is the default; pass --apply for reviewed writes.
 */
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

if (!GHL_API_KEY || !GHL_LOCATION_ID) throw new Error('Missing GHL credentials');

const ORGANISATIONS = [
  {
    name: 'Urapuntja Aboriginal Corporation',
    website: 'https://urapuntja.com.au',
    type: 'community-organisation',
    relationship: 'active-community-partner',
    places: ['utopia'],
  },
  {
    name: 'Oonchiumpa Consultancy',
    website: 'https://oonchiumpa.com.au',
    type: 'community-organisation',
    relationship: 'active-community-partner',
    places: ['utopia', 'alice-springs'],
  },
  {
    name: 'Homeland School Company',
    website: 'https://homelandschoolcompany.org.au',
    type: 'community-organisation',
    relationship: 'active-delivery-partner',
    places: ['maningrida'],
  },
  {
    name: 'Wilya Janta',
    website: 'https://wilyajanta.org',
    type: 'community-organisation',
    relationship: 'active-community-governance-partner',
    places: ['tennant-creek'],
  },
  {
    name: 'Anyinginyi Health Aboriginal Corporation',
    website: 'https://anyinginyi.org.au',
    type: 'health-service',
    relationship: 'active-health-partner',
    places: ['tennant-creek'],
  },
  {
    name: 'Our Community Shed Inc.',
    website: 'https://ourshed.org',
    type: 'community-organisation',
    relationship: 'active-community-partner',
    places: ['tennant-creek'],
  },
];

const PEOPLE = [
  {
    firstName: 'Kirsty',
    lastName: 'Bloomfield',
    email: 'kristy.bloomfield@oonchiumpa.com.au',
    companyName: 'Oonchiumpa Consultancy',
    role: 'community-partner',
    places: ['utopia', 'alice-springs'],
  },
  {
    firstName: 'Tanya',
    lastName: 'Turner',
    email: 'tanya.turner@oonchiumpa.com.au',
    companyName: 'Oonchiumpa Consultancy',
    role: 'community-partner',
    places: ['utopia', 'alice-springs'],
  },
  {
    firstName: 'Jane',
    lastName: 'Wilson',
    email: 'communityprogramsmgr@urapuntja.com.au',
    companyName: 'Urapuntja Aboriginal Corporation',
    role: 'community-lead',
    places: ['utopia'],
  },
  {
    firstName: 'Alex',
    lastName: 'Meng',
    email: 'alex.meng@homelandschoolcompany.org.au',
    companyName: 'Homeland School Company',
    role: 'delivery-partner',
    places: ['maningrida'],
  },
  {
    firstName: 'John',
    lastName: 'Dohler',
    email: 'john.dohler@homelandschoolcompany.org.au',
    companyName: 'Homeland School Company',
    role: 'delivery-partner',
    places: ['maningrida'],
  },
  {
    firstName: 'Lucy',
    lastName: 'McGarry',
    email: 'lm@wilyajanta.org',
    companyName: 'Wilya Janta',
    role: 'community-governance-partner',
    places: ['tennant-creek'],
  },
  {
    firstName: 'Simon',
    lastName: 'Quilty',
    email: 'sq@wilyajanta.org',
    companyName: 'Wilya Janta',
    role: 'community-governance-partner',
    places: ['tennant-creek'],
  },
  {
    firstName: 'Tony',
    lastName: 'Miles',
    email: 'tony.miles@anyinginyi.com.au',
    companyName: 'Anyinginyi Health Aboriginal Corporation',
    role: 'health-service-partner',
    places: ['tennant-creek'],
  },
  {
    firstName: 'Jennifer',
    lastName: 'Kitching',
    email: 'jennifer.kitching@anyinginyi.com.au',
    companyName: 'Anyinginyi Health Aboriginal Corporation',
    role: 'health-service-partner',
    places: ['tennant-creek'],
  },
  {
    firstName: 'Michelle',
    lastName: 'Bates',
    email: 'chair@ourshed.org',
    phone: '+61438333131',
    companyName: 'Our Community Shed Inc.',
    role: 'community-lead',
    places: ['tennant-creek'],
  },
];

const normalize = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
const clean = (value) => String(value || '').trim() || null;
const domain = (value) => {
  try {
    const raw = String(value || '').trim();
    const host = raw.includes('@')
      ? raw.split('@').pop()
      : new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname;
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
  const contactByEmail = new Map(
    contacts.filter((row) => row.email).map((row) => [row.email.toLowerCase(), row]),
  );
  const companyResults = [];
  const contactResults = [];

  for (const organisation of ORGANISATIONS) {
    const organisationEmails = PEOPLE
      .filter((person) => person.companyName === organisation.name)
      .map((person) => person.email.toLowerCase());
    const relatedBusiness = organisationEmails
      .map((email) => contactByEmail.get(email))
      .filter((contact) => contact?.businessId)
      .map((contact) => businessById.get(contact.businessId))
      .find(Boolean);
    const existing = businessByName.get(normalize(organisation.name))
      || businessByDomain.get(domain(organisation.website))
      || relatedBusiness;
    const description = [
      `Goods relationship: ${organisation.relationship}.`,
      `Organisation type: ${organisation.type}.`,
      `Communities: ${organisation.places.join(', ')}.`,
      'Reviewed through the Goods Community OS four-community pilot on 28 Jul 2026.',
    ].join(' ');
    const payload = {
      name: organisation.name,
      website: organisation.website,
      country: 'au',
      description,
    };
    if (existing) {
      const patch = {
        ...(!clean(existing.website) ? { website: organisation.website } : {}),
        ...(!clean(existing.description) ? { description } : {}),
      };
      if (APPLY && Object.keys(patch).length) {
        await ghl(`/businesses/${existing.id}`, { method: 'PUT', body: JSON.stringify(patch) });
        await sleep(80);
      }
      businessByName.set(normalize(organisation.name), existing);
      companyResults.push({
        name: organisation.name,
        matchedName: existing.name,
        action: Object.keys(patch).length ? 'updated' : 'reused',
        id: existing.id,
      });
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
      businessByName.set(normalize(organisation.name), { id: `dry:${organisation.name}`, ...payload });
      companyResults.push({ name: organisation.name, action: 'create' });
    }
  }

  for (const person of PEOPLE) {
    const business = businessByName.get(normalize(person.companyName));
    const existing = contactByEmail.get(person.email.toLowerCase());
    const tags = [...new Set([
      ...(existing?.tags || []),
      'project:goods-on-country',
      'lane:community',
      `relationship:${person.role}`,
      ...person.places.map((place) => `place:${place}`),
      'source:community-os-pilot',
      'comms:manual-relationship',
    ])];
    const payload = {
      firstName: person.firstName,
      lastName: person.lastName,
      email: person.email,
      ...(person.phone ? { phone: person.phone } : {}),
      companyName: person.companyName,
      ...(business?.id && !String(business.id).startsWith('dry:') ? { businessId: business.id } : {}),
      tags,
      source: `Goods community pilot — ${person.role}`,
    };
    if (existing) {
      if (APPLY) {
        await ghl(`/contacts/${existing.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            companyName: person.companyName,
            ...(business?.id && !String(business.id).startsWith('dry:') ? { businessId: business.id } : {}),
            tags,
          }),
        });
        await sleep(80);
      }
      contactResults.push({
        email: person.email,
        companyName: person.companyName,
        action: 'updated',
        id: existing.id,
      });
      continue;
    }
    if (APPLY) {
      const { businessId, ...createPayload } = payload;
      const data = await ghl('/contacts/', {
        method: 'POST',
        body: JSON.stringify({ locationId: GHL_LOCATION_ID, ...createPayload }),
      });
      let created = data.contact || data;
      if (businessId) {
        const linked = await ghl(`/contacts/${created.id}`, {
          method: 'PUT',
          body: JSON.stringify({ businessId, companyName: person.companyName, tags }),
        });
        created = linked.contact || linked;
      }
      contactResults.push({
        email: person.email,
        companyName: person.companyName,
        action: 'created',
        id: created.id,
      });
      await sleep(100);
    } else {
      contactResults.push({ email: person.email, companyName: person.companyName, action: 'create' });
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
