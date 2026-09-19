// PBAC Training Course - Policy Languages, Platforms & Capstones (Lessons 6-24)
// =================================================================================
// Hands-on OPA/Rego, Cedar, OpenFGA, Immuta, and PlainID with production guidance.
// All vendor examples were critically reviewed against official docs (Sept 2026):
// OPA docs (openpolicyagent.org), Cedar docs (cedarpolicy.com), OpenFGA docs
// (openfga.dev), Immuta docs (2026.1), PlainID docs, plus real-world GitHub repos
// (rest-rego sidecar, OPA+Keycloak middleware, Envoy+OPA payments gateway).

// Check if COURSE_DATA exists
if (typeof COURSE_DATA === 'undefined') {
    console.error('ERROR: COURSE_DATA not loaded. Please load course-data.js first.');
} else {

    // =========================================================================
    // UTILITY: Create code block with copy button + verification stamp
    // =========================================================================
    let __codeBlockCounter = 0;
    function createCodeBlock(code, language = 'rego', caption = '') {
        const id = 'pbac-cb-' + (++__codeBlockCounter);
        const escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `
            <div class="code-example" style="margin: 1rem 0; border-left: 4px solid var(--ai-purple);" data-code-id="${id}">
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.25rem 0.5rem; background: var(--surface-light); border-radius: 4px 4px 0 0;">
                    <span style="font-size: 0.8rem; color: var(--text-muted);">${caption}</span>
                    <button class="btn-small" onclick="pbacCopy('${id}')" aria-label="Copy code" style="padding: 0.15rem 0.4rem; font-size: 0.75rem; background: var(--surface-color); color: var(--text-secondary); border: 1px solid var(--border-color); border-radius: 4px; cursor: pointer;">📋 Copy</button>
                </div>
                <pre style="margin: 0; padding: 1rem; background: var(--code-bg); border-radius: 0 4px 4px 0; overflow-x: auto; font-size: 0.85rem;" tabindex="0" role="region" aria-label="Code block"><code class="language-${language}">${escaped}</code></pre>
                <div id="${id}" class="code-source" style="display:none;">${escaped}</div>
            </div>
        `;
    }

    function __pbacGetCode(id) {
        const el = document.getElementById(id);
        if (!el) return '';
        return el.textContent;
    }
    async function pbacCopy(id) {
        const code = __pbacGetCode(id);
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code);
            const btn = Array.from(document.querySelectorAll(`[data-code-id="${id}"] button[onclick*="pbacCopy"]`)).pop();
            if (btn) { const txt = btn.textContent; btn.textContent = '✓ Copied'; setTimeout(() => { btn.textContent = txt; }, 1500); }
        } catch (e) {
            console.warn('Clipboard write failed; copy manually', e);
        }
    }
    window.pbacCopy = pbacCopy;

    function renderPolicyLab(hint) {
        return `
            <div class="lesson-section" style="background: rgba(139, 92, 246, 0.08); border-left: 4px solid var(--ai-purple); padding: 0.75rem 1rem; border-radius: 4px;">
                <strong>🎮 Try it in the Policy Lab →</strong> ${hint} Use the controls under the canvas to switch scenarios and watch the verdict change.
            </div>
        `;
    }

    // =========================================================================
    // PLATFORM SETUP GUIDES (version-pinned, last verified 2026-09)
    // =========================================================================
    const POLICY_GUIDES = {
        opa: {
            name: 'Open Policy Agent',
            description: 'General-purpose policy engine (APIs, K8s, CI)',
            installation: 'curl -L -o opa https://openpolicyagent.org/downloads/v1.8.0/opa_darwin_arm64 && chmod +x opa',
            helloWorld: 'opa version  # expect 1.x; opa run --server ./policies'
        },
        cedar: {
            name: 'Cedar / Amazon Verified Permissions',
            description: 'App-focused language + managed PDP',
            installation: 'cargo install cedar-policy-cli --version 4.11.2  # or: npm install -g @cedar-policy/cli@4.11.2 (verified 2026-09)',
            helloWorld: 'cedar authorize --policies policies.cedar --entities entities.json --request request.json'
        },
        openfga: {
            name: 'OpenFGA',
            description: 'Zanzibar-style relationship engine',
            installation: 'docker run -p 8080:8080 openfga/openfga:v1.9.0 run',
            helloWorld: 'fga model write --store-id $STORE --file model.fga && fga tuple write ...'
        }
    };

    // =========================================================================
    // LESSON 6: Rego Foundations
    // =========================================================================
    COURSE_DATA.levels.intermediate.lessons.rego_foundations = {
        id: "rego_foundations",
        title: "Rego Foundations",
        subtitle: "Packages, default-deny, allow-if, input vs data",
        level: "intermediate",
        number: 6,
        estimatedTime: 60,
        difficulty: 2,
        prerequisites: ["pbac_business_case"],

        content: `
            <div class="lesson-section">
                <h3>📦 Package, Input, Data: The Three Namespaces</h3>
                <p>A Rego policy declares a <strong>package</strong> (its API path: <code>package demo</code> → <code>/v1/data/demo</code>), reads the per-request <strong>input</strong> document, and reads slowly-changing <strong>data</strong> (roles, team memberships) loaded separately. Rules define <code>allow</code>; anything undefined is denied when you set the default.</p>
                ${createCodeBlock(`# Last verified: 2026-09 against OPA docs + rest-rego sidecar pattern
package policies

# Deny by default (fail-closed). NEVER default allow := true.
default allow := false

# Allow listed applications (JWT claim from the sidecar input)
allow if {
    input.jwt.appid == "11112222-3333-4444-5555-666677778888"
}

# Allow based on roles
allow if {
    "admin" in input.jwt.roles
}

# Allow public endpoints without auth context.
# Narrow by design: GET only, exact allowlisted paths. A bare
# path[0] == "public" check would also allow PUT/DELETE under /public/*
# (including future non-idempotent endpoints) — every carve-out gets
# its own deny-test (Lesson 20).
allow if {
    input.request.method == "GET"
    input.request.path in [["public", "health"], ["public", "version"]]
}`, 'rego', 'Rego 1.x: canonical sidecar shape (default-deny + three allow rules)')}
            </div>

            <div class="lesson-section">
                <h3>🔑 Critical Review: What the Docs and Repos Agree On</h3>
                <ul>
                    <li><strong>OPA official docs:</strong> <code>default allow := false</code> is the documented deny-by-default idiom; without it a missing field yields <em>undefined</em>, which most integrations treat as deny — but explicit false is auditable and testable.</li>
                    <li><strong>rest-rego (GitHub):</strong> production sidecar uses exactly this shape — package policies, <code>input.jwt.*</code> claims, public-path carve-out, hot reload, <code>&lt;5ms</code> overhead. Our example mirrors its <code>policies/request.rego</code>.</li>
                    <li><strong>Rego 1.x note:</strong> modern syntax is <code>allow if { ... }</code> (no <code>= true</code> needed). Older <code>allow { ... }</code> still parses but the <code>if</code> keyword is current.</li>
                </ul>
            </div>

            <div class="lesson-section">
                <h3>🧪 Evaluate Locally (No Server)</h3>
                ${createCodeBlock(`# Score one decision file against policy, like CI does:
opa eval -i input.json -d request.rego 'data.policies.allow'

# NOTE the shape difference: the REST decision API wraps the runtime
# request under an "input" key ({"input": {...}}), but 'opa eval -i'
# loads the file AS the input document itself — no wrapper. Wrapping
# here would make rules see input.input.* and deny everything in CI
# while the playground (which wraps) still allows.
{ "jwt": { "appid": "11112222-3333-4444-5555-666677778888",
           "roles": ["viewer"] },
  "request": { "method": "GET", "path": ["public", "health"] } }
# expect: { "result": [{ "expressions": [{ "value": true }] }] }`, 'bash', 'OPA eval: the unit-test loop for policy')}
            </div>

            <div class="lesson-section">
                <h3>⚠️ Beginner Traps</h3>
                <ul>
                    <li><strong>Undefined ≠ false:</strong> without a default, a typo'd field name silently denies. Good for security, miserable for debugging — add <code>deny_reason</code> helpers (Lesson 11).</li>
                    <li><strong><code>in</code> needs Rego 1.x / future.keywords import on old OPA:</strong> pin your OPA version in CI (Lesson 20).</li>
                    <li><strong>Input shape is a contract:</strong> document it; the PEP and the policy must agree, or rules silently miss.</li>
                </ul>
            </div>
            ${renderPolicyLab('Pick the three Rego scenarios and confirm which allow-rule (if any) fires.')}
        `,

        concepts: ["Rego Package", "Input vs Data", "Default Deny in Rego", "Allow-if Rules", "OPA Eval"],

        quiz: {
            id: "rego_found_quiz",
            title: "Rego Foundations Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 420,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "What does default allow := false do in a Rego policy?",
                    options: [
                        { text: "Makes unmatched requests evaluate to false (deny) instead of undefined", isCorrect: true },
                        { text: "Blocks all requests permanently", isCorrect: false },
                        { text: "Speeds up policy evaluation", isCorrect: false },
                        { text: "Encrypts the input document", isCorrect: false }
                    ],
                    explanation: "OPA docs prescribe default for deny-by-default: explicit false is auditable and testable, vs undefined which integrations merely coerce to deny.",
                    difficulty: 1, concept: "Default Deny in Rego"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "package policies in request.rego maps to which OPA API path?",
                    options: [
                        { text: "/v1/data/policies (dots become slashes)", isCorrect: true },
                        { text: "/v1/policies/request.rego", isCorrect: false },
                        { text: "/policies/request", isCorrect: false },
                        { text: "There is no mapping; packages are comments", isCorrect: false }
                    ],
                    explanation: "OPA converts the package path to the data API path — the convention the REST-demo repos rely on when POSTing decisions.",
                    difficulty: 1, concept: "Rego Package"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "Where do per-request JWT claims belong, vs role tables?",
                    options: [
                        { text: "Claims in input (per request); role tables in data (loaded separately, updated via API)", isCorrect: true },
                        { text: "Both hard-coded in the Rego file", isCorrect: false },
                        { text: "Both in environment variables", isCorrect: false },
                        { text: "Claims in data, role tables in input", isCorrect: false }
                    ],
                    explanation: "input = dynamic per-request; data = slowly-changing context injected via /v1/data PUT/PATCH. Mixing them up breaks caching and hot updates.",
                    difficulty: 2, concept: "Input vs Data"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "A request from an unknown appid to /private/report gets allow=true. First suspect?",
                    options: [
                        { text: "A fail-open default (default allow := true) or an over-broad allow rule", isCorrect: true },
                        { text: "The JWT signature algorithm", isCorrect: false },
                        { text: "The JWT expiry timestamp (an authN fact, not the authZ decision)", isCorrect: false },
                        { text: "The number of allow rules in the file (more rules do not mean safer)", isCorrect: false }
                    ],
                    explanation: "Unexpected allows trace to the default or to a rule matching more than intended (e.g. path[0] checks without method checks). Deny-tests catch both.",
                    difficulty: 2, concept: "Allow-if Rules"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "How do you unit-test a Rego rule without running a server?",
                    options: [
                        { text: "opa eval -i input.json -d policy.rego 'data.<pkg>.allow'", isCorrect: true },
                        { text: "You cannot; a server is mandatory", isCorrect: false },
                        { text: "By opening the file in a browser", isCorrect: false },
                        { text: "By POSTing {\"input\": {...}} wrapped to opa eval -i", isCorrect: false }
                    ],
                    explanation: "opa eval is the documented fast loop and the basis of opa test suites in CI (Lesson 20).",
                    difficulty: 1, concept: "OPA Eval"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "Two teams deploy packages both named acme.payments. What breaks?",
                                options: [
                                    { text: "Bundle collision — identical data-API paths; namespace packages per team/service", isCorrect: true },
                                    { text: "Nothing — OPA merges same-named packages safely", isCorrect: false },
                                    { text: "JWTs stop verifying cluster-wide", isCorrect: false },
                                    { text: "Nothing — OPA merges same-named packages safely", isCorrect: false },
                                ],
                                explanation: "Package names are API paths. Collisions silently merge or shadow rules — namespace like code.",
                                difficulty: 1, concept: "Rego Package"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "Group membership changes must take effect within a minute, with no redeploy. Where does membership live?",
                                options: [
                                    { text: "In data (PUT/PATCH at runtime); policy reads it, bundle untouched", isCorrect: true },
                                    { text: "Hard-coded in the Rego file", isCorrect: false },
                                    { text: "Compiled into the OPA binary", isCorrect: false },
                                    { text: "In input alongside per-request JWT claims", isCorrect: false }
                                ],
                                explanation: "Input/data separation exists for exactly this: fast-moving facts ride in data, slow-moving logic in versioned policy.",
                                difficulty: 2, concept: "Input vs Data"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "opa eval returns undefined for data.policies.allow on a request you expect allowed. First check?",
                                options: [
                                    { text: "No rule body matched the input (or default missing) — print the input, diff against rule conditions", isCorrect: true },
                                    { text: "Reinstall OPA", isCorrect: false },
                                    { text: "Increase the timeout", isCorrect: false },
                                    { text: "Add more allow rules blindly", isCorrect: false }
                                ],
                                explanation: "Undefined means unmatched, not broken. Debugging starts with the input document, not the engine.",
                                difficulty: 2, concept: "OPA Eval"
                            }
                        ]
                    },
        animation: {
            type: "rego-playground",
            title: "Rego Rule Simulator",
            description: "Three requests against team/admin rules; see which rule fires",
            controls: ["setRegoScenario"]
        }
    };

    // =========================================================================
    // LESSON 7: Rego for API Authorization
    // =========================================================================
    COURSE_DATA.levels.intermediate.lessons.rego_api_authz = {
        id: "rego_api_authz",
        title: "Rego for API Authorization",
        subtitle: "JWT claims, team scoping, tenant isolation",
        level: "intermediate",
        number: 7,
        estimatedTime: 90,
        difficulty: 3,
        prerequisites: ["rego_foundations"],

        content: `
            <div class="lesson-section">
                <h3>👥 Team-Scoped Access (Reviewed Pattern)</h3>
                <p>The most-copied real-world Rego shape (Keycloak+OPA demo repos): members of a team get read+write on <em>only that team's</em> objects, derived from the URL, plus role-wide read and full-admin grants. Critically reviewed: the <code>concat(["Team", id])</code> derivation ties the URL to the group claim, closing IDOR by construction.</p>
                ${createCodeBlock(`# Last verified: 2026-09 vs mouton0815/authorization-with-OPA demo-rules.rego
package demo

default allow := false

# Members of a team have read+write on ONLY that team's data
allow if {
    input.method in {"GET", "PUT"}
    teamId := trim_prefix(input.path, "/teams/")
    teamName := concat("", ["Team", teamId])
    teamName in input.groups
}

# Users with "api-read" rights can read all endpoints
allow if {
    input.method == "GET"
    "api-read" in input.roles
}

# Users with "api-full" rights have full access
allow if {
    "api-full" in input.roles
}`, 'rego', 'Team scoping + role grants (Rego 1.x if-syntax)')}
            </div>

            <div class="lesson-section">
                <h3>🏢 Tenant Isolation at the Gateway (Reviewed Pattern)</h3>
                <p>The Envoy+OPA payments-gateway pattern separates duties: Envoy validates the JWT (issuer, audience, expiry) and forwards claims; OPA authorizes. Admins pass everywhere; analysts only <code>GET</code> inside their own tenant, compared case-insensitively against the request header.</p>
                ${createCodeBlock(`# Last verified: 2026-09 vs Envoy+OPA payments_authz (justinpolidori.com)
package envoy.authz

default allow := false

# Claims arrive via input.jwt_claims, populated by Envoy's jwt_authn
# filter AFTER RS256/exp/aud verification. OPA never verifies
# signatures itself — trusting unverified claims is a critical finding.
verified_claims := input.jwt_claims

# Admin: everything
allow if {
    verified_claims.role == "admin"
}

# Analyst: GET /payments/* only within own tenant
allow if {
    verified_claims.role == "analyst"
    input.attributes.request.http.method == "GET"
    input.parsed_path[0] == "payments"
    lower(verified_claims.tenant) == lower(input.attributes.request.http.headers["x-tenant"])
}

# Debug/audit helper: name the cause when nothing matches
deny_reason contains msg if {
    not allow
    not verified_claims.role
    msg := "denied: no verified JWT claims in input (authN did not run?)"
}`, 'rego', 'Tenant isolation: JWT claim vs request header')}
            </div>

            <div class="lesson-section">
                <h3>🔍 Critical Review Notes (Do Not Skip)</h3>
                <ul>
                    <li><strong>OPA does not verify JWT signatures by itself</strong> — the Hoop.dev JWT+OPA guide and the Envoy pattern agree: fetch JWKS, pin RS256 (never <code>none</code>), check <code>exp/nbf</code> <em>before</em> claims are trusted. Our gateway example delegates this to Envoy.</li>
                    <li><strong><code>failure_mode_allow: false</code></strong> on the ext_authz filter: if OPA is down or slow (&gt;200ms), deny. The reviewed config sets this explicitly.</li>
                    <li><strong>Every reviewed repo pins the cross-tenant deny-test</strong> (<code>test_analyst_denied_other_tenant</code>). Copy that test into your suite verbatim, adapted to your paths.</li>
                </ul>
            </div>

            <div class="lesson-section">
                <h3>📨 The Input Contract (Keycloak-middleware shape)</h3>
                ${createCodeBlock(`{ "input": {
    "user": { "user_id": "u-2", "roles": ["analyst"],
              "tenant_id": "t1", "auth_source": "keycloak" },
    "action": "payments:read",
    "resource": { "type": "payment", "id": "123", "tenant_id": "t1" } } }`, 'json', 'Canonical authZ input: user, action (resource:verb), resource')}
            </div>
            ${renderPolicyLab('Run the analyst/admin scenarios and watch tenant mismatch deny.')}
        `,

        concepts: ["Team Scoping Derivation", "JWT Verification Boundary", "Fail-Closed Gateway", "AuthZ Input Contract", "Cross-Tenant Deny Tests"],

        quiz: {
            id: "rego_api_quiz",
            title: "Rego API Authorization Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 480,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "PUT /teams/123 from bob (groups: [Team123]) — which rule allows it in the team pattern?",
                    options: [
                        { text: "Team-membership rule: Team+123 derived from URL is in bob's groups", isCorrect: true },
                        { text: "The api-read rule", isCorrect: false },
                        { text: "The public-endpoint rule", isCorrect: false },
                        { text: "No rule — it denies", isCorrect: false }
                    ],
                    explanation: "trim_prefix + concat derive Team123 from the path; membership grants GET/PUT on that team only. Eve (Team999) is denied by the same rule.",
                    difficulty: 2, concept: "Team Scoping Derivation"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "Analyst (tenant t1) GETs /payments/123 with x-tenant: t2. Verdict in the gateway pattern?",
                    options: [
                        { text: "DENY — claim tenant must equal request tenant", isCorrect: true },
                        { text: "ALLOW — analysts read all tenants", isCorrect: false },
                        { text: "ALLOW — GET is always safe", isCorrect: false },
                        { text: "TIMEOUT — the policy cannot decide", isCorrect: false }
                    ],
                    explanation: "The reviewed gateway pins exactly this deny-test. Tenant equality is the load-bearing comparison — keep it as a named regression test forever.",
                    difficulty: 2, concept: "Cross-Tenant Deny Tests"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "Who verifies the JWT signature in the Envoy+OPA pattern?",
                    options: [
                        { text: "Envoy (jwt_authn filter: issuer, audience, expiry) before OPA ever sees claims", isCorrect: true },
                        { text: "OPA verifies signatures natively with no keys", isCorrect: false },
                        { text: "The browser verifies its own token", isCorrect: false },
                        { text: "Nobody — signatures are optional", isCorrect: false }
                    ],
                    explanation: "Authenticate first (Envoy), authorize second (OPA). OPA evaluates claims it is handed; trusting unverified claims is a critical finding.",
                    difficulty: 2, concept: "JWT Verification Boundary"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "OPA is unreachable (gateway timeout 200ms). Correct behavior?",
                    options: [
                        { text: "Deny (failure_mode_allow: false) and alert", isCorrect: true },
                        { text: "Allow to preserve availability", isCorrect: false },
                        { text: "Retry for 30 seconds holding the connection", isCorrect: false },
                        { text: "Allow GETs, deny POSTs", isCorrect: false }
                    ],
                    explanation: "The reviewed Envoy config fails closed explicitly. Fail-open on PDP outage is a breach-shaped setting.",
                    difficulty: 1, concept: "Fail-Closed Gateway"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "Why use resource:action strings (payments:read) in the input contract?",
                    options: [
                        { text: "One stable vocabulary: the PEP maps routes once, the PDP rules stay route-free and testable", isCorrect: true },
                        { text: "They run faster than plain strings", isCorrect: false },
                        { text: "OPA requires the colon character", isCorrect: false },
                        { text: "They encrypt the permission", isCorrect: false }
                    ],
                    explanation: "Route→permission mapping lives in middleware (Keycloak-middleware RULES table); policy reasons about permissions, so URL refactors never silently change access.",
                    difficulty: 2, concept: "AuthZ Input Contract"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "Teams rename groups from Team123 to Squad123. What breaks in the trim_prefix/concat pattern?",
                                options: [
                                    { text: "Derivation mismatches claims until code or claims update — derivation is a contract, version it", isCorrect: true },
                                    { text: "Nothing — Rego auto-detects renames", isCorrect: false },
                                    { text: "Only the UI labels", isCorrect: false },
                                    { text: "JWT signatures invalidate", isCorrect: false }
                                ],
                                explanation: "String derivation bakes naming into policy. Renames are migrations: update claims and code together, with tests.",
                                difficulty: 3, concept: "Team Scoping Derivation"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "A service passes the raw Authorization header to OPA as input and enforces allow. What's missing?",
                                options: [
                                    { text: "Signature/expiry/audience verification before OPA — OPA evaluates claims, never authenticates them", isCorrect: true },
                                    { text: "Base64 decoding of the token", isCorrect: false },
                                    { text: "A bigger server", isCorrect: false },
                                    { text: "More verbose logs", isCorrect: false }
                                ],
                                explanation: "The JWT boundary: Envoy/sidecar verifies, OPA authorizes. Enforcing on unverified claims is authentication theater.",
                                difficulty: 2, concept: "JWT Verification Boundary"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "Two PEPs send tenancy as tenant_id vs tenant. Consequence?",
                                options: [
                                    { text: "One PEP's rules silently miss — standardize the contract and test both shapes deny safely", isCorrect: true },
                                    { text: "OPA merges the spellings automatically", isCorrect: false },
                                    { text: "Faster evaluation", isCorrect: false },
                                    { text: "Nothing — field names are cosmetic", isCorrect: false }
                                ],
                                explanation: "Contract drift is silent rule-miss. One vocabulary, schema-checked, with property tests for unknown fields.",
                                difficulty: 2, concept: "AuthZ Input Contract"
                            }
                        ]
                    },
        animation: {
            type: "rego-playground",
            title: "API AuthZ Simulator",
            description: "Admin, team-member, and stranger requests against the team pattern",
            controls: ["setRegoScenario"]
        }
    };

    // =========================================================================
    // LESSON 8: Cedar Foundations
    // =========================================================================
    COURSE_DATA.levels.intermediate.lessons.cedar_foundations = {
        id: "cedar_foundations",
        title: "Cedar Foundations",
        subtitle: "Permit, forbid, and the request shape",
        level: "intermediate",
        number: 8,
        estimatedTime: 60,
        difficulty: 3,
        prerequisites: ["rego_api_authz"],

        content: `
            <div class="lesson-section">
                <h3>✅ Permit, ⛔ Forbid, 🤷 Default Deny</h3>
                <p>Cedar decides <strong>Allow</strong> iff <em>at least one permit matches AND no forbid matches</em>. Everything else denies. Three canonical policies below are quoted from the Cedar documentation set (verified Sept 2026):</p>
                ${createCodeBlock(`// Last verified: 2026-09 vs cedar-policy/cedar-docs syntax-policy.md
permit (
    principal == User::"alice",
    action == Action::"view",
    resource == Photo::"VacationPhoto94.jpg"
);

// Owner-scoped edit: when-condition binds resource to principal
permit (
    principal,
    action == Action::"editPhoto",
    resource
)
when {
    resource.owner == principal
};

// Forbid wins: private photos stay private (permit alone is not enough)
forbid (
    principal,
    action,
    resource
)
when {
    resource.private
}
unless {
    principal == resource.owner
};`, 'cedar', 'Cedar: specific permit, conditional permit, overriding forbid')}
            </div>

            <div class="lesson-section">
                <h3>📨 The Authorization Request (Terminology, Verified)</h3>
                <p>Cedar docs define an authorization request as <em>principal × action × resource × context</em>: the app supplies entity details (principals, resources), context (IP, auth method, time), and the policy set; the engine returns <strong>decision + determining policies</strong>. If you remember the XACML boxes from Lesson 3, this is the same idea with Cedar nouns.</p>
                ${createCodeBlock(`// SHAPE-ILLUSTRATIVE entity/request JSON — the exact 'cedar authorize'
// flags and __entity/type+id forms vary by CLI version. Confirm with
// 'cedar authorize --help' for your pinned version before scripting.
// Semantics (principal/action/resource/context + entity attrs) verified
// 2026-09 vs cedar-policy/cedar-docs terminology.
// Entities the app must supply:
{ "uid": { "type": "User", "id": "alice" },
  "attrs": { "department": "finance", "clearance": 3 },
  "parents": [{ "type": "Team", "id": "eng" }] }

// Request: alice views VacationPhoto94.jpg from office IP with MFA
{ "principal": "User::\\"alice\\"", "action": "Action::\\"view\\"",
  "resource": "Photo::\\"VacationPhoto94.jpg\\"",
  "context": { "ip": "10.0.4.12", "mfa": true } }`, 'json', 'Cedar request: entities + context travel with every call')}
            </div>

            <div class="lesson-section">
                <h3>🔍 Critical Review Notes</h3>
                <ul>
                    <li><strong>Forbid is not standalone:</strong> the docs are explicit — a forbid-only set denies everything because no permit matches. Every forbid needs its permit partner.</li>
                    <li><strong><code>unless</code> vs <code>when</code>:</strong> <code>when</code> must hold for the policy to apply; <code>unless</code> must NOT hold. The private-photo forbid reads: <em>applies when private, except when requester is owner</em>.</li>
                    <li><strong>Rego vs Cedar instinct check:</strong> Rego asks <em>is allow derivable?</em>; Cedar asks <em>does a permit match AND no forbid match?</em> Both default-deny; Cedar makes the override explicit.</li>
                </ul>
            </div>
            ${renderPolicyLab('Run the four photo scenarios: public vs private × owner vs stranger.')}
        `,

        concepts: ["Cedar Permit", "Cedar Forbid Override", "When/Unless Clauses", "Cedar Request Shape"],

        quiz: {
            id: "cedar_found_quiz",
            title: "Cedar Foundations Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 420,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "When does Cedar return Allow?",
                    options: [
                        { text: "At least one permit matches AND no forbid matches", isCorrect: true },
                        { text: "When no policy matches at all", isCorrect: false },
                        { text: "When a forbid matches, regardless of permits", isCorrect: false },
                        { text: "Only when every permit in the set matches", isCorrect: false }
                    ],
                    explanation: "Cedar's own terminology: decision Allow requires a matching permit and zero matching forbids. Forbid always overrides.",
                    difficulty: 1, concept: "Cedar Permit"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "Bob views Alice's private photo. A permit matches (public-view rule) and the private-photo forbid matches. Verdict?",
                    options: [
                        { text: "Deny — forbid overrides permit", isCorrect: true },
                        { text: "Allow — permit was listed first", isCorrect: false },
                        { text: "Allow — Bob asked politely", isCorrect: false },
                        { text: "Error — policies conflict", isCorrect: false }
                    ],
                    explanation: "Order is irrelevant in Cedar; forbid wins by semantics, not position. The unless-owner escape is what saves Alice viewing her own private photo.",
                    difficulty: 2, concept: "Cedar Forbid Override"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "In forbid(...) when { resource.private } unless { principal == resource.owner }, what does unless do?",
                    options: [
                        { text: "The forbid does NOT apply when the requester is the owner", isCorrect: true },
                        { text: "The forbid applies ONLY to the owner", isCorrect: false },
                        { text: "It is a comment with no effect", isCorrect: false },
                        { text: "It converts the forbid into a permit", isCorrect: false }
                    ],
                    explanation: "unless = negative condition. Policy applies when when-holds AND unless-does-not-hold. Owner viewing own private photo escapes the forbid.",
                    difficulty: 2, concept: "When/Unless Clauses"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "A Cedar request must include which four elements?",
                    options: [
                        { text: "Principal, action, resource, context (+ entities and policies)", isCorrect: true },
                        { text: "Username and password only", isCorrect: false },
                        { text: "IP address only", isCorrect: false },
                        { text: "The full database", isCorrect: false }
                    ],
                    explanation: "Per Cedar terminology: the engine evaluates (principal, action, resource, context) against entities + policies and returns decision + determining policies.",
                    difficulty: 1, concept: "Cedar Request Shape"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "A policy set contains ONLY forbid policies. What happens to all requests?",
                    options: [
                        { text: "All deny — no permit can match", isCorrect: true },
                        { text: "All allow — forbids are ignored alone", isCorrect: false },
                        { text: "The engine crashes", isCorrect: false },
                        { text: "Only admins are affected", isCorrect: false }
                    ],
                    explanation: "Docs-verified: forbid only restricts; granting requires a permit. Forbid-only sets are a classic misconfiguration this quiz exists to prevent.",
                    difficulty: 2, concept: "Cedar Forbid Override"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "An isAuthorized call omits context.mfa but policy branches on it. Result?",
                                options: [
                                    { text: "Attribute access errors — the erroring policy is skipped, deny follows; check errors diagnostics and the schema", isCorrect: true },
                                    { text: "The engine defaults it to true", isCorrect: false },
                                    { text: "The engine guesses from the IP", isCorrect: false },
                                    { text: "Automatic permit for resilience", isCorrect: false }
                                ],
                                explanation: "Missing-attribute access is an evaluation error, not false: skip-on-error plus default-deny yields deny. Debug via errors diagnostics, prevent via schema validation.",
                                difficulty: 2, concept: "Cedar Request Shape"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "Restate forbid(...) when {A} unless {B} as prose.",
                                options: [
                                    { text: "Forbids when A holds, except where B holds", isCorrect: true },
                                    { text: "Forbids only when A and B both hold", isCorrect: false },
                                    { text: "Permits when A holds", isCorrect: false },
                                    { text: "Ignores B entirely", isCorrect: false }
                                ],
                                explanation: "when gates applicability; unless carves the exception. Misreading the polarity inverts the protection.",
                                difficulty: 3, concept: "When/Unless Clauses"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "Two permits match overlapping scopes. Result?",
                                options: [
                                    { text: "Allow — one matching permit suffices; forbids are still checked", isCorrect: true },
                                    { text: "Deny — overlapping permits are ambiguous", isCorrect: false },
                                    { text: "Engine error on overlap", isCorrect: false },
                                    { text: "First-listed permit wins, rest ignored", isCorrect: false }
                                ],
                                explanation: "Permits are existential, not exclusive. Order never matters in Cedar — only match plus absence of forbid.",
                                difficulty: 1, concept: "Cedar Permit"
                            }
                        ]
                    },
        animation: {
            type: "cedar-sim",
            title: "Cedar Decision Simulator",
            description: "Permit/forbid interaction across public/private photo scenarios",
            controls: ["setCedarScenario"]
        }
    };

    // =========================================================================
    // LESSON 9: OpenFGA Foundations
    // =========================================================================
    COURSE_DATA.levels.intermediate.lessons.openfga_foundations = {
        id: "openfga_foundations",
        title: "OpenFGA Foundations",
        subtitle: "Zanzibar tuples, DSL models, and check",
        level: "intermediate",
        number: 9,
        estimatedTime: 60,
        difficulty: 3,
        prerequisites: ["cedar_foundations"],

        content: `
            <div class="lesson-section">
                <h3>🕸️ Tuples Are the Policy</h3>
                <p>OpenFGA stores <strong>relationship tuples</strong> — <code>(user, relation, object)</code> — and a <strong>model</strong> defines which relations exist and how they imply each other. Authorization = graph reachability. The canonical docs model (verified Sept 2026):</p>
                ${createCodeBlock(`# Last verified: 2026-09 vs openfga.dev direct-relationships
model
  schema 1.1

type user

type team
  relations
    define member: [user]

type document
  relations
    define viewer: [user, team#member] or editor
    define editor: [user, team#member]

# Tuples (written at share-time):
# anne editor document:Q3        -> anne can view via concentric inherit
# team:eng member cara           -> cara in the team
# team:eng editor document:Q3    -> whole team edits (and hence views)`, 'openfga', 'OpenFGA DSL: viewer defined via editor (concentric) + team indirection')}
            </div>

            <div class="lesson-section">
                <h3>🔍 check() Reads the Graph</h3>
                <p><code>check(user:anne, viewer, document:Q3)</code> walks: direct viewer tuple? team#member path? editor path? Any path → allow. No path → deny. Concentric <code>viewer: ... or editor</code> means editors never need separate viewer tuples — the model bakes the implication in.</p>
                ${createCodeBlock(`# check(user:anne, viewer, document:Q3)  -> true
#   path: anne --editor--> document:Q3, editor => viewer
# check(user:zoe, viewer, document:Q3)   -> false (no path, default deny)
# check(user:cara, viewer, document:Q3)  -> true
#   path: cara --member--> team:eng --editor--> document:Q3 => viewer`, 'text', 'Check evaluation as path-finding')}
            </div>

            <div class="lesson-section">
                <h3>🔍 Critical Review Notes</h3>
                <ul>
                    <li><strong><code>user:*</code> (public wildcard) exists</strong> in the DSL for genuinely public objects — but every <code>*</code> in a model deserves a review comment explaining why that object class is public.</li>
                    <li><strong>Contextual tuples</strong> (time windows, IP ranges) are evaluated at check-time and are <em>not</em> supported in the playground — integration-test them against a real server (Lesson 14).</li>
                    <li><strong>Model versioning matters:</strong> changing <code>define</code> lines changes every past tuple's meaning. Version models like code and migrate tuples deliberately.</li>
                </ul>
            </div>
            ${renderPolicyLab('Run the three check scenarios: direct editor, stranger, and team-transitive access.')}
        `,

        concepts: ["Relationship Tuples", "OpenFGA DSL Model", "Concentric Relations", "Check as Path-Finding", "Default Deny in ReBAC"],

        quiz: {
            id: "fga_found_quiz",
            title: "OpenFGA Foundations Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 420,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "What is stored in OpenFGA as the source of truth for access?",
                    options: [
                        { text: "Relationship tuples (user, relation, object) interpreted through a versioned model", isCorrect: true },
                        { text: "Passwords and password hashes", isCorrect: false },
                        { text: "JWT signing keys", isCorrect: false },
                        { text: "Signed JWTs (authentication artifacts, not relationship facts)", isCorrect: false }
                    ],
                    explanation: "Zanzibar's insight: access = graph reachability over stored relationships. The model defines relation meanings; tuples are the facts.",
                    difficulty: 1, concept: "Relationship Tuples"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "Given define viewer: [user] or editor, anne holds only an editor tuple on doc:Q3. check(anne, viewer, doc:Q3)?",
                    options: [
                        { text: "true — editor implies viewer (concentric relation)", isCorrect: true },
                        { text: "false — she needs a separate viewer tuple", isCorrect: false },
                        { text: "error — models cannot reference other relations", isCorrect: false },
                        { text: "true — everyone is a viewer", isCorrect: false }
                    ],
                    explanation: "Concentric inheritance is the documented pattern: define viewer as editor (plus direct grants) so one tuple serves both.",
                    difficulty: 2, concept: "Concentric Relations"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "cara is member of team:eng; team:eng is editor of doc:Q3; viewer includes team#member-or-editor paths. check(cara, viewer, doc:Q3)?",
                    options: [
                        { text: "true — transitive path cara→team→doc resolves", isCorrect: true },
                        { text: "false — only direct tuples count", isCorrect: false },
                        { text: "false — teams cannot hold relations", isCorrect: false },
                        { text: "error — too many hops", isCorrect: false }
                    ],
                    explanation: "team#member indirection resolves transitively — and check() is path-finding: any valid path from subject to object through allowed relations is an allow.",
                    difficulty: 2, concept: "Check as Path-Finding"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "No tuple path exists between subject and object. Verdict?",
                    options: [
                        { text: "Deny — ReBAC default-deny (no path, no access)", isCorrect: true },
                        { text: "Allow — unknown users get viewer", isCorrect: false },
                        { text: "Ask the user to retry", isCorrect: false },
                        { text: "Grant admin to be safe", isCorrect: false }
                    ],
                    explanation: "Same invariant as every model in this course: unmatched → deny. ReBAC just spells 'matched' as 'a path exists'.",
                    difficulty: 1, concept: "Default Deny in ReBAC"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "You change define viewer to remove the editor clause. What must you consider?",
                    options: [
                        { text: "Every existing editor tuple silently loses viewer access — model edits are migrations", isCorrect: true },
                        { text: "Nothing — models are cosmetic", isCorrect: false },
                        { text: "Only new documents are affected", isCorrect: false },
                        { text: "Tuples auto-update to match", isCorrect: false }
                    ],
                    explanation: "The model gives meaning to all stored tuples. Editing defines retroactively reinterprets history — version and migrate deliberately.",
                    difficulty: 3, concept: "OpenFGA DSL Model"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "You add define owner: [user] to document but no rule references owner. Effect?",
                                options: [
                                    { text: "None until referenced — the model defines vocabulary; tuples and paths give it meaning", isCorrect: true },
                                    { text: "All owners instantly become admins", isCorrect: false },
                                    { text: "All checks start failing", isCorrect: false },
                                    { text: "Tuples auto-create for every owner", isCorrect: false }
                                ],
                                explanation: "Unused definitions are inert. Model edits only matter where relations are referenced — which is why edits need review.",
                                difficulty: 2, concept: "OpenFGA DSL Model"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "check() traverses six hops through nested teams. Operational concern?",
                                options: [
                                    { text: "Latency and depth limits — flatten hot paths, cache carefully, test p99", isCorrect: true },
                                    { text: "None — graph traversal is free", isCorrect: false },
                                    { text: "More tuples always make it faster", isCorrect: false },
                                    { text: "Disable authorization for deep graphs", isCorrect: false }
                                ],
                                explanation: "Reachability cost grows with depth. Production graphs need the same latency budgeting as any hot path.",
                                difficulty: 3, concept: "Check as Path-Finding"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "The team is deleted in the IdP but its OpenFGA tuples were never removed. Access via those paths?",
                                options: [
                                    { text: "Allow until the tuples are deleted — stale tuples are lingering grants; reconcile via sync/outbox", isCorrect: true },
                                    { text: "Deny automatically once the IdP object is gone", isCorrect: false },
                                    { text: "Auto-recreate the deleted team", isCorrect: false },
                                    { text: "Grant admin to affected users", isCorrect: false }
                                ],
                                explanation: "Tuples are independent stored facts — deleting the IdP object does not delete them. Stale tuples resolve and allow: tuple hygiene (sync job/outbox) is part of offboarding.",
                                difficulty: 1, concept: "Relationship Tuples"
                            }
                        ]
                    },
        animation: {
            type: "openfga-graph",
            title: "Relationship Graph Checks",
            description: "Direct, stranger, and team-transitive check() paths",
            controls: ["setFgaScenario"]
        }
    };

    // =========================================================================
    // LESSON 10: XACML and ALFA (the ancestors)
    // =========================================================================
    COURSE_DATA.levels.intermediate.lessons.xacml_alfa = {
        id: "xacml_alfa",
        title: "XACML and ALFA",
        subtitle: "Targets, combining algorithms, obligations",
        level: "intermediate",
        number: 10,
        estimatedTime: 60,
        difficulty: 2,
        prerequisites: ["rego_api_authz"],

        content: `
            <div class="lesson-section">
                <h3>🏛️ Where the Boxes Came From</h3>
                <p>XACML (OASIS standard) gave the field its vocabulary — PEP/PDP/PIP/PAP from Lesson 3 are XACML terms — and its architecture: requests and policies as XML, decisions Permit/Deny/NotApplicable/Indeterminate. It lost on ergonomics: even simple rules drown in angle brackets. <strong>ALFA</strong> (Abbreviated Language for Authorization, OASIS-adopted 2014) keeps the XACML model with readable syntax. Most engines in this course replay XACML ideas (combining, obligations, the four boxes); ReBAC's graph lineage runs parallel — see Lesson 9. Learn the model once here, recognize it everywhere.</p>
                <p><strong>Reading note:</strong> the ALFA below is a shape-illustrative fragment (Enforcer tutorial form) — a runnable file also needs attribute declarations, and bare <code>CurrentTime</code> is bag-valued in strict ALFA (canonical: <code>timeInRange(timeOneAndOnly(currentTime), ...)</code>). Read it for structure, not for pasting.</p>
                ${createCodeBlock(`// Last verified: 2026-09 vs Enforcer ALFA docs + Axiomatics guides
namespace AcmeCorp
{
    import Oasis.Attributes

    policy buildingAccess
    {
        apply denyOverrides
        target clause ResourceType == "door"

        rule openMainDoor
        {
            target clause Resource == "mainDoor" and Action == "open"
            permit
            condition Subject.Role == "employee" and
                      CurrentTime > "08:00:00":time and
                      CurrentTime < "18:00:00":time
        }
    }
}`, 'alfa', 'ALFA: policy, target scoping, rule with permit + condition')}
                <p><strong>What the ALFA above looks like inherited as raw XACML</strong> (same rule, shape-illustrative — abbreviated with <code>…</code>; you will read this, not write it):</p>
                ${createCodeBlock(`<!-- Same openMainDoor rule as raw XACML 3.0 (decoder-ring sample) -->
<Policy PolicyId="buildingAccess" RuleCombiningAlgId="…:deny-overrides">
  <Target><AnyOf><AllOf>
    <Match MatchId="…:string-equal">
      <AttributeValue DataType="…#string">door</AttributeValue>
      <AttributeDesignator Category="…:resource" AttributeId="ResourceType"/>
    </Match>
  </AllOf></AnyOf></Target>
  <Rule RuleId="openMainDoor" Effect="Permit">
    <Target><!-- Resource == mainDoor, Action == open (same Matches) -->…</Target>
    <Condition><!-- Subject.Role == employee AND timeInRange(timeOneAndOnly(currentTime), 08:00, 18:00) -->
      <Apply FunctionId="…:and">…</Apply>
    </Condition>
  </Rule>
</Policy>`, 'xml', 'XACML XML: the same rule drowning in angle brackets')}
            </div>

            <div class="lesson-section">
                <h3>⚖️ Combining Algorithms: Conflict Resolution, Named</h3>
                <p>When children disagree, the parent's <code>apply</code> clause decides — the idea Cedar's forbid-wins and OpenFGA's path-union both replay:</p>
                <ul>
                    <li><strong>denyOverrides:</strong> any Deny wins (Cedar forbid thinks this way).</li>
                    <li><strong>permitOverrides:</strong> any Permit wins.</li>
                    <li><strong>firstApplicable:</strong> first non-NotApplicable child wins (order matters — like middleware route tables).</li>
                    <li><strong>denyUnlessPermit / permitUnlessDeny:</strong> default-denied / default-permitted closes (this course standardizes on denyUnlessPermit).</li>
                </ul>
                <p><strong>Target vs condition:</strong> targets only compare attributes to values and scope <em>whether a rule is considered</em> (false → NotApplicable); conditions run arbitrary functions and decide the outcome. Cheap scoping first, expensive logic second — the same instinct as PEP route-mapping before PDP evaluation.</p>
            </div>

            <div class="lesson-section">
                <h3>📣 Obligations and Advice (Decisions With Side Jobs)</h3>
                <p>XACML decisions can carry <strong>obligations</strong> (must-do: log this access) and <strong>advice</strong> (should-do: show this message). Verified Enforcer pattern — a medical-records read permit obligates an audit entry while the deny path raises an alert:</p>
                ${createCodeBlock(`rule readPatientsRecords
{
    permit
    target clause ResourceType == "MedicalRecord" and Action == "Read"
    condition Subject.Role == "Doctor"

    on permit
    {
        obligation Auditor.RecordAccess
        {
            Auditor.Who = Subject.Name
            Auditor.When = CurrentDateTime
        }
    }
    on deny
    {
        advice Auditor.Alert
        {
            Auditor.Who = Subject.Name
            Auditor.Message = "Attempted medical-record access, denied"
        }
    }
}`, 'alfa', 'ALFA obligations (must log) vs advice (should alert)')}
            </div>

            <div class="lesson-section">
                <h3>🔍 Critical Review Notes</h3>
                <ul>
                    <li><strong>Why not XACML XML in 2026:</strong> verbosity killed adoption, not the model. New codebases should not start in XACML — but you will inherit it in banks, hospitals, and governments, and this lesson is the decoder ring.</li>
                    <li><strong>Obligations need a PEP that honors them:</strong> an obligation the enforcer ignores is documentation, not control. Verify obligation handling in tests, not just decisions.</li>
                    <li><strong>firstApplicable is order-sensitive:</strong> same hazard as middleware route tables (Lesson 19) — specific-first, tested overlaps.</li>
                </ul>
            </div>
            ${renderPolicyLab('Step a door-access request through target scoping, then condition, then combining.')}
        `,

        concepts: ["XACML Lineage", "ALFA Targets", "Combining Algorithms", "Target vs Condition", "Obligations and Advice", "Default-Closed Combines"],

        quiz: {
            id: "xacml_quiz",
            title: "XACML and ALFA Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 420,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "Where do the terms PEP, PDP, PIP, and PAP come from?",
                    options: [
                        { text: "XACML — the OASIS standard that named the architecture", isCorrect: true },
                        { text: "Invented for this course", isCorrect: false },
                        { text: "TCP/IP packet headers", isCorrect: false },
                        { text: "SQL query clauses", isCorrect: false }
                    ],
                    explanation: "Lesson 3's boxes are XACML vocabulary. The standard lost on ergonomics; its architecture won everywhere.",
                    difficulty: 1, concept: "XACML Lineage"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "A rule's target clause evaluates to false. The rule's outcome?",
                    options: [
                        { text: "NotApplicable — the rule is not considered", isCorrect: true },
                        { text: "Deny", isCorrect: false },
                        { text: "Permit", isCorrect: false },
                        { text: "The engine crashes", isCorrect: false }
                    ],
                    explanation: "Targets scope consideration, not outcomes. False target means the PDP skips the rule entirely.",
                    difficulty: 1, concept: "ALFA Targets"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "Two child rules return Permit and Deny under apply denyOverrides. Result?",
                    options: [
                        { text: "Deny — any Deny wins and evaluation stops", isCorrect: true },
                        { text: "Permit — permits outrank", isCorrect: false },
                        { text: "First-listed wins", isCorrect: false },
                        { text: "Indeterminate always", isCorrect: false }
                    ],
                    explanation: "denyOverrides is Cedar-forbid thinking with a name: Deny dominates regardless of position.",
                    difficulty: 2, concept: "Combining Algorithms"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "Target clauses may only compare attributes to values, while conditions run arbitrary functions. Why the split?",
                    options: [
                        { text: "Cheap scoping first, expensive logic second — same instinct as route-mapping before evaluation", isCorrect: true },
                        { text: "Targets are decorative", isCorrect: false },
                        { text: "Conditions cannot use attributes", isCorrect: false },
                        { text: "There is no reason", isCorrect: false }
                    ],
                    explanation: "Targets prune the candidate set with cheap comparisons; conditions spend compute only where relevant.",
                    difficulty: 2, concept: "Target vs Condition"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "A permit carries an obligation to log the access, but the PEP ignores obligations. Status?",
                    options: [
                        { text: "Broken control — obligations need enforcing PEPs, verified in tests", isCorrect: true },
                        { text: "Fine — obligations are advisory by definition", isCorrect: false },
                        { text: "The permit becomes a deny", isCorrect: false },
                        { text: "Obligations enforce themselves", isCorrect: false }
                    ],
                    explanation: "Obligations (must-do) differ from advice (should-do) precisely in enforcement. Unenforced obligations are documentation.",
                    difficulty: 2, concept: "Obligations and Advice"
                },
                {
                    id: "q6", type: "multiple-choice",
                                question: "Which combining algorithm is this course's standard posture?",
                                options: [
                                    { text: "denyUnlessPermit — closed unless a permit matches", isCorrect: true },
                                    { text: "permitUnlessDeny — open unless forbidden (polarity flip)", isCorrect: false },
                                    { text: "firstApplicable with order never mattering", isCorrect: false },
                                    { text: "Majority vote of children", isCorrect: false }
                                ],
                    explanation: "denyUnlessPermit is default-deny with a combining-algorithm name: Rego defaults, Cedar semantics, ReBAC no-path-deny all rhyme with it.",
                    difficulty: 1, concept: "Default-Closed Combines"
                },
                {
                    id: "q7", type: "multiple-choice",
                    question: "Under firstApplicable, a broad early rule shadows a strict later one. Fix?",
                    options: [
                        { text: "Order specific-first and test overlaps — same discipline as middleware route tables", isCorrect: true },
                        { text: "Delete all broad rules", isCorrect: false },
                        { text: "Switch to random order", isCorrect: false },
                        { text: "Nothing — shadowing is safe", isCorrect: false }
                    ],
                    explanation: "Order-sensitive combiners inherit order-sensitive hazards. Specific-first plus overlap tests, everywhere.",
                    difficulty: 2, concept: "Combining Algorithms"
                },
                {
                    id: "q8", type: "multiple-choice",
                                question: "Should a new 2026 codebase start in XACML XML?",
                                options: [
                                    { text: "No — verbosity killed adoption; learn the model here, build in Rego/Cedar/ReBAC, read XACML where inherited", isCorrect: true },
                                    { text: "Yes — auditors accept only raw XACML XML", isCorrect: false },
                                    { text: "Yes — Rego and Cedar cannot express combining algorithms", isCorrect: false },
                                    { text: "Yes — modern PDPs require XML input", isCorrect: false }
                                ],
                    explanation: "The honest verdict: model yes, syntax no. Banks and hospitals will still hand you XACML — now you can read it.",
                    difficulty: 1, concept: "XACML Lineage"
                }
            ]
        },
        animation: {
            type: "policy-flow",
            title: "Target → Condition → Combine",
            description: "Step a request through scoping, evaluation, and combining",
            controls: ["flowPrev", "flowNext"]
        }
    };

    // =========================================================================
    // LESSON 11: OPA in Production
    // =========================================================================
    COURSE_DATA.levels.advanced.lessons.opa_production = {
        id: "opa_production",
        title: "OPA in Production",
        subtitle: "Bundles, data injection, REST, and hot reload",
        level: "advanced",
        number: 11,
        estimatedTime: 75,
        difficulty: 3,
        prerequisites: ["rego_api_authz"],

        content: `
            <div class="lesson-section">
                <h3>📦 From Files to Bundles</h3>
                <p>Real estates do not PUT Rego through ad-hoc REST calls (the demo-repos do that for teaching). Production: <strong>.rego + data.json in Git → CI (opa fmt, opa test) → signed bundle → OPA sidecars poll/push</strong>. Hot reload lands in under a second on local bundle polls with zero restarts — the rest-rego sidecar demonstrates exactly this (caveat: large bundles over slow links take longer; measure your p99 bundle-activation, not the demo's).</p>
                ${createCodeBlock(`# CI gate for every policy change (copy into your pipeline)
opa fmt --diff ./policies        # canonical formatting, diff fails the build
opa test ./policies/ -v          # allow-tests + deny-tests + regression tests
opa build -b ./policies -o bundle.tar.gz   # ship one artifact

# Data injection at runtime (roles WITHOUT redeploying policy):
# PUT /v1/data/user_roles/alice  ["analyst"]
# PATCH /v1/data/cnapp/rbac  [{"op":"add","path":"/blacklist/...","value":{...}}]`, 'bash', 'OPA production loop: fmt, test, bundle, inject data')}
            </div>

            <div class="lesson-section">
                <h3>📨 Decision API, Precisely</h3>
                <p>Package <code>app.rbac</code> is queried at <code>POST /v1/data/app/rbac</code> with <code>{"input": {...}}</code> — the wrapper key is mandatory and the #1 beginner 404/undefined cause in every demo repo. Query a sub-rule (<code>/v1/data/demo/allow</code>) for booleans, or the package path for the full decision document.</p>
                ${createCodeBlock(`curl -s -X POST localhost:8181/v1/data/demo/allow \\
  -H 'Content-Type: application/json' \\
  -d '{ "input": { "method": "PUT", "path": "/teams/123",
                   "roles": ["analyst"], "groups": ["Team123"] } }'
# -> {"result": true}   (team rule matched; Team999 would return false)`, 'bash', 'Decision call: input wrapper + package-derived path')}
            </div>

            <div class="lesson-section">
                <h3>🔍 Critical Review: Production Gaps the Demos Admit</h3>
                <ul>
                    <li><strong>Debug with reasons:</strong> the zero-trust gatekeeper repo queries a companion <code>data.zt.authz.reasons</code> rule to name the vetoing sub-policy. Ship a reasons rule from day one.</li>
                    <li><strong>Decision logs:</strong> OPA can ship every decision (input + result + policy id) to your log pipeline — the audit trail compliance asked for in Lesson 5. Configure drop/masking for sensitive input fields first, or the audit trail becomes a PII leak.</li>
                    <li><strong>Sign bundles, watch status:</strong> sign bundles in CI (<code>opa build --signing-key</code>) and verify on agents; poll <code>/v1/status</code> and the discovery service so a sidecar running a stale bundle pages you instead of silently enforcing yesterday's policy.</li>
                    <li><strong>Cache carefully:</strong> the Keycloak-middleware pattern caches decisions ~5s with <code>OPA_FAIL_OPEN=false</code>. Cache keys must include tenant + roles + resource, or you will serve alice's verdict to bob.</li>
                </ul>
            </div>
            ${renderPolicyLab('Compare sidecar vs gateway vs middleware latency and failure posture.')}
            <div class="lesson-section"><p><strong>Choosing between these?</strong> Lesson 19 is the decision reference — it compares the three patterns on latency, blast radius, and code-change budget. This lesson is the setup; that lesson is the choice.</p></div>
        `,

        concepts: ["Policy Bundles", "Data Injection API", "Decision API Paths", "Decision Logs and Reasons", "Decision Caching"],

        quiz: {
            id: "opa_prod_quiz",
            title: "OPA in Production Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 480,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "What is the production path for a policy change?",
                    options: [
                        { text: "Git → opa fmt/test in CI → bundle → sidecars hot-reload", isCorrect: true },
                        { text: "SSH into servers and edit Rego by hand", isCorrect: false },
                        { text: "PUT the policy via ad-hoc REST calls in production", isCorrect: false },
                        { text: "Policies never change after launch", isCorrect: false }
                    ],
                    explanation: "Policy-as-code earns its name: reviewed, tested, bundled, distributed. Ad-hoc REST PUTs are for learning, not for prod.",
                    difficulty: 1, concept: "Policy Bundles"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "POST /v1/data/demo/allow with a bare input (no input wrapper key). What happens?",
                    options: [
                        { text: "Rules see empty input and deny (or misbehave) — the wrapper is mandatory", isCorrect: true },
                        { text: "OPA auto-detects the format", isCorrect: false },
                        { text: "It returns allow=true for convenience", isCorrect: false },
                        { text: "The server deletes the policy", isCorrect: false }
                    ],
                    explanation: "Every demo repo calls this out: runtime facts must sit under input. Missing wrapper is the classic 'policy works in playground, denies in prod' bug.",
                    difficulty: 2, concept: "Decision API Paths"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "Alice's admin role is revoked. Fastest correct propagation without redeploying policy?",
                    options: [
                        { text: "PUT /v1/data/user_roles/alice with the new role list (data injection)", isCorrect: true },
                        { text: "Rewrite and redeploy all Rego files", isCorrect: false },
                        { text: "Restart every application server", isCorrect: false },
                        { text: "Wait for the JWT to expire someday", isCorrect: false }
                    ],
                    explanation: "Data (who-has-what-role) is separate from policy (what-roles-mean) precisely so revocation is a data write, demonstrated in the REST demo repos.",
                    difficulty: 2, concept: "Data Injection API"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "A denial reaches your on-call with no explanation. What should have existed?",
                    options: [
                        { text: "A reasons rule + decision logs naming the determining policy", isCorrect: true },
                        { text: "A louder 403 status code", isCorrect: false },
                        { text: "More permissive rules so denials never happen", isCorrect: false },
                        { text: "Deleting the logs to save disk", isCorrect: false }
                    ],
                    explanation: "The gatekeeper repo's reasons rule is the pattern: every deny carries its cause; decision logs preserve input+result for audit.",
                    difficulty: 2, concept: "Decision Logs and Reasons"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "You cache PDP decisions. What must the cache key include?",
                    options: [
                        { text: "Subject identity/roles + tenant + action + resource (+ relevant context)", isCorrect: true },
                        { text: "Only the URL path", isCorrect: false },
                        { text: "Only the time of day", isCorrect: false },
                        { text: "Caching is never allowed", isCorrect: false }
                    ],
                    explanation: "Under-keyed caches serve one user's verdict to another — a cache-shaped authZ bypass. Key everything the decision depends on; TTL in seconds.",
                    difficulty: 3, concept: "Decision Caching"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "You query /v1/data/app instead of /v1/data/app/allow. Difference?",
                                options: [
                                    { text: "Full decision document vs boolean — document for audit, boolean for the hot path", isCorrect: true },
                                    { text: "No difference at all", isCorrect: false },
                                    { text: "One is faster to type", isCorrect: false },
                                    { text: "The path is case-sensitive magic", isCorrect: false }
                                ],
                                explanation: "Package path returns the whole document (reasons, obligations); sub-rule path returns the boolean. Choose per consumer.",
                                difficulty: 2, concept: "Decision API Paths"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "Decision logs must exclude PII but preserve cause. How?",
                                options: [
                                    { text: "Log inputs selectively (drop raw claims) plus determining policy ids and reason codes", isCorrect: true },
                                    { text: "Log absolutely everything", isCorrect: false },
                                    { text: "Disable decision logs", isCorrect: false },
                                    { text: "Log only allows", isCorrect: false }
                                ],
                                explanation: "Auditability and privacy compose: keep the why (policy ids, reasons), drop the who (raw claims).",
                                difficulty: 2, concept: "Decision Logs and Reasons"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "Two sidecars run bundle v41 and v42 during rollout. Risk?",
                                options: [
                                    { text: "Verdict skew across instances — pin versions, roll forward fast, monitor diff rate", isCorrect: true },
                                    { text: "None — versions are cosmetic", isCorrect: false },
                                    { text: "Faster decisions overall", isCorrect: false },
                                    { text: "Bundles auto-heal to newest", isCorrect: false }
                                ],
                                explanation: "Mixed-version fleets answer the same question differently. Bundle rollout is a deployment like any other.",
                                difficulty: 1, concept: "Policy Bundles"
                            }
                        ]
                    },
        animation: {
            type: "auth-patterns",
            title: "Enforcement Patterns Compared",
            description: "Sidecar vs gateway vs middleware: flow, latency, failure mode",
            controls: ["setAuthPattern"]
        }
    };

    // =========================================================================
    // LESSON 12: OPA Data Filtering (partial evaluation)
    // =========================================================================
    COURSE_DATA.levels.advanced.lessons.opa_data_filtering = {
        id: "opa_data_filtering",
        title: "OPA Data Filtering",
        subtitle: "Partial evaluation: decisions compiled to WHERE clauses",
        level: "advanced",
        number: 12,
        estimatedTime: 70,
        difficulty: 4,
        prerequisites: ["opa_production"],

        content: `
            <div class="lesson-section">
                <h3>🔽 From Decisions to Filters</h3>
                <p>Per-row PDP calls don't scale to analytics tables — and the warehouse can't call your sidecar per row. <strong>Partial evaluation</strong> compiles policy + known input into a residual query (e.g. SQL <code>WHERE</code>) the database enforces itself. Unknowns (row fields) stay symbolic; knowns (the requester's attributes) fold into constants. Verified against the OPA filtering docs:</p>
                ${createCodeBlock(`# Last verified: 2026-09 vs OPA docs /filtering + REST /v1/compile
# METADATA
# scope: package
# compile:
#   unknowns: [input.employees]
package filters

include if {
    input.user.role == "director"                        # known -> consumed
    input.employees.department == input.user.department  # unknown == known -> SQL
}

# POST /v1/compile/filters/include  {"input": {"user": {...director, engineering...}}}
# Enterprise OPA SQL shape: { "result": { "query": "WHERE employees.department = 'engineering'" } }
# OSS OPA 1.8 shape:        { "result": {"queries": [...], "support": [...] } }  (Rego AST + translator)
# The app appends the filter: SELECT name, salary FROM employees $FILTER;`, 'rego', 'Partial eval: knowns fold, unknowns become SQL')}
            </div>

            <div class="lesson-section">
                <h3>🧪 The Two-User Proof (Docs Tutorial Shape)</h3>
                <p>Alice (director, engineering) compiles to <code>WHERE department = engineering</code>; Dave (director, marketing) compiles to <code>WHERE department = marketing</code>. Same policy, different filters — the requester's attributes specialize the query. This is ABAC executed by the database, and it is also why input correctness matters twice: a wrong department folds into a wrong filter silently. Lab note: add 30m if running the Postgres lab end-to-end.</p>
            </div>

            <div class="lesson-section">
                <h3>🎭 Masking at Compile Time (Enterprise API)</h3>
                <p>Scope this precisely: on <strong>Enterprise OPA</strong>, the expanded compile API accepts a <code>maskRule</code> and can return SQL-shaped <code>{"result": {"query": "..."}}</code> — columns the policy masks become projections, not just filters. On <strong>OSS OPA 1.8</strong> (pinned in this course), <code>/v1/compile</code> returns <code>{"result": {"queries": [...], "support": ...}}</code> — a Rego AST your translator turns into SQL. Filters decide <em>which rows</em>; masks decide <em>which columns</em> — the Immuta split (Lesson 17) reproduced inside OPA's compiler.</p>
            </div>

            <div class="lesson-section">
                <h3>🔍 Critical Review Notes</h3>
                <ul>
                    <li><strong>Residual queries need review like policies:</strong> a compiled <code>WHERE true</code> (over-permissive unknowns) is a breach in SQL clothing. Log compiled filters, sample them, alert on tautologies (e.g. alert when <code>query LIKE '%WHERE 1=1%' OR query LIKE '%WHERE true%' OR query NOT LIKE '%WHERE%'</code>).</li>
                    <li><strong>Translators are unsound until reviewed:</strong> OSS <code>/v1/compile</code> returns a Rego AST — your translator turns it into SQL. Never string-concat raw attribute values into SQL (injection); use bound parameters. Review the translator like policy code.</li>
                    <li><strong>Not every rule compiles:</strong> rules with side effects, iteration over unknowns, or non-relational logic may refuse partial eval. Keep filter-path rules relational and simple; keep the exotic logic on the per-request path. Builtins that commonly break partial-eval: <code>http.send</code>, <code>walk</code> over unknowns, time/date arithmetic on unknowns, custom functions over unknowns — verify against OPA 1.8 filtering docs for your pinned version.</li>
                    <li><strong>Freshness still applies:</strong> compiled filters embed the requester's attributes at compile time — recompile per request (or per attribute change), never cache across revocations.</li>
                </ul>
            </div>
            ${renderPolicyLab('Preview masking outcomes per role before implementing.')}
        `,

        concepts: ["Partial Evaluation", "Knowns vs Unknowns", "Compile to SQL", "Mask Rules", "Residual Query Review", "Filter Freshness"],

        quiz: {
            id: "partial_eval_quiz",
            title: "OPA Data Filtering Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 420,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "Why compile policy to SQL instead of calling the PDP per row?",
                    options: [
                        { text: "Per-row PDP calls don't scale; the database enforces the compiled filter itself", isCorrect: true },
                        { text: "SQL is more secure by nature", isCorrect: false },
                        { text: "PDPs cannot read databases", isCorrect: false },
                        { text: "Filters are prettier than decisions", isCorrect: false }
                    ],
                    explanation: "Bulk-data systems need answers shaped like queries (filters), not booleans — the same insight as PlainID Resolution.",
                    difficulty: 1, concept: "Partial Evaluation"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "In the filters package, what do unknowns: [input.employees] declare?",
                    options: [
                        { text: "Row fields stay symbolic (become SQL); requester attributes fold into constants", isCorrect: true },
                        { text: "Those fields are deleted", isCorrect: false },
                        { text: "Those fields are always true", isCorrect: false },
                        { text: "The rule is skipped", isCorrect: false }
                    ],
                    explanation: "Unknowns mark what the compiler cannot know yet. Knowns evaluate away; unknowns become the residual query.",
                    difficulty: 2, concept: "Knowns vs Unknowns"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "Alice (engineering) and Dave (marketing) compile the same policy. Result?",
                    options: [
                        { text: "Different WHERE clauses specialized by each requester's attributes", isCorrect: true },
                        { text: "Identical filters for both", isCorrect: false },
                        { text: "An error — one policy, one filter", isCorrect: false },
                        { text: "No filter for directors", isCorrect: false }
                    ],
                    explanation: "Partial evaluation specializes: same policy plus different knowns yields different residual queries.",
                    difficulty: 2, concept: "Compile to SQL"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "What does the compile API's maskRule option produce?",
                    options: [
                        { text: "Column projections (masking) alongside row filters", isCorrect: true },
                        { text: "Faster network speeds", isCorrect: false },
                        { text: "Stronger passwords", isCorrect: false },
                        { text: "More unknown declarations", isCorrect: false }
                    ],
                    explanation: "Filters gate rows, masks shape columns — the subscription/data split compiled into one artifact.",
                    difficulty: 2, concept: "Mask Rules"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "A compiled filter reads WHERE true. Response?",
                    options: [
                        { text: "Treat as a breach-shaped artifact: block, alert, fix the unknowns — never ship tautologies", isCorrect: true },
                        { text: "Ship it — true means tested", isCorrect: false },
                        { text: "Cache it for performance", isCorrect: false },
                        { text: "Add more ORs", isCorrect: false }
                    ],
                    explanation: "Over-permissive unknowns compile to allow-everything SQL. Residual queries get the same review gates as policies.",
                    difficulty: 3, concept: "Residual Query Review"
                },
                {
                    id: "q6", type: "multiple-choice",
                    question: "A rule iterates over unknown rows with custom functions. Partial eval?",
                    options: [
                        { text: "Likely refuses — keep filter-path rules relational and simple; exotic logic stays per-request", isCorrect: true },
                        { text: "Always compiles anything", isCorrect: false },
                        { text: "Compiles but runs slower", isCorrect: false },
                        { text: "Deletes the rule", isCorrect: false }
                    ],
                    explanation: "Compilation has a supported fragment. Design filter-path rules for it; don't fight the compiler.",
                    difficulty: 2, concept: "Compile to SQL"
                },
                {
                    id: "q7", type: "multiple-choice",
                    question: "Compiled filters embed requester attributes. Caching rule?",
                    options: [
                        { text: "Recompile per request or attribute change — never cache across revocations", isCorrect: true },
                        { text: "Cache one filter for all users", isCorrect: false },
                        { text: "Cache for 30 days", isCorrect: false },
                        { text: "Compile once at deploy", isCorrect: false }
                    ],
                    explanation: "A filter is a decision frozen with yesterday's attributes. Stale filters are stale verdicts.",
                    difficulty: 2, concept: "Filter Freshness"
                },
                {
                    id: "q8", type: "multiple-choice",
                    question: "Which workload fits data filtering over per-request PDP calls?",
                    options: [
                        { text: "Analytics tables and search indexes enforced by another system", isCorrect: true },
                        { text: "Single-object API reads", isCorrect: false },
                        { text: "Login password checks", isCorrect: false },
                        { text: "TLS termination", isCorrect: false }
                    ],
                    explanation: "Bulk enforcement by foreign systems is the filtering lane; single decisions stay on the PDP hot path.",
                    difficulty: 1, concept: "Partial Evaluation"
                }
            ]
        },
        animation: {
            type: "data-masking-sim",
            title: "Compile-Time Masking Preview",
            description: "Filters gate rows, masks shape columns — per role",
            controls: ["setMaskRole"]
        }
    };

    // =========================================================================
    // LESSON 13: Cedar in Production (AVP)
    // =========================================================================
    COURSE_DATA.levels.advanced.lessons.cedar_production = {
        id: "cedar_production",
        title: "Cedar in Production",
        subtitle: "Schemas, templates, and Verified Permissions",
        level: "advanced",
        number: 13,
        estimatedTime: 70,
        difficulty: 3,
        prerequisites: ["cedar_foundations"],

        content: `
            <div class="lesson-section">
                <h3>📐 Schema First: The Compiler for Your Policy</h3>
                <p>Cedar schemas declare entity shapes and legal (principal, action, resource) combinations. The validator rejects nonsense policies <em>before</em> deployment — e.g. comparing a User to a Photo owner of the wrong type. This is Cedar's edge over stringly-typed Rego inputs. <strong>Limits:</strong> the validator sees policy + schema, not request context or entity-store contents — <code>context</code> typos and missing entities still surface at evaluation as errors-then-deny (Lesson 8 Q6). Validate with representative entities, not just the schema file.</p>
                ${createCodeBlock(`// Cedar schema (human form): principals, resources, actions, member attrs
entity User { department: String, clearance: Long };
entity Photo { owner: User, private: Boolean };
action "view" appliesTo { principal: [User], resource: [Photo], context: { mfa: Boolean } };
action "editPhoto" appliesTo { principal: [User], resource: [Photo], context: {} };`, 'cedar', 'Cedar schema: typed entities + action applicability')}
            </div>

            <div class="lesson-section">
                <h3>🧩 Templates: One Rule, Many Links</h3>
                <p>Policy <strong>templates</strong> leave slots (<code>?principal</code>, <code>?resource</code>) filled at link time. The docs' verified example ships a static permit plus a forbid template — one template, thousands of scoped links, no copy-paste policies. Templates pair: a <strong>permit template</strong> grants per scope (e.g. per-folder view), the <strong>forbid template</strong> below bounds it — and links have a lifecycle: create on grant, <strong>unlink on revoke</strong>; a forgotten link is a lingering grant, so list links per template in your offboarding/runbook check.</p>
                ${createCodeBlock(`// Template: ?resource filled per-link (e.g. per folder) at deploy time
forbid (
    principal == User::"12UA45",
    action == Action::"view",
    resource in ?resource
);`, 'cedar', 'Cedar template slot: forbid linked per resource scope')}
            </div>

            <div class="lesson-section">
                <h3>☁️ Amazon Verified Permissions (Managed PDP)</h3>
                <ul>
                    <li><strong>IsAuthorized:</strong> your service sends (principal, action, resource, context, entities) and gets decision + determining policies. Same request shape as Lesson 8, over HTTPS, with CloudTrail audit. Shape-illustrative JSON (confirm field names against your AVP API version):</li>
                </ul>
                ${createCodeBlock(`{ "principal": { "entityType": "User", "entityId": "alice" },
  "action": { "actionType": "Action", "actionId": "view" },
  "resource": { "entityType": "Photo", "entityId": "VacationPhoto94.jpg" },
  "context": { "mfa": true },
  "entities": { "entityList": [ /* User alice + Photo with owner/refattrs */ ] } }
// Local equivalent: cedar authorize --policies policies.cedar
//   --entities entities.json --request request.json
// (confirm flags with 'cedar authorize --help' for your pinned CLI)`, 'json', 'IsAuthorized request: principal/action/resource/context + entities')}
                <ul>
                    <li><strong>Policy stores version everything;</strong> schema validation runs at write time — bad policies are rejected, not deployed.</li>
                    <li><strong>Honest costs:</strong> per-request pricing + network hop + AWS coupling. Exit path: Cedar is open-source — the same policies run in the embedded engine (must keep entity feeds portable).</li>
                </ul>
            </div>
            ${renderPolicyLab('Re-run the Cedar scenarios with a private-photo forbid linked per folder.')}
        `,

        concepts: ["Cedar Schema", "Policy Templates and Slots", "Verified Permissions IsAuthorized", "Schema Validation", "Managed PDP Trade-offs"],

        quiz: {
            id: "cedar_prod_quiz",
            title: "Cedar in Production Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 480,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "What does a Cedar schema give you that raw Rego inputs do not?",
                    options: [
                        { text: "Write-time validation: illegal principal/action/resource combos and type errors are rejected before deploy", isCorrect: true },
                        { text: "Faster network speeds", isCorrect: false },
                        { text: "Free cloud hosting", isCorrect: false },
                        { text: "Automatic role assignment to all users", isCorrect: false }
                    ],
                    explanation: "Schemas are Cedar's headline operational advantage: the validator catches type/category errors at authoring time instead of as 3am denies.",
                    difficulty: 2, concept: "Cedar Schema"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "What is a policy template slot (?resource)?",
                    options: [
                        { text: "A placeholder filled at link time so one template serves many scoped policies", isCorrect: true },
                        { text: "A syntax error", isCorrect: false },
                        { text: "A wildcard granting everything", isCorrect: false },
                        { text: "A comment marker", isCorrect: false }
                    ],
                    explanation: "Templates (docs-verified forbid example) avoid copy-paste per-folder/per-user policies: write once, link per scope.",
                    difficulty: 2, concept: "Policy Templates and Slots"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "Your service calls AVP IsAuthorized. What must it send?",
                    options: [
                        { text: "Principal, action, resource, context, entities (+ policy store id)", isCorrect: true },
                        { text: "Only the username", isCorrect: false },
                        { text: "The entire database", isCorrect: false },
                        { text: "Nothing — AVP reads minds", isCorrect: false }
                    ],
                    explanation: "Managed or embedded, Cedar needs the same four request elements plus entity data. The transport changes; the contract does not.",
                    difficulty: 1, concept: "Verified Permissions IsAuthorized"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "A policy comparing User.clearance (Long) to a String literal is saved. When do you learn about it?",
                    options: [
                        { text: "At write time — schema validation rejects it before deployment", isCorrect: true },
                        { text: "Never — it silently allows everything", isCorrect: false },
                        { text: "Only after a breach", isCorrect: false },
                        { text: "When the invoice arrives", isCorrect: false }
                    ],
                    explanation: "Write-time rejection is the point of schemas: bad policy never becomes running policy.",
                    difficulty: 2, concept: "Schema Validation"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "What is the honest exit path from a managed Cedar PDP?",
                    options: [
                        { text: "Cedar is open-source: same policies run embedded; keep entity feeds portable", isCorrect: true },
                        { text: "There is none — rewrite everything", isCorrect: false },
                        { text: "Export to screenshots and retype", isCorrect: false },
                        { text: "Managed PDPs cannot be left", isCorrect: false }
                    ],
                    explanation: "Open language + portable entity pipelines = negotiable lock-in. The course rule: every platform lesson names its exit.",
                    difficulty: 2, concept: "Managed PDP Trade-offs"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "A template would need linking per user for 10,000 users. Better design?",
                                options: [
                                    { text: "Group-based links (team entities as parents) — links scale with groups, not users", isCorrect: true },
                                    { text: "Ten thousand individual templates", isCorrect: false },
                                    { text: "One giant permit for everyone", isCorrect: false },
                                    { text: "Skip templates entirely", isCorrect: false }
                                ],
                                explanation: "Templates multiply by scope count. Bind scopes to groups and let membership do the fan-out.",
                                difficulty: 2, concept: "Policy Templates and Slots"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "A schema update removes an attribute that policies still use. When is it caught?",
                                options: [
                                    { text: "At validate/write time — that is the entire point of schemas", isCorrect: true },
                                    { text: "Never — it fails silently", isCorrect: false },
                                    { text: "At 3am in production", isCorrect: false },
                                    { text: "By end users filing tickets", isCorrect: false }
                                ],
                                explanation: "Schema evolution is validated like API evolution: breakages surface before deploy, never after.",
                                difficulty: 2, concept: "Schema Validation"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "AVP latency spikes. What does your service do?",
                                options: [
                                    { text: "Timeout → deny plus alert, with cached verdicts bounded by a freshness SLO", isCorrect: true },
                                    { text: "Fail open until latency recovers", isCorrect: false },
                                    { text: "Retry forever holding the connection", isCorrect: false },
                                    { text: "Drop authorization from the path", isCorrect: false }
                                ],
                                explanation: "Managed PDPs share fate with your availability budget. Degradation policy is decided up front, not during the incident.",
                                difficulty: 1, concept: "Verified Permissions IsAuthorized"
                            }
                        ]
                    },
        animation: {
            type: "cedar-sim",
            title: "Template + Forbid in Production",
            description: "Scoped forbid links over the photo scenarios",
            controls: ["setCedarScenario"]
        }
    };

    // =========================================================================
    // LESSON 14: OpenFGA in Production
    // =========================================================================
    COURSE_DATA.levels.advanced.lessons.openfga_production = {
        id: "openfga_production",
        title: "OpenFGA in Production",
        subtitle: "Models API, writes, checks, and list-objects",
        level: "advanced",
        number: 14,
        estimatedTime: 70,
        difficulty: 3,
        prerequisites: ["openfga_foundations"],

        content: `
            <div class="lesson-section">
                <h3>🔌 The Four Calls That Matter</h3>
                <ul>
                    <li><strong>Model write:</strong> publish a versioned DSL model (<code>fga model write</code>); keep every version — old tuples are interpreted by the current model.</li>
                    <li><strong>Tuple write/delete:</strong> share-time and revoke-time facts (<code>fga tuple write user:anne editor document:Q3</code>).</li>
                    <li><strong>Check:</strong> <code>check(user:anne, viewer, document:Q3)</code> → allow/deny at request time.</li>
                    <li><strong>List-objects:</strong> <em>which documents can anne view?</em> — powers UIs and bulk pre-filtering without N checks.</li>
                </ul>
                ${createCodeBlock(`# Store -> model -> tuples -> check (OpenFGA CLI, pinned)
export STORE=$(fga store create --name pbac-lab | grep -o 'store_[A-Za-z0-9]*')
export MODEL_ID=$(fga model write --store-id $STORE --file model.fga | grep -o 'model_[A-Za-z0-9]*')
# --model-id is required once a store holds more than one model version;
# always pass it (copy-paste without it breaks after the second model write)
fga tuple write --store-id $STORE --model-id $MODEL_ID user:anne editor document:Q3
fga check --store-id $STORE --model-id $MODEL_ID user:anne viewer document:Q3
# -> {"allowed": true}   (editor => viewer, concentric)`, 'bash', 'OpenFGA lifecycle: store, model, tuples, check')}
            </div>

            <div class="lesson-section">
                <h3>⏱️ Contextual Tuples (Verified Behavior)</h3>
                <p>Time windows and IP ranges ride along as <strong>contextual tuples</strong> supplied at check-time (docs pseudocode: <code>ip-address-range:10.0.0.0/16</code>, <code>timeslot:18_19</code>). Precision note: gating on them requires <strong>conditions with request context</strong> in the model — contextual tuples alone are just facts. Shape-illustrative condition (confirm <code>condition</code> syntax against your server version):</p>
                ${createCodeBlock(`type document
  relations
    define viewer: [user with office_hours] or editor

condition office_hours(ip: string, now: string) {
  ip.startsWith("10.0.") and now >= "09:00" and now <= "17:00"
}
// check(user:anne, viewer, document:Q3,
//   context: { ip: "10.0.4.12", now: "10:15" },
//   contextual_tuples: [])  -> condition gates the direct grant`, 'openfga', 'Condition + context: time/IP gating needs model conditions, not just tuples')}
                <p>And do not rely on the playground for this path: integration-test time/IP-gated checks against a real server.</p>
            </div>

            <div class="lesson-section">
                <h3>🔍 Critical Review Notes</h3>
                <ul>
                    <li><strong>Revocation is tuple deletion</strong> — plus cache invalidation. A deleted tuple with a 60s check-cache is a 60s lingering grant. Size caches accordingly.</li>
                    <li><strong>Write tuples transactionally with your domain writes:</strong> sharing-without-tuple (user sees nothing) and tuple-without-share (dangling grant) are both bugs — same transaction or outbox.</li>
                    <li><strong>List-objects before check-storms:</strong> rendering <em>all docs anne can view</em> via per-doc checks is N+1 authorization; list-objects is the designed path. Bound it like any listing: type + relation filters, pagination, and product limits (see quiz q7 — unbounded reverse queries are a DoS vector).</li>
                </ul>
            </div>
            ${renderPolicyLab('Trace how team-transitive paths resolve through two hops.')}
        `,

        concepts: ["Model Versioning", "Tuple Writes and Revocation", "List-Objects", "Contextual Tuples", "Cache Invalidation on Revoke"],

        quiz: {
            id: "fga_prod_quiz",
            title: "OpenFGA in Production Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 480,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "A user unshares a document (tuple deleted) but keeps access for 60 seconds. Most likely cause?",
                    options: [
                        { text: "Check-result cache outliving the revocation — invalidate on tuple writes", isCorrect: true },
                        { text: "The model file was too large", isCorrect: false },
                        { text: "The user guessed another URL", isCorrect: false },
                        { text: "Check API is eventually consistent by design for hours", isCorrect: false }
                    ],
                    explanation: "Revocation must invalidate cached allows. Cache TTL is a security parameter, not just a performance knob.",
                    difficulty: 2, concept: "Cache Invalidation on Revoke"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "A dashboard must show all documents anne can view. Efficient approach?",
                    options: [
                        { text: "List-objects for (anne, viewer, document) — one designed call", isCorrect: true },
                        { text: "Check every document id in a loop", isCorrect: false },
                        { text: "Show all documents and 403 on click", isCorrect: false },
                        { text: "Disable authorization for dashboards", isCorrect: false }
                    ],
                    explanation: "List-objects answers the reverse query (subject→objects) natively. Per-object checks for listing is N+1 authZ.",
                    difficulty: 2, concept: "List-Objects"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "Where must contextual tuples (time/IP) be tested?",
                    options: [
                        { text: "Against a real OpenFGA server — time/IP gating needs conditions + context, not playground clicks", isCorrect: true },
                        { text: "Only in the playground", isCorrect: false },
                        { text: "They need no testing", isCorrect: false },
                        { text: "In the browser console", isCorrect: false }
                    ],
                    explanation: "Docs-verified limitation. Playground-green + server-red is the failure this question prevents.",
                    difficulty: 2, concept: "Contextual Tuples"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "Sharing is saved to your DB but the tuple write fails. Result and fix?",
                    options: [
                        { text: "User sees nothing (deny) — write tuples transactionally with domain writes", isCorrect: true },
                        { text: "User gets admin — fail open is fine here", isCorrect: false },
                        { text: "Nothing happens, tuples are optional", isCorrect: false },
                        { text: "The model auto-creates missing tuples", isCorrect: false }
                    ],
                    explanation: "Fail-closed saves you (deny), but the UX is broken. Same-transaction/outbox writes keep share-state and authZ-state consistent.",
                    difficulty: 3, concept: "Tuple Writes and Revocation"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "Why keep every published model version?",
                    options: [
                        { text: "Audits and rollbacks: know which semantics past decisions used", isCorrect: true },
                        { text: "They take up no space", isCorrect: false },
                        { text: "OpenFGA requires daily model writes", isCorrect: false },
                        { text: "Versions make checks faster", isCorrect: false }
                    ],
                    explanation: "Model edits reinterpret stored tuples. Version history lets you answer 'why was this allowed in March?' and roll back meaning.",
                    difficulty: 2, concept: "Model Versioning"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "Sharing succeeds in the app DB but the tuple write times out. State?",
                                options: [
                                    { text: "Inconsistent — user sees nothing (deny) but believes it shared; reconcile via outbox/retry", isCorrect: true },
                                    { text: "Fine — the app DB is the source of truth", isCorrect: false },
                                    { text: "Grant admin to compensate", isCorrect: false },
                                    { text: "Delete the document", isCorrect: false }
                                ],
                                explanation: "Fail-closed saves the data but breaks the UX. Dual-write needs outbox reconciliation, not hope.",
                                difficulty: 2, concept: "Tuple Writes and Revocation"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "List-objects returns 50,000 objects for a super-admin dashboard. Fix?",
                                options: [
                                    { text: "Paginate and scope the query (type and relation filters) — authorization output needs product limits too", isCorrect: true },
                                    { text: "Disable list-objects", isCorrect: false },
                                    { text: "Return all fifty thousand always", isCorrect: false },
                                    { text: "Cache the full set forever", isCorrect: false }
                                ],
                                explanation: "Reverse queries still need bounds. Unbounded authorization output is a DoS vector wearing a feature costume.",
                                difficulty: 2, concept: "List-Objects"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "You must rename a relation. Safe sequence?",
                                options: [
                                    { text: "Add the new relation, dual-write tuples, migrate checks, then remove the old — a schema migration", isCorrect: true },
                                    { text: "Rename in place on a Friday", isCorrect: false },
                                    { text: "Delete all tuples first", isCorrect: false },
                                    { text: "Relations can never be renamed", isCorrect: false }
                                ],
                                explanation: "Relation renames reinterpret stored tuples. Expand-migrate-contract, exactly like database schemas.",
                                difficulty: 1, concept: "Model Versioning"
                            }
                        ]
                    },
        animation: {
            type: "openfga-graph",
            title: "Production Check Paths",
            description: "Trace multi-hop resolution the way check() does",
            controls: ["setFgaScenario"]
        }
    };

    // =========================================================================
    // LESSON 15: Kubernetes Admission with Gatekeeper
    // =========================================================================
    COURSE_DATA.levels.advanced.lessons.k8s_gatekeeper = {
        id: "k8s_gatekeeper",
        title: "K8s Admission with Gatekeeper",
        subtitle: "ConstraintTemplates, Constraints, and deny",
        level: "advanced",
        number: 15,
        estimatedTime: 70,
        difficulty: 4,
        prerequisites: ["opa_production"],

        content: `
            <div class="lesson-section">
                <h3>🚪 Policy at the Cluster Door</h3>
                <p><strong>Requires:</strong> basic Pod/YAML familiarity (reading <code>spec.containers</code>). No cluster needed — review the manifests statically.</p>
                <p>Admission control is authorization for the orchestrator: every create/update to the API server passes Gatekeeper's webhook before etcd. Two objects: a <strong>ConstraintTemplate</strong> (the Rego rule, written once) and <strong>Constraints</strong> (instances with parameters and match scope, written per team). Verified against Gatekeeper docs and library patterns:</p>
                ${createCodeBlock(`# Last verified: 2026-09 vs Gatekeeper docs (ConstraintTemplate + library)
apiVersion: templates.gatekeeper.sh/v1
kind: ConstraintTemplate
metadata:
  name: k8sallowedrepos
spec:
  # Mandatory: the CRD backing Constraint instances (apply fails without it)
  crd:
    spec:
      names:
        kind: K8sAllowedRepos
      validation:
        openAPIV3Schema:
          type: object
  targets:
    - target: admission.k8s.gatekeeper.sh
      rego: |
        package k8sallowedrepos
        # Library pattern: ALL container lists, or init/ephemeral bypass you
        all_containers[c] { c := input.review.object.spec.containers[_] }
        all_containers[c] { c := input.review.object.spec.initContainers[_] }
        all_containers[c] { c := input.review.object.spec.ephemeralContainers[_] }
        violation[{"msg": msg}] if {
          not startswith(all_containers[_].image, "corp-registry.example.com/")
          msg := sprintf("image %v is not from the allowlisted registry", [all_containers[_].image])
        }`, 'rego', 'ConstraintTemplate: CRD + all-containers violation (verified pattern)')}
                ${createCodeBlock(`apiVersion: constraints.gatekeeper.sh/v1beta1
kind: K8sAllowedRepos
metadata:
  name: prod-allowlist
spec:
  enforcementAction: deny        # deny | dryrun | warn
  match:
    kinds:
      - apiGroups: [""]
        kinds: ["Pod"]
    excludedNamespaces: [kube-system, gatekeeper-system]`, 'yaml', 'Constraint: scope + enforcement action')}
            </div>

            <div class="lesson-section">
                <h3>🔍 Critical Review Notes</h3>
                <ul>
                    <li><strong>Containers AND initContainers AND ephemeralContainers:</strong> the library pattern checks all three. Guarding only <code>spec.containers</code> is a bypass with a YAML edit.</li>
                    <li><strong>Start with <code>dryrun</code>:</strong> new constraints audit first (violations logged, nothing blocked), then flip to <code>deny</code>. Big-bang deny on a brownfield cluster is a self-inflicted outage.</li>
                    <li><strong>exemptImages has no per-namespace scoping:</strong> docs-verified — different namespaces needing different exemptions require separate constraints, not one clever parameter.</li>
                    <li><strong>Mutation exists (Assign/AssignImage):</strong> defaulting digests and labels is powerful — and a second write path to review with the same rigor as deny rules.</li>
                    <li><strong>Audit vs enforce:</strong> <code>enforcementAction</code> is per-Constraint (deny/dryrun/warn) AND the <code>audit</code> loop re-checks existing objects on a schedule — admission gates new writes, audit catches what predates the policy. Run both; neither alone covers the estate.</li>
                    <li><strong>Data replication for cross-object rules:</strong> admission review sees one object — rules joining against other resources (e.g. allowed registries ConfigMap) need <code>config.spec.sync</code> replication configured, or the rule evaluates against an empty cache and misfires.</li>
                    <li><strong>Scope with namespaceSelector, plan webhook failure:</strong> prefer <code>namespaceSelector</code>/label scoping over name lists; and decide the webhook failure policy up front (fail-closed blocks deploys during Gatekeeper outages — rehearse it, or the first outage decides for you).</li>
                </ul>
            </div>
            ${renderPolicyLab('Compare sidecar vs gateway vs admission: who decides, when, with what blast radius.')}
        `,

        concepts: ["Admission Control", "ConstraintTemplates", "Constraint Scope", "Dry-Run First", "Container Coverage", "Mutation Review"],

        quiz: {
            id: "gatekeeper_quiz",
            title: "Gatekeeper Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 420,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "What is the split between ConstraintTemplate and Constraint?",
                    options: [
                        { text: "Template holds the Rego rule once; Constraints instantiate it with parameters and match scope", isCorrect: true },
                        { text: "They are synonyms", isCorrect: false },
                        { text: "Templates enforce, Constraints merely document", isCorrect: false },
                        { text: "Constraints hold Rego, Templates hold YAML", isCorrect: false }
                    ],
                    explanation: "Write the logic once, scope it per team. Templates are code; Constraints are configuration.",
                    difficulty: 1, concept: "ConstraintTemplates"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "A Pod runs a privileged initContainer while containers are clean. A containers-only image policy verdict?",
                    options: [
                        { text: "Misses it — initContainers (and ephemeralContainers) need the same checks", isCorrect: true },
                        { text: "Blocks it anyway", isCorrect: false },
                        { text: "Init containers cannot be privileged", isCorrect: false },
                        { text: "The Pod is rejected for other reasons", isCorrect: false }
                    ],
                    explanation: "The library pattern enumerates all three container lists. Partial coverage is a documented bypass.",
                    difficulty: 2, concept: "Container Coverage"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "Rolling a new image-allowlist onto a brownfield cluster. First enforcementAction?",
                    options: [
                        { text: "dryrun — audit violations first, flip to deny after triage", isCorrect: true },
                        { text: "deny immediately everywhere", isCorrect: false },
                        { text: "Delete all workloads first", isCorrect: false },
                        { text: "Disable the webhook", isCorrect: false }
                    ],
                    explanation: "Unknown estate plus instant deny equals outage. Dry-run measures the blast radius before you create it.",
                    difficulty: 1, concept: "Dry-Run First"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "Two namespaces need different image exemptions. Approach?",
                    options: [
                        { text: "Separate Constraints — exemptImages has no per-namespace scoping", isCorrect: true },
                        { text: "One Constraint with a clever exemptImages map", isCorrect: false },
                        { text: "Exempt both namespaces entirely", isCorrect: false },
                        { text: "Exemptions are impossible", isCorrect: false }
                    ],
                    explanation: "Docs-verified limitation. Fighting it with custom Rego forks you from the maintained library.",
                    difficulty: 2, concept: "Constraint Scope"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "Where does admission control sit in the request path?",
                    options: [
                        { text: "Between API-server receipt and etcd persist — every create/update passes the webhook", isCorrect: true },
                        { text: "Inside each container at runtime", isCorrect: false },
                        { text: "In the CI pipeline only", isCorrect: false },
                        { text: "After the Pod is already running", isCorrect: false }
                    ],
                    explanation: "Admission is deploy-time authorization for the orchestrator. Runtime needs its own controls.",
                    difficulty: 1, concept: "Admission Control"
                },
                {
                    id: "q6", type: "multiple-choice",
                    question: "AssignImage pins nginx to a digest via mutation. Review posture?",
                    options: [
                        { text: "Same rigor as deny rules — mutation is a second write path into every Pod", isCorrect: true },
                        { text: "Mutations are safe by definition", isCorrect: false },
                        { text: "No review needed for defaults", isCorrect: false },
                        { text: "Mutations cannot affect security", isCorrect: false }
                    ],
                    explanation: "Anything that rewrites workloads is privileged. Mutation policies get tests, review, and dry-run too.",
                    difficulty: 2, concept: "Mutation Review"
                },
                {
                    id: "q7", type: "multiple-choice",
                    question: "excludedNamespaces lists kube-system and gatekeeper-system. Why?",
                    options: [
                        { text: "So policy infrastructure itself is never blocked by its own rules", isCorrect: true },
                        { text: "Those namespaces are insecure by design", isCorrect: false },
                        { text: "To speed up the webhook", isCorrect: false },
                        { text: "Exclusions are mandatory syntax", isCorrect: false }
                    ],
                    explanation: "Self-lockout is the classic admission failure. The controller that enforces policy must stay schedulable.",
                    difficulty: 2, concept: "Constraint Scope"
                },
                {
                    id: "q8", type: "multiple-choice",
                    question: "A workload violates a dryrun constraint. What happens to the deploy?",
                    options: [
                        { text: "It proceeds; the violation is logged for triage", isCorrect: true },
                        { text: "It is blocked", isCorrect: false },
                        { text: "The cluster pauses", isCorrect: false },
                        { text: "The violation is deleted", isCorrect: false }
                    ],
                    explanation: "Dry-run is measurement mode. The log it produces is the evidence base for flipping to deny.",
                    difficulty: 1, concept: "Dry-Run First"
                }
            ]
        },
        animation: {
            type: "auth-patterns",
            title: "Admission vs Sidecar vs Gateway",
            description: "Deploy-time vs request-time enforcement compared",
            controls: ["setAuthPattern"]
        }
    };

    // =========================================================================
    // LESSON 16: Policy as Code in CI with Conftest
    // =========================================================================
    COURSE_DATA.levels.advanced.lessons.conftest_ci = {
        id: "conftest_ci",
        title: "Policy in CI with Conftest",
        subtitle: "deny_ rules, exceptions, shift-left gates",
        level: "advanced",
        number: 16,
        estimatedTime: 60,
        difficulty: 2,
        prerequisites: ["rego_foundations"],

        content: `
            <div class="lesson-section">
                <h3>⬅️ Shift-Left: Fail the PR, Not the Deploy</h3>
                <p>Gatekeeper guards the cluster; <strong>Conftest</strong> guards the repo. Same Rego language, earlier in the lifecycle: Dockerfiles, Kubernetes manifests, Terraform, and configs get tested on every pull request. Verified against the Conftest README and docs:</p>
                ${createCodeBlock(`# Last verified: 2026-09 vs conftest README (package main, deny regroup)
package main

deny contains msg if {
  input.kind == "Deployment"
  not input.spec.template.spec.securityContext.runAsNonRoot

  msg := "Containers must not run as root"
}

deny contains msg if {
  input.kind == "Deployment"
  not input.spec.selector.matchLabels.app

  msg := "Containers must provide app label for pod selectors"
}

# $ conftest test deployment.yaml
# FAIL - deployment.yaml - Containers must not run as root
# FAIL - deployment.yaml - Containers must provide app label for pod selectors
# 2 tests, 0 passed, 0 warnings, 2 failures, 0 exceptions
#
# Runnable layout: policy/deny.rego + policy/exceptions.rego, then
# $ conftest test -p policy deployment.yaml
# $ conftest test -p policy --all-namespaces manifests/   # multi-doc sweep`, 'rego', 'Conftest: deny regroup over manifests, CLI-verbatim output')}
            </div>

            <div class="lesson-section">
                <h3>🚪 Exceptions Are Policy Too</h3>
                <p>Blanket rules need escape hatches — but the hatch is itself versioned policy, not a Slack approval. Docs-verified exception pattern plus the <code>deny_</code>-prefix convention for unit-testable rules:</p>
                ${createCodeBlock(`# Last verified: 2026-09 vs conftest docs/exceptions + docs/index (deny_ prefix)
package main

deny_run_as_root contains msg if {
  input.kind == "Deployment"
  not input.spec.template.spec.securityContext.runAsNonRoot
  msg := "Containers must not run as root"
}

exception contains rules if {
  input.kind == "Deployment"
  input.metadata.name == "can-run-as-root"
  rules := ["run_as_root"]
}
# deny_ prefix: target one rule in tests instead of matching message strings.
# The aggregation the prefix requires (per conftest testing docs):
no_violations if { count(deny_run_as_root) == 0 }
# Note: pod-level runAsNonRoot only — per-container securityContext settings
# need an additional input.spec.template.spec.containers[_].securityContext
# check, or per-container violations slip through.`, 'rego', 'Conftest exceptions + testable deny_ rules')}
            </div>

            <div class="lesson-section">
                <h3>🔍 Critical Review Notes</h3>
                <ul>
                    <li><strong>CI complements admission, never replaces it:</strong> repo-time checks pass on what is committed; admission checks what is actually applied (kubectl --validate=false, GitOps drift, emergency edits all bypass CI).</li>
                    <li><strong>Exceptions expire or they accumulate:</strong> every exception rule gets an owner and an expiry; review the exception list with the same cadence as the deny list. Scope exceptions by namespace + labels, not bare workload name — a name-only exception follows the name anywhere it is reused.</li>
                    <li><strong>Test the tests:</strong> <code>deny_</code> prefixes plus per-rule unit tests keep suites readable past a dozen rules — message-matching monoliths rot.</li>
                </ul>
            </div>
            ${renderPolicyLab('Toggle a manifest between compliant and violating; watch which rule fires.')}
        `,

        concepts: ["Shift-Left Gates", "Deny Regroup", "Versioned Exceptions", "Testable Rules", "CI Plus Admission", "Exception Expiry"],

        quiz: {
            id: "conftest_quiz",
            title: "Conftest CI Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 420,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "A Deployment runs as root and lacks the app label. conftest test output?",
                    options: [
                        { text: "Two FAIL lines, one per violated deny rule, plus the summary count", isCorrect: true },
                        { text: "Silent pass with exit 0", isCorrect: false },
                        { text: "The manifest is auto-fixed", isCorrect: false },
                        { text: "Only the first violation is reported", isCorrect: false }
                    ],
                    explanation: "CLI-verbatim behavior: every violated message prints; the summary counts tests, passes, warnings, failures, exceptions.",
                    difficulty: 1, concept: "Deny Regroup"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "Why does Conftest belong in CI if Gatekeeper already guards the cluster?",
                    options: [
                        { text: "CI checks what is committed; admission checks what is applied — drift and emergency edits bypass CI", isCorrect: true },
                        { text: "It doesn't — admission makes CI redundant", isCorrect: false },
                        { text: "CI is faster than webhooks", isCorrect: false },
                        { text: "Gatekeeper cannot read YAML", isCorrect: false }
                    ],
                    explanation: "Defense in depth across lifecycle stages: shift-left for speed, admission for ground truth.",
                    difficulty: 2, concept: "CI Plus Admission"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "The can-run-as-root Deployment needs its exemption. Correct form?",
                    options: [
                        { text: "A versioned exception rule naming the workload and the exempted rule ids", isCorrect: true },
                        { text: "A Slack message to the team", isCorrect: false },
                        { text: "Deleting the deny rule", isCorrect: false },
                        { text: "Renaming the workload randomly", isCorrect: false }
                    ],
                    explanation: "Exceptions are policy: named, scoped, reviewable — never tribal knowledge.",
                    difficulty: 1, concept: "Versioned Exceptions"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "What does the deny_ prefix convention buy you?",
                    options: [
                        { text: "Per-rule unit tests instead of message-string matching, at the cost of one aggregation rule", isCorrect: true },
                        { text: "Faster Rego evaluation", isCorrect: false },
                        { text: "Automatic exception generation", isCorrect: false },
                        { text: "Nothing — pure style", isCorrect: false }
                    ],
                    explanation: "Docs-verified trade: target rules directly in tests; maintain no_violations aggregation. Suite readability past a dozen rules.",
                    difficulty: 2, concept: "Testable Rules"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "Which files does conftest test beyond Kubernetes manifests?",
                    options: [
                        { text: "Dockerfiles, Terraform, and structured configs — any data the Rego can read", isCorrect: true },
                        { text: "Only Go source files", isCorrect: false },
                        { text: "Only PNG images", isCorrect: false },
                        { text: "Nothing else", isCorrect: false }
                    ],
                    explanation: "Conftest tests configuration data broadly. Policy-as-code covers the whole repo, not just the cluster.",
                    difficulty: 1, concept: "Shift-Left Gates"
                },
                {
                    id: "q6", type: "multiple-choice",
                    question: "An exception list grows to forty entries with no owners. Diagnosis?",
                    options: [
                        { text: "Exception debt — every entry needs an owner and expiry, reviewed with the deny list", isCorrect: true },
                        { text: "Healthy policy evolution", isCorrect: false },
                        { text: "A sign to delete all deny rules", isCorrect: false },
                        { text: "Nothing — exceptions don't matter", isCorrect: false }
                    ],
                    explanation: "Unexpiring exceptions are permits wearing a costume. Govern the hatch with the same cadence as the wall.",
                    difficulty: 2, concept: "Exception Expiry"
                },
                {
                    id: "q7", type: "multiple-choice",
                    question: "Emergency kubectl edit bypasses CI and violates policy. What catches it?",
                    options: [
                        { text: "Admission control (Gatekeeper) — the cluster-door check CI cannot replace", isCorrect: true },
                        { text: "Nothing — emergencies are exempt from policy", isCorrect: false },
                        { text: "The next CI run retroactively", isCorrect: false },
                        { text: "The developer's memory", isCorrect: false }
                    ],
                    explanation: "This is the CI-plus-admission argument in one incident: commit-time gates never see out-of-band writes.",
                    difficulty: 2, concept: "CI Plus Admission"
                },
                {
                    id: "q8", type: "multiple-choice",
                    question: "A monolithic deny rule's tests match on message strings and break on every reword. Fix?",
                    options: [
                        { text: "Split into deny_-prefixed rules with per-rule tests", isCorrect: true },
                        { text: "Freeze all message wording forever", isCorrect: false },
                        { text: "Delete the tests", isCorrect: false },
                        { text: "Match on line numbers instead", isCorrect: false }
                    ],
                    explanation: "Test structure should follow rule structure. Prefixes make rules addressable; strings make tests brittle.",
                    difficulty: 2, concept: "Testable Rules"
                }
            ]
        },
        animation: {
            type: "default-deny-sim",
            title: "Compliant vs Violating Manifests",
            description: "Flip fields and watch deny rules fire per rule",
            controls: ["setDenyScenario", "toggleDenyRules"]
        }
    };

    // =========================================================================
    // LESSON 17: Immuta Data Policies
    // =========================================================================
    COURSE_DATA.levels.advanced.lessons.immuta_policies = {
        id: "immuta_policies",
        title: "Immuta Data Policies",
        subtitle: "Subscription, masking, and row rules by tag",
        level: "advanced",
        number: 17,
        estimatedTime: 75,
        difficulty: 3,
        prerequisites: ["conftest_ci"],

        content: `
            <div class="lesson-section">
                <h3>🎫 Two Policy Kinds, Three Scopes (Verified vs 2026.1 Docs)</h3>
                <ul>
                    <li><strong>Subscription policies</strong> = table access (who may subscribe). <strong>Data policies</strong> = inside the table (row filters, column/cell masking).</li>
                    <li><strong>Scopes:</strong> local (one table) → domain (domain's tables) → <strong>global</strong> (by tag across the estate — write once, e.g. <em>mask tag PII everywhere</em>).</li>
                    <li><strong>Merge logic (no shortcuts — see table below):</strong> <em>row/data</em> policies AND together (OR only inside one policy). <em>Subscription ABAC</em> merge is per-policy: <code>Always Required</code> = AND, <code>Share Responsibility</code> = OR. Non-ABAC subscription conflicts (Anyone / Anyone-who-asks / Individual users) resolve by <strong>descending policy-name order</strong> with owner override — renaming a policy can flip enforcement. Guardrails, where they apply, are always required on top of any grant.</li>
                </ul>
                <table>
                    <thead><tr><th>Policy kind</th><th>Combine</th><th>Example</th></tr></thead>
                    <tbody>
                        <tr><td>Row / data policies</td><td>AND (all apply)</td><td>Two row filters both filter; OR needs one policy with OR inside</td></tr>
                        <tr><td>Subscription ABAC, Always Required</td><td>AND</td><td>Must satisfy this grant AND any other applicable grant</td></tr>
                        <tr><td>Subscription ABAC, Share Responsibility</td><td>OR</td><td>Any one Share Responsibility grant suffices (guardrails still AND on top)</td></tr>
                        <tr><td>Non-ABAC subscription conflict</td><td>Descending name order + owner override</td><td>Renaming Zebra→Alpha can flip the winner — treat renames as policy changes</td></tr>
                        <tr><td>Guardrails</td><td>Always AND on top</td><td>Training-complete required even with manager approval (see quiz q4)</td></tr>
                    </tbody>
                </table>
                <p><strong>Staging procedure (do not edit globals live):</strong> 1) draft in a dev project on sampled tables → 2) staged=true dry-run, verify Pending→Enforced and row counts on a canary table → 3) run the lockout test (mis-scoped table must return zero rows) → 4) promote with staged=false plus rollback note (previous tag mapping + policy export).</p>
                ${createCodeBlock(`# SHAPE-ILLUSTRATIVE — field names simplified; verify against the
# Immuta 2026.1 v2 policy API / builder before pasting anywhere.
# Last verified (semantics): 2026-09 vs Immuta policy API + data-policy docs.
name: Finance PII masking
policyKey: data masking pii       # global data policy, applies by tag
type: data
actions:
  type: mask
  maskType: hash                  # intelligent fallback: numerics -> NULL
  exceptions:                     # exclusionary condition
    groups: [AUDIT]               # everyone masked EXCEPT auditors
circumstances:                    # tag targeting lives HERE, not in actions
  - type: columnTags               # NOT literal column names: tags survive renames
    columnTag: PII
staged: false`, 'yaml', 'Immuta global masking: tag-targeted, auditor exception')}
            </div>

            <div class="lesson-section">
                <h3>🧠 Advanced DSL: Attributes Meeting Tags</h3>
                <p>The reviewed Advanced-DSL pattern subscribes users whose <strong>attribute matches a tag on the data source</strong> — ABAC without per-table rules:</p>
                ${createCodeBlock(`# Spelling confirmed 2026-09 vs Immuta Advanced-DSL guide
# (advanced-dsl-policies: "@hasTagsAsAttribute('Department', 'dataSource')").
# SHAPE-ILLUSTRATIVE around it — build in the UI/API and diff the export.
# Performance note from the docs: thousands of @table-permutation rules
# slow resolution — prefer tag/attribute patterns like this one.
name: Department auto-subscribe
policyKey: subscription entitlements advanced boolean
type: subscription
actions:
  type: entitlements
  advanced: "@hasTagsAsAttribute('Department', 'dataSource')"
  # Department.Marketing users auto-subscribe to Marketing-tagged sources
  automaticSubscription: true   # trade-off: thousands of auto-subscribed
  allowDiscovery: false         # tables is a UX/cost decision, not free`, 'yaml', 'Immuta Advanced DSL: attribute-equals-tag subscription')}
            </div>

            <div class="lesson-section">
                <h3>🔍 Critical Review Notes (Straight From the Docs)</h3>
                <ul>
                    <li><strong>Intelligent fallbacks:</strong> hashing a numeric column would corrupt its type — Immuta falls back to NULL automatically. Never hand-roll hash-on-numeric.</li>
                    <li><strong>Lockout policy:</strong> a global row-filter referencing a column a table lacks (use <code>@columnTagged</code>, not hard-coded names) blocks ALL rows rather than leaking. Fail-closed at the data plane.</li>
                    <li><strong>Deeper tag wins — with a tie-break:</strong> <code>PII.SSN</code> policy beats <code>PII</code> policy on the same column; at the <strong>same depth the earliest-authored policy wins</strong> — never rely on creation order, consolidate the policies instead.</li>
                    <li><strong>Row filters AND together:</strong> two row policies both apply; to OR them, build one policy with an OR.</li>
                </ul>
            </div>
            <div class="lesson-section">
                <h3>🔒 Lock-in / Bill / Exit (Read Before You Commit)</h3>
                <ul>
                    <li><strong>Lock-in (documented):</strong> SaaS control plane holds your tag taxonomy, policy definitions, and audit history; enforcement is per-compute integration (Snowflake/Databricks/etc.). Your governance metadata gravity wells here.</li>
                    <li><strong>Bill (estimate — confirm current pricing):</strong> platform subscription plus per-compute/enforcement footprint; thousands of auto-subscribed tables and @table-permutation rules also cost resolution time and UX noise (see DSL note above).</li>
                    <li><strong>Exit (documented pattern):</strong> tag taxonomy ports as column/table labels; masking/row logic rewrites to native Snowflake masking + row-access policies or Databricks Unity Catalog views/RLS. Budget a rewrite — there is no policy export that executes elsewhere.</li>
                </ul>
            </div>
            ${renderPolicyLab('Switch viewer roles and watch PII masking vs auditor exception vs owner bypass.')}
        `,

        concepts: ["Subscription vs Data Policies", "Grant OR / Guardrail AND", "Masking Fallbacks", "Lockout Fail-Closed", "Advanced Tag DSL"],

        quiz: {
            id: "immuta_quiz",
            title: "Immuta Policies Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 480,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "What is the difference between subscription and data policies?",
                    options: [
                        { text: "Subscription = table access; data = rows/columns/cells inside subscribed tables", isCorrect: true },
                        { text: "They are identical synonyms", isCorrect: false },
                        { text: "Subscription is for databases, data is for email", isCorrect: false },
                        { text: "Data policies replace authentication", isCorrect: false }
                    ],
                    explanation: "Docs-verified split: subscription gates the table; data policies shape what subscribed users see inside it.",
                    difficulty: 1, concept: "Subscription vs Data Policies"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "Two global subscription grants (one Always Required, one Share Responsibility) and one guardrail apply. An admin renames the Share Responsibility policy from 'Zebra' to 'Alpha'. What must you check? (see merge truth table above)",
                    options: [
                        { text: "Whether non-ABAC conflicts now resolve differently — name order decides them, and the Always Required grant still ANDs with everything", isCorrect: true },
                        { text: "Nothing — renames never affect enforcement", isCorrect: false },
                        { text: "Only whether the guardrail still exists", isCorrect: false },
                        { text: "Nobody — policies conflict so nobody gets in", isCorrect: false }
                    ],
                    explanation: "Real merge rules: subscription ABAC merge is per-policy (Always Required=AND, Share Responsibility=OR); non-ABAC conflicts resolve by descending name order with owner override — so renames CAN flip enforcement. Guardrails stay mandatory on top.",
                    difficulty: 3, concept: "Grant OR / Guardrail AND"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "A hash-masking policy hits a numeric salary column. What happens?",
                    options: [
                        { text: "Intelligent fallback to NULL (hash would corrupt the numeric type)", isCorrect: true },
                        { text: "The column is hashed into a string, breaking the schema", isCorrect: false },
                        { text: "The policy is silently skipped, exposing raw salaries", isCorrect: false },
                        { text: "The table is deleted", isCorrect: false }
                    ],
                    explanation: "Docs-verified fallback preserves type safety AND privacy level. Hand-rolled masking gets this wrong.",
                    difficulty: 2, concept: "Masking Fallbacks"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "A global row-filter references a column that one table lacks. Result on that table?",
                    options: [
                        { text: "Lockout: zero rows returned until the policy is fixed (fail-closed, no leak)", isCorrect: true },
                        { text: "All rows returned unfiltered", isCorrect: false },
                        { text: "The table is dropped", isCorrect: false },
                        { text: "Only admins see rows", isCorrect: false }
                    ],
                    explanation: "Lockout trades availability for confidentiality on mis-scoped globals — and is why @columnTagged beats hard-coded column names.",
                    difficulty: 3, concept: "Lockout Fail-Closed"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "What does @hasTagsAsAttribute('Department', 'dataSource') achieve?",
                    options: [
                        { text: "Auto-subscribes users whose Department attribute matches the source's tag — ABAC without per-table rules", isCorrect: true },
                        { text: "Deletes all department tags", isCorrect: false },
                        { text: "Grants everyone admin", isCorrect: false },
                        { text: "Disables all subscription policies", isCorrect: false }
                    ],
                    explanation: "The reviewed Advanced-DSL pattern: attribute-meets-tag scales onboarding to zero-touch per-table work.",
                    difficulty: 2, concept: "Advanced Tag DSL"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "A user is subscribed to a table but sees zero rows. Which layer is responsible?",
                                options: [
                                    { text: "Data policy (row filter or lockout) — subscription gates the table, data policies shape rows", isCorrect: true },
                                    { text: "Authentication", isCorrect: false },
                                    { text: "DNS resolution", isCorrect: false },
                                    { text: "The UI theme", isCorrect: false }
                                ],
                                explanation: "Empty tables with valid subscriptions are data-policy behavior. Debug rows at the data layer, access at the subscription layer.",
                                difficulty: 2, concept: "Subscription vs Data Policies"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "Attribute Office values drift from tag values (NYC vs New York). Consequence?",
                                options: [
                                    { text: "Silent unsubscribes — attribute and tag vocabularies need joint governance", isCorrect: true },
                                    { text: "Auto-corrected by fuzzy matching", isCorrect: false },
                                    { text: "Nothing breaks", isCorrect: false },
                                    { text: "Everyone gets granted admin", isCorrect: false }
                                ],
                                explanation: "Attribute-meets-tag only works when both sides spell values identically. Vocabulary drift is silent access loss.",
                                difficulty: 2, concept: "Advanced Tag DSL"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "A staged global policy shows Pending for an hour. Meaning?",
                                options: [
                                    { text: "Still propagating to remote platforms — verify enforcement before announcing anything", isCorrect: true },
                                    { text: "It is broken and ignored", isCorrect: false },
                                    { text: "It was auto-approved", isCorrect: false },
                                    { text: "Pending means denied", isCorrect: false }
                                ],
                                explanation: "Policy push is eventually consistent across computes. Pending is a state to monitor, not an outcome to assume.",
                                difficulty: 3, concept: "Lockout Fail-Closed"
                            }
                        ]
                    },
        animation: {
            type: "data-masking-sim",
            title: "Masking Policy Simulator",
            description: "Analyst NULL vs auditor hash vs owner bypass on a PII table",
            controls: ["setMaskRole"]
        }
    };

    // =========================================================================
    // LESSON 18: PlainID Enterprise Policies
    // =========================================================================
    COURSE_DATA.levels.advanced.lessons.plainid_policies = {
        id: "plainid_policies",
        title: "PlainID Enterprise Policies",
        subtitle: "WHO/WHAT/WHEN, structured Rego, PDP APIs",
        level: "advanced",
        number: 18,
        estimatedTime: 75,
        difficulty: 4,
        prerequisites: ["conftest_ci"],

        content: `
            <div class="lesson-section">
                <h3>🧭 WHO / WHAT / WHEN (Wizard, Verified)</h3>
                <p>PlainID's Policy Wizard structures every policy as: <strong>WHO</strong> (dynamic groups get access), <strong>WHAT</strong> (asset types + action-ruleset combinations), <strong>WHEN</strong> (conditions). Access type is <strong>Allow or Restrict</strong>; dynamic authorization and SaaS management are separate policy uses. A policy without WHAT is invalid — WHO alone grants nothing.</p>
                ${createCodeBlock(`# Last verified: 2026-09 vs PlainID structured-Rego docs
# WHO: Gold + Standard external customers
dynamic_group(identity) if {
  identity.template == "User"
  identity["User_Type"] == "External"
  identity["Membership_Type"] == "Gold"
}

# WHAT: own accounts (View) + own cards (Manage, View)
ruleset(asset, identity, requestParams, action) if {
  asset.template == "Bank Accounts"
  asset["account_owner"] == identity["Userid_identity"]
  action.id in ["View"]
}

# WHEN: step-up MFA condition
condition_request(requestParams, identity) if {
  requestParams["Auth_Method"] == "MFA"
}`, 'rego', 'PlainID structured Rego: dynamic_group + ruleset + condition')}
            </div>

            <div class="lesson-section">
                <h3>📨 PDP APIs: Permit-Deny and Resolution</h3>
                <ul>
                    <li><strong>Permit/Deny (incl. V5 API-access endpoint, verified 2026-09):</strong> the original REST call (headers, URI path array, body) is forwarded; API matchers/mappers extract AssetID + request attributes; identity mappers parse the JWT. Returns permit/deny + optional deny reasons and asset attributes. Paths/payloads vary by tenant version — confirm against your tenant's V5 API-access docs before scripting. Matcher/mapper shape (illustrative — export yours from the console and diff):</li>
                </ul>
                ${createCodeBlock(`{ "apiMatcher": { "method": "GET", "pathPrefix": "/accounts/" },
  "assetMapper": { "assetTemplate": "Bank Accounts",
    "assetIdFrom": "path.segment[1]" },
  "identityMapper": { "from": "jwt.claims",
    "map": { "Userid_identity": "sub", "User_Type": "custom.user_type" } } }`, 'json', 'PlainID API-access mapper: REST call to asset + identity (shape-illustrative)')}
                <ul>
                    <li><strong>Scope hierarchy note:</strong> Scopes bound Policies → assets → identities. Multi-identity AND (see below) is evaluated per Scope, not globally — audit the Scope flag on every Scope that serves agents, or agents ride unevaluated in default mode.</li>
                    <li><strong>Policy Resolution:</strong> answers <em>what filters for this user?</em> for SQL/search/big-data enforcement done by another system — returns allowed attribute-filters, not just booleans.</li>
                    <li><strong>Multi-identity evaluation (Scope-gated):</strong> up to three identities from different templates (human + agent + app) evaluated with AND semantics — <strong>but only when <code>Use Multiple Identities Combination</code> is enabled on the Scope (disabled by default)</strong>. More than three identities = request error. In default single-identity mode, other templates' rules are ignored — an agent riding along unevaluated is an over-grant, not defense in depth.</li>
                </ul>
                <table>
                    <thead><tr><th>API</th><th>Answers</th><th>Staleness / failure mode</th></tr></thead>
                    <tbody>
                        <tr><td>Permit/Deny (+V5)</td><td>May they do this?</td><td>Real-time per call; PDP-down must fail closed (deny + alert)</td></tr>
                        <tr><td>Policy Resolution</td><td>What filters for them?</td><td>Filters computed at call time; re-resolve on policy/attribute change, never cache across revocations</td></tr>
                        <tr><td>User Access Token</td><td>Session credential</td><td>NOT real-time; large asset sets hit memory/perf limits — revalidate for high-risk actions</td></tr>
                        <tr><td>Unavailable identity source</td><td>Limited response</td><td>Missing attributes resolve against what IS available — treat limited responses as deny-by-default unless explicitly risk-accepted</td></tr>
                    </tbody>
                </table>
            </div>

            <div class="lesson-section">
                <h3>🔍 Critical Review Notes</h3>
                <ul>
                    <li><strong>Allow vs Restrict (documented, no Cedar analogy):</strong> Allow grants when all aspects match; Restrict denies when its settings are met. A standalone Restrict denies matching requests — audit every Scope's Allow+Restrict interaction explicitly, and test Restrict-only scopes rather than assuming a counterpart.</li>
                    <li><strong>Native policies (Snowflake/Databricks):</strong> PlainID can push vendor-native masking/RLS — same tags/table/column mapping discipline as Immuta; review generated native code like any migration artifact.</li>
                    <li><strong>AI Policy Builder:</strong> natural-language authoring generates the same model — but generated policies get the same tests and reviews as hand-written ones. Convenience is not verification.</li>
                </ul>
            </div>

            <div class="lesson-section">
                <h3>🔒 Lock-in / Bill / Exit (Read Before You Commit)</h3>
                <ul>
                    <li><strong>Lock-in (documented):</strong> Scopes, entityTypeIds, asset templates, and wizard-authored policies live in the PlainID control plane; enforcement couples to PDP tenancy/region. Rego-export exists for structured policies, but wizard-only artifacts do not round-trip as code.</li>
                    <li><strong>Bill (estimate — confirm current pricing):</strong> per-decision PDP volume plus caching strategy; PDP-per-tool-call agent patterns (Lesson 22) multiply call counts — budget latency AND invoice together, with fail-closed availability design.</li>
                    <li><strong>Exit (documented pattern):</strong> exported structured Rego + attribute feeds port to embedded OPA/Cedar with a rewrite of matchers/mappers; SaaS-native policies rewrite to vendor RLS/masking. Keep identity-attribute pipelines vendor-neutral from day one.</li>
                </ul>
            </div>
            ${renderPolicyLab('Step the Sara support-analyst request through WHO → WHAT → WHEN.')}
            <div class="lesson-section"><p><strong>Sequencing note:</strong> Immuta → PlainID ordering here is convenience, not dependency — this lesson stands alone without Lesson 17.</p></div>
        `,

        concepts: ["WHO WHAT WHEN", "MFA Conditions", "Policy Resolution", "Multi-Identity AND Semantics", "Generated-Policy Verification"],

        quiz: {
            id: "plainid_quiz",
            title: "PlainID Policies Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 480,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "A PlainID policy names a dynamic group but no asset type. What happens?",
                    options: [
                        { text: "Invalid — WHO without WHAT grants nothing", isCorrect: true },
                        { text: "It grants everything to the group", isCorrect: false },
                        { text: "It grants login access", isCorrect: false },
                        { text: "It deletes the group", isCorrect: false }
                    ],
                    explanation: "Docs-verified validity rule: a policy must include at least one of Identity / Agent / Control-or-Guardrail AND at least one WHAT (asset, tool, or action). WHO alone grants nothing.",
                    difficulty: 1, concept: "WHO WHAT WHEN"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "In the structured-Rego sample, what does condition_request(Auth_Method == MFA) enforce?",
                    options: [
                        { text: "WHEN: the policy grants only under step-up MFA context", isCorrect: true },
                        { text: "It disables MFA for everyone", isCorrect: false },
                        { text: "It grants MFA devices admin rights", isCorrect: false },
                        { text: "It is decorative metadata", isCorrect: false }
                    ],
                    explanation: "Conditions are the WHEN gate: same WHO+WHAT, different context → different verdict. Context-aware authZ without code changes.",
                    difficulty: 2, concept: "MFA Conditions"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "Your enforcement point is a search engine needing per-user result filters. Which PDP API?",
                    options: [
                        { text: "Policy Resolution — returns allowed attribute-filters for external enforcement", isCorrect: true },
                        { text: "Permit/Deny boolean only", isCorrect: false },
                        { text: "The login API", isCorrect: false },
                        { text: "A cached permit/deny boolean per user (stale the moment attributes change)", isCorrect: false }
                    ],
                    explanation: "Resolution answers 'what may they see?' (filters) vs permit-deny's 'may they do this?' (boolean). Bulk-data systems need the former.",
                    difficulty: 2, concept: "Policy Resolution"
                },
                {
                    id: "q4", type: "multiple-choice",
                                question: "A Scope has Use Multiple Identities Combination enabled. A request carries human Sara + agent support-bot + app helpdesk. How are they evaluated?",
                                options: [
                                    { text: "Together with AND semantics — each must satisfy its template's rules (max 3 templates)", isCorrect: true },
                                    { text: "Only the first identity counts", isCorrect: false },
                                    { text: "OR semantics — any one passing allows", isCorrect: false },
                                    { text: "Identities are concatenated into one string", isCorrect: false }
                                ],
                                explanation: "With the Scope flag ON: unified decision, strict AND across templates (disabled by default — in single-identity mode the extra identities are ignored, an over-grant). Max 3 templates; more is a request error.",
                                difficulty: 3, concept: "Multi-Identity AND Semantics"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "The AI assistant drafts a policy from a natural-language prompt. What is required before deploy?",
                    options: [
                        { text: "Same tests, review, and schema checks as hand-written policy", isCorrect: true },
                        { text: "Nothing — AI output is always correct", isCorrect: false },
                        { text: "Only a spell-check", isCorrect: false },
                        { text: "Delete all existing policies first", isCorrect: false }
                    ],
                    explanation: "Authoring convenience changes who writes, not what ships. Generated policy is untrusted input until verified (Lesson 20).",
                    difficulty: 1, concept: "Generated-Policy Verification"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "A policy allows all engineers on all repos with no conditions. What's missing for least privilege?",
                                options: [
                                    { text: "Scoped WHAT (which repos and actions) plus WHEN (conditions) — broad/broad/none is a smell", isCorrect: true },
                                    { text: "More engineers in the group", isCorrect: false },
                                    { text: "Nothing — engineers are trusted", isCorrect: false },
                                    { text: "A nicer policy name", isCorrect: false }
                                ],
                                explanation: "WHO/WHAT/WHEN is a completeness check. A policy with no WHAT scope and no WHEN is a grant waiting for an incident.",
                                difficulty: 2, concept: "WHO WHAT WHEN"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "Resolution returns filters your search engine cannot express (regex on analyzed text). Options?",
                                options: [
                                    { text: "Pre-filter where expressible, post-filter the remainder, and document the gap", isCorrect: true },
                                    { text: "Ignore the inexpressible filters", isCorrect: false },
                                    { text: "Disable the search engine", isCorrect: false },
                                    { text: "Allow everything instead", isCorrect: false }
                                ],
                                explanation: "External enforcement is only as strong as the engine's filter language. Gaps get compensating post-filters, explicitly.",
                                difficulty: 3, concept: "Policy Resolution"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "An MFA condition reads requestParams Auth_Method. Where must that value come from?",
                                options: [
                                    { text: "A trusted mapper (IdP or session) — never client-asserted input", isCorrect: true },
                                    { text: "The user typing it into a form", isCorrect: false },
                                    { text: "A URL query parameter", isCorrect: false },
                                    { text: "A cookie the client sets", isCorrect: false }
                                ],
                                explanation: "Conditions are only as trustworthy as their attributes. Client-asserted MFA is theater with extra steps.",
                                difficulty: 1, concept: "MFA Conditions"
                            }
                        ]
                    },
        animation: {
            type: "policy-flow",
            title: "WHO → WHAT → WHEN Flow",
            description: "Step a PlainID request through groups, rulesets, conditions",
            controls: ["flowPrev", "flowNext"]
        }
    };

    // =========================================================================
    // LESSON 19: Enforcement Architecture
    // =========================================================================
    COURSE_DATA.levels.expert.lessons.architecture_patterns = {
        id: "architecture_patterns",
        title: "Enforcement Architecture",
        subtitle: "Sidecar, gateway, middleware — latency and failure budgets",
        level: "expert",
        number: 19,
        estimatedTime: 70,
        difficulty: 4,
        prerequisites: ["plainid_policies"],

        content: `
            <div class="lesson-section">
                <h3>🔌 Three Patterns (All Reviewed, All Fail-Closed)</h3>
                <p>Setup detail lives in Lesson 11 (bundles, decision API, hot reload) — this lesson compares the patterns. Read the per-pattern setup there first if you have not run it.</p>
                <ul>
                    <li><strong>Sidecar (rest-rego):</strong> reverse-proxy beside each service; JWT/OIDC or Azure Graph; <code>&lt;5ms</code> overhead, 5000+ req/s on the reviewed hardware/policy (rest-rego's measurement, not a universal constant — re-measure with your policy and load); hot reload &lt;1s; Prometheus + structured logs. Zero app code changes.</li>
                    <li><strong>Gateway (Envoy + OPA):</strong> jwt_authn validates → x-jwt-payload to OPA via ext_authz gRPC → router forwards only on allow. <code>failure_mode_allow: false</code>, 200ms timeout. Minimal filter shape (confirm against your Envoy version): <code>http_filters: [{name: envoy.filters.http.ext_authz, typed_config: {failure_mode_allow: false, timeout: 200ms, grpc_service: {opa_cluster}}}]</code>.</li>
                    <li><strong>Middleware (Keycloak + OPA):</strong> route table maps paths to <code>resource:action</code> (first-match-wins, empty permission = public skip); single Starlette/FastAPI middleware resolves user, checks OPA (local or sidecar), caches 5s, denies closed on <code>OPA_FAIL_OPEN=false</code>. Minimal RULES shape: <code>[{path: "/teams/:id", action: "teams:write"}, {path: "/public/health", action: ""}]</code>.</li>
                </ul>
            </div>

            <div class="lesson-section">
                <h3>⏱️ Latency and Availability Budgets</h3>
                <ul>
                    <li><strong>Measure first:</strong> sidecar p99 vs gateway hop vs in-process Cedar. Cache decisions (5s TTL, fully-keyed) where freshness allows.</li>
                    <li><strong>Timeouts are decisions:</strong> every PDP call has a deadline; deadline-exceeded = deny + alert, never queue-forever or allow.</li>
                    <li><strong>Blast radius:</strong> gateway failure affects all routes (centralize carefully); sidecar failure affects one service; middleware local-mode survives network partitions.</li>
                </ul>
            </div>

            <div class="lesson-section">
                <h3>🪜 Choosing (Decision Tree)</h3>
                <p><strong>Zero code-change mandate?</strong> sidecar/gateway. <strong>Per-route permission vocabulary?</strong> middleware route table. <strong>Sub-5ms p99?</strong> in-process/embedded or fully-keyed cache. <strong>Multi-team gateway already?</strong> ext_authz filter reuses it. All three can front the same OPA/Cedar policies — pattern and policy are independent choices.</p>
            </div>
            ${renderPolicyLab('Compare the three patterns on flow, latency, and single-point-of-failure.')}
        `,

        concepts: ["Sidecar Pattern", "Middleware Route Table", "Latency Budgets", "Fail-Closed Timeouts", "Blast Radius"],

        quiz: {
            id: "arch_quiz",
            title: "Enforcement Architecture Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 480,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "Which reviewed setup adds <5ms overhead with zero app code changes?",
                    options: [
                        { text: "rest-rego sidecar reverse-proxy with hot-reloaded Rego", isCorrect: true },
                        { text: "Rewriting every handler by hand", isCorrect: false },
                        { text: "Disabling authorization", isCorrect: false },
                        { text: "Emailing each request for approval", isCorrect: false }
                    ],
                    explanation: "The sidecar's measured profile: <5ms, 5000+ req/s, hot reload <1s — the zero-code-change deployment story.",
                    difficulty: 1, concept: "Sidecar Pattern"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "In Envoy+OPA, what happens when OPA exceeds the 200ms timeout?",
                    options: [
                        { text: "Deny (failure_mode_allow: false) — fail closed", isCorrect: true },
                        { text: "Allow to keep traffic flowing", isCorrect: false },
                        { text: "Retry for 10 minutes", isCorrect: false },
                        { text: "Bypass to the backend silently", isCorrect: false }
                    ],
                    explanation: "Reviewed config is explicit: timeouts deny. Availability pressure never converts to unauthorized access.",
                    difficulty: 2, concept: "Fail-Closed Timeouts"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "What does the middleware route table buy you?",
                    options: [
                        { text: "One mapping of routes to resource:action strings, so handlers stay authZ-free and policy stays route-free", isCorrect: true },
                        { text: "Faster database queries", isCorrect: false },
                        { text: "Free TLS certificates", isCorrect: false },
                        { text: "Automatic UI generation", isCorrect: false }
                    ],
                    explanation: "The Keycloak-middleware RULES table is the PEP vocabulary: first-match-wins, empty permission = skip (public).",
                    difficulty: 2, concept: "Middleware Route Table"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "Gateway PDP fails. Blast radius vs sidecar PDP fails?",
                    options: [
                        { text: "Gateway: all routes denied (central); sidecar: one service denied (isolated)", isCorrect: true },
                        { text: "No difference at all", isCorrect: false },
                        { text: "Sidecar failure allows everything", isCorrect: false },
                        { text: "Gateway failure allows everything", isCorrect: false }
                    ],
                    explanation: "Centralization concentrates both consistency and failure. Both deny (fail-closed); the radius differs — design runbooks accordingly.",
                    difficulty: 3, concept: "Blast Radius"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "Sub-5ms p99 authZ budget with fresh group data. Best lever?",
                    options: [
                        { text: "In-process/embedded evaluation or fully-keyed short-TTL decision cache — measured, not guessed", isCorrect: true },
                        { text: "Remove authorization from the path", isCorrect: false },
                        { text: "Increase timeouts to 30s", isCorrect: false },
                        { text: "Cache one global ALLOW for all users", isCorrect: false }
                    ],
                    explanation: "Latency budgets are met with locality (embedded PDP) or keyed caching — never by skipping decisions or sharing verdicts across subjects.",
                    difficulty: 3, concept: "Latency Budgets"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "The route table has overlapping regexes and first match wins. Hazard?",
                                options: [
                                    { text: "A broad early rule shadows stricter later ones — order specific-first and test overlaps", isCorrect: true },
                                    { text: "None — overlap is harmless", isCorrect: false },
                                    { text: "Matching gets faster", isCorrect: false },
                                    { text: "The table auto-sorts itself", isCorrect: false }
                                ],
                                explanation: "First-match routing is priority routing. Untested overlaps silently downgrade strict routes to lax ones.",
                                difficulty: 2, concept: "Middleware Route Table"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "A gateway PDP upgrade goes bad mid-deploy. Containment?",
                                options: [
                                    { text: "Canary plus instant rollback via bundle and config pin; per-route cutover bounds the radius", isCorrect: true },
                                    { text: "Upgrade everything at once for consistency", isCorrect: false },
                                    { text: "Disable the PDP during upgrade", isCorrect: false },
                                    { text: "Hope the bad version is compatible", isCorrect: false }
                                ],
                                explanation: "Centralized enforcement centralizes failure. Upgrade like it can fail — because it can.",
                                difficulty: 3, concept: "Blast Radius"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "Sidecar and app parse the JWT differently and disagree on identity. Result?",
                                options: [
                                    { text: "Authorization decisions on the wrong subject — one shared identity-extraction point", isCorrect: true },
                                    { text: "Faster decisions", isCorrect: false },
                                    { text: "Nothing observable", isCorrect: false },
                                    { text: "Stronger security through diversity", isCorrect: false }
                                ],
                                explanation: "Two identity truths means decisions about someone else. AuthN parsing happens once, upstream of all enforcement.",
                                difficulty: 1, concept: "Sidecar Pattern"
                            }
                        ]
                    },
        animation: {
            type: "auth-patterns",
            title: "Pattern Trade-off Board",
            description: "Latency, failure radius, and code-change cost per pattern",
            controls: ["setAuthPattern"]
        }
    };

    // =========================================================================
    // LESSON 20: Testing and Verification
    // =========================================================================
    COURSE_DATA.levels.expert.lessons.testing_verification = {
        id: "testing_verification",
        title: "Testing and Verification",
        subtitle: "opa test, schema validation, CI gates, reviews",
        level: "expert",
        number: 20,
        estimatedTime: 70,
        difficulty: 4,
        prerequisites: ["architecture_patterns"],

        content: `
            <div class="lesson-section">
                <h3>🧪 The Four Suites (Every Engine)</h3>
                <ul>
                    <li><strong>Allow-tests:</strong> each permit rule's minimal passing input (<code>opa test</code>, Cedar <code>authorize</code> corpus, OpenFGA check fixtures).</li>
                    <li><strong>Deny-tests:</strong> stranger, wrong tenant, private-not-owner, expired MFA — including the verbatim cross-tenant test from Lesson 7.</li>
                    <li><strong>Regression-tests:</strong> every incident becomes a named permanent test.</li>
                    <li><strong>Property-tests:</strong> unknown roles, missing fields, empty inputs → all deny.</li>
                </ul>
                ${createCodeBlock(`# OPA: table-style tests live beside policy (policies/*_test.rego)
# test_admin_full_access, test_analyst_team_write,
# test_analyst_denied_other_tenant, test_stranger_denied_everything
opa test ./policies/ -v --coverage   # CI fails on red OR uncovered rules

# Cedar: validate policy against schema before any deploy
cedar validate --schema schema.cedar --policies policies.cedar

# OpenFGA: replay check fixtures against staging (never only playground)
fga check --store-id $STAGE user:eve viewer document:Q3  # expect false`, 'bash', 'Verification commands per engine (CI-gated)')}
                ${createCodeBlock(`# policies/request_test.rego — table-style Rego tests (opa test picks up *_test.rego)
package policies

test_analyst_denied_other_tenant if {
  not allow with input as {"jwt": {"roles": ["analyst"], "tenant": "t1"},
                            "request": {"method": "GET", "path": ["payments", "9"]},
                            "tenant_header": "t2"}
}

test_admin_full_access if {
  allow with input as {"jwt": {"roles": ["admin"], "tenant": "t1"},
                       "request": {"method": "DELETE", "path": ["payments", "9"]},
                       "tenant_header": "t1"}
}
# $ opa test ./policies/ -v  -> PASS: 2/2 (names above appear per-test)`, 'rego', 'Rego test file: named allow + deny twins')}
            </div>

            <div class="lesson-section">
                <h3>🚦 CI Gates and Change Review</h3>
                <ul>
                    <li><strong>Gate:</strong> fmt + tests + coverage + schema-validate on every PR touching policy, tuples, or schemas. Red = no merge.</li>
                    <li><strong>Two-person rule:</strong> policy changes need a second approver who replays the decision diff (which requests flip verdict?).</li>
                    <li><strong>Decision-diff previews:</strong> run the new bundle against sampled production inputs; list every flipped verdict for the reviewer.</li>
                    <li><strong>AI-generated policy:</strong> untrusted input — same gates, plus a human owns the merge.</li>
                </ul>
            </div>

            <div class="lesson-section">
                <h3>📊 Coverage Lies to Watch</h3>
                <p>100% rule coverage with only allow-tests is a green lie. Require <strong>deny-coverage</strong> (each rule has a failing-twin test) and <strong>default-coverage</strong> (empty/garbage inputs deny). Measurable gate: <code>opa test --coverage --format=json</code> must report every rule hit AND every rule hit by at least one failing input — encode both counts as CI thresholds (e.g. <code>jq '.coverage >= 100 and .deny_twins == .rules'</code>), not vibes. Pin engine versions in CI — Rego 1.x <code>if/in</code> vs legacy syntax must not drift between laptop and pipeline.</p>
                <p><strong>Decision-diff command (one way):</strong> <code>for f in inputs/*.json; do echo -n "$f old/new: "; opa eval -b old-bundle.tar.gz -i $f 'data.authz.allow' | jq .result[0].expressions[0].value; opa eval -b new-bundle.tar.gz -i $f 'data.authz.allow' | jq .result[0].expressions[0].value; done | diff against the approved flip list</code> — every flipped verdict needs a one-line justification in the PR.</p>
            </div>
            ${renderPolicyLab('Toggle default-deny off and watch the property tests go red.')}
        `,

        concepts: ["Regression Tests", "Cedar Schema Validation", "Decision-Diff Review", "Deny Coverage", "Pinned Engine Versions"],

        quiz: {
            id: "testing_quiz",
            title: "Testing and Verification Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 480,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "100% rule coverage, all tests are allow-cases. What is missing?",
                    options: [
                        { text: "Deny-coverage: failing twins + default-deny property tests", isCorrect: true },
                        { text: "Nothing — coverage is coverage", isCorrect: false },
                        { text: "More allow-tests", isCorrect: false },
                        { text: "Faster hardware", isCorrect: false }
                    ],
                    explanation: "Allow-only suites cannot catch over-broad rules or fail-open defaults. Every rule needs its deny twin; garbage inputs must deny.",
                    difficulty: 2, concept: "Deny Coverage"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "What does cedar validate --schema catch before deploy?",
                    options: [
                        { text: "Type/category errors (wrong entity types, illegal action combos)", isCorrect: true },
                        { text: "Spelling errors in comments", isCorrect: false },
                        { text: "Network latency", isCorrect: false },
                        { text: "Whether the policy is stylistically idiomatic", isCorrect: false }
                    ],
                    explanation: "Schema validation is Cedar's write-time gate — bad policy is rejected, never deployed (Lesson 13).",
                    difficulty: 1, concept: "Cedar Schema Validation"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "A policy PR flips 3 production requests from deny to allow. Correct handling?",
                    options: [
                        { text: "Decision-diff preview lists them; second approver justifies each flip before merge", isCorrect: true },
                        { text: "Merge silently — flips are always fine", isCorrect: false },
                        { text: "Delete the tests that noticed", isCorrect: false },
                        { text: "Deploy Friday evening to get it over with", isCorrect: false }
                    ],
                    explanation: "Verdict flips are the security-relevant diff. Two-person review of flips is the change control auditors expect.",
                    difficulty: 2, concept: "Decision-Diff Review"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "Last month's tenant-leak incident is fixed. What makes the fix permanent?",
                    options: [
                        { text: "A named regression test (test_analyst_denied_other_tenant) that lives forever", isCorrect: true },
                        { text: "A Slack message saying it is fixed", isCorrect: false },
                        { text: "Hoping nobody touches that code", isCorrect: false },
                        { text: "Deleting the incident ticket", isCorrect: false }
                    ],
                    explanation: "Incidents become tests or they become repeats. Named regression tests are institutional memory that runs on every build.",
                    difficulty: 1, concept: "Regression Tests"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "CI uses OPA 1.x but a laptop runs 0.x and a test passes locally, fails in CI. Fix?",
                    options: [
                        { text: "Pin the engine version everywhere (container digest / version file) so syntax and builtins match", isCorrect: true },
                        { text: "Delete the failing test", isCorrect: false },
                        { text: "Never test locally", isCorrect: false },
                        { text: "Use two different policy languages", isCorrect: false }
                    ],
                    explanation: "Rego 1.x keywords (if/in) vs legacy syntax is version-sensitive. Pinned versions make local == CI == prod.",
                    difficulty: 2, concept: "Pinned Engine Versions"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "A diff shows 200 flips, all deny-to-allow for one team. Reading?",
                                options: [
                                    { text: "Over-broad new permit scoped to that team — block merge until each flip is justified", isCorrect: true },
                                    { text: "Normal statistical noise", isCorrect: false },
                                    { text: "Approve — flips mean progress", isCorrect: false },
                                    { text: "Delete the diff output", isCorrect: false }
                                ],
                                explanation: "Clustered flips are the signature of an over-scoped rule. Diff review exists to catch exactly this shape.",
                                difficulty: 2, concept: "Decision-Diff Review"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "How do you write a regression test for a fixed tenant leak?",
                                options: [
                                    { text: "Name it after the incident, use the minimal failing input, keep it permanent", isCorrect: true },
                                    { text: "Delete it once the fix ships", isCorrect: false },
                                    { text: "Test only the allow-cases", isCorrect: false },
                                    { text: "File it in an email thread", isCorrect: false }
                                ],
                                explanation: "Named, minimal, permanent: incidents become tests or they become repeats.",
                                difficulty: 1, concept: "Regression Tests"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "OPA 1.x if-keyword syntax fails on a vendored 0.x binary in one region. Prevention?",
                                options: [
                                    { text: "Digest-pinned image plus version assertion at boot plus CI matching prod", isCorrect: true },
                                    { text: "Avoid modern keywords everywhere", isCorrect: false },
                                    { text: "One divergent region is acceptable", isCorrect: false },
                                    { text: "Edit policy directly in production", isCorrect: false }
                                ],
                                explanation: "Version drift between regions is a split-brain fleet. Pin, assert, and test the matrix you ship.",
                                difficulty: 3, concept: "Pinned Engine Versions"
                            }
                        ]
                    },
        animation: {
            type: "default-deny-sim",
            title: "Coverage vs Reality",
            description: "Watch property tests catch what allow-only suites miss",
            controls: ["setDenyScenario", "toggleDenyRules"]
        }
    };

    // =========================================================================
    // LESSON 21: Migration from RBAC
    // =========================================================================
    COURSE_DATA.levels.expert.lessons.migration_rbac_pbac = {
        id: "migration_rbac_pbac",
        title: "Migrating RBAC to PBAC",
        subtitle: "Strangler pattern for brownfield estates",
        level: "expert",
        number: 21,
        estimatedTime: 60,
        difficulty: 4,
        prerequisites: ["testing_verification"],

        content: `
            <div class="lesson-section">
                <h3>🌿 The Strangler Sequence</h3>
                <ol>
                    <li><strong>Inventory:</strong> extract every inline check into a catalog (route → current rule). You cannot migrate what you cannot list. Start mechanical: <code>rg -n "role|permit|allow|isAdmin|can[A-Z]" --type py --type js services/ | sort &gt; authz-inventory.txt</code>, then hand-triage into route → rule rows — the grep finds candidates, humans write the catalog.</li>
                    <li><strong>Shadow mode:</strong> deploy PDP beside the old checks; log agreements/disagreements without enforcing. Disagreements are your spec.</li>
                    <li><strong>Role-import:</strong> encode existing roles as policy first (RBAC-in-PBAC) — zero behavior change, full test harness.</li>
                    <li><strong>Attribute enrichment:</strong> add tenant/owner/MFA rules one invariant at a time, each with deny-tests.</li>
                    <li><strong>Cutover per route:</strong> flip enforcement route-by-route with instant rollback (bundle version pin).</li>
                    <li><strong>Delete the old code:</strong> the strangler is done only when inline checks are gone, not when the PDP exists.</li>
                </ol>
            </div>

            <div class="lesson-section">
                <h3>⚠️ Brownfield Hazards</h3>
                <ul>
                    <li><strong>Hidden admin backdoors</strong> (<code>if email == 'ceo@…'</code>) surface in shadow-mode diffs — decide explicitly, never silently port.</li>
                    <li><strong>Role explosion becomes policy debt</strong> if you transliterate 400 roles 1:1 — collapse dimensions into attributes during import.</li>
                    <li><strong>Dual-write tuples need an outbox, not a distributed transaction:</strong> share-actions write old ACL rows AND emit tuple-writes via transactional outbox; there is no XA across your DB and OpenFGA — design for at-least-once + reconciliation.</li>
                    <li><strong>Enforcement outside services:</strong> stored procedures, BI semantic layers, and warehouse grants are not lintable service code — inventory them as out-of-scope enforcement with owners, or the strangler strangles nothing.</li>
                    <li><strong>PII in shadow logs:</strong> shadow mode records real requests; allowlist what the diff pipeline keeps (subject id, action, resource id, verdict, policy id) and redact everything else (payloads, emails, tokens, free-text attributes) — or the migration creates its own breach.</li>
                    <li><strong>Attribute-source cleanup:</strong> HR/IdP feeds, stale groups, and dead roles migrate too — or the new PDP faithfully enforces garbage.</li>
                </ul>
            </div>

            <div class="lesson-section">
                <h3>📏 Done Criteria (Tolerance-Based, Not Zero-Based)</h3>
                <p>A long-tail estate will never show a literal zero diff. Exit instead on: inline authZ conditionals at zero in services (linted) with a risk-accepted inventory of out-of-scope enforcement; shadow diff <strong>below an agreed threshold on sampled production inputs</strong> with every residual exception named, owned, and expiry-dated; per-route rollback rehearsed; freeze windows and audit sign-off completed; old code deleted route-by-route. Numeric example: <code>&lt;0.1% disagree on 100k sampled prod requests over 7 days, zero disagree on deny→allow flips, ≤5 named exceptions each with owner + expiry</code> — calibrate the numbers to your estate, then freeze them in the migration charter. Migration without deletion is just two systems to breach.</p>
            </div>
            ${renderPolicyLab('Compare RBAC transliteration vs attribute-collapsed policy on role count.')}
        `,

        concepts: ["Strangler Pattern", "Shadow Mode Diffs", "Role Import", "Per-Route Cutover", "Migration Done Criteria"],

        quiz: {
            id: "migration_quiz",
            title: "Migration Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 480,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "What runs first in a safe RBAC→PBAC migration?",
                    options: [
                        { text: "Inventory of every inline check + shadow-mode PDP logging diffs without enforcing", isCorrect: true },
                        { text: "Deleting all old authorization code immediately", isCorrect: false },
                        { text: "Flipping every route to enforce on day one", isCorrect: false },
                        { text: "Buying the most expensive platform", isCorrect: false }
                    ],
                    explanation: "Shadow diffs ARE the migration spec: every disagreement between old checks and new policy is the first strangler decision to make explicitly.",
                    difficulty: 2, concept: "Strangler Pattern"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "Shadow mode shows the old code allows what new policy denies for the CEO's email. Correct move?",
                    options: [
                        { text: "Treat as explicit decision: encode or reject the backdoor deliberately, with approvers", isCorrect: true },
                        { text: "Silently port the backdoor into policy", isCorrect: false },
                        { text: "Ignore all diffs and cut over anyway", isCorrect: false },
                        { text: "Delete the logs", isCorrect: false }
                    ],
                    explanation: "Hidden grants surface in diffs precisely so they get deliberate treatment. Silent ports preserve invisible privilege.",
                    difficulty: 3, concept: "Shadow Mode Diffs"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "You have 400 roles (region × seniority × type). How to import them?",
                    options: [
                        { text: "Collapse dimensions into attributes; encode rules, not role enumerations", isCorrect: true },
                        { text: "Transliterate 1:1 into 400 policies", isCorrect: false },
                        { text: "Delete all roles and allow everyone", isCorrect: false },
                        { text: "Keep them in a spreadsheet", isCorrect: false }
                    ],
                    explanation: "1:1 transliteration preserves role explosion as policy debt. Import the roles, then collapse dimensions into attributes — import is the step, collapse is the goal.",
                    difficulty: 2, concept: "Role Import"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "Why cut over route-by-route instead of big-bang?",
                    options: [
                        { text: "Blast radius control + instant per-route rollback via bundle pin", isCorrect: true },
                        { text: "Big-bang is always safer", isCorrect: false },
                        { text: "Routes cannot share a PDP", isCorrect: false },
                        { text: "Rollback is impossible anyway", isCorrect: false }
                    ],
                    explanation: "Per-route cutover bounds every failure and makes rollback a version pin, not a war room.",
                    difficulty: 2, concept: "Per-Route Cutover"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "When is the migration actually done?",
                    options: [
                        { text: "Old checks deleted route-by-route; diff below threshold with owned exceptions; rollback rehearsed; sign-off complete", isCorrect: true },
                        { text: "When the PDP is installed (old code still running)", isCorrect: false },
                        { text: "When the kickoff meeting happens", isCorrect: false },
                        { text: "When the PDP container image is pinned (necessary hygiene, not migration-done)", isCorrect: false }
                    ],
                    explanation: "Tolerance-based exit: literal zero-diff is unattainable on long-tail estates. Done = old path gone, residuals named/owned/expiry-dated, rollback rehearsed. Coexistence is two systems to breach.",
                    difficulty: 1, concept: "Migration Done Criteria"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "Import discovers thirty roles nobody can explain. Treatment?",
                                options: [
                                    { text: "Quarantine with deny-by-default replacements plus owner attestation before porting", isCorrect: true },
                                    { text: "Port all thirty verbatim", isCorrect: false },
                                    { text: "Delete all thirty immediately", isCorrect: false },
                                    { text: "Ignore them and move on", isCorrect: false }
                                ],
                                explanation: "Unexplained roles are unexploded ordnance. Quarantine first; port only what an owner will sign for.",
                                difficulty: 2, concept: "Role Import"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "A route does three different things and has no clean permission. Cutover approach?",
                                options: [
                                    { text: "Split the handler, or gate the narrow union with an expiry plus a refactor ticket", isCorrect: true },
                                    { text: "One broad permit forever", isCorrect: false },
                                    { text: "Skip the route entirely", isCorrect: false },
                                    { text: "Restrict it to admin-only permanently", isCorrect: false }
                                ],
                                explanation: "Unmappable routes are design debt surfacing. Time-box the broad gate and pay down the split.",
                                difficulty: 3, concept: "Per-Route Cutover"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "Shadow diffs show 99% agreement. How do you treat the 1%?",
                                options: [
                                    { text: "As the entire migration spec — triage every disagreement explicitly", isCorrect: true },
                                    { text: "As noise to ignore", isCorrect: false },
                                    { text: "Auto-allow the differences", isCorrect: false },
                                    { text: "Delete the diff logs", isCorrect: false }
                                ],
                                explanation: "Agreement is uninteresting; disagreement is the spec. The 1% contains every backdoor and every misunderstanding.",
                                difficulty: 1, concept: "Shadow Mode Diffs"
                            }
                        ]
                    },
        animation: {
            type: "rbac-abac-compare",
            title: "Migration: Roles to Rules",
            description: "Watch role count collapse as dimensions become attributes",
            controls: ["setCompareMode"]
        }
    };

    // =========================================================================
    // LESSON 22: AI-Agent Authorization (PlainID LangChain pattern)
    // =========================================================================
    COURSE_DATA.levels.research.lessons.ai_agents_authz = {
        id: "ai_agents_authz",
        title: "Authorizing AI Agents",
        subtitle: "Guardrails at prompt, retrieval, and response",
        level: "research",
        number: 22,
        estimatedTime: 75,
        difficulty: 4,
        prerequisites: ["migration_rbac_pbac"],

        content: `
            <div class="lesson-section">
                <h3>🤖 Sara's Three Gates (Verified Pattern)</h3>
                <p>The reviewed PlainID LangChain pattern governs Sara (Tier-1 analyst, Germany) with <strong>three enforcement gates</strong>, each backed by the same policy plane:</p>
                <ul>
                    <li><strong>Gate 1 — prompt categorization:</strong> her query <em>product support + internal security</em> is classified; <em>internal_security</em> is outside her allowed categories → denied before any retrieval.</li>
                    <li><strong>Gate 2 — policy-aware retrieval:</strong> the retriever applies PDP filters (region <code>eu-central</code>) so US documents never enter context.</li>
                    <li><strong>Gate 3 — response anonymization:</strong> reporter names (PII asset type) are masked in output per her policy.</li>
                </ul>
                ${createCodeBlock(`# Gate 1: categorize BEFORE processing (reviewed LangChain pattern)
category = categorizer.invoke(user_query)   # 'internal_security' -> DENY
# "You're not authorized to ask about these topics."

# Gate 2: retrieval already filtered by PDP (region eu-central only)
filtered_docs = plainid_retriever.invoke(user_query)

# Gate 3: PII masked on the way out (reporter names)
result = plainid_anonymizer.invoke(user_query)`, 'python', 'Three gates: categorize, filter retrieval, anonymize response')}
            </div>

            <div class="lesson-section">
                <h3>🔍 Critical Review Notes</h3>
                <ul>
                    <li><strong>Gate order is load-bearing:</strong> categorizing after retrieval leaks unauthorized content into context (and logs). Deny early.</li>
                    <li><strong>Retrieval filtering ≠ output filtering:</strong> region-gating decides <em>which docs</em>; anonymization decides <em>which fields</em>. Both gates stay; neither subsumes the other.</li>
                    <li><strong>Agent identity is a first-class subject:</strong> multi-identity evaluation (human + agent + app, AND semantics) means the <em>agent's</em> clearance gates too — a cleared human driving an uncleared agent still denies.</li>
                    <li><strong>MCP/tool calls are actions:</strong> every tool invocation is an (agent, action, resource) triple through the PDP — tools are the new API endpoints. No PlainID tenant? The same triple gates through OPA (<code>allow if input.agent.clearance >= input.tool.sensitivity</code> over a tool-allowlist) or Cedar (permit per tool action + forbid on exfil compositions) — the gates are architecture, not vendor.</li>
                </ul>
            </div>

            <div class="lesson-section">
                <h3>⛔ Enforcement Limits (Read Before Trusting the Gates)</h3>
                <ul>
                    <li><strong>Gate 1 is probabilistic:</strong> the categorizer is an LLM classifier — paraphrase and prompt injection bypass it. Require allowlist categories, an adversarial test set, and human approval for high-risk tools. Adversarial set, minimum (run on every categorizer change): 5 paraphrases of each blocked topic, 3 injection probes (<code>ignore previous instructions…</code>, role-play, encoding tricks), 3 mixed allowed+blocked queries — all must deny. (Per docs, the categorizer also supports a single identity per request — do not assume multi-identity framing everywhere.)</li>
                    <li><strong>Blocked answers still leak:</strong> retrieved-then-blocked content touches context, logs, caches, and embeddings. Gate order reduces but does not eliminate retention — scope sessions and audit tool I/O.</li>
                    <li><strong>Anonymization ≠ de-identification:</strong> masked names re-identify via joins and aggregates. Treat anonymizer output as pseudonymized, not anonymous.</li>
                    <li><strong>Composed allowed actions leak:</strong> allowed search + allowed email = exfiltration. AND-semantics across identities does not stop two individually-permitted steps from composing into one violation — model dangerous compositions explicitly.</li>
                    <li><strong>PDP-per-call has a price:</strong> latency, invoice volume, and fail-closed availability all scale with tool-call counts. Deny on PIP-unavailable by default; enabling <code>skipUnneededOrUnavailableIdentitySources</code>-style leniency is an explicitly risk-accepted decision, logged per call.</li>
                    <li><strong>TOCTOU sessions:</strong> policy or attributes changing mid-session must re-gate open tool loops — a verdict at turn 1 is not a verdict at turn 20.</li>
                </ul>
            </div>
            ${renderPolicyLab('Walk Sara’s request through the three gates; change topic, region, PII.')}
        `,

        concepts: ["Prompt Categorization Gate", "Gate Ordering", "Response Anonymization", "Agent Identity", "Tool Calls as Actions"],

        quiz: {
            id: "agents_quiz",
            title: "AI-Agent Authorization Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 480,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "Sara asks about product support AND internal security. What happens at Gate 1?",
                    options: [
                        { text: "Denied before retrieval — internal_security is outside her allowed categories", isCorrect: true },
                        { text: "Allowed — any support keyword suffices", isCorrect: false },
                        { text: "Allowed but logged silently", isCorrect: false },
                        { text: "The agent answers from memory instead", isCorrect: false }
                    ],
                    explanation: "Categorization gates the whole interaction. Mixed queries containing restricted topics deny — partial compliance is non-compliance.",
                    difficulty: 2, concept: "Prompt Categorization Gate"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "Why must categorization run BEFORE retrieval?",
                    options: [
                        { text: "Otherwise unauthorized content enters context/logs even if the final answer is blocked", isCorrect: true },
                        { text: "It makes responses faster", isCorrect: false },
                        { text: "Retrieval requires a category label to function", isCorrect: false },
                        { text: "Order does not matter", isCorrect: false }
                    ],
                    explanation: "Late gates leak: retrieved-then-blocked content still touched the model, the logs, and possibly the cache. Deny early.",
                    difficulty: 3, concept: "Gate Ordering"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "Region filter allows eu-central docs; reporter names still show raw. Which gate is missing?",
                    options: [
                        { text: "Response anonymization (field-level PII masking on output)", isCorrect: true },
                        { text: "Prompt categorization", isCorrect: false },
                        { text: "JWT verification", isCorrect: false },
                        { text: "DNS filtering", isCorrect: false }
                    ],
                    explanation: "Retrieval gates documents; anonymization gates fields. The reviewed pattern keeps both — region ≠ de-identification.",
                    difficulty: 2, concept: "Response Anonymization"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "A cleared human tasks an uncleared support agent with reading restricted cases. Verdict under multi-identity AND?",
                    options: [
                        { text: "Deny — every identity (human, agent, app) must satisfy its template's rules", isCorrect: true },
                        { text: "Allow — the human's clearance covers the agent", isCorrect: false },
                        { text: "Allow — agents inherit human rights", isCorrect: false },
                        { text: "Allow on weekdays", isCorrect: false }
                    ],
                    explanation: "AND semantics close the confused-deputy gap: the weakest identity in the chain gates the decision.",
                    difficulty: 3, concept: "Agent Identity"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "An agent calls delete-customer-record via an MCP tool. How should this be authorized?",
                    options: [
                        { text: "As (agent, delete, customer-record) through the PDP — tools are actions on resources", isCorrect: true },
                        { text: "Tool calls are internal and need no authorization", isCorrect: false },
                        { text: "Allow all tool calls for speed", isCorrect: false },
                        { text: "Only authorize the first tool call per session", isCorrect: false }
                    ],
                    explanation: "Every tool invocation crosses a trust boundary. PDP-per-call with the agent as subject is the reviewed posture.",
                    difficulty: 2, concept: "Tool Calls as Actions"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "A tool result containing injected instructions arrives mid-session. Which gate applies?",
                                options: [
                                    { text: "Treat tool output as untrusted input — re-categorize before acting on it", isCorrect: true },
                                    { text: "Trust all tool output implicitly", isCorrect: false },
                                    { text: "Skip gates once a session is open", isCorrect: false },
                                    { text: "Allow everything tools return", isCorrect: false }
                                ],
                                explanation: "Retrieved content is the oldest injection vector in the new stack. Gates re-apply at every trust boundary, including tool returns.",
                                difficulty: 2, concept: "Gate Ordering"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "The support-bot needs broader access than Sara for one debugging session. Safe pattern?",
                                options: [
                                    { text: "Time-boxed elevation with approval and full tool-I/O audit, auto-expiring", isCorrect: true },
                                    { text: "Permanent elevation for convenience", isCorrect: false },
                                    { text: "Share Sara's personal token", isCorrect: false },
                                    { text: "Disable the PDP for the session", isCorrect: false }
                                ],
                                explanation: "Exceptional access is normal; permanent exceptional access is a backdoor. Box it in time, approval, and audit.",
                                difficulty: 3, concept: "Agent Identity"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "An allowlisted category name appears inside attacker-quoted text. Handling?",
                                options: [
                                    { text: "Classify intent and structure, not keywords — quoted payload is data, not instruction", isCorrect: true },
                                    { text: "Allow — the keyword matched", isCorrect: false },
                                    { text: "Deny all quoted text everywhere", isCorrect: false },
                                    { text: "Strip quotes and re-check keywords", isCorrect: false }
                                ],
                                explanation: "Keyword gates fall to quoting. Categorization must separate instruction from payload, or attackers will supply the keywords.",
                                difficulty: 2, concept: "Prompt Categorization Gate"
                            }
                        ]
                    },
        animation: {
            type: "policy-flow",
            title: "Three Gates Walkthrough",
            description: "Sara's request through categorize → retrieve → anonymize",
            controls: ["flowPrev", "flowNext"]
        }
    };

    // =========================================================================
    // LESSON 23: Capstone — API Authorization Build
    // =========================================================================
    COURSE_DATA.levels.research.lessons.capstone_api = {
        id: "capstone_api",
        title: "Capstone: Secure an API Estate",
        subtitle: "OPA + Cedar + OpenFGA, tested and measured",
        level: "research",
        number: 23,
        estimatedTime: 480,
        difficulty: 5,
        prerequisites: ["testing_verification", "openfga_production", "cedar_production"],

        content: `
            <div class="lesson-section">
                <h3>🎯 Mission</h3>
                <p>Secure a three-service payments API (public health, tenant-scoped reads, admin writes, per-document sharing) using <strong>at least two engines</strong> from this course: OPA/Rego for the API layer, Cedar for app rules, OpenFGA for document sharing. Ship policy + tests + measurements.</p>
                <p><strong>Time model (honest):</strong> 480 min across sessions — <strong>M1 policy (120)</strong> → <strong>M2 tests (120)</strong> → <strong>M3 enforcement (exactly one pattern) + evidence (240)</strong>. Do not attempt in one sitting.</p>
            </div>

            <div class="lesson-section">
                <h3>📦 Definition of Done</h3>
                <ul>
                    <li>Rego bundle: default-deny, team/tenant rules, public carve-out; <code>opa test</code> green incl. cross-tenant deny + stranger deny + property tests.</li>
                    <li>Cedar: schema + permit/forbid set validating clean; owner/MFA/private semantics demonstrated.</li>
                    <li>OpenFGA: model with concentric viewer←editor + team indirection; tuple lifecycle (share/revoke) scripted; list-objects powering one listing endpoint.</li>
                    <li>Enforcement: one pattern from Lesson 19 running (sidecar/gateway/middleware) with fail-closed timeout config shown.</li>
                    <li>Evidence: decision-diff of one intentional rule change + p50/p99 PDP latency numbers + rollback + comms runbook.</li>
                    <li>Inference-risk note: one paragraph on what your controls do NOT stop (e.g. authorized-but-sensitive aggregation, allowed-tool composition) and what compensates.</li>
                </ul>
            </div>

            <div class="lesson-section">
                <h3>📊 Rubric (14/20 to pass) — one artifact per row</h3>
                <p><strong>Submit:</strong> repo layout (<code>policies/</code>, <code>tests/</code>, <code>evidence/</code>), <code>opa test -v</code> log, p50/p99 table, decision-diff file, rollback log. Score each row 0 (absent), partial (present but unchecked), or full (present and evidenced per the check). <strong>Points:</strong> partial = 1 pt on every row (including 2-pt row 7); full = listed pts. Max 20, pass at 14.</p>
                <table>
                    <thead><tr><th>#</th><th>Artifact (pts)</th><th>Partial</th><th>Full (3, or 2 for row 7)</th></tr></thead>
                    <tbody>
                        <tr><td>1</td><td>Default-deny + fail-closed config (3)</td><td>Default set, timeout unconfigured</td><td>Config shows default-deny + timeout=Xms AND a PDP-down → DENY test log line</td></tr>
                        <tr><td>2</td><td>Deny/regression/property suite log (3)</td><td>Allow-tests only</td><td><code>opa test -v</code> green with named cross-tenant, stranger, and garbage-input denies</td></tr>
                        <tr><td>3</td><td>Two-engine seam tests (3)</td><td>Two engines present, seams untested</td><td>Rego tenant test AND FGA sharing test both green</td></tr>
                        <tr><td>4</td><td>Share/revoke lifecycle transcript (3)</td><td>Scripted but revoke untested</td><td>Share + revoke transcript AND cache-invalidation measurement shown</td></tr>
                        <tr><td>5</td><td>p50/p99 latency table (3)</td><td>Numbers without method</td><td>Table states n≥100, warm+cold split, tool named (e.g. hey/k6/opa bench), and fail-closed timeout for both percentiles</td></tr>
                        <tr><td>6</td><td>Rollback log (3)</td><td>Steps listed, never run</td><td>Log with staging timestamps from a rehearsed rollback</td></tr>
                        <tr><td>7</td><td>Decision-diff file (2)</td><td>Diff shown, flips unjustified</td><td>Diff file with every flipped verdict justified in one line each</td></tr>
                    </tbody>
                </table>
            </div>
            ${renderPolicyLab('Use the simulators to pre-validate each verdict before you build.')}
        `,

        concepts: ["Capstone Integration", "Multi-Engine Design", "Latency Measurement", "Decision Diffs"],

        quiz: {
            id: "capstone_api_quiz",
            title: "Capstone API Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 480,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "Which engine answers 'which documents can anne view' for the listing endpoint?",
                    options: [
                        { text: "OpenFGA list-objects (reverse query, not per-doc checks)", isCorrect: true },
                        { text: "OPA opa eval in a loop over all ids", isCorrect: false },
                        { text: "Cedar isAuthorized per document in a loop", isCorrect: false },
                        { text: "None — listings skip authorization", isCorrect: false }
                    ],
                    explanation: "List-objects is the designed reverse query; per-doc check loops are N+1 authZ (Lesson 14).",
                    difficulty: 2, concept: "Multi-Engine Design"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "Minimum evidence your capstone must present?",
                    options: [
                        { text: "Green tests (incl. denies) + latency p50/p99 + decision-diff + rollback steps", isCorrect: true },
                        { text: "Decision logs alone without versioned policy", isCorrect: false },
                        { text: "Passing allow-tests only, no deny-tests", isCorrect: false },
                        { text: "The policy file alone", isCorrect: false }
                    ],
                    explanation: "The Definition of Done is evidence-shaped: tests, numbers, diffs, procedures — the audit triple from Lesson 5, integrated across engines.",
                    difficulty: 1, concept: "Capstone Integration"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "Sharing uses OpenFGA, reads use OPA. Where does tenant equality live?",
                    options: [
                        { text: "In OPA policy (claim vs header), tested by the cross-tenant deny-test", isCorrect: true },
                        { text: "Nowhere — OpenFGA implies tenancy", isCorrect: false },
                        { text: "In the user's browser", isCorrect: false },
                        { text: "Tenancy does not matter with sharing", isCorrect: false }
                    ],
                    explanation: "Each engine owns its seam: ReBAC the sharing graph, Rego the tenant invariant. Assuming one covers the other is the integration bug.",
                    difficulty: 3, concept: "Multi-Engine Design"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "Your PDP p99 is 40ms against a 10ms budget. First correct lever?",
                    options: [
                        { text: "Fully-keyed short-TTL cache or embedded evaluation — measured, keeping fail-closed", isCorrect: true },
                        { text: "Set failure_mode_allow: true", isCorrect: false },
                        { text: "Remove the tenant check", isCorrect: false },
                        { text: "Cache one ALLOW for everyone", isCorrect: false }
                    ],
                    explanation: "Latency fixes preserve the invariant: locality/caching keyed on the full decision inputs (Lessons 11, 19).",
                    difficulty: 2, concept: "Latency Measurement"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "A rule change accidentally allows strangers. What catches it before prod?",
                    options: [
                        { text: "CI deny-tests + decision-diff preview showing the flipped verdicts", isCorrect: true },
                        { text: "Nothing can catch it", isCorrect: false },
                        { text: "The animation colors", isCorrect: false },
                        { text: "Longer timeouts", isCorrect: false }
                    ],
                    explanation: "The Lesson 20 gates exist for exactly this: stranger-deny tests plus flip-previews on every policy PR.",
                    difficulty: 1, concept: "Decision Diffs"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "Cedar says Allow and OpenFGA says Deny for the same user action. Resolution?",
                                options: [
                                    { text: "Deny — seams combine deny-biased; investigate which seam owns the invariant", isCorrect: true },
                                    { text: "Allow — one yes outweighs one no", isCorrect: false },
                                    { text: "Average the two decisions", isCorrect: false },
                                    { text: "Ask the end user to decide", isCorrect: false }
                                ],
                                explanation: "Multi-engine estates deny on disagreement. Divergent engines mean a misplaced invariant — find which seam should own it.",
                                difficulty: 2, concept: "Multi-Engine Design"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "PDP p50 is 3ms and p99 is 400ms. Reading?",
                                options: [
                                    { text: "Tail dominated by cold starts or retries — warm, cache, or bound the slow path; report both", isCorrect: true },
                                    { text: "Fine — p50 is what users feel", isCorrect: false },
                                    { text: "Stop measuring p99", isCorrect: false },
                                    { text: "Raise the timeout to 30 seconds", isCorrect: false }
                                ],
                                explanation: "Averages hide the failures your users actually hit. Tail latency is the reliability budget.",
                                difficulty: 3, concept: "Latency Measurement"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "Your second engine adds no decision the first couldn't already make. Problem?",
                                options: [
                                    { text: "Integration theater — each engine must own a seam (API vs sharing vs app rules)", isCorrect: true },
                                    { text: "More engines are always better", isCorrect: false },
                                    { text: "No problem at all", isCorrect: false },
                                    { text: "Keep both — redundancy is always safer", isCorrect: false }
                                ],
                                explanation: "Engines multiply operational cost. Each must earn its place with decisions only it can make well.",
                                difficulty: 1, concept: "Capstone Integration"
                            }
                        ]
                    },
        animation: {
            type: "rego-playground",
            title: "Pre-Build Verdict Checks",
            description: "Validate your capstone's core verdicts before coding",
            controls: ["setRegoScenario"]
        }
    };

    // =========================================================================
    // LESSON 24: Capstone — Data-Layer Policy Build
    // =========================================================================
    COURSE_DATA.levels.research.lessons.capstone_data = {
        id: "capstone_data",
        title: "Capstone: Govern the Data Plane",
        subtitle: "Tag-driven masking + row filters, Immuta-style",
        level: "research",
        number: 24,
        estimatedTime: 480,
        difficulty: 5,
        prerequisites: ["immuta_policies", "testing_verification"],

        content: `
            <div class="lesson-section">
                <h3>🎯 Mission</h3>
                <p>Govern a finance analytics warehouse: tag PII columns, write one <strong>global masking policy</strong> with an auditor exception, one <strong>row-filter policy</strong> (analysts see only their department), and a <strong>guardrail</strong> (training-complete required). Prove fail-closed behavior on a mis-scoped table. <strong>No Immuta tenant? Alternate track:</strong> OPA data-filtering compile-to-SQL (Lesson 12) + Postgres RLS/masking views — same artifacts (taxonomy, transcripts, parity diff against native SQL), no console required.</p>
                <p><strong>Time model (honest):</strong> 480 min across sessions — <strong>M1 taxonomy + masking (150)</strong> → <strong>M2 row filters + guardrail (150)</strong> → <strong>M3 lockout + evidence (180)</strong>.</p>
            </div>

            <div class="lesson-section">
                <h3>📦 Definition of Done</h3>
                <ul>
                    <li>Tag taxonomy documented (PII, PII.SSN depth demo showing deeper-tag-wins; same-depth tie-break noted).</li>
                    <li>Global mask-by-tag with AUDIT exception; numeric-column fallback demonstrated (NULL, not hash-string).</li>
                    <li>Row filter via @columnTagged (never hard-coded names); two-filter AND behavior shown; OR-via-single-policy shown.</li>
                    <li>Guardrail + grant merge demonstrated (per-policy Always Required vs Share Responsibility + guardrail).</li>
                    <li>Lockout demo run <strong>staged / domain-first</strong> (never directly on prod scope): mis-scoped global on a tag-less table returns zero rows, with the fix (re-tag) recorded.</li>
                    <li>Native-parity artifact: generated/synced native code (warehouse RLS/masking) reviewed against the Immuta/PlainID-authored policy for drift.</li>
                </ul>
            </div>

            <div class="lesson-section">
                <h3>📊 Rubric (14/20 to pass) — one artifact per row</h3>
                <p><strong>Submit:</strong> <code>taxonomy.md</code>, policy exports, <code>transcripts/*.md</code> (markdown: command + output per demo step), <code>remediation.log</code>, <code>native-parity.diff</code>. Score each row 0 (absent), partial (present but unchecked), or full per the check. <strong>Points:</strong> partial = 1 pt on every row (including 2-pt row 3); full = listed pts. Max 20, pass at 14.</p>
                <table>
                    <thead><tr><th>#</th><th>Artifact (pts)</th><th>Partial</th><th>Full</th></tr></thead>
                    <tbody>
                        <tr><td>1</td><td>Taxonomy + depth demo transcript (3)</td><td>Tags applied, no conflict demo</td><td>Transcript shows PII vs PII.SSN resolution AND states the same-depth tie-break</td></tr>
                        <tr><td>2</td><td>Masking per-role transcript (3)</td><td>Masked, exception untested</td><td>Transcript shows analyst NULL vs auditor hash vs owner raw on the same table</td></tr>
                        <tr><td>3</td><td>Numeric fallback proof (2)</td><td>Claimed in prose</td><td>Transcript shows a numeric column returning typed NULL (not a hash-string)</td></tr>
                        <tr><td>4</td><td>Row-filter AND/OR demo (3)</td><td>Filters exist, composition unexplained</td><td>Transcript shows two filters ANDing plus OR-inside-one-policy</td></tr>
                        <tr><td>5</td><td>Guardrail merge demo (3)</td><td>Guardrail named, merge untested</td><td>Transcript shows Always Required ANDing vs Share Responsibility ORing against the same table</td></tr>
                        <tr><td>6</td><td>Staged lockout + re-tag log (3)</td><td>Lockout shown without remediation</td><td>Staged-scope lockout transcript AND remediation.log with the re-tag fix</td></tr>
                        <tr><td>7</td><td>Native-parity diff (3)</td><td>Generated code attached unreviewed</td><td>native-parity.diff reviewed line-by-line against the authored policy, drift noted or clean</td></tr>
                    </tbody>
                </table>
            </div>
            ${renderPolicyLab('Preview every masking verdict in the simulator before implementing.')}
        `,

        concepts: ["Global Masking", "Row-Filter Composition", "Guardrail Merge", "Lockout Demonstration"],

        quiz: {
            id: "capstone_data_quiz",
            title: "Capstone Data Quiz",
            passingScore: 60,
            sampleSize: 5,
            timeLimit: 480,
            questions: [
                {
                    id: "q1", type: "multiple-choice",
                    question: "PII and PII.SSN masking policies both match a column. Which applies?",
                    options: [
                        { text: "PII.SSN (deeper tag wins as more specific)", isCorrect: true },
                        { text: "PII (shallower wins)", isCorrect: false },
                        { text: "Neither — they cancel out", isCorrect: false },
                        { text: "A random one", isCorrect: false }
                    ],
                    explanation: "Docs-verified specificity rule — your capstone must demonstrate global-mask resolution by tag depth, not just claim it (Lesson 17).",
                    difficulty: 2, concept: "Global Masking"
                },
                {
                    id: "q2", type: "multiple-choice",
                    question: "Why must the row filter use @columnTagged instead of a literal column name?",
                    options: [
                        { text: "Literal names break on tables lacking the column → lockout; tags adapt per table", isCorrect: true },
                        { text: "Tags run faster", isCorrect: false },
                        { text: "Column names are illegal", isCorrect: false },
                        { text: "No reason — purely cosmetic", isCorrect: false }
                    ],
                    explanation: "The lockout lesson: globals must be written against tags so heterogeneous tables each resolve sensibly.",
                    difficulty: 2, concept: "Row-Filter Composition"
                },
                {
                    id: "q3", type: "multiple-choice",
                    question: "Analysts need rows for dept A OR dept B. How?",
                    options: [
                        { text: "One policy containing the OR (separate row policies AND together)", isCorrect: true },
                        { text: "Two separate row policies (they OR automatically)", isCorrect: false },
                        { text: "Delete one department's data", isCorrect: false },
                        { text: "Row filters cannot express OR", isCorrect: false }
                    ],
                    explanation: "Verified composition: row policies AND; OR lives inside a single policy. Getting this backwards silently over-restricts (or under-).",
                    difficulty: 3, concept: "Row-Filter Composition"
                },
                {
                    id: "q4", type: "multiple-choice",
                    question: "Training-complete guardrail + manager-grant both apply. New hire without training but with manager approval?",
                    options: [
                        { text: "Denied — guardrails are always required on top of any grant", isCorrect: true },
                        { text: "Allowed — the grant overrides", isCorrect: false },
                        { text: "Allowed — guardrails apply only to contractors", isCorrect: false },
                        { text: "Error — conflicting policies halt evaluation", isCorrect: false }
                    ],
                    explanation: "Guardrail AND semantics: delegation-safe by design. Grants widen, guardrails bound.",
                    difficulty: 2, concept: "Guardrail Merge"
                },
                {
                    id: "q5", type: "multiple-choice",
                    question: "Your mis-scoped global returns zero rows on the demo table. How do you present this?",
                    options: [
                        { text: "As the lockout success case: fail-closed evidence + the re-tag fix, logged", isCorrect: true },
                        { text: "Hide it — zero rows looks like failure", isCorrect: false },
                        { text: "Switch to fail-open so rows appear", isCorrect: false },
                        { text: "Present it as a warehouse bug, re-scope silently", isCorrect: false }
                    ],
                    explanation: "Lockout is the data plane proving it fails closed. Documented + remediated lockout is rubric points, not embarrassment.",
                    difficulty: 2, concept: "Lockout Demonstration"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "Analysts in two departments need each other's aggregates but never each other's rows. Design?",
                                options: [
                                    { text: "Row filter denies rows plus a separate aggregate view under its own policy — never weaken the filter", isCorrect: true },
                                    { text: "Weaken the row filter to allow both", isCorrect: false },
                                    { text: "Share logins across departments", isCorrect: false },
                                    { text: "Export CSVs by email", isCorrect: false }
                                ],
                                explanation: "Aggregates are a different access shape with different inference risk. Separate view, separate policy, separate review.",
                                difficulty: 2, concept: "Row-Filter Composition"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "The training guardrail blocks new hires because the HR feed lags 48 hours. Fix that preserves safety?",
                                options: [
                                    { text: "Time-boxed provisional grant with expiry and manager approval, auto-revoked on feed sync", isCorrect: true },
                                    { text: "Drop the guardrail permanently", isCorrect: false },
                                    { text: "Permanent exception for all new hires", isCorrect: false },
                                    { text: "Allow all new hires during onboarding", isCorrect: false }
                                ],
                                explanation: "Stale feeds need bounded exceptions, not removed guardrails. Expiry plus approval plus auto-revoke keeps the invariant.",
                                difficulty: 2, concept: "Guardrail Merge"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "A new PII subtype appears (device IDs). Steps?",
                                options: [
                                    { text: "Extend the taxonomy (PII.Device), tag, verify deeper-tag-wins, add a regression test", isCorrect: true },
                                    { text: "Ignore it until audit finds it", isCorrect: false },
                                    { text: "Rename every existing tag", isCorrect: false },
                                    { text: "Mask every column manually", isCorrect: false }
                                ],
                                explanation: "Taxonomies are living governance. New data classes flow through tag → policy → test, the same pipeline as day one.",
                                difficulty: 1, concept: "Global Masking"
                            }
                        ]
                    },
        animation: {
            type: "data-masking-sim",
            title: "Capstone Verdict Preview",
            description: "Preview masking outcomes per role before implementing",
            controls: ["setMaskRole"]
        }
    };

    // =========================================================================
    // LEVEL DESCRIPTIONS + FOOTER
    // =========================================================================
    COURSE_DATA.levels.beginner.description = "Why authorization fails, the four models, decision anatomy, default-deny, and the business case";
    COURSE_DATA.levels.intermediate.description = "Hands-on OPA/Rego, Cedar, OpenFGA foundations plus XACML/ALFA lineage";
    COURSE_DATA.levels.advanced.description = "OPA (incl. data filtering), Cedar, OpenFGA, Gatekeeper, Conftest, Immuta, and PlainID in production";
    COURSE_DATA.levels.expert.description = "Enforcement patterns, verification, and RBAC-to-PBAC migration";
    COURSE_DATA.levels.research.description = "AI-agent authorization plus two build-and-defend capstones";

    console.log('✅ SUCCESS: PBAC Practical Examples & Platforms loaded!');
    console.log('');
    console.log('📚 Course Structure:');
    console.log('   Level 1 (Foundations): AuthZ intro + models + anatomy + default-deny + business case (5 lessons)');
    console.log('   Level 2 (Languages): Rego foundations + Rego API + Cedar + OpenFGA + XACML/ALFA (5 lessons)');
    console.log('   Level 3 (Platforms): OPA prod + data filtering + Cedar/AVP + OpenFGA prod + Gatekeeper + Conftest + Immuta + PlainID (8 lessons)');
    console.log('   Level 4 (Architecture): Patterns + testing + migration (3 lessons)');
    console.log('   Level 5 (Frontier): AI agents + 2 capstones (3 lessons)');
    console.log('   Total: 24 lessons');
    console.log('');
    console.log('🚀 Features:');
    console.log('   ✓ Critically reviewed examples (OPA/Cedar/OpenFGA/Immuta/PlainID docs + GitHub repos)');
    console.log('   ✓ PBAC Policy Lab visualizers (8 canvas simulators)');
    console.log('   ✓ Pinned versions + Last-verified stamps on every code sample');
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { COURSE_DATA, POLICY_GUIDES };
}
