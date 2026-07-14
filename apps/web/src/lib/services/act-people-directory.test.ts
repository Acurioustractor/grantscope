import { describe, expect, it } from 'vitest';
import { buildActPersonDirectoryRows } from './act-people-directory';

function actPerson(overrides: Record<string, unknown> = {}) {
  return {
    person_name: 'Jane Rivers',
    person_category: 'community partner',
    sources: 'ghl,xero',
    paid_total: 0,
    paid_invoice_count: 0,
    last_paid_date: null,
    xero_project_codes: ['GOODS'],
    email: 'jane@example.org',
    company_name: 'River Country Alliance',
    tags: ['project:harvest'],
    last_contact_date: '2026-07-11T09:00:00Z',
    first_contact_date: '2025-04-01T09:00:00Z',
    engagement_status: 'active',
    is_storyteller: false,
    is_elder: false,
    gs_id: null,
    ...overrides,
  };
}

function contact360(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contact-1',
    ghl_id: 'ghl-jane',
    full_name: 'Jane Rivers',
    email: 'jane@example.org',
    company_name: 'River Country Alliance',
    tags: ['project:goods'],
    projects: ['ACT-GD'],
    engagement_status: 'active',
    first_contact_date: '2025-06-01T09:00:00Z',
    last_contact_date: '2026-07-12T09:00:00Z',
    opportunity_count: 2,
    total_pipeline_value: 120000,
    won_value: 25000,
    email_count: 8,
    last_email_date: '2026-07-13T09:00:00Z',
    first_email_date: '2025-05-01T09:00:00Z',
    total_revenue: 48000,
    total_payments: 4000,
    ...overrides,
  };
}

describe('ACT people directory identity joins', () => {
  it('assembles one canonical person across identity, organisation, history, project and money evidence', () => {
    const rows = buildActPersonDirectoryRows({
      people: [actPerson()],
      contacts: [contact360()],
      identities: [{
        person_id: 'person-1',
        full_name: 'Jane Rivers',
        email: 'jane@example.org',
        ghl_contact_id: 'ghl-jane',
        current_position: 'Director',
        current_company: 'River Country Alliance',
        data_quality_score: 92,
        data_sources: ['ghl', 'gmail'],
        needs_cleanup: false,
        last_verified_at: '2026-07-10T09:00:00Z',
        last_communication_at: '2026-07-13T09:00:00Z',
        unified_tags: ['partner'],
        updated_at: '2026-07-13T09:00:00Z',
      }],
      unifiedContacts: [{
        id: 'unified-1',
        name: 'Jane Rivers',
        email: 'jane@example.org',
        company: 'River Country Alliance',
        confidence: 0.97,
        relationship_strength: 'warm',
        primary_project_codes: ['ACT-GD'],
        sources: ['crm', 'xero'],
        ghl_id: 'ghl-jane',
        identifier_count: 3,
        updated_at: '2026-07-13T09:00:00Z',
      }],
      health: [{
        ghl_contact_id: 'ghl-jane',
        temperature: 68,
        lcaa_stage: 'active_partner',
        total_touchpoints: 12,
        inbound_count: 5,
        outbound_count: 7,
        last_contact_at: '2026-07-14T09:00:00Z',
        days_since_contact: 1,
        overall_sentiment: 'positive',
        suggested_actions: ['Invite Jane into the Goods evidence review.'],
        risk_flags: [],
      }],
      orgContacts: [{
        id: 'org-contact-1',
        name: 'Jane Rivers',
        email: 'jane@example.org',
        role: 'Director',
        organisation: 'River Country Alliance',
        last_contacted_at: '2026-07-09T09:00:00Z',
        linked_entity_id: 'entity-1',
        person_id: 'person-1',
        unified_tags: ['community'],
      }],
      entityLinks: [{
        contact_id: 'contact-1',
        entity_id: 'entity-1',
        entity_gs_id: 'GS-RIVER',
        entity_name: 'River Country Alliance Ltd',
        confidence_score: 0.96,
        verified: true,
      }],
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'unified-1',
      canonicalPersonId: 'person-1',
      identityStatus: 'canonical',
      canonicalOrganisationName: 'River Country Alliance Ltd',
      touchpoints: 12,
      inboundCount: 5,
      outboundCount: 7,
      receivedFromThem: 48000,
      paidToThem: 4000,
      firstContactAt: '2025-04-01T09:00:00Z',
      lastContactAt: '2026-07-14T09:00:00Z',
      recommendedMove: 'Invite Jane into the Goods evidence review.',
      evidenceGaps: [],
    });
    expect(rows[0].projects).toEqual(expect.arrayContaining(['ACT-GD', 'GOODS', 'HARVEST']));
  });

  it('keeps a paid but unresolved person visible with honest evidence gaps', () => {
    const rows = buildActPersonDirectoryRows({
      people: [actPerson({
        person_name: 'Maya North',
        email: null,
        company_name: null,
        paid_total: 2400,
        paid_invoice_count: 2,
        xero_project_codes: [],
        tags: [],
        first_contact_date: null,
        last_contact_date: null,
      })],
      contacts: [],
      identities: [],
      unifiedContacts: [],
      health: [],
      orgContacts: [],
      entityLinks: [],
    });

    expect(rows[0]).toMatchObject({
      name: 'Maya North',
      identityStatus: 'unresolved',
      paidToThem: 2400,
      paidInvoiceCount: 2,
    });
    expect(rows[0].evidenceGaps).toEqual([
      'canonical person identity',
      'canonical organisation',
      'dated contact history',
      'ACT project connection',
    ]);
    expect(rows[0].recommendedMove).toContain('canonical identity');
  });

  it('removes ACT operators from the external relationship directory', () => {
    const rows = buildActPersonDirectoryRows({
      people: [actPerson({ person_name: 'Benjamin Knight', email: 'benjamin@act.place' })],
      contacts: [contact360({ full_name: 'Benjamin Knight', email: 'benjamin@act.place' })],
      identities: [],
      unifiedContacts: [],
      health: [],
      orgContacts: [],
      entityLinks: [],
    });

    expect(rows).toEqual([]);
  });
});
