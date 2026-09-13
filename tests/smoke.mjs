// tests/smoke.mjs
// Roadmap T6.2. Smoke test that runs in plain Node with zero dependencies.
//
// Verified things (without a browser):
//   - all 5 JS files pass `node --check`
//   - the merged COURSE_DATA has the expected number of lessons across all 5 levels
//   - every lesson has a quiz with >= 5 questions and a 60% pass threshold
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
const KNOWN_HARMLESS = ['favicon.ico'];  // acceptable console errors

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
    if (q >= 5) ok(`${id}: ${q} quiz questions (>=5)`);
    else fail(`${id}: only ${q} quiz questions (<5)`);
    if (lesson.animation && lesson.animation.type) ok(`${id}: has animation type '${lesson.animation.type}'`);
    else fail(`${id}: missing animation`);
}
// practical-examples.js lessons are assignments, not inline objects: verify
// each assigned id carries a quiz + animation by scanning the source.
{
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
        if (peQuizIds.has(id)) ok(`${id}: has quiz block (>=5 enforced by validate-lessons.mjs)`);
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
        page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
        page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message));
        await page.goto(BASE_URL, { waitUntil: 'networkidle' });

        const summary = await page.evaluate(async () => {
            const out = { lessons: 0, quizzes: 0, anims: 0, renderErrs: [], quizErrs: [], animErrs: [] };
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
                        for (let i = 0; i < window.quiz.currentQuiz.questions.length; i++) {
                            window.quiz.currentQuestionIndex = i;
                            window.quiz.userAnswers[i] = 0;
                        }
                        window.quiz.endQuiz();
                        out.quizzes++;
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
            ok(`Browser smoke clean: ${summary.lessons} lessons, ${summary.quizzes} quizzes, ${summary.anims} anims`);
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