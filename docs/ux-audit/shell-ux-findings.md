# Shell + Browse surfaces — UX findings (pass 1, 2026-08-18)

Audited logged-in shell at 1280×900 on 3013: dashboard, people (+drawer), places, grants,
donations, entities search. Shots in `docs/ux-audit/shots/shell-0*.png`. Judged against
DESIGN.md (softened `.shell` scope) + the five questions. Ranked by first-impression damage.

## Findings (ranked)

**SH-1 · Grants: a literal "(blank)" recipient ranks #9 with 286 grants / $265.4M — M, data-honesty.**
The name blocklist catches 'total'/'various' but not '(blank)'. Either add it to the
NON_RECIPIENT_NAMES family (SQL + justice-money.ts, keeping parity) or surface as
"name missing in source" — silent rank pollution is exactly what the filters exist to stop.

**SH-2 · Dashboard: the remoteness chart is one giant black bar — M, value-shown.**
Major cities $1,003bn vs Very remote $11.5bn on a linear scale = four invisible bars and no
story. This is the ledger's F5 "chart-as-shares" item: render as % shares with the dollar in
the label, or log-ish scaled bars with the share printed. The chart currently *hides* the
inequity it exists to show.

**SH-3 · Rail: Browse entries have no active state — M, clarity.**
On /dashboard/browse/* and sub-pages the rail highlights "Dashboard", not the Browse entry
you're in. The NAV group derives active-by-longest-prefix; the Browse + Ops groups are plain
Links. Extend RailNav's pathname logic to them.

**SH-4 · Header title is static "Dashboard" on every page — S, clarity.**
People/Places/Grants all show "Dashboard" in the shell header (layout-level title). Derive
from pathname or pass per-page.

**SH-5 · Donations top-15 shows three duplicate donor pairs — M, meaning.**
Labor Holdings ×2, Pratt Holdings ×2, Cormack Foundation ×2 (ABN-keyed vs name-keyed rows
split). The caveat admits it, but 3 dupes in the top 15 reads as broken. Fix in RPC: second
grouping pass collapsing normalised names onto the ABN-keyed row.

**SH-6 · Database vocabulary on screen — S, Ben rage-trigger.**
`board_member` (person drawer role list), `government_body` (entities search meta). Humanize:
"board member", "government body" — one small formatter shared by both.

**SH-7 · Donors page sort chip says "CONTRACTS" — S, bug.**
The shared SORTS list wasn't parameterised when itemLabel was; on /browse/donations the
count-sort chip should read "Donations".

**SH-8 · Entities search: raw `&amp;` in names + unranked results — S/M.**
"Global Youth Centre &amp; Gym Inc." renders the entity escape literally (source data);
decode on render. Results are ILIKE-ordered (arbitrary); now that the trigram index exists,
ORDER BY similarity DESC puts the best match first.

**SH-9 · Avatar button overlaps the rail's last saved-view — S, aesthetic.**
The floating "N" circle sits on top of "Power: top 1%" at 900px height. Rail needs bottom
padding clearance (or the avatar belongs in the header only).

**SH-10 · Dashboard "1 grants" pluralisation — S.** Top-recipients list (UnitingCare, "1 grants").

**SH-11 · People list: lowercase display names ("catherine taylor") — S, aesthetic.**
Source-casing leak. Title-case display with the usual surname guards (Mc/Mac/O') or accept
source casing consistently — mixed looks broken.

**SH-12 · Places: desert score scale unexplained — S, copy.**
List shows scores like 185 next to Brisbane-tier 70 with no scale anchor. One clause in the
caveat: "higher = more disadvantage with less money reaching it; scores above ~150 are the
extreme tail."

**SH-13 · Filters/chart contradiction on dashboard — S, friction.**
Topic/year filters say they scope tiles+recipients; the chart beside them states it ignores
them. Correct but confusing. If SH-2 rebuilds the chart, let it accept the topic filter, or
visually separate the all-topics block.

**SH-14 · Person drawer: no scrim, no click-outside close — S, friction.**
All drawers: content behind stays fully interactive-looking; only ✕ closes.

## Decisions Ben owns
- SH-1: exclude '(blank)' entirely vs show as "name missing in source"?
- SH-2: shares-of-total bars vs log scale (taste call — shares recommended).
- SH-11: title-case names vs keep source casing?
