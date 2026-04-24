import { NextResponse } from 'next/server';
import { TRACKER_STATE_META } from '../../../../tracker-meta';
import { getSiteDossierBySlug } from '../../site-dossier';

export const revalidate = 3600;

export async function GET(
  _request: Request,
  context: { params: Promise<{ state: string; siteSlug: string }> },
) {
  const { state, siteSlug } = await context.params;
  const stateKey = state.toLowerCase();
  const meta = TRACKER_STATE_META[stateKey];
  if (!meta) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const dossier = await getSiteDossierBySlug({
    stateKey,
    stateAbbr: meta.abbr,
    stateName: meta.name,
    siteSlug,
  });

  if (!dossier) {
    return new NextResponse('Not Found', { status: 404 });
  }

  return new NextResponse(dossier.markdownBrief, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${siteSlug}-site-dossier.md"`,
      'Cache-Control': 'no-store',
    },
  });
}
