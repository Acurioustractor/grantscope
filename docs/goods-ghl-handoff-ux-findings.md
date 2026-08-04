# Goods workspace — CivicGraph → GHL handoff UX findings

Pass 1: 2026-08-04. Lens: "from any discovery row, can I reach the GHL record in one click, and does GHL state read back honestly?" Audited in code + live route check (dev on 3013): foundations/scan, buyers, community push-to-GHL button, grants, channels.

## Findings (ranked)

### G1 — No deep link into GHL anywhere in the app. **S effort, highest value.**
- Verified: zero `href` to `app.gohighlevel.com` in `apps/web/src`. We store `ghl_contact_id` and `ghl_opportunity_id` on the goods tables and have `GHL_LOCATION_ID` in env, but every "✓ In GHL", "GHL linked", "synced from GHL" badge is dead text.
- This is dead-end disease on the exact handoff the three-pipeline architecture depends on: GHL is the system of record, but the UI gives no door into it.
- Fix: badge → `<a href="https://app.gohighlevel.com/v2/location/{GHL_LOCATION_ID}/contacts/detail/{contactId}" target="_blank">`. Contact detail links are reliable; opportunity deep links are flaky, so link the contact.
- Surfaces: buyers page chip (`buyers/page.tsx:77-83`), scan page rows (`foundations/scan/page.tsx` — has `ghlEmail` but no id/link), push button linked state (`push-to-ghl-button.tsx:67-87`).

### G2 — Push success state is also a dead end. **S.**
- After "✓ Pushed to GHL" the component holds `contactId` in state and renders only a label. The natural next act — open the record, set the next action — requires manually finding the contact in GHL.

### G3 — "No GHL signal" on buyers shows a state, not an action. **S/M.**
- The chip diagnoses the gap but offers no push button on that surface (push lives only on the community dossier). The row should carry the fix.

### G4 — Funder Scan "unpushed" queue has no in-UI push. **M.**
- The `?view=unpushed` filter is the push-next queue, but pushing a foundation still requires `seed-goods-grants-ghl.mjs` / manual GHL work. The queue points at work the UI can't do.

### G5 — Grants Triage and Channels have zero GHL presence. **M.**
- A live grant round you decide to pursue has no route into the GHL applications/grants pipeline from the UI; channel prospects likewise. `grep -c ghl` = 0 on both pages. Acceptable for channels (early), a real leak for grants once a round goes "pursuing".

### G6 — Warmth read-back only exists on the scan page. **M.**
- Buyers/communities show GHL linkage but not warmth; the "GHL is authoritative" story is told once, on one page, rather than wherever a relationship is shown.

## Decisions for Ben
1. G1/G2 link target: contact detail (recommended) vs opportunity list?
2. G3/G4: bring push-to-GHL onto buyers rows and funder-scan rows, or keep push deliberate (dossier-only) to avoid casual pushes?
3. G5: does a grants→GHL push belong now (pre PR #106 merge) or after?

## Fix log
- 2026-08-04: **G1+G2 fixed** (commit 4927373). New `lib/ghl-links.ts` helper; scan warmth chips, buyers "Open in GHL ↗" chips, and push-button done/linked states all deep-link to the GHL contact detail. Verified live on 3013: real `app.gohighlevel.com/v2/location/…/contacts/detail/…` hrefs render on both pages. Ben's calls: contact-detail target, push stays dossier-only, grants→GHL after PR #106.
- Discovered during fix: `PushToGhlButton` is currently imported by NOTHING — the community dossier lost its wiring at some point. The component is updated and ready, but the dossier needs it re-wired (new finding, G7).
