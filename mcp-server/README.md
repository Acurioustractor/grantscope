# civicgraph-mcp

[MCP](https://modelcontextprotocol.io/) server for [CivicGraph](https://civicgraph.app) — Australian government intelligence for AI agents.

560K entities, 1.5M relationships, 770K contracts, 312K political donations. Cross-referenced by ABN across 11 datasets.

## Quick Start

```bash
npx civicgraph-mcp
```

### With API key (higher rate limits)

Get a key at [civicgraph.app/agent](https://civicgraph.app/agent), then:

```bash
CIVICGRAPH_API_KEY=cg_live_... npx civicgraph-mcp
```

## Install in Claude Code

```bash
claude mcp add civicgraph -- npx civicgraph-mcp
```

With API key:

```bash
claude mcp add civicgraph -- env CIVICGRAPH_API_KEY=cg_live_... npx civicgraph-mcp
```

## Available Tools

| Tool | Description |
|------|-------------|
| `civicgraph_search` | Search entities by name or ABN |
| `civicgraph_entity` | Full entity profile — power score, 7-system presence, board members |
| `civicgraph_power_index` | Top entities by cross-system power score |
| `civicgraph_funding_deserts` | Most underserved LGAs by disadvantage vs funding |
| `civicgraph_revolving_door` | Entities with lobbying + donations + contracts |
| `civicgraph_ask` | Natural language query across all datasets |

## Data Sources

AusTender, AEC donations, ACNC charities, ATO tax transparency, ORIC, justice funding, ALMA evidence, ABR, Lobbying Register, person roles (board members).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CIVICGRAPH_API_KEY` | — | API key for authenticated access |
| `CIVICGRAPH_URL` | `https://civicgraph.app` | Base URL |

## Rate Limits

- **Anonymous:** 20 requests/minute
- **With API key:** 60+ requests/minute

## License

MIT
