#!/usr/bin/env node

import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function toNum(value) {
  return Number(value || 0);
}

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

function mdTable(rows, columns) {
  if (!rows.length) return '_No rows_';
  const header = `| ${columns.join(' | ')} |`;
  const divider = `| ${columns.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) => `| ${columns.map((col) => String(row[col] ?? '')).join(' | ')} |`);
  return [header, divider, ...body].join('\n');
}

function formatInt(value) {
  return new Intl.NumberFormat('en-AU').format(toNum(value));
}

function formatMoney(value) {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(toNum(value));
}

async function main() {
  mkdirSync(path.join(process.cwd(), 'output'), { recursive: true });

  const [counts] = await sql(`
    SELECT
      (SELECT COUNT(*) FROM gs_entities) AS entities,
      (SELECT COUNT(*) FROM foundations) AS foundations,
      (SELECT COUNT(*) FROM grant_opportunities) AS grants,
      (SELECT COUNT(*) FROM social_enterprises) AS social_enterprises,
      (SELECT COUNT(*) FROM community_orgs) AS community_orgs,
      (SELECT COUNT(*) FROM acnc_charities) AS charities,
      (SELECT COUNT(*) FROM gs_entities WHERE is_community_controlled = true) AS community_controlled_entities
  `);

  const [quality] = await sql(`
    SELECT
      (SELECT COUNT(*) FROM foundations WHERE description IS NOT NULL AND btrim(description) <> '') AS foundations_described,
      (SELECT COUNT(*) FROM foundations WHERE profile_confidence = 'high') AS foundations_high_confidence,
      (SELECT COUNT(*) FROM social_enterprises WHERE description IS NOT NULL AND btrim(description) <> '') AS social_enterprises_described,
      (SELECT COUNT(*) FROM social_enterprises WHERE website IS NOT NULL AND btrim(website) <> '') AS social_enterprises_with_website,
      (SELECT COUNT(*) FROM social_enterprises WHERE business_model IS NOT NULL AND btrim(business_model) <> '') AS social_enterprises_with_business_model,
      (SELECT COUNT(*) FROM social_enterprises WHERE source_primary = 'social-traders') AS social_traders_primary_rows,
      (SELECT COUNT(*) FROM social_enterprises WHERE sources ? 'social_traders') AS social_traders_linked_rows,
      (SELECT COUNT(*) FROM community_orgs WHERE description IS NOT NULL AND btrim(description) <> '') AS community_orgs_described,
      (SELECT COUNT(*) FROM grant_opportunities WHERE closes_at IS NOT NULL) AS grants_with_deadline
  `);

  const fundingPostcodes = await sql(`
    SELECT postcode, state, remoteness, entity_count, total_funding
    FROM mv_funding_by_postcode
    ORDER BY total_funding DESC NULLS LAST
    LIMIT 10
  `);

  const [fundingTotals] = await sql(`
    SELECT
      COALESCE(SUM(total_funding), 0) AS national_total_funding,
      COALESCE(SUM(total_funding) FILTER (
        WHERE postcode IN (
          SELECT postcode FROM mv_funding_by_postcode ORDER BY total_funding DESC NULLS LAST LIMIT 5
        )
      ), 0) AS top5_postcode_funding
    FROM mv_funding_by_postcode
  `);

  const socialEnterpriseStates = await sql(`
    SELECT COALESCE(state, 'Unknown') AS state, COUNT(*) AS count
    FROM social_enterprises
    GROUP BY 1
    ORDER BY count DESC
    LIMIT 10
  `);

  const communityControlByRemoteness = await sql(`
    SELECT COALESCE(remoteness, 'Unknown') AS remoteness, COUNT(*) AS count
    FROM gs_entities
    WHERE is_community_controlled = true
    GROUP BY 1
    ORDER BY count DESC
  `);

  const [socialTradersCoverage] = await sql(`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE description IS NOT NULL AND btrim(description) <> '') AS with_description,
      COUNT(*) FILTER (WHERE geographic_focus IS NOT NULL) AS with_geographic_focus,
      COUNT(*) FILTER (WHERE website IS NOT NULL AND btrim(website) <> '') AS with_website,
      COUNT(*) FILTER (WHERE target_beneficiaries IS NOT NULL) AS with_beneficiaries,
      COUNT(*) FILTER (WHERE profile_confidence = 'high') AS high_confidence
    FROM social_enterprises
    WHERE sources ? 'social_traders'
  `);

  const [ndisNationalSupply] = await sql(`
    SELECT report_date, provider_count
    FROM v_ndis_provider_supply_summary
    WHERE state_code = 'ALL' AND service_district_name = 'ALL'
    ORDER BY report_date DESC
    LIMIT 1
  `);

  const ndisStateSupply = await sql(`
    SELECT state_code, provider_count
    FROM v_ndis_provider_supply_summary
    WHERE report_date = (SELECT MAX(report_date) FROM v_ndis_provider_supply_summary)
      AND service_district_name = 'ALL'
      AND state_code NOT IN ('ALL', 'OT', 'State_Missing')
    ORDER BY provider_count DESC
  `);

  const ndisHotspots = await sql(`
    SELECT state_code, service_district_name, support_class, payment_share_top10_pct, payment_band
    FROM v_ndis_market_concentration_hotspots
    WHERE report_date = (SELECT MAX(report_date) FROM v_ndis_market_concentration_hotspots)
      AND state_code NOT IN ('ALL', 'OT', 'State_Missing')
      AND service_district_name <> 'ALL'
      AND service_district_name NOT ILIKE 'Other%'
      AND support_class IN ('Core', 'Capacity Building')
      AND payment_band <> '< 1m'
      AND payment_share_top10_pct IS NOT NULL
    ORDER BY payment_share_top10_pct DESC NULLS LAST, payment_band DESC NULLS LAST
    LIMIT 10
  `);

  const [disabilityEnterpriseCoverage] = await sql(`
    SELECT COUNT(*) AS total
    FROM social_enterprises
    WHERE target_beneficiaries @> ARRAY['people_with_disability']::text[]
  `);

  const top5Share = toNum(fundingTotals.top5_postcode_funding) / Math.max(1, toNum(fundingTotals.national_total_funding));
  const communityControlledShare = toNum(counts.community_controlled_entities) / Math.max(1, toNum(counts.entities));
  const foundationDescriptionShare = toNum(quality.foundations_described) / Math.max(1, toNum(counts.foundations));
  const grantDeadlineShare = toNum(quality.grants_with_deadline) / Math.max(1, toNum(counts.grants));

  const insights = [];
  insights.push(`Top 5 funded postcodes hold ${Math.round(top5Share * 100)}% of postcode-attributed funding, which confirms heavy metro concentration rather than broad place coverage.`);
  insights.push(`Only ${Math.round(communityControlledShare * 100)}% of graph entities are marked community-controlled, so justice/diversity weighting still depends on sparse identification rather than dense structural data.`);
  insights.push(`Foundations remain thin: only ${Math.round(foundationDescriptionShare * 100)}% have descriptions, which limits plausibility matching and relationship-first philanthropy search.`);
  insights.push(`Grant freshness is still weak: only ${Math.round(grantDeadlineShare * 100)}% of grant opportunities have a deadline, so "open money now" search is still constrained by source quality.`);
  insights.push(`Social Traders is now a serious public-enterprise input: ${formatInt(socialTradersCoverage.total)} linked rows, ${formatInt(socialTradersCoverage.with_description)} with descriptions, and ${formatInt(socialTradersCoverage.high_confidence)} marked high confidence.`);
  if (ndisNationalSupply?.provider_count) {
    insights.push(`The official NDIS market layer now shows ${formatInt(ndisNationalSupply.provider_count)} active providers nationally at ${new Date(ndisNationalSupply.report_date).toLocaleDateString('en-AU')}, which exposes just how much disability market activity sits outside ordinary philanthropy and procurement conversations.`);
  }
  if (ndisHotspots.length) {
    const topHotspot = ndisHotspots[0];
    insights.push(`NDIS provider concentration is material: ${topHotspot.service_district_name} / ${topHotspot.support_class} has ${topHotspot.payment_share_top10_pct}% of payments held by the top 10 providers, which is exactly the kind of incumbent power we need to surface beside community-control and place-need signals.`);
  }

  const lines = [
    '# CivicGraph Overnight Power and Coverage Brief',
    '',
    `Generated: ${new Date().toLocaleString('en-AU', { timeZone: 'Australia/Brisbane' })}`,
    '',
    '## System Scale',
    '',
    `- Entities: ${formatInt(counts.entities)}`,
    `- Foundations: ${formatInt(counts.foundations)}`,
    `- Grant opportunities: ${formatInt(counts.grants)}`,
    `- Social enterprises: ${formatInt(counts.social_enterprises)}`,
    `- Community orgs: ${formatInt(counts.community_orgs)}`,
    `- ACNC charities: ${formatInt(counts.charities)}`,
    `- Community-controlled entities: ${formatInt(counts.community_controlled_entities)}`,
    '',
    '## Data Quality Read',
    '',
    `- Foundations described: ${formatInt(quality.foundations_described)} / ${formatInt(counts.foundations)}`,
    `- Foundations high confidence: ${formatInt(quality.foundations_high_confidence)}`,
    `- Social enterprises described: ${formatInt(quality.social_enterprises_described)} / ${formatInt(counts.social_enterprises)}`,
    `- Social enterprises with website: ${formatInt(quality.social_enterprises_with_website)}`,
    `- Social enterprises with business model: ${formatInt(quality.social_enterprises_with_business_model)}`,
    `- Community orgs described: ${formatInt(quality.community_orgs_described)} / ${formatInt(counts.community_orgs)}`,
    `- Grants with deadline: ${formatInt(quality.grants_with_deadline)} / ${formatInt(counts.grants)}`,
    '',
    '## Power Read',
    '',
    ...insights.map((insight) => `- ${insight}`),
    '',
    '## Top Funding Postcodes',
    '',
    mdTable(
      fundingPostcodes.map((row) => ({
        postcode: row.postcode,
        state: row.state,
        remoteness: row.remoteness,
        entity_count: formatInt(row.entity_count),
        total_funding: formatMoney(row.total_funding),
      })),
      ['postcode', 'state', 'remoteness', 'entity_count', 'total_funding']
    ),
    '',
    `Top 5 postcode funding share: ${formatMoney(fundingTotals.top5_postcode_funding)} of ${formatMoney(fundingTotals.national_total_funding)} total (${Math.round(top5Share * 100)}%)`,
    '',
    '## Social Enterprise Coverage by State',
    '',
    mdTable(
      socialEnterpriseStates.map((row) => ({ state: row.state, count: formatInt(row.count) })),
      ['state', 'count']
    ),
    '',
    '## Community-Controlled Entity Distribution',
    '',
    mdTable(
      communityControlByRemoteness.map((row) => ({ remoteness: row.remoteness, count: formatInt(row.count) })),
      ['remoteness', 'count']
    ),
    '',
    '## Social Traders Impact',
    '',
    `- Social Traders source-primary rows: ${formatInt(quality.social_traders_primary_rows)}`,
    `- Rows carrying Social Traders source data: ${formatInt(quality.social_traders_linked_rows)}`,
    `- Described Social Traders-linked rows: ${formatInt(socialTradersCoverage.with_description)}`,
    `- Geographic focus on Social Traders-linked rows: ${formatInt(socialTradersCoverage.with_geographic_focus)}`,
    `- Website coverage on Social Traders-linked rows: ${formatInt(socialTradersCoverage.with_website)}`,
    `- Beneficiary coverage on Social Traders-linked rows: ${formatInt(socialTradersCoverage.with_beneficiaries)}`,
    `- High-confidence Social Traders-linked rows: ${formatInt(socialTradersCoverage.high_confidence)}`,
    '',
    '## NDIS Market Read',
    '',
    ndisNationalSupply?.provider_count
      ? `- Active providers nationally: ${formatInt(ndisNationalSupply.provider_count)} as at ${new Date(ndisNationalSupply.report_date).toLocaleDateString('en-AU')}`
      : '- Active providers nationally: _Not yet imported_',
    `- Disability-focused social enterprises in graph: ${formatInt(disabilityEnterpriseCoverage.total)}`,
    '',
    '### State Provider Supply',
    '',
    mdTable(
      ndisStateSupply.map((row) => ({ state_code: row.state_code, provider_count: formatInt(row.provider_count) })),
      ['state_code', 'provider_count']
    ),
    '',
    '### Concentration Hotspots',
    '',
    mdTable(
      ndisHotspots.map((row) => ({
        state_code: row.state_code,
        service_district_name: row.service_district_name,
        support_class: row.support_class,
        payment_share_top10_pct: `${toNum(row.payment_share_top10_pct)}%`,
        payment_band: row.payment_band,
      })),
      ['state_code', 'service_district_name', 'support_class', 'payment_share_top10_pct', 'payment_band']
    ),
    '',
    '## What To Do Next',
    '',
    '- Keep scraping and enrichment aimed at sparse delivery signals, not just more rows.',
    '- Add the registered-provider layer so aggregate NDIS supply and concentration can be tied back to real organisations and ABNs.',
    '- Refresh dead or gated procurement/social-enterprise public sources so Social Traders is not carrying too much of the enterprise graph alone.',
    '- Improve philanthropy plausibility and relationship-stage data so funder search becomes more than topical adjacency.',
    '- Use place/coverage signals to show where funding is heavy, where delivery capacity is thin, and where community-controlled options are missing.',
    '- Join NDIS supply and concentration to youth justice, disability, and community-controlled delivery so users can see where service provision is thin and where incumbent providers dominate.',
  ];

  const filename = path.join(process.cwd(), 'output', `power-coverage-brief-${nowStamp()}.md`);
  writeFileSync(filename, `${lines.join('\n')}\n`);
  console.log(filename);
}

main().catch((error) => {
  console.error('Fatal:', error.message);
  process.exit(1);
});
