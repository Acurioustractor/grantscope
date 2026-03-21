import { Metadata } from 'next';
import { AgentPlayground } from './playground';
import { ApiKeyManager } from './api-keys';

export const metadata: Metadata = {
  title: 'Agent API — CivicGraph',
  description: 'Structured intelligence on Australian government spending for AI agents. 560K entities, 1.5M relationships, 770K contracts.',
};

const ACTIONS = [
  {
    name: 'search',
    label: 'Entity Search',
    description: 'Find entities by name or ABN. Returns power scores, cross-system presence, and dollar flows.',
    example: { action: 'search', query: 'Commonwealth Bank' },
    returns: 'Array of entities with gs_id, canonical_name, entity_type, power_score, system_count, total_dollar_flow',
  },
  {
    name: 'entity',
    label: 'Entity Profile',
    description: 'Full entity intelligence — power score, 7-system presence, board members, procurement history, political donations, justice funding.',
    example: { action: 'entity', abn: '48123123124' },
    returns: 'Entity profile + board member list with roles and appointment dates',
  },
  {
    name: 'power_index',
    label: 'Power Index',
    description: 'Top entities ranked by cross-system power score. Spans procurement, justice, donations, charity, foundation, evidence, and tax systems.',
    example: { action: 'power_index', limit: 10, min_systems: 3 },
    returns: 'Ranked entities with power_score, system_count, and dollar breakdowns per system',
  },
  {
    name: 'funding_deserts',
    label: 'Funding Deserts',
    description: 'Most underserved local government areas in Australia. Scored by disadvantage (SEIFA), remoteness, and funding shortfall.',
    example: { action: 'funding_deserts', state: 'NT', limit: 10 },
    returns: 'LGAs ranked by desert_score with IRSD decile, entity counts, and dollar flows',
  },
  {
    name: 'revolving_door',
    label: 'Revolving Door',
    description: 'Entities with multiple influence vectors — lobbying, political donations, and government contracts. Cross-referenced automatically.',
    example: { action: 'revolving_door', limit: 10 },
    returns: 'Entities with revolving_door_score, influence vectors, donation and contract totals',
  },
  {
    name: 'ask',
    label: 'Natural Language Query',
    description: 'Ask any question in plain English. CivicGraph generates SQL, executes it across all datasets, and returns structured results with an AI explanation.',
    example: { action: 'ask', query: 'How much does QLD spend on youth justice?' },
    returns: 'Query results as structured data + AI explanation + generated SQL',
  },
];

const DATA_SOURCES = [
  { name: 'AusTender', desc: '770K federal contracts', color: 'bg-bauhaus-blue' },
  { name: 'AEC Donations', desc: '312K political donations', color: 'bg-bauhaus-red' },
  { name: 'ACNC', desc: '66K charities', color: 'bg-bauhaus-black' },
  { name: 'ATO', desc: '24K tax records', color: 'bg-bauhaus-yellow' },
  { name: 'Justice Funding', desc: '71K grants', color: 'bg-bauhaus-red' },
  { name: 'ALMA', desc: '1.2K evidence interventions', color: 'bg-bauhaus-blue' },
  { name: 'ABR', desc: '18.5M business registrations', color: 'bg-bauhaus-black' },
  { name: 'ORIC', desc: 'Indigenous corporations', color: 'bg-bauhaus-red' },
  { name: 'Foundations', desc: '10.8K giving foundations', color: 'bg-bauhaus-blue' },
  { name: 'Lobbying Register', desc: '560 firms, 1.7K clients', color: 'bg-bauhaus-black' },
  { name: 'Person Roles', desc: '340K board seats', color: 'bg-bauhaus-yellow' },
];

export default function AgentPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-12">
        <div className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-3">Agent Commerce</div>
        <h1 className="text-4xl sm:text-5xl font-black text-bauhaus-black mb-4 tracking-tight leading-[0.9]">
          CivicGraph<br />Agent API
        </h1>
        <p className="text-lg text-bauhaus-muted max-w-2xl font-medium leading-relaxed">
          Structured intelligence on Australian government spending, procurement, political donations,
          and community organisations. Built for AI agents that need real data, not hallucinated answers.
        </p>
      </div>

      {/* Stats bar */}
      <div className="border-4 border-bauhaus-black mb-12">
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x-4 divide-bauhaus-black">
          {[
            { value: '560K+', label: 'Entities' },
            { value: '1.5M+', label: 'Relationships' },
            { value: '770K+', label: 'Contracts' },
            { value: '$74B+', label: 'Tracked' },
          ].map((s, i) => (
            <div key={s.label} className={`p-4 text-center ${i >= 2 ? 'border-t-4 border-bauhaus-black sm:border-t-0' : ''}`}>
              <div className="text-2xl sm:text-3xl font-black text-bauhaus-black tabular-nums">{s.value}</div>
              <div className="text-[10px] font-black text-bauhaus-muted uppercase tracking-widest mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick start */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-4">Quick Start</h2>
        <div className="border-4 border-bauhaus-black bg-bauhaus-canvas p-4 sm:p-6">
          <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-3">Single endpoint. POST JSON. Get intelligence.</div>
          <pre className="text-sm font-mono text-bauhaus-black overflow-x-auto whitespace-pre">{`POST /api/agent
Content-Type: application/json
Authorization: Bearer cg_live_...

{
  "action": "search",
  "query": "Commonwealth Bank"
}`}</pre>
          <div className="mt-4 text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-2">Or discover capabilities:</div>
          <pre className="text-sm font-mono text-bauhaus-black">{`GET /api/agent`}</pre>
          <div className="mt-3 text-xs text-bauhaus-muted font-medium">
            API key optional during beta. Anonymous: 20 req/min. With key: 60+ req/min.
          </div>
        </div>
      </section>

      {/* API Keys */}
      <ApiKeyManager />

      {/* Live Playground */}
      <AgentPlayground />

      {/* Actions */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-6">Available Actions</h2>
        <div className="space-y-4">
          {ACTIONS.map(a => (
            <div key={a.name} className="border-4 border-bauhaus-black">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 gap-1 bg-bauhaus-black text-white">
                <h3 className="font-black text-sm uppercase tracking-widest">{a.label}</h3>
                <code className="text-[11px] font-mono text-bauhaus-yellow">{`"action": "${a.name}"`}</code>
              </div>
              <div className="p-4">
                <p className="text-sm text-bauhaus-muted font-medium mb-3">{a.description}</p>
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Example Request</div>
                <pre className="text-xs font-mono text-bauhaus-black bg-bauhaus-canvas p-3 mb-3 overflow-x-auto">
                  {JSON.stringify(a.example, null, 2)}
                </pre>
                <div className="text-xs font-black text-bauhaus-muted uppercase tracking-widest mb-1">Returns</div>
                <p className="text-xs text-bauhaus-muted font-medium">{a.returns}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Use cases */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-6">Agent Use Cases</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            {
              title: 'Procurement Agent',
              desc: 'Evaluate Australian suppliers before bid decisions. Check cross-system presence, contract history, political donation patterns, and compliance signals.',
              color: 'hover:bg-bauhaus-blue hover:text-white',
            },
            {
              title: 'Policy Research Agent',
              desc: 'Analyse funding flows, identify service gaps, compare state spending on youth justice, disability, and Indigenous services.',
              color: 'hover:bg-bauhaus-red hover:text-white',
            },
            {
              title: 'Due Diligence Agent',
              desc: 'Entity profile, board interlock detection, revolving door analysis. Automated background checks on government contractors.',
              color: 'hover:bg-bauhaus-black hover:text-white',
            },
            {
              title: 'Compliance Agent',
              desc: 'Monitor entity changes, new contracts, board appointments. Detect conflicts of interest and emerging interlock patterns.',
              color: 'hover:bg-bauhaus-yellow',
            },
          ].map(uc => (
            <div key={uc.title} className={`border-4 border-bauhaus-black p-5 transition-colors ${uc.color}`}>
              <h3 className="font-black text-sm mb-2">{uc.title}</h3>
              <p className="text-xs font-medium leading-relaxed opacity-80">{uc.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Data sources */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-4">Data Sources</h2>
        <div className="border-4 border-bauhaus-black p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {DATA_SOURCES.map(ds => (
              <div key={ds.name} className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 shrink-0 ${ds.color} border border-bauhaus-black`} />
                <span className="text-xs font-black text-bauhaus-black uppercase tracking-widest">{ds.name}</span>
                <span className="text-[10px] text-bauhaus-muted font-medium whitespace-nowrap">{ds.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="mb-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-4">Pricing</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border-4 border-bauhaus-black p-6">
            <div className="text-xs font-black text-bauhaus-muted uppercase tracking-[0.3em] mb-1">Anonymous</div>
            <div className="text-3xl font-black text-bauhaus-black mb-2">Free</div>
            <ul className="text-sm text-bauhaus-muted font-medium space-y-1">
              <li>20 requests/minute</li>
              <li>All 6 actions available</li>
              <li>No API key needed</li>
              <li>IP-based rate limiting</li>
            </ul>
          </div>
          <div className="border-4 border-bauhaus-blue p-6 bg-bauhaus-blue/5">
            <div className="text-xs font-black text-bauhaus-blue uppercase tracking-[0.3em] mb-1">With API Key</div>
            <div className="text-3xl font-black text-bauhaus-black mb-2">Free <span className="text-sm font-bold text-bauhaus-muted">(beta)</span></div>
            <ul className="text-sm text-bauhaus-muted font-medium space-y-1">
              <li>60 requests/minute</li>
              <li>Usage tracking + analytics</li>
              <li>Up to 5 keys per org</li>
              <li>Priority when paid tiers launch</li>
            </ul>
          </div>
        </div>
        <div className="mt-4 flex justify-center gap-4 flex-wrap">
          <a href="/api/agent" className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-red transition-colors">
            View API Docs
          </a>
          <a href="mailto:ben@civicgraph.com.au?subject=Agent API Access" className="px-6 py-3 bg-white text-bauhaus-black font-black text-xs uppercase tracking-widest border-4 border-bauhaus-black hover:bg-bauhaus-yellow transition-colors">
            Get In Touch
          </a>
        </div>
      </section>

      {/* Why CivicGraph for agents */}
      <section className="border-t-4 border-bauhaus-black pt-12">
        <h2 className="text-xl font-black text-bauhaus-black mb-4">Why CivicGraph for Agents</h2>
        <div className="space-y-4 text-sm text-bauhaus-muted font-medium leading-relaxed max-w-2xl">
          <p>
            General-purpose LLMs hallucinate government data. They don&apos;t know who holds what contracts,
            which entities donate to which parties, or where funding deserts exist. CivicGraph does.
          </p>
          <p>
            Every response comes from structured, cross-referenced datasets — not generated text.
            560K entities linked by ABN across 11 data sources. Every number is auditable.
          </p>
          <p>
            An agent that buys a CivicGraph query for $0.01 gets a verified answer.
            An agent that tries to answer from training data gets a plausible-sounding wrong answer.
            In procurement and compliance, the difference matters.
          </p>
        </div>
      </section>
    </div>
  );
}
