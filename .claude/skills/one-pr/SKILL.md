---
name: one-pr
description: One PR per sitting in grantscope. All of a sitting's fixes on one branch, gates once, ships once, CI watched in the background while work continues; SAFE merges itself, VISIBLE waits for one look. Use when starting a fix, when a fix is done and the next is starting, when about to commit, push, open a PR or merge, or when Ben says "ship it".
---

# One PR per sitting

Ben, 2026-09-24: "all we do is wait for this to land and merge, how can we actually fucking do things".
That session landed four PRs one at a time, and the landing took far longer than the fixes. A sitting is
the unit of work: every fix Ben and the agent do together, from the first ask to "ship it". It lands as
ONE PR, and the agent is back on real work while CI runs.

## Steps

1. **Open the sitting's branch.** Before the first edit: `git fetch -q origin && git switch -c <type>/<slug> origin/main`
   in the main checkout. If the checkout is already on a branch of this sitting, stay on it. Done when
   `git branch --show-current` is the sitting's branch and it has no commits outside this sitting.

2. **Do each fix, commit it, start the next.** Per fix: edit, run the ONE test or local check that proves it,
   then commit it locally (`git add <files>`, never `-A`; subject plus the why; no attribution of any kind).
   These commits are local and need no approval: the plan is shown once, in step 3. Never push mid-sitting.
   Done per fix when its check passed and it is committed.

3. **Close the sitting in one message.** When Ben says "ship it", or the work he asked for is done:
   run the gate once (`bash scripts/precheck.sh`; it refuses while a dev server holds `.next`, so say so and
   run `cd apps/web && npx tsc --noEmit && npx vitest run` instead), then send one plain message with the
   commit list, what each commit fixes, and the one reply that ships it: *Say "ship it"*. If Ben is
   exploring (still working things out), the sitting stays local and step 4 waits for his "ship it".

4. **Ship: push, one PR, classify.** `git push -u origin HEAD`, `gh pr create` (body: what, why, how it was
   verified, what was left out), then `bash scripts/classify-changes.sh`. The classifier counts untracked
   files too and errs toward VISIBLE: when its VISIBLE rests only on files outside the PR's diff
   (`git diff --name-only origin/main...HEAD`), the diff decides, and the PR body says so.
   - **SAFE:** start ONE background watcher, `node scripts/ship-watch.mjs --pr <n> --merge` (Bash
     `run_in_background`), and go straight back to real work.
   - **VISIBLE:** verify the changed routes on the local dev server first and quote what they render, with
     one route that should NOT have changed as a control. Start the watcher without `--merge`, then send ONE
     preview link (from the Vercel bot comment) naming what to look at and what broken looks like.
     Ben's "good" and "land" (one message is fine) merges it: `gh pr merge <n> --squash --delete-branch`.
   Done when the PR is open, the watcher is running, and the agent is on the next piece of work.

5. **Check it live, then clean up.** When the watcher reports the merge (or after the VISIBLE merge), wait
   for the Vercel status on the merge commit, then read the changed routes on civicgraph.app with Playwright
   (`browser_navigate` + `browser_evaluate`, match case-insensitively; curl gets 429). A job fix is checked
   by its next scheduled run: name the run and the time. Then delete the merged branch and any worktree,
   and put the main checkout back on main. Done when each changed route shows the new content, or the
   report names what is not checked yet and when it will be.

## Waiting

CI runs about 8 minutes and a deploy about 4. That time goes to the next fix, never to watching:
the background watcher's notification wakes the agent. One watcher per PR; CLAUDE.md caps a session at
five background tasks, so a sitting spends one or two of them, not one per fix.

## Still needs Ben's words

A sitting changes when things land, never what needs a human: applying a migration (`/db-apply`), a
force-push other than rebasing the sitting's own branch, deleting any branch but the merged one, and
anything that reaches an external system or another person's inbox. Money surfaces still get
`/money-audit` before step 3.
