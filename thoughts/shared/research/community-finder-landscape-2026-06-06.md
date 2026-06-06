# Community Finder Landscape Audit — CivicGraph

Date: 2026-06-06
Repo: /Users/benknight/Code/grantscope
Question: How good is our data vs what exists, how do incumbents source theirs, and what do we build to become the best "local community everything finder"?

Provenance note: claims tagged `[investigator]` come directly from the six investigator briefs (internal-search, internal-data, community-service finders, grant/philanthropy finders, legal-help finders, youth-justice finders). Claims tagged `[inferred]` are my synthesis. Claims tagged `[unverified]` were flagged unverified by the investigator (could not load a licence field, a 403, or no public figure).

---

## Executive summary

CivicGraph is built as a **funding-discovery** product, not a **service-discovery** one. `[investigator]` For a member of the public trying to find help, the only public anonymous surfaces are entity-name typeahead (`/api/global-search`, prefix-biased, grants/foundations hidden unless the query literally contains a funding keyword), `/api/data/entity/search` (name-contains + LGA filter, but it powers map panels, not a help-finder UI), and the `/grants` browse page (rich grant facets but ACT-org-skewed and grants-only). Every semantic or personalised surface sits behind `requireModule` auth. There is **no public surface that searches a directory of community orgs, legal-help providers, or youth-justice services by what-they-do plus where-you-are.** `[investigator]`

Our **data** is strong exactly where the incumbents are weak, and weak exactly where they are strong. We are best-in-class on the **graph** (159K+ org-type entities, funding/contract/donation relationships, 11K funder profiles, 2K evidence-rated ALMA interventions) and on **funder discovery** (foundations 92% with giving figures). `[investigator]` We are weak on the thing a help-seeker actually needs: **verified contact details and live service records by location and service type.** Our community directory is effectively SA-only (99.8% SA, 14.4K rows from SAcommunity), only 52% with ABN, only 25% linked to the graph. `[investigator]`

The incumbents cluster into three sourcing models `[investigator]`: (1) **paid human curation** (Infoxchange/Ask Izzy, ~450K listings, 25+ updaters who phone services — the national moat, now API/licence-only since their open platform retired); (2) **government funding-contract feeds** (My Aged Care, NHSD — "being listed = being funded", near-perfect accuracy, open snapshots on data.gov.au); (3) **publicly-funded or volunteer curation** (SAcommunity, CC-BY, the cleanest open ingest).

**The defensible niche is the join no incumbent does** `[inferred from investigator lessons]`: bind service presence to the funding/contract data CivicGraph already holds (the My Aged Care trick, but across all sectors), then layer independent evidence ratings (the NSW DCJ Evidence Portal model) onto programs. No generalist directory can derive a finder from funding; no funding tool has the evidence layer; no evidence portal has live service locations.

**Sequenced build:** (1) ungate and harden the public finder (HSDS schema, trigram fuzzy, postcode/LGA + service-type facets); (2) ingest the four clean open feeds (ACNC AIS grant-flows, GrantConnect awards, My Aged Care + NHSD service lists, SAcommunity); (3) derive presence from funding edges and surface authoritative referral tiers (Legal Aid, ATSILS, Justice Connect); (4) pursue Infoxchange/MyCommunityDirectory licence partnerships for verified contact freshness rather than scraping. Publish funding-desert demand/gap analytics as the differentiated open contribution.

---

## Per-domain scorecard (ours vs theirs)

Verdict scale: **Strong** / **Partial** / **Weak** describe CivicGraph's data and surface readiness for a public help-finder, not the domain's importance.

### Community orgs — Verdict: Partial (data), Weak (surface)

| | Ours | Theirs |
|---|---|---|
| Coverage | `[investigator]` acnc_charities 65,375 rows, 100% ABN, 90% postcode/state, 67% website — strong national backbone. gs_entities 159K org-type records (charity 54.9K, social_enterprise 5K, indigenous_corp 8.5K). community_directory_orgs 14,469 but **99.8% SA-only**, 52% ABN, 25% graph-linked. | `[investigator]` Ask Izzy/Infoxchange ~450K listings national, ~8M searches/yr, daily human-verified. MyCommunityDirectory tens of thousands, white-label to councils. SAcommunity 14K SA (we already ingest this). |
| Contact data | `[investigator]` gs_entities has website/postcode/state only, **no per-row phone/email**. community_directory_orgs has phone 74% / email 86% but only for SA. | `[investigator]` Verified phone/email at national scale (Infoxchange's moat is the paid team that phones services). |
| Surface | `[investigator]` Name-contains lookup only, no service-type or sector facet for the public, no fuzzy. | `[investigator]` Category + location + eligibility filters, embeddable widgets. |

Evidence verdict: We have the **registry backbone** (ACNC) and the **graph**, but not the **verified, national, contact-complete, service-typed** records a finder needs. Outside SA, contact handoff is the gap.

### Philanthropy / funders — Verdict: Strong

| | Ours | Theirs |
|---|---|---|
| Coverage | `[investigator]` foundations 11,025 rows, 99.8% ABN, 92% with total_giving_annual, 99% geographic_focus, 60% thematic_focus, 53% website. gs_entities foundation mirror 10,983. | `[investigator]` Philanthropy Australia Directory of Funders 200+ profiled (paid). Foundation Maps (Candid x PA) coded grant flows but **voluntary submission** = coverage gaps. |
| Edge | `[inferred]` We can derive funder→grantee flows from ACNC AIS + contracts + justice_funding without funder goodwill — beating Foundation Maps' voluntary-submission weakness. | `[investigator]` Their gap is precisely where they rely on funder goodwill. |
| Weak spot | `[investigator]` ~half of funders missing website/application URL. | — |

Evidence verdict: "Who funds what here" is well covered. This is our strongest domain. Biggest enrichment win: application/contact URLs.

### Grants — Verdict: Partial (data quality blocks "open now")

| | Ours | Theirs |
|---|---|---|
| Volume | `[investigator]` grant_opportunities 24,986 total; 97% have a URL; 1,994 created in last 30 days (active pipeline). | `[investigator]` Funding Centre ~4,500 live (daily). The Grants Hub 7,000+. GrantConnect = complete legally-mandated Commonwealth awards + forecasts, daily. |
| Live-status quality | `[investigator]` Only ~4,640 (18%) demonstrably open now; 3,287 expired; **17,114 (68%) carry NO deadline** — open-vs-closed unknown for two-thirds. | `[investigator]` Funding Centre's edge is "daily, live" freshness, not count. |
| Surface | `[investigator]` `/grants` page is the richest surface (geo, amount, closing window, program type, semantic fallback) but **ACT-org-skewed default list** and grants-only. | `[investigator]` Curated proprietary directories ($85–313/yr), no open API. |

Evidence verdict: Strong volume and active ingestion, but the 68% missing-deadline problem blocks reliable "open now near you." Incumbents curate on top of the same open government feeds we can reach directly. `[investigator]`

### Legal help — Verdict: Partial (assembled signal, no curated directory)

| | Ours | Theirs |
|---|---|---|
| Coverage | `[investigator]` No single curated legal directory. Assembled from: 647 law/policy-purpose charities (national, ABN-complete), 150 distinct legal-services funding recipients (current-FY-tagged), 27 explicitly legal-named directory orgs (SA-skewed). | `[investigator]` Ask Izzy has a "Legal" category. CLCs Australia 160+ centres (federated state member rolls). National Legal Aid = 8 statutory commissions. ATSILS/NATSILS = 8 community-controlled Indigenous services (NLAP ~$440M/5yr). Justice Connect runs an NLP problem-classifier. |
| Surface | `[investigator]` Exists only as topic tags inside grant/funding text — not a searchable provider directory. Effectively unserved as a discovery domain. | `[investigator]` Eligibility/jurisdiction/matter-type filters are first-class (legal services have hard scope limits). |

Evidence verdict: Enough to **seed** a CLC/Legal-Aid layer but requires assembly + dedup. The authoritative sources are small, stable, high-trust referral sets (8 Legal Aid commissions, 8 ATSILS) we can include without scraping. `[investigator]` The killer pattern to copy is Justice Connect's: classify the free-text problem into an area of law, then route. `[investigator]`

### Youth justice — Verdict: Strong (deepest domain)

| | Ours | Theirs |
|---|---|---|
| Coverage | `[investigator]` justice_funding youth-justice: 5,580 rows, 886 distinct recipient ABNs, all 8 states, current FY. alma_interventions 2,087 (752 serve youth justice), 87% with evidence_level, 99.8% with geography, 72% graph-linked. mv_org_justice_signals ~65K. | `[investigator]` AIHW NMDS (cohort denominator, restricted unit-record). AIHW Appendix D names programs but **self-reports "evidence-based" with no evaluations** (the cautionary case). NSW DCJ Evidence Portal = commissioned reviews, 7-point evidence ratings (the positive analogue). State funded-provider lists (QLD CKAN Services Map, NSW, NT). |
| The unique join | `[investigator]` alma joins program → alma_evidence (methodology, sample, effect size) → alma_outcomes — the join no one else does. | `[investigator]` Org finders never link to outcomes; evidence portals never link to live service locations. |
| Weak spot | `[investigator]` ALMA contact_email only 1% (21 rows) — "how to reach this service" needs enrichment. | — |

Evidence verdict: Deepest domain. Strong for mapping/funding-flow + evidence; partial only on direct-contact handoff. `[investigator]`

---

## The data-sourcing playbook (ranked by effort / legality / durability)

Ranked best-to-worst for a platform that wants durable, legal, fresh data.

### Tier 1 — Open data (lowest effort, cleanest legality, ingest first)

`[investigator]` These are CC-licensed or open on data.gov.au / data.sa.gov.au with documented APIs or bulk files. Legal to ingest with attribution; verify the exact per-resource licence before redistribution `[unverified — several CC fields could not be loaded by investigators]`.

- **ACNC Charity Register + AIS** — mandatory regulatory data, CSV/JSON/XML + API, regular cadence. The backbone for funder discovery via AIS "grants made" / "grants to other charities" fields. We already hold 66K rows; the next step is **mining the AIS grant-flow fields** to build funder→grantee edges. `[investigator]`
- **SAcommunity** — CC BY 3.0 AU, CSV/JSON/XLSX + CKAN API, 14K SA records. Already ingested. Caveat: annual snapshots, stale for live use. `[investigator]`
- **My Aged Care Aged Care Service List** + **NHSD Services Directory snapshot** — open annual snapshots on data.gov.au. These are funding/registration-bound = high accuracy. `[investigator]`
- **QLD open data** — CC BY 4.0 (Youth Justice Services Map CKAN; Grants Finder checklist dataset). Cleanest machine-readable state source. Caveat: the open QLD grants dataset is checklist/metadata, **not** the full live grants list. `[investigator]`

### Tier 2 — Government feeds (authoritative, mandatory, some open some negotiated)

`[investigator]` The highest-accuracy model: presence is bound to a funding/registration system.

- **GrantConnect (grants.gov.au)** — legally MANDATORY Commonwealth publication of forecasts, opportunities, and awards within 21 days, updated daily. Single highest-value grant feed. Build a registered-user automated puller; reconcile recipients to gs_entities by ABN. Verify export format + Terms-of-Use reuse rights first `[unverified — feed format and reuse licence]`.
- **State grants portals** — NSW (publishes both opportunities AND recipients centrally — recipient data is the graph-relevant part), QLD (CKAN, partial), VIC (most fragmented, lowest priority). `[investigator]`
- **State youth-justice funded-provider lists** — QLD / NSW Funded Services Framework / NT diversion programs. Provenance-grade funder→org edges for gs_relationships; carry no outcomes. Some bot-block scraping (QLD programs page returned 403). `[investigator]`
- **AIHW** — NMDS (restricted unit-record, partnership/citation only) + Appendix D program names (seed list, but do NOT trust the self-applied "evidence-based" tag). `[investigator]`

### Tier 3 — APIs / partnerships (paid or negotiated, buys verified freshness)

`[investigator]` Where the verified-contact moat lives. Licence, do not scrape.

- **Infoxchange Service Directory API / Service Seeker Widget** — ~450K national listings, daily human-verified, the de-facto national backbone (also powers Lifeline, Foodbank, NSW HSNet). Their Open Data Platform RETIRED; access now API/widget under negotiated commercial licence. **Partner, don't rebuild raw curation.** `[investigator]`
- **MyCommunityDirectory** — API to partnering orgs; "Community Information Exchange" shared-record model; council white-label business model (a viable revenue path for us). `[investigator]`
- **Philanthropy Australia / Candid / Our Community (SmartyGrants)** — partnership for the voluntary philanthropic layer; SmartyGrants (~570 grantmakers) is the richest live AU grant-flow pool but grantmaker-owned — pursue as cross-funder intelligence partnership, not competitor. `[investigator]`
- **Justice Connect / NATSILS / state CLC associations** — partner for the legal referral + problem-classifier layer; ingest member rolls via partnership, never scrape. `[investigator]`

### Tier 4 — Self-listing flywheel (breadth cheap, quality rots without moderation)

`[investigator]` Self-listings rot. The only self-listing model that doesn't degrade quality is **moderated** self-listing (org submits, human verifies before publish — Ask Izzy / Infoxchange model). MyCommunityDirectory and oneplace (QLD, 58K) are pure self-listing = breadth but low confidence. Treat self-listed entries as `confidence='self-listed'/'unverified'` unless corroborated by a funding contract or registry. `[investigator]`

### Tier 5 — Scraping (last resort, fragile, legally grey)

`[investigator]` Only for public-but-unstructured authoritative sources with no feed: FRRR recipient announcements (match by name+postcode since grassroots groups lack ABNs — fills funding-desert blind spots), state youth-justice program pages where not bot-blocked. `[inferred]` Never scrape the paid commercial directories (Funding Centre, Grants Hub, GrantGuru, Philanthropy Australia) — go to their underlying open government sources instead.

**Cross-cutting sourcing lessons** `[investigator]`: (a) the moat is active verification, not listing volume; (b) binding presence to funding/contract data gives near-perfect accuracy with near-zero maintenance — and we uniquely already hold that data; (c) standardise on **Open Referral HSDS** (org/location/service) for "update-once-syndicate-everywhere" interoperability; (d) never depend on a single govt department feed (oneplace's related QLD dataset went stale after a 2017 machinery-of-government change); (e) differentiate by publishing **demand/gap analytics** (NSW DCJ and Ask Izzy both release/monetise this — our funding-deserts work is a natural fit).

---

## Build plan (phased)

Each phase names the data source and the product surface. Sequenced to ship public value early, then deepen the moat.

### Phase 0 — Unlock and harden the public finder (surface work, no new data)

- **Source:** existing gs_entities, foundations, grant_opportunities, community_directory_orgs.
- **Surface:** a single public `/find` route (Server Component) that searches **orgs + services + grants + funders** in one response, no `requireModule` gate. `[inferred — directly addresses the internal-search investigator's headline gap]`
- Add a **trigram/fuzzy** index path so typos and mid-word queries on entity names stop missing. `[investigator: prefix-first matching means typo queries mostly miss]`
- Add **postcode/LGA "near me"** + **service-type** facets to the public flow (today only `/api/data/entity/search` has an LGA filter, and it powers map panels). `[investigator]`
- Remove the funding-keyword gate that hides grants/foundations from public searches, and the hardcoded ACT-pipeline default list on `/grants`. `[investigator]`
- Adopt **Open Referral HSDS** as the internal schema for any service listing now, before ingesting more. `[investigator]`

### Phase 1 — Ingest the clean open feeds (data work)

- **Source → surface:**
  - ACNC AIS grant-flow fields → funder→grantee edges in gs_relationships → "who funds whom here" on funder/place pages. `[investigator]`
  - GrantConnect daily awards + forecasts → reconcile to gs_entities by ABN → fixes the grants freshness + recipient graph. `[investigator]`
  - My Aged Care + NHSD open service lists → first **funding-bound service records** (presence = funded) → seeds the health/aged-care verticals of the finder. `[investigator]`
  - Normalise acnc_charities state casing (Qld/Vic/nsw dupes, ~6,349 blank states). `[investigator]`
- Fix the grant **deadline data-quality** problem (68% null) so "open now" is reliable — backfill closes_at where derivable, flag perpetual/placeholder dates. `[investigator]`

### Phase 2 — Derive presence from funding (the unique trick)

- **Source:** justice_funding, austender_contracts, grant_opportunities, ACNC AIS, state funded-provider lists.
- **Surface:** a multi-sector finder where **"this org appears because it is funded to do X here"** — the My Aged Care model generalised across all sectors, which no generalist directory does. `[investigator: this is CivicGraph's native advantage]`
- Tag every derived record with funding-contract provenance and a confidence level. `[investigator]`
- Surface authoritative **referral tiers** without scraping: 8 Legal Aid commissions, 8 ATSILS (surface FIRST for Indigenous users), Youth Law Australia (national 24/7 deep-link), headspace centres. Capture **eligibility/jurisdiction/matter-type** as first-class filters for legal. `[investigator]`

### Phase 3 — Evidence + classifier layer (deepen the moat)

- **Source:** alma_interventions/evidence/outcomes; cite NSW DCJ Evidence Portal 7-point ratings + Indigenous Justice Clearinghouse rather than re-rating. `[investigator]`
- **Surface:** programs shown with an evidence rating + "core components"; honour Indigenous Data Sovereignty for place-based outcomes (Maranguka) — cite published figures, never ingest raw community data. `[investigator]`
- Adopt Justice Connect's **problem-classifier** pattern (free-text → area of law/need → route), privacy-first (no PII until eligible options shown). Partnership opportunity for training data. `[investigator]`
- Enrich ALMA contact details (only 1% have email today). `[investigator]`

### Phase 4 — Partnerships + distribution (verified freshness + revenue)

- **Source:** Infoxchange API licence (verified national contact data), MyCommunityDirectory, Philanthropy Australia / SmartyGrants. `[investigator]`
- **Surface:** an **embeddable widget** (NHSD model) so CivicGraph becomes the backbone behind councils'/funders' sites; **white-label directories to LGAs/state govts** (MyCommunityDirectory revenue model); publish **funding-desert demand/gap analytics** as the differentiated open contribution. `[investigator]`

---

## Risks and unknowns

- **Licence verification gaps** `[unverified — investigators]`: exact CC licences on several data.gov.au datasets (My Aged Care, NHSD, NSW/VIC grants), GrantConnect's machine-readable export format and Terms-of-Use reuse rights, and whether Infoxchange conforms to HSDS — all flagged unverified (403s / unloadable licence fields). Confirm each before redistribution or automated ingest.
- **Freshness vs the paid moat** `[inferred]`: our open-data ingests (SAcommunity annual, data.gov.au annual snapshots) are stale relative to Infoxchange's daily human verification. Without a Tier-3 licence partnership, contact-detail freshness remains a structural weakness outside the funding-bound records.
- **Geographic lopsidedness** `[investigator]`: community_directory_orgs is 99.8% SA. The non-SA contact-data gap is real until we ingest national feeds or partner.
- **Grant live-status** `[investigator]`: 68% of grants have no deadline — "open now near you" is unreliable until backfilled, and over-promising it erodes trust.
- **Feed-continuity risk** `[investigator]`: govt feeds break on machinery-of-government changes (oneplace/QLD 2017 precedent). Own the canonical record; treat any single feed as one input.
- **Data sovereignty** `[investigator]`: place-based and Indigenous-led outcome data (Maranguka, ATSILS) is consent-governed, not open-scrapeable. Cite with provenance, partner rather than ingest.
- **Self-listing quality** `[investigator]`: any self-listing flywheel degrades without a moderation/verification step. Do not add unmoderated self-listing.
- **Scope creep / surface fragmentation** `[inferred]`: there are already 11 search routes, most auth-gated and overlapping. Phase 0 should consolidate, not add a 12th surface.
- **Unverified scale figures** `[unverified — investigators]`: exact counts on NSW Evidence Portal, NHSD total services, MyCommunityDirectory, and HSNet internal maintenance mechanics could not be confirmed (some pages 403'd).
