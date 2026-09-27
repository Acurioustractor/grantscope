# Jev ecosystem claims and JRNA identity: primary-source verification

**Date:** 2026-09-27  
**Status:** Primary-source review complete  
**Scope:** The ten GitHub repositories linked in the supplied post, TypeSafe's official Jev documentation, and Justice Reinvestment Network Australia's official website and documents.  
**Source rule:** Official GitHub repository pages/API and official organisation sites/docs only. No social posts, catalogues, press coverage, or third-party benchmarks were used as evidence.

---

## Executive finding

All ten linked repositories existed and were public when checked. The post is therefore not fabricating repository names. It does, however, compress a very young ecosystem into language that can sound more established than the evidence supports.

Every repository was created between 10 and 18 September 2026. At the 27 September snapshot, only four had GitHub releases, only five had GitHub Actions workflows, and only `jev-guard` had a repository security policy. Several have tests and thoughtful documentation, but none has enough public history to support a claim of production maturity, long-term maintenance, or independent security assurance.

Jev itself is not a general-purpose agent or coding model. TypeSafe describes it as a hosted "System One" decision model: software sends state plus narrowly typed questions and receives a bounded `Choice`, `Score`, or `Noul` result, with probabilities and, for Choice and Score, confidence. TypeSafe explicitly says Jev does not generate text, write code, hold a conversation, or replace the LLM in a coding agent.

The useful architectural claim in the post is substantially accurate: these projects generally keep state, arithmetic, thresholds, and execution in code while assigning Jev a narrow semantic judgement. The safety implication is equally important: Jev should be treated as a probabilistic input to a policy, not as the policy or authority itself.

## What Jev is, and is not

### Verified

- TypeSafe calls Jev its flagship System One model. It accepts a state and typed questions, then returns structured answers rather than generated prose ([official introduction](https://docs.typesafe.ai/introduction)).
- The three documented primitives are `Choice`, `Score`, and `Noul`. Choice selects from a closed list, Score evaluates against an ordered rubric, and Noul returns a 0 to 1 probability for a true/false proposition ([official introduction](https://docs.typesafe.ai/introduction)).
- TypeSafe recommends atomic questions and composing results in code. Complex reasoning, weighting, arithmetic, dates, and invariants should remain deterministic code concerns ([official introduction](https://docs.typesafe.ai/introduction), [Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13)).
- TypeSafe explicitly states that Jev is not a chat model, code-completion model, or drop-in replacement for the model behind a coding agent ([Jev with coding agents](https://docs.typesafe.ai/introduction/coding-agents)).
- The reviewed integrations use a remote TypeSafe API key. This means the state supplied to Jev leaves the local process unless an integration inserts another provider or local fallback.

### Important limitations disclosed by TypeSafe

The official `jev-1.13` jaggedness document says the model can struggle with literal wording, arithmetic, counting, dates, indirection, large irrelevant states, contradictory criteria, and structural invariants. It also says adversarial content can move an answer because Jev does not treat supplied state as hostile by default. TypeSafe recommends precise criteria and testing edge cases before broad deployment ([Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13)).

TypeSafe says it does not train models on customer data and offers zero data retention to enterprise customers. The reviewed legal overview does not say that ordinary accounts receive zero retention, so a project handling community, justice, browser, shell-history, source-code, or home-state data must review the applicable DPA and privacy policy before use ([official legal overview](https://docs.typesafe.ai/legal)).

### Legitimacy boundary

TypeSafe provides coherent official documentation, SDK references, model-version limitations, and legal documents. That supports Jev being a real commercial API with an articulated design, not an invented label. The reviewed primary sources do not establish independent model auditing, open weights, long-term operational history, or fitness for high-consequence decisions. Those remain unknown.

## Repository verification and maturity snapshot

The table uses repository creation and push timestamps, stars, commits, releases, licence metadata, and file-tree checks from GitHub's official repository API on 27 September 2026. Stars and activity are mutable signals, not quality proof. "Test files" means test-like paths were present; it does not mean the tests were independently run in this review.

| Repository | Existence and claimed function | Snapshot | Maturity assessment |
|---|---|---|---|
| [`GoldenLoaf24h/browserclaw`](https://github.com/GoldenLoaf24h/browserclaw) | **Verified.** Chrome extension plus local MCP/native-messaging server controlling an existing logged-in Chrome profile. Jev is optional in a bounded page-level perceive, decide, act loop; heuristics are the fallback. | Created 10 Sep; pushed 23 Sep; 29 stars; 159 commits shown by GitHub; 29 releases, latest `v3.1.0`; CI present; extensive test paths; AGPL-3.0 stated in README, although API licence detection returned `NOASSERTION`. | **Most developed of the list, still very new.** Documentation, releases, tests, and bounded-step design are positive. It has extremely broad browser authority, including cookies/storage, authenticated requests, history, JavaScript, CDP, uploads, and clicks. Treat installation as granting access to the user's live authenticated browser. |
| [`leepokai/jev-guard`](https://github.com/leepokai/jev-guard) | **Verified.** Hooks multiple coding-agent environments and classifies tool calls into allow, ask, or deny using Jev plus local policy. | Created 17 Sep; pushed 24 Sep; 35 stars; 23 commits; 3 releases, latest `v0.3.1`; MIT; tests present; no Actions workflow found; only repository in the ten with `SECURITY.md`. | **Early security prototype with unusually explicit security intent.** A classifier-based guard is not a sandbox. Its own purpose requires sending selected prompt/tool context to a remote API. Thresholds, fallback behaviour, redaction, bypass resistance, and host-hook coverage need local review before enforcement. Never make it the sole control for destructive actions or secrets. |
| [`luantak/is-malicious`](https://github.com/luantak/is-malicious) | **Verified.** Scans an unfamiliar codebase before execution and asks Jev typed questions about suspicious source/build-file chunks. | Created 18 Sep; pushed 23 Sep; 28 stars; 20 commits; 1 release, latest `v0.1.1`; MIT; test paths present; no Actions workflow or security policy found. | **Promising proof of concept, not a malware verdict engine.** Static, chunked semantic review can miss obfuscation, runtime downloads, transitive dependencies, cross-file behaviour, binaries, and excluded files. Source snippets are potentially sent to the API. A clean result must not be read as proof that code is safe. |
| [`valentynkit/jev.nvim`](https://github.com/valentynkit/jev.nvim) | **Verified.** Uses Treesitter to split a Neovim buffer into functions, asks Jev a plain-language question about each, and ranks matches in quickfix/virtual text. | Created 18 Sep; pushed 19 Sep; 8 stars; 8 commits; no releases; MIT; CI and tests present. | **Small experimental editor plugin.** The bounded semantic-ranking use is plausible, but source-code fragments leave the editor for the API. No release history or maintenance record exists yet. |
| [`mrnugget/jev-shell-history`](https://github.com/mrnugget/jev-shell-history) | **Verified.** Ranks likely zsh completions from the user's recent shell history. | Created and pushed 18 Sep; 113 stars; 1 commit; no releases; no detected licence; tests present; no CI or security policy found. | **Demonstration-stage despite the highest star count.** One commit and no licence are material adoption cautions. Shell history routinely contains paths, hostnames, identifiers, commands, and occasionally secrets. Sending the latest 100 distinct entries to a hosted classifier creates a serious privacy surface. |
| [`colliber/duckdb-jev`](https://github.com/colliber/duckdb-jev) | **Verified.** DuckDB extension exposing Jev results as SQL scalar types for semantic questions over rows. | Created 17 Sep; pushed 18 Sep; 26 stars; 6 commits; no releases; MIT; 2 workflows and test paths present. | **Early technical prototype.** Typed SQL output is real, but it does not make the semantic answer deterministic. Queries may transmit row content externally, incur one or more remote calls, vary over time, and behave poorly at scale. It should not be used over sensitive rows without data-governance review. |
| [`AboveColin/HA-Jev`](https://github.com/AboveColin/HA-Jev) | **Verified.** Home Assistant integration exposing typed Jev answers as sensors, automation actions, and an Assist conversation agent. | Created 17 Sep; pushed 25 Sep; 65 stars; 66 commits; 18 releases, latest `1.18.0`; MIT; 4 workflows and tests present. | **Best packaged application integration in the list, but only days old.** Releases, HACS metadata, tests, and CI are positive. Home state and user commands can reveal occupancy, routines, devices, and behaviour. Automations must retain deterministic limits and confirmation for physical or security-sensitive actions. |
| [`valentynkit/jev-skip`](https://github.com/valentynkit/jev-skip) | **Verified.** Reads YouTube captions, estimates sponsor probability, displays a seek-bar heatmap, and skips high-confidence segments without a crowd database. | Created 18 Sep; pushed 19 Sep; 5 stars; 18 commits; no releases; MIT; CI and tests present. | **Experimental browser/media plugin.** The claim is narrower than the post implies and depends on captions being available and semantically clear. False positives affect viewing rather than a high-consequence process, making this a comparatively suitable experiment. |
| [`cocktailpeanut/jevthoven`](https://github.com/cocktailpeanut/jevthoven) | **Verified.** Generates editable multitrack MIDI through repeated bounded Jev decisions plus conventional music/code constraints. | Created 17 Sep; pushed 18 Sep; 15 stars; 7 commits; no releases; MIT; tests and explicit `KNOWN_LIMITATIONS.md`/`VALIDATION.md`; no CI found. | **Documented creative prototype.** It demonstrates closed choices composed by code, but "turns a sentence into MIDI" should not be confused with a mature generative-music model. No release or sustained activity record exists. |
| [`valentynkit/jev-plays-pokemon-red`](https://github.com/valentynkit/jev-plays-pokemon-red) | **Verified.** PyBoy and deterministic code handle navigation/state/arithmetic while Jev chooses at defined branch points. | Created 18 Sep; pushed 19 Sep; 8 stars; 22 commits; no releases; MIT; tests present; no CI found. | **Research/demo prototype.** It is a clean illustration of the bounded-choice pattern. It is not evidence that Jev can operate a general game agent or handle long-horizon planning independently. |

## Corrections to the social-post framing

1. **"Jev runs the fast perceive, decide, act loop" is true only for one BrowserClaw mode.** BrowserClaw also exposes deterministic tools, uses a heuristic fallback without a Jev key, caps the micro-loop, and escalates destructive or ambiguous actions. The browser controller is the larger system; Jev supplies a bounded choice inside it.
2. **"Checks every agent tool call" is an intended `jev-guard` integration claim, not a universal guarantee.** Actual coverage depends on which host hooks are installed, which tool types the host exposes, configuration, redaction, timeouts, and fallback mode.
3. **"Scans unfamiliar codebases for hidden, deceptive, or data-stealing behaviour" describes `is-malicious`, but a scan is not proof of absence.** It is a semantic static-review aid with normal static-analysis blind spots and model-specific adversarial weakness.
4. **"Proper SQL types" is accurate about `duckdb-jev` return values, not about semantic certainty.** A Boolean, number, or enum can still encode a probabilistic or mistaken model judgement.
5. **The remaining descriptions are broadly faithful to their READMEs.** What is omitted is age: most have no release, little commit history, and no evidence yet of sustained use beyond their authors' tests and examples.

## Cross-cutting security and legitimacy caveats

### 1. Hosted inference changes the data boundary

The projects can transmit browser/page context, current prompts and tool calls, source code, shell history, database rows, home state, captions, or creative prompts to TypeSafe. The exact payload differs by project. "No training on customer data" is not equivalent to no retention, no logging, Australian data residency, or permission to disclose community-controlled information.

For GrantScope, JusticeHub, JRNA-related work, and Goods on Country, do not send personal, cultural, justice, commercial, or community-governed data until the payload, retention, hosting jurisdiction, access controls, and authority to disclose have been explicitly reviewed.

### 2. Model judgement must not become delegated authority

TypeSafe's own design guidance is to keep code in control. For this work, Jev may rank or classify candidate material, but it should not decide:

- whether a community or organisation is "ready";
- whether a person, organisation, or place is risky or legitimate;
- who may be contacted or represented;
- whether culturally governed material can be used;
- whether a grant, contract, partnership, or public claim is approved;
- whether a destructive tool call or physical automation is safe without deterministic controls.

### 3. Confidence is not validation

The API returns probabilities and confidence, but TypeSafe documents several non-intuitive behaviours and warns against carrying thresholds between question forms. Thresholds need task-specific labelled examples, monitoring, abstention, and human review. High confidence does not turn a poorly framed question or incomplete state into a correct answer.

### 4. Repository existence is not supply-chain assurance

The repositories are real and readable. That does not establish maintainer identity, secure release provenance, dependency safety, reproducible builds, vulnerability response, or continued maintenance. Before any pilot, pin a reviewed commit, inspect install scripts and dependencies, run tests in isolation, restrict credentials and network access, and record exactly what data leaves the machine.

## JRNA identity and relevance

### Resolution

**High-confidence contextual resolution:** In GrantScope's justice and justice-reinvestment context, `JRNA` means **Justice Reinvestment Network Australia**. The acronym alone is not globally unique, so this should remain an explicit expansion in any public or partner-facing material.

JRNA's official site describes Justice Reinvestment Network Australia Limited as an Aboriginal and Torres Strait Islander community-controlled organisation with a 100% Aboriginal governing board. It describes JRNA as the community-controlled representative national body for communities working in justice reinvestment ([official About us page](https://justicereinvestment.net.au/what-is-justice-reinvestment/about-us/)). Its governance document says the network has existed since 2015 and incorporated as an Aboriginal Community Controlled Organisation in June 2024 ([official governance structure](https://justicereinvestment.net.au/wp-content/uploads/2025/08/jrna-governance-structure-2.pdf)).

JRNA defines justice reinvestment as First Nations community-led, place-based work that combines community data, administrative data, lived experience, and local expertise to design holistic responses. It explicitly says justice reinvestment is not an off-the-shelf program and must shift power and decision-making to community ([official JRNA site](https://justicereinvestment.net.au/)).

JRNA also publishes First Nations data-sovereignty principles and practical material for working with data. Its official partnership guidance says data and place must be defined by First Nations people and that success cannot be measured only through population-level offending or imprisonment metrics ([community-government partnerships](https://justicereinvestment.net.au/community-government-partnerships/), [resources hub](https://justicereinvestment.net.au/resources/)).

### Implication for engagement

JRNA is not simply a prospective user of a smarter classification tool. It is a potential authority, governance partner, and source of constraints for any justice-reinvestment evidence infrastructure. A legitimate approach would begin with the problem JRNA and participating communities want solved, their authority over data and definitions, and their review/withdrawal rights. Jev could later be evaluated for a bounded internal task, such as triaging public documents against a community-defined taxonomy, only after deterministic provenance, abstention, and human approval are in place.

The strongest lesson from the Jev architecture is therefore useful, but it needs a governance correction:

> Give the model one bounded, reversible judgement. Keep evidence, rules, thresholds, authority, consent, and action with code and accountable people. Let communities define the question before a model is asked to answer it.

## Recommended GrantScope position

- **Do not adopt any listed repository directly into production yet.** Their age alone warrants an isolated evaluation first.
- **Use the pattern, not the hype.** Candidate generation and semantic ranking are plausible Jev experiments. Authority, eligibility, consent, outreach, risk, and final decisions remain deterministic and human-governed.
- **Best low-risk technical experiment:** reproduce a small `Choice` or `Noul` classification over already-public documents, with a labelled evaluation set and an explicit "uncertain/manual review" route. Do not begin with private CRM, community, justice, browser-session, shell-history, or row-level service data.
- **Best JRNA-facing move:** bring a transparent evidence workflow and ask whether the problem, categories, data sources, and outputs are useful under JRNA/community governance. Do not lead with Jev or an autonomous-agent proposition.
- **Security gate before any trial:** document exact outbound fields, vendor retention terms, data location, key storage, failure mode, threshold calibration, logs, deletion, human override, and the deterministic actions the model can never authorize.

## Primary sources

### TypeSafe

- [TypeSafe: Introduction to Jev](https://docs.typesafe.ai/introduction)
- [TypeSafe: Jev with coding agents](https://docs.typesafe.ai/introduction/coding-agents)
- [TypeSafe: Jev 1.13 jaggedness](https://docs.typesafe.ai/model-jaggedness/jev-1.13)
- [TypeSafe: Legal overview](https://docs.typesafe.ai/legal)
- [TypeSafe documentation index](https://docs.typesafe.ai/llms.txt)

### Repositories

- [BrowserClaw](https://github.com/GoldenLoaf24h/browserclaw)
- [jev-guard](https://github.com/leepokai/jev-guard)
- [is-malicious](https://github.com/luantak/is-malicious)
- [jev.nvim](https://github.com/valentynkit/jev.nvim)
- [jev-shell-history](https://github.com/mrnugget/jev-shell-history)
- [duckdb-jev](https://github.com/colliber/duckdb-jev)
- [HA-Jev](https://github.com/AboveColin/HA-Jev)
- [jev-skip](https://github.com/valentynkit/jev-skip)
- [Jevthoven](https://github.com/cocktailpeanut/jevthoven)
- [jev-plays-pokemon-red](https://github.com/valentynkit/jev-plays-pokemon-red)

### JRNA

- [Justice Reinvestment Network Australia: About us](https://justicereinvestment.net.au/what-is-justice-reinvestment/about-us/)
- [Justice Reinvestment Network Australia: main site and approach](https://justicereinvestment.net.au/)
- [JRNA governance structure](https://justicereinvestment.net.au/wp-content/uploads/2025/08/jrna-governance-structure-2.pdf)
- [JRNA community-government partnerships and funding](https://justicereinvestment.net.au/community-government-partnerships/)
- [JRNA resources hub](https://justicereinvestment.net.au/resources/)

## Evidence limits

- Repository metadata is a point-in-time snapshot from 27 September 2026 and will change.
- The review inspected official repository metadata, trees, READMEs, release counts, and published documentation. It did not install or execute the ten projects, audit every source file or dependency, test their live Jev calls, or verify author identities.
- Presence of tests, workflows, releases, a licence, or a security policy is a maturity signal only. It is not proof of correctness or safety.
- JRNA resolution is high confidence because of the GrantScope justice context and the existing justice-reinvestment material, but the acronym should still be expanded on first use.
