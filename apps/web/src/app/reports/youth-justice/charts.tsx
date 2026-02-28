'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Sankey as RechartsSankey, LineChart, Line,
} from 'recharts';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Types (matching the API response)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface ProgramComparison {
  name: string;
  budgetAnnual: number;
  spendPerUnit: number;
  unitLabel: string;
  outcomes: Array<{ metric: string; value: number; trend: string; label: string }>;
  budgetHistory: Array<{ year: number; amount: number }>;
}

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
  totalAmount: number;
}

interface YouthJusticeReport {
  sankey: SankeyData;
  programs: ProgramComparison[];
  totalBudget: number;
  detentionCostPerChild: number;
  communityCostPerChild: number;
  costRatio: number;
  detentionRecidivism: number;
  communityRecidivism: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Formatters
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function formatDollars(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Cost Per Child Comparison
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function CostComparison({ report }: { report: YouthJusticeReport }) {
  const data = report.programs.map(p => ({
    name: p.name.replace('Youth ', '').replace(' Centres', '').replace(' Programs', ''),
    costPerChild: p.spendPerUnit,
    budget: p.budgetAnnual,
  }));

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>Cost Per Child Per Year</h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px' }}>
        Detention costs <strong>{report.costRatio}x more</strong> per child than community programs
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" tickFormatter={formatDollars} />
          <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 13 }} />
          <Tooltip formatter={(value) => formatDollars(Number(value))} />
          <Bar dataKey="costPerChild" fill="#dc2626" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Recidivism Comparison
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function RecidivismComparison({ report }: { report: YouthJusticeReport }) {
  const data = [
    {
      name: 'Detention',
      reoffend: report.detentionRecidivism * 100,
      desist: (1 - report.detentionRecidivism) * 100,
    },
    {
      name: 'Community',
      reoffend: report.communityRecidivism * 100,
      desist: (1 - report.communityRecidivism) * 100,
    },
  ];

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>Reoffending Rates (12 months)</h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px' }}>
        Detention has a <strong>{formatPercent(report.detentionRecidivism)}</strong> reoffending rate
        vs <strong>{formatPercent(report.communityRecidivism)}</strong> for community programs
      </p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" />
          <YAxis tickFormatter={(v: number) => `${v}%`} domain={[0, 100]} />
          <Tooltip formatter={(value) => `${Number(value).toFixed(0)}%`} />
          <Legend />
          <Bar dataKey="reoffend" name="Reoffend" fill="#dc2626" stackId="a" radius={[0, 0, 0, 0]} />
          <Bar dataKey="desist" name="Desist" fill="#059669" stackId="a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Budget Trend
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function BudgetTrend({ report }: { report: YouthJusticeReport }) {
  // Build merged year data from all programs
  const yearMap = new Map<number, Record<string, number>>();

  for (const program of report.programs) {
    const shortName = program.name.replace('Youth ', '').replace(' Centres', '').replace(' Programs', '');
    for (const entry of program.budgetHistory) {
      const existing = yearMap.get(entry.year) || { year: entry.year };
      existing[shortName] = entry.amount;
      yearMap.set(entry.year, existing);
    }
  }

  const data = Array.from(yearMap.values()).sort((a, b) => (a.year as number) - (b.year as number));
  const colors = ['#dc2626', '#2563eb', '#059669', '#d97706'];

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>Budget Growth Over Time</h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px' }}>
        Detention spending growing faster than community alternatives
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="year" />
          <YAxis tickFormatter={formatDollars} />
          <Tooltip formatter={(value) => formatDollars(Number(value))} />
          <Legend />
          {report.programs.map((p, i) => {
            const shortName = p.name.replace('Youth ', '').replace(' Centres', '').replace(' Programs', '');
            return (
              <Line
                key={p.name}
                type="monotone"
                dataKey={shortName}
                stroke={colors[i % colors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Money Flow Diagram (simplified Sankey using horizontal bars)
// Recharts Sankey is limited, so we build a visual flow using stacked bars
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function MoneyFlow({ report }: { report: YouthJusticeReport }) {
  const { sankey } = report;

  // Group flows by stage
  const stages = [
    { label: 'Source', type: 'taxpayer' },
    { label: 'Government', type: 'government' },
    { label: 'Programs', type: 'government_program' },
    { label: 'Outcomes', type: 'outcome' },
  ];

  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
      <h3 style={{ margin: '0 0 4px', fontSize: '18px' }}>Follow the Dollar</h3>
      <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px' }}>
        {formatDollars(sankey.totalAmount)} flows from QLD taxpayers through the youth justice system
      </p>

      <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-start' }}>
        {stages.map((stage) => {
          const stageNodes = sankey.nodes.filter(n => n.type === stage.type);
          const stageLinks = sankey.links.filter(l =>
            stageNodes.some(n => n.id === l.source || n.id === l.target)
          );

          // Calculate total for this stage
          const total = stageNodes.reduce((sum, node) => {
            const incoming = sankey.links
              .filter(l => l.target === node.id)
              .reduce((s, l) => s + l.value, 0);
            const outgoing = sankey.links
              .filter(l => l.source === node.id)
              .reduce((s, l) => s + l.value, 0);
            return sum + Math.max(incoming, outgoing);
          }, 0);

          return (
            <div key={stage.type} style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '11px', fontWeight: 700, color: '#999',
                textTransform: 'uppercase', letterSpacing: '0.05em',
                marginBottom: '8px', textAlign: 'center',
              }}>
                {stage.label}
              </div>
              {stageNodes.map(node => {
                const incoming = sankey.links
                  .filter(l => l.target === node.id)
                  .reduce((s, l) => s + l.value, 0);
                const outgoing = sankey.links
                  .filter(l => l.source === node.id)
                  .reduce((s, l) => s + l.value, 0);
                const value = Math.max(incoming, outgoing);
                const pct = total > 0 ? (value / total) * 100 : 0;

                const isNegativeOutcome = node.label.includes('Reoffending');
                const bgColor = isNegativeOutcome ? '#fecaca' :
                  node.type === 'outcome' ? '#d1fae5' :
                  node.type === 'government_program' ? '#dbeafe' :
                  '#f3f4f6';

                const borderColor = isNegativeOutcome ? '#dc2626' :
                  node.type === 'outcome' ? '#059669' :
                  node.type === 'government_program' ? '#2563eb' :
                  '#d1d5db';

                return (
                  <div
                    key={node.id}
                    style={{
                      background: bgColor,
                      border: `1px solid ${borderColor}`,
                      borderRadius: '8px',
                      padding: '10px',
                      marginBottom: '6px',
                      minHeight: Math.max(40, pct * 1.5),
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: 600, lineHeight: 1.3 }}>
                      {node.label}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: borderColor }}>
                      {formatDollars(value)}
                    </div>
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Main Report Component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function YouthJusticeCharts({ report }: { report: YouthJusticeReport }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hero stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px',
      }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626' }}>
            {formatDollars(report.totalBudget)}
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>Total QLD Youth Justice Budget</div>
        </div>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#dc2626' }}>
            {formatDollars(report.detentionCostPerChild)}
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>Per Child in Detention</div>
        </div>
        <div style={{ background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#059669' }}>
            {formatDollars(report.communityCostPerChild)}
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>Per Child in Community</div>
        </div>
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#d97706' }}>
            {report.costRatio}x
          </div>
          <div style={{ fontSize: '13px', color: '#666' }}>Detention vs Community Cost</div>
        </div>
      </div>

      {/* Money flow */}
      <MoneyFlow report={report} />

      {/* Side by side: cost + recidivism */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <CostComparison report={report} />
        <RecidivismComparison report={report} />
      </div>

      {/* Budget trend */}
      <BudgetTrend report={report} />

      {/* Data sources */}
      <div style={{ background: '#f9fafb', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '24px' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: '16px' }}>Data Sources</h3>
        <ul style={{ margin: 0, padding: '0 0 0 20px', color: '#666', fontSize: '14px', lineHeight: 1.8 }}>
          <li>QLD Budget Papers 2024-25 — Department of Youth Justice appropriation</li>
          <li>QLD Government Statistician — Youth justice supervision data</li>
          <li>AIHW Youth Justice in Australia — National comparison data</li>
          <li>QLD Open Data (data.qld.gov.au) — Detention and community supervision datasets</li>
          <li>QATSIP Annual Report — Indigenous community justice group funding</li>
        </ul>
        <p style={{ margin: '12px 0 0', fontSize: '12px', color: '#999' }}>
          This is a living report. Data is updated as new budget papers and reports are released.
          If you spot an error, please open an issue on GitHub.
        </p>
      </div>
    </div>
  );
}
