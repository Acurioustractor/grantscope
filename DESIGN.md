# Design System — CivicGraph

> **Inherits identity from** `act-global-infrastructure/.claude/skills/act-brand-alignment/references/brand-core.md` — particularly "uncomfortable truth-telling" and "name extractive systems" promises, which CivicGraph operationalises as a tool. **Visual cluster: Civic Bauhaus** — intentional break from the Editorial Warmth family because data + accountability surfaces require authority, not warmth. Bloomberg Terminal designed by the Bauhaus school. See `act-global-infrastructure/wiki/decisions/act-brand-alignment-map.md`.

## Product Context
- **What this is:** Decision infrastructure for Australian government and social sector — entity graph, procurement intelligence, funding allocation analysis, and outcome evidence
- **Who it's for:** Foundation program officers, government accountability researchers, procurement analysts, community organisations
- **Space/industry:** Civic data / government intelligence — peers: OpenCorporates, USAspending.gov, CivicIQ
- **Project type:** Data-heavy web app / dashboard

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian Bauhaus
- **Decoration level:** Intentional — hard shadows and thick borders ARE the decoration. No gradients, no blobs, no rounded corners. The geometry is the ornament.
- **Mood:** Authoritative, precise, serious. This is accountability infrastructure with teeth — a Bloomberg Terminal designed by the Bauhaus school. Not friendly, not playful, not "approachable." Rigorous.
- **Reference sites:** Every competitor uses government blue + system fonts + rounded corners. CivicGraph deliberately breaks from this with zero border-radius, bold black borders, and hard shadows.

## Typography
- **Display/Hero:** Satoshi Black (900) — geometric sans-serif, born for Bauhaus. Uppercase with tracking-widest at hero sizes. (Free via Fontshare CDN)
- **Page Headings:** Satoshi ExtraBold (800) — uppercase, slightly tighter tracking than hero
- **Section/Card Headings:** Satoshi Bold (700) — uppercase, tight tracking. Used for section titles, card headers, nav labels, button text
- **Body:** DM Sans (400/500/600/700) — geometric, clean, excellent readability at small sizes. The workhorse font for all running text.
- **UI/Labels:** DM Sans 600 or Satoshi 700 at small sizes (11-13px) — uppercase with letter-spacing for labels, tags, meta text
- **Data/Tables:** DM Sans with `font-variant-numeric: tabular-nums` — aligned columns for financial data
- **Code:** JetBrains Mono (400/500) — for ABNs, GS-IDs, technical identifiers, code blocks
- **Loading:**
  - Satoshi: `https://api.fontshare.com/v2/css?f[]=satoshi@700,800,900&display=swap`
  - DM Sans: Google Fonts `family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400`
  - JetBrains Mono: Google Fonts `family=JetBrains+Mono:wght@400;500;600`
- **Scale:**
  - Hero: 56px / Satoshi 900
  - H1: 48px / Satoshi 900
  - H2: 32px / Satoshi 800
  - H3: 20px / Satoshi 700
  - Body: 16px / DM Sans 400
  - Body small: 14px / DM Sans 400
  - Meta/Labels: 13px / DM Sans 500
  - Micro: 11-12px / Satoshi 700 uppercase (tags, badges, section labels)
  - Code: 14px / JetBrains Mono 400

## Color
- **Approach:** Restrained — color is rare and meaningful. Black + neutrals dominate; color signals state.
- **Primary palette:**
  - Black: `#121212` — primary text, borders, backgrounds, headers
  - Red: `#D02020` — danger, alerts, attention, accent. The signature color.
  - Blue: `#1040C0` — links, interactive elements, information
  - Yellow: `#F0C020` — warnings, highlights, caution
  - Canvas: `#F0F0F0` — page background
  - White: `#FFFFFF` — card/surface background
  - Muted: `#777777` — secondary text, disabled states
- **Semantic:**
  - Success/Money: `#059669` (green) / light: `#ecfdf5`
  - Warning: `#F0C020` (yellow) / light: `#FFF8E0`
  - Error/Danger: `#D02020` (red) / light: `#FFE8E8`
  - Info/Link: `#1040C0` (blue) / light: `#E8EEFF`
- **Neutral scale:** `#F0F0F0` → `#E8E8E8` → `#D0D0D0` → `#B0B0B0` → `#888888` → `#777777` → `#555555` → `#333333` → `#1A1A1A` → `#121212` → `#0A0A0A`
- **Dark mode:** Not planned. Bauhaus aesthetic is built on light canvas + contrast. Dark mode would require complete shadow system rethink — defer until there's demand.

## Spacing
- **Base unit:** 4px
- **Density:** Comfortable
- **Scale:** 2xs(2px) xs(4px) sm(8px) md(16px) lg(24px) xl(32px) 2xl(48px) 3xl(64px)

## Layout
- **Approach:** Grid-disciplined — strict columns, predictable alignment. Data density is a feature.
- **Grid:** 12 columns, responsive breakpoints
- **Max content width:** 1200px
- **Border radius:** 0px everywhere. `border-radius: 0 !important` enforced globally. This is non-negotiable — sharp corners are the Bauhaus identity.
- **Borders:** 4px solid for primary containers, 2px for secondary elements, 1px for table rows and dividers
- **Shadows:** Hard offset only — `8px 8px 0px 0px var(--bauhaus-black)` for primary cards, `4px 4px 0px 0px` for smaller elements. No soft drop shadows.

## Motion
- **Approach:** Minimal-functional — only transitions that aid comprehension
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out)
- **Duration:** micro(50-100ms) short(150ms) medium(300ms) — buttons at 0.15s, section fades at 0.3s
- **No decorative animation.** Bauhaus is still, not bouncy. No spring physics, no parallax, no scroll-triggered reveals.

## Component Patterns

### Tags/Badges
- Satoshi 700, 10-11px, uppercase, letter-spacing 0.1em
- 2px border, colored border + text, light background fill
- Examples: `LINKED` (green), `UNLINKED` (red), `PARTIAL` (yellow)

### Cards
- White background, 4px black border, 8px hard shadow
- Optional colored left border (8px) for category accent
- Satoshi 700 uppercase title, DM Sans value + label

### Tables
- 4px black border around table
- Black header row with Satoshi 700 white uppercase text
- 1px dividers between rows
- Hover: light blue background (`#E8EEFF`)
- Financial values in DM Sans tabular-nums, green for positive

### Navigation
- Sidebar: black background, Satoshi brand, DM Sans items, 4px red left-border for active
- Tab bar: Satoshi 700 uppercase, 4px red bottom-border for active, 2px black bottom-border for container

### Forms
- 2px black border inputs, DM Sans 15px text
- Focus: border-color transitions to blue
- Labels: Satoshi 700, 12px, uppercase

## Workspace Theme (.ws)
The workspace theme is a density variant for operational/internal tools. Same fonts, softer borders:
- Borders: 1px instead of 4px
- Shadows: subtle drop shadow instead of hard offset
- Typography weight: Satoshi 700 (not 900) for headings, reduced letter-spacing
- Colors: same palette, mapped through CSS variables

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-26 | Initial design system created | Codified existing Bauhaus identity, upgraded typography from system fonts to Satoshi + DM Sans + JetBrains Mono. Research showed every competitor uses government blue + system fonts — CivicGraph's Bauhaus direction is the key differentiator. |
| 2026-03-26 | No dark mode | Bauhaus aesthetic requires light canvas for shadow system. Defer until user demand. |
| 2026-03-26 | Zero border-radius enforced | Global `border-radius: 0 !important` — sharp corners are the identity, not a bug. |
| 2026-03-26 | Satoshi over system fonts | System fonts (Avenir Next / Helvetica Neue) undermined the Bauhaus commitment. Satoshi's geometric letterforms complete the vision. |