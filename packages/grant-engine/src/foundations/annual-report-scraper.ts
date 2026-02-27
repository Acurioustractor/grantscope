/**
 * Foundation Website & Annual Report Scraper
 *
 * Uses Firecrawl to scrape foundation websites and extract:
 * - Open programs and application guidelines
 * - Focus areas and giving philosophy
 * - Annual report data (giving amounts, recipients)
 * - Board members, governance
 *
 * Rate-limited to respect Firecrawl quotas.
 */

import FirecrawlApp from '@mendable/firecrawl-js';

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
  private firecrawl: FirecrawlApp;
  private delayMs: number;
  private maxPages: number;
  private lastRequest = 0;

  constructor(config: ScrapeConfig = {}) {
    const apiKey = config.firecrawlApiKey || process.env.FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error('FIRECRAWL_API_KEY required');
    this.firecrawl = new FirecrawlApp({ apiKey });
    this.delayMs = config.requestDelayMs || 2000;
    this.maxPages = config.maxPagesPerFoundation || 5;
  }

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < this.delayMs) {
      await new Promise(r => setTimeout(r, this.delayMs - elapsed));
    }
    this.lastRequest = Date.now();
  }

  /**
   * Scrape a foundation's website for key content.
   * Tries homepage + important subpages, returns combined markdown.
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

    // First: try to map the site to find available pages
    try {
      await this.rateLimit();
      const mapResult = await this.firecrawl.map(baseUrl);
      const rawLinks = (mapResult as unknown as { links?: Array<string | { url: string }> }).links || [];
      const links = rawLinks.map(l => typeof l === 'string' ? l : l.url);

      // Score links by relevance
      const scoredLinks = links
        .map(link => ({
          url: link,
          score: scoreUrl(link),
        }))
        .filter(l => l.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, this.maxPages);

      // Scrape the most relevant pages
      for (const { url } of scoredLinks) {
        if (pagesScraped >= this.maxPages) break;

        try {
          await this.rateLimit();
          const page = await this.firecrawl.scrape(url, { formats: ['markdown'] });
          const markdown = page.markdown || '';
          if (!markdown || markdown.length < 100) continue;

          result.scrapedUrls.push(url);
          pagesScraped++;

          // Categorize content
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
        } catch (err) {
          result.errors.push(`Failed to scrape ${url}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch {
      // Map failed, fallback to direct scraping of common paths
    }

    // Fallback: if map didn't work or got few pages, try common paths
    if (pagesScraped < 2) {
      for (const path of IMPORTANT_PATHS) {
        if (pagesScraped >= this.maxPages) break;

        const url = `${baseUrl}${path}`;
        if (result.scrapedUrls.includes(url)) continue;

        try {
          await this.rateLimit();
          const page = await this.firecrawl.scrape(url, { formats: ['markdown'] });
          const markdown = page.markdown || '';
          if (!markdown || markdown.length < 100) continue;

          result.scrapedUrls.push(url);
          pagesScraped++;

          if (path.includes('about') || path.includes('story') || path.includes('philosophy')) {
            result.aboutContent = (result.aboutContent || '') + '\n\n---\n\n' + markdown;
          } else if (path.includes('grant') || path.includes('program') || path.includes('apply')) {
            result.programsContent = (result.programsContent || '') + '\n\n---\n\n' + markdown;
          } else if (path.includes('annual') || path.includes('report')) {
            result.annualReportContent = (result.annualReportContent || '') + '\n\n---\n\n' + markdown;
          } else {
            result.websiteContent = (result.websiteContent || '') + '\n\n---\n\n' + markdown;
          }
        } catch {
          // Page doesn't exist, skip
        }
      }
    }

    return result;
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
