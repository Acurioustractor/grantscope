import { getServiceSupabase } from '@/lib/supabase';
import { buildYouthJusticeReport } from '@grant-engine/reports/money-flow';
import { YouthJusticeCharts } from './charts';

export const dynamic = 'force-dynamic';

import { QLD_YOUTH_JUSTICE_PROGRAMS, QLD_YOUTH_JUSTICE_FLOWS } from '@grant-engine/sources/qld-youth-justice';

async function getReport() {
  try {
    const supabase = getServiceSupabase();
    return await buildYouthJusticeReport(supabase);
  } catch {
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
      <div className="mb-8">
        <a href="/reports" className="text-xs font-black text-bauhaus-muted uppercase tracking-widest hover:text-bauhaus-black">&larr; All Reports</a>
        <div className="text-xs font-black text-bauhaus-red mt-4 mb-1 uppercase tracking-widest">Living Report</div>
        <h1 className="text-3xl sm:text-4xl font-black text-bauhaus-black mb-3">
          QLD Youth Justice: Follow the Money
        </h1>
        <p className="text-bauhaus-muted text-base sm:text-lg max-w-2xl leading-relaxed font-medium">
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
