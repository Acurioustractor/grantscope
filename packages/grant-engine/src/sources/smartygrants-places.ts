/**
 * Where each SmartyGrants tenant's rounds apply, keyed by tenant subdomain (not funder name: Campbelltown,
 * Central Coast, Central Highlands, Kingston and Latrobe are each more than one council).
 * `lga` uses postcode_geo.lga_name spelling. LGA codes are left out on purpose: postcode_geo carries
 * conflicting codes (Western Downs has two, one shared with South Burnett).
 * Tenants not listed yield no place rather than a guessed one.
 */

export type AuState = 'NSW' | 'VIC' | 'QLD' | 'WA' | 'SA' | 'TAS' | 'NT' | 'ACT';
export type SmartyGrantsPlace = { state: AuState; lga?: string } | { national: true };

const council = (state: AuState, lga: string): SmartyGrantsPlace => ({ state, lga });
const state = (s: AuState): SmartyGrantsPlace => ({ state: s });
const NATIONAL: SmartyGrantsPlace = { national: true };

export const SMARTYGRANTS_PLACES: Readonly<Record<string, SmartyGrantsPlace>> = {
  // Councils
  alexandrina: council('SA', 'Alexandrina'), banyule: council('VIC', 'Banyule'),
  'bass-coast': council('VIC', 'Bass Coast'), bayswater: council('WA', 'Bayswater'),
  bendigo: council('VIC', 'Greater Bendigo'), brisbane: council('QLD', 'Brisbane'),
  burnie: council('TAS', 'Burnie'), cairns: council('QLD', 'Cairns'), campaspe: council('VIC', 'Campaspe'),
  campbelltownnsw: council('NSW', 'Campbelltown (NSW)'), canning: council('WA', 'Canning'),
  cardinia: council('VIC', 'Cardinia'), casey: council('VIC', 'Casey'),
  cassowarycoast: council('QLD', 'Cassowary Coast'), centralcoast: council('NSW', 'Central Coast (NSW)'),
  centralcoasttas: council('TAS', 'Central Coast (Tas.)'), chrc: council('QLD', 'Central Highlands (Qld)'),
  cityofadelaide: council('SA', 'Adelaide'), cityofsydney: council('NSW', 'Sydney'),
  cityofyarra: council('VIC', 'Yarra'), cloncurry: council('QLD', 'Cloncurry'),
  cockburn: council('WA', 'Cockburn'), dubboregion: council('NSW', 'Dubbo'),
  eastgippsland: council('VIC', 'East Gippsland'), frankston: council('VIC', 'Frankston'),
  frasercoast: council('QLD', 'Fraser Coast'), fremantle: council('WA', 'Fremantle'),
  geelong: council('VIC', 'Greater Geelong'), georgesriver: council('NSW', 'Georges River'),
  georgetown: council('TAS', 'George Town'), gladstone: council('QLD', 'Gladstone'),
  gleneira: council('VIC', 'Glen Eira'), glenelg: council('VIC', 'Glenelg'),
  goldcoast: council('QLD', 'Gold Coast'), greatershepparton: council('VIC', 'Greater Shepparton'),
  gympie: council('QLD', 'Gympie'), harvey: council('WA', 'Harvey'), hobartcity: council('TAS', 'Hobart'),
  holdfast: council('SA', 'Holdfast Bay'), horshamrcc: council('VIC', 'Horsham'), hume: council('VIC', 'Hume'),
  innerwest: council('NSW', 'Inner West'), ipswich: council('QLD', 'Ipswich'), kiama: council('NSW', 'Kiama'),
  kingston: council('VIC', 'Kingston (Vic.)'), kwinana: council('WA', 'Kwinana'),
  latrobe: council('VIC', 'Latrobe (Vic.)'), lockyervalley: council('QLD', 'Lockyer Valley'),
  loddon: council('VIC', 'Loddon'), logan: council('QLD', 'Logan'), mackay: council('QLD', 'Mackay'),
  mandurah: council('WA', 'Mandurah'), melbourne: council('VIC', 'Melbourne'), melton: council('VIC', 'Melton'),
  melville: council('WA', 'Melville'), 'merri-bek': council('VIC', 'Merri-bek'), moira: council('VIC', 'Moira'),
  monash: council('VIC', 'Monash'), moretonbay: council('QLD', 'Moreton Bay'),
  morpen: council('VIC', 'Mornington Peninsula'), mrsc: council('VIC', 'Macedon Ranges'),
  murrayriver: council('NSW', 'Murray River'), mvcc: council('VIC', 'Moonee Valley'),
  nillumbik: council('VIC', 'Nillumbik'), noosa: council('QLD', 'Noosa'),
  northburnett: council('QLD', 'North Burnett'), northernbeaches: council('NSW', 'Northern Beaches'),
  onkaparinga: council('SA', 'Onkaparinga'), parracity: council('NSW', 'Parramatta'),
  perth: council('WA', 'Perth'), porthedland: council('WA', 'Port Hedland'),
  portphillip: council('VIC', 'Port Phillip'), portstephens: council('NSW', 'Port Stephens'),
  prospect: council('SA', 'Prospect'), qprc: council('NSW', 'Queanbeyan-Palerang'),
  rockingham: council('WA', 'Rockingham'), sbrc: council('QLD', 'South Burnett'),
  scenicrim: council('QLD', 'Scenic Rim'), southerndowns: council('QLD', 'Southern Downs'),
  southgippsland: council('VIC', 'South Gippsland'), stirling: council('WA', 'Stirling'),
  swan: council('WA', 'Swan'), townsville: council('QLD', 'Townsville'), vincent: council('WA', 'Vincent'),
  wdrc: council('QLD', 'Western Downs'), wellington: council('VIC', 'Wellington'),
  westtorrens: council('SA', 'West Torrens'), westwimmera: council('VIC', 'West Wimmera'),
  whittlesea: council('VIC', 'Whittlesea'), wodonga: council('VIC', 'Wodonga'), wyndham: council('VIC', 'Wyndham'),

  // State agencies and state-scoped funders
  actgovt: state('ACT'), acthealth: state('ACT'), dhcs: state('ACT'),
  artsqueensland: state('QLD'), childrens: state('QLD'), des: state('QLD'), desbt: state('QLD'),
  ditidtourism: state('QLD'), dsiti: state('QLD'), healthqld: state('QLD'), screenqueensland: state('QLD'),
  artstasmania: state('TAS'), communitiestas: state('TAS'), nre: state('TAS'),
  artsunimelb: state('VIC'), communitybankavocamaryborough: state('VIC'), fisheriesvictoria: state('VIC'),
  norcenfs: state('VIC'), ravgrants: state('VIC'), worksafevic: state('VIC'),
  carclew: state('SA'), createsa: state('SA'), dhs: state('SA'), dsa: state('SA'), mdo: state('SA'),
  orsr: state('SA'), safilm: state('SA'), saoecd: state('SA'), wchfoundation: state('SA'),
  departmentofcommunitiesapply: state('WA'), dpird: state('WA'), dplh: state('WA'), 'dwer-env': state('WA'),
  screenwest: state('WA'), wadbca: state('WA'),
  hneccphn: state('NSW'), screennsw: state('NSW'),

  // National funders
  asf: NATIONAL, avant: NATIONAL, cbf: NATIONAL, fnpw: NATIONAL, hermonslade: NATIONAL, lowitja: NATIONAL,
  scanlonfoundation: NATIONAL, screenaustraliafunding: NATIONAL, tourismaustralia: NATIONAL,
};

/** Geography tags in the engine's convention: ['AU-WA', 'LGA:Melville'], ['AU-National'], or ['AU'] if unknown. */
export function smartyGrantsGeography(tenant: string): string[] {
  const place = SMARTYGRANTS_PLACES[tenant];
  if (!place) return ['AU'];
  if ('national' in place) return ['AU-National'];
  return place.lga ? [`AU-${place.state}`, `LGA:${place.lga}`] : [`AU-${place.state}`];
}
