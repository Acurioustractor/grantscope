import { NextRequest, NextResponse } from 'next/server';
import { requireModule } from '@/lib/api-auth';
import { getServiceSupabase } from '@/lib/supabase';
import { getCurrentOrgProfileContext } from '@/lib/org-profile';
import {
  buildGoodsExportRows,
  getGoodsWorkspaceData,
  toCsv,
  type GoodsTargetType,
} from '@/lib/goods-workspace-data';

export const dynamic = 'force-dynamic';

type ExportFormat = 'csv' | 'json' | 'notion';

function toMarkdownTable(rows: Record<string, unknown>[]) {
  if (!rows.length) return '# Goods Outreach Targets\n\n_No rows selected._\n';
  const headers = Object.keys(rows[0]);
  const headerLine = `| ${headers.join(' | ')} |`;
  const divider = `| ${headers.map(() => '---').join(' | ')} |`;
  const body = rows.map((row) =>
    `| ${headers
      .map((header) => String(row[header] ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' '))
      .join(' | ')} |`,
  );
  return ['# Goods Outreach Targets', '', headerLine, divider, ...body].join('\n');
}

export async function GET(request: NextRequest) {
  const auth = await requireModule('supply-chain');
  if (auth.error) return auth.error;
  const { user } = auth;

  const targetType = (request.nextUrl.searchParams.get('targetType') || 'buyer') as GoodsTargetType;
  const format = (request.nextUrl.searchParams.get('format') || 'csv') as ExportFormat;
  const ids = request.nextUrl.searchParams.get('ids')?.split(',').filter(Boolean) || null;
  const sourceIdentityId = request.nextUrl.searchParams.get('sourceIdentityId');
  const focusCommunityId = request.nextUrl.searchParams.get('focusCommunityId');

  if (!['buyer', 'capital', 'partner'].includes(targetType)) {
    return NextResponse.json({ error: 'Invalid target type' }, { status: 400 });
  }

  if (!['csv', 'json', 'notion'].includes(format)) {
    return NextResponse.json({ error: 'Invalid format' }, { status: 400 });
  }

  const serviceDb = getServiceSupabase();
  const orgContext = await getCurrentOrgProfileContext(serviceDb, user.id);
  const data = await getGoodsWorkspaceData(serviceDb, orgContext);
  const rows = buildGoodsExportRows(data, targetType, ids, sourceIdentityId, focusCommunityId);

  if (format === 'json') {
    return NextResponse.json(
      {
        targetType,
        count: rows.length,
        exportedAt: new Date().toISOString(),
        rows,
      },
      {
        headers: {
          'Content-Disposition': `attachment; filename="goods-${targetType}-targets.json"`,
        },
      },
    );
  }

  if (format === 'notion') {
    const markdown = toMarkdownTable(rows as unknown as Record<string, unknown>[]);
    return new NextResponse(markdown, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="goods-${targetType}-targets.md"`,
      },
    });
  }

  return new NextResponse(toCsv(rows as unknown as Record<string, unknown>[]), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="goods-${targetType}-targets.csv"`,
    },
  });
}
