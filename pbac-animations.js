// PBAC Training Course - Policy Animations
// =========================================
// Canvas visualizers for policy-based access control concepts.
// Interface matches the GenAI framework: window.animations with
// startAnimation(type, data), stopAnimation(), resetAnimation(), drawFrame().

class PBACAnimations {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.animationContainer = null;
        this.animationControls = null;
        this.currentAnimation = null;
        this.animationData = null;
        this.isAnimating = false;
        this.animationId = null;
        this.continuous = false;

        // Per-visualizer state
        this.flowStep = 0;          // policy-flow stepper
        this.flowSteps = ['Client request', 'PEP intercepts', 'PEP -> PDP (authZ query)', 'PDP evaluates policy', 'PIP attributes fetched', 'Decision: ALLOW / DENY', 'PEP enforces'];
        this.compareMode = 'rbac';  // rbac-abac-compare
        this.denyRules = true;      // default-deny-sim toggle
        this.denyScenario = 0;
        this.denyScenarios = [
            { label: 'Admin reads report', admin: true, owner: false, mfa: true },
            { label: 'Stranger reads report', admin: false, owner: false, mfa: true },
            { label: 'Owner edits own doc (no MFA)', admin: false, owner: true, mfa: false },
            { label: 'Owner edits own doc (MFA)', admin: false, owner: true, mfa: true }
        ];
        this.regoScenario = 0;
        // Vocabulary matches Lesson 7's team pattern verbatim: api-full (all),
        // api-read (GET only), team-membership (GET/PUT on own team). The canvas
        // prints exactly the rules evaluated below — see drawRego.
        this.regoScenarios = [
            { label: 'alice (api-full) DELETE /teams/123', roles: ['api-full'], groups: [], method: 'DELETE', teamId: '123' },
            { label: 'bob (api-read) GET /teams/123', roles: ['api-read'], groups: [], method: 'GET', teamId: '123' },
            { label: 'bob (Team123) PUT /teams/123', roles: [], groups: ['Team123'], method: 'PUT', teamId: '123' },
            { label: 'eve (api-read, Team999) PUT /teams/123', roles: ['api-read'], groups: ['Team999'], method: 'PUT', teamId: '123' },
            { label: 'mallory (Team123) PUT /teams/456 — wrong team', roles: [], groups: ['Team123'], method: 'PUT', teamId: '456' }
        ];
        this.cedarScenario = 0;
        // Literal Lesson 8 policies: (P1) alice-only view of VacationPhoto94.jpg,
        // (P2) owner-scoped editPhoto, (F) private-forbid unless owner.
        this.cedarScenarios = [
            { label: 'alice views VacationPhoto94.jpg (public)', principal: 'alice', action: 'view', photo: 'VacationPhoto94.jpg', owner: 'alice', priv: false },
            { label: 'bob views VacationPhoto94.jpg (public)', principal: 'bob', action: 'view', photo: 'VacationPhoto94.jpg', owner: 'alice', priv: false },
            { label: 'bob views VacationPhoto94.jpg (private)', principal: 'bob', action: 'view', photo: 'VacationPhoto94.jpg', owner: 'alice', priv: true },
            { label: 'alice edits own photo (private)', principal: 'alice', action: 'editPhoto', photo: 'HolidaySnap12.jpg', owner: 'alice', priv: true },
            { label: 'bob edits photo, owner unknown (missing attr)', principal: 'bob', action: 'editPhoto', photo: 'OrphanPic01.jpg', owner: null, priv: false }
        ];
        this.fgaScenario = 0;
        this.fgaScenarios = [
            { label: 'anne editor -> viewer?', tuples: ['anne editor doc:Q3', 'bob viewer doc:Q3'], check: 'anne viewer doc:Q3', result: true },
            { label: 'zoe stranger -> viewer?', tuples: ['anne editor doc:Q3'], check: 'zoe viewer doc:Q3', result: false },
            { label: 'team member via group', tuples: ['team:eng member cara', 'team:eng editor doc:Q3'], check: 'cara viewer doc:Q3', result: true }
        ];
        this.maskRole = 'analyst';
        this.authPattern = 'sidecar';

        this.init();
    }

    init() {
        this.canvas = document.getElementById('aiCanvas');
        this.animationContainer = document.getElementById('animationContainer');
        this.animationControls = document.getElementById('animationControls');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
        }
    }

    resizeCanvas() {
        if (this.canvas) {
            const parent = this.canvas.parentElement;
            this.canvas.width = parent ? Math.max(200, parent.clientWidth) : 400;
            this.canvas.height = 300;
            if (this.currentAnimation) this.drawFrame();
        }
    }

    startAnimation(type, data = {}) {
        this.currentAnimation = type;
        this.animationData = data;
        this.isAnimating = true;
        this.continuous = false;
        this.stopLoop();
        this.flowStep = 0;
        this.updateControls(type);
        this.drawFrame();
        console.log(`Started animation: ${type}`);
    }

    stopLoop() {
        if (this.animationId) { cancelAnimationFrame(this.animationId); this.animationId = null; }
    }

    stopAnimation() {
        this.stopLoop();
        this.isAnimating = false;
        if (this.ctx && this.canvas) this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    resetAnimation() {
        this.flowStep = 0;
        this.denyScenario = 0;
        this.regoScenario = 0;
        this.cedarScenario = 0;
        this.fgaScenario = 0;
        this.compareMode = 'rbac';
        this.denyRules = true;
        this.maskRole = 'analyst';
        this.updateControls(this.currentAnimation);
        this.drawFrame();
    }

    // ---- controls ---------------------------------------------------------
    updateControls(type) {
        if (!this.animationControls) return;
        this.animationControls.innerHTML = this.getControlsForAnimation(type);
    }

    getControlsForAnimation(type) {
        const base = `
            <button class="btn-small" onclick="animations.stopAnimation()" aria-label="Stop animation">⏹ Stop</button>
            <button class="btn-small" onclick="animations.resetAnimation()" aria-label="Reset animation">🔄 Reset</button>
        `;
        switch (type) {
            case 'policy-flow':
                return base + `
                    <button class="btn-small" onclick="animations.flowPrev()" aria-label="Previous step">← Prev</button>
                    <button class="btn-small" onclick="animations.flowNext()" aria-label="Next step">Next →</button>
                    <span style="font-size:0.75rem;">Step <span id="flowStepN">1</span>/7</span>`;
            case 'rbac-abac-compare':
                return base + `
                    <select onchange="animations.setCompareMode(this.value)" aria-label="Access model">
                        <option value="rbac">RBAC</option>
                        <option value="abac">ABAC</option>
                        <option value="pbac">PBAC</option>
                        <option value="rebac">ReBAC</option>
                    </select>`;
            case 'default-deny-sim':
                return base + `
                    <select onchange="animations.setDenyScenario(parseInt(this.value,10))" aria-label="Scenario">
                        ${this.denyScenarios.map((s, i) => `<option value="${i}">${s.label}</option>`).join('')}
                    </select>
                    <button class="btn-small" onclick="animations.toggleDenyRules()" aria-label="Toggle default deny">Toggle default-deny</button>`;
            case 'rego-playground':
                return base + `
                    <select onchange="animations.setRegoScenario(parseInt(this.value,10))" aria-label="Rego scenario">
                        ${this.regoScenarios.map((s, i) => `<option value="${i}">${s.label}</option>`).join('')}
                    </select>`;
            case 'cedar-sim':
                return base + `
                    <select onchange="animations.setCedarScenario(parseInt(this.value,10))" aria-label="Cedar scenario">
                        ${this.cedarScenarios.map((s, i) => `<option value="${i}">${s.label}</option>`).join('')}
                    </select>`;
            case 'openfga-graph':
                return base + `
                    <select onchange="animations.setFgaScenario(parseInt(this.value,10))" aria-label="OpenFGA scenario">
                        ${this.fgaScenarios.map((s, i) => `<option value="${i}">${s.label}</option>`).join('')}
                    </select>`;
            case 'data-masking-sim':
                return base + `
                    <select onchange="animations.setMaskRole(this.value)" aria-label="Viewer role">
                        <option value="analyst">Analyst</option>
                        <option value="auditor">Auditor (exception)</option>
                        <option value="owner">Data owner</option>
                    </select>`;
            case 'auth-patterns':
                return base + `
                    <select onchange="animations.setAuthPattern(this.value)" aria-label="Enforcement pattern">
                        <option value="sidecar">Sidecar</option>
                        <option value="gateway">Gateway</option>
                        <option value="middleware">Middleware</option>
                    </select>`;
            default:
                return base;
        }
    }

    flowNext() { this.flowStep = Math.min(6, this.flowStep + 1); this.drawFrame(); const el = document.getElementById('flowStepN'); if (el) el.textContent = String(this.flowStep + 1); }
    flowPrev() { this.flowStep = Math.max(0, this.flowStep - 1); this.drawFrame(); const el = document.getElementById('flowStepN'); if (el) el.textContent = String(this.flowStep + 1); }
    setCompareMode(v) { this.compareMode = v; this.drawFrame(); }
    setDenyScenario(i) { this.denyScenario = i; this.drawFrame(); }
    toggleDenyRules() { this.denyRules = !this.denyRules; this.drawFrame(); }
    setRegoScenario(i) { this.regoScenario = i; this.drawFrame(); }
    setCedarScenario(i) { this.cedarScenario = i; this.drawFrame(); }
    setFgaScenario(i) { this.fgaScenario = i; this.drawFrame(); }
    setMaskRole(v) { this.maskRole = v; this.drawFrame(); }
    setAuthPattern(v) { this.authPattern = v; this.drawFrame(); }

    // ---- frame dispatch ----------------------------------------------------
    drawFrame() {
        if (!this.ctx || !this.canvas) return;
        const ctx = this.ctx, W = this.canvas.width, H = this.canvas.height;
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = '#0f172a'; ctx.fillRect(0, 0, W, H);
        const t = this.animationData && this.animationData.title ? this.animationData.title : this.currentAnimation;
        ctx.fillStyle = '#c5d4e3'; ctx.font = '600 13px system-ui'; ctx.fillText(t, 12, 20);
        switch (this.currentAnimation) {
            case 'policy-flow': this.drawPolicyFlow(ctx, W, H); break;
            case 'rbac-abac-compare': this.drawCompare(ctx, W, H); break;
            case 'default-deny-sim': this.drawDenySim(ctx, W, H); break;
            case 'rego-playground': this.drawRego(ctx, W, H); break;
            case 'cedar-sim': this.drawCedar(ctx, W, H); break;
            case 'openfga-graph': this.drawFga(ctx, W, H); break;
            case 'data-masking-sim': this.drawMasking(ctx, W, H); break;
            case 'auth-patterns': this.drawPatterns(ctx, W, H); break;
            default: this.drawFallback(ctx, W, H);
        }
    }

    box(ctx, x, y, w, h, label, active, color = '#6366f1') {
        ctx.fillStyle = active ? color : '#1e293b';
        ctx.strokeStyle = active ? '#fff' : '#475569';
        ctx.lineWidth = active ? 2 : 1;
        // roundRect guard: main.js installs a polyfill at boot, but the box
        // must not throw if this file ever loads standalone (Safari <16).
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, 6); else ctx.rect(x, y, w, h);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = active ? '#fff' : '#94a3b8';
        ctx.font = '600 11px system-ui';
        ctx.fillText(label, x + 8, y + h / 2 + 4);
    }

    drawPolicyFlow(ctx, W) {
        const nodes = ['Client', 'PEP', 'PDP', 'PIP', 'Policy'];
        const bw = Math.min(120, (W - 60) / nodes.length), y = 60;
        nodes.forEach((n, i) => {
            const x = 16 + i * ((W - 32 - bw) / (nodes.length - 1)) - 0;
            const active = this.stepActive(i);
            this.box(ctx, x, y, bw, 40, n, active, i === 2 ? '#8b5cf6' : '#6366f1');
            if (i < nodes.length - 1) {
                ctx.strokeStyle = '#475569'; ctx.beginPath();
                ctx.moveTo(x + bw, y + 20); ctx.lineTo(x + ((W - 32 - bw) / (nodes.length - 1)), y + 20); ctx.stroke();
            }
        });
        ctx.fillStyle = '#e2e8f0'; ctx.font = '600 13px system-ui';
        ctx.fillText(`Step ${this.flowStep + 1}/7: ${this.flowSteps[this.flowStep]}`, 12, 140);
        const notes = [
            'User calls GET /reports/q3 with a JWT.',
            'PEP (sidecar / middleware) pauses the call.',
            'PEP asks PDP: may subject S do action A on R?',
            'PDP loads versioned policy bundle.',
            'PDP pulls groups, clearance, time from PIP.',
            'PDP returns ALLOW or DENY + reason.',
            'PEP forwards request or returns 403.'
        ];
        ctx.fillStyle = '#94a3b8'; ctx.font = '12px system-ui';
        this.wrap(ctx, notes[this.flowStep], 12, 162, W - 24, 18);
        this.announce('Request lifecycle step ' + (this.flowStep + 1) + ' of 7: ' + this.flowSteps[this.flowStep] + '. ' + notes[this.flowStep]);
    }

    stepActive(i) {
        // map 7 steps onto 5 nodes loosely
        const map = [0, 1, 1, 2, 2, 2, 1];
        return map[this.flowStep] === i || (this.flowStep >= 4 && i === 3) || (this.flowStep >= 3 && i === 4);
    }

    drawCompare(ctx, W, H) {
        const models = {
            rbac: { title: 'RBAC: allow if role grants permission', rows: ['role=analyst', 'permits: reports:read', 'denies: reports:write', 'verdict: ALLOW read, DENY write'] },
            abac: { title: 'ABAC: allow if attributes satisfy rule', rows: ['dept=finance, clearance>=3', 'rule: dept==resource.dept && clearance>=3', 'time=10:00 business hours', 'verdict: ALLOW (all true)'] },
            pbac: { title: 'PBAC: versioned policy evaluated at PDP', rows: ['policy bundle v42, default deny', 'permit: owner OR oncall && MFA', 'forbid: embargoed region', 'verdict: ALLOW + audit reason'] },
            rebac: { title: 'ReBAC: allow via relationship path', rows: ['anne editor doc:Q3', 'editor => viewer (concentric)', 'check(anne, viewer, doc:Q3)', 'verdict: ALLOW via inheritance'] }
        };
        const m = models[this.compareMode] || models.rbac;
        ctx.fillStyle = '#e2e8f0'; ctx.font = '600 13px system-ui'; ctx.fillText(m.title, 12, 48);
        ctx.font = '12px system-ui';
        m.rows.forEach((r, i) => {
            ctx.fillStyle = i === 3 ? (r.includes('ALLOW') ? '#22c55e' : '#ef4444') : '#94a3b8';
            ctx.fillText('• ' + r, 16, 76 + i * 24);
        });
        ctx.fillStyle = '#64748b'; ctx.font = '11px system-ui';
        ctx.fillText('Switch the model above: same request, different decision logic.', 12, H - 16);
        this.announce('Model comparison, mode ' + this.compareMode + ': ' + m.title + '. ' + m.rows[3]);
    }

    drawDenySim(ctx, W, H) {
        const s = this.denyScenarios[this.denyScenario];
        let verdict, reason;
        if (!this.denyRules) { verdict = 'ALLOW (no default-deny!)'; reason = 'Without default deny, unmatched requests fall through to ALLOW.'; }
        else if (s.admin) { verdict = 'ALLOW'; reason = 'Matched rule: admin may read.'; }
        else if (s.owner && s.mfa) { verdict = 'ALLOW'; reason = 'Matched rule: owner + MFA may edit.'; }
        else if (s.owner) { verdict = 'DENY'; reason = 'Owner but no MFA -> no rule matches -> default deny.'; }
        else { verdict = 'DENY'; reason = 'No rule matches stranger -> default deny.'; }
        ctx.fillStyle = '#e2e8f0'; ctx.font = '600 13px system-ui';
        ctx.fillText('Request: ' + s.label, 12, 48);
        ctx.font = '12px system-ui'; ctx.fillStyle = '#94a3b8';
        ctx.fillText(`default allow := ${this.denyRules ? 'false (deny-closed)' : 'true (DANGEROUS)'}`, 12, 72);
        const ok = verdict.startsWith('ALLOW') && this.denyRules;
        ctx.fillStyle = ok ? '#22c55e' : '#ef4444'; ctx.font = '700 22px system-ui';
        ctx.fillText('verdict: ' + verdict, 12, 110);
        ctx.fillStyle = '#c5d4e3'; ctx.font = '12px system-ui';
        this.wrap(ctx, reason, 12, 134, W - 24, 18);
        this.announce('Default-deny simulator: ' + s.label + ' — verdict ' + verdict + '. ' + reason);
        ctx.fillStyle = '#64748b'; ctx.font = '11px system-ui';
        ctx.fillText('Toggle default-deny to see why fail-open is a critical finding.', 12, H - 16);
    }

    drawRego(ctx, W, H) {
        const s = this.regoScenarios[this.regoScenario];
        // Exactly Lesson 7's three rules (package demo), including the
        // URL→group derivation: teamName := concat("", ["Team", teamId]).
        const derived = 'Team' + (s.teamId || '123');
        const fullAllow = s.roles.includes('api-full');
        const readAllow = s.method === 'GET' && s.roles.includes('api-read');
        const teamAllow = (s.method === 'GET' || s.method === 'PUT') && s.groups.includes(derived);
        const allow = fullAllow || readAllow || teamAllow;
        const which = fullAllow ? 'Matched "api-full" rule.' : readAllow ? 'Matched "api-read" GET rule.' : teamAllow ? 'Matched team-membership rule (' + derived + ' derived from URL).' : '';
        const miss = !allow && (s.method === 'GET' || s.method === 'PUT') && s.groups.length ? ' Derived ' + derived + ' from URL not in groups — the IDOR-closing derivation.' : '';
        ctx.fillStyle = '#e2e8f0'; ctx.font = '600 12px system-ui';
        ctx.fillText('package demo  |  default allow := false', 12, 48);
        ctx.fillStyle = '#94a3b8'; ctx.font = '12px monospace';
        ctx.fillText('allow if { "api-full" in input.roles }', 12, 70);
        ctx.fillText('allow if { method==GET; "api-read" in roles }', 12, 88);
        ctx.fillText('allow if { method in {GET,PUT}; Team+id in groups }', 12, 106);
        ctx.fillStyle = '#c5d4e3'; ctx.font = '12px system-ui';
        ctx.fillText('input: ' + s.label, 12, 130);
        ctx.fillStyle = allow ? '#22c55e' : '#ef4444'; ctx.font = '700 20px system-ui';
        ctx.fillText('result: ' + (allow ? 'true' : 'false'), 12, 160);
        ctx.fillStyle = '#94a3b8'; ctx.font = '12px system-ui';
        this.wrap(ctx, allow ? which : 'No rule matched -> default deny. Note: api-read is GET-only, so eve PUTs deny.' + miss, 12, 182, W - 24, 18);
        this.announce('Rego simulator: ' + s.label + ' — result ' + (allow ? 'true' : 'false') + '. ' + (allow ? which : 'No rule matched, default deny.' + miss));
        ctx.fillStyle = '#64748b'; ctx.font = '11px system-ui';
        ctx.fillText('Mirrors mouton0815/authorization-with-OPA team pattern.', 12, H - 16);
    }

    drawCedar(ctx, W, H) {
        const s = this.cedarScenarios[this.cedarScenario];
        // Missing-attribute path: owner unknown -> evaluation error, the
        // owner-scoped policy is skipped, default-deny follows. Lesson 8 Q6.
        const missingOwner = (s.owner === null || s.owner === undefined);
        // Exactly Lesson 8's three policies:
        const p1 = !missingOwner && s.principal === 'alice' && s.action === 'view' && s.photo === 'VacationPhoto94.jpg';
        const p2 = !missingOwner && s.action === 'editPhoto' && s.principal === s.owner;
        const forbid = !missingOwner && s.priv && s.principal !== s.owner;
        const decision = !missingOwner && (p1 || p2) && !forbid ? 'Allow' : 'Deny';
        const which = missingOwner ? 'owner attribute missing: evaluation error, policy skipped -> default deny. Check errors diagnostics + schema (Lesson 8).'
            : forbid ? 'F (private-forbid) matches and is not escaped -> forbid wins.'
            : p1 ? 'P1 (alice-only view permit) matches, no forbid.'
            : p2 ? 'P2 (owner editPhoto permit) matches, owner escapes the forbid.'
            : 'No permit matches (bob has no view permit on this photo).';
        ctx.fillStyle = '#e2e8f0'; ctx.font = '600 12px system-ui';
        ctx.fillText('P1 permit: alice view VacationPhoto94.jpg', 12, 48);
        ctx.fillText('P2 permit: owner editPhoto (when owner==principal)', 12, 66);
        ctx.fillText('F forbid: private unless principal==owner', 12, 84);
        ctx.fillStyle = '#c5d4e3'; ctx.font = '12px system-ui';
        ctx.fillText(`request: ${s.principal} ${s.action} ${s.photo}${s.priv ? ' (private)' : ''}`, 12, 110);
        ctx.fillStyle = decision === 'Allow' ? '#22c55e' : '#ef4444'; ctx.font = '700 20px system-ui';
        ctx.fillText('decision: ' + decision, 12, 140);
        ctx.fillStyle = '#94a3b8'; ctx.font = '12px system-ui';
        this.wrap(ctx, which, 12, 162, W - 24, 18);
        this.announce('Cedar simulator: ' + s.label + ' — decision ' + decision + '. ' + which);
        ctx.fillStyle = '#64748b'; ctx.font = '11px system-ui';
        ctx.fillText('Cedar: forbid always overrides permit; Deny unless a permit matches.', 12, H - 16);
    }

    drawFga(ctx, W, H) {
        const s = this.fgaScenarios[this.fgaScenario];
        // Computed from tuples + model (Lesson 9 DSL): viewer defined as
        // [user, team#member] or editor; editor implies viewer (concentric);
        // team membership resolves transitively. s.result stays as the
        // documented expectation — a mismatch would flag model/canvas drift.
        const computed = this.fgaCheck(s.check, s.tuples);
        const result = computed;
        ctx.fillStyle = '#e2e8f0'; ctx.font = '600 12px system-ui';
        ctx.fillText('model: type document { viewer: [user] or editor }', 12, 48);
        ctx.fillStyle = '#94a3b8'; ctx.font = '12px monospace';
        s.tuples.forEach((t, i) => ctx.fillText('tuple: ' + t, 12, 70 + i * 18));
        ctx.fillStyle = '#c5d4e3'; ctx.font = '12px system-ui';
        ctx.fillText('check(' + s.check + ')', 12, 70 + s.tuples.length * 18 + 12);
        ctx.fillStyle = result ? '#22c55e' : '#ef4444'; ctx.font = '700 20px system-ui';
        ctx.fillText(result ? 'ALLOW (relation holds)' : 'DENY (no path)', 12, 70 + s.tuples.length * 18 + 44);
        this.announce('OpenFGA check ' + s.check + ' — ' + (result ? 'ALLOW, relation holds.' : 'DENY, no path.'));
        if (computed !== s.result) this.announce('Drift warning: computed ' + computed + ' differs from documented ' + s.result + '.');
        ctx.fillStyle = '#64748b'; ctx.font = '11px system-ui';
        ctx.fillText('OpenFGA: viewer defined as editor => concentric inherit.', 12, H - 16);
    }

    fgaCheck(check, tuples) {
        const parts = String(check).trim().split(/\s+/);
        if (parts.length < 3) return false;
        const subject = parts[0], relation = parts[1], object = parts.slice(2).join(' ');
        const edges = tuples.map(t => {
            const p = String(t).trim().split(/\s+/);
            return { s: p[0], r: p[1], o: p.slice(2).join(' ') };
        });
        const has = (s, r, o) => edges.some(e => e.s === s && e.r === r && e.o === o);
        const isMember = (team, user, depth) => {
            if (depth > 4) return false;
            if (has(team, 'member', user)) return true;
            return edges.some(e => e.s === team && e.r === 'member' && String(e.o).startsWith('team:') && isMember(e.o, user, depth + 1));
        };
        const can = (s, rel, o, seen, depth) => {
            if (depth > 6) return false;
            const key = s + '|' + rel + '|' + o;
            if (seen.includes(key)) return false;
            seen.push(key);
            if (has(s, rel, o)) return true;
            if (rel === 'viewer' && can(s, 'editor', o, seen, depth + 1)) return true;
            for (const e of edges) {
                if (e.o === o && (e.r === rel || (rel === 'viewer' && e.r === 'editor')) && String(e.s).startsWith('team:')) {
                    if (isMember(e.s, s, 0)) return true;
                }
            }
            return false;
        };
        return can(subject, relation, object, [], 0);
    }

    drawMasking(ctx, W, H) {
        const rows = [
            ['name', 'ssn', 'dept'],
            ['A. Bell', '***-**-4417', 'finance'],
            ['C. Diaz', '***-**-9021', 'finance']
        ];
        const masked = this.maskRole === 'auditor' ? 1 : 2; // auditor sees hashed-ish, analyst sees null
        ctx.fillStyle = '#e2e8f0'; ctx.font = '600 12px system-ui';
        ctx.fillText(`viewer role: ${this.maskRole}  |  global policy: mask tag PII`, 12, 48);
        ctx.font = '12px monospace';
        rows.forEach((r, ri) => {
            let line = r.join(' | ');
            if (ri > 0) line = `${r[0]} | ${this.maskRole === 'owner' ? (ri === 1 ? '441-09-4417' : '902-11-9021') : (this.maskRole === 'auditor' ? 'hash(' + r[1].slice(-4) + ')' : 'NULL')} | ${r[2]}`;
            ctx.fillStyle = ri === 0 ? '#8b5cf6' : '#94a3b8';
            ctx.fillText(line, 12, 72 + ri * 20);
        });
        ctx.fillStyle = '#94a3b8'; ctx.font = '12px system-ui';
        this.wrap(ctx, this.maskRole === 'owner' ? 'Owner bypass: raw values (break-glass audited).' : this.maskRole === 'auditor' ? 'Exception group AUDIT: deterministic hash instead of NULL.' : 'Default: PII columns nulled; numeric fallback NULL (never hash->string).', 12, 150, W - 24, 18);
        this.announce('Masking simulator, viewer role ' + this.maskRole + ': ' + (this.maskRole === 'owner' ? 'raw values.' : this.maskRole === 'auditor' ? 'hash of last 4, sim shorthand.' : 'PII nulled.'));
        ctx.fillStyle = '#64748b'; ctx.font = '11px system-ui';
        ctx.fillText('Immuta pattern: global tag policy + exclusionary exception.', 12, H - 16);
    }

    drawPatterns(ctx, W, H) {
        const p = {
            sidecar: ['Client -> sidecar (PEP)', 'sidecar -> PDP: POST /v1/data/authz', 'PDP allow? forward : 403', 'latency <5ms, hot reload'],
            gateway: ['Client -> Envoy (JWT verify)', 'Envoy -> OPA ext_authz gRPC', 'allow? route : 403', 'fail-closed, 200ms timeout'],
            middleware: ['Request -> route table', 'JWT -> user/roles/tenant', 'OPA check(user, action)', 'deny: 401/403, cache 5s']
        }[this.authPattern];
        ctx.fillStyle = '#e2e8f0'; ctx.font = '600 13px system-ui';
        ctx.fillText('pattern: ' + this.authPattern, 12, 48);
        ctx.font = '12px system-ui';
        p.forEach((r, i) => { ctx.fillStyle = '#94a3b8'; ctx.fillText(`${i + 1}. ${r}`, 16, 76 + i * 24); });
        ctx.fillStyle = '#64748b'; ctx.font = '11px system-ui';
        ctx.fillText('All patterns: authenticate first, authorize second, fail closed.', 12, H - 16);
        this.announce('Enforcement pattern ' + this.authPattern + ': ' + p.join('; '));
    }

    drawFallback(ctx, W, H) {
        ctx.fillStyle = '#94a3b8'; ctx.font = '12px system-ui';
        ctx.fillText('Unknown visualizer. Content and quiz still work.', 12, 60);
    }

    wrap(ctx, text, x, y, maxW, lh) {
        const words = text.split(' ');
        let line = '', yy = y;
        for (const w of words) {
            const t = line ? line + ' ' + w : w;
            if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, yy); line = w; yy += lh; }
            else line = t;
        }
        if (line) ctx.fillText(line, x, yy);
    }

    announce(text) {
        try {
            var s = document.getElementById('policylab-status');
            if (s) s.textContent = text;
        } catch (e) { /* non-DOM env (smoke) — ignore */ }
    }
}

window.animations = new PBACAnimations();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PBACAnimations;
}
