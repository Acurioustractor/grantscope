#!/usr/bin/env node
/**
 * Audit the live Goods Buyer Pipeline without changing HighLevel.
 *
 * Reports whether each opportunity has a real named contact, canonical company
 * link, relationship evidence, value, and recent activity. Synthetic CivicGraph
 * place contacts remain research signals and are never treated as buyer people.
 */
import 'dotenv/config';

const BASE = 'https://services.leadconnectorhq.com';
const KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const PIPELINE_ID = 'FjMyJM3YzWQFmKqR9fur';
const SUMMARY_ONLY = process.argv.includes('--summary');
if (!KEY || !LOCATION_ID) throw new Error('Missing GHL credentials');

async function ghl(path) {
  const response = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
      Version: '2021-07-28',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL ${response.status} ${path}: ${text.slice(0, 500)}`);
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

async function allOpportunities() {
  const rows = [];
  let path = `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${PIPELINE_ID}&limit=100`;
  for (let page = 0; page < 20 && path; page += 1) {
    const data = await ghl(path);
    const batch = data.opportunities || [];
    rows.push(...batch);
    if (batch.length < 100) break;
    const meta = data.meta || {};
    if (meta.nextPageUrl) path = meta.nextPageUrl.replace(BASE, '');
    else if (meta.startAfter && meta.startAfterId) {
      path = `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${PIPELINE_ID}&limit=100`
        + `&startAfter=${encodeURIComponent(meta.startAfter)}&startAfterId=${encodeURIComponent(meta.startAfterId)}`;
    } else break;
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

const clean = (value) => String(value || '').trim();
const normalize = (value) => clean(value).toLowerCase().replace(/[^a-z0-9]+/g, '');
const daysSince = (value) => {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? Math.floor((Date.now() - time) / 86_400_000) : null;
};

const [pipelineData, contacts, opportunities] = await Promise.all([
  ghl(`/opportunities/pipelines?locationId=${LOCATION_ID}`),
  allContacts(),
  allOpportunities(),
]);

const pipeline = (pipelineData.pipelines || []).find((row) => row.id === PIPELINE_ID);
const stageById = new Map((pipeline?.stages || []).map((row) => [row.id, row.name]));
const contactById = new Map(contacts.map((row) => [row.id, row]));

const rows = opportunities.map((opportunity) => {
  const contactId = opportunity.contactId || opportunity.contact?.id;
  const contact = contactById.get(contactId) || opportunity.contact || {};
  const email = clean(contact.email);
  const tags = contact.tags || [];
  const synthetic = email.endsWith('@goods.civicgraph.io')
    || tags.includes('record:place-signal')
    || /CivicGraph Goods Intelligence/i.test(clean(contact.source));
  const contactName = clean(contact.contactName || `${contact.firstName || ''} ${contact.lastName || ''}`);
  const looksLikeOrganisationPlaceholder = Boolean(
    contactName
    && (
      normalize(contactName) === normalize(contact.companyName)
      || normalize(contactName) === normalize(opportunity.name.replace(/\s+—.+$/, ''))
    ),
  );
  const namedPerson = Boolean(
    contactName
    && !/^(goods|buyer|demand|public contact)$/i.test(clean(contact.firstName))
    && !looksLikeOrganisationPlaceholder
    && !synthetic,
  );
  const companyLinked = Boolean(contact.businessId);
  const relationshipEvidence = tags.some((tag) =>
    /^(relationship:|comms:manual|source:gmail|source:community-os|source:verified)/i.test(tag));
  const staleDays = daysSince(opportunity.updatedAt || opportunity.dateUpdated || opportunity.lastStatusChangeAt);
  const issues = [];
  if (synthetic) issues.push('synthetic-place-contact');
  if (!namedPerson) issues.push('no-named-person');
  if (!companyLinked) issues.push('no-company-link');
  if (!relationshipEvidence) issues.push('no-relationship-evidence');
  if (!Number(opportunity.monetaryValue || 0)) issues.push('no-value');
  if (staleDays === null || staleDays > 45) issues.push('stale');

  return {
    opportunityId: opportunity.id,
    name: opportunity.name,
    stage: stageById.get(opportunity.pipelineStageId) || opportunity.pipelineStageId,
    status: opportunity.status,
    value: Number(opportunity.monetaryValue || 0),
    updatedAt: opportunity.updatedAt || opportunity.dateUpdated || null,
    staleDays,
    contactId: contactId || null,
    contact: contactName || null,
    email: email || null,
    company: clean(contact.companyName) || null,
    businessId: contact.businessId || null,
    synthetic,
    namedPerson,
    companyLinked,
    relationshipEvidence,
    classification: synthetic
      ? 'research-signal'
      : namedPerson && companyLinked && relationshipEvidence
        ? 'active-relationship'
        : 'qualification-required',
    issues,
  };
});

const count = (predicate) => rows.filter(predicate).length;
const openRows = rows.filter((row) => row.status === 'open');
const byStage = Object.fromEntries([...new Set(openRows.map((row) => row.stage))]
  .map((stage) => [stage, openRows.filter((row) => row.stage === stage).length]));
const summary = {
  opportunities: rows.length,
  open: openRows.length,
  closedOrAbandoned: rows.length - openRows.length,
  activeRelationships: openRows.filter((row) => row.classification === 'active-relationship').length,
  qualificationRequired: openRows.filter((row) => row.classification === 'qualification-required').length,
  researchSignals: openRows.filter((row) => row.classification === 'research-signal').length,
  namedPeople: openRows.filter((row) => row.namedPerson).length,
  companyLinked: openRows.filter((row) => row.companyLinked).length,
  relationshipEvidence: openRows.filter((row) => row.relationshipEvidence).length,
  withValue: openRows.filter((row) => row.value > 0).length,
  staleOver45Days: openRows.filter((row) => row.staleDays === null || row.staleDays > 45).length,
  byStage,
};

const output = {
  generatedAt: new Date().toISOString(),
  pipeline: pipeline?.name || PIPELINE_ID,
  summary,
  qualificationQueue: openRows
    .filter((row) => row.classification !== 'active-relationship')
    .sort((left, right) => left.classification.localeCompare(right.classification)
      || (right.value - left.value)
      || String(left.name).localeCompare(String(right.name))),
  activeRelationships: openRows
    .filter((row) => row.classification === 'active-relationship')
    .sort((left, right) => (right.value - left.value) || String(left.name).localeCompare(String(right.name))),
};
console.log(JSON.stringify(SUMMARY_ONLY ? {
  generatedAt: output.generatedAt,
  pipeline: output.pipeline,
  summary: output.summary,
  qualificationQueue: output.qualificationQueue.map((row) => ({
    opportunityId: row.opportunityId,
    name: row.name,
    stage: row.stage,
    classification: row.classification,
    issues: row.issues,
  })),
} : output, null, 2));
