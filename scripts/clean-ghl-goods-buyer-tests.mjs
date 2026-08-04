#!/usr/bin/env node
/**
 * Remove verified test/spam opportunities from the active Goods Buyer queue.
 * Records are retained in HighLevel with status "abandoned" for audit history.
 */
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const BASE = 'https://services.leadconnectorhq.com';
const KEY = process.env.GHL_API_KEY;
if (!KEY) throw new Error('Missing GHL_API_KEY');

const TARGETS = [
  ['O975pKKQl7evuYSLxefF', 'random-string record using a careers inbox'],
  ['9r4ITsnAFBokzjcU5598', 'random-string record using a malformed test email'],
  ['vs8TDv3UI4ntGS3dBsga', 'explicit Wash Test record'],
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
for (const [id, reason] of TARGETS) {
  const data = await ghl(`/opportunities/${id}`);
  const opportunity = data.opportunity || data;
  if (opportunity.status === 'abandoned') {
    results.push({ id, name: opportunity.name, action: 'already-abandoned', reason });
    continue;
  }
  if (APPLY) {
    await ghl(`/opportunities/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        pipelineId: opportunity.pipelineId,
        pipelineStageId: opportunity.pipelineStageId,
        name: opportunity.name,
        status: 'abandoned',
        monetaryValue: opportunity.monetaryValue || 0,
        ...(opportunity.contactId ? { contactId: opportunity.contactId } : {}),
        ...(opportunity.assignedTo ? { assignedTo: opportunity.assignedTo } : {}),
      }),
    });
  }
  results.push({ id, name: opportunity.name, action: APPLY ? 'abandoned' : 'would-abandon', reason });
}

console.log(JSON.stringify({ apply: APPLY, results }, null, 2));
