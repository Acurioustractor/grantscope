#!/usr/bin/env node
/**
 * Quick data health check — run anytime to see GrantScope coverage at a glance.
 * Usage: node scripts/gsql-health.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function query(sql) {
  const { data, error } = await supabase.rpc('exec_sql', { query: sql });
  if (error) throw new Error(error.message);
  return data[0];
}

async function main() {
  // Run queries in parallel for speed
  const [entities, postcodes, sources] = await Promise.all([
    query(`SELECT COUNT(*) as total,
      COUNT(CASE WHEN postcode IS NOT NULL THEN 1 END) as with_postcode,
      COUNT(CASE WHEN sa2_code IS NOT NULL THEN 1 END) as with_sa2,
      COUNT(CASE WHEN postcode IS NOT NULL AND sa2_code IS NULL THEN 1 END) as postcode_no_sa2,
      COUNT(CASE WHEN postcode IS NULL THEN 1 END) as no_postcode
      FROM gs_entities`),
    query(`SELECT COUNT(DISTINCT postcode) as total,
      COUNT(DISTINCT CASE WHEN sa2_code IS NOT NULL THEN postcode END) as with_sa2,
      COUNT(DISTINCT sa2_code) as sa2_regions
      FROM postcode_geo WHERE sa2_code IS NOT NULL
      AND postcode IN (SELECT DISTINCT postcode FROM gs_entities WHERE postcode IS NOT NULL)`),
    query(`SELECT
      (SELECT COUNT(*) FROM gs_relationships) as relationships,
      (SELECT COUNT(*) FROM money_flows) as money_flows,
      (SELECT COUNT(*) FROM acnc_charities) as acnc,
      (SELECT COUNT(*) FROM foundations) as foundations,
      (SELECT COUNT(*) FROM political_donations) as donations`),
  ]);

  const pct = (n, d) => (d > 0 ? (n / d * 100).toFixed(1) : '0') + '%';

  console.log(`
╔══════════════════════════════════════════════════════╗
║           GRANTSCOPE DATA HEALTH                     ║
╠══════════════════════════════════════════════════════╣
║  Entities:         ${String(entities.total).padStart(8)}                       ║
║  With Postcode:    ${String(entities.with_postcode).padStart(8)}  (${pct(entities.with_postcode, entities.total).padStart(6)})            ║
║  With SA2:         ${String(entities.with_sa2).padStart(8)}  (${pct(entities.with_sa2, entities.total).padStart(6)})            ║
║  Relationships:    ${String(sources.relationships).padStart(8)}                       ║
║  Money Flows:      ${String(sources.money_flows).padStart(8)}                       ║
╠══════════════════════════════════════════════════════╣
║  MAP COVERAGE                                        ║
║  SA2 Regions:      ${String(postcodes.sa2_regions).padStart(8)} / 2,473  (${pct(postcodes.sa2_regions, 2473).padStart(6)})    ║
║  Postcodes:        ${String(postcodes.total).padStart(8)} (${postcodes.with_sa2} with SA2)          ║
╠══════════════════════════════════════════════════════╣
║  GAPS                                                ║
║  No Postcode:      ${String(entities.no_postcode).padStart(8)}  (need ABN Lookup)      ║
║  Postcode→No SA2:  ${String(entities.postcode_no_sa2).padStart(8)}  (unmapped postcodes)   ║
╠══════════════════════════════════════════════════════╣
║  SOURCES                                             ║
║  ACNC Charities:   ${String(sources.acnc).padStart(8)}                       ║
║  Foundations:       ${String(sources.foundations).padStart(8)}                       ║
║  Political Dons:   ${String(sources.donations).padStart(8)}                       ║
╚══════════════════════════════════════════════════════╝
`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
