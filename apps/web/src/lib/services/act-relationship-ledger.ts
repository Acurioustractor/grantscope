import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';
import { isInternalActIdentity } from '@/lib/act-internal-identities';

export type ActRelationshipBalance = 'awaiting_payment' | 'mutual_flow' | 'repeat_paid' | 'paid_once' | 'exchange_only' | 'not_realised';

export interface ActRelationshipInvoice {
  id: string;
  number: string | null;
  status: string;
  date: string | null;
  dueDate: string | null;
  fullyPaidDate: string | null;
  total: number;
  paid: number;
  due: number;
  daysOverdue: number;
  projectCode: string | null;
  reference: string | null;
  work: string[];
}

export interface ActRelationshipPerson {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  source: 'contact' | 'ghl' | 'gmail';
  lastContactAt: string | null;
}

export interface ActRelationshipConversation {
  id: string;
  source: string;
  title: string;
  summary: string;
  person: string | null;
  happenedAt: string | null;
}

export type ActContributionDirection = 'given' | 'received';
export type ActContributionPayment = 'paid' | 'unpaid' | 'not_expected' | 'unknown';

export interface ActRelationshipContribution {
  id: string;
  direction: ActContributionDirection;
  kind: string;
  summary: string;
  payment: ActContributionPayment;
  amount: number | null;
  person: string | null;
  happenedAt: string | null;
}

export interface ActRelationshipFollowUp {
  id: string;
  action: string;
  owner: string;
  dueAt: string;
  status: 'planned' | 'completed';
  completedAt: string | null;
}

export interface ActRelationshipExchangeSuggestion {
  id: string;
  source: 'gmail' | 'notion';
  organisation: string;
  person: string | null;
  title: string;
  summary: string;
  happenedAt: string | null;
  direction: ActContributionDirection;
  kind: string;
  payment: ActContributionPayment;
  reason: string;
}

export type ActRelationshipTimelineKind = 'invoice' | 'payment' | 'exchange' | 'conversation';

export interface ActRelationshipTimelineEvent {
  id: string;
  kind: ActRelationshipTimelineKind;
  happenedAt: string | null;
  title: string;
  summary: string;
  source: string;
  amount: number | null;
  status: string | null;
  person: string | null;
}

export interface ActRelationshipLedgerItem {
  key: string;
  organisation: string;
  balance: ActRelationshipBalance;
  invoicedTotal: number;
  receivedTotal: number;
  outstandingTotal: number;
  actPaidThemTotal: number;
  paidInvoiceCount: number;
  outstandingInvoiceCount: number;
  invoiceCount: number;
  oldestOverdueDays: number;
  firstInvoiceAt: string | null;
  lastInvoiceAt: string | null;
  lastPaidAt: string | null;
  lastContactAt: string | null;
  projectCodes: string[];
  work: string[];
  nextMove: string;
  evidenceGaps: string[];
  people: ActRelationshipPerson[];
  conversations: ActRelationshipConversation[];
  contributions: ActRelationshipContribution[];
  followUp: ActRelationshipFollowUp | null;
  invoices: ActRelationshipInvoice[];
}

export interface ActRelationshipLedger {
  generatedAt: string;
  summary: {
    organisations: number;
    invoices: number;
    paidInvoices: number;
    receivedTotal: number;
    outstandingInvoices: number;
    outstandingTotal: number;
    repeatRelationships: number;
    withConversationEvidence: number;
    contributions: number;
    unpaidContributions: number;
    suggestedContributions: number;
    plannedFollowUps: number;
    overdueFollowUps: number;
  };
  suggestions: ActRelationshipExchangeSuggestion[];
  items: ActRelationshipLedgerItem[];
}

interface XeroInvoiceRow extends Record<string, unknown> {
  id: string;
  invoice_number: string | null;
  type: string;
  status: string;
  contact_name: string | null;
  date: string | null;
  due_date: string | null;
  fully_paid_date: string | null;
  total: number | string | null;
  amount_paid: number | string | null;
  amount_due: number | string | null;
  project_code: string | null;
  reference: string | null;
  line_items: unknown;
}

interface ContactRow extends Record<string, unknown> {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  organisation: string | null;
  last_contacted_at: string | null;
}

interface GhlRow extends Record<string, unknown> {
  id: string;
  full_name: string | null;
  email: string | null;
  company_name: string | null;
  last_contact_date: string | null;
}

export interface ActRelationshipSourceSignal extends Record<string, unknown> {
  id: string;
  source_system: string;
  organisation: string | null;
  actor_name: string | null;
  actor_email: string | null;
  title: string;
  summary: string;
  happened_at: string | null;
  signal_kind: string | null;
  metadata: Record<string, unknown> | null;
}

const ACTIVE_INVOICE_STATUSES = new Set(['PAID', 'AUTHORISED', 'DRAFT', 'SUBMITTED']);
const LEGAL_TOKENS = new Set(['the', 'pty', 'ltd', 'limited', 'inc', 'incorporated', 'company', 'corporation', 'trustee', 'for']);
const INTERNAL_ORGANISATIONS = new Set(['a curious tractor', 'act', 'goods on country']);
const EXPLICIT_SUPPORT_PATTERN = /\b(provided|introduced|connected|helped|supported|hosted|donated|contributed|offered to|keen to support|would love to work)\b/i;
const ACT_GAVE_PATTERN = /\b(act|ben|benjamin|nic|nicholas|we)\s+(provided|introduced|connected|helped|supported|hosted|donated|contributed|offered)\b/i;

function numberValue(value: unknown): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function normaliseRelationshipIdentity(value: string | null | undefined): string {
  return String(value ?? '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((token) => token && !LEGAL_TOKENS.has(token))
    .join(' ')
    .trim();
}

function identityVariants(value: string | null | undefined): string[] {
  return [...new Set(String(value ?? '').split(/\s+[/·]\s+/).map(normaliseRelationshipIdentity).filter(Boolean))];
}

export function relationshipNamesMatch(left: string | null | undefined, right: string | null | undefined): boolean {
  const leftVariants = identityVariants(left);
  const rightVariants = identityVariants(right);
  return leftVariants.some((leftValue) => rightVariants.some((rightValue) => leftValue === rightValue));
}

export function relationshipCounterparties(values: Array<string | null | undefined>): string[] {
  const counterparties: string[] = [];
  for (const value of values) {
    const organisation = value?.trim();
    if (organisation && !counterparties.some((existing) => relationshipNamesMatch(existing, organisation))) counterparties.push(organisation);
  }
  return counterparties;
}

export function suggestRelationshipExchange(row: ActRelationshipSourceSignal): ActRelationshipExchangeSuggestion | null {
  if (row.source_system !== 'gmail' && row.source_system !== 'notion') return null;
  const organisation = row.organisation?.trim();
  if (!organisation || INTERNAL_ORGANISATIONS.has(normaliseRelationshipIdentity(organisation))) return null;
  const evidence = `${row.title} ${row.summary}`;
  const isWarmIntroduction = row.signal_kind === 'warm_intro';
  const isInvitation = row.signal_kind === 'invitation';
  const isExplicitSupport = EXPLICIT_SUPPORT_PATTERN.test(evidence);
  if (!isWarmIntroduction && !isInvitation && !isExplicitSupport) return null;
  if (!isWarmIntroduction && !isInvitation && !['email_context', 'knowledge_context'].includes(row.signal_kind ?? '')) return null;

  const actorIsAct = isInternalActIdentity({ name: row.actor_name, email: row.actor_email });
  const direction: ActContributionDirection = actorIsAct || ACT_GAVE_PATTERN.test(evidence) ? 'given' : 'received';
  const kind = isWarmIntroduction || /\b(intro|introduced|connected)\b/i.test(evidence)
    ? 'introduction'
    : isInvitation ? 'event' : /\b(hosted|venue|space)\b/i.test(evidence) ? 'space' : 'support';
  const reason = isWarmIntroduction
    ? 'A named introduction or connection was found.'
    : isInvitation
      ? 'A direct invitation into an event or place was found.'
      : 'The source describes an explicit offer or act of support.';
  return {
    id: row.id,
    source: row.source_system,
    organisation,
    person: row.actor_name || row.actor_email,
    title: row.title,
    summary: row.summary,
    happenedAt: row.happened_at,
    direction,
    kind,
    payment: 'not_expected',
    reason,
  };
}

export function buildActRelationshipTimeline(item: ActRelationshipLedgerItem): ActRelationshipTimelineEvent[] {
  const events: ActRelationshipTimelineEvent[] = [
    ...item.contributions.map((contribution): ActRelationshipTimelineEvent => ({
      id: `exchange:${contribution.id}`,
      kind: 'exchange',
      happenedAt: contribution.happenedAt,
      title: `${contribution.direction === 'given' ? 'ACT gave' : 'ACT received'} ${contribution.kind}`,
      summary: contribution.summary,
      source: 'relationship record',
      amount: contribution.amount,
      status: contribution.payment,
      person: contribution.person,
    })),
    ...item.conversations.map((conversation): ActRelationshipTimelineEvent => ({
      id: `conversation:${conversation.id}`,
      kind: 'conversation',
      happenedAt: conversation.happenedAt,
      title: conversation.title,
      summary: conversation.summary,
      source: conversation.source,
      amount: null,
      status: null,
      person: conversation.person,
    })),
    ...item.invoices.flatMap((invoice): ActRelationshipTimelineEvent[] => {
      const invoiceEvent: ActRelationshipTimelineEvent = {
        id: `invoice:${invoice.id}`,
        kind: 'invoice',
        happenedAt: invoice.date,
        title: `${invoice.number || 'Invoice'} issued`,
        summary: invoice.work.join(' · ') || invoice.reference || 'No work description recorded.',
        source: 'xero',
        amount: invoice.total,
        status: invoice.status,
        person: null,
      };
      const paidAt = invoice.fullyPaidDate || (invoice.status === 'PAID' ? invoice.date : null);
      const paymentEvent: ActRelationshipTimelineEvent | null = invoice.paid > 0 && paidAt ? {
        id: `payment:${invoice.id}`,
        kind: 'payment',
        happenedAt: paidAt,
        title: `Payment received for ${invoice.number || 'invoice'}`,
        summary: invoice.due > 0 ? `${invoice.due.toLocaleString('en-AU')} remains due.` : 'Invoice paid in full.',
        source: 'xero',
        amount: invoice.paid,
        status: invoice.due > 0 ? 'part_paid' : 'paid',
        person: null,
      } : null;
      return paymentEvent ? [invoiceEvent, paymentEvent] : [invoiceEvent];
    }),
  ];
  return events.sort((left, right) => String(right.happenedAt ?? '').localeCompare(String(left.happenedAt ?? '')) || left.id.localeCompare(right.id));
}

function daysOverdue(dueDate: string | null, amountDue: number): number {
  if (!dueDate || amountDue <= 0) return 0;
  const due = new Date(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(due.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - due.getTime()) / 86_400_000));
}

function cleanWorkDescription(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  if (!clean) return null;
  return clean.length > 220 ? `${clean.slice(0, 217).trimEnd()}...` : clean;
}

function invoiceWork(lineItems: unknown, reference: string | null): string[] {
  const descriptions = Array.isArray(lineItems)
    ? lineItems.map((line) => cleanWorkDescription((line as Record<string, unknown>)?.description)).filter((value): value is string => Boolean(value))
    : [];
  const cleanReference = cleanWorkDescription(reference);
  return [...new Set([...(cleanReference ? [cleanReference] : []), ...descriptions])].slice(0, 4);
}

function dedupePeople(people: ActRelationshipPerson[]): ActRelationshipPerson[] {
  const seen = new Set<string>();
  return people.filter((person) => {
    if (isInternalActIdentity(person)) return false;
    const key = String(person.email || person.name).toLowerCase().trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => String(right.lastContactAt ?? '').localeCompare(String(left.lastContactAt ?? '')));
}

function relationshipBalance(received: number, paidInvoices: number, outstanding: number, actPaidThem: number, contributions: number): ActRelationshipBalance {
  if (outstanding > 0) return 'awaiting_payment';
  if (received > 0 && actPaidThem > 0) return 'mutual_flow';
  if (paidInvoices > 1) return 'repeat_paid';
  if (received > 0) return 'paid_once';
  if (contributions > 0) return 'exchange_only';
  return 'not_realised';
}

function recommendedMove(input: {
  organisation: string;
  outstanding: number;
  oldestOverdue: number;
  paidInvoices: number;
  received: number;
  lastContactAt: string | null;
  work: string[];
  contributions: ActRelationshipContribution[];
}): string {
  if (input.outstanding > 0 && input.oldestOverdue > 0) {
    return `Confirm payment and the relationship next step; the oldest invoice is ${input.oldestOverdue} days overdue.`;
  }
  if (input.outstanding > 0) return 'Confirm the payment date and keep delivery expectations explicit.';
  if (input.paidInvoices > 1) return `Reconnect around the strongest previous work and shape the next useful piece together.`;
  if (input.received > 0) return 'Ask what was most useful, what changed, and whether there is a natural next piece of work.';
  const unpaidGiven = input.contributions.find((contribution) => contribution.direction === 'given' && contribution.payment === 'unpaid');
  if (unpaidGiven) return 'Decide whether this contribution should become a paid scope, be acknowledged as a gift, or be closed without further work.';
  const receivedSupport = input.contributions.find((contribution) => contribution.direction === 'received');
  if (receivedSupport) return 'Acknowledge what they contributed and agree on the most natural way to keep the relationship reciprocal.';
  if (input.contributions.length > 0) return 'Reconnect around what moved between you and agree whether there is a useful next step.';
  if (input.work.length > 0) return 'Confirm whether this work is proceeding, paused, or needs a clearer paid scope.';
  return `Recover the work history and identify the person who can explain the relationship with ${input.organisation}.`;
}

export const getActRelationshipLedger = cache(async function getActRelationshipLedger(slug: string, orgProfileId: string): Promise<ActRelationshipLedger | null> {
  if (!isActSlug(slug)) return null;
  const db = getServiceSupabase();
  const { data: incomeData, error: incomeError } = await db
    .from('xero_invoices')
    .select('id, invoice_number, type, status, contact_name, date, due_date, fully_paid_date, total, amount_paid, amount_due, project_code, reference, line_items')
    .eq('type', 'ACCREC')
    .order('date', { ascending: false, nullsFirst: false })
    .range(0, 999);
  if (incomeError || !incomeData) return null;

  const incomeRows = incomeData as XeroInvoiceRow[];
  const [expenseResult, contactsResult, contextResult] = await Promise.all([
    db.from('xero_invoices').select('id, invoice_number, type, status, contact_name, date, due_date, fully_paid_date, total, amount_paid, amount_due, project_code, reference, line_items')
      .eq('type', 'ACCPAY').range(0, 999),
    db.from('org_contacts').select('id, name, email, role, organisation, last_contacted_at').eq('org_profile_id', orgProfileId),
    db.from('opportunity_context_events').select('id, source_system, organisation, actor_name, actor_email, title, summary, happened_at, signal_kind, metadata')
      .eq('org_profile_id', orgProfileId).in('source_system', ['gmail', 'notion', 'civicgraph'])
      .order('happened_at', { ascending: false, nullsFirst: false }).range(0, 999),
  ]);

  const expenseRows = (expenseResult.data ?? []) as XeroInvoiceRow[];
  const contactRows = (contactsResult.data ?? []) as ContactRow[];
  const contextRows = (contextResult.data ?? []) as ActRelationshipSourceSignal[];
  const counterparties = relationshipCounterparties([
    ...incomeRows.map((row) => row.contact_name),
    ...contextRows.filter((row) => row.signal_kind === 'relationship_contribution' || row.signal_kind === 'relationship_follow_up').map((row) => row.organisation),
  ]);
  const ghlResult = counterparties.length > 0
    ? await db.from('ghl_contacts').select('id, full_name, email, company_name, last_contact_date').in('company_name', counterparties).range(0, 999)
    : { data: [], error: null };
  const ghlRows = (ghlResult.data ?? []) as GhlRow[];
  const reviewedSourceIds = new Set(contextRows
    .filter((row) => row.signal_kind === 'relationship_contribution' || row.signal_kind === 'relationship_contribution_review')
    .map((row) => row.metadata?.source_event_id)
    .filter((value): value is string => typeof value === 'string'));
  const suggestions = contextRows
    .map(suggestRelationshipExchange)
    .filter((suggestion): suggestion is ActRelationshipExchangeSuggestion => suggestion !== null && !reviewedSourceIds.has(suggestion.id))
    .slice(0, 12);

  const items = counterparties.map((organisation): ActRelationshipLedgerItem => {
    const rows = incomeRows.filter((row) => row.contact_name === organisation);
    const invoices = rows.map((row): ActRelationshipInvoice => {
      const due = numberValue(row.amount_due);
      return {
        id: row.id,
        number: row.invoice_number,
        status: row.status,
        date: row.date,
        dueDate: row.due_date,
        fullyPaidDate: row.fully_paid_date,
        total: numberValue(row.total),
        paid: numberValue(row.amount_paid),
        due,
        daysOverdue: daysOverdue(row.due_date, due),
        projectCode: row.project_code,
        reference: row.reference,
        work: invoiceWork(row.line_items, row.reference),
      };
    }).sort((left, right) => String(right.date ?? '').localeCompare(String(left.date ?? '')));
    const activeInvoices = invoices.filter((invoice) => ACTIVE_INVOICE_STATUSES.has(invoice.status));
    const receivedTotal = activeInvoices.reduce((sum, invoice) => sum + invoice.paid, 0);
    const outstandingTotal = activeInvoices.reduce((sum, invoice) => sum + invoice.due, 0);
    const paidInvoiceCount = activeInvoices.filter((invoice) => invoice.status === 'PAID').length;
    const outstandingInvoiceCount = activeInvoices.filter((invoice) => invoice.due > 0).length;
    const oldestOverdueDays = Math.max(0, ...activeInvoices.map((invoice) => invoice.daysOverdue));
    const actPaidThemTotal = expenseRows
      .filter((row) => relationshipNamesMatch(row.contact_name, organisation) && row.status === 'PAID')
      .reduce((sum, row) => sum + numberValue(row.amount_paid || row.total), 0);
    const relatedContext = contextRows.filter((row) => relationshipNamesMatch(row.organisation, organisation));
    const contributions = relatedContext.filter((row) => row.signal_kind === 'relationship_contribution')
      .map((row): ActRelationshipContribution => {
        const metadata = row.metadata ?? {};
        const direction = metadata.direction === 'received' ? 'received' : 'given';
        const payment = ['paid', 'unpaid', 'not_expected', 'unknown'].includes(String(metadata.payment_state))
          ? String(metadata.payment_state) as ActContributionPayment
          : 'unknown';
        return {
          id: row.id,
          direction,
          kind: String(metadata.contribution_type ?? 'other'),
          summary: row.summary,
          payment,
          amount: metadata.amount == null ? null : numberValue(metadata.amount),
          person: row.actor_name || row.actor_email,
          happenedAt: row.happened_at,
        };
      });
    const conversations = relatedContext.filter((row) => row.signal_kind !== 'relationship_contribution')
      .filter((row) => row.signal_kind !== 'relationship_follow_up' && row.signal_kind !== 'relationship_contribution_review')
      .map((row): ActRelationshipConversation => ({
        id: row.id,
        source: row.source_system,
        title: row.title,
        summary: row.summary,
        person: row.actor_name || row.actor_email,
        happenedAt: row.happened_at,
      })).slice(0, 12);
    const followUpRow = relatedContext.find((row) => row.signal_kind === 'relationship_follow_up') ?? null;
    const followUpMetadata = followUpRow?.metadata ?? {};
    const followUp: ActRelationshipFollowUp | null = followUpRow && typeof followUpMetadata.due_at === 'string'
      ? {
        id: followUpRow.id,
        action: typeof followUpMetadata.action === 'string' ? followUpMetadata.action : followUpRow.summary,
        owner: typeof followUpMetadata.owner === 'string' ? followUpMetadata.owner : 'Unassigned',
        dueAt: followUpMetadata.due_at,
        status: followUpMetadata.status === 'completed' ? 'completed' : 'planned',
        completedAt: typeof followUpMetadata.completed_at === 'string' ? followUpMetadata.completed_at : null,
      }
      : null;
    const people = dedupePeople([
      ...contactRows.filter((row) => relationshipNamesMatch(row.organisation, organisation)).map((row): ActRelationshipPerson => ({
        id: `contact:${row.id}`, name: row.name, email: row.email, role: row.role, source: 'contact', lastContactAt: row.last_contacted_at,
      })),
      ...ghlRows.filter((row) => relationshipNamesMatch(row.company_name, organisation) && (row.full_name || row.email)).map((row): ActRelationshipPerson => ({
        id: `ghl:${row.id}`, name: row.full_name || row.email || 'Unknown contact', email: row.email, role: null, source: 'ghl', lastContactAt: row.last_contact_date,
      })),
      ...conversations.filter((row) => row.person).map((row): ActRelationshipPerson => ({
        id: `gmail:${row.id}`, name: row.person || 'Unknown contact', email: row.person?.includes('@') ? row.person : null, role: null, source: 'gmail', lastContactAt: row.happenedAt,
      })),
    ]);
    const work = [...new Set(activeInvoices.flatMap((invoice) => invoice.work))].slice(0, 12);
    const projectCodes = [...new Set(activeInvoices.map((invoice) => invoice.projectCode).filter((value): value is string => Boolean(value)))].sort();
    const lastContactAt = [...people.map((person) => person.lastContactAt), ...conversations.map((row) => row.happenedAt)]
      .filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
    const input = { organisation, outstanding: outstandingTotal, oldestOverdue: oldestOverdueDays, paidInvoices: paidInvoiceCount, received: receivedTotal, lastContactAt, work, contributions };
    return {
      key: normaliseRelationshipIdentity(organisation),
      organisation,
      balance: relationshipBalance(receivedTotal, paidInvoiceCount, outstandingTotal, actPaidThemTotal, contributions.length),
      invoicedTotal: activeInvoices.reduce((sum, invoice) => sum + invoice.total, 0),
      receivedTotal,
      outstandingTotal,
      actPaidThemTotal,
      paidInvoiceCount,
      outstandingInvoiceCount,
      invoiceCount: invoices.length,
      oldestOverdueDays,
      firstInvoiceAt: invoices.map((invoice) => invoice.date).filter((value): value is string => Boolean(value)).sort()[0] ?? null,
      lastInvoiceAt: invoices.map((invoice) => invoice.date).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
      lastPaidAt: invoices.map((invoice) => invoice.fullyPaidDate || (invoice.status === 'PAID' ? invoice.date : null)).filter((value): value is string => Boolean(value)).sort().at(-1) ?? null,
      lastContactAt,
      projectCodes,
      work,
      nextMove: recommendedMove(input),
      evidenceGaps: [
        people.length === 0 ? 'named relationship owner' : null,
        conversations.length === 0 ? 'conversation history' : null,
        work.length === 0 && contributions.length === 0 ? 'description of what ACT delivered' : null,
        contributions.length === 0 ? 'unbilled or freely contributed work is not yet captured' : null,
      ].filter((value): value is string => Boolean(value)),
      people,
      conversations,
      contributions,
      followUp,
      invoices,
    };
  }).sort((left, right) => Number(right.outstandingTotal > 0) - Number(left.outstandingTotal > 0)
    || right.oldestOverdueDays - left.oldestOverdueDays
    || right.receivedTotal - left.receivedTotal
    || left.organisation.localeCompare(right.organisation));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      organisations: items.length,
      invoices: items.reduce((sum, item) => sum + item.invoiceCount, 0),
      paidInvoices: items.reduce((sum, item) => sum + item.paidInvoiceCount, 0),
      receivedTotal: items.reduce((sum, item) => sum + item.receivedTotal, 0),
      outstandingInvoices: items.reduce((sum, item) => sum + item.outstandingInvoiceCount, 0),
      outstandingTotal: items.reduce((sum, item) => sum + item.outstandingTotal, 0),
      repeatRelationships: items.filter((item) => item.paidInvoiceCount > 1).length,
      withConversationEvidence: items.filter((item) => item.conversations.length > 0).length,
      contributions: items.reduce((sum, item) => sum + item.contributions.length, 0),
      unpaidContributions: items.reduce((sum, item) => sum + item.contributions.filter((contribution) => contribution.payment === 'unpaid').length, 0),
      suggestedContributions: suggestions.length,
      plannedFollowUps: items.filter((item) => item.followUp?.status === 'planned').length,
      overdueFollowUps: items.filter((item) => item.followUp?.status === 'planned' && item.followUp.dueAt < new Date().toISOString().slice(0, 10)).length,
    },
    suggestions,
    items,
  };
});
