'use client';

import { useState } from 'react';
import Link from 'next/link';

type PackType = 'intervention' | 'entity' | 'state';

const STATES = ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'NT', 'ACT'];

export default function EvidencePacksPage() {
  const [packType, setPackType] = useState<PackType>('state');
  const [stateValue, setStateValue] = useState('NSW');
  const [entityId, setEntityId] = useState('');
  const [interventionId, setInterventionId] = useState('');
  const [loading, setLoading] = useState(false);
  const [packData, setPackData] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generatePack() {
    setLoading(true);
    setError(null);
    setPackData(null);

    let url = '/api/justice/evidence-pack?format=json';
    if (packType === 'state') url += `&state=${stateValue}`;
    else if (packType === 'entity') url += `&entity_id=${encodeURIComponent(entityId)}`;
    else url += `&intervention_id=${encodeURIComponent(interventionId)}`;

    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed to generate pack'); return; }
      setPackData(json);
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  function openPrintable() {
    let url = '/api/justice/evidence-pack?format=html';
    if (packType === 'state') url += `&state=${stateValue}`;
    else if (packType === 'entity') url += `&entity_id=${encodeURIComponent(entityId)}`;
    else url += `&intervention_id=${encodeURIComponent(interventionId)}`;
    window.open(url, '_blank');
  }

  function downloadJSON() {
    if (!packData) return;
    const blob = new Blob([JSON.stringify(packData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `civicgraph-evidence-pack-${packType}-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="max-w-5xl">
      <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Home
      </Link>

      <div className="mt-4 mb-6">
        <div className="bg-bauhaus-black border-4 border-bauhaus-black p-6 sm:p-8" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-red)' }}>
          <p className="text-xs font-black text-white/40 uppercase tracking-[0.3em] mb-3">CivicGraph — Allocation Intelligence</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            Evidence Packs
          </h1>
          <p className="text-white/70 font-medium max-w-3xl leading-relaxed">
            Generate branded evidence packs for board papers, cabinet submissions, and funding applications.
            Powered by the Australian Living Map of Alternatives (ALMA), CivicGraph entity graph, and justice funding database.
          </p>
        </div>
      </div>

      {/* Pack type selector */}
      <div className="border-4 border-bauhaus-black mb-6">
        <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
          <h2 className="text-xs font-black uppercase tracking-widest">Generate Evidence Pack</h2>
        </div>
        <div className="p-6">
          <div className="flex gap-0 mb-6">
            {([
              { key: 'state' as PackType, label: 'State Summary' },
              { key: 'entity' as PackType, label: 'Entity Deep-Dive' },
              { key: 'intervention' as PackType, label: 'Intervention Analysis' },
            ]).map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => { setPackType(tab.key); setPackData(null); setError(null); }}
                className={`px-4 py-2 text-xs font-black uppercase tracking-wider border-2 border-bauhaus-black ${i > 0 ? 'border-l-0' : ''} ${
                  packType === tab.key ? 'bg-bauhaus-black text-white' : 'bg-white hover:bg-bauhaus-canvas'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {packType === 'state' && (
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-bauhaus-muted block mb-2">Select State</label>
              <div className="flex gap-2 flex-wrap">
                {STATES.map(s => (
                  <button
                    key={s}
                    onClick={() => setStateValue(s)}
                    className={`px-3 py-1.5 text-xs font-black border-2 border-bauhaus-black ${
                      stateValue === s ? 'bg-bauhaus-black text-white' : 'hover:bg-bauhaus-canvas'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {packType === 'entity' && (
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-bauhaus-muted block mb-2">Entity GS-ID or UUID</label>
              <input
                type="text"
                value={entityId}
                onChange={(e) => setEntityId(e.target.value)}
                placeholder="e.g. GS-00001 or entity UUID"
                className="w-full border-2 border-bauhaus-black p-2 text-sm font-mono"
              />
            </div>
          )}

          {packType === 'intervention' && (
            <div>
              <label className="text-xs font-black uppercase tracking-wider text-bauhaus-muted block mb-2">Intervention ID</label>
              <input
                type="text"
                value={interventionId}
                onChange={(e) => setInterventionId(e.target.value)}
                placeholder="ALMA intervention UUID"
                className="w-full border-2 border-bauhaus-black p-2 text-sm font-mono"
              />
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={generatePack}
              disabled={loading}
              className="px-6 py-3 bg-bauhaus-red text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-black transition-colors disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Generate Pack'}
            </button>
            {packData && (
              <>
                <button
                  onClick={openPrintable}
                  className="px-6 py-3 bg-bauhaus-black text-white font-black text-xs uppercase tracking-widest hover:bg-bauhaus-red transition-colors"
                >
                  Open Printable (PDF)
                </button>
                <button
                  onClick={downloadJSON}
                  className="px-6 py-3 border-2 border-bauhaus-black font-black text-xs uppercase tracking-widest hover:bg-bauhaus-canvas transition-colors"
                >
                  Download JSON
                </button>
              </>
            )}
          </div>

          {error && (
            <div className="mt-4 border-2 border-bauhaus-red p-3 text-sm text-bauhaus-red font-bold">
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Pack preview */}
      {packData && (
        <div className="border-4 border-bauhaus-black mb-6">
          <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black flex justify-between items-center">
            <h2 className="text-xs font-black uppercase tracking-widest">Pack Preview</h2>
            <span className="text-[10px] font-mono text-bauhaus-muted">
              {(packData.generated_at as string)?.split('T')[0]}
            </span>
          </div>
          <div className="p-6">
            {packType === 'state' && <StatePreview data={packData} />}
            {packType === 'entity' && <EntityPreview data={packData} />}
            {packType === 'intervention' && <InterventionPreview data={packData} />}
          </div>
        </div>
      )}

      {/* What packs contain */}
      <div className="border-4 border-bauhaus-black">
        <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
          <h2 className="text-xs font-black uppercase tracking-widest">What Evidence Packs Contain</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-bauhaus-black/10">
          {[
            {
              title: 'State Summary Pack',
              items: ['Indigenous org count', 'Community-controlled orgs', 'Justice funding totals', 'ALMA intervention breakdown', 'Evidence level distribution', 'Closing the Gap Target 11 status', 'Top interventions by type'],
            },
            {
              title: 'Entity Deep-Dive',
              items: ['Organisation profile + SEIFA/remoteness', 'ALMA interventions delivered', 'Justice funding received', 'Government contracts won', 'Political donation records', 'Integrity cross-reference flags'],
            },
            {
              title: 'Intervention Analysis',
              items: ['Full intervention profile', 'Evidence records + methodology', 'Measured outcomes + indicators', 'Delivery organisation details', 'Justice funding linked', 'Cultural authority assessment', 'Replication readiness score'],
            },
          ].map((pack, i) => (
            <div key={i} className="p-5">
              <h3 className="text-sm font-black uppercase tracking-wider mb-3">{pack.title}</h3>
              <ul className="space-y-1">
                {pack.items.map((item, j) => (
                  <li key={j} className="text-sm text-bauhaus-muted flex gap-2">
                    <span className="text-bauhaus-red font-bold">+</span> {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatMoney(amount: number): string {
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function StatePreview({ data }: { data: Record<string, unknown> }) {
  const s = data.summary as Record<string, unknown>;
  return (
    <div>
      <h3 className="text-lg font-black mb-4">{data.state as string} — State Evidence Summary</h3>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Indigenous Orgs', value: s.indigenous_organisations },
          { label: 'Community Controlled', value: s.community_controlled },
          { label: 'Justice Funding', value: formatMoney(s.total_justice_funding as number) },
          { label: 'ALMA Interventions', value: s.alma_interventions },
          { label: 'JR Interventions', value: s.jr_interventions },
          { label: 'Entity Linkage', value: `${s.linkage_rate}%` },
        ].map((stat, i) => (
          <div key={i} className="border-2 border-bauhaus-black/20 p-3">
            <div className="text-[10px] font-black uppercase tracking-wider text-bauhaus-muted">{stat.label}</div>
            <div className="text-xl font-black">{String(stat.value)}</div>
          </div>
        ))}
      </div>
      <div className="text-sm text-bauhaus-muted">
        <p className="font-bold mb-1">Data sources:</p>
        {(data.data_sources as string[]).map((s, i) => <p key={i}>- {s}</p>)}
      </div>
    </div>
  );
}

function EntityPreview({ data }: { data: Record<string, unknown> }) {
  const e = data.entity as Record<string, unknown>;
  const interventions = data.alma_interventions as Record<string, unknown>[];
  const funding = data.justice_funding as Record<string, unknown>;
  const contracts = data.government_contracts as Record<string, unknown>;
  const flags = data.integrity_flags as Record<string, boolean>;

  return (
    <div>
      <h3 className="text-lg font-black mb-1">{e.name as string}</h3>
      <p className="text-xs font-mono text-bauhaus-muted mb-4">ABN {(e.abn as string) || 'N/A'} | {e.type as string} | {e.state as string} | SEIFA {String(e.seifa_decile || 'N/A')}</p>

      {flags.donations_and_contracts && (
        <div className="border-2 border-bauhaus-red p-3 mb-4 text-sm">
          <span className="font-black text-bauhaus-red">INTEGRITY FLAG:</span> This entity has both political donations and government contracts on record.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="border-2 border-bauhaus-black/20 p-3">
          <div className="text-[10px] font-black uppercase text-bauhaus-muted">Interventions</div>
          <div className="text-xl font-black">{interventions.length}</div>
        </div>
        <div className="border-2 border-bauhaus-black/20 p-3">
          <div className="text-[10px] font-black uppercase text-bauhaus-muted">Justice Funding</div>
          <div className="text-xl font-black text-bauhaus-red">{formatMoney(funding.total as number)}</div>
        </div>
        <div className="border-2 border-bauhaus-black/20 p-3">
          <div className="text-[10px] font-black uppercase text-bauhaus-muted">Contracts</div>
          <div className="text-xl font-black">{formatMoney(contracts.total as number)}</div>
        </div>
        <div className="border-2 border-bauhaus-black/20 p-3">
          <div className="text-[10px] font-black uppercase text-bauhaus-muted">Donations</div>
          <div className="text-xl font-black">{formatMoney((data.political_donations as Record<string, unknown>).total as number)}</div>
        </div>
      </div>
    </div>
  );
}

function InterventionPreview({ data }: { data: Record<string, unknown> }) {
  const i = data.intervention as Record<string, unknown>;
  const evidence = data.evidence as Record<string, unknown>[];
  const outcomes = data.outcomes as Record<string, unknown>[];
  const entity = data.delivery_organisation as Record<string, unknown> | null;

  return (
    <div>
      <h3 className="text-lg font-black mb-1">{i.name as string}</h3>
      <p className="text-xs font-mono text-bauhaus-muted mb-4">{i.type as string} | Evidence: {(i.evidence_level as string) || 'Not rated'} | Score: {String(i.portfolio_score || 'N/A')}</p>
      <p className="text-sm mb-4">{(i.description as string) || 'No description available.'}</p>

      {entity && (
        <div className="border-2 border-bauhaus-black/20 p-3 mb-4">
          <div className="text-[10px] font-black uppercase text-bauhaus-muted mb-1">Delivered By</div>
          <div className="font-bold">{entity.name as string}</div>
          <div className="text-xs text-bauhaus-muted">{entity.type as string} | {entity.state as string} | {entity.community_controlled ? 'Community Controlled' : ''}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="border-2 border-bauhaus-black/20 p-3">
          <div className="text-[10px] font-black uppercase text-bauhaus-muted">Evidence Records</div>
          <div className="text-xl font-black">{evidence.length}</div>
        </div>
        <div className="border-2 border-bauhaus-black/20 p-3">
          <div className="text-[10px] font-black uppercase text-bauhaus-muted">Measured Outcomes</div>
          <div className="text-xl font-black">{outcomes.length}</div>
        </div>
      </div>
    </div>
  );
}
