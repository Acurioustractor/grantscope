import { getServiceSupabase } from '@/lib/supabase';
import { buildYouthJusticeReport } from '@grantscope/engine';
import { YouthJusticeCharts } from './charts';

// Fallback data when DB tables don't exist yet
import { QLD_YOUTH_JUSTICE_PROGRAMS, QLD_YOUTH_JUSTICE_FLOWS } from '@grantscope/engine';

async function getReport() {
  try {
    const supabase = getServiceSupabase();
    return await buildYouthJusticeReport(supabase);
  } catch {
    // Tables may not exist yet — build from static data
    return buildFallbackReport();
  }
}

function buildFallbackReport() {
  const programs = QLD_YOUTH_JUSTICE_PROGRAMS.map(p => ({
    name: p.name,
    budgetAnnual: p.budget_annual,
    spendPerUnit: p.spend_per_unit,
    unitLabel: p.unit_label,
    outcomes: p.outcomes,
    budgetHistory: p.budget_history,
  }));

  // Build sankey from static flows
  const nodeMap = new Map<string, { id: string; label: string; type: string }>();
  const links = QLD_YOUTH_JUSTICE_FLOWS.map(f => {
    const sourceId = `${f.source_type}:${f.source_name}`;
    const targetId = `${f.destination_type}:${f.destination_name}`;
    if (!nodeMap.has(sourceId)) nodeMap.set(sourceId, { id: sourceId, label: f.source_name, type: f.source_type });
    if (!nodeMap.has(targetId)) nodeMap.set(targetId, { id: targetId, label: f.destination_name, type: f.destination_type });
    return { source: sourceId, target: targetId, value: f.amount, notes: f.notes };
  });

  const detention = programs.find(p => p.name.includes('Detention'));
  const community = programs.find(p => p.name.includes('Community Youth'));

  return {
    sankey: {
      nodes: Array.from(nodeMap.values()),
      links,
      domain: 'youth_justice',
      year: 2025,
      totalAmount: 510_000_000,
    },
    programs,
    totalBudget: programs.reduce((s, p) => s + p.budgetAnnual, 0),
    detentionCostPerChild: detention?.spendPerUnit || 1_300_000,
    communityCostPerChild: community?.spendPerUnit || 12_000,
    costRatio: Math.round((detention?.spendPerUnit || 1_300_000) / (community?.spendPerUnit || 12_000)),
    detentionRecidivism: 0.73,
    communityRecidivism: 0.42,
  };
}

export default async function YouthJusticePage() {
  const report = await getReport();

  return (
    <div>
      <div style={{ marginBottom: '32px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#dc2626', marginBottom: '4px' }}>
          LIVING REPORT
        </div>
        <h1 style={{ fontSize: '36px', fontWeight: 800, margin: '0 0 8px' }}>
          QLD Youth Justice: Follow the Money
        </h1>
        <p style={{ color: '#666', fontSize: '16px', margin: 0, maxWidth: '700px' }}>
          Queensland spends ${(report.totalBudget / 1_000_000).toFixed(0)}M per year on youth justice.
          {' '}${(report.detentionCostPerChild / 1_000_000).toFixed(1)}M per child in detention,
          with a {Math.round(report.detentionRecidivism * 100)}% reoffending rate.
          Community programs cost ${(report.communityCostPerChild / 1_000).toFixed(0)}K per child
          with {Math.round(report.communityRecidivism * 100)}% reoffending.
        </p>
      </div>

      <YouthJusticeCharts report={report} />
    </div>
  );
}
