# Content Model

This document defines the shape of a *lesson* in the Policy-Based Access Control Course. It maps directly to entries under `COURSE_DATA.levels.<level>.lessons.<id>` in `course-data.js` (Lessons 1-5, Foundations) and `practical-examples.js` (Lessons 6-24), and is formalized as JSON Schema in **`docs/lesson.schema.json`**.

Framework note: this course reuses the GenAI/Quantum course shell (`index.html` + `styles.css` + `quiz-system.js` + `main.js`) unchanged except branding. Only the curriculum files, the animation engine (`pbac-animations.js`), and the docs differ.

## The lesson shape

| Field | Type | Notes |
|-------|------|-------|
| `id` | string (snake_case) | Unique across the course; e.g. `rego_foundations`. |
| `title` | string | Short display title in the sidebar. |
| `subtitle` | string | Tagline shown beneath the title. |
| `level` | enum | `beginner \| intermediate \| advanced \| expert \| research`. Must match the key the lesson is filed under. |
| `number` | integer | Sequential 1..N across the whole course, no gaps (currently 1..24). |
| `estimatedTime` | integer (minutes) | Be honest. Standard lessons 30–90. Capstones are 480 across sessions with M1/M2/M3 milestones (see Lessons 23–24). |
| `difficulty` | integer 1-5 | 1 = gentle intro, 5 = capstone. Display only. Note: L5 (business case) is intentionally d1 — non-technical synthesis after technical L2–L4, not a dip. |
| `prerequisites` | string[] | Lesson IDs that must be completed first. Empty = always open. |
| `unlocked` | boolean (optional) | False by default (gated by prereqs). True = always unlocked. |
| `content` | string (HTML) | Body rendered inside `.lesson-container`. Use `<div class="lesson-section">` blocks. |
| `concepts` | string[] | Tags the lesson covers. Adaptive reinforcement looks for these. |
| `quiz` | object | See below. |
| `animation` | object | See below. |

## Shape of `quiz`

Question **banks of 8** per lesson with exactly 4 options each, exactly one `isCorrect: true`. Each attempt samples `sampleSize: 5`, so `passingScore: 60` stays on the reachable 0/20/40/60/80/100 ladder and memorization by order fails. Every question needs an `explanation` (shown in Review mode) and a `concept` tag from the lesson's `concepts` — and every concept must be tagged by at least one question (`scripts/check-concept-coverage.mjs` enforces both directions in CI). Question and option order are shuffled at runtime by `quiz-system.js`.

## Shape of `animation`

```
{
  type: one of (see below),
  title: string,
  description: string,
  controls: string[]   // handler names on window.animations
}
```

### Implemented animation types (`pbac-animations.js`)

- `policy-flow` — 7-step PEP→PDP→PIP decision stepper
- `rbac-abac-compare` — same request across RBAC/ABAC/PBAC/ReBAC
- `default-deny-sim` — scenario verdicts with default-deny toggle
- `rego-playground` — Rego team/tenant rule simulator
- `cedar-sim` — Cedar permit/forbid interaction
- `openfga-graph` — check() path-finding scenarios
- `data-masking-sim` — Immuta-style masking per role
- `auth-patterns` — sidecar vs gateway vs middleware

## Helpers (practical-examples.js only)

- `createCodeBlock(code, language, caption)` — copy-button code block. Every sample carries a `# Last verified: YYYY-MM` stamp naming the source it was reviewed against.
- `renderPolicyLab(hint)` — callout box pointing at the Policy Lab panel.
- `POLICY_GUIDES` — pinned install/verify commands for OPA, Cedar, OpenFGA.

`course-data.js` (Lessons 1-5) uses plain HTML only — no helpers — because it loads before `practical-examples.js` defines them.

## How to add a new lesson

1. Decide `number`/`level`; renumber subsequent lessons (no gaps 1..N).
2. Write the object in the right file; match the schema; pin versions; stamp `Last verified`.
3. Write an 8-question bank, `passingScore: 60`, `sampleSize: 5`, concept tags from `lesson.concepts` — every concept must be tagged by at least one question.
4. Wire `prerequisites`; verify: `node --check`, `node scripts/validate-lessons.mjs`, `node scripts/check-concept-coverage.mjs`, `node tests/smoke.mjs`.
5. Re-run `node scripts/extract-lessons.mjs` and commit the refreshed `lessons/` mirror.

## The JSON mirror (`lessons/`)

Every lesson is mirrored to `lessons/<level>/<id>.json` by `scripts/extract-lessons.mjs`. The mirror is schema-validated and drift-checked against the JS source by `scripts/validate-lessons.mjs` in CI — hand-editing JSON without updating JS (or vice versa) fails the build. The runtime loader still reads inline JS (fetch-based loading would break `file://` usage); the mirror exists for audits, diffs, and non-developer review.
