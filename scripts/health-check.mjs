#!/usr/bin/env node
/**
 * health-check.mjs — Data health + agent health dashboard for GrantScope
 *
 * Usage: node --env-file=.env scripts/health-check.mjs
 *        node --env-file=.env scripts/health-check.mjs --agents   (agent health only)
 *        node --env-file=.env scripts/health-check.mjs --data     (data health only)
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function sql(query) {
  const { data, error } = await supabase.rpc('exec_sql', { query });
  if (error) throw new Error(error.message);
  return data;
}

const args = process.argv.slice(2);
const showAgents = args.includes('--agents') || !args.some(a => a.startsWith('--'));
const showData = args.includes('--data') || !args.some(a => a.startsWith('--'));
const showEcosystem = args.includes('--ecosystem') || !args.some(a => a.startsWith('--'));

console.log('\n  GrantScope Health Check\n');

// ── Data Health ──
if (showData) {
  console.log('  ── DATA HEALTH ──\n');

  // Core table counts
  const counts = await sql(`
    SELECT 'gs_entities' as tbl, COUNT(*) as rows FROM gs_entities
    UNION ALL SELECT 'gs_relationships', COUNT(*) FROM gs_relationships
    UNION ALL SELECT 'austender_contracts', COUNT(*) FROM austender_contracts
    UNION ALL SELECT 'acnc_charities', COUNT(*) FROM acnc_charities
    UNION ALL SELECT 'justice_funding', COUNT(*) FROM justice_funding
    UNION ALL SELECT 'political_donations', COUNT(*) FROM political_donations
    UNION ALL SELECT 'foundations', COUNT(*) FROM foundations
    UNION ALL SELECT 'grant_opportunities', COUNT(*) FROM grant_opportunities
    ORDER BY tbl
  `);
  for (const r of counts) {
    console.log(`  ${r.tbl.padEnd(25)} ${Number(r.rows).toLocaleString().padStart(10)} rows`);
  }

  // Entity coverage
  console.log('\n  ── ENTITY COVERAGE ──\n');
  const coverage = await sql(`
    SELECT
      COUNT(*) as total,
      COUNT(postcode) as with_postcode,
      COUNT(remoteness) as with_remoteness,
      COUNT(lga_name) as with_lga,
      COUNT(seifa_irsd_decile) as with_seifa,
      COUNT(CASE WHEN is_community_controlled THEN 1 END) as community_controlled,
      COUNT(abn) as with_abn,
      COUNT(website) as with_website,
      COUNT(description) as with_description
    FROM gs_entities
  `);
  const c = coverage[0];
  const pct = (n) => `${Math.round(n / c.total * 100)}%`;

  console.log(`  Total entities:       ${Number(c.total).toLocaleString()}`);
  console.log(`  With postcode:        ${Number(c.with_postcode).toLocaleString()} (${pct(c.with_postcode)})`);
  console.log(`  With remoteness:      ${Number(c.with_remoteness).toLocaleString()} (${pct(c.with_remoteness)})`);
  console.log(`  With LGA:             ${Number(c.with_lga).toLocaleString()} (${pct(c.with_lga)})`);
  console.log(`  With SEIFA:           ${Number(c.with_seifa).toLocaleString()} (${pct(c.with_seifa)})`);
  console.log(`  With ABN:             ${Number(c.with_abn).toLocaleString()} (${pct(c.with_abn)})`);
  console.log(`  With website:         ${Number(c.with_website).toLocaleString()} (${pct(c.with_website)})`);
  console.log(`  With description:     ${Number(c.with_description).toLocaleString()} (${pct(c.with_description)})`);
  console.log(`  Community-controlled: ${Number(c.community_controlled).toLocaleString()} (${pct(c.community_controlled)})`);

  // Materialized view health
  console.log('\n  ── MATERIALIZED VIEWS ──\n');
  const mvs = await sql(`
    SELECT matviewname, ispopulated,
           pg_size_pretty(pg_total_relation_size('public.' || matviewname)) as size
    FROM pg_matviews
    WHERE schemaname = 'public'
    ORDER BY matviewname
  `);
  for (const mv of mvs) {
    const icon = mv.ispopulated === true ? '✅' : '❌';
    console.log(`  ${icon} ${mv.matviewname.padEnd(42)} ${mv.size}`);
  }
}

// ── Agent Health ──
if (showAgents) {
  console.log('\n  ── AGENT HEALTH ──\n');

  const agents = await sql(`
    SELECT
      agent_name,
      COUNT(*) as total_runs,
      COUNT(CASE WHEN status = 'success' THEN 1 END) as successes,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failures,
      COUNT(CASE WHEN status = 'running' THEN 1 END) as running,
      MAX(CASE WHEN status = 'success' THEN started_at END) as last_success,
      MAX(started_at) as last_run,
      ROUND(AVG(CASE WHEN status = 'success' THEN duration_ms END)) as avg_duration_ms
    FROM agent_runs
    GROUP BY agent_name
    ORDER BY last_run DESC
  `);

  const now = new Date();
  for (const a of agents) {
    const successRate = a.total_runs > 0 ? Math.round(a.successes / a.total_runs * 100) : 0;
    const lastRun = a.last_run ? new Date(a.last_run) : null;
    const hoursAgo = lastRun ? Math.round((now - lastRun) / 3600000) : null;
    const stale = hoursAgo && hoursAgo > 48;

    const icon = a.running > 0 ? '🔄' :
                 a.failures > 0 && a.successes === 0 ? '❌' :
                 stale ? '⚠️' :
                 successRate >= 80 ? '✅' : '🟡';

    const duration = a.avg_duration_ms ? `${Math.round(a.avg_duration_ms / 1000)}s` : '—';
    const freshness = hoursAgo !== null ? `${hoursAgo}h ago` : 'never';

    console.log(`  ${icon} ${a.agent_name.padEnd(35)} ${String(successRate + '%').padStart(4)} success | ${String(a.total_runs).padStart(3)} runs | ${duration.padStart(5)} avg | ${freshness}`);
  }

  // Stuck agents (running > 1 hour)
  const stuck = await sql(`
    SELECT agent_name, started_at
    FROM agent_runs
    WHERE status = 'running'
    AND started_at < NOW() - INTERVAL '1 hour'
  `);
  if (stuck.length > 0) {
    console.log('\n  ⚠️  STUCK AGENTS (running > 1 hour):');
    for (const s of stuck) {
      const hours = Math.round((now - new Date(s.started_at)) / 3600000);
      console.log(`     ${s.agent_name} — started ${hours}h ago`);
    }
  }
}

// ── Ecosystem Health (Cross-System) ──
if (showEcosystem) {
  console.log('\n  ── ECOSYSTEM HEALTH (GS + JH + EL) ──\n');

  const eco = await sql(`
    SELECT
      (SELECT COUNT(*) FROM organizations) as jh_orgs,
      (SELECT COUNT(*) FROM organizations WHERE gs_entity_id IS NOT NULL) as jh_linked,
      (SELECT COUNT(*) FROM organizations WHERE abn IS NOT NULL) as jh_with_abn,
      (SELECT COUNT(*) FROM alma_interventions) as jh_interventions,
      (SELECT COUNT(*) FROM alma_evidence) as jh_evidence,
      (SELECT COUNT(*) FROM alma_outcomes) as jh_outcomes,
      (SELECT COUNT(*) FROM justice_funding) as jh_funding,
      (SELECT COUNT(*) FROM storytellers) as el_storytellers,
      (SELECT COUNT(*) FROM story_analysis) as el_stories,
      (SELECT COUNT(*) FROM tour_stops) as el_tour_stops
  `);
  const e = eco[0];
  const linkRate = Math.round(e.jh_linked / e.jh_orgs * 100);

  console.log('  JusticeHub:');
  console.log(`    Organizations:    ${Number(e.jh_orgs).toLocaleString()} (${e.jh_linked} linked to GS = ${linkRate}%)`);
  console.log(`    With ABN:         ${e.jh_with_abn} (${e.jh_orgs - e.jh_with_abn} missing — cannot auto-link)`);
  console.log(`    Interventions:    ${Number(e.jh_interventions).toLocaleString()}`);
  console.log(`    Evidence:         ${Number(e.jh_evidence).toLocaleString()}`);
  console.log(`    Outcomes:         ${Number(e.jh_outcomes).toLocaleString()}`);
  console.log(`    Justice funding:  ${Number(e.jh_funding).toLocaleString()}`);

  console.log('  Empathy Ledger:');
  console.log(`    Storytellers:     ${Number(e.el_storytellers).toLocaleString()}`);
  console.log(`    Stories:          ${Number(e.el_stories).toLocaleString()}`);
  console.log(`    Tour stops:       ${Number(e.el_tour_stops).toLocaleString()}`);

  // Linkage gaps
  const unlinkable = e.jh_with_abn - e.jh_linked;
  if (unlinkable > 0) {
    console.log(`\n  ⚠️  ${unlinkable} JH orgs have ABN but no gs_entity_id — re-run ABN match to link`);
  }
}

console.log('');
