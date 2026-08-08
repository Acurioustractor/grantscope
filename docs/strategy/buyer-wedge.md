# The Buyer Wedge — CivicGraph SE Registry Strategy

**Decided:** 2026-06-08 (Ben, strategy checkpoint session)
**Status:** ACTIVE — every SE-registry feature decision gets evaluated against this.

## The one sentence

> **Free open registry for everyone; paid evidence + tender tools for buyers.**

## What this means

- The registry (profiles, search, data downloads, claim-your-profile) stays **free and open, no gates**. Tags and certifications are signals, not gates. This feeds the supply side and creates legitimacy — same proven shape as Supply Nation (free supplier listing, ~870 paying buyers).
- Revenue comes from the **buyer side**: government/corporate procurement teams with social-procurement obligations (Vic SPF mandated weightings, SA SAIPP, QLD targets, federal framework recommended-and-lobbied). They pay for what nobody else has: **evidence** (ABN-keyed AusTender contract history, funding received, registry presence) and **tender tools** (analyse, tender-pack with state policy citations).
- SEs are users, not customers. Grant matching and claim-your-profile are free supply-side magnets, not products.

## Why this wedge (verified 2026-06-08, see competitive scan)

Two confirmed white spaces nobody in Australia occupies:
1. **No competitor links a supplier profile to actual government contract history or funding evidence.** Not Social Traders, not Supply Nation (aggregate spend only), not the state networks, not the grant tools.
2. **No free need-first product search across the full non-member SE universe.** Social Traders searches certified-only (~750); Supply Nation searches Indigenous-only.

Threat to respect: Social Traders' SE Identifier (open dashboard, ~6K, daily) converges on registry *breadth*. We do not win on row count. We win on **evidence depth + buyer UX**.

## The five moves (in order)

1. **[DONE — this doc]** Wedge picked formally.
2. **Need-first search as the front door.** Spec below. The data layer is ready; this is a search-UX build.
3. **One lighthouse buyer.** A government buyer with social-procurement obligations using a tender-pack in a real procurement. Worth more than the next 5,000 rows. Machinery: `scripts/scout-se-buyers.mjs` ranks every government buyer by their existing SE contract evidence — warm prospects are buyers who ALREADY buy from SEs and can be shown their own social-procurement story. Workflow: `/lighthouse` skill.

   > **Amended 2026-08-08 (Ben).** This move originally said "a Vic or SA government buyer with SPF/SAIPP obligations". Chosen instead: **NSW Department of Communities and Justice** — 91 SE suppliers, 383 contracts, $3.69B, of which 61 suppliers are ORIC or Supply Nation registered. Reason: the premise that our buyer evidence was federal-only turned out to be false (`austender_contracts` carries NSW eTender disclosures), so a *state* buyer with a real obligation was available with zero ingest, where Vic and SA are each an ingest project before they are an outreach one. The trade accepted: NSW has policy targets (Social Enterprise Policy direct engagement under $150K, Aboriginal Procurement Policy 3%) rather than Victoria's mandated SPF weightings, so urgency is softer. Vic/SA remain the right *second* move once state tender ingest exists. Pack: `thoughts/shared/prospects/nsw-dcj/`.
4. **Confidence strata in the UI** — certified > verified > identified. Turns the definitional risk (LLM-classified op shop next to a certified SE) into a feature. External marks (Social Traders, Supply Nation, BuyAbility, B Corp, PPF) are signals INSIDE our layer. Machinery: `verification_tier` column + `scripts/compute-se-verification-tiers.mjs`.
5. **Data widening is PAUSED.** NSW/QLD/WA/ACT classifier passes are cheap but marginal (~100 candidates). The registry is at universe scale (11.8K vs RISE's 5,795 identified, ~12K estimated universe). Evidence depth and buyer UX are the scarce things. Exception: grant ingest agents keep running (they're scheduled, zero marginal effort, and feed the SE-side magnet).

## Verification tiers (move 4 definitions)

| Tier | Meaning | Sources/basis |
|---|---|---|
| **certified** | Carries an external certification/verification mark from a recognised body | social-traders, supply-nation, buyability (ADE), b-corp; later: PPF-verified |
| **verified** | On a statutory register (ORIC, ACNC) or member-listed by a state SE network, with ABN matched | oric, senvic/secna/wasec/qsec/sasec with ABN, acnc-classified with ABN |
| **identified** | Directory-sourced or LLM-classified; no external mark yet | sacommunity-classified, mycommunitydirectory-classified, no-ABN rows |

Honesty rule: tier describes the *strength of external verification*, not SE-ness. The public framing remains "social and Indigenous enterprise supply base" with per-source flags. We aggregate verification marks; we never issue our own.

## Need-first search spec (move 2 — build next session)

**The interaction:** "I need [beds / catering / landscaping / IT support] in [place]" → ranked, evidenced suppliers.

**Ranking signal stack (in order):**
1. **Revealed capability** — AusTender contract titles/categories for the SE's ABN (what government actually bought from them). THE differentiator; no one else has it.
2. Sector/description match — existing `sector` array + description text (pg_trgm or embeddings; entity-embedding infra exists, social_enterprises needs an embedding backfill if semantic search is wanted v1).
3. Place — state/postcode proximity, `geographic_focus`.
4. Verification tier (certified > verified > identified) as a rank boost + visible badge, never a filter-out by default.

**Surface:** front door at `/suppliers` (or homepage hero) — NOT buried under `/giving/suppliers`. Procurement officers don't read "giving".

**v1 scope:** one search box + place filter; results show name, tier badge, evidence line ("12 govt contracts · $3.4M · last 2025"), sectors, claim-CTA on identified rows. SSR, no client-heavy graph. Tender-pack CTA on every result list.

**Out of scope v1:** embeddings (trgm is fine to start), buyer accounts, saved lists.

## What we are NOT building

- A grants portal for everyone (GrantGuru's curated 1,400 + council white-label channel is their game; our grant pool is an SE-side magnet and a future council-embed ingredient).
- A certification scheme. Never. We aggregate marks with attribution.
- More breadth scrapers (paused per move 5).
