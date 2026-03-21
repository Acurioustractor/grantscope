import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from '../packages/grant-engine/node_modules/openai/index.mjs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const harvestBcvText = `
Regenerative agriculture community hub on Jinibara Country, Sunshine Coast Hinterland Queensland.
First Nations cultural experiences, art trails, night walks, farm-to-table dining, innovation hub.
Community-owned social enterprise, therapeutic horticulture, land-based healing, cultural tourism,
agritourism, creative placemaking, environmental regeneration, youth engagement, social impact,
rural innovation, food systems, eco-tourism, nature-based experiences, Indigenous partnership.
Seeking partners and funders for: regenerative land, community infrastructure, art installations,
First Nations programs, tourism development, social enterprise, regional economic development.
`;

console.log('Generating embedding for Harvest+BCV partnership scan...\n');
const embRes = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: harvestBcvText.trim()
});
const emb = embRes.data[0].embedding;

// 1. FOUNDATIONS — semantic search
console.log('=== TOP FOUNDATIONS FOR HARVEST + BCV ===\n');
const { data: fResults, error: fErr } = await sb.rpc('exec_sql', {
  query: `
    SELECT name, website, total_giving_annual, avg_grant_size,
           thematic_focus, geographic_focus, giving_philosophy,
           1 - (embedding <=> '${JSON.stringify(emb)}'::vector) as similarity
    FROM foundations
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> '${JSON.stringify(emb)}'::vector) > 0.45
    ORDER BY embedding <=> '${JSON.stringify(emb)}'::vector
    LIMIT 40
  `
});

if (fErr) {
  console.log('Foundation search error:', fErr.message);
} else {
  const rows = fResults || [];
  // Filter to higher-value foundations
  const good = rows.filter(r => r.total_giving_annual > 20000 || !r.total_giving_annual);
  console.log(`Found ${rows.length} matching foundations (${good.length} with >$20K annual giving):\n`);

  good.slice(0, 25).forEach((f, i) => {
    const giving = f.total_giving_annual ? `$${(f.total_giving_annual / 1000).toFixed(0)}K/yr` : '?';
    const avgGrant = f.avg_grant_size ? `avg $${(f.avg_grant_size / 1000).toFixed(0)}K` : '';
    console.log(`${i + 1}. [${(f.similarity * 100).toFixed(1)}%] ${f.name} — ${giving} ${avgGrant}`);
    if (f.website) console.log(`   Web: ${f.website}`);
    if (f.thematic_focus) console.log(`   Focus: ${Array.isArray(f.thematic_focus) ? f.thematic_focus.join(', ') : f.thematic_focus}`);
    if (f.geographic_focus) console.log(`   Geo: ${Array.isArray(f.geographic_focus) ? f.geographic_focus.join(', ') : f.geographic_focus}`);
    if (f.giving_philosophy) console.log(`   Philosophy: ${f.giving_philosophy.substring(0, 120)}...`);
    console.log('');
  });
}

// 2. COMMUNITY ORGS — potential collaborators
console.log('\n=== POTENTIAL PARTNER ORGS (community orgs, social enterprises) ===\n');
const { data: orgResults, error: oErr } = await sb.rpc('exec_sql', {
  query: `
    SELECT name, abn, website, primary_activity, state, suburb,
           1 - (embedding <=> '${JSON.stringify(emb)}'::vector) as similarity
    FROM community_orgs
    WHERE embedding IS NOT NULL
      AND 1 - (embedding <=> '${JSON.stringify(emb)}'::vector) > 0.5
    ORDER BY embedding <=> '${JSON.stringify(emb)}'::vector
    LIMIT 25
  `
});

if (oErr) {
  console.log('Community org search error:', oErr.message);
} else {
  const orgs = orgResults || [];
  console.log(`Found ${orgs.length} potential partner orgs:\n`);
  orgs.forEach((o, i) => {
    console.log(`${i + 1}. [${(o.similarity * 100).toFixed(1)}%] ${o.name}`);
    if (o.primary_activity) console.log(`   Activity: ${o.primary_activity}`);
    if (o.state || o.suburb) console.log(`   Location: ${o.suburb || ''} ${o.state || ''}`);
    if (o.website) console.log(`   Web: ${o.website}`);
    console.log('');
  });
}

// 3. FOUNDATION PROGRAMS — open programs specifically
console.log('\n=== OPEN FOUNDATION PROGRAMS ===\n');
const { data: progResults } = await sb.rpc('exec_sql', {
  query: `
    SELECT fp.program_name, fp.description, fp.status, fp.grant_range, fp.eligibility,
           f.name as foundation_name, f.website
    FROM foundation_programs fp
    JOIN foundations f ON f.id = fp.foundation_id
    WHERE fp.status = 'open'
      AND (fp.description ILIKE '%community%' OR fp.description ILIKE '%indigenous%'
           OR fp.description ILIKE '%art%' OR fp.description ILIKE '%environment%'
           OR fp.description ILIKE '%agriculture%' OR fp.description ILIKE '%rural%'
           OR fp.description ILIKE '%social enterprise%' OR fp.description ILIKE '%regenerat%'
           OR fp.description ILIKE '%First Nations%' OR fp.description ILIKE '%queensland%')
    ORDER BY fp.program_name
    LIMIT 30
  `
});

if (progResults && progResults.length > 0) {
  progResults.forEach((p, i) => {
    console.log(`${i + 1}. ${p.program_name} — ${p.foundation_name}`);
    if (p.grant_range) console.log(`   Range: ${p.grant_range}`);
    if (p.description) console.log(`   ${p.description.substring(0, 150)}`);
    if (p.website) console.log(`   Web: ${p.website}`);
    console.log('');
  });
} else {
  console.log('No open programs found matching themes (checking all open programs count...)');
  const { data: countData } = await sb.rpc('exec_sql', {
    query: `SELECT COUNT(*) as cnt FROM foundation_programs WHERE status = 'open'`
  });
  console.log('Total open programs:', countData?.[0]?.cnt || 0);
}
