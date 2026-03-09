# GrantScope Schema Cache

Generated: 2026-03-09. Refresh with:
```bash
node --env-file=.env scripts/preflight.mjs --refresh
```

## gs_entities (93K rows)
| Column | Type | Nullable |
|--------|------|----------|
| id | uuid | NOT NULL |
| entity_type | text | NOT NULL |
| canonical_name | text | NOT NULL |
| abn | text |  |
| acn | text |  |
| gs_id | text | NOT NULL |
| description | text |  |
| website | text |  |
| state | text |  |
| postcode | text |  |
| sector | text |  |
| sub_sector | text |  |
| tags | text[] |  |
| source_datasets | text[] | NOT NULL |
| source_count | integer |  |
| confidence | text |  |
| latest_revenue | numeric |  |
| latest_assets | numeric |  |
| latest_tax_payable | numeric |  |
| financial_year | text |  |
| first_seen | timestamp with time zone |  |
| last_seen | timestamp with time zone |  |
| created_at | timestamp with time zone |  |
| updated_at | timestamp with time zone |  |
| seifa_irsd_decile | smallint |  |
| remoteness | text |  |
| sa2_code | text |  |
| is_community_controlled | boolean |  |
| lga_name | text |  |
| lga_code | text |  |

## gs_relationships (65K rows)
| Column | Type | Nullable |
|--------|------|----------|
| id | uuid | NOT NULL |
| source_entity_id | uuid | NOT NULL |
| target_entity_id | uuid | NOT NULL |
| relationship_type | text | NOT NULL |
| amount | numeric |  |
| currency | text |  |
| year | integer |  |
| start_date | date |  |
| end_date | date |  |
| dataset | text | NOT NULL |
| source_record_id | text |  |
| source_url | text |  |
| confidence | text |  |
| first_seen | timestamp with time zone |  |
| last_seen | timestamp with time zone |  |
| created_at | timestamp with time zone |  |
| properties | jsonb |  |

## austender_contracts (672K rows)
| Column | Type | Nullable |
|--------|------|----------|
| id | uuid | NOT NULL |
| ocid | text | NOT NULL |
| release_id | text |  |
| title | text |  |
| description | text |  |
| contract_value | numeric |  |
| currency | text |  |
| procurement_method | text |  |
| category | text |  |
| contract_start | date |  |
| contract_end | date |  |
| date_published | timestamp with time zone |  |
| date_modified | timestamp with time zone |  |
| buyer_name | text |  |
| buyer_id | text |  |
| supplier_name | text |  |
| supplier_abn | text |  |
| supplier_id | text |  |
| supplier_acnc_match | boolean |  |
| supplier_oric_match | boolean |  |
| supplier_entity_type | text |  |
| source_url | text |  |
| created_at | timestamp with time zone |  |
| updated_at | timestamp with time zone |  |

## justice_funding (53K rows)
| Column | Type | Nullable |
|--------|------|----------|
| id | uuid | NOT NULL |
| source | text | NOT NULL |
| source_url | text |  |
| source_statement_id | text |  |
| recipient_name | text | NOT NULL |
| recipient_abn | text |  |
| program_name | text | NOT NULL |
| program_round | text |  |
| amount_dollars | numeric |  |
| state | text |  |
| location | text |  |
| funding_type | text |  |
| sector | text |  |
| project_description | text |  |
| announcement_date | date |  |
| financial_year | text |  |
| alma_intervention_id | uuid |  |
| alma_organization_id | uuid |  |
| created_at | timestamp with time zone |  |
| updated_at | timestamp with time zone |  |

## foundations (11K rows)
| Column | Type | Nullable |
|--------|------|----------|
| id | uuid | NOT NULL |
| acnc_abn | text |  |
| name | text | NOT NULL |
| type | text |  |
| website | text |  |
| description | text |  |
| total_giving_annual | numeric(18,2) |  |
| giving_history | jsonb |  |
| avg_grant_size | numeric(18,2) |  |
| grant_range_min | numeric(18,2) |  |
| grant_range_max | numeric(18,2) |  |
| thematic_focus | text[] |  |
| geographic_focus | text[] |  |
| target_recipients | text[] |  |
| endowment_size | numeric(18,2) |  |
| investment_returns | numeric(18,2) |  |
| giving_ratio | numeric(8,2) |  |
| revenue_sources | text[] |  |
| parent_company | text |  |
| asx_code | text |  |
| open_programs | jsonb |  |
| acnc_data | jsonb |  |
| last_scraped_at | timestamp with time zone |  |
| profile_confidence | text |  |
| created_at | timestamp with time zone |  |
| updated_at | timestamp with time zone |  |
| giving_philosophy | text |  |
| wealth_source | text |  |
| application_tips | text |  |
| notable_grants | text[] |  |
| board_members | text[] |  |
| scraped_urls | text[] |  |
| enrichment_source | text |  |
| enriched_at | timestamp with time zone |  |

## grant_opportunities (17K rows)
| Column | Type | Nullable |
|--------|------|----------|
| id | uuid | NOT NULL |
| name | text | NOT NULL |
| description | text |  |
| amount_min | integer |  |
| amount_max | integer |  |
| deadline | date |  |
| source | text | NOT NULL |
| relevance_score | integer |  |
| application_status | text |  |
| url | text |  |
| requirements | text |  |
| metadata | jsonb |  |
| created_at | timestamp with time zone |  |
| updated_at | timestamp with time zone |  |
| provider | text |  |
| program | text |  |
| aligned_projects | text[] |  |
| categories | text[] |  |
| focus_areas | text[] |  |
| fit_score | integer |  |
| discovered_by | text |  |
| closes_at | date |  |
| feedback | jsonb |  |
| eligibility_criteria | jsonb |  |
| assessment_criteria | jsonb |  |
| timeline_stages | jsonb |  |
| funder_info | jsonb |  |
| grant_structure | jsonb |  |
| ghl_opportunity_id | text |  |
| requirements_summary | text |  |
| act_readiness | jsonb |  |
| enriched_at | timestamp with time zone |  |
| enrichment_source | text |  |
| sources | jsonb |  |
| discovery_method | text |  |
| last_verified_at | timestamp with time zone |  |
| grant_type | text |  |
| embedding | vector(1536) |  |
| embedding_model | text |  |
| embedded_at | timestamp with time zone |  |
| target_recipients | text[] |  |
| foundation_id | uuid |  |
| program_type | text |  |
| last_deadline_alert_at | timestamp with time zone |  |

## postcode_geo (12K rows)
| Column | Type | Nullable |
|--------|------|----------|
| postcode | text | NOT NULL |
| locality | text | NOT NULL |
| state | text |  |
| latitude | numeric(10,6) |  |
| longitude | numeric(10,6) |  |
| sa2_code | text |  |
| sa2_name | text |  |
| sa3_code | text |  |
| sa3_name | text |  |
| sa4_code | text |  |
| sa4_name | text |  |
| remoteness_2021 | text |  |
| lga_name | text |  |
| lga_code | text |  |

## org_profiles (0K rows)
| Column | Type | Nullable |
|--------|------|----------|
| id | uuid | NOT NULL |
| user_id | uuid | NOT NULL |
| name | text | NOT NULL |
| description | text |  |
| mission | text |  |
| abn | text |  |
| website | text |  |
| domains | text[] |  |
| geographic_focus | text[] |  |
| org_type | text |  |
| annual_revenue | numeric(14,2) |  |
| team_size | integer |  |
| projects | jsonb |  |
| embedding | vector(1536) |  |
| embedding_text | text |  |
| notify_email | boolean |  |
| notify_threshold | numeric(3,2) |  |
| created_at | timestamp with time zone |  |
| updated_at | timestamp with time zone |  |
| stripe_customer_id | text |  |
| subscription_plan | text |  |
| subscription_status | text |  |
