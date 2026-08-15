# Installed visualization libraries (verified from package.json, 2026-08-14)

## GrantScope — apps/web/package.json
- leaflet ^1.9.4 + react-leaflet ^5.0.0 + @types/leaflet   → maps
- react-force-graph-2d ^1.29.1 / react-force-graph-3d ^1.29.1 → network graphs
- recharts ^3.7.0 → charts

## JusticeHub — package.json (richer)
- @tanstack/react-query ^5.17.0
- cytoscape ^3.33.1 (+types) → graph
- d3 ^7.9.0 (+types), d3-sankey ^0.12.3 (+types) → custom viz, money flows
- leaflet ^1.9.4 + react-leaflet ^4.2.1, maplibre-gl ^4.7.1 → maps (two stacks!)
- react-force-graph-2d ^1.29.0
- recharts ^3.6.0

## Implication for the build
Build the CivicGraph catalog/map on what GrantScope ALREADY has:
**recharts** (charts) · **react-force-graph-2d** (network) · **leaflet** (maps).
The only likely justified addition is **d3-sankey** for funder→intermediary→delivery→place
money flow, and it is already proven in JusticeHub so the pattern can be copied rather than invented.
Note react-leaflet is on v5 in GrantScope but v4 in JusticeHub — components are NOT portable
between the two without adjustment.
