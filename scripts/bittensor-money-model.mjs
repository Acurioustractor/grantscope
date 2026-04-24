#!/usr/bin/env node

/**
 * Bittensor Money Model
 *
 * Purpose:
 * - Turn strategy into explicit monthly economics
 * - Compare revenue tracks: subnet consumer products + mining operations
 * - Stress-test assumptions before spending time/capital
 *
 * Usage:
 *   node scripts/bittensor-money-model.mjs
 *   node scripts/bittensor-money-model.mjs --config=thoughts/plans/bittensor-money-model.json
 */

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_CONFIG_PATH = path.resolve('thoughts/plans/bittensor-money-model.json');
const DAYS_PER_MONTH = 30;

function parseArgs() {
  const arg = process.argv.find((a) => a.startsWith('--config='));
  if (!arg) return { configPath: DEFAULT_CONFIG_PATH };
  return { configPath: path.resolve(arg.split('=')[1]) };
}

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function pct(value) {
  return `${round2(value * 100)}%`;
}

function asCurrency(value) {
  const n = Number.isFinite(value) ? value : 0;
  return `$${n.toLocaleString('en-AU', { maximumFractionDigits: 2 })}`;
}

function sumBy(items, key) {
  return items.reduce((acc, item) => acc + (item[key] || 0), 0);
}

function calcConsumerTrack(input) {
  const enrichmentRevenue = input.enrichedEntitiesPerMonth * input.pricePerEnrichedEntityUsd;
  const enrichmentCost = input.enrichedEntitiesPerMonth * input.costPerEnrichedEntityUsd;

  const attestationRevenue = input.attestedExportsPerMonth * input.pricePerAttestedExportUsd;
  const attestationCost = input.attestedExportsPerMonth * input.costPerAttestedExportUsd;

  const subscriptionRevenue = input.subscriptionCustomers * input.subscriptionArpuUsd;
  const subscriptionCost = subscriptionRevenue * input.subscriptionDeliveryCostRate;

  return {
    name: 'Subnet Consumer Products',
    revenue: round2(enrichmentRevenue + attestationRevenue + subscriptionRevenue),
    cost: round2(enrichmentCost + attestationCost + subscriptionCost),
    notes: [
      `${input.enrichedEntitiesPerMonth.toLocaleString()} enriched entities/month`,
      `${input.attestedExportsPerMonth.toLocaleString()} attested exports/month`,
      `${input.subscriptionCustomers.toLocaleString()} subscription customers`,
    ],
  };
}

function calcMiningTrack(input, taoPriceUsd) {
  const taoPerMonth = input.miners * input.taoPerMinerPerDay * DAYS_PER_MONTH * input.uptimeRate;
  const revenue = taoPerMonth * taoPriceUsd;
  const infraCost = input.miners * input.infraCostPerMinerUsd;
  const otherCost = input.opsAndMonitoringCostUsd + input.validatorOrDelegationCostUsd;

  return {
    name: 'Bittensor Mining Operations',
    revenue: round2(revenue),
    cost: round2(infraCost + otherCost),
    notes: [
      `${input.miners} miners @ ${input.taoPerMinerPerDay} TAO/day each`,
      `Uptime ${pct(input.uptimeRate)}`,
      `${round2(taoPerMonth)} TAO/month modelled`,
    ],
  };
}

function calcSignalsTrack(input) {
  const reportRevenue = input.monthlyReportClients * input.pricePerMonthlyReportUsd;
  const apiRevenue = input.apiCustomers * input.apiArpuUsd;
  const customRevenue = input.customEngagementsPerMonth * input.customEngagementValueUsd;
  const totalRevenue = reportRevenue + apiRevenue + customRevenue;
  const totalCost = totalRevenue * input.deliveryCostRate + input.fixedTeamCostUsd;

  return {
    name: 'Signals + Intelligence Products',
    revenue: round2(totalRevenue),
    cost: round2(totalCost),
    notes: [
      `${input.monthlyReportClients} report clients`,
      `${input.apiCustomers} API customers`,
      `${input.customEngagementsPerMonth} custom engagements/month`,
    ],
  };
}

function printScenario(scenarioName, scenario, taoPriceUsd) {
  const tracks = [
    calcConsumerTrack(scenario.consumerTrack),
    calcMiningTrack(scenario.miningTrack, taoPriceUsd),
    calcSignalsTrack(scenario.signalsTrack),
  ];

  const totalRevenue = sumBy(tracks, 'revenue');
  const totalCost = sumBy(tracks, 'cost');
  const grossProfit = totalRevenue - totalCost;
  const margin = totalRevenue > 0 ? grossProfit / totalRevenue : 0;

  console.log(`\n=== ${scenarioName.toUpperCase()} ===`);
  for (const t of tracks) {
    const gp = t.revenue - t.cost;
    const gm = t.revenue > 0 ? gp / t.revenue : 0;
    console.log(`\n${t.name}`);
    console.log(`  Revenue: ${asCurrency(t.revenue)}`);
    console.log(`  Cost:    ${asCurrency(t.cost)}`);
    console.log(`  Profit:  ${asCurrency(gp)} (${pct(gm)})`);
    for (const n of t.notes) {
      console.log(`  - ${n}`);
    }
  }

  console.log('\nTOTAL');
  console.log(`  Revenue: ${asCurrency(totalRevenue)}`);
  console.log(`  Cost:    ${asCurrency(totalCost)}`);
  console.log(`  Profit:  ${asCurrency(grossProfit)} (${pct(margin)})`);
}

function main() {
  const { configPath } = parseArgs();
  const config = readConfig(configPath);

  console.log('Bittensor Money Model');
  console.log(`Config: ${configPath}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`TAO Price (USD): ${config.marketAssumptions.taoPriceUsd}`);
  console.log(`Baseline low-source entities: ${config.baseline.lowSourceEntities.toLocaleString()}`);
  console.log(`Baseline entities total: ${config.baseline.entitiesTotal.toLocaleString()}`);

  for (const [name, scenario] of Object.entries(config.scenarios)) {
    printScenario(name, scenario, config.marketAssumptions.taoPriceUsd);
  }
}

main();
