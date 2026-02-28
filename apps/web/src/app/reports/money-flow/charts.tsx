'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Treemap,
} from 'recharts';

interface SankeyNode {
  id: string;
  label: string;
  type: string;
}

interface SankeyLink {
  source: string;
  target: string;
  value: number;
  notes?: string;
}

interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  domain: string;
  year: number;
  totalAmount: number;
}

interface DomainSummary {
  domain: string;
  totalAmount: number;
  flowCount: number;
  topSources: Array<{ name: string; amount: number }>;
  topDestinations: Array<{ name: string; amount: number }>;
}

interface MoneyFlowReport {
  domains: DomainSummary[];
  sankeyByDomain: Record<string, SankeyData>;
  totalTracked: number;
}

function formatDollars(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

const DOMAIN_COLORS: Record<string, string> = {
  youth_justice: '#dc2626',
  indigenous: '#d97706',
  health: '#059669',
  education: '#2563eb',
  arts: '#7c3aed',
  environment: '#16a34a',
  community: '#0891b2',
  general: '#6b7280',
};

function DomainOverview({ report }: { report: MoneyFlowReport }) {
  const data = report.domains.map(d => ({
    name: d.domain.replace('_', ' '),
    amount: d.totalAmount,
    flows: d.flowCount,
    fill: DOMAIN_COLORS[d.domain] || '#6b7280',
  }));

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>Funding by Domain</h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px' }}>
        {formatDollars(report.totalTracked)} tracked across {report.domains.length} domains
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={formatDollars} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 13 }} />
          <Tooltip formatter={(value) => formatDollars(Number(value))} />
          <Bar dataKey="amount" radius={[0, 4, 4, 0]}>
            {data.map((entry, index) => (
              <rect key={index} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function DomainFlowDetail({ domain, sankey }: { domain: DomainSummary; sankey?: SankeyData }) {
  if (!sankey) return null;

  const stages = [
    { label: 'Sources', types: ['taxpayer', 'corporate'] },
    { label: 'Intermediaries', types: ['government', 'foundation'] },
    { label: 'Programs', types: ['government_program', 'grant_program'] },
    { label: 'Outcomes', types: ['outcome', 'community_org'] },
  ];

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px', textTransform: 'capitalize' }}>
        {domain.domain.replace('_', ' ')} — Money Flow
      </h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px' }}>
        {formatDollars(domain.totalAmount)} across {domain.flowCount} tracked flows
      </p>

      <div style={{ display: 'flex', gap: '2px' }}>
        {stages.map(stage => {
          const nodes = sankey.nodes.filter(n => stage.types.includes(n.type));
          if (!nodes.length) return null;

          return (
            <div key={stage.label} style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '11px', fontWeight: 700, color: '#999',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                marginBottom: '8px', textAlign: 'center',
              }}>
                {stage.label}
              </div>
              {nodes.slice(0, 8).map(node => {
                const value = Math.max(
                  sankey.links.filter(l => l.target === node.id).reduce((s, l) => s + l.value, 0),
                  sankey.links.filter(l => l.source === node.id).reduce((s, l) => s + l.value, 0),
                );

                const color = DOMAIN_COLORS[domain.domain] || '#6b7280';

                return (
                  <div key={node.id} style={{
                    background: `${color}10`,
                    border: `1px solid ${color}40`,
                    borderRadius: '8px', padding: '8px', marginBottom: '4px',
                  }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, lineHeight: 1.3 }}>{node.label}</div>
                    {value > 0 && (
                      <div style={{ fontSize: '13px', fontWeight: 800, color }}>{formatDollars(value)}</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MoneyFlowCharts({ report }: { report: MoneyFlowReport }) {
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const filteredDomains = selectedDomain
    ? report.domains.filter(d => d.domain === selectedDomain)
    : report.domains;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hero stat */}
      <div style={{
        background: '#fff', border: '2px solid #2563eb', borderRadius: '12px',
        padding: '24px', textAlign: 'center',
      }}>
        <div style={{ fontSize: '36px', fontWeight: 800, color: '#2563eb' }}>
          {formatDollars(report.totalTracked)}
        </div>
        <div style={{ fontSize: '16px', color: '#666' }}>
          Total funding tracked across {report.domains.length} domains
        </div>
      </div>

      {/* Domain filter */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setSelectedDomain(null)}
          style={{
            padding: '6px 16px', borderRadius: '20px', border: '1px solid #e0e0e0',
            background: !selectedDomain ? '#1a1a2e' : '#fff',
            color: !selectedDomain ? '#fff' : '#555',
            cursor: 'pointer', fontSize: '13px', fontWeight: 600,
          }}
        >
          All Domains
        </button>
        {report.domains.map(d => (
          <button
            key={d.domain}
            onClick={() => setSelectedDomain(d.domain)}
            style={{
              padding: '6px 16px', borderRadius: '20px',
              border: `1px solid ${DOMAIN_COLORS[d.domain] || '#e0e0e0'}`,
              background: selectedDomain === d.domain ? (DOMAIN_COLORS[d.domain] || '#1a1a2e') : '#fff',
              color: selectedDomain === d.domain ? '#fff' : (DOMAIN_COLORS[d.domain] || '#555'),
              cursor: 'pointer', fontSize: '13px', fontWeight: 600, textTransform: 'capitalize',
            }}
          >
            {d.domain.replace('_', ' ')} ({d.flowCount})
          </button>
        ))}
      </div>

      {/* Overview chart */}
      {!selectedDomain && <DomainOverview report={report} />}

      {/* Domain details */}
      {filteredDomains.map(d => (
        <DomainFlowDetail
          key={d.domain}
          domain={d}
          sankey={report.sankeyByDomain[d.domain]}
        />
      ))}
    </div>
  );
}
