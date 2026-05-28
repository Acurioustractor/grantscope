import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const revalidate = 3600;

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'CivicGraph Public API',
    version: '1.0.0',
    description: 'Public-good intelligence on Australian funding flows and entity influence.',
    license: { name: 'CC-BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    contact: { email: 'feedback@civicgraph.au' },
  },
  servers: [{ url: 'https://civicgraph.au' }],
  paths: {
    '/api/v1/public/funding-deserts': {
      get: {
        summary: 'List Australian LGAs by funding-desert score',
        parameters: [
          { name: 'state', in: 'query', schema: { type: 'string', enum: ['NSW','VIC','QLD','WA','SA','TAS','NT','ACT'] } },
          { name: 'remoteness', in: 'query', schema: { type: 'string' } },
          { name: 'min_decile', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 10 } },
          { name: 'max_decile', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 10 } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['desert_score', 'total_funding', 'indexed_entities'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 25, maximum: 500 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          { name: 'lga', in: 'query', schema: { type: 'string' }, description: 'If supplied, returns one LGA matching this name (pair with state).' },
        ],
        responses: { '200': { description: 'Paginated list with meta + data' }, '429': { description: 'Rate-limited (60 req/min)' } },
      },
    },
    '/api/v1/public/revolving-door': {
      get: {
        summary: 'Entities active across 2+ influence vectors',
        parameters: [
          { name: 'state', in: 'query', schema: { type: 'string' } },
          { name: 'vector', in: 'query', schema: { type: 'string', enum: ['lobbies', 'donates', 'contracts', 'receives_funding'] } },
          { name: 'min_vectors', in: 'query', schema: { type: 'integer', minimum: 2, maximum: 4 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 25, maximum: 500 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { '200': { description: 'List of entities with vector flags + dollar footprints' } },
      },
    },
    '/api/v1/public/entity/{abn}': {
      get: {
        summary: 'Entity profile by ABN (registry + revolving-door + power-index summary)',
        parameters: [{ name: 'abn', in: 'path', required: true, schema: { type: 'string', pattern: '^[0-9]{11}$' } }],
        responses: { '200': { description: 'Entity record with cross-system summary' }, '404': { description: 'Not found' } },
      },
    },
    '/api/v1/public/grants': {
      get: {
        summary: 'Open grant opportunities',
        parameters: [
          { name: 'category', in: 'query', schema: { type: 'string' } },
          { name: 'min_amount', in: 'query', schema: { type: 'integer' } },
          { name: 'dgr_required', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 25, maximum: 200 } },
          { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
        ],
        responses: { '200': { description: 'List of open grants' } },
      },
    },
  },
};

export async function GET() {
  return NextResponse.json(spec, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
