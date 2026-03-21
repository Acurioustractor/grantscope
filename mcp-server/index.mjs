#!/usr/bin/env node

/**
 * CivicGraph MCP Server
 *
 * Exposes CivicGraph intelligence as MCP tools for AI agents.
 * Wraps the /api/agent endpoint into tool calls.
 *
 * Usage:
 *   CIVICGRAPH_URL=http://localhost:3003 node mcp-server/index.mjs
 *
 * Install in Claude Code:
 *   claude mcp add civicgraph -- node /path/to/grantscope/mcp-server/index.mjs
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const BASE_URL = process.env.CIVICGRAPH_URL || 'http://localhost:3003';

async function callAgent(body) {
  const res = await fetch(`${BASE_URL}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `API error ${res.status}`);
  }
  return data;
}

const TOOLS = [
  {
    name: 'civicgraph_search',
    description:
      'Search Australian entities (companies, charities, Indigenous corps, government bodies) by name or ABN. Returns power scores, cross-system presence, and dollar flows. 560K+ entities indexed.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Entity name or ABN to search for' },
        state: { type: 'string', description: 'Filter by AU state (NSW, VIC, QLD, WA, SA, TAS, ACT, NT)', enum: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] },
        limit: { type: 'number', description: 'Max results (1-50, default 10)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'civicgraph_entity',
    description:
      'Get full entity profile — power score, 7-system presence (procurement, justice, donations, charity, foundation, evidence, tax), board members, dollar flows. Provide gs_id or ABN.',
    inputSchema: {
      type: 'object',
      properties: {
        gs_id: { type: 'string', description: 'CivicGraph entity ID (e.g. AU-ABN-48123123124)' },
        abn: { type: 'string', description: 'Australian Business Number (11 digits)' },
      },
    },
  },
  {
    name: 'civicgraph_power_index',
    description:
      'Top entities ranked by cross-system power score. Spans 7 systems: procurement ($74B+), justice funding, political donations, charity registry, foundations, ALMA evidence, ATO tax data.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (1-50, default 10)' },
        state: { type: 'string', description: 'Filter by AU state', enum: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] },
        min_systems: { type: 'number', description: 'Minimum number of systems entity appears in (1-7, default 1)' },
      },
    },
  },
  {
    name: 'civicgraph_funding_deserts',
    description:
      'Most underserved local government areas in Australia. Scored by SEIFA disadvantage index, remoteness, and funding shortfall. Identifies where money doesn\'t flow.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Filter by AU state', enum: ['NSW', 'VIC', 'QLD', 'WA', 'SA', 'TAS', 'ACT', 'NT'] },
        limit: { type: 'number', description: 'Max results (1-50, default 10)' },
      },
    },
  },
  {
    name: 'civicgraph_revolving_door',
    description:
      'Entities with multiple influence vectors — lobbying, political donations, AND government contracts. Cross-referenced automatically. Reveals potential conflicts of interest.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max results (1-50, default 10)' },
      },
    },
  },
  {
    name: 'civicgraph_ask',
    description:
      'Ask any question about Australian government spending in plain English. CivicGraph generates SQL, executes it across all datasets (contracts, grants, donations, charities, tax), and returns structured results with an AI explanation.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language question about Australian government, procurement, funding, or entities' },
      },
      required: ['query'],
    },
  },
];

// Map tool names to agent API actions
const TOOL_TO_ACTION = {
  civicgraph_search: 'search',
  civicgraph_entity: 'entity',
  civicgraph_power_index: 'power_index',
  civicgraph_funding_deserts: 'funding_deserts',
  civicgraph_revolving_door: 'revolving_door',
  civicgraph_ask: 'ask',
};

const server = new Server(
  { name: 'civicgraph', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const action = TOOL_TO_ACTION[name];
  if (!action) {
    throw new Error(`Unknown tool: ${name}`);
  }

  try {
    const result = await callAgent({ action, ...args });
    return {
      content: [{ type: 'text', text: JSON.stringify(result.data, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`CivicGraph MCP server running (${BASE_URL})`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
