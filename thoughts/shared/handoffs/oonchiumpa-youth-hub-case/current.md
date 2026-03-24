---
date: 2026-03-22T15:00:00Z
session_name: oonchiumpa-youth-hub-case
branch: main
status: active
---

# Work Stream: oonchiumpa-youth-hub-case

## Ledger
**Updated:** 2026-03-22T11:10:00Z
**Goal:** Build Oonchiumpa site as authentic, photo-led community org website with full Empathy Ledger syndication
**Branch:** main
**Test:** `open https://oonchiumpa-app.vercel.app/` and all routes

### Now
[->] Site deployed and functional — content population and domain setup remain

### This Session
- [x] Fixed Aunty Barb & Uncle Tony: renamed (was "Bev"), bio (was "Terry"), set is_elder=true
- [x] Created contact_submissions table in Supabase with RLS + anon insert policy
- [x] Confirmed Shane/Shayne — only one Shayne exists, no dedup needed
- [x] Confirmed Kirsty/Kristy are two different people
- [x] NIAA funding research: $1.4M for 18 months (Dec 2023), part of Better Safer Future for Central Australia
- [x] Full homepage redesign — stripped AI-slop, photo-led layout with real Oonchiumpa images
- [x] Created Oonchiumpa design skill (`.claude/skills/oonchiumpa-design.md`) — locked brand guide
- [x] Created Oonchiumpa org API key in Empathy Ledger (`el_org_b4b82a52...`) scoped to 19 storytellers
- [x] Built EL v2 API client (`src/services/empathyLedgerClient.ts`) — stories, storytellers, media, galleries, transcripts
- [x] Built React hooks (`src/hooks/useEmpathyLedger.ts`) — 6 hooks for all EL data types
- [x] Wired live storyteller avatars + stories into homepage from EL API
- [x] Built MediaBrowser widget (`src/components/MediaBrowser.tsx`) — photo picker from EL galleries
- [x] Built StorytellerPicker widget — browse/select storytellers from org
- [x] Built EditableImage component — swap any photo on site via EL MediaBrowser
- [x] Built EditModeContext — floating edit button, Cmd+E, ?edit=true URL param
- [x] Built siteConfig persistence (localStorage, ready for Supabase migration)
- [x] Rewrote `/stories` page — pulls from EL v2, shows storyteller grid
- [x] Rewrote `/stories/:id` detail page — EL v2 fallback, clean article layout with inline photos
- [x] Rewrote `/about` page — team profiles now from EL storytellers, hardcoded stats/partners
- [x] Rewrote `/contact` page — 5-type inquiry form (referral/partnership/funding/media/general) with mailto fallback
- [x] Rewrote `/services` page — hardcoded services with outcomes, editable hero image
- [x] `/blog` + `/blog/:id` redirect to `/stories` (all content via EL now)
- [x] Simplified nav — 4 items: Home, About, Services, Stories
- [x] Fixed EL v2 story detail route — org_id auth, FK join fallback, media_urls/location in response (deployed)
- [x] Created test story "Bringing Kids Back to Country" by Kristy Bloomfield — verified full syndication pipeline
- [x] Uploaded 9 local Oonchiumpa images to EL Supabase storage + media_assets table (246 total available)
- [x] Content source audit — mapped every page to its data source

### Next
- [x] Create `contact_submissions` table — DONE
- [x] Clean Empathy Ledger data — Shayne already clean, Kirsty/Kristy confirmed different people
- [x] Fix elder status — Aunty Barb & Uncle Tony now elder=true
- [x] Style refinement pass — removed emoji, gradients, text-gradient, rounded-full from About page
- [x] Mobile responsive testing — all 5 pages verified at 375px, fixed Contact submit layout
- [x] Deploy Oonchiumpa site to Vercel — live at https://oonchiumpa-app.vercel.app
- [x] Added vercel.json SPA rewrite for client-side routing
- [x] Set Vercel env vars (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_EMPATHY_LEDGER_URL, VITE_EMPATHY_LEDGER_API_KEY)
- [x] Fixed CORS: added oonchiumpa-app.vercel.app to EL API key allowed_domains
- [ ] Set up Oonchiumpa domain pointing to Vercel
- [ ] Add more stories in Empathy Ledger (write in EL → auto-syndicate)
- [ ] Upload more photos to EL galleries (on-country trips, events, youth programs)
- [ ] Add video support — EL stories with video_link field rendering on detail page

### Decisions
- **Content model: write in Empathy Ledger, syndicate to site** — no blog/story CMS in the Oonchiumpa app itself
- **Photos stored in EL Supabase storage** — accessible via v2 API, swappable via MediaBrowser widget
- **Staff = EL storytellers** — add staff as storytellers in EL, they appear on About + Home automatically
- **Design: photo-led, earth tones, no AI-slop** — locked in design skill, ochre/earth palette, Inter font
- **Buttons: rounded-lg not rounded-full** — less SaaS, more community org
- **No emoji in headings or body** — authentic, not decorated
- **Blog redirects to Stories** — single content stream from EL
- **Contact form with referral mode** — age, gender, context fields for youth referrals
- **EditableImage for all hero/feature photos** — editors can swap via EL MediaBrowser in edit mode
- **EL v2 story detail: org_id auth + project auth** — fixed to support both (was only project)

### Open Questions
- UNCONFIRMED: `contact_submissions` Supabase table needs manual creation (SQL provided)
- RESOLVED: Kirsty and Kristy Bloomfield are two different people (confirmed by user)
- RESOLVED: Shayne Bloomfield — only one entry exists, no Shane duplicate
- RESOLVED: Aunty Barb (not Bev) and Uncle Tony (not Terry) — names corrected in EL
- PARTIALLY RESOLVED: NIAA funding = $1.4M for 18 months (journalism source). Entity registered under ASIC as "Oonchiumpa Consultancy and Services" — verify if same as ABN 53658668627

### Workflow State
pattern: build-and-iterate
phase: 4
total_phases: 5
retries: 0
max_retries: 3

#### Resolved
- goal: "Authentic Oonchiumpa site with EL syndication — write in EL, shows on site"
- resource_allocation: aggressive

#### Unknowns
- Storyteller dedup (Kirsty/Kristy, Shayne/Shane)
- Whether contact_submissions table exists yet

#### Last Failure
(none)

---

## Context

### Architecture

**Content flow:** Empathy Ledger → v2 API (org-scoped key) → Oonchiumpa React app

**API Key:** `el_org_b4b82a52a5aefd63771d268baea699169d9e76ec70a23828af3b0c30ae92a1bc`
- Org: Oonchiumpa (`c53077e1-98de-4216-9149-6268891ff62e`)
- Tenant: `8891e1a9-92ae-423f-928b-cec602660011`
- Scopes: read, 1000 req/hr, domains: oonchiumpa.org, localhost

**Env vars (Oonchiumpa app `.env`):**
- `VITE_EMPATHY_LEDGER_URL=https://www.empathyledger.com`
- `VITE_EMPATHY_LEDGER_API_KEY=el_org_b4b82a52...`

### Key Files (Oonchiumpa app)

| File | Purpose |
|------|---------|
| `src/services/empathyLedgerClient.ts` | Typed v2 API client (stories, storytellers, media, galleries, transcripts) |
| `src/hooks/useEmpathyLedger.ts` | 6 React hooks for all EL data types |
| `src/components/MediaBrowser.tsx` | Photo picker widget + StorytellerPicker |
| `src/components/EditableImage.tsx` | Swappable image with EL MediaBrowser |
| `src/contexts/EditModeContext.tsx` | Edit mode toggle (floating button, Cmd+E, URL param) |
| `src/services/siteConfig.ts` | localStorage persistence for photo overrides |
| `.claude/skills/oonchiumpa-design.md` | Locked design system / brand guide |
| `src/pages/HomePage.tsx` | Photo-led, EL storytellers + stories |
| `src/pages/StoriesPage.tsx` | EL v2 stories + storyteller grid |
| `src/pages/EnhancedStoryDetailPage.tsx` | EL fallback detail with inline photos |
| `src/pages/AboutPage.tsx` | EL storytellers for team, hardcoded content |
| `src/pages/ContactPage.tsx` | 5-type inquiry form with referral mode |
| `src/pages/ServicesPage.tsx` | Hardcoded services with EditableImage hero |

### Key Files (Empathy Ledger — modified this session)

| File | Change |
|------|--------|
| `src/app/api/v2/stories/[id]/route.ts` | Added org_id auth, FK fallback, media_urls/location/wordCount (committed + deployed) |

### Content Source Map

| Page | Source | Status |
|------|--------|--------|
| Home `/` | EL v2 (storytellers, stories) + hardcoded stats | Live |
| Stories `/stories` | EL v2 (stories, storytellers) | Live |
| Story Detail `/stories/:id` | EL v2 fallback from old Supabase | Live |
| About `/about` | EL v2 (team) + hardcoded content | Live |
| Contact `/contact` | Form → Supabase `contact_submissions` (mailto fallback) | Live |
| Services `/services` | Hardcoded + EditableImage | Live |
| Model `/model` | Hardcoded (standalone dark page) | Unchanged |
| System `/system` | Hardcoded (standalone dark page) | Unchanged |
| Blog `/blog` | Redirects to `/stories` | Live |

### Oonchiumpa EL Data

- **19 storytellers** linked to org
- **3 stories** published (Bringing Kids Back to Country, Coming Home to Love's Creek, Creating Our Own History)
- **246 media assets** accessible via API (9 uploaded this session + existing project media)
- **2 galleries**: Oonchiumpa Founders, Law Students Event 2025
- **2 projects**: The Homestead, Law Student Workshops

### Dev Server
- Oonchiumpa app: `http://localhost:5173` (Vite on port 5173, config says 3001)
- Empathy Ledger: `https://www.empathyledger.com`

### Contact Form SQL (needs manual creation in Supabase Dashboard)
```sql
CREATE TABLE contact_submissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL, email text NOT NULL,
  phone text, organization text,
  inquiry_type text NOT NULL DEFAULT 'general',
  message text, status text NOT NULL DEFAULT 'new',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_insert" ON contact_submissions FOR INSERT TO anon WITH CHECK (true);
```
