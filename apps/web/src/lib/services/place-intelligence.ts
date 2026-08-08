import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';

/**
 * Data for the public place pages.
 *
 * These numbers are read by people who live in the places being described, so
 * the caveats are part of the data rather than footnotes bolted on by the view:
 * contract value is by supplier registered address, and philanthropic counts
 * are floors limited by our grant-link coverage. Both travel to the page.
 */

export interface PlaceSnapshot {
  areaKey: string;
  areaLabel: string;
  areaNote: string | null;
  remoteness: string | null;
  irsdDecile: number;
  orgCount: number;
  communityControlledCount: number;
  caringForCountry: number;
  employers: number;
  contractCount: number;
  contractValue: number;
  contractValue24m: number;
  govtGrantCount: number;
  govtGrantValue: number;
  /**
   * Federal grants held by organisations registered here, whatever their
   * delivery location. The delivered figure above is keyed on a delivery
   * postcode that 93% of awards in this region do not publish, so on its own it
   * reports Central Desert at $2.8M against $212.8M actually held there.
   */
  grantsHeldCount: number;
  grantsHeldValue: number;
  /** Share of delivered grant money held by an organisation based here. */
  localRetentionPct: number | null;
  philanthropicFunderCount: number;
  philanthropicGrantCount: number;
  lgaResolved: boolean;
  /**
   * False when we hold no organisations for this council at all.
   *
   * The distinction matters more than it looks. A council with no record is not
   * a council where nothing happens — it is usually one whose organisations are
   * all registered somewhere else. Rendering it as a row of zeros would say the
   * first thing; leaving it out entirely, which is what happened before, said
   * nothing and hid four Cape York Aboriginal shires from their own page.
   */
  hasRecord: boolean;
  computedAt: string;
}

export interface UnplacedOrg {
  name: string;
  entityType: string | null;
  communityControlled: boolean;
}

export interface PlaceIntelligence {
  areas: PlaceSnapshot[];
  /** Organisations we can name but cannot place in a council area. */
  unplacedOrgs: UnplacedOrg[];
  unplacedTotal: number;
  gapNote: string | null;
  /** Share of the region's grant money that carries a delivery location. */
  deliveryCoverage: { knownM: number; unknownM: number; pct: number } | null;
  /** Deregistered corporations withheld from the list, reported rather than hidden. */
  deregisteredExcluded: number;
}

interface RawProfile {
  lga_name: string;
  state: string;
  remoteness: string | null;
  avg_irsd_decile: number | string | null;
  org_count: number;
  community_controlled: number;
  without_abn: number;
  caring_for_country: number;
  employers: number;
  contract_count: number;
  contract_value_lifetime: number | string;
  contract_value_24m: number | string;
  grants_delivered: number;
  grants_delivered_value: number | string;
  local_retention_pct: number | string | null;
  philanthropic_funders: number;
  philanthropic_grants: number;
}

/**
 * Outstations are administered from the regional centre, so postcode,
 * registered address and postal locality all point at the hub. The hub is then
 * credited with money earned by the communities it administers.
 *
 * This is not a defect waiting to be repaired. No source records where the work
 * happened, and inventing one would be worse than the distortion. It is a fact
 * about the register, so the page states it rather than quietly carrying it.
 *
 * It holds wherever a regional centre services remote communities: Central
 * Australia, the APY Lands, the Kimberley, Cape York. Declaring it per region
 * means the next region needs a registry entry, not new prose.
 */
export interface HubAdministration {
  /** The council credited with money earned elsewhere. */
  hubLga: string;
  /**
   * True when the hub is not one of this region's councils at all.
   *
   * Cape York broke the assumption that a hub is always inside the region it
   * distorts. Its communities each have their own shire council, and those
   * councils are still credited to Cairns, which is not on Cape York. The money
   * therefore appears in no figure on the region's own page — a stronger
   * statement than "one council is overstated", and one the earlier shape could
   * not express.
   */
  hubIsOutsideRegion: boolean;
  /** Communities administered from the hub, named as people there name them. */
  administeredCommunities: string[];
  /**
   * Organisations checked one by one and found credited to the hub.
   * A name list, not a rule: no heuristic separates a homeland organisation
   * from a town one, and guessing would put words in a community's mouth.
   */
  creditedOrgs: string[];
  note: string;
}

/**
 * A place people live in that the national gazetteer has no entry for.
 *
 * ABS SAL_2021 is the authority the rest of this pipeline resolves against, so
 * a place missing from it cannot be placed at all — not placed wrongly, simply
 * absent. Recording why makes the absence checkable rather than an oversight.
 */
export interface GazetteerGap {
  place: string;
  /** The ABS locality containing it, where one exists. */
  containingLocality: string | null;
  /** Councils that locality spans. More than one means we cannot choose. */
  straddles: string[];
  note: string;
}

/**
 * A region this service can describe.
 *
 * These were hardcoded to Central Australia. They are configuration now because
 * the same shape holds anywhere: a set of council areas, optionally the
 * postcodes whose organisations have no council area at all, and labels that
 * use the names people there actually use.
 */
export interface PlaceRegion {
  key: string;
  lgaNames: string[];
  states: string[];
  /**
   * Postcodes whose organisations cannot be placed in a council area at all.
   *
   * A list rather than one postcode because the Kimberley's unplaced
   * organisations are spread across five of them, and naming only the largest
   * would have hidden more than half of them.
   */
  unplaced: { postcodes: string[]; state: string } | null;
  labels: Record<string, { label: string; note: string | null }>;
  hubAdministration: HubAdministration | null;
  gazetteerGaps: GazetteerGap[];
  /**
   * Communities in the region and the council they are counted under.
   *
   * Lifted from the Far West Coast page, which listed them by hand. A council
   * area is an administrative unit and a community is a place people are from;
   * naming both together is the only way a reader can see when the two come
   * apart.
   */
  communities: RegionCommunity[];
  crossBorder: CrossBorderMisattribution | null;
}

/**
 * Organisations recorded in the wrong state.
 *
 * The APY Lands are South Australian, governed under South Australian land
 * rights legislation, and most of their organisations are recorded as Northern
 * Territory organisations in Alice Springs. Their post goes to Alice Springs
 * and the register followed the post across a state border.
 *
 * Kept separate from HubAdministration on purpose. A hub crediting itself with
 * a homeland's money is one error; a state boundary in the wrong place is
 * another, and it breaks the coarsest geography there is. Anything counting by
 * state gets both jurisdictions wrong at once.
 */
export interface CrossBorderMisattribution {
  /** Where the register puts them. */
  recordedState: string;
  /** Where they are. */
  actualState: string;
  recordedLga: string;
  communities: string[];
  /** Checked one by one, like every other list here. */
  orgNames: string[];
  note: string;
}

export interface RegionCommunity {
  name: string;
  /** The council our records place it under, or null when there is none. */
  council: string | null;
  note: string;
}

export const PLACE_REGIONS: Record<string, PlaceRegion> = {
  'central-australia': {
    key: 'central-australia',
    lgaNames: ['Alice Springs', 'Barkly', 'MacDonnell', 'Central Desert', 'Anangu Pitjantjatjara Yankunytjatjara'],
    states: ['NT', 'SA'],
    unplaced: { postcodes: ['0872'], state: 'NT' },
    labels: {
      'Alice Springs': {
        label: 'Mparntwe (Alice Springs)',
        note: 'Also carries organisations that belong to the Utopia homelands, because those organisations are administered from town. See what this number contains, below.',
      },
      Barkly: {
        label: 'Barkly, including Tennant Creek',
        note: 'Tennant Creek, Ali Curung and Ampilatwatja. Ampilatwatja is an Alyawarr community near the Utopia homelands; Ali Curung is Kaytetye and is not part of Utopia.',
      },
      MacDonnell: { label: 'MacDonnell', note: 'Includes Papunya, Hermannsburg and Areyonga.' },
      'Central Desert': { label: 'Central Desert', note: 'Includes Yuendumu and Atitjere.' },
      'Anangu Pitjantjatjara Yankunytjatjara': {
        label: 'APY Lands (South Australia)',
        note: 'Iwantja, Mimili, Kaltjiti and Pukatja. Their grants are delivered into postcode 0872, which spans eight councils, so most cannot be placed here.',
      },
    },
    // Verified 8 August 2026 by reading lga_name on each organisation named
    // here. Every one of them sits inside the Alice Springs figures above.
    hubAdministration: {
      hubLga: 'Alice Springs',
      hubIsOutsideRegion: false,
      administeredCommunities: ['Utopia / Urapuntja homelands', 'Arlparra', 'Ampilatwatja'],
      creditedOrgs: [
        'Urapuntja Health Service Aboriginal Corporation',
        'Urapuntja Aboriginal Corporation',
        'The Artists of Ampilatwatja Aboriginal Corporation',
        'Arlparra Aboriginal Corporation',
        'Utopia Farms Aboriginal Corporation',
      ],
      note:
        'These organisations work in the Utopia homelands, roughly 250km north-east of town. They are registered to Alice Springs postcodes because that is where the post goes, so every dollar they receive is counted as money reaching Alice Springs.',
    },
    // Utopia is not one place. It is roughly sixteen homelands across the
    // Sandover, and the gazetteer holds none of them.
    gazetteerGaps: [
      {
        place: 'Urapuntja (Utopia homelands)',
        containingLocality: 'SANDOVER',
        straddles: ['Barkly', 'Central Desert'],
        note:
          'URAPUNTJA is not a locality in ABS SAL_2021. The locality that contains it, SANDOVER, is — and it spans two councils, so even resolving to it would not name a council.',
      },
      {
        place: 'Mulga Bore, Aherrenge, Antewenegerrde, Thangkenharenge',
        containingLocality: null,
        straddles: [],
        note: 'Homelands with no entry in ABS SAL_2021 and no locality above them that has one.',
      },
    ],
    communities: [
      { name: 'Mparntwe (Alice Springs)', council: 'Alice Springs', note: 'The regional centre. Administers much of the rest of this list.' },
      { name: 'Tennant Creek', council: 'Barkly', note: 'Postcode 0860. Placed correctly.' },
      { name: 'Utopia / Urapuntja homelands', council: null, note: 'No council area. Its organisations are counted under Alice Springs or nowhere.' },
      { name: 'Arlparra', council: 'Alice Springs', note: 'In the Utopia homelands, counted under Alice Springs.' },
      { name: 'Ampilatwatja', council: 'Barkly', note: 'ABS places the locality in Barkly, and the health centre resolves there. The art centre, filed to a town address, resolves to Alice Springs.' },
      { name: 'Ali Curung', council: 'Barkly', note: 'Kaytetye country. Not part of the Utopia homelands, despite older notes here saying so.' },
      { name: 'Atitjere', council: 'Central Desert', note: 'Placed correctly by ABS.' },
      { name: 'APY Lands (South Australia)', council: 'Alice Springs', note: 'Pukatja, Amata, Mimili, Kaltjiti, Iwantja, Kalka, Nyapari and Watarru. Most of their organisations are recorded in the Northern Territory. See below.' },
    ],
    // Verified 8 August 2026 by reading state and lga_name on each name here.
    // 12 carry state 'NT' and Alice Springs; Ernabella Arts carries no state at
    // all. Three APY organisations are recorded correctly and are not listed.
    crossBorder: {
      recordedState: 'NT',
      actualState: 'SA',
      recordedLga: 'Alice Springs',
      communities: ['Pukatja', 'Amata', 'Mimili', 'Kaltjiti', 'Iwantja', 'Kalka', 'Nyapari', 'Watarru'],
      orgNames: [
        'APY Art Centre Collective Aboriginal Corporation',
        'Ernabella Arts Incorporated',
        'Pukatja Supermarket and Associated Stores Aboriginal Corporation',
        'Kaltjiti Arts and Crafts Aboriginal Corporation',
        'Kaltjiti Community (Aboriginal Corporation)',
        'Indulkana Community Store Aboriginal Corporation',
        'INDULKANA SOCIAL CLUB INC',
        'IWANTJA COMMUNITY INC GRANTE DOWNS',
        'Amata Anangu Store Aboriginal Corporation',
        'Mimili Maku Store Aboriginal Corporation',
        'Kalka Community Aboriginal Corporation',
        'NYAPARI COMMUNITY INC',
        'Watarru Community (Aboriginal Corporation)',
      ],
      note:
        'The APY Lands are in South Australia, governed under South Australian land rights legislation. Their post comes to Alice Springs, and the register followed it across the border. Anything counting by state gets both jurisdictions wrong at once: South Australia is short these organisations and the Northern Territory is credited with them.',
    },
  },
  // Wirangu country and the Far West Coast.
  //
  // This entry described the opposite of the current data until 8 August 2026.
  // Postcode 5690 used to map every locality in it, Ceduna township included,
  // to Maralinga Tjarutja. Rebuilding postcode_geo from ABS reversed that:
  // Maralinga Tjarutja now holds no organisations at all and Ceduna holds all
  // 23, Oak Valley and Yalata among them. Same distortion, other direction.
  'far-west-coast': {
    key: 'far-west-coast',
    lgaNames: ['Ceduna', 'Maralinga Tjarutja', 'Streaky Bay'],
    states: ['SA'],
    unplaced: null,
    labels: {
      Ceduna: {
        label: 'Ceduna (District Council)',
        note: 'Holds every organisation on the Far West Coast, including ones that work at Oak Valley, Yalata and Koonibba rather than in town. See what this number contains, below.',
      },
      'Maralinga Tjarutja': {
        label: 'Maralinga Tjarutja',
        note: 'Holds no organisations in our records. Not because none work there, but because all of them are registered to Ceduna addresses.',
      },
      'Streaky Bay': { label: 'Streaky Bay', note: null },
    },
    // Verified 8 August 2026 by reading lga_name on each organisation named.
    hubAdministration: {
      hubLga: 'Ceduna',
      hubIsOutsideRegion: false,
      administeredCommunities: ['Oak Valley', 'Yalata', 'Koonibba', 'Scotdesco'],
      creditedOrgs: [
        'Oak Valley (Maralinga) Aboriginal Corporation',
        'Yalata Anangu Aboriginal Corporation',
        'Koonibba Community Aboriginal Corporation',
        'Maralinga Tjarutja',
      ],
      note:
        'Oak Valley is around 700km from Ceduna. Its corporation, Yalata, Koonibba and the Maralinga Tjarutja administration itself all carry Ceduna addresses, so their money is counted as reaching Ceduna.',
    },
    gazetteerGaps: [],
    // Left empty deliberately. The Far West Coast page lists its communities by
    // hand, with distances, and is not rendered by RegionReport. Duplicating
    // that list here would give it two sources that can disagree.
    communities: [],
    crossBorder: null,
  },
  // The Kimberley. Verified 8 August 2026, org by org, the same way as the
  // other two: read lga_name on each organisation, then check the localities
  // against ABS rather than against what the names suggest.
  //
  // The wall is worse here than anywhere yet measured. Halls Creek has five
  // organisations with a council area and 100 without, 75 of them
  // community-controlled.
  kimberley: {
    key: 'kimberley',
    lgaNames: ['Broome', 'Derby-West Kimberley', 'Halls Creek', 'Wyndham-East Kimberley'],
    states: ['WA'],
    unplaced: { postcodes: ['6725', '6743', '6770', '6765', '6740'], state: 'WA' },
    labels: {
      Broome: {
        label: 'Rubibi (Broome)',
        note: 'Also carries organisations working on the Dampier Peninsula, several hundred kilometres north, because their post comes to Broome. See what this number contains, below.',
      },
      'Derby-West Kimberley': {
        label: 'Derby and the West Kimberley',
        note: 'Covers Fitzroy Crossing and part of the Dampier Peninsula. Postcode 6765 splits between here and Halls Creek.',
      },
      'Halls Creek': {
        label: 'Halls Creek',
        note: 'Five organisations here have a council area and 100 in postcode 6770 have none. Read the five as a fragment, not a picture.',
      },
      'Wyndham-East Kimberley': {
        label: 'Wyndham and the East Kimberley',
        note: 'Includes Kununurra and Warmun.',
      },
    },
    hubAdministration: {
      hubLga: 'Broome',
      hubIsOutsideRegion: false,
      administeredCommunities: ['Ardyaloon (One Arm Point)', 'Djarindjin', 'Lombadina', 'Beagle Bay'],
      creditedOrgs: [
        'Djarindjin Aboriginal Corporation',
        'Ardyaloon Incorporated',
        'Bardi and Jawi Niimidiman Aboriginal Corporation RNTBC',
        'Ardyaloon Art & Culture Aboriginal Corporation',
      ],
      note:
        'These organisations work on the Dampier Peninsula, up to 200km north of town by road. Their ACNC record gives Broome as the town, because that is where the post goes, so their money is counted as money reaching Broome.',
    },
    gazetteerGaps: [
      {
        place: 'Ardyaloon, Djarindjin, Lombadina, Beagle Bay',
        containingLocality: 'DAMPIER PENINSULA',
        straddles: ['Broome', 'Derby-West Kimberley'],
        note:
          'None of these communities is a locality in ABS SAL_2021. The one that contains them, DAMPIER PENINSULA, is — and it spans two councils, so resolving to it would still not name one.',
      },
      {
        place: 'Bidyadanga',
        containingLocality: null,
        straddles: [],
        note:
          'The largest remote Aboriginal community in Western Australia, and it has no entry in ABS SAL_2021. Its organisations sit in postcode 6725 with no council area.',
      },
    ],
    communities: [
      { name: 'Rubibi (Broome)', council: 'Broome', note: 'The regional centre. Administers the Dampier Peninsula communities below.' },
      { name: 'Ardyaloon (One Arm Point)', council: 'Broome', note: 'On the Dampier Peninsula. Counted under Broome because its ACNC town is Broome.' },
      { name: 'Djarindjin', council: 'Broome', note: 'On the Dampier Peninsula. Counted under Broome. Holds the largest single grant total of the four.' },
      { name: 'Lombadina', council: null, note: 'On the Dampier Peninsula. Absent from ABS SAL_2021.' },
      { name: 'Beagle Bay', council: null, note: 'Absent from ABS SAL_2021. Its organisations sit in postcode 6725 with no council area.' },
      { name: 'Bidyadanga', council: null, note: 'The largest remote Aboriginal community in WA, and absent from the gazetteer entirely.' },
      { name: 'Fitzroy Crossing', council: 'Derby-West Kimberley', note: 'Postcode 6765, which splits between Derby-West Kimberley and Halls Creek.' },
      { name: 'Warmun', council: 'Halls Creek', note: 'Placed correctly by ABS, in postcode 6743.' },
    ],
    crossBorder: null,
  },
  // Cape York. Verified 8 August 2026 and it broke the model.
  //
  // Every other region here has a hub inside it: Alice Springs is in Central
  // Australia, Broome is in the Kimberley. On Cape York each community has its
  // own shire council, so there is no in-region hub — and the distortion is
  // worse rather than absent. The councils themselves are registered in Cairns,
  // which is not on Cape York, so their money appears in no figure on this
  // region's page at all.
  //
  // It is also the first region where the failure mode is confident and wrong
  // rather than absent. Utopia and the Dampier Peninsula fall out of the
  // gazetteer and land unplaced, which the page can say. Kowanyama Aboriginal
  // Council is placed, in Cairns, with nothing to signal doubt.
  'cape-york': {
    key: 'cape-york',
    lgaNames: [
      'Aurukun', 'Cook', 'Hope Vale', 'Kowanyama', 'Lockhart River', 'Mapoon',
      'Napranum', 'Northern Peninsula Area', 'Pormpuraaw', 'Torres',
      'Torres Strait Island', 'Weipa', 'Wujal Wujal',
    ],
    states: ['QLD'],
    unplaced: { postcodes: ['4871', '4874', '4876', '4892', '4895'], state: 'QLD' },
    labels: {
      Cook: { label: 'Cook Shire', note: 'Covers Coen, Laura and Cooktown. The largest council on the peninsula by organisation count, and it holds 24.' },
      Torres: { label: 'Torres Shire', note: 'Thursday Island and the inner islands.' },
      'Northern Peninsula Area': { label: 'Northern Peninsula Area', note: 'Bamaga, Seisia, Injinoo, Umagico and New Mapoon. Placed correctly through their ACNC town.' },
      'Torres Strait Island': { label: 'Torres Strait Island Regional Council', note: null },
      Aurukun: { label: 'Aurukun Shire', note: 'Holds three organisations in our records.' },
      Pormpuraaw: { label: 'Pormpuraaw Shire', note: 'Holds three organisations in our records.' },
      Kowanyama: { label: 'Kowanyama Shire', note: 'Holds one organisation. Kowanyama Aboriginal Council, the local government itself, is counted under Cairns.' },
      'Wujal Wujal': { label: 'Wujal Wujal Shire', note: 'Holds one organisation.' },
      Weipa: { label: 'Weipa', note: null },
      // Notes here appear beneath the "nothing in our records" card, so they
      // should add a fact rather than restate it. Left null where we have none.
      'Hope Vale': { label: 'Hope Vale Shire', note: null },
      Mapoon: { label: 'Mapoon Shire', note: 'Old Mapoon Aboriginal Corporation is registered in Cairns and counted there.' },
      Napranum: { label: 'Napranum Shire', note: null },
      'Lockhart River': { label: 'Lockhart River Shire', note: 'Its council runs a youth service that has taken 45 grants worth $13.2M, all counted under Cairns.' },
    },
    // Verified 8 August 2026 by reading lga_name on each organisation. All are
    // postcode 4870, all counted under Cairns.
    hubAdministration: {
      hubLga: 'Cairns',
      hubIsOutsideRegion: true,
      administeredCommunities: ['Kowanyama', 'Lockhart River', 'Mapoon', 'Aurukun', 'Seisia'],
      creditedOrgs: [
        'Apunipima Cape York Health Council Aboriginal Corporation',
        'Cape York Solutions',
        'Cape York Land Council Aboriginal Corporation',
        'Cape York Employment Pty Ltd',
        'AFL Cape York',
        'Kowanyama Aboriginal Council',
        'CAPE YORK INSTITUTE FOR POLICY AND LEADERSHIP LTD',
        'Lockhart River Aboriginal Shire Council Youth Support',
        'Cape York Natural Resource Management Ltd.',
        'Balkanu Cape York Development Corporation Pty Ltd',
      ],
      note:
        'These organisations carry Cape York in their names or serve its communities, and every one of them is registered in Cairns, off the peninsula. Kowanyama Aboriginal Council is a local government; it is recorded as a Cairns organisation. Cairns is not a Cape York council, so none of this money appears in any figure on this page.',
    },
    // No gazetteer gaps found. The communities here are in ABS SAL_2021 and
    // have their own councils. That is what makes this region different: the
    // reference data is fine and the addresses are not.
    gazetteerGaps: [],
    communities: [
      { name: 'Kowanyama', council: 'Kowanyama', note: 'Also appears under Cairns, Carpentaria and Tablelands, depending which address each organisation filed. Carpentaria and Tablelands are not on Cape York.' },
      { name: 'Aurukun', council: 'Aurukun', note: 'Its community corporation is placed correctly; a tourism business with the same name is counted under Cairns.' },
      { name: 'Pormpuraaw', council: 'Pormpuraaw', note: 'The art centre is placed correctly. The sports club is counted under Carpentaria.' },
      { name: 'Lockhart River', council: null, note: 'No organisations placed here. Its council runs a youth service counted under Cairns.' },
      { name: 'Bamaga and Seisia', council: 'Northern Peninsula Area', note: 'Placed correctly through their ACNC town. One Seisia corporation is counted under Cairns.' },
      { name: 'Wujal Wujal', council: 'Wujal Wujal', note: 'Its justice group is placed correctly.' },
      { name: 'Hope Vale, Mapoon, Napranum', council: null, note: 'No organisations in our records under any council.' },
    ],
    crossBorder: null,
  },
};

function num(value: number | string | null): number {
  if (value === null) return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const getPlaceIntelligence = cache(
  async function getPlaceIntelligence(regionKey: string): Promise<PlaceIntelligence> {
    const region = PLACE_REGIONS[regionKey];
    if (!region) {
      throw new Error(`Unknown place region: ${regionKey}`);
    }
    const db = getServiceSupabase();

    const [snapshotResult, orgsResult, gapResult, deregisteredResult] = await Promise.all([
      // mv_lga_place_profile, not place_funding_snapshot. The underlying view
      // aggregates every LGA in the country before filtering, so reading it in
      // the request path timed out; it is materialized and refreshed after an
      // ingest instead. The snapshot was built
      // before councils were reattributed to the shires they serve, so it still
      // credited Alice Springs with $749.4M rather than $688.4M, and its grants
      // figure predates GrantConnect entirely — showing $44.1M where delivered
      // grants are $202.8M.
      db.from('mv_lga_place_profile')
        .select('lga_name, state, remoteness, avg_irsd_decile, org_count, community_controlled, without_abn, caring_for_country, employers, contract_count, contract_value_lifetime, contract_value_24m, grants_delivered, grants_delivered_value, local_retention_pct, philanthropic_funders, philanthropic_grants')
        .in('lga_name', region.lgaNames)
        .in('state', region.states),
      // The homelands organisations, named. They have no council area, so the
      // only honest way to show them is by name — and all of them, not a
      // slice. An alphabetical cap truncates mid-list and quietly drops the
      // Utopia and Urapuntja organisations at the end of the alphabet, which
      // is the same erasure the geocoding bug caused.
      // Deregistered ORIC corporations are excluded. Listing a defunct
      // corporation as a current community organisation misrepresents the
      // community it belonged to, and the first version of this page did
      // exactly that for 57 of them.
      // lga_name IS NULL matters. Without it this listed every organisation in
      // the postcode under a heading saying none of them can be placed, so
      // Urapuntja Aboriginal Corporation appeared as unplaceable on the same
      // page that showed it counted under Alice Springs.
      region.unplaced
        ? db.from('gs_entities')
            .select('canonical_name, entity_type, is_community_controlled')
            .eq('state', region.unplaced.state)
            .in('postcode', region.unplaced.postcodes)
            .is('lga_name', null)
            .or('is_community_controlled.eq.true,entity_type.eq.indigenous_corp')
            .or('oric_status.is.null,oric_status.neq.Deregistered')
            .order('canonical_name')
            .limit(300)
        : Promise.resolve({ data: [], error: null }),
      region.unplaced
        ? db.from('geo_resolution_gaps')
            .select('postcode, required_source, affected_entities, affected_community_controlled')
            .in('postcode', region.unplaced.postcodes)
        : Promise.resolve({ data: null, error: null }),
      region.unplaced
        ? db.from('gs_entities')
            .select('id', { count: 'exact', head: true })
            .eq('state', region.unplaced.state)
            .in('postcode', region.unplaced.postcodes)
            .or('is_community_controlled.eq.true,entity_type.eq.indigenous_corp')
            .eq('oric_status', 'Deregistered')
        : Promise.resolve({ count: 0, error: null }),
    ]);

    if (snapshotResult.error) {
      throw new Error(`Place snapshot unavailable: ${snapshotResult.error.message}`);
    }

    const profileByLga = new Map<string, RawProfile>();
    for (const row of (snapshotResult.data || []) as RawProfile[]) {
      profileByLga.set(row.lga_name, row);
    }

    // Built from the councils the region declares, not from the rows that came
    // back. A council whose organisations were all nulled produces no row, so
    // reading only the result set deleted it from its own region page. That is
    // how Maralinga Tjarutja and the Hope Vale, Mapoon, Napranum and Lockhart
    // River shires disappeared — five councils, four of them Aboriginal shires,
    // absent from pages about the places they govern.
    const computedAt = new Date().toISOString();
    const areas: PlaceSnapshot[] = region.lgaNames
      .map(lgaName => {
        const row = profileByLga.get(lgaName);
        return {
          areaKey: lgaName,
          areaLabel: region.labels[lgaName]?.label ?? lgaName,
          areaNote: region.labels[lgaName]?.note ?? null,
          hasRecord: Boolean(row),
          remoteness: row?.remoteness ?? null,
          irsdDecile: num(row?.avg_irsd_decile ?? null),
          orgCount: row?.org_count ?? 0,
          communityControlledCount: row?.community_controlled ?? 0,
          caringForCountry: row?.caring_for_country ?? 0,
          employers: row?.employers ?? 0,
          contractCount: row?.contract_count ?? 0,
          contractValue: num(row?.contract_value_lifetime ?? null),
          contractValue24m: num(row?.contract_value_24m ?? null),
          govtGrantCount: row?.grants_delivered ?? 0,
          govtGrantValue: num(row?.grants_delivered_value ?? null),
          grantsHeldCount: 0,
          grantsHeldValue: 0,
          localRetentionPct:
            row?.local_retention_pct === null || row?.local_retention_pct === undefined
              ? null
              : num(row.local_retention_pct),
          philanthropicFunderCount: row?.philanthropic_funders ?? 0,
          philanthropicGrantCount: row?.philanthropic_grants ?? 0,
          lgaResolved: true,
          computedAt,
        };
      })
      // Councils we hold nothing for sort last, and alphabetically among
      // themselves, so they read as a group rather than as the bottom of a
      // league table they were never in.
      .sort((left, right) => {
        if (left.hasRecord !== right.hasRecord) return left.hasRecord ? -1 : 1;
        if (!left.hasRecord) return left.areaLabel.localeCompare(right.areaLabel);
        return right.contractValue + right.govtGrantValue - (left.contractValue + left.govtGrantValue);
      });

    const unplacedOrgs = orgsResult.error
      ? []
      : ((orgsResult.data || []) as Array<{
          canonical_name: string;
          entity_type: string | null;
          is_community_controlled: boolean | null;
        }>).map(row => ({
          name: row.canonical_name,
          entityType: row.entity_type,
          communityControlled: row.is_community_controlled === true,
        }));

    // How much of the region's grant money can be placed at all. Most cannot:
    // the agencies funding Indigenous affairs and social services publish a
    // delivery location on almost nothing, so a map of delivered grants shows a
    // small and unrepresentative slice.
    const unplacedClause = region.unplaced
      ? ` OR e.postcode IN (${quoted(region.unplaced.postcodes)})`
      : '';
    const coverageResult = await db.rpc('exec_sql', {
      query: `SELECT round(sum(ga.value_aud) FILTER (WHERE ga.delivery_postcode IS NOT NULL)/1e6,1) AS known_m,
                     round(sum(ga.value_aud) FILTER (WHERE ga.delivery_postcode IS NULL)/1e6,1) AS unknown_m
                FROM grantconnect_awards ga
                JOIN gs_entities e ON e.id = ga.gs_entity_id
               WHERE e.state IN (${quoted(region.states)})
                 AND (e.lga_name IN (${quoted(region.lgaNames)})${unplacedClause})`,
    });
    // Grants keyed on the recipient's registered address rather than the
    // award's delivery postcode — the basis the Ceduna work settled on, because
    // most awards publish no delivery location at all. Kept beside the
    // delivered figure rather than replacing it: one says where money is spent,
    // the other says which organisations hold it, and neither is the whole
    // answer.
    const heldResult = await db.rpc('exec_sql', {
      query: `SELECT e.lga_name, count(*) AS awards, sum(ga.value_aud) AS value
                FROM grantconnect_awards ga
                JOIN gs_entities e ON e.id = ga.gs_entity_id
               WHERE e.state IN (${quoted(region.states)})
                 AND e.lga_name IN (${quoted(region.lgaNames)})
               GROUP BY e.lga_name`,
    });
    const heldByLga = new Map<string, { awards: number; value: number }>();
    if (Array.isArray(heldResult.data)) {
      for (const row of heldResult.data as Array<Record<string, unknown>>) {
        heldByLga.set(String(row.lga_name), {
          awards: num((row.awards as number | string | null) ?? null),
          value: num((row.value as number | string | null) ?? null),
        });
      }
    }
    for (const area of areas) {
      const held = heldByLga.get(area.areaKey);
      area.grantsHeldCount = held?.awards ?? 0;
      area.grantsHeldValue = held?.value ?? 0;
    }

    const covRow = Array.isArray(coverageResult.data) ? coverageResult.data[0] as Record<string, unknown> : null;
    const knownM = num((covRow?.known_m as number | string | null) ?? null);
    const unknownM = num((covRow?.unknown_m as number | string | null) ?? null);
    const coverage = knownM + unknownM > 0
      ? { knownM, unknownM, pct: Math.round((100 * knownM) / (knownM + unknownM)) }
      : null;

    // Summed across every unplaced postcode. The Kimberley's wall is spread
    // over five of them, so reading one row would report a fifth of it.
    const gapRows = gapResult.error
      ? []
      : ((gapResult.data || []) as Array<{
          required_source: string;
          affected_entities: number;
          affected_community_controlled: number;
        }>);
    const gapTotals = gapRows.reduce(
      (total, row) => ({
        entities: total.entities + (row.affected_entities || 0),
        communityControlled: total.communityControlled + (row.affected_community_controlled || 0),
      }),
      { entities: 0, communityControlled: 0 },
    );
    const requiredSources = [...new Set(gapRows.map(row => row.required_source).filter(Boolean))];

    return {
      areas,
      unplacedOrgs,
      unplacedTotal: gapTotals.entities || unplacedOrgs.length,
      gapNote: gapRows.length
        ? `${gapTotals.communityControlled} of ${gapTotals.entities} organisations here are community-controlled. Placing them in a council area needs the ${requiredSources.join(', or the ')}.`
        : null,
      deregisteredExcluded: deregisteredResult.error ? 0 : (deregisteredResult.count ?? 0),
      deliveryCoverage: coverage,
    };
  },
);

export function getCentralAustraliaIntelligence(): Promise<PlaceIntelligence> {
  return getPlaceIntelligence('central-australia');
}

export interface CreditedOrg {
  name: string;
  /**
   * How many rows the register holds for this organisation.
   *
   * Usually one. Kalka Community Aboriginal Corporation has two — an ABN
   * registration placed in Alice Springs and an ORIC registration placed
   * nowhere. They are merged so one organisation counts once, and the number is
   * shown rather than swallowed.
   */
  records: number;
  /** Null when the organisation is in no council area at all. */
  lgaName: string | null;
  postcode: string | null;
  grants: number;
  grantValue: number;
  contracts: number;
  contractValue: number;
}

export interface CrossBorderPicture extends CrossBorderMisattribution {
  orgs: CreditedOrg[];
  /** Money recorded in the wrong state. */
  misattributedValue: number;
  missing: string[];
}

export interface HubAdministrationPicture extends HubAdministration {
  orgs: CreditedOrg[];
  /** Money credited to the hub that was earned in the communities it administers. */
  creditedValue: number;
  /** Organisations named in the registry we could not find. Reported, not hidden. */
  missing: string[];
}

/**
 * What a hub council's figure actually contains.
 *
 * Computed from the register on every request rather than written into the
 * registry, because a hardcoded total silently goes stale the next time an
 * award lands or an address changes — and a stale number on a page about
 * misattributed numbers would be its own joke.
 */
/**
 * Money and council for a named list of organisations.
 *
 * Shared by the hub and cross-border pictures. Both ask the same question of a
 * different list, and both compute it per request rather than storing a total,
 * because a hardcoded figure on a page about wrong figures would be its own
 * joke.
 */
async function describeOrgs(names: string[]): Promise<{ orgs: CreditedOrg[]; missing: string[] } | null> {
  const db = getServiceSupabase();
  const { data, error } = await db
    .from('gs_entities')
    .select('id, abn, canonical_name, lga_name, postcode')
    .in('canonical_name', names);
  if (error) return null;

  const entities = (data || []) as Array<{
    id: string;
    abn: string | null;
    canonical_name: string;
    lga_name: string | null;
    postcode: string | null;
  }>;
  if (entities.length === 0) return { orgs: [], missing: names };

  const abns = entities.map(row => row.abn).filter((abn): abn is string => Boolean(abn));
  const [awardsResult, contractsResult] = await Promise.all([
    db.from('grantconnect_awards').select('gs_entity_id, value_aud').in('gs_entity_id', entities.map(row => row.id)),
    abns.length
      ? db.from('austender_contracts').select('supplier_abn, contract_value').in('supplier_abn', abns)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const grantsByEntity = new Map<string, { count: number; value: number }>();
  for (const row of (awardsResult.data || []) as Array<{ gs_entity_id: string; value_aud: number | string | null }>) {
    const tally = grantsByEntity.get(row.gs_entity_id) ?? { count: 0, value: 0 };
    tally.count += 1;
    tally.value += num(row.value_aud);
    grantsByEntity.set(row.gs_entity_id, tally);
  }

  const contractsByAbn = new Map<string, { count: number; value: number }>();
  for (const row of (contractsResult.data || []) as Array<{ supplier_abn: string; contract_value: number | string | null }>) {
    const tally = contractsByAbn.get(row.supplier_abn) ?? { count: 0, value: 0 };
    tally.count += 1;
    tally.value += num(row.contract_value);
    contractsByAbn.set(row.supplier_abn, tally);
  }

  // Merged by name. The register holds more than one row for some
  // organisations, and counting an organisation twice because it registered
  // twice would overstate the very problem these lists exist to describe.
  // A placed council wins over an unplaced one: if any record locates it, that
  // is where the money is being counted.
  const byName = new Map<string, CreditedOrg>();
  for (const row of entities) {
    const grants = grantsByEntity.get(row.id) ?? { count: 0, value: 0 };
    const contracts = (row.abn && contractsByAbn.get(row.abn)) || { count: 0, value: 0 };
    const existing = byName.get(row.canonical_name);
    if (!existing) {
      byName.set(row.canonical_name, {
        name: row.canonical_name,
        records: 1,
        lgaName: row.lga_name,
        postcode: row.postcode,
        grants: grants.count,
        grantValue: grants.value,
        contracts: contracts.count,
        contractValue: contracts.value,
      });
      continue;
    }
    existing.records += 1;
    existing.lgaName = existing.lgaName ?? row.lga_name;
    existing.postcode = existing.postcode ?? row.postcode;
    existing.grants += grants.count;
    existing.grantValue += grants.value;
    existing.contracts += contracts.count;
    existing.contractValue += contracts.value;
  }

  const orgs: CreditedOrg[] = [...byName.values()].sort(
    (left, right) => right.grantValue + right.contractValue - (left.grantValue + left.contractValue),
  );

  const found = new Set(entities.map(row => row.canonical_name));
  return { orgs, missing: names.filter(name => !found.has(name)) };
}

/**
 * Organisations this region's page has to report as recorded in another state.
 */
export const getCrossBorderPicture = cache(
  async function getCrossBorderPicture(regionKey: string): Promise<CrossBorderPicture | null> {
    const region = PLACE_REGIONS[regionKey];
    if (!region?.crossBorder) return null;
    const crossBorder = region.crossBorder;
    const described = await describeOrgs(crossBorder.orgNames);
    if (!described) return null;
    return {
      ...crossBorder,
      orgs: described.orgs,
      misattributedValue: described.orgs.reduce((total, org) => total + org.grantValue + org.contractValue, 0),
      missing: described.missing,
    };
  },
);

export const getHubAdministrationPicture = cache(
  async function getHubAdministrationPicture(regionKey: string): Promise<HubAdministrationPicture | null> {
    const region = PLACE_REGIONS[regionKey];
    if (!region?.hubAdministration) return null;
    const hub = region.hubAdministration;
    const described = await describeOrgs(hub.creditedOrgs);
    if (!described) return null;

    // Only money sitting inside the hub's own figure counts as credited to it.
    // An organisation the register places elsewhere, or nowhere, is not
    // inflating the hub, and adding it here would overstate the problem.
    const creditedValue = described.orgs
      .filter(org => org.lgaName === hub.hubLga)
      .reduce((total, org) => total + org.grantValue + org.contractValue, 0);

    return { ...hub, orgs: described.orgs, creditedValue, missing: described.missing };
  },
);

/**
 * Federal grants held by organisations registered in a postcode.
 *
 * The place pages previously read funding from gs_relationships, which does not
 * carry GrantConnect. For Ceduna that showed $7.5M against $215.3M of federal
 * money currently committed to organisations based there, so the page reported
 * roughly three cents in the dollar and read as a place nobody funds.
 *
 * This is keyed on the recipient's registered address, not delivery location.
 * Only 41 of 346 awards in postcode 5690 publish a delivery postcode, so a
 * delivery-keyed figure omits seven awards in eight. Registered address has its
 * own bias in the other direction: an organisation registered here may deliver
 * elsewhere, and a service delivered here may be run from Adelaide. Both
 * caveats travel to the page rather than sitting in this comment.
 */
export interface FundingPicture {
  awards: number;
  recipients: number;
  lifetimeValue: number;
  activeAwards: number;
  activeValue: number;
  /** Committed money whose agreement ends inside two years. The renewal window. */
  endingWithin24mValue: number;
  /** Awards that publish a delivery location, out of the total. */
  withDeliveryPostcode: number;
  topPrograms: Array<{ agency: string; program: string; awards: number; value: number }>;
  endingSoon: Array<{ recipient: string; agency: string; program: string; value: number; endDate: string }>;
}

export interface PostcodeFundingPicture extends FundingPicture {
  postcode: string;
}

/** Quote a list for an IN clause. Values here are code-defined, never user input. */
function quoted(values: string[]): string {
  return values.map(value => `'${value.replace(/'/g, "''")}'`).join(',');
}

/**
 * The funding picture for any set of recipients.
 *
 * The three queries differ only in which organisations they count, so the scope
 * is a predicate on `e` and everything else is shared. A postcode and a region
 * are then the same question asked of a different set of people.
 */
async function fundingPictureForScope(scopeSql: string): Promise<FundingPicture | null> {
  const db = getServiceSupabase();

  const [totals, programs, ending] = await Promise.all([
    db.rpc('exec_sql', {
      query: `SELECT count(*) AS awards,
                     count(DISTINCT ga.recipient_abn) AS recipients,
                     coalesce(sum(ga.value_aud),0) AS lifetime_value,
                     count(*) FILTER (WHERE ga.end_date >= current_date) AS active_awards,
                     coalesce(sum(ga.value_aud) FILTER (WHERE ga.end_date >= current_date),0) AS active_value,
                     coalesce(sum(ga.value_aud) FILTER (WHERE ga.end_date >= current_date
                                                          AND ga.end_date < current_date + interval '24 months'),0) AS ending_24m_value,
                     count(*) FILTER (WHERE ga.delivery_postcode IS NOT NULL) AS with_delivery_pc
                FROM grantconnect_awards ga
                JOIN gs_entities e ON e.id = ga.gs_entity_id
               WHERE ${scopeSql}`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT ga.agency, ga.grant_program AS program, count(*) AS awards, coalesce(sum(ga.value_aud),0) AS value
                FROM grantconnect_awards ga
                JOIN gs_entities e ON e.id = ga.gs_entity_id
               WHERE ${scopeSql} AND ga.grant_program IS NOT NULL
               GROUP BY 1,2 ORDER BY value DESC LIMIT 8`,
    }),
    db.rpc('exec_sql', {
      query: `SELECT ga.recipient_name AS recipient, ga.agency, ga.grant_program AS program,
                     coalesce(ga.value_aud,0) AS value, ga.end_date::text AS end_date
                FROM grantconnect_awards ga
                JOIN gs_entities e ON e.id = ga.gs_entity_id
               WHERE ${scopeSql}
                 AND ga.end_date >= current_date
                 AND ga.end_date < current_date + interval '24 months'
               ORDER BY ga.value_aud DESC NULLS LAST LIMIT 10`,
    }),
  ]);

  const row = Array.isArray(totals.data) ? (totals.data[0] as Record<string, unknown>) : null;
  if (!row || num(row.awards as number | string | null) === 0) return null;

  return {
    awards: num(row.awards as number | string | null),
    recipients: num(row.recipients as number | string | null),
    lifetimeValue: num(row.lifetime_value as number | string | null),
    activeAwards: num(row.active_awards as number | string | null),
    activeValue: num(row.active_value as number | string | null),
    endingWithin24mValue: num(row.ending_24m_value as number | string | null),
    withDeliveryPostcode: num(row.with_delivery_pc as number | string | null),
    topPrograms: (Array.isArray(programs.data) ? programs.data : []).map(entry => {
      const record = entry as Record<string, unknown>;
      return {
        agency: String(record.agency ?? ''),
        program: String(record.program ?? ''),
        awards: num(record.awards as number | string | null),
        value: num(record.value as number | string | null),
      };
    }),
    endingSoon: (Array.isArray(ending.data) ? ending.data : []).map(entry => {
      const record = entry as Record<string, unknown>;
      return {
        recipient: String(record.recipient ?? ''),
        agency: String(record.agency ?? ''),
        program: String(record.program ?? ''),
        value: num(record.value as number | string | null),
        endDate: String(record.end_date ?? ''),
      };
    }),
  };
}

/**
 * The same picture for a whole region: every council it reads, plus the
 * postcodes whose organisations have no council at all.
 *
 * Scoped exactly like the delivery-coverage query, so the unplaced
 * organisations are counted here rather than falling between the two. They are
 * the ones most likely to be missed, and a renewal cliff they are standing on
 * is the last thing that should be invisible.
 */
export const getRegionFundingPicture = cache(
  async function getRegionFundingPicture(regionKey: string): Promise<FundingPicture | null> {
    const region = PLACE_REGIONS[regionKey];
    if (!region) return null;
    const unplacedClause = region.unplaced
      ? ` OR e.postcode IN (${quoted(region.unplaced.postcodes)})`
      : '';
    return fundingPictureForScope(
      `e.state IN (${quoted(region.states)}) AND (e.lga_name IN (${quoted(region.lgaNames)})${unplacedClause})`,
    );
  },
);

export const getPostcodeFundingPicture = cache(
  async function getPostcodeFundingPicture(postcode: string): Promise<PostcodeFundingPicture | null> {
    if (!/^\d{4}$/.test(postcode)) return null;
    const picture = await fundingPictureForScope(`e.postcode = '${postcode}'`);
    return picture ? { postcode, ...picture } : null;
  },
);
