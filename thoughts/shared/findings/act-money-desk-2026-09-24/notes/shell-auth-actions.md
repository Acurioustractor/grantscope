# shell-auth-actions — how a /org/[slug] page is authenticated, resolved, mutated, read and tested

Reader: shell-auth-actions. Repo `/Users/benknight/Code/grantscope`, read at `main` = `1b517ba0`, 2026-09-24.
Read-only pass. Every file:line below was read, every SQL was run with `node --env-file=.env scripts/gsql.mjs`.
Confidence tags: **[verified]** = read the file / ran the query; **[inferred]** = derived from what was read; **[unverified]** = not checked.

---

## 0. Judgement, in one screen

1. **There is no per-org membership check on /org/[slug] page reads.** Middleware only proves "a session exists" (in prod, `getUser()`; in dev, "an sb- cookie exists" or `SKIP_AUTH_LOCAL=1`). `org/[slug]/layout.tsx` then resolves the slug and renders. Any signed-in CivicGraph user can read `/org/act/desk`. Three pages add their own `isAdminEmail` gate (`/grants`, `/goods/money`, `/research`). Membership is only checked on **writes**, and only on the API-route pattern. [verified]
2. **Two mutation patterns coexist, with different auth.** API routes under `/api/org/[orgProfileId]/*` use `requireOrgWriteAccess(orgProfileId)` (owner/admin/editor of THAT org, or super-admin). Colocated `'use server'` `actions.ts` files under `/org/[slug]/goods/*` use `requireWriteAccess()` (super-admin email only, bypassed entirely when `NODE_ENV !== 'production'`). The first is org-scoped and testable by policy test; the second is ACT-only by construction. [verified]
3. **The org-membership resolver returns ONE org per user, not "is this user in this org".** `getCurrentOrgProfileContext` picks the owned profile, else the most recent membership. A user who owns `act` and is a member of `picc` (user `079d5f62…` is both, see §1.7) gets 403 on `/api/org/<picc-id>/…`. Super-admins bypass it, which is why it has never bitten. [verified code, inferred consequence]
4. **Reads everywhere in /org and lib/services/act-\* use the live service-role client** (`getServiceSupabase` from `@/lib/supabase`). The snapshot trap only lives in `@/lib/report-supabase`; nothing under `/org` imports it. `getReportSnapshotSupabase()` is an empty-result Proxy, not a replica: importing the wrong module gives `[]` with no error. [verified]
5. **`act-one-desk.ts` and `act-project-grants-triage.ts` have no caching of their own and no tests.** Per-request dedupe comes from React `cache()` on some upstream loaders (`getOrgProfileBySlug`, `getActRelationshipLedger`, `getGoodsCapitalWorkspace`). The triage reads `grant_opportunities` filtered by `aligned_projects && ACT codes`, which is **68 of 3,169 live rows** today. [verified]
6. **The desk's write tables are empty in production**: `act_obligations` 0, `daily_action` events 0, `decision_outcome` events 0. The mutation plumbing exists and is tested by policy, but has never been exercised against the live DB. [verified by SQL]
7. **Two visual token sets inside /org/act**: `/desk` is Quiet Ledger (`ql-*`, `.ws.act-workspace`), `/grants` is Bauhaus (`bauhaus-*`). Both sit inside the same `ActWorkspaceShell` rail. The design-alignment memory already flags this. [verified]

---

## 1. Authentication chain, request to page

### 1.1 The cookie and the libs [verified]

- Auth library: `@supabase/ssr ^0.8.0` on `@supabase/supabase-js ^2.49.1`, Next `^15.1.0` (`apps/web/package.json`).
- Browser client: `apps/web/src/lib/supabase-browser.ts:4-9` `createSupabaseBrowser()` → `createBrowserClient(getSupabaseUrl(), getSupabasePublicKey())`.
- Server (cookie-bound) client: `apps/web/src/lib/supabase-server.ts:20-48` `createSupabaseServer()` → `createServerClient(url, publicKey, { cookies: { getAll, setAll } })` over `next/headers` `cookies()`. `setAll` swallows the throw when called from a Server Component (`:36-44`).
- Env resolution: `apps/web/src/lib/supabase-env.ts` — URL from `NEXT_PUBLIC_SUPABASE_URL || SUPABASE_URL` (`:1-3`); public key prefers `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` then `SUPABASE_PUBLISHABLE_KEY` then the two ANON names (`:5-13`); secret key `SUPABASE_SECRET_KEY || SUPABASE_SERVICE_ROLE_KEY` (`:15-20`).
- Sign-in: `apps/web/src/app/login/page.tsx:23-27` `signInWithOAuth` (Google) and `:50-51` `signInWithPassword`, both on the browser client. OAuth PKCE code is exchanged server-side in `apps/web/src/app/auth/callback/route.ts:24-29` (`exchangeCodeForSession`), which is what lands the session in cookies.
- Cookie name shape the middleware looks for: `/^sb-.+-auth-token(?:\.\d+)?$/` or a name containing `supabase-auth-token` (`apps/web/src/middleware.ts:5-13`).

### 1.2 Middleware [verified] — `apps/web/src/middleware.ts`

| line | what |
|---|---|
| 29-36 | 308 redirect of bare `grantscope.vercel.app` host to `civicgraph.app` |
| 40-44 | sets `x-pathname` and `x-search` request headers for the root layout |
| 50-52 | **`SKIP_AUTH_LOCAL=1` lets everything through, hard-guarded by `NODE_ENV !== 'production'`** |
| 57-66 | protected prefixes: `/home`, `/tracker`, `/foundations/tracker`, `/foundations/backlog`, `/ops`, `/profile`, **`/org`** |
| 72-78 | `fastCookieAuth` = `NODE_ENV !== 'production' || NEXT_PUBLIC_FAST_LOCAL_AUTH === '1' || FAST_LOCAL_AUTH === '1'`; when true, `isAuthed = hasAuthCookie` (no network) |
| 80-109 | when NOT fast: builds an `@supabase/ssr` server client from request cookies and calls `supabase.auth.getUser()`; `isAuthed = Boolean(data.user)` |
| 112-117 | unauthenticated on a protected prefix → redirect `/login?next=<pathname>` |
| 120-127 | authed on `/login` → redirect to sanitised `next`/`redirect` (`safeRedirectPath` `:15-19` refuses non-`/` and `//`) |
| 132-138 | matcher: everything except `_next/static`, `_next/image`, favicon and static asset extensions |

Judgement: the middleware is a **session gate, not an authorisation gate**. It never reads the slug, never touches `org_profiles` or `org_members`. Whether production runs strict (`getUser`) or the cookie fast-path depends on the deployed values of `FAST_LOCAL_AUTH` / `NEXT_PUBLIC_FAST_LOCAL_AUTH`, which I did not check (`/config-truth` territory). [unverified: prod env]

### 1.3 Root layout: /org/act is chromeless [verified]

- `apps/web/src/lib/public-frame.ts:16-24`: `SIGNED_IN_PREFIXES`, `OWN_FRAME_PREFIXES`, and `ACT_WORKSPACE_PREFIXES = ['/org/act', '/org/a-curious-tractor', '/org/curious-tractor']`; `isChromelessPath()` at `:32-34`.
- `apps/web/src/app/layout.tsx:86-105`: reads `x-pathname`, and if `isChromelessPath` returns bare `<html><body>{children}` — no NavBar, no footer, no user lookup. `LAYOUT_AUTH_PREFIXES` at `:53-63` includes `/org` for the non-ACT branch (tier lookup etc.).
- `apps/web/src/app/globals.css:237-270`: `.ws`, `.ws.act-workspace`, `.act-workspace` overrides (the ACT workspace re-skins Tailwind greys to `--ws-*` vars).

### 1.4 `/org/[slug]/layout.tsx` [verified] — `apps/web/src/app/org/[slug]/layout.tsx`

```
12-26  generateMetadata: isActSlug → ACT_FAST_PROFILE name; else getOrgProfileBySlug
35-54  ACT branch: storedProfile = ACT_E2E_FIXTURES==='1' ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug)
       projects = ACT_E2E_FIXTURES==='1' ? ACT_E2E_PROJECTS : storedProfile ? await getOrgProjectSummaries(storedProfile.id) : []
       renders <div class="ws act-workspace"><ActWorkspaceShell slug projects>{children}</ActWorkspaceShell><ActTestGuide/></div>
56-57  non-ACT: profile = await getOrgProfileBySlug(slug); if (!profile) notFound()
61-66  admin banner ONLY when SHOW_SUPER_ADMIN_BANNER==='1' (avoids a getUser() network hop per click)
69-70  reads cg_impersonate_org cookie to suppress the banner
```

**No `getUser()`, no `org_members`, no `isAdminEmail` on the ACT branch.** The comment at `:59-60` says why: navigation speed. The ACT branch does not even `notFound()` when the profile is missing; it renders the shell with an empty project list.

### 1.5 Per-page gates that DO exist [verified]

| page | gate | lines |
|---|---|---|
| `apps/web/src/app/org/[slug]/grants/page.tsx` | `isActSlug` else `notFound()`; then unless `NODE_ENV!=='production' && SKIP_AUTH_LOCAL==='1'`: `createSupabaseServer().auth.getUser()` and `isAdminEmail(user.email)` else `notFound()` | 61-72 |
| `apps/web/src/app/org/[slug]/goods/money/page.tsx` | `getUser()`, non-admin → `redirect(/org/${slug}/goods/engagement)` | 60-63 |
| `apps/web/src/app/org/[slug]/research/page.tsx` | `getUser()` + `isAdminEmail` decides `reviewer` mode (soft gate) | 28-34 |
| `apps/web/src/app/org/page.tsx` (index) | `getUser()` else `redirect('/login?next=/org')`; non-admins redirected to their owned org (`org_profiles.user_id`) or first membership (`org_members`) | 18-57 |

The `grants/page.tsx:63-66` comment is the clearest statement of the model: *"Middleware only checks for a session and signup is open, so this page checks who is looking."*

### 1.6 The org-membership model [verified]

- Super-admin list: `apps/web/src/lib/admin.ts:5-15` — four emails (`benjamin@act.place`, `ben@benjamink.com.au`, `hello@civicgraph.au`, `accounts@act.place`), `isAdminEmail()`.
- Ownership: `org_profiles.user_id` (one owner per profile).
- Membership: `org_members(org_profile_id, user_id, role, invited_by, invited_at, accepted_at, created_at, invited_email)` — columns verified via information_schema (§1.7).
- Resolver: `apps/web/src/lib/org-profile.ts:57-128` `getCurrentOrgProfileContext(serviceDb, userId)`:
  1. `cg_impersonate_org` cookie → that org, role `admin`, `isImpersonating: true` (`:61-79`)
  2. owned profile by `user_id` → role `admin` (`:81-94`)
  3. else **one** `org_members` row, latest `accepted_at`/`created_at`, `.limit(1)` (`:96-127`)
- API guard: `apps/web/src/app/api/org/_lib/auth.ts`
  - `requireOrgAccess(orgProfileId)` `:25-58`: `getUser()` else 401; `isAdminEmail` → role `admin` for any org; else `ctx.orgProfileId !== orgProfileId` → 403; returns `{ userId, orgProfileId, role, serviceDb }`.
  - `requireOrgWriteAccess(orgProfileId)` `:60-69`: above, then `isOrgWriteRole(role)` where `ORG_WRITE_ROLES = {'admin','editor'}` (`:14-18`) else 403 "Editor access is required".
  - Note the returned `serviceDb` is the **service-role** client; RLS is bypassed and scoping is done by `.eq('org_profile_id', orgProfileId)` in every query. Policy tests exist for this (§6).
- Server-action guard: `apps/web/src/lib/services/goods-write-guard.ts:18-25` `requireWriteAccess()`: **returns `null` (allow) whenever `shouldUseFastLocalOrg()`**, i.e. `NODE_ENV !== 'production'` (`fast-local-org.ts:25-27`); in prod, `getUser()` then `isAdminEmail` else `{ ok:false, error }`. Not org-scoped at all.
- Tier/module guard (used by `/api/goods/grants/push-ghl`): `apps/web/src/lib/api-auth.ts:43-95` `requireAuth` → `requireModule(module)` on `org_profiles.subscription_plan` via `resolveSubscriptionTier`.
- Dev bypass helper `apps/web/src/lib/admin-auth-bypass.ts` (guarded by `tests/admin-auth-bypass.test.ts`) is imported by `components/shell/shell.tsx`, `lib/admin-auth.ts` and one clarity route — **not by anything under /org**. [verified by grep]

### 1.7 Live DB facts [verified by SQL]

```sql
SELECT table_name, column_name, data_type FROM information_schema.columns
WHERE table_name IN ('org_members','org_profiles','act_obligations') ORDER BY table_name, ordinal_position
-- 61 rows; org_profiles has slug, user_id, additional_abns (ARRAY), acn, subscription_plan, org_status …
```

```sql
SELECT id, user_id, slug, name, subscription_plan, abn, additional_abns, acn, org_status
FROM org_profiles WHERE slug IN ('act','justicehub') OR name ILIKE '%curious tractor%'
```
| id | user_id | slug | plan | abn | additional_abns | acn | org_status |
|---|---|---|---|---|---|---|---|
| `8b6160a1-7eea-4bd2-8404-71c196381de0` | `079d5f62-4502-4129-bcda-0e61a914b26d` | act | enterprise | 21591780066 | {73669029341} | 697347676 | incorporated |
| `f3783794-1589-4ecd-b25f-ec039d2291ea` | `4d45101e-8f42-44d4-a072-04376c710e70` | justicehub | enterprise | | | | exploring |

```sql
SELECT m.role, m.user_id, m.invited_email, m.accepted_at IS NOT NULL AS accepted, p.slug
FROM org_members m JOIN org_profiles p ON p.id = m.org_profile_id ORDER BY p.slug, m.role
```
5 rows: act/admin (`079d5f62…`), justicehub/admin (`4d45101e…`), picc/admin ×2 (`272f1ad1…`, `079d5f62…`), one admin on a profile with NULL slug (`c88d0030…`). All accepted. `org_profiles` = 4, `org_members` = 5.

```sql
SELECT (SELECT count(*) FROM act_obligations) AS act_obligations,
       (SELECT count(*) FROM act_obligations WHERE state='open') AS open_obligations,
       (SELECT count(*) FROM opportunity_context_events WHERE signal_kind='daily_action') AS daily_action_events,
       (SELECT count(*) FROM opportunity_context_events WHERE signal_kind='decision_outcome') AS decision_outcomes,
       (SELECT count(*) FROM opportunity_decisions) AS opportunity_decisions
-- 0 | 0 | 0 | 0 | 7
```

```sql
SELECT signal_kind, source_type, count(*) FROM opportunity_context_events
WHERE org_profile_id = '8b6160a1-7eea-4bd2-8404-71c196381de0' GROUP BY 1,2 ORDER BY 3 DESC
-- 137 rows total: email_context/message 94, knowledge_context/page 15, open_opportunity/official_program 6, … (no daily_action, no relationship_follow_up, no decision_outcome)
```

```sql
SELECT (SELECT count(*) FROM org_pipeline WHERE org_profile_id='8b6160a1-…') AS act_pipeline,
       (SELECT count(*) FROM org_projects WHERE org_profile_id='8b6160a1-…') AS act_projects,
       (SELECT count(*) FROM org_projects WHERE org_profile_id='8b6160a1-…' AND status='active') AS act_active_projects,
       (SELECT count(*) FROM opportunity_decisions WHERE org_profile_id='8b6160a1-…') AS act_decisions
-- 112 | 14 | 14 | 3
```

RLS on the mutation tables (`pg_class.relrowsecurity` + `pg_policies` count):
`act_obligations` rls=true/0 policies · `act_private_grant_rounds` true/0 · `goods_relationships` true/0 · `grant_opportunities` true/1 · `opportunity_context_events` true/1 · `opportunity_decisions` true/2 · `org_members` true/3 · `org_pipeline` true/5 · `org_profiles` true/1 · `org_projects` true/4.
Reading: tables with rls=true and 0 policies are **service-role only** — every app write to them goes through the service client, which is why the app-side guards above are the only guard.

---

## 2. Slug → org: `getOrgProfileBySlug` and the fixture guard [verified]

`apps/web/src/lib/services/org-dashboard-service.ts:520-544`:
```ts
export const getOrgProfileBySlug = cache(async function getOrgProfileBySlug(slug: string): Promise<OrgProfile | null> {
  if (process.env.ACT_E2E_FIXTURES === '1' && isActSlug(slug)) return ACT_FAST_PROFILE;   // :524-526
  const supabase = getServiceSupabase();                                                    // :527
  const slugAliases = { 'a-curious-tractor': 'act', 'curious-tractor': 'act' };            // :528-531
  … .from('org_profiles').select('id, name, abn, additional_abns, acn, slug, linked_gs_entity_id, description, team_size, annual_revenue, org_type, subscription_plan, logo_url, updated_at').eq('slug', lookupSlug).maybeSingle()
  if (error || !data) return null;                                                          // :538
```
- Wrapped in React `cache()` (`:1` import) → one DB hit per request no matter how many callers.
- `OrgProfile` type at `:88-106` (`additional_abns: string[]`, `acn`, `slug: string | null`…); `orgAbns()` at `:114-119` is the helper for ABN-union lookups.
- `isActSlug` at `apps/web/src/lib/services/fast-local-org.ts:21-23` accepts `act`, `a-curious-tractor`, `curious-tractor`.
- `ACT_FAST_PROFILE` at `fast-local-org.ts:4-19`: `id: 'act-fast-local'`, ABN `21591780066`, `additional_abns: ['73669029341']`, `acn '697347676'`, plan `enterprise`.
- `shouldUseFastLocalOrg(fullParam?)` at `fast-local-org.ts:25-27` = `NODE_ENV !== 'production' && fullParam !== '1'` (a **different** switch from `ACT_E2E_FIXTURES`; used by `goods/foundations/page.tsx:40` and the write guard).
- Fixture flag census (`grep -rc ACT_E2E_FIXTURES`): `org/[slug]/layout.tsx` ×2, `org/[slug]/page.tsx:111`, `org/[slug]/goods/page.tsx:81` (only toggles a field map), `lib/services/act-atlas.ts:445`, `org-dashboard-service.ts:524`. The memory rule "guard lives inside getOrgProfileBySlug, never per-page" is mostly honoured; the layout and root page still branch on it to swap in `ACT_E2E_PROJECTS` etc. from `apps/web/src/lib/services/act-e2e-fixtures.ts:12-36`.
- Playwright sets both flags: `apps/web/playwright.config.ts:24-28` `SKIP_AUTH_LOCAL: '1', ACT_E2E_FIXTURES: '1'`, webServer on `:3013`.
- `getOrgProjectSummaries(orgProfileId)` `:394-430`: `getOrgProjects` (`org_projects`, `:372-375`) then three `exec_sql` counts over `org_programs`, `org_pipeline`, `org_contacts`; React-cached; feeds the rail's "Jump to a project".

---

## 3. Mutations from /org pages — the three patterns actually in use

Census: `'use server'` files under `/org` = 4 (`goods/capital|engagement|foundations|matters/actions.ts`); org-scoped API routes = 20 dirs under `apps/web/src/app/api/org/[orgProfileId]/`. [verified by find/grep]

### 3.1 Pattern A — API route + client `fetch` + `router.refresh()` (org-scoped, the majority)

**Example A1: daily actions** (what the One Desk "Done → next" button calls)
- Route: `apps/web/src/app/api/org/[orgProfileId]/daily-actions/route.ts`
  - `:1-2` imports `NextRequest, NextResponse` and `requireOrgAccess, requireOrgWriteAccess, type OrgAuthResult` from `'../../_lib/auth'`
  - `:13` `type Params = { params: Promise<{ orgProfileId: string }> }` (Next 15 async params)
  - `:68-73` `GET`: `requireOrgAccess`; returns `{ day, states }`
  - `:75-89` `POST`: `requireOrgWriteAccess`; `if (auth instanceof NextResponse) return auth;` body parsed as `Record<string, unknown>`, fields hand-validated with `typeof … === 'string' ? .trim().slice(0, N) : ''`, status via `isActDailyActionStatus`; 400 with a plain sentence
  - `:109-128` upsert into `opportunity_context_events` keyed `onConflict: 'org_profile_id,source_system,source_ref,signal_kind'`, `source_ref = dailyActionSourceRef(actionId, day)` (Perth day)
  - `:185-206` `DELETE` with the same guard
  - No `revalidatePath` here; the page is `force-dynamic` and the client calls `router.refresh()`
- Client: `apps/web/src/app/org/[slug]/desk/desk-mark-buttons.tsx` (51 lines, `'use client'`): `fetch(`/api/org/${orgProfileId}/daily-actions`, { method:'POST', … })`, throws on `!res.ok` with the JSON `error`, then `router.refresh()` (`:18-34`).
- Server page wiring: `apps/web/src/app/org/[slug]/desk/page.tsx:203-212` passes `orgProfileId` (from `getOneDesk`) + record id/title/next into the button; renders it only when `orgProfileId` is non-null.

**Example A2: obligations** — `apps/web/src/app/api/org/[orgProfileId]/obligations/route.ts`
- `:8-15` tiny validators `text(v, limit)` and `isoDate(v)`; `:6` `OWED_TO = ['funder','community'] as const`
- `:19-53` `POST` mints into `act_obligations` with `minted_by: auth.userId`
- `:58-116` `PATCH`: reads the existing row scoped by `org_profile_id` (`:67-74`), enforces terminal states (`:79-81`), requires `drop_reason` for community-owed (`:87-89`), patches allow-listed keys with per-key limits (`:97-100`)
- Client: `desk/desk-obligation-buttons.tsx:35-41` `PATCH` with `window.prompt` for the reason.

**Example A3: pipeline** — `apps/web/src/app/api/org/[orgProfileId]/pipeline/route.ts`
- `:26-40` `POST` is the loosest write in the set: `insert({ ...body, org_profile_id })` with **no field allow-list** (body spread straight in)
- `:42-148` `PATCH`: typed body, `isActPipelineStatus`, `pipelineStatusRequiresReason` (`:65-73`), then side-writes a learning row into `opportunity_decisions` (`:105-141`), returns `learning_memory_recorded`/`_warning`
- Client: `apps/web/src/app/org/[slug]/_components/act-pipeline-status-control.tsx` (not read in full; listed in the client census)

**Example A4: relationship follow-ups** — `apps/web/src/app/api/org/[orgProfileId]/relationship-follow-ups/route.ts:52,84` calls **`revalidatePath('/org/act')`** with the slug hard-coded (also `relationship-contributions/route.ts:88,142`). Works only because there is one ACT org.

**Example A5: people (GHL-first)** — `apps/web/src/app/api/org/[orgProfileId]/people/route.ts:28-60`: validates, writes to GHL (`createPersonContact`, `setWarmthTag`, `upsertNextActionTask`) **before** mirroring to `act_people`; errors surface. Client hook `usePatch` in `org/[slug]/people/people-actions.tsx:38-50`.

### 3.2 Pattern B — colocated `'use server'` `actions.ts` + `requireWriteAccess()` + `revalidatePath` (Goods only, super-admin only)

**Example B1: track a foundation** — `apps/web/src/app/org/[slug]/goods/foundations/actions.ts`
```ts
'use server';                                                              // :1
import { revalidatePath } from 'next/cache';                               // :3
import { getServiceSupabase } from '@/lib/supabase';                       // :4
import { requireWriteAccess, type ActionResult } from '@/lib/services/goods-write-guard'; // :5
export async function trackFoundationTarget(input: { slug; gsEntityId; name; … }): Promise<ActionResult> {  // :15-22
  const denied = await requireWriteAccess(); if (denied) return denied;    // :23-24
  … validation returns { ok:false, error } …                               // :26-28
  const { error } = await supabase.from('goods_relationships').insert({…}) // :39-51
  if (error) return { ok:false, error: friendly-or-raw };                  // :53-60
  revalidatePath(`/org/${input.slug}/goods/foundations`); revalidatePath(`/org/${input.slug}/goods/engagement`); // :63-64
  return { ok: true };                                                     // :65
}
```
- Caller: `goods/foundations/track-button.tsx` (`'use client'`, 59 lines): `useTransition()` + direct import of the action (`:3-4`, `:30-44`), shows `Tracked ✓` locally and lets the revalidated page drop the row.
- Page: `goods/foundations/page.tsx:3-8,40-41` (server) resolves the profile with `shouldUseFastLocalOrg() && isActSlug(slug) ? ACT_FAST_PROFILE : await getOrgProfileBySlug(slug)` and renders `<TrackButton slug=… />` at `:172`.

**Example B2: capital routes** — `goods/capital/actions.ts`: `UUID` regex (`:7`), allow-listed state sets (`:8-12`), `text()`/`nonNegative()` (`:14-22`), a shared `revalidateGoods(slug, routeCode)` fan-out over seven paths (`:24-32`), three actions (`saveFundingRouteFacts :34-74`, `saveRouteAllocation :76-107` upsert `onConflict: 'route_id,capital_block_id'`, `saveCommitmentEvidence :109-146` with evidence-form rules).

**Example B3: matter review** — `goods/matters/actions.ts`: the one action that also fetches the user itself (`createSupabaseServer().auth.getUser()` `:74-76`) because it needs `user.id` for the `record_opportunity_review` RPC (`:96-109`); returns `{ ok, error?, nextStep? }` and revalidates five paths (`:116-120`).

**Example B4: engagement** — `goods/engagement/actions.ts:22-81` `updateRelationship` builds a sparse patch only from keys that were passed (`!== undefined`), recomputes `warmth_computed` if stage moved, revalidates one path.

### 3.3 Pattern C — outlier: `/api/goods/grants/push-ghl` [verified]
`apps/web/src/app/api/goods/grants/push-ghl/route.ts:9-10` uses `requireModule('tracker')` (tier gate, not org gate), idempotent on `grant_opportunities.ghl_opportunity_id` (`:19-27`), then writes back (`:45-48`). Anyone with tracker tier can push a Goods grant to GHL.

### 3.4 Validation conventions (both patterns) [verified]
- No zod anywhere in these files; hand-rolled `text(v, limit)`, `isoDate`, `UUID` regex, `Set`/`as const` allow-lists, `typeof x === 'string'`.
- Errors are one plain sentence in `{ error }` (routes → 400/403/404/500; actions → `{ ok:false, error }`).
- Every route re-reads the target row **scoped by `org_profile_id`** before updating (`obligations:67-74`, `pipeline:78-87`, `daily-actions:50-56`).
- Pattern B actions are NOT org-scoped (no `org_profile_id` on `goods_relationships`, `goods_funding_routes`).

### 3.5 Revalidation [verified by grep]
- `revalidatePath`: only in the four Goods `actions.ts` and two API routes (`relationship-*`), the latter with `'/org/act'` hard-coded.
- `revalidateTag('act-funder-intelligence')`: `contact-resolution/route.ts:68`, `funder-intelligence/route.ts:87,201`. But `act-funder-intelligence.ts:1334-1353` has **moved off `unstable_cache` to an in-process TTL memo** (payload > 2MB), so that tag no longer invalidates anything; only `act-people-directory.ts:545-549` still declares `tags: ['act-people-directory']`.
- Desk pages are `export const dynamic = 'force-dynamic'` (`desk/page.tsx:12`, `grants/page.tsx:9`, `funding/page.tsx:8`, `org/[slug]/page.tsx:90`), so `router.refresh()` is enough and `revalidatePath` is belt-and-braces.

### 3.6 Which to use for a new /org/act mutation [judgement]
Pattern A (API route + `requireOrgWriteAccess`) is the one with a policy test (`tests/unit/api/org/route-access-policy.test.ts`), org scoping, and a working dev story once you are signed in. Pattern B is faster to write and works signed-out in dev, but is admin-only in prod, has no org scoping, and its `requireWriteAccess()` bypass is `NODE_ENV`-only (no `VERCEL` guard like `admin-auth-bypass` has). For anything that is "ACT's own record", either is defensible; for anything that could ever be another org's, A.

---

## 4. Which Supabase client reads use [verified]

`apps/web/src/lib/supabase.ts`:
- `:43-48` `getSupabase()` anon/public key, RLS enforced (client-side).
- `:177-186` `getServiceSupabase()` = `getDirectServiceSupabase()` = `createClient(url, getSupabaseSecretKey())` wrapped by `createRuntimeSupabaseClient` (`:122-146`), which blocks `exec`/`execute_sql`/`exec_agent_sql` (`:12`) and allows `exec_sql` only for single SELECT/WITH (`isReadOnlyExecSql :19-39`, error code `SQL_RPC_READONLY`).
- `:148-158` `getReportSnapshotSupabase()` is a **Proxy whose `from`/`rpc` always resolve `{ data:null, error:null, count:0 }`** — an empty client, not a replica. The long comment at `:160-176` explains the removed stack-sniffing.

`apps/web/src/lib/report-supabase.ts`:
- `:23-25` `liveReportsEnabled()` = `process.env.CIVICGRAPH_LIVE_REPORTS?.trim() === 'true'` (trim because prod stores `"true\n"`).
- `:27-33` its **own** `getServiceSupabase()` returns live only when the flag is on, else the empty snapshot proxy.
- `apps/web/src/lib/report-client-convention.test.ts:30-45` fails the build if anything under `app/reports` imports `getServiceSupabase` from `@/lib/supabase`; `:55-77` fails if anything reads `CIVICGRAPH_LIVE_REPORTS` directly.

For /org and the ACT services the picture is uniform: every `lib/services/act-*.ts`, `goods-*.ts`, `org-dashboard-service.ts` imports `getServiceSupabase` from `@/lib/supabase` (live, service role). Grep under `/org` for `getServiceSupabase`: 7 files (4 actions.ts, `goods/we-owe/page.tsx`, `intelligence/page.tsx`, `org/page.tsx`); nothing under `/org` imports `report-supabase`. **The trap for a new /org page is only reachable by importing a helper from `report-service.ts` that internally uses `@/lib/report-supabase`**; the memory rule (pass the caller's live `db`) stands. Also: `safe()` at `apps/web/src/lib/services/utils.ts:21-33` swallows errors to `null` with a `[report-service] <context> failed:` log line — `|| []` after it renders a confident zero.

---

## 5. How client components are kept small [verified]

- Census: 42 `'use client'` files under `apps/web/src/app/org/[slug]`; 27 outside `goods/`. Pages themselves are Server Components (`desk/page.tsx`, `grants/page.tsx`, `funding/page.tsx`, `goods/foundations/page.tsx`), fetch everything, filter/sort in the server function body, and hand **ids and strings** (never clients or big objects) to leaf client components.
- Leaf shapes in use: `DeskMarkButtons` (51 lines: `useState` ×2 + `useRouter` + one `fetch`), `DeskObligationButtons` (61), `TrackButton` (59: `useTransition` + server action), `PursueFundingForm` (54: `<form action={submit}>` to `/api/ops/funding/pursue`), `people-actions.tsx` (a `usePatch(orgProfileId)` hook wrapping `fetch PATCH`).
- The one big client file is the shell: `_components/act-workspace-shell.tsx` (460 lines, `usePathname`/`useSearchParams`, Phosphor icons). Nav is data: `workModes` at `:83-103` (One Desk, Orgs, People, Curiosity, Funding, Grants), `utilityLinks :104-117` (Atlas, Queries), `GOODS_RAIL_SECTIONS :333-338`, `DESK_LENSES :343-353`. **Adding a rail entry = one object literal in `workModes`.**
- Filters are URL state (`?kind=`, `?project=`, `?rec=`), rendered as `<Link>` chips server-side (`desk/page.tsx:59-77,117-124`), so no client state for filters.

---

## 6. How tests are written [verified]

- Runner: `apps/web/vitest.config.ts` — `environment: 'jsdom'`, `setupFiles: ['./tests/setup.ts']` (`@testing-library/jest-dom/vitest`), `include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}']`, alias `@ → ./src`. `pnpm test` = `vitest run`; `pnpm test:e2e` = `playwright test`.
- CI (`.github/workflows/*.yml`): `tsc --noEmit` (`:26`), `pnpm test` (`:40`), Playwright chromium (`:80-82`), migration parity + private-exposure + contradictions + linkage + completion receipts (`:112-141`). Local gate `scripts/precheck.sh` = tsc + vitest (+ `next build` when the diff touches package.json/lockfile/next.config/root layout/middleware).
- **lib/services tests are colocated `*.test.ts` over pure functions**, no DB, no mocks: `act-daily-actions.test.ts` (99 lines: `perthDayKey`, `dailyActionSourceRef`, `buildDecisionOutcomeMetadata`, `buildDailyActionMemory`), `act-grants-desk.test.ts` (`buildDesk(publicRows, privateRows, today)` is deliberately pure; the DB fetch is a separate `fetchLive` at `act-grants-desk.ts:128`), `act-grant-eligibility.test.ts`. 14 such files under `lib/services`, 30 under `lib`.
- **Route handlers are tested with `vi.mock` of the auth module and a dynamic import after the mocks**: `tests/unit/api/opportunity-intelligence/actions-route.test.ts:4-22` mocks `@/lib/api-auth` and `@/app/api/org/_lib/auth`, then `const { POST } = await import('@/app/api/…/route')`, builds a `new Request(...)` and asserts status codes (`:40-78`). `tests/unit/lib/api-auth.test.ts:5-22` mocks `@/lib/supabase-server` (`auth.getUser`) and `@/lib/supabase` (`from`) with chainable `vi.fn().mockReturnThis()` builders.
- **Policy tests read source text**: `tests/unit/api/org/route-access-policy.test.ts:5-38` lists ten route files and asserts every non-GET export contains `requireOrgWriteAccess(orgProfileId)` — **add a new `/api/org/[orgProfileId]/<x>/route.ts` to `ROUTES` here**; `tests/unit/api/org/auth.test.ts` checks `isOrgWriteRole`; `report-client-convention.test.ts` (§4); `tests/admin-auth-bypass.test.ts` guards the dev bypass with a `VERCEL=1` case (the Goods `requireWriteAccess` has no equivalent test).
- **Pages have no vitest**; the `app/**/*.test.ts` files (10) are all pure helpers under `/clarity` and `/reports/theme`. Page behaviour is covered by Playwright: `tests/e2e/act-field-desk.spec.ts` — `/org/act` lands on `/org/act/desk` (`:4-8`), walkthrough guide (`:10-31`), and mutations are **stubbed** with `page.route('**/api/org/act-fast-local/daily-actions', …)` (`:54-56`) because with `SKIP_AUTH_LOCAL=1` there is no session and `requireOrgWriteAccess` would 401.
- No test imports `act-one-desk` or `act-project-grants-triage` (grep over `*.test.ts*` and `*.spec.ts`: none).

---

## 7. `apps/web/src/lib/services/act-one-desk.ts` (248 lines, read in full) [verified]

Imports (`:5-15`): `getFunderScan` (goods-funder-scan), `getActRelationshipLedger`, `getOrgDailyActionStates` + `ActDailyActionStatus`, `getOrgProfileBySlug`, `getAllProjectsGrantsTriage`, `getGoodsBuyerPipeline`, `ghlContactUrl`, `actOrgHref`, `getGoodsCapitalWorkspace`, `getDeskObligations`, `getDeskPeople`. **No Supabase import of its own; no `unstable_cache`, no React `cache`.**

Public surface:
| export | line | in | out |
|---|---|---|---|
| `type DeskRecordKind` | 19 | | `'funder'\|'grant'\|'buyer'\|'money'\|'obligation'\|'person'` |
| `deskProjectLabel(code)` | 27-30 | project code or null | label via `PROJECT_LABELS` (`:21-25`: ACT-GD Goods, ACT-EL Empathy Ledger, ACT-JH JusticeHub, ACT-HV Harvest, ACT-FM Farm, ACT-CN Contained, ACT-PI Palm Island, ACT-MY ACT) |
| `type DeskRecord` | 32-59 | | `id, kind, project, name, signal, next, dueDays, score, amount, ghlUrl, workHref, isDecision?, owedTo?, obligationId?, via?, personId?, lastSyncedAt?` |
| `type DeskTarget` | 62-68 | | `label, needMinAud, needMaxAud, committedAud, askMadeAud` |
| `type DeskHorizon`, `deskHorizon(r)` | 70-77 | record | `'overdue'` (<0) / `'fortnight'` (≤14) / `'quarter'` (≤90) / `'undated'` (null or >90) |
| `type OneDeskPool` | 90-97 | | `{ active, handled: [{record,status}], orgProfileId, target }` |
| `getOneDesk(slug)` | 99-123 | slug | `Promise.all([getOneDeskPool(slug), getGoodsCapitalWorkspace()])`; `target` from capital summary; `profile = getOrgProfileBySlug(slug)`; `states = getOrgDailyActionStates(profile.id)` splits pool into `active` vs `handled` by `states[r.id]` |
| `getOneDeskPool(slug)` | 125-248 | slug | ranked `DeskRecord[]` (sort by `urgency` `:85-88`: dated → `dueDays` (overdue → `-1000+dueDays`); undated → `500 - score`) |

Pool composition (`:127-140` runs six loaders in `Promise.all`, each `.catch`-ed to null/[]):
- obligations `:146-163` → `id: o-<id>`, `kind:'obligation'`, undated pinned by `score = 200 - rank`, `workHref` only for ACT-GD (`/goods/we-owe`)
- people `:166-180` → `p-<id>`, project `'ACT'`, `workHref /people`
- money owed `:183-194` → `m-<key>` from `ledger.items` with outstanding invoices, `dueDays = -oldestOverdueDays`, `score = min(99, total/1000)`
- funders `:198-216` → `f-<id>` from `scan.rows` excluding `parked`/`declined`; not-in-GHL rows admitted only when `evidenceGrade === 'A'` (`:204`, the fit≥85 gate was retired); `isDecision = !inGhl`
- grant rounds `:222-236` → `g-<id>` from triage; `fitBar = 85 for goods else 40`; `decisionDue = daysToDeadline ≤ 30 || fitScore ≥ fitBar`; skipped when `!inGhl && !decisionDue`; `workHref` `/goods/grants` or `/grants`
- buyers `:237-246` → `b-<id>` from `buyers.rows` where `isOpen`

Consumers (`grep`): `org/[slug]/desk/page.tsx:8`, `org/[slug]/digest-preview/page.tsx:8` (`getOneDeskPool`), `org/[slug]/people/page.tsx:20` (`deskProjectLabel`), `lib/services/act-desk-digest.ts:8` (`getOneDesk`, driven by `api/cron/desk-digest/route.ts:23` with `CRON_SECRET` bearer, `:14-19`).

Judgement: record ids are the contract with the daily-actions store (`action_id` = `DeskRecord.id`, `source_thread_id` in `opportunity_context_events`). Renaming a prefix orphans today's handled states. `getOrgProfileBySlug` is called twice per request (`:111`, `:126`) and deduped by React `cache()`.

## 8. `apps/web/src/lib/services/act-project-grants-triage.ts` (78 lines, read in full) [verified]

- `:1` `import { getServiceSupabase } from '@/lib/supabase'` (live service client)
- `:9-16` `PROJECT_CODES` = goods ACT-GD, justicehub ACT-JH, empathy-ledger ACT-EL, harvest ACT-HV, farm ACT-FM, contained ACT-CN (six; no Palm Island / ACT-MY)
- `:18-31` `ProjectGrantRow { id: '<rowId>:<project>', rowId, project, code, name, provider, fitScore, deadline, daysToDeadline, amountMax, url, ghlOpportunityId }`
- `:37-78` `getAllProjectsGrantsTriage()`: no args; `grant_opportunities` `.select('id, name, provider, deadline, amount_max, url, status, ghl_opportunity_id, aligned_projects, goods_relevance_score, project_relevance').in('status', ['open','ongoing','upcoming']).overlaps('aligned_projects', codes).limit(3000)`; **throws** on error (`:45`, the desk catches to `[]`); drops rows with a past deadline (`:53`); fans out one row per aligned project; `fitScore` = `goods_relevance_score` for goods else `project_relevance[project].score` (`:58-60`). No caching.

Sizing:
```sql
SELECT count(*) AS total_live,
       count(*) FILTER (WHERE aligned_projects && ARRAY['ACT-GD','ACT-JH','ACT-EL','ACT-HV','ACT-FM','ACT-CN']) AS aligned_any,
       count(*) FILTER (WHERE project_relevance IS NOT NULL) AS with_project_relevance,
       count(*) FILTER (WHERE ghl_opportunity_id IS NOT NULL) AS in_ghl,
       count(*) FILTER (WHERE deadline IS NOT NULL AND deadline >= CURRENT_DATE) AS future_deadline
FROM grant_opportunities WHERE status IN ('open','ongoing','upcoming')
-- 3169 | 68 | 3169 | 114 | 309
SELECT code, count(*) FROM grant_opportunities, unnest(aligned_projects) AS code
WHERE status IN ('open','ongoing','upcoming') AND code IN (…six…) GROUP BY code ORDER BY 2 DESC
-- ACT-GD 46 · ACT-FM 6 · ACT-JH 6 · ACT-CN 5 · ACT-EL 3 · ACT-HV 3
```
Judgement: `project_relevance` is populated on **all 3,169** live rows but `aligned_projects` on only 68, so the `.overlaps` gate is what shrinks the desk's grant lane to ≤69 rows. The `.limit(3000)` is never near. Whether `aligned_projects` is the intended gate or a stale tagging artefact is a question for the grants reader / Ben.

## 9. Caching, in one table [verified]

| layer | mechanism | key / TTL | file:line |
|---|---|---|---|
| `getOrgProfileBySlug`, `getOrgProjects`, `getOrgProjectSummaries`, `getOrgProjectBySlug` | React `cache()` (per request) | n/a | `org-dashboard-service.ts:372,382,394,520` |
| `getActRelationshipLedger` | React `cache()` | n/a | `act-relationship-ledger.ts:471` |
| `getGoodsCapitalWorkspace` | React `cache()` | n/a | `goods-capital-workspace.ts:1249` |
| `getActPeopleIndex` | `unstable_cache` **inside** React `cache` | `['act-people-directory-v2']`, `revalidate: 300`, tag `act-people-directory` | `act-people-directory.ts:545-551` |
| `getActFunderIntelligence` | in-process `Map` TTL memo (payload > 2MB, `unstable_cache` silently never stored) | `INTEL_TTL_MS = 300_000` per orgProfileId | `act-funder-intelligence.ts:1334-1353` |
| `getOneDesk`, `getOneDeskPool`, `getAllProjectsGrantsTriage`, `getFunderScan`, `getGoodsBuyerPipeline`, `getDeskObligations`, `getDeskPeople`, `getOrgDailyActionStates` | none | | |
| public pages / reports | `unstable_cache(fn, ['<key>-vN'], { revalidate: 3600 })` | versioned keys, e.g. `reports-access-gap-v2`, `reports-desert-overhead-v4` | 40+ sites under `app/reports`, `app/dashboard`, `app/api/data/map` |

The memory rule applies to the `-vN` pattern: bump the key when the cached VALUE's shape changes; `unstable_cache` stores whatever came back, so loaders throw on failure rather than returning `[]` (`reports/who-runs-australia/page.tsx:128`). Nothing under `/org/act` uses `unstable_cache` except the people index; the desk is `force-dynamic` and pays the full load every request (six loaders in parallel).

---

## 10. Recipe: add a page + a mutation to `/org/act`

Files to copy from, in order. Paths are under `apps/web/src/`.

**1. Service (server-only, pure where possible)** — copy the shape of `lib/services/act-project-grants-triage.ts`:
```ts
import { getServiceSupabase } from '@/lib/supabase';      // live service client, never '@/lib/report-supabase'
export interface MyRow { … }
export async function getMyThing(orgProfileId: string): Promise<MyRow[]> {
  const db = getServiceSupabase();
  const { data, error } = await db.from('<table>').select('…').eq('org_profile_id', orgProfileId);
  if (error) throw new Error(`my thing: ${error.message}`);   // throw; let the page decide
  return (data ?? []).map(…);
}
```
Put the ranking/filtering in a pure `buildX(rows, today)` like `act-grants-desk.ts:57` so it gets a colocated `lib/services/my-thing.test.ts` (copy `act-grants-desk.test.ts:1-17`). Wrap with `cache()` from `'react'` if two components on one page call it.

**2. Page (Server Component)** — copy `app/org/[slug]/desk/page.tsx:1-16,53-63`:
```ts
import { notFound } from 'next/navigation';
import { isActSlug } from '@/lib/services/fast-local-org';
import { getOrgProfileBySlug } from '@/lib/services/org-dashboard-service';
import { getMyThing } from '@/lib/services/my-thing';
import { MyButtons } from './my-buttons';
export const dynamic = 'force-dynamic';
export async function generateMetadata() { return { title: 'My thing — CivicGraph' }; }
export default async function Page({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { slug } = await params; if (!isActSlug(slug)) notFound();
  const profile = await getOrgProfileBySlug(slug);          // ACT_E2E_FIXTURES handled inside; null in fixtures only if not act
  const rows = profile ? await getMyThing(profile.id) : [];
  // filters are URL state: read `await searchParams`, render <Link> chips (desk/page.tsx:59-77)
  return <main className="min-h-screen bg-ql-surface2 p-6 text-ql-ink">…<MyButtons orgProfileId={profile?.id ?? ''} id={row.id} />…</main>;
}
```
If ACT-internal data must never reach a non-admin, add the `grants/page.tsx:67-72` block (`SKIP_AUTH_LOCAL` bypass + `getUser` + `isAdminEmail` else `notFound()`). File goes at `app/org/[slug]/<room>/page.tsx`; the layout wraps it in the rail automatically.

**3. Rail entry** — one object in `workModes` at `app/org/[slug]/_components/act-workspace-shell.tsx:83-103`:
`{ label: 'My thing', hint: 'plain words', href: `/org/${slug}/<room>`, active: pathname.startsWith(`/org/${slug}/<room>`) }`.

**4. Mutation, Pattern A (recommended)** — new `app/api/org/[orgProfileId]/<room>/route.ts`, copy `obligations/route.ts:1-53`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireOrgWriteAccess } from '../../_lib/auth';
type Params = { params: Promise<{ orgProfileId: string }> };
function text(v: unknown, limit = 400) { return typeof v === 'string' && v.trim() ? v.trim().slice(0, limit) : null; }
export async function POST(request: NextRequest, { params }: Params) {
  const { orgProfileId } = await params;
  const auth = await requireOrgWriteAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;
  const body = await request.json() as Record<string, unknown>;
  const title = text(body.title, 300); if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  const { data, error } = await auth.serviceDb.from('<table>').insert({ org_profile_id: orgProfileId, title, created_by: auth.userId }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id });
}
```
Always scope updates with `.eq('org_profile_id', orgProfileId)` (`obligations/route.ts:109-113`). **Then add `'<room>/route.ts'` to `ROUTES` in `tests/unit/api/org/route-access-policy.test.ts:5-16`** so the guard is enforced by the build. For a handler test copy `tests/unit/api/opportunity-intelligence/actions-route.test.ts:1-49` (mock `@/app/api/org/_lib/auth`, dynamic import, `new Request`).

**5. Client leaf** — copy `app/org/[slug]/desk/desk-mark-buttons.tsx` (51 lines): `'use client'`, `useState` + `useRouter`, `fetch(`/api/org/${orgProfileId}/<room>`, { method:'POST', headers:{'Content-Type':'application/json'}, body })`, throw on `!res.ok` with `error`, `router.refresh()`.

**4′. Mutation, Pattern B (only if ACT-only and admin-only is acceptable)** — `app/org/[slug]/<room>/actions.ts` copying `goods/foundations/actions.ts:1-66` (`'use server'`, `requireWriteAccess()`, `getServiceSupabase`, `revalidatePath(`/org/${input.slug}/<room>`)`, return `ActionResult`), called from a client via `useTransition` as in `goods/foundations/track-button.tsx:20-44`. Remember `requireWriteAccess()` returns `null` for everyone when `NODE_ENV !== 'production'`.

**6. Data** — a new table needs a migration in `supabase/migrations/<14-digit>_<name>.sql` via `/db-apply` (Ben's verb), with RLS enabled and no anon grant (service-role only, like `act_obligations`). Verify columns first with the information_schema query in §1.7.

**7. Gates** — `scripts/precheck.sh` once at the end (tsc + vitest); `scripts/classify-changes.sh` will call anything under `app/org/` **VISIBLE** (only `lib/`, `app/api/`, `app/ops/`, `app/admin/`, tests are SAFE, `classify-changes.sh:38`), so the PR waits for Ben's preview. Dev: `pnpm dev` on `:3003` with `SKIP_AUTH_LOCAL=1` reaches the page; **the API route still needs a real session** (`requireOrgAccess` calls `getUser()`), so sign in as an `ADMIN_EMAILS` user or the button 401s.

---

## 11. Gaps and open questions

- Production values of `FAST_LOCAL_AUTH` / `NEXT_PUBLIC_FAST_LOCAL_AUTH` / `SKIP_AUTH_LOCAL` not checked (would decide whether prod middleware verifies the session or only the cookie). `/config-truth`.
- `act-pipeline-status-control.tsx`, `act-relationship-action-buttons.tsx`, `act-today-focus.tsx` listed in the client census but not read.
- `goods-funder-scan.ts`, `goods-buyer-pipeline.ts`, `act-obligations.ts`, `act-desk-people.ts` were only grepped for caching/client (none/service), not read for logic.
- Whether `org_pipeline` POST's raw `insert({ ...body })` (`pipeline/route.ts:32-36`) is reachable from any current UI was not traced.
- `revalidateTag('act-funder-intelligence')` now invalidates nothing (memo replaced `unstable_cache`); whether the funder-intelligence routes need a memo-bust hook is unverified.
- For Ben: (a) should `/org/[slug]` reads be membership-gated, or is "any signed-in user, super-admin for ACT-private rooms" the intended model? (b) Is the `aligned_projects` gate (68 of 3,169 live grants) the intended input to the desk, given `project_relevance` is scored on all 3,169? (c) Is Pattern B (admin-only server actions, dev bypass on `NODE_ENV` alone) acceptable for the redesign, or should new ACT mutations all go through `/api/org/[orgProfileId]`?
