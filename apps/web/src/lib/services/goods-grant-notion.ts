import { createHash } from 'node:crypto';
import { getServiceSupabase } from '@/lib/supabase';

const NOTION_API = 'https://api.notion.com/v1';

function richText(value: unknown) {
  return value == null || value === '' ? [] : [{ type: 'text', text: { content: String(value).slice(0, 2000) } }];
}

async function notion(token: string, method: string, path: string, body?: unknown) {
  const response = await fetch(`${NOTION_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Notion ${response.status}: ${(await response.text()).slice(0, 300)}`);
  return response.json() as Promise<Record<string, unknown>>;
}

export async function promoteGoodsGrantToNotion(input: { grantId: string; reviewerId: string; orgProfileId: string; projectCode?: string; fundingBlockIds?: string[] }) {
  const { grantId, reviewerId, orgProfileId } = input;
  const token = process.env.NOTION_TOKEN;
  const databaseId = process.env.NOTION_FUNDER_OPPORTUNITIES_DB;
  if (!token || !databaseId) {
    throw new Error('Canonical Notion promotion is not configured. Set NOTION_FUNDER_OPPORTUNITIES_DB and share that database with the integration.');
  }

  const db = getServiceSupabase();
  const { data: grant, error } = await db
    .from('grant_opportunities')
    .select('id,name,provider,url,amount_min,amount_max,deadline,closes_at,status,goods_relevance_score,last_verified_at,accepts_pty_ltd,dgr_required,aligned_projects,requirements_summary')
    .eq('id', grantId)
    .single();
  if (error || !grant) throw new Error(error?.message || 'Grant not found');

  const warnings: string[] = [];
  if (!['open', 'ongoing', 'upcoming'].includes(String(grant.status || '').toLowerCase())) warnings.push('the round is not live');
  if (!grant.url) warnings.push('official source URL missing');
  if (!grant.last_verified_at) warnings.push('verification date missing');
  if (grant.last_verified_at && Date.now() - new Date(grant.last_verified_at).getTime() > 30 * 86_400_000) warnings.push('verification is older than 30 days');
  if ((grant.goods_relevance_score ?? 0) < 60) warnings.push('Goods fit score below 60');
  if (!grant.accepts_pty_ltd && !grant.dgr_required) warnings.push('applicant route needs confirmation');
  const alignedProjects = Array.isArray(grant.aligned_projects) ? grant.aligned_projects.map(String).filter(Boolean) : [];
  const projectCode = input.projectCode || alignedProjects[0] || 'ACT';

  const database = await notion(token, 'GET', `/databases/${databaseId}`);
  const fields = new Set(Object.keys((database.properties as Record<string, unknown>) || {}));
  const identityField = fields.has('GrantScope ID') ? 'GrantScope ID' : fields.has('Supabase ID') ? 'Supabase ID' : null;
  const titleField = fields.has('Funder / Opportunity') ? 'Funder / Opportunity' : fields.has('Grant Name') ? 'Grant Name' : null;
  if (!identityField || !titleField) throw new Error('Canonical Notion database is missing its title or GrantScope ID property');

  const matches = await notion(token, 'POST', `/databases/${databaseId}/query`, {
    page_size: 10,
    filter: { property: identityField, rich_text: { equals: grant.id } },
  });
  const results = Array.isArray(matches.results) ? matches.results as Array<Record<string, unknown>> : [];
  if (results.length > 1) throw new Error(`Promotion blocked: ${results.length} Notion pages already use this GrantScope ID`);

  const properties: Record<string, unknown> = {
    [titleField]: { title: richText(grant.name) },
    [identityField]: { rich_text: richText(grant.id) },
  };
  if (fields.has('Provider')) properties.Provider = { rich_text: richText(grant.provider) };
  if (fields.has('Amount (AUD)')) properties['Amount (AUD)'] = { number: grant.amount_max ?? grant.amount_min ?? null };
  if (fields.has('Due date')) properties['Due date'] = { date: (grant.closes_at || grant.deadline) ? { start: String(grant.closes_at || grant.deadline).slice(0, 10) } : null };
  if (fields.has('Application URL')) properties['Application URL'] = { url: grant.url };
  if (fields.has('Key Requirements')) properties['Key Requirements'] = { rich_text: richText(grant.requirements_summary) };
  if (fields.has('Project')) properties.Project = { rich_text: richText(projectCode) };
  if (fields.has('Funding block') && input.fundingBlockIds?.length) {
    const { data: selectedBlocks } = await db.from('goods_capital_blocks').select('code, name').in('id', input.fundingBlockIds);
    const notionBlockNames: Record<string, string> = {
      'measured-run': 'Measured 50-bed run',
      'operating-cover': 'Working capital',
      'servicing-scoping': 'Community scoping / governance',
      equipment: 'Production equipment',
      'working-capital': 'Working capital',
    };
    if (selectedBlocks?.[0]) properties['Funding block'] = { select: { name: notionBlockNames[String(selectedBlocks[0].code)] || selectedBlocks[0].name } };
  }
  if (fields.has('Stage')) properties.Stage = { select: { name: 'Identified' } };
  if (fields.has('Last Updated')) properties['Last Updated'] = { date: { start: new Date().toISOString().slice(0, 10) } };

  const page = results[0]
    ? await notion(token, 'PATCH', `/pages/${String(results[0].id)}`, { properties })
    : await notion(token, 'POST', '/pages', { parent: { database_id: databaseId }, properties });
  const pageId = String(page.id || results[0]?.id || '');
  if (!pageId) throw new Error('Notion did not return a page ID');
  const pageUrl = typeof page.url === 'string' ? page.url : `https://www.notion.so/${pageId.replace(/-/g, '')}`;
  const deterministicKey = createHash('sha256').update(`${projectCode}|grant|${grant.id}`).digest('hex');

  const ledgerPayload = {
    source_type: 'grant', source_ref: grant.id, project_code: projectCode, deterministic_key: deterministicKey,
    target_system: 'notion', target_record_id: pageId, target_url: pageUrl,
    status: results[0] ? 'linked' : 'promoted', reviewed_by: reviewerId,
    gate_snapshot: { human_promoted: true, project_code: projectCode, goods_fit: grant.goods_relevance_score, applicant_route: grant.dgr_required ? 'Butterfly Movement Ltd' : grant.accepts_pty_ltd ? 'A Curious Tractor Pty Ltd' : 'Needs confirmation', warnings },
    reviewed_at: new Date().toISOString(), promoted_at: new Date().toISOString(),
  };
  const { data: existingPromotion } = await db.from('opportunity_promotions').select('id').eq('source_type', 'grant').eq('source_ref', grant.id).eq('target_system', 'notion').maybeSingle();
  const ledgerWrite = existingPromotion?.id
    ? await db.from('opportunity_promotions').update(ledgerPayload).eq('id', existingPromotion.id)
    : await db.from('opportunity_promotions').insert(ledgerPayload);
  const ledgerError = ledgerWrite.error;
  if (ledgerError) throw new Error(`Notion page saved but promotion ledger failed: ${ledgerError.message}`);

  if (projectCode === 'ACT-GD' && input.fundingBlockIds?.length) {
    const slug = `grant-${grant.id}`;
    const matterPayload = {
      org_profile_id: orgProfileId,
      project_code: projectCode,
      slug,
      title: grant.name,
      counterparty_name: grant.provider || 'Unknown funder',
      purpose: grant.requirements_summary || `Assess and pursue ${grant.name} for selected Goods funding blocks.`,
      state: 'open',
      why_now: grant.deadline ? `Current deadline: ${grant.deadline}` : 'Human-promoted funding opportunity.',
      current_learning_question: 'Which Goods costs are eligible, and what amount should be allocated to each selected block?',
      evidence_gaps: warnings,
      official_source_url: grant.url,
      source_refs: { grant_opportunity_id: grant.id, notion_page_id: pageId },
    };
    const { data: existingMatter } = await db.from('goods_funding_matters').select('id').eq('slug', slug).maybeSingle();
    const matterWrite = existingMatter?.id
      ? await db.from('goods_funding_matters').update(matterPayload).eq('id', existingMatter.id).select('id').single()
      : await db.from('goods_funding_matters').insert(matterPayload).select('id').single();
    if (matterWrite.error || !matterWrite.data?.id) throw new Error(`Notion saved but Goods funding matter failed: ${matterWrite.error?.message || 'missing ID'}`);

    const routeCode = `grant-${grant.id}`;
    const routePayload = {
      matter_id: matterWrite.data.id,
      route_code: routeCode,
      route_type: 'grant',
      named_route: grant.name,
      legal_recipient_name: grant.dgr_required ? 'The Butterfly Movement Ltd' : grant.accepts_pty_ltd ? 'A Curious Tractor Pty Ltd' : null,
      eligibility_state: grant.dgr_required || grant.accepts_pty_ltd ? 'conditional' : 'unknown',
      target_amount_aud: grant.amount_max ?? grant.amount_min ?? null,
      application_state: 'researching',
      official_source_url: grant.url,
      official_source_checked_at: grant.last_verified_at,
      decision_due_at: grant.closes_at || grant.deadline,
      notion_url: pageUrl,
      evidence_gaps: warnings,
      source_refs: { grant_opportunity_id: grant.id, notion_page_id: pageId },
    };
    const { data: existingRoute } = await db.from('goods_funding_routes').select('id').eq('route_code', routeCode).maybeSingle();
    const routeWrite = existingRoute?.id
      ? await db.from('goods_funding_routes').update(routePayload).eq('id', existingRoute.id).select('id').single()
      : await db.from('goods_funding_routes').insert(routePayload).select('id').single();
    if (routeWrite.error || !routeWrite.data?.id) throw new Error(`Notion saved but Goods funding route failed: ${routeWrite.error?.message || 'missing ID'}`);
    for (const capitalBlockId of input.fundingBlockIds) {
      const { error: allocationError } = await db.from('goods_route_allocations').upsert({
        route_id: routeWrite.data.id,
        capital_block_id: capitalBlockId,
        proposed_amount_aud: null,
        restrictions: 'Amount allocation pending human review.',
        allocation_evidence_ref: pageUrl,
      }, { onConflict: 'route_id,capital_block_id' });
      if (allocationError) throw new Error(`Notion saved but Goods block allocation failed: ${allocationError.message}`);
    }
  }
  return { pageId, pageUrl, operation: results[0] ? 'updated' : 'created', warnings, projectCode };
}
