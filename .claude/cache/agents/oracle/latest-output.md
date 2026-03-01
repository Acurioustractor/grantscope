# Research Report: Australian Grant/Funding Websites Analysis
Generated: 2026-03-01

## Summary

Researched 6 Australian grant/funding websites to assess data availability, access methods, and suitability for GrantScope's database. Key findings: Queensland has excellent CKAN API access with JSON exports; AusTender provides OCDS API for contracts but is procurement-focused (not grants); commercial directories (Funding Centre, The Grants Hub) are behind paywalls with 5,500-7,000+ grants but prohibit redistribution; GrantConnect is the authoritative free source but lacks documented API; AirTree VC is a curated resource page, not a data source.

## Questions Answered

### Q1: Funding Centre (explore.fundingcentre.com.au)
**Data Available:** 5,500+ live grants, updated daily
**Paywall:** Yes - $85-150/year subscription required
**API/Feeds:** iCal calendar feeds available for members (personal feed for saved grants/deadlines), no public API documented
**Scraping Feasibility:** Likely JS-rendered, behind login wall
**Volume:** 5,500+ grants
**Good Source?** No - Terms prohibit commercial use/redistribution
**Confidence:** High

**Sources:**
- [Funding Centre Membership](https://explore.fundingcentre.com.au/membership)
- [Funding Centre FAQ](https://explore.fundingcentre.com.au/faq)

---

### Q2: QLD Grants Services (grants.services.qld.gov.au)
**Data Available:** Grant listings, details, amounts, deadlines via Queensland Government Grants Finder
**Paywall:** No - Open data under CC BY 4.0 license
**API/Feeds:** Yes - CKAN API with JSON export at data.qld.gov.au
**Scraping Feasibility:** CKAN DataStore API preferred over scraping - use `datastore_search` endpoint
**Volume:** Unknown (dataset available but size not specified in search results)
**Good Source?** Yes - Excellent option with structured API access
**Confidence:** High

**API Details:**
- Endpoint: `https://www.data.qld.gov.au/api/action/datastore_search`
- Dataset: "Grants Finder" available on data.qld.gov.au
- Format: JSON via CKAN API
- License: Creative Commons Attribution 4.0

**Sources:**
- [Grants Finder Dataset](https://www.data.qld.gov.au/dataset/grants-finder)
- [CKAN Data API](https://www.data.qld.gov.au/api/1/util/snippet/api_info.html)
- [Queensland Open Data Portal](https://www.data.qld.gov.au/)

---

### Q3: The Grants Hub (thegrantshub.com.au)
**Data Available:** 7,000+ Australian grants from government, trusts, foundations, and businesses
**Paywall:** Yes - $313.20-486/year subscription
**API/Feeds:** None documented
**Scraping Feasibility:** Unknown rendering method, behind login wall
**Volume:** 7,000+ grants
**Good Source?** No - Terms explicitly prohibit use by "businesses offering online grants directories, databases, searchable grant tools or similar"
**Confidence:** High

**Sources:**
- [The Grants Hub Pricing](https://www.thegrantshub.com.au/pricing)
- [Grants Directory](https://www.thegrantshub.com.au/grants-directory)
- [Terms & Conditions](https://www.thegrantshub.com.au/terms-conditions)

---

### Q4: AirTree VC (airtree.vc/open-source-vc/government-grants-for-australian-startups)
**Data Available:** Curated list of ~5-6 major federal grant programs for startups
**Paywall:** No - Free educational resource
**API/Feeds:** N/A - Static content page
**Scraping Feasibility:** Static HTML, easily scrapable
**Volume:** ~5-6 grant programs (not a comprehensive database)
**Good Source?** No - Just a curated guide pointing to government sources, not a database
**Confidence:** High

**Listed Programs:**
- Export Market Development Grants (EDMG) - Austrade
- R&D Tax Incentive
- CSIRO Kick-Start
- Business Research and Innovation Initiative (BRII)
- Industry Growth Program (IGP)

**Sources:**
- [AirTree Government Grants for Startups](https://www.airtree.vc/open-source-vc/government-grants-for-australian-startups)
- [AirTree Open Source VC](https://www.airtree.vc/open-source-vc)

---

### Q5: Community Grants Hub (communitygrants.gov.au)
**Data Available:** Australian Government community grants, application guides, grant recipient portal
**Paywall:** No - Free government service
**API/Feeds:** No documented API, RSS feed, or data export
**Scraping Feasibility:** Likely JS-rendered government portal, would need investigation
**Volume:** Unknown (central hub for community grants administration)
**Good Source?** Potentially - But appears to be a grants management portal rather than a searchable directory
**Confidence:** Medium

**Note:** This is a shared-services platform that delivers grant administration on behalf of Australian Government agencies. The authoritative source for searchable grant opportunities is GrantConnect (grants.gov.au), not this portal.

**Sources:**
- [Community Grants Hub Homepage](https://www.communitygrants.gov.au/)
- [Grant Support](https://www.communitygrants.gov.au/grant-support)

---

### Q6: AusTender (tenders.gov.au)
**Data Available:** 450,000+ procurement contracts and tenders (NOT grants)
**Paywall:** No - Free public access
**API/Feeds:** Yes - OCDS API (Open Contracting Data Standard) with authentication token required
**Scraping Feasibility:** API available, no scraping needed
**Volume:** 450,000+ contracts
**Good Source?** No - This is for government procurement contracts/tenders, not grants
**Confidence:** High

**API Details:**
- Endpoint: `https://api.tenders.gov.au/`
- Format: OCDS-compliant JSON
- Auth: Token required
- Documentation: [GitHub - austender/austender-ocds-api](https://github.com/austender/austender-ocds-api)

**Sources:**
- [AusTender Homepage](https://www.tenders.gov.au/)
- [AusTender OCDS API GitHub](https://github.com/austender/austender-ocds-api)
- [Open Contracting Partnership - Australia Data](https://www.open-contracting.org/2020/02/11/what-does-australias-open-contracting-data-look-like/)

---

## Additional Finding: GrantConnect (grants.gov.au)

**THE PRIMARY SOURCE** - This is the authoritative, free, whole-of-government grants directory for Australia.

**Data Available:** All Commonwealth grant opportunities and grants awarded
**Paywall:** No - Free (registration required for downloading docs and notifications)
**API/Feeds:** Not documented in search results
**Scraping Feasibility:** Unknown - Would need technical investigation
**Volume:** All federal government grants (exact count not specified)
**Good Source?** Yes - The official authoritative source

**Key Features:**
- Centralised listing of current grant opportunities
- Grants awarded by agency
- Daily updated reports
- Search and notification system
- No documented bulk export or API (but may exist - contact GrantConnect@Finance.gov.au)

**Note:** Search results referenced U.S. Grants.gov (which has XML export and RSS feeds), but did not find equivalent documentation for Australian GrantConnect API.

**Sources:**
- [GrantConnect Homepage](https://www.grants.gov.au/)
- [GrantConnect Help Centre](https://help.grants.gov.au/)
- [Department of Finance - Find a Grant](https://www.finance.gov.au/individuals/find-grant-grantconnect)

---

## Comparison Matrix

| Source | Volume | Free Access | API/Feed | Scraping OK | Terms Allow Reuse | Best For |
|--------|--------|-------------|----------|-------------|-------------------|----------|
| **GrantConnect** | All federal | Yes (reg req) | Unknown | ? | ? | Primary source |
| **QLD Grants Finder** | QLD only | Yes | CKAN JSON | Yes (API) | Yes (CC BY 4.0) | State data |
| **Funding Centre** | 5,500+ | No ($85-150) | iCal only | No | No | N/A |
| **The Grants Hub** | 7,000+ | No ($313-486) | None | No | No (prohibited) | N/A |
| **AusTender** | 450k contracts | Yes | OCDS API | Yes (API) | Yes | Procurement only |
| **AirTree VC** | ~5 programs | Yes | None | Yes | Yes | Guide only |
| **Community Grants Hub** | Unknown | Yes | None | ? | ? | Admin portal |

---

## Recommendations

### For GrantScope Database

**Priority 1 - Immediate Implementation:**
1. **GrantConnect (grants.gov.au)** - Start here. This is the authoritative source for all Commonwealth grants.
   - Action: Contact GrantConnect@Finance.gov.au to inquire about API access or bulk export
   - Fallback: Build scraper (investigate if JS-rendered or static HTML)
   - Expected volume: All federal government grants

2. **Queensland Grants Finder (via data.qld.gov.au)** - Easiest technical integration
   - Action: Use CKAN API to pull Grants Finder dataset
   - Implementation: Standard CKAN `datastore_search` endpoint
   - Code example needed: Python/Node.js CKAN API client
   - License: CC BY 4.0 (perfect for GrantScope)

**Priority 2 - State/Territory Expansion:**
3. **Other State Open Data Portals** - Check for similar CKAN datasets:
   - data.nsw.gov.au
   - data.vic.gov.au
   - data.sa.gov.au
   - data.wa.gov.au
   - Action: Search each portal for "grants" datasets

**Do NOT Pursue:**
- Funding Centre - Paywall + terms prohibit redistribution
- The Grants Hub - Paywall + explicit prohibition on grant directory use
- AusTender - Wrong data type (procurement, not grants)
- Community Grants Hub - Admin portal, not a searchable directory
- AirTree VC - Too small, just a curated guide

---

## Implementation Notes

### Queensland CKAN API Integration
To access Queensland Grants Finder data:

```python
import requests

# Find the Grants Finder dataset
response = requests.get('https://www.data.qld.gov.au/api/3/action/package_show?id=grants-finder')
dataset = response.json()

# Get resource ID from dataset
resource_id = dataset['result']['resources'][0]['id']

# Query the grants data
response = requests.get(
    'https://www.data.qld.gov.au/api/action/datastore_search',
    params={'resource_id': resource_id, 'limit': 1000}
)
grants = response.json()['result']['records']
```

### GrantConnect Investigation Steps
1. Visit grants.gov.au and inspect network requests
2. Check for:
   - `/api/` endpoints
   - JSON responses in XHR requests
   - GraphQL endpoints
   - Sitemap.xml for bulk discovery
3. If no API found, assess scraping:
   - Check if React/Vue/Angular (JS-rendered)
   - If JS-rendered, use Playwright
   - If static HTML, use Cheerio
4. Monitor `robots.txt` for scraping permissions

### State Portal Research Template
For each state portal (data.nsw.gov.au, etc.):
1. Search for "grants" datasets
2. Check if CKAN-based (most Australian gov portals use CKAN)
3. If CKAN: use standard API pattern
4. Document license (should be CC BY 4.0 or similar)
5. Estimate update frequency

---

## Open Questions

1. **GrantConnect API** - Does an official API exist? Contact: GrantConnect@Finance.gov.au
2. **GrantConnect scraping policy** - Is automated access permitted? Check robots.txt and ToS
3. **GrantConnect data volume** - How many total grant opportunities and awarded grants?
4. **State portal coverage** - Which other states have open data grants datasets?
5. **Update frequency** - How often does GrantConnect vs QLD Grants Finder update?
6. **Historical data** - Does GrantConnect provide access to closed/historical grant rounds?
7. **Community Grants Hub relationship** - How does this relate to GrantConnect? Are they separate databases?

---

## Technical Findings Summary

### "Backdoors" Found:
- **Queensland CKAN API** - Full JSON access via data.qld.gov.au
- **AusTender OCDS API** - But wrong data type (procurement, not grants)

### No Backdoors Found:
- Funding Centre - Login-walled, iCal only for members
- The Grants Hub - Login-walled, no documented API
- GrantConnect - No documented API (requires direct contact/investigation)
- Community Grants Hub - No documented data export
- AirTree VC - Static content page (not a database)

### Next Steps for GrantScope Team:
1. Contact GrantConnect for API documentation
2. Implement QLD CKAN API integration (quick win)
3. Investigate GrantConnect scraping feasibility
4. Research other state open data portals
5. Consider building relationships with GrantConnect/Department of Finance for official data partnership
