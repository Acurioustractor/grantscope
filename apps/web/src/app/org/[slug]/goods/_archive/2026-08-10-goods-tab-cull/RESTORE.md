# Goods tab cull — 2026-08-10

Four Goods screens moved out of the route tree (Ben approved the kill list, 2026-08-10).
They are **moved, not deleted**. The `_archive` folder is underscore-prefixed, so Next.js does
not route it — the code is intact but the URLs 404.

| Screen | Why it was cut |
|---|---|
| `we-owe` | `act_obligations` has **0 rows**. The screen rendered empty. |
| `model` | 28 lines; a thin wrapper around another screen's content. |
| `pitch` | Deck content, not weekly work. Belongs inside `proof`. |
| `foundations-scan` | Second door to `foundations` for the same job. |

## Restore one

```bash
cd apps/web/src/app/org/\[slug\]/goods
git mv _archive/2026-08-10-goods-tab-cull/we-owe we-owe          # or model / pitch
git mv _archive/2026-08-10-goods-tab-cull/foundations-scan foundations/scan
```

Then re-add its entry to `GOODS_RAIL_SECTIONS` in
`apps/web/src/app/org/[slug]/_components/act-workspace-shell.tsx`, to the relevant tab list in
`_components/goods-sub-nav.tsx`, and to `MORE_SCREENS` in `goods/page.tsx`.

**Before restoring `we-owe`, check the data first** — it is only worth a screen once
`act_obligations` has rows:

```bash
node --env-file=.env scripts/gsql.mjs "SELECT count(*) FROM act_obligations"
```
