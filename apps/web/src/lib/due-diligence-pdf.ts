import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { DueDiligencePack } from '@/lib/services/due-diligence-service';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_SIZES: Record<string, number> = {
  micro: 7,
  tiny: 8,
  label: 9,
  body: 10,
  section: 11,
  metric: 12,
  heading: 18,
  statValue: 28,
  title: 34,
};

// Bauhaus-inspired: pure black/white/red — no compromises
const C = {
  black: rgb(0, 0, 0),
  white: rgb(1, 1, 1),
  red: rgb(0.898, 0.224, 0.208),   // #E53935
  muted: rgb(0.459, 0.459, 0.459), // #757575
  light: rgb(0.741, 0.741, 0.741), // #BDBDBD
  surface: rgb(0.961, 0.961, 0.961), // #F5F5F5
  hairline: rgb(0.88, 0.88, 0.88),
} as const;

function fmtMoney(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '\u2014';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '\u2014';
  return new Date(value).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sanitize(text: string): string {
  return text
    .replace(/\u2713|\u2714/g, '[Y]')
    .replace(/\u2717|\u2718/g, '[N]')
    .replace(/\u2022/g, '*')
    .replace(/[\u0100-\u024F]/g, '')
    .replace(/[\u2000-\u200F]/g, ' ')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(/[^\x00-\xFF]/g, '');
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'due-diligence';
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.replace(/\r/g, '').split('\n')) {
    const trimmed = paragraph.trim();
    if (!trimmed) { lines.push(''); continue; }
    let current = '';
    for (const word of trimmed.split(/\s+/)) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= maxWidth) {
        current = next;
      } else if (!current) {
        lines.push(word);
      } else {
        lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines.length > 0 ? lines : [''];
}

function drawWrapped(
  page: PDFPage, text: string,
  opts: { x: number; y: number; maxWidth: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; lineGap?: number },
): number {
  const lines = wrapText(sanitize(text), opts.font, opts.size, opts.maxWidth);
  const lh = opts.size + (opts.lineGap ?? 4);
  let cy = opts.y;
  for (const line of lines) {
    if (line) page.drawText(line, { x: opts.x, y: cy, size: opts.size, font: opts.font, color: opts.color });
    cy -= lh;
  }
  return cy;
}

export async function buildDueDiligencePdf(pack: DueDiligencePack): Promise<{ bytes: Uint8Array; filename: string }> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pages: PDFPage[] = [];
  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  pages.push(page);
  let y = PAGE_HEIGHT - MARGIN;

  const startPage = () => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pages.push(page);
    // Draw page header bar
    page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 28, width: PAGE_WIDTH, height: 28, color: C.black });
    page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 22, width: 18, height: 18, color: C.red });
    page.drawRectangle({ x: MARGIN + 4, y: PAGE_HEIGHT - 18, width: 10, height: 10, color: C.white });
    page.drawText('CIVICGRAPH DUE DILIGENCE PACK', {
      x: MARGIN + 24, y: PAGE_HEIGHT - 19, size: FONT_SIZES.tiny, font: bold, color: C.muted,
    });
    y = PAGE_HEIGHT - 52;
  };

  const ensureSpace = (height: number) => {
    if (y - height < 48) startPage();
  };

  // Section divider: label + 2px black rule
  const drawSection = (label: string) => {
    ensureSpace(28);
    page.drawText(label.toUpperCase(), { x: MARGIN, y, size: FONT_SIZES.body, font: bold, color: C.muted });
    y -= 14;
    page.drawRectangle({ x: MARGIN, y, width: CONTENT_WIDTH, height: 2, color: C.black });
    y -= 16;
  };

  const drawParagraph = (text: string, size = FONT_SIZES.body, font: PDFFont = regular, color = C.black) => {
    const lines = wrapText(sanitize(text), font, size, CONTENT_WIDTH);
    ensureSpace(lines.length * (size + 4) + 4);
    y = drawWrapped(page, text, { x: MARGIN, y, maxWidth: CONTENT_WIDTH, font, size, color });
    y -= 4;
  };

  // Stat cards: 2px black stroke, large value
  const drawStatCards = (items: Array<{ label: string; value: string; color?: ReturnType<typeof rgb>; filled?: boolean }>) => {
    const cols = Math.min(items.length, 3);
    const gap = 16;
    const cardW = (CONTENT_WIDTH - gap * (cols - 1)) / cols;
    const cardH = 58;
    ensureSpace(cardH + 8);
    items.slice(0, 6).forEach((item, i) => {
      const col = i % cols;
      const rowIdx = Math.floor(i / cols);
      if (col === 0 && rowIdx > 0) { y -= cardH + 8; ensureSpace(cardH + 8); }
      const x = MARGIN + col * (cardW + gap);
      const cy = y;
      const isFilled = item.filled;
      const borderColor = item.color || C.black;
      page.drawRectangle({ x, y: cy - cardH, width: cardW, height: cardH, color: isFilled ? C.black : C.white, borderColor, borderWidth: 2 });
      page.drawText(sanitize(item.label.toUpperCase()), { x: x + 14, y: cy - 16, size: FONT_SIZES.tiny, font: bold, color: C.muted });
      page.drawText(sanitize(String(item.value ?? '\u2014')), { x: x + 14, y: cy - 40, size: FONT_SIZES.statValue, font: bold, color: isFilled ? C.white : (item.color || C.black) });
    });
    y -= cardH + 8;
  };

  // KV grid: two columns of label/value pairs
  const drawKVGrid = (items: Array<{ label: string; value: string; highlight?: boolean }>) => {
    const colW = (CONTENT_WIDTH - 16) / 2;
    for (let i = 0; i < items.length; i += 2) {
      ensureSpace(32);
      const row = items.slice(i, i + 2);
      row.forEach((item, idx) => {
        const x = MARGIN + idx * (colW + 16);
        page.drawText(sanitize(item.label.toUpperCase()), { x, y, size: FONT_SIZES.tiny, font: bold, color: C.light });
        const valColor = item.highlight ? C.red : C.black;
        page.drawText(sanitize(item.value), { x, y: y - 14, size: FONT_SIZES.metric, font: bold, color: valColor });
      });
      y -= 36;
    }
  };

  // Table with grey header row
  const drawTable = (headers: string[], rows: string[][], colWidths: number[]) => {
    const rh = 20;
    ensureSpace(rh * 2);
    // Header
    page.drawRectangle({ x: MARGIN, y: y - rh, width: CONTENT_WIDTH, height: rh, color: C.surface });
    let tx = MARGIN;
    for (let c = 0; c < headers.length; c++) {
      page.drawText(headers[c].toUpperCase(), { x: tx + 8, y: y - 14, size: FONT_SIZES.tiny, font: bold, color: C.muted });
      tx += colWidths[c];
    }
    y -= rh;
    // Rows
    for (const row of rows) {
      ensureSpace(rh);
      tx = MARGIN;
      for (let c = 0; c < row.length; c++) {
        const raw = sanitize(row[c] == null || typeof row[c] !== 'string' ? String(row[c] ?? '\u2014') : row[c]);
        const cellText = raw.length > 50 ? raw.slice(0, 48) + '...' : raw;
        const isFirstCol = c === 0;
        const font_ = isFirstCol ? bold : regular;
        page.drawText(cellText, { x: tx + 8, y: y - 14, size: FONT_SIZES.label, font: font_, color: C.black });
        tx += colWidths[c];
      }
      y -= rh;
      page.drawRectangle({ x: MARGIN, y, width: CONTENT_WIDTH, height: 0.5, color: C.hairline });
    }
    y -= 8;
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COVER PAGE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Hero block — full-width black with red top stripe
  const heroH = 260;
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - heroH, width: PAGE_WIDTH, height: heroH, color: C.black });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 4, width: PAGE_WIDTH, height: 4, color: C.red });

  // Logo mark
  page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 60, width: 28, height: 28, color: C.red });
  page.drawRectangle({ x: MARGIN + 7, y: PAGE_HEIGHT - 53, width: 14, height: 14, color: C.white });
  page.drawText('CIVICGRAPH', { x: MARGIN + 38, y: PAGE_HEIGHT - 48, size: FONT_SIZES.section, font: bold, color: C.red });
  page.drawText('DUE DILIGENCE PACK', { x: MARGIN + 38, y: PAGE_HEIGHT - 60, size: FONT_SIZES.label, font: bold, color: C.muted });

  // Entity name
  y = PAGE_HEIGHT - 105;
  const nameLines = wrapText(sanitize(pack.entity.canonical_name), bold, FONT_SIZES.title, CONTENT_WIDTH - 130);
  for (const line of nameLines) {
    page.drawText(line, { x: MARGIN, y, size: FONT_SIZES.title, font: bold, color: C.white });
    y -= FONT_SIZES.title + 6;
  }

  // Subtitle
  const subtitle = [pack.entity.abn ? `ABN ${pack.entity.abn}` : null, pack.entity.entity_type, pack.entity.state].filter(Boolean).join('  ·  ');
  page.drawText(sanitize(subtitle), { x: MARGIN, y, size: FONT_SIZES.metric, font: regular, color: C.light });

  // Divider + gen info
  const metaY = PAGE_HEIGHT - heroH + 50;
  page.drawRectangle({ x: MARGIN, y: metaY + 16, width: CONTENT_WIDTH, height: 1, color: C.muted });
  page.drawText(`Generated ${fmtDate(pack.generated_at)}`, { x: MARGIN, y: metaY, size: FONT_SIZES.body, font: regular, color: C.muted });
  page.drawText('CivicGraph \u2014 Allocation Intelligence', { x: MARGIN + 260, y: metaY, size: FONT_SIZES.body, font: regular, color: C.muted });

  // Community-controlled badge (if applicable)
  y = PAGE_HEIGHT - heroH - 10;
  if (pack.entity.is_community_controlled) {
    const badgeW = 220;
    page.drawRectangle({ x: MARGIN, y: y - 18, width: badgeW, height: 18, color: C.red });
    page.drawRectangle({ x: MARGIN + 8, y: y - 13, width: 8, height: 8, color: C.white });
    page.drawText('COMMUNITY-CONTROLLED ORGANISATION', { x: MARGIN + 22, y: y - 13, size: FONT_SIZES.micro, font: bold, color: C.white });
    y -= 28;
  }

  // Revenue trend mini bar chart (if financials available)
  if (pack.financials.length >= 2) {
    const trendX = MARGIN + 290;
    const trendW = CONTENT_WIDTH - 290;
    const trendY = y + (pack.entity.is_community_controlled ? 28 : 0);
    page.drawText('5-YEAR REVENUE TREND', { x: trendX, y: trendY - 2, size: FONT_SIZES.micro, font: bold, color: C.light });
    const years = pack.financials.slice(0, 5).reverse();
    const maxRev = Math.max(...years.map(f => f.total_revenue ?? 0), 1);
    const barMaxH = 28;
    const barW = (trendW - (years.length - 1) * 3) / years.length;
    const chartY = trendY - 16;
    years.forEach((yr, i) => {
      const rev = yr.total_revenue ?? 0;
      const h = Math.max(2, (rev / maxRev) * barMaxH);
      const bx = trendX + i * (barW + 3);
      const isLatest = i === years.length - 1;
      page.drawRectangle({ x: bx, y: chartY - barMaxH, width: barW, height: h, color: isLatest ? C.red : C.muted });
      page.drawText(String(yr.ais_year), { x: bx + 2, y: chartY - barMaxH - 10, size: FONT_SIZES.micro, font: isLatest ? bold : regular, color: isLatest ? C.red : C.light });
    });
  }

  // Stat cards row
  y -= 8;
  drawStatCards([
    { label: 'Total Funding', value: fmtMoney(pack.funding.total), color: C.red },
    { label: 'Contracts', value: fmtMoney(pack.contracts.total) },
    { label: 'ALMA Evidence', value: String(pack.alma_interventions.length), filled: true },
  ]);

  // Entity snapshot KV grid
  drawSection('Entity Snapshot');
  drawKVGrid([
    { label: 'Entity Type', value: `${pack.entity.entity_type}${pack.entity.is_community_controlled ? ' / Community-controlled' : ''}` },
    { label: 'Data Sources', value: `${pack.data_sources.length} databases cross-referenced` },
    { label: 'Location', value: [pack.entity.postcode, pack.entity.state, pack.entity.remoteness].filter(Boolean).join(' · ') || '\u2014' },
    { label: 'LGA', value: pack.entity.lga_name || '\u2014' },
    { label: 'SEIFA IRSD', value: pack.entity.seifa_irsd_decile != null ? `Decile ${pack.entity.seifa_irsd_decile}${pack.entity.seifa_irsd_decile <= 3 ? ' (most disadvantaged)' : ''}` : '\u2014', highlight: (pack.entity.seifa_irsd_decile ?? 10) <= 3 },
    { label: 'ACNC Status', value: pack.charity ? [pack.charity.pbi ? 'PBI' : null, pack.charity.charity_size ? `${pack.charity.charity_size} charity` : null].filter(Boolean).join(' · ') || 'Registered' : 'Not ACNC registered' },
  ]);

  // Integrity checklist
  drawSection('Integrity Assessment');
  const flags = pack.integrity_flags;
  const checks: Array<{ label: string; ok: boolean }> = [
    { label: 'ABN registered', ok: !flags.missing_abn },
    { label: 'ACNC financial data available', ok: !flags.missing_financials },
    { label: 'Evidence-backed programs (ALMA)', ok: flags.has_alma_interventions },
    { label: 'Government funding received', ok: flags.has_justice_funding },
    { label: 'No political donations declared', ok: !flags.has_donations },
    { label: 'Operating in disadvantaged area (SEIFA <= 3)', ok: flags.low_seifa },
  ];

  for (const chk of checks) {
    ensureSpace(20);
    const boxX = MARGIN;
    if (chk.ok) {
      page.drawRectangle({ x: boxX, y: y - 12, width: 14, height: 14, color: C.red });
      page.drawText('Y', { x: boxX + 4, y: y - 10, size: FONT_SIZES.label, font: bold, color: C.white });
    } else {
      page.drawRectangle({ x: boxX, y: y - 12, width: 14, height: 14, borderColor: C.light, borderWidth: 2, color: C.white });
      page.drawText('\u2014', { x: boxX + 3, y: y - 10, size: FONT_SIZES.label, font: bold, color: C.light });
    }
    page.drawText(sanitize(chk.label), { x: boxX + 22, y: y - 10, size: FONT_SIZES.section, font: regular, color: chk.ok ? C.black : C.muted });
    y -= 20;
  }

  if (flags.donations_and_contracts_overlap) {
    ensureSpace(30);
    page.drawRectangle({ x: MARGIN, y: y - 24, width: CONTENT_WIDTH, height: 24, color: rgb(1, 0.95, 0.95), borderColor: C.red, borderWidth: 1.5 });
    page.drawText('INTEGRITY FLAG: Entity has both political donations and government contracts.', {
      x: MARGIN + 10, y: y - 17, size: FONT_SIZES.label, font: bold, color: C.red,
    });
    y -= 34;
  }

  // Cover footer: CTA + data freshness
  const footY = 42;
  // Live profile CTA
  page.drawRectangle({ x: MARGIN, y: footY, width: 280, height: 22, color: C.black });
  page.drawRectangle({ x: MARGIN + 8, y: footY + 6, width: 8, height: 8, color: C.red });
  page.drawRectangle({ x: MARGIN + 10, y: footY + 8, width: 4, height: 4, color: C.white });
  const profileUrl = `civicgraph.org/entities/${pack.entity.gs_id}`;
  page.drawText(`VIEW LIVE PROFILE  ${profileUrl}`, { x: MARGIN + 22, y: footY + 6, size: FONT_SIZES.micro, font: bold, color: C.white });
  // Data freshness
  page.drawRectangle({ x: MARGIN + 284, y: footY, width: CONTENT_WIDTH - 284, height: 22, color: C.surface });
  page.drawEllipse({ x: MARGIN + 296, y: footY + 11, xScale: 4, yScale: 4, color: C.red });
  page.drawText(`DATA CURRENT AS OF ${fmtDate(pack.generated_at).toUpperCase()}`, { x: MARGIN + 306, y: footY + 6, size: FONT_SIZES.micro, font: bold, color: C.muted });

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGE 2: FINANCIAL SUMMARY + FUNDING
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  startPage();

  drawSection('Financial Summary');
  if (pack.financials.length > 0) {
    const latest = pack.financials[0];
    drawStatCards([
      { label: 'Latest Revenue', value: fmtMoney(latest.total_revenue) },
      { label: 'Latest Expenses', value: fmtMoney(latest.total_expenses) },
      { label: 'Total Assets', value: fmtMoney(latest.total_assets) },
    ]);

    drawTable(
      ['Year', 'Revenue', 'Expenses', 'Assets', 'Surplus', 'Gov Rev'],
      pack.financials.map(f => [
        String(f.ais_year),
        fmtMoney(f.total_revenue),
        fmtMoney(f.total_expenses),
        fmtMoney(f.total_assets),
        fmtMoney(f.net_surplus_deficit),
        fmtMoney(f.revenue_from_government),
      ]),
      [55, 90, 90, 90, 90, 90],
    );
  } else {
    drawParagraph('No ACNC financial data available for this entity.', FONT_SIZES.body, regular, C.muted);
  }

  drawSection('Government Funding');
  if (pack.funding.total > 0) {
    drawStatCards([
      { label: 'Total Funding', value: fmtMoney(pack.funding.total), color: C.red },
      { label: 'Funding Records', value: String(pack.funding.record_count) },
      { label: 'Programs', value: String(Object.keys(pack.funding.by_program).length) },
    ]);

    const programs = Object.entries(pack.funding.by_program).sort((a, b) => b[1] - a[1]).slice(0, 10);
    drawTable(
      ['Program', 'Total'],
      programs.map(([prog, total]) => [prog, fmtMoney(total)]),
      [CONTENT_WIDTH - 100, 100],
    );
  } else {
    drawParagraph('No justice funding records found for this entity.', FONT_SIZES.body, regular, C.muted);
  }

  // Geographic context on same page if space
  drawSection('Geographic Context');
  if (pack.place) {
    drawKVGrid([
      { label: 'Locality', value: pack.place.locality || '\u2014' },
      { label: 'LGA', value: pack.place.lga_name || '\u2014' },
      { label: 'Remoteness', value: pack.place.remoteness || '\u2014', highlight: pack.place.remoteness?.includes('Remote') ?? false },
      { label: 'Local Ecosystem', value: `${pack.place.local_entity_count} entities in postcode ${pack.place.postcode}` },
      { label: 'SEIFA Score', value: pack.place.seifa_score != null ? String(pack.place.seifa_score) : '\u2014' },
      { label: 'SEIFA Decile', value: pack.place.seifa_decile != null ? `Decile ${pack.place.seifa_decile}` : '\u2014', highlight: (pack.place.seifa_decile ?? 10) <= 3 },
    ]);
  } else {
    drawParagraph('No geographic data available (missing postcode).', FONT_SIZES.body, regular, C.muted);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGE 3: CONTRACTS + POLITICAL + RELATIONSHIPS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  startPage();

  drawSection('Government Contracts');
  if (pack.contracts.total > 0) {
    drawStatCards([
      { label: 'Total Contracts', value: fmtMoney(pack.contracts.total) },
      { label: 'Contract Count', value: String(pack.contracts.record_count) },
    ]);

    if (pack.contracts.recent.length > 0) {
      drawTable(
        ['Title', 'Value', 'Buyer', 'Start'],
        pack.contracts.recent.map(c => [
          c.title || '\u2014',
          fmtMoney(c.contract_value),
          c.buyer_name || '\u2014',
          fmtDate(c.contract_start),
        ]),
        [200, 80, 140, 92],
      );
    }
  } else {
    drawParagraph('No AusTender contract records found for this entity.', FONT_SIZES.body, regular, C.muted);
  }

  drawSection('Political Connections');
  if (pack.donations.total > 0) {
    drawStatCards([
      { label: 'Total Donations', value: fmtMoney(pack.donations.total), color: C.red },
      { label: 'Donation Records', value: String(pack.donations.record_count) },
    ]);
    const parties = Object.entries(pack.donations.by_party).sort((a, b) => b[1] - a[1]);
    drawTable(['Party / Recipient', 'Total'], parties.map(([p, t]) => [p, fmtMoney(t)]), [CONTENT_WIDTH - 100, 100]);
  } else {
    ensureSpace(30);
    page.drawRectangle({ x: MARGIN, y: y - 24, width: CONTENT_WIDTH, height: 24, color: C.surface });
    page.drawRectangle({ x: MARGIN + 12, y: y - 18, width: 12, height: 12, borderColor: C.light, borderWidth: 2, color: C.white });
    page.drawText('\u2014', { x: MARGIN + 15, y: y - 16, size: FONT_SIZES.label, font: bold, color: C.light });
    page.drawText('No political donation records found for this entity.', { x: MARGIN + 32, y: y - 16, size: FONT_SIZES.section, font: regular, color: C.muted });
    y -= 34;
  }

  drawSection('Relationship Summary');
  if (pack.stats) {
    drawStatCards([
      { label: 'Relationships', value: String(pack.stats.total_relationships) },
      { label: 'Inbound Value', value: fmtMoney(pack.stats.total_inbound_amount), color: C.red },
      { label: 'Counterparties', value: String(pack.stats.counterparty_count) },
    ]);
    drawParagraph(`${pack.stats.counterparty_count} distinct counterparties across all relationship types.`);
  } else {
    drawParagraph('No relationship statistics available.', FONT_SIZES.body, regular, C.muted);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGE 4: EVIDENCE + SOURCES + GLOSSARY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  startPage();

  drawSection('Evidence Alignment \u2014 Australian Living Map of Alternatives (ALMA)');
  if (pack.alma_interventions.length > 0) {
    drawStatCards([
      { label: 'ALMA Interventions', value: String(pack.alma_interventions.length), color: C.red },
      { label: 'Youth Justice', value: String(pack.alma_interventions.filter(a => a.serves_youth_justice).length), filled: true },
    ]);

    drawTable(
      ['Intervention', 'Type', 'Evidence', 'Cohort'],
      pack.alma_interventions.map(a => [a.name, a.type || '\u2014', a.evidence_level || '\u2014', a.target_cohort || '\u2014']),
      [190, 110, 100, 112],
    );
  } else {
    drawParagraph('No Australian Living Map of Alternatives (ALMA) interventions linked to this entity.', FONT_SIZES.body, regular, C.muted);
  }

  drawSection('Data Sources & Citation');
  for (const src of pack.data_sources) {
    ensureSpace(14);
    page.drawText(sanitize(`* ${src}`), { x: MARGIN + 8, y, size: FONT_SIZES.body, font: regular, color: C.black });
    y -= 14;
  }
  y -= 6;

  // Citation box
  ensureSpace(50);
  page.drawRectangle({ x: MARGIN, y: y - 44, width: CONTENT_WIDTH, height: 44, color: C.surface, borderColor: C.light, borderWidth: 1 });
  drawWrapped(page, pack.citation, { x: MARGIN + 12, y: y - 14, maxWidth: CONTENT_WIDTH - 24, font: regular, size: FONT_SIZES.label, color: C.muted });
  y -= 54;

  drawParagraph(
    'This due diligence pack is auto-generated from public data sources. Verify critical claims against primary sources before inclusion in formal submissions or board papers.',
    FONT_SIZES.label, regular, C.light,
  );

  // Glossary
  drawSection('Glossary');
  const glossary: Array<{ term: string; def: string }> = [
    { term: 'ALMA', def: 'Australian Living Map of Alternatives. JusticeHub\'s evidence database of community-led interventions, their outcomes, and evaluation methodology.' },
    { term: 'SEIFA IRSD', def: 'Index of Relative Socio-economic Disadvantage. Decile 1 = most disadvantaged 10% of areas nationally.' },
    { term: 'PBI', def: 'Public Benevolent Institution. ATO endorsement allowing DGR (tax-deductible donation) status.' },
    { term: 'Community-controlled', def: 'Organisation governed by the community it serves, typically with majority Indigenous board.' },
    { term: 'CivicGraph', def: 'Decision infrastructure for government and social sector. Cross-references 7+ public databases.' },
  ];

  for (const g of glossary) {
    const termWidth = bold.widthOfTextAtSize(sanitize(g.term), FONT_SIZES.body);
    const defLines = wrapText(sanitize(`\u2014 ${g.def}`), regular, FONT_SIZES.body, CONTENT_WIDTH - termWidth - 8);
    ensureSpace(defLines.length * 14 + 4);
    page.drawText(sanitize(g.term), { x: MARGIN, y, size: FONT_SIZES.body, font: bold, color: C.black });
    let gy = y;
    for (const line of defLines) {
      page.drawText(line, { x: MARGIN + termWidth + 6, y: gy, size: FONT_SIZES.body, font: regular, color: C.muted });
      gy -= 14;
    }
    y = gy - 2;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGE CHROME (footer on all pages)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const totalPages = pages.length;
  pages.forEach((p, index) => {
    // Footer line
    p.drawRectangle({ x: MARGIN, y: 30, width: CONTENT_WIDTH, height: 1, color: C.black });
    p.drawText(`Page ${index + 1} of ${totalPages}`, { x: MARGIN, y: 18, size: FONT_SIZES.tiny, font: regular, color: C.light });
    const idText = pack.entity.gs_id;
    p.drawText(idText, {
      x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(idText, FONT_SIZES.tiny), y: 18, size: FONT_SIZES.tiny, font: regular, color: C.light,
    });
  });

  const bytes = await pdfDoc.save();
  return {
    bytes: new Uint8Array(bytes),
    filename: `due-diligence-${slugify(pack.entity.canonical_name)}.pdf`,
  };
}
