# The Clarity Console

**Status:** plan, agreed 2026-08-16 via a design grilling. Not started.
**Supersedes:** the `/clarity` front door shipped across issue #190 slices 1–7 (PRs #204–#215). The
questions, sentinels, seams, wants and refusals all survive. The *front door* does not.
**Scope:** grantscope only. Reads across the shared database; writes nothing outside this repo
except one declaration file in `act-global-infrastructure`.

---

## One line

Turn `/clarity` from a 1,222-row admin table into an operator's console over the whole data
estate: a page for every object, one index above them, a row viewer that reaches the actual rows,
and a findings stream so that working the data compounds instead of evaporating.

## What it is for

Stated by Ben, 2026-08-16, and it governs every trade-off below:

> Keep surfacing what makes sense, what is matched, and what is still not working. Build the
> process that surfaces all related things **so community can make better decisions** — better
> relationships with funding, philanthropy and grants — and build the system to see what is
> actually happening in Australia across justice, child protection, health, so we can build better
> systems.

Three consequences worth holding on to, because they decide arguments later:

1. **Three states, never two.** What makes sense · what is matched · what is still not working.
   A console that only shows the working parts is a brochure. The unmeasured, the unfiled, the
   weak seams and the refusals are first-class content here, not blemishes to be cleaned up before
   showing anyone.
2. **Community is the destination, the operator is the first user.** Q2 settled operator-first and
   that stands — you cannot design a surface for community decisions until you can see the corpus
   yourself. But "admin-gated" is a stage, not the goal, and it is why the refusal ethos and the
   consent exception are load-bearing rather than decorative: everything built here should be able
   to survive being looked at by the people it is about.
3. **Cross-sector by construction.** Justice, child protection and health are separate domains in
   the catalogue and the same money, the same organisations and the same people run through all of
   them. The value is in the linkages, which is why the undiscovered-join detector and the seam
   match rates matter more than any single domain's completeness.

---

## The diagnosis

`/clarity` renders, is fast, and passes its tests. It still feels clunky, and the reason is
specific rather than aesthetic.

`clarity_object` carries about 60 columns per object — `purpose`, `caveat`, `grain`, `join_keys`,
`owner_app`, `importance`, `verdict`, `refs_app`, `refs_script`, `refs_migration`,
`refs_db_function`, `fk_in`/`fk_out`, `join_in`/`join_out`, `lineage_in`/`lineage_out`, `degree`,
`rls_enabled`, `anon_readable`, `first_seen_at`, `missing_since`. That is an encyclopedia article
per object, and it is already written for 812 of them.

**There is no page for an object.** `/clarity/q/[slug]` exists for questions. Nothing exists for
objects. So sixty curated fields per object render as one three-line row in a 1,222-row table, six
columns wide, in a page 70,614 pixels tall.

The content is Wikipedia. It shipped as a spreadsheet. Everything below follows from fixing that.

A second, smaller diagnosis: the default sort is `importance`, which is populated on all 1,479
objects and **tied for 424 of them at the single value `0.0225`**. For a third of the corpus the
"ranked" order is arbitrary, which is exactly how it reads.

---

## The shape

Craigslist and Wikipedia were both named as the target. They are opposites, and the useful
observation is that **the Wikipedia half already exists** — there is already a page per entity,
person, postcode and council (`/entity/[gsId]`, `/person/[name]`, `/places/[postcode]`,
`/place/council/[slug]`, plus per-entity `investigate`, `funding-flow`, `due-diligence`, `print`,
`compare`). What is missing is the Craigslist half: a complete, honest index that shows the shape
of the corpus and makes all of it reachable.

So: **build the index, and the object pages it points at. Do not rebuild the semantic pages.**

### The governing principle

> **Completeness at the index layer. Refusal at the claim layer.**

You may always see that an object exists, how many rows it has, and how bad it is. You are not
always handed a sentence you can quote from it. The index shows everything; the pages still refuse.
This reconciles "see it all like Craigslist" with the refusal ethos that eight slices of `/clarity`
were spent establishing, and it is the rule that settles every hard case below — including the one
hard exception, consent.

### Audience

**Operator-facing, admin-gated, garbage included** — optimised for one person finding things across
52.3M rows. A public civic encyclopedia is the eventual destination and is explicitly *not* this
build. You cannot design the public index until you can see the corpus yourself, and you currently
cannot.

---

## Architecture

### The spine — six nouns

Real-world nouns, not database domains. The existing 17-domain taxonomy is a *schema* taxonomy in
subject clothing: its largest member is `platform_ops_auth` at 215 objects, more than double the
next, so sorting the civic-money index by it puts auth tables first.

| Noun | Holds |
|---|---|
| **Money** | grants, contracts, donations, budgets |
| **Organisations** | entities, charities, companies, ABR |
| **People** | persons, directors, boards, roles |
| **Places** | postcodes, LGAs, SEIFA, geography |
| **Evidence** | ALMA, outcomes, stories, consent |
| **The Machine** | auth, agents, pipeline, staging, and everything unfiled |

Second axis is **source system** (ACNC, AusTender, ABR, ASIC, GrantConnect, AEC, state portals) —
nouns are what you look for, source is how you decide whether to trust it.

Open judgement, deferred to first contact: **split Money into Money In / Money Out** if, looking at
the 71 `grants_funding` and 32 `government_spend_procurement` objects on one shelf, they don't
belong together. Grants and procurement behave nothing alike.

No Time bucket. Change is a lens over every noun, not a noun.

### Assignment, and the honest gap

667 of 1,479 objects have no domain at all, and description is all-or-nothing — the same 812
objects carry `purpose`, `grain` and `join_keys`, so nobody has half-documented anything.

Rules **propose** a noun; a human **confirms** it. `verdict` / `verdict_by` / `verdict_at` already
exist in the schema for exactly this and are populated on **0 of 1,479** rows — the mechanism is
built and has never been used.

An object with no confirmed noun renders as **unfiled**. Never guessed into a bucket. An index that
quietly mis-files is worse than one that admits to 667 unfiled objects, and **the unfiled count is
the honest progress bar for the whole effort.**

### The front door — one page

One page, all ~1,024 relations, grouped under the six nouns, terse links, no pagination. You scroll
once and you have genuinely seen the corpus.

- **Alphabetical within a bucket**, with row-count and degree as one-click re-sorts. Craigslist is
  alphabetical for a reason: on a page visited daily, stable position beats optimal ranking, because
  you navigate by muscle memory rather than by reading. Smart rankings make the page move under you.
- The **questions strip sits above the corpus** — 12 answered, 6 contested, 3 refused, 5 blocked.
  They are the only place in the system where the data has been made to *mean* something. Small
  strip, though: the corpus is the body of the page.
- The current 70,614px height stops being a problem once rows stop being three-line cards. As terse
  links, 1,024 objects fit in roughly a fifth of that, and the unvirtualized table is fine.

### The object page — `/clarity/o/[object_key]`

The missing half, and **built first**. The index is navigation; this is the thing being navigated
to. Today a click on `austender_contracts` goes nowhere.

Renders the ~60 fields as an article: `purpose` and `caveat` as prose; `grain` and `join_keys` as an
infobox; `refs_app` / `refs_script` / `refs_migration` / `refs_db_function` as "what uses this";
`fk` / `join` / `lineage` / `degree` as "what it connects to" — the Wikipedia link graph, already
present as 1,367 rows in `clarity_edge`.

**Stubs are editable in place.** 667 near-empty pages will never be cleared by hand-written
migrations; they will be cleared in the two minutes after you look at a table and think "oh, that's
what this is." The page must capture that thought where it happens, writing `purpose` / `grain` /
`caveat` / `join_keys` directly. This is what makes the build compound instead of decay.

Also absorbs `seams` and `changes` — a seam is a fact about two objects, a change is a fact about
one. They belong on the object's page, not in a screen you must remember to visit.

### The row viewer

One component, not 1,024 pages. It is what converts "52.3M rows" from a claim into something you can
put your eye on.

Extends the pattern already shipped at `/clarity/q/[slug]/rows` (RPC `clarity_question_rows` —
refuses anything that isn't a single SELECT, clamps the limit, migration `20260815000700`).

- New guarded RPC: `SELECT * FROM <object> ORDER BY <pk or ctid> LIMIT 100 OFFSET n`
- Limit clamped **server-side**; object key checked against `clarity_object`, so it can only ever
  read catalogued relations
- **No free-text WHERE in v1** — column filters only, from the known column list
- **No `count(*)`** — use the nightly snapshot count
- First page always cheap. `abr_registry` is 20.0M rows and project rules already forbid unfiltered
  scans on exactly these tables.

**Cross-links out** by a small hard-coded convention table of about six rules: `gs_id` →
`/entity/[gsId]`, `abn` → entity by ABN, `postcode` → `/places/[postcode]`, `person_name` →
`/person/[name]`. Conventions beat declarations here because they work on all 1,479 objects
including the 667 stubs; let declared `join_keys` override later where present.

### Counts

Nightly snapshot with the age stamped on the page — which `/clarity` already does ("REFRESHED
2026-08-15"). Plus one deliberate exception: a **recount-this button per object**, so when a number
looks wrong you can force truth on demand rather than distrusting the whole page.

---

## The findings stream

This is the part that makes the console compound rather than just display, and it is the part the
existing schema cannot hold.

`clarity_event` has 10 rows and is the wrong shape: `before_value` / `after_value` / `delta_pct` /
`severity` / `reason`. It is a log of **numbers that moved**. It cannot hold "these two tables share
a key and have never been joined", or "this LGA has deep disadvantage, no funding, and a
community-controlled org sitting right there."

**There is nowhere in the schema to put a finding.** That gap is the work.

### Direction of learning

Both directions eventually — the pages teach you the real systems behind the data, and what you
notice accumulates — but built **capture-first**. The teaching content is 1,479 essays that don't
exist yet and can only be written by someone noticing things. Build the box before the thing that
fills it, or "learning modules" becomes a documentation project that stalls at 5%, which is already
the fate of the 667 stubs.

### Who notices

The system proposes; you adjudicate. Same `verdict` mechanism as noun assignment, so **one
adjudication surface serves both**.

- A machine-proposed finding starts **unconfirmed** and never counts as true.
- Confirmation promotes it.
- **Unconfirmed findings age out** after N days rather than piling up — otherwise the findings list
  becomes another 1,222-row table nobody reads and we have gone in a circle.

### Detectors

Ship first, both computable from data already held:

1. **Undiscovered join** — two objects share a column name and have no edge between them. Runs off
   `clarity_column` (**16,124 columns catalogued**) against `clarity_edge` (1,367 edges). One query.
2. **Orphan** — a populated relation that nothing in the app, scripts or migrations references.
   **BLOCKED, corrected 2026-08-16 during slice 1.** `refs_app`, `refs_script` and `refs_migration`
   are 0 on **all 1,479 rows** — the code scanner that populates them has never run. Only
   `refs_db_function` (328 objects) and the `db_function`/`trigger` rows in `clarity_code_ref` are
   real. Shipping this detector today would report **1,151 orphans**, every one of them an artefact
   of an unrun probe rather than a fact about the corpus — the exact `unmeasured` vs
   `never_populated` vs `dead` collapse this project already ruled out. **The code scanner is now a
   prerequisite slice.** Until it runs, the object page renders these UNMEASURED.

Later, in rough value order:

3. **Weak seam** — a declared join that resolves poorly (3 seams currently sit at 21–75%).
4. **Contradiction** — two sources disagreeing about the same ABN's name, state or size. The
   highest-value detector in the list and the one most likely to find something true about the real
   world. Needs per-source name normalisation, so it is a later slice, not a first one.
5. **Dead end** — an entity present in five systems whose graph node has no edges.
6. **Community-led opportunity** — high disadvantage, low funding, community-controlled org present.
   Substrate exists (`mv_funding_deserts`, `is_community_controlled`, the place-attribution work).

Community-led opportunity is **a detector in the one stream, never its own surface.** The moment it
gets its own screen it acquires its own ranking and its own rot, and that instinct is why there are
ten front doors already. It also **carries the confirmation gate more strictly than any other
detector**: naming a community as an "opportunity" on bad place attribution — when hub-address
attribution is still known to push the wrong way — is a real-world harm, not just a wrong number.

---

## ACT's own work

### ACT is a lens, never a bucket

`act_business` is a boolean — a lens by construction. Making it a seventh noun would tear the corpus
along the wrong seam: `justice_funding` is both civic infrastructure *and* ACT's work and cannot
live on one shelf.

The flag needs repair before it means anything. It is true on 306 of 1,479, but **132 of those are
`platform_ops_auth` and 91 are unfiled — 73% of the "ACT business" flag is plumbing.** Source is
`scope_table` (299) and `name_rule` (7): entirely rule-derived, never adjudicated.

### Project codes

Add **`project_codes text[]`** to `clarity_object`, drawn from the 74 canonical codes in
`act-global-infrastructure/config/project-codes.json` (11 categories: justice, indigenous, stories,
enterprise, regenerative, health, community, arts, events, funding, tech). An object can evidence
several projects.

**Declared from the project side.** The claim "these tables evidence Goods" is a statement about the
work, and belongs in the wiki under version control next to the decision that created it. Mirror it
onto `clarity_object` as an array for fast filtering. Same edge, stored once, written from the end
that owns the meaning.

Then "shed light on Goods" becomes a real query: every object evidencing ACT-GD, its freshness, its
gaps, its unconfirmed findings, on one page.

And the reverse is **the single most useful number in this design**:

> **Of 74 project codes, how many have zero evidence?**

That is the list of projects the data cannot currently speak about at all.

### `owner_app` — populate it

`owner_app` is `'neither'` on **all 1,479 rows**. The column exists, the enum plainly anticipates
grantscope / justicehub / both, and in a Supabase project shared by CivicGraph, JusticeHub and
empathy-ledger, the catalogue cannot say which product owns a single object.

Populating it via the same propose-then-confirm path is close to free and is what makes the whole
ACT ambition possible: "shed light on justice and stories and Goods" is unachievable from a
CivicGraph-only catalogue, because justice lives partly in JusticeHub's tables (`organizations`
104K at 99.72% bridged, `state_tenders` 200K) and stories live in the consent-tiered storytelling
tables — and right now nothing knows that.

### What ACT should look at first

Not "which data serves our work" (a filter) and not "opportunities for ACT" (exists already, and
mostly disappoints — `fit_score ≥85` funders are noise, and 348 grants close in 60 days, not
25,879).

**Turn the graph on yourselves.** A Curious Tractor Pty Ltd, The Butterfly Movement and A Kind
Tractor are real ABNs in a 20M-row register, sitting in a network of donations, contracts, board
interlocks and funding that has never once been looked at from the outside. That is the only one of
the three that can surprise you.

---

## Stories, and the one hard exception

empathy-ledger-v2 points at **`tednluwflfhxyucgwigh` — the same Supabase project as CivicGraph.**
The stories and the 52.3M rows of public money are already in one database. Nothing needs to be
joined for the risk to exist; it exists now.

That repo carries **21 consent migrations**, the newest dated 2026-08-14 and 2026-08-15. Their names
are the design: `every_named_person_consents`, `public_storytellers_requires_consent`,
`org_consent_needs_human_confirmation`, `consents_record_who_gave_them`,
`syndication_consent_who_granted`, `article_consent_requires_single_subject`.

`clarity_object` already catalogues 49 `storytelling_consent` objects. The row viewer as designed
would open them.

### The link is project-mediated, and only project-mediated

A story links to a **project code**; a project code links to the **objects that evidence it**; data
is reached only through the project.

Direct story→data linkage is how re-identification gets built: a story from a young person in Alice
Springs, joined to `justice_funding`, `person_roles` and a 20M-row ABN register, can name someone the
storyteller never agreed to name — and the rule shipped two days ago is that *every named person
consents*. Place-mediation is the more dangerous version of the same mistake: place is a
quasi-identifier, and at postcode grain in remote communities it is often *the* identifier.

Project-mediation also happens to be what was actually asked for — stories overtly about the
projects we do. A story says "this is about Goods"; Goods says "this is my evidence"; the reader
sees both; nobody is triangulated.

**Now:** story ↔ project only.
**Later, deliberately:** project + coarse place, grain fixed at LGA, never postcode, with a
minimum-count suppression rule.
**Later still, and narrowly:** project + organisation, only for organisations that are parties to
the work and have consented *as organisations* — which is what `org_consent_needs_human_confirmation`
was built for.

Do not design the later two yet. Get story↔project working and see whether "here is what we say
about Goods, and here is what the data says about Goods, on one page" is already 90% of it.

### The console refuses consent-governed rows

**This is the single hard exception in the design**, and it is the governing principle applied
rather than an exception to it: the index shows everything, the pages still refuse.

For a consent-governed object the console shows that it exists, its row count, grain, freshness,
RLS posture, owner — everything *about* it — and **refuses the rows**, with the reason rendered on
the card the way `/clarity` already refuses claims.

"Admin-only" is not a consent basis. A storyteller consented to their story being used a particular
way, not to it being browsable by whoever holds the admin session.

**Enforced in the RPC, not the UI.** The UI is one query parameter away from being bypassed.

---

## Build order

Eleven slices. That is a lot, and slices 0–5 are the ones that change how the system feels; 6–10 are
what make it compound. Stopping after 5 leaves something coherent and much better than today.

| # | Slice | Notes |
|---|---|---|
| 0 | **Deletions** — `/discover` (118), `/dashboard` (278), `/start` (108) | Check inbound links first. Own PR, trivially revertible. Keep `/home` (public marketing) and `/rankings` (real content). Read `/insights` (323) before judging it. |
| 1 | **Object page** `/clarity/o/[object_key]`, read-only | No new schema. Highest value in the build. |
| 2 | **Inline edit** on the object page | Write path. Three `/api/clarity` routes already exist and have **never served a request** — this needs real HTTP verification, not a typecheck. |
| 3 | **The index** — one page, six nouns, alphabetical, terse links, questions strip on top | Cheap once objects have pages. |
| 4 | **Nouns** — `noun` column, rules propose, human confirms, unfiled counter | First use of `verdict` in anger. |
| 5 | **Row viewer** — guarded RPC **plus consent refusal in the same slice** | The refusal must never ship a release later than the reader. |
| 6 | **Fold `seams` and `changes` into the object page**; delete both screens | Keep `wants` (a real work queue) and `cross` (genuinely about many objects). |
| 6b | **Code scanner** — populate `refs_app` / `refs_script` / `refs_migration` | Added 2026-08-16. Prerequisite for the orphan detector; without it slice 7 reports 1,151 false orphans. |
| 7 | **Findings** — `clarity_finding` table, detector 1 (undiscovered join), adjudication, age-out | The compounding layer. Detector 2 (orphan) only after 6b. |
| 8 | **`owner_app`** — propose and confirm across all 1,479 | Unlocks the cross-product view. |
| 9 | **Project codes** — wiki-side declaration, mirror to `clarity_object`, zero-evidence report | Cross-repo: one declaration file in `act-global-infrastructure`. |
| 10 | **Stories** — story ↔ project link, project-mediated only | Consent-critical. Day shift, human in the loop. |

Sequencing notes worth keeping:

- **Slice 5 is atomic.** The row viewer and the consent refusal ship together or neither ships.
- **Slice 2 before slice 3.** Capture before navigation — the box before the thing that fills it.
- Slices 9 and 10 touch other repos and cross into consent territory. Day-shift work, not AFK.

---

## What is deliberately not being built

- A **public** civic encyclopedia. Destination, not this build.
- A **community-led opportunities screen**. It is a detector in the one stream.
- **Contradiction detection.** Highest value, needs name normalisation first.
- **Story ↔ place** and **story ↔ organisation** links.
- **Teaching content** (the 1,479 essays). The capture mechanism comes first; the essays are what
  accumulates through it.
- Any change to the **26 questions, sentinels, refusals or the answer runner.** All of that survives
  untouched.

---

## Open, and honestly so

- **Money In / Money Out** — whether Money splits. Decide on first contact with the shelf.
- **The age-out window** for unconfirmed findings. N is unset.
- **`/insights`** (323 lines) — unread, so unjudged.
- The seven rendering defects found on the current screens on 2026-08-16 (duplicate React key on the
  map, `break-all` shredding titles, "1 objects moved", the triplicated refusal paragraph, a leaked
  `▸ none + finer framing` placeholder, `NEVER RUN · RUN #0` on a refusal). Slices 1–5 delete most of
  the surfaces they live on. **Do not fix them first** — fix only what survives the rebuild.

---

## Measured facts behind this plan

All queried 2026-08-16 against `tednluwflfhxyucgwigh`. Re-measure before trusting them again.

| Fact | Value |
|---|---|
| Catalogued objects | 1,479 |
| With `purpose` / `grain` / `join_keys` | 812 each (same set) |
| With `caveat` | 728 |
| Stubs (no purpose/grain/join_keys) | **667** |
| With `verdict` | **0** |
| `owner_app = 'neither'` | **1,479 of 1,479** |
| `importance` tied at `0.0225` | **424** |
| `act_business = true` | 306 — of which 132 `platform_ops_auth`, 91 unfiled |
| `act_business_source` | `scope_table` 299, `name_rule` 7 |
| Largest domain | `platform_ops_auth` 215 |
| Objects carrying any domain | 812 of 1,479 |
| `clarity_column` | 16,124 — but `null_pct` is NULL on every one; never profiled |
| Objects with a column catalogue | 1,056 of 1,479 (routines never have one) |
| `refs_app` / `refs_script` / `refs_migration` > 0 | **0 / 0 / 0** — scanner never run |
| `refs_db_function` > 0 | 328 |
| `clarity_edge` | 1,367 |
| `clarity_code_ref` | 816 |
| `clarity_answer` | 89 |
| `clarity_gap_metric` / `_measurement` | 24 / 36 |
| `clarity_event` | **10** |
| Wiki markdown files | 1,090 (98 projects, 64 narrative, 58 decisions, 54 stories, 47 concepts, 34 synthesis, 23 people) |
| Canonical project codes | 74, in 11 categories |
| empathy-ledger-v2 consent migrations | 21, newest 2026-08-15 |
| empathy-ledger-v2 Supabase project | `tednluwflfhxyucgwigh` — same as CivicGraph |
| Current `/clarity` page height | 70,614px |
