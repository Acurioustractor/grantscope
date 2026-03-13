import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { decisionTagLabel } from '@/lib/procurement-shortlist';

export type ProcurementPdfRecord = Record<string, unknown>;

export interface ProcurementDecisionPdfPayload {
  orgName: string | null;
  preparedBy: string;
  packId: string;
  memoTitle: string;
  shortlistName: string;
  versionNumber: number;
  createdAt: string;
  sourceShortlistUpdatedAt: string | null;
  decisionDueAt: string | null;
  approvalStatus: string | null;
  approvalSnapshot: ProcurementPdfRecord;
  decisionBrief: ProcurementPdfRecord;
  decisionCounts: ProcurementPdfRecord;
  reviewedSuppliers: ProcurementPdfRecord[];
  recommendedPartners: ProcurementPdfRecord[];
  supplierShortlist: ProcurementPdfRecord[];
  taskQueue: ProcurementPdfRecord[];
  signoffComments: ProcurementPdfRecord[];
  marketOverview: ProcurementPdfRecord;
  datasetList: string[];
  packIsLockedApproval: boolean;
  shortlistChangedSincePack: boolean;
}

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_SIZES = {
  tiny: 8,
  label: 9,
  body: 11,
  section: 13,
  title: 26,
  heading: 18,
} as const;

const COLORS = {
  black: rgb(0.08, 0.08, 0.08),
  muted: rgb(0.42, 0.42, 0.42),
  red: rgb(0.87, 0.11, 0.12),
  yellow: rgb(0.95, 0.78, 0.12),
  blue: rgb(0.11, 0.28, 0.82),
  green: rgb(0.06, 0.6, 0.41),
  canvas: rgb(0.97, 0.96, 0.93),
  white: rgb(1, 1, 1),
  border: rgb(0.14, 0.14, 0.14),
} as const;

function textValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numericValue(value: unknown) {
  return typeof value === 'number' ? value : Number(value || 0);
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

function truncateText(value: unknown, maxLength = 220) {
  const text = textValue(value);
  if (!text) return 'No analyst note was recorded for this supplier in the saved pack.';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}…`;
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

function pluralise(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
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
    return 'Analyst should address the requested changes, update affected suppliers and evidence, then generate a fresh version for resubmission.';
  }
  if (shortlistChangedSincePack) {
    return 'This shortlist has changed since the memo was generated. Produce a fresh version before sending it for sign-off or external use.';
  }
  if (openTaskCount > 0) {
    return 'Work the remaining review tasks, complete supplier decisions, and generate an updated memo once the queue is clear enough for sign-off.';
  }
  return 'This memo is ready for procurement lead review. Confirm the recommendation summary and submit the shortlist for sign-off.';
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

function checklistProgress(checklist: ProcurementPdfRecord) {
  const keys = ['fit', 'risk_checked', 'evidence_checked', 'decision_made'];
  const checked = keys.filter((key) => checklist[key] === true).length;
  return { checked, total: keys.length };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'decision-memo';
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  const paragraphs = text.replace(/\r/g, '').split('\n');

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      lines.push('');
      continue;
    }

    let current = '';
    for (const word of trimmed.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else if (!current) {
        lines.push(word);
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }

  return lines.length > 0 ? lines : [''];
}

function drawWrappedText(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    maxWidth: number;
    font: PDFFont;
    size: number;
    color: ReturnType<typeof rgb>;
    lineGap?: number;
  },
) {
  const lines = wrapText(text, options.font, options.size, options.maxWidth);
  const lineHeight = options.size + (options.lineGap ?? 4);
  let cursorY = options.y;
  for (const line of lines) {
    if (line) {
      page.drawText(line, {
        x: options.x,
        y: cursorY,
        size: options.size,
        font: options.font,
        color: options.color,
      });
    }
    cursorY -= lineHeight;
  }
  return cursorY;
}

export async function buildProcurementDecisionPdf(payload: ProcurementDecisionPdfPayload) {
  const decisionAsk = buildDecisionAsk(
    payload.approvalStatus,
    payload.packIsLockedApproval,
    payload.shortlistChangedSincePack,
    payload.taskQueue.filter((task) => String(task.status || 'open') !== 'done').length,
  );
  const recommendedCount = Number(payload.decisionCounts.priority || 0) + Number(payload.decisionCounts.engage || 0);
  const formalRecommendation = buildFormalRecommendation(
    payload.shortlistName,
    recommendedCount,
    payload.reviewedSuppliers.length,
    payload.taskQueue.filter((task) => String(task.status || 'open') !== 'done').length,
    textValue(payload.decisionBrief.next_action),
  );
  const preparedFor = payload.orgName ? `${payload.orgName} procurement leadership` : 'Procurement leadership';
  const sortedReviewedSuppliers = [...payload.reviewedSuppliers].sort((left, right) => {
    const leftChecklist = checklistProgress((left.review_checklist as ProcurementPdfRecord) || {});
    const rightChecklist = checklistProgress((right.review_checklist as ProcurementPdfRecord) || {});
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
      : payload.recommendedPartners.length > 0
        ? payload.recommendedPartners
        : payload.supplierShortlist
  ).slice(0, 8);
  const openTasks = payload.taskQueue.filter((task) => String(task.status || 'open') !== 'done').slice(0, 8);

  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages: PDFPage[] = [];
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN;

  const drawPageChrome = (currentPage: PDFPage, pageIndex: number, totalPages = 1) => {
    currentPage.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 28, width: CONTENT_WIDTH, height: 2, color: COLORS.black });
    currentPage.drawRectangle({ x: MARGIN, y: 28, width: CONTENT_WIDTH, height: 1, color: COLORS.border });
    currentPage.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 56, width: 22, height: 22, color: COLORS.red });
    currentPage.drawRectangle({ x: MARGIN + 5, y: PAGE_HEIGHT - 51, width: 12, height: 12, color: COLORS.white });
    currentPage.drawText('CivicGraph Procurement Decision Memo', {
      x: MARGIN + 32,
      y: PAGE_HEIGHT - 47,
      size: FONT_SIZES.tiny,
      font: bold,
      color: COLORS.muted,
    });
    currentPage.drawText(`Page ${pageIndex} of ${totalPages}`, {
      x: MARGIN,
      y: 16,
      size: FONT_SIZES.tiny,
      font: regular,
      color: COLORS.muted,
    });
    currentPage.drawText(payload.packId, {
      x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(payload.packId, FONT_SIZES.tiny),
      y: 16,
      size: FONT_SIZES.tiny,
      font: regular,
      color: COLORS.muted,
    });
  };

  const startPage = () => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    y = PAGE_HEIGHT - 72;
  };

  const ensureSpace = (height: number) => {
    if (y - height < 48) startPage();
  };

  const drawSectionLabel = (label: string) => {
    ensureSpace(24);
    page.drawText(label.toUpperCase(), {
      x: MARGIN,
      y,
      size: FONT_SIZES.label,
      font: bold,
      color: COLORS.muted,
    });
    y -= 18;
  };

  const drawParagraph = (text: string, size: number = FONT_SIZES.body, font: PDFFont = regular, color = COLORS.black) => {
    const lines = wrapText(text, font, size, CONTENT_WIDTH);
    const needed = lines.length * (size + 4) + 4;
    ensureSpace(needed);
    y = drawWrappedText(page, text, {
      x: MARGIN,
      y,
      maxWidth: CONTENT_WIDTH,
      font,
      size,
      color,
    });
    y -= 4;
  };

  const drawKeyValueGrid = (items: Array<{ label: string; value: string }>) => {
    const columnWidth = (CONTENT_WIDTH - 16) / 2;
    for (let index = 0; index < items.length; index += 2) {
      ensureSpace(80);
      const row = items.slice(index, index + 2);
      row.forEach((item, itemIndex) => {
        const x = MARGIN + itemIndex * (columnWidth + 16);
        page.drawRectangle({
          x,
          y: y - 66,
          width: columnWidth,
          height: 66,
          borderColor: COLORS.border,
          borderWidth: 1.5,
          color: COLORS.canvas,
        });
        page.drawText(item.label.toUpperCase(), {
          x: x + 10,
          y: y - 16,
          size: FONT_SIZES.tiny,
          font: bold,
          color: COLORS.muted,
        });
        drawWrappedText(page, item.value, {
          x: x + 10,
          y: y - 32,
          maxWidth: columnWidth - 20,
          font: bold,
          size: FONT_SIZES.body,
          color: COLORS.black,
          lineGap: 3,
        });
      });
      y -= 80;
    }
  };

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 180, width: PAGE_WIDTH, height: 180, color: COLORS.black });
  page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 74, width: 26, height: 26, color: COLORS.red });
  page.drawRectangle({ x: MARGIN + 6, y: PAGE_HEIGHT - 68, width: 14, height: 14, color: COLORS.white });
  page.drawText('CivicGraph Procurement Decision Memo', {
    x: MARGIN + 36,
    y: PAGE_HEIGHT - 58,
    size: FONT_SIZES.label,
    font: bold,
    color: COLORS.yellow,
  });
  y = PAGE_HEIGHT - 102;
  drawParagraph(payload.memoTitle, FONT_SIZES.title, bold, COLORS.white);
  drawParagraph(
    'Saved procurement recommendation, sign-off, and audit record.',
    FONT_SIZES.body,
    regular,
    rgb(0.92, 0.92, 0.92),
  );
  y -= 28;

  page.drawRectangle({
    x: MARGIN,
    y: y - 86,
    width: CONTENT_WIDTH,
    height: 86,
    color: COLORS.yellow,
    borderColor: COLORS.border,
    borderWidth: 1.5,
  });
  page.drawText('DECISION ASK', {
    x: MARGIN + 14,
    y: y - 18,
    size: FONT_SIZES.tiny,
    font: bold,
    color: COLORS.muted,
  });
  drawWrappedText(page, decisionAsk, {
    x: MARGIN + 14,
    y: y - 42,
    maxWidth: CONTENT_WIDTH - 28,
    font: bold,
    size: FONT_SIZES.heading,
    color: COLORS.black,
    lineGap: 4,
  });
  y -= 104;

  drawSectionLabel('Prepared memo details');
  drawKeyValueGrid([
    { label: 'Prepared for', value: preparedFor },
    { label: 'Prepared by', value: payload.preparedBy },
    { label: 'Purpose', value: 'Procurement recommendation, sign-off, and audit record' },
    { label: 'Generated at', value: fmtDateTime(payload.createdAt) },
    { label: 'Source shortlist', value: payload.shortlistName },
    { label: 'Decision due', value: fmtDate(payload.decisionDueAt) },
  ]);

  drawSectionLabel('Formal recommendation');
  drawParagraph(formalRecommendation, FONT_SIZES.heading, bold);
  drawParagraph(String(payload.decisionBrief.recommendation_summary || 'No recommendation summary was recorded for this memo.'));

  ensureSpace(96);
  drawSectionLabel('Current governance state');
  drawParagraph(`Approval status: ${approvalStatusLabel(payload.approvalStatus)}`, FONT_SIZES.body, bold);
  drawParagraph(
    `Shortlist owner: ${textValue(payload.decisionBrief.owner_name) || 'Not assigned'} | Approver: ${
      textValue(payload.approvalSnapshot.approver_name) || textValue(payload.approvalSnapshot.approver_user_id) || 'Not assigned'
    }`,
  );
  drawParagraph(
    `Open tasks: ${openTasks.length} | Reviewed suppliers: ${payload.reviewedSuppliers.length} | Priority or engage: ${recommendedCount}`,
  );

  ensureSpace(72);
  drawSectionLabel('Decision-ready supplier set');
  for (const supplier of recommendedSupplierCards) {
    const checklist = checklistProgress((supplier.review_checklist as ProcurementPdfRecord) || {});
    const evidence = (supplier.evidence_snapshot as ProcurementPdfRecord) || {};
    const contractValue = numericValue(supplier.contract_total_value) || numericValue((supplier.contracts as ProcurementPdfRecord)?.total_value);
    const contractCount = numericValue(supplier.contract_count) || numericValue((supplier.contracts as ProcurementPdfRecord)?.count);
    const supplierName = textValue(supplier.supplier_name) || textValue(supplier.name) || 'Unknown supplier';
    const location = compactStrings([textValue(supplier.lga_name), textValue(supplier.lga), textValue(supplier.state)]).join(', ');
    const metaLine = compactStrings([
      `Decision ${decisionTagLabel(typeof supplier.decision_tag === 'string' ? supplier.decision_tag : null)}`,
      textValue(supplier.supplier_abn) ? `ABN ${textValue(supplier.supplier_abn)}` : null,
      location || null,
      contractCount > 0 ? `${contractCount} contracts / ${fmtMoney(contractValue)}` : null,
    ]).join(' | ');
    const evidenceLine = compactStrings([
      textValue(evidence.match_reason) || 'Shortlist review evidence',
      `${numericValue(evidence.source_count)} sources`,
      textValue(evidence.confidence) || 'Confidence not set',
      `${checklist.checked}/${checklist.total} checks complete`,
    ]).join(' | ');

    ensureSpace(128);
    page.drawRectangle({
      x: MARGIN,
      y: y - 110,
      width: CONTENT_WIDTH,
      height: 110,
      borderColor: COLORS.border,
      borderWidth: 1.5,
      color: COLORS.white,
    });
    page.drawText(supplierName, {
      x: MARGIN + 12,
      y: y - 20,
      size: FONT_SIZES.section,
      font: bold,
      color: COLORS.black,
    });
    drawWrappedText(page, metaLine || 'Location and ABN not captured in this memo.', {
      x: MARGIN + 12,
      y: y - 38,
      maxWidth: CONTENT_WIDTH - 24,
      font: regular,
      size: FONT_SIZES.label,
      color: COLORS.muted,
    });
    drawWrappedText(page, evidenceLine, {
      x: MARGIN + 12,
      y: y - 56,
      maxWidth: CONTENT_WIDTH - 24,
      font: regular,
      size: FONT_SIZES.label,
      color: COLORS.black,
    });
    drawWrappedText(page, truncateText(supplier.note), {
      x: MARGIN + 12,
      y: y - 76,
      maxWidth: CONTENT_WIDTH - 24,
      font: regular,
      size: FONT_SIZES.body,
      color: COLORS.black,
    });
    y -= 124;
  }

  startPage();
  drawSectionLabel('Open work and sign-off');
  drawParagraph(`Prepared for: ${preparedFor}`);
  drawParagraph(`Prepared by: ${payload.preparedBy}`);
  drawParagraph(`Current status: ${approvalStatusLabel(payload.approvalStatus)}`);
  drawParagraph(
    `Requested by: ${textValue(payload.approvalSnapshot.requested_by_name) || textValue(payload.approvalSnapshot.requested_by) || 'Not recorded'} | Approved by: ${
      textValue(payload.approvalSnapshot.approved_by_name) || textValue(payload.approvalSnapshot.approved_by) || 'Pending approval'
    }`,
  );

  if (openTasks.length > 0) {
    drawSectionLabel('Open review tasks');
    for (const task of openTasks) {
      ensureSpace(60);
      page.drawRectangle({
        x: MARGIN,
        y: y - 48,
        width: CONTENT_WIDTH,
        height: 48,
        borderColor: COLORS.border,
        borderWidth: 1,
        color: COLORS.canvas,
      });
      page.drawText(String(task.title || 'Untitled task'), {
        x: MARGIN + 10,
        y: y - 17,
        size: FONT_SIZES.body,
        font: bold,
        color: COLORS.black,
      });
      const taskMeta = compactStrings([
        String(task.status || 'open'),
        String(task.priority || 'medium'),
        textValue(task.assignee_label) ? `Owner ${textValue(task.assignee_label)}` : null,
        textValue(task.due_at) ? `Due ${fmtDateTime(String(task.due_at))}` : null,
      ]).join(' | ');
      page.drawText(taskMeta, {
        x: MARGIN + 10,
        y: y - 32,
        size: FONT_SIZES.label,
        font: regular,
        color: COLORS.muted,
      });
      y -= 58;
    }
  }

  if (payload.signoffComments.length > 0) {
    drawSectionLabel('Latest sign-off discussion');
    for (const comment of payload.signoffComments.slice(0, 6)) {
      ensureSpace(70);
      page.drawText(
        `${String(comment.comment_type || 'discussion').replace(/_/g, ' ')} - ${String(comment.author_label || comment.author_user_id || 'Unknown reviewer')}`,
        {
          x: MARGIN,
          y,
          size: FONT_SIZES.label,
          font: bold,
          color: COLORS.red,
        },
      );
      y -= 14;
      drawParagraph(String(comment.body || ''));
    }
  }

  startPage();
  drawSectionLabel('Appendix - full shortlist evidence');
  drawParagraph(`This appendix preserves the reviewed supplier evidence captured when the memo was generated. Datasets: ${payload.datasetList.length > 0 ? payload.datasetList.join(' | ') : 'No dataset labels were captured in this saved pack.'}`);
  for (const supplier of sortedReviewedSuppliers) {
    const checklist = checklistProgress((supplier.review_checklist as ProcurementPdfRecord) || {});
    const evidence = (supplier.evidence_snapshot as ProcurementPdfRecord) || {};
    const datasetBadges = compactStrings([
      ...((Array.isArray(evidence.source_datasets) ? evidence.source_datasets : []) as unknown[]),
      ...((Array.isArray(evidence.datasets) ? evidence.datasets : []) as unknown[]),
      ...((Array.isArray(supplier.dataset_badges) ? supplier.dataset_badges : []) as unknown[]),
    ]).slice(0, 6);
    const supplierName = textValue(supplier.supplier_name) || 'Unknown supplier';
    const location = compactStrings([textValue(supplier.lga_name), textValue(supplier.state)]).join(', ');
    const note = textValue(supplier.note) || 'No analyst note was recorded.';
    const blockLines = [
      supplierName,
      compactStrings([
        `Decision ${decisionTagLabel(typeof supplier.decision_tag === 'string' ? supplier.decision_tag : null)}`,
        textValue(supplier.supplier_abn) ? `ABN ${textValue(supplier.supplier_abn)}` : null,
        location || null,
      ]).join(' | '),
      compactStrings([
        textValue(evidence.match_reason) || 'Shortlist review evidence',
        `${numericValue(evidence.source_count)} sources`,
        textValue(evidence.confidence) || 'Confidence not set',
        `${checklist.checked}/${checklist.total} checks complete`,
      ]).join(' | '),
      note,
      datasetBadges.length > 0 ? `Datasets: ${datasetBadges.join(', ')}` : 'Datasets: not captured',
    ];
    const estimatedHeight = 18 + blockLines.length * 18 + 12;
    ensureSpace(estimatedHeight);
    page.drawRectangle({
      x: MARGIN,
      y: y - estimatedHeight + 8,
      width: CONTENT_WIDTH,
      height: estimatedHeight,
      borderColor: COLORS.border,
      borderWidth: 1,
      color: COLORS.white,
    });
    page.drawText(blockLines[0], {
      x: MARGIN + 10,
      y: y - 14,
      size: FONT_SIZES.body,
      font: bold,
      color: COLORS.black,
    });
    let blockY = y - 30;
    for (const line of blockLines.slice(1)) {
      blockY = drawWrappedText(page, line, {
        x: MARGIN + 10,
        y: blockY,
        maxWidth: CONTENT_WIDTH - 20,
        font: regular,
        size: FONT_SIZES.label,
        color: COLORS.black,
      });
      blockY -= 2;
    }
    y -= estimatedHeight + 8;
  }

  const totalPages = pages.length;
  pages.forEach((currentPage, index) => drawPageChrome(currentPage, index + 1, totalPages));

  const bytes = await pdfDoc.save();
  return {
    bytes,
    filename: `${slugify(payload.memoTitle)}-v${payload.versionNumber}.pdf`,
  };
}
