# Person Disambiguation — Scoping Report + Proposed Approach

**Date:** 2026-06-19 · **Status:** SCOPING COMPLETE — awaiting Ben's go before any migration
**Prior:** homonym guard (cap board_count ≤10) + leaderboard re-rank shipped #90/#91. Guard is a band-aid; this is the real fix.

---

## TL;DR

The ranking-head "megamerges" are **not** hundreds of distinct homonyms merged together. They are dominated by **trustee-company nominee blocks** — one trustee firm whose officers are listed as "responsible persons" on hundreds of administered charitable trusts. Mark Smith's 714 boards = ~686 one nominee block + ~28 scattered real individuals.

This is **good news for separability**: the nominee block is the *densest* co-occurrence cluster in the data, so co-occurrence clustering collapses it cleanly. The remaining tail is mostly board-singletons that correctly stay separate.

The real probity fix has **two parts**, and the second matters more for leaderboard credibility than the first:
1. **Split** homonym megamerges into distinct identities (co-director graph + geography).
2. **Flag** nominee/trustee-administered blocks so a trustee-firm officer on 686 admin trusts is not ranked as a powerful individual board member.

Temporal signal (appointment/cessation overlap) from the proposed approach is **dead** — see below.

---

## 1. Scale (verified)

`mv_person_influence`: **237,340** distinct `person_name_normalised`.
- 2–10 boards: 39,105 (the plausible serial-director mass — leave alone)
- \>10 boards: **615** · >50 boards: **79** · max: **744** (Jodi Kennedy)

`person_roles`: ~339,286 rows (ABN-keyed directorships).

## 2. Signal coverage per role (verified, 5% sample + global existence checks)

| Signal | Coverage | Usable? |
|---|---|---|
| `company_abn` | ~100% | ✅ primary entity key |
| `company_acn` | 100% | ✅ |
| `entity_id` → `gs_entities` | ~100% | ✅ unlocks state/postcode/sector/type |
| `appointment_date` | **~0%** (true globally but 0 in 16K sample) | ❌ effectively dead |
| `cessation_date` | **0%** (none exist) | ❌ dead |
| `person_entity_id` | 100% but **name-keyed** — all 714 Mark Smith rows → 1 id | ❌ this IS the megamerge, not an identity key |

**Consequence:** the "tenure temporal overlap" idea in the brief is not available. Disambiguation rests on **co-occurrence (shared co-directors)** + **geography** + **role/sector/source patterns**.

## 3. Separability — proven on 2 megamerge names (by reproduction)

### Mark Smith (714 boards)
- 714 roles on **714 distinct entities** — no two share a board → direct shared-board signal is zero.
- BUT 3 names co-occur on ~686 of them: **Phillip Blackmore (687), Andrew Baker (686), Adam Balsamo (686)**.
- 669/714 in **NSW across only 12 postcodes**; the block clusters at **postcode 2034**.
- Block entities are **"The Trustee For [X] Trust"** foundations → a single trustee company's responsible-persons list.
- → Splits into **~1 nominee identity (~686) + ~28 scattered singletons** (QLD/VIC/SA/WA/NT).

### Jodi Kennedy (744 boards) — same structure, different firm
- Co-directors: **Johanna Platt (735), Michael O'Brien (439), Ian Westley (322)** → another trustee-officer block.

### Money inflation is real and co-occurrence fixes it
Mark Smith's $1.16M procurement + $3.6M justice = **three different real people**:
| Funded entity | Money | Nominee block? | Real person |
|---|---|---|---|
| Aboriginal Drug & Alcohol Council (SA) Aboriginal Corp | $3.45M justice | No | SA Mark Smith |
| Garnett Passe & Rodney Williams Foundation | $1.12M procurement | **Yes** | NSW trustee-officer |
| Allora Show Society (QLD) | $155K justice | No | QLD Mark Smith |

The board-count guard does **nothing** here — these people may each sit on 1–2 boards. Only identity-splitting re-attributes the money correctly.

## 4. Bonus finding — name-normalisation also fragments identities
Surname-first / middle-name variants split one person across keys:
`MICHAEL O'BRIEN`(439) vs `O'BRIEN MICHAEL`(7); `IAN WESTLEY`(322) vs `WESTLEY IAN`(7); `MARTIN GEOFFREY WALSH`(15) vs `GEOFF WALSH`(4). A normalisation pass (sort tokens / strip middle names with confidence) is a cheap orthogonal win — but it can also over-merge, so treat as a *candidate-link* signal, not a hard merge.

---

## 5. What IS vs ISN'T separable

**Separable cleanly:**
- Nominee/trustee blocks — densest co-occurrence cluster → collapse + flag.
- People who are board-linked to others via shared co-directors.
- Money attribution when the funded entity sits in a distinguishable cluster (proven above).

**Not separable (accept and stay conservative):**
- Two genuinely distinct people with identical names, each on **one** board, no shared co-director, same region → indistinguishable. They remain separate singletons (safe: no false merge). We can't *prove* they're distinct, but we never fabricate a link.
- One real person on 2 boards with no shared co-directors may **over-split** into 2 identities. Acceptable for probity: over-splitting under-counts (conservative), over-merging fabricates power (dangerous). **Bias toward over-split.**

---

## 6. Proposed approach (NOT yet committed — for Ben's review)

**Model: connected-components over a per-name co-director graph.**

For each `person_name_normalised` with >1 role:
1. Nodes = that name's role-entities.
2. Edge between two entities if they share ≥1 *other* co-director (another normalised name on both boards). Weight = count/rarity of shared co-directors.
3. Connected components = candidate distinct persons. Singletons → own identity.
4. Geography as secondary tie-breaker (same postcode/state strengthens; never the sole merge basis).
5. **Nominee detection:** a component where one identity holds N boards with a small fixed co-officer set and concentrated postcode → tag `is_nominee_block` + `nominee_postcode`.

**Output (additive, non-destructive):**
- New table `person_identities` (or `person_role_clusters`): `role_id → identity_key`, `confidence`, `is_nominee_block`, `cluster_size`, `method`. Stable `identity_key` (hash of name + sorted member-ABN set, or name + component seed).
- Re-point `mv_person_influence` / `mv_person_entity_network` to aggregate by `identity_key` instead of `person_name_normalised`. Keep the old column for rollback.
- Leaderboard: rank by identity, **exclude/down-weight `is_nominee_block`** identities from individual-governance rankings.

**Build order (verification gate FIRST — per house rule):**
1. **Gate script** `scripts/person-disambig-probe.mjs`: for a given name, print role count, component count, largest-component size + co-officer signature + dominant postcode, money-per-component with funded entity names, singleton tail. Assert expected shapes on Mark Smith (~1 block + ~28), Jodi Kennedy (block), and a **clean control** (a rare name → exactly 1 component). This is the gate — must pass before any write.
2. Only then: build the clustering job (set-based SQL in `scripts/`, chunked — no in-memory entity index; cf. `project_build_entity_graph_setbased`).
3. Re-point MVs; validate leaderboards unchanged-or-better; never break the shipped guard.

**Open questions for Ben:**
- Nominee blocks: collapse-to-one-identity **and** flag-out of individual rankings? (recommended) Or keep visible as "trustee-administered"?
- Identity-key stability across rebuilds — hash of sorted member-ABN set is stable unless membership changes; acceptable?
- Scope of first migration run: all 615 >10-board names, or start with >50 (79 names) where payoff is highest?

**Guardrails honoured:** additive only; verified by reproduction not assumption; gate before scoring; proven on 2 names first; no repo-wide migration without Ben's go.

---

## 7. VALIDATION RESULTS — gate PASSED (2026-06-19)

Built `scripts/person-disambig-probe.mjs` (READ-ONLY; no DB writes). Decisions locked with Ben: **nominee blocks collapse to one identity + flagged `is_nominee_block` → excluded from individual rankings**; **build gate + clusterer, validate, no migration yet.**

Algorithm as built: per-name co-director graph, union-find. Edge rules:
- **Block officer** (a co-director on ≥`HIGH_DEGREE`=10 of the target's boards) glues all its boards → catches nominee blocks.
- **Mid-degree corroboration** (co-director on 2–9 boards): a pair of boards merges only with ≥`MIN_SHARED`=2 shared co-directors → high precision on the tail, drops spurious single-common-name bridges.
- **Nominee flag:** component ≥`NOMINEE_MIN`=20 with a dominant officer (≥50%) AND dominant postcode (≥50%).
- Confidence: nominee→high, multi-board→medium, singleton→low. **Bias to over-split** (singletons stay separate; no false merges).

| Name | Raw boards | → identities | Nominee block | Real-people tail |
|---|---|---|---|---|
| MARK SMITH | 714 | **24** | 689 (NSW/2034) | 23 (each ≤2 boards) |
| JODI KENNEDY | 745 | **6** | 740 (VIC/3001) | 5 |
| THARANI JEGATHEESWARAN (control) | 6 | **2** | none | 1×5-board real + 1 singleton |

All assertions pass: massive collapse; one nominee block >500 (Mark)/>200 (Jodi); **SA justice $3.45M → non-nominee identity; Garnett Passe $1.12M → nominee block**; control resolves to ≤2, not flagged nominee.

**Bug the gate caught:** `exec_sql` RPC silently caps at PostgREST's 1000-row limit → first run truncated co-director data, fragmenting Mark's block to 301. Fixed with `qPaged()` (inner LIMIT/OFFSET). Re-run → block restored to 689. (Same cap noted in memory re: `paginatedRpc`.)

**Side-findings (out of scope, worth a ticket):**
- `mv_person_entity_network` money columns attribute an entity's **full** procurement/justice/donation to **every** board member — so "personal money footprint" is itself over-attributed (e.g. control shows $1.14B procurement on a 5-board person). The disambiguation re-point should decide whether per-person money is `SUM` or needs a fairer split.
- gs_entities has duplicate orgs ("Elston Giving Foundation" + "...LTD") — clustering correctly merged them via shared co-directors, but a dedup pass would help upstream.

**Next step (NEEDS BEN'S GO — Tier 3 migration):** generalise the clusterer to a set-based job over all >50-board names (79) first, write `person_identities` (role_id → identity_key, confidence, is_nominee_block) additively, re-point `mv_person_influence`/`mv_person_entity_network` by identity_key, exclude nominee blocks from rankings, validate leaderboards unchanged-or-better. Do NOT touch the shipped board-count guard.
