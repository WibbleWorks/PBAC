# PBAC Improvement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Option A (assessment + a11y polish) now, plus C-slice hardening for high-rot lessons L12/L17/L18.

**Architecture:** Static-course edits only — no framework rewrite. Fix gates first (smoke/schema alignment), then quiz distractors, then canvas a11y live-region + audit expansion, then version-pinning + lesson content hardening. Validate with `node --check`, `validate-lessons.mjs`, `check-concept-coverage.mjs`, `smoke.mjs` after each phase.

**Tech Stack:** Vanilla JS course shell (COURSE_DATA), Node validation scripts, axe-core + Playwright a11y, canvas Policy Lab (pbac-animations.js).

---

### Task 1: Align smoke gate to 8/5 contract

**Files:**
- Modify: `tests/smoke.mjs:7,75,95`
- Test: `node tests/smoke.mjs`
- Docs: `docs/CONTENT_MODEL.md` (no change, reference only)

**Step 1: Write the failing test**
Existing assertion is the test — `q >= 5` passes when bank has 5-7 (violates schema minItems 8). No new file needed; document expected FAIL:
Run: `node scripts/validate-lessons.mjs`
Expected: PASS (24 lessons), proving smoke is weaker than schema.

**Step 2: Run test to verify gap**
Run: `node tests/smoke.mjs 2>&1 | head -20`
Expected: PASS with `>=5` message, hiding 8-bank requirement.

**Step 3: Write minimal implementation**
In `tests/smoke.mjs`:
- Line 7 comment: `>= 5 questions` -> `8 questions (5 sampled per attempt)`
- Line 75: `if (q >= 5)` -> `if (q >= 8)`
- Line 75 ok/fail strings: `(>=5)` -> `(>=8)`, `(<5)` -> `(<8)`
- Line 95: `has quiz block (>=5 enforced by validate-lessons.mjs)` -> `has quiz block (>=8 enforced by validate-lessons.mjs)`

**Step 4: Run test to verify it passes**
Run: `node tests/smoke.mjs`
Expected: PASS (all 24 lessons report 8 questions)

**Step 5: Commit**
```bash
git add tests/smoke.mjs
git commit -m "test: align smoke quiz gate to 8-bank contract"
```

### Task 2: Replace joke distractors with misconception traps

**Files:**
- Modify: `practical-examples.js` (9 distractors across L6/L14/L23/L24)
- Test: `node scripts/validate-lessons.mjs && node scripts/check-concept-coverage.mjs`
- Reference: `docs/COUNCIL_REVIEW.md:65` (A15 joke-distractor note)

**Step 1: Write the failing test**
Manual lint — count joke options:
Run: `grep -n "emailing it to\|Policy Lab canvas breaks\|In the quiz file\|frontend guessing\|screenshot of the login\|promise that it works\|Rename the second\|Allowed on weekends\|system crashes\|Blame the database" practical-examples.js`
Expected: 9+ hits (list exact lines, e.g. :227, :239, :251, :3196, :3207-3208, :3281, :3398-3399, :3411)

**Step 2: Run test to verify it fails**
Same grep above. Expected: FAIL (jokes present).

**Step 3: Write minimal implementation**
Replace each with documented misconception from same lesson:
- L6 q5d "emailing OPA team" -> "By POSTing input.json wrapped in {\"input\":...} to opa eval -i" (wrapper-shape bug, lesson lines 138-149)
- L6 q6d "Policy Lab canvas breaks" -> "Nothing — same-named packages merge safely" (bundle-collision misconception)
- L6 q7d "In the quiz file" -> "In input (per-request claims)" (input vs data confusion)
- L23/L24 traps: "frontend guessing", "screenshot", "promise", "rename second engine", "weekends/crashes", "blame DB" -> use forbid-doesn't-override, tuple-lingering, decision-diff, native-parity misconceptions from capstone content.
Keep 4 options, exactly one isCorrect, keep concept tags unchanged.

**Step 4: Run test to verify it passes**
Run: `node scripts/validate-lessons.mjs && node scripts/check-concept-coverage.mjs && node --check practical-examples.js`
Expected: 24 schema-valid, 98 concepts zero untested, syntax clean. Re-run grep: zero hits.

**Step 5: Commit**
```bash
git add practical-examples.js
git commit -m "fix: replace joke distractors with misconception traps"
```

### Task 3: Add canvas verdict live-region (a11y)

**Files:**
- Modify: `index.html:92-93` (canvas block), `pbac-animations.js:287-297` (drawFrame + verdict sites :316-317,:341-342,:375)
- Test: `node tests/smoke.mjs` (syntax) + manual DOM check

**Step 1: Write the failing test**
Run: `grep -n "aria-live\|policylab-status" index.html pbac-animations.js`
Expected: FAIL (no hits — verdicts draw-only).

**Step 2: Run test to verify it fails**
Same grep. Expected: zero hits.

**Step 3: Write minimal implementation**
In `index.html` after `<canvas id="aiCanvas">` add:
```html
<div id="policylab-status" class="sr-only" role="status" aria-live="polite" style="position:absolute;left:-9999px;"></div>
```
Add `role="img" aria-label="Policy Lab visualizer. Verdict announced in status region below."` to `#aiCanvas`.
In `pbac-animations.js` in `drawFrame()` (or each verdict site), after canvas draw, set:
```js
var s=document.getElementById('policylab-status'); if(s) s.textContent = verdictText; // e.g. "DENY — tenant mismatch"
```
Do for Rego (:316), Cedar (:341), FGA (:349-361), masking (:375). Keep canvas draw unchanged.

**Step 4: Run test to verify it passes**
Run: `node --check pbac-animations.js && grep -n "policylab-status" index.html pbac-animations.js`
Expected: hits in both files, syntax clean.

**Step 5: Commit**
```bash
git add index.html pbac-animations.js
git commit -m "a11y: announce Policy Lab verdicts via live region"
```

### Task 4: Expand a11y audit sample

**Files:**
- Modify: `tests/a11y.mjs:80-88,91-97`
- Test: `node --check tests/a11y.mjs` (full run needs Playwright + server)

**Step 1: Write the failing test**
Run: `grep -n "sampleIds" tests/a11y.mjs`
Expected: only 3 ids (`access_control_intro`, `rego_foundations`, `architecture_patterns`).

**Step 2: Run test to verify gap**
Same. Expected: confirms 21/24 lessons + review/results states unaudited.

**Step 3: Write minimal implementation**
- Expand `sampleIds` to cover each animation type once: `['access_control_intro','rego_foundations','cedar_foundations','openfga_foundations','default_deny','immuta_policies','architecture_patterns','capstone_api']` (adjust ids to actual lesson ids in tree).
- Add after quiz-in-progress audit: review-mode audit (`window.quiz.showReview()`) + results-screen audit.
- Add capstone table check (no new dep — axe covers it once navigated).
Keep FAIL_LEVELS unchanged.

**Step 4: Run test to verify it passes**
Run: `node --check tests/a11y.mjs`
Expected: syntax clean. Full: `python3 -m http.server 8765 & node tests/a11y.mjs` passes where Chrome available.

**Step 5: Commit**
```bash
git add tests/a11y.mjs
git commit -m "test: expand a11y sample to all anim types + review mode"
```

### Task 5: Extend version-pinning lint to/sample OPA/Cedar/FGA

**Files:**
- Modify: `scripts/lint-version-pinning.js:17-20,26`
- Test: `node scripts/lint-version-pinning.js`

**Step 1: Write the failing test**
Run: `grep -n "openfga/openfga:\|opa_darwin\|cedar-policy-cli\|FROM.*opa\|docker run.*openfga" practical-examples.js | head`
Expected: versioned today (v1.8.0, v1.9.0) but linter doesn't scan docker/cargo/npm — gap.

**Step 2: Run test to verify gap**
Run: `node scripts/lint-version-pinning.js`
Expected: PASS (false-negative — only scans pip).

**Step 3: Write minimal implementation**
- FILES: add `'index.html','main.js'` (keep existing two).
- Add DOCKER_PIN check: `/docker run[^\\n]*openfga\/openfga:v[0-9]/` must match; flag `:latest` or bare.
- Add OPA_PIN check: `/openpolicyagent.org\/downloads\/v[0-9]+\.[0-9]+\.[0-9]+/` must match.
- Anchor PIP_LINE to line-end too (current `[<"'`\n]` misses EOL): add `$` alternative.
Keep exit-code contract (0 clean / 1 findings).

**Step 4: Run test to verify it passes**
Run: `node scripts/lint-version-pinning.js`
Expected: clean on current tree (v1.8.0/v1.9.0 pass), catches `:latest` if introduced.

**Step 5: Commit**
```bash
git add scripts/lint-version-pinning.js
git commit -m "test: lint docker/OPA/Cedar version pins"
```

### Task 6: L12 OPA-filtering hardening

**Files:**
- Modify: `practical-examples.js` (L12 `opa_data_filtering` block) + `lessons/advanced/opa_data_filtering.json` via `node scripts/extract-lessons.mjs`
- Test: `node scripts/validate-lessons.mjs && node tests/smoke.mjs`

**Step 1: Write the failing test**
Run: `grep -n "partial eval\|tautology\|unsound\|which builtins" practical-examples.js | head`
Expected: missing tautology-alert query + builtin allowlist.

**Step 2: Run test to verify gap**
Same. Expected: zero hits for tautology/unsound.

**Step 3: Write minimal implementation**
Add to L12 content (concise, no new lesson):
- OSS vs Enterprise `/v1/compile` shape note (keep, add "verify against OPA 1.x docs" + version pin).
- Unsound-translator warning: partial-eval output must be reviewed; never concat raw values into SQL.
- Tautology alert query snippet (e.g. `WHERE 1=1` detection in generated SQL).
- Builtin allowlist: which builtins break partial-eval (list 3-4 + link to docs).
Keep estimatedTime 70 (note "add 30m if running Postgres lab" in text, don't renumber).

**Step 4: Run test + mirror**
Run: `node --check practical-examples.js && node scripts/validate-lessons.mjs && node scripts/extract-lessons.mjs && git diff --stat lessons/`
Expected: schema-valid, mirror updated.

**Step 5: Commit**
```bash
git add practical-examples.js lessons/advanced/opa_data_filtering.json
git commit -m "docs: harden L12 filtering with tautology + builtin notes"
```

### Task 7: L17 Immuta hardening

**Files:**
- Modify: `practical-examples.js` (L17 `immuta_policies`), mirror via extract
- Test: validate + coverage scripts

**Step 1: Write the failing test**
Run: `grep -n "Always Required\|Share Responsibility\|staging" practical-examples.js | head`
Expected: single-bullet merge logic, no staging procedure.

**Step 2: Run test to verify gap**
Same. Expected: confirms cram.

**Step 3: Write minimal implementation**
- Split merge semantics into truth table (Always Required=AND vs Share Responsibility=OR vs non-ABAC name-order + owner override vs guardrail-AND).
- Keep "shape-illustrative — verify against Immuta 2026.1 policy API" label.
- Add 4-step staging/test procedure (dev project → dry-run → sampled prod inputs → promote).
- Soften Q2 rename-flip or add hint referencing truth table (don't change concept tag).
Keep 8Q/5-sample contract intact.

**Step 4: Run test + mirror**
Run: `node scripts/validate-lessons.mjs && node scripts/check-concept-coverage.mjs && node scripts/extract-lessons.mjs`
Expected: green, mirror diff present.

**Step 5: Commit**
```bash
git add practical-examples.js lessons/advanced/immuta_policies.json
git commit -m "docs: split Immuta merge truth table + staging steps"
```

### Task 8: L18 PlainID hardening

**Files:**
- Modify: `practical-examples.js` (L18 `plainid_policies`), mirror via extract
- Test: validate + coverage scripts

**Step 1: Write the failing test**
Run: `grep -n "confirm tenant version\|matcher\|Scope" practical-examples.js | head`
Expected: V5 hedge present, matcher/mapper JSON missing.

**Step 2: Run test to verify gap**
Same. Expected: confirms hedge + missing example.

**Step 3: Write minimal implementation**
- Replace "confirm tenant version" hedge with pinned behavior + "verified 2026-09 vs PlainID docs" or mark estimated.
- Add minimal matcher/mapper JWT→asset JSON example (shape-illustrative, 10 lines).
- Add Scope hierarchy note (multi-identity Scope-gated, disabled default, max 3 templates).
- Add one-line prereq honesty note (Immuta→PlainID is convenience, not dependency) — do NOT renumber DAG in this task (defer to Option B).
Keep 8Q intact.

**Step 4: Run test + mirror**
Run: `node scripts/validate-lessons.mjs && node scripts/extract-lessons.mjs`
Expected: green.

**Step 5: Commit**
```bash
git add practical-examples.js lessons/advanced/plainid_policies.json
git commit -m "docs: harden L18 with matcher example + Scope notes"
```
