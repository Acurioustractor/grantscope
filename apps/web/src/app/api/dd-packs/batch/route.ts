import { NextRequest, NextResponse } from 'next/server';
import { assembleDueDiligencePack } from '@/lib/services/due-diligence-service';
import { buildDueDiligencePdf } from '@/lib/due-diligence-pdf';

// Pre-built collections — curated entity lists for sales outreach
const COLLECTIONS: Record<string, { name: string; description: string; gsIds: string[] }> = {
  'prf-portfolio': {
    name: 'Paul Ramsay Foundation — Justice Reinvestment Portfolio',
    description: 'PRF\'s 15 grant partners across their $53.1M justice reinvestment portfolio (2021-2025). 10 site-level, 5 advocacy/enabling.',
    gsIds: [
      'AU-ABN-82646525135',  // Maranguka (Bourke)
      'AU-ABN-37751526982',  // Just Reinvest NSW
      'AU-ABN-47629577245',  // Olabud Doogethu (Kimberley)
      'AU-ABN-31117719267',  // Human Rights Law Centre
      'AU-ABN-53685983831',  // Tiraapendi Wodli
      'AU-ABN-68640446448',  // Justice Reform Initiative
      'AU-ABN-36678640214',  // Justice Reinvestment Network Australia
      'AU-ABN-69806855472',  // Anindilyakwa Royalties Aboriginal Corporation
      'AU-ABN-38136101379',  // Social Reinvestment WA
      'AU-ABN-77002773524',  // Justice and Equity Centre
      'AU-ABN-19556236404',  // NTCOSS
      'AU-ABN-50169561394',  // Australian Red Cross (Tiraapendi Wodli partner)
    ],
  },
  'prf-plus-sites': {
    name: 'PRF Portfolio + Key JR Site Orgs',
    description: 'Extended PRF portfolio including site-level organisations from Appendix B.',
    gsIds: [
      // Core PRF partners
      'AU-ABN-82646525135',  // Maranguka
      'AU-ABN-37751526982',  // Just Reinvest NSW
      'AU-ABN-47629577245',  // Olabud Doogethu
      'AU-ABN-31117719267',  // Human Rights Law Centre
      'AU-ABN-53685983831',  // Tiraapendi Wodli
      'AU-ABN-68640446448',  // Justice Reform Initiative
      'AU-ABN-36678640214',  // Justice Reinvestment Network Australia
      'AU-ABN-69806855472',  // Anindilyakwa Royalties
      'AU-ABN-38136101379',  // Social Reinvestment WA
      'AU-ABN-77002773524',  // Justice and Equity Centre
      'AU-ABN-19556236404',  // NTCOSS
      // Key site-level orgs from Appendix B
      'AU-ABN-30023616686',  // Blacktown Youth Services (Mount Druitt)
      'AU-ABN-24719196762',  // Berry Street Victoria
      'AU-ABN-97397067466',  // Anglicare Victoria
      'AU-ABN-24603467024',  // Brotherhood of St Laurence
      'AU-ABN-98302021142',  // Central Australian Aboriginal Family Legal Unit
      'AU-ABN-33266090956',  // Ballarat & District Aboriginal Cooperative
      'AU-ABN-44535341885',  // Ebenezer Aboriginal Corporation
      'AU-ABN-18068557906',  // Barnardos Australia
    ],
  },
};

export async function GET(request: NextRequest) {
  const collection = request.nextUrl.searchParams.get('collection');
  const gsIdsParam = request.nextUrl.searchParams.get('ids');
  const format = request.nextUrl.searchParams.get('format') || 'json';

  // List available collections
  if (!collection && !gsIdsParam) {
    return NextResponse.json({
      collections: Object.entries(COLLECTIONS).map(([key, val]) => ({
        key,
        name: val.name,
        description: val.description,
        entityCount: val.gsIds.length,
      })),
      usage: 'GET /api/dd-packs/batch?collection=prf-portfolio&format=json|summary',
    });
  }

  let gsIds: string[];
  let collectionName: string;

  if (collection && COLLECTIONS[collection]) {
    gsIds = COLLECTIONS[collection].gsIds;
    collectionName = COLLECTIONS[collection].name;
  } else if (gsIdsParam) {
    gsIds = gsIdsParam.split(',').map(id => id.trim()).filter(Boolean);
    collectionName = `Custom (${gsIds.length} entities)`;
  } else {
    return NextResponse.json({ error: `Unknown collection: ${collection}` }, { status: 400 });
  }

  // Single PDF download mode: ?collection=X&format=pdf&entity=GS-ID
  const singleEntity = request.nextUrl.searchParams.get('entity');
  if (format === 'pdf' && singleEntity && gsIds.includes(singleEntity)) {
    try {
      const pack = await assembleDueDiligencePack(singleEntity);
      if (!pack) return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
      const { bytes, filename } = await buildDueDiligencePdf(pack);
      return new Response(Buffer.from(bytes), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'private, max-age=300',
        },
      });
    } catch (err) {
      return NextResponse.json({ error: String(err), stack: err instanceof Error ? err.stack : undefined }, { status: 500 });
    }
  }

  // Generate packs in sequence (avoid overwhelming DB)
  const results: Array<{
    gsId: string;
    name: string;
    status: 'success' | 'not_found' | 'error';
    pack?: Record<string, unknown>;
    error?: string;
  }> = [];

  for (const gsId of gsIds) {
    try {
      const pack = await assembleDueDiligencePack(gsId);
      if (!pack) {
        results.push({ gsId, name: gsId, status: 'not_found' });
        continue;
      }

      if (format === 'pdf') {
        const { filename } = await buildDueDiligencePdf(pack);
        results.push({
          gsId,
          name: pack.entity.canonical_name,
          status: 'success',
          pack: {
            entity: pack.entity,
            integrity_flags: pack.integrity_flags,
            stats: pack.stats,
            pdfUrl: `/api/entities/${gsId}/due-diligence?format=pdf`,
            filename,
          },
        });
      } else {
        results.push({
          gsId,
          name: pack.entity.canonical_name,
          status: 'success',
          pack: format === 'summary' ? {
            entity: pack.entity,
            stats: pack.stats,
            integrity_flags: pack.integrity_flags,
            funding: { total: pack.funding.total, record_count: pack.funding.record_count },
            contracts: { total: pack.contracts.total, record_count: pack.contracts.record_count },
            donations: { total: pack.donations.total, record_count: pack.donations.record_count },
            alma_interventions: pack.alma_interventions.length,
            financialYears: pack.financials.length,
            data_sources: pack.data_sources,
          } : pack as unknown as Record<string, unknown>,
        });
      }
    } catch (err) {
      results.push({
        gsId,
        name: gsId,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }

  const successful = results.filter(r => r.status === 'success').length;
  const notFound = results.filter(r => r.status === 'not_found').length;

  return NextResponse.json({
    collection: collectionName,
    generated: new Date().toISOString(),
    summary: { total: gsIds.length, successful, notFound, errors: results.length - successful - notFound },
    results,
  }, {
    headers: { 'Cache-Control': 'private, max-age=60' },
  });
}
