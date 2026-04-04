# AGENTS.md — Knowledge Base Operating Manual

You are an LLM agent maintaining a personal knowledge base (wiki) on **social impact, philanthropy, community power, and social enterprise in Australia**. This file defines how you read, write, and maintain every file in this vault.

## Vault Structure

```
.
├── AGENTS.md          ← You are here. Read this first, always.
├── raw/               ← Source documents (articles, notes, data). Never modify these.
├── wiki/              ← LLM-compiled articles. You own this directory.
│   ├── _index.md      ← Master index. Always keep in sync.
│   ├── concepts/      ← Concept articles (e.g., mutual-aid.md)
│   ├── entities/      ← People, organisations, programs (e.g., corena.md)
│   └── connections/   ← Cross-cutting themes linking concepts + entities
├── outputs/           ← Generated reports, slide decks, visualisations
│   ├── reports/
│   └── slides/
└── tools/             ← CLI scripts (kb ingest, kb compile, etc.)
```

## Key Files

- **AGENTS.md** — this file. Read first in every session.
- **wiki/_index.md** — master content catalog. Updated after every ingest and compile.
- **log.md** — append-only operation timeline. Read to understand recent history.

### Reading log.md at session start

At the start of every session, read the last 10 log entries:
```
grep '^## \[' log.md | tail -10
```
This tells you what was recently ingested, compiled, queried, and filed. Use it to avoid re-doing work and to pick up where a previous session left off.

### log.md format

Every operation appends an entry:
```
## [YYYY-MM-DD HH:MM] operation | title
  detail line 1
  detail line 2
```

Operation types: `ingest` | `compile` | `query` | `filed` | `lint` | `output`

Grep patterns:
```bash
grep '^## \[' log.md | tail -10    # last 10 operations
grep 'filed' log.md                # answers filed back to wiki
grep 'ingest' log.md               # all ingested sources
```

---

## Rules

1. **raw/ is read-only.** Never edit, rename, or delete source documents.
2. **wiki/ is your domain.** Create, update, and reorganise articles freely.
3. **_index.md is the single source of truth.** After any change to raw/ or wiki/, update it.
4. **Use Obsidian wikilinks** — `[[article-name]]` — for all internal links. No relative paths.
5. **One concept per file.** If an article covers multiple concepts, split it.
6. **Filenames are kebab-case** — `community-energy.md`, not `Community Energy.md`.
7. **Every article must have YAML frontmatter** (see template below).
8. **Backlinks section at the bottom** of every wiki article listing what links to it.

## Article Template

```markdown
---
title: "Article Title"
category: concept | entity | connection
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources:
  - raw/source-filename.md
tags:
  - tag1
  - tag2
summary: "One-sentence summary for the index."
---

# Article Title

Main content here. Reference sources with [[raw/filename]] and link to other wiki
articles with [[article-name]].

## Key Points

- Bullet points summarising the core ideas

## Related

- [[related-concept]]
- [[related-entity]]

## Backlinks

<!-- Auto-maintained: articles that link to this one -->
- [[linking-article]]
```

## Index Format (_index.md)

The index has these sections, maintained as markdown tables:

- **Sources** — every file in raw/ with title, date added, one-line summary, key concepts
- **Wiki Articles** — every file in wiki/ with title, category, last updated, summary
- **Concepts** — alphabetical list of all concepts, linking to articles and counting sources
- **Coverage Gaps** — concepts mentioned in sources but lacking dedicated articles

## Category Definitions

- **concept** — An idea, model, or practice (e.g., mutual aid, social procurement, participatory grantmaking)
- **entity** — A specific person, organisation, program, or fund (e.g., CORENA, Paul Ramsay Foundation, SEDI)
- **connection** — A cross-cutting theme that links multiple concepts and entities (e.g., power-and-philanthropy, indigenous-self-determination)

## Writing Style

- Factual, evidence-based, cite sources
- Australian English spelling (organisation, programme where appropriate, labour)
- Plain language — avoid jargon unless defining it
- Present tense for current state, past tense for historical events
- Include dollar figures in AUD unless stated otherwise
- When data is uncertain, say so explicitly

## Marp Slide Format

When generating slides (outputs/slides/), use Marp markdown:

```markdown
---
marp: true
theme: default
paginate: true
---

# Slide Title

Content here

---

# Next Slide

More content
```

Keep slides concise: max 5 bullet points, prefer visuals. One idea per slide.

## Domain Context

This knowledge base covers:
- Australian philanthropy landscape (PAFs, ancillary funds, DGR system)
- Community-led funding models (cooperatives, mutual aid, community energy, timebanking)
- Social enterprise sector (~12,000-20,000 enterprises, $21.3B GDP contribution)
- Power dynamics in funding (who decides, who benefits, accountability gaps)
- First Nations self-determination and community-controlled organisations
- Government grant dependency and alternatives
- Social procurement policies (especially Victoria's $115.6M)
- Data infrastructure gaps (no equivalent of UK's 360Giving)

Key framing: we are exploring how communities can exit dependency on big philanthropy and government grants, building self-sustaining, community-controlled models.
