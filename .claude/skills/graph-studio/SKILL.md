---
name: graph-studio
description: "Brainstorm and evolve the /graph visualization — storytelling, data layers, interaction design, and new graph modes"
metadata:
  author: civicgraph
  version: "0.1.0"
---

# Graph Studio — Design & Ideation for /graph

A creative workspace for evolving the CivicGraph force-directed graph visualization. Use this skill when you want to brainstorm what the graph should show, how it should feel, what stories it should tell, and what new modes or data layers to add.

## When to Use

- `/graph-studio` — open-ended brainstorm about graph directions
- `/graph-studio storytelling` — focus on narrative and annotation ideas
- `/graph-studio mode <name>` — design a specific new graph mode
- `/graph-studio review` — screenshot the current graph and critique it

## Process

### 1. Ground in Current State

Read the current implementation to understand what exists:

```
apps/web/src/app/graph/page.tsx          — Frontend (react-force-graph-2d)
apps/web/src/app/api/data/graph/route.ts — API (hubs, justice, edge-first modes)
```

Check memory for the latest graph context:
```
~/.claude/projects/-Users-benknight-Code-grantscope/memory/MEMORY.md  (## Graph Visualization section)
```

### 2. Understand the Data Landscape

Query what's available to visualize:

```bash
# Entity types and counts
node --env-file=.env scripts/gsql.mjs "SELECT entity_type, COUNT(*) FROM gs_entities GROUP BY entity_type ORDER BY count DESC"

# Relationship datasets
node --env-file=.env scripts/gsql.mjs "SELECT dataset, COUNT(*), SUM(amount)::bigint FROM gs_relationships GROUP BY dataset ORDER BY count DESC"

# Justice funding topics
node --env-file=.env scripts/gsql.mjs "SELECT unnest(topics) as topic, COUNT(*) FROM justice_funding GROUP BY topic ORDER BY count DESC"

# ALMA intervention types
node --env-file=.env scripts/gsql.mjs "SELECT type, COUNT(*) FROM alma_interventions GROUP BY type ORDER BY count DESC"

# ALMA evidence levels
node --env-file=.env scripts/gsql.mjs "SELECT evidence_level, COUNT(*) FROM alma_interventions WHERE evidence_level IS NOT NULL GROUP BY evidence_level ORDER BY count DESC"
```

### 3. Brainstorm Framework

Structure ideation around these dimensions:

#### Stories the Graph Can Tell
What questions should a user be able to answer by looking at the graph?
- "Who are the biggest funders in youth justice?"
- "Which orgs receive from multiple programs?" (cross-funding)
- "Where are the evidence gaps?" (funded but no ALMA evidence)
- "How does funding flow differently in remote vs metro areas?"
- "Which Indigenous community-controlled orgs are in the network?"

#### Data Layers That Could Be Added
Each layer adds visual information without changing the graph structure:
- **Funding amount** → node size or edge thickness
- **Evidence level** → ring color intensity (strong evidence = bright, untested = faint)
- **Geography** → cluster by state, color by remoteness
- **Time** → animate by financial year, show funding appearing/disappearing
- **Cross-system** → orgs that appear in multiple datasets (justice + contracts + donations)

#### Interaction Patterns
How users explore and drill down:
- Click program hub → filter to just that program's recipients
- Click org → show all its connections across datasets
- Hover → rich tooltip with funding breakdown
- Search → find and zoom to specific org
- Filter panel → toggle entity types, minimum funding, state, evidence level

#### New Graph Modes to Consider
- `mode=place` — geographic graph, nodes = postcodes/LGAs, edges = funding flows between places
- `mode=evidence` — ALMA-centered, interventions as hubs, linked orgs as spokes, colored by evidence level
- `mode=crosssystem` — orgs that appear in 3+ datasets, showing all their different relationship types
- `mode=political` — political donations + government contracts, showing donor→party→contract flows
- `mode=timeline` — same graph but with a year slider, edges fade in/out by financial year

#### Visual & Aesthetic Ideas
The graph should feel like looking at a living system, not a static diagram:
- Particle effects along edges (funding "flowing")
- Breathing/pulsing for nodes receiving active funding
- Constellation mode — zoom out and the graph looks like a star map
- Heat overlay — areas of dense funding glow warm, sparse areas are dark
- Story mode — guided tour that zooms between clusters with narration

### 4. Output Format

After brainstorming, produce:

1. **Top 3 Ideas** — the highest-impact things to build next, ranked by:
   - Story value (does it reveal something non-obvious?)
   - Data readiness (can we build it with existing data?)
   - Visual impact (will it look impressive?)

2. **Quick Wins** — things that could be done in <30 minutes each

3. **Moonshots** — ambitious ideas that would take longer but be transformative

4. **Updated Memory** — save any new ideas/decisions to the Graph Visualization section of MEMORY.md

### 5. If Mode is "review"

Take a screenshot of the current graph and provide specific visual feedback:

```bash
# Warm up then screenshot
curl -s -o /dev/null "http://localhost:3003/graph" --max-time 60
B=$(~/.claude/skills/browse/bin/find-browse) && $B goto "http://localhost:3003/graph" && sleep 25 && $B screenshot /tmp/graph-review.png
```

Critique:
- Layout: Are clusters well-separated? Can you read labels?
- Color: Are entity types distinguishable? Does ALMA evidence stand out?
- Density: Too sparse? Too cluttered? Right balance?
- Story: What story does the current view tell at first glance?
- Polish: What small visual tweaks would elevate it?

## Key Context

### Current Graph Modes
| Mode | Data Source | Hub Type | Typical Size |
|------|-----------|----------|-------------|
| `justice` | `justice_funding` table | Programs (diamond) | 811 nodes, 1,596 edges |
| `hubs` | `gs_relationships` | Top-connected entities | 4,592 nodes, 6,091 edges |
| edge-first | `gs_relationships` | None (top by amount) | ~2,500 nodes, 10K edges |

### Available Data for New Modes
| Table | Rows | Graph Potential |
|-------|------|----------------|
| `gs_entities` | 100K | Node source for all modes |
| `gs_relationships` | 199K | Edge source (but justice edges are self-loops!) |
| `justice_funding` | 52K | Program→recipient edges (real connections) |
| `alma_interventions` | 1.2K | Evidence overlay, 484 youth-justice tagged |
| `austender_contracts` | 672K | Government procurement edges |
| `political_donations` | 312K | Political money flow edges |
| `foundations` | 10.8K | Foundation grantmaking |

### Justice Funding Self-Loop Problem
`gs_relationships` where `dataset='justice_funding'` has 34,853 self-loops out of 34,857 edges. These are useless for graph visualization. The justice mode queries `justice_funding` table directly to build real program→recipient edges.

### Topic Tags Available
youth-justice, child-protection, ndis, family-services, indigenous, legal-services, diversion, prevention, wraparound, community-led
