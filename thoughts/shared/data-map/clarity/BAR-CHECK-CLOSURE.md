# Bar-check closure — the five gaps, measured

`BAR-CHECK.md` said CLARITY-SPEC clears on structure but not on the vision half, and named five
additions. This closes the three that needed measurement. All figures below are exact, measured
2026-08-14 by direct psql. Two of the three change the recommendation.

---

## A2 — The vision-pillar views are finished answers, and they are real

17 views in `public` match the youth-justice / detention / Indigenous / child / media pattern.
Counted individually (a single batched count times out — these are not free):

| View | Rows |
|---|---|
| `justice_funding_clean` | 151,866 |
| `v_justice_funding_by_org` | 69,480 |
| `alma_media_articles_publishable` | 805 |
| `v_youth_justice_state_dashboard` | 288 |
| `v_ndis_youth_justice_overlay` | 181 |
| `v_youth_justice_cost_comparison` | 160 |
| `v_ctg_youth_justice_progress` | 64 |
| `v_indigenous_youth_overrepresentation` | 50 |
| `v_qld_watchhouse_latest` | 1 |

Also present, uncounted: `v_justice_funding_by_program`, `v_justice_funding_summary`,
`v_justice_spending_summary`, `v_youth_justice_entities`, `v_youth_justice_recipient_stats`,
`v_youth_justice_recipients`, `vw_justice_enrichment_candidates`, `public_media_with_collections`.

**Consequence for the spec, unchanged from BAR-CHECK:** the board's flagship "CANNOT ANSWER YET"
card claims Indigenous over-representation is blocked on an empty `abs_indigenous_population_by_lga`.
`v_indigenous_youth_overrepresentation` returns 50 rows at **state** level. The honest render is
`honest_at='state'` **plus** the LGA want — not a refusal. Seed the question registry from these
views before writing new SQL; several questions are already answered.

---

## A1 — Media is a SEAM finding, not a pillar. Measured: 2.4%

`alma_media_articles.organizations_mentioned` (text[]) → `gs_entities.canonical_name`,
case-insensitive exact match on trimmed values:

- **450** distinct organisations mentioned across the corpus
- **11** match an entity in the graph
- **2.4%**

BAR-CHECK anticipated this exactly: *"If it is very low the card still works — it prints the rate —
but the framing needs to be a seam finding, not a coverage claim."* It is very low.

**Recommendation, revised.** Do NOT ship a media board card that implies media is joined to the
entity graph. Ship it as a **seam row** on `/clarity/seams` — 450 organisations named in Australian
media coverage of youth justice, 439 of which this database cannot identify — which is a far more
honest and more motivating object than a coverage bar. The corpus itself is real and current
(881 articles, 253 sources, running to yesterday, 805 consent-cleared), so the want is
"resolve media mentions to entities", and it is a name-resolution problem, not an acquisition one.

---

## A3 — The Empathy Ledger bridge exists for people and stories, NOT for organisations

18 bridge columns across 14 tables. Fill measured:

| Table | Column | Filled |
|---|---|---|
| `synced_stories` | `empathy_ledger_id` | **190 / 190 (100%)** |
| `public_profiles` | `empathy_ledger_profile_id` | **214 / 218 (98.2%)** |
| `partner_storytellers` | `empathy_ledger_profile_id` | 12 / 14 (85.7%) |
| `partner_stories` | `empathy_ledger_story_id` | 10 / 29 (34.5%) |
| **`organizations`** | **`empathy_ledger_org_id`** | **15 / 104,427 (0.014%)** |
| `registered_services` | `empathy_ledger_project_id` | 0 / 19 |
| `platform_media_items` | `empathy_ledger_media_id` | 0 / 6 |
| `blog_posts` | `empathy_ledger_story_id` | 0 / 37 |

**This corrects the fear and sharpens it.** COMPLETENESS.md worried the consent bridge might be at
0%, which would mean consent lineage was broken. It is not: at the **person and story** level the
bridge is essentially complete (100% and 98%). What does not exist is the **organisation** bridge —
15 rows out of 104,427.

So the seam is not "consent is broken". It is: *a storyteller's consent is traceable, but there is
no path from an Empathy Ledger organisation to a CivicGraph entity*, which is why GrantScope's
`place-brief-service.ts` reads `el_transcripts` with no reference to Empathy Ledger anywhere in its
codebase. Render it as a seam with a measured 0.014%, not as an unknown.

---

## A4 / A5 — edits only, carried into the spec

- Flow matrix is **144 populated cells and 91s**, not "up to 1,210" and ~40s. The generative
  argument survives at 5.5× over 26 curated questions, not 46×.
- The ten-day guard — *if slice 2 has not shipped within 10 working days of slice 1, the direction
  has failed* — belongs in §1, not buried in the build sequence.
- The blanket embedding rejection generalised from the worst index in the database (2,846 MB over a
  22%-populated column). Narrow it: `grant_opportunities` (99.96% populated) and `knowledge_chunks`
  (100%) are small and complete, and are viable for catalog relatedness.

---

## Net effect on the build

Three of the five additions turned out to be **corrections to claims the spec would have rendered**,
not new features:

1. Over-representation is answerable at state level today — the refusal card was wrong.
2. Media does not join at any useful rate — the board card would have overstated it 40×.
3. Consent lineage is intact for people and absent for organisations — the opposite of the framing.

That is the argument for doing this before seeding the question registry, not after. Every one of
these would have shipped as a confident, wrong number on the front door.
