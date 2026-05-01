/**
 * civicgraph-summary.ts
 *
 * Pull the most meaningful chunk out of body_text fields scraped from
 * various Australian government sources. Each source has its own format
 * quirks — some use Markdown bullets, some have JSON-encoded escape
 * sequences, some are PDF-extracted plain text. The goal is a clean,
 * read-without-clicking summary that the dashboard side-drawer can show.
 */

function decodeEscapes(s: string): string {
  return s
    // JSON unicode escapes (literal "\u00XX" in the stored text)
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => {
      const code = parseInt(hex, 16);
      // Common HTML-ish chars
      if (code === 0x0026) return '&';
      if (code === 0x003c) return '<';
      if (code === 0x003e) return '>';
      if (code === 0x0027 || code === 0x2019) return "'";
      if (code === 0x0022 || code === 0x201c || code === 0x201d) return '"';
      try { return String.fromCharCode(code); } catch { return ' '; }
    })
    // HTML entities
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    // Literal CR/LF as escape sequences
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, ' ');
}

function stripTags(s: string): string {
  return s
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
}

function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Ministerial-statement summary.
 *
 * statements.qld.gov.au statements have a Markdown structure:
 *   Published Time: ...
 *
 *   * **lede sentence #1**
 *   * **lede sentence #2**
 *   * **lede sentence #3**
 *
 *   [body paragraphs ...]
 *
 * We pull: the published date if found, the first 3-5 lede bullets,
 * and a single body paragraph. Returns a structured object the
 * drawer can render.
 */
export function summarizeMinisterialStatement(bodyText: string | null | undefined): {
  publishedAt: string | null;
  ledeBullets: string[];
  bodyExcerpt: string;
} {
  if (!bodyText) return { publishedAt: null, ledeBullets: [], bodyExcerpt: '' };
  let s = decodeEscapes(bodyText);

  // Pull published date if present
  const pubMatch = s.match(/Published Time:\s*([0-9T:.\-Z]+)/i);
  const publishedAt = pubMatch?.[1] ?? null;

  // Strip the "Published Time" header so it doesn't pollute downstream
  s = s.replace(/Published Time:\s*[0-9T:.\-Z]+\s*/i, '');

  // Pull lede bullets — pattern is lines starting with "*   **" or "- **"
  const bulletRegex = /^(?:\*|-)\s+\*\*(.+?)\*\*\s*$/gm;
  const ledeBullets: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = bulletRegex.exec(s)) !== null && ledeBullets.length < 5) {
    const cleaned = tidy(stripTags(m[1].replace(/_+/g, '')));
    if (cleaned.length > 8) ledeBullets.push(cleaned);
  }

  // Body excerpt — strip Markdown fences/lists/links, take first 600 chars
  // after the bullets
  let body = s;
  if (ledeBullets.length > 0) {
    const lastBullet = ledeBullets[ledeBullets.length - 1];
    const idx = body.indexOf(lastBullet);
    if (idx >= 0) body = body.slice(idx + lastBullet.length);
  }
  body = body
    .replace(/^[#*\-=]+\s*/gm, '') // strip md headings + list markers
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text
    .replace(/_+/g, '')
    .replace(/\*\*/g, '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '');
  body = stripTags(body);
  body = tidy(body);
  // Cut at sentence boundary near 600 chars
  let cut = body.slice(0, 700);
  const lastDot = cut.lastIndexOf('. ');
  if (lastDot > 200) cut = cut.slice(0, lastDot + 1);
  return { publishedAt, ledeBullets, bodyExcerpt: cut };
}

/**
 * Hansard speech summary.
 *
 * Hansard body_text is plain prose extracted from PDF. Speakers prefix
 * their turn ("Mr X (Electorate—Party):"). We're given the speaker
 * separately, so pull the lede sentence + ~5-paragraph window.
 */
export function summarizeHansardSpeech(bodyText: string | null | undefined): {
  lede: string;
  excerpt: string;
} {
  if (!bodyText) return { lede: '', excerpt: '' };
  const s = tidy(stripTags(decodeEscapes(bodyText)));
  // Lede = first sentence
  const firstDot = s.indexOf('. ');
  const lede = firstDot > 20 ? s.slice(0, firstDot + 1) : s.slice(0, 200);
  // Excerpt = next ~1200 chars cut at sentence boundary
  let excerpt = s.slice(0, 1500);
  const cutAt = excerpt.lastIndexOf('. ');
  if (cutAt > 800) excerpt = excerpt.slice(0, cutAt + 1);
  return { lede, excerpt };
}

/**
 * Coronial finding summary.
 *
 * Coroners Court PDFs have predictable section headings:
 *   FINDINGS OF INQUEST / CITATION / TITLE OF COURT / JURISDICTION /
 *   FILE NO / DELIVERED ON / DELIVERED AT / HEARING DATES /
 *   FINDINGS OF / CATCHWORDS / CAUSE OF DEATH / RECOMMENDATIONS
 *
 * We pull: catchwords (key phrases), cause of death summary, and a
 * "key findings" excerpt taken from the start of the body.
 */
export function summarizeCoronerFinding(bodyText: string | null | undefined): {
  catchwords: string;
  cause: string;
  keyExcerpt: string;
} {
  if (!bodyText) return { catchwords: '', cause: '', keyExcerpt: '' };
  const s = tidy(stripTags(decodeEscapes(bodyText)));

  const catchMatch = s.match(/CATCHWORDS[:\s]+([^A-Z]{20,400})\b(?=[A-Z]{3,}|REPRESENTATION|HEARING|FILE NO|FINDINGS OF|DECEASED|CAUSE OF DEATH)/i);
  const catchwords = catchMatch ? tidy(catchMatch[1]).slice(0, 300) : '';

  const causeMatch = s.match(/CAUSE OF DEATH[:\s]+([^.]{20,400})/i)
    || s.match(/(?:died|cause of death (?:was|is))\s+([^.]{20,300})/i);
  const cause = causeMatch ? tidy(causeMatch[1]).slice(0, 280) : '';

  // Key excerpt = first 800 chars of body after a content marker
  // ("Introduction", "Background", "On [date]", etc.) since the PDF
  // headers are mostly metadata up front.
  let body = s;
  // Skip past the citation/header block
  const skipMarkers = [
    /introduction[:\s]+/i,
    /background[:\s]+/i,
    /on\s+\d{1,2}\s+\w+\s+20\d{2}/i,
    /circumstances[:\s]+/i,
    /the deceased[:\s]+/i,
  ];
  for (const re of skipMarkers) {
    const m2 = body.match(re);
    if (m2 && (m2.index ?? 0) > 100) {
      body = body.slice(m2.index ?? 0);
      break;
    }
  }
  let key = body.slice(0, 1000);
  const cutAt = key.lastIndexOf('. ');
  if (cutAt > 400) key = key.slice(0, cutAt + 1);
  return { catchwords, cause, keyExcerpt: key };
}

/**
 * Generic safe truncation at sentence boundary. Used by drawers
 * where we just need a tidy preview.
 */
export function previewText(s: string | null | undefined, maxChars = 320): string {
  if (!s) return '';
  const cleaned = tidy(stripTags(decodeEscapes(s)));
  if (cleaned.length <= maxChars) return cleaned;
  let cut = cleaned.slice(0, maxChars);
  const lastDot = cut.lastIndexOf('. ');
  if (lastDot > maxChars * 0.5) cut = cut.slice(0, lastDot + 1);
  return cut + (cut.endsWith('.') ? '' : '…');
}
