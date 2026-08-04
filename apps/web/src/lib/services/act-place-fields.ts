export type ActPlaceFieldKind = 'region' | 'community' | 'locality' | 'lga' | 'custom';

export type ActPlaceFieldLoader = 'civicgraph-place-field';

export interface ActPlaceFieldOutcome {
  number: string;
  title: string;
  detail: string;
  lenses: string[];
}

export interface ActPlaceFieldSupportPath {
  label: string;
  title: string;
  detail: string;
  next: string;
}

export interface ActPlaceFieldDefinition {
  slug: string;
  name: string;
  kind: ActPlaceFieldKind;
  state: string;
  subtitle: string;
  description: string;
  loader: ActPlaceFieldLoader;
  memberCommunities: string[];
  lenses: string[];
  tags: string[];
  evidenceLabel: string;
  evidenceUrl: string;
  evidenceCheckedAt: string;
  initiativeCount: number;
  initiativeRegisterLabel: string;
  officialProgressLabel: string;
  outcomesSourceNote: string;
  outcomes: ActPlaceFieldOutcome[];
  supportPaths: ActPlaceFieldSupportPath[];
  queryTerms: string[];
  primaryCommunityName: string;
}

const ACT_PLACE_FIELDS: ActPlaceFieldDefinition[] = [
  {
    slug: 'barkly',
    name: 'Barkly',
    kind: 'region',
    state: 'NT',
    subtitle: 'Regional field · Barkly, Northern Territory',
    description: 'A connected investigation of Barkly communities, people, organisations, ACT work, public money, Regional Deal initiatives, evidence, consent and possible next moves.',
    loader: 'civicgraph-place-field',
    memberCommunities: [
      'Tennant Creek',
      'Ali Curung',
      'Alpurrurulam',
      'Ampilatwatja',
      'Canteen Creek',
      'Elliott',
      'Epenarra',
      'Mungkarta',
    ],
    lenses: ['Goods', 'JusticeHub', 'Empathy Ledger', 'Relationships'],
    tags: ['regional field', 'Barkly Regional Deal', 'community authority', 'Northern Territory'],
    evidenceLabel: 'Barkly Regional Deal and live CivicGraph evidence',
    evidenceUrl: 'https://barklyregionaldeal.com.au/',
    evidenceCheckedAt: '2026-05-01',
    initiativeCount: 28,
    initiativeRegisterLabel: 'Barkly Regional Deal',
    officialProgressLabel: 'May 2026',
    outcomesSourceNote: 'Outcome framing comes from the local June 2024 Regional Deal theory-of-change material. It is historical context, not a substitute for current community interpretation.',
    outcomes: [
      { number: '01', title: 'Safe kids and youth', detail: 'Safety, prevention, youth voice and support close to family and community.', lenses: ['JusticeHub', 'Empathy Ledger'] },
      { number: '02', title: 'Learning in both worlds', detail: 'Education, culture, language, mentoring and pathways shaped around local ways of learning.', lenses: ['Stories', 'Relationships'] },
      { number: '03', title: 'Self-determination and meaningful jobs', detail: 'Local authority, Aboriginal employment, enterprise and procurement across the regional economy.', lenses: ['Goods', 'CivicGraph'] },
      { number: '04', title: 'Strong culture and wellbeing', detail: 'Culture, country, community connection and culturally safe services as foundations for wellbeing.', lenses: ['Empathy Ledger', 'JusticeHub'] },
      { number: '05', title: 'Quality services', detail: 'Transparent investment, accountable delivery and services that communities can access and trust.', lenses: ['CivicGraph', 'JusticeHub'] },
    ],
    supportPaths: [
      {
        label: 'Authority + relationships',
        title: 'Start with who can interpret the field',
        detail: 'Confirm community authority, decision rights and ACT’s strongest existing relationship before proposing work.',
        next: 'Review the evidence with a named local relationship holder.',
      },
      {
        label: 'Goods + procurement',
        title: 'Turn funded work into local capability',
        detail: 'Connect infrastructure, essential goods, maintenance and supplier opportunities to community-controlled organisations.',
        next: 'Review initiatives 2, 7, 9, 13, 18 and 23 for a locally authorised procurement pathway.',
      },
      {
        label: 'JusticeHub',
        title: 'Make prevention and service gaps visible',
        detail: 'Connect youth support, diversion, after-hours coverage, public funding and providers without exposing individual young people.',
        next: 'Validate the current service picture around initiatives 4, 6, 14, 15, 16 and 25.',
      },
      {
        label: 'Empathy Ledger',
        title: 'Keep community meaning beside the measures',
        detail: 'Link consented stories and community interpretation to places, initiatives and outcomes without copying restricted content.',
        next: 'Establish place- and initiative-level consent metadata before importing story excerpts.',
      },
    ],
    queryTerms: ['Barkly', 'Tennant Creek'],
    primaryCommunityName: 'Tennant Creek',
  },
  {
    slug: 'palm-island',
    name: 'Palm Island',
    kind: 'community',
    state: 'QLD',
    subtitle: 'Community field · Palm Island, Queensland',
    description: 'A connected investigation of Palm Island community evidence, PICC relationships, Goods delivery, justice and family-support programs, public money, cultural governance and possible ACT next moves.',
    loader: 'civicgraph-place-field',
    memberCommunities: ['Palm Island'],
    lenses: ['Goods', 'JusticeHub', 'Empathy Ledger', 'Relationships'],
    tags: ['community field', 'PICC', 'community authority', 'Queensland', 'Palm Island Aboriginal Shire'],
    evidenceLabel: 'Palm Island public evidence and live CivicGraph records',
    evidenceUrl: 'https://www.palmisland.qld.gov.au/',
    evidenceCheckedAt: '2026-07-14',
    initiativeCount: 5,
    initiativeRegisterLabel: 'Palm Island ACT workstreams',
    officialProgressLabel: 'Live CivicGraph',
    outcomesSourceNote: 'Outcome framing comes from ACT project memory and public CivicGraph records. It is a working interpretation, not a community mandate.',
    outcomes: [
      { number: '01', title: 'Community-led authority', detail: 'PICC, local Elders and community governance interpret what work is useful and authorised.', lenses: ['Relationships', 'Empathy Ledger'] },
      { number: '02', title: 'Safe families and young people', detail: 'Child, family, youth justice, DFV and wellbeing evidence remains connected without exposing individual risk.', lenses: ['JusticeHub'] },
      { number: '03', title: 'Goods and local capability', detail: 'Beds, goods, freight, repair, recycling and local production pathways are tied to place-based delivery reality.', lenses: ['Goods'] },
      { number: '04', title: 'Story sovereignty', detail: 'Repository, media and Empathy Ledger work stays governed by consent, attribution and cultural review.', lenses: ['Empathy Ledger'] },
      { number: '05', title: 'Funding clarity', detail: 'Public funding, contracts, philanthropy and ACT pipeline records stay separated by source and claim strength.', lenses: ['CivicGraph', 'JusticeHub'] },
    ],
    supportPaths: [
      {
        label: 'Authority + PICC',
        title: 'Start with the existing Palm Island relationship',
        detail: 'Confirm who can interpret the evidence, what PICC wants surfaced, and which decisions belong to community governance.',
        next: 'Review the field with the named Palm Island relationship holder before making any external ask.',
      },
      {
        label: 'Goods + freight',
        title: 'Make delivery and local capability visible',
        detail: 'Connect bed demand, assets, buyers, freight and supplier evidence without turning logistics into proof of impact.',
        next: 'Use the Goods dossier to test the next bed, repair or production decision.',
      },
      {
        label: 'JusticeHub',
        title: 'Keep system evidence accountable',
        detail: 'Trace youth, family, DFV, child-protection and wellbeing records back to public sources and local interpretation.',
        next: 'Separate current funded programs from historical claims before shaping a JusticeHub recommendation.',
      },
      {
        label: 'Empathy Ledger',
        title: 'Protect stories at the source',
        detail: 'Story, archive and media material needs explicit consent, audience and reuse metadata before CivicGraph reuses it.',
        next: 'Link to consent-governed source systems instead of copying restricted story content into Atlas.',
      },
    ],
    queryTerms: ['Palm Island', 'PICC', 'Palm Island Community Company'],
    primaryCommunityName: 'Palm Island',
  },
];

export function actPlaceFieldHref(orgSlug: string, placeSlug: string): string {
  return `/org/${orgSlug}/explore/place/${placeSlug}`;
}

export function getActPlaceFieldDefinition(placeSlug: string): ActPlaceFieldDefinition | null {
  const normalized = placeSlug.trim().toLocaleLowerCase('en-AU');
  return ACT_PLACE_FIELDS.find((field) => field.slug === normalized) ?? null;
}

export function searchActPlaceFields(query = '', state?: string): ActPlaceFieldDefinition[] {
  const needle = query.trim().toLocaleLowerCase('en-AU');
  return ACT_PLACE_FIELDS.filter((field) => {
    if (state && field.state !== state) return false;
    if (!needle) return true;
    const haystack = [
      field.name,
      field.subtitle,
      field.description,
      field.state,
      ...field.memberCommunities,
      ...field.lenses,
      ...field.tags,
    ].join(' ').toLocaleLowerCase('en-AU');
    return haystack.includes(needle);
  });
}
