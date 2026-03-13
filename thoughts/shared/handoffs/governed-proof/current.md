---
date: 2026-03-12T07:15:00Z
session_name: governed-proof
branch: codex/fix-trust-consistency
status: active
---

# Work Stream: governed-proof

## Ledger
**Updated:** 2026-03-12T07:15:00Z
**Goal:** Keep GrantScope, JusticeHub, and Empathy Ledger aligned as one governed-proof system without parallel builders drifting contracts, schema, routes, or local dev workflow.
**Branch:** `codex/fix-trust-consistency`
**Primary GrantScope test:** `cd /Users/benknight/Code/grantscope/apps/web && npx tsc --noEmit`

### Start Here
- Read [NEXT_BUILDER_BRIEF_GOVERNED_PROOF.md](/Users/benknight/Code/empathy-ledger-v2/docs/13-platform/NEXT_BUILDER_BRIEF_GOVERNED_PROOF.md) first.
- Use [CROSS_SYSTEM_GOVERNED_PROOF_BUILDER_HANDOFF.md](/Users/benknight/Code/empathy-ledger-v2/docs/13-platform/CROSS_SYSTEM_GOVERNED_PROOF_BUILDER_HANDOFF.md) for deeper context.
- Treat this file as the GrantScope-local front door for the same protocol.

### Product Shape
- `GrantScope` = public front door and shared app shell
- `JusticeHub` = internal governed-proof workbench
- `Empathy Ledger` = governed voice source

Do not merge these responsibilities casually.

### Canonical Local Dev
- GrantScope: `cd /Users/benknight/Code/grantscope/apps/web && npm run dev`
- JusticeHub: `cd /Users/benknight/Code/JusticeHub && npm run dev`
- Empathy Ledger: `cd /Users/benknight/Code/empathy-ledger-v2 && npm run dev`

Ports:
- GrantScope: `http://localhost:3003`
- JusticeHub: `http://localhost:3004`
- Empathy Ledger: `http://localhost:3030`

Important:
- GrantScope `npm run dev` is Turbopack and is the canonical local path.
- GrantScope `npm run dev:webpack` is fallback-only for explicit shell debugging.
- Public proof pages in GrantScope run inside the shared shell, so layout, nav, auth/session, and dev-runtime changes are shared-shell changes.

### Canonical Smoke Path
Public flow:
1. `http://localhost:3003/for/funders`
2. `http://localhost:3003/for/funders/proof/4825`
3. `http://localhost:3003/for/funders/proof/4825/system`
4. `http://localhost:3003/places/4825`
5. `http://localhost:3003/entities/AU-ABN-96130300355`

Internal flow:
1. `http://localhost:3004/admin/governed-proof`
2. `http://localhost:3004/admin/governed-proof/4825/brief`

### Repo Ownership
GrantScope owns:
- public proof presentation
- place/entity public handoffs
- capital and allocation context
- shared app shell on `3003`
- shared GS + JH migration lane

JusticeHub owns:
- bundle assembly
- review and repair
- internal briefing
- promotion decisions
- evidence/intervention contribution

Empathy Ledger owns:
- consent
- publishability
- story governance
- storyteller/story/media layer
- governed voice contribution

### Non-Negotiable Rules
1. Do not change shared bundle shape casually.
2. Do not add shared DB columns from multiple repos at once.
3. If a migration touches the shared governed-proof control plane, one builder owns it and everyone else waits.
4. Until a shared package exists, treat `/Users/benknight/Code/empathy-ledger-v2/src/lib/governed-proof/contracts.ts` as the canonical contract file and mirror the same change into:
   - `/Users/benknight/Code/JusticeHub/src/lib/governed-proof/contracts.ts`
   - `/Users/benknight/Code/grantscope/apps/web/src/lib/governed-proof/contracts.ts`
5. Do not treat GrantScope as the source of truth for consent or voice governance.
6. Do not treat JusticeHub as the source of truth for capital or place identity.
7. Do not publish weak or candidate bundles directly.

### Immediate Next Actions
1. Increase proof density for real places, starting with weaker bundles like `2770`.
2. Tighten review and promotion workflow before adding more public surfaces.
3. Improve public proof usefulness with stronger decision-safe evidence, not decorative UI.
4. Keep GrantScope shell/auth/runtime stable while governed-proof public routes evolve.

### Current Local Reality
- GrantScope local dev is running on `3003`
- JusticeHub local dev is running on `3004`
- Empathy Ledger is not assumed running unless manually started on `3030`
- GrantScope webpack dev breakage is a known non-canonical path; prefer Turbopack

### Resume Context
- If you are starting in GrantScope, do not invent a separate governed-proof workflow here.
- Follow the cross-system protocol above, validate `4825`, then work in the repo that owns the next change.
