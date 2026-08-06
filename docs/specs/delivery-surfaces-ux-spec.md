# UX spec: Delivery surfaces — the "We owe" tab

Build-ready spec for wayfinder [#155](https://github.com/Acurioustractor/grantscope/issues/155),
part of map #143. Consumes Obligation vocabulary (#147), Supabase-native
ownership (#151 / ADR 0003), desk thresholds (#152), and row shapes (#150).
Domain contract: `CONTEXT.md` → "Delivery surfaces". Skin: Quiet Ledger.

## 1. Route and scope

- **`/org/act/<project>/we-owe`** — one new tab per project workspace, named
  with the chip word (**We owe**). Per-project, matching #149: a Goods
  acquittal lives in the Goods workspace. No org-wide obligations surface.
- Layout: **split pane** (list left, detail right, `?rec=` selection) — the
  same pattern as One Desk and /people. Desk Obligation rows link to
  `/org/act/<project>/we-owe?rec=<id>` (supersedes the
  `/obligations/<id>` guess in the desk spec §7 — update on build).
- Data: Supabase-native (ADR 0003). No GHL involvement, no sync, no stale
  badges. Reads and writes are direct.

## 2. List

Row grammar = the desk's Obligation rows (#150 Variant B), full pool (no 30d
threshold here — the tab shows every open Obligation; the threshold only
gates the desk):

```
[we owe]  Acquittal — Snow capital block      → funder      12d
[we owe]  Return the trailer to Anyinginyi    → community   3d overdue
[we owe]  Quarterly yarn with the rangers     → community   —
```

- Ordering: overdue first, then by due date, then undated (newest-minted
  first). Horizon band headers as on the desk; undated band labelled
  **"No date — date it or drop it"**.
- Rail filters: `owed to` (funder / community) · state (`Open` default;
  `Done` / `Dropped` views for the record) · owner.
- Header count line: `N open · M overdue · K undated`, plus discharged
  count for the trailing 90d ("12 done this quarter") — the tab doubles as
  the honest delivery record.

## 3. Detail pane

1. **Header**: `we owe` chip + owed-to tag + `Due` + state. Title in display
   type; owner + minted-date + source on a muted line ("minted from
   **Snow capital Ask** · 2026-08-06" — Ask name links to its GHL card /
   workspace record; community promises show "recorded by <owner>").
2. **Next move box** (same warm box): next action text + due. Edit inline.
3. **Artefact link** (optional field): the Notion doc this Obligation
   discharges into (report, acquittal). Notion owns the artefact (ADR 0003);
   this is a link, never embedded content.
4. **Actions**: **Done** (one click, records discharged-at) · **Dropped**
   (one-line confirm stating who's disappointed: "This releases a promise to
   <funder|community>. Record why:" — reason required for `community`,
   optional for `funder`; Dropped rows keep the reason visible) · **Edit**
   (title, due, owner, owed-to, artefact link).
5. Done/Dropped are terminal (#147). No stages, no reopen in v1 — a
   resurfaced promise is a new mint (link the old row).

## 4. Mint flows

**Minting = acknowledging the promise, not starting work (#147). Always
human; nothing auto-creates.**

### 4a. Mint-on-Won batch modal
Marking an Ask **Won** (desk detail, workspace, or wherever stage changes
surface) opens a modal:

- Header: "<Ask name> is Won — what do we now owe?"
- A repeatable row editor: title · owed-to (default `funder`) · due date
  (optional) · owner (default the Ask owner). `+ add another` for multi-
  obligation grants (progress report + final acquittal + community delivery).
- **Skippable** — `None owed` (records an explicit none-owed flag, clearing
  the mismatch) and `Later` (dismisses; the Ask becomes a mismatch, §5).
- On submit: insert rows, land in the project's We-owe tab; anything due
  ≤ 30d or undated hits the desk immediately (#152).

### 4b. Community promise mint
`+ We owe something` button on the We-owe tab: same row editor, single row,
owed-to defaults `community`, plus a free-text "promised to" (person/org
picker optional — link a Person if the promise is to a known human).

## 5. Won-without-Obligations mismatch

Same pattern as warm-but-unworked. A Won Ask with zero Obligations and no
explicit none-owed flag is a standing mismatch:

- **Desk decision row**: kind `grant`-style decision framing — name = the Ask,
  `decide` pill, next = "mint what we owe, or mark none owed". Resolving
  opens the §4a modal. On the desk from the day Won lands (no threshold —
  a fresh Won is exactly when terms are in hand).
- **Tab banner**: atop the project's We-owe tab, one line per unminted Won
  ("Snow capital block is Won with nothing minted — mint / none owed").
- The none-owed flag is reversible from the Ask's record (things change).

## 6. Desk handshake

- Desk shows only overdue / ≤ 30d / undated Obligations (#152); this tab is
  the full pool and the only place Done/Dropped history lives.
- Done/Dropped from the desk pane and from this tab are the same endpoint.
- Desk `Open in delivery workspace →` targets this tab with `?rec=`.

## 7. Empty/edge states

- Empty tab: "Nothing owed on <project>." + `+ We owe something` + (if any
  unminted Wons) the mismatch banner — the banner renders even when the list
  is empty, that's its whole point.
- Undated Open rows never hide anywhere (per #152); the band label carries
  the nudge.

## Out of scope

Backfill of historical Wons (#156 decides the prompt list); Submitted-vs-
Acquitted sub-states (must earn their way in, #147); recurring/templated
obligations; any Xero linkage (dollars are Xero's story).
