import { unstable_cache } from 'next/cache';
import { getServiceSupabase } from '@/lib/supabase';

export interface FundingOperatingReport {
  generatedAt: string;
  newOpportunities: number;
  promotedThisWeek: number;
  dismissedThisWeek: number;
  deadlines: Array<{ id: string; name: string; provider: string | null; deadline: string; days: number; score: number | null }>;
  overdueRelationships: Array<{ id: string; name: string; action: string; due: string; daysOverdue: number }>;
  dismissalReasons: Array<{ reason: string; count: number }>;
  sourceHealth: { enabled: number; stale: number; failed: number };
}

interface RawReport extends Omit<FundingOperatingReport, 'deadlines' | 'overdueRelationships'> {
  deadlines: Array<Omit<FundingOperatingReport['deadlines'][number], 'days'>>;
  overdueRelationships: Array<Omit<FundingOperatingReport['overdueRelationships'][number], 'daysOverdue'>>;
}

const getCachedFundingOperatingReport = unstable_cache(async (): Promise<FundingOperatingReport> => {
  const db = getServiceSupabase();
  const { data, error } = await db.rpc('get_funding_operating_report');
  if (error) throw new Error(`Funding report unavailable: ${error.message}`);
  const raw = data as RawReport;
  const now = Date.now();
  return {
    ...raw,
    newOpportunities: Number(raw.newOpportunities || 0),
    promotedThisWeek: Number(raw.promotedThisWeek || 0),
    dismissedThisWeek: Number(raw.dismissedThisWeek || 0),
    deadlines: (raw.deadlines || []).map(item => ({
      ...item,
      days: Math.max(0, Math.ceil((new Date(`${item.deadline}T00:00:00Z`).getTime() - now) / 86_400_000)),
    })),
    overdueRelationships: (raw.overdueRelationships || []).map(item => ({
      ...item,
      daysOverdue: Math.max(1, Math.ceil((now - new Date(`${item.due}T00:00:00Z`).getTime()) / 86_400_000)),
    })),
  };
}, ['funding-operating-report-v2'], { revalidate: 300, tags: ['funding-operating-report'] });

export async function getFundingOperatingReport(): Promise<FundingOperatingReport> {
  return getCachedFundingOperatingReport();
}
