# What a community organisation can honestly be shown about money moving through its place

*19 August 2026. Resolves research ticket #305, part of map #303.*

Every figure below is labelled **Verified** (I ran the query today), **Inferred** (derived from
verified figures, not directly measured) or **Unverified**. Queries ran through
`scripts/gsql.mjs` against `tednluwflfhxyucgwigh`.

Prior work this builds on, not repeated here: `2026-08-19-grant-place-capture.md` (the capture
measure and its four corrections) and `2026-08-19-delivery-location-scoping.md` (why federal
contract delivery location does not exist).

---

## 1. Per-lane table

| lane | rows / dollars | geography available | honest grain | coverage | bias |
|---|---|---|---|---|---|
| **Grants** `grantconnect_awards` | 291,264 / $230bn | `delivery_postcode` + `delivery_state`, **separate** from recipient postcode/state | **LGA** where both resolve; **state** otherwise | LGA: 85,898 awards, **$33.75bn (14.7% of grant dollars)**, 426 LGAs. State: 281,003 awards, $200.21bn | `delivery_postcode` holds the literal `'Multiple'`; `delivery_state` holds 318 values incl. comma-lists, `National`, `Overseas`. Government-owned corporations (ARTC $940M) dominate any per-place ranking |
| **Federal contracts** `austender_contracts` | 825,222 / $1,268.2bn | **supplier registered address only** — no delivery location anywhere in the source (settled) | LGA of the supplier's registered office. **Not a delivery claim** | supplier ABN present 767,369 rows / $1,199.8bn; joins to a `gs_entities` LGA on 725,631 rows / **$1,141.8bn (90.0% of dollars)** | Registered-address bias, quantified in §2. 91.5% of contract dollars land in "Major Cities" by this measure; Remote + Very Remote together are **$3.1bn, 0.26%** |
| **Justice funding** `justice_funding` | 125,300 / $33.98bn (after the three mandatory filters) | `state` (99.8%), `location` free text (82.9%), `gs_entity_id` → recipient entity (96.4%, $32.38bn) | **State.** Recipient-entity LGA where linked — again a registered-address claim | `state` 125,028 rows; `location` 103,838 rows but **7,913 distinct unnormalised values** incl. `Multiple`, `Statewide`, `Not applicable`, `n/a`, mixed casing, `SOUTHPORT, Gold Coast (C)` | `location` is a lead, not a place key. Recipient link is registered address, same bias as contracts |
| **Political donations** `political_donations` | 557,491 / $25.27bn (`receipt_type='donation received'`) | `source_state` = **the disclosure jurisdiction**, not a place. `donor_abn` on 109,315 rows (19.6%) | Effectively **unplaceable**. 104,279 rows / $12.59bn join an entity; 95,389 get an LGA | ≤ 50% of donation dollars, and only as donor head office | `source_state` looks like a place and is not. Donor address is head office |
| **ACNC** `acnc_charities` | 66,143 charities | registered address `postcode`/`state` (90.5% / 90.3%), plus `operates_in_*` booleans / `operating_states` (77.7%) | **Registered address at postcode grain**; `operating_states` is a genuine *operating footprint* signal at **state** grain | 59,858 with postcode; 51,369 with operating states | Registered address ≠ where services are delivered. `operating_states` is self-declared and state-grain only |
| **State tenders** `state_tenders` | 199,719 / $37.82bn | `state` column only | **Not a delivery location.** See §3 | 100% populated — but **199,679 of 199,719 rows are QLD** | It is a portal-jurisdiction label on an almost entirely Queensland dataset |

All row counts and dollar figures in this table: **Verified** today.

**The asymmetry, stated plainly.** The lane that can be placed to an LGA by *where the work
happened* is $33.75bn. The lane holding the money is $1,268bn and cannot be placed at all.
Delivery-placeable money is about **2.2% of the ~$1,557bn across these lanes** (Inferred:
33.75 / (1268.2 + 230 + 33.98 + 25.27)).

---

## 2. The registered-address bias, measured

This has been documented as an artefact and never quantified. It can be quantified, because the
grant lane is the one place where we hold **both** locations for the same dollar. Attribute those
dollars twice — once by delivery location, once by recipient registered address — and the
difference *is* the bias that every other lane silently carries.

Population: awards where **both** delivery and recipient postcode resolve to a single trustworthy
LGA (an inner join, so smaller than the $33.75bn view): **$23.06bn**. **Verified.**

| remoteness | $m by delivery location | $m by recipient registered address | shift |
|---|---|---|---|
| Major Cities | 15,214 | 15,597 | **+2.5%** |
| Inner Regional | 2,831 | 2,691 | −4.9% |
| Outer Regional | 1,680 | 1,233 | **−26.6%** |
| Remote | 536 | 345 | **−35.6%** |
| Very Remote | 445 | 345 | **−22.5%** |
| (postcode unmapped) | 2,354 | 2,851 | +21.1% |

**Verified.** Read the middle column as "what a contracts-style, registered-address-only dataset
would tell a remote community it received".

**Remote Australia loses just over a third of its money to the city when you attribute by
registered address instead of by where the work happens.** Every contract, donation and
justice-funding place figure we can produce today is computed the way the right-hand column is.

### The surprise: it is not mostly land councils

The remote-intermediary story predicts community-sector hubs — a land council's town office
crediting the regional centre. The largest Very-Remote-delivered / Major-Cities-received awards
are not that. Top five by value, **Verified**:

| recipient | $ | delivered into | recipient LGA |
|---|---|---|---|
| Southern Cross Operations Pty Ltd | 30.8M | Burke (Very Remote) | Melbourne |
| Santos Limited | 16.5M | Unincorporated SA | Adelaide |
| Lynas Kalgoorlie Pty Ltd | 15.6M | Kalgoorlie-Boulder | Vincent |
| Metso Minerals Australia Ltd | 5.2M | Karratha | Perth |
| Engie Hydrogen Pty Ltd | 3.3M | Ashburton | Melbourne |

Mining, gas and energy corporates with capital-city head offices. The bias is real and large; its
*composition* at the top end is corporate head-office registration, not community intermediation.
The land-council effect may still exist further down the distribution — that is **Unverified** and
would need the community-sector subset isolated before anyone claims it.

This also means the ARTC caveat from the capture analysis generalises: **the top of any per-place
capture ranking is a list of places that had a mine, a railway or a transmission line built.**

---

## 3. Is there a second source for contract delivery location?

**No.** Three routes checked:

1. **Federal OCDS** — settled by the scoping doc: zero `deliveryAddress`, zero `deliveryLocation`
   across 100 live releases. Not re-investigated.
2. **`state_tenders`** — the `state` column is 100% populated and 99.98% of it is the single value
   `QLD` (199,679 of 199,719 rows; VIC 30, NSW 10). **Verified.** It is a jurisdiction label on a
   Queensland-only scrape, not a delivery geography, and it offers no sub-state field at all.
3. **`state_tenders` free text** — average description length **26 characters**; only **108 of
   199,719 rows (0.05%)** contain any of `region|district|shire|council|north|south|central`.
   **Verified.** Text extraction fails here even harder than it failed on AusTender titles.

Defence remains the largest single unplaceable block and is an FOI-shaped ask, not a data problem.

---

## 4. The largest honest claim available today

> **"Of the grant money the Commonwealth delivered into your local government area, this share was
> received by an organisation based in your local government area — and this share was not."**

Available for **426 LGAs**, on **85,898 awards worth $33.75bn**, via `v_grant_place_capture`.
Nationally the answer is **85.1% of awards and 59.6% of dollars** captured locally. **Verified.**

It is the largest honest claim because it is the only one in the whole database where *where the
work happened* and *who got paid* are both recorded for the same dollar. Everything else is a head
office address.

**The caveat that must sit beside it, every time:**

> This covers 14.7% of Commonwealth grant dollars and about 2% of all public money we track. The
> $1.27 trillion federal contract lane records no delivery location at all, so it is absent from
> this figure — not zero, absent. Large national infrastructure delivered by government-owned
> corporations can dominate a single LGA's result and does not mean what the rest of the measure
> means.

### One more claim worth having, at state grain

**96.8% of grant dollars are received in the state they were delivered into**, across 281,003
awards / $200.21bn (from the prior analysis, not re-run: **Unverified today**). Set against 59.6%
at LGA grain, the leak is entirely *within* state. Money delivered into a place stays in the
jurisdiction and leaves the town. Any pitch aimed at interstate extraction is aimed at something
that is not happening.

---

## Implications for the map (#303)

- A community-facing "money through my place" screen is buildable **today** for the grant lane at
  LGA grain, with a coverage number on the face of it.
- It must show the contract lane as **absent, with a stated reason**, not as a small number. A
  confident zero is the failure mode CLAUDE.md already warns about.
- Any contract, donation or justice-funding place figure that does ship must carry the §2 number:
  registered-address attribution understates remote places by 22–36%.
- Two follow-ups worth tickets: isolate the community-sector subset of §2 to test the land-council
  hypothesis properly; and normalise `justice_funding.location` (7,913 distinct values over
  103,838 rows) if state grain is ever not enough.
