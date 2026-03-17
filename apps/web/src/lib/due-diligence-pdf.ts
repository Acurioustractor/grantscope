import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { DueDiligencePack } from '@/lib/services/due-diligence-service';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_SIZES = {
  tiny: 8,
  label: 9,
  body: 11,
  section: 13,
  heading: 18,
  title: 26,
} as const;

const COLORS = {
  black: rgb(0.08, 0.08, 0.08),
  muted: rgb(0.42, 0.42, 0.42),
  red: rgb(0.87, 0.11, 0.12),
  blue: rgb(0.11, 0.28, 0.82),
  green: rgb(0.06, 0.6, 0.41),
  yellow: rgb(0.95, 0.78, 0.12),
  canvas: rgb(0.97, 0.96, 0.93),
  white: rgb(1, 1, 1),
  border: rgb(0.14, 0.14, 0.14),
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

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'due-diligence';
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.replace(/\r/g, '').split('\n');
  for (const paragraph of paragraphs) {
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

function drawWrappedText(
  page: PDFPage,
  text: string,
  options: { x: number; y: number; maxWidth: number; font: PDFFont; size: number; color: ReturnType<typeof rgb>; lineGap?: number },
): number {
  const lines = wrapText(text, options.font, options.size, options.maxWidth);
  const lineHeight = options.size + (options.lineGap ?? 4);
  let cursorY = options.y;
  for (const line of lines) {
    if (line) {
      page.drawText(line, { x: options.x, y: cursorY, size: options.size, font: options.font, color: options.color });
    }
    cursorY -= lineHeight;
  }
  return cursorY;
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
    y = PAGE_HEIGHT - 72;
  };

  const ensureSpace = (height: number) => {
    if (y - height < 48) startPage();
  };

  const drawSectionLabel = (label: string) => {
    ensureSpace(24);
    page.drawRectangle({ x: MARGIN, y: y - 2, width: CONTENT_WIDTH, height: 1, color: COLORS.border });
    y -= 16;
    page.drawText(label.toUpperCase(), { x: MARGIN, y, size: FONT_SIZES.label, font: bold, color: COLORS.muted });
    y -= 18;
  };

  const drawParagraph = (text: string, size: number = FONT_SIZES.body, font: PDFFont = regular, color = COLORS.black) => {
    const lines = wrapText(text, font, size, CONTENT_WIDTH);
    const needed = lines.length * (size + 4) + 4;
    ensureSpace(needed);
    y = drawWrappedText(page, text, { x: MARGIN, y, maxWidth: CONTENT_WIDTH, font, size, color });
    y -= 4;
  };

  const drawKeyValueGrid = (items: Array<{ label: string; value: string }>) => {
    const columnWidth = (CONTENT_WIDTH - 16) / 2;
    for (let index = 0; index < items.length; index += 2) {
      ensureSpace(70);
      const row = items.slice(index, index + 2);
      row.forEach((item, itemIndex) => {
        const x = MARGIN + itemIndex * (columnWidth + 16);
        page.drawRectangle({ x, y: y - 56, width: columnWidth, height: 56, borderColor: COLORS.border, borderWidth: 1.5, color: COLORS.canvas });
        page.drawText(item.label.toUpperCase(), { x: x + 10, y: y - 14, size: FONT_SIZES.tiny, font: bold, color: COLORS.muted });
        drawWrappedText(page, item.value, { x: x + 10, y: y - 30, maxWidth: columnWidth - 20, font: bold, size: FONT_SIZES.body, color: COLORS.black, lineGap: 3 });
      });
      y -= 68;
    }
  };

  const drawStatCards = (items: Array<{ label: string; value: string; color?: ReturnType<typeof rgb> }>) => {
    const cols = Math.min(items.length, 3);
    const gap = 12;
    const cardWidth = (CONTENT_WIDTH - gap * (cols - 1)) / cols;
    ensureSpace(68);
    items.slice(0, 6).forEach((item, i) => {
      const col = i % cols;
      const rowIndex = Math.floor(i / cols);
      if (col === 0 && rowIndex > 0) { y -= 68; ensureSpace(68); }
      const x = MARGIN + col * (cardWidth + gap);
      const cardY = y;
      page.drawRectangle({ x, y: cardY - 58, width: cardWidth, height: 58, borderColor: COLORS.border, borderWidth: 2, color: COLORS.white });
      page.drawText(item.label.toUpperCase(), { x: x + 10, y: cardY - 14, size: FONT_SIZES.tiny, font: bold, color: COLORS.muted });
      page.drawText(item.value, { x: x + 10, y: cardY - 38, size: FONT_SIZES.heading, font: bold, color: item.color || COLORS.black });
    });
    y -= 68;
  };

  const drawTable = (headers: string[], rows: string[][], colWidths: number[]) => {
    const rowHeight = 18;
    // Header
    ensureSpace(rowHeight * 2);
    let tx = MARGIN;
    page.drawRectangle({ x: MARGIN, y: y - rowHeight, width: CONTENT_WIDTH, height: rowHeight, color: COLORS.canvas });
    for (let c = 0; c < headers.length; c++) {
      page.drawText(headers[c].toUpperCase(), { x: tx + 4, y: y - 13, size: FONT_SIZES.tiny, font: bold, color: COLORS.muted });
      tx += colWidths[c];
    }
    y -= rowHeight;
    page.drawRectangle({ x: MARGIN, y, width: CONTENT_WIDTH, height: 1, color: COLORS.border });

    for (const row of rows) {
      ensureSpace(rowHeight);
      tx = MARGIN;
      for (let c = 0; c < row.length; c++) {
        const cellText = row[c].length > 50 ? row[c].slice(0, 48) + '\u2026' : row[c];
        page.drawText(cellText, { x: tx + 4, y: y - 13, size: FONT_SIZES.label, font: regular, color: COLORS.black });
        tx += colWidths[c];
      }
      y -= rowHeight;
      page.drawRectangle({ x: MARGIN, y, width: CONTENT_WIDTH, height: 0.5, color: rgb(0.88, 0.88, 0.88) });
    }
    y -= 8;
  };

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // COVER PAGE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 200, width: PAGE_WIDTH, height: 200, color: COLORS.black });

  // CivicGraph branding
  page.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 74, width: 26, height: 26, color: COLORS.red });
  page.drawRectangle({ x: MARGIN + 6, y: PAGE_HEIGHT - 68, width: 14, height: 14, color: COLORS.white });
  page.drawText('CivicGraph Due Diligence Pack', {
    x: MARGIN + 36, y: PAGE_HEIGHT - 58, size: FONT_SIZES.label, font: bold, color: COLORS.yellow,
  });

  y = PAGE_HEIGHT - 110;
  drawWrappedText(page, pack.entity.canonical_name, {
    x: MARGIN, y, maxWidth: CONTENT_WIDTH, font: bold, size: FONT_SIZES.title, color: COLORS.white,
  });
  y -= FONT_SIZES.title + 12;

  const subtitle = [
    pack.entity.abn ? `ABN ${pack.entity.abn}` : null,
    pack.entity.entity_type,
    pack.entity.state,
  ].filter(Boolean).join(' \u2022 ');
  page.drawText(subtitle, { x: MARGIN, y, size: FONT_SIZES.body, font: regular, color: rgb(0.8, 0.8, 0.8) });

  y = PAGE_HEIGHT - 240;
  drawKeyValueGrid([
    { label: 'Generated', value: fmtDate(pack.generated_at) },
    { label: 'Generated By', value: 'CivicGraph \u2014 Allocation Intelligence' },
    { label: 'Entity ID', value: pack.entity.gs_id },
    { label: 'Data Sources', value: `${pack.data_sources.length} databases` },
  ]);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. ENTITY PROFILE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  drawSectionLabel('1. Entity Profile');
  drawKeyValueGrid([
    { label: 'Legal Name', value: pack.entity.canonical_name },
    { label: 'ABN', value: pack.entity.abn || 'Not registered' },
    { label: 'Entity Type', value: pack.entity.entity_type },
    { label: 'Sector', value: pack.entity.sector || '\u2014' },
    { label: 'State', value: pack.entity.state || '\u2014' },
    { label: 'Postcode', value: pack.entity.postcode || '\u2014' },
    { label: 'Remoteness', value: pack.entity.remoteness || '\u2014' },
    { label: 'SEIFA IRSD Decile', value: pack.entity.seifa_irsd_decile != null ? String(pack.entity.seifa_irsd_decile) : '\u2014' },
    { label: 'Community Controlled', value: pack.entity.is_community_controlled ? 'Yes' : 'No' },
    { label: 'LGA', value: pack.entity.lga_name || '\u2014' },
  ]);

  if (pack.charity) {
    drawParagraph(
      [
        pack.charity.charity_size ? `Charity size: ${pack.charity.charity_size}` : null,
        pack.charity.pbi ? 'Public Benevolent Institution (PBI)' : null,
        pack.charity.hpc ? 'Health Promotion Charity (HPC)' : null,
        pack.charity.purposes?.length ? `Purposes: ${pack.charity.purposes.join(', ')}` : null,
        pack.charity.operating_states?.length ? `Operating in: ${pack.charity.operating_states.join(', ')}` : null,
      ].filter(Boolean).join('. ') + '.',
      FONT_SIZES.label,
      regular,
      COLORS.muted,
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. FINANCIAL SUMMARY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  drawSectionLabel('2. Financial Summary');
  if (pack.financials.length > 0) {
    const latestYear = pack.financials[0];
    drawStatCards([
      { label: 'Latest Revenue', value: fmtMoney(latestYear.total_revenue) },
      { label: 'Latest Expenses', value: fmtMoney(latestYear.total_expenses) },
      { label: 'Total Assets', value: fmtMoney(latestYear.total_assets) },
    ]);

    drawTable(
      ['Year', 'Revenue', 'Expenses', 'Assets', 'Surplus', 'Gov Revenue', 'Staff FTE'],
      pack.financials.map(f => [
        String(f.ais_year),
        fmtMoney(f.total_revenue),
        fmtMoney(f.total_expenses),
        fmtMoney(f.total_assets),
        fmtMoney(f.net_surplus_deficit),
        fmtMoney(f.revenue_from_government),
        f.staff_fte != null ? String(Math.round(f.staff_fte)) : '\u2014',
      ]),
      [55, 80, 80, 80, 75, 80, 62],
    );
  } else {
    drawParagraph('No ACNC financial data available for this entity.', FONT_SIZES.body, regular, COLORS.muted);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. FUNDING HISTORY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  drawSectionLabel('3. Government Funding');
  if (pack.funding.total > 0) {
    drawStatCards([
      { label: 'Total Funding', value: fmtMoney(pack.funding.total), color: COLORS.red },
      { label: 'Funding Records', value: String(pack.funding.record_count) },
      { label: 'Programs', value: String(Object.keys(pack.funding.by_program).length) },
    ]);

    const programEntries = Object.entries(pack.funding.by_program).sort((a, b) => b[1] - a[1]).slice(0, 10);
    drawTable(
      ['Program', 'Total'],
      programEntries.map(([prog, total]) => [prog, fmtMoney(total)]),
      [CONTENT_WIDTH - 100, 100],
    );
  } else {
    drawParagraph('No justice funding records found for this entity.', FONT_SIZES.body, regular, COLORS.muted);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. GOVERNMENT CONTRACTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  drawSectionLabel('4. Government Contracts');
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
    drawParagraph('No AusTender contract records found for this entity.', FONT_SIZES.body, regular, COLORS.muted);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. POLITICAL DONATIONS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  drawSectionLabel('5. Political Connections');
  if (pack.donations.total > 0) {
    drawStatCards([
      { label: 'Total Donations', value: fmtMoney(pack.donations.total), color: COLORS.red },
      { label: 'Donation Records', value: String(pack.donations.record_count) },
    ]);

    const partyEntries = Object.entries(pack.donations.by_party).sort((a, b) => b[1] - a[1]);
    drawTable(
      ['Party / Recipient', 'Total'],
      partyEntries.map(([party, total]) => [party, fmtMoney(total)]),
      [CONTENT_WIDTH - 100, 100],
    );
  } else {
    drawParagraph('No political donation records found for this entity.', FONT_SIZES.body, regular, COLORS.muted);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. ALMA EVIDENCE
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  drawSectionLabel('6. Evidence Alignment (ALMA)');
  if (pack.alma_interventions.length > 0) {
    drawStatCards([
      { label: 'ALMA Interventions', value: String(pack.alma_interventions.length), color: COLORS.green },
      { label: 'Youth Justice', value: String(pack.alma_interventions.filter(a => a.serves_youth_justice).length) },
    ]);

    drawTable(
      ['Intervention', 'Type', 'Evidence', 'Cohort'],
      pack.alma_interventions.map(a => [
        a.name,
        a.type || '\u2014',
        a.evidence_level || '\u2014',
        a.target_cohort || '\u2014',
      ]),
      [190, 110, 100, 112],
    );
  } else {
    drawParagraph('No Australian Living Map of Alternatives (ALMA) interventions linked to this entity.', FONT_SIZES.body, regular, COLORS.muted);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. GEOGRAPHIC CONTEXT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  drawSectionLabel('7. Geographic Context');
  if (pack.place) {
    drawKeyValueGrid([
      { label: 'Locality', value: pack.place.locality || '\u2014' },
      { label: 'LGA', value: pack.place.lga_name || '\u2014' },
      { label: 'Remoteness', value: pack.place.remoteness || '\u2014' },
      { label: 'SEIFA IRSD Score', value: pack.place.seifa_score != null ? String(pack.place.seifa_score) : '\u2014' },
      { label: 'SEIFA Decile', value: pack.place.seifa_decile != null ? String(pack.place.seifa_decile) : '\u2014' },
      { label: 'Local Ecosystem', value: `${pack.place.local_entity_count} entities in postcode ${pack.place.postcode}` },
    ]);
  } else {
    drawParagraph('No geographic data available (missing postcode).', FONT_SIZES.body, regular, COLORS.muted);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 8. RELATIONSHIP SUMMARY
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  drawSectionLabel('8. Relationship Summary');
  if (pack.stats) {
    drawStatCards([
      { label: 'Relationships', value: String(pack.stats.total_relationships) },
      { label: 'Inbound Value', value: fmtMoney(pack.stats.total_inbound_amount) },
      { label: 'Outbound Value', value: fmtMoney(pack.stats.total_outbound_amount) },
    ]);
    drawParagraph(`${pack.stats.counterparty_count} distinct counterparties across all relationship types.`);
  } else {
    drawParagraph('No relationship statistics available.', FONT_SIZES.body, regular, COLORS.muted);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 9. INTEGRITY ASSESSMENT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  drawSectionLabel('9. Integrity Assessment');
  const flags = pack.integrity_flags;
  const flagItems: Array<{ label: string; ok: boolean }> = [
    { label: 'ABN registered', ok: !flags.missing_abn },
    { label: 'ACNC financial data available', ok: !flags.missing_financials },
    { label: 'Evidence-backed programs (ALMA)', ok: flags.has_alma_interventions },
    { label: 'Government funding received', ok: flags.has_justice_funding },
    { label: 'Government contracts held', ok: flags.has_contracts },
    { label: 'Political donations declared', ok: !flags.has_donations },
    { label: 'No donations + contracts overlap', ok: !flags.donations_and_contracts_overlap },
    { label: 'Operating in disadvantaged area (SEIFA \u2264 3)', ok: flags.low_seifa },
  ];

  for (const flag of flagItems) {
    ensureSpace(18);
    const indicator = flag.ok ? '\u2713' : '\u2717';
    const color = flag.ok ? COLORS.green : COLORS.red;
    page.drawText(indicator, { x: MARGIN, y, size: FONT_SIZES.body, font: bold, color });
    page.drawText(flag.label, { x: MARGIN + 18, y, size: FONT_SIZES.body, font: regular, color: COLORS.black });
    y -= 18;
  }
  y -= 8;

  if (flags.donations_and_contracts_overlap) {
    ensureSpace(40);
    page.drawRectangle({ x: MARGIN, y: y - 30, width: CONTENT_WIDTH, height: 30, color: rgb(1, 0.95, 0.95), borderColor: COLORS.red, borderWidth: 1.5 });
    page.drawText('INTEGRITY FLAG: Entity has both political donation records and government contracts. Cross-reference recommended.', {
      x: MARGIN + 10, y: y - 20, size: FONT_SIZES.label, font: bold, color: COLORS.red,
    });
    y -= 42;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 10. DATA SOURCES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  drawSectionLabel('10. Data Sources & Citation');
  for (const src of pack.data_sources) {
    ensureSpace(16);
    page.drawText(`\u2022 ${src}`, { x: MARGIN + 8, y, size: FONT_SIZES.label, font: regular, color: COLORS.muted });
    y -= 16;
  }
  y -= 8;

  ensureSpace(60);
  page.drawRectangle({ x: MARGIN, y: y - 50, width: CONTENT_WIDTH, height: 50, color: COLORS.canvas, borderColor: COLORS.border, borderWidth: 1 });
  drawWrappedText(page, pack.citation, {
    x: MARGIN + 10, y: y - 14, maxWidth: CONTENT_WIDTH - 20, font: regular, size: FONT_SIZES.label, color: COLORS.muted,
  });
  y -= 60;

  drawParagraph(
    'This due diligence pack is auto-generated from public data sources. Verify critical claims against primary sources before inclusion in formal submissions or board papers.',
    FONT_SIZES.label,
    regular,
    COLORS.muted,
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // PAGE CHROME
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  const totalPages = pages.length;
  pages.forEach((p, index) => {
    p.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 28, width: CONTENT_WIDTH, height: 2, color: COLORS.black });
    p.drawRectangle({ x: MARGIN, y: 28, width: CONTENT_WIDTH, height: 1, color: COLORS.border });
    p.drawRectangle({ x: MARGIN, y: PAGE_HEIGHT - 56, width: 22, height: 22, color: COLORS.red });
    p.drawRectangle({ x: MARGIN + 5, y: PAGE_HEIGHT - 51, width: 12, height: 12, color: COLORS.white });
    p.drawText('CivicGraph Due Diligence Pack', {
      x: MARGIN + 32, y: PAGE_HEIGHT - 47, size: FONT_SIZES.tiny, font: bold, color: COLORS.muted,
    });
    p.drawText(`Page ${index + 1} of ${totalPages}`, {
      x: MARGIN, y: 16, size: FONT_SIZES.tiny, font: regular, color: COLORS.muted,
    });
    const idText = pack.entity.gs_id;
    p.drawText(idText, {
      x: PAGE_WIDTH - MARGIN - regular.widthOfTextAtSize(idText, FONT_SIZES.tiny), y: 16, size: FONT_SIZES.tiny, font: regular, color: COLORS.muted,
    });
  });

  const bytes = await pdfDoc.save();
  return {
    bytes: new Uint8Array(bytes),
    filename: `due-diligence-${slugify(pack.entity.canonical_name)}.pdf`,
  };
}
