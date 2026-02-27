/**
 * Foundation types for GrantScope
 */

export interface Foundation {
  id?: string;
  acnc_abn: string;
  name: string;
  type: FoundationType | null;
  website: string | null;
  description: string | null;
  total_giving_annual: number | null;
  giving_history: GivingYear[] | null;
  avg_grant_size: number | null;
  grant_range_min: number | null;
  grant_range_max: number | null;
  thematic_focus: string[];
  geographic_focus: string[];
  target_recipients: string[];
  endowment_size: number | null;
  investment_returns: number | null;
  giving_ratio: number | null;
  revenue_sources: string[];
  parent_company: string | null;
  asx_code: string | null;
  open_programs: FoundationProgram[] | null;
  acnc_data: Record<string, unknown> | null;
  last_scraped_at: string | null;
  profile_confidence: 'low' | 'medium' | 'high';
}

export type FoundationType =
  | 'private_ancillary_fund'
  | 'public_ancillary_fund'
  | 'trust'
  | 'corporate_foundation';

export interface GivingYear {
  year: number;
  amount: number;
}

export interface FoundationProgram {
  name: string;
  url?: string;
  amount?: number;
  deadline?: string;
  description?: string;
}

export interface ACNCRecord {
  ABN: string;
  'Charity_Legal_Name': string;
  'Other_Organisation_Names': string;
  'Address_Type': string;
  'Address_Line_1': string;
  'Town_City': string;
  'State': string;
  'Postcode': string;
  'Country': string;
  'Charity_Size': string;
  'Charity_Type': string;
  'Charity_Subtype': string;
  'Registration_Date': string;
  'Registration_Status': string;
  'Date_Organisation_Established': string;
  'Website': string;
  'Operates_in_ACT': string;
  'Operates_in_NSW': string;
  'Operates_in_NT': string;
  'Operates_in_QLD': string;
  'Operates_in_SA': string;
  'Operates_in_TAS': string;
  'Operates_in_VIC': string;
  'Operates_in_WA': string;
  [key: string]: string;
}
