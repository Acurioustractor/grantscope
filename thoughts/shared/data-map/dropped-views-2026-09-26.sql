-- v_justice_spending_summary
CREATE OR REPLACE VIEW public.v_justice_spending_summary WITH (security_invoker=true) AS
 SELECT rogs_section,
    financial_year,
    service_type,
    unit,
    description2 AS category,
    nsw,
    vic,
    qld,
    wa,
    sa,
    tas,
    act,
    nt,
    aust
   FROM rogs_justice_spending
  WHERE (unit = ANY (ARRAY['$''000'::text, '$m'::text])) AND (description2 = ANY (ARRAY['Total net operating expenditure and capital costs'::text, 'Net operating expenditure'::text, 'Total expenditure'::text, 'Recurrent expenditure'::text])) AND (description3 IS NULL OR description3 = ''::text OR description3 = 'Total'::text)
  ORDER BY rogs_section, financial_year DESC, service_type;

-- v_llm_spend_monthly
CREATE OR REPLACE VIEW public.v_llm_spend_monthly AS
 SELECT date_trunc('month'::text, u.created_at) AS month,
    u.provider,
    u.model,
    count(*) AS calls,
    count(*) FILTER (WHERE p.input_price_per_1m IS NULL) AS unpriced_calls,
    sum(u.input_tokens) AS input_tokens,
    sum(u.output_tokens) AS output_tokens,
    round(sum(u.input_tokens::numeric / 1000000.0 * p.input_price_per_1m + u.output_tokens::numeric / 1000000.0 * p.output_price_per_1m), 4) AS priced_cost_usd
   FROM llm_usage u
     LEFT JOIN api_pricing p ON p.provider = u.provider AND p.model = u.model AND p.endpoint = COALESCE(u.endpoint, 'chat'::text) AND p.effective_from <= u.created_at::date AND (p.effective_until IS NULL OR p.effective_until > u.created_at::date)
  GROUP BY (date_trunc('month'::text, u.created_at)), u.provider, u.model;

-- v_ndis_support_class_supply
CREATE OR REPLACE VIEW public.v_ndis_support_class_supply WITH (security_invoker=true) AS
 SELECT report_date,
    state_code,
    service_district_name,
    support_class,
    provider_count
   FROM ndis_active_providers
  WHERE disability_group_name = 'ALL'::text AND age_band = 'ALL'::text AND support_class <> 'ALL'::text;

-- v_newsletter_audience
CREATE OR REPLACE VIEW public.v_newsletter_audience WITH (security_invoker=true) AS
 SELECT gc.id,
    gc.ghl_id,
    gc.full_name,
    gc.email,
    gc.newsletter_consent,
    gc.newsletter_consent_at,
    gc.newsletter_unsubscribed_at,
    gc.projects,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM unnest(gc.tags) t_1(t)
              WHERE lower(t_1.t) = 'goods-newsletter'::text)) THEN 'goods'::text
            WHEN (EXISTS ( SELECT 1
               FROM unnest(gc.tags) t_1(t)
              WHERE lower(t_1.t) = 'harvest-newsletter'::text)) THEN 'harvest'::text
            WHEN (EXISTS ( SELECT 1
               FROM unnest(gc.tags) t_1(t)
              WHERE lower(t_1.t) = 'newsletter'::text)) THEN 'generic'::text
            ELSE NULL::text
        END AS newsletter_segment,
    array_agg(DISTINCT t.t) FILTER (WHERE t.t ~~ '%newsletter%'::text) AS newsletter_tags
   FROM ghl_contacts gc
     LEFT JOIN LATERAL unnest(gc.tags) t(t) ON lower(t.t) ~~ '%newsletter%'::text
  WHERE gc.newsletter_consent = true AND gc.newsletter_unsubscribed_at IS NULL AND gc.email IS NOT NULL AND gc.email !~~ '%.local'::text AND gc.email !~~ '%.temp'::text
  GROUP BY gc.id, gc.ghl_id, gc.full_name, gc.email, gc.newsletter_consent, gc.newsletter_consent_at, gc.newsletter_unsubscribed_at, gc.projects, gc.tags;

-- v_newsletter_reprompt_candidates
CREATE OR REPLACE VIEW public.v_newsletter_reprompt_candidates WITH (security_invoker=true) AS
 SELECT id,
    ghl_id,
    full_name,
    email,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM unnest(gc.tags) t(t)
              WHERE lower(t.t) = 'goods-newsletter'::text)) THEN 'goods'::text
            WHEN (EXISTS ( SELECT 1
               FROM unnest(gc.tags) t(t)
              WHERE lower(t.t) = 'harvest-newsletter'::text)) THEN 'harvest'::text
            WHEN (EXISTS ( SELECT 1
               FROM unnest(gc.tags) t(t)
              WHERE lower(t.t) = 'newsletter'::text)) THEN 'generic'::text
            ELSE NULL::text
        END AS newsletter_segment,
    projects,
    tags,
    last_contact_date
   FROM ghl_contacts gc
  WHERE (EXISTS ( SELECT 1
           FROM unnest(gc.tags) t(t)
          WHERE lower(t.t) ~~ '%newsletter%'::text)) AND COALESCE(newsletter_consent, false) = false AND email IS NOT NULL AND email !~~ '%.local'::text AND email !~~ '%.temp'::text;

-- v_nt_community_procurement_summary
CREATE OR REPLACE VIEW public.v_nt_community_procurement_summary WITH (security_invoker=true) AS
 WITH entity_counts AS (
         SELECT v_nt_community_entity_matches.community_id,
            count(DISTINCT v_nt_community_entity_matches.entity_id) AS entity_match_count,
            count(DISTINCT v_nt_community_entity_matches.entity_id) FILTER (WHERE v_nt_community_entity_matches.is_community_controlled) AS community_controlled_match_count
           FROM v_nt_community_entity_matches
          GROUP BY v_nt_community_entity_matches.community_id
        ), buyer_counts AS (
         SELECT v_nt_community_buyer_crosswalk.community_id,
            count(DISTINCT v_nt_community_buyer_crosswalk.entity_id) AS buyer_match_count,
            count(DISTINCT v_nt_community_buyer_crosswalk.entity_id) FILTER (WHERE v_nt_community_buyer_crosswalk.buyer_type = 'store'::text) AS store_count,
            count(DISTINCT v_nt_community_buyer_crosswalk.entity_id) FILTER (WHERE v_nt_community_buyer_crosswalk.buyer_type = 'health'::text) AS health_count,
            count(DISTINCT v_nt_community_buyer_crosswalk.entity_id) FILTER (WHERE v_nt_community_buyer_crosswalk.buyer_type = 'housing'::text) AS housing_count,
            count(DISTINCT v_nt_community_buyer_crosswalk.entity_id) FILTER (WHERE v_nt_community_buyer_crosswalk.buyer_type = 'council'::text) AS council_count,
            count(DISTINCT v_nt_community_buyer_crosswalk.entity_id) FILTER (WHERE v_nt_community_buyer_crosswalk.buyer_type = 'other_service'::text) AS other_service_count,
            array_agg(v_nt_community_buyer_crosswalk.buyer_name ORDER BY v_nt_community_buyer_crosswalk.match_score DESC) AS top_buyer_names
           FROM v_nt_community_buyer_crosswalk
          GROUP BY v_nt_community_buyer_crosswalk.community_id
        )
 SELECT c.id AS community_id,
    c.community_name,
    c.region_label,
    c.service_region,
    c.land_council,
    c.postcode,
    c.is_official_remote_community,
    c.goods_focus_priority,
    c.goods_signal_name,
    c.goods_signal_type,
    c.known_buyer_name,
    COALESCE(ec.entity_match_count, 0::bigint) AS entity_match_count,
    COALESCE(bc.buyer_match_count, 0::bigint) AS buyer_match_count,
    COALESCE(bc.store_count, 0::bigint) AS store_count,
    COALESCE(bc.health_count, 0::bigint) AS health_count,
    COALESCE(bc.housing_count, 0::bigint) AS housing_count,
    COALESCE(bc.council_count, 0::bigint) AS council_count,
    COALESCE(bc.other_service_count, 0::bigint) AS other_service_count,
    COALESCE(ec.community_controlled_match_count, 0::bigint) AS community_controlled_match_count,
    COALESCE(bc.top_buyer_names, ARRAY[]::text[]) AS top_buyer_names,
    c.postcode IS NULL AS needs_postcode_enrichment,
    c.goods_signal_name IS NOT NULL OR c.known_buyer_name IS NOT NULL OR c.proof_line IS NOT NULL AS has_goods_signal
   FROM nt_communities c
     LEFT JOIN entity_counts ec ON ec.community_id = c.id
     LEFT JOIN buyer_counts bc ON bc.community_id = c.id
  ORDER BY c.is_official_remote_community DESC, c.community_name;

-- v_org_grant_health
CREATE OR REPLACE VIEW public.v_org_grant_health WITH (security_invoker=true) AS
 SELECT g.id,
    g.grant_name,
    g.funder_name,
    g.organization_id,
    COALESCE(g.approved_amount, g.amount_awarded) AS approved_amount,
    g.amount_awarded,
    g.contract_start,
    g.contract_end,
    g.status,
    COALESCE(b.total_budgeted, 0::numeric) AS total_budgeted,
    COALESCE(b.total_actual, 0::numeric) AS total_spent,
    COALESCE(g.approved_amount, g.amount_awarded, 0::numeric) - COALESCE(b.total_actual, 0::numeric) AS remaining_budget,
    COALESCE(i.issues_count, 0::bigint) AS issues_count
   FROM org_grants g
     LEFT JOIN ( SELECT org_grant_budget_lines.grant_id,
            sum(org_grant_budget_lines.budgeted_amount) AS total_budgeted,
            sum(org_grant_budget_lines.actual_amount) AS total_actual
           FROM org_grant_budget_lines
          GROUP BY org_grant_budget_lines.grant_id) b ON b.grant_id = g.id
     LEFT JOIN ( SELECT bl.grant_id,
            count(*) AS issues_count
           FROM org_grant_budget_lines bl
          WHERE bl.has_issue = true
          GROUP BY bl.grant_id) i ON i.grant_id = g.id;

-- v_org_upcoming_deadlines
CREATE OR REPLACE VIEW public.v_org_upcoming_deadlines WITH (security_invoker=true) AS
 SELECT d.id,
    d.organization_id,
    d.grant_id,
    d.title,
    d.due_date,
    d.deadline_type,
    d.status,
    d.submitted_date,
    d.requirements,
    d.document_url,
    d.reminder_days_before,
    d.notes,
    d.created_at,
    d.updated_at,
    d.due_date - CURRENT_DATE AS days_until_due,
        CASE
            WHEN d.status = ANY (ARRAY['completed'::text, 'submitted'::text]) THEN 'done'::text
            WHEN d.due_date < CURRENT_DATE THEN 'overdue'::text
            WHEN d.due_date <= (CURRENT_DATE + '7 days'::interval) THEN 'urgent'::text
            WHEN d.due_date <= (CURRENT_DATE + '30 days'::interval) THEN 'upcoming'::text
            ELSE 'future'::text
        END AS urgency,
    g.grant_name,
    g.funder_name
   FROM org_deadlines d
     LEFT JOIN org_grants g ON g.id = d.grant_id
  ORDER BY d.due_date;

-- v_pending_receipts
CREATE OR REPLACE VIEW public.v_pending_receipts WITH (security_invoker=true) AS
 SELECT id,
    source_type,
    source_id,
    vendor_name,
    amount,
    transaction_date,
    category,
    description,
    status,
    match_confidence,
    suggested_email_subject,
    suggested_email_from,
    week_start,
    deferred_count,
    CURRENT_DATE - transaction_date AS days_old,
        CASE
            WHEN transaction_date >= (CURRENT_DATE - 7) THEN 'quick_resolve_eligible'::text
            WHEN transaction_date >= (CURRENT_DATE - 30) THEN 'recent'::text
            WHEN transaction_date >= (CURRENT_DATE - 60) THEN 'aging'::text
            ELSE 'backlog'::text
        END AS age_category
   FROM receipt_matches rm
  WHERE status = ANY (ARRAY['pending'::text, 'email_suggested'::text, 'deferred'::text])
  ORDER BY match_confidence DESC NULLS LAST, transaction_date DESC;

-- v_pending_subscriptions_review
CREATE OR REPLACE VIEW public.v_pending_subscriptions_review WITH (security_invoker=true) AS
 SELECT id,
    vendor_name,
    vendor_aliases,
    detected_amount,
    detected_currency,
    detected_cycle,
    discovery_source,
    discovery_confidence,
    first_seen_at,
    last_seen_at,
    payment_count,
    avg_interval_days,
    amount_variance_pct,
    evidence,
    status,
    resolved_subscription_id,
    resolved_at,
    resolved_by,
    created_at,
    updated_at,
    COALESCE(( SELECT s.vendor_name
           FROM subscriptions s
          WHERE lower(s.vendor_name) = lower(ps.vendor_name)
         LIMIT 1), NULL::text) AS possible_match
   FROM pending_subscriptions ps
  WHERE status = 'pending'::text
  ORDER BY discovery_confidence DESC, payment_count DESC;

-- v_person_roles_typed
CREATE OR REPLACE VIEW public.v_person_roles_typed WITH (security_invoker=true) AS
 SELECT id,
    person_name,
    person_name_normalised,
    role_type,
    entity_id,
    confidence,
    properties ->> 'charity_size'::text AS charity_size,
    properties ->> 'original_role'::text AS original_role
   FROM person_roles p;

-- v_program_detail_deliverers
CREATE OR REPLACE VIEW public.v_program_detail_deliverers AS
 SELECT p.id AS program_id,
    d.program_name,
    d.gs_entity_id,
    d.organisation,
    d.legal_name,
    a.asserter_kind,
    a.basis,
    a.source_url,
    a.note,
    a.created_at::date AS read_at,
    "substring"(a.note, 'Quoted: "(.*)"'::text) AS source_quote
   FROM alma_government_programs p
     JOIN v_program_deliverers d ON lower(TRIM(BOTH FROM d.program_name)) = lower(TRIM(BOTH FROM p.name))
     LEFT JOIN LATERAL ( SELECT x.asserter_kind,
            x.basis,
            x.source_url,
            x.note,
            x.created_at
           FROM assertions x
          WHERE x.subject_id = d.gs_entity_id AND x.predicate = 'delivers_program'::text AND x.superseded_by IS NULL
          ORDER BY (
                CASE x.basis
                    WHEN 'statutory'::text THEN 1
                    WHEN 'certified'::text THEN 2
                    WHEN 'disclosed'::text THEN 3
                    WHEN 'stated'::text THEN 4
                    WHEN 'derived'::text THEN 5
                    ELSE 6
                END), (x.note ~~ '%Quoted: "%'::text) DESC, x.created_at DESC
         LIMIT 1) a ON true
  WHERE d.organisation IS NOT NULL AND d.organisation <> 'Name unresolved'::text;

-- v_project_actions
CREATE OR REPLACE VIEW public.v_project_actions WITH (security_invoker=true) AS
 SELECT id,
    project_code,
    title,
    action_items,
    follow_up_date,
    recorded_at
   FROM project_knowledge pk
  WHERE action_required = true OR follow_up_date IS NOT NULL
  ORDER BY follow_up_date, recorded_at DESC;

-- v_project_decisions
CREATE OR REPLACE VIEW public.v_project_decisions WITH (security_invoker=true) AS
 SELECT project_code,
    project_name,
    title,
    content,
    decision_status,
    decision_rationale,
    recorded_at,
    participants
   FROM project_knowledge pk
  WHERE knowledge_type = 'decision'::text
  ORDER BY project_code, recorded_at DESC;

-- v_project_lifetime_position
CREATE OR REPLACE VIEW public.v_project_lifetime_position WITH (security_invoker=true) AS
 SELECT project_code,
    sum(revenue_invoiced) AS revenue_invoiced_lifetime,
    sum(expense_billed) AS expense_billed_lifetime,
    sum(expense_bank) AS expense_bank_lifetime,
    sum(receive_bank) AS receive_bank_lifetime,
    sum(invoice_count) AS invoice_count_lifetime,
    sum(txn_count) AS txn_count_lifetime,
    min(quarter_start) AS first_quarter,
    max(quarter_start) AS last_quarter
   FROM mv_project_quarter_position
  GROUP BY project_code;

-- v_project_pipeline_totals
CREATE OR REPLACE VIEW public.v_project_pipeline_totals WITH (security_invoker=true) AS
 SELECT project_code,
    count(DISTINCT pipeline_name) AS pipelines_active,
    sum(open_count) AS open_count,
    sum(won_count) AS won_count,
    sum(lost_count) AS lost_count,
    sum(open_value_aud) AS open_value_aud,
    sum(won_value_aud) AS won_value_aud,
    max(latest_activity_at) AS latest_activity_at,
    max(computed_at) AS computed_at
   FROM project_pipelines
  WHERE project_code IS NOT NULL AND project_code <> ''::text
  GROUP BY project_code;

-- v_project_questions
CREATE OR REPLACE VIEW public.v_project_questions WITH (security_invoker=true) AS
 SELECT project_code,
    project_name,
    title,
    content,
    recorded_at,
    follow_up_date,
    importance
   FROM project_knowledge pk
  WHERE knowledge_type = 'question'::text AND action_required = true
  ORDER BY importance DESC, recorded_at DESC;

-- v_rd_expenses
CREATE OR REPLACE VIEW public.v_rd_expenses WITH (security_invoker=true) AS
 SELECT vr.vendor_name,
    vr.category,
    vr.project_code,
    t.contact_name,
    t.total,
    t.date,
    t.id AS transaction_id
   FROM vendor_project_rules vr
     JOIN xero_transactions t ON t.project_code = vr.project_code AND t.type = 'SPEND'::text AND (lower(t.contact_name) ~~* (('%'::text || lower(vr.vendor_name)) || '%'::text) OR (EXISTS ( SELECT 1
           FROM unnest(vr.aliases) alias(alias)
          WHERE lower(t.contact_name) ~~* (('%'::text || lower(alias.alias)) || '%'::text))))
  WHERE vr.rd_eligible = true;

-- v_recent_agent_errors
CREATE OR REPLACE VIEW public.v_recent_agent_errors WITH (security_invoker=true) AS
 SELECT agent_id,
    action,
    target_table,
    error_message,
    error_code,
    "timestamp",
    duration_ms
   FROM agent_audit_log
  WHERE success = false AND "timestamp" > (now() - '24:00:00'::interval)
  ORDER BY "timestamp" DESC;

-- v_recent_project_knowledge
CREATE OR REPLACE VIEW public.v_recent_project_knowledge WITH (security_invoker=true) AS
 SELECT id,
    project_code,
    project_name,
    knowledge_type,
    title,
    content,
    source_type,
    source_ref,
    source_url,
    voice_note_id,
    communication_id,
    recorded_by,
    recorded_at,
    participants,
    contact_ids,
    summary,
    topics,
    sentiment,
    importance,
    action_required,
    action_items,
    follow_up_date,
    decision_status,
    decision_rationale,
    embedding,
    created_at,
    updated_at,
        CASE
            WHEN recorded_at >= (now() - '7 days'::interval) THEN 'this_week'::text
            WHEN recorded_at >= (now() - '30 days'::interval) THEN 'this_month'::text
            ELSE 'older'::text
        END AS recency
   FROM project_knowledge pk
  WHERE recorded_at >= (now() - '30 days'::interval)
  ORDER BY recorded_at DESC;

-- v_relationship_health
CREATE OR REPLACE VIEW public.v_relationship_health WITH (security_invoker=true) AS
 SELECT r.relationship_type,
    r.dataset,
    count(*) AS total,
    count(
        CASE
            WHEN s.abn IS NOT NULL AND t.abn IS NOT NULL THEN 1
            ELSE NULL::integer
        END) AS both_abn,
    count(
        CASE
            WHEN s.abn IS NULL AND t.abn IS NULL THEN 1
            ELSE NULL::integer
        END) AS neither_abn,
    count(
        CASE
            WHEN s.abn IS NULL AND t.abn IS NOT NULL THEN 1
            ELSE NULL::integer
        END) AS source_missing,
    count(
        CASE
            WHEN s.abn IS NOT NULL AND t.abn IS NULL THEN 1
            ELSE NULL::integer
        END) AS target_missing,
    round(100.0 * count(
        CASE
            WHEN s.abn IS NOT NULL AND t.abn IS NOT NULL THEN 1
            ELSE NULL::integer
        END)::numeric / NULLIF(count(*), 0)::numeric, 1) AS pct_solid
   FROM gs_relationships r
     JOIN gs_entities s ON s.id = r.source_entity_id
     JOIN gs_entities t ON t.id = r.target_entity_id
  GROUP BY r.relationship_type, r.dataset
  ORDER BY (count(*)) DESC;

-- v_state_ecosystem_summary
CREATE OR REPLACE VIEW public.v_state_ecosystem_summary AS
 SELECT state,
    count(*) FILTER (WHERE operational_status = 'operational'::text) AS operational_facilities,
    sum(capacity_beds) AS total_capacity,
    sum(current_population) AS total_population,
    ( SELECT count(*) AS count
           FROM registered_services cp
          WHERE cp.state = ydf.state) AS community_programs,
    ( SELECT count(*) AS count
           FROM services s
          WHERE s.location_state = ydf.state) AS services,
    ( SELECT count(*) AS count
           FROM organizations o
          WHERE o.state = ydf.state AND o.is_active) AS organizations
   FROM youth_detention_facilities ydf
  GROUP BY state;

-- v_team_capacity
CREATE OR REPLACE VIEW public.v_team_capacity WITH (security_invoker=true) AS
 SELECT tm.id,
    tm.name,
    tm.role,
    tm.available_hours_per_week,
    COALESCE(sum(ra.hours_per_week), 0::numeric) AS allocated_hours,
    tm.available_hours_per_week - COALESCE(sum(ra.hours_per_week), 0::numeric) AS available_hours,
    round(COALESCE(sum(ra.hours_per_week), 0::numeric) / NULLIF(tm.available_hours_per_week, 0::numeric) * 100::numeric, 1) AS utilisation_pct,
    array_agg(DISTINCT ra.project_code) FILTER (WHERE ra.project_code IS NOT NULL) AS projects
   FROM team_members tm
     LEFT JOIN resource_allocations ra ON ra.team_member_id = tm.id AND (ra.end_date IS NULL OR ra.end_date >= CURRENT_DATE) AND ra.start_date <= CURRENT_DATE
  WHERE tm.status = 'active'::text
  GROUP BY tm.id, tm.name, tm.role, tm.available_hours_per_week;

-- v_voice_notes_cultural_review
CREATE OR REPLACE VIEW public.v_voice_notes_cultural_review WITH (security_invoker=true) AS
 SELECT vn.id,
    vn.source_channel,
    vn.recorded_by,
    vn.recorded_by_name,
    vn.duration_seconds,
    vn.file_size_bytes,
    vn.audio_url,
    vn.audio_format,
    vn.transcript,
    vn.transcript_confidence,
    vn.transcript_language,
    vn.transcribed_at,
    vn.transcription_model,
    vn.summary,
    vn.topics,
    vn.action_items,
    vn.key_points,
    vn.mentioned_people,
    vn.mentioned_contacts,
    vn.embedding,
    vn.visibility,
    vn.shared_with,
    vn.project_context,
    vn.related_contact_id,
    vn.related_communication_id,
    vn.reply_to_voice_note_id,
    vn.mentions_elders,
    vn.requires_cultural_review,
    vn.cultural_review_status,
    vn.cultural_reviewer_notes,
    vn.recorded_at,
    vn.uploaded_at,
    vn.enriched_at,
    vn.created_at,
    vn.updated_at,
    ui.display_name AS recorder_display_name
   FROM voice_notes vn
     LEFT JOIN user_identities ui ON vn.recorded_by = ui.id
  WHERE vn.requires_cultural_review = true AND vn.cultural_review_status = 'pending'::text
  ORDER BY vn.recorded_at;

-- v_voice_notes_with_actions
CREATE OR REPLACE VIEW public.v_voice_notes_with_actions WITH (security_invoker=true) AS
 SELECT id,
    summary,
    recorded_by_name,
    recorded_at,
    project_context,
    jsonb_array_elements(action_items) AS action_item
   FROM voice_notes vn
  WHERE action_items IS NOT NULL AND jsonb_array_length(action_items) > 0
  ORDER BY recorded_at DESC;

-- v_youth_justice_cost_comparison
CREATE OR REPLACE VIEW public.v_youth_justice_cost_comparison WITH (security_invoker=true) AS
 SELECT financial_year,
    service_type,
    unit,
    description2 AS metric,
    nsw,
    vic,
    qld,
    wa,
    sa,
    tas,
    act,
    nt,
    aust
   FROM rogs_justice_spending
  WHERE rogs_section = 'youth_justice'::text AND rogs_table = '17A.10'::text
  ORDER BY financial_year DESC, service_type;

-- v_youth_justice_entities
CREATE OR REPLACE VIEW public.v_youth_justice_entities AS
 SELECT e.id,
    e.gs_id,
    e.canonical_name,
    e.abn,
    e.entity_type,
    e.sector,
    e.state,
    e.postcode,
    e.remoteness,
    e.lga_name,
    e.is_community_controlled,
    COALESCE(jf.justice_funding_total, 0::numeric) AS justice_funding_total,
    COALESCE(jf.justice_grant_count, 0::bigint) AS justice_grant_count,
    COALESCE(ac.contract_total, 0::numeric) AS contract_total,
    COALESCE(ac.contract_count, 0::bigint) AS contract_count,
    COALESCE(alma.intervention_count, 0::bigint) AS alma_intervention_count,
    alma.evidence_levels,
    alma.avg_cost_per_person,
    jf.justice_funding_total IS NOT NULL AS has_justice_funding,
    ac.contract_total IS NOT NULL AS has_yj_contracts,
    alma.intervention_count IS NOT NULL AS has_alma_interventions
   FROM gs_entities e
     LEFT JOIN LATERAL ( SELECT sum(j.amount_dollars) AS justice_funding_total,
            count(*) AS justice_grant_count
           FROM justice_funding j
          WHERE j.gs_entity_id = e.id AND (j.sector ~~* '%youth%'::text OR j.sector ~~* '%justice%'::text OR j.program_name ~~* '%youth%'::text OR j.program_name ~~* '%juvenile%'::text)) jf ON true
     LEFT JOIN LATERAL ( SELECT sum(c.contract_value) AS contract_total,
            count(*) AS contract_count
           FROM austender_contracts c
          WHERE c.supplier_abn = e.abn AND (c.title ~~* '%youth justice%'::text OR c.title ~~* '%juvenile%'::text OR c.title ~~* '%young offend%'::text OR c.title ~~* '%youth detention%'::text)) ac ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS intervention_count,
            array_agg(DISTINCT ai.evidence_level) AS evidence_levels,
            avg(ai.cost_per_young_person) AS avg_cost_per_person
           FROM alma_interventions ai
          WHERE ai.gs_entity_id = e.id AND ai.serves_youth_justice = true) alma ON true
  WHERE COALESCE(jf.justice_funding_total, 0::numeric) > 0::numeric OR COALESCE(ac.contract_total, 0::numeric) > 0::numeric OR COALESCE(alma.intervention_count, 0::bigint) > 0;

-- v_youth_justice_recipient_stats
CREATE OR REPLACE VIEW public.v_youth_justice_recipient_stats WITH (security_invoker=true) AS
 WITH r AS (
         SELECT v_youth_justice_recipients.total_dollars,
            v_youth_justice_recipients.rank
           FROM v_youth_justice_recipients
        )
 SELECT count(*) AS organisations,
    sum(total_dollars) AS total_dollars,
    round(100.0 * sum(total_dollars) FILTER (WHERE rank <= 10) / NULLIF(sum(total_dollars), 0::numeric), 1) AS top_ten_pct,
    round(100.0 * sum(total_dollars) FILTER (WHERE rank <= 100) / NULLIF(sum(total_dollars), 0::numeric), 1) AS top_hundred_pct,
    percentile_cont(0.5::double precision) WITHIN GROUP (ORDER BY (total_dollars::double precision))::numeric AS median_dollars,
    count(*) FILTER (WHERE total_dollars < 10000::numeric) AS under_ten_thousand
   FROM r;

-- vw_alma_intervention_matches
CREATE OR REPLACE VIEW public.vw_alma_intervention_matches WITH (security_invoker=true) AS
 SELECT pcm.id,
    pcm.contact_id,
    pcm.person_id,
    pcm.project_notion_id,
    pcm.project_name,
    pcm.project_source,
    pcm.alignment_score,
    pcm.matched_keywords,
    pcm.match_reason,
    pcm.alma_intervention_id,
    pcm.alma_signal_boost,
    pcm.engagement_status,
    pcm.created_at,
    pcm.updated_at,
    lc.full_name,
    lc.email_address,
    lc.alignment_tags,
    lc.strategic_value
   FROM project_contact_matches pcm
     LEFT JOIN linkedin_contacts lc ON pcm.contact_id = lc.id
  WHERE pcm.project_source = 'justicehub'::text AND pcm.alma_intervention_id IS NOT NULL AND pcm.alignment_score >= 60
  ORDER BY pcm.alignment_score DESC;

-- vw_auto_mapped_contacts
CREATE OR REPLACE VIEW public.vw_auto_mapped_contacts WITH (security_invoker=true) AS
 SELECT lc.id AS linkedin_contact_id,
    lc.full_name,
    lc.email_address,
    lc.current_company,
    lc.bio,
    lc.exa_confidence_score,
    lc.exa_last_enriched,
    pim.person_id,
    pim.engagement_priority,
    pim.data_source,
    pim.discovered_via,
    pim.created_at AS person_created_at
   FROM linkedin_contacts lc
     JOIN person_identity_map pim ON pim.person_id = lc.person_id
  WHERE lc.exa_enriched = true AND pim.data_source = 'exa_enrichment'::text
  ORDER BY lc.exa_last_enriched DESC;

-- vw_engagement_tier_stats
CREATE OR REPLACE VIEW public.vw_engagement_tier_stats WITH (security_invoker=true) AS
 SELECT engagement_priority AS tier,
    count(*) AS total_contacts,
    count(
        CASE
            WHEN notion_person_id IS NOT NULL THEN 1
            ELSE NULL::integer
        END) AS synced_to_notion,
    count(
        CASE
            WHEN sector = 'government'::text THEN 1
            ELSE NULL::integer
        END) AS government_contacts
   FROM person_identity_map
  WHERE email IS NOT NULL
  GROUP BY engagement_priority;

-- vw_exa_queue_summary
CREATE OR REPLACE VIEW public.vw_exa_queue_summary WITH (security_invoker=true) AS
 SELECT campaign_type,
    status,
    count(*) AS count,
    avg(priority) AS avg_priority,
    min(queued_at) AS oldest_queued,
    max(queued_at) AS newest_queued
   FROM exa_enrichment_queue
  GROUP BY campaign_type, status
  ORDER BY campaign_type, status;

-- vw_exa_usage_summary
CREATE OR REPLACE VIEW public.vw_exa_usage_summary WITH (security_invoker=true) AS
 SELECT period_month,
    total_requests,
    successful_requests,
    failed_requests,
    free_tier_limit,
    free_tier_remaining,
    free_tier_exceeded,
    linkedin_requests,
    company_requests,
    media_requests,
    network_discovery_requests,
    round(total_requests::numeric / free_tier_limit::numeric * 100::numeric, 2) AS usage_percentage,
    estimated_cost_usd
   FROM exa_api_usage
  ORDER BY period_month DESC;

-- vw_goods_enrichment_candidates
CREATE OR REPLACE VIEW public.vw_goods_enrichment_candidates WITH (security_invoker=true) AS
 SELECT p.person_id,
    p.full_name,
    p.email,
    p.current_company,
    p.current_position,
    p.tags,
    p.engagement_priority,
    p.exa_enriched,
    p.exa_enriched_at,
    cis.composite_score,
    cis.influence_score,
        CASE
            WHEN p.engagement_priority = 'critical'::text THEN 100
            WHEN p.engagement_priority = 'high'::text THEN 75
            WHEN p.engagement_priority = 'medium'::text THEN 50
            ELSE 25
        END AS enrichment_priority
   FROM person_identity_map p
     LEFT JOIN contact_intelligence_scores cis ON p.person_id = cis.person_id
  WHERE p.exa_enriched = false AND p.email IS NOT NULL AND (('goods-on-country'::text = ANY (p.tags)) OR ('circular-economy'::text = ANY (p.tags)) OR ('indigenous-business'::text = ANY (p.tags)) OR ('sustainable-products'::text = ANY (p.tags)) OR p.sector = 'retail'::text OR p.sector = 'manufacturing'::text)
  ORDER BY (
        CASE
            WHEN p.engagement_priority = 'critical'::text THEN 100
            WHEN p.engagement_priority = 'high'::text THEN 75
            WHEN p.engagement_priority = 'medium'::text THEN 50
            ELSE 25
        END) DESC, cis.composite_score DESC NULLS LAST;

-- vw_high_value_project_matches
CREATE OR REPLACE VIEW public.vw_high_value_project_matches WITH (security_invoker=true) AS
 SELECT pcm.id,
    pcm.contact_id,
    pcm.person_id,
    pcm.project_notion_id,
    pcm.project_name,
    pcm.project_source,
    pcm.alignment_score,
    pcm.matched_keywords,
    pcm.match_reason,
    pcm.alma_intervention_id,
    pcm.alma_signal_boost,
    pcm.engagement_status,
    pcm.created_at,
    pcm.updated_at,
    lc.full_name,
    lc.email_address,
    lc.linkedin_url,
    lc.current_company,
    lc.current_position,
    lc.strategic_value,
    lc.alignment_tags,
    pim.notion_person_id,
    pim.ghl_contact_id
   FROM project_contact_matches pcm
     LEFT JOIN linkedin_contacts lc ON pcm.contact_id = lc.id
     LEFT JOIN person_identity_map pim ON pcm.person_id = pim.person_id
  WHERE pcm.alignment_score >= 60 AND pcm.engagement_status <> 'obsolete'::text
  ORDER BY pcm.alignment_score DESC, pcm.created_at DESC;

-- vw_justice_enrichment_candidates
CREATE OR REPLACE VIEW public.vw_justice_enrichment_candidates WITH (security_invoker=true) AS
 SELECT p.person_id,
    p.full_name,
    p.email,
    p.current_company,
    p.current_position,
    p.tags,
    p.engagement_priority,
    p.youth_justice_relevance_score,
    p.exa_enriched,
    p.exa_enriched_at,
    cis.composite_score,
    cis.influence_score,
        CASE
            WHEN p.engagement_priority = 'critical'::text THEN 100
            WHEN p.engagement_priority = 'high'::text THEN 75
            WHEN p.youth_justice_relevance_score > 70 THEN 80
            WHEN p.engagement_priority = 'medium'::text THEN 50
            ELSE 25
        END AS enrichment_priority
   FROM person_identity_map p
     LEFT JOIN contact_intelligence_scores cis ON p.person_id = cis.person_id
  WHERE p.exa_enriched = false AND p.email IS NOT NULL AND (p.youth_justice_relevance_score > 50 OR ('youth-justice'::text = ANY (p.tags)) OR ('juvenile-justice'::text = ANY (p.tags)) OR ('restorative-justice'::text = ANY (p.tags)) OR ('indigenous-youth'::text = ANY (p.tags)))
  ORDER BY (
        CASE
            WHEN p.engagement_priority = 'critical'::text THEN 100
            WHEN p.engagement_priority = 'high'::text THEN 75
            WHEN p.youth_justice_relevance_score > 70 THEN 80
            WHEN p.engagement_priority = 'medium'::text THEN 50
            ELSE 25
        END) DESC, p.youth_justice_relevance_score DESC NULLS LAST, cis.composite_score DESC NULLS LAST;

