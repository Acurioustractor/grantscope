#!/usr/bin/env node
/**
 * Build Wiki Support Index
 *
 * Creates a small structured index from ACT/Goods source documents so the
 * GrantScope UI can surface procurement, foundation, grant, and capital routes
 * without asking the user to search through the wiki manually.
 *
 * Run:
 *   node scripts/build-wiki-support-index.mjs
 */

import { mkdir, readFile, stat, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '..');
const GOODS_ROOT = process.env.GOODS_REPO_PATH || '/Users/benknight/Code/Goods Asset Register';
const ACT_ROOT = process.env.ACT_INFRA_REPO_PATH || '/Users/benknight/Code/act-global-infrastructure';

const OUTPUTS = [
  path.join(REPO_ROOT, 'data/support-intelligence/wiki-support-index.json'),
  path.join(REPO_ROOT, 'apps/web/src/lib/generated/wiki-support-index.json'),
];

const SOURCE_FILES = {
  goodsReadme: path.join(GOODS_ROOT, 'README.md'),
  goodsCatalysingImpact: path.join(GOODS_ROOT, 'Catalysing_Impact_Application_DRAFT.md'),
  goodsGoToMarket: path.join(GOODS_ROOT, 'GO_TO_MARKET_THOUSANDS_2026.md'),
  goodsMarketIntel: path.join(GOODS_ROOT, 'MARKET_INTELLIGENCE_2026.md'),
  goodsSnowReview: path.join(GOODS_ROOT, 'SNOW_SUBMISSION_REVIEW_FEBRUARY_2026.md'),
  goodsAssetsCsv: path.join(GOODS_ROOT, 'data/expanded_assets_final.csv'),
  goodsQrManifest: path.join(GOODS_ROOT, 'data/qr_codes/qr_manifest.csv'),
  actOperationalThesis: path.join(ACT_ROOT, 'wiki/operations/act-operational-thesis.md'),
  actKnowledgeOps: path.join(ACT_ROOT, 'wiki/technical/act-knowledge-ops-loop.md'),
  actArchitecture: path.join(ACT_ROOT, 'wiki/technical/act-architecture.md'),
  actProjectCodes: path.join(ACT_ROOT, 'config/project-codes.json'),
  actActiveProjects: path.join(ACT_ROOT, 'config/active-projects.json'),
  actRepoConnections: path.join(ACT_ROOT, 'config/repo-connections-latest.json'),
  actDextRules: path.join(ACT_ROOT, 'config/dext-supplier-rules.json'),
};

const TEN_AREAS = [
  'Vision and ambition',
  'Social objective and impact',
  'Business model clarity',
  'Financial management and performance',
  'Strategic planning and risk',
  'Process and technology maturity',
  'Governance, data and reporting',
  'People and organisation',
  'Legal structure',
  'Investors and capital raising',
];

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

async function readText(filePath) {
  try {
    return await readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function readJson(filePath, fallback) {
  const text = await readText(filePath);
  if (!text) return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

async function inventoryEntry(label, filePath, role) {
  try {
    const meta = await stat(filePath);
    const text = await readText(filePath);
    return {
      label,
      role,
      path: filePath,
      exists: true,
      bytes: meta.size,
      lines: text ? text.split(/\r?\n/).length : 0,
      modified_at: meta.mtime.toISOString(),
    };
  } catch {
    return {
      label,
      role,
      path: filePath,
      exists: false,
      bytes: 0,
      lines: 0,
      modified_at: null,
    };
  }
}

async function readCsvRows(filePath) {
  const text = await readText(filePath);
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length <= 1) return [];
  const headers = parseCsvLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || '']));
  });
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = String(row[key] || '').trim();
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => ({ label, count }));
}

function unique(values) {
  return [...new Set(values.filter(Boolean).map((value) => String(value).trim()).filter(Boolean))];
}

function route(type, label, why, searchTerms, nextAction, sourceDocuments) {
  return {
    type,
    label,
    why,
    search_terms: unique(searchTerms),
    next_action: nextAction,
    source_documents: sourceDocuments,
  };
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function actionLabel(routeType) {
  if (routeType === 'procurement') return 'Map buyers and procurement notices';
  if (routeType === 'foundation') return 'Build funder relationship shortlist';
  if (routeType === 'grant') return 'Run GrantScope grant scan';
  if (routeType === 'capital') return 'Build capital stack scan';
  if (routeType === 'evidence') return 'Assemble application proof pack';
  return 'Set CRM and pipeline handoff';
}

function sourceQuerySuffix(routeType) {
  if (routeType === 'procurement') return 'procurement tender buyer Australia';
  if (routeType === 'foundation') return 'foundation grant program Australia';
  if (routeType === 'capital') return 'impact investment finance Australia';
  if (routeType === 'evidence') return 'evidence impact funding Australia';
  if (routeType === 'systems') return 'CRM grant pipeline automation';
  return 'grant funding Australia';
}

function buildSupportAction(project, routeItem, index) {
  const primaryTerm = routeItem.search_terms[0] || project.name;
  const query = routeItem.search_terms.slice(0, 3).join(' ');
  const discoverySuffix = sourceQuerySuffix(routeItem.type);

  return {
    id: `${project.slug}-${routeItem.type}-${slugify(routeItem.label)}`,
    project_slug: project.slug,
    project_name: project.name,
    project_code: project.code || null,
    route_type: routeItem.type,
    priority:
      project.slug === 'goods' && ['procurement', 'foundation', 'grant', 'capital'].includes(routeItem.type)
        ? 'high'
        : index < 2
          ? 'medium'
          : 'low',
    title: actionLabel(routeItem.type),
    summary: routeItem.label,
    next_step: routeItem.next_action,
    search_terms: routeItem.search_terms.slice(0, 8),
    grant_finder_href: `/grants?type=open_opportunity&sort=closing_asc&project=${encodeURIComponent(project.slug)}&quality=ready&q=${encodeURIComponent(query || primaryTerm)}`,
    source_discovery_queries: routeItem.search_terms
      .slice(0, 5)
      .map((term) => `${term} ${discoverySuffix}`),
    source_documents: routeItem.source_documents,
  };
}

function source(label, key) {
  return { label, path: SOURCE_FILES[key] };
}

function activeProjectThemes(activeProjects, slug) {
  const projects = Array.isArray(activeProjects?.projects) ? activeProjects.projects : [];
  const match = projects.find((project) => project.slug === slug);
  return Array.isArray(match?.themes) ? match.themes : [];
}

async function main() {
  const [
    assetRows,
    qrRows,
    activeProjects,
    repoConnections,
    projectCodes,
    sourceInventory,
  ] = await Promise.all([
    readCsvRows(SOURCE_FILES.goodsAssetsCsv),
    readCsvRows(SOURCE_FILES.goodsQrManifest),
    readJson(SOURCE_FILES.actActiveProjects, { projects: [] }),
    readJson(SOURCE_FILES.actRepoConnections, { repos: [] }),
    readJson(SOURCE_FILES.actProjectCodes, {}),
    Promise.all([
      inventoryEntry('Goods Asset Register README', SOURCE_FILES.goodsReadme, 'goods-evidence'),
      inventoryEntry('Catalysing Impact Application Draft', SOURCE_FILES.goodsCatalysingImpact, 'grant-application'),
      inventoryEntry('Goods Path to Thousands 2026', SOURCE_FILES.goodsGoToMarket, 'procurement-scale-plan'),
      inventoryEntry('Goods Market Intelligence 2026', SOURCE_FILES.goodsMarketIntel, 'market-research'),
      inventoryEntry('Snow Submission Review February 2026', SOURCE_FILES.goodsSnowReview, 'foundation-review'),
      inventoryEntry('Goods Expanded Asset CSV', SOURCE_FILES.goodsAssetsCsv, 'asset-evidence'),
      inventoryEntry('Goods QR Manifest', SOURCE_FILES.goodsQrManifest, 'asset-evidence'),
      inventoryEntry('ACT Operational Thesis', SOURCE_FILES.actOperationalThesis, 'operating-system'),
      inventoryEntry('ACT Knowledge Ops Loop', SOURCE_FILES.actKnowledgeOps, 'knowledge-system'),
      inventoryEntry('ACT Architecture', SOURCE_FILES.actArchitecture, 'technology-system'),
      inventoryEntry('ACT Project Codes', SOURCE_FILES.actProjectCodes, 'project-code-map'),
      inventoryEntry('ACT Active Projects', SOURCE_FILES.actActiveProjects, 'project-map'),
      inventoryEntry('ACT Repo Connections', SOURCE_FILES.actRepoConnections, 'repo-map'),
      inventoryEntry('ACT Dext Supplier Rules', SOURCE_FILES.actDextRules, 'finance-map'),
    ]),
  ]);

  const productCounts = countBy(assetRows, 'product');
  const communityCounts = countBy(assetRows, 'community');
  const goodsRepo = Array.isArray(repoConnections?.repos)
    ? repoConnections.repos.find((repo) => repo.name === 'Goods')
    : null;
  const grantscopeRepo = Array.isArray(repoConnections?.repos)
    ? repoConnections.repos.find((repo) => repo.name === 'GrantScope')
    : null;

  const goodsSources = [
    source('Goods Asset Register README', 'goodsReadme'),
    source('Catalysing Impact Application Draft', 'goodsCatalysingImpact'),
    source('Goods on Country Path to Thousands 2026', 'goodsGoToMarket'),
    source('Market Intelligence 2026', 'goodsMarketIntel'),
    source('Snow Submission Review February 2026', 'goodsSnowReview'),
    source('Goods Expanded Asset CSV', 'goodsAssetsCsv'),
    source('Goods QR Manifest', 'goodsQrManifest'),
    source('ACT Operational Thesis', 'actOperationalThesis'),
    source('ACT Knowledge Ops Loop', 'actKnowledgeOps'),
    source('ACT Repo Connections', 'actRepoConnections'),
    source('ACT Dext Supplier Rules', 'actDextRules'),
  ];

  const goodsRoutes = [
    route(
      'procurement',
      'Remote housing and essential-goods buyers',
      'Goods already has deployed assets, demand proof, QR support infrastructure, and a 2026 scale plan that names housing, hostels, retail, ACCHO, and community-housing routes.',
      [
        'remote housing fitout',
        'Aboriginal housing furniture',
        'durable beds remote communities',
        'washing machines remote communities',
        'NT Remote Housing Investment Package',
        'Aboriginal Hostels Limited',
        'ALPA Outback Stores',
        'NACCHO ACCHO infrastructure',
        'state Aboriginal housing',
        'NDIS SDA community housing fitout',
      ],
      'Create one procurement pack: unit costs, minimum order quantities, delivery model, warranty/support, impact proof, and buyer-specific ask.',
      [source('Goods Path to Thousands 2026', 'goodsGoToMarket'), source('Goods Expanded Asset CSV', 'goodsAssetsCsv')]
    ),
    route(
      'foundation',
      'Health, housing, First Nations, circular economy foundations',
      'The strongest foundation case is not generic product funding; it is the link between remote housing, dignity, laundry/health outcomes, circular materials, First Nations production, and community ownership.',
      [
        'First Nations enterprise grants',
        'remote housing philanthropy',
        'circular economy grants Australia',
        'social enterprise growth fund',
        'health equity foundations Australia',
        'Snow Foundation social impact loan',
        'VFFF social enterprise',
        'FRRR remote communities',
        'Catalysing Impact',
        'Giant Leap impact investment',
      ],
      'Build a foundation narrative pack with the Catalysing Impact draft, asset evidence, community demand, and a clear repayable/non-repayable funding split.',
      [source('Catalysing Impact Application Draft', 'goodsCatalysingImpact'), source('Snow Submission Review February 2026', 'goodsSnowReview')]
    ),
    route(
      'grant',
      'Open grants for products, capability, evidence, and regional delivery',
      'GrantScope should search beyond research grants: manufacturing capability, circular economy, Indigenous business, regional health, climate resilience, social enterprise, logistics, and community infrastructure.',
      [
        'Indigenous business growth grant',
        'social enterprise capability grant',
        'circular economy product grant',
        'regional health infrastructure grant',
        'remote community infrastructure grant',
        'climate resilience social enterprise grant',
        'manufacturing modernisation grant',
        'Indigenous procurement grant',
        'community laundry grant',
        'goods for remote communities funding',
      ],
      'Use the Goods feed first, then add missing sources to the public-source frontier when the match is real and public.',
      [source('Market Intelligence 2026', 'goodsMarketIntel'), source('ACT Operational Thesis', 'actOperationalThesis')]
    ),
    route(
      'capital',
      'Working capital and impact investment',
      'The current evidence supports a capital stack: pre-purchase contracts, repayable finance, R&D tax, catalytic grants, and a First Nations-owned operating pathway.',
      [
        'impact investment social enterprise Australia',
        'SEFA loan social enterprise',
        'IBA commercial finance',
        'First Nations business finance',
        'social impact loan Australia',
        'pre purchase contract foundation',
        'R&D tax incentive product development',
        'working capital social enterprise',
      ],
      'Turn the 2026 plan into a capital table: ask, source, repayment logic, evidence needed, and owner/date for each route.',
      [source('Goods Path to Thousands 2026', 'goodsGoToMarket'), source('ACT Dext Supplier Rules', 'actDextRules')]
    ),
    route(
      'evidence',
      'Application proof and impact measurement',
      'The strongest application material is already split across the asset register, QR manifest, community demand, Catalysing Impact draft, and ACT project-code evidence.',
      [
        'asset register evidence',
        'community demand evidence',
        'remote laundry health evidence',
        'scabies reduction community laundry',
        'rheumatic heart disease prevention laundry',
        'social return remote housing',
      ],
      'Create a repeatable evidence pack: facts, source document, proof status, and where it appears in applications.',
      [source('Goods Asset Register README', 'goodsReadme'), source('Goods QR Manifest', 'goodsQrManifest'), source('ACT Operational Thesis', 'actOperationalThesis')]
    ),
  ];

  const projects = [
    {
      slug: 'goods',
      aliases: ['goods-on-country', 'act-gd'],
      name: 'Goods on Country',
      code: 'ACT-GD',
      summary: 'Practical enterprise lane for remote-community essential goods, circular materials, asset tracking, procurement, grants, and impact investment.',
      themes: unique(['Product Design', 'Cultural Design', 'Sustainability', 'Resource Tracking', 'Community Assets', ...activeProjectThemes(activeProjects, 'goods')]),
      source_documents: goodsSources,
      evidence: [
        {
          label: 'Tracked deployment proof',
          value: '389 assets claimed in README',
          detail: `${assetRows.length} current CSV rows and ${qrRows.length} QR manifest rows were found locally; reconcile CSV growth against the 389-asset canonical claim before external use.`,
          source: 'Goods Asset Register',
        },
        {
          label: 'Product mix',
          value: productCounts.slice(0, 3).map((item) => `${item.count} ${item.label}`).join(', '),
          detail: 'Use product mix to prove real delivery and to forecast replacement, production, freight, and support needs.',
          source: 'expanded_assets_final.csv',
        },
        {
          label: 'Community footprint',
          value: `${communityCounts.length} communities in current CSV`,
          detail: communityCounts.slice(0, 6).map((item) => `${item.label} (${item.count})`).join(', '),
          source: 'expanded_assets_final.csv',
        },
        {
          label: 'Operating system',
          value: goodsRepo?.linkedProjects?.[0]?.productionUrl || 'Goods repo linked',
          detail: 'ACT repo map links Goods to ACT-GD and the Goods production URL.',
          source: 'repo-connections-latest.json',
        },
      ],
      routes: goodsRoutes,
      readiness_gaps: [
        'Reconcile the canonical asset count against the latest expanded CSV before sending external claims.',
        'Confirm the preferred legal/entity pathway for IPP and Supply Nation positioning.',
        'Create a buyer-ready unit economics sheet for beds, washing machines, freight, warranty, and support.',
        'Separate grants, procurement revenue, pre-purchase contracts, loans, and R&D tax in the capital stack.',
        'Turn community demand and health evidence into reusable application language.',
      ],
      search_terms: unique(goodsRoutes.flatMap((item) => item.search_terms)),
    },
    {
      slug: 'civicgraph',
      aliases: ['grantscope', 'act-cg'],
      name: 'CivicGraph / GrantScope',
      code: 'ACT-CG',
      summary: 'Infrastructure lane for funding intelligence, source discovery, public data, grant/foundation matching, and relationship evidence.',
      themes: ['Funding transparency', 'Public-source intelligence', 'Data infrastructure', 'CRM/pipeline alignment'],
      source_documents: [
        source('ACT Operational Thesis', 'actOperationalThesis'),
        source('ACT Architecture', 'actArchitecture'),
        source('ACT Repo Connections', 'actRepoConnections'),
      ],
      evidence: [
        {
          label: 'Repo linked',
          value: grantscopeRepo?.originSlug || 'GrantScope repo mapped',
          detail: 'GrantScope is the support layer for finding, scoring, tracking, and sending opportunities into CRM/pipeline workflows.',
          source: 'repo-connections-latest.json',
        },
      ],
      routes: [
        route(
          'grant',
          'Public-source grant discovery',
          'Use GrantScope to search public grant sources and convert strong matches into tracked pipeline, not to make users search from scratch.',
          ['public grant finder', 'foundation program Australia', 'council grant finder', 'corporate giving Australia', 'philanthropy program Australia'],
          'Keep expanding the public source frontier and classify sources by state, source family, project fit, and readiness.',
          [source('ACT Architecture', 'actArchitecture')]
        ),
        route(
          'systems',
          'GHL and pipeline handoff',
          'The value is in moving real opportunities into contacts, tasks, and follow-up, not just listing grants.',
          ['GHL grant pipeline', 'grant CRM automation', 'foundation relationship management'],
          'Use scored matches to create tasks, contact records, and follow-up notes for the right ACT project lane.',
          [source('ACT Operational Thesis', 'actOperationalThesis')]
        ),
      ],
      readiness_gaps: ['Make source quality visible so users know what is ready, stale, local, national, or needs verification.'],
      search_terms: ['public grant finder', 'foundation program Australia', 'council grant finder', 'corporate giving Australia'],
    },
    {
      slug: 'justicehub',
      aliases: ['act-jh'],
      name: 'JusticeHub',
      code: 'ACT-JH',
      summary: 'Justice-system change lane for evidence, youth justice, diversion, reintegration, community support, and policy/practice alignment.',
      themes: unique(['Systems Change', 'Community Support', ...activeProjectThemes(activeProjects, 'justicehub')]),
      source_documents: [
        source('ACT Operational Thesis', 'actOperationalThesis'),
        source('ACT Active Projects', 'actActiveProjects'),
      ],
      evidence: [],
      routes: [
        route(
          'grant',
          'Youth justice and reintegration grants',
          'The strongest search terms should cover justice reform, diversion, community-led support, family support, and evidence translation.',
          ['youth justice grant', 'diversion program funding', 'justice reintegration funding', 'community legal education grant', 'family violence justice support'],
          'Use ALMA/evidence context to distinguish research, implementation, service delivery, and advocacy opportunities.',
          [source('ACT Active Projects', 'actActiveProjects')]
        ),
        route(
          'foundation',
          'Systems-change foundations',
          'JusticeHub needs relationship-led foundation work around justice reform, young people, families, First Nations justice, and systems accountability.',
          ['justice reform foundation Australia', 'youth justice philanthropy', 'First Nations justice funding', 'systems change grant'],
          'Create a foundation shortlist with fit, relationship path, proof, and a specific ask per funder.',
          [source('ACT Operational Thesis', 'actOperationalThesis')]
        ),
      ],
      readiness_gaps: ['Separate service delivery, advocacy, evidence platform, and policy reform asks before matching funders.'],
      search_terms: ['youth justice grant', 'justice reform foundation Australia', 'diversion program funding'],
    },
    {
      slug: 'empathy-ledger',
      aliases: ['act-el'],
      name: 'Empathy Ledger',
      code: 'ACT-EL',
      summary: 'Community voice, Indigenous data sovereignty, consent, storytelling, and accountable evidence infrastructure.',
      themes: unique(['Indigenous Data Sovereignty', 'Community Voice', ...activeProjectThemes(activeProjects, 'empathy-ledger')]),
      source_documents: [source('ACT Active Projects', 'actActiveProjects'), source('ACT Architecture', 'actArchitecture')],
      evidence: [],
      routes: [
        route(
          'grant',
          'Data sovereignty and community evidence grants',
          'Search should include community data governance, ethical AI, storytelling infrastructure, consent, and impact measurement.',
          ['Indigenous data sovereignty grant', 'community voice platform funding', 'ethical AI grant Australia', 'impact measurement grant'],
          'Package Empathy Ledger as the evidence/voice infrastructure that strengthens ACT project applications.',
          [source('ACT Active Projects', 'actActiveProjects')]
        ),
      ],
      readiness_gaps: ['Clarify when Empathy Ledger is a standalone product, a partner service, or an embedded evidence layer for another project.'],
      search_terms: ['Indigenous data sovereignty grant', 'community voice platform funding', 'ethical AI grant Australia'],
    },
    {
      slug: 'picc',
      aliases: ['palm-island-community-company'],
      name: 'PICC and Palm Island support',
      code: null,
      summary: 'Place-based Aboriginal community-controlled support lane for Palm Island relationships, programs, governance, and funding context.',
      themes: activeProjectThemes(activeProjects, 'picc'),
      source_documents: [source('ACT Active Projects', 'actActiveProjects'), source('ACT Operational Thesis', 'actOperationalThesis')],
      evidence: [],
      routes: [
        route(
          'grant',
          'Place-based ACCO support grants',
          'Match against Palm Island, ACCO, community control, family support, youth, housing, health, and regional development language.',
          ['Palm Island grant', 'ACCO funding Queensland', 'Aboriginal community controlled organisation grant', 'place based funding Queensland'],
          'Keep PICC as a relationship/context lane unless there is a direct project ask and permission to proceed.',
          [source('ACT Active Projects', 'actActiveProjects')]
        ),
      ],
      readiness_gaps: ['Separate ACT-owned opportunities from partner-led opportunities and record relationship consent clearly.'],
      search_terms: ['Palm Island grant', 'ACCO funding Queensland', 'place based funding Queensland'],
    },
    {
      slug: 'the-harvest',
      aliases: ['harvest', 'green-harvest-witta'],
      name: 'The Harvest / Green Harvest Witta',
      code: 'ACT-HV',
      summary: 'Regenerative agriculture, place, learning, therapeutic landscapes, and community infrastructure lane.',
      themes: unique(['Regenerative Agriculture', 'Therapeutic Landscapes', 'Community Innovation', ...activeProjectThemes(activeProjects, 'green-harvest-witta')]),
      source_documents: [source('ACT Active Projects', 'actActiveProjects'), source('ACT Repo Connections', 'actRepoConnections')],
      evidence: [],
      routes: [
        route(
          'grant',
          'Regenerative place and community infrastructure grants',
          'Search should cover land stewardship, community education, social prescribing, circular economy, events infrastructure, and regional resilience.',
          ['regenerative agriculture grant', 'social prescribing nature grant', 'community garden infrastructure grant', 'regional resilience grant Queensland'],
          'Define whether the ask is land/infrastructure, program delivery, education, health, or creative/community activation before matching.',
          [source('ACT Active Projects', 'actActiveProjects')]
        ),
      ],
      readiness_gaps: ['Separate lease/infrastructure risk from program funding and earned-revenue planning.'],
      search_terms: ['regenerative agriculture grant', 'community garden infrastructure grant', 'regional resilience grant Queensland'],
    },
  ];

  const projectsWithActions = projects.map((project) => ({
    ...project,
    support_actions: project.routes.map((routeItem, index) => buildSupportAction(project, routeItem, index)),
  }));
  const supportActions = projectsWithActions.flatMap((project) => project.support_actions);
  const routeCounts = projectsWithActions
    .flatMap((project) => project.routes)
    .reduce((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {});

  const index = {
    generated_at: new Date().toISOString(),
    generated_by: 'scripts/build-wiki-support-index.mjs',
    source_roots: {
      grantscope: REPO_ROOT,
      goods: GOODS_ROOT,
      act_global_infrastructure: ACT_ROOT,
    },
    summary: {
      project_count: projectsWithActions.length,
      route_count: projectsWithActions.reduce((sum, project) => sum + project.routes.length, 0),
      support_action_count: supportActions.length,
      source_document_count: sourceInventory.filter((item) => item.exists).length,
      route_counts: routeCounts,
      primary_use:
        'Use this index to turn ACT/Goods wiki context into GrantScope search terms, source expansion, project pipeline actions, and application evidence packs.',
    },
    ten_area_framework: TEN_AREAS,
    cross_project_terms: unique([
      'social enterprise',
      'First Nations enterprise',
      'community-controlled',
      'place-based funding',
      'impact investment',
      'procurement pathway',
      'foundation relationship',
      'evidence pack',
      'regional resilience',
      'circular economy',
      'Indigenous data sovereignty',
      'systems change',
      'remote communities',
      'community infrastructure',
    ]),
    project_code_map: projectCodes,
    source_inventory: sourceInventory,
    support_actions: supportActions,
    projects: projectsWithActions,
  };

  for (const output of OUTPUTS) {
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(index, null, 2)}\n`);
  }

  console.log(`Wiki support index built: ${projects.length} projects, ${index.summary.route_count} routes`);
  for (const output of OUTPUTS) {
    console.log(`  ${path.relative(REPO_ROOT, output)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
