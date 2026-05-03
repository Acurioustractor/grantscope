import { NextRequest, NextResponse } from 'next/server';
import {
  getOpportunityIntelligence,
  type OpportunityIntelligenceFilters,
  type OpportunitySignalLane,
  type OpportunitySignalSource,
  type OpportunitySignalStatus,
} from '@/lib/opportunity-intelligence';

export const dynamic = 'force-dynamic';

const LANES = new Set<OpportunitySignalLane>([
  'grant',
  'foundation',
  'procurement',
  'capital',
  'buyer',
  'relationship',
  'communications',
  'evidence',
  'systems',
]);

const SOURCES = new Set<OpportunitySignalSource>([
  'wiki',
  'grant',
  'foundation',
  'procurement',
  'crm',
  'notion',
  'goods',
]);

const STATUSES = new Set<OpportunitySignalStatus>([
  'discovered',
  'researching',
  'qualified',
  'briefing',
  'pursuing',
  'submitted',
  'won',
  'lost',
  'monitor',
  'no-go',
]);

function parseFilters(request: NextRequest): OpportunityIntelligenceFilters {
  const params = request.nextUrl.searchParams;
  const lane = params.get('lane');
  const source = params.get('source');
  const status = params.get('status');
  const minScoreRaw = params.get('minScore');
  const deadline = params.get('deadline');

  return {
    project: params.get('project') ?? undefined,
    lane: lane && LANES.has(lane as OpportunitySignalLane) ? (lane as OpportunitySignalLane) : undefined,
    source: source && SOURCES.has(source as OpportunitySignalSource) ? (source as OpportunitySignalSource) : undefined,
    status: status && STATUSES.has(status as OpportunitySignalStatus) ? (status as OpportunitySignalStatus) : undefined,
    q: params.get('q') ?? undefined,
    deadline:
      deadline === 'overdue' || deadline === '30d' || deadline === '60d' || deadline === '90d' || deadline === 'none'
        ? deadline
        : undefined,
    minScore: minScoreRaw ? Number(minScoreRaw) : undefined,
  };
}

export async function GET(request: NextRequest) {
  try {
    const filters = parseFilters(request);
    const response = await getOpportunityIntelligence(filters);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to build opportunity intelligence',
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
