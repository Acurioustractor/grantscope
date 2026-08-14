# /clarity — design, and the two cleanups Ben approved

Round two, 2026-08-14. Twelve agents: three investigations, three competing design directions,
three judging panels, one synthesis, two verification passes.

## Nothing here has been applied

Eight migration files exist. **All are unapplied deliverables.** The database was not written to at
any point. Each carries its psql apply command in a header comment.

Before applying anything, read `CLARITY-VERIFICATION.md`. It checked 68 claims — 47 confirmed,
16 refuted, 5 indeterminate — and found three blockers, all now corrected in the files:

| | What it would have done |
|---|---|
| **B1** | The rewritten nightly job would have refreshed **zero matviews, silently, every night**. PostgreSQL forbids `COMMIT` in a procedure carrying `SET` clauses; plpgsql doesn't catch it at definition time. Fixed: settings moved into the body. |
| **B2** | The revoke migration **would not have closed the exposure it exists to close**. `knowledge_chunks` carries a second `{public}` policy predicated on `org_profile_id IS NULL`, and 19,367 of 19,413 rows (99.76%) are null. Fixed: that policy re-scoped to `authenticated`. |
| **B3** | The revoke **would have broken a live unauthenticated endpoint**. `partner_goals` and `partner_contacts` have exactly one policy each, and JusticeHub's `api/organizations/[id]` reads them with the anon key. Those two drops are now commented out with the prerequisite stated. |

Two further corrections applied: the `CONCURRENTLY` eligibility test missed partial and expression
indexes (B8), and three live-referenced Goods tables were on the extraction move list, one of which
backs the GrantScope home page (B5).

## Read in this order

| File | What it is |
|---|---|
| `CLARITY-VERIFICATION.md` | **First.** 68 claims checked. The blockers above. |
| `BAR-CHECK.md` | Does the spec clear "way way better"? Verdict: clears on structure, **not** on the vision half. Five additions, ~2 days. |
| `CLARITY-SPEC.md` | The build spec. 9 screens, 4 migrations, 7 slices, ~18.5 days, zero new dependencies. |
| `matview-reconciliation.md` | Decision 2. Six registries, not two. |
| `act-extraction-plan.md` | Decision 1. 162 confirmed in, 29 wrongly classified, 46 borderline. |
| `clarity-data-layer.md` | The catalog schema over the real 1,434-object universe. |
| `design-*.md`, `judge-*.md` | The three directions and the three panels that scored them. |
| `act_*_list.txt` | Machine-readable extraction lists. |

## The decision

**The Interrogator** won: 24 points across three panels against Atlas 21 and Instrument 19, with
20 named grafts from the losing directions. Question-first rather than inventory-first — the front
door holds facts about Australia, with the full 1,434-object ledger one click behind.

The dissenting panel (buildability, which ranked Atlas first) was resolved rather than overruled:
its three objections were defects with named fixes, not an argument about direction.

## What still blocks a yes

`BAR-CHECK.md` is the honest one. Its verdict sentence:

> Nothing on any screen answers a question about the world today; every screen audits our estate.
> There is no reason to open this on a Tuesday when nothing is broken.

Five additions close it, about two days:
1. **Media.** `alma_media_articles` holds 881 rows, 253 sources, running to yesterday, 805 already
   cleared through a consent gate that exists. Ben named media as a pillar; all four documents
   mention it once, as an empty cell.
2. **The 212 views**, inherited as a blind spot from round one — they contain *finished answers*
   (`v_youth_justice_state_dashboard`, `v_indigenous_youth_overrepresentation`, `v_qld_watchhouse_latest`).
   Inventory them as answers before seeding the question registry.
3. **JusticeHub and Empathy Ledger** — named, not represented. Empathy Ledger's consent bridge fill
   has never been measured by anyone.
4. Correct the flow-matrix figures: 144 cells and 91s, not 1,210 and 40s.
5. Promote the ten-day guard out of a build-sequence subsection.

## The guard worth keeping

Slices 1–2 ship something indistinguishable from a competent data catalog; the distinctive half
lands day 9–13. The spec's own line — *if slice 2 has not shipped within 10 working days of slice 1,
the direction has failed* — is the sentence to hold it to.
