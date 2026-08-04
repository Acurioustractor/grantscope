#!/usr/bin/env node
/**
 * Explain HighLevel forecast totals by pipeline and opportunity.
 *
 * HighLevel values are CRM estimates, never invoice/payment truth. This script
 * is read-only and identifies which pipelines and records create the displayed
 * open and won totals.
 */
import 'dotenv/config';

const BASE = 'https://services.leadconnectorhq.com';
const KEY = process.env.GHL_API_KEY;
const LOCATION_ID = process.env.GHL_LOCATION_ID;
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

async function opportunities(pipelineId) {
  const rows = [];
  let path = `/opportunities/search?location_id=${LOCATION_ID}&pipeline_id=${pipelineId}&limit=100`;
  for (let page = 0; page < 30 && path; page += 1) {
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

const pipelineData = await ghl(`/opportunities/pipelines?locationId=${LOCATION_ID}`);
const pipelines = pipelineData.pipelines || [];
const results = [];
const allRows = [];

for (const pipeline of pipelines) {
  const rows = await opportunities(pipeline.id);
  const stageById = new Map((pipeline.stages || []).map((stage) => [stage.id, stage.name]));
  const enriched = rows.map((row) => ({
    id: row.id,
    pipelineId: pipeline.id,
    pipeline: pipeline.name,
    name: row.name,
    status: row.status || 'open',
    stage: stageById.get(row.pipelineStageId) || row.pipelineStageId,
    value: Number(row.monetaryValue || 0),
    contact: row.contact?.name || row.contact?.contactName || row.contact?.companyName || null,
    updatedAt: row.updatedAt || row.dateUpdated || null,
  }));
  allRows.push(...enriched);
  const open = enriched.filter((row) => row.status === 'open');
  const won = enriched.filter((row) => row.status === 'won');
  results.push({
    pipelineId: pipeline.id,
    pipeline: pipeline.name,
    total: enriched.length,
    open: open.length,
    openValue: open.reduce((sum, row) => sum + row.value, 0),
    won: won.length,
    wonValue: won.reduce((sum, row) => sum + row.value, 0),
    missingValue: open.filter((row) => row.value === 0).length,
  });
}

const moneyRows = allRows.filter((row) => row.value > 0);
const openRows = moneyRows.filter((row) => row.status === 'open');
const wonRows = moneyRows.filter((row) => row.status === 'won');

console.log(JSON.stringify({
  generatedAt: new Date().toISOString(),
  disclaimer: 'HighLevel opportunity values are CRM estimates. Xero invoices and payments are financial truth.',
  totals: {
    opportunities: allRows.length,
    open: allRows.filter((row) => row.status === 'open').length,
    openValue: openRows.reduce((sum, row) => sum + row.value, 0),
    won: allRows.filter((row) => row.status === 'won').length,
    wonValue: wonRows.reduce((sum, row) => sum + row.value, 0),
    openMissingValue: allRows.filter((row) => row.status === 'open' && row.value === 0).length,
  },
  pipelines: results
    .filter((row) => row.total > 0)
    .sort((left, right) => right.openValue - left.openValue),
  largestOpen: openRows.sort((left, right) => right.value - left.value).slice(0, 30),
  largestWon: wonRows.sort((left, right) => right.value - left.value).slice(0, 30),
}, null, 2));
