# Goods funder relationship history — alignment substrate

> Compiled 2026-06-19 from Goods Notion (QBE operating plan, populated Investor Alignment Tool, Tier-1 funder letters, Area 10 Investors) + live CivicGraph CRM tables. This is the alignment layer for `goods-qbe-power-capital-strategy.md`: every funder move must reconcile to the real stage/contact/history here, and obey the claim guardrails. Background workflow agents could not authenticate to Notion, so this file carries the Notion-only facts; the live state is in the DB tables named below.

## The keystone (unchanged)
- Goods is 1 of 10 enterprises in **Catalysing Impact** (Social Impact Hub × QBE Foundation), sharing a $1M pool.
- **Stage 2 prize:** up to AU$400K ($150K floor), discretionary, **must be at least 1:1 matched by external commitments**, **prefers repayable finance over grants**, verified at the **Sept 2026** application, decided **Nov 2026**.
- **Goal:** close the first **~AU$400K of SIGNED, match-eligible commitments by 31 Aug 2026**. **0 signed today** — "a conversation problem, not a discovery problem."
- **SIH pipeline model:** Prospect → EOI → LOI → Term Sheet → Funding Agreement. Signed LOI+ counts as match.
- SIH contact for funder verification: **Jay Boolkin** (jay@socialimpacthub.org). Attach SIH "Letter to Funders" (Adam Long, 1 Apr 2026). Cost model advisory: **Matt** (lead) + **Mal** (QA).

## The capital stack (reconciled 2026-06-13) — AU$900K–1M blended, non-equity
| Layer | Target | Source | Notes |
|---|---|---|---|
| Junior — grants | ~$500K | Snow R4/R5, Centrecorp next round, VFFF (+ Butterfly/DGR upside FY2026-27) | de-risks the debt |
| Catalytic — QBE match | up to $400K | QBE (contingent, 1:1) | output of match raised, NOT an input |
| Senior — concessional debt | ~$300K | SEFA | gated on financial model + independent-majority board + revenue covenant |
| **First use of funds** | **$60–80K** | (from the above) | **50-bed in-source production run** — turns the $425.74 unit-cost claim from MODELLED to MEASURED. 0 beds assembled in-house so far. |

## Warmest-first shortlist (proximity to a signed, match-eligible commitment)

### Tier 1 — push now (warm, knockout-pass, full fit score)
| Funder | Contact | Stage / history | Capital | The specific ask (letter already drafted) |
|---|---|---|---|---|
| **Snow Foundation** | Georgina + team | Stewarding, deepest relationship (~$403K hist), R4/R5 in flight | Grant (ask loan-first / recoverable) | Formalise R4/R5 as a **signed multi-year LOI before end Aug** we can present as match. The first-mover signal everyone else reads. |
| **SEFA** | (named contact in CRM) | **Advanced discussion** | **Repayable working-capital ~$300K** | **THE single highest-value move:** advance to a **term sheet** now. Repayable = highest match value. Use of funds: inventory + next on-Country run. |
| **Centrecorp Foundation** | Randle | Stewarding + **live 130-bed board (June)**; already approved/paid 107 beds (Utopia) | Grant | At June board, a **grant commitment kept SEPARATE from the bed order** (order = revenue, not match). Central Australian Aboriginal foundation = real weight. |
| **Minderoo Foundation** | Lucy | **Ask made (~$200K)** | Grant | A decision inside the Sept window — a **signed LOI now, disbursement later**. Remote-Australia thesis. |
| **Vincent Fairfax Family Foundation (VFFF)** | El | Stewarding (~$50K), repeat funder | Grant | Renew with a **signed commitment to aggregate into the blended round**. |

### Tier 2 — ask in, convert before September
Paul Ramsay · Ian Potter · Tim Fairfax Family Foundation · Bryan Foundation · Brian M Davis · **Eloise Hall** (impact investor) · Dusseldorp Forum · The Funding Network · FRRR · Rotary.

### Tier 3 — net-new repayable (THE MATCH GAP — mostly cold, this is where the strategy adds most)
- **First Australians Capital** — highest-fit Indigenous-led repayable capital, **open now** (full fit score, fails knockout on TIMING only → right for next cycle unless it can move fast).
- **IBA** (Indigenous Business Australia) · **SVA / SEDIF** · **Conscious Investment** (debt side only).
- **QLD Partnering for Impact: CLOSED for 2026** (min $500K, 20% cap, EOI closed 15 Mar) — NOT a Sept match source; watch future round.

### Excluded from the match math (note, do NOT count)
QBE Foundation (cannot match itself) · DEWR / REAL Innovation Fund (separate vehicle) · equity VCs incl. Giant Leap (fail no-equity knockout) · the **buyer pipeline** (WHSAC, Northern Land Council, health corporations, govt re-tenders) = **revenue, not match capital**.

## Cautions from the relationship history (do not break these)
- **FRRR / VFFF**: the $50K is **one joint "Backing the Future" stream** — do NOT count as two separate $50K grants.
- **Centrecorp**: keep the **grant (match) cleanly separate from the 130-bed order (revenue)**.
- **PICC (Palm Island Community Company)**: contact **Rachel Atkinson**; PICC is a partner-relationship not just a funder; flagged as the **biggest revival opportunity** across the funder pipeline.
- **"El" vs Eloise Hall**: VFFF letter is to "El"; "Eloise Hall" is also listed separately as a Tier-2 impact investor (TABOO co-founder, outgoing Butterfly board). Confirm whether these are the same person before personalising.

## Hard claim guardrails (apply to ALL funder-facing output — Area 10)
1. Do **not** present active pipeline as committed capital.
2. Do **not** present the GHL pipeline value as committed (it is prospects, not signatures).
3. Do **not** say the QBE match is unlocked.
4. Do **not** present QBE's $400K as secured (**0 signed commitments today**).
5. Do **not** use DGR/entity language without legal/accounting confirmation (entity migration in progress; MinterEllison advising).
6. Do **not** imply community-owned manufacturing is complete (0 beds assembled in-house).
7. Do **not** quote a precise revenue figure — **hold AU$741,111 publicly until accountant-signed**; Goods-only carve-out ~AU$713,827; corrected reconciliation ~$907,569 still pending sign-off.
8. **Lead with verified proof only:** 496 beds · 9 communities · every bed QR-tracked · ~20kg recycled plastic/bed. (133 Stretch + 363 Basket; 107 to Utopia May 2026, 2.14t plastic diverted.)

## Live relationship data IN the CivicGraph DB (agents query these directly)
- **`fundraising_pipeline`** (14 rows) — curated funder pipeline: `funder, type, amount, status, probability, expected_date, actual_date, project_codes, contact_id, requirements, deadline, notes`. THE hand-curated truth.
- **`ghl_opportunities`** (975) — live GoHighLevel CRM: `name, pipeline_name, stage_name, status, monetary_value, project_code, pile, last_stage_change_at, last_status_change_at, assigned_to`. Filter `project_code` to Goods (ACT-GD) + the Goods funder pipeline_name. Synced every 12h.
- **`ghl_pipelines`** (17) — pipeline definitions (`name, stages`). Find the Goods funder pipeline + the dedicated "Match Campaign" pipeline.
- **`funder_briefs`** (2) — already-structured: `asks_from_them, ask_amount_aud, ask_status, ask_submitted_at, ask_decision_due, strategy_their_priorities, strategy_our_claims, next_move, next_move_owner, next_move_due, last_feedback_summary, notion_hq_url`. The template to extend.
- **`funder_profiles`** (3) · **`funder_portfolios`** / **`funder_portfolio_entities`** · **`funder_context_snapshot`** · **`funder_nudge_log`** · **`funder_allowlist`** / **`funder_blocklist`**.
- **Proof points:** `goods_communities`, `goods_deployment_batches`, `goods_asset_lifecycle`, `goods_procurement_entities`, `goods_procurement_signals`, `goods_governance_readiness`.
- `contact_intelligence` / `contact_intelligence_scores` / `contact_cadence_metrics` — engagement scoring per contact.

## Notion relationship pages (reference; agents cannot auth — facts above are extracted)
- QBE operating plan (warmest-first shortlist): `380ebcf981cf819cac62f51dd9532e84`
- Investor alignment tool, populated: `380ebcf981cf814ca724c12a01016467`
- Tier-1 funder letters (drafts): `380ebcf981cf81cfa9d1e21327880348`
- Area 10 — Investors & Capital Raising: `36eebcf981cf81329a11e33e2d121bf9`
- 19 GHL investor pipeline (match-readiness pipeline design): `380ebcf981cf81169eb0cc62f939e049`
- Capital And Funder Register: `355ebcf981cf81f085cfe0dcf26ea6d4`
- Per-project pipelines — Goods/Harvest/JusticeHub (tag scheme: goods-state-{nt|qld}, goods-communitycontrolled, goods-stage-{prospect|active|customer}, warmth goods-{hot|steady|cooling|cold}): `36debcf981cf817c90e5da6c150ab3b3`
- Goods on Country: the funding and demand system: `36debcf981cf81a48f9bd56727137d84`
- 10. Investors and Capital Raising (cautions incl. FRRR/VFFF double-count): `355ebcf981cf81bca45ce9a81a9c10e3`
- PICC Reporting (Rachel Atkinson, revival opportunity): `367ebcf981cf81c2b037f003a93c73f8`

## How the strategy must use this
1. **Reconcile** every workflow-discovered candidate against this shortlist + `fundraising_pipeline`/`ghl_opportunities` — do not re-pitch a Tier-1 as a cold lead; advance it from its real stage. Drop anything on the excluded list.
2. **Align** each Tier-1 brief to the drafted letter + named contact + the live stage; the brief's "opening move" is the *next* step on the SIH path (e.g. Snow LOI, SEFA term sheet), not an intro.
3. **Concentrate net-new discovery on Tier 3** — repayable/catalytic capital to fill the match gap (First Australians Capital, SVA/SEDIF, Conscious Investment + DB-surfaced peers). This is the scarce, highest-leverage search.
4. **Obey the 8 guardrails** in every funder-facing line.
