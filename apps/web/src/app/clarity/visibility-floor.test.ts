import { describe, expect, it } from 'vitest';
import { canRender } from '@/lib/visibility';
import { floorFor, floorReason } from './visibility-floor';

describe('floorFor — safe by default', () => {
  it('defaults an unknown object to operator, never public', () => {
    // The inversion that makes a miss cheap: getting the floor wrong costs visibility, not
    // consent. Nothing in the catalogue is public unless a surface deliberately promotes it.
    expect(floorFor({ object_name: 'some_new_table', domain: null })).toBe('operator');
    expect(floorFor({ object_name: 'austender_contracts', domain: 'government_spend_procurement' })).toBe(
      'operator',
    );
  });

  it('withholds every object in the storytelling_consent domain', () => {
    for (const name of ['stories', 'storytellers', 'transcripts', 'quotes', 'alma_consent_ledger']) {
      expect(floorFor({ object_name: name, domain: 'storytelling_consent' })).toBe('withheld');
    }
  });

  it('withholds the consent-governed objects that domain alone misses', () => {
    // Found 2026-08-16: a domain-only rule leaks these four. Derived analysis of a transcript is
    // still the storyteller's, and a view over storytellers is still storytellers.
    expect(floorFor({ object_name: 'story_analysis', domain: 'ai_agents_pipeline' })).toBe('withheld');
    expect(floorFor({ object_name: 'transcript_analysis', domain: 'ai_agents_pipeline' })).toBe(
      'withheld',
    );
    expect(floorFor({ object_name: 'tour_stories', domain: 'media_narrative' })).toBe('withheld');
    expect(floorFor({ object_name: 'partner_storytellers_v', domain: null })).toBe('withheld');
  });

  it('does not withhold history tables — `history` contains `story`', () => {
    // The over-capture that killed the name-pattern approach. h-i-STORY.
    for (const name of [
      'subscription_history',
      'communications_history',
      'clarity_object_history',
      'receipt_match_history',
      'project_health_history',
      'clarity_edge_history',
    ]) {
      expect(floorFor({ object_name: name, domain: 'platform_ops_auth' })).toBe('operator');
    }
  });
});

describe('floorReason — a refusal names its mechanism', () => {
  it('gives no reason for an ordinary object', () => {
    expect(floorReason({ object_name: 'gs_entities', domain: 'corporate_registry' })).toBeNull();
  });

  it('names the domain when that is why', () => {
    expect(floorReason({ object_name: 'stories', domain: 'storytelling_consent' })).toMatch(
      /storytelling_consent/,
    );
  });

  it('explains an out-of-domain withholding, naming where it was actually filed', () => {
    const reason = floorReason({ object_name: 'tour_stories', domain: 'media_narrative' });
    expect(reason).toMatch(/story content or identifies storytellers/);
    expect(reason).toMatch(/media narrative/);
  });
});

describe('the console surface', () => {
  it('cannot read the contents of any consent-governed object', () => {
    // The end-to-end assertion: the floor and the vocabulary agree that an admin session does not
    // open a storyteller's transcript.
    const consentGoverned = [
      { object_name: 'transcripts', domain: 'storytelling_consent' },
      { object_name: 'story_analysis', domain: 'ai_agents_pipeline' },
      { object_name: 'partner_storytellers_v', domain: null },
    ];
    for (const o of consentGoverned) {
      expect(canRender(floorFor(o), 'operator')).toBe(false);
      expect(canRender(floorFor(o), 'org')).toBe(false);
      expect(canRender(floorFor(o), 'public')).toBe(false);
    }
  });
});
