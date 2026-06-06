import { NextResponse } from 'next/server';
import {
  GIVING_SCHEMA_VERSION,
  PUBLIC_DATASET_KEYS,
  PUBLIC_DATASETS,
  PUBLIC_SNAPSHOT_DATE,
  correctionUrl,
  withCorsHeaders,
} from '@/lib/giving-commons';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: withCorsHeaders() });
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const rows = PUBLIC_DATASET_KEYS.map((key) => {
    const dataset = PUBLIC_DATASETS[key];
    return {
      dataset_key: key,
      label: dataset.label,
      table_name: dataset.table,
      domain: dataset.domain,
      description: dataset.description,
      public_export: true,
      pii_level: dataset.piiLevel,
      source: dataset.source,
      source_url: dataset.sourceUrl,
      source_owner: dataset.sourceOwner,
      licence: dataset.licence,
      collection_method: dataset.collectionMethod,
      update_cadence: dataset.updateCadence,
      caveats: dataset.caveats,
      correction_url: correctionUrl(origin),
    };
  });

  const response = NextResponse.json({
    schema_version: GIVING_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    snapshot_date: PUBLIC_SNAPSHOT_DATE,
    count: rows.length,
    rows,
  });

  response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  withCorsHeaders(response.headers);
  return response;
}
