import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createSupabaseServer } from '@/lib/supabase-server';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import { decisionTagBadgeClass, decisionTagLabel } from '@/lib/procurement-shortlist';
import { PrintDecisionMemoButton } from './print-decision-memo-button';

type JsonRecord = Record<string, unknown>;

const REVIEW_CHECKLIST_KEYS = [
  ['fit', 'Fit checked'],
  ['risk_checked', 'Risk checked'],
  ['evidence_checked', 'Evidence checked'],
  ['decision_made', 'Decision recorded'],
] as const;

function fmtMoney(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return '—';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function fmtDateTime(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function fmtDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function readObject(value: unknown) {
  return typeof value === 'object' && value ? (value as JsonRecord) : {};
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function approvalStatusLabel(value: string | null | undefined) {
  switch (value) {
    case 'approved':
      return 'Approved';
    case 'submitted':
      return 'Submitted For Sign-Off';
    case 'changes_requested':
      return 'Changes Requested';
    case 'review_ready':
      return 'Review Ready';
    default:
      return 'Draft';
  }
}

function approvalStatusClass(value: string | null | undefined) {
  switch (value) {
    case 'approved':
      return 'border-money bg-money-light text-money';
    case 'submitted':
      return 'border-bauhaus-blue bg-link-light text-bauhaus-blue';
    case 'changes_requested':
      return 'border-bauhaus-red bg-error-light text-bauhaus-red';
    case 'review_ready':
      return 'border-bauhaus-yellow bg-warning-light text-bauhaus-black';
    default:
      return 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted';
  }
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

function truncateText(value: unknown, maxLength = 220) {
  const text = textValue(value);
  if (!text) return 'No analyst note was recorded for this supplier in the saved pack.';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
}

function checklistProgress(checklist: JsonRecord) {
  const checked = REVIEW_CHECKLIST_KEYS.filter(([key]) => checklist[key] === true).length;
  return {
    checked,
    total: REVIEW_CHECKLIST_KEYS.length,
    complete: checked === REVIEW_CHECKLIST_KEYS.length,
  };
}

function decisionPriority(value: unknown) {
  switch (value) {
    case 'priority':
      return 0;
    case 'engage':
      return 1;
    case 'reviewing':
      return 2;
    case 'monitor':
      return 3;
    case 'not_now':
      return 5;
    default:
      return 4;
  }
}

function numericValue(value: unknown) {
  return typeof value === 'number' ? value : Number(value || 0);
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

function buildDecisionAsk(
  approvalStatus: string | null | undefined,
  packIsLockedApproval: boolean,
  shortlistChangedSincePack: boolean,
  openTaskCount: number,
) {
  if (packIsLockedApproval) {
    return 'Use this memo as the live approved procurement record. Only reopen the shortlist if the market view, supplier evidence, or recommendation changes materially.';
  }
  if (approvalStatus === 'submitted') {
    return 'Approver should review this memo, confirm open risks and task coverage, then approve or request changes against this saved pack.';
  }
  if (approvalStatus === 'changes_requested') {
    return 'Analyst should address the requested changes, update affected suppliers and evidence, then generate a fresh pack version for resubmission.';
  }
  if (shortlistChangedSincePack) {
    return 'This shortlist has changed since the memo was generated. Produce a fresh version before sending it for sign-off or external use.';
  }
  if (openTaskCount > 0) {
    return 'Work the remaining review tasks, complete supplier decisions, and generate an updated memo once the queue is clear enough for sign-off.';
  }
  return 'This memo is ready for procurement lead review. Confirm the recommendation summary and submit the shortlist for sign-off.';
}

function pluralise(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function buildFormalRecommendation(
  shortlistName: string,
  recommendedCount: number,
  reviewedCount: number,
  openTaskCount: number,
  nextAction: string | null,
) {
  const carryForwardCount = recommendedCount > 0 ? recommendedCount : reviewedCount;
  const supplierPhrase = carryForwardCount > 0
    ? `carry forward ${pluralise(carryForwardCount, 'supplier')} from ${shortlistName}`
    : `continue reviewing ${pluralise(reviewedCount, 'supplier')} in ${shortlistName}`;
  const nextStep = nextAction || 'move to the next procurement step once the shortlist is accepted';
  const gating = openTaskCount > 0
    ? ` This recommendation is subject to closing ${pluralise(openTaskCount, 'open review task')} or explicitly accepting those residual gaps.`
    : '';

  return `Recommendation: ${supplierPhrase} and proceed to ${nextStep}.${gating}`;
}

export default async function ProcurementDecisionPackPage(
  { params }: { params: Promise<{ exportId: string }> },
) {
  const { exportId } = await params;
  const authSupabase = await createSupabaseServer();
  const { data: { user } } = await authSupabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const serviceDb = getServiceSupabase();
  const orgContext = await getCurrentOrgProfileContext(serviceDb, user.id);
  if (!orgContext.orgProfileId) {
    notFound();
  }

  const { data: packExport, error } = await serviceDb
    .from('procurement_pack_exports')
    .select('id, shortlist_id, title, version_number, export_summary, pack_payload, evidence_snapshot, source_shortlist_updated_at, superseded_at, created_at')
    .eq('id', exportId)
    .eq('org_profile_id', orgContext.orgProfileId)
    .single();

  if (error || !packExport) {
    notFound();
  }

  const { data: currentShortlist } = await serviceDb
    .from('procurement_shortlists')
    .select('id, name, approval_status, updated_at, last_pack_export_id, approved_pack_export_id, approval_lock_active, approval_locked_at, reopened_at')
    .eq('id', packExport.shortlist_id)
    .eq('org_profile_id', orgContext.orgProfileId)
    .maybeSingle();

  const { data: shortlistPackHistory } = await serviceDb
    .from('procurement_pack_exports')
    .select('id, title, version_number, created_at, superseded_at')
    .eq('shortlist_id', packExport.shortlist_id)
    .eq('org_profile_id', orgContext.orgProfileId)
    .order('version_number', { ascending: false })
    .limit(6);

  const exportSummary = readObject(packExport.export_summary);
  const packPayload = readObject(packExport.pack_payload);
  const evidenceSnapshot = readObject(packExport.evidence_snapshot);
  const decisionBrief = readObject(evidenceSnapshot.decision_brief);
  const approvalSnapshot = readObject(evidenceSnapshot.approval_snapshot);
  const shortlistSummary = readObject(evidenceSnapshot.shortlist_summary);
  const signoffComments = readArray(evidenceSnapshot.signoff_comments) as JsonRecord[];
  const reviewedSuppliers = readArray(evidenceSnapshot.reviewed_suppliers) as JsonRecord[];
  const taskQueue = readArray(evidenceSnapshot.task_queue) as JsonRecord[];
  const packSections = readObject(packPayload.sections);
  const marketOverview = readObject(packSections.market_overview);
  const complianceAnalysis = readObject(packSections.compliance_analysis);
  const supplierShortlist = readArray(packSections.supplier_shortlist) as JsonRecord[];
  const bidStrength = readObject(packSections.bid_strength);
  const recommendedPartners = readArray(packSections.recommended_partners) as JsonRecord[];
  const decisionCounts = readObject(shortlistSummary.decision_counts || exportSummary.decision_counts);
  const approvalStatus = typeof approvalSnapshot.approval_status === 'string'
    ? approvalSnapshot.approval_status
    : currentShortlist?.approval_status || null;
  const packIsLockedApproval = currentShortlist?.approved_pack_export_id === packExport.id;
  const packIsLatest = currentShortlist?.last_pack_export_id === packExport.id;
  const shortlistChangedSincePack = currentShortlist
    ? new Date(currentShortlist.updated_at).getTime() > new Date(packExport.created_at).getTime()
    : false;
  const governanceNextStep = packIsLockedApproval && currentShortlist?.approval_lock_active
    ? 'This pack is the live approved decision record. Keep using this version unless the shortlist needs to be reopened.'
    : approvalStatus === 'changes_requested'
      ? 'Changes were requested after this pack. Update the shortlist, generate a fresh version, and resubmit.'
      : shortlistChangedSincePack
        ? 'The shortlist changed after this export. Generate a new pack version before relying on it for sign-off.'
        : packExport.superseded_at
          ? 'This pack is now historical only. Open the latest version for current decision work.'
          : packIsLatest
            ? 'This is the current working pack for the shortlist.'
            : 'This pack remains part of the shortlist history.';

  const sortedReviewedSuppliers = [...reviewedSuppliers].sort((left, right) => {
    const leftChecklist = checklistProgress(readObject(left.review_checklist));
    const rightChecklist = checklistProgress(readObject(right.review_checklist));
    const decisionDelta = decisionPriority(left.decision_tag) - decisionPriority(right.decision_tag);
    if (decisionDelta !== 0) return decisionDelta;
    const checklistDelta = rightChecklist.checked - leftChecklist.checked;
    if (checklistDelta !== 0) return checklistDelta;
    const contractDelta = numericValue(right.contract_total_value) - numericValue(left.contract_total_value);
    if (contractDelta !== 0) return contractDelta;
    return String(left.supplier_name || left.gs_id || '').localeCompare(String(right.supplier_name || right.gs_id || ''));
  });

  const recommendedSupplierCards = (
    sortedReviewedSuppliers.length > 0
      ? sortedReviewedSuppliers
      : recommendedPartners.length > 0
        ? recommendedPartners
        : supplierShortlist
  ).slice(0, 6);

  const openTasks = taskQueue.filter((task) => String(task.status || 'open') !== 'done');
  const taskCounts = {
    open: openTasks.length,
    urgent: openTasks.filter((task) => String(task.priority || '').toLowerCase() === 'urgent').length,
  };
  const checklistTotals = sortedReviewedSuppliers.reduce<{ checked: number; total: number }>(
    (totals, supplier) => {
      const progress = checklistProgress(readObject(supplier.review_checklist));
      return {
        checked: totals.checked + progress.checked,
        total: totals.total + progress.total,
      };
    },
    { checked: 0, total: 0 },
  );
  const datasetList = compactStrings([
    ...extractDatasets(shortlistSummary.source_datasets, exportSummary.source_datasets, marketOverview.source_datasets),
    ...sortedReviewedSuppliers.flatMap((supplier) => {
      const evidence = readObject(supplier.evidence_snapshot);
      return extractDatasets(evidence.source_datasets, evidence.datasets, supplier.dataset_badges);
    }),
  ]).slice(0, 10);
  const decisionAsk = buildDecisionAsk(approvalStatus, packIsLockedApproval, shortlistChangedSincePack, taskCounts.open);
  const shortlistName = textValue(exportSummary.shortlist_name) || currentShortlist?.name || 'Procurement shortlist';
  const memoTitle = textValue(packExport.title) || `${shortlistName} Decision Memo`;
  const recommendedCount = Number(decisionCounts.priority || 0) + Number(decisionCounts.engage || 0);
  const reviewerCount = signoffComments.length;
  const approvalNotes = textValue(approvalSnapshot.approval_notes);
  const latestComments = signoffComments.slice(0, 5);
  const packTimeline = shortlistPackHistory || [];
  const preparedFor = orgContext.profile?.name
    ? `${orgContext.profile.name} procurement leadership`
    : 'Procurement leadership';
  const preparedBy = user.email || textValue(approvalSnapshot.requested_by_name) || 'Current workspace user';
  const memoPurpose = 'Procurement recommendation, sign-off, and audit record';
  const formalRecommendation = buildFormalRecommendation(
    shortlistName,
    recommendedCount,
    reviewedSuppliers.length,
    taskCounts.open,
    textValue(decisionBrief.next_action),
  );
  const provenanceSummary = datasetList.length > 0
    ? datasetList.join(' • ')
    : 'Dataset labels were not captured in this saved pack.';

  return (
    <div className="min-h-screen bg-bauhaus-canvas print:bg-white">
      <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8 print:max-w-none print:px-0 print:py-0">
        <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/tender-intelligence?tab=pack&shortlistId=${packExport.shortlist_id}`}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-black text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
          >
            Back To Tender Intelligence
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <div className="text-xs font-bold text-bauhaus-muted">
              Saved {fmtDateTime(packExport.created_at)}
            </div>
            <Link
              href={`/tender-intelligence/exports/${packExport.id}/pdf`}
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border-2 border-bauhaus-blue text-bauhaus-blue hover:bg-bauhaus-blue hover:text-white transition-colors"
            >
              Download PDF
            </Link>
            <PrintDecisionMemoButton />
          </div>
        </div>

        <article className="border-4 border-bauhaus-black bg-white shadow-[12px_12px_0_0_rgba(0,0,0,0.08)] print:shadow-none">
          <header className="border-b-4 border-bauhaus-black">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
              <div className="bg-bauhaus-black px-6 py-8 text-white print:px-8">
                <p className="text-[10px] font-black uppercase tracking-[0.32em] text-bauhaus-yellow">
                  CivicGraph Procurement Decision Memo
                </p>
                <h1 className="mt-4 text-3xl font-black tracking-tight md:text-5xl">{memoTitle}</h1>
                <p className="mt-4 max-w-3xl text-base font-medium leading-relaxed text-white/80">
                  This memo freezes the procurement recommendation, supplier evidence, governance state, and review activity captured at the time of export.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="border border-white/30 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                    V{packExport.version_number}
                  </span>
                  <span className="border border-white/30 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-white">
                    {shortlistName}
                  </span>
                  <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${approvalStatusClass(approvalStatus)}`}>
                    {approvalStatusLabel(approvalStatus)}
                  </span>
                  {packIsLockedApproval && (
                    <span className="border border-money bg-money-light px-2 py-1 text-[10px] font-black uppercase tracking-widest text-money">
                      Approved Record
                    </span>
                  )}
                  {packIsLatest && !packIsLockedApproval && (
                    <span className="border border-bauhaus-blue bg-link-light px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                      Latest Draft
                    </span>
                  )}
                  {packExport.superseded_at && (
                    <span className="border border-bauhaus-red bg-error-light px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                      Superseded
                    </span>
                  )}
                  {shortlistChangedSincePack && (
                    <span className="border border-bauhaus-yellow bg-warning-light px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
                      Shortlist Changed Since Export
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-bauhaus-yellow px-6 py-8 print:px-8">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-bauhaus-black/60">
                  Decision Ask
                </p>
                <p className="mt-4 text-2xl font-black leading-tight text-bauhaus-black">
                  {decisionAsk}
                </p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Memo saved', value: fmtDateTime(packExport.created_at) },
                    { label: 'Decision due', value: fmtDate(typeof decisionBrief.decision_due_at === 'string' ? decisionBrief.decision_due_at : null) },
                    { label: 'Shortlist owner', value: textValue(decisionBrief.owner_name) || 'Not assigned' },
                    { label: 'Assigned approver', value: textValue(approvalSnapshot.approver_name) || textValue(approvalSnapshot.approver_user_id) || 'Not assigned' },
                  ].map((item) => (
                    <div key={item.label} className="border-2 border-bauhaus-black bg-white px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{item.label}</p>
                      <p className="mt-2 text-sm font-black text-bauhaus-black">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </header>

          <section className="border-b-4 border-bauhaus-black">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="border-b-4 border-bauhaus-black px-6 py-6 lg:border-b-0 lg:border-r-4 print:px-8">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-bauhaus-muted">Prepared memo details</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Prepared for', value: preparedFor },
                    { label: 'Prepared by', value: preparedBy },
                    { label: 'Purpose', value: memoPurpose },
                    { label: 'Record ID', value: packExport.id },
                    { label: 'Source shortlist', value: shortlistName },
                    { label: 'Generated at', value: fmtDateTime(packExport.created_at) },
                  ].map((item) => (
                    <div key={item.label} className="border-2 border-bauhaus-black bg-bauhaus-canvas px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{item.label}</p>
                      <p className="mt-2 text-sm font-black leading-relaxed text-bauhaus-black break-words">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-bauhaus-red px-6 py-6 text-white print:px-8">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/70">Formal recommendation</p>
                <p className="mt-4 text-2xl font-black leading-tight">{formalRecommendation}</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="border-2 border-white/30 bg-white/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Decision basis</p>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-white">
                      {recommendedCount > 0
                        ? `${pluralise(recommendedCount, 'supplier')} are currently tagged as priority or engage.`
                        : `No suppliers are yet tagged priority or engage; this memo records the current review state.`}
                    </p>
                  </div>
                  <div className="border-2 border-white/30 bg-white/10 px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/70">Use of memo</p>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-white">
                      Use this document for shortlist review, approval discussion, and exportable audit evidence. Generate a new version if the shortlist changes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-0 border-b-4 border-bauhaus-black lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
            <div className="border-b-4 border-bauhaus-black px-6 py-6 lg:border-b-0 lg:border-r-4 print:px-8">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-bauhaus-muted">Executive recommendation</p>
              <p className="mt-4 text-2xl font-black leading-tight text-bauhaus-black whitespace-pre-wrap">
                {String(decisionBrief.recommendation_summary || 'No recommendation summary was recorded for this memo.')}
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[
                  { label: 'Why now', value: decisionBrief.why_now, tone: 'bg-bauhaus-canvas' },
                  { label: 'Risks to review', value: decisionBrief.risk_summary, tone: 'bg-error-light' },
                  { label: 'Next action', value: decisionBrief.next_action, tone: 'bg-link-light' },
                  { label: 'Governance note', value: governanceNextStep, tone: 'bg-warning-light' },
                ].map((block) => (
                  <div key={block.label} className={`border-2 border-bauhaus-black p-4 ${block.tone}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{block.label}</p>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-black whitespace-pre-wrap">
                      {String(block.value || '—')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="bg-bauhaus-canvas px-6 py-6 print:px-8">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-bauhaus-muted">Memo facts</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {[
                  { label: 'Suppliers', value: String(exportSummary.supplier_count || 0) },
                  { label: 'Reviewed', value: String(exportSummary.reviewed_supplier_count || reviewedSuppliers.length || 0) },
                  { label: 'Priority or engage', value: String(recommendedCount) },
                  { label: 'Open tasks', value: String(taskCounts.open) },
                  { label: 'Checklist items checked', value: checklistTotals.total > 0 ? `${checklistTotals.checked}/${checklistTotals.total}` : '—' },
                  { label: 'Discussion entries', value: String(reviewerCount) },
                ].map((metric) => (
                  <div key={metric.label} className="border-2 border-bauhaus-black bg-white px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{metric.label}</p>
                    <p className="mt-2 text-2xl font-black text-bauhaus-black">{metric.value}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 border-2 border-bauhaus-black bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Approval record</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${approvalStatusClass(approvalStatus)}`}>
                    {approvalStatusLabel(approvalStatus)}
                  </span>
                  {Boolean(approvalSnapshot.requested_at) && (
                    <span className="border border-bauhaus-black/20 bg-bauhaus-canvas px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                      Requested {fmtDateTime(String(approvalSnapshot.requested_at))}
                    </span>
                  )}
                  {Boolean(approvalSnapshot.approved_at) && (
                    <span className="border border-money bg-money-light px-2 py-1 text-[10px] font-black uppercase tracking-widest text-money">
                      Approved {fmtDateTime(String(approvalSnapshot.approved_at))}
                    </span>
                  )}
                </div>
                <div className="mt-3 space-y-2 text-sm font-medium text-bauhaus-black">
                  <p>Requested by: {textValue(approvalSnapshot.requested_by_name) || textValue(approvalSnapshot.requested_by) || '—'}</p>
                  <p>Approver: {textValue(approvalSnapshot.approver_name) || textValue(approvalSnapshot.approver_user_id) || '—'}</p>
                  <p>Approved by: {textValue(approvalSnapshot.approved_by_name) || textValue(approvalSnapshot.approved_by) || '—'}</p>
                </div>
                {approvalNotes && (
                  <div className="mt-4 border-2 border-bauhaus-black bg-bauhaus-canvas p-3">
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Approval notes</p>
                    <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-black whitespace-pre-wrap">
                      {approvalNotes}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-4 border-2 border-bauhaus-black bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Evidence coverage</p>
                <div className="mt-3 space-y-2 text-sm font-medium text-bauhaus-black">
                  <p>Shortlist updated at export: {fmtDateTime(packExport.source_shortlist_updated_at)}</p>
                  <p>Current shortlist state: {approvalStatusLabel(currentShortlist?.approval_status || null)}</p>
                  {currentShortlist?.approval_lock_active && (
                    <p>Approval lock active since {fmtDateTime(currentShortlist.approval_locked_at)}</p>
                  )}
                  {currentShortlist?.reopened_at && !currentShortlist.approval_lock_active && (
                    <p>Reopened {fmtDateTime(currentShortlist.reopened_at)}</p>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {datasetList.length === 0 ? (
                    <span className="text-sm font-medium text-bauhaus-muted">No dataset labels were captured in the evidence snapshot.</span>
                  ) : (
                    datasetList.map((dataset) => (
                      <span
                        key={dataset}
                        className="border border-bauhaus-black px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-black"
                      >
                        {dataset}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </aside>
          </section>

          <section className="border-b-4 border-bauhaus-black print:break-before-page" style={{ breakBefore: 'page' }}>
            <div className="border-b-4 border-bauhaus-black bg-money px-6 py-4 text-white print:px-8">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-white/70">Recommended supplier set</p>
              <h2 className="mt-2 text-2xl font-black">Decision-ready organisations to carry forward</h2>
            </div>
            {recommendedSupplierCards.length === 0 ? (
              <div className="px-6 py-6 text-sm font-medium text-bauhaus-muted print:px-8">
                No supplier snapshot was attached to this memo.
              </div>
            ) : (
              <div className="grid gap-0 md:grid-cols-2 xl:grid-cols-3">
                {recommendedSupplierCards.map((supplier, index) => {
                  const checklist = checklistProgress(readObject(supplier.review_checklist));
                  const evidence = readObject(supplier.evidence_snapshot);
                  const contractValue = numericValue(supplier.contract_total_value) || numericValue(readObject(supplier.contracts).total_value);
                  const contractCount = numericValue(supplier.contract_count) || numericValue(readObject(supplier.contracts).count);
                  const datasetBadges = extractDatasets(evidence.source_datasets, evidence.datasets, supplier.dataset_badges).slice(0, 4);
                  const location = compactStrings([
                    textValue(supplier.lga_name),
                    textValue(supplier.lga),
                    textValue(supplier.state),
                  ]).join(', ');
                  const supplierName = textValue(supplier.supplier_name) || textValue(supplier.name) || 'Unknown supplier';
                  return (
                    <div
                      key={`${supplier.gs_id || supplierName || index}`}
                      className="border-b-4 border-bauhaus-black p-6 md:border-r-4 xl:[&:nth-child(3n)]:border-r-0 print:break-inside-avoid print:px-8"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${decisionTagBadgeClass(typeof supplier.decision_tag === 'string' ? supplier.decision_tag : null)}`}
                            >
                              {decisionTagLabel(typeof supplier.decision_tag === 'string' ? supplier.decision_tag : null)}
                            </span>
                            {contractCount > 0 && (
                              <span className="border border-bauhaus-black bg-bauhaus-canvas px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
                                {contractCount} contracts
                              </span>
                            )}
                          </div>
                          <h3 className="mt-3 text-xl font-black leading-tight text-bauhaus-black">{supplierName}</h3>
                          <p className="mt-2 text-sm font-medium text-bauhaus-muted">
                            {compactStrings([
                              textValue(supplier.supplier_abn) ? `ABN ${textValue(supplier.supplier_abn)}` : null,
                              location || null,
                            ]).join(' • ') || 'Location and ABN not captured in this memo.'}
                          </p>
                        </div>
                        {typeof supplier.gs_id === 'string' && (
                          <Link
                            href={`/entities/${supplier.gs_id}`}
                            className="print:hidden border-2 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                          >
                            Open Dossier
                          </Link>
                        )}
                      </div>

                      <p className="mt-4 text-sm font-medium leading-relaxed text-bauhaus-black">
                        {truncateText(supplier.note)}
                      </p>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="border-2 border-bauhaus-black bg-bauhaus-canvas px-3 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Evidence</p>
                          <p className="mt-2 text-sm font-black text-bauhaus-black">
                            {textValue(evidence.match_reason) || 'Shortlist review evidence'}
                          </p>
                          <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                            {numericValue(evidence.source_count)} sources • {textValue(evidence.confidence) || 'Confidence not set'}
                          </p>
                        </div>
                        <div className="border-2 border-bauhaus-black bg-white px-3 py-3">
                          <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Review coverage</p>
                          <p className="mt-2 text-sm font-black text-bauhaus-black">
                            {checklist.checked}/{checklist.total} checks complete
                          </p>
                          <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                            {contractCount > 0 ? `${contractCount} contracts • ${fmtMoney(contractValue)}` : 'No contract history captured in pack'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        {REVIEW_CHECKLIST_KEYS.map(([key, label]) => (
                          <span
                            key={key}
                            className={`border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${
                              readObject(supplier.review_checklist)[key] === true
                                ? 'border-money bg-money-light text-money'
                                : 'border-bauhaus-black/20 bg-bauhaus-canvas text-bauhaus-muted'
                            }`}
                          >
                            {label}
                          </span>
                        ))}
                      </div>

                      {datasetBadges.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {datasetBadges.map((dataset) => (
                            <span
                              key={dataset}
                              className="border border-bauhaus-black px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-black"
                            >
                              {dataset}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="grid gap-0 border-b-4 border-bauhaus-black lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.95fr)]">
            <div className="border-b-4 border-bauhaus-black px-6 py-6 lg:border-b-0 lg:border-r-4 print:px-8">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-bauhaus-muted">Market and compliance picture</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Suppliers identified', String(marketOverview.suppliers_identified || 0)],
                  ['Indigenous businesses', String(marketOverview.indigenous_businesses || 0)],
                  ['Social enterprises', String(marketOverview.social_enterprises || 0)],
                  ['With federal contracts', String(marketOverview.with_federal_contracts || 0)],
                ].map(([label, value]) => (
                  <div key={label} className="border-2 border-bauhaus-black bg-bauhaus-canvas px-4 py-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</p>
                    <p className="mt-2 text-3xl font-black text-bauhaus-black">{value}</p>
                  </div>
                ))}
              </div>

              {Object.keys(complianceAnalysis).length > 0 && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {[
                    { label: 'Indigenous participation', snapshot: readObject(complianceAnalysis.indigenous) },
                    { label: 'Social enterprise', snapshot: readObject(complianceAnalysis.social_enterprise) },
                    { label: 'Regional coverage', snapshot: readObject(complianceAnalysis.regional) },
                  ].map(({ label, snapshot }) => (
                    <div key={label} className="border-2 border-bauhaus-black bg-white px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{label}</p>
                      <p className="mt-2 text-3xl font-black text-bauhaus-black">{String(snapshot.pct || 0)}%</p>
                      <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                        {String(snapshot.count || 0)} suppliers
                        {numericValue(snapshot.shortfall_value) > 0 ? ` • shortfall ${fmtMoney(numericValue(snapshot.shortfall_value))}` : ''}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {readArray(bidStrength.insights).length > 0 && (
                <div className="mt-4 border-2 border-bauhaus-black bg-bauhaus-canvas p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Bid strength insights</p>
                  <div className="mt-3 space-y-2">
                    {readArray(bidStrength.insights).slice(0, 6).map((insight, index) => (
                      <p key={`${insight}-${index}`} className="text-sm font-medium leading-relaxed text-bauhaus-black">
                        {String(insight)}
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="bg-bauhaus-canvas px-6 py-6 print:px-8">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-bauhaus-muted">Outstanding work and discussion</p>

              <div className="mt-4 border-2 border-bauhaus-black bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Open tasks at export</p>
                {openTasks.length === 0 ? (
                  <p className="mt-3 text-sm font-medium text-bauhaus-muted">
                    No review tasks were open when this memo was generated.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {openTasks.slice(0, 6).map((task, index) => (
                      <div key={String(task.id || index)} className="border-2 border-bauhaus-black bg-bauhaus-canvas px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <span className="border border-bauhaus-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
                            {String(task.status || 'open')}
                          </span>
                          <span className="border border-bauhaus-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
                            {String(task.priority || 'medium')}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-black text-bauhaus-black">{String(task.title || 'Untitled task')}</p>
                        <p className="mt-2 text-xs font-medium leading-relaxed text-bauhaus-muted">
                          {compactStrings([
                            textValue(task.assignee_label) ? `Owner ${textValue(task.assignee_label)}` : null,
                            textValue(task.due_at) ? `Due ${fmtDateTime(String(task.due_at))}` : null,
                          ]).join(' • ') || 'No owner or due date captured.'}
                        </p>
                        {textValue(task.description) && (
                          <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-black whitespace-pre-wrap">
                            {String(task.description)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 border-2 border-bauhaus-black bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Sign-off discussion</p>
                {latestComments.length === 0 ? (
                  <p className="mt-3 text-sm font-medium text-bauhaus-muted">
                    No reviewer discussion was attached to this memo.
                  </p>
                ) : (
                  <div className="mt-3 space-y-3">
                    {latestComments.map((comment, index) => (
                      <div key={String(comment.id || index)} className="border-l-4 border-bauhaus-black pl-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">
                            {String(comment.comment_type || 'discussion').replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs font-bold text-bauhaus-muted">
                            {String(comment.author_label || comment.author_user_id || 'Unknown reviewer')} • {fmtDateTime(typeof comment.created_at === 'string' ? comment.created_at : null)}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-black whitespace-pre-wrap">
                          {String(comment.body || '')}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="border-b-4 border-bauhaus-black px-6 py-6 print:break-before-page print:px-8" style={{ breakBefore: 'page' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-bauhaus-muted">Decision history</p>
                <h2 className="mt-2 text-2xl font-black text-bauhaus-black">Pack timeline and current record</h2>
              </div>
              {packTimeline.length > 0 && (
                <p className="text-sm font-medium text-bauhaus-muted">
                  Latest pack version available: V{packTimeline[0]?.version_number || packExport.version_number}
                </p>
              )}
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {packTimeline.map((historyPack) => (
                <div key={historyPack.id} className="border-2 border-bauhaus-black bg-bauhaus-canvas p-4 print:break-inside-avoid">
                  <div className="flex flex-wrap gap-2">
                    <span className="border border-bauhaus-black bg-white px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-black">
                      V{historyPack.version_number}
                    </span>
                    {currentShortlist?.approved_pack_export_id === historyPack.id && (
                      <span className="border border-money bg-money-light px-2 py-1 text-[10px] font-black uppercase tracking-widest text-money">
                        Approved record
                      </span>
                    )}
                    {currentShortlist?.last_pack_export_id === historyPack.id && currentShortlist?.approved_pack_export_id !== historyPack.id && (
                      <span className="border border-bauhaus-blue bg-link-light px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-blue">
                        Latest draft
                      </span>
                    )}
                    {historyPack.superseded_at && (
                      <span className="border border-bauhaus-red bg-error-light px-2 py-1 text-[10px] font-black uppercase tracking-widest text-bauhaus-red">
                        Superseded
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-lg font-black text-bauhaus-black">{historyPack.title}</p>
                  <p className="mt-2 text-xs font-medium text-bauhaus-muted">
                    Saved {fmtDateTime(historyPack.created_at)}
                  </p>
                  <div className="mt-4 print:hidden">
                    <Link
                      href={`/tender-intelligence/exports/${historyPack.id}`}
                      className="inline-flex border-2 border-bauhaus-black px-3 py-2 text-[10px] font-black uppercase tracking-widest text-bauhaus-black hover:bg-bauhaus-black hover:text-white transition-colors"
                    >
                      Open Pack
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <footer className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_minmax(340px,0.85fr)]">
            <div className="border-b-4 border-bauhaus-black px-6 py-5 lg:border-b-0 lg:border-r-4 print:px-8">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-bauhaus-muted">Provenance and usage</p>
              <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-black">
                This saved pack reflects the shortlist, evidence, comments, and governance state captured at export time. If the shortlist has been reopened or changed since then, generate a new memo before using it as a sign-off record.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="border-2 border-bauhaus-black bg-bauhaus-canvas p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Source shortlist timestamp</p>
                  <p className="mt-2 text-sm font-black text-bauhaus-black">{fmtDateTime(packExport.source_shortlist_updated_at)}</p>
                </div>
                <div className="border-2 border-bauhaus-black bg-bauhaus-canvas p-4">
                  <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Current status</p>
                  <p className="mt-2 text-sm font-black text-bauhaus-black">{governanceNextStep}</p>
                </div>
              </div>
              <div className="mt-4 border-2 border-bauhaus-black bg-white p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Evidence datasets</p>
                <p className="mt-2 text-sm font-medium leading-relaxed text-bauhaus-black">{provenanceSummary}</p>
              </div>
            </div>

            <div className="px-6 py-5 print:px-8">
              <p className="text-[10px] font-black uppercase tracking-[0.28em] text-bauhaus-muted">Approval signature block</p>
              <div className="mt-4 space-y-4">
                {[
                  {
                    label: 'Prepared by',
                    person: preparedBy,
                    meta: `Saved ${fmtDateTime(packExport.created_at)}`,
                  },
                  {
                    label: 'Requested by',
                    person: textValue(approvalSnapshot.requested_by_name) || textValue(approvalSnapshot.requested_by) || 'Not recorded',
                    meta: textValue(approvalSnapshot.requested_at) ? `Requested ${fmtDateTime(String(approvalSnapshot.requested_at))}` : 'Not yet requested',
                  },
                  {
                    label: 'Approved by',
                    person: textValue(approvalSnapshot.approved_by_name) || textValue(approvalSnapshot.approved_by) || 'Pending approval',
                    meta: textValue(approvalSnapshot.approved_at) ? `Approved ${fmtDateTime(String(approvalSnapshot.approved_at))}` : 'Approval pending',
                  },
                ].map((signature) => (
                  <div key={signature.label} className="border-2 border-bauhaus-black bg-white p-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">{signature.label}</p>
                    <p className="mt-2 text-sm font-black text-bauhaus-black">{signature.person}</p>
                    <div className="mt-4 border-t-2 border-bauhaus-black pt-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-bauhaus-muted">Signature / record line</p>
                      <p className="mt-2 text-xs font-medium text-bauhaus-muted">{signature.meta}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
