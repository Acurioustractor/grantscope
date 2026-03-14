'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';

/* ── Types ─────────────────────────────────────────────────── */

interface Supplier {
  abn: string;
  name: string | null;
  uploaded_name: string | null;
  matched: boolean;
  contract_value: number;
  is_indigenous: boolean;
  is_social_enterprise: boolean;
  is_community_controlled: boolean;
  is_charity: boolean;
  entity_type: string | null;
  state: string | null;
  postcode: string | null;
  remoteness: string | null;
  seifa_irsd_decile: number | null;
  lga: string | null;
  certifications: Array<{ body: string }> | null;
}

interface ComplianceResult {
  compliance: {
    ipp: { current: number; target: number; gap: number; gap_dollars: number; status: string; indigenous_suppliers: number; indigenous_spend: number };
    sme: { current: number; target: number; gap: number; gap_dollars: number; status: string; sme_suppliers: number; sme_spend: number };
    total_spend: number;
    match_rate: number;
  };
  suppliers: Supplier[];
  breakdowns: {
    by_state: Record<string, { count: number; value: number; indigenous: number; sme: number }>;
    by_remoteness: Record<string, { count: number; value: number }>;
    by_lga: Record<string, { count: number; value: number; indigenous: number }>;
    by_disadvantage: Record<string, { count: number; value: number; label: string }>;
  };
  recommendations: Array<{
    gs_id: string;
    name: string;
    abn: string;
    entity_type: string;
    state: string;
    remoteness: string;
    is_community_controlled: boolean;
    lga: string;
  }>;
}

interface BlackCladdingResult {
  assessments: Array<{
    abn: string;
    gs_id: string;
    name: string;
    risk_score: number;
    risk_level: string;
    flags: Array<{ flag: string; severity: string; detail: string }>;
    directors: Array<{ name: string; entity_type: string }>;
  }>;
  summary: { high_risk: number; medium_risk: number; low_risk: number };
}

/* ── Helpers ───────────────────────────────────────────────── */

function formatMoney(amount: number | null | undefined): string {
  if (!amount) return '—';
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

type TabKey = 'upload' | 'compliance' | 'risk' | 'recommendations';

/* ── Component ─────────────────────────────────────────────── */

export default function ProcurementDashboard() {
  const [tab, setTab] = useState<TabKey>('upload');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Upload state
  const [abnInput, setAbnInput] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [ippTarget, setIppTarget] = useState('3.0');
  const [smeTarget, setSmeTarget] = useState('30.0');
  const [totalSpend, setTotalSpend] = useState('');

  // Results
  const [result, setResult] = useState<ComplianceResult | null>(null);
  const [riskResult, setRiskResult] = useState<BlackCladdingResult | null>(null);

  const handleAnalyse = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        ipp_target: ippTarget,
        sme_target: smeTarget,
      });
      if (totalSpend) params.set('total_spend', totalSpend);

      let res: Response;

      if (csvFile) {
        // CSV upload
        const formData = new FormData();
        formData.append('file', csvFile);
        res = await fetch(`/api/procurement/upload?${params}`, {
          method: 'POST',
          body: formData,
        });
      } else {
        // ABN paste
        const abns = abnInput
          .split(/[\s,;]+/)
          .map(a => a.replace(/\D/g, ''))
          .filter(a => a.length === 11);

        if (abns.length === 0) {
          setError('Enter at least one valid ABN (11 digits) or upload a CSV');
          setLoading(false);
          return;
        }

        res = await fetch(`/api/procurement/upload?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: abns.map(abn => ({ abn })),
          }),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Analysis failed');
      } else {
        setResult(data);
        setTab('compliance');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, [abnInput, csvFile, ippTarget, smeTarget, totalSpend]);

  const handleRiskScan = useCallback(async () => {
    if (!result) return;
    setLoading(true);
    try {
      const indigenousAbns = result.suppliers
        .filter(s => s.is_indigenous && s.matched)
        .map(s => s.abn);

      if (indigenousAbns.length === 0) {
        setError('No Indigenous-classified suppliers to scan');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/procurement/black-cladding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ abns: indigenousAbns }),
      });
      const data = await res.json();
      if (res.ok) {
        setRiskResult(data);
        setTab('risk');
      }
    } catch {
      setError('Risk scan failed');
    } finally {
      setLoading(false);
    }
  }, [result]);

  const loadExample = () => {
    setAbnInput([
      '91604482966',  // Indigenous enterprise
      '55606241203',  // Arrilla Indigenous Consulting
      '42093279985',  // Brotherhood of St Laurence
      '86008474422',  // Mission Australia
      '53169542648',  // Goodstart Early Learning
      '78004085330',  // St Vincent de Paul
      '88610252511',  // Company
      '47110995518',  // Company
    ].join('\n'));
    setTotalSpend('50000000');
  };

  return (
    <div className="max-w-6xl">
      <Link href="/" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">
        &larr; Home
      </Link>

      {/* Hero */}
      <div className="mt-4 mb-6">
        <div className="bg-bauhaus-blue border-4 border-bauhaus-black p-6 sm:p-8" style={{ boxShadow: '8px 8px 0px 0px var(--color-bauhaus-black)' }}>
          <p className="text-xs font-black text-white/60 uppercase tracking-[0.3em] mb-3">CivicGraph</p>
          <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-3">
            Procurement Compliance Dashboard
          </h1>
          <p className="text-white/80 font-medium max-w-3xl leading-relaxed">
            Upload your supplier ledger to instantly see your IPP and SME compliance status.
            Get gap calculations, supplier recommendations, and black cladding risk scores — all powered by 143K entities and 754K contracts.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-4 border-bauhaus-black border-b-0">
        {([
          ['upload', 'Upload'],
          ['compliance', 'Compliance'],
          ['risk', 'Risk Scan'],
          ['recommendations', 'Recommendations'],
        ] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            disabled={key !== 'upload' && !result}
            className={`flex-1 px-4 py-3 text-xs font-black uppercase tracking-widest transition-colors ${
              tab === key
                ? 'bg-bauhaus-black text-white'
                : key !== 'upload' && !result
                  ? 'bg-white text-bauhaus-muted cursor-not-allowed'
                  : 'bg-white text-bauhaus-muted hover:bg-bauhaus-canvas hover:text-bauhaus-black'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="border-4 border-bauhaus-black p-6">
        {error && (
          <div className="border-4 border-bauhaus-red bg-bauhaus-red/10 p-4 mb-6">
            <p className="text-sm font-bold text-bauhaus-red">{error}</p>
          </div>
        )}

        {/* ── Upload Tab ──────────────────────── */}
        {tab === 'upload' && (
          <div className="space-y-6">
            {/* Input method toggle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* CSV Upload */}
              <div>
                <h3 className="text-xs font-black uppercase tracking-widest mb-3">Upload Supplier CSV</h3>
                <div
                  className={`border-4 border-dashed ${csvFile ? 'border-bauhaus-blue bg-bauhaus-blue/5' : 'border-bauhaus-black/30'} p-6 text-center`}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files[0];
                    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.tsv'))) {
                      setCsvFile(file);
                    }
                  }}
                >
                  <input
                    type="file"
                    accept=".csv,.tsv"
                    onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="csv-upload"
                  />
                  <label htmlFor="csv-upload" className="cursor-pointer">
                    {csvFile ? (
                      <div>
                        <p className="text-sm font-black text-bauhaus-blue">{csvFile.name}</p>
                        <p className="text-xs text-bauhaus-muted mt-1">{(csvFile.size / 1024).toFixed(0)} KB</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-bold text-bauhaus-muted">Drop CSV here or click to browse</p>
                        <p className="text-xs text-bauhaus-muted mt-1">Columns: abn, supplier_name, contract_value</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* ABN Paste */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-xs font-black uppercase tracking-widest">Or Paste ABNs</h3>
                  <button type="button" onClick={loadExample} className="text-xs font-bold text-bauhaus-blue hover:text-bauhaus-black underline">
                    Load example
                  </button>
                </div>
                <textarea
                  value={abnInput}
                  onChange={(e) => setAbnInput(e.target.value)}
                  placeholder="Paste ABNs — one per line, comma-separated, or space-separated"
                  rows={5}
                  className="w-full px-3 py-2 text-sm font-mono border-4 border-bauhaus-black/20 focus:border-bauhaus-black focus:outline-none resize-y"
                />
              </div>
            </div>

            {/* Target Configuration */}
            <div className="border-4 border-bauhaus-black/20 p-4">
              <h3 className="text-xs font-black uppercase tracking-widest mb-4">Compliance Targets</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-bauhaus-muted block mb-1">IPP Target (%)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="100"
                    value={ippTarget}
                    onChange={(e) => setIppTarget(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border-2 border-bauhaus-black/20 focus:border-bauhaus-black focus:outline-none"
                  />
                  <p className="text-[10px] text-bauhaus-muted mt-1">Commonwealth IPP: 3% (2025), rising to 4% by 2030</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-bauhaus-muted block mb-1">SME Target (%)</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    max="100"
                    value={smeTarget}
                    onChange={(e) => setSmeTarget(e.target.value)}
                    className="w-full px-3 py-2 text-sm font-mono border-2 border-bauhaus-black/20 focus:border-bauhaus-black focus:outline-none"
                  />
                  <p className="text-[10px] text-bauhaus-muted mt-1">QPP 2026: 30% SME participation</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-bauhaus-muted block mb-1">Total Org Spend ($)</label>
                  <input
                    type="text"
                    value={totalSpend}
                    onChange={(e) => setTotalSpend(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="e.g. 50000000"
                    className="w-full px-3 py-2 text-sm font-mono border-2 border-bauhaus-black/20 focus:border-bauhaus-black focus:outline-none"
                  />
                  <p className="text-[10px] text-bauhaus-muted mt-1">For $ gap calculation</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleAnalyse}
              disabled={loading || (!abnInput && !csvFile)}
              className="w-full px-6 py-4 bg-bauhaus-black text-white font-black text-sm uppercase tracking-widest hover:bg-bauhaus-blue transition-colors disabled:opacity-50"
            >
              {loading ? 'Analysing supplier base...' : 'Analyse Compliance'}
            </button>
          </div>
        )}

        {/* ── Compliance Tab ──────────────────── */}
        {tab === 'compliance' && result && (
          <div className="space-y-6">
            {/* IPP & SME Gauges */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
              <ComplianceGauge
                title="Indigenous Procurement Policy (IPP)"
                current={result.compliance.ipp.current}
                target={result.compliance.ipp.target}
                status={result.compliance.ipp.status}
                supplierCount={result.compliance.ipp.indigenous_suppliers}
                spend={result.compliance.ipp.indigenous_spend}
                gapDollars={result.compliance.ipp.gap_dollars}
                color="bauhaus-red"
                borderRight
              />
              <ComplianceGauge
                title="SME Participation"
                current={result.compliance.sme.current}
                target={result.compliance.sme.target}
                status={result.compliance.sme.status}
                supplierCount={result.compliance.sme.sme_suppliers}
                spend={result.compliance.sme.sme_spend}
                gapDollars={result.compliance.sme.gap_dollars}
                color="bauhaus-blue"
              />
            </div>

            {/* Top-line stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
              {[
                { label: 'Suppliers', value: result.suppliers.length.toString(), sub: `${result.suppliers.filter(s => s.matched).length} matched (${pct(result.compliance.match_rate)})` },
                { label: 'Total Spend', value: formatMoney(result.compliance.total_spend), sub: 'Uploaded or estimated' },
                { label: 'Indigenous', value: result.compliance.ipp.indigenous_suppliers.toString(), sub: `${pct(result.compliance.ipp.current)} of spend` },
                { label: 'IPP Gap', value: formatMoney(result.compliance.ipp.gap_dollars), sub: result.compliance.ipp.status === 'compliant' ? 'Compliant' : 'Additional spend needed' },
              ].map((stat, i) => (
                <div key={i} className={`p-4 border-4 border-bauhaus-black ${i > 0 ? 'border-l-0' : ''}`}>
                  <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted mb-1">{stat.label}</div>
                  <div className="text-xl font-black text-bauhaus-black">{stat.value}</div>
                  <div className="text-[10px] font-bold text-bauhaus-muted mt-1">{stat.sub}</div>
                </div>
              ))}
            </div>

            {/* Disadvantage breakdown */}
            <div className="border-4 border-bauhaus-black">
              <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
                <h2 className="text-xs font-black uppercase tracking-widest">Spend by Disadvantage (SEIFA)</h2>
              </div>
              <div className="divide-y divide-bauhaus-black/10">
                {Object.entries(result.breakdowns.by_disadvantage)
                  .filter(([, v]) => v.count > 0)
                  .map(([key, val]) => {
                    const totalSuppliers = result.suppliers.length;
                    const barWidth = totalSuppliers > 0 ? (val.count / totalSuppliers) * 100 : 0;
                    return (
                      <div key={key} className="p-3 flex items-center gap-4">
                        <div className="w-48 text-xs font-bold text-bauhaus-muted truncate">{val.label}</div>
                        <div className="flex-1 h-6 bg-bauhaus-canvas border-2 border-bauhaus-black/20 relative">
                          <div
                            className={`h-full ${key === 'most_disadvantaged' ? 'bg-bauhaus-red' : key === 'disadvantaged' ? 'bg-bauhaus-red/60' : key === 'most_advantaged' ? 'bg-money' : 'bg-bauhaus-blue/40'}`}
                            style={{ width: `${Math.max(barWidth, 2)}%` }}
                          />
                        </div>
                        <div className="w-12 text-right text-sm font-black">{val.count}</div>
                        <div className="w-20 text-right text-xs font-bold text-bauhaus-muted">{formatMoney(val.value)}</div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* By State + Remoteness */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
              <div className="border-4 border-bauhaus-black">
                <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
                  <h2 className="text-xs font-black uppercase tracking-widest">By State</h2>
                </div>
                <div className="p-4 space-y-2">
                  {Object.entries(result.breakdowns.by_state)
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-sm font-bold text-bauhaus-muted">{key}</span>
                        <div className="flex gap-3 items-center">
                          {val.indigenous > 0 && (
                            <span className="text-[10px] px-1 py-0.5 font-black border border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red">{val.indigenous} IPP</span>
                          )}
                          <span className="text-sm font-black">{val.count}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <div className="border-4 border-bauhaus-black sm:border-l-0">
                <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black">
                  <h2 className="text-xs font-black uppercase tracking-widest">By Remoteness</h2>
                </div>
                <div className="p-4 space-y-2">
                  {Object.entries(result.breakdowns.by_remoteness)
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([key, val]) => (
                      <div key={key} className="flex justify-between items-center">
                        <span className="text-sm font-bold text-bauhaus-muted">{key}</span>
                        <span className="text-sm font-black">{val.count}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Supplier table */}
            <div className="border-4 border-bauhaus-black">
              <div className="p-4 bg-bauhaus-canvas border-b-4 border-bauhaus-black flex justify-between items-center">
                <h2 className="text-xs font-black uppercase tracking-widest">Supplier Detail</h2>
                <div className="flex gap-3 items-center">
                  <span className="text-xs font-bold text-bauhaus-muted">{result.suppliers.length} suppliers</span>
                  <button
                    onClick={handleRiskScan}
                    disabled={loading || !result.suppliers.some(s => s.is_indigenous)}
                    className="text-[10px] px-2 py-1 font-black uppercase tracking-wider border-2 border-bauhaus-red text-bauhaus-red hover:bg-bauhaus-red hover:text-white transition-colors disabled:opacity-30"
                  >
                    Run Risk Scan
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-4 border-bauhaus-black bg-bauhaus-canvas">
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">Supplier</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">ABN</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">Type</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">Location</th>
                      <th className="px-3 py-2 text-right text-[10px] font-black uppercase tracking-wider">Value</th>
                      <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">Flags</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bauhaus-black/10">
                    {result.suppliers.map((s) => (
                      <tr key={s.abn} className={`${!s.matched ? 'opacity-50' : ''} hover:bg-bauhaus-canvas/50`}>
                        <td className="px-3 py-2 font-bold text-bauhaus-black">
                          {s.matched && s.name ? (
                            <Link href={`/entities/${s.abn}`} className="hover:text-bauhaus-blue underline">{s.name}</Link>
                          ) : (
                            s.uploaded_name || s.name || 'Unknown'
                          )}
                        </td>
                        <td className="px-3 py-2 font-mono text-xs text-bauhaus-muted">{s.abn}</td>
                        <td className="px-3 py-2">
                          {s.entity_type && (
                            <span className={`text-[10px] px-1.5 py-0.5 font-black uppercase tracking-wider border ${
                              s.entity_type === 'indigenous_corp' ? 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red' :
                              s.entity_type === 'charity' ? 'border-bauhaus-blue bg-bauhaus-blue/10 text-bauhaus-blue' :
                              'border-bauhaus-black/20 text-bauhaus-muted'
                            }`}>
                              {s.entity_type.replace(/_/g, ' ')}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-bauhaus-muted">
                          {s.state}{s.postcode ? ` ${s.postcode}` : ''}
                          {s.remoteness && !s.remoteness.includes('Major') && (
                            <span className="ml-1 text-[10px] font-bold text-bauhaus-red">{s.remoteness.replace(' Australia', '')}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-right">{formatMoney(s.contract_value)}</td>
                        <td className="px-3 py-2">
                          <div className="flex gap-1 flex-wrap">
                            {s.is_indigenous && <span className="text-[10px] px-1 py-0.5 font-black border border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red">IPP</span>}
                            {s.is_social_enterprise && <span className="text-[10px] px-1 py-0.5 font-black border border-bauhaus-blue bg-bauhaus-blue/10 text-bauhaus-blue">SE</span>}
                            {s.is_community_controlled && <span className="text-[10px] px-1 py-0.5 font-black border border-money bg-money/10 text-money">CC</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Risk Scan Tab ──────────────────── */}
        {tab === 'risk' && (
          <div className="space-y-6">
            {!riskResult ? (
              <div className="text-center py-12">
                <h3 className="text-sm font-black uppercase tracking-widest text-bauhaus-muted mb-3">Black Cladding Risk Scanner</h3>
                <p className="text-sm text-bauhaus-muted mb-6 max-w-md mx-auto">
                  Analyses directorship structures, ownership patterns, and entity relationships to flag potential &ldquo;black cladding&rdquo; — where non-Indigenous operators create shell partnerships to access IPP procurement.
                </p>
                <button
                  onClick={handleRiskScan}
                  disabled={loading || !result}
                  className="px-6 py-3 bg-bauhaus-red text-white font-black text-sm uppercase tracking-widest hover:bg-bauhaus-black transition-colors disabled:opacity-50"
                >
                  {loading ? 'Scanning...' : 'Run Risk Scan'}
                </button>
              </div>
            ) : (
              <>
                {/* Risk summary */}
                <div className="grid grid-cols-3 gap-0">
                  {[
                    { label: 'High Risk', value: riskResult.summary.high_risk, color: 'bg-bauhaus-red/10 border-bauhaus-red' },
                    { label: 'Medium Risk', value: riskResult.summary.medium_risk, color: 'bg-bauhaus-blue/10 border-bauhaus-blue' },
                    { label: 'Low Risk', value: riskResult.summary.low_risk, color: 'bg-money/10 border-money' },
                  ].map((stat, i) => (
                    <div key={i} className={`p-4 border-4 border-bauhaus-black ${i > 0 ? 'border-l-0' : ''}`}>
                      <div className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{stat.label}</div>
                      <div className="text-3xl font-black">{stat.value}</div>
                    </div>
                  ))}
                </div>

                {/* Risk details */}
                <div className="space-y-3">
                  {riskResult.assessments
                    .filter(a => a.risk_level !== 'not_applicable')
                    .sort((a, b) => b.risk_score - a.risk_score)
                    .map((assessment) => (
                    <div key={assessment.abn} className={`border-4 ${
                      assessment.risk_level === 'high' ? 'border-bauhaus-red' :
                      assessment.risk_level === 'medium' ? 'border-bauhaus-blue' :
                      'border-bauhaus-black/20'
                    }`}>
                      <div className="p-4 flex justify-between items-start">
                        <div>
                          <h3 className="font-black text-bauhaus-black">{assessment.name}</h3>
                          <p className="text-xs font-mono text-bauhaus-muted">{assessment.abn}</p>
                        </div>
                        <div className={`px-2 py-1 text-[10px] font-black uppercase tracking-wider border-2 ${
                          assessment.risk_level === 'high' ? 'border-bauhaus-red bg-bauhaus-red text-white' :
                          assessment.risk_level === 'medium' ? 'border-bauhaus-blue bg-bauhaus-blue text-white' :
                          'border-money bg-money/10 text-money'
                        }`}>
                          {assessment.risk_level} ({assessment.risk_score})
                        </div>
                      </div>
                      {assessment.flags.length > 0 && (
                        <div className="px-4 pb-4 space-y-2">
                          {assessment.flags.map((flag, i) => (
                            <div key={i} className="flex gap-2 items-start">
                              <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                                flag.severity === 'high' ? 'bg-bauhaus-red' :
                                flag.severity === 'medium' ? 'bg-bauhaus-blue' :
                                'bg-bauhaus-muted'
                              }`} />
                              <p className="text-xs text-bauhaus-muted leading-relaxed">{flag.detail}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Recommendations Tab ─────────────── */}
        {tab === 'recommendations' && result && (
          <div className="space-y-6">
            {result.recommendations.length > 0 ? (
              <>
                <div className="p-4 bg-bauhaus-canvas border-4 border-bauhaus-black/20">
                  <h3 className="text-xs font-black uppercase tracking-widest mb-2">Gap-Filling Recommendations</h3>
                  <p className="text-sm text-bauhaus-muted">
                    Based on your compliance gaps, here are verified suppliers that could help you meet your IPP and SME targets.
                    These entities are NOT in your current supplier ledger.
                  </p>
                </div>
                <div className="border-4 border-bauhaus-black">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-4 border-bauhaus-black bg-bauhaus-canvas">
                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">Entity</th>
                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">Type</th>
                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">Location</th>
                        <th className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider">Flags</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bauhaus-black/10">
                      {result.recommendations.map((r) => (
                        <tr key={r.gs_id} className="hover:bg-bauhaus-canvas/50">
                          <td className="px-3 py-2">
                            <Link href={`/entities/${r.gs_id}`} className="font-bold text-bauhaus-black hover:text-bauhaus-blue underline">
                              {r.name}
                            </Link>
                            <div className="text-xs font-mono text-bauhaus-muted">{r.abn}</div>
                          </td>
                          <td className="px-3 py-2">
                            <span className={`text-[10px] px-1.5 py-0.5 font-black uppercase tracking-wider border ${
                              r.entity_type === 'indigenous_corp' ? 'border-bauhaus-red bg-bauhaus-red/10 text-bauhaus-red' :
                              'border-bauhaus-blue bg-bauhaus-blue/10 text-bauhaus-blue'
                            }`}>
                              {r.entity_type.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-bauhaus-muted">
                            {r.state} — {r.lga}
                            {r.remoteness && !r.remoteness.includes('Major') && (
                              <span className="ml-1 text-[10px] font-bold text-bauhaus-red">{r.remoteness.replace(' Australia', '')}</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {r.is_community_controlled && (
                              <span className="text-[10px] px-1 py-0.5 font-black border border-money bg-money/10 text-money">CC</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-sm font-black text-bauhaus-muted uppercase tracking-widest">
                  {result.compliance.ipp.status === 'compliant' && result.compliance.sme.status === 'compliant'
                    ? 'You\'re compliant — no gap-filling needed'
                    : 'No recommendations available for your current filters'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* API integration callout */}
      <div className="mt-6 border-4 border-bauhaus-black bg-bauhaus-canvas p-5">
        <h3 className="text-xs font-black uppercase tracking-widest mb-2">Enterprise API</h3>
        <p className="text-sm font-medium text-bauhaus-muted mb-3">
          Integrate compliance analysis directly into your ERP or procurement system.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { endpoint: 'POST /api/procurement/upload', desc: 'CSV upload + compliance gap analysis' },
            { endpoint: 'POST /api/procurement/tender-pack', desc: 'Auto-generate Tender Intelligence Packs' },
            { endpoint: 'POST /api/procurement/black-cladding', desc: 'Black cladding risk scoring' },
          ].map((api, i) => (
            <div key={i} className="text-xs">
              <code className="font-mono font-bold text-bauhaus-blue block">{api.endpoint}</code>
              <span className="text-bauhaus-muted">{api.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Compliance Gauge Sub-component ────────────────────────── */

function ComplianceGauge({ title, current, target, status, supplierCount, spend, gapDollars, color, borderRight }: {
  title: string;
  current: number;
  target: number;
  status: string;
  supplierCount: number;
  spend: number;
  gapDollars: number;
  color: string;
  borderRight?: boolean;
}) {
  const isCompliant = status === 'compliant';
  const currentPct = Math.min(current * 100, 100);
  const targetPct = target * 100;

  return (
    <div className={`p-6 border-4 border-bauhaus-black ${borderRight ? 'md:border-r-0' : ''}`}>
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-xs font-black uppercase tracking-widest">{title}</h3>
        <span className={`text-[10px] px-2 py-1 font-black uppercase tracking-wider border-2 ${
          isCompliant ? 'border-money bg-money/10 text-money' : `border-${color} bg-${color}/10 text-${color}`
        }`}>
          {isCompliant ? 'Compliant' : 'Gap'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-8 bg-bauhaus-canvas border-2 border-bauhaus-black/20 mb-3">
        <div
          className={`h-full ${isCompliant ? 'bg-money' : `bg-${color}`} transition-all duration-500`}
          style={{ width: `${Math.min(currentPct / Math.max(targetPct, 1) * 100, 100)}%` }}
        />
        {/* Target marker */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-bauhaus-black"
          style={{ left: `${Math.min(100, (targetPct / Math.max(currentPct, targetPct, 1)) * 100)}%` }}
        >
          <div className="absolute -top-5 -translate-x-1/2 text-[10px] font-black text-bauhaus-black">
            {targetPct}%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-2xl font-black">{pct(current)}</div>
          <div className="text-[10px] font-bold text-bauhaus-muted">{supplierCount} suppliers / {formatMoney(spend)} spend</div>
        </div>
        {!isCompliant && gapDollars > 0 && (
          <div className="text-right">
            <div className={`text-2xl font-black text-${color}`}>{formatMoney(gapDollars)}</div>
            <div className="text-[10px] font-bold text-bauhaus-muted">additional spend needed</div>
          </div>
        )}
      </div>
    </div>
  );
}
