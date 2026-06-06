#!/usr/bin/env node
/**
 * build-orbit-soil.mjs — "soil" enrichment for ACT's Field: resolve each orbit person into
 * CivicGraph and give them their institutional ground — the orgs/boards they sit in, the nature
 * of those orgs (funder / community-controlled / supply-nation), and the INTERLOCKS (entities
 * multiple orbit people touch = warm paths to otherwise-cold targets).
 *
 * Read-join of existing tables (no new resolution): person_identity_map (email/ghl_contact_id →
 * person + company/position/sector/influence) ⋈ person_entity_links ⋈ person_role_holdings ⋈ gs_entities.
 *
 * Reads the ACT orbit worklist; writes the soil worklist back into the act repo. Read-only.
 * Run (from grantscope):  node scripts/build-orbit-soil.mjs
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ACT = '/Users/benknight/Code/act-global-infrastructure';
async function q(sql){const{data,error}=await db.rpc('exec_sql',{query:sql});if(error){console.error('SQL',error.message,sql.slice(0,120));process.exit(1);}return data||[];}
async function qAll(base){const out=[];for(let off=0;;off+=1000){const p=await q(`${base}\nLIMIT 1000 OFFSET ${off}`);out.push(...p);if(p.length<1000)break;}return out;}
const norm=s=>(s||'').toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim();
const lit=a=>`'${String(a).replace(/'/g,"''")}'`;
function parseCSV(t){const R=[];let r=[],f='',Q=false;for(let i=0;i<t.length;i++){const c=t[i];if(Q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else Q=false;}else f+=c;}else if(c==='"')Q=true;else if(c===',')(r.push(f),f='');else if(c==='\n')(r.push(f),R.push(r),r=[],f='');else if(c!=='\r')f+=c;}if(f||r.length){r.push(f);R.push(r);}return R;}
const rd=p=>{const R=parseCSV(readFileSync(p,'utf8'));const h=R[0];return R.slice(1).filter(x=>x.length===h.length).map(x=>Object.fromEntries(h.map((k,i)=>[k,x[i]])));};

// ── 1) ACT orbit people ─────────────────────────────────────────────────────
const orbit=rd(`${ACT}/thoughts/shared/unified-orbit-worklist.csv`).map(p=>{
  const bs=Number(p.beeper_score)||0;const[gi,go]=(p.gmail_in_out||'').split('/').map(Number);
  return {name:p.name,email:(p.email||'').toLowerCase().trim(),lane:p.status,warmth:bs+((gi&&go)?Math.min(gi,go)*2:0)};
}).filter(p=>p.name);
console.log(`ACT orbit: ${orbit.length} people`);

// ── 2) person_identity_map → email/name index ──────────────────────────────
console.log('Loading person_identity_map…');
const pim=await qAll(`SELECT person_id, lower(email) email, full_name, current_company, current_position, sector, indigenous_affiliation, government_influence, engagement_priority FROM person_identity_map`);
const byEmail=new Map(), byName=new Map();
for(const r of pim){if(r.email)byEmail.set(r.email,r);const n=norm(r.full_name);if(n&&!byName.has(n))byName.set(n,r);}
console.log(`  ${pim.length} identities (${byEmail.size} by email)`);

// ── 3) person → entities + roles ────────────────────────────────────────────
const pel=await qAll(`SELECT person_id, entity_id FROM person_entity_links`);
const entByPerson=new Map(); for(const r of pel){(entByPerson.get(r.person_id)||entByPerson.set(r.person_id,[]).get(r.person_id)).push(r.entity_id);}
const prh=await q(`SELECT person_id, role_title, role_type, body_name, organization_id, is_current FROM person_role_holdings LIMIT 1000`);
const rolesByPerson=new Map(); for(const r of prh){(rolesByPerson.get(r.person_id)||rolesByPerson.set(r.person_id,[]).get(r.person_id)).push(r);}

// ── 4) entity profiles (the nature of the soil) ─────────────────────────────
const allEnt=[...new Set(pel.map(r=>r.entity_id))];
const ent=new Map();
for(let i=0;i<allEnt.length;i+=400){const list=allEnt.slice(i,i+400).map(lit).join(',');
  for(const e of await q(`SELECT id, canonical_name, sector, abn, is_community_controlled, is_supply_nation_certified, round(latest_revenue) latest_revenue FROM gs_entities WHERE id IN (${list})`))ent.set(e.id,e);}

// ── 5) match each orbit person → their soil ─────────────────────────────────
const rows=[]; let matched=0, withEnt=0, withBoard=0;
const entityTouches=new Map(); // entity_id -> [orbit names] (for interlocks/warm paths)
for(const p of orbit){
  const id=(p.email&&byEmail.get(p.email))||byName.get(norm(p.name));
  if(!id)continue; matched++;
  const eids=entByPerson.get(id.person_id)||[];
  const profs=eids.map(e=>ent.get(e)).filter(Boolean);
  const roles=rolesByPerson.get(id.person_id)||[];
  if(profs.length)withEnt++; if(roles.length)withBoard++;
  for(const e of eids){if(!entityTouches.has(e))entityTouches.set(e,[]);entityTouches.get(e).push(p.name);}
  rows.push({
    name:p.name, email:p.email, lane:p.lane, warmth:Math.round(p.warmth),
    company:id.current_company||'', position:id.current_position||'', sector:id.sector||'',
    gov_influence:id.government_influence||'', indigenous:id.indigenous_affiliation||'',
    entities:profs.slice(0,6).map(e=>e.canonical_name+(e.is_community_controlled?' [CC]':'')+(e.is_supply_nation_certified?' [SN]':'')).join(' · '),
    n_entities:eids.length,
    boards:roles.map(r=>`${r.role_title||r.role_type}${r.body_name?' @ '+r.body_name:''}${r.is_current?'':' (past)'}`).join(' · '),
  });
}
rows.sort((a,b)=>b.warmth-a.warmth);

// ── 6) interlocks — entities multiple orbit people touch (the warm paths) ───
const interlocks=[...entityTouches.entries()].filter(([,ppl])=>new Set(ppl).size>=2)
  .map(([e,ppl])=>({entity:ent.get(e)?.canonical_name||e,n:new Set(ppl).size,people:[...new Set(ppl)],cc:ent.get(e)?.is_community_controlled}))
  .sort((a,b)=>b.n-a.n);

// ── write + summarise ───────────────────────────────────────────────────────
const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;
const cols=['name','email','lane','warmth','company','position','sector','gov_influence','indigenous','n_entities','entities','boards'];
writeFileSync(`${ACT}/thoughts/shared/orbit-soil.csv`,[cols.join(','),...rows.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n'));
const esc2=v=>`"${String(v??'').replace(/"/g,'""')}"`;
writeFileSync(`${ACT}/thoughts/shared/orbit-interlocks.csv`,['entity,orbit_people_connected,community_controlled,people',...interlocks.map(i=>[esc2(i.entity),i.n,i.cc?'yes':'',esc2(i.people.join('; '))].join(','))].join('\n'));

console.log(`\nSOIL — ${matched}/${orbit.length} orbit people resolved to a CivicGraph identity (${withEnt} have linked entities, ${withBoard} hold a board/role).`);
console.log(`→ thoughts/shared/orbit-soil.csv\n`);
console.log('Top warm people, with their soil:');
for(const r of rows.filter(r=>r.warmth>0&&(r.company||r.entities)).slice(0,12))
  console.log(`  ${String(r.warmth).padStart(3)} ${r.name} — ${r.position?r.position+', ':''}${r.company||r.entities||'(no org)'}${r.boards?' · BOARDS: '+r.boards:''}`);
console.log(`\nINTERLOCKS — ${interlocks.length} entities touched by ≥2 orbit people (warm paths). Top:`);
for(const i of interlocks.slice(0,12))console.log(`  ${String(i.n).padStart(2)} · ${i.entity}${i.cc?' [community-controlled]':''} ← ${i.people.slice(0,4).join(', ')}${i.people.length>4?'…':''}`);
console.log('→ thoughts/shared/orbit-interlocks.csv');
console.log('\nNOTE: soil = public institutional context (orgs/boards/ABN), not energy-scoring. Read-only.');
