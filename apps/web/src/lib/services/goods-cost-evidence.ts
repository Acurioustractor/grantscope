import { createHash } from 'crypto';

import { getServiceSupabase } from '@/lib/supabase';

const PROJECT_CODE = 'ACT-GD';
const LAST_50_START = '2025-10-08';
const LAST_50_END = '2025-12-02';
const LAST_50_COUNT = 50;

type XeroSupplierBill = {
  id: string;
  invoice_number: string | null;
  contact_name: string | null;
  status: string | null;
  date: string | null;
  total: number | string | null;
  amount_paid: number | string | null;
  amount_due: number | string | null;
  has_attachments: boolean | null;
  line_items: unknown;
  synced_at: string | null;
};

type MonthlyFinancialRow = {
  month: string | null;
  fy_ytd_expenses: number | string | null;
};

type XeroTransactionRow = {
  xero_transaction_id: string | null;
  contact_name: string | null;
  type: string | null;
  total: number | string | null;
  status: string | null;
  date: string | null;
  has_attachments: boolean | null;
  is_reconciled: boolean | null;
};

type DextReceiptRow = {
  xero_transaction_id: string | null;
  vendor_name: string | null;
  receipt_date: string | null;
  filename: string | null;
  match_confidence: number | null;
  match_method: string | null;
};

type XeroLineItem = {
  description?: string | null;
  line_amount?: number | string | null;
  account_code?: string | null;
};

export type GoodsCostAllocationDecision =
  | 'needs_allocation'
  | 'include_direct'
  | 'show_separately'
  | 'exclude'
  | 'needs_receipt'
  | 'needs_review';

export type GoodsCostAllocationScope =
  | 'unallocated'
  | 'last_50'
  | 'current_batch'
  | 'specific_assets'
  | 'shared_service';

type GoodsCostAllocationDecisionRow = {
  line_fingerprint: string;
  decision: GoodsCostAllocationDecision;
  allocation_scope: GoodsCostAllocationScope;
  notes: string | null;
  decided_at: string | null;
};

const GOODS_COST_DECISIONS: GoodsCostAllocationDecision[] = [
  'needs_allocation',
  'include_direct',
  'show_separately',
  'exclude',
  'needs_receipt',
  'needs_review',
];

export type GoodsCostAllocationSaveInput = {
  lineFingerprint: string;
  lineIndex: number;
  xeroInvoiceId: string;
  invoice: string;
  supplier: string;
  accountCode: string;
  account: string;
  description: string;
  amount: string;
  category: string;
  decision: GoodsCostAllocationDecision;
  allocationScope?: GoodsCostAllocationScope;
  notes?: string | null;
  decidedBy?: string | null;
};

export type GoodsCostEvidence = {
  status: 'live' | 'empty' | 'error';
  decision: string;
  totals: Array<{ label: string; value: string; detail: string }>;
  costBoundaryRows: Array<{
    label: string;
    treatment: 'quote in direct cost' | 'show separately' | 'approve before quoting';
    detail: string;
    examples: string;
  }>;
  unitEstimateRows: Array<{
    label: string;
    value: string;
    use: string;
    basis: string;
    confidence: 'use now' | 'planning' | 'proxy only' | 'do not quote';
  }>;
  costInputRows: Array<{
    input: string;
    status: 'known-source' | 'finance-backed' | 'allocation-gap';
    wikiEvidence: string;
    financeEvidence: string;
    stillNeeded: string;
    sourceDocs: string;
  }>;
  costAllocationRows: Array<{
    lineFingerprint: string;
    lineIndex: number;
    xeroInvoiceId: string;
    supplier: string;
    invoice: string;
    date: string;
    amount: string;
    category: string;
    directCostTreatment: 'include when allocated' | 'show separately' | 'review before quoting';
    batchStatus: string;
    proofStatus: string;
    action: string;
    account: string;
    accountCode: string;
    description: string;
    currentDecision: GoodsCostAllocationDecision;
    allocationScope: GoodsCostAllocationScope;
    decisionNotes: string | null;
    decidedAt: string | null;
  }>;
  supplierRows: Array<{
    supplier: string;
    rows: number;
    total: string;
    paid: string;
    due: string;
    period: string;
  }>;
  accountRows: Array<{
    account: string;
    label: string;
    lines: number;
    subtotal: string;
    suppliers: string;
  }>;
  directEvidenceRows: Array<{
    supplier: string;
    invoice: string;
    date: string;
    amount: string;
    account: string;
    description: string;
    note: string;
  }>;
  last50WindowRows: Array<{
    supplier: string;
    invoice: string;
    date: string;
    status: string;
    total: string;
    paid: string;
    due: string;
  }>;
  dataQualityFlags: Array<{
    id: string;
    severity: 'high' | 'medium' | 'low';
    issue: string;
    amount: string | null;
    evidence: string;
    action: string;
  }>;
  capitalRows: Array<{
    supplier: string;
    invoice: string;
    date: string;
    amount: string;
    description: string;
    bucket: 'facility-tooling' | 'facility-materials' | 'facility-labour' | 'capital-asset';
    note: string;
  }>;
  funderView: {
    hero: { value: string; label: string; provenance: string };
    costStack: Array<{ label: string; amount: string; pctOfDirect: number; basis: string }>;
    capitalSummary: { total: string; rows: Array<{ label: string; amount: string; note: string }> };
    conversion: Array<{ funds: string; beds: number; note: string }>;
    counterfactual: {
      commercialRangeLow: string;
      commercialRangeHigh: string;
      ratioLow: string;
      ratioHigh: string;
      basis: string;
    };
    provenance: Array<{
      figure: string;
      source: string;
      confidence: 'verified' | 'inferred' | 'planning' | 'unverified';
    }>;
  };
  gaps: string[];
};

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyToNumber(value: string | null | undefined) {
  if (!value) return 0;
  const parsed = Number(value.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`;
  if (Math.abs(value) >= 1000) return `$${Math.round(value / 1000)}K`;
  return money(value);
}

function dateLabel(value: string | null | undefined) {
  return value ? value.slice(0, 10) : 'unknown';
}

export function buildGoodsCostLineFingerprint(input: {
  xeroInvoiceId: string;
  lineIndex: number;
  accountCode: string;
  description: string;
  lineAmount: number;
}) {
  return createHash('sha256')
    .update(
      JSON.stringify([
        input.xeroInvoiceId,
        input.lineIndex,
        input.accountCode,
        input.description,
        input.lineAmount,
      ]),
    )
    .digest('hex');
}

function normaliseLineItems(value: unknown): XeroLineItem[] {
  if (Array.isArray(value)) return value as XeroLineItem[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as XeroLineItem[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function accountLabel(account: string) {
  const labels: Record<string, string> = {
    '400': 'Production / supplier cost bucket',
    '412': 'Bed manufacture / product work',
    '413': 'Materials / production support',
    '425': 'Freight / couriers / delivery',
    '429': 'Defy materials / production inputs',
    '446': 'Bedding / product inputs',
    '447': 'Equipment / field gear',
    '451': 'Vehicle / mechanical support',
    '486': 'People / design / partner services',
    '493': 'Field travel / accommodation',
  };
  return labels[account] || 'Unmapped Xero account';
}

function periodLabel(first: string | null, last: string | null) {
  if (!first && !last) return 'unknown';
  if (first === last) return dateLabel(first);
  return `${dateLabel(first)} - ${dateLabel(last)}`;
}

function emptyEvidence(detail: string): GoodsCostEvidence {
  return {
    status: 'empty',
    decision: detail,
    totals: [{ label: 'Supplier bills', value: '$0', detail }],
    costBoundaryRows: goodsCostBoundaryRows(),
    unitEstimateRows: goodsUnitEstimateRows(),
    costInputRows: goodsCostInputRows(),
    costAllocationRows: [],
    supplierRows: [],
    accountRows: [],
    directEvidenceRows: [],
    last50WindowRows: [],
    dataQualityFlags: [],
    capitalRows: [],
    funderView: buildFunderView({ perBedDirect: 600, capitalTotalKnown: 0, totalBills: 0 }),
    gaps: [
      'No ACT-GD supplier bills were returned from Xero.',
      'Do not quote an actual delivered unit cost until finance rows are loaded.',
    ],
  };
}

function goodsCostBoundaryRows(): GoodsCostEvidence['costBoundaryRows'] {
  return [
    {
      label: 'Direct delivered cost',
      treatment: 'quote in direct cost',
      detail:
        'This is the external unit-cost number for QBE, buyers, SEFA, Snow and foundations once allocation is complete.',
      examples:
        'Product materials, direct build labour, packaging, attributable freight/last-mile delivery, and a direct support/warranty allowance tied to asset batches.',
    },
    {
      label: 'ACT shared-service support',
      treatment: 'show separately',
      detail:
        'Do not blend this into the delivered bed unit cost. Show it as a separate operating-support or use-of-funds line.',
      examples:
        'Grant writing, finance/admin, CRM, reporting, evidence work, software, governance, founder time, entity transition, and shared ACT systems.',
    },
    {
      label: 'Buyer price / margin',
      treatment: 'approve before quoting',
      detail:
        'Buyer pricing can sit above direct delivered cost, but needs an explicit price, margin, warranty and contingency decision.',
      examples:
        'Government buyer price, retail/remote-store price, subsidised philanthropic price, contingency, margin, and repayment logic.',
    },
  ];
}

function moneyRange(low: number, high: number) {
  return `${money(low)}-${money(high)}`;
}

function roundedMoneyRange(low: number, high: number) {
  return `${money(Math.round(low / 5) * 5)}-${money(Math.round(high / 5) * 5)}`;
}

function goodsUnitEstimateRows(last50WindowTotal?: number): GoodsCostEvidence['unitEstimateRows'] {
  const productionLow = 550;
  const productionMid = 600;
  const productionHigh = 650;
  const roadFreight = 52;
  const bargeFreight = 163;
  const charterFreight = 455;
  const rows: GoodsCostEvidence['unitEstimateRows'] = [
    {
      label: 'QBE working estimate',
      value: `${money(productionMid)} / bed + route freight`,
      use: 'Use this in the QBE budget draft now. Keep it labelled as a planning estimate.',
      basis: '$60K / 100 beds in the QBE draft, cross-checked against the $550-$650 production range.',
      confidence: 'use now',
    },
    {
      label: 'Production range',
      value: `${moneyRange(productionLow, productionHigh)} / bed`,
      use: 'Use as the current bed production band before route freight, warranty, support, or margin.',
      basis: 'Goods cost register, Snow review, and Catalysing Impact draft.',
      confidence: 'planning',
    },
    {
      label: 'Road delivered estimate',
      value: `${roundedMoneyRange(productionLow + roadFreight, productionHigh + roadFreight)} / bed`,
      use: 'Use for mainland road-access buyer and grant scenarios.',
      basis: `Production range plus ${money(roadFreight)} road freight benchmark.`,
      confidence: 'planning',
    },
    {
      label: 'Island/barge estimate',
      value: `${roundedMoneyRange(productionLow + bargeFreight, productionHigh + bargeFreight)} / bed`,
      use: 'Use for Palm Island and similar barge/remote freight scenarios.',
      basis: `Production range plus ${money(bargeFreight)} barge freight benchmark.`,
      confidence: 'planning',
    },
    {
      label: 'Very remote estimate',
      value: `${roundedMoneyRange(productionLow + charterFreight, productionHigh + charterFreight)} / bed`,
      use: 'Use only where charter or very high last-mile freight is realistic.',
      basis: `Production range plus ${money(charterFreight)} charter freight benchmark.`,
      confidence: 'planning',
    },
    {
      label: 'Buyer price band',
      value: '$850-$1,200 / bed',
      use: 'Use as the buyer/sponsored price range to test after the product and freight route are clear.',
      basis: 'Goods go-to-market and Catalysing Impact planning material.',
      confidence: 'planning',
    },
  ];

  if (last50WindowTotal && last50WindowTotal > 0) {
    rows.splice(2, 0, {
      label: 'Xero date-window proxy',
      value: `${money(last50WindowTotal / LAST_50_COUNT)} / bed`,
      use: 'Use internally to test whether the estimate is plausible. Do not quote as actual delivered cost.',
      basis: `${money(last50WindowTotal)} in ACT-GD supplier bills dated ${LAST_50_START} to ${LAST_50_END}, divided by ${LAST_50_COUNT} bed rows.`,
      confidence: 'proxy only',
    });
  }

  return rows;
}

function goodsCostInputRows(): GoodsCostEvidence['costInputRows'] {
  return [
    {
      input: 'Materials',
      status: 'finance-backed',
      wikiEvidence:
        'Stretch Bed source data names recycled HDPE legs, galvanised steel poles, heavy-duty canvas, hardware and packaging. Cost register also carries the $149.20 materials-only quote and the $550 planning production model.',
      financeEvidence:
        'Xero supplier bills include Defy / Defy Manufacturing, Zinus, Bunnings, RW Pacific and materials-style account buckets including 446 Materials & Supplies.',
      stillNeeded:
        'Allocate supplier bill line items to current Stretch Bed batches and asset IDs; separate Basket/Weave history from current Stretch Bed cost.',
      sourceDocs:
        'capital/cost-register; sources/canonical-product-data; products/stretch-bed',
    },
    {
      input: 'Labour',
      status: 'known-source',
      wikiEvidence:
        'Production facility guide names the build flow: collection, shredding, pressing, CNC cutting, finishing, assembly, shift notes and handover logic.',
      financeEvidence:
        'Cost register has staff/founder time, consulting/design/contractor rows and Xero subcontractor-style account buckets, but they are not cleanly allocated to product batches.',
      stillNeeded:
        'Pull payroll, contractor, community payment and founder-time treatment into an approved allocation rule before quoting labour per bed.',
      sourceDocs:
        'sources/production-facility-guide; enterprise/04-financial-management; capital/cost-register',
    },
    {
      input: 'Freight and delivery',
      status: 'finance-backed',
      wikiEvidence:
        'Goods source pack names remote freight, delivery into communities, barge/road/last-mile constraints and delivery benchmarks.',
      financeEvidence:
        'Xero/cost register includes freight and delivery signals: Loadshift, Sea Swift, Palm Island Barge, Peak Up Transport and account 425 freight/courier rows.',
      stillNeeded:
        'Tie freight invoices to specific communities, trips, deliveries and asset batches so delivered cost is not averaged blindly.',
      sourceDocs:
        'capital/cost-register; sources/procurement-strategy; sources/go-to-market-thousands-2026',
    },
    {
      input: 'Support and warranty',
      status: 'known-source',
      wikiEvidence:
        'Product data carries a 5-year warranty. The tracking model names check-ins, repair, movement, replacement, support events and lifecycle evidence.',
      financeEvidence:
        'Support costs are not yet split out from general Goods/Xero rows; replacement parts and failed design costs need tagging.',
      stillNeeded:
        'Connect QR asset check-ins, support logs, replacement parts and warranty work to finance rows and product batches.',
      sourceDocs:
        'sources/community-essential-goods-tracking-model; products/stretch-bed; impact/metrics-tracked',
    },
    {
      input: 'Overhead allocation',
      status: 'allocation-gap',
      wikiEvidence:
        'ACT operating thesis and Goods finance pages state that Goods sits inside ACT and uses shared finance, admin, website, communications, technology and founder support.',
      financeEvidence:
        'Project monthly financials give ACT-GD spend, but ACT shared-service costs may sit under ACT-IN or wider project codes rather than the Goods ledger.',
      stillNeeded:
        'Rule selected: do not blend ACT shared-service overhead into delivered unit cost. Show it as a separate operating-support/use-of-funds line.',
      sourceDocs:
        'act-operational-thesis; enterprise/04-financial-management; capital/cost-register',
    },
  ];
}

function categoryForCostLine(account: string, description: string, supplier: string) {
  const haystack = `${accountLabel(account)} ${description} ${supplier}`.toLowerCase();
  if (account === '425') return 'Freight and delivery';
  if (account === '446' || account === '413' || account === '429') return 'Materials';
  if (account === '400' || account === '412') return 'Direct build / manufacture';
  if (account === '451') return 'Support and warranty';
  if (account === '493') return 'ACT shared-service support';
  if (account === '486') return 'Direct labour / build';
  if (/freight|courier|transport|barge|delivery|sendle|loadshift|sea swift|peak up/.test(haystack)) {
    return 'Freight and delivery';
  }
  if (/bed|mattress|plastic|canvas|bedding|sheet|fastener|packag|material|defy|zinus|metal|rw pacific/.test(haystack)) {
    return 'Materials';
  }
  if (/repair|warranty|replacement|vehicle|mechanic|field support|support/.test(haystack)) {
    return 'Support and warranty';
  }
  if (/labour|labor|assembly|build|manufactur|contractor|sub-contract|cnc|design/.test(haystack) || account === '486') {
    return 'Direct labour / build';
  }
  if (/admin|software|insurance|accounting|crm|reporting|governance|grant|founder|travel|accommodation/.test(haystack) || account === '493') {
    return 'ACT shared-service support';
  }
  return 'Needs finance review';
}

function treatmentForCategory(category: string): GoodsCostEvidence['costAllocationRows'][number]['directCostTreatment'] {
  if (category === 'ACT shared-service support') return 'show separately';
  if (category === 'Needs finance review') return 'review before quoting';
  return 'include when allocated';
}

function actionForCategory(category: string) {
  const actions: Record<string, string> = {
    Materials: 'Allocate to current Stretch Bed batch and asset IDs.',
    'Direct build / manufacture': 'Allocate manufactured units to asset IDs and current product type.',
    'Freight and delivery': 'Tie to community delivery, trip, and asset batch.',
    'Direct labour / build': 'Confirm direct build labour or move to ACT support.',
    'Support and warranty': 'Confirm field/warranty event or move to support allowance.',
    'ACT shared-service support': 'Keep out of unit cost; add to support/use-of-funds line.',
    'Needs finance review': 'Finance review before quoting or excluding.',
  };
  return actions[category] || actions['Needs finance review'];
}

function allocationPriority(category: string) {
  const priorities: Record<string, number> = {
    Materials: 1,
    'Direct build / manufacture': 2,
    'Freight and delivery': 3,
    'Direct labour / build': 4,
    'Support and warranty': 5,
    'ACT shared-service support': 6,
    'Needs finance review': 7,
  };
  return priorities[category] || 99;
}

function selectAllocationRows(rows: GoodsCostEvidence['costAllocationRows']) {
  const sorted = [...rows].sort((a, b) => {
    const priority = allocationPriority(a.category) - allocationPriority(b.category);
    if (priority !== 0) return priority;
    return b.date.localeCompare(a.date);
  });
  const quotas: Array<[string, number]> = [
    ['Materials', 5],
    ['Direct build / manufacture', 5],
    ['Freight and delivery', 3],
    ['Direct labour / build', 2],
    ['Support and warranty', 2],
    ['ACT shared-service support', 1],
  ];
  const selected: GoodsCostEvidence['costAllocationRows'] = [];
  const selectedKeys = new Set<string>();
  const keyFor = (row: GoodsCostEvidence['costAllocationRows'][number]) =>
    `${row.invoice}-${row.account}-${row.description}-${row.amount}`;

  for (const [category, limit] of quotas) {
    for (const row of sorted.filter((candidate) => candidate.category === category).slice(0, limit)) {
      const key = keyFor(row);
      if (!selectedKeys.has(key)) {
        selected.push(row);
        selectedKeys.add(key);
      }
    }
  }

  for (const row of sorted) {
    if (selected.length >= 18) break;
    const key = keyFor(row);
    if (!selectedKeys.has(key)) {
      selected.push(row);
      selectedKeys.add(key);
    }
  }

  return selected.slice(0, 18);
}

function defaultScopeForDecision(decision: GoodsCostAllocationDecision): GoodsCostAllocationScope {
  if (decision === 'show_separately') return 'shared_service';
  if (decision === 'include_direct') return 'current_batch';
  return 'unallocated';
}

export async function saveGoodsCostAllocationDecision(input: GoodsCostAllocationSaveInput) {
  if (!GOODS_COST_DECISIONS.includes(input.decision)) {
    throw new Error(`Unsupported Goods cost allocation decision: ${input.decision}`);
  }

  const supabase = getServiceSupabase();
  const allocationScope = input.allocationScope ?? defaultScopeForDecision(input.decision);
  const { data, error } = await supabase
    .from('goods_cost_allocation_decisions')
    .upsert(
      {
        project_code: PROJECT_CODE,
        xero_invoice_id: input.xeroInvoiceId,
        invoice_number: input.invoice === 'missing' ? null : input.invoice,
        line_index: input.lineIndex,
        line_fingerprint: input.lineFingerprint,
        supplier: input.supplier,
        account_code: input.accountCode,
        account_label: input.account,
        description: input.description,
        line_amount: moneyToNumber(input.amount),
        category: input.category,
        decision: input.decision,
        allocation_scope: allocationScope,
        notes: input.notes || null,
        decided_by: input.decidedBy || null,
        decided_at: new Date().toISOString(),
      },
      { onConflict: 'project_code,line_fingerprint' },
    )
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

// Known data-quality issues from the 2026-05-28 cost-evidence plan.
// These are findings Ben/finance have surfaced but not yet resolved in Xero.
// Surfacing them in the tool turns "buried in a spreadsheet" into "visible review queue".
const KNOWN_QUALITY_ISSUES: Array<{
  id: string;
  severity: 'high' | 'medium' | 'low';
  supplierIncludes: string;
  descriptionIncludes?: string;
  issue: string;
  action: string;
}> = [
  {
    id: 'rm-tanner-capital',
    severity: 'high',
    supplierIncludes: 'r m tanner',
    descriptionIncludes: 'triple axle',
    issue: 'R M Tanner "Triple Axle Tiny House" is coded as labour but is a capital asset.',
    action: 'Reclassify as capital (facility-tooling). Exclude from per-bed direct cost.',
  },
  {
    id: '1300-washer-mistag',
    severity: 'high',
    supplierIncludes: '1300 washer',
    issue: '1300 Washer bill tagged ACT-GD but the line item reads ACT-FM.',
    action: 'Retag to ACT-FM in Xero; will reduce ACT-GD spend.',
  },
  {
    id: 'zinus-confirm',
    severity: 'medium',
    supplierIncludes: 'zinus',
    issue: 'Zinus Australia spend — purpose unconfirmed (mattress input vs. resale noise).',
    action: 'Confirm with Defy whether this is a bed component or trial-stock noise.',
  },
];

// Suppliers/descriptions that flag capital (one-off facility/tooling) rather
// than per-unit cost. Per the plan: facility ~$100K + tooling ~$10K (+ R M
// Tanner $20K if reclassified). These do NOT belong in the delivered unit cost.
const CAPITAL_HINTS: Array<{
  supplierIncludes?: string;
  descriptionIncludes?: string;
  bucket: 'facility-tooling' | 'facility-materials' | 'facility-labour' | 'capital-asset';
  note: string;
}> = [
  {
    supplierIncludes: 'carbatec',
    bucket: 'facility-tooling',
    note: 'Workshop tooling — one-off capital, not per-bed.',
  },
  {
    supplierIncludes: 'r m tanner',
    descriptionIncludes: 'triple axle',
    bucket: 'capital-asset',
    note: 'Triple Axle Tiny House — capital asset, not per-bed labour.',
  },
  {
    descriptionIncludes: 'facility',
    bucket: 'facility-materials',
    note: 'Facility build / fit-out — one-off capital, not per-bed.',
  },
];

function detectDuplicateBills(bills: XeroSupplierBill[]) {
  const flags: Array<{ id: string; severity: 'high'; issue: string; amount: string | null; evidence: string; action: string }> = [];
  const byKey = new Map<string, XeroSupplierBill[]>();
  for (const bill of bills) {
    if (!bill.contact_name || !bill.total || bill.status === 'VOIDED' || bill.status === 'DELETED') continue;
    // Match on supplier + total + month (date YYYY-MM). Tightens to "same supplier,
    // same total, same month" — catches the Carla-Furnishers-style mirrored bill
    // without false-positiving normal recurring vendors.
    const monthKey = bill.date?.slice(0, 7) || 'unknown';
    const key = `${bill.contact_name.toLowerCase()}::${toNumber(bill.total).toFixed(2)}::${monthKey}`;
    const existing = byKey.get(key) ?? [];
    existing.push(bill);
    byKey.set(key, existing);
  }
  for (const [key, group] of byKey.entries()) {
    if (group.length < 2) continue;
    const supplier = group[0]?.contact_name || 'Unknown supplier';
    const amount = toNumber(group[0]?.total);
    const invoices = group.map((b) => b.invoice_number || 'no-number').join(', ');
    flags.push({
      id: `dup-${key.replace(/[^a-z0-9-]/gi, '-').slice(0, 60)}`,
      severity: 'high',
      issue: `${supplier} — ${group.length} bills with identical ${money(amount)} amount in the same month.`,
      amount: money(amount * (group.length - 1)),
      evidence: `Bills: ${invoices}.`,
      action: 'Verify in Xero; void the duplicate if confirmed (use manual-duplicate-of-* source).',
    });
  }
  return flags;
}

function detectKnownIssues(bills: XeroSupplierBill[]) {
  const flags: GoodsCostEvidence['dataQualityFlags'] = [];
  for (const issue of KNOWN_QUALITY_ISSUES) {
    const matches = bills.filter((bill) => {
      const supplier = (bill.contact_name || '').toLowerCase();
      if (!supplier.includes(issue.supplierIncludes)) return false;
      if (!issue.descriptionIncludes) return true;
      const lines = normaliseLineItems(bill.line_items);
      return lines.some((line) =>
        String(line.description || '').toLowerCase().includes(issue.descriptionIncludes!),
      );
    });
    if (matches.length === 0) continue;
    const totalAmount = matches.reduce((sum, b) => sum + toNumber(b.total), 0);
    flags.push({
      id: issue.id,
      severity: issue.severity,
      issue: issue.issue,
      amount: totalAmount > 0 ? money(totalAmount) : null,
      evidence: `${matches.length} bill${matches.length === 1 ? '' : 's'}: ${matches.map((b) => b.invoice_number || 'no-number').slice(0, 4).join(', ')}.`,
      action: issue.action,
    });
  }
  return flags;
}

function extractCapitalRows(bills: XeroSupplierBill[]): GoodsCostEvidence['capitalRows'] {
  const rows: GoodsCostEvidence['capitalRows'] = [];
  for (const bill of bills) {
    if (bill.status === 'VOIDED' || bill.status === 'DELETED') continue;
    const supplier = (bill.contact_name || '').toLowerCase();
    const lines = normaliseLineItems(bill.line_items);
    for (const [lineIndex, item] of lines.entries()) {
      const description = String(item.description || '').toLowerCase();
      const hint = CAPITAL_HINTS.find((h) => {
        if (h.supplierIncludes && !supplier.includes(h.supplierIncludes)) return false;
        if (h.descriptionIncludes && !description.includes(h.descriptionIncludes)) return false;
        return Boolean(h.supplierIncludes || h.descriptionIncludes);
      });
      if (!hint) continue;
      const amount = toNumber(item.line_amount);
      if (amount <= 0) continue;
      rows.push({
        supplier: bill.contact_name || 'Unknown supplier',
        invoice: bill.invoice_number || 'missing',
        date: dateLabel(bill.date),
        amount: money(amount),
        description: String(item.description || '').replace(/\s+/g, ' ').trim() || `Line ${lineIndex + 1}`,
        bucket: hint.bucket,
        note: hint.note,
      });
    }
  }
  return rows.sort((a, b) =>
    moneyToNumber(b.amount) - moneyToNumber(a.amount),
  );
}

function buildFunderView(input: {
  perBedDirect: number; // verified per-bed direct cost (excludes capital, freight TBD)
  capitalTotalKnown: number;
  totalBills: number;
}): GoodsCostEvidence['funderView'] {
  // Source-of-truth numbers from the plan + Ben's Notion Bed-Inputs DB (verified-where-possible).
  const components = {
    hdpe_kit: { amount: 344.05, label: 'HDPE kit', basis: 'Defy invoices, verified.' },
    canvas: { amount: 93.50, label: 'Canvas', basis: 'Notion BOM, estimate.' },
    assembly: { amount: 55.95, label: 'Assembly labour', basis: 'Defy invoices, verified.' },
    steel: { amount: 27.00, label: 'Steel frame', basis: 'Notion BOM, estimate.' },
    caps: { amount: 3.20, label: 'End caps / fittings', basis: 'Notion BOM, estimate.' },
  };
  const directComponents = Object.values(components).reduce((sum, c) => sum + c.amount, 0);
  // Freight is the biggest gap (per plan); use the road-freight benchmark of $52
  // as a placeholder until the actual Syd→Utopia freight invoice lands.
  const freight = 52;
  const overhead = Math.max(0, input.perBedDirect - directComponents - freight); // facility amortisation residual
  const fullyLoaded = directComponents + freight + overhead;
  const commercialLow = 1500;
  const commercialHigh = 2000;
  return {
    hero: {
      value: money(fullyLoaded),
      label: 'delivers one community-made bed (fully-loaded, ex capital)',
      provenance: `Components ${money(directComponents)} (HDPE kit + canvas + assembly + steel + caps) + freight ${money(freight)} + facility overhead ${money(overhead)}. Capital is shown separately.`,
    },
    costStack: [
      { label: components.hdpe_kit.label, amount: money(components.hdpe_kit.amount), pctOfDirect: components.hdpe_kit.amount / fullyLoaded, basis: components.hdpe_kit.basis },
      { label: components.canvas.label, amount: money(components.canvas.amount), pctOfDirect: components.canvas.amount / fullyLoaded, basis: components.canvas.basis },
      { label: components.assembly.label, amount: money(components.assembly.amount), pctOfDirect: components.assembly.amount / fullyLoaded, basis: components.assembly.basis },
      { label: components.steel.label, amount: money(components.steel.amount), pctOfDirect: components.steel.amount / fullyLoaded, basis: components.steel.basis },
      { label: components.caps.label, amount: money(components.caps.amount), pctOfDirect: components.caps.amount / fullyLoaded, basis: components.caps.basis },
      { label: 'Freight (road)', amount: money(freight), pctOfDirect: freight / fullyLoaded, basis: 'Road-freight benchmark; remote routes higher. Actual Syd→Utopia invoice still TBC.' },
      { label: 'Facility overhead', amount: money(overhead), pctOfDirect: overhead / fullyLoaded, basis: 'Amortised facility labour + materials per bed, derived from the $550–$650 production band.' },
    ],
    capitalSummary: {
      total: input.capitalTotalKnown > 0 ? compactMoney(input.capitalTotalKnown) : 'identified items only',
      rows: [
        { label: 'Production facility', amount: '$100K invested to date', note: 'FRRR + initial fit-out; one-off, not per bed.' },
        { label: 'Carbatec tooling', amount: '$10,046', note: 'Workshop tooling (verified Xero ACT-GD line).' },
        { label: 'Defy facility materials', amount: '$11,725', note: 'Facility build materials (verified Xero ACT-GD line).' },
        { label: 'Kirmos facility labour', amount: '$4,500 / month', note: 'Facility labour run-rate; amortised into per-bed overhead.' },
      ],
    },
    conversion: [
      { funds: '$10,000', beds: Math.round(10000 / fullyLoaded), note: 'A single-funder cheque.' },
      { funds: '$50,000', beds: Math.round(50000 / fullyLoaded), note: 'A typical foundation grant.' },
      { funds: '$100,000', beds: Math.round(100000 / fullyLoaded), note: 'A community-partnership commitment.' },
      { funds: '$500,000', beds: Math.round(500000 / fullyLoaded), note: 'Major-gift or capital allocation.' },
    ],
    counterfactual: {
      commercialRangeLow: money(commercialLow),
      commercialRangeHigh: money(commercialHigh),
      ratioLow: `${(commercialLow / fullyLoaded).toFixed(1)}×`,
      ratioHigh: `${(commercialHigh / fullyLoaded).toFixed(1)}×`,
      basis: 'Commercial-equivalent steel-frame bed pricing (retail furniture/contract supply, mid-2026 AU market).',
    },
    provenance: [
      { figure: `${components.hdpe_kit.label} ${money(components.hdpe_kit.amount)}`, source: 'Defy supplier invoices (Notion: Bed Inputs DB)', confidence: 'verified' },
      { figure: `${components.assembly.label} ${money(components.assembly.amount)}`, source: 'Defy supplier invoices', confidence: 'verified' },
      { figure: `${components.canvas.label} ${money(components.canvas.amount)}`, source: 'Notion BOM working figure', confidence: 'inferred' },
      { figure: `${components.steel.label} ${money(components.steel.amount)}`, source: 'Notion BOM working figure', confidence: 'inferred' },
      { figure: `Freight ${money(freight)}`, source: 'Road-freight benchmark; Syd→Utopia actual TBC', confidence: 'planning' },
      { figure: `Facility overhead ${money(overhead)}`, source: 'Production-range residual ($550–$650 band)', confidence: 'planning' },
      { figure: 'Commercial counterfactual $1.5K–$2K', source: 'Retail/contract-supply market scan, mid-2026 AU', confidence: 'inferred' },
      { figure: `Xero supplier-bills total ${compactMoney(input.totalBills)}`, source: 'xero_invoices (ACT-GD, ACCPAY, non-voided)', confidence: 'verified' },
    ],
  };
}

export async function getGoodsCostEvidence(): Promise<GoodsCostEvidence> {
  const supabase = getServiceSupabase();

  try {
    const [billResult, monthlyResult, transactionResult, decisionResult] = await Promise.all([
      supabase
        .from('xero_invoices')
        .select('id, invoice_number, contact_name, status, date, total, amount_paid, amount_due, has_attachments, line_items, synced_at')
        .eq('project_code', PROJECT_CODE)
        .eq('type', 'ACCPAY')
        .not('status', 'in', '(VOIDED,DELETED)')
        .order('date', { ascending: false }),
      supabase
        .from('project_monthly_financials')
        .select('month, fy_ytd_expenses')
        .eq('project_code', PROJECT_CODE)
        .order('month', { ascending: false })
        .limit(1),
      supabase
        .from('xero_transactions')
        .select('xero_transaction_id, contact_name, type, total, status, date, has_attachments, is_reconciled')
        .eq('project_code', PROJECT_CODE)
        .not('status', 'eq', 'DELETED'),
      supabase
        .from('goods_cost_allocation_decisions')
        .select('line_fingerprint, decision, allocation_scope, notes, decided_at')
        .eq('project_code', PROJECT_CODE),
    ]);

    if (billResult.error) {
      return { ...emptyEvidence(billResult.error.message), status: 'error' };
    }

    const bills = (billResult.data || []) as XeroSupplierBill[];
    if (bills.length === 0) {
      return emptyEvidence(`No ${PROJECT_CODE} supplier bills were found in xero_invoices.`);
    }

    const transactions = (transactionResult.data || []) as XeroTransactionRow[];
    const transactionIds = transactions
      .map((row) => row.xero_transaction_id)
      .filter((value): value is string => Boolean(value));
    const dextResult =
      transactionIds.length > 0
        ? await supabase
            .from('dext_receipts')
            .select('xero_transaction_id, vendor_name, receipt_date, filename, match_confidence, match_method')
            .in('xero_transaction_id', transactionIds)
        : { data: [], error: null };
    const dextReceipts = ((dextResult.data || []) as DextReceiptRow[]).filter((row) => row.xero_transaction_id);
    const monthly = ((monthlyResult.data || []) as MonthlyFinancialRow[])[0];
    const allocationDecisions = new Map(
      (((decisionResult.data || []) as GoodsCostAllocationDecisionRow[]).filter((row) => row.line_fingerprint)).map(
        (row) => [row.line_fingerprint, row],
      ),
    );

    const total = bills.reduce((sum, row) => sum + toNumber(row.total), 0);
    const paid = bills.reduce((sum, row) => sum + toNumber(row.amount_paid), 0);
    const due = bills.reduce((sum, row) => sum + toNumber(row.amount_due), 0);
    const attached = bills.filter((row) => row.has_attachments).length;
    const latestSync = bills
      .map((row) => row.synced_at)
      .filter(Boolean)
      .sort()
      .at(-1);

    const supplierMap = new Map<
      string,
      { rows: number; total: number; paid: number; due: number; first: string | null; last: string | null }
    >();
    for (const bill of bills) {
      const supplier = bill.contact_name || 'Unknown supplier';
      const existing = supplierMap.get(supplier) ?? { rows: 0, total: 0, paid: 0, due: 0, first: null, last: null };
      const date = bill.date;
      existing.rows += 1;
      existing.total += toNumber(bill.total);
      existing.paid += toNumber(bill.amount_paid);
      existing.due += toNumber(bill.amount_due);
      existing.first = !existing.first || (date && date < existing.first) ? date : existing.first;
      existing.last = !existing.last || (date && date > existing.last) ? date : existing.last;
      supplierMap.set(supplier, existing);
    }

    const supplierRows = [...supplierMap.entries()]
      .map(([supplier, row]) => ({
        supplier,
        rows: row.rows,
        total: money(row.total),
        paid: money(row.paid),
        due: money(row.due),
        period: periodLabel(row.first, row.last),
      }))
      .sort((a, b) => toNumber(b.total.replace(/[$,]/g, '')) - toNumber(a.total.replace(/[$,]/g, '')))
      .slice(0, 10);

    const accountMap = new Map<string, { lines: number; subtotal: number; suppliers: Set<string> }>();
    const directEvidence: GoodsCostEvidence['directEvidenceRows'] = [];
    const costAllocationRows: GoodsCostEvidence['costAllocationRows'] = [];
    for (const bill of bills) {
      const supplier = bill.contact_name || 'Unknown supplier';
      for (const [lineIndex, item] of normaliseLineItems(bill.line_items).entries()) {
        const account = item.account_code || 'missing';
        const lineAmount = toNumber(item.line_amount);
        const existing = accountMap.get(account) ?? { lines: 0, subtotal: 0, suppliers: new Set<string>() };
        existing.lines += 1;
        existing.subtotal += lineAmount;
        existing.suppliers.add(supplier);
        accountMap.set(account, existing);

        const description = String(item.description || '').replace(/\s+/g, ' ').trim();
        const category = categoryForCostLine(account, description, supplier);
        if (lineAmount > 0 && category !== 'Needs finance review') {
          const lineFingerprint = buildGoodsCostLineFingerprint({
            xeroInvoiceId: bill.id,
            lineIndex,
            accountCode: account,
            description,
            lineAmount,
          });
          const decision = allocationDecisions.get(lineFingerprint);
          const inLast50DateWindow = Boolean(bill.date && bill.date >= LAST_50_START && bill.date <= LAST_50_END);
          const hasBedQuantity = /(\d+)\s+Beds?/i.test(description);
          costAllocationRows.push({
            lineFingerprint,
            lineIndex,
            xeroInvoiceId: bill.id,
            supplier,
            invoice: bill.invoice_number || 'missing',
            date: dateLabel(bill.date),
            amount: money(lineAmount),
            category,
            directCostTreatment: treatmentForCategory(category),
            batchStatus: hasBedQuantity
              ? 'Line names bed quantity; needs asset IDs'
              : inLast50DateWindow
                ? 'Last-50 date window only'
                : 'Not allocated to batch',
            proofStatus: bill.has_attachments ? 'Xero attachment' : 'Xero row only',
            action: actionForCategory(category),
            account: `Xero ${account}: ${accountLabel(account)}`,
            accountCode: account,
            description: description || 'No line description',
            currentDecision: decision?.decision ?? 'needs_allocation',
            allocationScope: decision?.allocation_scope ?? 'unallocated',
            decisionNotes: decision?.notes ?? null,
            decidedAt: decision?.decided_at ?? null,
          });
        }
        if (/bed|mattress|plastic|freight|transport/i.test(description)) {
          const bedMatch = description.match(/(\d+)\s+Beds?/i);
          const note =
            bedMatch && Number(bedMatch[1]) > 0
              ? `${money(lineAmount / Number(bedMatch[1]))} per described bed, excluding GST; still needs allocation to exact asset IDs.`
              : 'Direct product/material/freight evidence; still needs allocation to exact asset IDs.';
          directEvidence.push({
            supplier,
            invoice: bill.invoice_number || 'missing',
            date: dateLabel(bill.date),
            amount: money(lineAmount || toNumber(bill.total)),
            account,
            description: description || 'No line description',
            note,
          });
        }
      }
    }

    const accountRows = [...accountMap.entries()]
      .map(([account, row]) => ({
        account,
        label: accountLabel(account),
        lines: row.lines,
        subtotal: money(row.subtotal),
        suppliers: [...row.suppliers].sort().slice(0, 5).join(', '),
      }))
      .sort((a, b) => toNumber(b.subtotal.replace(/[$,]/g, '')) - toNumber(a.subtotal.replace(/[$,]/g, '')))
      .slice(0, 8);

    const last50Bills = bills
      .filter((row) => row.date && row.date >= LAST_50_START && row.date <= LAST_50_END)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    const last50Total = last50Bills.reduce((sum, row) => sum + toNumber(row.total), 0);
    const last50Paid = last50Bills.reduce((sum, row) => sum + toNumber(row.amount_paid), 0);
    const last50Due = last50Bills.reduce((sum, row) => sum + toNumber(row.amount_due), 0);

    return {
      status: 'live',
      decision:
        'Real ACT-GD supplier bills have been pulled from Xero, and the working estimate is good enough for planning: use $600 per bed plus route freight. Keep ACT shared-service overhead as a separate support line. Treat detailed supplier-to-asset allocation as later finance cleanup, not the blocker for QBE, buyer, or foundation planning.',
      totals: [
        {
          label: 'Supplier bills',
          value: compactMoney(total),
          detail: `${bills.length} ACT-GD ACCPAY rows, excluding voided/deleted bills. Last sync ${latestSync ? latestSync.slice(0, 10) : 'unknown'}.`,
        },
        {
          label: 'Paid supplier bills',
          value: compactMoney(paid),
          detail: `${bills.filter((row) => toNumber(row.amount_paid) > 0).length} supplier bills show paid amounts in Xero.`,
        },
        {
          label: 'Still due',
          value: compactMoney(due),
          detail: `${bills.filter((row) => toNumber(row.amount_due) > 0).length} supplier bills still show amount due.`,
        },
        {
          label: 'FY26 spend',
          value: compactMoney(toNumber(monthly?.fy_ytd_expenses)),
          detail: monthly?.month
            ? `Project monthly financials as at ${monthly.month.slice(0, 10)}.`
            : 'No project monthly financial row found.',
        },
        {
          label: 'Xero attachments',
          value: `${attached}/${bills.length}`,
          detail: 'Supplier bills with Xero attachments.',
        },
        {
          label: 'Dext linked',
          value: `${dextReceipts.length}/${transactions.length}`,
          detail: 'Dext receipts joined to ACT-GD Xero transactions. This is the weakest part of the evidence chain.',
        },
        {
          label: 'Last-50 date window',
          value: compactMoney(last50Total),
          detail: `${last50Bills.length} supplier bills dated ${LAST_50_START} to ${LAST_50_END}; ${money(last50Paid)} paid and ${money(last50Due)} due. Window average is ${money(last50Total / LAST_50_COUNT)} and is only a plausibility check beside the $600 planning number.`,
        },
      ],
      costBoundaryRows: goodsCostBoundaryRows(),
      unitEstimateRows: goodsUnitEstimateRows(last50Total),
      costInputRows: goodsCostInputRows(),
      costAllocationRows: selectAllocationRows(costAllocationRows),
      supplierRows,
      accountRows,
      directEvidenceRows: directEvidence
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8),
      last50WindowRows: last50Bills.map((row) => ({
        supplier: row.contact_name || 'Unknown supplier',
        invoice: row.invoice_number || 'missing',
        date: dateLabel(row.date),
        status: (row.status || 'unknown').toLowerCase(),
        total: money(toNumber(row.total)),
        paid: money(toNumber(row.amount_paid)),
        due: money(toNumber(row.amount_due)),
      })),
      dataQualityFlags: [...detectDuplicateBills(bills), ...detectKnownIssues(bills)].sort((a, b) => {
        const order = { high: 0, medium: 1, low: 2 } as const;
        return order[a.severity] - order[b.severity];
      }),
      capitalRows: extractCapitalRows(bills),
      funderView: buildFunderView({
        perBedDirect: 600,
        capitalTotalKnown: extractCapitalRows(bills).reduce((sum, row) => sum + moneyToNumber(row.amount), 0),
        totalBills: total,
      }),
      gaps: [
        'Later finance cleanup: allocate supplier bill lines to Goods asset IDs or batch IDs when possible.',
        'Map Xero account codes to finance-approved labels before sharing externally.',
        'Attach Dext/supplier receipts for production, freight, and materials rows where Xero attachment coverage is weak.',
        'Keep wiki/source-pack facts visible, but mark them as source evidence until finance allocation is complete.',
        'Use $600 per bed plus route freight as the planning number; show ACT shared-service overhead separately as operating support.',
      ],
    };
  } catch (error) {
    return {
      ...emptyEvidence(error instanceof Error ? error.message : 'Unknown Goods cost evidence load error.'),
      status: 'error',
    };
  }
}
