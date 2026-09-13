# PBAC Course — Council Review

**Date:** 2026-09-13
**Status:** SIGN-OFF GRANTED 2026-09-13 — all amendments (A1–A20) plus all 24 sign-off delta findings merged and verified. No open items.
**Sign-off verification (2026-09-13):** `node --check` ×5 clean · `validate-lessons.mjs` (24 schema-valid + JSON mirror zero drift) · `check-concept-coverage.mjs` (24 lessons, 98 concepts, zero untested, zero mistags) · `smoke.mjs` passed · **a11y re-run PASSED with axe-core 4.10 on system Chrome: 0 violations (total and serious) across all 6 states — initial load, 3 lessons, quiz in progress, mobile viewport** (run via local CHROME_PATH runner; Playwright browser download unavailable in this env, system Chrome 153 used instead; committed `tests/a11y.mjs` unchanged and CI-valid) · browser: 24 renders, 24 sampled quizzes at 100% correct-answer scoring, review mode, first-paint shuffle match on all 24, zero state leaks on cancel, zero prereq dangles. All 20 sign-off delta fixes audit-verified present in the tree (spec.crd + all-containers, ALFA fragment note, Enterprise-vs-OSS compile scoping, no_violations rule, tuple-lingering flip, Scope-gated multi-identity, error-not-false, comments/docs/logs strings, cancelQuiz reset, shuffled first-paint, null guards, DAG refinancing, recalibrated difficulties, qualified exits/bills, single-artifact rubrics, mirrored submission specs, Cedar prereq).

## 5. Material-improvements round + sign-off (2026-09-13)

**Shipped since §3:** 24 lessons (new: XACML/ALFA L10, OPA data-filtering L12, Gatekeeper L15, Conftest L16); 192-question banks (8/lesson, 5 sampled per attempt via quiz-system `sampleSize`/`activeCount`); Styra/Aserto/Warrant/Keto landscape; `lessons/` JSON mirror finished (schema-validated + drift-checked in CI, extraction determinism job); `scripts/check-concept-coverage.mjs` now also enforces bank ≥8 and sampleSize == 5.

**Sign-off deltas found (all fixed):** R1 — Gatekeeper template gained `spec.crd` + all-containers pattern; ALFA labeled fragment with bag-valued-time caveat; maskRule/SQL-shape scoped to Enterprise vs OSS AST; Conftest `no_violations` aggregation added + per-container note; OpenFGA dangling-tuple quiz flipped to Allow-until-deleted; PlainID multi-identity qualified by Scope flag; Cedar missing-attribute corrected to error/skip. R4 — stale 20-lesson strings fixed (comments, docs, logs); capstone q4 refs corrected; `cancelQuiz` full reset; first-paint renders shuffled order; null guards. R2/R3 — prereq DAG refinanced (CI before admission; XACML parallel); difficulties recalibrated (XACML/Conftest 2, filtering/Gatekeeper 4); landscape exits/bills qualified; rubrics rebuilt one-artifact-per-row with checkable verbs; data submission spec; Cedar added to capstone_api prereqs.

**Sign-off verification:** static gates green · coverage 24 lessons / 98 concepts, zero untested, zero mistags · browser: 24 renders, 24 sampled quizzes at 100% correct-answer scoring, review mode, first-paint shuffle match on all 24, zero state leaks on cancel, zero prereq dangles, zero JS errors (only by-design auth-config.json/favicon 404s). **Council sign-off: GRANTED (conditional on the owed a11y re-run with Playwright + axe-core). Playwright install fails in this environment (10-min timeout, no cached browsers) — run `npx playwright@1.47 install chromium && node tests/a11y.mjs` where network allows.**
**Council verdict:** Agree with direction, structure, and secure-default posture. Do not ship to learners until §3 is merged. No re-review of content accuracy needed after amendments; Reviewer 4 requests a re-run of `tests/a11y.mjs` only.
**Basis:** Independent review 2026-09-13 — `PBAC/course-data.js` (L1–5), `PBAC/practical-examples.js` (L6–20), `PBAC/pbac-animations.js`, `PBAC/main.js`, `PBAC/index.html`, `PBAC/tests/*`, `PBAC/scripts/*`, `PBAC/.github/workflows/ci.yml`, verified against GenAI/Quantum framework sources.
**Council:** R1 Staff Policy Engineer · R2 Curriculum Designer · R3 Enterprise Data Governance Lead · R4 Framework/QA Engineer

---

## 1. What the council agrees on (verified, no action)

- Secure-default posture throughout: `default allow := false`, Cedar permit+forbid/no-match-deny, OpenFGA no-path-deny, `failure_mode_allow: false` / `OPA_FAIL_OPEN=false` / deny-on-timeout, guardrail-AND, lockout fail-closed. The course never teaches a fail-open pattern as valid. (R1, hand-traced)
- Framework fidelity structurally sound: script load order, all 27 `getElementById` targets, all 20 lesson ids, zero dangling prereqs, 8/8 animation types implemented, quiz↔course contract intact, storage keys rebranded, `auth.js` byte-identical. (R4, vm load test)
- Curriculum skeleton sound: numbering 1–20 contiguous, all prerequisites resolve, 100/100 questions single-correct with 4 options, all concept tags ∈ lesson arrays, passingScore 60 reachable, fail-closed properly spiraled L1→L4→L7→L10→L15→L16. (R2, executed harness)
- Node gates green: `node --check` × 5, `validate-lessons.mjs` 20/20, `smoke.mjs` passed, real-browser run (20 renders, 20 quizzes, 8 anims, zero real console errors). (Prior session)

---

## 2. Verdicts by reviewer

| Reviewer | Lens | Verdict |
|---|---|---|
| R1 | Policy-engine accuracy | CONDITIONAL — 2 non-functional samples + 1 lesson/sim contradiction must be fixed |
| R2 | Pedagogy / assessment | CONDITIONAL — skeleton sound; measurement layer (tags, rubrics, time honesty) is not |
| R3 | Enterprise realism | CONDITIONAL — vendor-neutrality promise broken, compliance overstated, merge semantics oversimplified, probabilistic gates presented as deterministic |
| R4 | Framework fidelity | CONDITIONAL — sound structure, but a11y suite will fail CI on stale GenAI ids; user-facing rebrand misses |

Unanimous: **CONDITIONAL. Not REJECT.** No fail-open posture is taught anywhere.

---

## 3. Council amendments (all required before ship)

### P0 — Ship blockers (non-functional, failing CI, or wrong-by-construction)

- **A1 — Envoy Rego sample never allows (R1).** `practical-examples.js:282-295` references undefined `verified_claims`; both `allow` bodies are undefined → all-deny including the "Admin: everything" case. Fix: bind claims to the Envoy-forwarded input explicitly with a comment that OPA never verifies signatures, plus a missing-claims `deny_reason`.
- **A2 — Role-vocabulary parity lesson↔simulator (R1).** Lesson team pattern grants on `api-read`/`api-full`; simulator uses `admin`/`analyst` while displaying `api-full` text. A learner copying lesson code verbatim DENIES scenario 1 while the sim shows ALLOW. Fix: unify vocabulary and make displayed code exactly the evaluated code.
- **A3 — `opa eval -i` double-wraps input (R1).** Sample `input.json` nests under an `input` key, but `opa eval -i` loads the file AS the input document → rules see `input.input.*` → all deny in CI. Fix: show the unwrapped shape + one-line note (REST wraps, `eval -i` does not).
- **A4 — Immuta YAML fields illustrative, not API (R1+R3).** `actions.columnsTagged` is not a documented v2 field; tag targeting belongs in `circumstances`. DSL spelling `@hasTagsAsAttribute` plural unconfirmed (docs show singular). Fix: delete `columnsTagged`, keep tags in `circumstances`, label blocks "shape-illustrative — verify against Immuta 2026.1 policy API", confirm spelling, add the docs' performance warning on `@table` permutations.
- **A5 — Immuta merge semantics false absolute (R3).** "Grants OR / guardrails AND, always" is wrong for subscription ABAC (per-policy `Always Required`=AND vs `Share Responsibility`=OR) and non-ABAC conflicts (descending name order + owner override). Fix: state the real rules; add a quiz trap on `Always Required` + the rename hazard. Row-policy AND stays.
- **A6 — Cedar simulator ≠ lesson policy (R1).** `drawCedar` evaluates a generic owner-permit for VIEW; the lesson's permits are alice-only-view + owner-scoped-editPhoto. Fix: evaluate the two literal lesson policies + private-forbid-unless-owner, or relabel canvas as simplified illustration.
- **A7 — Public carve-out over-broad (R1).** `path[0] == "public"` with no method/suffix scoping allows PUT/DELETE under `/public/*`. Fix: narrow to GET + exact-path/second-segment allowlist, with a comment that every carve-out needs its own deny-test.
- **A8 — a11y suite will fail CI on stale GenAI ids (R4).** `tests/a11y.mjs:60,80,93-94,103` uses `aiCoursePlacementOffered` (overlay not suppressed) and `ai_introduction/practical_scikit/rag_vector_databases` (none exist; `showLesson` no-ops). Fix: `pbacCoursePlacementOffered` + real PBAC ids (e.g. `access_control_intro`, `rego_foundations`, `architecture_patterns`).
- **A9 — User-facing rebrand misses (R4).** Completion modal still says "AI & ML course" (`main.js:1162,1168,1172`); export filename `ai-course-progress-*.json` (`main.js:576`); fallback text `'AI Course'` (`main.js:932`). Fix: all to PBAC.
- **A10 — L14 q4/q5 concept mistags break adaptive mastery (R2).** Multi-identity question tagged `PDP Permit-Deny API`; generated-policy question tagged `Dynamic Groups`. Fix: add `Multi-Identity AND Semantics` + `Generated-Policy Verification` to L14 concepts and retag.

### P1 — Required pre-launch polish (correctness of claims, assessment validity)

- **A11 — Capstone rubrics unscoreable; estimates dishonest (R2+R3).** Both rubrics are five 4-point buckets in one paragraph with bundled artifacts (±4 reviewer noise = pass/fail on noise); 120 min is 3–5× low for the stated Definitions of Done. Fix: 5-row analytic rubrics (0/2/4 descriptors, one artifact per row, submission format specified); re-time to 480–720 min in milestones OR re-scope DoD; amend `docs/CONTENT_MODEL.md:16`. Add: inference-risk note, staged lockout procedure, native-parity artifact, rollback+comms runbook (R3).
- **A12 — Compliance claim rewrite (R3).** `course-data.js:540-541` ("ARE the evidence… almost for free") is necessary-but-not-sufficient for SOC2/ISO/HIPAA/GDPR/AI Act. Fix: "support CC6/CC7, A.5/A.8, §164.308/312, Art.5/25/32, logging/human-oversight — but do not alone satisfy them"; map control-by-control; name residual work.
- **A13 — Vendor-neutrality promise (R3).** `course-data.js:553` claims every platform lesson names lock-in/bill/exit; only Cedar does. Fix: delete the universal claim OR add Lock-in/Bill/Exit boxes to Immuta + PlainID lessons (SaaS coupling, per-decision/per-compute cost, tag/template portability, native-code drift, export path). State documented vs estimated.
- **A14 — PlainID corrections (R3).** Delete the "Restrict needs Allow counterpart" Cedar analogy (undocumented); state documented Allow/Restrict semantics + Restrict-only scope testing. Fix WHO explanation AND→OR (≥1 Identity/Agent/Control AND ≥1 WHAT). Document multi-identity as Scope-gated (disabled by default, max 3 templates, >3 = error) with a lab toggle showing default-mode behavior. Add PDP API-selection table (Permit-Deny vs Resolution vs User Access Token staleness vs unavailable-source limits); cite-or-mark the V5 assertion.

### P2 — Accepted with follow-ups (may ship, track as issues)

- **A15 — Assessment hygiene (R2):** rewrite L5 q4 to L5-only content (dedup vs L2 q5); retag-or-drop the 25 never-assessed concepts (starting L7 `Cross-Tenant Deny Tests`, L20 `Global Masking`/`Exception Groups`, L17 `Strangler Pattern`); replace cited joke distractors with misconception-based ones; fix difficulty dips (L8→3; note L5 d1 intentional); retag L4 q3/q5 to `Regression Tests`; re-time L7→90 min, L1/L3→30–35 min (or publish the time model).
- **A16 — Prereq DAG (R2):** `capstone_data` ← `immuta_policies` + `testing_verification`; `capstone_api` ← `testing_verification` + `openfga_production`; L18 co-requisite only for agent extensions. Linearity is a loader convenience, not a curriculum argument.
- **A17 — Small engine-accuracy items (R1):** OpenFGA CLI `--model-id` on tuple/check; reword contextual-tuple playground limitation precisely (time/IP gating needs conditions + context); annotate Cedar request/schema JSON as shape-illustrative with CLI-version pin; remove stray `}` in `pbac-animations.js:280`.
- **A18 — Framework cleanups (R4):** stale T5.3 comment (`main.js:75-78`); smoke comment (`smoke.mjs:8`) + extend §3 to merged lesson map; vm shims `aiLab*`→`pbacCopy`; `roundRect` guard in `box()` (Safari <16 standalone); comment-or-delete dead `mountInteractiveLabs` guard (`main.js:774-776`); remove or `.gitkeep` empty `lessons/`.
- **A19 — Migration realism (R3):** tolerance-based exit (diff < threshold with risk-accepted exceptions, sampled prod inputs, per-route rollback rehearsal); inventory out-of-scope enforcement (procedures/BI/grants); redacted shadow logs; outbox (not XA) for tuples; freeze/audit sign-off; attribute-source cleanup.
- **A20 — AI-agent enforcement limits box (R3):** categorizer probabilistic (paraphrase/injection bypass; single-identity-per-request per docs) → allowlist categories + adversarial set + human approval for high-risk tools; retrieval≠output filtering; anonymization ≠ de-identification; TOCTOU sessions; composed-allowed-action leaks; PDP-per-call latency/cost/availability; `skipUnneededOrUnavailableIdentitySources` warning.

## 4. References

- Course: `PBAC/course-data.js`, `PBAC/practical-examples.js`, `PBAC/pbac-animations.js`, `PBAC/main.js`, `PBAC/index.html`, `PBAC/docs/lesson.schema.json`
- Framework sources: `GenAI/` (shell, quiz, controller, CI), `Quantum/quantum-course/` (prior generation)
- Docs reviewed Sept 2026: OPA (openpolicyagent.org), Cedar (cedarpolicy.com), OpenFGA (openfga.dev), Immuta 2026.1, PlainID docs; GitHub: rest-rego, OPA+Keycloak, OPA RBAC demos, zero-trust gatekeeper, Envoy+OPA gateway, JWT+OPA guide
