import { NextResponse } from 'next/server';
import {
  GIVING_STANDARD,
  PUBLIC_DATASET_KEYS,
  PUBLIC_DATASETS,
  correctionUrl,
  withCorsHeaders,
} from '@/lib/giving-commons';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: withCorsHeaders() });
}

export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const response = NextResponse.json({
    ...GIVING_STANDARD,
    correction_url: correctionUrl(origin),
    datasets: PUBLIC_DATASET_KEYS.map((key) => ({
      key,
      table: PUBLIC_DATASETS[key].table,
      label: PUBLIC_DATASETS[key].label,
      domain: PUBLIC_DATASETS[key].domain,
      public_export: true,
      pii_level: PUBLIC_DATASETS[key].piiLevel,
      fields: PUBLIC_DATASETS[key].select.split(',').map((field) => field.trim()),
      source: PUBLIC_DATASETS[key].source,
      licence: PUBLIC_DATASETS[key].licence,
      caveats: PUBLIC_DATASETS[key].caveats,
    })),
  });

  response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  withCorsHeaders(response.headers);
  return response;
}
