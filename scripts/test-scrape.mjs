import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const {data} = await db.from('gs_entities').select('id, canonical_name, website').eq('entity_type','indigenous_corp').not('website','is',null).is('description',null).limit(5);
for (const e of data) {
  let url = e.website;
  if (!url.startsWith('http')) url = 'https://' + url;
  console.log('Trying:', e.canonical_name, url);
  try {
    const html = execSync(`curl -sL --max-time 5 --connect-timeout 3 -A CivicGraph "${url}"`, {encoding:'utf-8', timeout:6000, maxBuffer:2*1024*1024});
    const desc = html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i);
    console.log('  len:', html.length, 'desc:', desc ? desc[1].slice(0,60) : 'none');
  } catch(e) { console.log('  ERR:', e.message.slice(0,80)); }
}
console.log('DONE');
