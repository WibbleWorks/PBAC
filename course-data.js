// PBAC Training Course Data - Foundations (Lessons 1-5)
// ==========================================================
// Beginner tier: why authorization, models compared, architecture,
// default-deny, and the business case. Framework: same shape as the
// GenAI/Quantum courses (COURSE_DATA.levels.<level>.lessons.<id>).

const COURSE_DATA = {
    meta: {
        title: "Policy-Based Access Control Course",
        description: "PBAC for access authorization: foundations, OPA/Rego, Cedar, OpenFGA, Immuta, PlainID, architecture, and capstones",
        version: "1.0.0",
        totalLessons: 0,
        levels: ["beginner", "intermediate", "advanced", "expert", "research"]
    },

    levels: {
        // LEVEL 1: Foundations (Beginner) - Lessons 1-5
        beginner: {
            name: "Foundations",
            description: "Why authorization fails, the access-control models, the policy architecture, default-deny, and the business case",
            color: "#10b981",
            icon: "🎓",
            lessons: {
                access_control_intro: {
                    id: "access_control_intro",
                    title: "Why Authorization Fails",
                    subtitle: "Authentication vs authorization, and the cost of if-statements",
                    level: "beginner",
                    number: 1,
                    estimatedTime: 35,
                    difficulty: 1,
                    prerequisites: [],

                    content: `
                        <div class="lesson-section">
                            <h3>🔐 Authentication Is Not Authorization</h3>
                            <p><strong>Authentication (AuthN)</strong> answers <em>who are you?</em> — passwords, SSO, JWTs, API keys. <strong>Authorization (AuthZ)</strong> answers <em>what may you do?</em> — can this identity read this report, edit this tenant, see this column?</p>
                            <p><strong>The industry failure mode:</strong> teams invest heavily in AuthN (OIDC, MFA, Keycloak) and then scatter AuthZ as <code>if user.role == "admin"</code> checks across every service. Those checks are untestable as a whole, unauditable, and drift between services until a breach finds the gap.</p>
                        </div>

                        <div class="lesson-section">
                            <h3>💥 Three Real Breach Shapes</h3>
                            <ul>
                                <li><strong>Broken object-level authorization (BOLA/IDOR):</strong> <code>GET /invoices/1234</code> returns any invoice when the id is guessed, because the handler checks login but never checks ownership. OWASP API #1 year after year.</li>
                                <li><strong>Tenant leakage:</strong> an analyst for tenant A reads tenant B's rows because the query forgot <code>WHERE tenant_id = ?</code>. One missing predicate, full cross-customer exposure.</li>
                                <li><strong>Fail-open defaults:</strong> an authorizer that returns ALLOW when the policy engine is unreachable, misconfigured, or the input shape is unexpected. Deny must be the default.</li>
                            </ul>
                        </div>

                        <div class="lesson-section">
                            <h3>📜 Policy-Based Access Control in One Paragraph</h3>
                            <p><strong>PBAC</strong> externalizes authorization decisions into versioned, testable <strong>policies</strong> evaluated by a dedicated <strong>policy decision point (PDP)</strong> at request time. Application code asks <em>may S do A on R given context C?</em> and enforces the answer — it never hard-codes the answer. Policies live in Git, go through review, run in CI, and ship like code.</p>
                        </div>

                        <div class="lesson-section">
                            <h3>🧭 What This Course Covers</h3>
                            <ul>
                                <li><strong>Foundations (L1):</strong> models compared, architecture, default-deny, business case</li>
                                <li><strong>Languages (L2):</strong> OPA/Rego, Cedar, OpenFGA — hands-on, critically reviewed against official docs and real-world repos</li>
                                <li><strong>Platforms (L3):</strong> OPA/Cedar/OpenFGA in production, plus Immuta (data) and PlainID (enterprise) scenarios</li>
                                <li><strong>Architecture (L4):</strong> enforcement patterns, testing, RBAC-to-PBAC migration</li>
                                <li><strong>Capstones (L5):</strong> AI-agent guardrails and two build-and-defend projects with rubrics</li>
                            </ul>
                        </div>

                        <div class="lesson-section">
                            <h3>✅ How to Use This Course</h3>
                            <p>Each lesson has written content, a <strong>Policy Lab</strong> visualizer on the right, and a 5-question knowledge check (60% to pass). Lessons unlock sequentially. Your progress saves in the browser automatically.</p>
                        </div>
                    `,

                    concepts: ["Authentication vs Authorization", "BOLA/IDOR", "Tenant Isolation", "Fail-Closed Defaults", "Policy as Code"],

                    quiz: {
                        id: "access_intro_quiz",
                        title: "Why Authorization Fails Quiz",
                        passingScore: 60,
                        sampleSize: 5,
                        timeLimit: 360,
                        questions: [
                            {
                                id: "q1", type: "multiple-choice",
                                question: "What is the core difference between authentication and authorization?",
                                options: [
                                    { text: "Authentication proves who you are; authorization decides what you may do", isCorrect: true },
                                    { text: "They are the same thing with different names", isCorrect: false },
                                    { text: "Authorization happens before authentication", isCorrect: false },
                                    { text: "Authentication is for APIs, authorization is for web pages", isCorrect: false }
                                ],
                                explanation: "AuthN establishes identity (JWT, SSO, MFA). AuthZ evaluates that identity against policy for a specific action on a specific resource. A valid login must never imply permission.",
                                difficulty: 1, concept: "Authentication vs Authorization"
                            },
                            {
                                id: "q2", type: "multiple-choice",
                                question: "GET /invoices/1234 returns another customer's invoice when the id is changed to 1235. The user is logged in. What failed?",
                                options: [
                                    { text: "Object-level authorization (BOLA/IDOR) — ownership of the object was never checked", isCorrect: true },
                                    { text: "Authentication — the user was not logged in", isCorrect: false },
                                    { text: "Encryption — the invoice was not encrypted", isCorrect: false },
                                    { text: "Rate limiting — too many requests were allowed", isCorrect: false }
                                ],
                                explanation: "BOLA is OWASP API #1: the handler verified login but never asked whether this subject may read that object. A PDP check on (subject, read, invoice:1235) would deny it.",
                                difficulty: 1, concept: "BOLA/IDOR"
                            },
                            {
                                id: "q3", type: "multiple-choice",
                                question: "An analyst for tenant A can read tenant B's rows because a query omitted the tenant predicate. What is the structural fix?",
                                options: [
                                    { text: "Enforce tenant isolation in policy (deny unless token tenant == resource tenant), tested in CI", isCorrect: true },
                                    { text: "Add more database indexes", isCorrect: false },
                                    { text: "Require a longer password", isCorrect: false },
                                    { text: "Cache the query results", isCorrect: false }
                                ],
                                explanation: "Tenant isolation is an authorization invariant, not a query-writing discipline. It belongs in centrally evaluated policy with tests, so one forgotten WHERE clause cannot leak a tenant.",
                                difficulty: 2, concept: "Tenant Isolation"
                            },
                            {
                                id: "q4", type: "multiple-choice",
                                question: "Your authorizer cannot reach the policy engine (timeout). What is the safe behavior?",
                                options: [
                                    { text: "Deny the request (fail closed) and alert", isCorrect: true },
                                    { text: "Allow the request so users are not blocked", isCorrect: false },
                                    { text: "Retry forever until the engine responds", isCorrect: false },
                                    { text: "Allow reads but deny writes", isCorrect: false }
                                ],
                                explanation: "Fail-closed is the load-bearing rule of authorization infrastructure. Fail-open turns every outage or misconfiguration into a breach. Timeouts, unknown inputs, and missing attributes must all resolve to DENY.",
                                difficulty: 2, concept: "Fail-Closed Defaults"
                            },
                            {
                                id: "q5", type: "multiple-choice",
                                question: "Which statement best describes policy-based access control?",
                                options: [
                                    { text: "Authorization logic lives in versioned, testable policies evaluated by a PDP; apps enforce the decision", isCorrect: true },
                                    { text: "Every service hard-codes its own if-statements for speed", isCorrect: false },
                                    { text: "Access is granted once at login and never re-checked", isCorrect: false },
                                    { text: "Policies are written in emails and enforced by managers", isCorrect: false }
                                ],
                                explanation: "PBAC = externalize the decision (PDP + policy-as-code), keep enforcement in the app (PEP). Decisions are consistent, reviewable, testable, and auditable across all services.",
                                difficulty: 1, concept: "Policy as Code"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "A mobile app calls GET /orders/{id} with the user's own JWT and returns other users' orders. The root-cause fix?",
                                options: [
                                    { text: "Server-side ownership check (subject vs order.owner) on every read", isCorrect: true },
                                    { text: "Longer, unguessable order IDs", isCorrect: false },
                                    { text: "Hiding the endpoint from API docs", isCorrect: false },
                                    { text: "Requiring re-login per request", isCorrect: false }
                                ],
                                explanation: "Unpredictable IDs are obscurity, not authorization. Only a per-request ownership decision closes BOLA.",
                                difficulty: 2, concept: "BOLA/IDOR"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "Your PDP client library throws on malformed responses. Where should that exception be caught?",
                                options: [
                                    { text: "At the PEP boundary — deny plus alert, never propagate into allow", isCorrect: true },
                                    { text: "In the UI toast notification", isCorrect: false },
                                    { text: "Nowhere — crash the process instead", isCorrect: false },
                                    { text: "In the metrics pipeline only", isCorrect: false }
                                ],
                                explanation: "Exception paths are decision paths. An unhandled throw that skips enforcement is fail-open by accident.",
                                difficulty: 2, concept: "Fail-Closed Defaults"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "Why do policies live in Git rather than a wiki page?",
                                options: [
                                    { text: "Review, versioning, tests, and automated deploy — the same lifecycle as code", isCorrect: true },
                                    { text: "Git is free file storage", isCorrect: false },
                                    { text: "Wikis cannot hold text", isCorrect: false },
                                    { text: "Auditors prefer markdown aesthetics", isCorrect: false }
                                ],
                                explanation: "Policy-as-code earns its name from the lifecycle: reviewed, tested, versioned, shipped — not the file format.",
                                difficulty: 1, concept: "Policy as Code"
                            }
                        ]
                    },
                    animation: {
                        type: "policy-flow",
                        title: "Request Lifecycle",
                        description: "Follow a request from client through PEP, PDP, PIP to decision",
                        controls: ["flowPrev", "flowNext"]
                    }
                },

                rbac_abac_rebac: {
                    id: "rbac_abac_rebac",
                    title: "RBAC vs ABAC vs PBAC vs ReBAC",
                    subtitle: "Four models, one comparison, no hype",
                    level: "beginner",
                    number: 2,
                    estimatedTime: 60,
                    difficulty: 2,
                    prerequisites: ["access_control_intro"],

                    content: `
                        <div class="lesson-section">
                            <h3>👥 RBAC: Roles as Indirection</h3>
                            <p><strong>Role-based access control</strong> grants permissions to roles, users to roles. <em>alice is analyst → analyst may read reports.</em> Cheap to start, and it collapses under <strong>role explosion</strong>: analyst-eu, analyst-us, analyst-eu-manager-readonly… each new dimension multiplies roles until nobody can audit who can do what.</p>
                        </div>

                        <div class="lesson-section">
                            <h3>🏷️ ABAC: Attributes Decide</h3>
                            <p><strong>Attribute-based access control</strong> evaluates attributes of subject, resource, action, and environment: <em>allow if subject.dept == resource.dept AND clearance >= 3 AND 09:00 &lt; now &lt; 17:00.</em> Far more expressive — and the rules have to live <em>somewhere</em>. Without a policy engine, ABAC becomes stringly-typed if-statements again.</p>
                        </div>

                        <div class="lesson-section">
                            <h3>📜 PBAC: The Delivery Mechanism</h3>
                            <p><strong>PBAC is not a rival to RBAC/ABAC — it is how you deliver them.</strong> RBAC role mappings, ABAC attribute rules, and ownership checks all become versioned policies evaluated at a PDP. The model answers <em>what logic</em>; PBAC answers <em>where it lives, how it ships, and how it is tested</em>.</p>
                        </div>

                        <div class="lesson-section">
                            <h3>🕸️ ReBAC: Relationships Decide (Zanzibar)</h3>
                            <p><strong>Relationship-based access control</strong>, pioneered by Google Zanzibar and open-sourced as OpenFGA, stores relationship tuples (<em>anne is editor of doc:Q3</em>) and answers <em>does a path exist from subject to object through allowed relations?</em> Ideal for sharing graphs (docs, repos, drives). Concentric inheritance (<em>editor implies viewer</em>) removes whole classes of tuples.</p>
                        </div>

                        <div class="lesson-section">
                            <h3>⚖️ Choosing Honestly</h3>
                            <ul>
                                <li><strong>Small internal tool, 3 roles, no sharing:</strong> RBAC in a policy file is fine. Do not buy a platform.</li>
                                <li><strong>Multi-tenant SaaS with per-customer rules:</strong> ABAC-over-PBAC (OPA/Cedar); tenant and attributes in every decision.</li>
                                <li><strong>Drive/Docs-style sharing, teams, nested groups:</strong> ReBAC (OpenFGA); graphs beat attribute lists.</li>
                                <li><strong>Data warehouse with masking + row filters:</strong> Immuta-style data policies; column tags, not app code.</li>
                                <li><strong>Enterprise with auditors and hundred-app sprawl:</strong> PlainID-style orchestration; one policy plane, many enforcement points.</li>
                            </ul>
                            <p>Most real estates end up <strong>hybrid</strong>: ReBAC for the sharing graph, ABAC-over-PBAC for API/fine-grained rules, data policies for the warehouse. This course teaches all three seams.</p>
                        </div>
                    `,

                    concepts: ["Role Explosion", "ABAC", "PBAC as Delivery", "ReBAC/Zanzibar", "Model Selection"],

                    quiz: {
                        id: "models_quiz",
                        title: "Access Models Quiz",
                        passingScore: 60,
                        sampleSize: 5,
                        timeLimit: 420,
                        questions: [
                            {
                                id: "q1", type: "multiple-choice",
                                question: "A company has 400 roles including analyst-eu-readonly-contractor and manager-us-write-fulltime. What is this failure called?",
                                options: [
                                    { text: "Role explosion — dimensions multiplied into unauditable roles", isCorrect: true },
                                    { text: "Privilege creep on a single account", isCorrect: false },
                                    { text: "A secure default-deny posture", isCorrect: false },
                                    { text: "Proper separation of duties", isCorrect: false }
                                ],
                                explanation: "RBAC scales by role count. Every new dimension (region × seniority × employment type) multiplies roles. The fix is attribute/policy rules that compute access instead of enumerating it.",
                                difficulty: 1, concept: "Role Explosion"
                            },
                            {
                                id: "q2", type: "multiple-choice",
                                question: "allow if subject.clearance >= resource.classification AND subject.dept == resource.dept. Which model?",
                                options: [
                                    { text: "ABAC — decision from subject/resource/environment attributes", isCorrect: true },
                                    { text: "RBAC — decision from role membership only", isCorrect: false },
                                    { text: "ReBAC — decision from relationship graph paths", isCorrect: false },
                                    { text: "DAC — decision by object owner discretion only", isCorrect: false }
                                ],
                                explanation: "Attribute rules over subject, resource, and environment are the textbook ABAC shape. RBAC would need a pre-built role per (dept × classification) combination.",
                                difficulty: 1, concept: "ABAC"
                            },
                            {
                                id: "q3", type: "multiple-choice",
                                question: "How does PBAC relate to RBAC and ABAC?",
                                options: [
                                    { text: "PBAC is the delivery mechanism: RBAC/ABAC logic expressed as versioned policy evaluated at a PDP", isCorrect: true },
                                    { text: "PBAC replaces both and they must never be used", isCorrect: false },
                                    { text: "PBAC is only for networks, RBAC/ABAC only for apps", isCorrect: false },
                                    { text: "They are competing vendors and cannot be combined", isCorrect: false }
                                ],
                                explanation: "Model = what logic. PBAC = where it lives and how it ships. A Cedar permit keyed on a role attribute IS RBAC delivered through PBAC.",
                                difficulty: 2, concept: "PBAC as Delivery"
                            },
                            {
                                id: "q4", type: "multiple-choice",
                                question: "A docs app needs: anne shared doc:Q3 with team:eng as editors; every editor must read as viewer without extra tuples. Best fit?",
                                options: [
                                    { text: "ReBAC (OpenFGA): editor relation implies viewer; team membership resolves transitively", isCorrect: true },
                                    { text: "Pure RBAC with one global editor role", isCorrect: false },
                                    { text: "A firewall allowlist of IP addresses", isCorrect: false },
                                    { text: "Column masking in the warehouse", isCorrect: false }
                                ],
                                explanation: "Sharing graphs with transitive membership and concentric relations are exactly the Zanzibar/OpenFGA sweet spot. Roles cannot express per-object sharing; ABAC lists get unwieldy.",
                                difficulty: 2, concept: "ReBAC/Zanzibar"
                            },
                            {
                                id: "q5", type: "multiple-choice",
                                question: "A 3-role internal tool with no sharing and no auditors asks for an enterprise policy platform. Honest advice?",
                                options: [
                                    { text: "RBAC in a versioned policy file is enough; do not buy a platform yet", isCorrect: true },
                                    { text: "Deploy all five platforms taught in this course immediately", isCorrect: false },
                                    { text: "Skip authorization entirely at this scale", isCorrect: false },
                                    { text: "Hard-code checks in each handler for speed", isCorrect: false }
                                ],
                                explanation: "Proportionality is a professional skill. PBAC discipline (default-deny, versioned rules, tests) pays off at any size; the heavy platforms earn their keep with scale, sharing graphs, or audit pressure.",
                                difficulty: 2, concept: "Model Selection"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "A role matrix has 12 regions × 4 seniorities × 3 contract types = 144 roles. What single change kills the explosion?",
                                options: [
                                    { text: "Replace the region/seniority/type dimensions with attributes evaluated in policy", isCorrect: true },
                                    { text: "Rename roles to shorter codes", isCorrect: false },
                                    { text: "Merge everything into one admin role", isCorrect: false },
                                    { text: "Move the matrix to a spreadsheet", isCorrect: false }
                                ],
                                explanation: "Explosion is multiplicative dimensions. Attributes compute what roles enumerate — 3 attributes replace 144 roles.",
                                difficulty: 2, concept: "Role Explosion"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "Contractors may read only public documents during business hours. How many new roles does the ABAC version need?",
                                options: [
                                    { text: "Zero — one rule over employment-type, classification, and time attributes", isCorrect: true },
                                    { text: "One per contractor", isCorrect: false },
                                    { text: "One per document", isCorrect: false },
                                    { text: "Three — one per condition", isCorrect: false }
                                ],
                                explanation: "ABAC scales by rule, not by role count. Conditions compose inside one rule.",
                                difficulty: 2, concept: "ABAC"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "Alice shares doc:Q3 with Bob as viewer; the whole team:eng edits it. How does the team get viewer access with zero per-doc writes?",
                                options: [
                                    { text: "Model-level rule (editor implies viewer) plus the team tuple — no per-doc writes", isCorrect: true },
                                    { text: "Email everyone a share link", isCorrect: false },
                                    { text: "Make all documents public", isCorrect: false },
                                    { text: "Copy Bob's tuple to each teammate by hand", isCorrect: false }
                                ],
                                explanation: "ReBAC puts the implication in the model (concentric relations) and membership in tuples. Per-doc grants are the RBAC reflex this model replaces.",
                                difficulty: 2, concept: "ReBAC/Zanzibar"
                            }
                        ]
                    },
                    animation: {
                        type: "rbac-abac-compare",
                        title: "Same Request, Four Models",
                        description: "Switch RBAC / ABAC / PBAC / ReBAC and compare the decision logic",
                        controls: ["setCompareMode"]
                    }
                },

                policy_anatomy: {
                    id: "policy_anatomy",
                    title: "Anatomy of a Policy Decision",
                    subtitle: "PEP, PDP, PIP, PAP — the XACML boxes that actually matter",
                    level: "beginner",
                    number: 3,
                    estimatedTime: 35,
                    difficulty: 2,
                    prerequisites: ["rbac_abac_rebac"],

                    content: `
                        <div class="lesson-section">
                            <h3>🧱 The Four Boxes (XACML vocabulary, universal idea)</h3>
                            <ul>
                                <li><strong>PEP — Policy Enforcement Point:</strong> intercepts the request (sidecar, gateway filter, middleware). Asks, then enforces. Never decides.</li>
                                <li><strong>PDP — Policy Decision Point:</strong> evaluates policy + attributes, returns ALLOW/DENY (+ reason). OPA, Cedar engine, OpenFGA server, PlainID PDP.</li>
                                <li><strong>PIP — Policy Information Point:</strong> supplies attributes (groups, clearance, time, device posture). HR system, IdP, device inventory.</li>
                                <li><strong>PAP — Policy Administration Point:</strong> authors, versions, ships policy (Git + bundle pipeline + Immuta/PlainID consoles).</li>
                            </ul>
                        </div>

                        <div class="lesson-section">
                            <h3>🔁 The Decision Lifecycle</h3>
                            <ol>
                                <li>Client calls <code>GET /reports/q3</code> with a JWT.</li>
                                <li>PEP intercepts, extracts subject/action/resource/context.</li>
                                <li>PEP queries PDP: <em>may S do A on R given C?</em></li>
                                <li>PDP loads the current policy bundle; pulls attributes from PIPs.</li>
                                <li>PDP evaluates: default DENY unless a permit rule matches (and no forbid overrides).</li>
                                <li>PDP returns decision + determining policy ids (audit trail).</li>
                                <li>PEP enforces: forward or 403. Every denial is logged with its reason.</li>
                            </ol>
                        </div>

                        <div class="lesson-section">
                            <h3>📨 What Travels in an AuthZ Query</h3>
                            <p><strong>Subject</strong> (who: id, roles, groups, tenant), <strong>action</strong> (what verb: read/write/delete, preferably <code>resource:action</code>), <strong>resource</strong> (which object: type, id, owner, tenant, labels), <strong>context</strong> (when/where/how: time, IP, MFA, device). If any of the four is missing, the policy cannot decide correctly — schema it.</p>
                        </div>

                        <div class="lesson-section">
                            <h3>⚠️ Two Classic Confusions</h3>
                            <ul>
                                <li><strong>PEP vs PDP:</strong> putting rule logic in the middleware <em>is</em> the scattered-if-statement problem. The PEP maps routes to permission strings; the PDP owns the rules.</li>
                                <li><strong>AuthN tokens vs AuthZ attributes:</strong> a JWT proves identity and carries claims, but group membership, clearance, and resource labels usually come from PIPs at decision time — fresher than token issuance.</li>
                            </ul>
                        </div>
                    `,

                    concepts: ["PEP", "PDP", "PIP/PAP", "AuthZ Query Shape", "PEP vs PDP Separation"],

                    quiz: {
                        id: "anatomy_quiz",
                        title: "Policy Decision Anatomy Quiz",
                        passingScore: 60,
                        sampleSize: 5,
                        timeLimit: 420,
                        questions: [
                            {
                                id: "q1", type: "multiple-choice",
                                question: "A sidecar intercepts GET /payments/123, asks the engine, then forwards or returns 403. Which box is the sidecar?",
                                options: [
                                    { text: "PEP — it intercepts and enforces, but does not decide", isCorrect: true },
                                    { text: "PDP — it makes the allow/deny decision", isCorrect: false },
                                    { text: "PIP — it supplies user attributes", isCorrect: false },
                                    { text: "PAP — it authors and versions policy", isCorrect: false }
                                ],
                                explanation: "Enforcement (intercept + forward/deny) is the PEP job. The decision comes from the PDP. Mixing them recreates scattered authorization logic.",
                                difficulty: 1, concept: "PEP"
                            },
                            {
                                id: "q2", type: "multiple-choice",
                                question: "Which component returns ALLOW/DENY for (subject, action, resource, context)?",
                                options: [
                                    { text: "PDP — the policy decision point (OPA, Cedar engine, OpenFGA, PlainID PDP)", isCorrect: true },
                                    { text: "PEP — the enforcement point", isCorrect: false },
                                    { text: "PIP — the attribute source", isCorrect: false },
                                    { text: "CDN — the content cache", isCorrect: false }
                                ],
                                explanation: "The PDP owns evaluation. Everything else feeds it (PIP), asks it (PEP), or ships to it (PAP).",
                                difficulty: 1, concept: "PDP"
                            },
                            {
                                id: "q3", type: "multiple-choice",
                                question: "Group membership, clearance level, and device posture arrive at decision time from HR/IdP/device systems. What are these systems?",
                                options: [
                                    { text: "PIPs — policy information points supplying attributes", isCorrect: true },
                                    { text: "PEPs — enforcement points", isCorrect: false },
                                    { text: "PAPs — policy authoring tools", isCorrect: false },
                                    { text: "PDPs — decision points", isCorrect: false }
                                ],
                                explanation: "Attributes flow from PIPs. Freshness matters: group changes should affect decisions without waiting for token re-issue.",
                                difficulty: 2, concept: "PIP/PAP"
                            },
                            {
                                id: "q4", type: "multiple-choice",
                                question: "An authZ query contains subject + action but no resource identifier. Why is this dangerous?",
                                options: [
                                    { text: "Policy cannot check ownership or tenancy — decisions become coarse allow/deny for whole APIs", isCorrect: true },
                                    { text: "It makes responses slightly slower", isCorrect: false },
                                    { text: "It violates REST naming conventions", isCorrect: false },
                                    { text: "It prevents gzip compression", isCorrect: false }
                                ],
                                explanation: "BOLA lives here. Without the resource (type, id, owner, tenant), the PDP can only answer role-wide questions, never is-this-subject-allowed-this-object.",
                                difficulty: 2, concept: "AuthZ Query Shape"
                            },
                            {
                                id: "q5", type: "multiple-choice",
                                question: "Where should the rule 'analysts may read only their own tenant' live?",
                                options: [
                                    { text: "In PDP policy, with the PEP only mapping the route to a permission string", isCorrect: true },
                                    { text: "Hard-coded in each service handler", isCorrect: false },
                                    { text: "In the JWT signing key", isCorrect: false },
                                    { text: "In the frontend router", isCorrect: false }
                                ],
                                explanation: "PEP maps (route → permission/action); PDP owns rules. That split keeps one auditable source of truth and lets tests cover the invariant once.",
                                difficulty: 2, concept: "PEP vs PDP Separation"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "A user's department changes in HR but decisions use yesterday's value. Which box is stale?",
                                options: [
                                    { text: "PIP feed (attribute freshness) — shorten sync or read through at decision time", isCorrect: true },
                                    { text: "PEP cache of HTML pages", isCorrect: false },
                                    { text: "PAP font choice", isCorrect: false },
                                    { text: "PDP power supply", isCorrect: false }
                                ],
                                explanation: "Decisions are only as fresh as their attributes. PIP latency is an authorization parameter, not an HR detail.",
                                difficulty: 1, concept: "PIP/PAP"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "A request arrives with subject and resource but no action. What should the PDP do?",
                                options: [
                                    { text: "Deny — an action-less query cannot match least-privilege rules; fix the PEP to send it", isCorrect: true },
                                    { text: "Guess read, since reads are safe", isCorrect: false },
                                    { text: "Allow and log verbosely", isCorrect: false },
                                    { text: "Ask the end user what they meant", isCorrect: false }
                                ],
                                explanation: "Every AuthZ query needs all four elements. Guessing the verb is how write-access hides inside read-shaped holes.",
                                difficulty: 2, concept: "AuthZ Query Shape"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "Two services ask the same PDP the same question and get different answers. First suspect?",
                                options: [
                                    { text: "They sent different inputs — stale attributes or different resource ids", isCorrect: true },
                                    { text: "PDP mood varies by caller", isCorrect: false },
                                    { text: "Network speed differences", isCorrect: false },
                                    { text: "Time-zone settings", isCorrect: false }
                                ],
                                explanation: "PDPs are deterministic over (policy, input). Divergent answers mean divergent inputs — diff them before blaming the engine.",
                                difficulty: 1, concept: "PDP"
                            }
                        ]
                    },
                    animation: {
                        type: "policy-flow",
                        title: "Decision Lifecycle Stepper",
                        description: "Step through the 7-stage PEP → PDP → PIP flow",
                        controls: ["flowPrev", "flowNext"]
                    }
                },

                default_deny: {
                    id: "default_deny",
                    title: "Default-Deny and Testing",
                    subtitle: "The one invariant that prevents breaches",
                    level: "beginner",
                    number: 4,
                    estimatedTime: 40,
                    difficulty: 2,
                    prerequisites: ["policy_anatomy"],

                    content: `
                        <div class="lesson-section">
                            <h3>🔒 Deny by Default, Permit by Exception</h3>
                            <p>Every policy set in this course starts closed: <strong>no rule matched → DENY</strong>. In Rego: <code>default allow := false</code>. In Cedar: <em>deny unless a permit matches</em> (plus forbid overrides). In OpenFGA: <em>no relation path → deny</em>. Open by default is never a performance optimization — it is a breach waiting for an outage.</p>
                        </div>

                        <div class="lesson-section">
                            <h3>🧪 Authorization Needs Tests Like Code</h3>
                            <ul>
                                <li><strong>Allow-cases:</strong> each permit rule has a test with the minimal input that should pass.</li>
                                <li><strong>Deny-cases:</strong> strangers, wrong tenants, expired MFA, private resources — each must return false.</li>
                                <li><strong>Regression-cases:</strong> every past incident becomes a permanent test (<code>test_analyst_denied_other_tenant</code>).</li>
                                <li><strong>Property checks:</strong> unknown roles, missing fields, and empty inputs must all deny.</li>
                            </ul>
                        </div>

                        <div class="lesson-section">
                            <h3>📋 Reasons, Not Just Booleans</h3>
                            <p>A bare <code>true/false</code> cannot be audited or debugged. Production PDP responses carry <strong>which policies determined the decision</strong> (Cedar determining-policies, OPA decision logs, OpenFGA tuples used, PlainID access-policy names). Denials log the reason; the simulator in this lesson's lab shows why each scenario passes or fails.</p>
                        </div>

                        <div class="lesson-section">
                            <h3>🚨 Fail-Open Smells to Memorize</h3>
                            <ul>
                                <li><code>failure_mode_allow: true</code> on a gateway authz filter</li>
                                <li><code>OPA_FAIL_OPEN=true</code> in middleware env</li>
                                <li>Catching PDP timeouts and continuing to the handler</li>
                                <li><code>default allow := true</code> in any Rego file, ever</li>
                            </ul>
                        </div>
                    `,

                    concepts: ["Default Deny", "Permit by Exception", "Decision Reasons", "Fail-Open Smells", "Regression Tests"],

                    quiz: {
                        id: "deny_quiz",
                        title: "Default-Deny Quiz",
                        passingScore: 60,
                        sampleSize: 5,
                        timeLimit: 360,
                        questions: [
                            {
                                id: "q1", type: "multiple-choice",
                                question: "What does default-deny mean in practice?",
                                options: [
                                    { text: "No rule matched → DENY; access requires an explicit permit", isCorrect: true },
                                    { text: "All requests are denied permanently", isCorrect: false },
                                    { text: "Admins are denied first, then allowed", isCorrect: false },
                                    { text: "Denials are never logged", isCorrect: false }
                                ],
                                explanation: "Default-deny is a closed starting posture with explicit exceptions (permit rules), not a refusal to grant access. Rego: default allow := false.",
                                difficulty: 1, concept: "Default Deny"
                            },
                            {
                                id: "q2", type: "multiple-choice",
                                question: "A Rego file contains default allow := true with narrow deny rules. What is wrong?",
                                options: [
                                    { text: "Fail-open: any input the deny rules did not anticipate is allowed", isCorrect: true },
                                    { text: "Nothing — this is the recommended pattern", isCorrect: false },
                                    { text: "It will be too slow", isCorrect: false },
                                    { text: "OPA cannot parse the keyword default", isCorrect: false }
                                ],
                                explanation: "Deny-lists enumerate badness; the universe of bad inputs is infinite. Default-allow with deny override only works when layered over a default-deny base with explicit broad permits — never as the base itself.",
                                difficulty: 2, concept: "Permit by Exception"
                            },
                            {
                                id: "q3", type: "multiple-choice",
                                question: "Which test belongs in every authorization test-suite?",
                                options: [
                                    { text: "Cross-tenant read must deny (analyst of A reading B's object)", isCorrect: true },
                                    { text: "Admin login page renders in under 50ms", isCorrect: false },
                                    { text: "Passwords contain a special character", isCorrect: false },
                                    { text: "The homepage has no broken images", isCorrect: false }
                                ],
                                explanation: "Tenant isolation is the invariant most likely to regress silently. Pin it as a named, permanent regression test — every past incident becomes a test that runs on every build (Lesson 20).",
                                difficulty: 2, concept: "Regression Tests"
                            },
                            {
                                id: "q4", type: "multiple-choice",
                                question: "Why should PDP responses include determining policies / reasons?",
                                options: [
                                    { text: "Auditability and debugging: know which rule allowed/denied and why", isCorrect: true },
                                    { text: "To make responses larger and slower", isCorrect: false },
                                    { text: "Because JSON requires a reason field", isCorrect: false },
                                    { text: "Only to satisfy frontend developers", isCorrect: false }
                                ],
                                explanation: "A bare boolean cannot answer 'why was this denied?' at 3am or 'which rule granted this?' in an audit. Cedar, OPA decision logs, and PlainID all surface determining policy.",
                                difficulty: 1, concept: "Decision Reasons"
                            },
                            {
                                id: "q5", type: "multiple-choice",
                                question: "During a code review you see: except TimeoutError: return ALLOW. What do you do?",
                                options: [
                                    { text: "Block it — PDP unreachable must fail closed (deny + alert), never allow", isCorrect: true },
                                    { text: "Approve — availability matters more than authorization", isCorrect: false },
                                    { text: "Approve if it only affects reads", isCorrect: false },
                                    { text: "Ignore — timeouts never happen in production", isCorrect: false }
                                ],
                                explanation: "Fail-open on timeout converts every network blip into unauthorized access. The safe pattern: deny, emit a metric/alert, and let operators — not attackers — decide.",
                                difficulty: 2, concept: "Fail-Open Smells"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "A denial arrives with no reason attached. What is the operational cost?",
                                options: [
                                    { text: "On-call cannot distinguish attack from misconfiguration; audits cannot attribute the decision", isCorrect: true },
                                    { text: "None — a 403 is self-explanatory", isCorrect: false },
                                    { text: "Slightly larger log volume", isCorrect: false },
                                    { text: "Marginally slower responses", isCorrect: false }
                                ],
                                explanation: "Reasons turn denials into diagnosable, auditable events. Bare booleans are operational darkness.",
                                difficulty: 2, concept: "Decision Reasons"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "A partner integration needs one new endpoint. Safest change?",
                                options: [
                                    { text: "Add one narrow permit rule plus its deny-test; the default stays deny", isCorrect: true },
                                    { text: "Default-allow during onboarding, tighten later", isCorrect: false },
                                    { text: "Share an admin token for speed", isCorrect: false },
                                    { text: "Disable authorization for their IP range", isCorrect: false }
                                ],
                                explanation: "Permit-by-exception scales one rule at a time. Temporary openness has a perfect record of becoming permanent.",
                                difficulty: 2, concept: "Permit by Exception"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "A brand-new resource type has no rules yet. What happens on first access?",
                                options: [
                                    { text: "Deny — unmatched means denied until a permit is written and reviewed", isCorrect: true },
                                    { text: "Allow until someone complains", isCorrect: false },
                                    { text: "Deny forever, even after rules are added", isCorrect: false },
                                    { text: "The PDP crashes on unknown types", isCorrect: false }
                                ],
                                explanation: "Default-deny covers the unknown-unknowns: new resources are closed on arrival, opened deliberately.",
                                difficulty: 1, concept: "Default Deny"
                            }
                        ]
                    },
                    animation: {
                        type: "default-deny-sim",
                        title: "Default-Deny Simulator",
                        description: "Run scenarios with default-deny on and off; watch unmatched requests",
                        controls: ["setDenyScenario", "toggleDenyRules"]
                    }
                },

                pbac_business_case: {
                    id: "pbac_business_case",
                    title: "The Business Case for PBAC",
                    subtitle: "Risk, cost, compliance — and when not to adopt",
                    level: "beginner",
                    number: 5,
                    estimatedTime: 40,
                    difficulty: 1,
                    prerequisites: ["default_deny"],

                    content: `
                        <div class="lesson-section">
                            <h3>💰 The Cost of Scattered AuthZ</h3>
                            <ul>
                                <li><strong>Breach cost:</strong> BOLA and tenant leakage are data-breach categories with notification, churn, and regulatory exposure.</li>
                                <li><strong>Audit cost:</strong> answering <em>who can access what?</em> across N services with inline checks is a quarter-long project. With centralized policy it is a query.</li>
                                <li><strong>Velocity cost:</strong> every new endpoint re-implements checks; every incident fix must be ported N times.</li>
                                <li><strong>People cost:</strong> only the original author understands service #7's checks. Policy-as-code is readable by the next team.</li>
                            </ul>
                        </div>

                        <div class="lesson-section">
                            <h3>🏛️ Compliance Maps to Policy Artifacts (Partially)</h3>
                            <p>SOC 2, ISO 27001, HIPAA, GDPR, and the EU AI Act all ask variants of: <em>define access rules, enforce least privilege, review them, log decisions.</em> Versioned policy + decision logs + periodic access reviews <strong>support</strong> controls like SOC 2 CC6/CC7, ISO A.5/A.8, HIPAA §164.308/312, GDPR Art. 5/25/32, and AI Act logging/human-oversight — <strong>but do not alone satisfy them</strong>. HIPAA still needs administrative/physical safeguards + risk analysis; GDPR still needs DPIAs, subject rights, breach notification, minimization; the AI Act still needs risk management, data governance, and robustness. Map control-by-control; residual work (reviews, DPIAs, incident process, tagging stewardship) is real labor, not "almost free".</p>
                        </div>

                            <div class="lesson-section">
                    <h3>🗺️ The Platform Landscape (Vendor-Neutral)</h3>
                            <ul>
                                <li><strong>OPA:</strong> general-purpose engine; APIs, K8s (Gatekeeper), CI (Conftest), data filtering. You host it.</li>
                                <li><strong>Cedar / Amazon Verified Permissions:</strong> app-focused language + managed PDP; schema-first with formal verification tooling.</li>
                                <li><strong>OpenFGA:</strong> Zanzibar-style relationship engine for sharing graphs. You host it.</li>
                                <li><strong>Immuta:</strong> data-plane governance: subscription + masking/row policies on Snowflake/Databricks/etc.</li>
                                <li><strong>PlainID:</strong> enterprise authorization plane: visual policy, PDP APIs, SaaS connectors, AI-agent guardrails.</li>
                            </ul>
                            <p><strong>Also in the market (not full lessons — honest placement):</strong></p>
                            <ul>
                                <li><strong>Styra DAS:</strong> managed OPA control plane (bundles, decisions, audit) — choose over self-hosted OPA when you want OPA semantics without running the fleet. Bill: managed platform (confirm current pricing). Exit: your Rego ports, but re-point sidecars/bundles, replay decision-audit, and rebuild DAS-specific distribution config.</li>
                                <li><strong>Aserto:</strong> managed PDP + directory with framework authorizers — choose for drop-in app integration speed. Bill: managed per-decision/seat (confirm current pricing). Exit: OPA-compatible policies port, but directory data and Edge authorizer bindings need remapping.</li>
                                <li><strong>Warrant:</strong> Zanzibar-style managed API (objects, relations, warrants) — choose over OpenFGA when you want the relationship model without operating it; exit means re-homing tuples + model, so keep an export routine from day one.</li>
                                <li><strong>Ory Keto:</strong> self-hosted Zanzibar-style engine in the Ory ecosystem — choose when you already run Ory (Kratos/Hydra) and want one identity+authZ vendor. Bill: your ops instead of a vendor invoice; same tuple-portability caveat as Warrant.</li>
                            </ul>
                            <p>Rule of thumb: <strong>managed buys speed, self-hosted buys control, open languages buy exits.</strong> Every managed pick above rents its decision path — price the exit (export routines, portable policies) before you need it.</p>
                            <p>This course is <strong>not</strong> a vendor pitch: every platform lesson names the lock-in, the bill, and the exit path.</p>
                        </div>

                        <div class="lesson-section">
                            <h3>🚫 When NOT to Adopt (Honesty Section)</h3>
                            <ul>
                                <li>Three roles, one app, no auditors → policy file + tests, no platform.</li>
                                <li>No owner for policy content → a PDP without maintained policy is shelfware with latency.</li>
                                <li>Latency budget under ~5ms p99 with no cache tolerance → decide locally or cache decisions; measure first.</li>
                            </ul>
                        </div>
                    `,

                    concepts: ["Total Cost of AuthZ", "Compliance Evidence", "Platform Landscape", "Least Privilege"],

                    quiz: {
                        id: "business_quiz",
                        title: "Business Case Quiz",
                        passingScore: 60,
                        sampleSize: 5,
                        timeLimit: 360,
                        questions: [
                            {
                                id: "q1", type: "multiple-choice",
                                question: "What is the most expensive property of scattered if-statement authorization?",
                                options: [
                                    { text: "No single auditable answer to 'who can access what' — every review is N-service archaeology", isCorrect: true },
                                    { text: "If-statements use too much CPU", isCorrect: false },
                                    { text: "If-statements cannot check roles", isCorrect: false },
                                    { text: "Junior developers cannot read if-statements", isCorrect: false }
                                ],
                                explanation: "The cost is systemic: unauditable, untestable-as-a-whole, and N-times porting of every fix. CPU is irrelevant; comprehension at estate scale is the bill.",
                                difficulty: 1, concept: "Total Cost of AuthZ"
                            },
                            {
                                id: "q2", type: "multiple-choice",
                                question: "An auditor asks for evidence of least-privilege enforcement. What do you show in a PBAC estate?",
                                options: [
                                    { text: "Versioned policy + decision logs + periodic access reviews", isCorrect: true },
                                    { text: "The OIDC configuration showing MFA is enabled", isCorrect: false },
                                    { text: "The password complexity setting", isCorrect: false },
                                    { text: "A verbal assurance from engineering", isCorrect: false }
                                ],
                                explanation: "Policy history shows what the rules were; decision logs show what was enforced; reviews show humans still check. That triple is the compliance artifact.",
                                difficulty: 1, concept: "Compliance Evidence"
                            },
                            {
                                id: "q3", type: "multiple-choice",
                                question: "Which platform fits warehouse column-masking and row filters on Snowflake/Databricks?",
                                options: [
                                    { text: "Immuta-style data policies (subscription + masking/row rules by tag)", isCorrect: true },
                                    { text: "OpenFGA relationship tuples", isCorrect: false },
                                    { text: "Kubernetes admission control", isCorrect: false },
                                    { text: "JWT signature verification", isCorrect: false }
                                ],
                                explanation: "Data-plane governance (mask/tag/row-filter at query time) is Immuta's lane. OpenFGA answers object-sharing questions; K8s admission answers deploy-time questions.",
                                difficulty: 2, concept: "Platform Landscape"
                            },
                            {
                                id: "q4", type: "multiple-choice",
                                question: "Your estate shows versioned policy, decision logs, and quarterly access reviews. The GDPR auditor now asks about deletion handling and DPIAs. Best response?",
                                options: [
                                    { text: "Produce the DPIA register and deletion runbooks — policy artifacts never covered those; map control-by-control", isCorrect: true },
                                    { text: "Claim the PDP logs alone satisfy GDPR", isCorrect: false },
                                    { text: "Delete the decision logs to minimize stored data", isCorrect: false },
                                    { text: "Show the login page again, more slowly", isCorrect: false }
                                ],
                                explanation: "Residual work is real: DPIAs, subject rights, breach notification, and minimization sit outside authorization. Evidence supports a control; it is not the control.",
                                difficulty: 2, concept: "Compliance Evidence"
                            },
                            {
                                id: "q5", type: "multiple-choice",
                                question: "What does least privilege require of a policy set over time?",
                                options: [
                                    { text: "Regular reviews that shrink grants to what is actually used", isCorrect: true },
                                    { text: "Granting admin to everyone for simplicity", isCorrect: false },
                                    { text: "Never changing policies after launch", isCorrect: false },
                                    { text: "Deleting all logs to save storage", isCorrect: false }
                                ],
                                explanation: "Least privilege is a process, not a launch state: grants decay toward usage, exceptions expire, and reviews remove what drifted.",
                                difficulty: 1, concept: "Least Privilege"
                            },
                            {
                                id: "q6", type: "multiple-choice",
                                question: "Which pair is correctly matched to its sweet spot?",
                                options: [
                                    { text: "OpenFGA → per-object sharing graphs; Immuta-style → warehouse masking", isCorrect: true },
                                    { text: "JWTs → warehouse masking; OpenFGA → column masking", isCorrect: false },
                                    { text: "Gatekeeper → SaaS user provisioning", isCorrect: false },
                                    { text: "PlainID → container image scanning", isCorrect: false }
                                ],
                                explanation: "Relationship engines answer sharing questions; data-plane governance answers masking questions. Mismatching them is the classic platform misbuy.",
                                difficulty: 2, concept: "Platform Landscape"
                            },
                            {
                                id: "q7", type: "multiple-choice",
                                question: "Quarterly review finds 40% of grants unused. Correct response?",
                                options: [
                                    { text: "Expire or remove them; require re-justification for exceptions", isCorrect: true },
                                    { text: "Keep them — removal feels risky", isCorrect: false },
                                    { text: "Convert everything to admin for simplicity", isCorrect: false },
                                    { text: "Review less often to save time", isCorrect: false }
                                ],
                                explanation: "Least privilege decays without pruning. Unused grants are breach surface with zero business value.",
                                difficulty: 2, concept: "Least Privilege"
                            },
                            {
                                id: "q8", type: "multiple-choice",
                                question: "The cheapest authorization to operate across 50 services is…",
                                options: [
                                    { text: "One policy plane with per-service enforcement, tested once", isCorrect: true },
                                    { text: "Fifty hand-rolled check sets", isCorrect: false },
                                    { text: "No authorization at all", isCorrect: false },
                                    { text: "One shared admin password", isCorrect: false }
                                ],
                                explanation: "Centralize the decision, distribute enforcement. N implementations means N audits, N ports of every fix.",
                                difficulty: 1, concept: "Total Cost of AuthZ"
                            }
                        ]
                    },
                    animation: {
                        type: "rbac-abac-compare",
                        title: "Cost of Models Compared",
                        description: "Compare audit and scaling cost across the four models",
                        controls: ["setCompareMode"]
                    }
                }
            }
        },

        // LEVEL 2: Policy Languages (Intermediate) - Lessons 6-10 (in practical-examples.js)
        intermediate: {
            name: "Policy Languages",
            description: "Hands-on OPA/Rego, Cedar, and OpenFGA: the three open languages",
            color: "#3b82f6",
            icon: "🔧",
            lessons: {}
        },

        // LEVEL 3: Platforms in Production (Advanced) - Lessons 11-18 (in practical-examples.js)
        advanced: {
            name: "Platforms in Production",
            description: "OPA, Cedar, OpenFGA, Immuta, and PlainID operated for real",
            color: "#8b5cf6",
            icon: "🔬",
            lessons: {}
        },

        // LEVEL 4: Architecture & Operations (Expert) - Lessons 19-21 (in practical-examples.js)
        expert: {
            name: "Architecture & Operations",
            description: "Enforcement patterns, verification, and migration",
            color: "#f59e0b",
            icon: "🚀",
            lessons: {}
        },

        // LEVEL 5: Frontier & Capstones (Research) - Lessons 22-24 (in practical-examples.js)
        research: {
            name: "Frontier & Capstones",
            description: "AI-agent authorization and two build-and-defend capstones",
            color: "#ef4444",
            icon: "🎓",
            lessons: {}
        }
    }
};

// Calculate total lessons
COURSE_DATA.meta.totalLessons = 0;
for (const levelKey in COURSE_DATA.levels) {
    const level = COURSE_DATA.levels[levelKey];
    if (level.lessons) {
        COURSE_DATA.meta.totalLessons += Object.keys(level.lessons).length;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = COURSE_DATA;
}
