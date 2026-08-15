CREATE POLICY "Public read" ON public._backup_entity_contacts_20260606 FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.abr_registry FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.abs_indigenous_population_by_lga FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read abs locality lga" ON public.abs_locality_lga FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.abs_raw_responses FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.acara_schools FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.acnc_ais FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.acnc_ais_line_items FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.acnc_charities FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.acnc_programs FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.act_grant_recommendation_decisions FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.act_grant_recommendation_projects FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.act_payable_decisions FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public reads ACT research experiments" ON public.act_research_experiments FOR SELECT TO public USING (true);
CREATE POLICY "Public reads ACT research initiatives" ON public.act_research_initiatives FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.agil_locations FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.aihw_child_protection FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.aihw_youth_justice_stats FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Service manages alert events" ON public.alert_events FOR ALL TO public USING (true);
CREATE POLICY "Users see own alert events" ON public.alert_events FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Users see own notifications" ON public.alert_notifications FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Users manage own alerts" ON public.alert_preferences FOR ALL TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Public can view public contexts" ON public.alma_community_contexts FOR SELECT TO anon,authenticated USING ((consent_level = 'Public Knowledge Commons'::text));
CREATE POLICY "Users can read own conversations" ON public.alma_conversations FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY admin_discovered_links ON public.alma_discovered_links FOR ALL TO public USING (((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'service_role'::text));
CREATE POLICY read_discovered_links ON public.alma_discovered_links FOR SELECT TO public USING (true);
CREATE POLICY "Public read for entity_sources" ON public.alma_entity_sources FOR SELECT TO public USING (true);
CREATE POLICY "Public can view public evidence" ON public.alma_evidence FOR SELECT TO anon,authenticated USING ((consent_level = 'Public Knowledge Commons'::text));
CREATE POLICY admin_extraction_patterns ON public.alma_extraction_patterns FOR ALL TO public USING (((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'service_role'::text));
CREATE POLICY read_extraction_patterns ON public.alma_extraction_patterns FOR SELECT TO public USING (true);
CREATE POLICY admin_funding_data ON public.alma_funding_data FOR ALL TO public USING (((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'service_role'::text));
CREATE POLICY read_funding_data ON public.alma_funding_data FOR SELECT TO public USING (true);
CREATE POLICY "Anyone can view funding opportunities" ON public.alma_funding_opportunities FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.alma_government_programs FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.alma_impact_metrics FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.alma_ingestion_jobs FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public can view links between public records" ON public.alma_intervention_evidence FOR SELECT TO anon,authenticated USING (((EXISTS ( SELECT 1
   FROM alma_interventions i
  WHERE ((i.id = alma_intervention_evidence.intervention_id) AND (i.review_status = 'Published'::text) AND (i.consent_level = ANY (ARRAY['Public Knowledge Commons'::text, 'Community Controlled'::text]))))) AND (EXISTS ( SELECT 1
   FROM alma_evidence e
  WHERE ((e.id = alma_intervention_evidence.evidence_id) AND (e.consent_level = 'Public Knowledge Commons'::text))))));
CREATE POLICY "Public can view published interventions" ON public.alma_interventions FOR SELECT TO public USING (((review_status = 'Published'::text) AND (consent_level = ANY (ARRAY['Public Knowledge Commons'::text, 'Community Controlled'::text]))));
CREATE POLICY "Public read for locations" ON public.alma_locations FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.alma_maturation_log FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.alma_media_articles FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY alma_oec_admin_read ON public.alma_org_enrichment_candidates FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY alma_oec_admin_write ON public.alma_org_enrichment_candidates FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "Anyone can view outcomes" ON public.alma_outcomes FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.alma_program_interventions FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read findings" ON public.alma_research_findings FOR SELECT TO public USING (true);
CREATE POLICY "Public read research sessions" ON public.alma_research_sessions FOR SELECT TO public USING (true);
CREATE POLICY "Public read tool logs" ON public.alma_research_tool_logs FOR SELECT TO public USING (true);
CREATE POLICY "Public read for source_documents" ON public.alma_source_documents FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.alma_stories FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read for tags" ON public.alma_tags FOR SELECT TO public USING (true);
CREATE POLICY owners_can_read_own_jobs ON public.analysis_jobs FOR SELECT TO public USING ((storyteller_id IN ( SELECT storytellers.id
   FROM storytellers
  WHERE (storytellers.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "Public read" ON public.anao_mmr_compliance FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.anao_mmr_exemptions FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY app_users_select_own ON public.app_users FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = "openId"));
CREATE POLICY "Art & Innovation projects are viewable by everyone" ON public.art_innovation FOR SELECT TO public USING ((status = 'published'::text));
CREATE POLICY art_innovation_profiles_public_read ON public.art_innovation_profiles FOR SELECT TO public USING (true);
CREATE POLICY "Public can view article locations" ON public.article_locations FOR SELECT TO public USING (true);
CREATE POLICY article_related_programs_public_read ON public.article_related_programs FOR SELECT TO public USING (true);
CREATE POLICY "Public can view published articles" ON public.articles FOR SELECT TO public USING ((status = 'published'::text));
CREATE POLICY "Public read" ON public.asic_companies FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.asic_name_lookup FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY assertions_public_read ON public.assertions FOR SELECT TO public USING (((predicate = ANY (ARRAY['delivers_program'::text, 'annual_budget_line_is'::text])) AND (source_url IS NOT NULL) AND (superseded_by IS NULL) AND (audience = 'public'::text) AND (disagreement_kind IS NULL)));
CREATE POLICY "Public read" ON public.asx_companies FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.ato_tax_transparency FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.audit_events FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.auditor_general_audits FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.austender_contracts FOR SELECT TO public USING (true);
CREATE POLICY "Public read active frameworks" ON public.australian_frameworks FOR SELECT TO public USING ((is_active = true));
CREATE POLICY "Public can view authors" ON public.authors FOR SELECT TO public USING (true);
CREATE POLICY bgfit_budget_items_admin_or_org_admin ON public.bgfit_budget_items FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM (bgfit_grants g
     JOIN organization_members om ON ((om.organization_id = g.organization_id)))
  WHERE ((g.id = bgfit_budget_items.grant_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::text))))));
CREATE POLICY bgfit_budget_items_org_read ON public.bgfit_budget_items FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (bgfit_grants g
     JOIN organization_members om ON ((om.organization_id = g.organization_id)))
  WHERE ((g.id = bgfit_budget_items.grant_id) AND (om.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY bgfit_deadlines_admin_or_org_admin ON public.bgfit_deadlines FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))) OR (grant_id IS NULL) OR (EXISTS ( SELECT 1
   FROM (bgfit_grants g
     JOIN organization_members om ON ((om.organization_id = g.organization_id)))
  WHERE ((g.id = bgfit_deadlines.grant_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::text))))));
CREATE POLICY bgfit_deadlines_org_read ON public.bgfit_deadlines FOR SELECT TO public USING (((grant_id IS NULL) OR (EXISTS ( SELECT 1
   FROM (bgfit_grants g
     JOIN organization_members om ON ((om.organization_id = g.organization_id)))
  WHERE ((g.id = bgfit_deadlines.grant_id) AND (om.user_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY bgfit_financial_periods_admin ON public.bgfit_financial_periods FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY bgfit_grants_admin_or_org_admin ON public.bgfit_grants FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.organization_id = bgfit_grants.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::text))))));
CREATE POLICY bgfit_grants_org_read ON public.bgfit_grants FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM organization_members om
  WHERE ((om.organization_id = bgfit_grants.organization_id) AND (om.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY bgfit_suppliers_admin ON public.bgfit_suppliers FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY bgfit_transactions_admin_or_org_admin ON public.bgfit_transactions FOR ALL TO public USING (((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))) OR (EXISTS ( SELECT 1
   FROM (bgfit_grants g
     JOIN organization_members om ON ((om.organization_id = g.organization_id)))
  WHERE ((g.id = bgfit_transactions.grant_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::text))))));
CREATE POLICY bgfit_transactions_org_read ON public.bgfit_transactions FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM (bgfit_grants g
     JOIN organization_members om ON ((om.organization_id = g.organization_id)))
  WHERE ((g.id = bgfit_transactions.grant_id) AND (om.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "Public read of published posts" ON public.blog_posts FOR SELECT TO anon,authenticated USING ((status = 'published'::text));
CREATE POLICY "Users can view their own blog posts" ON public.blog_posts FOR SELECT TO public USING (((EXISTS ( SELECT 1
   FROM public_profiles
  WHERE ((public_profiles.id = blog_posts.author_id) AND (public_profiles.user_id = ( SELECT auth.uid() AS uid))))) OR (( SELECT auth.uid() AS uid) IN ( SELECT public_profiles.user_id
   FROM public_profiles
  WHERE (public_profiles.id = ANY (blog_posts.co_authors))))));
CREATE POLICY "Public read" ON public.bocsar_source_files FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.bocsar_youth_offending FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Authenticated users can read business alerts" ON public.business_alerts FOR SELECT TO public USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Admin read campaign_content" ON public.campaign_content FOR SELECT TO public USING (true);
CREATE POLICY "Admin write campaign_content" ON public.campaign_content FOR ALL TO public USING (true);
CREATE POLICY "Admins can read campaign nominations" ON public.campaign_nominations FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admin read campaign_outreach" ON public.campaign_outreach FOR SELECT TO public USING (true);
CREATE POLICY "Admin write campaign_outreach" ON public.campaign_outreach FOR ALL TO public USING (true);
CREATE POLICY "Public read" ON public.canonical_entities FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "select own or verified" ON public.charity_claims FOR SELECT TO public USING (((( SELECT auth.uid() AS uid) = user_id) OR (status = 'verified'::text)));
CREATE POLICY "Public read" ON public.children_commissioner_reports FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.civic_alerts FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.civic_charter_commitments FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.civic_claim_evidence FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.civic_consultancy_spending FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.civic_digests FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY civic_fund_yj_public_read ON public.civic_funding_yj_classifications FOR SELECT TO public USING ((confirmed_at IS NOT NULL));
CREATE POLICY "Public read" ON public.civic_hansard FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.civic_intelligence_chunks FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY civic_claims_public_read ON public.civic_intelligence_claims FOR SELECT TO public USING ((verification_status = ANY (ARRAY['snapshot'::text, 'verified'::text])));
CREATE POLICY civic_meeting_tags_public_read_confirmed ON public.civic_meeting_tags FOR SELECT TO public USING ((confirmed_at IS NOT NULL));
CREATE POLICY "Public read" ON public.civic_metric_snapshots FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.civic_ministerial_diaries FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.civic_ministerial_statements FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY civic_org_class_public_read_confirmed ON public.civic_org_classifications FOR SELECT TO public USING ((confirmed_at IS NOT NULL));
CREATE POLICY "Public read" ON public.civic_rti_disclosures FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.civicscope_act_entity_bridge FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read access for published pages" ON public.cms_pages FOR SELECT TO public USING (((status)::text = 'published'::text));
CREATE POLICY "Public can view key people" ON public.coe_key_people FOR SELECT TO public USING ((is_active = true));
CREATE POLICY "Public can view collection media" ON public.collection_media FOR SELECT TO public USING ((collection_id IN ( SELECT media_collections.id
   FROM media_collections
  WHERE (media_collections.public_visible = true))));
CREATE POLICY "Public read" ON public.community_directory_orgs FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY community_events_own_data ON public.community_events FOR ALL TO public USING ((((( SELECT auth.uid() AS uid))::text = (user_id)::text) OR ((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'service_role'::text)));
CREATE POLICY "Public read" ON public.community_outcome_definitions FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.community_outcome_validations FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.compliance_ack FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Authenticated users can read compliance tracking" ON public.compliance_tracking FOR SELECT TO public USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Authenticated users can read contact enrichments" ON public.contact_enrichments FOR SELECT TO public USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Authenticated users can read contact intelligence" ON public.contact_intelligence FOR SELECT TO public USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Users can view all scores" ON public.contact_intelligence_scores FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage contact submissions" ON public.contact_submissions FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can manage contained capture log" ON public.contained_capture_log FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY content_placements_select_active ON public.content_placements FOR SELECT TO public USING ((active = true));
CREATE POLICY "Public read" ON public.coroners_findings FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.crime_stats_lga FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.cross_system_stats FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.data_agent_findings FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY data_catalogue_public_read ON public.data_catalogue FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.data_gap_questions FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.data_sources_inventory FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY device_sessions_admin_read ON public.device_sessions FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY device_sessions_self_read ON public.device_sessions FOR SELECT TO public USING ((auth_user_id = auth.uid()));
CREATE POLICY discoveries_read ON public.discoveries FOR SELECT TO public USING (true);
CREATE POLICY public_read_discrimination_reports ON public.discrimination_reports FOR SELECT TO anon USING (true);
CREATE POLICY "Public read" ON public.donor_entity_matches FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.dss_payment_demographics FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public can read approved enrichments" ON public.enrichment_reviews FOR SELECT TO public USING ((status = 'approved'::text));
CREATE POLICY enrollment_codes_admin_all ON public.enrollment_codes FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Public read" ON public.entity_identifiers FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.entity_merge_log FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.entity_potential_matches FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Users can manage own watches" ON public.entity_watches FOR ALL TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Public read" ON public.entity_xref FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Service role manages event feedback" ON public.event_feedback FOR ALL TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Admins can read event registrations" ON public.event_registrations FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Public can view public events" ON public.events FOR SELECT TO public USING ((is_public = true));
CREATE POLICY "Public read" ON public.exhibition_service_submissions FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read access" ON public.facility_partnerships FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.fellows FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.finance_ai_routing_suggestions FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.foundation_categories FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.foundation_category_assignments FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.foundation_geo_focus FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.foundation_grantees FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Users manage own notes" ON public.foundation_notes FOR ALL TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Public read" ON public.foundation_people FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.foundation_power_profiles FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.foundation_program_years FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.foundation_programs FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.foundation_relationship_signals FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.foundations FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY anon_read_messages ON public.founder_intake_messages FOR SELECT TO anon USING (true);
CREATE POLICY anon_read_signals ON public.founder_intake_signals FOR SELECT TO anon USING (true);
CREATE POLICY anon_read_intakes ON public.founder_intakes FOR SELECT TO anon USING (true);
CREATE POLICY "Public read" ON public.funder_allowlist FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.funder_blocklist FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.funder_briefs FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.funder_context_snapshot FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.funder_nudge_log FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY funder_portfolio_entities_service ON public.funder_portfolio_entities FOR ALL TO public USING (true);
CREATE POLICY funder_portfolio_entities_user_policy ON public.funder_portfolio_entities FOR ALL TO public USING ((portfolio_id IN ( SELECT funder_portfolios.id
   FROM funder_portfolios
  WHERE (funder_portfolios.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY funder_portfolios_service ON public.funder_portfolios FOR ALL TO public USING (true);
CREATE POLICY funder_portfolios_user_policy ON public.funder_portfolios FOR ALL TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Admins can manage all funder profiles" ON public.funder_profiles FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Users can read own funder profile" ON public.funder_profiles FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Public read funding_awards" ON public.funding_awards FOR SELECT TO public USING (((community_governance_required = true) OR (public_summary IS NOT NULL)));
CREATE POLICY "ingest sources are readable" ON public.funding_ingest_sources FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read funding_programs" ON public.funding_programs FOR SELECT TO public USING ((public_transparency_required = true));
CREATE POLICY "Public read funding_sources" ON public.funding_sources FOR SELECT TO public USING ((is_active = true));
CREATE POLICY "Public read" ON public.goods_deployment_batches FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.goods_relationships FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.goods_tranches FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.government_programs FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Users can manage their org answer bank" ON public.grant_answer_bank FOR ALL TO public USING ((org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "Public read" ON public.grant_application_requirements FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.grant_applications FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.grant_assets FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Users can manage their own feedback" ON public.grant_feedback FOR ALL TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Public read" ON public.grant_frontier_source_snapshots FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.grant_funder_documents FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY users_own_grant_notifications ON public.grant_notification_outbox FOR SELECT TO public USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Authenticated users can read grant opportunities" ON public.grant_opportunities FOR SELECT TO public USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Public read" ON public.grantconnect_awards FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.gs_entities FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.gs_entity_aliases FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.gs_relationships FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Anyone can view approved harvest businesses" ON public.harvest_businesses FOR SELECT TO public USING ((status = 'approved'::text));
CREATE POLICY "Service role manages harvest businesses" ON public.harvest_businesses FOR ALL TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Anyone can view approved harvest events" ON public.harvest_events FOR SELECT TO public USING ((status = 'approved'::text));
CREATE POLICY "Service role manages harvest events" ON public.harvest_events FOR ALL TO public USING ((auth.role() = 'service_role'::text));
CREATE POLICY "Public can view inquiries" ON public.historical_inquiries FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.idea_ack FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.idea_snoozes FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Authenticated read access on ignored_email_patterns" ON public.ignored_email_patterns FOR SELECT TO public USING (true);
CREATE POLICY "International programs are viewable by everyone" ON public.international_programs FOR SELECT TO public USING ((status = 'published'::text));
CREATE POLICY "Public read" ON public.jr_evaluations FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "jr_publication_snapshots public read" ON public.jr_publication_snapshots FOR SELECT TO anon,authenticated USING (((status = 'published'::text) AND (withdrawn_at IS NULL) AND (EXISTS ( SELECT 1
   FROM jr_sites site
  WHERE ((site.id = jr_publication_snapshots.jr_site_id) AND (site.published_at IS NOT NULL))))));
CREATE POLICY "jr_site_impact_figures public read" ON public.jr_site_impact_figures FOR SELECT TO anon,authenticated USING (((visibility = 'public'::text) AND (withdrawn_at IS NULL)));
CREATE POLICY "jr_site_links public read" ON public.jr_site_links FOR SELECT TO anon,authenticated USING ((is_public = true));
CREATE POLICY "jr_site_metrics public read" ON public.jr_site_metrics FOR SELECT TO anon,authenticated USING (((confirmed = true) OR (verify_verdict IS NOT NULL)));
CREATE POLICY "jr_site_research_items public read" ON public.jr_site_research_items FOR SELECT TO anon,authenticated USING (((visibility = 'public'::text) AND (withdrawn_at IS NULL)));
CREATE POLICY "jr_sites public read" ON public.jr_sites FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY justice_funding_admin_write ON public.justice_funding FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY justice_funding_public_read ON public.justice_funding FOR SELECT TO public USING (true);
CREATE POLICY "Public read access for campaigns" ON public.justice_matrix_campaigns FOR SELECT TO public USING (true);
CREATE POLICY "public read case-campaign links" ON public.justice_matrix_case_campaigns FOR SELECT TO public USING (true);
CREATE POLICY "Public read access for cases" ON public.justice_matrix_cases FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.justice_matrix_gaps FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "public read published issues" ON public.justice_matrix_issues FOR SELECT TO public USING ((is_published = true));
CREATE POLICY "Public read" ON public.justice_reinvestment_sites FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public can view nodes" ON public.justicehub_nodes FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.kiosk_control_signals FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Anon read access on knowledge_chunks" ON public.knowledge_chunks FOR SELECT TO public USING (true);
CREATE POLICY org_chunks_select ON public.knowledge_chunks FOR SELECT TO public USING (((org_profile_id IS NULL) OR (org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "Authenticated users can view extraction queue" ON public.knowledge_extraction_queue FOR SELECT TO public USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Authenticated users can view source sync status" ON public.knowledge_source_sync FOR SELECT TO public USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY "Sources are viewable by everyone" ON public.knowledge_sources FOR SELECT TO public USING (true);
CREATE POLICY org_sources_select ON public.knowledge_sources FOR SELECT TO public USING (((org_profile_id IS NULL) OR (org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "Knowledge is viewable by everyone" ON public.knowledge_versions FOR SELECT TO public USING ((status = 'active'::text));
CREATE POLICY "Authenticated read access on learned_thresholds" ON public.learned_thresholds FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.lga_cross_system_stats FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON public.linkedin_contacts FOR SELECT TO public USING (true);
CREATE POLICY "Public read access for locations" ON public.locations FOR SELECT TO public USING (true);
CREATE POLICY "Public can view public collections" ON public.media_collections FOR SELECT TO public USING ((public_visible = true));
CREATE POLICY "Public can read media_items" ON public.media_items FOR SELECT TO public USING (true);
CREATE POLICY "Public can view approved media" ON public.media_items FOR SELECT TO public USING (((community_approved = true) AND (consent_verified = true)));
CREATE POLICY "Users can read own actions" ON public.member_actions FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY mentorships_public_read ON public.mentorships FOR SELECT TO public USING ((is_public = true));
CREATE POLICY "Messages are readable by portrait owner" ON public.messages FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.mmr_unspsc_categories FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.name_aliases FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.ndis_active_providers FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.ndis_compliance_actions FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.ndis_first_nations FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.ndis_market_concentration FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.ndis_participants FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.ndis_participants_lga FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.ndis_plan_budgets FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.ndis_providers FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.ndis_registered_providers FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.ndis_sda FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.ndis_utilisation FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read active" ON public.network_memberships FOR SELECT TO public USING ((status = 'active'::text));
CREATE POLICY "Public read" ON public.newsletter_candidates FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.newsletter_drafts FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Admins can read newsletter subscriptions" ON public.newsletter_subscriptions FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Public read" ON public.nt_communities FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "opportunity decisions select own" ON public.opportunity_decisions FOR SELECT TO public USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM org_members om
  WHERE ((om.org_profile_id = opportunity_decisions.org_profile_id) AND (om.user_id = auth.uid()))))));
CREATE POLICY "Admins can read org_action_items" ON public.org_action_items FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY org_applicant_entities_select ON public.org_applicant_entities FOR SELECT TO public USING (user_can_access_org(org_profile_id));
CREATE POLICY "Admins can read org_compliance_docs" ON public.org_compliance_docs FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY org_contacts_select ON public.org_contacts FOR SELECT TO public USING (user_can_access_org(org_profile_id));
CREATE POLICY "Admins can read org_deadlines" ON public.org_deadlines FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can read org_grant_budget_lines" ON public.org_grant_budget_lines FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can read org_grants" ON public.org_grants FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY org_leadership_select ON public.org_leadership FOR SELECT TO public USING (user_can_access_org(org_profile_id));
CREATE POLICY "admin manage memberships" ON public.org_members FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM org_members om
  WHERE ((om.org_profile_id = org_members.org_profile_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.role = 'admin'::text)))));
CREATE POLICY "owner sees memberships" ON public.org_members FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM org_profiles op
  WHERE ((op.id = org_members.org_profile_id) AND (op.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "select own memberships" ON public.org_members FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Admins can read org_milestones" ON public.org_milestones FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can read org_participants" ON public.org_participants FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY org_pipeline_select ON public.org_pipeline FOR SELECT TO public USING (user_can_access_org(org_profile_id));
CREATE POLICY "Users manage own profile" ON public.org_profiles FOR ALL TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY org_program_source_links_select ON public.org_program_source_links FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM org_programs op
  WHERE ((op.id = org_program_source_links.org_program_id) AND user_can_access_org(op.org_profile_id)))));
CREATE POLICY org_programs_select ON public.org_programs FOR SELECT TO public USING (user_can_access_org(org_profile_id));
CREATE POLICY org_project_foundation_interactions_select ON public.org_project_foundation_interactions FOR SELECT TO public USING (user_can_access_org(org_profile_id));
CREATE POLICY org_project_foundation_research_select ON public.org_project_foundation_research FOR SELECT TO public USING (user_can_access_org(org_profile_id));
CREATE POLICY org_project_foundations_select ON public.org_project_foundations FOR SELECT TO public USING (user_can_access_org(org_profile_id));
CREATE POLICY org_projects_select ON public.org_projects FOR SELECT TO public USING (user_can_access_org(org_profile_id));
CREATE POLICY "Admins can read org_referrals" ON public.org_referrals FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Admins can read org_sessions" ON public.org_sessions FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "funding summaries are public unless withdrawn" ON public.organization_funding_summaries FOR SELECT TO anon,authenticated USING ((withdrawn_at IS NULL));
CREATE POLICY org_members_admin_access ON public.organization_members FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.role = ANY (ARRAY['admin'::text, 'super_admin'::text]))))));
CREATE POLICY outreach_log_admin_read ON public.organization_outreach_log FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY outreach_log_admin_write ON public.organization_outreach_log FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = 'admin'::text)))));
CREATE POLICY "Public read access for organizations" ON public.organizations FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.oric_corporations FOR SELECT TO public USING (true);
CREATE POLICY outcome_submissions_own ON public.outcome_submissions FOR ALL TO public USING ((submitted_by = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Admins can manage page galleries" ON public.page_gallery FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Anyone can read page galleries" ON public.page_gallery FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.parliament_bills FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public can view contacts" ON public.partner_contacts FOR SELECT TO public USING (true);
CREATE POLICY "Public can view goals" ON public.partner_goals FOR SELECT TO public USING (true);
CREATE POLICY "Public can view impact metrics" ON public.partner_impact_metrics FOR SELECT TO public USING ((is_featured = true));
CREATE POLICY "Public can view public photos" ON public.partner_photos FOR SELECT TO public USING ((is_public = true));
CREATE POLICY "Public can view public stories" ON public.partner_stories FOR SELECT TO public USING (((is_public = true) AND (consent_level = 'public'::text)));
CREATE POLICY "Public can view public storytellers" ON public.partner_storytellers FOR SELECT TO public USING (((is_public = true) AND (consent_level = 'public'::text)));
CREATE POLICY "Public can view public videos" ON public.partner_videos FOR SELECT TO public USING ((is_public = true));
CREATE POLICY "Public read" ON public.partnership_inquiries FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.peer_validations FOR SELECT TO public USING ((is_public = true));
CREATE POLICY "Public read" ON public.people FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.person_entity_links FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Allow authenticated read" ON public.person_identity_map FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.person_role_holdings FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.person_roles FOR SELECT TO public USING (true);
CREATE POLICY "Public read place snapshot" ON public.place_funding_snapshot FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Platform organization media isolation" ON public.platform_media_items FOR ALL TO public USING ((platform_organization_id = get_current_platform_organization_id()));
CREATE POLICY "Platform organization processing isolation" ON public.platform_media_processing_jobs FOR ALL TO public USING ((platform_organization_id = get_current_platform_organization_id()));
CREATE POLICY "Users see their own platform organization" ON public.platform_organizations FOR ALL TO public USING ((id = get_current_platform_organization_id()));
CREATE POLICY "Active PMPP is viewable by everyone" ON public.pmpp_knowledge FOR SELECT TO public USING ((status = 'active'::text));
CREATE POLICY "Public read" ON public.political_donations FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Allow all reads" ON public.portraits FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.postcode_geo FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.postcode_sa2_concordance FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY org_procurement_alerts_manage ON public.procurement_alerts FOR ALL TO public USING ((org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_procurement_notification_channels_manage ON public.procurement_notification_channels FOR ALL TO public USING ((org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_procurement_notification_outbox_manage ON public.procurement_notification_outbox FOR ALL TO public USING ((org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_procurement_pack_exports_manage ON public.procurement_pack_exports FOR ALL TO public USING ((org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_procurement_pending_team_invites_manage ON public.procurement_pending_team_invites FOR ALL TO public USING ((org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_procurement_shortlist_comments_manage ON public.procurement_shortlist_comments FOR ALL TO public USING ((org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_procurement_shortlist_events_select ON public.procurement_shortlist_events FOR SELECT TO public USING ((org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_procurement_shortlist_items_manage ON public.procurement_shortlist_items FOR ALL TO public USING ((shortlist_id IN ( SELECT procurement_shortlists.id
   FROM procurement_shortlists
  WHERE (procurement_shortlists.org_profile_id IN ( SELECT org_profiles.id
           FROM org_profiles
          WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
        UNION
         SELECT org_members.org_profile_id
           FROM org_members
          WHERE (org_members.user_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY org_procurement_shortlist_watches_manage ON public.procurement_shortlist_watches FOR ALL TO public USING ((org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_procurement_shortlists_manage ON public.procurement_shortlists FOR ALL TO public USING ((org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_procurement_tasks_manage ON public.procurement_tasks FOR ALL TO public USING ((org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_procurement_team_settings_manage ON public.procurement_team_settings FOR ALL TO public USING ((org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY org_procurement_workflow_runs_select ON public.procurement_workflow_runs FOR SELECT TO public USING (((user_id = ( SELECT auth.uid() AS uid)) OR (org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY profile_appearances_admin_write ON public.profile_appearances FOR ALL TO public USING (((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'service_role'::text));
CREATE POLICY profile_appearances_public_read ON public.profile_appearances FOR SELECT TO public USING (true);
CREATE POLICY profiles_own_data ON public.profiles FOR ALL TO public USING ((( SELECT auth.uid() AS uid) = id));
CREATE POLICY "Admins can read project backers" ON public.project_backers FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Authenticated users can read project health analysis" ON public.project_health_analysis FOR SELECT TO public USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY pk_read_all ON public.project_knowledge FOR SELECT TO public USING (true);
CREATE POLICY "Public can read project_media_links" ON public.project_media_links FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.project_pipelines FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Allow all access for service role" ON public.project_strategic_profile FOR ALL TO public USING (true);
CREATE POLICY "Admins can view all profiles" ON public.public_profiles FOR SELECT TO public USING (is_admin());
CREATE POLICY "Anyone can view public profiles" ON public.public_profiles FOR SELECT TO public USING ((is_public = true));
CREATE POLICY "Users can view own profile" ON public.public_profiles FOR SELECT TO public USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "Public read public_spending_transactions" ON public.public_spending_transactions FOR SELECT TO public USING ((community_visible = true));
CREATE POLICY "Pulse events are readable" ON public.pulse_events FOR SELECT TO public USING (true);
CREATE POLICY "Published pulse links are public" ON public.pulse_report_links FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM pulse_reports r
  WHERE ((r.id = pulse_report_links.report_id) AND (r.status = 'published'::text)))));
CREATE POLICY "Public read" ON public.qbe_evaluations FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.qld_watchhouse_snapshot_rows FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.qld_watchhouse_snapshots FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY quotes_access ON public.quotes FOR ALL TO public USING (((visibility = 'public'::text) OR ((visibility = 'organization'::text) AND (EXISTS ( SELECT 1
   FROM (storytellers st
     JOIN organization_members om ON ((st.organization_id = om.organization_id)))
  WHERE ((st.id = quotes.storyteller_id) AND (om.user_id = ( SELECT auth.uid() AS uid)) AND (om.status = 'active'::text)))))));
CREATE POLICY "Authenticated read access on recommendation_outcomes" ON public.recommendation_outcomes FOR SELECT TO public USING (true);
CREATE POLICY "Allow public read access to community programs" ON public.registered_services FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY community_programs_profiles_public_read ON public.registered_services_profiles FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.report_feedback FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.report_submissions FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.research_grants FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read active research" ON public.research_items FOR SELECT TO public USING ((is_active = true));
CREATE POLICY "Authenticated write access for curated entries" ON public.review_curated_entries FOR ALL TO public USING (true);
CREATE POLICY "Public read access for curated entries" ON public.review_curated_entries FOR SELECT TO public USING (true);
CREATE POLICY "Public can view review media links" ON public.review_media_links FOR SELECT TO public USING (true);
CREATE POLICY "Service role full access review_media_links" ON public.review_media_links FOR ALL TO public USING (true);
CREATE POLICY "Public can view published review projects" ON public.review_projects FOR SELECT TO public USING ((is_published = true));
CREATE POLICY "Service role full access review_projects" ON public.review_projects FOR ALL TO public USING (true);
CREATE POLICY "Public can view review videos" ON public.review_videos FOR SELECT TO public USING (true);
CREATE POLICY "Service role full access review_videos" ON public.review_videos FOR ALL TO public USING (true);
CREATE POLICY "Authenticated write access for year settings" ON public.review_year_settings FOR ALL TO public USING (true);
CREATE POLICY "Public read access for year settings" ON public.review_year_settings FOR SELECT TO public USING (true);
CREATE POLICY rogs_auth_write ON public.rogs_justice_spending FOR ALL TO public USING ((( SELECT auth.role() AS role) = 'authenticated'::text));
CREATE POLICY rogs_public_read ON public.rogs_justice_spending FOR SELECT TO public USING (true);
CREATE POLICY "Public can view role taxonomy" ON public.role_taxonomy FOR SELECT TO public USING ((is_active = true));
CREATE POLICY "Public read" ON public.sa2_reference FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY public_read_sa3_regions ON public.sa3_regions FOR SELECT TO anon USING (true);
CREATE POLICY "Users manage own saved foundations" ON public.saved_foundations FOR ALL TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "org members see shared foundations" ON public.saved_foundations FOR SELECT TO public USING (((org_profile_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM org_members om
  WHERE ((om.org_profile_id = saved_foundations.org_profile_id) AND (om.user_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY "org members see shared grants" ON public.saved_grants FOR SELECT TO public USING (((org_profile_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM org_members om
  WHERE ((om.org_profile_id = saved_grants.org_profile_id) AND (om.user_id = ( SELECT auth.uid() AS uid)))))));
CREATE POLICY "select own" ON public.saved_grants FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Public read" ON public.scag_communiques FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.se_buyer_prospects FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.se_search_index FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.seifa_2021 FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY services_profiles_public_read ON public.services_profiles FOR SELECT TO public USING (true);
CREATE POLICY anon_read_signal_content ON public.signal_content FOR SELECT TO anon USING (true);
CREATE POLICY anon_read_signal_events ON public.signal_events FOR SELECT TO anon USING (true);
CREATE POLICY "Admin can write site_config" ON public.site_config FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Public can read site_config" ON public.site_config FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.social_enterprises FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.state_tenders FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY service_role_story_analysis_all ON public.story_analysis FOR ALL TO public USING (((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'service_role'::text));
CREATE POLICY storyteller_story_analysis_select ON public.story_analysis FOR SELECT TO public USING (((storyteller_id IN ( SELECT storytellers.id
   FROM storytellers
  WHERE (storytellers.user_id = ( SELECT auth.uid() AS uid)))) OR ((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'service_role'::text)));
CREATE POLICY "Public read comments" ON public.story_comments FOR SELECT TO public USING (true);
CREATE POLICY "Public read reactions" ON public.story_reactions FOR SELECT TO public USING (true);
CREATE POLICY story_related_programs_public_read ON public.story_related_programs FOR SELECT TO public USING (true);
CREATE POLICY "story_related_sites public read" ON public.story_related_sites FOR SELECT TO anon,authenticated USING (((is_active = true) AND (consent_level IS DISTINCT FROM 'strictly_private'::text) AND (EXISTS ( SELECT 1
   FROM jr_sites
  WHERE ((jr_sites.id = story_related_sites.jr_site_id) AND (jr_sites.published_at IS NOT NULL))))));
CREATE POLICY storyteller_videos_public_read ON public.storyteller_videos FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users can read storytellers with consent" ON public.storytellers FOR SELECT TO public USING ((((( SELECT auth.role() AS role) = 'authenticated'::text) OR (( SELECT auth.role() AS role) = 'service_role'::text)) AND (consent_given = true)));
CREATE POLICY "Public read for consenting storytellers" ON public.storytellers FOR SELECT TO public USING (((consent_given = true) AND (((privacy_preferences ->> 'public_display'::text))::boolean = true)));
CREATE POLICY "Service role has full access to storytellers" ON public.storytellers FOR ALL TO public USING (true);
CREATE POLICY "Allow all access for service role" ON public.strategic_objectives FOR ALL TO public USING (true);
CREATE POLICY "Public read" ON public.supporter_comms_summary FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.supporters_intelligence FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Authenticated read access on tag_inference_rules" ON public.tag_inference_rules FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.tagging_sweep_runs FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.telegram_mutes FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Users can view own usage" ON public.ti_usage_log FOR SELECT TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Admins can read tour reactions" ON public.tour_reactions FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY tour_stops_admin_write ON public.tour_stops FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::text)))));
CREATE POLICY tour_stops_public_read ON public.tour_stops FOR SELECT TO public USING (true);
CREATE POLICY "Admins can manage tour stories" ON public.tour_stories FOR ALL TO public USING ((EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.role = 'admin'::text)))));
CREATE POLICY "Public can read approved tour stories" ON public.tour_stories FOR SELECT TO public USING (((status = 'approved'::text) AND (is_public = true)));
CREATE POLICY service_role_transcript_analysis_all ON public.transcript_analysis FOR ALL TO public USING (((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'service_role'::text));
CREATE POLICY story_analysis_analytics_read ON public.transcript_analysis FOR SELECT TO public USING ((processing_status = 'completed'::text));
CREATE POLICY storyteller_transcript_analysis_select ON public.transcript_analysis FOR SELECT TO public USING (((storyteller_id IN ( SELECT storytellers.id
   FROM storytellers
  WHERE (storytellers.user_id = ( SELECT auth.uid() AS uid)))) OR ((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'service_role'::text)));
CREATE POLICY "Users manage own pipeline" ON public.user_grant_tracking FOR ALL TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY "Users manage own tracking" ON public.user_grant_tracking FOR ALL TO public USING ((( SELECT auth.uid() AS uid) = user_id));
CREATE POLICY user_profiles_own_data ON public.user_profiles FOR ALL TO public USING (((( SELECT auth.uid() AS uid))::text = (user_id)::text));
CREATE POLICY vendor_rules_read_all ON public.vendor_project_rules FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.vic_grants_awarded FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read" ON public.whats_new_subscribers FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Wiki versions are readable if page is active" ON public.wiki_page_versions FOR SELECT TO public USING ((EXISTS ( SELECT 1
   FROM wiki_pages
  WHERE ((wiki_pages.id = wiki_page_versions.page_id) AND (wiki_pages.status = 'active'::text)))));
CREATE POLICY "Active wiki pages are publicly readable" ON public.wiki_pages FOR SELECT TO public USING ((status = 'active'::text));
CREATE POLICY org_wiki_select ON public.wiki_pages FOR SELECT TO public USING (((org_profile_id IS NULL) OR (org_profile_id IN ( SELECT org_profiles.id
   FROM org_profiles
  WHERE (org_profiles.user_id = ( SELECT auth.uid() AS uid))
UNION
 SELECT org_members.org_profile_id
   FROM org_members
  WHERE (org_members.user_id = ( SELECT auth.uid() AS uid))))));
CREATE POLICY "Public read" ON public.xero_payments FOR SELECT TO anon,authenticated USING (true);
CREATE POLICY "Public read access" ON public.youth_detention_facilities FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.youth_opportunities FOR SELECT TO public USING (true);
CREATE POLICY "Public read" ON public.youth_survey_results FOR SELECT TO anon,authenticated USING (true);
