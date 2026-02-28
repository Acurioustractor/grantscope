'use client';

import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Legend, Cell,
} from 'recharts';

interface AccessGapReport {
  orgsBySize: Array<{
    name: string;
    revenue: number;
    fundingReceived: number;
    adminPercent: number;
    domain: string[];
  }>;
  adminBurdenBySize: Array<{
    size: string;
    avgAdminPercent: number;
    count: number;
  }>;
  fundingConcentration: Array<{
    decile: string;
    percentOfOrgs: number;
    percentOfFunding: number;
  }>;
  totalOrgs: number;
  avgSmallOrgAdminPercent: number;
  avgLargeOrgAdminPercent: number;
}

function formatDollars(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function FundingVsSize({ report }: { report: AccessGapReport }) {
  const data = report.orgsBySize.slice(0, 200).map(o => ({
    revenue: o.revenue,
    funding: o.fundingReceived || 0,
    name: o.name,
  }));

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>Org Size vs Funding Received</h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px' }}>
        Larger organizations receive disproportionately more funding
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <ScatterChart margin={{ bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number" dataKey="revenue" name="Revenue"
            tickFormatter={formatDollars}
            label={{ value: 'Annual Revenue', position: 'bottom', offset: 0 }}
          />
          <YAxis
            type="number" dataKey="funding" name="Funding"
            tickFormatter={formatDollars}
          />
          <Tooltip
            formatter={(value) => formatDollars(Number(value))}
            labelFormatter={() => ''}
          />
          <Scatter data={data} fill="#2563eb" fillOpacity={0.5} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

function AdminBurdenChart({ report }: { report: AccessGapReport }) {
  const colors = ['#dc2626', '#f97316', '#eab308', '#22c55e'];

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>Admin Burden by Organization Size</h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px' }}>
        Small orgs spend <strong>{report.avgSmallOrgAdminPercent}%</strong> on admin
        vs <strong>{report.avgLargeOrgAdminPercent}%</strong> for large orgs
      </p>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={report.adminBurdenBySize}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="size" />
          <YAxis tickFormatter={(v: number) => `${v}%`} domain={[0, 50]} />
          <Tooltip formatter={(value) => `${Number(value).toFixed(0)}%`} />
          <Bar dataKey="avgAdminPercent" name="Admin % of Revenue" radius={[4, 4, 0, 0]}>
            {report.adminBurdenBySize.map((_, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function FundingConcentration({ report }: { report: AccessGapReport }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>Funding Concentration</h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px' }}>
        How funding is distributed across organizations by size
      </p>
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={report.fundingConcentration}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="decile" />
          <YAxis tickFormatter={(v: number) => `${v}%`} />
          <Tooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />
          <Legend />
          <Bar dataKey="percentOfOrgs" name="% of Orgs" fill="#93c5fd" radius={[4, 4, 0, 0]} />
          <Bar dataKey="percentOfFunding" name="% of Funding" fill="#2563eb" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AccessGapCharts({ report }: { report: AccessGapReport }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hero stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626' }}>
            {report.avgSmallOrgAdminPercent}%
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>Admin burden (small orgs)</div>
        </div>
        <div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669' }}>
            {report.avgLargeOrgAdminPercent}%
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>Admin burden (large orgs)</div>
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#2563eb' }}>
            {report.totalOrgs.toLocaleString()}
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>Community orgs tracked</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <AdminBurdenChart report={report} />
        <FundingConcentration report={report} />
      </div>

      <FundingVsSize report={report} />

      <div style={{ background: '#f9fafb', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Methodology</h3>
        <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#666', fontSize: '14px', lineHeight: 1.8 }}>
          <li>Admin burden estimated from ACNC reporting requirements by org size tier</li>
          <li>Small orgs defined as annual revenue under $250K</li>
          <li>Funding data from ACNC register, foundation programs, and grant records</li>
          <li>Community orgs identified from ACNC-registered charities with revenue under $1M</li>
        </ul>
      </div>
    </div>
  );
}
