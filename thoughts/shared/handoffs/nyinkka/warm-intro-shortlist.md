# Warm-Intro Shortlist — Post-Enrichment

**Date:** 2026-04-15
**Source:** CivicGraph `foundations.board_members` (post-enrichment) × `person_roles` (334K ACNC records) × fit score ≥7 target list.

## What changed
- **Board coverage on 126 target foundations: 25% → 96%** (31 → 121) via bulk `person_roles` join (9,344 foundations updated total)
- **9 additional boards + 3 grants** extracted via targeted website scrape (Support Act, Karrkad-Kanjdji, Indigenous Capital, CDU, Tiwi Land Council, Documentary Australia, Dementia Australia, Burnett Mary NRM, Vincent Fairfax Family Trust, Australian Rotary Health + others)
- **Grants coverage still at 21%** — the remaining gap; most grants lists are in PDF annual reports, not on scraped HTML. Addressable with manual pull for top 10.

## The single most valuable name: Allan James Myers
Sits on **both Ian Potter Foundation AND Minderoo Foundation**. Combined annual giving footprint **$239M**. One conversation = two Tier A pitches opened simultaneously. Priority-1 warm-intro target.

## Top 20 warm-intro candidates (Tier A/B funder boards × network breadth)

| Person | Funder board(s) | Total entity count | Leverage |
|---|---|---:|---|
| **Allan James Myers** | Ian Potter + Minderoo | 7 | #1 — unlocks both Tier A funders |
| **John Forrest** | Minderoo | 6 | Minderoo founder; full control |
| **Nicola Forrest** | Minderoo | 6 | Co-founder; grants lead |
| **Alison Watkins** | Ian Potter | 16 | Highest network breadth in entire list |
| **Rupert Myer** | Myer Foundation | 11 | Myer family principal |
| **Peter Hay** | Rock Art Australia | 11 | Direct Mukurtu-adjacent board |
| **Keith Rovers** | Humanitix | 11 | Ticketing + grant path |
| **Matthew Ryan** | Developing East Arnhem | 9 | **Direct NT bridge** |
| **Suzanne Montandon** | Minderoo | 4 | Minderoo Indigenous streams |
| **Paul Conroy** | Ian Potter | 6 | Ian Potter Arts lead |
| **Tessa Boyd-Caine** | Australian Communities Foundation | 6 | Sub-fund conduit |
| **Andrew Parfitt** | UTS | 3 | Academic partner pathway |
| **Anthony Grist** | Minderoo | 3 | Minderoo operations |
| **Kathryn North** | Ian Potter | 5 | Research grants |
| **Fiona McLeay** | Australian Communities Foundation | 5 | Civil society lead |
| **Patrick Houlihan** | Ian Potter | 5 | Corporate bridge |
| **Richard Simpson** | Swinburne | 5 | Academic/research |
| **Karina Coombes** | Tiwi Land Council | 5 | **NT Indigenous peer** |
| **Brian Tipungwuti** | Tiwi Land Council | 4 | **NT Indigenous peer (Tiwi Elder)** |
| **Stephen Walker** | Walk a While Foundation | 6 | NT youth/arts bridge |

## Tim Fairfax Family Foundation (the #1 thematic match)
Now enriched: **Gina Fairfax, James Peterson, Timothy Fairfax**. Three people — warm intro path needs external network (alumni, arts sector) not cross-board. Strategy: direct approach via QAGOMA / Brisbane arts network where the Fairfax family is heavily active.

## NT-local trust clusters — the peer alliance layer is real
- **Ininti Store Trust ↔ Walkatjara Trust** share 5 Warumungu/Anangu board members (Cyril McKenzie, Dorethea Randall, Leroy Lester, Peggy Naylon, Vicky Jingo) — confirms Central Australia peer network exists at governance level
- **Karrkad-Kanjdji Trust ↔ Karrkad-Kanjdji Limited** share 7 board members (Dean Yibarbuk, Jon Altman, Otto Campion, Justin Punch, Teya Dusseldorp, John Dalywater, Cindy Jinmarabynana) — NT arnhem-land cultural governance mirror of what Nyinkka could do

## Remaining data gap
- **27/126 target foundations have notable_grants** (21%). Need either: PDF annual report scrape (next agent build) or manual pull for top 10.
- **5/126 still missing boards** (likely the non-ACNC-registered ones: BHP Foundation, Rio Tinto Foundation, Woolworths Group Foundation).

## Next queries to run

```sql
-- Who on the warm-intro list has ANY connection to NT/Nyinkka/Warumungu/Barkly ecosystem?
SELECT pr.person_name, pr.company_name, pr.role_type
FROM person_roles pr
WHERE pr.person_name_normalised IN (
  'ALLAN JAMES MYERS','ALISON WATKINS','RUPERT MYER','PETER HAY',
  'MATTHEW RYAN','TESSA BOYD-CAINE','SUZANNE MONTANDON','PAUL CONROY'
)
AND (pr.company_name ILIKE '%NT%' OR pr.company_name ILIKE '%territory%'
     OR pr.company_name ILIKE '%indigenous%' OR pr.company_name ILIKE '%aboriginal%'
     OR pr.company_name ILIKE '%warumungu%' OR pr.company_name ILIKE '%barkly%'
     OR pr.company_name ILIKE '%arts%' OR pr.company_name ILIKE '%culture%')
ORDER BY pr.person_name;

-- Alison Watkins' 16 boards — full map
SELECT company_name, role_type, appointment_date
FROM person_roles
WHERE person_name_normalised = 'ALISON WATKINS' AND cessation_date IS NULL
ORDER BY company_name;

-- Matthew Ryan (Developing East Arnhem, 9 entities) — the NT bridge
SELECT company_name, role_type FROM person_roles
WHERE person_name_normalised = 'MATTHEW RYAN' AND cessation_date IS NULL
ORDER BY company_name;
```

## Actionable roster

**Immediate warm-intro asks (in priority order):**
1. Allan James Myers — via legal/arts sector networks; unlocks Ian Potter + Minderoo
2. Nicola Forrest or Suzanne Montandon — via Indigenous philanthropy network; Minderoo lead
3. Matthew Ryan (Developing East Arnhem) — direct NT peer intro, lowest-friction first-meeting
4. Brian Tipungwuti or Karina Coombes (Tiwi Land Council) — NT Indigenous peer solidarity
5. Peter Hay (Rock Art Australia) — Mukurtu-adjacent board, direct fit for data sovereignty pitch
6. Rupert Myer — Myer Foundation family principal
7. Matthew Ryan + Stephen Walker + Brian Tipungwuti — convene an NT cultural centres peer call; this is the peer alliance layer

**Files updated:**
- `foundations.board_members` — now 96% populated on target list
- `foundations.enriched_at` + `enrichment_source` — audit trail intact
- New script: `scripts/enrich-foundations-targeted.mjs` (reusable for future pipelines)
