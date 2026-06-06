# Social Enterprise Discovery in Australia — Deep Review & CivicGraph Strategy

**Date:** 2026-06-07
**Status:** Review complete, strategy proposed
**Provenance:** Directory landscape researched via web (Social Traders, SASEC, SEA, BuyAbility, QSEC fetched directly; state networks/open-data findings inferred from search). All CivicGraph numbers queried live from project DB `tednluwflfhxyucgwigh` on 2026-06-07 — queries listed in Appendix A.

---

## 1. The landscape: why it feels disconnected and clunky

### The five directories reviewed

| Directory | Operator | Scale | Access | Core gap |
|---|---|---|---|---|
| Social Traders Finder | Social Traders Ltd (certifier) | ~700 certified SEs, national | Public list; rich data (200+ verified points) behind paid member portal; IP-locked, no API | Covers ~6% of est. 12,000 SEs; data deliberately walled |
| SASEC directory | SA Social Enterprise Council | 82 members, SA only | **Login required to even search** | Members-only kills public discovery |
| Social Enterprise Australia | National peak body | No directory at all | n/a | The national peak runs no national registry — the central vacuum |
| BuyAbility | National Disability Services | 600+ disability enterprises | Free browse, no export/API | Siloed to ADEs; invisible to mainstream SE search |
| QSEC directory | Qld SE Council | ~66 members | Free browse, thin fields | Tiny; verification exists but isn't shown per listing |

Plus the state patchwork: Map for Impact (~3,500 Vic SEs, map-only), SENVIC, WASEC, SECNA (NSW/ACT), SECTAS (Tas), Impact North (NT) — no shared schema, no shared IDs, no cross-state dedup, ABNs rarely exposed. ASENA (the new alliance of state networks) is a coalition, not a data platform.

### The eight structural problems

1. **No national entity registry.** The most complete dataset (Social Traders' Identifier dashboard, blending 5 sources) is proprietary, aggregate-only, view-only.
2. **State-siloed, incompatible directories** with overlapping listings and no join keys.
3. **Competing "verified" definitions** — Social Traders certification, People & Planet First (SEWF), WASEC and SECNA state verifications. A buyer can't trust one badge nationally.
4. **Gated access defeats discovery** — login walls, member paywalls, thin public fields.
5. **Thin public data** — name + tagline + region, while the procurement-relevant attributes (capability, beneficiaries, capacity) are walled off.
6. **No open data, no API, anywhere.** RISE 2024 identified 5,795 SEs — published as a PDF.
7. **Disconnected from demand.** Vic SPF (mandatory >$20M, 5–15% tender weighting), Buy Queensland, NSW SE Policy (<$150K direct engagement) create real buying demand with no supply-side rail.
8. **Scope fragmentation** — disability enterprises, Indigenous business, and general SEs live in separate registries with no unified supply-base view.

### The model that works: Supply Nation

One national registry, audited 5-step verification, **mandated as first port of call** in the federal Indigenous Procurement Policy (3% targets). Verified directory + policy mandate + buyer workflow integration = the proven pattern. **Nothing equivalent exists for the broader social enterprise sector.** That's the gap.

---

## 2. What CivicGraph already holds (verified 2026-06-07)

### The dataset nobody else has assembled

`social_enterprises`: **10,339 records** across 10 sources:

| Source | Records | With ABN |
|---|---|---|
| Supply Nation | 6,135 | 5,103 |
| ORIC | 3,364 | 2,687 |
| Social Traders | 699 | 340 |
| ACNC-classified | 271 | 271 |
| BuyAbility | 146 | 3 |
| SASEC | 82 | 0 |
| WASEC | 42 | 0 |
| B Corp | 30 | 6 |
| QSEC | 20 | 0 |
| Kinaway | 1 | 0 |

### The evidence layer nobody else CAN assemble

- **8,410 (81%)** match into `gs_entities` → place, remoteness, SEIFA disadvantage decile, community-control flag
- **1,135 SEs hold 13,398 AusTender contracts worth $15.6B** — government delivery history
- **636 SEs received $2.0B** in tracked grant funding (justice_funding)

This is the inversion: every directory shows *claims* (member badge, certification). CivicGraph can show *track record* — contracts won, grants delivered, where, for whom. Proof of delivery beats proof of membership.

### Existing app surface (mapped)

- `/social-enterprises` + `/api/social-enterprises` — directory with state/sector/source/certification filters, map view, CSV export, gs_entities enrichment by ABN
- `/procurement/*` — Procurement Intelligence: supplier-list analysis already flags `is_social_enterprise`, IPP/SME gap analysis, gap-map, tender-pack builder
- `/grants` + `/api/grants/match` — embedding-based grant matching (org_profiles ↔ grant_opportunities)
- `/giving/*` — the just-shipped Giving Data Commons: open API envelope, bulk exports, source provenance, quality dashboard, **corrections/right-of-reply flow**, data standard
- `social-enterprises` is already in the export API's ALLOWED_TYPES

**The federation gap:** these share `gs_entities` via ABN but have independent discovery flows. SE directory, grants matching, and procurement never cross-reference. No unified profile unites supply-side evidence (grants received, contracts delivered) with demand-side discovery (buyers searching).

---

## 3. The reframe: stop building a directory, build the supply base

Three shifts in how to talk about this:

1. **From membership lists → national open registry.** ABN-keyed, deduped, federated across all 10+ sources, per-claim provenance, open CSV/JSON/API under the Giving Commons. The open dataset that does not exist anywhere in Australia today.
2. **From badges → track record.** Show all verification marks side by side (Social Traders, PPF, Supply Nation, state verifications) rather than picking a winner — then add the layer none of them have: delivery evidence from AusTender and grant data.
3. **From browsing → buying.** The buyer's question is never "show me social enterprises". It's "who can supply catering in Logan with government delivery history, and does using them count toward my social procurement target?" That's a procurement workflow, not a directory page.

Positioning sentence: **"The open national registry and evidence layer for Australia's social enterprise supply base — federated from every certifier and network, keyed to ABN, backed by $15.6B of verified delivery history, wired into procurement."**

Critically: this is *infrastructure under* the certifiers and networks, not a rival directory. Social Traders verifies; QSEC organises; CivicGraph is the rails. Offer state networks free enriched feeds/widgets of their own members; ASENA is the natural federation partner.

---

## 4. Product moves (sequenced)

### Phase 1 — SE dataset into the Giving Commons (days)
- Add `social_enterprises` to `PUBLIC_DATASETS` in `giving-commons.ts` + `data_catalog` row (licence, source_url, caveats per source)
- Surface on `/giving` search, downloads, sources pages — export is already allowed, it's just not registered as a first-class commons dataset
- **ABN backfill** via ABR/ABN Lookup for the 2,140 records missing ABNs (SASEC 82, WASEC 42, QSEC 20, BuyAbility 143, Social Traders 359...). ABN is the join key to all evidence; this is the highest-leverage data task in the whole strategy.

### Phase 2 — Evidence-enriched SE profiles (week)
- `/social-enterprises/[id]`: add contract history (austender by ABN), grant history (justice_funding + gs_relationships), place context, all verification marks held
- The "proof of delivery" page no other directory can render

### Phase 3 — Buyer integration (weeks)
- Procurement gap recommendations name **specific SEs** by category + region + delivery history (the analyse endpoint already flags is_social_enterprise; close the loop)
- Tender-pack: "social procurement insert" citing Vic SPF / Buy Qld / NSW SE Policy compliance with candidate SE suppliers
- Public lightweight version: "find a social enterprise supplier" search by need + place, free, on /giving

### Phase 4 — Supply-side flywheel (weeks)
- Grants-for-SEs view: filter `grant_opportunities` by SE-eligible target_recipients; show matched funding on SE profiles
- **Claim-your-profile via the corrections flow** — the data_corrections table just shipped doubles as the mechanism for SEs to correct and extend their own record, free. Solves the freshness rot every member directory suffers.
- The flywheel: grants build SEs → SEs win contracts → contract history strengthens profiles → buyers find and use them → spend data flows back in.

---

## 5. Risks and honesty constraints

1. **Taxonomy honesty.** 9,499 of 10,339 records are Supply Nation + ORIC — Indigenous businesses are not automatically social enterprises. Labelling everything "social enterprise" would be contested by the sector. Frame as **"social and Indigenous enterprise supply base"** with explicit per-source classification flags (`is_indigenous` already exists; add `se_classification` with source-based confidence).
2. **Licensing.** Social Traders profile descriptions are explicitly IP-locked. We can publish facts from public sources (name, ABN, category, certification *status*) but not their authored content. Per-field provenance, which the Giving Commons standard already models.
3. **We aggregate verification, we don't perform it.** Be explicit everywhere: certifiers verify, CivicGraph registers and evidences. Never imply a CivicGraph "verified" mark.
4. **Data freshness.** Member directories rot; ours will too without the corrections flow + re-crawl cadence being real. The quality dashboard must show SE dataset freshness honestly.
5. **Relationship risk with networks.** If this looks like a land-grab, state networks won't federate. Lead with free feeds, attribution, and the corrections/claim flow before any commercial layer.

---

## Appendix A — Provenance queries (run 2026-06-07)

```sql
SELECT source_primary, COUNT(*), COUNT(abn) FROM social_enterprises GROUP BY source_primary;
-- 10,339 total

SELECT COUNT(DISTINCT se.id), COUNT(DISTINCT ac.id), ROUND(SUM(ac.contract_value)/1e6)
FROM social_enterprises se JOIN austender_contracts ac ON ac.supplier_abn = se.abn
WHERE se.abn IS NOT NULL;
-- 1,135 SEs · 13,398 contracts · $15,591M

SELECT COUNT(DISTINCT se.id), ROUND(SUM(jf.amount_dollars)/1e6)
FROM social_enterprises se JOIN justice_funding jf ON jf.recipient_abn = se.abn
WHERE se.abn IS NOT NULL;
-- 636 SEs · $2,025M

SELECT COUNT(DISTINCT se.id) FROM social_enterprises se
JOIN gs_entities e ON e.abn = se.abn WHERE se.abn IS NOT NULL;
-- 8,410 matched to entity graph
```

External landscape: Social Traders, SASEC, SEA, BuyAbility, QSEC sites fetched 2026-06-07; state networks, RISE report, Social Traders Identifier dashboard, and procurement policies inferred from web search results (flagged where not directly fetched).
