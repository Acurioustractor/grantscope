// Goods impact film data. Every number is sourced. Refresh monthly.
//
// need / gap: goods_communities priority in (active, lead) (the curated slice),
//   summed by goods-pipeline-rollup.mjs (grantscope).
// delivered: Goods v2 assets sync (project cwsyhpiuepvdjtxaozwf), 2026-05-27.
// communities: goods_communities, priority in (active, lead), top by demand_beds.
//
// To refresh: re-run scripts/goods-pipeline-rollup.mjs and re-query goods_communities,
// then update the numbers below and bump generatedAt. No invented numbers.

export type GoodsImpactData = {
  generatedAt: string;
  need: { beds: number; washers: number; communities: number };
  delivered: { beds: number; washers: number };
  gap: { beds: number; washers: number };
  communities: { name: string; state: string; beds: number }[];
};

export const goodsImpactData: GoodsImpactData = {
  generatedAt: '2026-05-28',
  need: { beds: 12504, washers: 1563, communities: 64 },
  delivered: { beds: 520, washers: 41 },
  gap: { beds: 11984, washers: 1522 },
  communities: [
    { name: 'Maningrida', state: 'NT', beds: 930 },
    { name: 'Wadeye', state: 'NT', beds: 918 },
    { name: 'Galiwinku', state: 'NT', beds: 841 },
    { name: 'Wurrumiyanga', state: 'NT', beds: 630 },
    { name: 'Milingimbi', state: 'NT', beds: 493 },
    { name: 'Ngukurr', state: 'NT', beds: 463 },
    { name: 'Gunbalanya', state: 'NT', beds: 450 },
    { name: 'Gapuwiyak', state: 'NT', beds: 372 },
  ],
};
