import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import { buildProcurementDecisionPdf, type ProcurementPdfRecord } from '@/lib/procurement-decision-pdf';

function readObject(value: unknown) {
  return typeof value === 'object' && value ? (value as ProcurementPdfRecord) : {};
}

function readArray(value: unknown) {
  return Array.isArray(value) ? (value as ProcurementPdfRecord[]) : [];
}

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function compactStrings(values: unknown[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    seen.add(trimmed);
  }
  return Array.from(seen);
}

function extractDatasets(...values: unknown[]) {
  const datasets: string[] = [];
  for (const value of values) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string') datasets.push(item);
      }
    }
  }
  return compactStrings(datasets);
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ exportId: string }> }) {
  const { exportId } = await params;
  const authSupabase = await createSupabaseServer();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const serviceDb = getServiceSupabase();
  const orgContext = await getCurrentOrgProfileContext(serviceDb, user.id);
  if (!orgContext.orgProfileId) {
    return NextResponse.json({ error: 'No organisation context' }, { status: 404 });
  }

  const { data: packExport } = await serviceDb
    .from('procurement_pack_exports')
    .select('id, shortlist_id, title, version_number, export_summary, pack_payload, evidence_snapshot, source_shortlist_updated_at, created_at')
    .eq('id', exportId)
    .eq('org_profile_id', orgContext.orgProfileId)
    .single();

  if (!packExport) {
    return NextResponse.json({ error: 'Pack not found' }, { status: 404 });
  }

  const { data: currentShortlist } = await serviceDb
    .from('procurement_shortlists')
    .select('id, name, approval_status, updated_at, approved_pack_export_id')
    .eq('id', packExport.shortlist_id)
    .eq('org_profile_id', orgContext.orgProfileId)
    .maybeSingle();

  const exportSummary = readObject(packExport.export_summary);
  const packPayload = readObject(packExport.pack_payload);
  const evidenceSnapshot = readObject(packExport.evidence_snapshot);
  const decisionBrief = readObject(evidenceSnapshot.decision_brief);
  const approvalSnapshot = readObject(evidenceSnapshot.approval_snapshot);
  const shortlistSummary = readObject(evidenceSnapshot.shortlist_summary);
  const signoffComments = readArray(evidenceSnapshot.signoff_comments);
  const reviewedSuppliers = readArray(evidenceSnapshot.reviewed_suppliers);
  const taskQueue = readArray(evidenceSnapshot.task_queue);
  const packSections = readObject(packPayload.sections);
  const marketOverview = readObject(packSections.market_overview);
  const recommendedPartners = readArray(packSections.recommended_partners);
  const supplierShortlist = readArray(packSections.supplier_shortlist);
  const decisionCounts = readObject(shortlistSummary.decision_counts || exportSummary.decision_counts);
  const approvalStatus = typeof approvalSnapshot.approval_status === 'string'
    ? approvalSnapshot.approval_status
    : currentShortlist?.approval_status || null;
  const packIsLockedApproval = currentShortlist?.approved_pack_export_id === packExport.id;
  const shortlistChangedSincePack = currentShortlist
    ? new Date(currentShortlist.updated_at).getTime() > new Date(packExport.created_at).getTime()
    : false;
  const datasetList = compactStrings([
    ...extractDatasets(shortlistSummary.source_datasets, exportSummary.source_datasets, marketOverview.source_datasets),
    ...reviewedSuppliers.flatMap((supplier) => {
      const evidence = readObject(supplier.evidence_snapshot);
      return extractDatasets(evidence.source_datasets, evidence.datasets, supplier.dataset_badges);
    }),
  ]).slice(0, 12);
  const shortlistName = textValue(exportSummary.shortlist_name) || currentShortlist?.name || 'Procurement shortlist';
  const memoTitle = textValue(packExport.title) || `${shortlistName} Decision Memo`;

  const pdf = await buildProcurementDecisionPdf({
    orgName: orgContext.profile?.name ?? null,
    preparedBy: user.email || textValue(approvalSnapshot.requested_by_name) || 'Current workspace user',
    packId: packExport.id,
    memoTitle,
    shortlistName,
    versionNumber: packExport.version_number || 1,
    createdAt: packExport.created_at,
    sourceShortlistUpdatedAt: packExport.source_shortlist_updated_at,
    decisionDueAt: typeof decisionBrief.decision_due_at === 'string' ? decisionBrief.decision_due_at : null,
    approvalStatus,
    approvalSnapshot,
    decisionBrief,
    decisionCounts,
    reviewedSuppliers,
    recommendedPartners,
    supplierShortlist,
    taskQueue,
    signoffComments,
    marketOverview,
    datasetList,
    packIsLockedApproval,
    shortlistChangedSincePack,
  });

  return new NextResponse(Buffer.from(pdf.bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdf.filename}"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
