# Policy-Based Access Control Course

An interactive, browser-based PBAC course covering authorization foundations, OPA/Rego, Cedar, OpenFGA, XACML/ALFA, Immuta, PlainID, K8s admission, CI policy gates, data filtering, enforcement architecture, and two build-and-defend capstones. Same framework as the GenAI and Quantum courses (static shell + adaptive quizzes + canvas Policy Lab); 24 lessons; 192-question bank (8 per lesson, 5 sampled per attempt); 2 capstone projects with rubrics.

> **Status:** 24 lessons across 5 levels, 192 quiz questions in banks (8 per lesson, 5 sampled per attempt, shuffled with review mode), 2 capstones with rubrics, 8 Policy Lab visualizers. Every vendor example critically reviewed against official docs (Sept 2026) plus real-world GitHub repos.

## Course Overview

### Learning Path

**Level 1: Foundations** (Beginner)
1. Why Authorization Fails (AuthN vs AuthZ, BOLA, fail-closed)
2. RBAC vs ABAC vs PBAC vs ReBAC
3. Anatomy of a Policy Decision (PEP/PDP/PIP/PAP)
4. Default-Deny and Testing
5. The Business Case for PBAC

**Level 2: Policy Languages** (Intermediate)
6. Rego Foundations (package/input/data, default-deny)
7. Rego for API Authorization (teams, tenants, JWT boundary)
8. Cedar Foundations (permit/forbid, when/unless)
9. OpenFGA Foundations (tuples, DSL, check)
10. XACML and ALFA (targets, combining algorithms, obligations)

**Level 3: Platforms in Production** (Advanced)
11. OPA in Production (bundles, data injection, decision API)
12. OPA Data Filtering (partial evaluation to SQL)
13. Cedar in Production (schemas, templates, Verified Permissions)
14. OpenFGA in Production (model API, contextual tuples, list-objects)
15. K8s Admission with Gatekeeper (templates, constraints, dry-run)
16. Policy in CI with Conftest (deny rules, exceptions, shift-left)
17. Immuta Data Policies (subscription vs data, masking, guardrails)
18. PlainID Enterprise Policies (WHO/WHAT/WHEN, PDP APIs)

**Level 4: Architecture & Operations** (Expert)
19. Enforcement Architecture (sidecar/gateway/middleware)
20. Testing and Verification (suites, diffs, CI gates)
21. Migrating RBAC to PBAC (strangler pattern)

**Level 5: Frontier & Capstones** (Research)
22. Authorizing AI Agents (3-gate LangChain pattern)
23. Capstone: Secure an API Estate (with rubric)
24. Capstone: Govern the Data Plane (with rubric)

## Features

- **Adaptive Quizzes**: 5 questions per lesson, 60% pass threshold, shuffled order, end-of-quiz Review mode.
- **Policy Lab**: 8 canvas visualizers — decision stepper, model comparison, default-deny sim, Rego/Cedar/OpenFGA simulators, masking sim, pattern board.
- **Critically reviewed examples**: each code sample stamped with source + verification date (OPA/Cedar/OpenFGA/Immuta/PlainID docs, rest-rego, OPA+Keycloak, Envoy+OPA repos).
- **Progress**: localStorage + export/import + optional Supabase sync (same `auth.js` as GenAI course).

## File Structure

```
PBAC/
├── index.html              # Course shell (PBAC branding)
├── styles.css              # Theme (shared with GenAI course)
├── pbac-animations.js      # 8 Policy Lab visualizers
├── quiz-system.js          # Adaptive quiz with shuffle + review mode
├── course-data.js          # Foundations lessons (1-5)
├── practical-examples.js   # Languages, platforms, architecture, capstones (6-24)
├── main.js                 # Course controller (PBAC-branded storage keys)
├── auth.js                 # Optional Supabase sync
├── docs/                   # CONTENT_MODEL.md + lesson.schema.json + COUNCIL_REVIEW.md
├── lessons/                # JSON mirror of all 24 lessons (extracted, schema-validated, drift-checked in CI)
├── scripts/                # validate-lessons (+JSON mirror), extract-lessons, check-concept-coverage, lint-version-pinning
└── tests/                  # smoke.mjs + a11y.mjs
```

## Getting Started

1. Serve over HTTP (lesson partials aside, everything is static): `python3 -m http.server 8765` then open `http://localhost:8765/index.html`.
2. Navigate via the sidebar (☰ on mobile), run Policy Lab scenarios, take each knowledge check (60% to advance).
3. Validate changes: `node --check *.js && node scripts/validate-lessons.mjs && node tests/smoke.mjs`.

## Sources reviewed (Sept 2026)

OPA docs (openpolicyagent.org) · Cedar docs (cedarpolicy.com) · OpenFGA docs (openfga.dev) · Immuta docs 2026.1 · PlainID docs · GitHub: AB-Lindex/rest-rego, mouton0815/authorization-with-open-policy-agent, saonam/opa-rbac, dSofikitis/zerotrust-gatekeeper, Envoy+OPA payments gateway write-up, OPA+Keycloak one-sheet, Hoop.dev JWT+OPA guide, purnima-jain/opa-access-control-rest-api.
