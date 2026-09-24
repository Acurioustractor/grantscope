# design-and-ui: what the new ACT money surface must obey

Reader: design-and-ui. Date: 2026-09-24. Repo: /Users/benknight/Code/grantscope (read-only; nothing edited, no server started; a dev server was already listening on :3003, PID 87198, and was used for screenshots via Playwright). Screenshots landed in the git-ignored `.playwright-mcp/` folder (`.gitignore:61`), so `git status` is unchanged.

All paths below are relative to `apps/web/src/` unless they start with `/` or `docs/`, `thoughts/`, `DESIGN.md`, `CONTEXT.md`.

---

## 1. The frame question: which language does a signed-in ACT page speak?

**Answer: neither public Bauhaus nor the `.shell` rail. `/org/act/*` is a third, separately scoped skin called "Quiet Ledger" (`ql-*` tokens) inside the `.ws.act-workspace` wrapper, with its own dark-green rail (`ActWorkspaceShell`).** DESIGN.md does not document it.

Evidence:

- `app/org/[slug]/layout.tsx:36-53` — for an ACT slug the layout returns `<div className="ws act-workspace min-h-screen" data-act-workspace><ActWorkspaceShell slug projects>{children}</ActWorkspaceShell><ActTestGuide/></div>`. Non-ACT orgs get plain children with an optional yellow admin banner (`:72-91`, raw `bg-yellow-100`).
- `lib/public-frame.ts:24` — `ACT_WORKSPACE_PREFIXES = ['/org/act', '/org/a-curious-tractor', '/org/curious-tractor']`; `:32-34` `isChromelessPath()` returns true for them, so the root layout renders no top nav or footer (`app/layout.tsx:91-105`). `/org` is also in `LAYOUT_AUTH_PREFIXES` (`app/layout.tsx:53-63`).
- `app/ui/routes/route-scan.ts:22-27` — `SCOPES` classifies `/org` as design system `'act-workspace'` (vs `/dashboard` → `'shell'`, `/clarity` → `'clarity-dark'`, `/ui` → `'ui'`, everything else `'public'`). `detectVocab` (`:32-36`) knows three vocabularies: `bauhaus`, `shell`, `quiet-ledger`.
- `lib/palette-ratchet.test.ts:41-43` — the enforcement message names the token family per scope: *"bauhaus-\* on public pages, --shell-\* inside the shell, --ws-\* inside /org."*
- `app/globals.css:7-29` — `@theme` defines the `ql-*` colours and two fonts; comment at `:8`: *"Quiet Ledger palette (ACT one-system theme — source of truth: pencil-new.pen tokens)"*. `pencil-new.pen` is not in the repo root; only an untracked `Grantscope.pen` (330,867 bytes, 22 Sep) is (`ls *.pen`).
- `app/globals.css:244-260` (the `.ws.act-desk, .ws.act-workspace` block) remaps every `--ws-*` variable to the `ql-*` values, with the comment *"ACT workspace speaks Quiet Ledger (2026-08-05): the soft-green family is retired; these vars mirror the ql-\* tokens so every legacy ACT surface (Curiosity, ?view= lenses, shell) joins the one visual family."*
- `app/globals.css:119-121` — the global zero-radius rule `*:not(.ws *):not(.shell *):not(.ui):not(.ui *) { border-radius: 0 !important }` exempts `.ws` descendants, so rounded corners are legal in `/org`.
- `app/globals.css:237-241` — `.ws { background: var(--ws-surface-0); color: var(--ws-text); font-family: ui-sans-serif, system-ui, -apple-system, ... }`. **Body text inside `/org` is the system font**, not DM Sans; only elements that opt into `font-ql-display` / `font-ql-mono` / `font-display` / `font-mono` get a brand face. The screenshots are consistent with this (row text renders as SF Pro on this Mac).
- `app/globals.css:290-333` — inside `.ws`, Bauhaus utilities are remapped: `border-4/3/2` → 1px, `border-bauhaus-black` → `var(--ws-border)`, `text-bauhaus-*`/`bg-bauhaus-*` → ws vars, `font-black` → 700, `tracking-widest` → 0.05em, `bauhaus-shadow` → soft 1px shadow. So a Bauhaus-vocabulary page dropped into `/org` renders as thin cream lines (the grants desk is exactly this; see §6.3).
- DESIGN.md (read in full, 177 lines) documents: Bauhaus (`:11-103`), `.ws` (`:105-110`, "1px borders, subtle shadow, Satoshi 700"), `.clarity-dark` (`:112-125`), `.shell` (`:127-144`, "the rail is for signed-in work only (2026-09-24)"), one public frame (`:146-158`). The strings "Quiet Ledger", "Newsreader", "ql-" do not occur in DESIGN.md (grep over `DESIGN.md docs thoughts apps/web/src` for "Quiet Ledger" returned 15 files, none of them DESIGN.md). The `.ws` section says "Same fonts" as Bauhaus, which is not what `.ws` does (system-ui body, and `.ws.act-workspace` swaps the palette).
- Where Quiet Ledger IS written down: `docs/specs/one-desk-widened-ux-spec.md:8` ("Skin stays Quiet Ledger; no new visual family"), `docs/specs/people-surface-ux-spec.md`, `docs/specs/delivery-surfaces-ux-spec.md`, handoffs `one-desk-domain-model`, `goods-opportunities`, `place-atlas`.

**Judgement.** There are two signed-in languages today, and DESIGN.md only knows one of them:

| scope | routes | rail | display face | canvas | documented |
|---|---|---|---|---|---|
| `.shell` (softened Bauhaus) | `/dashboard`, `/clarity`, `/ops`, `/admin` | black `#121212`, 236px, CIVICGRAPH wordmark (`components/shell/shell.tsx:113-126`) | Satoshi (`font-display`) | `#F4F4F2` | DESIGN.md `:127-144`, decision 2026-08-16 |
| `.ws.act-workspace` (Quiet Ledger) | `/org/act/*` | dark green `#183426`, 200/208px, yellow `#e7ef65` "A" mark (`act-workspace-shell.tsx:125-139`) | Newsreader serif (`font-ql-display`) | `#F6F1E8` cream | specs only; not in DESIGN.md |

A signed-in ACT grant page belongs in the second: it is what `/org/act/desk`, `/orgs`, `/people`, `/communities`, `/digest-preview` and the two desk button components already use (14 files, list in §7). But Ben has to say so once, because the 2026-09-24 DESIGN.md wording ("the rail is for signed-in work only") reads as if `.shell` were *the* signed-in frame, while his 2026-08-05 rulings (memory `feedback_ben_ux_taste_one_desk`) were made on the green Quiet Ledger rail. Question 1 in the summary.

---

## 2. Exact tokens, classes and fonts for the workspace

### 2.1 Colour utilities (Tailwind v4 `@theme`, `app/globals.css:9-27`)

| utility | hex | used for (on the desk) |
|---|---|---|
| `bg-ql-surface2` | `#F6F1E8` | page ground (`desk/page.tsx:93`) |
| `bg-ql-surface` | `#FFFCF7` | list and detail panels (`:138`, `:178`), inactive chips |
| `bg-ql-warm` | `#F2E5D6` | "Do this now" hero (`:129`), selected row (`:148`), "Next move" box (`:199`) |
| `bg-ql-canvas` | `#E9E2D7` | defined, unused on the desk |
| `text-ql-ink` | `#27221D` | body text |
| `bg-ql-bar` / `border-ql-bar` | `#211F1C` | sticky horizon header (`:141`), primary button (`desk-mark-buttons.tsx:39`), active chip (`:89`) |
| `text-ql-text2` | `#70685F` | secondary text |
| `text-ql-muted` | `#AAA49B` | tertiary, `—` |
| `text-ql-inverse` | `#FFFCF7` | text on dark |
| `text-ql-accent` | `#9A673B` | eyebrows and the count line (`:97`, `:130`, `:200`), "decide" pill (`:155`), GHL link (`:215`) |
| `text-ql-moss` | `#5F725C` | positive money (`:110`) |
| `text-ql-alert` / `bg-ql-alert` / `border-ql-alert` | `#A44A3B` | overdue (`:40-41`, `:141`), errors, stale badge (`:196`) |
| `border-ql-border` | `#DDD4C7` | every hairline |
| `bg-ql-kind-money` | `#A44A3B` | "owed" chip |
| `bg-ql-kind-funder` | `#6B5B8A` | "funder" chip |
| `bg-ql-kind-grant` | `#3F6577` | "round" chip |
| `bg-ql-kind-buyer` | `#5F725C` | "buyer" chip |
| `bg-ql-kind-obligation` | `#9A673B` | "we owe" chip |
| `bg-ql-kind-person` | `#4A5D8A` | "person" chip |

### 2.2 CSS variables for legacy or mixed pages (`app/globals.css:219-232` root defaults, remapped `:247-260` inside `.ws.act-workspace`)

`--ws-surface-0` `#F6F1E8` · `--ws-surface-1` `#FFFCF7` · `--ws-surface-2` `#F2E5D6` · `--ws-border` `#DDD4C7` · `--ws-border-strong` `#211F1C` · `--ws-text` `#27221D` · `--ws-text-secondary` `#70685F` · `--ws-text-tertiary` `#AAA49B` · `--ws-accent` `#9A673B` · `--ws-red` `#A44A3B` · `--ws-amber` `#9A673B` · `--ws-green` `#5F725C`.

These are what `ActWorkspacePageHeader` and the rail's mobile header use (`bg-[var(--ws-surface-0)]`, `border-[var(--ws-border)]`, `text-[var(--ws-text-secondary)]`). Do not use `--shell-*` inside `/org`: no `.shell` scope wraps it, so `var(--shell-muted)` resolves to nothing (the same silent-invalid-var failure recorded at `globals.css:210-218` for the public nav).

### 2.3 Fonts

- `font-ql-display` → `var(--font-newsreader)` Newsreader serif, weights 400/500/600 + italic, loaded by `next/font` in `app/layout.tsx:6`. The desk H1 (`desk/page.tsx:106`, `text-4xl font-semibold`), the hero name (`:131`, `text-lg`), the detail H2 (`:185`, `text-3xl`) and `ActWorkspacePageHeader`'s H1 (`act-workspace-page-header.tsx:30`, `text-2xl`).
- `font-ql-mono` → IBM Plex Mono 400/500/600 (`app/layout.tsx:7`). Chips, eyebrows, counts, money, days.
- `font-mono` → JetBrains Mono (`globals.css:38`) is what the rail uses (`act-workspace-shell.tsx:139,142,154`), so the rail and the page use two different monospaces.
- Body: system-ui from `.ws` (`globals.css:240`). Satoshi and DM Sans are loaded (`app/layout.tsx:15-29`) but the workspace does not reach them unless a class says `font-display`/`font-sans` on the element.

### 2.4 Radius, borders, shadows

Allowed inside `.ws`: `rounded` (4px), `rounded-md`, `rounded-lg`, `rounded-full`. Census of `desk/` + `[slug]/_components/`: `rounded-md` 120, `rounded` 36, `rounded-full` 9, `rounded-lg` 4, `rounded-xl` 3. Borders are 1px `border-ql-border`. No shadows on the desk; `.ws .bauhaus-shadow` softens to `0 1px 3px rgba(0,0,0,.08)` (`globals.css:332`).

### 2.5 Type scale actually in use (and the 11px floor)

DESIGN.md `:37` sets the micro floor at 11px. The desk and rail use: `text-[8px]` (rail hints, `act-workspace-shell.tsx:326,443`; rail sub-labels `:363,392`), `text-[8.5px]` (kind chip `desk/page.tsx:47`, decide pill `:155`), `text-[9px]` (rail section labels `:142,154`; header "Only show project" `:118`; horizon header `:141`; Next-move label `:200`; stale badge `:196`), `text-[9.5px]` (hero label `:130`, signal line `:183`), `text-[10px]` (count line `:97`, Due `:39-42`, owed-to `:156`). Memory `project_design_alignment` counted 2,289 sub-11px sizes site-wide; the desk contributes.

### 2.6 The rail's own colours are hard-coded hex, not tokens

`act-workspace-shell.tsx:18` `PROJECT_COLOURS = ['#c99a2e','#6b78b8','#4f8b63','#a06b8b','#44899b','#8b6f56']`; `:129` rail `bg-[#183426]`; `:138` mark `bg-[#e7ef65] text-[#183426]`; `:142` labels `text-[#8fa196]`; `:319` links `text-[#c7d1ca]`; `:169` `text-[#aebcb2]`; `:326` `text-[#9fb0a4]`; `:426` `text-[#d7ded9]`; matter rail `:280` `bg-[#2f8f64]` with a soft shadow. None of these exist in `@theme`. The green is the "soft-green family" that `globals.css:244-246` says was retired on 2026-08-05; the rail kept it.

---

## 3. Reusable primitives (name, path, props)

### 3.1 Workspace (Quiet Ledger / ws) — the ones a new `/org/act` surface should build on

| name | path | props / exports | notes |
|---|---|---|---|
| `ActWorkspaceShell` | `app/org/[slug]/_components/act-workspace-shell.tsx:61` | `{ slug, projects: OrgProjectSummary[], children }` (client) | The green rail. "Where you work": One Desk (hint "What needs you"), Orgs, People, Curiosity, Funding, Grants (`:83-103`); lenses nest under One Desk via `DeskRailTree` (`:355-378`, `DESK_LENSES :343-353`: Everything / Funders / Grant rounds / Buyers / Money owed to us / We owe / Follow-ups); "Jump to a project": top 7 active projects by `projectFieldRank` (`:32-42`) with a colour dot and `pipeline_count`; utility: Atlas, Queries. Under `lg` it collapses to a sticky horizontal-scroll header (`:192-214`) that also exposes Money / Sources / Research links the desktop rail hides. Goods gets its own tree (`GOODS_RAIL_SECTIONS :333-338`). Matter desks (`/goods/model`, `/justicehub/model`, `/resources`) swap to a 72px icon rail (`MatterDecisionRail :222-311`). |
| `ActWorkspacePageHeader` | `app/org/[slug]/_components/act-workspace-page-header.tsx:3` | `{ eyebrow: string; title: string; description?; controls?; meta?; testId?; sticky=true }` | Sticky header on ws vars. **Has a required `eyebrow` prop**, i.e. it institutionalises the eyebrow-plus-title stack Ben dislikes. Used by other `/org` rooms; the desk does not use it. |
| `DeskMarkButtons` | `app/org/[slug]/desk/desk-mark-buttons.tsx:8` | `{ orgProfileId, actionId, title, detail }` | Done → next / Waiting / Tomorrow. `POST /api/org/{orgProfileId}/daily-actions` with `{action_id,title,detail,status}` then `router.refresh()` (`:18-34`). Primary = `bg-ql-bar text-ql-inverse`, secondary = `border-ql-border bg-ql-surface` (`:36-46`). |
| `DeskObligationButtons` | `app/org/[slug]/desk/desk-obligation-buttons.tsx:9` | `{ orgProfileId, obligationId, owedTo: 'funder'|'community' }` | Done / Dropped. `PATCH /api/org/{id}/obligations`. Dropped uses `window.prompt` for the reason (`:21-25`), required when community-owed (`:27-30`). |
| `Due` | `desk/page.tsx:38-43` (not exported) | `{ d: number|null }` | `—` / `Nd overdue` (alert) / `Nd` (alert if ≤14, ink otherwise). |
| `KindChip` | `desk/page.tsx:45-51` (not exported) | `{ k: DeskRecordKind }` | solid chip, `KIND_STYLE` (`:18-21`) × `KIND_CHIP_LABEL` (`:30-32`: owed / we owe / person / funder / round / buyer). |
| `chip(active)` | `desk/page.tsx:87-90` | | the project-filter pill: `rounded-full border px-3.5 py-1.5 text-[11px]`, active = `bg-ql-bar`. |
| `KIND_FILTER_LABEL` | `desk/page.tsx:25-28` | | the plain words: Money owed to us / We owe / People / Funders / Grant rounds / Buyers. |
| `HORIZON_LABEL` | `desk/page.tsx:34-36` | | Overdue / This fortnight / This quarter / No date · ranked by fit. |
| `getOneDesk(slug)` | `lib/services/act-one-desk.ts:99-123` | → `{ active: DeskRecord[], handled, orgProfileId, target: DeskTarget|null }` | The pool. `DeskRecord` `:32-59` (`id, kind, project, name, signal, next, dueDays, score, amount: string|null, ghlUrl, workHref, isDecision?, owedTo?, obligationId?, via?, personId?, lastSyncedAt?`). `deskHorizon` `:72-77`. `getOneDeskPool` `:125-248` merges obligations, people, money, funders (`getFunderScan`), grants (`getAllProjectsGrantsTriage`), buyers, then sorts by `urgency` (`:85-88`). |
| `getActGrantsDesk()` | `lib/services/act-grants-desk.ts` | `DeskGrant` `:31-47` (`id, origin, name, provider, closeDate, daysToClose, amountMin, amountMax, geography, url, source, eligibility: ProjectEligibility[], fitScore: Partial<Record<ActProject, number>>`) | Backs `/org/act/grants`. `buildDesk` `:57` dedupes by URL, public row wins. |
| `ACT_PROJECTS`, `ENTITY_LABEL` | `lib/act-grant-eligibility.ts:30-36`, `:10` | | labels Goods / JusticeHub / Empathy Ledger / Harvest / Farm / Contained; entities per project; operating areas (Goods NT/QLD/WA; Harvest and Farm Sunshine Coast; others national). |
| `ActTestGuide` | `app/org/[slug]/_components/act-test-guide.tsx` | `{ slug }` | The floating dark-green "Test the whole ACT system" button bottom-right of every ACT page (visible in all four screenshots); a walkthrough stored in `localStorage` key `act-gold-standard-test-drive-v1` (`:7`). |

Legacy helpers to avoid: `app/org/_components/ui.tsx` (`Section`, `StatCard`, `SystemBadge`, `StatusBadge`, `ContactTypeBadge`) are built on raw `gray-200`/`emerald-50`/`rounded-sm`/`shadow-sm` (`:16`, `:24-34`, `:44-51`). New files with those classes fail `palette-ratchet.test.ts:48-58`.

### 3.2 Public data parts (Bauhaus) — `components/data/index.ts:4-9`

| name | path | props |
|---|---|---|
| `Section` | `components/data/section.tsx:4` | `{ title, children }` — uppercase title on a 4px rule |
| `StatRow` / `Stat` | `components/data/stat-row.tsx:17`, `:36` | `StatRow { cols: 2|3|4|5 }`; `Stat { label, value, sub?, tone?: 'ink'|'red'|'money'|'blue', children? }` — `sub` says what the figure counts |
| `Panel` / `FactList` | `components/data/panel.tsx:4`, `:23` | `Panel { title }`; `FactList { facts: {label, value, mono?}[] }` — empty values skipped |
| `DataTable<T>` | `components/data/data-table.tsx:16` | `{ columns: Column<T>[], rows, rowKey, caption? }`; `Column { key, label, align?: 'left'|'right', cell }` — black header row, right-aligned tabular numbers |
| `Callout` | `components/data/callout.tsx:13` | `{ tone: 'alert'|'caution'|'note', title, children? }` |
| `SourceLine` | `components/data/source-line.tsx:5` | `{ sources: string|string[], asOf? }` — "Source: … · data as of …" |

Inside `.ws` these soften automatically (4px → 1px, black → `--ws-border`, `font-black` → 700), so they are usable in `/org` as a bridge; `/org/act/grants` hand-rolls the same shapes and gets the same softened look (screenshot §6.3).

### 3.3 Browse scaffolding — `components/browse/browse-ui.tsx`

`money(n)` `:19` (wraps site `money`, `≤0` → `—`), `L` `:24` (section label on `--shell-muted`), `makeQs(basePath, params)` `:33` (URL-state builder), `SortHeader` `:48` (`{label, sortKey, current, dir?, naturalDir?, qs, width?, align?, title?}`; every column sorts by its header, Ben 2026-08-18; ▲/▼/⇅ in `#D02020`/`#C0C0C0`), `useDrawer<T>()` `:91`, `Drawer` `:112` (fixed right, `max-w-[460px]`, scrim). Consumers `GrantBrowser`, `FoundationsBrowser`, `OrgBrowser`, `ContractSideBrowser`. They read `--shell-*`, so they need a `.shell` scope (`BrowseScope`, `components/shell/browse-scope.tsx:14`) or a ws-var port before they can sit inside `/org`.

### 3.4 Shell chrome — `components/shell/` (signed-in `/dashboard`, `/clarity`, `/ops`, `/admin` only)

`Shell` (`shell.tsx:105`, server; rail + `ShellHeader`), `RailNav` / `RailGroupLink` (`rail-nav.tsx:75`, `:38`; longest-prefix active state, red dot), `ShellHeader` (`shell-header.tsx:46`; pathname-derived title table `:23-44`, ⌘K search, "Data: nightly refresh" pill), `ShellFilters` (`shell-filters.tsx:14`; topic/fy `<select>`s writing `?topic=&fy=` with `router.replace`), `ShellMenus`, `BrowseScope`. Not used by `/org`.

### 3.5 shadcn `.ui` — `components/ui/{button,badge,card,input,separator,skeleton,table,tabs}.tsx`

Base UI + cva, oklch tokens, `rounded-lg`/`rounded-xl`; scoped to `.ui` (`globals.css:608-620`). Unused on the desk. A fourth vocabulary; the design-alignment memory lists it among "too many themes".

---

## 4. Money formatting

**THE formatter:** `money(n)` in `lib/format.ts:8-15`: `$1.2B` / `$3.4M` / `$56K` / `$789`; `null|undefined|NaN` → `—`; `0` → `$0`; negative → `−$…`. DESIGN.md `:155`: "One money format: `money()` in `lib/format.ts`. Local formatters delegate to it."

**Under `/org` it is barely used.** `grep -rln "from '@/lib/format'" app/org` → 2 files (`app/org/_components/matched-grants.tsx`, `app/org/[slug]/intelligence/page.tsx`). `grep -rnE "function money\(|const money = |function fmtMoney|function formatMoney|const fmtMoney|const formatMoney" app/org` → **33 local formatters**, including:

- `desk/page.tsx:64` `const money = (n) => n >= 1e6 ? $X.XM : $NK` — header target line ("$0K committed").
- `lib/services/act-one-desk.ts:191` `amount: \`$${Math.round(item.outstandingTotal / 1000)}K\`` (money owed), `:232` `\`$${Math.round(g.amountMax / 1000)}K\`` (grant rounds), `:243` (buyer asks). **K only, no M**, so the grant lens prints `$22039K` (Closing the Gap program), `$12610K` (ATSI initiatives), `$7240K` (Cairns Private Hospital), `$6700K` (City-Country Partnerships), `$1800K`, `$1000K` (snapshot of `/org/act/desk?kind=grant`, refs f7e174, f7e179, f7e235, f7e268). The grants desk prints the same ATSI row as `$12.6M` (`grants/page.tsx:15-20`, snapshot ref f8e200).
- `grants/page.tsx:15-20` (`min–max`, `from $X`, `Not published`), `funding/page.tsx:10-12` (`Intl.NumberFormat` AUD, `Amount not published`), `orgs/page.tsx:17` (full dollars), `orgs/[org]/page.tsx:22` (Intl AUD), `projects/page.tsx:7`, `research/page.tsx:19`, `[projectSlug]/act-project-field-map.tsx:43`, `[projectSlug]/funding/page.tsx:8`, `wiki/goods-signals/page.tsx:10`, 10 `fmtMoney`/`formatMoney` in `_components/*` (`income-history-section.tsx:9`, `expense-history-section.tsx:8`, `financial-pulse-tile.tsx:5`, `act-action-queue.tsx:48`, `act-operating-desk.tsx:118`, `act-people-directory.tsx:414`, `act-relationship-ledger.tsx:546`, `act-funder-intelligence-desk.tsx:864`, `people-section.tsx:8`, `outstanding-receivables-section.tsx:3`, `source-verification-panel.tsx:3`), `barkly/barkly-regional-field.tsx:546`, `payables/page.tsx:15`, `payables/payables-kanban.tsx:22`, `goods/page.tsx:30`, `goods/grants/page.tsx:15`, `goods/foundations/scan/page.tsx:21`, `goods/community/[communityId]/page.tsx:497`, `goods/funnel/page.tsx:14`, `goods/channels/page.tsx:14`, `goods/proof/page.tsx:29` (`moneyShort`).

**Rule for the new surface:** import `money` from `@/lib/format` and store amounts as numbers on the record (`DeskRecord.amount` is a pre-formatted `string|null`, `act-one-desk.ts:45`, which is why the K-only bug cannot be fixed at render time). For ranges reuse the `grants/page.tsx:15-20` shape but on `money()`.

---

## 5. The rail / filter pattern

- **The rail is the ONE nav and owns the lenses** (Ben 2026-08-05, memory `feedback_ben_ux_taste_one_desk`; code comment `act-workspace-shell.tsx:115-116`, `:331-332`, `:340-342`). Kind lenses are rail children under One Desk (`DeskRailTree`), rendered only while the pathname is under `/desk` (`:147-149`). Goods' 18 sub-pages are a rail tree in four groups (`GOODS_RAIL_SECTIONS :333-338`: Work / Money in / Delivery / Trust).
- **State lives in the URL, server-rendered, no client state**: `?kind=`, `?project=`, `?rec=` on the desk (`desk/page.tsx:60-77`; `qs()` `:73-77`); `?project=`, `?show=all`, `?limit=` on the grants desk (`grants/page.tsx:55-60`, `:97-101`); `makeQs` on browse pages; `router.replace` selects on shell pages.
- **What still sits in the header:** the desk keeps a "Only show project" chip row (`desk/page.tsx:117-124`) with seven pills (Contained, Empathy Ledger, Goods, Harvest, JusticeHub, Palm Island Community Company, The Farm; the labels come from `DeskRecord.project`, so "Palm Island Community Company" and "The Farm" appear where the rail says "Palm Island"/"Farm"). The grants desk puts its project switch in the header as seven `border-2` uppercase chips (`grants/page.tsx:117-122`). Both are the "header chip rows he reads as competing tabs".
- **Sorting** on browse tables is by column header (`SortHeader`), never by chip rows. The desk list is not sortable (ranked by `urgency`); the grants desk sorts by fit then close date when a project is picked (`grants/page.tsx:86-96`), otherwise soonest close.
- **Selection** is a link to `?rec=` that re-renders the page; the detail pane is the right half of a two-column grid (`desk/page.tsx:137`, `lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]`), list capped at 80 rows (`:80`) with a `max-h-[74vh]` scroll (`:138`).

---

## 6. Three screenshots in words (localhost:3003, 1440×900, `SKIP_AUTH_LOCAL=1` in `apps/web/.env.local` so `middleware.ts:50` lets `/org/act` through; the grants page has the same bypass at `grants/page.tsx:67-72`)

### 6.1 `/org/act/desk` (the "Everything" lens) — `.playwright-mcp/understand-desk-1440.png`

Left, a 200px dark-green rail (`#183426`): a yellow square "A" and "A CURIOUS TRACTOR" in 10px mono caps; 9px label "WHERE YOU WORK"; six numbered rows `01 One Desk … What needs you` (title truncates to "One…" because the 8px hint takes the width; only 02 Orgs, 04 Curiosity and the hints survive intact), with "SHOW ONLY" and seven lens links indented under 01 (Everything highlighted); 9px label "JUMP TO A PROJECT" with seven dot-and-count rows (Goods 22, JusticeHub 6, Harvest 14, Empathy Ledger 4, CivicGraph 0, Palm Island 8, ALMA 0) and "All projects →"; at the bottom Atlas "Search everything" and Queries "Audited answers", the second half-covered by the Next.js dev-tools "N" button.

Main, cream (`#F6F1E8`): a 10px rust mono count line `182 ASKS · 180 DECISIONS DUE · 0 OWED · 0 PEOPLE`; a 36px serif "One Desk"; a contract line "Goods capital plan: **$0K** committed of $367K–$620K needed · $0K asked" ($0K in alert red); right-aligned "ONLY SHOW PROJECT" and seven rounded pills. Then a full-width warm box: "DO THIS NOW  Social Impact Hub Foundation  Confirm payment and the relationship next step; the oldest invoice is 575 days overdue." Below, a two-column split. Left panel (scrolls): a dark-red sticky bar "OVERDUE · 17", then 17 rows each `[owed] Name  $22K  575d overdue` or `[buyer] Name  98d overdue` (six invoice chases first: Social Impact Hub $22K/575d, Rotary Eclub Outback $83K/518d, Jenn Brazier $4K/436d, Berry Obsession $13K/226d, Sonas Properties $44K/216d, Brodie Germaine Fitness $15K/148d; then buyers AHL, Anyinginyi, Centrebuild, Miwatj, Hewitt Agriculture at 96–98d overdue; Regional Arts Australia $17K/86d; GW Space, East Arnhem Regional Council, Northern Land Council — GAPUWIYAK; Tandanya $22K/85d; ALIVE/University of Melbourne $66K/56d). Off-screen below: a near-black bar "THIS FORTNIGHT · 2" (two grant rounds with a "decide" pill), "THIS QUARTER · 2", then "NO DATE · RANKED BY FIT · 59" which is mostly `[funder] … decide —` rows: The Snow Foundation, Sydney Community Foundation ×2, Reichstein ×2, Gulf Regional Economic Aboriginal Trust ×3, Mary MacKillop Today ×3, MINDEROO PICTURES ×3, Community Broadcasting Foundation ×4, Colonial Foundation Trust ×4, John Villiers Trust ×3, KARI ×2 (snapshot refs f6e245–f6e518). Right panel: `[owed] 1 INVOICE OUTSTANDING`, a 30px serif "Social Impact Hub Foundation", `$22K 575d overdue`, a warm "NEXT MOVE" box repeating the hero sentence, three buttons "Done → next" (dark) / "Waiting" / "Tomorrow", and "Open full workspace →" (to `/org/act/orgs/social-impact-hub-foundation`). Bottom-right, floating: a dark-green pill "Test the whole ACT system".

What the eye reads: a collections queue. Grants are not on the first screen; 180 of the 182 "asks" are foundation rows demanding a decision that has no decision button.

### 6.2 `/org/act/desk?kind=grant` (the "Grant rounds" lens) — `.playwright-mcp/understand-desk-grant-lens-1440.png`

Same rail with "Grant rounds" highlighted; the count line gains "· SHOWING GRANT ROUNDS ✕". Hero: "DO THIS NOW  Aboriginal Community Initiatives Fund: 2026–27 funding round  Decide: pursue (push to GHL) or pass". Left list: "THIS FORTNIGHT · 2" → `[round] Aboriginal Community Initiatives Fund: 2026–27 funding r…  DECIDE  $100K  4d`, `[round] Visions of Australia - Round 23  DECIDE  8d`; "THIS QUARTER · 2" → Alcohol and Other Drugs Youth Grants 2026/27 `DECIDE $20K 15d`, 2026 Regional Arts Touring Round 2 `DECIDE $120K 19d`; "NO DATE · RANKED BY FIT · 39" → SEDI Capability Building Grant `$120K 279d` (a dated row under a "no date" header, because `deskHorizon` files anything >90d as undated, `act-one-desk.ts:73`), Whitegoods and Household Goods `DECIDE $6K —`, Northern Sub-Regional Trust … `DECIDE $6K —`, SEDI First Nations Social Enterprise Grants `—`, Closing the Gap program `$22039K —`, ATSI initiatives `$12610K —`, IBA Start-Up Finance Package `$150K`, Supply Nation Certification + Buyer Access, Aboriginals Benefit Account `$1000K`, Binar Futures Ltd — Towards development… (a 200-character name, truncated) `$1800K`, then 29 more. A grant row carries: chip "round", name, optional "decide", amount, days. It does **not** carry the project it was tagged for, the funder, the fit score, Jev's verdict, the close date, the entity that can apply, or the source. Right panel: `[round] LIVE ROUND · NOT YET AN ASK`, serif "Aboriginal Community Initiatives Fund: 2026–27 funding round", `$100K 4d`, "NEXT MOVE  Decide: pursue (push to GHL) or pass", then the same three buttons "Done → next / Waiting / Tomorrow" and "Open full workspace →" (to `/org/act/goods/grants`). There is no Pursue and no Pass anywhere on the page (`desk/page.tsx:203-212` renders `DeskMarkButtons` for every non-obligation kind; `ghlUrl` is `null` for grants, `act-one-desk.ts:233`).

### 6.3 `/org/act/grants?project=goods` (the Grants desk) — `.playwright-mcp/understand-grants-goods-1440.png`

Same rail with 06 Grants highlighted. Main, cream: red 11px caps "ACT ONLY · NOT PUBLIC"; a 36px heavy sans uppercase "GRANTS DESK" (system font at 700 because `.ws .font-black` caps weight, `globals.css:327`); a three-line explanatory paragraph ("Pick a project to rank grants by fit … read the guidelines before applying."); seven bordered uppercase chips ALL GRANTS / GOODS (filled) / JUSTICEHUB / EMPATHY LEDGER / HARVEST / FARM / CONTAINED; a sentence "**Goods** applies through A Curious Tractor Pty Ltd or The Butterfly Movement (DGR). Ranked by fit, soonest close breaks ties. 1,360 ruled out by entity or place, 1,583 with no fit signal for this project hidden show everything." Four stat cells in one thin frame: LIVE GRANTS 831 · CLOSE WITHIN 30 DAYS 14 · NO CLOSE DATE 774 · PRIVATE SMARTYGRANTS ROUNDS 12. A table with a black header FIT / CLOSES / GRANT / AMOUNT / WHERE / CAN APPLY / SOURCE. Rows: `100 · NO CLOSE DATE · Northern Sub-Regional Trust - Whitegoods and Household Goods (rust link) / The Trustee For The Western Cape Communities Trust · $6K · AU-QLD · [UNKNOWN] [PLACE YES] [PTY UNKNOWN] [BUTTERFLY UNKNOWN] · foundation_program`; the same for Whitegoods and Household Goods; `88 · NO CLOSE DATE · SEDI First Nations Social Enterprise Grants / Impact Investing Australia + Malu Pty Ltd (admin) — Dept of Social Services (funder) · Not published · Unknown · [UNKNOWN][PLACE UNKNOWN][PTY YES][BUTTERFLY UNKNOWN] · manual-research-2026-05-27`; `82 · 279D 2027-06-30 · SEDI Capability Building Grant · $120K · Unknown …`; `82 · ATSI initiatives / DTMR · $12.6M · AU-QLD`; `82 · IBA Start-Up Finance Package · $150K`. Each row is ~125px tall because "Can apply" stacks four tags. Fit pills are green (≥60), yellow (≥20) or outlined; close pills red ≤14d, yellow ≤45d. Footer (off-screen): "Showing the soonest 300 of N. Show 500 more" and "Generated 24/09/2026 …".

What the eye reads: a spreadsheet with verdict tags, mostly "unknown". It answers "can we apply" better than the desk does, but there is no action on a row (no pursue, no push to GHL, no save) and no Jev column.

### 6.4 Extras, for the "ten surfaces" context

- `/org/act/funding` (`.playwright-mcp/understand-funding-1440.png`): a different skin again — `funding/page.tsx:20-31` uses raw hex (`bg-[#f8fafc] text-[#0f172a]`, `#183426`, `#2f8f64`, `#e7ef65`, `#eff6ff/#2563eb`, `#fff7ed/#9a3412`), `rounded-xl`, `shadow-sm`, `hover:-translate-y-0.5`. Green eyebrow "WEEKLY FUNDING DESK", H1 "Five decisions, not five hundred grants", subtitle, two buttons ("Open pipeline", "Explore evidence"); a dark-green "OPERATING CYCLE / Week of 21 Sept / 0 decisions this week · 5/5 queue places · 0/14 project profiles ready" card with three "PRIORITY ACTIONS"; "This week's decision queue — 5 of 5 places used · 135 evidence-safe project matches considered"; card #1: chips "PALM ISLAND COMMUNITY COMPANY" and "NEEDS VERIFICATION", "Skills NT Grant", "Department of Education and Training · fit 70/100", "Palm Island Community Company still has 3 unresolved profile decisions.", four mono chips "Hybrid 21.0 · Lexical 0.00 · Semantic 0.00 · Project 70", buttons "Review project route" / "Official evidence ↗", two full-width outline buttons "PURSUE → GHL" and "CORRECT THIS RESULT", and a side box Deadline 31 Dec 2028 / 829 days remaining / Maximum "Amount not published". This page does have the pursue verb, on its own card grammar, in the retired green family.
- Phone width 390px (`.playwright-mcp/understand-desk-390.png`): the rail becomes a sticky top strip "A · Atlas · One Desk (filled) · Orgs · People · Curiosit…" that scrolls sideways; the count line wraps to two lines; the seven project pills wrap to three rows; the hero and list stack; the "Test the whole ACT system" pill covers the bottom rows. The lenses (Funders / Grant rounds …) are not reachable on a phone: `DeskRailTree` is inside the `hidden lg:block` aside (`act-workspace-shell.tsx:129`) and the mobile nav (`:196-213`) does not repeat them.

---

## 7. Where each `/org` page stands, by vocabulary (census, `grep -rl --include='*.tsx'` under `app/org`, 138 files)

- `ql-*` Quiet Ledger: **14 files** — `[slug]/desk/page.tsx`, `desk-mark-buttons.tsx`, `desk-obligation-buttons.tsx`, `_components/act-operating-desk.tsx`, `act-funder-intelligence-desk.tsx`, `act-record-review.tsx`, `act-workspace-page-header.tsx`, `communities/page.tsx`, `communities/[community]/page.tsx`, `digest-preview/page.tsx`, `orgs/page.tsx`, `orgs/[org]/page.tsx`, `people/page.tsx`, `people/people-actions.tsx`.
- `bauhaus-*`: **83 files** (softened by the `.ws` remap; e.g. `grants/page.tsx`, most of `goods/*`, `[projectSlug]/*`, `contacts/*`, `ecosystem`).
- `var(--ws-`: 20 files.
- raw Tailwind palette (`gray-/emerald-/amber-/…-NNN`): **81 files**; raw hex `#xxxxxx`: 34 files (incl. the rail and `funding/page.tsx`).

So the "ONE visual family" of 2026-08-05 covers 10% of the workspace by file; the rest is Bauhaus-through-a-remap, raw palette, or the retired green.

---

## 8. Numbers behind the screens

- Desk header (rendered): 182 asks · 180 decisions due · 0 owed · 0 people. Grant lens: 2 + 2 + 39 = 43 grant rows. Rail counts: Goods 22, JusticeHub 6, Harvest 14, Empathy Ledger 4, CivicGraph 0, Palm Island 8, ALMA 0 (`project.pipeline_count`).
- Grants desk, Goods: 831 live, 14 close within 30 days, 774 no close date, 12 private SmartyGrants rounds; 1,360 ruled out, 1,583 hidden below fit 20 (`FIT_THRESHOLD`, `grants/page.tsx:41`).
- Rows that satisfy the desk's grant contract (status live + an ACT tag), measured:

```sql
SELECT code, count(*) AS rows,
       count(*) FILTER (WHERE deadline IS NOT NULL AND deadline >= current_date) AS dated_live,
       count(*) FILTER (WHERE deadline IS NULL) AS undated,
       count(*) FILTER (WHERE ghl_opportunity_id IS NOT NULL) AS in_ghl
FROM grant_opportunities g
CROSS JOIN LATERAL unnest(g.aligned_projects) AS code
WHERE g.status IN ('open','ongoing','upcoming')
  AND code IN ('ACT-GD','ACT-JH','ACT-EL','ACT-HV','ACT-FM','ACT-CN')
GROUP BY code ORDER BY rows DESC
```

| code | rows | dated_live | undated | in_ghl |
|---|---|---|---|---|
| ACT-GD | 46 | 8 | 38 | 32 |
| ACT-FM | 6 | 0 | 5 | 0 |
| ACT-JH | 6 | 2 | 4 | 2 |
| ACT-CN | 5 | 3 | 1 | 0 |
| ACT-EL | 3 | 0 | 3 | 2 |
| ACT-HV | 3 | 0 | 3 | 0 |

69 (grant, project) pairs; the desk's decision-due filter (`act-one-desk.ts:222-226`: in GHL, or deadline ≤30d, or fit ≥85 for Goods / ≥40 for others) leaves 43 on screen. Columns verified first with `information_schema.columns` for `grant_opportunities` (`id uuid, name text, amount_min int, amount_max int, deadline date, url text, provider text, aligned_projects ARRAY, ghl_opportunity_id text, status text, goods_relevance_score int, project_relevance jsonb`).

---

## 9. Anti-patterns to avoid, per Ben's taste (each one is on a live screen today)

1. **Label stacks.** Eyebrow + H1 + explainer + section eyebrow + card eyebrow (`funding/page.tsx:23-27,41,46`; `grants/page.tsx:109-115`; `ActWorkspacePageHeader` makes `eyebrow` mandatory). Ben: one heading per screen and one contract line (memory `feedback_ben_ux_taste_one_desk`).
2. **Header chip rows that read as tabs.** Desk "Only show project" pills (`desk/page.tsx:117-124`); grants desk project nav (`grants/page.tsx:117-122`). Lenses belong in the rail.
3. **Explanation captions in nav.** Rail hints "What needs you / Look one up / Who we cultivate / New leads / Money worth chasing / Every live grant" at 8px (`act-workspace-shell.tsx:86-98,326`), which also truncate the labels they explain ("One…", "Pe…", "F…", "Gr…").
4. **Database vocabulary on the surface.** `foundation_program`, `manual-research-2026-05-27` (Source column), `AU-QLD`, `Hybrid 21.0 · Lexical 0.00 · Semantic 0.00 · Project 70`, `fit 70/100`, `evidence-safe`, `decision_ready` (`funding/page.tsx:109`), `minted from`, `not_in_ghl`.
5. **Riddles instead of verbs.** A "decide" pill and a "Decide: pursue or pass" sentence next to buttons that say Done → next / Waiting / Tomorrow (§6.2). CONTEXT.md `:124-125` says the decision is *pursue* (mints an Ask) or *pass*; the memory says the primary verb pair goes on top. Also "$0K committed of $367K–$620K needed · $0K asked" as the only contract line, and "NO DATE · RANKED BY FIT" over rows showing 279d.
6. **Confident zeros.** "0 OWED · 0 PEOPLE" and rail "CivicGraph 0 / ALMA 0" read as measurements (CLAUDE.md "the tell: any screen showing a confident zero"). The obligations mirror and people mirror may simply be empty for this profile; the screen cannot tell the reader which.
7. **Hidden facts on the row.** Grant rows drop project, funder, fit, Jev verdict, close date, entity eligibility; funder rows drop the project they matched, so Reichstein ×2, Mary MacKillop ×3, Colonial Foundation ×4, Community Broadcasting ×4, MINDEROO PICTURES ×3 look like duplicates when they are per-project matches (`act-one-desk.ts:198-216`, one row per scan match). "Merge on identifiers, disclose on names" (memory `feedback_disclose_dont_hide`) wants the distinguishing fact printed beside the repeated name.
8. **Money that is not `money()`.** `$22039K`, `$12610K`, `$0K`; 33 local formatters under `/org` (§4).
9. **Sub-11px type** everywhere on the desk and rail (§2.5).
10. **Raw palette and hex** (81 + 34 files under `/org`); a new file with any raw palette class fails `palette-ratchet.test.ts:48-58`.
11. **Soft shadows and hover lifts** in the retired green family (`funding/page.tsx:38,61,106`); allowed by the ratchet inside `/org` but off the sanctioned families.
12. **Browser dialogs** for a required reason (`desk-obligation-buttons.tsx:21` `window.prompt`).
13. **Lenses that vanish on a phone** (§6.4) and a floating test-guide pill that covers list rows on every ACT page.
14. **Vague endings**: any "say the word"; every gated action needs its exact phrase (memory `feedback_explicit_action_menus`, `feedback_end_with_the_action`).

---

## 10. Judgement: what the new surface should obey

- **Live at `/org/act/…`**, inside `ActWorkspaceShell`, on `ql-*` tokens and `--ws-*` vars, `font-ql-display` for the one heading, `font-ql-mono` for figures, hairline `border-ql-border`, radius ≤ `rounded-md`, no shadow. This is the family the desk, orgs, people and the two desk button components already speak, and the only one the memory rulings were made on.
- **Reuse:** `ActWorkspaceShell` (add the new lenses under the right rail entry, not a header chip row), `getOneDesk` / `DeskRecord` (extend, do not fork: add `projectCode`, `fitKeyword`, `fitJev`, `taggedBy`, `closeDate`, `provider`, numeric `amountMin/Max`, `eligibility`), `Due`/`KindChip` (lift them out of `desk/page.tsx` into `_components/desk-ui.tsx` so a second page can import rather than redefine, the same move `browse-ui.tsx` made), `money()` from `lib/format`, `SourceLine`/`Stat`'s "says what it counts" discipline (`components/data`, which soften correctly inside `.ws`).
- **Row contract for a grant** (handoff `thoughts/shared/handoffs/act-grant-desk/current.md:28`): project · fit shown as keyword AND Jev with which one tagged it · deadline (date + days) · amount via `money()` · which ACT entity can apply · next action with the verbs **Pursue → GHL** and **Pass** on top, Done/Waiting/Tomorrow demoted or gone for decision rows.
- **Disclose, don't filter:** print the hidden count and the fit bar where the list is (the grants desk's "1,583 hidden · show everything" sentence is the right shape), print the horizon rule ("No date, or more than 90 days out") instead of "No date".
- **Do not** add a fourth header, a `.shell` rail, shadcn `.ui` parts, or another local `money`.

---

## 11. Gaps

- `pencil-new.pen`, the stated source of truth for the `ql-*` tokens (`globals.css:8`), is not in the repo; `Grantscope.pen` is untracked and was not opened (encrypted; needs the Pencil MCP). Whether the two agree is unknown.
- I did not open the other grant surfaces named in the handoff (`/org/act/pipeline`, `/org/act/intelligence`, `/org/act/goods/grants`, `/org/act/goods/foundations`, `/ops/grant-recommendations`, `/home`, `[projectSlug]`) beyond confirming they exist; their vocabularies are inferred from the census, not read.
- `apps/web/.env.local` sets `SKIP_AUTH_LOCAL`; what a real signed-in session shows (admin banner, impersonation) was not exercised.
- Whether the "0 owed · 0 people" zeros are empty mirrors or a broken read was not traced (`getDeskObligations`, `getDeskPeople` not read).
- No production screenshot: `civicgraph.app` answers 429 to curl and the brief said local.
