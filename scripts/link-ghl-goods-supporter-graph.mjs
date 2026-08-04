#!/usr/bin/env node
/**
 * Link Goods supporter opportunities to verified companies and people in GHL.
 *
 * Dry-run:
 *   node --env-file=.env --env-file=apps/web/.env.local scripts/link-ghl-goods-supporter-graph.mjs
 * Apply:
 *   node --env-file=.env --env-file=apps/web/.env.local scripts/link-ghl-goods-supporter-graph.mjs --apply
 */
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const BASE = 'https://services.leadconnectorhq.com';
const key = process.env.GHL_API_KEY;
const locationId = process.env.GHL_LOCATION_ID;
if (!key || !locationId) throw new Error('Missing GHL credentials');

const FUNDER_ASSOCIATION = '6a62b8e4c70ef7bf543db7d4';
const CONTACT_ASSOCIATION = 'OPPORTUNITIES_CONTACTS_ASSOCIATION';
const SUPPORTER_PIPELINE = 'JvBFYpVpyKsw899lkFgj';

const pathways = [
  {
    label: 'QBE Foundation — Catalysing Impact Stage 2',
    opportunityId: 'f8CVsp8afeeuqnSsHBUM',
    companyId: '6a62c079fc92b40ff73bed82',
    primaryContactId: 'lDj2R6MytUQZt7UA1JLq',
    people: ['lDj2R6MytUQZt7UA1JLq', 'IaVqryFVpgl8f8bipLlC', 'KbPA3zRH2re4uCXK1lYR', 'jWlB8bMHxQxWMNIZLIoD'],
  },
  {
    label: 'Snow Foundation — First-mover funding pathway',
    opportunityId: 'ZzPJCLAq3nkAo0bG7ot3',
    companyId: '692634eb8d0bf5b97d620557',
    primaryContactId: 'NSn2Ywjd0g0RIlWp66Fs',
    people: ['NSn2Ywjd0g0RIlWp66Fs', 'M6SIDwBoUo4NxKaMXF6G', 'ua7d7GzRAlKkivxPTsrv', '9xn4Hn689ubEtXdRkR84', 'WKPGDlP6FyYg4hUTmQzd'],
  },
  {
    label: 'SEFA — Goods growth finance',
    opportunityId: 'hBRVkCMhT93215aqTRRr',
    companyId: '6a62c07f63474ecf509d69d0',
    people: ['QP8M4iLfBOfs66V81jiX'],
  },
  {
    label: 'Minderoo Foundation — Goods pathway',
    opportunityId: 'zQZWXJyILdvzwm8OACPr',
    companyId: '6a62c080fc92b40d263bed8f',
    people: ['bkZQ6vDNekvTtUVV1TpI'],
  },
  {
    label: 'Centrecorp Foundation — funder and buyer pathway',
    opportunityId: 'KZSUEe89wSm1vMLYMUr8',
    companyId: '6a62c07eeb3a626f1171f437',
    people: ['ehnCEv62bCaGNTd1QuGp', 'j9orNPWqQmXEqg662Elq'],
  },
  {
    label: 'Tim Fairfax Family Foundation — Goods pathway',
    opportunityId: 'ihodM2eQqGW7UlS7WeKp',
    companyId: '692635a51b86984c5fd2fe9e',
    people: ['LrnFSa8OwzINnTHCmIGj'],
  },
  {
    label: 'Brian M Davis Charitable Foundation — Goods pathway',
    opportunityId: 'y4Zppt4TNDtMYZwJBDY1',
    companyId: '6a62c07cebcb244c8fcc08b2',
    people: ['EuDwAclyizud8q47dTVS', 'X9kE3G9rqvR51gUo0Bsx'],
  },
  {
    label: 'Dusseldorp Forum — Goods relationship',
    opportunityId: 'oZejjLcisgyDGnfJCbZj',
    companyId: '69263990fd008eb3c2cf72c8',
    people: ['643e8sHlP3I5GooP85EC', 'tiZ5Qu8NcbAPaXguI6bq'],
  },
  {
    label: 'FRRR — Goods delivery and stewardship',
    opportunityId: 'L49Oi4l2b2J6miZJZl9C',
    companyId: '6a62c07f09d45a5ac471f46d',
    people: ['jatY7yhZL4h5OtexuCJ1'],
  },
];

async function ghl(endpoint, options = {}) {
  const response = await fetch(`${BASE}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: '2021-07-28',
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL ${response.status} ${endpoint}: ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : {};
}

async function createRelation(associationId, firstRecordId, secondRecordId) {
  if (!APPLY) return 'would-create';
  await ghl('/associations/relations', {
    method: 'POST',
    body: JSON.stringify({
      locationId,
      associationId,
      firstRecordId,
      secondRecordId,
      ...(associationId === CONTACT_ASSOCIATION ? { pipelineId: SUPPORTER_PIPELINE } : {}),
    }),
  });
  return 'created';
}

for (const pathway of pathways) {
  const current = await ghl(`/associations/relations/${pathway.opportunityId}?locationId=${locationId}`);
  const relations = current.relations || [];
  const has = (associationId, secondRecordId) =>
    relations.some((row) => row.associationId === associationId && row.secondRecordId === secondRecordId)
    || relations.some((row) => row.associationId === associationId && row.firstRecordId === secondRecordId);

  const result = { pathway: pathway.label, opportunityId: pathway.opportunityId, changes: [] };

  const opportunity = await ghl(`/opportunities/${pathway.opportunityId}`);
  const currentOpportunity = opportunity.opportunity || opportunity;
  if (pathway.primaryContactId && currentOpportunity.contactId !== pathway.primaryContactId) {
    result.changes.push({ primaryContact: pathway.primaryContactId, action: APPLY ? 'updated' : 'would-update' });
    if (APPLY) {
      await ghl(`/opportunities/${pathway.opportunityId}`, {
        method: 'PUT',
        body: JSON.stringify({ name: pathway.label, contactId: pathway.primaryContactId }),
      });
    }
  }

  if (!has(FUNDER_ASSOCIATION, pathway.companyId)) {
    result.changes.push({
      company: pathway.companyId,
      action: await createRelation(FUNDER_ASSOCIATION, pathway.companyId, pathway.opportunityId),
    });
  }

  for (const contactId of pathway.people) {
    if (contactId === pathway.primaryContactId || has(CONTACT_ASSOCIATION, contactId)) continue;
    result.changes.push({
      contact: contactId,
      action: await createRelation(CONTACT_ASSOCIATION, pathway.opportunityId, contactId),
    });
  }
  console.log(JSON.stringify(result));
}
