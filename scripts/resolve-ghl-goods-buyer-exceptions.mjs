#!/usr/bin/env node
/**
 * Resolve the final reviewed Goods Buyer Pipeline exceptions.
 *
 * - Qualify NPY Women's Council from explicit Notion relationship evidence.
 * - Archive Hewitt Agriculture, Laura/Go Kindly and the synthetic NLC signal.
 * - Preserve all records and mark non-relationship contacts research-only.
 */
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const BASE = 'https://services.leadconnectorhq.com';
const KEY = process.env.GHL_API_KEY;
if (!KEY) throw new Error('Missing GHL_API_KEY');

const NPY = {
  contactId: 'mmLzQtTJEMJE0KAiDTTO',
  opportunityId: 'YVLVRFFkag7r3i1PgUIy',
  evidence: 'Notion records an ongoing NPY Women’s Council relationship and a 200–350 bed standing-interest signal.',
};

const ARCHIVE = [
  ['tWB0jh5t9uGjdJ03Vp0P', 'Hewitt Agriculture', 'research only; sourced from a Lhere Artepe deep dive'],
  ['TgiSKRRMXv0HPb9uPzQ7', 'Laura McConnell Conti / Go Kindly', 'no Gmail or Notion relationship evidence'],
  ['mXK6faxOGpm4ryalyLVc', 'Northern Land Council — GAPUWIYAK', 'synthetic CivicGraph place signal'],
];

async function ghl(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL ${response.status} ${path}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : {};
}

const results = [];

{
  const data = await ghl(`/contacts/${NPY.contactId}`);
  const contact = data.contact || data;
  const tags = [...new Set([
    ...(contact.tags || []),
    'project:goods-on-country',
    'relationship:buyer-demand',
    'source:notion-relationship-evidence',
    'comms:manual-relationship',
    'place:npy-lands',
  ])];
  const changed = tags.length !== (contact.tags || []).length;
  if (changed && APPLY) {
    await ghl(`/contacts/${NPY.contactId}`, {
      method: 'PUT',
      body: JSON.stringify({ tags }),
    });
  }
  results.push({
    name: "NPY Women's Council",
    action: changed ? (APPLY ? 'qualified' : 'would-qualify') : 'already-qualified',
    evidence: NPY.evidence,
  });
}

for (const [opportunityId, name, reason] of ARCHIVE) {
  const opportunityData = await ghl(`/opportunities/${opportunityId}`);
  const opportunity = opportunityData.opportunity || opportunityData;
  const contactId = opportunity.contactId || opportunity.contact?.id;
  let contactAction = 'no-contact';
  if (contactId) {
    const contactData = await ghl(`/contacts/${contactId}`);
    const contact = contactData.contact || contactData;
    const tags = [...new Set([
      ...(contact.tags || []).filter((tag) =>
        !['role:buyer', 'role:partner', 'comms:buyer-drip'].includes(tag)),
      'project:goods-on-country',
      'status:research-only',
      'comms:do-not-contact',
      'source:buyer-exception-review',
      ...(contact.email?.endsWith('@goods.civicgraph.io') ? ['record:place-signal'] : []),
    ])];
    const changed = contact.dnd !== true || tags.length !== (contact.tags || []).length;
    if (changed && APPLY) {
      await ghl(`/contacts/${contactId}`, {
        method: 'PUT',
        body: JSON.stringify({ dnd: true, tags }),
      });
    }
    contactAction = changed ? (APPLY ? 'marked-research-only' : 'would-mark-research-only') : 'already-research-only';
  }

  const changed = opportunity.status !== 'abandoned';
  if (changed && APPLY) {
    await ghl(`/opportunities/${opportunityId}`, {
      method: 'PUT',
      body: JSON.stringify({
        pipelineId: opportunity.pipelineId,
        pipelineStageId: opportunity.pipelineStageId,
        name: opportunity.name,
        status: 'abandoned',
        monetaryValue: opportunity.monetaryValue || 0,
        ...(contactId ? { contactId } : {}),
        ...(opportunity.assignedTo ? { assignedTo: opportunity.assignedTo } : {}),
      }),
    });
  }
  results.push({
    name,
    action: changed ? (APPLY ? 'abandoned' : 'would-abandon') : 'already-abandoned',
    contactAction,
    reason,
  });
}

console.log(JSON.stringify({ apply: APPLY, results }, null, 2));
