#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/benknight/Code/grantscope"
GOODS_V2="/Users/benknight/Code/Goods Asset Register/v2"

echo ""
echo "Goods Signoff Check"
echo "==================="
echo ""

echo "[1/3] GrantScope typecheck"
(
  cd "$ROOT/apps/web"
  npx tsc --noEmit
)

echo ""
echo "[2/3] Goods v2 build"
(
  cd "$GOODS_V2"
  npm run build
)

echo ""
echo "[3/3] Manual smoke-test routes"
cat <<'EOF'

GrantScope
- http://127.0.0.1:3003/org/act/goods
  - Top workspace strip renders with freshness chips and one recommended focus.
  - Sticky lane nav stays compact and follows the page while scrolling.
  - Pressure Points, Operating Queue, Funder & Capital Routes, Procurement, and Decision Brief all render.
  - Decision Brief collapsible blocks expand and close cleanly.
  - Foundation Contacts shows saved Goods foundations and not an empty state.
  - Pipeline-Matched Foundation Prospects only appears when there are importable pipeline candidates.

Goods v2
- https://www.goodsoncountry.com/admin/qbe-program
  - Discovery intake renders.
  - Identity health card renders.
  - Run identity check works.
  - Backfill review shows linked / needs decision / unmatched / reviewed states.
  - Push to GHL and Open contact / Open People actions render appropriately.
  - Reviewed and undo-reviewed flows are available.

Runtime checks
- In GrantScope, click:
  - Open QBE Program
  - Open Goods Workspace
  - Open foundation
  - Open grant
- In Goods v2, verify:
  - Discovery intake status chips load
  - Backfill target IDs returns counts
  - Manual resolve buttons appear for ambiguous matches when present

If all of the above works, the Goods operating surface is in a signoff-ready state.
EOF
