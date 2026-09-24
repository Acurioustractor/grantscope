// The communities Goods on Country has delivered to, keyed by the Goods app's communities.id slug
// (Goods Asset Register v2/src/lib/data/community-canonical.ts, COMMUNITY_BED_CANON), linked to the
// goods_communities row here. Bed counts are NOT held here: they are canon in the Goods app and
// CivicGraph never recomputes them.
//
// Exact ids only (GRANTSCOPE.md, and GOODS_PLACE_CROSSWALK's rule): no caller may fall back to name,
// postcode or LGA matching. `status` says how each link was made:
//   confirmed  already in GOODS_PLACE_CROSSWALK, backed by GHL pathway and Xero invoices
//   proposed   one goods_communities row with the same name and state (2026-09-24); needs Ben's yes
//   unlinked   no honest single row; null until Ben decides

export type ServedPlaceStatus = 'confirmed' | 'proposed' | 'unlinked';

export interface GoodsServedPlace {
  slug: string;
  name: string;
  state: 'NT' | 'QLD' | 'WA' | 'ACT';
  communityId: string | null;
  status: ServedPlaceStatus;
  note?: string;
}

export const GOODS_SERVED_PLACES: readonly GoodsServedPlace[] = [
  { slug: 'utopia', name: 'Utopia', state: 'NT', communityId: null, status: 'unlinked',
    note: 'Utopia Homelands is many outstations; Arlparra (96255fb4-6ba1-4b54-ae6f-0b5c2bc0e583) is the hub row. GOODS_PLACE_CROSSWALK leaves it null on purpose.' },
  { slug: 'tennant-creek', name: 'Tennant Creek', state: 'NT', communityId: '61184d6b-bfc7-4e30-8567-77809f8d0361', status: 'confirmed' },
  { slug: 'palm-island', name: 'Palm Island', state: 'QLD', communityId: '61475b5b-3617-47c4-9fb7-3e8f8b4171df', status: 'confirmed' },
  { slug: 'maningrida', name: 'Maningrida', state: 'NT', communityId: '13e45858-d3a8-4c70-b95a-3cfbe1dd8764', status: 'proposed' },
  { slug: 'kalgoorlie', name: 'Kalgoorlie', state: 'WA', communityId: '44bb2787-c5a7-4947-9aa6-1b1ff594ce96', status: 'proposed' },
  { slug: 'alice-springs', name: 'Alice Springs', state: 'NT', communityId: '6cec2c4f-d390-4bff-95e1-5ad9db9b08da', status: 'proposed' },
  { slug: 'canberra', name: 'Canberra', state: 'ACT', communityId: null, status: 'unlinked',
    note: 'Not a community Goods serves; the two beds are a demonstration placement.' },
  { slug: 'mount-isa', name: 'Mount Isa', state: 'QLD', communityId: '6d4152a5-bde0-4b3a-969a-7c5f1aef18df', status: 'proposed' },
  { slug: 'darwin', name: 'Darwin', state: 'NT', communityId: 'd236cb79-58a7-4b90-873e-cc170d5d9387', status: 'proposed' },
  { slug: 'kununurra', name: 'Kununurra', state: 'WA', communityId: 'b27e8c1d-4055-4187-a0f9-2dfd8a6d2eca', status: 'proposed' },
  { slug: 'katherine', name: 'Katherine', state: 'NT', communityId: null, status: 'unlinked',
    note: 'No goods_communities row for Katherine; Lake Katherine is a different place.' },
];

export function servedPlaceBySlug(slug: string): GoodsServedPlace | undefined {
  return GOODS_SERVED_PLACES.find((p) => p.slug === slug);
}
