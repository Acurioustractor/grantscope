# CivicGraph Data Asset Inventory and Alignment Map

**Date:** 2026-06-06 · **Method:** direct catalog + aggregate queries against the live Supabase (`tednluwflfhxyucgwigh`). All counts Verified (queried directly) unless marked Inferred.
**Companion:** `community-finder-landscape-2026-06-06.md` (external landscape + build plan). This doc corrects and grounds that plan against what the DB actually holds.

## Headline

605 tables (277 with >500 rows). The system is dramatically richer than the in-repo docs suggest — and **several of the "Phase 1 ingest" targets in the landscape plan are already ingested and 100% graph-linked.** The binding constraint is not data acquisition; it is (a) the public surface, and (b) contact-detail completeness on the canonical graph.

## Tier 1 — The canonical graph (the spine)

| Asset | Rows | Completeness |
|---|---|---|
| `gs_entities` | 597K | ABN 58% · state/postcode 55% · LGA 48% · **website 9.8% · email 1.2% · phone 0.9%** |
| `gs_relationships` | 1.62M | top datasets: austender 904K, acnc_register 322K, aec_donations 172K, person_roles_crossmatch 95K, justice_funding 57K |
| `entity_xref` | 1.19M | GS_ID 560K, ABN 318K, ABR trading names 223K, ACN 100K |
| `gs_entity_aliases` | 16.6K | name variants |

Entity types: company 270K · person 239K · charity 55K · foundation 11K · indigenous_corp 8.5K · program 6.6K · social_enterprise 5K · government_body 2.9K.

**The contact-detail hole is the single biggest enrichment gap.** Today's SA bridge run created most of the email layer (7,117 enriched of ~7,130 total emails).

## Tier 2 — Service-finder assets, already linked, ready to surface

| Asset | Rows | Linked to graph | Finder value |
|---|---|---|---|
| `acnc_programs` | 98K | **100%** | program_name, classification, ~25 `targets_*` facets (youth 40K, homeless 14K, offenders 5.1K…), operating_locations 94%, weblink. **2023 snapshot only.** |
| `ndis_registered_providers` | 48.5K | **100%** | ABN 100%, address/suburb/state/postcode, **website 51% (24.7K)** |
| `organizations` | 104K | 97% | user-facing profiles (Empathy Ledger sync), full address fields, but email only 172 |
| `state_tenders` | 200K | 82% | justice-flagged, supplier ABN 98% |
| `justice_funding` | 157K | 80% | topics[] tagged, program-level |
| `community_directory_orgs` | 14.5K | 52% | SA open data (today) + MCD API pipeline |
| `alma_interventions` (+evidence/outcomes) | 1.2K | high | the evidence layer nobody else has |
| `social_enterprises` | 10.7K | unverified | has ABN/state/postcode/target_beneficiaries columns |

**Correction to the landscape plan:** Phase 1 said "ingest ACNC AIS grant-flows" — `acnc_ais` (360K rows) already holds full per-charity financials including `revenue_from_government` and `grants_donations_au`, FY-bounded. The programs dataset is also already here. Phase 1 should be *refresh + surface*, not ingest.

## Tier 3 — Reference registries (resolution backbone)

| Asset | Rows | Use |
|---|---|---|
| `abr_registry` | **20.0M** | name→ABN resolution for anything (plus `mv_abr_name_lookup` 9M) |
| `asic_companies` / `asic_name_lookup` | 2.17M / 2.15M | company register |
| `acnc_ais` | 360K | charity financials by year (govt revenue, grants in/out, staff, volunteers) |
| `acnc_charities` | 65K | register snapshot (`mv_acnc_latest` 63.5K) |
| `nz_charities` | 45K | trans-Tasman |
| `oric_corporations` | 7.4K | Indigenous corporations (ABN 45%) |
| `acara_schools` | 9.8K | schools register |

## Tier 4 — Place and need context (the demand side)

`crime_stats_lga` 57K · `rogs_justice_spending` 12.6K · `dss_payment_demographics` 105K · `ndis_utilisation` 144K · `ndis_active_providers` 135K (aggregates by district × disability group — thin-market detection) · `ndis_participants_lga` 8.3K · `seifa_2021` · `postcode_geo` · `mv_funding_deserts`.

This is the "demand analytics" differentiator from the landscape report — already in place.

## Grants freshness (Verified)

`grant_opportunities`: 24,986 rows · **4,585 live** (deadline ≥ today) · 17,114 (68%) no deadline at all. The no-deadline mass blocks an honest "open now" filter.

## Enrichment opportunities, ranked by effort:impact

1. **Contact backfill from assets we already hold** (zero new ingestion): push `ndis_registered_providers.website` (24.7K), `acnc_ais.charity_website`, `acnc_programs.charity_weblink`, `organizations` contact fields into `gs_entities` where NULL — same fill-only pattern as the community bridge. Could lift website coverage ~5x in one script.
2. **Refresh `acnc_programs` to 2024/2025** — it's an annual regulator feed (ACNC data.gov.au), currently 2023-only. This *is* the national service directory, self-reported to a regulator.
3. **Run the MCD national crawl** — scraper is now API-based and scheduled; Brisbane alone reports 5K listings. Fills the non-SA community-org hole.
4. **Grant deadline repair** — parse/rescrape the 17K no-deadline rows, or re-key on GrantConnect's API where deadlines are mandatory.
5. **ABR-powered promotion of the 6,999 unmatched SA orgs** — resolve name+postcode against `abr_registry` (20M) to mint verified ABN-keyed entities instead of name-only ones.
6. **Reconcile the unlinked tails**: justice_funding 31.5K (20%), state_tenders 36.5K (18%), community orgs 48%.

## Build alignment (revised Phase 0/1)

Phase 0 stands: one public `/find` surface. But it should be fed by what is already linked: `acnc_programs` (target facets ≈ service taxonomy, operating_locations ≈ geography) ∪ `ndis_registered_providers` ∪ `community_directory_orgs` ∪ justice-funded services (`mv_org_justice_signals` 65K, `mv_youth_justice_entities` 5.5K), all joined through `gs_entity_id` to funding context (`mv_entity_total_funding` 94K). The "funding edge → service presence" join the landscape report called the defensible niche is **already materialized** — it needs a surface, not a pipeline.
