#!/usr/bin/env node
/**
 * Reconcile Goods opportunity values to their correct meaning.
 *
 * - Demand Register values are modelled need, not forecast revenue: set to $0.
 * - WHSAC's $1.7m is unvalidated at Outreach Queued: set to $0 until confirmed.
 * - Historical won Snow/Centrecorp values use paid Xero ACCREC totals.
 *
 * Demand estimates remain in opportunity names and GrantScope.
 */
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const BASE = 'https://services.leadconnectorhq.com';
const KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
const DEMAND_PIPELINE_ID = 'UQsrmuqzxMSdCTklxEcG';
if (!KEY || !LOCATION_ID) throw new Error('Missing GHL credentials');

const VERIFIED = [
  {
    id: '49tvaOJvcQFzqf4arXfl',
    label: 'WHSAC (Groote Archipelago)',
    value: 0,
    basis: 'Unvalidated estimate at Outreach Queued; validation task due 5 Aug 2026.',
  },
  {
    id: 'qqMUNJI4qHbPR2lLHqn9',
    label: 'Snow Foundation — historical funding (Xero-reconciled)',
    value: 397384.91,
    basis: 'Xero ACT-GD paid ACCREC invoices through 28 Jul 2026.',
  },
  {
    id: '4DJPvPgoBxFi82lduMpN',
    label: 'Centrecorp — historical funding (Xero-reconciled)',
    value: 85712,
    basis: 'Xero ACT-GD paid invoice INV-0291.',
  },
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
  if (!response.ok) throw new Error(`GHL ${response.status} ${path}: ${text.slice(0, 600)}`);
  return text ? JSON.parse(text) : {};
}

async function opportunities(pipelineId) {
  const rows = [];
  let path = `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${pipelineId}&limit=100`;
  for (let page = 0; page < 20 && path; page += 1) {
    const data = await ghl(path);
    const batch = data.opportunities || [];
    rows.push(...batch);
    if (batch.length < 100) break;
    const meta = data.meta || {};
    if (meta.nextPageUrl) path = meta.nextPageUrl.replace(BASE, '');
    else if (meta.startAfter && meta.startAfterId) {
      path = `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${pipelineId}&limit=100`
        + `&startAfter=${encodeURIComponent(meta.startAfter)}&startAfterId=${encodeURIComponent(meta.startAfterId)}`;
    } else break;
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

async function updateOpportunity(opportunity, value, name = opportunity.name) {
  if (!APPLY) return;
  await ghl(`/opportunities/${opportunity.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      pipelineId: opportunity.pipelineId,
      pipelineStageId: opportunity.pipelineStageId,
      name,
      status: opportunity.status,
      monetaryValue: value,
      ...(opportunity.contactId || opportunity.contact?.id
        ? { contactId: opportunity.contactId || opportunity.contact.id }
        : {}),
      ...(opportunity.assignedTo ? { assignedTo: opportunity.assignedTo } : {}),
    }),
  });
}

const results = [];
const demand = await opportunities(DEMAND_PIPELINE_ID);
for (const opportunity of demand) {
  const current = Number(opportunity.monetaryValue || 0);
  if (current === 0) continue;
  await updateOpportunity(opportunity, 0);
  results.push({
    id: opportunity.id,
    name: opportunity.name,
    action: APPLY ? 'value-cleared' : 'would-clear-value',
    from: current,
    to: 0,
    basis: 'Modelled community need is not forecast revenue.',
  });
}

for (const target of VERIFIED) {
  const data = await ghl(`/opportunities/${target.id}`);
  const opportunity = data.opportunity || data;
  const current = Number(opportunity.monetaryValue || 0);
  if (Math.abs(current - target.value) < 0.005 && opportunity.name === target.label) {
    results.push({ id: target.id, name: target.label, action: 'already-correct', value: current, basis: target.basis });
    continue;
  }
  await updateOpportunity(opportunity, target.value, target.label);
  results.push({
    id: target.id,
    name: target.label,
    action: APPLY ? 'value-reconciled' : 'would-reconcile-value',
    from: current,
    to: target.value,
    basis: target.basis,
  });
}

console.log(JSON.stringify({
  apply: APPLY,
  demandOpportunities: demand.length,
  changes: results.filter((row) => !['already-correct'].includes(row.action)).length,
    clearedDemandValue: results
      .filter((row) => row.action === 'would-clear-value' || row.action === 'value-cleared')
    .reduce((sum, row) => sum + row.from, 0),
  results,
}, null, 2));
