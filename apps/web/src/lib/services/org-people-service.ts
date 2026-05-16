import { cache } from 'react';
import { getServiceSupabase } from '@/lib/supabase';
import { isActSlug } from '@/lib/services/fast-local-org';

export type PersonCategory = 'family' | 'contractor' | 'contact' | 'network';

export interface PersonRow {
  person_name: string;
  person_category: PersonCategory;
  /** Comma-separated source list, e.g. "xero,ghl,gs_entity" */
  sources: string;
  paid_total: number;
  paid_invoice_count: number;
  last_paid_date: string | null;
  xero_project_codes: string[] | null;
  email: string | null;
  company_name: string | null;
  tags: unknown;
  last_contact_date: string | null;
  first_contact_date: string | null;
  engagement_status: string | null;
  is_storyteller: boolean;
  is_elder: boolean;
  gs_id: string | null;
}

export interface OrgPeopleData {
  people: PersonRow[];
  totals: {
    person_count: number;
    family_count: number;
    contractor_count: number;
    contact_count: number;
    network_count: number;
    storyteller_count: number;
    elder_count: number;
    total_paid_to_people: number;
  };
}

export const getOrgPeopleNetwork = cache(async function getOrgPeopleNetwork(
  slug: string,
): Promise<OrgPeopleData | null> {
  if (!isActSlug(slug)) return null;

  const supabase = getServiceSupabase();
  const { data, error } = await supabase
    .from('v_act_people')
    .select('*')
    .order('paid_total', { ascending: false, nullsFirst: false })
    .order('last_contact_date', { ascending: false, nullsFirst: false })
    .limit(2000);

  if (error || !data) return null;

  const people: PersonRow[] = data.map((row) => ({
    person_name: String(row.person_name ?? ''),
    person_category: (row.person_category ?? 'network') as PersonCategory,
    sources: String(row.sources ?? ''),
    paid_total: Number(row.paid_total ?? 0),
    paid_invoice_count: Number(row.paid_invoice_count ?? 0),
    last_paid_date: (row.last_paid_date as string | null) ?? null,
    xero_project_codes: (row.xero_project_codes as string[] | null) ?? null,
    email: (row.email as string | null) ?? null,
    company_name: (row.company_name as string | null) ?? null,
    tags: row.tags,
    last_contact_date: (row.last_contact_date as string | null) ?? null,
    first_contact_date: (row.first_contact_date as string | null) ?? null,
    engagement_status: (row.engagement_status as string | null) ?? null,
    is_storyteller: Boolean(row.is_storyteller),
    is_elder: Boolean(row.is_elder),
    gs_id: (row.gs_id as string | null) ?? null,
  }));

  const totals = people.reduce(
    (acc, p) => {
      acc.person_count += 1;
      if (p.person_category === 'family') acc.family_count += 1;
      else if (p.person_category === 'contractor') acc.contractor_count += 1;
      else if (p.person_category === 'contact') acc.contact_count += 1;
      else acc.network_count += 1;
      if (p.is_storyteller) acc.storyteller_count += 1;
      if (p.is_elder) acc.elder_count += 1;
      acc.total_paid_to_people += p.paid_total;
      return acc;
    },
    {
      person_count: 0,
      family_count: 0,
      contractor_count: 0,
      contact_count: 0,
      network_count: 0,
      storyteller_count: 0,
      elder_count: 0,
      total_paid_to_people: 0,
    },
  );

  return { people, totals };
});

export const PERSON_CATEGORY_LABELS: Record<PersonCategory, string> = {
  family: 'Family / founders',
  contractor: 'Contractors / suppliers',
  contact: 'Contact (paid + warm)',
  network: 'Network',
};

export const PERSON_CATEGORY_COLORS: Record<PersonCategory, string> = {
  family: 'bg-bauhaus-red text-white',
  contractor: 'bg-bauhaus-blue text-white',
  contact: 'bg-green-600 text-white',
  network: 'bg-bauhaus-yellow text-bauhaus-black',
};
