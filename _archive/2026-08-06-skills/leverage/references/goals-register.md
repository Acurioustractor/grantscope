# Goals Register

What "valuable" means. A connection scores on goal-alignment only against these. Keep this in sync with
the source docs — if a goal changes, edit the doc first, then this file.

## G1 — The buyer wedge (PRIMARY revenue goal)

Source of truth: `docs/strategy/buyer-wedge.md` (run `/wedge` for current move status).
One sentence: **free open registry for everyone; paid evidence + tender tools for buyers.**

A connection serves G1 when it deepens one of:
- **Evidence depth** — proof a supplier/SE is real, capable, well-governed (contracts won, ACNC standing,
  ATO presence, board, outcomes). Evidence depth beats row count, always.
- **Tender tools** — anything that assembles a buyer-ready pack (supplier shortlist + evidence + risk).
- **Need-first search** — matching a buyer's *need* to capable suppliers (`/suppliers`, `se_search_index`).
- **Lighthouse-buyer motion** — finding/serving a specific paying procurement buyer (`/lighthouse`,
  `se_buyer_prospects`, `scout-se-buyers`).

Revenue test: *"would a procurement officer pay for this?"*

## G2 — Free registry legitimacy (supply-side magnet, NOT revenue)

Claim-your-profile, SE grant-matching, registry openness/trust. Fine and good, but must stay light-touch
and free. Legitimacy test: *"does this make the registry more trustworthy?"* Never the paid product.

## G3 — Justice & equity (mission)

Youth justice, child protection, prevention-vs-reactive spend, diversion, wraparound. Connections that
expose where money flows vs where need is (e.g. funding deserts, reactive vs prevention ratios) serve G3.
Topic tags: `justice_funding.topics`, `alma_interventions.topics`.

## G4 — Indigenous-led & community-controlled (mission)

ORIC corporations, ACNC Indigenous orgs, `is_community_controlled`, ALMA (cultural authority), remoteness.
Connections that surface Indigenous-controlled capability/funding/representation serve G4. Naming: always
"Australian Living Map of Alternatives (ALMA)".

## G5 — Place-based equity (mission)

Disadvantage vs funding by place (`mv_funding_deserts`, SEIFA, remoteness, LGA/postcode). Connections that
tie a place's need to its actual funding serve G5.

---

## The wedge filter (tag every opportunity)

Apply `/wedge`'s logic to each candidate and tag it:
- **green** — serves G1 directly (evidence depth, tender tools, need-first search, lighthouse).
- **supply-magnet** — serves G2; fine but free/light-touch, never ranked as revenue.
- **widening-paused** — its action is "acquire more data" → out of scope (move 5). Note and de-rank.
- **not-building** — on the buyer-wedge NOT-building list → stop, cite the doc.

A mission connection (G3–G5) that *also* feeds the wedge (e.g. Indigenous procurement evidence for buyers)
is the highest-value quadrant — flag those explicitly.
