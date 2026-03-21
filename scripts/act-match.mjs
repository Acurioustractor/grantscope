import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// Get ACT profile embedding
const { data: profile, error: pErr } = await sb
  .from('org_profiles')
  .select('embedding')
  .eq('id', '8b6160a1-7eea-4bd2-8404-71c196381de0')
  .single();

if (pErr || !profile || !profile.embedding) {
  console.log('No embedding found', pErr);
  process.exit(1);
}

console.log('ACT profile embedding found, running semantic match...\n');

// Try match_grants_for_org RPC
const { data, error } = await sb.rpc('match_grants_for_org', {
  org_embedding: profile.embedding,
  threshold: 0.5,
  match_limit: 50
});

if (error) {
  console.log('RPC error:', error.message);
  // Try alternate function name
  const { data: d2, error: e2 } = await sb.rpc('search_grants_semantic', {
    query_embedding: profile.embedding,
    match_threshold: 0.5,
    match_count: 50
  });
  if (e2) {
    console.log('Alternate RPC error:', e2.message);
    process.exit(1);
  }
  console.log('Top matches (via search_grants_semantic):');
  d2.forEach((g, i) => {
    console.log(`${i + 1}. [${(g.similarity * 100).toFixed(1)}%] ${g.name} | ${g.provider || g.source || ''} | $${g.amount_max || '?'} | deadline: ${g.deadline || g.closes_at || 'open'}`);
  });
} else {
  console.log('Top 50 matches for ACT:');
  data.forEach((g, i) => {
    console.log(`${i + 1}. [${(g.similarity * 100).toFixed(1)}%] ${g.name} | ${g.provider || g.source || ''} | $${g.amount_max || '?'} | deadline: ${g.deadline || g.closes_at || 'open'}`);
  });
}
