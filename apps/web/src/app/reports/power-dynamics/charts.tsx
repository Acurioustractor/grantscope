'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Treemap, Cell,
} from 'recharts';

interface PowerMetrics {
  herfindahlIndex: number;
  herfindahlLabel: string;
  giniCoefficient: number;
  top10Share: number;
  top50Share: number;
  totalGiving: number;
  foundationCount: number;
  givingFoundationCount: number;
}

interface FoundationPowerProfile {
  name: string;
  totalGiving: number;
  share: number;
  thematicFocus: string[];
  parentCompany: string | null;
}

interface PowerReport {
  metrics: PowerMetrics;
  topFoundations: FoundationPowerProfile[];
  givingDistribution: Array<{
    percentile: string;
    percentOfFoundations: number;
    percentOfGiving: number;
    avgGiving: number;
  }>;
  thematicConcentration: Array<{
    theme: string;
    totalGiving: number;
    foundationCount: number;
    topFoundation: string;
  }>;
}

function formatDollars(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function TopFoundationsChart({ foundations }: { foundations: FoundationPowerProfile[] }) {
  const data = foundations.slice(0, 15).map(f => ({
    name: f.name.length > 30 ? f.name.slice(0, 28) + '...' : f.name,
    giving: f.totalGiving,
    share: f.share,
    corporate: !!f.parentCompany,
  }));

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>Who Controls the Funding</h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px' }}>
        Top 15 foundations by annual giving
      </p>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data} layout="vertical" margin={{ left: 180 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={formatDollars} />
          <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(value) => formatDollars(Number(value))} />
          <Bar dataKey="giving" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.corporate ? '#d97706' : '#7c3aed'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '12px', color: '#666' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#7c3aed', borderRadius: 2, marginRight: 4 }} />Independent Foundation</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#d97706', borderRadius: 2, marginRight: 4 }} />Corporate Foundation</span>
      </div>
    </div>
  );
}

function GivingDistribution({ distribution }: { distribution: PowerReport['givingDistribution'] }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>Giving Distribution</h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px' }}>
        How giving is distributed across foundations
      </p>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={distribution}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="percentile" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={(v: number) => `${v}%`} />
          <Tooltip formatter={(value) => `${Number(value)}%`} />
          <Legend />
          <Bar dataKey="percentOfFoundations" name="% of Foundations" fill="#93c5fd" radius={[4, 4, 0, 0]} />
          <Bar dataKey="percentOfGiving" name="% of Giving" fill="#7c3aed" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ThematicConcentration({ themes }: { themes: PowerReport['thematicConcentration'] }) {
  const colors = ['#7c3aed', '#2563eb', '#059669', '#d97706', '#dc2626', '#0891b2', '#6b7280', '#ec4899'];

  const data = themes.slice(0, 10).map(t => ({
    name: t.theme.replace('_', ' '),
    giving: t.totalGiving,
    foundations: t.foundationCount,
    topFoundation: t.topFoundation,
  }));

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>Funding by Theme</h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px' }}>
        Where philanthropic money flows by thematic area
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 100 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={formatDollars} />
          <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 13 }} />
          <Tooltip
            formatter={(value) => formatDollars(Number(value))}
          />
          <Bar dataKey="giving" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PowerDynamicsCharts({ report }: { report: PowerReport }) {
  const { metrics } = report;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hero metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <div style={{
          background: metrics.herfindahlLabel === 'high' ? '#fef2f2' : '#fff',
          border: `1px solid ${metrics.herfindahlLabel === 'high' ? '#fecaca' : '#e0e0e0'}`,
          borderRadius: '12px', padding: '20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#7c3aed' }}>
            {metrics.herfindahlIndex.toLocaleString()}
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>
            HHI ({metrics.herfindahlLabel} concentration)
          </div>
        </div>
        <div style={{
          background: metrics.giniCoefficient > 0.6 ? '#fef2f2' : '#fff',
          border: `1px solid ${metrics.giniCoefficient > 0.6 ? '#fecaca' : '#e0e0e0'}`,
          borderRadius: '12px', padding: '20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626' }}>
            {metrics.giniCoefficient.toFixed(2)}
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>Gini coefficient</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#d97706' }}>
            {metrics.top10Share}%
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>Top 10 foundations share</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb' }}>
            {formatDollars(metrics.totalGiving)}
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>Total tracked giving</div>
        </div>
      </div>

      <TopFoundationsChart foundations={report.topFoundations} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <GivingDistribution distribution={report.givingDistribution} />
        <ThematicConcentration themes={report.thematicConcentration} />
      </div>

      <div style={{ background: '#f9fafb', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Understanding the Metrics</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', fontSize: '14px', color: '#666', lineHeight: 1.8 }}>
          <div>
            <strong>HHI (Herfindahl-Hirschman Index)</strong>
            <p style={{ margin: '4px 0' }}>
              Measures market concentration. Below 1,500 = competitive/diverse.
              1,500-2,500 = moderate concentration. Above 2,500 = highly concentrated.
            </p>
          </div>
          <div>
            <strong>Gini Coefficient</strong>
            <p style={{ margin: '4px 0' }}>
              Measures inequality in giving distribution. 0 = perfect equality
              (all foundations give the same). 1 = perfect inequality (one foundation gives everything).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
