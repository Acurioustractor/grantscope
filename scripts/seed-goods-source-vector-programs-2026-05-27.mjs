#!/usr/bin/env node
/**
 * Seed the Goods "source-vector" programs identified in the 2026-05-27 grants
 * sweep (§3/§4) — the capital / capability / procurement / grant opportunities
 * GrantScope's nightly crawlers don't cover.
 *
 * REVIEW-FIRST. Default is --dry-run (prints, writes nothing). Use --apply to write.
 *
 *   node --env-file=.env scripts/seed-goods-source-vector-programs-2026-05-27.mjs            # dry-run
 *   node --env-file=.env scripts/seed-goods-source-vector-programs-2026-05-27.mjs --apply
 *
 * Net-new rows are source='manual-research-2026-05-27' so the score-goods-relevance
 * manual-guard preserves their curated scores. discovery_method routes capital/
 * procurement rows through the scorer's +25 boost. After --apply, run the rescorer
 * so the enriched existing rows pick up new scores:
 *   node --env-file=.env scripts/score-goods-relevance.mjs --rescore-all
 *
 * NOTE: sweep amounts/dates are mostly "Inferred" — verify against the funder page
 * before relying on any value here.
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const MANUAL_SOURCE = 'manual-research-2026-05-27';
const TAGS = ['ACT-GD', 'goods'];

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// ── Net-new programs (INSERT/upsert on (source,name)) ───────────────────────
// score is curated per the sweep; >=50 rows get the ACT-GD/goods tags.
const NET_NEW = [
  {
    name: 'IBA Start-Up Finance Package', provider: 'Indigenous Business Australia',
    program: 'Start-Up Finance', discovery_method: 'indigenous-finance',
    amount_min: null, amount_max: 150000, status: 'open', closes_at: null,
    accepts_pty_ltd: true, accepts_charity: false, score: 82,
    url: 'https://iba.gov.au/business/business-finance/',
    description: 'Loan with up to 30% as a grant component to buy business assets (machinery, inventory) — buys beds/washers/plant. ≥50% Indigenous-owned, ABN, viable business. Year-round. CAPITAL, not a grant portal listing.',
  },
  {
    name: 'Supply Nation Certification + Buyer Access', provider: 'Supply Nation',
    program: 'Indigenous Business Certification', discovery_method: 'procurement',
    amount_min: null, amount_max: null, status: 'open', closes_at: null,
    accepts_pty_ltd: true, accepts_charity: false, score: 80,
    url: 'https://supplynation.org.au/',
    description: 'Certification + access to corporate/govt RAP buyers ($5.83B FY24-25 member spend). ≥50% Indigenous-owned/controlled. DEMAND SIDE — register to sell beds/washers; a purchase order beats a grant and repeats.',
  },
  {
    name: 'Aboriginals Benefit Account (ABA) Grants', provider: 'NIAA / Aboriginal Investment NT',
    program: 'Aboriginals Benefit Account', discovery_method: 'grant',
    amount_min: null, amount_max: null, status: 'open', closes_at: null,
    accepts_pty_ltd: true, accepts_charity: true, score: 75,
    url: 'https://aboriginalinvestment.org.au/grants',
    description: 'Beneficial projects for Aboriginal Territorians; multi-year, admin costs OK. Remote-NT — Goods’ core delivery geography. Year-round open funding.',
  },
  {
    name: 'NAIF Small Loans Program', provider: 'Northern Australia Infrastructure Facility',
    program: 'Small Loans', discovery_method: 'indigenous-finance',
    amount_min: null, amount_max: null, status: 'ongoing', closes_at: null,
    accepts_pty_ltd: true, accepts_charity: true, score: 62,
    url: 'https://naif.gov.au/',
    description: 'Concessional finance (loans/equity, not grants) for First Nations community projects in Northern Australia. Capital for scale infrastructure.',
  },
  {
    name: 'Many Rivers Microfinance', provider: 'Many Rivers',
    program: 'Microenterprise Loans + Coaching', discovery_method: 'indigenous-finance',
    amount_min: null, amount_max: null, status: 'ongoing', closes_at: null,
    accepts_pty_ltd: true, accepts_charity: true, score: 60,
    url: 'https://manyrivers.org.au/',
    description: 'Microenterprise loans + coaching for First Nations businesses. Early capital + capability.',
  },
  {
    name: 'Barayamal Accelerator', provider: 'Barayamal',
    program: 'Indigenous Startup Accelerator', discovery_method: 'grant',
    amount_min: null, amount_max: 10000, status: 'open', closes_at: null,
    accepts_pty_ltd: true, accepts_charity: false, score: 55,
    url: 'https://barayamal.com.au/',
    description: 'Indigenous startup accelerator — grants + coworking + mentoring for First Nations founders, early-stage. ~$10K/startup. Capability + small grant + network.',
  },
  {
    name: 'ILSC Future Industries Grant Program', provider: 'Indigenous Land and Sea Corporation (ILSC)',
    program: 'Future Industries', discovery_method: 'grant',
    amount_min: null, amount_max: null, status: 'open', closes_at: null,
    accepts_pty_ltd: true, accepts_charity: true, score: 55,
    url: 'https://www.ilsc.gov.au/grants/future-industries-grant-program/',
    description: 'Independent specialist advice on economic opportunities on Country for Indigenous Corporations. Feasibility/advice for scale-up.',
  },
  {
    name: 'FRRR / ANZ Seeds of Renewal', provider: 'FRRR + ANZ',
    program: 'Seeds of Renewal', discovery_method: 'grant',
    amount_min: null, amount_max: null, status: 'upcoming', closes_at: null,
    accepts_pty_ltd: false, accepts_charity: true, score: 45,
    url: 'https://frrr.org.au/funding/place/anz-seeds-of-renewal/',
    description: 'Rural community + economic projects. Annual round. Rural NFP/community (Goods may need an auspice).',
  },
  {
    name: 'Lowitja Institute Seeding / GLOWS', provider: 'Lowitja Institute',
    program: 'Aboriginal & TSI Community Grants', discovery_method: 'grant',
    amount_min: null, amount_max: null, status: 'open', closes_at: '2026-06-10',
    accepts_pty_ltd: false, accepts_charity: true, score: 40,
    url: 'https://lowitja.smartygrants.com.au/',
    description: 'Aboriginal & TSI community grant stream (research-leaning; community stream only if Goods has a health-evidence angle). GLOWS closes 10 Jun 2026.',
  },
  {
    name: 'Macquarie Group Foundation Grant', provider: 'Macquarie Group Foundation',
    program: 'Global Grant-Making', discovery_method: 'grant',
    amount_min: null, amount_max: null, status: 'pending', closes_at: null,
    accepts_pty_ltd: true, accepts_charity: true, score: 40,
    url: 'https://www.macquarie.com/au/en/about/community/macquarie-group-foundation.html',
    description: 'Work-integrated social enterprises; Indigenous economic development. Relationship-led / by nomination, not open application.',
  },
];

// ── Existing rows to ENRICH (UPDATE by id; score left to the rescorer) ──────
const ENRICH = [
  { id: 'b8a98813-1927-40a4-ad68-bad7d115b01d', label: 'ILSC Our Country Our Future (keep)',
    patch: { provider: 'Indigenous Land and Sea Corporation (ILSC)', discovery_method: 'grant',
      status: 'ongoing', accepts_pty_ltd: true, accepts_charity: true,
      description: 'Land/water ownership + enterprise on Country; partnership brokering + funding for Indigenous groups. On-Country enterprise infrastructure.' } },
  { id: 'a22e6b40-30c2-445e-916d-5e0b2902f5f6', label: 'Westpac Inclusive Employment Grant',
    patch: { provider: 'Westpac Foundation', discovery_method: 'grant', amount_max: 50000,
      status: 'upcoming', accepts_pty_ltd: false, accepts_charity: true,
      description: 'Jobs/training for people facing barriers; social enterprises eligible. $50K over 2 years. Goods = employment social enterprise. Round opens 2026 (date TBC).' } },
  { id: '8859f780-8fdd-49e7-8d31-7c1be4fa11f9', label: 'Westpac Social Change Fellowship',
    patch: { provider: 'Westpac Scholars Trust', discovery_method: 'grant', amount_max: 50000,
      status: 'open', closes_at: '2026-06-16', accepts_pty_ltd: true, accepts_charity: true,
      description: 'Development program for social entrepreneurs creating community change; Indigenous social enterprise founders eligible. Founder capability. 2027 round closes 16 Jun 2026.' } },
  { id: 'f270bdf5-77d7-4fdb-91d7-601f6bade95f', label: 'FRRR Strengthening Rural Communities (keep)',
    patch: { provider: 'Foundation for Rural & Regional Renewal (FRRR)', discovery_method: 'grant',
      amount_max: 50000, status: 'upcoming', closes_at: '2026-09-17', accepts_pty_ltd: false, accepts_charity: true,
      description: 'Remote/rural community projects; explicit First Nations + economic-participation priority; non-DGR eligible. Round 30 opens 25 Jun 2026, closes 17 Sep. Remote + First Nations priority.' } },
  { id: 'f8ddbf67-de8d-40cc-9098-54aa06ad2f9c', label: 'Telstra Connected Communities (mark closed)',
    patch: { provider: 'Telstra Foundation', discovery_method: 'grant', status: 'closed',
      description: 'Digital tech for remote communities; First Nations-led eligible. Annual; this cycle CLOSED 26 Mar 2026, next ~Feb 2027.' } },
];

// ── Duplicate rows to RETIRE (status='duplicate') ───────────────────────────
const DEDUP = [
  { id: 'db62e090-e391-44c6-9a7f-62b9e2491970', label: 'ILSC Our Country (ghl_sync dup of b8a98813)' },
  { id: 'e525f89b-38c3-452d-83ae-b1ef2f087c10', label: 'Social Change Fellowship (dup of Westpac 8859f780)' },
  { id: 'd4d6ce7d-ac6a-45de-ae03-c6e26d3a5be1', label: 'Strengthening Rural Communities (dup of SRC f270bdf5)' },
  { id: 'ec05578d-e09b-4216-86c9-d7990ae86e78', label: 'Connected Communities Grant (dup of Telstra f8ddbf67)' },
];

function fmtMoney(v) { return v == null ? '—' : `$${v.toLocaleString()}`; }

async function main() {
  console.log(`\n=== Seed Goods source-vector programs === ${APPLY ? 'APPLY (writing)' : 'DRY-RUN (no writes)'}\n`);

  console.log(`── NET-NEW (${NET_NEW.length}) → upsert on (source,name), source='${MANUAL_SOURCE}' ──`);
  for (const r of NET_NEW) {
    console.log(`  [${String(r.score).padStart(2)}] ${r.discovery_method.padEnd(18)} ${r.name}  (${fmtMoney(r.amount_max)}, ${r.status})`);
  }
  console.log(`\n── ENRICH existing (${ENRICH.length}) → UPDATE by id; score recomputed by rescorer ──`);
  for (const e of ENRICH) console.log(`  ${e.id.slice(0, 8)}  ${e.label}`);
  console.log(`\n── DEDUP (${DEDUP.length}) → status='duplicate' ──`);
  for (const d of DEDUP) console.log(`  ${d.id.slice(0, 8)}  ${d.label}`);

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to write, then rescore.');
    return;
  }

  let ins = 0, enr = 0, ded = 0;
  for (const r of NET_NEW) {
    const row = {
      name: r.name, provider: r.provider, program: r.program, source: MANUAL_SOURCE,
      discovery_method: r.discovery_method, amount_min: r.amount_min, amount_max: r.amount_max,
      status: r.status, closes_at: r.closes_at, deadline: r.closes_at,
      accepts_pty_ltd: r.accepts_pty_ltd, accepts_charity: r.accepts_charity,
      url: r.url, description: r.description,
      goods_relevance_score: r.score, goods_relevance_scored_at: new Date().toISOString(),
      aligned_projects: r.score >= 50 ? TAGS : [],
    };
    const { error } = await supabase.from('grant_opportunities').upsert(row, { onConflict: 'source,name' });
    if (error) console.error(`  upsert "${r.name}": ${error.message.slice(0, 100)}`); else ins++;
  }
  for (const e of ENRICH) {
    const { error } = await supabase.from('grant_opportunities').update({ ...e.patch, updated_at: new Date().toISOString() }).eq('id', e.id);
    if (error) console.error(`  enrich ${e.id.slice(0, 8)}: ${error.message.slice(0, 100)}`); else enr++;
  }
  for (const d of DEDUP) {
    const { error } = await supabase.from('grant_opportunities').update({ status: 'duplicate', goods_relevance_score: 0, aligned_projects: [], updated_at: new Date().toISOString() }).eq('id', d.id);
    if (error) console.error(`  dedup ${d.id.slice(0, 8)}: ${error.message.slice(0, 100)}`); else ded++;
  }
  console.log(`\n✓ upserted ${ins}/${NET_NEW.length} net-new · enriched ${enr}/${ENRICH.length} · retired ${ded}/${DEDUP.length} dups`);
  console.log('Next: node --env-file=.env scripts/score-goods-relevance.mjs --rescore-all');
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
