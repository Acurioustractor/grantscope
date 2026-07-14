import { NextResponse } from 'next/server';
import {
  getActPeopleDirectory,
  getActPersonHistory,
  type ActPeopleFilter,
} from '@/lib/services/act-people-directory';
import { requireOrgAccess } from '../../_lib/auth';

type RouteContext = { params: Promise<{ orgProfileId: string }> };

const FILTERS = new Set<ActPeopleFilter>(['attention', 'connected', 'money', 'unresolved', 'all']);

function positiveInteger(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request, context: RouteContext) {
  const { orgProfileId } = await context.params;
  const auth = await requireOrgAccess(orgProfileId);
  if (auth instanceof NextResponse) return auth;

  const params = new URL(request.url).searchParams;
  const person = params.get('person')?.trim();
  if (person) {
    return NextResponse.json({ history: await getActPersonHistory(orgProfileId, person) });
  }

  const requestedFilter = params.get('filter') as ActPeopleFilter | null;
  const filter = requestedFilter && FILTERS.has(requestedFilter) ? requestedFilter : 'attention';

  return NextResponse.json(await getActPeopleDirectory(orgProfileId, {
    query: params.get('q')?.slice(0, 160) ?? '',
    filter,
    page: positiveInteger(params.get('page'), 1),
    pageSize: positiveInteger(params.get('page_size'), 60),
  }));
}
