import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { PlaceBriefData, PlaceTranscript, AlmaIntervention } from '@/lib/services/place-brief-service';

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 42;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const FONT_SIZES = {
  tiny: 8,
  label: 9,
  body: 10,
  section: 13,
  heading: 18,
  title: 24,
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

interface PlaceBriefPdfInput {
  postcode: string;
  locality: string;
  state: string;
  remoteness: string | null;
  seifaDecile: number | null;
  entityCount: number;
  totalFunding: number;
  communityControlledCount: number;
  communityControlledShare: number;
  brief: PlaceBriefData;
}

export async function buildPlaceBriefPdf(input: PlaceBriefPdfInput): Promise<{ bytes: Uint8Array; filename: string }> {
  const pdfDoc = await PDFDocument.create();
  const regular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const startPage = () => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - 60;
  };

  const ensureSpace = (height: number) => {
    if (y - height < 48) startPage();
  };

  const drawSectionLabel = (label: string) => {
    ensureSpace(24);
    page.drawRectangle({ x: MARGIN, y: y - 2, width: CONTENT_WIDTH, height: 2, color: COLORS.border });
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

  // === TITLE PAGE ===
  // Header bar
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - 6, width: PAGE_WIDTH, height: 6, color: COLORS.black });

  // Title
  y = PAGE_HEIGHT - 50;
  page.drawText('PLACE BRIEF', { x: MARGIN, y, size: FONT_SIZES.tiny, font: bold, color: COLORS.muted });
  y -= 28;
  page.drawText(`${input.locality}, ${input.state}`, { x: MARGIN, y, size: FONT_SIZES.title, font: bold, color: COLORS.black });
  y -= 18;
  page.drawText(`Postcode ${input.postcode}`, { x: MARGIN, y, size: FONT_SIZES.body, font: regular, color: COLORS.muted });
  y -= 8;

  if (input.remoteness) {
    page.drawText(input.remoteness, { x: MARGIN + 80, y: y + 8, size: FONT_SIZES.tiny, font: bold, color: COLORS.muted });
  }

  y -= 24;
  page.drawRectangle({ x: MARGIN, y, width: CONTENT_WIDTH, height: 1, color: COLORS.border });
  y -= 20;

  // === STATS ROW ===
  const statWidth = CONTENT_WIDTH / 4;
  const stats = [
    { label: 'ENTITIES', value: String(input.entityCount) },
    { label: 'TOTAL FUNDING', value: fmtMoney(input.totalFunding) },
    { label: 'COMMUNITY-CTRL', value: String(input.communityControlledCount) },
    { label: 'CC FUNDING SHARE', value: `${input.communityControlledShare}%` },
  ];

  for (let i = 0; i < stats.length; i++) {
    const x = MARGIN + i * statWidth;
    page.drawRectangle({ x, y: y - 48, width: statWidth - 4, height: 48, borderColor: COLORS.border, borderWidth: 1, color: COLORS.canvas });
    page.drawText(stats[i].label, { x: x + 8, y: y - 14, size: FONT_SIZES.tiny, font: bold, color: COLORS.muted });
    page.drawText(stats[i].value, { x: x + 8, y: y - 34, size: FONT_SIZES.section, font: bold, color: COLORS.black });
  }
  y -= 64;

  // === ALIGNMENT SCORE ===
  const { alignment } = input.brief;

  drawSectionLabel('Evidence-Funding Alignment');

  // Score badge
  const scoreColor = alignment.score >= 75 ? COLORS.green : alignment.score >= 50 ? COLORS.blue : alignment.score >= 25 ? COLORS.yellow : COLORS.red;
  ensureSpace(50);
  page.drawRectangle({ x: MARGIN, y: y - 40, width: 80, height: 40, color: scoreColor });
  page.drawText(String(alignment.score), { x: MARGIN + 20, y: y - 28, size: 22, font: bold, color: COLORS.white });
  page.drawText('/100', { x: MARGIN + 50, y: y - 28, size: FONT_SIZES.body, font: regular, color: COLORS.white });
  page.drawText(alignment.label.toUpperCase(), { x: MARGIN + 90, y: y - 16, size: FONT_SIZES.label, font: bold, color: scoreColor });
  page.drawText(alignment.detail, { x: MARGIN + 90, y: y - 30, size: FONT_SIZES.tiny, font: regular, color: COLORS.muted });
  y -= 52;

  // === ALMA INTERVENTIONS ===
  if (input.brief.interventions.length > 0) {
    drawSectionLabel(`Evidence-Based Interventions (${input.brief.interventions.length})`);

    for (const intervention of input.brief.interventions) {
      ensureSpace(32);
      const fundedTag = intervention.linked ? '[FUNDED]' : '[UNFUNDED]';
      const tagColor = intervention.linked ? COLORS.green : COLORS.red;
      page.drawText(fundedTag, { x: MARGIN, y, size: FONT_SIZES.tiny, font: bold, color: tagColor });
      page.drawText(intervention.name, { x: MARGIN + 65, y, size: FONT_SIZES.body, font: bold, color: COLORS.black });
      y -= 14;
      page.drawText(`${intervention.type} | ${intervention.evidence_level}`, { x: MARGIN + 65, y, size: FONT_SIZES.tiny, font: regular, color: COLORS.muted });
      y -= 16;
    }
  }

  // === COMMUNITY VOICE (EL TRANSCRIPTS) ===
  if (input.brief.transcripts.length > 0) {
    drawSectionLabel(`Community Voice (${input.brief.transcripts.length} Transcripts)`);

    drawParagraph(
      'Empathy Ledger transcripts recorded in this area. These are first-person accounts from community members about their lived experience with services and systems.',
      FONT_SIZES.tiny,
      regular,
      COLORS.muted,
    );
    y -= 8;

    for (const transcript of input.brief.transcripts.slice(0, 8)) {
      ensureSpace(60);

      // Name + video badge
      page.drawText(transcript.storyteller_name, { x: MARGIN, y, size: FONT_SIZES.body, font: bold, color: COLORS.black });
      if (transcript.has_video) {
        const nameWidth = bold.widthOfTextAtSize(transcript.storyteller_name, FONT_SIZES.body);
        page.drawText('VIDEO', { x: MARGIN + nameWidth + 8, y, size: FONT_SIZES.tiny, font: bold, color: COLORS.blue });
      }
      y -= 14;

      // Title
      if (transcript.title !== transcript.storyteller_name) {
        page.drawText(transcript.title, { x: MARGIN, y, size: FONT_SIZES.tiny, font: bold, color: COLORS.muted });
        y -= 12;
      }

      // Excerpt
      if (transcript.excerpt) {
        const excerptLines = wrapText(`"${transcript.excerpt}"`, regular, FONT_SIZES.tiny, CONTENT_WIDTH - 10);
        for (const line of excerptLines.slice(0, 3)) {
          ensureSpace(12);
          page.drawText(line, { x: MARGIN + 5, y, size: FONT_SIZES.tiny, font: regular, color: COLORS.muted });
          y -= 11;
        }
      }

      // Word count
      page.drawText(`${transcript.word_count.toLocaleString()} words`, { x: MARGIN, y, size: FONT_SIZES.tiny, font: regular, color: COLORS.muted });
      y -= 16;
    }

    if (input.brief.transcripts.length > 8) {
      drawParagraph(`+ ${input.brief.transcripts.length - 8} more transcripts`, FONT_SIZES.tiny, regular, COLORS.muted);
    }
  }

  // === FOOTER on each page ===
  const pageCount = pdfDoc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const p = pdfDoc.getPage(i);
    p.drawText(`CivicGraph Place Brief | ${input.locality}, ${input.state} ${input.postcode}`, {
      x: MARGIN, y: 22, size: FONT_SIZES.tiny, font: regular, color: COLORS.muted,
    });
    p.drawText(`Page ${i + 1} of ${pageCount}`, {
      x: PAGE_WIDTH - MARGIN - 60, y: 22, size: FONT_SIZES.tiny, font: regular, color: COLORS.muted,
    });
    p.drawText(`Generated ${new Date().toLocaleDateString('en-AU')}`, {
      x: MARGIN, y: 12, size: 6, font: regular, color: COLORS.muted,
    });
    p.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: 4, color: COLORS.black });
  }

  const bytes = await pdfDoc.save();
  const slug = input.locality.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  return { bytes: new Uint8Array(bytes), filename: `place-brief-${slug}-${input.postcode}.pdf` };
}
