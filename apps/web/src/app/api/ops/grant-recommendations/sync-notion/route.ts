import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';

// Same Notion mapping logic as scripts/sync-act-opportunities-to-notion.mjs.
// Kept duplicated here so the admin button works without shelling out to Node;
// long-form cron should use the CLI script.

import { getServiceSupabase } from '@/lib/supabase';

const STAGE_MAP: Record<string, { stage: string; status: string }> = {
  discovered: { stage: 'Grant Opportunity Identified', status: 'open' },
  watching: { stage: 'Signal', status: 'open' },
  pursuing: { stage: 'Scoping', status: 'open' },
  applied: { stage: 'Application In Progress', status: 'open' },
  submitted: { stage: 'Grant Submitted', status: 'open' },
  won: { stage: 'Paid', status: 'won' },
  lost: { stage: 'Grant Declined', status: 'lost' },
  passed: { stage: 'Composting', status: 'abandoned' },
};

const NOTION_API = 'https://api.notion.com/v1';

interface Recommendation {
  project_code: string;
  project_name: string | null;
  opportunity_id: string;
  opportunity_name: string;
  funder_name: string | null;
  deadline: string | null;
  max_grant_amount: number | null;
  focus_areas: string[] | null;
  source_url: string | null;
  fit_score: number;
  theme_score: number;
  geography_score: number;
  eligibility_score: number;
  timing_score: number;
  flags: string[] | null;
  is_strong_fit: boolean | null;
}

interface DecisionRow {
  project_code: string;
  opportunity_id: string;
  decision: string;
  decided_at: string | null;
  decided_by: string | null;
  notes: string | null;
  notion_page_id: string | null;
  grant_opportunity_id: string | null;
}

function richText(content: string | null | undefined) {
  if (!content) return [];
  return [{ type: 'text', text: { content: String(content).slice(0, 2000) } }];
}

async function notion(token: string, method: string, path: string, body?: unknown) {
  const res = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  return res.json();
}

function buildProperties(rec: Recommendation, decision: DecisionRow | undefined) {
  const map = STAGE_MAP[decision?.decision ?? 'discovered'] ?? STAGE_MAP.discovered;
  const props: Record<string, unknown> = {
    Name: { title: richText(rec.opportunity_name) },
    Pipeline: { select: { name: 'Grants' } },
    Project: { multi_select: [{ name: rec.project_code }] },
    Stage: { select: { name: map.stage } },
    Status: { select: { name: map.status } },
    'Org Name': { rich_text: richText(rec.funder_name ?? '') },
    'Last Synced': { date: { start: new Date().toISOString() } },
  };
  if (rec.max_grant_amount != null) props.Value = { number: rec.max_grant_amount };
  if (decision?.decided_at) {
    props['Last Activity'] = { date: { start: decision.decided_at } };
  }
  if (rec.deadline) {
    props['Received Date'] = { date: { start: new Date(rec.deadline).toISOString().slice(0, 10) } };
  }
  return props;
}

function buildPageBody(rec: Recommendation, decision: DecisionRow | undefined) {
  const blocks: unknown[] = [
    {
      object: 'block',
      type: 'callout',
      callout: {
        icon: { type: 'emoji', emoji: rec.fit_score >= 80 ? '🟢' : rec.fit_score >= 60 ? '🟡' : '⚪' },
        rich_text: richText(
          `Fit ${rec.fit_score}/100 — theme ${rec.theme_score} · geo ${rec.geography_score} · elig ${rec.eligibility_score} · timing ${rec.timing_score}`
        ),
      },
    },
  ];
  if (rec.flags?.length) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: richText(`Flags: ${rec.flags.join(' · ')}`) },
    });
  }
  if (rec.focus_areas?.length) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: richText(`Focus: ${rec.focus_areas.join(' · ')}`) },
    });
  }
  if (rec.source_url) {
    blocks.push({ object: 'block', type: 'bookmark', bookmark: { url: rec.source_url } });
  }
  if (decision?.notes) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: richText(`Notes: ${decision.notes}`) },
    });
  }
  return blocks;
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const NOTION_TOKEN = process.env.NOTION_MIRROR_TOKEN || process.env.NOTION_TOKEN;
  const NOTION_DB = process.env.NOTION_OPPORTUNITIES_DB_ID;

  if (!NOTION_TOKEN || !NOTION_DB) {
    return NextResponse.json(
      { error: 'NOTION_MIRROR_TOKEN and NOTION_OPPORTUNITIES_DB_ID must be set in env' },
      { status: 500 }
    );
  }

  let body: { include_undecided?: boolean; dry_run?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }
  const includeUndecided = body.include_undecided === true;
  const dryRun = body.dry_run === true;

  const supabase = getServiceSupabase();

  const { data: recs, error: recErr } = await supabase
    .from('act_grant_recommendations')
    .select('*')
    .eq('is_strong_fit', true);

  if (recErr) {
    return NextResponse.json({ error: `MV read failed: ${recErr.message}` }, { status: 500 });
  }

  const { data: decisions } = await supabase
    .from('act_grant_recommendation_decisions')
    .select('project_code, opportunity_id, decision, decided_at, decided_by, notes, notion_page_id, grant_opportunity_id');

  const decisionMap = new Map<string, DecisionRow>(
    (decisions ?? []).map((d) => [`${d.project_code}|${d.opportunity_id}`, d as DecisionRow])
  );

  let created = 0, updated = 0, failed = 0, skipped = 0;
  const errors: string[] = [];

  for (const recRaw of recs ?? []) {
    const rec = recRaw as Recommendation;
    const key = `${rec.project_code}|${rec.opportunity_id}`;
    const decision = decisionMap.get(key);

    if (!decision && !includeUndecided) {
      skipped++;
      continue;
    }

    const properties = buildProperties(rec, decision);
    try {
      if (decision?.notion_page_id) {
        if (!dryRun) {
          await notion(NOTION_TOKEN, 'PATCH', `/pages/${decision.notion_page_id}`, { properties });
        }
        updated++;
      } else {
        if (dryRun) {
          created++;
          continue;
        }
        const page = await notion(NOTION_TOKEN, 'POST', '/pages', {
          parent: { database_id: NOTION_DB },
          properties,
          children: buildPageBody(rec, decision),
        });
        await supabase.from('act_grant_recommendation_decisions').upsert(
          {
            project_code: rec.project_code,
            opportunity_id: rec.opportunity_id,
            decision: decision?.decision ?? 'discovered',
            decided_by: decision?.decided_by ?? null,
            decided_at: decision?.decided_at ?? new Date().toISOString(),
            notes: decision?.notes ?? null,
            notion_page_id: page.id,
            grant_opportunity_id: decision?.grant_opportunity_id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'project_code,opportunity_id' }
        );
        created++;
      }
    } catch (err) {
      failed++;
      errors.push(`${rec.opportunity_name}: ${(err as Error).message}`);
    }
  }

  return NextResponse.json({
    created,
    updated,
    skipped,
    failed,
    total: recs?.length ?? 0,
    dry_run: dryRun,
    errors: errors.slice(0, 10),
  });
}
