---
date: 2026-03-19T03:15:00Z
session_name: unified-relationship-network
branch: main
status: active
---

# Work Stream: unified-relationship-network

## Ledger
**Updated:** 2026-03-19T03:15:00Z
**Goal:** Cross-system contact network — unified tags, GHL/Notion/CivicGraph links, smart tag taxonomy
**Branch:** main
**Test:** `cd apps/web && npx tsc --noEmit`

### Now
[->] GHL tag cleanup — reviewing 163 tags with user, building cleanup script. Full tag audit printed, awaiting user decisions on keep/merge/delete per group.

### This Session
- [x] Migration: `unified_tags text[]` + GIN index on `person_identity_map`
- [x] Tag sync service (`tag-sync-service.ts`): `buildUnifiedTags`, `syncTagsToGHL`, `batchSyncTags`
- [x] Enriched `getOrgContacts()` — JOINs `person_identity_map` → `ghl_contacts`, returns engagement status, tags, notion_id
- [x] Contacts UI: engagement badges, tag chips (clickable filter), Notion buttons, GHL/Notion status dots, tag filter dropdown
- [x] Notion linking API: POST/DELETE `/api/org/[id]/contacts/link-notion`
- [x] Batch sync script: `scripts/sync-contact-tags.mjs` (37 people synced on first run)
- [x] GHL custom field "CivicGraph Profile" created (ID: `sGf7MWeuQTUuQIYp4VpS`, type: TEXT)
- [x] `updateContactCustomField()` + `customFields` param added to `upsertContact()` in `lib/ghl.ts`
- [x] Sync-to-GHL route writes CivicGraph entity URL on every upsert
- [x] Backfill script: 139 GHL contacts got CivicGraph Profile URLs (via `contact_entity_links`, confidence >= 0.5)
- [x] Two commits on main: `99a3e7f` (unified network) + `036e161` (GHL links)

### Next
- [ ] **GHL tag cleanup** — user reviewing 163 tags, needs to decide keep/merge/delete per group
- [ ] Build GHL tag cleanup script (rename + merge old → new via API)
- [ ] Update `GHL_TAG_MAP` in `tag-sync-service.ts` to match new canonical tags
- [ ] QA contacts page (needs auth cookie import for headless browse)
- [ ] Populate Notion links (search Notion for existing contact pages)
- [ ] Add `sync-contact-tags` to agent registry + orchestrator

### Decisions
- **Tag format**: `prefix:value` — role:, sector:, engagement:, topic:, source:, org:, ghl: (passthrough)
- **GHL custom field**: TEXT type (no URL type available in GHL), field ID `sGf7MWeuQTUuQIYp4VpS`
- **Entity URL priority**: linked entity page > org contacts page (via `contact_entity_links` with confidence >= 0.5)
- **Tag sync direction**: GHL tags pull into unified_tags; CivicGraph role:/sector:/topic:/priority: tags push to GHL

### Open Questions
- AWAITING USER: GHL tag cleanup decisions — 163 tags in 10 groups presented for review
- How to handle `goods-*` pipeline tags (15 tags) — keep all? simplify?
- `linkedin-nic` vs `linkedin-ben` — merge to `linkedin` or keep attribution?

### Workflow State
pattern: feature-build
phase: 3
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "Cross-system contact network with unified tags"
- resource_allocation: aggressive

#### Unknowns
- GHL tag taxonomy: AWAITING USER REVIEW
- Notion workspace contact pages: not yet searched

#### Last Failure
- Browse QA: cookie import failed (browse server closed during picker UI)

---

## Context

### GHL Tag Audit (163 tags)
Full audit printed to user. Key groups:
- **Project**: justicehub (891), contained (216), goods (145), harvest (5-89), empathy ledger (2896)
- **Engagement**: active (11), responsive (142), dormant (97), prospect (19), ai-flagged (151), needs-attention (143)
- **Role**: storyteller (2896), elder (186), partner (43), funder (31), community (141), government (58)
- **Goods pipeline**: 15 tags (goods-newsletter 145 down to goods-supplier 1)
- **Channel**: linkedin (333+), newsletter, website-signup, forms
- **Sector**: education (56), indigenous (39), technology (228), regenerative (12)
- **Geo**: state-* tags, international countries
- **Events**: eoi-gathering-march-2026 (54), world-tour (34)
- **Junk**: test/webhook-test/test-delete-me etc

### Key Files
- `apps/web/src/lib/services/tag-sync-service.ts` — tag normalization + sync
- `apps/web/src/lib/ghl.ts` — GHL API wrapper (now with custom fields)
- `apps/web/src/lib/services/org-dashboard-service.ts` — enriched getOrgContacts
- `apps/web/src/app/org/[slug]/contacts/contacts-client.tsx` — contacts UI
- `scripts/sync-contact-tags.mjs` — batch tag sync
- `scripts/backfill-ghl-civicgraph-links.mjs` — backfill CivicGraph URLs to GHL
- `scripts/migrations/add-unified-tags.sql` — unified_tags column

### GHL Custom Field
- Name: "CivicGraph Profile"
- ID: `sGf7MWeuQTUuQIYp4VpS`
- Key: `contact.civicgraph_profile`
- Type: TEXT (stores full URL)
