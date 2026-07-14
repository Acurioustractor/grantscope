import { describe, expect, it } from 'vitest';
import { buildActRelationshipTimeline, normaliseRelationshipIdentity, relationshipCounterparties, relationshipNamesMatch, suggestRelationshipExchange } from './act-relationship-ledger';

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

  it('orders invoices, payments, exchanges, and conversations as one relationship story', () => {
    const timeline = buildActRelationshipTimeline({
      key: 'example', organisation: 'Example Partner', balance: 'repeat_paid', invoicedTotal: 1000, receivedTotal: 1000,
      outstandingTotal: 0, actPaidThemTotal: 0, paidInvoiceCount: 1, outstandingInvoiceCount: 0, invoiceCount: 1,
      oldestOverdueDays: 0, firstInvoiceAt: '2026-07-01', lastInvoiceAt: '2026-07-01', lastPaidAt: '2026-07-08',
      lastContactAt: '2026-07-09', projectCodes: [], work: ['Facilitation'], nextMove: 'Reconnect.', evidenceGaps: [], people: [],
      contributions: [{ id: 'exchange-1', direction: 'received', kind: 'introduction', summary: 'Made a useful introduction.', payment: 'not_expected', amount: null, person: 'Ari', happenedAt: '2026-07-10' }],
      conversations: [{ id: 'conversation-1', source: 'gmail', title: 'Planning yarn', summary: 'Agreed the next step.', person: 'Ari', happenedAt: '2026-07-09' }],
      followUp: null,
      invoices: [{ id: 'invoice-1', number: 'INV-1', status: 'PAID', date: '2026-07-01', dueDate: '2026-07-07', fullyPaidDate: '2026-07-08', total: 1000, paid: 1000, due: 0, daysOverdue: 0, projectCode: null, reference: null, work: ['Facilitation'] }],
    });
    expect(timeline.map((event) => event.kind)).toEqual(['exchange', 'conversation', 'payment', 'invoice']);
    expect(timeline.find((event) => event.kind === 'payment')).toMatchObject({ amount: 1000, status: 'paid' });
  });
});
