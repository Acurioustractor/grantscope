import { describe, expect, it } from 'vitest';
import { getAtlasLayer } from './layers';
import {
  ATLAS_STORY,
  ATLAS_STORY_MEASURED_AT,
  getStoryStep,
  storyLayersVisibleAt,
  storyStepIndex,
} from './story';

describe('the story sequence', () => {
  it('holds five steps with stable unique ids', () => {
    expect(ATLAS_STORY.length).toBe(5);
    const ids = ATLAS_STORY.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it('every step points at a registered, publicly visible layer', () => {
    expect(storyLayersVisibleAt('public')).toBe(true);
    for (const step of ATLAS_STORY) {
      expect(getAtlasLayer(step.view.layerKey), step.id).not.toBeNull();
    }
  });

  it('a step that opens a place always says which state it means', () => {
    for (const step of ATLAS_STORY) {
      if (step.view.place) {
        expect(step.view.pst, `${step.id} pst`).toBeTruthy();
        expect(step.view.place).toMatch(/^[a-z0-9-]+$/);
      }
    }
  });

  it('paragraphs are read-aloud length, titles are spoken length', () => {
    for (const step of ATLAS_STORY) {
      expect(step.paragraph.length, `${step.id} paragraph`).toBeGreaterThan(200);
      expect(step.paragraph.length, `${step.id} paragraph`).toBeLessThan(700);
      expect(step.title.length, `${step.id} title`).toBeLessThan(70);
      // The room register bans em-dashes; sentences carry the pauses.
      expect(step.paragraph, `${step.id} em-dash`).not.toContain('—');
    }
  });

  it('pins the figures that were verified against the registers', () => {
    // Verified 2026-08-08 against grantconnect_awards via exec_sql:
    //   Central Australia scope (place-intelligence PLACE_REGIONS):
    //     active $1,829.1M, ending within 24 months $1,170.6M (64%).
    //   The five Utopia orgs named in hubAdministration, all lga Alice
    //     Springs: $93.2M lifetime.
    // If these assertions fail because the copy changed, re-run those
    // queries before updating: the paragraphs are spoken as fact in a room.
    const utopia = getStoryStep('utopia-alice-springs');
    expect(utopia?.paragraph).toContain('93 million');
    expect(utopia?.paragraph).toContain('250 kilometres');
    const cliff = getStoryStep('renewal-cliff');
    expect(cliff?.paragraph).toContain('58 and 64 per cent');
    expect(cliff?.paragraph).toContain('1.17 billion of 1.83 billion');
    expect(ATLAS_STORY_MEASURED_AT).toBe('August 2026');
  });

  it('steps resolve by id and report their position', () => {
    expect(getStoryStep('recorded-not-landed')?.title).toBe('Recorded is not landed');
    expect(getStoryStep('nope')).toBeNull();
    expect(storyStepIndex('recorded-not-landed')).toBe(0);
    expect(storyStepIndex('correct-us')).toBe(4);
    expect(storyStepIndex('nope')).toBe(-1);
  });

  it('never references Goods on the public story surface', () => {
    for (const step of ATLAS_STORY) {
      const text = `${step.title} ${step.paragraph} ${step.cannotSay ?? ''}`.toLowerCase();
      expect(text.includes('goods'), `${step.id} mentions Goods`).toBe(false);
      expect(text.includes('beds'), `${step.id} mentions beds`).toBe(false);
    }
  });
});
