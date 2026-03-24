export type ProgramRow = { program_name: string; grants: number; total: number; orgs: number };
export type OrgRow = { recipient_name: string; recipient_abn: string | null; state: string | null; grants: number; total: number; gs_id: string | null };
export type AlmaRow = { name: string; type: string | null; evidence_level: string | null; geography: string | null; portfolio_score: number | null; gs_id: string | null; org_name: string | null; org_abn: string | null };
export type LgaRow = { lga_name: string; state: string; orgs: number; total_funding: number; seifa_decile: number | null };
export type MetricRow = { metric_name: string; metric_value: number; metric_unit: string; period: string; cohort: string | null; source: string; notes: string | null };
export type PolicyRow = { event_date: string; title: string; description: string; event_type: string; severity: string; source: string | null; impact_summary: string | null; metadata: Record<string, unknown> | null };
export type OversightRow = { oversight_body: string; report_title: string; report_date: string; report_url: string | null; recommendation_number: string; recommendation_text: string; status: string; status_notes: string | null; severity: string | null };
export type CrossSystemRow = { gs_id: string; canonical_name: string; entity_type: string | null; topics: string[]; topic_count: number; total_funding: number };
