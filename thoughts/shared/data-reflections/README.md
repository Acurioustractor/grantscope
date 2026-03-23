# Data Reflections

A structured system for deep analysis after every significant data change — ingestion, linkage, cleanup, or new layer. Not a changelog. A place to think about **what data reveals, what it obscures, and what it opens up** toward CivicGraph's mission.

## When to Write a Reflection

After any of:
- New dataset ingested (e.g., Hansard, NDIS, state procurement)
- Major linkage run (e.g., mega-linker, bridge script, dedup)
- Data cleanup or structural change (e.g., self-loop fix, constraint update)
- New materialized view or cross-system join
- Evidence coverage analysis

## Reflection Template

Each reflection answers five questions:

### 1. What Changed? (Facts)
Raw numbers. What went in, what came out, what moved.

### 2. What Does This Reveal? (Signal)
What story does the data tell now that it couldn't before? What patterns emerge? What confirms or contradicts our assumptions?

### 3. What's Still Hidden? (Gaps)
What can't we see yet? What data would change the picture? Where are the false negatives (things that look absent but aren't)?

### 4. What Could We Do Better? (Method)
What was clumsy about this process? What would make the next run cleaner, faster, more complete?

### 5. What Does This Open Up? (Opportunity)
New products, reports, investigations, or partnerships this enables. How does this move toward "Know who to fund. Know who to contract. Know it worked."

## File Naming

`YYYY-MM-DD-{slug}.md` — e.g., `2026-03-23-qld-justice-graph-fix.md`

## Index

| Date | Reflection | Key Insight |
|------|-----------|-------------|
| 2026-03-23 | [QLD Justice Graph Fix](2026-03-23-qld-justice-graph-fix.md) | Program entities unlock graph traversal; QLD 40% evidence coverage; ACCOs get 9.3% of $405M; Big Three lobby + receive |
