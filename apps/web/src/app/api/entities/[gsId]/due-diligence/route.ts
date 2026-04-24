import { NextRequest, NextResponse } from 'next/server';
import { assembleDueDiligencePack } from '@/lib/services/due-diligence-service';
import { buildDueDiligencePdf } from '@/lib/due-diligence-pdf';
import type { DueDiligencePack } from '@/lib/services/due-diligence-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gsId: string }> },
) {
  // Free and public. Accountability Briefs are a public-good tool for
  // journalists, researchers, and community orgs. Paywall removed with
  // the Path D scope cut.
  const { gsId } = await params;
  const format = request.nextUrl.searchParams.get('format') || 'json';

  const pack = await assembleDueDiligencePack(gsId);
  if (!pack) {
    return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
  }

  if (format === 'pdf') {
    const { bytes, filename } = await buildDueDiligencePdf(pack);
    return new Response(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  }

  if (format === 'html') {
    return new Response(renderHTML(pack), {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, max-age=300',
      },
    });
  }

  return NextResponse.json(pack, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HTML renderer (print-friendly)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '\u2014';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '\u2014';
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function esc(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderHTML(pack: DueDiligencePack): string {
  const e = pack.entity;
  const flags = pack.integrity_flags;

  let body = `
<div class="header">
  <div class="subtitle">CivicGraph \u2014 Accountability Brief</div>
  <h1>${esc(e.canonical_name)}</h1>
  <div class="date">ABN ${esc(e.abn) || 'Not registered'} \u2022 ${esc(e.entity_type)} \u2022 Generated ${pack.generated_at.split('T')[0]}</div>
</div>

<div class="stat-grid">
  <div class="stat"><div class="stat-label">Entity Type</div><div class="stat-value" style="font-size:16px">${esc(e.entity_type)}</div></div>
  <div class="stat"><div class="stat-label">State</div><div class="stat-value" style="font-size:16px">${esc(e.state) || '\u2014'}</div></div>
  <div class="stat"><div class="stat-label">SEIFA Decile</div><div class="stat-value">${e.seifa_irsd_decile ?? '\u2014'}</div></div>
  <div class="stat"><div class="stat-label">Community Ctrl</div><div class="stat-value">${e.is_community_controlled ? '<span class="tag tag-green">YES</span>' : 'No'}</div></div>
  <div class="stat"><div class="stat-label">Remoteness</div><div class="stat-value" style="font-size:14px">${esc(e.remoteness) || '\u2014'}</div></div>
  <div class="stat"><div class="stat-label">LGA</div><div class="stat-value" style="font-size:14px">${esc(e.lga_name) || '\u2014'}</div></div>
</div>`;

  // Integrity flags
  if (flags.donations_and_contracts_overlap) {
    body += `<div class="section" style="border:2px solid #c0392b;padding:12px;margin-bottom:24px"><strong style="color:#c0392b">INTEGRITY FLAG:</strong> This entity has both political donation records and government contract records. Cross-reference recommended.</div>`;
  }

  // Financial summary
  body += `<div class="section"><div class="section-title">Financial Summary</div>`;
  if (pack.financials.length > 0) {
    body += `<div class="stat-grid">
      <div class="stat"><div class="stat-label">Latest Revenue</div><div class="stat-value">${fmtMoney(pack.financials[0].total_revenue)}</div></div>
      <div class="stat"><div class="stat-label">Latest Expenses</div><div class="stat-value">${fmtMoney(pack.financials[0].total_expenses)}</div></div>
      <div class="stat"><div class="stat-label">Total Assets</div><div class="stat-value">${fmtMoney(pack.financials[0].total_assets)}</div></div>
    </div>`;
    body += `<table><tr><th>Year</th><th>Revenue</th><th>Expenses</th><th>Assets</th><th>Surplus</th><th>Gov Revenue</th><th>Staff FTE</th></tr>`;
    for (const f of pack.financials) {
      body += `<tr><td>${f.ais_year}</td><td class="money">${fmtMoney(f.total_revenue)}</td><td class="money">${fmtMoney(f.total_expenses)}</td><td class="money">${fmtMoney(f.total_assets)}</td><td class="money">${fmtMoney(f.net_surplus_deficit)}</td><td class="money">${fmtMoney(f.revenue_from_government)}</td><td>${f.staff_fte != null ? Math.round(f.staff_fte) : '\u2014'}</td></tr>`;
    }
    body += '</table>';
  } else {
    body += '<p style="color:#888">No ACNC financial data available.</p>';
  }
  body += '</div>';

  // Funding
  body += `<div class="section"><div class="section-title">Government Funding</div>`;
  if (pack.funding.total > 0) {
    body += `<div class="stat-grid">
      <div class="stat"><div class="stat-label">Total Funding</div><div class="stat-value red">${fmtMoney(pack.funding.total)}</div></div>
      <div class="stat"><div class="stat-label">Records</div><div class="stat-value">${pack.funding.record_count}</div></div>
      <div class="stat"><div class="stat-label">Programs</div><div class="stat-value">${Object.keys(pack.funding.by_program).length}</div></div>
    </div>`;
    body += `<table><tr><th>Program</th><th style="text-align:right">Total</th></tr>`;
    for (const [prog, total] of Object.entries(pack.funding.by_program).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      body += `<tr><td>${esc(prog)}</td><td class="money">${fmtMoney(total)}</td></tr>`;
    }
    body += '</table>';
  } else {
    body += '<p style="color:#888">No justice funding records.</p>';
  }
  body += '</div>';

  // Contracts
  body += `<div class="section"><div class="section-title">Government Contracts</div>`;
  if (pack.contracts.total > 0) {
    body += `<div class="stat-grid" style="grid-template-columns:repeat(2,1fr)">
      <div class="stat"><div class="stat-label">Total Value</div><div class="stat-value">${fmtMoney(pack.contracts.total)}</div></div>
      <div class="stat"><div class="stat-label">Contracts</div><div class="stat-value">${pack.contracts.record_count}</div></div>
    </div>`;
    body += `<table><tr><th>Title</th><th>Value</th><th>Buyer</th><th>Start</th></tr>`;
    for (const c of pack.contracts.recent) {
      body += `<tr><td>${esc(c.title)}</td><td class="money">${fmtMoney(c.contract_value)}</td><td>${esc(c.buyer_name)}</td><td>${fmtDate(c.contract_start)}</td></tr>`;
    }
    body += '</table>';
  } else {
    body += '<p style="color:#888">No AusTender contracts.</p>';
  }
  body += '</div>';

  // Donations
  body += `<div class="section"><div class="section-title">Political Connections</div>`;
  if (pack.donations.total > 0) {
    body += `<div class="stat-grid" style="grid-template-columns:repeat(2,1fr)">
      <div class="stat"><div class="stat-label">Total Donations</div><div class="stat-value red">${fmtMoney(pack.donations.total)}</div></div>
      <div class="stat"><div class="stat-label">Records</div><div class="stat-value">${pack.donations.record_count}</div></div>
    </div>`;
    body += `<table><tr><th>Party / Recipient</th><th style="text-align:right">Total</th></tr>`;
    for (const [party, total] of Object.entries(pack.donations.by_party).sort((a, b) => b[1] - a[1])) {
      body += `<tr><td>${esc(party)}</td><td class="money">${fmtMoney(total)}</td></tr>`;
    }
    body += '</table>';
  } else {
    body += '<p style="color:#888">No political donation records.</p>';
  }
  body += '</div>';

  // ALMA
  body += `<div class="section"><div class="section-title">Evidence Alignment (ALMA)</div>`;
  if (pack.alma_interventions.length > 0) {
    body += `<table><tr><th>Intervention</th><th>Type</th><th>Evidence</th><th>Cohort</th><th>Youth Justice</th></tr>`;
    for (const a of pack.alma_interventions) {
      body += `<tr><td>${esc(a.name)}</td><td>${esc(a.type)}</td><td>${esc(a.evidence_level) || '\u2014'}</td><td>${esc(a.target_cohort) || '\u2014'}</td><td>${a.serves_youth_justice ? '<span class="tag tag-green">YES</span>' : '\u2014'}</td></tr>`;
    }
    body += '</table>';
  } else {
    body += '<p style="color:#888">No ALMA interventions linked.</p>';
  }
  body += '</div>';

  // Place context
  if (pack.place) {
    body += `<div class="section"><div class="section-title">Geographic Context</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">Locality</div><div class="stat-value" style="font-size:14px">${esc(pack.place.locality) || '\u2014'}</div></div>
      <div class="stat"><div class="stat-label">Remoteness</div><div class="stat-value" style="font-size:14px">${esc(pack.place.remoteness) || '\u2014'}</div></div>
      <div class="stat"><div class="stat-label">Local Ecosystem</div><div class="stat-value">${pack.place.local_entity_count} orgs</div></div>
    </div></div>`;
  }

  // Relationship summary
  if (pack.stats) {
    body += `<div class="section"><div class="section-title">Relationship Summary</div>
    <div class="stat-grid">
      <div class="stat"><div class="stat-label">Relationships</div><div class="stat-value">${pack.stats.total_relationships}</div></div>
      <div class="stat"><div class="stat-label">Inbound Value</div><div class="stat-value">${fmtMoney(pack.stats.total_inbound_amount)}</div></div>
      <div class="stat"><div class="stat-label">Outbound Value</div><div class="stat-value">${fmtMoney(pack.stats.total_outbound_amount)}</div></div>
    </div></div>`;
  }

  // Integrity
  body += `<div class="section"><div class="section-title">Integrity Assessment</div>
  <table><tr><th>Check</th><th>Status</th></tr>`;
  const checks: Array<[string, boolean]> = [
    ['ABN registered', !flags.missing_abn],
    ['ACNC financials available', !flags.missing_financials],
    ['Evidence-backed programs (ALMA)', flags.has_alma_interventions],
    ['Government funding received', flags.has_justice_funding],
    ['Government contracts held', flags.has_contracts],
    ['No political donations', !flags.has_donations],
    ['No donations + contracts overlap', !flags.donations_and_contracts_overlap],
    ['Serves disadvantaged area (SEIFA \u2264 3)', flags.low_seifa],
  ];
  for (const [label, ok] of checks) {
    body += `<tr><td>${label}</td><td>${ok ? '<span class="tag tag-green">\u2713 PASS</span>' : '<span class="tag tag-red">\u2717 FLAG</span>'}</td></tr>`;
  }
  body += '</table></div>';

  // Data sources
  body += `<div class="section"><div class="section-title">Data Sources</div><ul style="font-size:12px;color:#888">`;
  for (const src of pack.data_sources) {
    body += `<li>${esc(src)}</li>`;
  }
  body += `</ul><div style="margin-top:12px;padding:12px;background:#f5f5f0;border:1px solid #ddd;font-size:11px;color:#888">${esc(pack.citation)}</div></div>`;

  return htmlShell(e.canonical_name, body);
}

function htmlShell(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(title)} \u2014 CivicGraph Accountability Brief</title>
<style>
  @page { margin: 2cm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a1a; line-height: 1.5; max-width: 800px; margin: 0 auto; padding: 40px 20px; }
  .header { border-bottom: 4px solid #1a1a1a; padding-bottom: 16px; margin-bottom: 32px; }
  .header h1 { font-size: 28px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; }
  .header .subtitle { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; color: #888; margin-top: 4px; }
  .header .date { font-size: 11px; color: #888; margin-top: 8px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #888; border-bottom: 2px solid #e5e5e5; padding-bottom: 4px; margin-bottom: 12px; }
  .stat-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px; }
  .stat { border: 2px solid #1a1a1a; padding: 12px; }
  .stat-value { font-size: 24px; font-weight: 900; }
  .stat-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #888; }
  .stat-value.red { color: #c0392b; }
  .stat-value.green { color: #27ae60; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 16px; }
  th { text-align: left; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em; color: #888; border-bottom: 2px solid #1a1a1a; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e5e5; }
  td.money { font-family: 'SF Mono', 'Consolas', monospace; text-align: right; }
  .tag { display: inline-block; padding: 2px 6px; font-size: 10px; font-weight: 700; border: 1px solid; margin-right: 4px; }
  .tag-red { color: #c0392b; border-color: #c0392b; background: #fdf2f0; }
  .tag-green { color: #27ae60; border-color: #27ae60; background: #f0fdf4; }
  ul { padding-left: 20px; }
  li { margin-bottom: 4px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 4px solid #1a1a1a; font-size: 10px; color: #888; }
  .footer .brand { font-weight: 900; text-transform: uppercase; letter-spacing: 0.15em; color: #1a1a1a; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style>
</head>
<body>
${body}
<div class="footer">
  <div class="brand">CivicGraph \u2014 Australia&rsquo;s Accountability Atlas \u2022 A Curious Tractor</div>
  <p style="margin-top:4px">This accountability brief is auto-generated from public data sources (AusTender, AEC, ACNC, GrantConnect, ABR, ATO tax transparency). Free for community organisations, journalists, and researchers. Verify critical claims against primary sources before formal use. civicgraph.com.au/about/curious-tractor</p>
</div>
</body>
</html>`;
}
