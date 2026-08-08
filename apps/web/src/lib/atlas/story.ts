// Story mode: the fixed sequence the Atlas walks through in a room.
//
// Five steps. Each one is a map state plus one paragraph, written to be read
// aloud. This is the community-conversation artifact: the thing on the screen
// when the consent question gets asked in person. The register is the same
// one the place pages hold — say what the number contains, and where we
// cannot say, say that instead of guessing.
//
// Every figure in these paragraphs was verified against the database on the
// date below, using the same queries the region pages run. The paragraphs
// use rounded words ("more than 93 million dollars") so a small movement in
// the registers does not make the room copy wrong; the live region pages
// carry the exact current numbers.

import { getAtlasLayer, type AtlasConsentTier } from './layers';

export interface AtlasStoryView {
  /** Layer to select. May be a declared layer: the point of that step is
   * saying out loud that the Atlas cannot draw it yet. */
  layerKey: string;
  /** State filter chip; omitted means the whole country. */
  state?: string;
  /** Place to open in the rail, as a placeSlug. */
  place?: string;
  /** The place's state. Required whenever place is set: slugs collide. */
  pst?: string;
}

export interface AtlasStoryStep {
  /** Stable id — it is the URL (?story=<id>), so renumbering never breaks a link. */
  id: string;
  title: string;
  /** The read-aloud paragraph. One breath long, plain words. */
  paragraph: string;
  /** The "what we cannot say" line, when the step carries one. */
  cannotSay?: string;
  view: AtlasStoryView;
}

/** When the figures in the paragraphs were verified against the registers. */
export const ATLAS_STORY_MEASURED_AT = 'August 2026';

export const ATLAS_STORY: readonly AtlasStoryStep[] = [
  {
    id: 'recorded-not-landed',
    title: 'Recorded is not landed',
    paragraph:
      'This map colours every council by how much public money our records can see ' +
      'reaching it, set against how much disadvantage sits there. Before reading it, ' +
      'know one thing: money is counted where it was recorded, not where it landed. ' +
      'A grant run from a regional office is credited to the office’s town, not to ' +
      'the communities the work reaches.',
    view: { layerKey: 'funding-deserts' },
  },
  {
    id: 'utopia-alice-springs',
    title: 'Utopia’s money sits in Alice Springs',
    paragraph:
      'The Utopia homelands are roughly 250 kilometres north-east of Mparntwe, Alice ' +
      'Springs. Their organisations, including Urapuntja Health Service and Urapuntja ' +
      'Aboriginal Corporation, are registered to town addresses because that is where ' +
      'the post goes. More than 93 million dollars of their funding is counted as money ' +
      'reaching Alice Springs. Utopia has no council area of its own. On this map, ' +
      'Utopia is invisible, and Alice Springs looks better funded than it is.',
    cannotSay:
      'The national gazetteer holds no entry for Urapuntja or the homelands around it. ' +
      'We cannot place what the reference data cannot name.',
    view: { layerKey: 'funding-deserts', state: 'NT', place: 'alice-springs', pst: 'NT' },
  },
  {
    id: 'what-we-cannot-place',
    title: 'What we cannot place',
    paragraph:
      'This layer is the map grading its own homework. It shows the share of ' +
      'organisations registered in each council’s postcodes that our records cannot ' +
      'tie to any single council. One postcode, 0872, spans eight councils and a third ' +
      'of the continent. The darker the red, the less certain every other number on ' +
      'this map is. The places where the records are weakest are the same places the ' +
      'money is hardest to see.',
    view: { layerKey: 'unplaced-orgs' },
  },
  {
    id: 'renewal-cliff',
    title: 'The renewal cliff',
    paragraph:
      'Now add time. Across the four regions we have measured, between 58 and 64 per ' +
      'cent of committed federal grant money ends within the next 24 months. In Central ' +
      'Australia that is 1.17 billion of 1.83 billion dollars. An agreement ending is ' +
      'not the same as funding stopping, but it is the moment a decision gets made ' +
      'somewhere else. The Atlas cannot draw this layer per council yet, and the layer ' +
      'picker says so rather than hiding it.',
    cannotSay:
      'Renewals that happen without a new public record look like cliffs that never ' +
      'fall. The records show endings, not decisions.',
    view: { layerKey: 'renewal-cliff' },
  },
  {
    id: 'correct-us',
    title: 'The people who can correct this map are the people it is about',
    paragraph:
      'Everything here comes from public registers, and registers record addresses, ' +
      'councils and financial years. They do not record homelands, or money held by a ' +
      'regional body for communities, or work delivered 250 kilometres from where it ' +
      'is filed. So this map will be wrong in ways only local people can see. Every ' +
      'place page carries a correction form that goes to a person, not a pipeline. If ' +
      'this map says something wrong about your place, we want to be corrected.',
    view: { layerKey: 'funding-deserts' },
  },
];

export function getStoryStep(id: string): AtlasStoryStep | null {
  return ATLAS_STORY.find(step => step.id === id) ?? null;
}

export function storyStepIndex(id: string): number {
  return ATLAS_STORY.findIndex(step => step.id === id);
}

/** Story mode is a public-surface artifact: every layer a step points at must
 * be visible at the given tier. Used by tests and by the client as a guard. */
export function storyLayersVisibleAt(tier: AtlasConsentTier): boolean {
  return ATLAS_STORY.every(step => {
    const layer = getAtlasLayer(step.view.layerKey);
    return layer !== null && (tier !== 'public' || layer.consent === 'public');
  });
}
