# The 46 borderline ACT objects — a decision you can make in one pass

The extraction plan classified 162 objects as confirmed ACT and 29 as not-ACT. These 46 were
genuinely ambiguous and were left for you. This reframes them by the question that actually
decides it — **what breaks if this moves?** — rather than "is this ACT data", which is what made
them ambiguous in the first place.

Counts are exact rows; GS/JH are the number of source files in each repo that reference the table.

---

## Group A — move now, nothing reads them (24 objects, ~23,600 rows)

Zero references in either repo. These can go to the new Supabase with no application work at all.
This is the whole first tranche.

| object | rows | | object | rows |
|---|---|---|---|---|
| `opportunities_unified` | 17,790 | | `entity_merge_log` | 21 |
| `civicscope_act_entity_bridge` | 3,074 | | `editable_content` | 19 |
| `relationship_pipeline` | 1,000 | | `bgfit_suppliers` | 15 |
| `entity_potential_matches` | 620 | | `exa_company_intelligence` | 12 |
| `wiki_pages` | 413 | | `project_funding_allocations` | 12 |
| `goods_content_library` | 369 | | `witta_contributions` | 4 |
| `notion_organizations` | 74 | | `harvest_events` | 3 |
| `project_funding_drawdowns` | 48 | | `app_config` | 2 |
| `act_opportunity_observatory` | 47 | | `harvest_businesses` | 2 |
| `contact_intelligence_scores` | 47 | | `pulse_responses` | 2 |
| `image_overrides` | 43 | | `app_users` | 1 |
| `bgfit_transactions` | 22 | | `bgfit_financial_periods` | 0 |

**Recommendation: move all 24.** One caveat — `opportunities_unified` at 17,790 rows is
referenced nowhere, which is worth a glance before it leaves. Either it is dead, or something
outside these two repos reads it.

---

## Group B — GrantScope reads them; moving requires code work first (13 objects)

| object | rows | GS files | note |
|---|---|---|---|
| `ghl_contacts` | 5,169 | **18** | The most-wired ACT table in the app. |
| `act_grant_recommendation_decisions` | 89 | 12 | |
| `goods_relationships` | 306 | 10 | Backs the Goods command centre. |
| `person_identity_map` | 14,919 | 7 (+2 JH) | Also cross-app. |
| `act_grant_recommendation_projects` | 12 | 5 | |
| `goods_asset_lifecycle` | 404 | 4 | |
| `act_opportunity_benchmark_cases` | 275 | 4 | |
| `entity_identifiers` | 31,451 | 3 | Largest here. Zero ABNs — CRM store, not the graph crosswalk. |
| `act_obligations` | 0 | 3 | Empty but wired. **Write-first — do not treat as dead.** |
| `goods_deployment_batches` | 0 | 3 | Same. |
| `knowledge_chunks` | 19,413 | 1 | Personal iMessage content. Anon read already revoked. |
| `linkedin_contacts` | 13,810 | 1 | 13,810 PII records. |
| `goods_funding_matters` / `goods_capital_blocks` / `goods_products` | 9 / 5 / 4 | 1 each | |

**Recommendation: move, but sequence it.** Each needs its GrantScope reads repointed at the new
project (or removed) *before* the table leaves, not after. `ghl_contacts` at 18 files is the one
that will take actual effort; the rest are single-digit.

---

## Group C — cross-app, decide deliberately (5 objects)

These are read by **both** repos, so moving them breaks two apps and creates the dual-write hazard
the map already flagged.

| object | rows | GS | JH | the question |
|---|---|---|---|---|
| `projects` | 81 | 2 | **10** | Mostly JusticeHub's. Is this ACT's project registry or JusticeHub's? |
| `notion_opportunities` | 43 | 0 | 3 | JusticeHub writes it from a live request path. |
| `sessions` | 14 | 1 | 2 | Generic name — check whether these are auth sessions before moving anything. |
| `canonical_entities` | 15,324 | 0 | 1 | The CRM spine. One JH reference only. |
| `bgfit_grants` / `bgfit_budget_items` / `bgfit_deadlines` | 4 / 46 / 27 | 0 | 1–2 | Why does JusticeHub read a client's books at all? |

**Recommendation: hold all five** until the reads are explained. `bgfit_*` in particular — a client
engagement's financial records being read by JusticeHub is either a mistake or something you know
about, and it is worth knowing which before it moves.

---

## Suggested sequence

1. **Group A now** — 24 objects, no code changes, proves the migration path end to end on data
   nobody reads.
2. **Group B next** — repoint the reads first, table by table, largest reference count last.
3. **Group C last**, and only after each cross-app read is explained.

The whole extraction is 336 MB. Group A is most of the object count and almost none of the risk,
which makes it the right thing to do first regardless of how the other two land.
