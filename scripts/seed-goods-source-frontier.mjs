#!/usr/bin/env node
/**
 * Seed goods-shaped sources into source_frontier via service role.
 *
 * Mirrors scripts/migrations/seed-goods-source-frontier.sql but uses the JS
 * client so we don't need direct psql access. Idempotent on source_key.
 *
 * Run: node --env-file=.env scripts/seed-goods-source-frontier.mjs
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const SOURCES = [
  // LANE 1: Federal Indigenous funding bodies
  { source_key: 'grant-source:niaa:aba', source_kind: 'grant_source_page',
    source_name: 'NIAA Aboriginals Benefit Account (ABA) Grants',
    target_url: 'https://www.niaa.gov.au/our-work/grants-and-funding/aboriginals-benefit-account',
    domain: 'niaa.gov.au', parser_hint: 'niaa-aba-monitor',
    cadence_hours: 48, priority: 8, confidence: 'high',
    metadata: { goods_focus: true, lane: 'indigenous-grants', notes: 'ABA funds NT Aboriginal community infrastructure — beds/housing fit cleanly' } },

  { source_key: 'grant-source:niaa:ipp', source_kind: 'grant_source_page',
    source_name: 'NIAA Indigenous Procurement Policy',
    target_url: 'https://www.niaa.gov.au/our-work/economic-development/indigenous-procurement-policy',
    domain: 'niaa.gov.au', parser_hint: 'niaa-ipp-monitor',
    cadence_hours: 168, priority: 6, confidence: 'high',
    metadata: { goods_focus: true, lane: 'procurement-policy', notes: 'Mandatory minimum Indigenous procurement targets — find buyers obligated to source from Goods' } },

  { source_key: 'grant-source:ilc:funding', source_kind: 'grant_source_page',
    source_name: 'Indigenous Land and Sea Corporation Funding',
    target_url: 'https://www.ilsc.gov.au/applicants/',
    domain: 'ilsc.gov.au', parser_hint: 'ilsc-funding-monitor',
    cadence_hours: 72, priority: 8, confidence: 'high',
    metadata: { goods_focus: true, lane: 'indigenous-grants', notes: 'ILSC funds community infrastructure on Aboriginal-owned land' } },

  { source_key: 'grant-source:iba:programs', source_kind: 'grant_source_page',
    source_name: 'Indigenous Business Australia Programs',
    target_url: 'https://iba.gov.au/business/',
    domain: 'iba.gov.au', parser_hint: 'iba-programs-monitor',
    cadence_hours: 168, priority: 6, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'indigenous-grants', notes: 'Business finance for Indigenous-controlled supply chains' } },

  { source_key: 'grant-source:fac:programs', source_kind: 'grant_source_page',
    source_name: 'First Australians Capital',
    target_url: 'https://firstaustralianscapital.org/',
    domain: 'firstaustralianscapital.org', parser_hint: 'foundation-program-monitor',
    cadence_hours: 168, priority: 7, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'indigenous-capital' } },

  // LANE 2: State housing / community-infra departments
  { source_key: 'grant-source:nt-dlghcd:grants', source_kind: 'grant_source_page',
    source_name: 'NT Local Government, Housing & Community Development Grants',
    target_url: 'https://nt.gov.au/community/community-organisations/grants-and-funding',
    domain: 'nt.gov.au', parser_hint: 'nt-community-grants-monitor',
    cadence_hours: 48, priority: 8, confidence: 'high',
    metadata: { goods_focus: true, lane: 'state-housing', geography: 'AU-NT' } },

  { source_key: 'grant-source:nt-dchde:housing', source_kind: 'grant_source_page',
    source_name: 'NT Housing Aboriginal Community Programs',
    target_url: 'https://nt.gov.au/property/community-housing',
    domain: 'nt.gov.au', parser_hint: 'nt-housing-monitor',
    cadence_hours: 72, priority: 7, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'state-housing', geography: 'AU-NT' } },

  { source_key: 'grant-source:wa-dch:aboriginal', source_kind: 'grant_source_page',
    source_name: 'WA Department of Communities — Aboriginal Housing',
    target_url: 'https://www.wa.gov.au/organisation/department-of-communities/aboriginal-housing',
    domain: 'wa.gov.au', parser_hint: 'wa-aboriginal-housing-monitor',
    cadence_hours: 72, priority: 7, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'state-housing', geography: 'AU-WA' } },

  { source_key: 'grant-source:nsw-aac:closing-the-gap', source_kind: 'grant_source_page',
    source_name: 'NSW Aboriginal Affairs — Closing the Gap',
    target_url: 'https://www.aboriginalaffairs.nsw.gov.au/our-business/closing-the-gap/',
    domain: 'aboriginalaffairs.nsw.gov.au', parser_hint: 'nsw-aac-monitor',
    cadence_hours: 48, priority: 7, confidence: 'high',
    metadata: { goods_focus: true, lane: 'state-indigenous', geography: 'AU-NSW' } },

  { source_key: 'grant-source:qld-dseo:first-nations', source_kind: 'grant_source_page',
    source_name: 'QLD First Nations Partnerships Grants',
    target_url: 'https://www.dtatsipca.qld.gov.au/our-work/grant-programs',
    domain: 'qld.gov.au', parser_hint: 'qld-first-nations-monitor',
    cadence_hours: 48, priority: 7, confidence: 'high',
    metadata: { goods_focus: true, lane: 'state-indigenous', geography: 'AU-QLD' } },

  { source_key: 'grant-source:sa-aar:grants', source_kind: 'grant_source_page',
    source_name: 'SA Aboriginal Affairs and Reconciliation Grants',
    target_url: 'https://www.dpc.sa.gov.au/responsibilities/aboriginal-affairs-and-reconciliation/programs',
    domain: 'sa.gov.au', parser_hint: 'sa-aar-monitor',
    cadence_hours: 72, priority: 6, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'state-indigenous', geography: 'AU-SA' } },

  // LANE 3: NT Remote Council tender portals
  { source_key: 'procurement-source:barkly:tenders', source_kind: 'grant_source_page',
    source_name: 'Barkly Regional Council Tenders',
    target_url: 'https://www.barkly.nt.gov.au/council/tenders-quotes-and-expressions-of-interest',
    domain: 'barkly.nt.gov.au', parser_hint: 'council-tender-monitor',
    cadence_hours: 48, priority: 8, confidence: 'high',
    metadata: { goods_focus: true, lane: 'procurement', scope: 'RFQ/RFT for beds, white-goods, community equipment', communities: ['Tennant Creek','Ali Curung','Alpurrurulam','Ampilatwatja','Canteen Creek'] } },

  { source_key: 'procurement-source:macdonnell:tenders', source_kind: 'grant_source_page',
    source_name: 'MacDonnell Regional Council Tenders',
    target_url: 'https://www.macdonnell.nt.gov.au/council/tenders',
    domain: 'macdonnell.nt.gov.au', parser_hint: 'council-tender-monitor',
    cadence_hours: 48, priority: 8, confidence: 'high',
    metadata: { goods_focus: true, lane: 'procurement', communities: ['Hermannsburg','Atitjere','Areyonga','Engawala','Kintore','Mt Liebig','Imanpa','Kaltukatjara','Laramba','Papunya','Santa Teresa'] } },

  { source_key: 'procurement-source:central-desert:tenders', source_kind: 'grant_source_page',
    source_name: 'Central Desert Regional Council Tenders',
    target_url: 'https://www.centraldesert.nt.gov.au/council/tenders',
    domain: 'centraldesert.nt.gov.au', parser_hint: 'council-tender-monitor',
    cadence_hours: 48, priority: 7, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'procurement', communities: ['Yuendumu','Nyirripi','Willowra','Lajamanu','Anmatjere'] } },

  { source_key: 'procurement-source:roper-gulf:tenders', source_kind: 'grant_source_page',
    source_name: 'Roper Gulf Regional Council Tenders',
    target_url: 'https://www.ropergulf.nt.gov.au/council/tenders-and-public-notices',
    domain: 'ropergulf.nt.gov.au', parser_hint: 'council-tender-monitor',
    cadence_hours: 48, priority: 7, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'procurement', communities: ['Barunga','Beswick','Binjari','Bulman','Jilkminggan'] } },

  { source_key: 'procurement-source:west-arnhem:tenders', source_kind: 'grant_source_page',
    source_name: 'West Arnhem Regional Council Tenders',
    target_url: 'https://www.westarnhem.nt.gov.au/council/tenders',
    domain: 'westarnhem.nt.gov.au', parser_hint: 'council-tender-monitor',
    cadence_hours: 48, priority: 8, confidence: 'high',
    metadata: { goods_focus: true, lane: 'procurement', communities: ['Maningrida','Minjilang','Warruwi','Gunbalanya'] } },

  { source_key: 'procurement-source:tiwi:tenders', source_kind: 'grant_source_page',
    source_name: 'Tiwi Islands Regional Council Tenders',
    target_url: 'https://www.tiwiislands.nt.gov.au/business/tenders',
    domain: 'tiwiislands.nt.gov.au', parser_hint: 'council-tender-monitor',
    cadence_hours: 72, priority: 6, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'procurement', communities: ['Wurrumiyanga','Milikapiti','Pirlangimpi'] } },

  { source_key: 'procurement-source:east-arnhem:tenders', source_kind: 'grant_source_page',
    source_name: 'East Arnhem Regional Council Tenders',
    target_url: 'https://www.eastarnhem.nt.gov.au/council/tenders',
    domain: 'eastarnhem.nt.gov.au', parser_hint: 'council-tender-monitor',
    cadence_hours: 48, priority: 7, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'procurement', communities: ['Yirrkala','Gunyangara','Galiwinku','Ramingining'] } },

  { source_key: 'procurement-source:victoria-daly:tenders', source_kind: 'grant_source_page',
    source_name: 'Victoria Daly Regional Council Tenders',
    target_url: 'https://www.victoriadaly.nt.gov.au/council/tenders',
    domain: 'victoriadaly.nt.gov.au', parser_hint: 'council-tender-monitor',
    cadence_hours: 72, priority: 6, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'procurement', communities: ['Belyuen','Daguragu','Kalkarindji'] } },

  { source_key: 'procurement-source:palm-island:tenders', source_kind: 'grant_source_page',
    source_name: 'Palm Island Aboriginal Shire Council Tenders',
    target_url: 'https://www.palmisland.qld.gov.au/council/tenders',
    domain: 'palmisland.qld.gov.au', parser_hint: 'council-tender-monitor',
    cadence_hours: 48, priority: 9, confidence: 'high',
    metadata: { goods_focus: true, lane: 'procurement', communities: ['Palm Island'], notes: 'Priority — active Goods buyer relationship' } },

  { source_key: 'procurement-source:kalgoorlie:tenders', source_kind: 'grant_source_page',
    source_name: 'City of Kalgoorlie-Boulder Tenders',
    target_url: 'https://www.ckb.wa.gov.au/Business/Procurement/Tenders',
    domain: 'ckb.wa.gov.au', parser_hint: 'council-tender-monitor',
    cadence_hours: 48, priority: 7, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'procurement', communities: ['Kalgoorlie'] } },

  // LANE 4: Procurement panels & supplier directories
  { source_key: 'procurement-source:ibd:directory', source_kind: 'grant_source_page',
    source_name: 'Indigenous Business Direct (IBD)',
    target_url: 'https://www.supplynation.org.au/indigenous-business-direct/',
    domain: 'supplynation.org.au', parser_hint: 'ibd-supplier-monitor',
    cadence_hours: 168, priority: 6, confidence: 'high',
    metadata: { goods_focus: true, lane: 'procurement', notes: 'Verified Indigenous suppliers — Goods can register and find aligned buyers' } },

  { source_key: 'procurement-source:nt-stores:licensing', source_kind: 'grant_source_page',
    source_name: 'NT Remote Community Stores Licensing',
    target_url: 'https://stores.nt.gov.au/stores/store-list',
    domain: 'nt.gov.au', parser_hint: 'nt-stores-monitor',
    cadence_hours: 168, priority: 6, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'procurement', notes: 'Licensed remote stores — supply route partners for white-goods distribution' } },

  { source_key: 'grant-source:ndia:market-stewardship', source_kind: 'grant_source_page',
    source_name: 'NDIA Market Stewardship Grants',
    target_url: 'https://www.ndis.gov.au/about-us/strategies/our-priorities',
    domain: 'ndis.gov.au', parser_hint: 'ndia-monitor',
    cadence_hours: 168, priority: 5, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'ndis', notes: 'Disability housing assistive tech — bed/equipment fit' } },

  // LANE 5: ACCO peaks
  { source_key: 'grant-source:naccho:grants', source_kind: 'grant_source_page',
    source_name: 'NACCHO Member Funding Opportunities',
    target_url: 'https://www.naccho.org.au/funding/',
    domain: 'naccho.org.au', parser_hint: 'acco-peak-monitor',
    cadence_hours: 168, priority: 5, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'acco-peak', notes: 'Aboriginal Community Controlled Health Organisations peak' } },

  { source_key: 'grant-source:snaicc:opportunities', source_kind: 'grant_source_page',
    source_name: 'SNAICC Funding & Tenders',
    target_url: 'https://www.snaicc.org.au/policy-and-research/',
    domain: 'snaicc.org.au', parser_hint: 'acco-peak-monitor',
    cadence_hours: 168, priority: 5, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'acco-peak', notes: 'National First Nations children peak' } },

  { source_key: 'grant-source:absec:opportunities', source_kind: 'grant_source_page',
    source_name: 'AbSec Tenders & Grants',
    target_url: 'https://www.absec.org.au/',
    domain: 'absec.org.au', parser_hint: 'acco-peak-monitor',
    cadence_hours: 168, priority: 5, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'acco-peak', geography: 'AU-NSW', notes: 'NSW Aboriginal child & family peak' } },

  // LANE 6: High-value Indigenous foundations
  { source_key: 'grant-source:kkt:programs', source_kind: 'grant_source_page',
    source_name: 'Karrkad Kanjdji Trust',
    target_url: 'https://kkt.org.au/our-programs/',
    domain: 'kkt.org.au', parser_hint: 'foundation-program-monitor',
    cadence_hours: 168, priority: 6, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'indigenous-foundation', geography: 'AU-NT' } },

  { source_key: 'grant-source:lowitja:grants', source_kind: 'grant_source_page',
    source_name: 'Lowitja Institute Funding',
    target_url: 'https://www.lowitja.org.au/page/grants-funding',
    domain: 'lowitja.org.au', parser_hint: 'foundation-program-monitor',
    cadence_hours: 168, priority: 5, confidence: 'medium',
    metadata: { goods_focus: true, lane: 'indigenous-foundation' } },

  { source_key: 'grant-source:centrecorp:foundation', source_kind: 'grant_source_page',
    source_name: 'Centrecorp Foundation',
    target_url: 'https://centrecorpfoundation.com.au/',
    domain: 'centrecorpfoundation.com.au', parser_hint: 'foundation-program-monitor',
    cadence_hours: 168, priority: 8, confidence: 'high',
    metadata: { goods_focus: true, lane: 'indigenous-foundation', notes: 'Existing Goods funder — monitor for new programs' } },

  // LANE 7: Trustee-managed philanthropy and corporate community investment
  { source_key: 'grant-source:perpetual:impact-philanthropy', source_kind: 'foundation_program_page',
    source_name: 'Perpetual IMPACT Philanthropy Application Program',
    target_url: 'https://www.perpetual.com.au/wealth-management/not-for-profits/impact-funding/',
    domain: 'perpetual.com.au', parser_hint: 'foundation-program-monitor',
    foundation_id: 'e1f8f068-fc24-4d2b-bc7c-357a371bf20e',
    cadence_hours: 72, priority: 9, confidence: 'high',
    metadata: { goods_focus: true, trustee_portal: true, lane: 'trustee-philanthropy', doorway: 'annual_application', notes: 'One annual application can be matched across multiple charitable trusts and endowments' } },

  { source_key: 'grant-source:eqt:community-grants', source_kind: 'foundation_program_page',
    source_name: 'Equity Trustees Community Grants',
    target_url: 'https://www.eqt.com.au/our-services/community/grant-funding/community-grants',
    domain: 'eqt.com.au', parser_hint: 'foundation-program-monitor',
    foundation_id: 'a4bdfdd2-1cca-4c4f-b5ed-3d3aead21513',
    cadence_hours: 72, priority: 9, confidence: 'high',
    metadata: { goods_focus: true, trustee_portal: true, lane: 'trustee-philanthropy', doorway: 'annual_application', notes: 'One application is considered across multiple aligned trusts' } },

  { source_key: 'grant-source:eqt:current-rounds', source_kind: 'foundation_program_page',
    source_name: 'Equity Trustees Current Grant Rounds',
    target_url: 'https://equitytrustees.smartygrants.com.au/',
    domain: 'equitytrustees.smartygrants.com.au', parser_hint: 'smartygrants-round-monitor',
    foundation_id: 'a4bdfdd2-1cca-4c4f-b5ed-3d3aead21513',
    cadence_hours: 48, priority: 9, confidence: 'high',
    metadata: { goods_focus: true, trustee_portal: true, lane: 'trustee-philanthropy', doorway: 'current_rounds' } },

  { source_key: 'grant-source:jemena:first-nations-grants', source_kind: 'grant_source_page',
    source_name: 'Jemena First Nations Community Grants',
    target_url: 'https://www.jemena.com.au/media/jemena-expands-first-nations-community-grants-to-support-wellbeing-education-and-employment/',
    domain: 'jemena.com.au', parser_hint: 'corporate-community-investment-monitor',
    cadence_hours: 48, priority: 10, confidence: 'high',
    metadata: { goods_focus: true, corporate_community: true, lane: 'nt-corporate-community', doorway: 'open_grant', geography: 'AU-NT', place: 'Tennant Creek', notes: 'Up to $10,000 for Indigenous-led wellbeing, practical support, training and employment projects' } },

  { source_key: 'grant-source:powerwater:community-partnerships', source_kind: 'grant_source_page',
    source_name: 'Power and Water Community Partnerships',
    target_url: 'https://www.powerwater.com.au/about/community/community-partnerships',
    domain: 'powerwater.com.au', parser_hint: 'corporate-community-investment-monitor',
    cadence_hours: 72, priority: 8, confidence: 'high',
    metadata: { goods_focus: true, corporate_community: true, lane: 'nt-corporate-community', doorway: 'annual_grant_and_partnership', geography: 'AU-NT' } },

  { source_key: 'grant-source:newmont:tanami-community-investment', source_kind: 'grant_source_page',
    source_name: 'Newmont Tanami Community Investment',
    target_url: 'https://newmont.com/operations-and-projects/global-presence/australia/tanami-au/default.aspx',
    domain: 'newmont.com', parser_hint: 'corporate-community-investment-monitor',
    cadence_hours: 168, priority: 7, confidence: 'medium',
    metadata: { goods_focus: true, corporate_community: true, lane: 'nt-corporate-community', doorway: 'relationship_sponsorship', geography: 'AU-NT', place: 'Tanami', notes: 'Community capacity building, sponsorship grants and in-kind support; no verified public round' } },

  { source_key: 'grant-source:australian-ethical:foundation', source_kind: 'foundation_program_page',
    source_name: 'Australian Ethical Foundation',
    target_url: 'https://www.australianethical.com.au/foundation/',
    domain: 'australianethical.com.au', parser_hint: 'foundation-program-monitor',
    foundation_id: '386109c6-5cb5-405e-b489-96c698b4cba2',
    cadence_hours: 168, priority: 7, confidence: 'high',
    metadata: { goods_focus: true, corporate_community: true, lane: 'catalytic-philanthropy', doorway: 'relationship_research', notes: 'Climate resilience, justice, Indigenous-led approaches and early-stage catalytic models' } },
];

async function main() {
  console.log(`=== Seed Goods Source Frontier ===`);
  console.log(`Upserting ${SOURCES.length} sources...\n`);

  let upserted = 0;
  const updatedAt = new Date().toISOString();
  for (let offset = 0; offset < SOURCES.length; offset += 20) {
    const payload = SOURCES.slice(offset, offset + 20).map(src => ({
      ...src,
      enabled: true,
      updated_at: updatedAt,
    }));
    const { error } = await supabase
      .from('source_frontier')
      .upsert(payload, { onConflict: 'source_key' });
    if (error) throw new Error(`Source upsert failed at offset ${offset}: ${error.message}`);
    upserted += payload.length;
    console.log(`  Upserted ${upserted}/${SOURCES.length}`);
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Upserted: ${upserted}`);

  // Show lane distribution
  const { data: byLane } = await supabase
    .from('source_frontier')
    .select('metadata, priority')
    .filter('metadata->goods_focus', 'eq', true);
  if (byLane) {
    const tally = {};
    for (const r of byLane) {
      const lane = r.metadata?.lane || 'unknown';
      tally[lane] = (tally[lane] || 0) + 1;
    }
    console.log('\nLane distribution:');
    for (const [lane, count] of Object.entries(tally).sort((a,b) => b[1] - a[1])) {
      console.log(`  ${lane.padEnd(28)} ${count}`);
    }
  }
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
