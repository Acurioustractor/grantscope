#!/usr/bin/env node
/**
 * Remove unqualified MMR government research targets from the active Goods
 * Buyer Pipeline while retaining their HighLevel records for audit history.
 *
 * Placeholder contacts are marked research-only and do-not-contact. No company
 * or person records are fabricated.
 */
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const BASE = 'https://services.leadconnectorhq.com';
const KEY = process.env.GHL_API_KEY;
if (!KEY) throw new Error('Missing GHL_API_KEY');

const TARGETS = [
  ['PZImorD7OXC48iI7Zq47', 'Australian Federal Police'],
  ['M47WSU3ZE6vgbluYT3aR', 'Australian Prudential Regulation Authority'],
  ['wGM7VsV3iwJ206MJu3o4', 'Department of Defence'],
  ['StczmxFEQZz5o5SEnwxV', 'Department of Industry, Science and Resources'],
  ['tHT2zQV8RkEHLLRvwY9H', 'National Emergency Management Agency'],
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
for (const [opportunityId, organisation] of TARGETS) {
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
      'record:organisation-placeholder',
      'status:research-only',
      'source:mmr-research-target',
      'comms:do-not-contact',
    ])];
    const contactChanged = contact.dnd !== true
      || tags.length !== (contact.tags || []).length;
    if (contactChanged && APPLY) {
      await ghl(`/contacts/${contactId}`, {
        method: 'PUT',
        body: JSON.stringify({ dnd: true, tags }),
      });
    }
    contactAction = contactChanged ? (APPLY ? 'marked-research-only' : 'would-mark-research-only') : 'already-research-only';
  }

  const opportunityChanged = opportunity.status !== 'abandoned';
  if (opportunityChanged && APPLY) {
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
    opportunityId,
    organisation,
    opportunityAction: opportunityChanged ? (APPLY ? 'abandoned' : 'would-abandon') : 'already-abandoned',
    contactId: contactId || null,
    contactAction,
  });
}

console.log(JSON.stringify({ apply: APPLY, results }, null, 2));
