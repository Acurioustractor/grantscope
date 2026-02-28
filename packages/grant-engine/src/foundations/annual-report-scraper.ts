/**
 * Foundation Website & Annual Report Scraper
 *
 * Multi-provider scraping: Jina Reader (free) with Firecrawl fallback.
 * - Firecrawl: site mapping (discover pages) + JS-heavy site scraping
 * - Jina Reader: free page-level scraping (no key needed)
 *
 * Extracts:
 * - Open programs and application guidelines
 * - Focus areas and giving philosophy
 * - Annual report data (giving amounts, recipients)
 * - Board members, governance
 */

export interface ScrapedFoundationData {
  websiteContent: string | null;
  aboutContent: string | null;
  programsContent: string | null;
  annualReportContent: string | null;
  scrapedUrls: string[];
  errors: string[];
}

interface ScrapeConfig {
  firecrawlApiKey?: string;
  requestDelayMs?: number;
  maxPagesPerFoundation?: number;
  preferJina?: boolean; // Use Jina Reader as primary (saves Firecrawl credits)
}

/**
 * Common paths where foundations publish key information.
 */
const IMPORTANT_PATHS = [
  '',                    // homepage
  '/about',
  '/about-us',
  '/our-story',
  '/what-we-do',
  '/grants',
  '/programs',
  '/funding',
  '/apply',
  '/how-to-apply',
  '/annual-report',
  '/annual-reports',
  '/publications',
  '/impact',
  '/our-impact',
  '/focus-areas',
  '/our-focus',
  '/philosophy',
  '/approach',
];

export class FoundationScraper {
  private firecrawl: { map: (url: string) => Promise<unknown>; scrape: (url: string, opts: unknown) => Promise<{ markdown?: string }> } | null = null;
  private _firecrawlApiKey: string | null = null;
  private _firecrawlLoaded = false;
  private delayMs: number;
  private maxPages: number;
  private lastRequest = 0;
  private preferJina: boolean;
  private jinaFailCount = 0;

  constructor(config: ScrapeConfig = {}) {
    this._firecrawlApiKey = config.firecrawlApiKey || process.env.FIRECRAWL_API_KEY || null;
    this.delayMs = config.requestDelayMs || 1500;
    this.maxPages = config.maxPagesPerFoundation || 5;
    this.preferJina = config.preferJina ?? true; // Default: save Firecrawl credits
  }

  private async ensureFirecrawl(): Promise<void> {
    if (this._firecrawlLoaded || !this._firecrawlApiKey) return;
    this._firecrawlLoaded = true;
    try {
      const { default: FirecrawlApp } = await import('@mendable/firecrawl-js');
      this.firecrawl = new FirecrawlApp({ apiKey: this._firecrawlApiKey });
    } catch {
      console.log('[scraper] Firecrawl SDK not available, using Jina Reader only');
    }
  }

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < this.delayMs) {
      await new Promise(r => setTimeout(r, this.delayMs - elapsed));
    }
    this.lastRequest = Date.now();
  }

  /**
   * Scrape a single URL via Jina Reader (free, no API key).
   * Returns markdown content or null on failure.
   */
  private async scrapeViaJina(url: string): Promise<string | null> {
    try {
      const response = await fetch(`https://r.jina.ai/${url}`, {
        headers: {
          'Accept': 'text/markdown',
          'X-No-Cache': 'true',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        return null;
      }

      const text = await response.text();
      // Jina returns markdown with metadata header, extract just the content
      const contentMatch = text.match(/Markdown Content:\n([\s\S]*)/);
      return contentMatch ? contentMatch[1].trim() : text.trim();
    } catch {
      this.jinaFailCount++;
      return null;
    }
  }

  /**
   * Scrape a single URL via Firecrawl (paid, handles JS).
   */
  private async scrapeViaFirecrawl(url: string): Promise<string | null> {
    await this.ensureFirecrawl();
    if (!this.firecrawl) return null;
    try {
      const page = await this.firecrawl.scrape(url, { formats: ['markdown'] });
      return page.markdown || null;
    } catch {
      return null;
    }
  }

  /**
   * Scrape a single page — tries Jina first (free), falls back to Firecrawl.
   */
  private async scrapePage(url: string): Promise<string | null> {
    await this.rateLimit();

    if (this.preferJina && this.jinaFailCount < 3) {
      const jina = await this.scrapeViaJina(url);
      if (jina && jina.length >= 100) return jina;
      // Fall back to Firecrawl
    }

    if (this.firecrawl) {
      await this.rateLimit();
      const fc = await this.scrapeViaFirecrawl(url);
      if (fc && fc.length >= 100) return fc;
    }

    // If Jina wasn't tried first, try it as fallback
    if (!this.preferJina || this.jinaFailCount >= 3) {
      const jina = await this.scrapeViaJina(url);
      if (jina && jina.length >= 100) return jina;
    }

    return null;
  }

  /**
   * Discover pages on a foundation website.
   * Uses Firecrawl map if available, otherwise generates URLs from common paths.
   */
  private async discoverPages(baseUrl: string): Promise<string[]> {
    const discovered: string[] = [];

    // Try Firecrawl map first (discovers actual site structure)
    await this.ensureFirecrawl();
    if (this.firecrawl) {
      try {
        await this.rateLimit();
        const mapResult = await this.firecrawl.map(baseUrl);
        const rawLinks = (mapResult as unknown as { links?: Array<string | { url: string }> }).links || [];
        const links = rawLinks.map((l: string | { url: string }) => typeof l === 'string' ? l : l.url);

        // Score and return top links
        const scored = links
          .map((link: string) => ({ url: link, score: scoreUrl(link) }))
          .filter((l: { score: number }) => l.score > 0)
          .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
          .slice(0, this.maxPages);

        return scored.map((l: { url: string }) => l.url);
      } catch {
        // Map failed, fall through to common paths
      }
    }

    // Fallback: generate URLs from common paths
    for (const path of IMPORTANT_PATHS) {
      discovered.push(`${baseUrl}${path}`);
    }
    return discovered;
  }

  /**
   * Scrape a foundation's website for key content.
   */
  async scrapeFoundation(websiteUrl: string): Promise<ScrapedFoundationData> {
    const result: ScrapedFoundationData = {
      websiteContent: null,
      aboutContent: null,
      programsContent: null,
      annualReportContent: null,
      scrapedUrls: [],
      errors: [],
    };

    // Normalize URL
    let baseUrl = websiteUrl.trim();
    if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
    baseUrl = baseUrl.replace(/\/+$/, '');

    let pagesScraped = 0;

    // Discover pages
    const pages = await this.discoverPages(baseUrl);

    // Scrape discovered pages
    for (const url of pages) {
      if (pagesScraped >= this.maxPages) break;

      try {
        const markdown = await this.scrapePage(url);
        if (!markdown) continue;

        result.scrapedUrls.push(url);
        pagesScraped++;
        categorizeContent(result, url, markdown);
      } catch (err) {
        result.errors.push(`Failed to scrape ${url}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // If we got few pages from discovery, try common paths directly
    if (pagesScraped < 2) {
      for (const path of IMPORTANT_PATHS) {
        if (pagesScraped >= this.maxPages) break;
        const url = `${baseUrl}${path}`;
        if (result.scrapedUrls.includes(url)) continue;

        try {
          const markdown = await this.scrapePage(url);
          if (!markdown) continue;

          result.scrapedUrls.push(url);
          pagesScraped++;
          categorizeContent(result, url, markdown);
        } catch {
          // Page doesn't exist, skip
        }
      }
    }

    return result;
  }
}

/**
 * Categorize scraped content by URL pattern.
 */
function categorizeContent(result: ScrapedFoundationData, url: string, markdown: string): void {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('annual-report') || urlLower.includes('annual_report')) {
    result.annualReportContent = (result.annualReportContent || '') + '\n\n---\n\n' + markdown;
  } else if (urlLower.includes('about') || urlLower.includes('story') || urlLower.includes('philosophy')) {
    result.aboutContent = (result.aboutContent || '') + '\n\n---\n\n' + markdown;
  } else if (urlLower.includes('grant') || urlLower.includes('program') || urlLower.includes('fund') || urlLower.includes('apply')) {
    result.programsContent = (result.programsContent || '') + '\n\n---\n\n' + markdown;
  } else {
    result.websiteContent = (result.websiteContent || '') + '\n\n---\n\n' + markdown;
  }
}

/**
 * Score a URL by how relevant it is for foundation profiling.
 */
function scoreUrl(url: string): number {
  const lower = url.toLowerCase();
  let score = 0;

  // High value pages
  if (/annual.?report/i.test(lower)) score += 10;
  if (/grant|fund|program|apply/i.test(lower)) score += 8;
  if (/about|story|mission|philosophy|approach/i.test(lower)) score += 7;
  if (/impact|outcome|report/i.test(lower)) score += 6;
  if (/focus|area|priority|strateg/i.test(lower)) score += 5;

  // Moderate value
  if (/governance|board|team|people/i.test(lower)) score += 3;
  if (/news|media|publication/i.test(lower)) score += 2;

  // Penalize non-content pages
  if (/login|cart|shop|donate|privacy|terms|cookie/i.test(lower)) score -= 10;
  if (/\.pdf$/i.test(lower)) score += 4; // PDFs often contain annual reports
  if (/\.(jpg|png|gif|svg|mp4|zip)$/i.test(lower)) score -= 20;

  return score;
}
