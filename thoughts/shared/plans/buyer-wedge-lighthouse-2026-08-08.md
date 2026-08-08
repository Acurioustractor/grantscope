# Next phase prompt — Buyer wedge, move 3: land one lighthouse buyer

**Written:** 2026-08-08, at the close of the ACT money-surface session.
**How to use:** paste the "The prompt" block into a fresh session after `/clear`. Everything below it is the
grounding that prompt assumes, verified rather than remembered.

---

## The prompt

> Read `docs/strategy/buyer-wedge.md` and `thoughts/shared/plans/buyer-wedge-lighthouse-2026-08-08.md`,
> then work move 3: land one lighthouse buyer.
>
> Moves 1, 2 and 4 are built and verified — do not rebuild them. The open question is not what to build,
> it is which buyer to aim at, because the strategy names VIC/SA and the evidence machine is federal-only.
> Resolve that fork first, with me, before building anything.
>
> Start by telling me which of the two paths you recommend and why, in under ten lines. Then do the work.

---

## Verified state (queried 2026-08-08, do not re-derive)

| Move | State | Evidence |
|---|---|---|
| 1. Wedge picked | DONE | `docs/strategy/buyer-wedge.md`, decided 2026-06-08 |
| 2. Need-first search | **BUILT** | `/suppliers` (`apps/web/src/app/suppliers/page.tsx`, 443 lines) — q + state params, tier badges, contract evidence lines, tender-pack CTA |
| 3. **One lighthouse buyer** | **OPEN — this phase** | `se_buyer_prospects` = 417 rows; `/lighthouse` skill; `scripts/scout-se-buyers.mjs` |
| 4. Confidence strata | DONE | `social_enterprises.verification_tier`: 7,031 certified / 3,959 verified / 1,170 identified |
| 5. Data widening | PAUSED | Supply-side breadth only. Buyer-side evidence is *not* what that pause covers. |

Also built: `/procurement/tender-pack`, `/procurement/gap-map`, `/procurement/commissioning`.

## RESOLVED 2026-08-08 — and the fork below was built on a false premise

**Outcome: NSW Department of Communities and Justice.** Pack built at `thoughts/shared/prospects/nsw-dcj/`.

The claim below that "every one of the 417 prospects is a Commonwealth agency" is **wrong**.
`austender_contracts` carries NSW eTender disclosures (`source_url` = `tenders.nsw.gov.au`) alongside
Commonwealth rows, so state buyers were in the pool the whole time — NSW DCJ ranks 8th overall with 91 SE
suppliers and $3.69B. That made a third path available: a state buyer, with a state obligation, whose
evidence needs no ingest at all. Neither Path A nor Path B was the right answer.

Two further corrections found while verifying:

- **`scout-se-buyers.mjs` was inflating every figure.** Its ABN lookup deduped on the whole tuple, not the
  ABN, so 527 duplicate registry rows fanned the contract join out. The "$10.8B DSS" number quoted in
  Path A below is really **$3.98B**. Fixed and rebuilt 2026-08-08.
- **An NIAA pack has been built and demo-ready since 2026-06-09**, which this plan did not mention. See
  `thoughts/shared/prospects/PIPELINE.md`. Its figures are now stale and are corrected there.

Everything below is left as written, for the record.

## The fork that has to be resolved first

`docs/strategy/buyer-wedge.md` says to target **a Vic or SA government buyer** with SPF/SAIPP mandated
weightings. But `se_buyer_prospects` is derived from **AusTender, which is federal-only**. Every one of the
417 prospects is a Commonwealth agency. The `states` column lists where the *suppliers* are, not where the
buyer sits — an easy thing to misread, so read it carefully before ranking anything on it.

So the differentiator ("we can show a buyer their own social-procurement story from public contract
records") does not currently work for the buyers the strategy names. That is the actual blocker, and it is
a strategy question, not a bug.

**Path A — go federal, where the evidence already is.** Top warm prospects by SE supplier count:
Department of Social Services (137 SE suppliers, 482 contracts, $10.8B), National Indigenous Australians
Agency (132 / 364 / $72.9M), Services Australia (174 / 1,502 / $265.8M). The pitch works today with zero
new ingest. The weakness: no mandated social-procurement weighting creating urgency, so the pack is
interesting rather than needed.

**Path B — go VIC/SA per the strategy, and ingest their tender data first.** VIC and SA portals are
scrapable via headless Chrome with no proxy, and a scaffold plus ingest spec already exist (see the
`state_tenders_scrapable` memory — this overturned an earlier "Cloudflare dead end" conclusion, so don't
re-conclude it). The weakness: it is an ingest project before it is an outreach project. Note this does
**not** violate move 5 — that pause is about supply-side row count, and this is buyer-side evidence depth,
which the doc names as the scarce thing.

My read, for whatever it is worth to the next session: Path B is what the strategy actually asked for and
the ingest is smaller than it looks, but it is Ben's call and it changes weeks of work. Ask, don't assume.

## Stale data to refresh before trusting it

`se_buyer_prospects.computed_at` is **2026-06-08 — two months old**. Re-run `scripts/scout-se-buyers.mjs`
before ranking prospects or putting a name in front of anyone.

## Guardrails

- **Tier 3 boundary.** Anything that reaches a real buyer — an email, a LinkedIn message, a submitted form —
  is day-shift, human-in-loop, and needs an explicit verb from Ben. Prepare the pack; never send it.
- **Every dollar figure needs a source.** Buyer-facing numbers get a `.provenance.md` sidecar
  (`thoughts/shared/templates/provenance-template.md`). This is outward-facing material about real
  organisations, so a wrong figure is worse than a missing one.
- **`/wedge` before scope growth.** If this phase starts to grow a registry feature, run the guardrail.
- **`/ground` before any copy ships.** Outreach material is exactly what that pass exists for.
- Read `DESIGN.md` before any UI. Bauhaus Industrial, and CivicGraph is the intentional break from the
  Editorial Warmth family.

## Carried over from the money-surface session (small, unrelated to this phase)

- Unmerged branch `fix/ledger-classifier-note` — one docs commit correcting the ACT ledger. Merge or drop.
- Unverified: no scheduled run has yet exercised the multi-provider classifier. Tell: if the 23 unclassified
  `alma_funding_opportunities` rows clear on the next nightly run, it works. Details in
  `thoughts/shared/handoffs/act-money-surface/current.md`.
- Four ACT projects clear zero strong fits because their theme keywords are thin. Needs Ben's words about
  what each project does, not a looser matcher.
