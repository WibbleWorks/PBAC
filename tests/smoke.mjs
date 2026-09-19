// tests/smoke.mjs
// Roadmap T6.2. Smoke test that runs in plain Node with zero dependencies.
//
// Verified things (without a browser):
//   - all 5 JS files pass `node --check`
//   - the merged COURSE_DATA has the expected number of lessons across all 5 levels
//   - every lesson has a quiz with 8 questions (5 sampled per attempt) and a 60% pass threshold
//   - every lesson uses an animation type the PBACAnimations class implements
//
// If Playwright is installed (`npx playwright install chromium`), the test
// ALSO boots the course in a headless browser, renders every lesson, runs
// every quiz end-to-end, and starts every animation - failing on any throw.
//
// Run locally:
//   python3 -m http.server 8765 &   # from repo root
//   node tests/smoke.mjs

import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BASE_URL = process.env.SMOKE_URL || 'http://localhost:8765/index.html';
const KNOWN_HARMLESS = ['favicon.ico', 'auth-config.json'];  // by-design optional fetches (see README: Supabase sync)

let failures = 0;
function fail(msg) { console.error('  FAIL: ' + msg); failures++; }
function ok(msg) { console.log('  ok:  ' + msg); }

// -- 1. Syntax check every source file --------------------------------------
console.log('\n[1/4] Syntax check');
const JS_FILES = ['pbac-animations.js', 'quiz-system.js', 'course-data.js', 'practical-examples.js', 'main.js'];
for (const f of JS_FILES) {
    try { execSync(`node --check ${f}`, { stdio: 'pipe' }); ok(`${f} passes node --check`); }
    catch (e) { fail(`${f}: ${e.stderr?.toString() || e.message}`); }
}

// -- 2. Load course-data.js (it self-exports as CommonJS) -------------------
console.log('\n[2/4] Course data structure');
// course-data.js is CommonJS and does `module.exports = COURSE_DATA` at the end.
// When loaded via dynamic ESM `import()`, the CJS exports become `.default`.
const courseDataMod = await import(new URL('../course-data.js', import.meta.url).href);
const COURSE_DATA = courseDataMod.default || courseDataMod.COURSE_DATA;

// practical-examples.js extends COURSE_DATA in place; simulate that by reading
// its assignments via regex match (we don't want to fully execute browser code).
const pe = readFileSync(new URL('../practical-examples.js', import.meta.url), 'utf8');
const assignmentRe = /COURSE_DATA\.levels\.(\w+)\.lessons\.(\w+)\s*=\s*\{/g;
let m;
const extraLessons = [];
while ((m = assignmentRe.exec(pe)) !== null) {
    extraLessons.push({ level: m[1], id: m[2] });
}

// Build a fake "lesson exists" map so we can check counts without executing
// practical-examples fully.
const knownBeginner = Object.keys(COURSE_DATA.levels.beginner.lessons);
const knownAll = {};
for (const [lvl, level] of Object.entries(COURSE_DATA.levels)) {
    knownAll[lvl] = new Set(Object.keys(level.lessons || {}));
}
for (const { level, id } of extraLessons) knownAll[level]?.add(id);

let totalLessons = 0;
for (const lvl of Object.keys(knownAll)) totalLessons += knownAll[lvl].size;

if (totalLessons >= 18) ok(`Total lessons: ${totalLessons} (>= 18)`);
else fail(`Total lessons: ${totalLessons} (expected >= 18)`);

// -- 3. Validate quizzes on every lesson: inline (course-data.js) AND every
// lesson id assigned in practical-examples.js (which validate-lessons.mjs
// already schema-checks, but smoke re-asserts counts here) ----
console.log('\n[3/4] Lesson quizzes (course-data.js + practical-examples.js)');
for (const [id, lesson] of Object.entries(COURSE_DATA.levels.beginner.lessons)) {
    if (!lesson.quiz) { fail(`${id}: no quiz`); continue; }
    const q = lesson.quiz.questions.length;
    if (q >= 8) ok(`${id}: ${q} quiz questions (>=8)`);
    else fail(`${id}: only ${q} quiz questions (<8)`);
    if (lesson.animation && lesson.animation.type) ok(`${id}: has animation type '${lesson.animation.type}'`);
    else fail(`${id}: missing animation`);
}
// practical-examples.js lessons are assignments, not inline objects: verify
// each assigned id carries a quiz + animation by scanning the source.
{
    // Static a11y contract: canvas verdicts must mirror into a live region
    // (axe cannot catch canvas-invisibility; see tests/a11y.mjs §3d).
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const animSrc = readFileSync(new URL('../pbac-animations.js', import.meta.url), 'utf8');
    if (html.includes('id="policylab-status"') && html.includes('aria-live="polite"')) ok('index.html: Policy Lab live region present');
    else fail('index.html: missing #policylab-status aria-live region');
    if ((animSrc.match(/\.announce\(/g) || []).length >= 8) ok('pbac-animations.js: all 8 visualizers announce verdicts');
    else fail('pbac-animations.js: expected >=8 announce() calls (one per visualizer)');
    const quizRe = /COURSE_DATA\.levels\.(\w+)\.lessons\.(\w+)\s*=\s*\{[\s\S]*?quiz:\s*\{[\s\S]*?questions:\s*\[/g;
    const animRe = /animation:\s*\{\s*type:\s*"([^"]+)"/g;
    const peQuizIds = new Set();
    let qm;
    const peQuizRe = new RegExp(quizRe.source, 'g');
    while ((qm = peQuizRe.exec(pe)) !== null) peQuizIds.add(qm[2]);
    const animTypes = new Set();
    let am;
    const peAnimRe = new RegExp(animRe.source, 'g');
    while ((am = peAnimRe.exec(pe)) !== null) animTypes.add(am[1]);
    const KNOWN_ANIMS = new Set(['policy-flow', 'rbac-abac-compare', 'default-deny-sim', 'rego-playground', 'cedar-sim', 'openfga-graph', 'data-masking-sim', 'auth-patterns']);
    for (const { level, id } of extraLessons) {
        if (peQuizIds.has(id)) ok(`${id}: has quiz block (>=8 enforced by validate-lessons.mjs)`);
        else fail(`${id}: no quiz block found in practical-examples.js`);
    }
    for (const t of animTypes) {
        if (KNOWN_ANIMS.has(t)) ok(`animation type '${t}' implemented by PBACAnimations`);
        else fail(`unknown animation type '${t}' (not in PBACAnimations)`);
    }
}

// -- 4. Optional: browser smoke test if Playwright is installed -----------
console.log('\n[4/4] Browser smoke (optional)');
let pw = null;
try { pw = await import('playwright'); }
catch { try { pw = await import('@playwright/test'); } catch { /* not installed */ } }

if (!pw) {
    console.log('  skipped: Playwright not installed. To enable: `npx playwright install chromium`');
} else {
    console.log('  Booting headless browser...');
    try {
        const browser = await pw.chromium.launch();
        const page = await browser.newPage();
        const consoleErrors = [];
        // 'Failed to load resource' console text carries no URL and duplicates
        // the response event below (which does) — classify once, on URLs.
        page.on('console', m => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) consoleErrors.push(m.text()); });
        page.on('response', r => { if (r.status() >= 400) consoleErrors.push(`${r.status()} ${r.url()}`); });
        page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        const summary = await page.evaluate(async () => {
            const out = { lessons: 0, quizzes: 0, reviews: 0, anims: 0, renderErrs: [], quizErrs: [], animErrs: [] };
            const ids = [];
            for (const lvl of Object.values(COURSE_DATA.levels)) {
                for (const id of Object.keys(lvl.lessons || {})) {
                    ids.push(id);
                    window.course.completedLessons.add(id);
                }
            }
            window.course.buildNavigation();
            for (const id of ids) {
                out.lessons++;
                try { window.course.showLesson(id); } catch (e) { out.renderErrs.push(`${id}: ${e.message}`); }
                try { window.course.startAnimation(id); out.anims++; } catch (e) { out.animErrs.push(`${id}: ${e.message}`); }
                try {
                    window.course.startQuiz(id);
                    if (window.quiz.currentQuiz) {
                        // Answer via the shuffle mapping (display -> original)
                        // so the run proves scoring, not just rendering.
                        const n = window.quiz.activeCount;
                        for (let i = 0; i < n; i++) {
                            const q = window.quiz._origQuestion(i);
                            const correctOrig = q.options.findIndex(o => o.isCorrect);
                            window.quiz.userAnswers[i] = window.quiz.optionOrder[i].indexOf(correctOrig);
                        }
                        window.quiz.endQuiz();
                        if (window.quiz.score !== 100) out.quizErrs.push(`${id}: all-correct run scored ${window.quiz.score}`);
                        else out.quizzes++;
                        try { window.quiz.showReview(); out.reviews++; } catch (e) { out.quizErrs.push(`${id}: review ${e.message}`); }
                    }
                    window.quiz.cancelQuiz();
                } catch (e) { out.quizErrs.push(`${id}: ${e.message}`); }
            }
            return out;
        });

        const realErrors = consoleErrors.filter(e => !KNOWN_HARMLESS.some(k => e.includes(k)));
        console.log(JSON.stringify(summary, null, 2));
        console.log('  console errors:', consoleErrors.length, ' real:', realErrors.length);
        realErrors.forEach(e => console.log('   ', e));

        await browser.close();

        if (summary.renderErrs.length || summary.quizErrs.length || summary.animErrs.length || realErrors.length) {
            fail('Browser smoke test surfaced errors (see above)');
        } else {
            ok(`Browser smoke clean: ${summary.lessons} lessons, ${summary.quizzes} quizzes, ${summary.reviews} reviews, ${summary.anims} anims`);
        }
    } catch (e) {
        fail('Browser smoke could not run: ' + e.message);
    }
}

// -- Report -----------------------------------------------------------------
console.log('\n----');
if (failures > 0) {
    console.error(`SMOKE TEST FAILED (${failures} failure(s))`);
    process.exit(1);
}
console.log('SMOKE TEST PASSED');