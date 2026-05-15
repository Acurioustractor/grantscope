import { NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/admin-auth';
import { getServiceSupabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export interface TimelineEvent {
  date: string;          // ISO
  type: 'xero_invoice' | 'xero_payment' | 'contact' | 'decision' | 'past_grant';
  label: string;
  detail?: string;
  amount?: number | null;
  status?: string | null;
  link?: string | null;
}

// Build an ILIKE pattern that matches the distinctive tokens of a funder name
// so "The Trustee For The Snow Foundation" and "Snow Foundation" both find Xero rows
const GENERIC = new Set([
  'foundation','trust','limited','ltd','pty','inc','incorporated','the','for','and',
  'of','family','community','national','australia','australian','public','ancillary',
  'fund','funds','group','corporation','services','project','department','government',
  'agency','council','office','trustee',
]);

function distinctiveTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !GENERIC.has(t))
    .slice(0, 3);
}

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const funder = (url.searchParams.get('funder') ?? '').trim();
  if (!funder) {
    return NextResponse.json({ error: 'funder query param required' }, { status: 400 });
  }

  const supabase = getServiceSupabase();
  const tokens = distinctiveTokens(funder);
  const events: TimelineEvent[] = [];

  // 1. Xero invoices — paid + authorised + voided history
  if (tokens.length) {
    const ilikePattern = `%${tokens[0]}%`;
    const { data: invoices } = await supabase
      .from('xero_invoices')
      .select('date, contact_name, total, status, invoice_number, reference')
      .ilike('contact_name', ilikePattern)
      .order('date', { ascending: false })
      .limit(40);

    for (const inv of invoices ?? []) {
      const allMatch = tokens.every((t) => (inv.contact_name ?? '').toLowerCase().includes(t));
      if (!allMatch) continue;
      events.push({
        date: inv.date,
        type: inv.status === 'PAID' ? 'xero_payment' : 'xero_invoice',
        label: inv.status === 'PAID' ? `Paid ${inv.invoice_number ?? 'invoice'}` : `${inv.status} ${inv.invoice_number ?? 'invoice'}`,
        detail: inv.reference ?? undefined,
        amount: inv.total,
        status: inv.status,
      });
    }
  }

  // 2. GHL contacts — engagement events
  if (tokens.length) {
    const ilikePattern = `%${tokens[0]}%`;
    const { data: contacts } = await supabase
      .from('ghl_contacts')
      .select('full_name, email, company_name, engagement_status, first_contact_date, last_contact_date')
      .ilike('company_name', ilikePattern)
      .order('last_contact_date', { ascending: false })
      .limit(30);

    for (const c of contacts ?? []) {
      const allMatch = tokens.every((t) => (c.company_name ?? '').toLowerCase().includes(t));
      if (!allMatch) continue;
      if (c.last_contact_date) {
        events.push({
          date: c.last_contact_date,
          type: 'contact',
          label: `Contact: ${c.full_name ?? 'Unknown'}`,
          detail: [c.engagement_status, c.email].filter(Boolean).join(' · ') || undefined,
        });
      }
      if (c.first_contact_date && c.first_contact_date !== c.last_contact_date) {
        events.push({
          date: c.first_contact_date,
          type: 'contact',
          label: `First contact: ${c.full_name ?? 'Unknown'}`,
        });
      }
    }
  }

  // 3. ACT decisions on this funder's grants
  const { data: decisions } = await supabase
    .from('act_grant_recommendation_decisions')
    .select('decision, decided_at, notes, opportunity_id, project_code, alma_funding_opportunities!inner(name, funder_name)')
    .eq('alma_funding_opportunities.funder_name', funder)
    .order('decided_at', { ascending: false })
    .limit(40);

  for (const d of decisions ?? []) {
    const opp = (d as unknown as { alma_funding_opportunities: { name: string } }).alma_funding_opportunities;
    events.push({
      date: d.decided_at,
      type: 'decision',
      label: `${d.decision.toUpperCase()}: ${opp?.name ?? 'grant'}`,
      detail: `${d.project_code}${d.notes ? ` — ${d.notes.slice(0, 80)}` : ''}`,
    });
  }

  // 4. Foundation past grantees — ACT got money historically? (look for ACT/Tractor in grantee_name)
  if (tokens.length) {
    const ilikePattern = `%${tokens[0]}%`;
    const { data: grantees } = await supabase
      .from('foundation_grantees')
      .select('grantee_name, grant_amount, grant_year, program_name, foundation_name')
      .ilike('foundation_name', ilikePattern)
      .or('grantee_name.ilike.%curious tractor%,grantee_name.ilike.%a curious tractor%,grantee_name.ilike.%a kind tractor%')
      .order('grant_year', { ascending: false })
      .limit(10);

    for (const g of grantees ?? []) {
      const allMatch = tokens.every((t) => (g.foundation_name ?? '').toLowerCase().includes(t));
      if (!allMatch) continue;
      const year = g.grant_year ? String(g.grant_year) : '';
      events.push({
        date: year ? `${year}-01-01` : new Date().toISOString().slice(0, 10),
        type: 'past_grant',
        label: `Past grant to ${g.grantee_name ?? 'ACT'}`,
        detail: g.program_name ?? undefined,
        amount: g.grant_amount ?? null,
      });
    }
  }

  // Sort all events by date desc
  events.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    return db - da;
  });

  // Compute summary stats
  const stats = {
    total_events: events.length,
    earliest: events.length ? events[events.length - 1].date : null,
    latest: events.length ? events[0].date : null,
    xero_paid_count: events.filter((e) => e.type === 'xero_payment').length,
    xero_paid_total: events
      .filter((e) => e.type === 'xero_payment')
      .reduce((s, e) => s + (Number(e.amount) || 0), 0),
    contact_count: events.filter((e) => e.type === 'contact').length,
    decision_count: events.filter((e) => e.type === 'decision').length,
    past_grant_count: events.filter((e) => e.type === 'past_grant').length,
  };

  return NextResponse.json({ funder, events: events.slice(0, 50), stats });
}
