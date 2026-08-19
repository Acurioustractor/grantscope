---
name: config-truth
description: Compare DEPLOYED environment values against what the code actually expects — not just whether a var is set. Catches trailing whitespace, case mismatches, and strict === comparisons the stored value cannot satisfy. Use on /config-truth, "check the env", "is the flag actually on", "why is this feature not working in prod", or whenever a feature is configured-but-inert. Also run it when adding any new env flag.
---

# /config-truth — the variable is set; that is not the same as correct

On 2026-08-20 this check found that `CIVICGRAPH_LIVE_REPORTS` had been set in Vercel production
since **2026-04-30**, and that its stored value was:

```
CIVICGRAPH_LIVE_REPORTS="true\n"
```

The code read `process.env.CIVICGRAPH_LIVE_REPORTS === 'true'`. `'true\n' === 'true'` is false.
So the flag was on, the check failed, and **61 public report pages read from an empty-result stub
for four months.** Nothing errored. The handoff had recorded it as a decision nobody had taken —
"do it awake" — when it was a stray newline.

**Presence is not truth.** `/preflight` checks that vars exist. This checks that their values can
satisfy the comparisons the code performs on them.

## Procedure

### 1. Pull the real deployed values

```bash
cd /tmp && vercel env pull .envcheck --environment=production --yes
```

Run from a writable directory — the pull silently fails from some working directories and leaves
no file, which reads as "no vars" if you do not check.

### 2. Find the whitespace class first — it is invisible and it is common

```bash
grep -c '\\n"$' /tmp/.envcheck        # vars whose stored value ends in a newline
grep '\\n"$' /tmp/.envcheck | cut -d= -f1
```

Match `\n"$` (literal backslash-n), **not** `n"$` — the latter also matches any value ending in
the letter n and will overcount. Measured 2026-08-20: **8 of 42** production vars carry a trailing
newline, including `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `INVESTOR_PAGE_PASSWORD` and
both `TELEGRAM_*` vars. It is how they were pasted, so assume more will arrive the same way.

Never print a value. Names only.

### 3. Find every strict comparison the code makes

```bash
grep -rn "process\.env\.[A-Z_]* ===\|process\.env\.[A-Z_]* !==" apps/web/src --include=*.ts --include=*.tsx
```

Cross-reference against step 2. **Any var in both lists is a live bug.** Also look for the same
var read in more than one place — four files carried their own private copy of the
`CIVICGRAPH_LIVE_REPORTS` comparison, so fixing the shared helper alone would have left them
broken. A grep for `=== '` misses `!== '`; search both.

### 4. Fix the code, not just the variable

Editing the Vercel value is a Tier 2 action and it is **Ben's**, not yours. What you can do
without asking is make the code tolerant:

```ts
export function liveReportsEnabled(): boolean {
  return process.env.CIVICGRAPH_LIVE_REPORTS?.trim() === 'true';
}
```

Then read the flag in **exactly one place**, and add a convention test that fails the build if
anyone reads `process.env.<FLAG>` directly again. `apps/web/src/lib/report-client-convention.test.ts`
has the pattern; it caught a fourth offender using `!==` that the grep had missed.

### 5. Check for undefined CSS custom properties too — same failure shape

A `var(--thing)` that resolves to nothing is silent in exactly the way a failed `===` is. On the
same day, `--ws-*` was declared only inside `.ws`, while `components/nav.tsx` read it inline with
no fallbacks — so every logged-out visitor got a nav with no background and an invisible
active-page state.

```bash
grep -rn "var(--[a-z-]*)" apps/web/src --include=*.tsx | grep -v "var(--[a-z-]*," | head -40
```

Anything without a fallback comma needs a `:root` definition, or a fallback.

## The general shape

**Configuration fails silently by design.** A wrong value does not throw; it takes a different
branch. So the only way to find these is to compare the two sides — what is stored, and what the
code can accept — and no amount of reading either side alone will do it.

Before shipping any new env flag, ask: what does this render as when the flag is wrong? If the
answer is "an empty page" rather than "an error", it needs a `.trim()`, one read site, and a test.

## Definition of done

- [ ] Deployed values pulled, whitespace class counted precisely, names reported (never values)
- [ ] Every `===` / `!==` env comparison in the codebase cross-referenced
- [ ] Each flag read in exactly one place, with a build-failing test enforcing it
- [ ] Comparisons made whitespace-tolerant
- [ ] CSS custom properties checked for undefined-and-unguarded reads
- [ ] Any change to a deployed value handed to Ben; never made autonomously
