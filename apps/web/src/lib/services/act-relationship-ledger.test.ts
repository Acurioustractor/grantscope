import { describe, expect, it } from 'vitest';
import {
  ACT_RELATIONSHIP_CONTEXT_SOURCE_SYSTEMS,
  buildActRelationshipTimeline,
  normaliseRelationshipIdentity,
  relationshipCounterparties,
  relationshipNamesMatch,
  relationshipObligationFromSignal,
  relationshipOrganisationForSignal,
  suggestRelationshipExchange,
} from './act-relationship-ledger';

describe('ACT relationship ledger identity matching', () => {
  it('matches legal-name wrappers without collapsing distinctive names', () => {
    expect(normaliseRelationshipIdentity('The Snow Foundation Pty Ltd')).toBe('snow foundation');
    expect(relationshipNamesMatch('The Snow Foundation', 'Snow Foundation Limited')).toBe(true);
  });

  it('matches a primary organisation named before a context suffix', () => {
    expect(relationshipNamesMatch('Regional Arts Australia', 'Regional Arts Australia / Artlands')).toBe(true);
  });

  it('does not join organisations through a generic shared word', () => {
    expect(relationshipNamesMatch('Sydney Community Foundation', 'University of Sydney')).toBe(false);
    expect(relationshipNamesMatch('Cape York Partnership', 'Cape York Water Partnership')).toBe(false);
  });

  it('keeps contribution-only organisations while deduplicating invoice name variants', () => {
    expect(relationshipCounterparties([
      'Regional Arts Australia',
      'Regional Arts Australia / Artlands',
      null,
      'Country Arts Network',
    ])).toEqual(['Regional Arts Australia', 'Country Arts Network']);
  });

  it('suggests explicit warm introductions without treating them as paid work', () => {
    const suggestion = suggestRelationshipExchange({
      id: 'signal-1', source_system: 'gmail', signal_kind: 'warm_intro', organisation: 'LGANT', actor_name: 'Michelle', actor_email: null,
      title: 'CDU introduction', summary: 'Michelle asked permission to introduce ACT to the CDU team.', happened_at: '2026-07-09', metadata: null,
    });
    expect(suggestion).toMatchObject({ direction: 'received', kind: 'introduction', payment: 'not_expected' });
  });

  it('rejects newsletters and internal Notion notes from the exchange queue', () => {
    expect(suggestRelationshipExchange({
      id: 'signal-2', source_system: 'gmail', signal_kind: 'email_context', organisation: 'Example Foundation', actor_name: 'Newsletter', actor_email: null,
      title: 'July newsletter', summary: 'Funding news and stories from our partners.', happened_at: '2026-07-08', metadata: null,
    })).toBeNull();
    expect(suggestRelationshipExchange({
      id: 'signal-3', source_system: 'notion', signal_kind: 'knowledge_context', organisation: 'A Curious Tractor', actor_name: null, actor_email: null,
      title: 'Support plan', summary: 'ACT provided project support.', happened_at: '2026-07-08', metadata: null,
    })).toBeNull();
    expect(suggestRelationshipExchange({
      id: 'signal-4', source_system: 'gmail', signal_kind: 'relationship', organisation: 'Interlace Advisory', actor_name: 'Kate', actor_email: null,
      title: 'Conference photos', summary: 'Kate requested photos and a third person offered to provide them.', happened_at: '2026-07-08', metadata: null,
    })).toBeNull();
  });

  it('loads append-only human review memory without reclassifying it as an exchange', () => {
    expect(ACT_RELATIONSHIP_CONTEXT_SOURCE_SYSTEMS).toContain('human_review');
    const event = {
      id: 'review-return-1',
      source_system: 'human_review',
      signal_kind: 'relationship_return',
      organisation: null,
      actor_name: 'Ben',
      actor_email: null,
      title: 'Return: share the delivery evidence',
      summary: 'Share the confirmed delivery evidence.',
      happened_at: '2026-07-11',
      metadata: {
        kind: 'return',
        owner: 'Ben',
        beneficiary: 'Community partner',
        action: 'Share the confirmed delivery evidence.',
        dueAt: '2026-07-18',
      },
    };

    expect(relationshipOrganisationForSignal(event)).toBe('Community partner');
    expect(relationshipObligationFromSignal(event)).toEqual({
      id: 'review-return-1',
      kind: 'return',
      action: 'Share the confirmed delivery evidence.',
      owner: 'Ben',
      beneficiary: 'Community partner',
      dueAt: '2026-07-18',
      happenedAt: '2026-07-11',
    });
  });

  it('does not infer a counterparty or obligation from incomplete or machine-sourced rows', () => {
    const missingRelationship = {
      id: 'review-return-unknown',
      source_system: 'human_review',
      signal_kind: 'relationship_return',
      organisation: null,
      actor_name: 'Ben',
      actor_email: null,
      title: 'Return recorded',
      summary: 'Something must be returned.',
      happened_at: '2026-07-11',
      metadata: { action: 'Something must be returned.' },
    };
    const machineSignal = {
      ...missingRelationship,
      id: 'machine-return',
      source_system: 'gmail',
      organisation: 'Community partner',
      metadata: {
        owner: 'Ben',
        beneficiary: 'Community partner',
        action: 'Something must be returned.',
      },
    };

    expect(relationshipOrganisationForSignal(missingRelationship)).toBeNull();
    expect(relationshipObligationFromSignal(missingRelationship)).toBeNull();
    expect(relationshipObligationFromSignal(machineSignal)).toBeNull();
  });

  it('orders promises and returns alongside invoices, payments, exchanges, and conversations as distinct memory', () => {
    const timeline = buildActRelationshipTimeline({
      key: 'example', organisation: 'Example Partner', balance: 'repeat_paid', invoicedTotal: 1000, receivedTotal: 1000,
      outstandingTotal: 0, actPaidThemTotal: 0, paidInvoiceCount: 1, outstandingInvoiceCount: 0, invoiceCount: 1,
      oldestOverdueDays: 0, firstInvoiceAt: '2026-07-01', lastInvoiceAt: '2026-07-01', lastPaidAt: '2026-07-08',
      lastContactAt: '2026-07-09', projectCodes: [], work: ['Facilitation'], nextMove: 'Reconnect.', evidenceGaps: [], people: [],
      obligations: [{ id: 'obligation-1', kind: 'commitment', action: 'Send the agreed evidence.', owner: 'Ben', beneficiary: 'Example Partner', dueAt: '2026-07-18', happenedAt: '2026-07-11' }],
      contributions: [{ id: 'exchange-1', direction: 'received', kind: 'introduction', summary: 'Made a useful introduction.', payment: 'not_expected', amount: null, person: 'Ari', happenedAt: '2026-07-10' }],
      conversations: [{ id: 'conversation-1', source: 'gmail', title: 'Planning yarn', summary: 'Agreed the next step.', person: 'Ari', happenedAt: '2026-07-09' }],
      followUp: null,
      invoices: [{ id: 'invoice-1', number: 'INV-1', status: 'PAID', date: '2026-07-01', dueDate: '2026-07-07', fullyPaidDate: '2026-07-08', total: 1000, paid: 1000, due: 0, daysOverdue: 0, projectCode: null, reference: null, work: ['Facilitation'] }],
    });
    expect(timeline.map((event) => event.kind)).toEqual(['obligation', 'exchange', 'conversation', 'payment', 'invoice']);
    expect(timeline[0]).toMatchObject({ amount: null, source: 'human review', status: 'promise_recorded' });
    expect(timeline.find((event) => event.kind === 'payment')).toMatchObject({ amount: 1000, status: 'paid' });
  });
});
