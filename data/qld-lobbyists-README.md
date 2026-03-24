# QLD Lobbyist Register — Data Extraction Guide

## Status
The QLD Lobbying Register at https://lobbyists.integrity.qld.gov.au/ uses a
Microsoft Dynamics 365 Power Pages portal. The entity grid API requires 
browser-generated session tokens and returns 500 for all server-side requests.

**As of 2024-25:** 124 registered entities, 257 registered individuals
(Source: OQIC Annual Report 2024-25, Table 1, p.11)

## Data Source
- **Primary:** https://lobbyists.integrity.qld.gov.au/Lobbying-Register/Search-lobbyists/
- **Clients:** https://lobbyists.integrity.qld.gov.au/Lobbying-Register/Search-clients/
- **Activity:** https://lobbyists.integrity.qld.gov.au/Lobbying-Register/Search-lobbying-activity/

## Why Automated Scraping Fails
1. Dynamics 365 Power Pages generates `base64SecureConfiguration` client-side via JavaScript
2. The `/_services/entity-grid-data.json/` endpoint returns 500 without this config
3. Anti-forgery tokens alone are insufficient — full browser JavaScript execution is required
4. No CSV/XLSX export function is exposed on the portal
5. No open data download on data.qld.gov.au (only PSC contact logs, not the register)

## Manual Extraction Steps

### Option A: Browser Console Script (Fastest)
1. Open https://lobbyists.integrity.qld.gov.au/Lobbying-Register/Search-lobbyists/
2. Wait for the table to fully render
3. Open DevTools Console (F12 → Console)
4. Run the extraction script from `scripts/qld-lobbyist-console-extract.js`
5. A CSV will auto-download
6. Repeat for Search-clients page
7. Place combined file at `data/qld-lobbyists.csv`

### Option B: Manual Copy-Paste
1. Open Search Lobbyists page
2. Set page size to maximum (if available)
3. For each page: select all table rows, copy to spreadsheet
4. Repeat for all pages
5. Export as CSV with columns: lobbyist_name, lobbyist_abn, client_name, client_abn

### Option C: Install Playwright (Recommended for Automation)
```bash
npm install -D playwright
npx playwright install chromium
node scripts/scrape-lobbying-qld-playwright.mjs
```

## After Extraction
Once `data/qld-lobbyists.csv` exists:
```bash
node --env-file=.env scripts/scrape-lobbying-qld.mjs
```
The scraper's Strategy C will pick up the CSV automatically.

## Alternative Data Sources Checked
- [x] data.qld.gov.au — only has PSC contact logs, not the register itself
- [x] OQIC Annual Reports — aggregate stats only (no individual names)
- [x] Wayback Machine — portal renders client-side, no cached data
- [x] Google Cache — same issue
- [x] QLD Integrity Commissioner website — links to portal only
- [x] QLD Parliament documents — no lobbyist list publications found
