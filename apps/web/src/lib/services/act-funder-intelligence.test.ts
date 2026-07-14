import { describe, expect, it } from 'vitest';
import {
  buildContactResolutionItems,
  contactMatchesFoundation,
  normaliseFunderIdentity,
  recommendFunderAction,
  relationshipState,
} from './act-funder-intelligence';

describe('ACT contact entity review queue', () => {
  it('surfaces a distinctive legal-name candidate without auto-linking it', () => {
    const [item] = buildContactResolutionItems([{
      contact_id: 'contact-1',
      contact_name: 'Gandel Foundation',
      organisation: 'Gandel Foundation',
      email: null,
      search_name: 'Gandel Foundation',
      entity_id: 'entity-1',
      entity_name: 'Gandel Family Foundation',
      entity_abn: '51393866453',
      entity_type: 'foundation',
      entity_website: null,
      name_score: 0.75,
    }]);

    expect(item.status).toBe('suggested');
    expect(item.candidates[0]).toMatchObject({ name: 'Gandel Family Foundation', nameScore: 75 });
  });

  it('keeps competing organisation candidates ambiguous', () => {
    const shared = {
      contact_id: 'contact-2',
      contact_name: 'Audrey Deemal',
      organisation: 'Cape York Partnership',
      email: 'adeemal@cyp.org.au',
      search_name: 'Cape York Partnership',
    };
    const [item] = buildContactResolutionItems([
      { ...shared, entity_id: 'entity-2', entity_name: 'Cape York Water Partnership, Inc', entity_abn: '98276605211', entity_type: 'charity', entity_website: null, name_score: 0.69 },
      { ...shared, entity_id: 'entity-3', entity_name: 'The Cape York Partnership Group Ltd', entity_abn: '67161760738', entity_type: 'charity', entity_website: null, name_score: 0.61 },
    ]);

    expect(item.status).toBe('ambiguous');
    expect(item.candidates).toHaveLength(2);
  });

  it('withholds unrelated fuzzy matches from approval', () => {
    const [item] = buildContactResolutionItems([{
      contact_id: 'contact-3',
      contact_name: 'CBA Foundation',
      organisation: 'CBA Foundation',
      email: null,
      search_name: 'CBA Foundation',
      entity_id: 'entity-4',
      entity_name: 'CAO Foundation',
      entity_abn: '47565421271',
      entity_type: 'foundation',
      entity_website: null,
      name_score: 0.67,
    }]);

    expect(item.status).toBe('research');
    expect(item.candidates).toEqual([]);
  });

  it('does not approve a low-score generic name overlap', () => {
    const [item] = buildContactResolutionItems([{
      contact_id: 'contact-4',
      contact_name: 'Sam Davies',
      organisation: 'Defy Design',
      email: 'sam@defydesign.org',
      search_name: 'Defy Design',
      entity_id: 'entity-5',
      entity_name: 'DEFY BY DESIGN LTD',
      entity_abn: '60636263146',
      entity_type: 'company',
      entity_website: null,
      name_score: 0.59,
    }]);

    expect(item.status).toBe('research');
    expect(item.candidates).toEqual([]);
  });
});

describe('ACT funder intelligence identity resolution', () => {
  it('normalises trustee and company wrappers without losing the distinctive name', () => {
    expect(normaliseFunderIdentity('The Trustee For The Snow Foundation')).toBe('snow foundation');
    expect(normaliseFunderIdentity('Paul Ramsay Foundation Limited')).toBe('paul ramsay foundation');
  });

  it('prefers exact organisation domains for direct contact evidence', () => {
    expect(contactMatchesFoundation(
      'The Trustee For The Snow Foundation',
      'https://www.snowfoundation.org.au',
      null,
      'sally@snowfoundation.org.au',
    )).toBe(true);
    expect(contactMatchesFoundation(
      'Paul Ramsay Foundation Limited',
      'https://paulramsayfoundation.org.au',
      'Unrelated Foundation',
      'person@example.org',
    )).toBe(false);
  });

  it('requires all distinctive name tokens for a company-name match', () => {
    expect(contactMatchesFoundation(
      'Paul Ramsay Foundation Limited',
      null,
      'Paul Ramsay Foundation',
      null,
    )).toBe(true);
    expect(contactMatchesFoundation(
      'Paul Ramsay Foundation Limited',
      null,
      'Ramsay Health',
      null,
    )).toBe(false);
  });

  it('does not turn a shared place word into a funder relationship', () => {
    expect(contactMatchesFoundation(
      'Sydney Community Foundation',
      null,
      'University of Sydney',
      'alice.motion@sydney.edu.au',
    )).toBe(false);
    expect(contactMatchesFoundation(
      'Sydney Community Foundation',
      null,
      'buttersydney.com',
      'manoli@buttersydney.com.au',
    )).toBe(false);
  });
});

describe('ACT funder intelligence next moves', () => {
  it('surfaces overdue human commitments before automated enrichment', () => {
    const result = recommendFunderAction({
      state: 'active',
      nextStep: 'Send the working brief',
      nextTouchAt: '2026-04-01T00:00:00Z',
      people: 2,
      grantees: 40,
      programs: 4,
      applicationPaths: 2,
    });
    expect(result.action).toBe('Send the working brief');
    expect(result.why).toContain('overdue');
  });

  it('finds a named person before recommending cold outreach', () => {
    expect(recommendFunderAction({
      state: 'cold',
      nextStep: null,
      nextTouchAt: null,
      people: 0,
      grantees: 12,
      programs: 3,
      applicationPaths: 1,
    }).action).toContain('program lead');
  });

  it('extracts funding behaviour before shaping an approach', () => {
    expect(recommendFunderAction({
      state: 'warm',
      nextStep: null,
      nextTouchAt: null,
      people: 1,
      grantees: 0,
      programs: 2,
      applicationPaths: 1,
    }).action).toContain('recent grantees');
  });

  it('treats registry officeholders as research leads rather than warm contacts', () => {
    const result = recommendFunderAction({
      state: 'known',
      nextStep: null,
      nextTouchAt: null,
      people: 8,
      directContacts: 0,
      grantees: 20,
      programs: 3,
      applicationPaths: 2,
    });
    expect(result.action).toContain('credible introduction');
    expect(result.why).toContain('none is yet a verified ACT contact');
  });

  it('uses a verified board bridge before suggesting generic outreach', () => {
    const result = recommendFunderAction({
      state: 'known',
      nextStep: null,
      nextTouchAt: null,
      people: 7,
      directContacts: 0,
      verifiedIntroductions: 1,
      introductionPerson: 'Georgina Byron',
      grantees: 12,
      programs: 2,
      applicationPaths: 1,
    });
    expect(result.action).toBe('Test the verified board introduction through Georgina Byron.');
    expect(result.why).toContain('current registry role');
  });

  it('describes an organisation bridge as a path to test', () => {
    const result = recommendFunderAction({
      state: 'known',
      nextStep: null,
      nextTouchAt: null,
      people: 6,
      directContacts: 0,
      verifiedIntroductions: 1,
      introductionPerson: 'Sally Grimsley-Ballard',
      introductionKind: 'shared_organisation',
      grantees: 10,
      programs: 2,
      applicationPaths: 1,
    });
    expect(result.action).toBe('Test the source-backed introduction through Sally Grimsley-Ballard.');
    expect(result.why).toContain('named contact at an organisation');
  });
});

describe('ACT funder relationship state', () => {
  it('does not call an undated CRM or board record warm', () => {
    expect(relationshipState(null, 3, 1, false)).toBe('known');
  });

  it('requires recent dated interaction evidence for active or warm states', () => {
    const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
    expect(relationshipState(daysAgo(30), 1, 0, false)).toBe('active');
    expect(relationshipState(daysAgo(180), 1, 0, false)).toBe('warm');
    expect(relationshipState(daysAgo(500), 1, 0, false)).toBe('known');
  });
});
