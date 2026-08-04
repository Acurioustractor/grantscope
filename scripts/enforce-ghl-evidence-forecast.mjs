#!/usr/bin/env node
/**
 * Make Goods forecasts evidence-based.
 *
 * Value is retained only for:
 * - a formally submitted funding application under assessment; or
 * - a scoped buyer opportunity with a quantity/price basis.
 *
 * Community demand, relationship asks, finance concepts, grants merely
 * identified, historical stewardship and Xero receivables carry $0 here.
 */
import 'dotenv/config';

const APPLY = process.argv.includes('--apply');
const BASE = 'https://services.leadconnectorhq.com';
const KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
if (!KEY || !LOCATION_ID) throw new Error('Missing GHL credentials');

const SUPPORTER_PIPELINE_ID = 'JvBFYpVpyKsw899lkFgj';
const GRANTS_PIPELINE_ID = 'scom3L0kNwA1W0zPIzMe';
const REAL_ID = 'zAZtJBfdQ0PBdFYUDCLw';
const BUYER_DATES = new Map([
  ['TUpPBR3c76JeuksojRz1', '2026-08-15T00:00:00.000Z'],
  ['sT7MOE1aCt2ywomCcg2l', '2026-08-31T00:00:00.000Z'],
]);

const SUPPORTER_PROBABILITIES = new Map([
  ['Identified', 0],
  ['Qualified', 10],
  ['Cultivating', 20],
  ['Ask made', 40],
  ['Committed', 90],
  ['Delivering', 100],
  ['Stewarding / Reporting', 100],
  ['Renewing', 20],
  ['Lapsed', 0],
  ['Declined / Parked', 0],
]);

async function ghl(path, options = {}, version = 'v3') {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Version: version,
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`GHL ${response.status} ${path}: ${text.slice(0, 800)}`);
  return text ? JSON.parse(text) : {};
}

async function opportunities(pipelineId) {
  const rows = [];
  let path = `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${pipelineId}&limit=100`;
  for (let page = 0; page < 20 && path; page += 1) {
    const data = await ghl(path, {}, '2021-07-28');
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

async function updateOpportunity(opportunity, patch) {
  if (!APPLY) return;
  await ghl(`/opportunities/${opportunity.id}`, {
    method: 'PUT',
    body: JSON.stringify({
      pipelineId: opportunity.pipelineId,
      pipelineStageId: opportunity.pipelineStageId,
      name: opportunity.name,
      status: opportunity.status,
      monetaryValue: Number(opportunity.monetaryValue || 0),
      ...(opportunity.contactId || opportunity.contact?.id
        ? { contactId: opportunity.contactId || opportunity.contact.id }
        : {}),
      ...(opportunity.assignedTo ? { assignedTo: opportunity.assignedTo } : {}),
      ...patch,
    }),
  });
}

const changes = [];
const supporter = await opportunities(SUPPORTER_PIPELINE_ID);
for (const opportunity of supporter) {
  if (opportunity.status !== 'open' || opportunity.id === REAL_ID) continue;
  const current = Number(opportunity.monetaryValue || 0);
  if (current === 0) continue;
  await updateOpportunity(opportunity, { monetaryValue: 0 });
  changes.push({
    id: opportunity.id,
    name: opportunity.name,
    action: APPLY ? 'value-cleared' : 'would-clear-value',
    from: current,
    to: 0,
    basis: 'No verified submitted application, signed commitment or scoped buyer order.',
  });
}

const grants = await opportunities(GRANTS_PIPELINE_ID);
for (const opportunity of grants) {
  if (opportunity.status !== 'open') continue;
  const current = Number(opportunity.monetaryValue || 0);
  if (current === 0) continue;
  await updateOpportunity(opportunity, { monetaryValue: 0 });
  changes.push({
    id: opportunity.id,
    name: opportunity.name,
    action: APPLY ? 'value-cleared' : 'would-clear-value',
    from: current,
    to: 0,
    basis: 'Grant is identified, not a submitted application under assessment.',
  });
}

const real = supporter.find((row) => row.id === REAL_ID);
if (real) {
  const closeDate = '2026-08-31T00:00:00.000Z';
  await updateOpportunity(real, { forecastExpectedCloseDate: closeDate });
  changes.push({
    id: real.id,
    name: real.name,
    action: APPLY ? 'close-date-set' : 'would-set-close-date',
    value: Number(real.monetaryValue || 0),
    forecastExpectedCloseDate: closeDate,
    basis: 'DEWR email dated 27 Jul 2026 says assessment outcome is expected before end of August.',
  });
}

const buyer = await opportunities('FjMyJM3YzWQFmKqR9fur');
for (const opportunity of buyer) {
  const closeDate = BUYER_DATES.get(opportunity.id);
  if (!closeDate) continue;
  await updateOpportunity(opportunity, { forecastExpectedCloseDate: closeDate });
  changes.push({
    id: opportunity.id,
    name: opportunity.name,
    action: APPLY ? 'close-date-set' : 'would-set-close-date',
    value: Number(opportunity.monetaryValue || 0),
    forecastExpectedCloseDate: closeDate,
    basis: 'Next decision checkpoint for active scoped buyer opportunity.',
  });
}

const pipelinesData = await ghl(
  `/opportunities/pipelines?locationId=${LOCATION_ID}`,
  {},
  '2021-07-28',
);
const pipeline = pipelinesData.pipelines.find((row) => row.id === SUPPORTER_PIPELINE_ID);
const stages = pipeline.stages.map((stage) => ({
  id: stage.id,
  name: stage.name,
  position: stage.position,
  showInFunnel: stage.showInFunnel,
  showInPieChart: stage.showInPieChart,
  stageWinProbability: SUPPORTER_PROBABILITIES.get(stage.name) ?? 0,
}));
changes.push({
  id: SUPPORTER_PIPELINE_ID,
  name: pipeline.name,
  action: 'requires-pipeline-write-scope-or-ui',
  probabilities: Object.fromEntries(SUPPORTER_PROBABILITIES),
});

console.log(JSON.stringify({
  apply: APPLY,
  changes: changes.length,
  valueRemoved: changes.reduce((sum, row) => sum + Number(row.from || 0), 0),
  results: changes,
}, null, 2));
