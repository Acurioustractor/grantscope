import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'API Developer Portal | CivicGraph',
  description: 'Programmatic access to Australia\'s most comprehensive cross-system civic intelligence dataset. 333K+ entities, 1M+ relationships, 770K+ contracts across 8 data systems.',
  openGraph: {
    title: 'CivicGraph API',
    description: 'Programmatic access to Australia\'s most comprehensive cross-system civic intelligence dataset.',
    type: 'website',
    siteName: 'CivicGraph',
  },
};

/* ─── Section IDs for sidebar nav ─────────────────────────── */
const sections = [
  { id: 'overview', label: 'Overview' },
  { id: 'quickstart', label: 'Quick Start' },
  { id: 'authentication', label: 'Authentication' },
  { id: 'endpoints', label: 'Endpoints' },
  { id: 'entities', label: 'Entities', indent: true },
  { id: 'relationships', label: 'Relationships', indent: true },
  { id: 'grants', label: 'Grants & Foundations', indent: true },
  { id: 'reports', label: 'Reports & Analysis', indent: true },
  { id: 'graph', label: 'Graph', indent: true },
  { id: 'export', label: 'Export', indent: true },
  { id: 'health', label: 'Health', indent: true },
  { id: 'rate-limits', label: 'Rate Limits' },
  { id: 'sdks', label: 'SDKs & Examples' },
  { id: 'data-dictionary', label: 'Data Dictionary' },
  { id: 'terms', label: 'Terms of Use' },
];

/* ─── Code Block Component ────────────────────────────────── */
function Code({ children, lang = 'bash' }: { children: string; lang?: string }) {
  return (
    <div className="relative group">
      <div className="absolute top-2 right-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
        {lang}
      </div>
      <pre className="bg-gray-900 text-green-400 p-4 text-sm font-mono overflow-x-auto border-2 border-bauhaus-black leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function JsonCode({ children }: { children: string }) {
  return (
    <pre className="bg-gray-900 text-amber-300 p-4 text-sm font-mono overflow-x-auto border-2 border-bauhaus-black leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}

/* ─── Endpoint Card ───────────────────────────────────────── */
function Endpoint({
  method,
  path,
  description,
  params,
  response,
  auth,
}: {
  method: string;
  path: string;
  description: string;
  params?: { name: string; type: string; desc: string }[];
  response?: string;
  auth?: string;
}) {
  const methodColor = method === 'GET'
    ? 'bg-green-600'
    : method === 'POST'
      ? 'bg-blue-600'
      : method === 'DELETE'
        ? 'bg-red-600'
        : 'bg-amber-600';

  return (
    <div className="border-2 border-bauhaus-black bg-white mb-4">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-bauhaus-black/10 bg-gray-50">
        <span className={`${methodColor} text-white text-xs font-black px-2 py-0.5 tracking-wider`}>
          {method}
        </span>
        <code className="text-sm font-mono font-bold text-bauhaus-black">{path}</code>
        {auth && (
          <span className="ml-auto text-[10px] font-bold text-bauhaus-red uppercase tracking-widest">
            {auth}
          </span>
        )}
      </div>
      <div className="px-4 py-3">
        <p className="text-sm text-bauhaus-muted mb-3">{description}</p>
        {params && params.length > 0 && (
          <div className="mb-3">
            <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">Parameters</div>
            <table className="w-full text-sm">
              <tbody>
                {params.map((p) => (
                  <tr key={p.name} className="border-t border-gray-100">
                    <td className="py-1.5 pr-3 font-mono text-xs font-bold text-bauhaus-blue whitespace-nowrap">{p.name}</td>
                    <td className="py-1.5 pr-3 text-xs text-bauhaus-muted font-bold">{p.type}</td>
                    <td className="py-1.5 text-xs text-bauhaus-muted">{p.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {response && <JsonCode>{response}</JsonCode>}
      </div>
    </div>
  );
}

/* ─── Page ────────────────────────────────────────────────── */
export default function DevelopersPage() {
  return (
    <div className="flex gap-0 max-w-7xl mx-auto -mt-4">
      {/* Sidebar nav */}
      <aside className="hidden lg:block w-56 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto pr-6">
        <nav className="py-4">
          <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-[0.3em] mb-3">
            API Reference
          </div>
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className={`block py-1.5 text-sm font-medium transition-colors hover:text-bauhaus-red ${
                s.indent ? 'pl-4 text-bauhaus-muted text-xs' : 'text-bauhaus-black font-bold'
              }`}
            >
              {s.label}
            </a>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Hero */}
        <section id="overview" className="mb-12 pt-4">
          <div className="text-xs font-black text-bauhaus-red uppercase tracking-widest mb-2">Developer Portal</div>
          <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
            CivicGraph API
          </h1>
          <p className="text-bauhaus-muted text-base sm:text-lg max-w-3xl leading-relaxed font-medium">
            Programmatic access to Australia&apos;s most comprehensive cross-system civic intelligence dataset.
            Query entities, relationships, grants, contracts, political donations, and evidence programs
            through a simple REST API.
          </p>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 mt-6">
            {[
              { label: 'Entities', value: '159K+', color: 'bg-bauhaus-black text-white' },
              { label: 'Relationships', value: '1M+', color: 'bg-bauhaus-red text-white' },
              { label: 'Contracts', value: '770K+', color: 'bg-white text-bauhaus-black' },
              { label: 'Data Systems', value: '7', color: 'bg-bauhaus-blue text-white' },
            ].map((stat) => (
              <div key={stat.label} className={`border-4 border-bauhaus-black p-4 ${stat.color} ${stat.color.includes('white text-bauhaus') ? '' : ''}`}
                   style={stat.label === 'Contracts' ? {} : {}}>
                <div className="text-2xl sm:text-3xl font-black">{stat.value}</div>
                <div className={`text-xs font-black uppercase tracking-widest mt-1 ${
                  stat.color.includes('text-white') ? 'opacity-60' : 'text-bauhaus-muted'
                }`}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Quick Start */}
        <section id="quickstart" className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-4 uppercase tracking-widest">Quick Start</h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-2xl">
            The CivicGraph API is a read-only REST API. Most endpoints are publicly accessible.
            Authenticated endpoints (export, API key management) require a Bearer token.
          </p>

          <div className="mb-4">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
              1. Look up an entity by ABN
            </div>
            <Code>{`curl "https://civicgraph.au/api/data?type=entities&abn=12345678901"`}</Code>
          </div>

          <div className="mb-4">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
              2. Search entities by name
            </div>
            <Code>{`curl "https://civicgraph.au/api/data?type=entities&q=salvation%20army&limit=10"`}</Code>
          </div>

          <div className="mb-4">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
              3. Get open grant opportunities
            </div>
            <Code>{`curl "https://civicgraph.au/api/data?type=grants&min_amount=10000&limit=20"`}</Code>
          </div>

          <div className="mb-4">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
              4. Check the cross-system power index
            </div>
            <Code>{`curl "https://civicgraph.au/api/data/power-index?min_systems=4&state=NSW&limit=20"`}</Code>
          </div>

          <div className="border-2 border-bauhaus-black p-4 bg-bauhaus-canvas text-sm text-bauhaus-muted">
            <strong className="text-bauhaus-black">Base URL:</strong>{' '}
            <code className="font-mono text-bauhaus-blue">https://civicgraph.au/api</code>
            <br />
            <strong className="text-bauhaus-black">Format:</strong> All responses are JSON. Export endpoints support CSV.
            <br />
            <strong className="text-bauhaus-black">Pagination:</strong> Use <code className="font-mono">limit</code> and <code className="font-mono">offset</code> parameters. Max 500 per request.
          </div>
        </section>

        {/* Authentication */}
        <section id="authentication" className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-4 uppercase tracking-widest">Authentication</h2>
          <p className="text-sm text-bauhaus-muted mb-4 max-w-2xl">
            Most read endpoints are publicly accessible without authentication. For higher rate limits,
            data export, and key management, authenticate with an API key.
          </p>

          <div className="border-4 border-bauhaus-black p-6 bg-white mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">Public Access</div>
                <ul className="text-sm text-bauhaus-muted space-y-1 list-disc list-inside">
                  <li>No API key required</li>
                  <li>60 requests/minute per IP</li>
                  <li>All read endpoints: entities, relationships, grants, foundations</li>
                  <li>Health and reports endpoints</li>
                </ul>
              </div>
              <div>
                <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">Authenticated Access</div>
                <ul className="text-sm text-bauhaus-muted space-y-1 list-disc list-inside">
                  <li>API key via Bearer token</li>
                  <li>1,000 requests/hour (configurable)</li>
                  <li>Data export in CSV/JSON</li>
                  <li>Key management API</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
            Using your API key
          </div>
          <Code>{`curl -H "Authorization: Bearer cg_your_api_key_here" \\
  "https://civicgraph.au/api/data/export?type=foundations&format=csv"`}</Code>

          <div className="mt-4">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">
              Generate an API key (requires account)
            </div>
            <Code>{`curl -X POST "https://civicgraph.au/api/keys" \\
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My App", "permissions": ["read"]}'`}</Code>
            <JsonCode>{`{
  "id": "uuid",
  "key_prefix": "cg_a1b2c3d4",
  "key": "cg_a1b2c3d4e5f6...full_key_shown_once",
  "name": "My App",
  "enabled": true,
  "rate_limit_per_hour": 1000,
  "created_at": "2026-03-20T00:00:00Z"
}`}</JsonCode>
            <p className="text-xs text-bauhaus-red font-bold mt-2">
              The full API key is only shown once at creation. Store it securely.
            </p>
          </div>
        </section>

        {/* ═══════════ ENDPOINTS ═══════════ */}
        <section id="endpoints" className="mb-8">
          <h2 className="text-xl font-black text-bauhaus-black mb-2 uppercase tracking-widest">Endpoints</h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            All data endpoints use the unified <code className="font-mono">/api/data</code> route with a <code className="font-mono">type</code> parameter,
            plus dedicated routes for specialized queries.
          </p>
        </section>

        {/* Entities */}
        <section id="entities" className="mb-10">
          <h3 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest border-b-4 border-bauhaus-black pb-2">
            Entities
          </h3>
          <Endpoint
            method="GET"
            path="/api/data?type=entities"
            description="Search and filter the national entity graph. 159K+ entities including charities, companies, government bodies, foundations, and community-controlled organisations."
            params={[
              { name: 'q', type: 'string', desc: 'Search by entity name (case-insensitive partial match)' },
              { name: 'abn', type: 'string', desc: 'Exact ABN lookup' },
              { name: 'entity_type', type: 'string', desc: 'Filter by type: charity, company, foundation, government, etc.' },
              { name: 'state', type: 'string', desc: 'Australian state: NSW, VIC, QLD, WA, SA, TAS, NT, ACT' },
              { name: 'postcode', type: 'string', desc: 'Filter by postcode' },
              { name: 'community_controlled', type: 'boolean', desc: 'Only community-controlled organisations (true)' },
              { name: 'limit', type: 'integer', desc: 'Max results (default 100, max 500)' },
              { name: 'offset', type: 'integer', desc: 'Pagination offset' },
            ]}
            response={`{
  "type": "entities",
  "data": [
    {
      "gs_id": "GS-00001",
      "canonical_name": "The Salvation Army",
      "abn": "85007834963",
      "entity_type": "charity",
      "sector": "welfare",
      "state": "VIC",
      "postcode": "3101",
      "remoteness": "Major Cities of Australia",
      "seifa_irsd_decile": 9,
      "lga_name": "Boroondara",
      "is_community_controlled": false,
      "website": "https://salvationarmy.org.au",
      "description": "..."
    }
  ],
  "limit": 100,
  "offset": 0
}`}
          />
        </section>

        {/* Relationships */}
        <section id="relationships" className="mb-10">
          <h3 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest border-b-4 border-bauhaus-black pb-2">
            Relationships
          </h3>
          <Endpoint
            method="GET"
            path="/api/data?type=relationships"
            description="Query the cross-system relationship graph. 1M+ edges linking entities through contracts, grants, donations, and funding flows."
            params={[
              { name: 'relationship_type', type: 'string', desc: 'Filter by type: contracted_with, donated_to, funded_by, etc.' },
              { name: 'dataset', type: 'string', desc: 'Source dataset: austender, political_donations, justice_funding, etc.' },
              { name: 'min_amount', type: 'integer', desc: 'Minimum dollar amount' },
              { name: 'year', type: 'integer', desc: 'Filter by year' },
              { name: 'limit', type: 'integer', desc: 'Max results (default 100, max 500)' },
              { name: 'offset', type: 'integer', desc: 'Pagination offset' },
            ]}
            response={`{
  "type": "relationships",
  "data": [
    {
      "id": "uuid",
      "source_entity_id": "uuid",
      "target_entity_id": "uuid",
      "relationship_type": "contracted_with",
      "amount": 15000000,
      "year": 2024,
      "dataset": "austender"
    }
  ],
  "limit": 100,
  "offset": 0
}`}
          />
        </section>

        {/* Grants & Foundations */}
        <section id="grants" className="mb-10">
          <h3 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest border-b-4 border-bauhaus-black pb-2">
            Grants & Foundations
          </h3>
          <Endpoint
            method="GET"
            path="/api/data?type=grants"
            description="Search live and historical grant opportunities. 18K+ grants from government and philanthropic sources."
            params={[
              { name: 'min_amount', type: 'integer', desc: 'Minimum grant amount (filters on amount_max)' },
              { name: 'max_amount', type: 'integer', desc: 'Maximum grant amount' },
              { name: 'category', type: 'string', desc: 'Filter by category (array contains match)' },
              { name: 'limit', type: 'integer', desc: 'Max results (default 100, max 500)' },
              { name: 'offset', type: 'integer', desc: 'Pagination offset' },
            ]}
            response={`{
  "type": "grants",
  "data": [
    {
      "id": "uuid",
      "name": "Community Development Grant",
      "provider": "Dept of Social Services",
      "program": "Stronger Communities",
      "amount_min": 5000,
      "amount_max": 50000,
      "closes_at": "2026-06-30T00:00:00Z",
      "url": "https://...",
      "categories": ["community", "indigenous"],
      "geography": "National"
    }
  ]
}`}
          />

          <Endpoint
            method="GET"
            path="/api/data?type=foundations"
            description="Search 10.8K+ grant-making foundations. Filter by thematic focus and geographic coverage."
            params={[
              { name: 'focus', type: 'string', desc: 'Thematic focus filter: indigenous, education, health, environment, etc.' },
              { name: 'state', type: 'string', desc: 'Geographic focus filter (by AU state code)' },
              { name: 'limit', type: 'integer', desc: 'Max results (default 100, max 500)' },
              { name: 'offset', type: 'integer', desc: 'Pagination offset' },
            ]}
            response={`{
  "type": "foundations",
  "data": [
    {
      "id": "uuid",
      "name": "Ian Potter Foundation",
      "type": "private_ancillary_fund",
      "website": "https://ianpotter.org.au",
      "total_giving_annual": 35000000,
      "thematic_focus": ["arts", "education", "environment", "health"],
      "geographic_focus": ["AU-VIC", "AU-NSW"],
      "profile_confidence": 0.9
    }
  ]
}`}
          />

          <Endpoint
            method="GET"
            path="/api/data?type=social-enterprises"
            description="Search social enterprises including B Corps, Supply Nation, and indigenous enterprises."
            params={[
              { name: 'source', type: 'string', desc: 'Source registry: supply_nation, bcorp, etc.' },
              { name: 'state', type: 'string', desc: 'Filter by state' },
              { name: 'indigenous', type: 'boolean', desc: 'Only indigenous enterprises (true)' },
              { name: 'q', type: 'string', desc: 'Search by name' },
              { name: 'limit', type: 'integer', desc: 'Max results (default 100, max 500)' },
            ]}
          />
        </section>

        {/* Reports & Analysis */}
        <section id="reports" className="mb-10">
          <h3 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest border-b-4 border-bauhaus-black pb-2">
            Reports & Analysis
          </h3>

          <Endpoint
            method="GET"
            path="/api/data/power-index"
            description="Cross-system power concentration index. 82K+ entities scored across 7 Australian government datasets."
            params={[
              { name: 'view', type: 'string', desc: 'View mode: entities (default), deserts, or summary' },
              { name: 'min_systems', type: 'integer', desc: 'Minimum system count (default 2)' },
              { name: 'state', type: 'string', desc: 'Filter by state' },
              { name: 'type', type: 'string', desc: 'Filter by entity type' },
              { name: 'community', type: 'boolean', desc: 'Only community-controlled (true)' },
              { name: 'sort', type: 'string', desc: 'Sort by: power_score, system_count, total_dollar_flow, procurement_dollars' },
              { name: 'limit', type: 'integer', desc: 'Max results (default 100, max 1000)' },
            ]}
            response={`{
  "entities": [
    {
      "gs_id": "GS-00001",
      "canonical_name": "Serco Group",
      "entity_type": "company",
      "system_count": 5,
      "power_score": 47,
      "in_procurement": true,
      "in_political_donations": true,
      "procurement_dollars": 4200000000,
      "total_dollar_flow": 4500000000
    }
  ],
  "meta": { "count": 100, "filters": { ... } }
}`}
          />

          <Endpoint
            method="GET"
            path="/api/data/power-index?view=deserts"
            description="Funding deserts: LGAs with high disadvantage and low funding. Desert score combines SEIFA IRSD, remoteness, entity coverage, and funding gaps."
            params={[
              { name: 'state', type: 'string', desc: 'Filter by state' },
              { name: 'min_desert', type: 'integer', desc: 'Minimum desert score (default 0)' },
              { name: 'limit', type: 'integer', desc: 'Max results (default 50, max 500)' },
            ]}
          />

          <Endpoint
            method="GET"
            path="/api/data/power-index?view=summary"
            description="Aggregate power statistics by entity type, remoteness category, and community-controlled status."
          />

          <Endpoint
            method="GET"
            path="/api/data/funding-deserts"
            description="Detailed funding desert analysis. Returns worst deserts, best-funded LGAs, breakdowns by remoteness and state."
            response={`{
  "worst30": [ ... ],
  "best10": [ ... ],
  "byRemoteness": [
    {
      "remoteness": "Very Remote Australia",
      "lga_count": 84,
      "avg_desert_score": 142.3,
      "avg_funding": 521000
    }
  ],
  "byState": [ ... ],
  "summary": { "total_lgas": 492, "severe_deserts": 156 }
}`}
          />

          <Endpoint
            method="GET"
            path="/api/data/who-runs-australia"
            description="Cross-system influence network: revolving door entities, board interlocks, and political crossover data."
            response={`{
  "revolving_door": [ ... ],
  "board_interlocks": [ ... ],
  "political_crossover": [ ... ],
  "stats": {
    "revolving_door_total": 4700,
    "three_vector_plus": 240,
    "multi_board_people": 1200,
    "board_donors": 85
  }
}`}
          />

          <Endpoint
            method="GET"
            path="/api/data/data-health"
            description="Comprehensive data health metrics: entity coverage, linkage rates, relationship network quality, and agent pipeline status."
          />
        </section>

        {/* Graph */}
        <section id="graph" className="mb-10">
          <h3 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest border-b-4 border-bauhaus-black pb-2">
            Graph
          </h3>
          <Endpoint
            method="GET"
            path="/api/data/graph"
            description="Force-directed graph data. Returns nodes and edges for visualization. Supports hub, justice, power, and interlock modes."
            params={[
              { name: 'mode', type: 'string', desc: 'Graph mode: hubs, justice, power, interlocks' },
              { name: 'entity_type', type: 'string', desc: 'Hub mode: entity type (foundation, charity, company)' },
              { name: 'topic', type: 'string', desc: 'Justice mode: topic filter (youth-justice, child-protection, indigenous, diversion)' },
              { name: 'min_systems', type: 'integer', desc: 'Power mode: minimum systems (default 3)' },
              { name: 'min_boards', type: 'integer', desc: 'Interlocks mode: minimum board seats (default 2)' },
              { name: 'state', type: 'string', desc: 'Filter by state' },
              { name: 'min_amount', type: 'integer', desc: 'Minimum edge amount' },
              { name: 'hubs', type: 'integer', desc: 'Number of top hubs (default 30, max 100)' },
              { name: 'limit', type: 'integer', desc: 'Max nodes (default 5000, max 60000)' },
            ]}
            response={`{
  "nodes": [
    {
      "id": "uuid",
      "label": "Entity Name",
      "type": "charity",
      "state": "NSW",
      "degree": 15,
      "community_controlled": true
    }
  ],
  "edges": [
    {
      "source": "uuid",
      "target": "uuid",
      "type": "funded_by",
      "amount": 500000,
      "dataset": "justice_funding"
    }
  ],
  "meta": { "total_nodes": 811, "total_edges": 1596 }
}`}
          />
        </section>

        {/* Export */}
        <section id="export" className="mb-10">
          <h3 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest border-b-4 border-bauhaus-black pb-2">
            Export
          </h3>
          <Endpoint
            method="GET"
            path="/api/data/export"
            description="Bulk data export in CSV or JSON format. Requires authentication with 'research' module access."
            auth="Requires Auth"
            params={[
              { name: 'type', type: 'string', desc: 'Data type: entities, relationships, foundations, grants, social-enterprises, money-flows, community-orgs, government-programs' },
              { name: 'format', type: 'string', desc: 'Output format: csv or json (default csv)' },
              { name: 'domain', type: 'string', desc: 'Domain filter (for money-flows, government-programs, community-orgs)' },
              { name: 'jurisdiction', type: 'string', desc: 'Jurisdiction filter (for government-programs)' },
              { name: 'limit', type: 'integer', desc: 'Max rows (default 5000, max 10000)' },
            ]}
          />
        </section>

        {/* Health */}
        <section id="health" className="mb-10">
          <h3 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest border-b-4 border-bauhaus-black pb-2">
            Health
          </h3>
          <Endpoint
            method="GET"
            path="/api/data/health"
            description="Platform health and statistics. No authentication required. Returns comprehensive stats about data coverage, freshness, quality, and recent agent pipeline runs."
            response={`{
  "platform": {
    "name": "CivicGraph",
    "total_records": 1890000,
    "dataset_count": 17,
    "agents": 48
  },
  "entities": { "total": 333000, "by_type": [...] },
  "relationships": { "total": 1000000 },
  "grants": { "total": 18000, "open": 3200 },
  "foundations": { "total": 10800, "programs": 2400 },
  "money_flows": {
    "contracts": { "records": 772000, "total_value": 853000000000 },
    "political_donations": { "records": 312000 },
    "justice_funding": { "records": 71000 }
  },
  "datasets": [
    { "name": "Entity Graph", "table": "gs_entities", "records": 333000, "status": "fresh" }
  ],
  "recent_agent_runs": [...]
}`}
          />
        </section>

        {/* API Key Management */}
        <section className="mb-10">
          <h3 className="text-lg font-black text-bauhaus-black mb-4 uppercase tracking-widest border-b-4 border-bauhaus-black pb-2">
            API Key Management
          </h3>
          <Endpoint
            method="GET"
            path="/api/keys"
            description="List all API keys for the authenticated user. Returns key metadata (prefix, name, permissions, rate limits, usage) but never the full key."
            auth="Requires Auth"
            response={`{
  "keys": [
    {
      "id": "uuid",
      "key_prefix": "cg_a1b2c3d4",
      "name": "Production App",
      "permissions": ["read"],
      "rate_limit_per_hour": 1000,
      "enabled": true,
      "last_used_at": "2026-03-19T12:00:00Z",
      "expires_at": null,
      "created_at": "2026-01-15T00:00:00Z"
    }
  ]
}`}
          />
          <Endpoint
            method="POST"
            path="/api/keys"
            description="Generate a new API key. The full key is returned only once in the response -- store it securely."
            auth="Requires Auth"
            params={[
              { name: 'name', type: 'string (required)', desc: 'Human-readable key name' },
              { name: 'permissions', type: 'string[]', desc: 'Permission scopes (default: ["read"])' },
              { name: 'rate_limit_per_hour', type: 'integer', desc: 'Requests per hour (default: 1000)' },
            ]}
          />
          <Endpoint
            method="PATCH"
            path="/api/keys/[keyId]"
            description="Update an API key's name or enabled status."
            auth="Requires Auth"
            params={[
              { name: 'name', type: 'string', desc: 'New key name' },
              { name: 'enabled', type: 'boolean', desc: 'Enable or disable the key' },
            ]}
          />
          <Endpoint
            method="DELETE"
            path="/api/keys/[keyId]"
            description="Permanently revoke an API key. This action cannot be undone."
            auth="Requires Auth"
          />
        </section>

        {/* Rate Limits */}
        <section id="rate-limits" className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-4 uppercase tracking-widest">Rate Limits</h2>
          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Tier</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Rate</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Daily Limit</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Features</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-gray-100">
                  <td className="p-3 font-bold">Public (no key)</td>
                  <td className="p-3 text-right font-mono">60 req/min</td>
                  <td className="p-3 text-right font-mono">1,000/day</td>
                  <td className="p-3 text-bauhaus-muted">Read-only data access</td>
                </tr>
                <tr className="border-t border-gray-100 bg-gray-50">
                  <td className="p-3 font-bold">Authenticated</td>
                  <td className="p-3 text-right font-mono">1,000 req/hr</td>
                  <td className="p-3 text-right font-mono">10,000/day</td>
                  <td className="p-3 text-bauhaus-muted">Read + Export (CSV/JSON)</td>
                </tr>
                <tr className="border-t border-gray-100">
                  <td className="p-3 font-bold text-bauhaus-blue">Enterprise</td>
                  <td className="p-3 text-right font-mono">Custom</td>
                  <td className="p-3 text-right font-mono">Custom</td>
                  <td className="p-3 text-bauhaus-muted">Dedicated support, custom integrations</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 border-2 border-bauhaus-black p-4 bg-bauhaus-canvas text-sm text-bauhaus-muted">
            <strong className="text-bauhaus-black">Rate limit headers:</strong> All responses include{' '}
            <code className="font-mono">X-RateLimit-Limit</code> and <code className="font-mono">X-RateLimit-Window</code> headers.
            When rate limited, you will receive a <code className="font-mono">429 Too Many Requests</code> response.
            <br />
            <strong className="text-bauhaus-black">Caching:</strong> Public endpoints are cached for 5 minutes (<code className="font-mono">s-maxage=300</code>)
            with 10-minute stale-while-revalidate.
          </div>
        </section>

        {/* SDKs & Examples */}
        <section id="sdks" className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-4 uppercase tracking-widest">SDKs & Examples</h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            No official SDK is required -- the API is a standard REST API that works with any HTTP client.
            Here are examples in common languages.
          </p>

          <div className="space-y-6">
            <div>
              <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">curl</div>
              <Code>{`# Search entities
curl "https://civicgraph.au/api/data?type=entities&q=indigenous&state=QLD&limit=20"

# Get power index for NSW
curl "https://civicgraph.au/api/data/power-index?state=NSW&min_systems=3"

# Export foundations as CSV (authenticated)
curl -H "Authorization: Bearer cg_your_key" \\
  "https://civicgraph.au/api/data/export?type=foundations&format=csv" \\
  -o foundations.csv`}</Code>
            </div>

            <div>
              <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">JavaScript / TypeScript</div>
              <Code lang="javascript">{`const API_BASE = "https://civicgraph.au/api";

// Search entities
const res = await fetch(
  \`\${API_BASE}/data?type=entities&q=salvation+army&limit=10\`
);
const { data: entities } = await res.json();

// Get power index with authentication
const powerRes = await fetch(
  \`\${API_BASE}/data/power-index?min_systems=4\`,
  { headers: { Authorization: "Bearer cg_your_key" } }
);
const { entities: powerEntities } = await powerRes.json();

// Check platform health
const healthRes = await fetch(\`\${API_BASE}/data/health\`);
const health = await healthRes.json();
console.log(\`\${health.platform.total_records} records across \${health.platform.dataset_count} datasets\`);`}</Code>
            </div>

            <div>
              <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">Python</div>
              <Code lang="python">{`import requests

API_BASE = "https://civicgraph.au/api"

# Search entities
resp = requests.get(f"{API_BASE}/data", params={
    "type": "entities",
    "q": "indigenous",
    "state": "QLD",
    "community_controlled": "true",
    "limit": 50,
})
entities = resp.json()["data"]

# Get funding deserts
deserts = requests.get(f"{API_BASE}/data/funding-deserts").json()
for d in deserts["worst30"][:5]:
    print(f"{d['lga_name']} ({d['state']}): desert_score={d['desert_score']}")

# Export as CSV (authenticated)
headers = {"Authorization": "Bearer cg_your_key"}
csv_resp = requests.get(
    f"{API_BASE}/data/export",
    params={"type": "foundations", "format": "csv"},
    headers=headers,
)
with open("foundations.csv", "w") as f:
    f.write(csv_resp.text)`}</Code>
            </div>
          </div>
        </section>

        {/* Data Dictionary */}
        <section id="data-dictionary" className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-4 uppercase tracking-widest">Data Dictionary</h2>
          <p className="text-sm text-bauhaus-muted mb-6 max-w-2xl">
            CivicGraph aggregates data from 7 Australian public datasets, cross-referenced by ABN.
            Data is updated daily via an automated agent pipeline (48 agents across 9 categories).
          </p>

          <div className="border-4 border-bauhaus-black bg-white overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bauhaus-black text-white">
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Dataset</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs">Table</th>
                  <th className="text-right p-3 font-black uppercase tracking-widest text-xs">Records</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Key Columns</th>
                  <th className="text-left p-3 font-black uppercase tracking-widest text-xs hidden md:table-cell">Freshness</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { dataset: 'Entity Graph', table: 'gs_entities', records: '159K', cols: 'gs_id, canonical_name, abn, entity_type, state, remoteness, is_community_controlled', freshness: 'Daily' },
                  { dataset: 'Relationships', table: 'gs_relationships', records: '1M+', cols: 'source_entity_id, target_entity_id, relationship_type, amount, year, dataset', freshness: 'Daily' },
                  { dataset: 'AusTender Contracts', table: 'austender_contracts', records: '772K', cols: 'title, contract_value, buyer_name, supplier_name, supplier_abn', freshness: 'Daily' },
                  { dataset: 'ACNC Charities', table: 'acnc_charities', records: '66K', cols: 'abn, name, charity_size, state, purposes, beneficiaries', freshness: 'Weekly' },
                  { dataset: 'Political Donations', table: 'political_donations', records: '312K', cols: 'donor_name, donor_abn, donation_to, amount, financial_year', freshness: 'Quarterly' },
                  { dataset: 'Justice Funding', table: 'justice_funding', records: '71K', cols: 'recipient_name, recipient_abn, program_name, amount_dollars, state', freshness: 'Daily' },
                  { dataset: 'ATO Tax Transparency', table: 'ato_tax_transparency', records: '24K', cols: 'entity_name, abn, total_income, taxable_income, tax_payable', freshness: 'Annual' },
                  { dataset: 'Foundations', table: 'foundations', records: '10.8K', cols: 'name, acnc_abn, total_giving_annual, thematic_focus, geographic_focus', freshness: 'Weekly' },
                  { dataset: 'Grant Opportunities', table: 'grant_opportunities', records: '18K', cols: 'name, amount_min, amount_max, deadline, categories, focus_areas', freshness: 'Daily' },
                  { dataset: 'Social Enterprises', table: 'social_enterprises', records: '2K+', cols: 'name, abn, source_primary, sector, state, is_indigenous', freshness: 'Weekly' },
                  { dataset: 'ALMA Interventions', table: 'alma_interventions', records: '1.2K', cols: 'name, type, evidence_level, target_cohort, geography', freshness: 'Weekly' },
                ].map((row, i) => (
                  <tr key={row.table} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="p-3 font-bold text-bauhaus-black">{row.dataset}</td>
                    <td className="p-3 font-mono text-xs text-bauhaus-blue">{row.table}</td>
                    <td className="p-3 text-right font-mono font-bold">{row.records}</td>
                    <td className="p-3 text-xs text-bauhaus-muted font-mono hidden md:table-cell">{row.cols}</td>
                    <td className="p-3 text-xs hidden md:table-cell">
                      <span className={`font-bold ${
                        row.freshness === 'Daily' ? 'text-green-600' :
                        row.freshness === 'Weekly' ? 'text-blue-600' :
                        row.freshness === 'Quarterly' ? 'text-amber-600' :
                        'text-gray-500'
                      }`}>
                        {row.freshness}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4">
            <h4 className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-2">Materialized Views (Pre-computed Analytics)</h4>
            <div className="border-2 border-bauhaus-black bg-white overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    { view: 'mv_entity_power_index', desc: 'Cross-system power scores for 82K+ entities', records: '82K' },
                    { view: 'mv_funding_deserts', desc: 'LGA-level disadvantage vs funding desert scores', records: '1.6K' },
                    { view: 'mv_revolving_door', desc: 'Entities with 2+ influence vectors', records: '4.7K' },
                    { view: 'mv_board_interlocks', desc: 'Shared board members between organisations', records: '1.2K' },
                    { view: 'mv_gs_donor_contractors', desc: 'Entities that both donate politically and hold contracts', records: '500+' },
                    { view: 'mv_gs_entity_stats', desc: 'Entity-level rollup statistics', records: '159K' },
                  ].map((row, i) => (
                    <tr key={row.view} className={`border-t border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="p-2 font-mono text-xs text-bauhaus-blue font-bold">{row.view}</td>
                      <td className="p-2 text-xs text-bauhaus-muted">{row.desc}</td>
                      <td className="p-2 text-right font-mono text-xs font-bold">{row.records}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Terms */}
        <section id="terms" className="mb-12">
          <h2 className="text-xl font-black text-bauhaus-black mb-4 uppercase tracking-widest">Terms of Use</h2>
          <div className="border-4 border-bauhaus-black p-6 bg-white space-y-4 text-sm text-bauhaus-muted leading-relaxed max-w-3xl">
            <div>
              <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-1">Attribution</div>
              <p>
                When using CivicGraph data in publications, research, or applications, please credit:
                <br />
                <code className="font-mono text-bauhaus-blue text-xs">Source: CivicGraph (civicgraph.au)</code>
              </p>
            </div>
            <div>
              <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-1">Data Sources</div>
              <p>
                CivicGraph aggregates publicly available Australian government data: AusTender, AEC political donations,
                ACNC charity registry, ATO tax transparency, state justice funding data, and community-sourced evidence databases.
                All source data is public record.
              </p>
            </div>
            <div>
              <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-1">Acceptable Use</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Research, journalism, and public interest investigation</li>
                <li>Non-profit sector analysis and grant-seeking</li>
                <li>Government transparency and accountability projects</li>
                <li>Academic research with appropriate citation</li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-1">Prohibited Use</div>
              <ul className="list-disc list-inside space-y-1">
                <li>Reselling raw data without transformation or added value</li>
                <li>Automated scraping that exceeds rate limits</li>
                <li>Misrepresenting CivicGraph data or analysis</li>
              </ul>
            </div>
            <div>
              <div className="text-xs font-black text-bauhaus-black uppercase tracking-widest mb-1">Contact</div>
              <p>
                For enterprise access, custom integrations, or research partnerships:{' '}
                <a href="mailto:hello@civicgraph.au" className="text-bauhaus-blue font-bold hover:text-bauhaus-red">
                  hello@civicgraph.au
                </a>
              </p>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="mb-8">
          <div className="border-4 border-bauhaus-red p-8 bg-bauhaus-red/5 text-center">
            <h2 className="text-lg font-black text-bauhaus-black mb-2">Ready to Build?</h2>
            <p className="text-sm text-bauhaus-muted mb-4 max-w-xl mx-auto">
              Start making API requests now -- no key required for read access.
              Create an account for higher rate limits and data export capabilities.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <a
                href="/api/data/health"
                className="inline-block px-8 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
              >
                Try the Health Endpoint
              </a>
              <a
                href="/api/data?type=entities&q=salvation+army&limit=5"
                className="inline-block px-8 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors"
              >
                Try Entity Search
              </a>
              <a
                href="/login"
                className="inline-block px-8 py-3 bg-white text-bauhaus-black border-2 border-bauhaus-black font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black hover:text-white transition-colors"
              >
                Create Account
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
