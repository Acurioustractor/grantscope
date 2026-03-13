import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { requireModule } from '@/lib/api-auth';
import { logUsage } from '../_lib/log-usage';
import { runProcurementDiscovery } from '../_lib/discovery';
import { logProcurementWorkflowRun, updateShortlistFilters } from '../_lib/procurement-workspace';

/**
 * POST /api/tender-intelligence/discover
 *
 * Supplier discovery — query entities by category, geography, and type.
 * Returns matching suppliers with contract history and compliance metadata.
 */
export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const {
    state,
    postcode,
    lga,
    shortlist_id,
    entity_types = ['indigenous_corp', 'social_enterprise', 'charity', 'company'],
    remoteness,
    community_controlled,
    min_contracts = 0,
    limit: rawLimit = 50,
  } = body;

  const startedAt = new Date().toISOString();
  const supabase = getServiceSupabase();

  let discovery;
  try {
    discovery = await runProcurementDiscovery(supabase, {
      state,
      postcode,
      lga,
      entity_types,
      remoteness,
      community_controlled,
      min_contracts,
      limit: rawLimit,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to run supplier discovery';
    await logProcurementWorkflowRun(supabase, {
      userId: user.id,
      workflowType: 'discover',
      workflowStatus: 'failed',
      shortlistId: shortlist_id,
      inputPayload: { state, postcode, lga, entity_types, remoteness, community_controlled, min_contracts, limit: rawLimit },
      outputSummary: { error: message },
      errorCount: 1,
      startedAt,
    });
    return NextResponse.json({ error: message }, { status: message.includes('entity_type') ? 400 : 500 });
  }

  if (discovery.suppliers.length === 0) {
    await Promise.all([
      updateShortlistFilters(supabase, user.id, {
        ...discovery.appliedFilters,
      }, { shortlistId: shortlist_id }),
      logProcurementWorkflowRun(supabase, {
        userId: user.id,
        workflowType: 'discover',
        workflowStatus: 'completed',
        shortlistId: shortlist_id,
        inputPayload: discovery.appliedFilters,
        outputSummary: { total_found: 0, with_federal_contracts: 0 },
        recordsScanned: 0,
        recordsChanged: 0,
        startedAt,
      }),
    ]);
    return NextResponse.json({ suppliers: [], summary: discovery.summary, filters_applied: discovery.appliedFilters });
  }

  logUsage({ user_id: user.id, endpoint: 'discover', filters: { state, postcode, lga, remoteness }, result_count: discovery.suppliers.length });
  await Promise.all([
    updateShortlistFilters(supabase, user.id, {
      ...discovery.appliedFilters,
    }, { shortlistId: shortlist_id }),
    logProcurementWorkflowRun(supabase, {
      userId: user.id,
      workflowType: 'discover',
      workflowStatus: 'completed',
      shortlistId: shortlist_id,
      inputPayload: discovery.appliedFilters,
      outputSummary: {
        total_found: discovery.suppliers.length,
        with_federal_contracts: discovery.summary.with_federal_contracts,
        indigenous_businesses: discovery.summary.indigenous_businesses,
        social_enterprises: discovery.summary.social_enterprises,
      },
      recordsScanned: discovery.recordsScanned,
      recordsChanged: discovery.suppliers.length,
      startedAt,
    }),
  ]);

  return NextResponse.json({
    suppliers: discovery.suppliers,
    summary: discovery.summary,
    filters_applied: discovery.appliedFilters,
  });
}
