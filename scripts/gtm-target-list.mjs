#!/usr/bin/env node
/**
 * GTM Phase 1: Generate target list for DD pack outreach.
 *
 * For each target foundation, identifies a compelling grantee entity
 * and generates a DD pack URL they can demo.
 *
 * Usage:
 *   node --env-file=.env scripts/gtm-target-list.mjs
 */

// ── Target Foundations ──────────────────────────────────────────────
// Selected for: youth justice / child protection focus, QLD/NSW geography,
// significant giving capacity, likely to convert at Funder tier ($499/mo)
const TARGETS = [
  {
    foundation: 'Paul Ramsay Foundation',
    abn: '32623132472',
    giving: '$320M/yr',
    focus: 'Justice reinvestment, youth, systems change',
    geo: 'National',
    why: 'Largest justice-focused funder in Australia. Their whole thesis is data-driven justice reinvestment.',
    grantee: { name: 'Ted Noffs Foundation', gsId: 'AU-ABN-49018049971', why: '16 ALMA interventions, $27.8M justice funding — perfect proof-of-concept for cross-system intelligence' },
  },
  {
    foundation: 'Australian Communities Foundation',
    abn: '57967620066',
    giving: '$39.6M/yr',
    focus: 'Community, justice, social enterprise, indigenous',
    geo: 'National',
    why: 'Community foundation with justice focus. Sub-funds would each benefit from entity intelligence.',
    grantee: { name: 'Mission Australia', gsId: 'AU-ABN-15000002522', why: '66 govt contracts + 4 ALMA interventions + $118M justice funding — shows cross-system overlap' },
  },
  {
    foundation: 'Gandel Foundation',
    abn: '51393866453',
    giving: '$12M/yr',
    focus: 'Youth, community, indigenous',
    geo: 'National (VIC-based)',
    why: 'Major family foundation with youth focus. Board papers need due diligence briefs.',
    grantee: { name: 'Act For Kids', gsId: 'AU-ABN-98142986767', why: '$253M justice funding, child protection specialist — compelling DD pack for child-focused funder' },
  },
  {
    foundation: 'The Smith Family',
    abn: '28000030179',
    giving: '$37.8M/yr',
    focus: 'Education, youth, employment',
    geo: 'National',
    why: 'Major youth-focused charity that also funds partners. Would benefit from ecosystem visibility.',
    grantee: { name: 'Queensland Youth Services', gsId: 'AU-ABN-33186707759', why: '3 ALMA interventions, $19.5M justice funding, QLD youth specialist' },
  },
  {
    foundation: 'Barnardos Australia',
    abn: '18068557906',
    giving: '$60.2M/yr',
    focus: 'Youth, community, education',
    geo: 'National',
    why: 'Major child welfare org. Could use CivicGraph to map ecosystem of partners and co-funders.',
    grantee: { name: 'Palm Island Community Company', gsId: 'AU-ABN-14640793728', why: '7 ALMA interventions, 6 govt contracts, $38.7M justice funding — Indigenous community org, compelling story' },
  },
  {
    foundation: 'Vincent Fairfax Family Foundation',
    abn: '64127467210',
    giving: '$15M/yr',
    focus: 'Social justice, youth, leadership, education',
    geo: 'National (NSW-based)',
    why: 'Family foundation with social justice focus. Long-term funder, values evidence-based giving.',
    grantee: { name: 'The Benevolent Society', gsId: 'AU-ABN-95084695045', why: '35 govt contracts, $53.5M justice funding — oldest charity in Australia, impressive cross-system profile' },
  },
  {
    foundation: 'Dusseldorp Forum',
    abn: '25269392713',
    giving: '$1.5M/yr',
    focus: 'Youth transitions, education, employment',
    geo: 'National',
    why: 'Boutique foundation focused on youth transitions. Data-driven approach to giving.',
    grantee: { name: 'South Burnett CTC', gsId: 'AU-ABN-85399349965', why: '3 ALMA interventions, $74.5M justice funding, rural QLD — shows place-based impact' },
  },
  {
    foundation: 'Minderoo Foundation',
    abn: '24819440618',
    giving: '$268M/yr',
    focus: 'Indigenous, early childhood, employment',
    geo: 'National + WA',
    why: 'Second largest foundation in Australia. Data-driven, would value procurement intelligence.',
    grantee: { name: 'UnitingCare Community', gsId: 'AU-ABN-28728322186', why: '4 ALMA interventions, 6 contracts, $511M justice funding — massive cross-system footprint' },
  },
  {
    foundation: 'Beyond Blue',
    abn: '87093865840',
    giving: '$35.3M/yr',
    focus: 'Mental health, youth, community',
    geo: 'National',
    why: 'Major mental health funder. Youth mental health is their core concern.',
    grantee: { name: 'Anglicare Central Queensland', gsId: 'AU-ABN-76088159335', why: '2 ALMA interventions, 11 contracts, $95.7M justice funding — regional service provider' },
  },
  {
    foundation: 'Macquarie Group Foundation',
    abn: null,
    giving: '$37.5M/yr',
    focus: 'Community, youth, employment',
    geo: 'National',
    why: 'Corporate foundation with structured giving. Board wants data-backed decisions.',
    grantee: { name: 'Anglicare North Queensland', gsId: 'AU-ABN-86094640552', why: '$80.7M justice funding, 1 ALMA intervention — shows geographic concentration' },
  },
];

// ── Output ──────────────────────────────────────────────────────────
const BASE_URL = 'https://civicgraph.app';

console.log('╔══════════════════════════════════════════════════════════════════╗');
console.log('║  CivicGraph GTM Phase 1 — Foundation Outreach Target List      ║');
console.log('║  Strategy: Send unsolicited DD pack → offer Funder tier trial  ║');
console.log('╚══════════════════════════════════════════════════════════════════╝\n');

for (let i = 0; i < TARGETS.length; i++) {
  const t = TARGETS[i];
  const ddUrl = `${BASE_URL}/entities/${t.grantee.gsId}/due-diligence`;
  const entityUrl = `${BASE_URL}/entities/${t.grantee.gsId}`;

  console.log(`── ${i + 1}. ${t.foundation} ──────────────────────────`);
  console.log(`   Giving: ${t.giving} | Focus: ${t.focus}`);
  console.log(`   Geo: ${t.geo}`);
  console.log(`   Why target: ${t.why}`);
  console.log(`   `);
  console.log(`   GRANTEE FOR DD PACK:`);
  console.log(`   → ${t.grantee.name}`);
  console.log(`   → ${t.grantee.why}`);
  console.log(`   → Entity: ${entityUrl}`);
  console.log(`   → DD Pack: ${ddUrl}`);
  console.log(`   `);
  console.log(`   EMAIL TEMPLATE:`);
  console.log(`   Subject: "${t.grantee.name} — funding intelligence brief"`);
  console.log(`   Body: "Hi [Name], We built a due diligence brief on ${t.grantee.name}`);
  console.log(`   using CivicGraph's cross-system intelligence. It maps their government`);
  console.log(`   contracts, justice funding, evidence-based programs, and relationships`);
  console.log(`   in one view. Thought your team at ${t.foundation} might find it useful.`);
  console.log(`   [Link to DD pack]. Want to see your whole portfolio mapped like this?`);
  console.log(`   Happy to set up a 30-day trial of our Funder tier ($499/mo)."`);
  console.log('');
}

console.log('═══════════════════════════════════════════════════════════════════');
console.log(`Total targets: ${TARGETS.length}`);
console.log(`Revenue potential: ${TARGETS.length} × $499/mo = $${(TARGETS.length * 499).toLocaleString()}/mo ($${(TARGETS.length * 499 * 12).toLocaleString()}/yr)`);
console.log(`DD Pack URLs ready for all ${TARGETS.length} grantees`);
console.log('═══════════════════════════════════════════════════════════════════');
