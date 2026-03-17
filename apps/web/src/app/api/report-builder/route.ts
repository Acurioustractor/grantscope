import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import {
  getFundingByState,
  getTopPrograms,
  getTopOrgs,
  getAlmaInterventions,
  getAlmaCount,
  getFundingByLga,
  getCrossSystemOrgs,
} from '@/lib/services/report-service';

type Topic = 'youth-justice' | 'child-protection' | 'ndis' | 'family-services' | 'indigenous' | 'legal-services' | 'diversion' | 'prevention';

const VALID_TOPICS: Topic[] = ['youth-justice', 'child-protection', 'ndis', 'family-services', 'indigenous', 'legal-services', 'diversion', 'prevention'];

/**
 * POST /api/report-builder — generate custom report data
 */
export async function POST(request: NextRequest) {
  const auth = await requireModule('research');
  if (auth.error) return auth.error;

  const body = await request.json();
  const { topic, stateFilter } = body as { topic: string; stateFilter?: string };

  if (!topic || !VALID_TOPICS.includes(topic as Topic)) {
    return NextResponse.json({ error: `Invalid topic. Must be one of: ${VALID_TOPICS.join(', ')}` }, { status: 400 });
  }

  const t = topic as Topic;

  // Cross-topics for overlap analysis
  const crossTopics = VALID_TOPICS.filter(ct => ct !== t).slice(0, 3) as Topic[];

  // Run all queries in parallel
  const [fundingByState, topPrograms, topOrgs, almaInterventions, almaCount, fundingByLga, crossSystemOrgs] = await Promise.all([
    getFundingByState(t),
    getTopPrograms(t, 15),
    getTopOrgs(t, 25),
    getAlmaInterventions(t, 20),
    getAlmaCount(t),
    getFundingByLga(t, 20),
    getCrossSystemOrgs(t, crossTopics, 15),
  ]);

  // Apply state filter if provided
  const filterState = (items: Array<{ state?: string | null }> | null) => {
    if (!stateFilter || !items) return items;
    return items.filter(i => i.state === stateFilter);
  };

  return NextResponse.json({
    topic: t,
    stateFilter: stateFilter || null,
    generatedAt: new Date().toISOString(),
    sections: {
      fundingByState: fundingByState,
      topPrograms: filterState(topPrograms),
      topOrgs: filterState(topOrgs),
      almaInterventions: almaInterventions,
      almaCount,
      fundingByLga: filterState(fundingByLga),
      crossSystemOrgs: filterState(crossSystemOrgs),
    },
  });
}
