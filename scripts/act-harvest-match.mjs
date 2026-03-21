import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from '../packages/grant-engine/node_modules/openai/index.mjs';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// 1. Create a targeted embedding for Harvest + BCV specifically
const harvestBcvText = `
The Harvest and Black Cockatoo Valley — two regenerative properties on Jinibara Country,
Sunshine Coast Hinterland, Queensland. A community hub, regenerative agriculture, First Nations
cultural experiences, night walks with projection mapping on trees, farm-to-table dining,
innovation hub at the forest edge, art trails through subtropical forest, community-owned
social enterprise, therapeutic horticulture, land-based healing, cultural tourism,
agritourism, creative placemaking, Indigenous cultural knowledge, environmental regeneration,
community development, youth engagement, social impact, rural innovation,
food systems, circular economy, heritage preservation, eco-tourism, nature-based experiences.
40 acres dense subtropical forest, existing water infrastructure. Witta village retail space.
Seeking funding for: property development, community infrastructure, art installations,
First Nations partnership programs, regenerative land management, tourism development,
social enterprise incubation, regional economic development.
`;

console.log('Generating Harvest+BCV specific embedding...\n');
const embRes = await openai.embeddings.create({
  model: 'text-embedding-3-small',
  input: harvestBcvText.trim()
});
const embedding = embRes.data[0].embedding;

// 2. Search grants semantically
const { data, error } = await sb.rpc('match_grants_for_org', {
  org_embedding: embedding,
  threshold: 0.55,
  match_limit: 80
});

if (error) {
  console.log('RPC error:', error.message);
  process.exit(1);
}

// 3. Filter and categorize
const now = new Date();
const open = [];
const upcoming = [];
const historical = [];

for (const g of data) {
  const deadline = g.deadline ? new Date(g.deadline) : null;
  if (!deadline || deadline > now) {
    if (g.amount_max && g.amount_max > 5000) {
      open.push(g);
    }
  } else {
    historical.push(g);
  }
}

console.log(`=== OPEN/UPCOMING OPPORTUNITIES (${open.length}) ===\n`);
open.sort((a, b) => (b.amount_max || 0) - (a.amount_max || 0));
open.forEach((g, i) => {
  const amt = g.amount_max ? `$${(g.amount_max / 1000).toFixed(0)}K` : '$?';
  const dl = g.deadline || 'ongoing';
  console.log(`${i + 1}. [${(g.similarity * 100).toFixed(1)}%] ${amt} — ${g.name}`);
  console.log(`   Provider: ${g.provider || g.source || '?'} | Deadline: ${dl}`);
  console.log('');
});

console.log(`\n=== HISTORICAL/PRECEDENT (${historical.length} — who funded similar work?) ===\n`);
// Group historical by provider to find patterns
const providerMap = {};
for (const g of historical) {
  const p = g.provider || g.source || 'Unknown';
  if (!providerMap[p]) providerMap[p] = { count: 0, total: 0, grants: [] };
  providerMap[p].count++;
  providerMap[p].total += g.amount_max || 0;
  providerMap[p].grants.push(g);
}

const sorted = Object.entries(providerMap).sort((a, b) => b[1].total - a[1].total);
sorted.slice(0, 20).forEach(([provider, info]) => {
  const total = info.total ? `$${(info.total / 1000).toFixed(0)}K total` : '';
  console.log(`  ${provider}: ${info.count} grants ${total}`);
});

// 4. Partnership potential — find foundations matching these themes
console.log('\n\n=== FOUNDATION PARTNERSHIP SCAN ===\n');
const { data: foundations, error: fErr } = await sb.rpc('search_grants_semantic', {
  query_embedding: embedding,
  match_threshold: 0.55,
  match_count: 30
});

if (!fErr && foundations) {
  // Deduplicate by provider and find unique funders
  const funders = new Set();
  foundations.forEach(f => {
    if (f.provider) funders.add(f.provider);
  });
  console.log(`${funders.size} unique funders found across matches:`);
  [...funders].forEach(f => console.log(`  - ${f}`));
}
