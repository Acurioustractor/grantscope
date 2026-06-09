---
date: 2026-06-09
title: Goods Governance + Relationship-Intelligence Layer
status: planned — ready to build in a fresh context
inputs:
  - research: thoughts/shared/research/goods-relationship-intel-patterns-2026-06-09.md
  - membership model: act-global-infrastructure/wiki/decisions/act-belonging-model.md
  - roster source: act-global-infrastructure/wiki/concepts/act-business-architecture.md
---

# Goods Governance + Relationship-Intelligence Layer

The next Goods workstream (after the 6-tab command center merged in PR #66). Ben's vision:
fuse GHL + email + Supabase graph + LinkedIn into one understanding of "who can help Goods
and how," showcase the connections compellingly, and stand up a **governance section** —
the advisory group + Goods on Country charity members + how people become members.

## Ben's decisions (2026-06-09)
1. **Roster source:** the people are NAMED IN THE WIKI — align/sync so they're always accessible (don't retype).
2. **Membership model:** a **lifecycle** — Ben will confirm/define stages. (CANONICAL model already exists, see below.)
3. **Surface:** its **own governance section**, separate from the Goods funding pages (closer to the Butterfly charity-board structure).

## The membership model already exists — confirm, don't invent
`act-belonging-model.md`: the **ACT Belonging Model**, one ladder across the ecosystem:

| Rung | Meaning | Tag |
|------|---------|-----|
| Curious | aware, in the system, not engaged | `tier:curious` |
| Connected | receiving the story, warming, opted in | `tier:connected` |
| Member | committed — joined, supports, contributes, belongs | `tier:member` |
| Active | shows up — does the thing | `tier:active` |
| Steward | aligned — champions, brings others, co-owns, can be handed the keys | `tier:steward` |

- `tier:` is one namespace; `project:` scopes it. Stage (GHL pipeline) and `tier:` stay in sync.
- **For Goods:** Member = committed funder/supporter/buyer · Active = repeat giving, deploys beds, refers · Steward = champion / **advisory** / backs community ownership.
- **ACTION:** confirm with Ben whether the governance section uses these 5 rungs verbatim or a governance-specific variant (prospect → invited → advisory → board/member).

## HARD CONSTRAINT — the line that must never blur
The ladder is for people who **support** the work (funders, members, buyers, partners, public).
It is **NOT** for the communities the work is **with**. First Nations communities, storytellers,
the people in the stories are **co-owners from the first moment** — sovereign, consent-governed
(OCAP), already at the deepest belonging by right. **Never** laddered, funnelled, or shown as "leads."
Any orbit/membership UI must structurally separate co-owners from the supporter ladder.
(Also: ACT brand voice — no em-dashes in ACT-facing copy, Indigenous place names first. Load the
brand-alignment writing-voice ref before any public copy.)

## The roster (seed) — Butterfly Movement Ltd Indigenous-majority board
The "Goods on Country charity member list" = the Butterfly board (the Goods charity + DGR home):
- **Kristy Bloomfield**
- **Audrey Deemal**
- **Sonia** (transition director)
- handover 26 Jun 2026
(Verify full names/roles against the wiki + GHL before seeding. These are governance/co-owners,
NOT funnel targets — present with respect, per the constraint above.)

## Data model
- **Home:** `org_contacts` already fits — `name, role, contact_type ('governance'), organisation, email, linkedin_url, person_id, linked_entity_id, project_id`. Use it; don't build new plumbing for the roster.
- **Membership lifecycle:** add a `tier`/`membership_stage` dimension (mirror the belonging ladder) — either a column on `org_contacts` or a small `goods_members` view that joins org_contacts + GHL `tier:` tags. Keep the GHL `tier:` tag as the source of truth (sync, like the funder-insight `ghl_signal` pattern).
- **Sync from wiki:** a script that reads the named roster from the wiki and upserts into `org_contacts` (idempotent), so "named in wiki → always accessible in-app" stays true. Mirror the `sync-act-context.mjs` downstream pattern.

## The build — top patterns to steal (from the research, ranked, all on data we already hold)
1. **Orbit Model membership view** — concentric rings (core advisory/board → members → engaged → network), scored by GHL activity + warmth. IS the "how people become members" funnel + the most showcase-worthy visual. Spine of the governance section. (Honor the co-owner separation — communities are not an outer ring of the supporter orbit.)
2. **"Best opener" inline** (Folk) — on every funder/target row, the strongest Goods-side connector via `mv_board_interlocks` + `goods_relationships`. Makes warm-intros ambient.
3. **"How Goods is connected" panel + degree badge** (LinkedIn) — degree ("2nd, via Nick → board member"), shared boards/funders, mutuals — on the board-interlock graph we own.
4. **Warm-intro shortest-path, drawn** (Polinode) — render the path Goods → target + the one recommended opener + warmth score.
5. **Fused relationship timeline** (Attio/Dex) — one feed: GHL emails/conversations + Xero invoices + civic-graph events + notes, click-through to provenance.
6. **Ego graph with depth slider + colour groups** (Obsidian) — per-person 1–2 hop on the existing `/graph`; anti-hairball.
7. **"Reason to reach out" life-event cards** — fire an outreach card when a contact's entity hits a new grant/contract/donation/ACNC filing. A moat: we own the feeds.
De-rank: full LinkedIn ingestion + NLP edge-extraction — our edges are already structured; surface provenance, don't infer it.

## Suggested slice order (build one at a time, commit each)
1. **Roster + wiki sync** — `org_contacts` governance seed from the wiki, idempotent sync script. (Foundational; unblocks everything.)
2. **Governance section shell** — its own area + sub-nav; the member directory (roles, tier, LinkedIn, contact).
3. **Orbit Model view** — the membership ladder as orbits; co-owner panel kept structurally separate.
4. **Connection showcase** — "best opener" inline + "how Goods is connected" degree panel on existing relationship rows.
5. **Fused timeline + life-event cards** — the moat features.

## Open questions for Ben (resolve on resume)
- Governance section: use the 5 belonging rungs verbatim, or a governance-specific ladder (prospect → invited → advisory → board)?
- Scope of v1: just the Butterfly board roster + orbit, or the full supporter-membership ladder across all Goods contacts?
- How to treat the email-history source (which inbox? Gmail MCP? privacy) — deferred from the funder-insight slice; same privacy weight.
