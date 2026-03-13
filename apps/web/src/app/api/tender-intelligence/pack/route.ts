import { NextRequest, NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/supabase';
import { getDecisionPackBlockers } from '@/lib/procurement-pack-readiness';
import { requireModule } from '@/lib/api-auth';
import { logUsage } from '../_lib/log-usage';
import {
  createProcurementPackExport,
  getProcurementContext,
  logProcurementWorkflowRun,
  normalizeReviewChecklist,
  updateProcurementShortlistSummary,
} from '../_lib/procurement-workspace';

/** Escape SQL LIKE wildcards in user input */
function sanitizeLike(s: string) {
  return s.replace(/[%_\\]/g, c => `\\${c}`);
}

/**
 * POST /api/tender-intelligence/pack
 *
 * Generate a full Tender Intelligence Pack — combines supplier discovery,
 * enrichment, compliance scoring, and gap analysis into one structured output.
 *
 * Input: geography + category + optional supplier list
 * Output: complete pack with 5 sections
 */

interface PackRequest {
  shortlist_id?: string;
  state?: string;
  postcode?: string;
  lga?: string;
  category?: string;
  remoteness?: string;
  supplier_types?: string[];
  existing_suppliers?: Array<{ name: string; abn?: string; contract_value?: number }>;
  total_contract_value?: number;
}

export async function POST(request: NextRequest) {
  const auth = await requireModule('procurement');
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json() as PackRequest;
  const supabase = getServiceSupabase();

  const {
    shortlist_id,
    state,
    postcode,
    lga,
    category,
    remoteness,
    supplier_types = ['indigenous_corp', 'social_enterprise', 'charity', 'company'],
    existing_suppliers = [],
    total_contract_value,
  } = body;
  const startedAt = new Date().toISOString();
  let packBlockers: string[] = [];

  // ── Section 1: Market Capability Overview ──
  let entityQuery = supabase
    .from('gs_entities')
    .select('gs_id, canonical_name, abn, entity_type, state, postcode, remoteness, seifa_irsd_decile, is_community_controlled, lga_name, latest_revenue, sector')
    .in('entity_type', supplier_types)
    .order('latest_revenue', { ascending: false, nullsFirst: false })
    .limit(200);

  if (state && typeof state === 'string') entityQuery = entityQuery.eq('state', state.slice(0, 10));
  if (postcode && typeof postcode === 'string') entityQuery = entityQuery.eq('postcode', postcode.slice(0, 10));
  if (lga && typeof lga === 'string') entityQuery = entityQuery.ilike('lga_name', `%${sanitizeLike(lga.slice(0, 100))}%`);
  if (remoteness && typeof remoteness === 'string') entityQuery = entityQuery.eq('remoteness', remoteness);

  const { data: entities } = await entityQuery;
  const allEntities = entities || [];

  // Get contract counts for all discovered entities
  const abns = allEntities.filter(e => e.abn).map(e => e.abn!);
  const contractMap: Record<string, { count: number; total_value: number; categories: string[] }> = {};

  if (abns.length > 0) {
    // Batch in chunks of 100
    for (let i = 0; i < abns.length; i += 100) {
      const batch = abns.slice(i, i + 100);
      const { data: contracts } = await supabase
        .from('austender_contracts')
        .select('supplier_abn, contract_value, category')
        .in('supplier_abn', batch);

      if (contracts) {
        for (const c of contracts) {
          if (!c.supplier_abn) continue;
          if (!contractMap[c.supplier_abn]) {
            contractMap[c.supplier_abn] = { count: 0, total_value: 0, categories: [] };
          }
          contractMap[c.supplier_abn].count++;
          contractMap[c.supplier_abn].total_value += c.contract_value || 0;
          if (c.category && !contractMap[c.supplier_abn].categories.includes(c.category)) {
            contractMap[c.supplier_abn].categories.push(c.category);
          }
        }
      }
    }
  }

  const marketOverview = {
    suppliers_identified: allEntities.length,
    indigenous_businesses: allEntities.filter(e => e.entity_type === 'indigenous_corp').length,
    social_enterprises: allEntities.filter(e => e.entity_type === 'social_enterprise').length,
    community_controlled: allEntities.filter(e => e.is_community_controlled).length,
    charities: allEntities.filter(e => e.entity_type === 'charity').length,
    with_federal_contracts: allEntities.filter(e => e.abn && contractMap[e.abn]).length,
    total_contract_value: Object.values(contractMap).reduce((sum, c) => sum + c.total_value, 0),
  };

  // ── Section 2: Compliance Analysis (if existing suppliers provided) ──
  let complianceAnalysis = null;
  if (existing_suppliers.length > 0) {
    // Bulk resolve: ABNs in one query, names in parallel batches
    const abnSuppliers = existing_suppliers.filter(s => s.abn);
    const abnEntityMap = new Map<string, { entity_type: string; is_community_controlled: boolean; remoteness: string | null; latest_revenue: number | null }>();

    if (abnSuppliers.length > 0) {
      const abns = abnSuppliers.map(s => s.abn!.replace(/\s/g, '').slice(0, 11));
      for (let i = 0; i < abns.length; i += 100) {
        const batch = abns.slice(i, i + 100);
        const { data } = await supabase
          .from('gs_entities')
          .select('abn, entity_type, is_community_controlled, remoteness, latest_revenue')
          .in('abn', batch);
        if (data) {
          for (const row of data) {
            if (row.abn) abnEntityMap.set(row.abn, row);
          }
        }
      }
    }

    const nameOnlySuppliers = existing_suppliers.filter(s => {
      if (s.abn) return !abnEntityMap.has(s.abn.replace(/\s/g, '').slice(0, 11));
      return !!s.name;
    });
    const nameEntityMap = new Map<string, { entity_type: string; is_community_controlled: boolean; remoteness: string | null; latest_revenue: number | null }>();

    if (nameOnlySuppliers.length > 0) {
      const BATCH = 10;
      for (let i = 0; i < nameOnlySuppliers.length; i += BATCH) {
        const batch = nameOnlySuppliers.slice(i, i + BATCH);
        const results = await Promise.all(
          batch.map(s =>
            supabase
              .from('gs_entities')
              .select('entity_type, is_community_controlled, remoteness, latest_revenue')
              .ilike('canonical_name', `%${sanitizeLike((s.name || '').slice(0, 200))}%`)
              .limit(1)
              .single()
              .then(({ data }) => ({ name: s.name, entity: data }))
          )
        );
        for (const r of results) {
          if (r.entity) nameEntityMap.set(r.name, r.entity);
        }
      }
    }

    const resolved = existing_suppliers.map(s => {
      let entity = null;
      if (s.abn) {
        entity = abnEntityMap.get(s.abn.replace(/\s/g, '').slice(0, 11)) || null;
      }
      if (!entity && s.name) {
        entity = nameEntityMap.get(s.name) || null;
      }
      return { ...s, entity };
    });

    const totalVal = total_contract_value || resolved.reduce((sum, r) => sum + (r.contract_value || 0), 0) || 1;
    const indCount = resolved.filter(r => r.entity?.entity_type === 'indigenous_corp').length;
    const seCount = resolved.filter(r => r.entity?.entity_type === 'social_enterprise').length;
    const regionalCount = resolved.filter(r => r.entity?.remoteness && r.entity.remoteness !== 'Major Cities of Australia').length;

    const indVal = resolved.filter(r => r.entity?.entity_type === 'indigenous_corp').reduce((s, r) => s + (r.contract_value || 0), 0);

    complianceAnalysis = {
      indigenous: {
        count: indCount,
        pct: +(indCount / Math.max(existing_suppliers.length, 1) * 100).toFixed(1),
        value: indVal,
        pct_value: +(indVal / totalVal * 100).toFixed(1),
        target: 3.0,
        meets_target: (indVal / totalVal * 100) >= 3.0,
        shortfall_value: Math.max(0, (0.03 * totalVal) - indVal),
      },
      social_enterprise: {
        count: seCount,
        pct: +(seCount / Math.max(existing_suppliers.length, 1) * 100).toFixed(1),
      },
      regional: {
        count: regionalCount,
        pct: +(regionalCount / Math.max(existing_suppliers.length, 1) * 100).toFixed(1),
      },
      total_suppliers: existing_suppliers.length,
      total_resolved: resolved.filter(r => r.entity).length,
    };
  }

  // ── Section 3: Supplier Shortlist (top 20) ──
  const supplierShortlist = allEntities
    .map(e => ({
      gs_id: e.gs_id,
      name: e.canonical_name,
      abn: e.abn,
      entity_type: e.entity_type,
      state: e.state,
      postcode: e.postcode,
      remoteness: e.remoteness,
      seifa_decile: e.seifa_irsd_decile,
      is_community_controlled: e.is_community_controlled,
      lga: e.lga_name,
      revenue: e.latest_revenue,
      contracts: contractMap[e.abn || ''] || { count: 0, total_value: 0 },
    }))
    .sort((a, b) => b.contracts.count - a.contracts.count || (b.revenue || 0) - (a.revenue || 0))
    .slice(0, 20);

  // ── Section 4: Bid Strength Analysis ──
  const bidStrength = {
    total_capable_suppliers: allEntities.length,
    suppliers_with_contract_history: Object.keys(contractMap).length,
    indigenous_capable: allEntities.filter(e => e.entity_type === 'indigenous_corp').length,
    se_capable: allEntities.filter(e => e.entity_type === 'social_enterprise').length,
    insights: [] as string[],
  };

  if (bidStrength.indigenous_capable > 0) {
    bidStrength.insights.push(
      `${bidStrength.indigenous_capable} Indigenous businesses identified in ${state || 'the target region'} — adding ${Math.min(3, bidStrength.indigenous_capable)} would strengthen Indigenous procurement compliance.`
    );
  }
  if (bidStrength.se_capable > 0) {
    bidStrength.insights.push(
      `${bidStrength.se_capable} social enterprises operate in the region — potential for social procurement targets.`
    );
  }
  if (complianceAnalysis && !complianceAnalysis.indigenous.meets_target) {
    const shortfall = complianceAnalysis.indigenous.shortfall_value;
    bidStrength.insights.push(
      `Current Indigenous participation is ${complianceAnalysis.indigenous.pct_value}% — ${shortfall > 0 ? `$${Math.round(shortfall).toLocaleString()} shortfall against 3% target` : 'below 3% target'}.`
    );
  }

  // ── Section 5: Recommended Partners ──
  const recommended = allEntities
    .filter(e => e.entity_type === 'indigenous_corp' || e.entity_type === 'social_enterprise' || e.is_community_controlled)
    .map(e => ({
      gs_id: e.gs_id,
      name: e.canonical_name,
      abn: e.abn,
      entity_type: e.entity_type,
      state: e.state,
      remoteness: e.remoteness,
      is_community_controlled: e.is_community_controlled,
      contracts: contractMap[e.abn || ''] || { count: 0, total_value: 0 },
      revenue: e.latest_revenue,
    }))
    .sort((a, b) => b.contracts.count - a.contracts.count || (b.revenue || 0) - (a.revenue || 0))
    .slice(0, 10);

  const packPayload = {
    generated_at: new Date().toISOString(),
    filters: { state, postcode, lga, category, remoteness, supplier_types },
    sections: {
      market_overview: marketOverview,
      compliance_analysis: complianceAnalysis,
      supplier_shortlist: supplierShortlist,
      bid_strength: bidStrength,
      recommended_partners: recommended,
    },
  };

  let workflowOutputSummary: Record<string, unknown> = {
    suppliers_identified: marketOverview.suppliers_identified,
    shortlist_size: supplierShortlist.length,
    recommended_count: recommended.length,
    compliance_score: complianceAnalysis
      ? {
          indigenous_meets_target: complianceAnalysis.indigenous.meets_target,
          indigenous_pct_value: complianceAnalysis.indigenous.pct_value,
        }
      : null,
  };
  let workflowStatus: 'completed' | 'failed' | 'blocked' = 'completed';
  let workflowRun: { id: string } | null = null;

  let packExport: { id: string; title: string; created_at: string } | null = null;
  if (shortlist_id) {
    const shortlistContext = await getProcurementContext(supabase, user.id, { shortlistId: shortlist_id });
    if (shortlistContext.shortlist && shortlistContext.orgProfileId) {
      const [
        { data: shortlistItems, error: shortlistItemsError },
        { data: shortlistTasks, error: shortlistTasksError },
        { data: shortlistComments, error: shortlistCommentsError },
      ] = await Promise.all([
        supabase
          .from('procurement_shortlist_items')
          .select('id, supplier_name, gs_id, supplier_abn, decision_tag, note, review_checklist, evidence_snapshot, contract_count, contract_total_value, state, lga_name, remoteness, updated_at, last_reviewed_at')
          .eq('shortlist_id', shortlistContext.shortlist.id)
          .order('updated_at', { ascending: false }),
        supabase
          .from('procurement_tasks')
          .select('id, title, status, priority, assignee_label, due_at, shortlist_item_id, completion_outcome, completion_note, completed_at')
          .eq('shortlist_id', shortlistContext.shortlist.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('procurement_shortlist_comments')
          .select('id, shortlist_item_id, pack_export_id, author_user_id, comment_type, body, created_at')
          .eq('shortlist_id', shortlistContext.shortlist.id)
          .is('shortlist_item_id', null)
          .order('created_at', { ascending: false })
          .limit(12),
      ]);

      if (shortlistItemsError) {
        return NextResponse.json({ error: shortlistItemsError.message }, { status: 500 });
      }

      if (shortlistTasksError) {
        return NextResponse.json({ error: shortlistTasksError.message }, { status: 500 });
      }

      if (shortlistCommentsError) {
        return NextResponse.json({ error: shortlistCommentsError.message }, { status: 500 });
      }

      const decisionCounts = (shortlistItems || []).reduce<Record<string, number>>((acc, item) => {
        const key = item.decision_tag || 'untriaged';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      const reviewedSuppliers = (shortlistItems || []).map((item) => {
        const checklist = normalizeReviewChecklist(item.review_checklist);
        const checklistComplete = Object.values(checklist).filter(Boolean).length;
        return {
          supplier_name: item.supplier_name,
          gs_id: item.gs_id,
          supplier_abn: item.supplier_abn,
          decision_tag: item.decision_tag,
          note: item.note,
          review_checklist: checklist,
          checklist_complete: checklistComplete,
          evidence_snapshot: item.evidence_snapshot || {},
          contract_count: item.contract_count,
          contract_total_value: item.contract_total_value,
          state: item.state,
          lga_name: item.lga_name,
          remoteness: item.remoteness,
          updated_at: item.updated_at,
          last_reviewed_at: item.last_reviewed_at,
        };
      });

      const reviewedSupplierCount = reviewedSuppliers.filter((item) => item.checklist_complete > 0 || item.decision_tag || item.note).length;
      const openTaskCount = (shortlistTasks || []).filter((task) => task.status !== 'done').length;
      const doneTaskCount = (shortlistTasks || []).filter((task) => task.status === 'done').length;
      const approvalUserIds = [
        shortlistContext.shortlist.requested_by,
        shortlistContext.shortlist.approved_by,
        shortlistContext.shortlist.approver_user_id,
        ...(shortlistComments || []).map((comment) => comment.author_user_id).filter((value): value is string => !!value),
      ].filter((value): value is string => !!value);
      const { data: approvalUsers, error: approvalUsersError } = approvalUserIds.length > 0
        ? await supabase
            .from('profiles')
            .select('id, display_name, full_name, email')
            .in('id', approvalUserIds)
        : { data: [], error: null };

      if (approvalUsersError) {
        return NextResponse.json({ error: approvalUsersError.message }, { status: 500 });
      }

      const approvalUserById = new Map(
        (approvalUsers || []).map((profile) => [
          profile.id,
          profile.display_name || profile.full_name || profile.email || null,
        ]),
      );

      const exportSummary = {
        generated_at: packPayload.generated_at,
        shortlist_name: shortlistContext.shortlist.name,
        supplier_count: reviewedSuppliers.length,
        reviewed_supplier_count: reviewedSupplierCount,
        decision_counts: decisionCounts,
        open_task_count: openTaskCount,
        completed_task_count: doneTaskCount,
        approval_status: shortlistContext.shortlist.approval_status,
        approver_user_id: shortlistContext.shortlist.approver_user_id,
      };

      const signoffComments = (shortlistComments || []).map((comment) => ({
        id: comment.id,
        pack_export_id: comment.pack_export_id,
        author_user_id: comment.author_user_id,
        author_label: comment.author_user_id ? approvalUserById.get(comment.author_user_id) || null : null,
        comment_type: comment.comment_type,
        body: comment.body,
        created_at: comment.created_at,
      }));

      packBlockers = getDecisionPackBlockers({
        shortlist: shortlistContext.shortlist,
        items: (shortlistItems || []).map((item) => ({
          id: item.id,
          supplier_name: item.supplier_name,
          decision_tag: item.decision_tag,
          note: item.note,
          review_checklist: item.review_checklist,
          evidence_snapshot: item.evidence_snapshot,
        })),
      }).map((blocker) => blocker.message);
      if (packBlockers.length > 0) {
        workflowStatus = 'blocked';
      }

      workflowOutputSummary = {
        ...workflowOutputSummary,
        reviewed_supplier_count: reviewedSupplierCount,
        open_task_count: openTaskCount,
        decision_counts: decisionCounts,
        blocker_count: packBlockers.length,
        blockers: packBlockers.slice(0, 8),
      };

      const evidenceSnapshot = {
        decision_brief: {
          recommendation_summary: shortlistContext.shortlist.recommendation_summary,
          why_now: shortlistContext.shortlist.why_now,
          risk_summary: shortlistContext.shortlist.risk_summary,
          next_action: shortlistContext.shortlist.next_action,
          owner_name: shortlistContext.shortlist.owner_name,
          owner_user_id: shortlistContext.shortlist.owner_user_id,
          approver_user_id: shortlistContext.shortlist.approver_user_id,
          approver_name: shortlistContext.shortlist.approver_user_id
            ? approvalUserById.get(shortlistContext.shortlist.approver_user_id) || null
            : null,
          decision_due_at: shortlistContext.shortlist.decision_due_at,
        },
        approval_snapshot: {
          approval_status: shortlistContext.shortlist.approval_status,
          approval_notes: shortlistContext.shortlist.approval_notes,
          requested_by: shortlistContext.shortlist.requested_by,
          requested_by_name: shortlistContext.shortlist.requested_by
            ? approvalUserById.get(shortlistContext.shortlist.requested_by) || null
            : null,
          requested_at: shortlistContext.shortlist.requested_at,
          approved_by: shortlistContext.shortlist.approved_by,
          approved_by_name: shortlistContext.shortlist.approved_by
            ? approvalUserById.get(shortlistContext.shortlist.approved_by) || null
            : null,
          approved_at: shortlistContext.shortlist.approved_at,
          last_pack_export_id: shortlistContext.shortlist.last_pack_export_id,
          approved_pack_export_id: shortlistContext.shortlist.approved_pack_export_id,
          approver_user_id: shortlistContext.shortlist.approver_user_id,
          approver_name: shortlistContext.shortlist.approver_user_id
            ? approvalUserById.get(shortlistContext.shortlist.approver_user_id) || null
            : null,
        },
        shortlist_summary: exportSummary,
        reviewed_suppliers: reviewedSuppliers,
        task_queue: shortlistTasks || [],
        signoff_comments: signoffComments,
      };

      if (packBlockers.length > 0) {
        logUsage({ user_id: user.id, endpoint: 'pack', filters: { state, lga, postcode, remoteness }, result_count: allEntities.length });
        workflowRun = await logProcurementWorkflowRun(supabase, {
          userId: user.id,
          workflowType: 'pack',
          workflowStatus,
          shortlistId: shortlist_id,
          inputPayload: {
            state: state || null,
            postcode: postcode || null,
            lga: lga || null,
            remoteness: remoteness || null,
            supplier_types,
            existing_supplier_count: existing_suppliers.length,
            total_contract_value: total_contract_value || null,
          },
          outputSummary: workflowOutputSummary,
          recordsScanned: allEntities.length,
          recordsChanged: 0,
          errorCount: packBlockers.length,
          startedAt,
        });

        return NextResponse.json({
          error: 'Decision pack blocked until the shortlist has enough evidence and governance detail.',
          blockers: packBlockers,
          workflow_run_id: workflowRun?.id || null,
        }, { status: 422 });
      }

      const createdExport = await createProcurementPackExport(supabase, user.id, {
        shortlistId: shortlistContext.shortlist.id,
        workflowRunId: null,
        title: `${shortlistContext.shortlist.name} Decision Pack`,
        exportSummary,
        packPayload,
        evidenceSnapshot,
      });

      if (createdExport) {
        await updateProcurementShortlistSummary(supabase, user.id, {
          shortlistId: shortlistContext.shortlist.id,
          lastPackExportId: createdExport.id,
        });
        packExport = {
          id: createdExport.id,
          title: createdExport.title,
          created_at: createdExport.created_at,
        };
      }
    }
  }

  if (packExport?.id) {
    workflowOutputSummary = {
      ...workflowOutputSummary,
      pack_export_id: packExport.id,
    };
  }

  logUsage({ user_id: user.id, endpoint: 'pack', filters: { state, lga, postcode, remoteness }, result_count: allEntities.length });
  workflowRun = await logProcurementWorkflowRun(supabase, {
    userId: user.id,
    workflowType: 'pack',
    workflowStatus,
    shortlistId: shortlist_id,
    inputPayload: {
      state: state || null,
      postcode: postcode || null,
      lga: lga || null,
      remoteness: remoteness || null,
      supplier_types,
      existing_supplier_count: existing_suppliers.length,
      total_contract_value: total_contract_value || null,
    },
    outputSummary: workflowOutputSummary,
    recordsScanned: allEntities.length,
    recordsChanged: supplierShortlist.length + recommended.length + (packExport ? 1 : 0),
    startedAt,
  });

  if (packExport?.id && workflowRun?.id) {
    const { error: workflowLinkError } = await supabase
      .from('procurement_pack_exports')
      .update({ workflow_run_id: workflowRun.id })
      .eq('id', packExport.id);

    if (workflowLinkError) {
      console.error('[procurement-pack-export-link]', workflowLinkError.message);
    }
  }

  return NextResponse.json({
    pack: packPayload,
    export: packExport,
  });
}
