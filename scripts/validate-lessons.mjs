// scripts/validate-lessons.mjs
//
// Roadmap T6.7. Loads the MERGED COURSE_DATA (course-data.js + practical-examples.js)
// using a minimal DOM shim, then validates every lesson against
// docs/lesson.schema.json using a lightweight schema validator (no external
// deps - the subset of JSON Schema we actually use here is small).
//
// Run locally:
//   node scripts/validate-lessons.mjs
//
// CI: runs as a CI job (see .github/workflows/ci.yml).

import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// --- Minimal DOM shim shared context so course-data.js + practical-examples.js evaluate ---
const ctx = {
  console,
  Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
  parseInt, parseFloat, isNaN, Infinity, NaN, undefined,
  Set, Map, Promise, Symbol, Proxy, Reflect,
  setTimeout, setInterval, clearInterval,
  Intl,
  requestAnimationFrame: () => {}, cancelAnimationFrame: () => {},
};
// We need `window`, `document`, `localStorage`, `navigator` available as globals
ctx.window = {
  animations: { startAnimation: () => {}, stopAnimation: () => {}, drawFrame: () => {} },
  quiz: { cancelQuiz: () => {}, startQuiz: () => {}, endQuiz: () => {}, currentQuiz: null },
  course: {
    completedLessons: new Set(), markLessonComplete: () => {}, adaptiveLearning: () => {},
    logActivity: () => {}, findLesson: () => null, showLesson: () => {},
    startAnimation: () => {}, startQuiz: () => {},
    buildNavigation: () => {}, updateProgress: () => {}, updateNavigation: () => {},
    currentLessonId: null, currentLevel: 'beginner',
    completedLessonsEl: null, avgScoreEl: null, currentScoreEl: null,
    masteredTopicsEl: null, confidenceLevelEl: null,
    progressFill: { setAttribute: () => {}, style: {} },
    progressText: null, courseNav: null,
    confidenceLevels: {}, scores: {}
  },
  pbacCopy: () => {},
  runCurrentCode: () => {},
  quiz: { cancelQuiz: () => {} }
};
ctx.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, body: null };
ctx.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
try { ctx.navigator = { clipboard: { writeText: async () => {} } }; } catch (e) { /* read-only */ }
try { ctx.location = { reload: () => {} }; } catch (e) { /* read-only */ }
ctx.CanvasRenderingContext2D = class {};
ctx.Image = class {};
// Intentionally do NOT set ctx.module - the CJS export lines at the bottom
// of each file check `typeof module !== 'undefined'` and skip themselves.
// (Trying to set module would trigger block-scoped class refs that don't exist
//  outside the wrapped `if (COURSE_DATA)` block in practical-examples.js.)
ctx.COURSE_DATA = undefined;

// Create a shared context that BOTH files evaluate in
vm.createContext(ctx);

const cd = readFileSync(join(ROOT, 'course-data.js'), 'utf8');
const pe = readFileSync(join(ROOT, 'practical-examples.js'), 'utf8');

// Append a global-assignment line so the `const COURSE_DATA` declared at the top
// of course-data.js leaks into the vm context (const is block-scoped otherwise).
// In vm contexts, `globalThis` IS the context object, so this propagates correctly.
const cdForVm = cd + '\n;globalThis.COURSE_DATA = COURSE_DATA;';
const peForVm = pe + '\n;globalThis.COURSE_DATA = COURSE_DATA;';

vm.runInContext(cdForVm, ctx, { filename: 'course-data.js' });
// Make COURSE_DATA visible to practical-examples.js's `typeof COURSE_DATA` check.
// In the vm context, the `const COURSE_DATA` declaration in practical-examples.js
// would redeclare, but since the file structure is a top-level `if (typeof COURSE_DATA === 'undefined') { ... } else { ... }`,
// the check passes and the else block executes without redeclaring.
// We also copy it to ctx.window for any code using window.COURSE_DATA.
ctx.window.COURSE_DATA = ctx.COURSE_DATA;

vm.runInContext(peForVm, ctx, { filename: 'practical-examples.js' });

const courseDataLoaded = ctx.COURSE_DATA || ctx.window.COURSE_DATA;

// --- Lightweight JSON-Schema subset validator ---
function validate(obj, schema, path = '') {
    const errors = [];
    if (schema.type) {
        // JS doesn't distinguish integer vs number natively; check both forms
        if (schema.type === 'integer') {
            if (typeof obj !== 'number' || !Number.isInteger(obj)) {
                errors.push(`${path || '(root)'}: expected integer, got ${typeof obj} (${JSON.stringify(obj)})`);
                return errors;
            }
        } else if (schema.type === 'array') {
            if (!Array.isArray(obj)) {
                errors.push(`${path || '(root)'}: expected array, got ${typeof obj}`);
                return errors;
            }
        } else if (schema.type === 'object') {
            // Arrays are also typeof 'object'; reject them here
            if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
                errors.push(`${path || '(root)'}: expected object, got ${obj === null ? 'null' : typeof obj}${Array.isArray(obj) ? ' (array)' : ''}`);
                return errors;
            }
        } else if (typeof obj !== schema.type) {
            errors.push(`${path || '(root)'}: expected ${schema.type}, got ${typeof obj}`);
            return errors;
        }
    }
    if (schema.enum && !schema.enum.includes(obj)) {
        errors.push(`${path}: value "${obj}" not in enum [${schema.enum.join(', ')}]`);
    }
    if (schema.pattern && typeof obj === 'string') {
        if (!new RegExp(schema.pattern).test(obj)) errors.push(`${path}: does not match pattern ${schema.pattern}`);
    }
    if (schema.minimum !== undefined && typeof obj === 'number' && obj < schema.minimum) errors.push(`${path}: ${obj} < minimum ${schema.minimum}`);
    if (schema.maximum !== undefined && typeof obj === 'number' && obj > schema.maximum) errors.push(`${path}: ${obj} > maximum ${schema.maximum}`);
    if (schema.minItems !== undefined && Array.isArray(obj) && obj.length < schema.minItems) errors.push(`${path}: ${obj.length} items < minItems ${schema.minItems}`);
    if (schema.maxItems !== undefined && Array.isArray(obj) && obj.length > schema.maxItems) errors.push(`${path}: ${obj.length} items > maxItems ${schema.maxItems}`);

    // Resolve $ref to $defs. If $ref can't be resolved, the resulting `def`
    // is essentially an empty schema (no constraints) and we just skip.
    let def = schema;
    if (schema.$ref) {
        const refName = schema.$ref.replace('#/$defs/', '');
        const rootDefs = schema._rootDefs?.$defs || schema.$rootDefs?.$defs || {};
        def = rootDefs[refName] || {};
    }
    if (!def) def = {};

    if (def.required && def.properties) {
        for (const req of def.required) {
            if (!(req in obj)) errors.push(`${path}.${req}: required field missing`);
        }
    }
    if (def.additionalProperties === false && def.properties) {
        for (const key of Object.keys(obj)) {
            if (!(key in def.properties)) errors.push(`${path}.${key}: additional property not allowed`);
        }
    }
    if (def.properties) {
        for (const [k, propSchema] of Object.entries(def.properties)) {
            if (k in obj) {
                // Attach root $defs so $ref resolves
                const childSchema = { ...propSchema };
                if (childSchema.$ref) childSchema._rootDefs = { $defs: schema._rootDefs?.$defs || schema.$rootDefs?.$defs || {} };
                errors.push(...validate(obj[k], childSchema, path ? `${path}.${k}` : k));
            }
        }
    }
    if (def.items && Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            const itemSchema = { ...def.items };
            if (itemSchema.$ref) itemSchema._rootDefs = { $defs: schema._rootDefs?.$defs || schema.$rootDefs?.$defs || {} };
            errors.push(...validate(obj[i], itemSchema, `${path}[${i}]`));
        }
    }
    return errors;
}

// --- Load schema and inject $defs at the root ---
const schema = JSON.parse(readFileSync(join(ROOT, 'docs', 'lesson.schema.json'), 'utf8'));
function validateWithDefs(lessonObj, label) {
    const withDefs = { ...schema };
    const rootWithDefs = { ...withDefs, _rootDefs: { $defs: schema.$defs } };
    return validate(lessonObj, rootWithDefs, label);
}

// --- Run validation over every lesson ---
const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert', 'research'];
let pass = 0, fail = 0;
const allErrors = [];

for (const lvl of levelOrder) {
    const level = courseDataLoaded.levels[lvl];
    if (!level || !level.lessons) continue;
    for (const [id, lesson] of Object.entries(level.lessons)) {
        const errs = validateWithDefs(lesson, id);
        if (errs.length === 0) { pass++; console.log(`  ok:  ${id}`); }
        else {
            fail++;
            console.error(`  FAIL: ${id}`);
            errs.forEach(e => { console.error(`      ${e}`); allErrors.push({ id, error: e }); });
        }
    }
}

console.log('\n----');
if (fail > 0) {
    console.error(`LESSON SCHEMA VALIDATION FAILED (${fail} lesson(s) with errors, ${pass} ok)`);
    process.exit(1);
}
console.log(`LESSON SCHEMA VALIDATION PASSED (${pass} lessons valid against docs/lesson.schema.json)`);

// --- Semantic quiz + prereq checks (schema cannot express these) ---
// check-concept-coverage.mjs owns concept-tagging both directions, bank>=8
// and sampleSize==5; this block owns single-correct, explanations,
// passingScore reachability, and prereq resolution so `validate-lessons`
// alone is sufficient in CI.
{
    let semFail = 0;
    const ids = new Set();
    for (const lvl of levelOrder) {
        for (const id of Object.keys(courseDataLoaded.levels[lvl]?.lessons || {})) ids.add(id);
    }
    for (const lvl of levelOrder) {
        for (const [id, lesson] of Object.entries(courseDataLoaded.levels[lvl]?.lessons || {})) {
            for (const pre of lesson.prerequisites || []) {
                if (!ids.has(pre)) { console.error(`  FAIL: ${id}: prerequisite '${pre}' resolves to no lesson`); semFail++; }
            }
            const quiz = lesson.quiz;
            if (!quiz) continue;
            if (quiz.sampleSize !== 5) { console.error(`  FAIL: ${id}: sampleSize ${quiz.sampleSize} !== 5`); semFail++; }
            // passingScore must sit on the reachable ladder for 5 sampled questions
            if (quiz.passingScore % 20 !== 0 || quiz.passingScore < 0 || quiz.passingScore > 100) {
                console.error(`  FAIL: ${id}: passingScore ${quiz.passingScore} unreachable with sampleSize 5`); semFail++;
            }
            (quiz.questions || []).forEach((q, i) => {
                const correct = (q.options || []).filter(o => o.isCorrect === true).length;
                if (correct !== 1) { console.error(`  FAIL: ${id} q${i + 1}: ${correct} correct options (need exactly 1)`); semFail++; }
                if (!q.explanation || !String(q.explanation).trim()) { console.error(`  FAIL: ${id} q${i + 1}: empty explanation (review mode needs it)`); semFail++; }
                if (!q.concept || !(lesson.concepts || []).includes(q.concept)) { console.error(`  FAIL: ${id} q${i + 1}: concept '${q.concept}' not in lesson concepts`); semFail++; }
            });
        }
    }
    if (semFail > 0) { console.error(`\nSEMANTIC QUIZ/PREREQ CHECKS FAILED (${semFail} finding(s))`); process.exit(1); }
    console.log('SEMANTIC QUIZ/PREREQ CHECKS PASSED (single-correct, explanations, reachable score, no dangling prereqs)');
}

// --- lessons/ JSON mirror: schema-valid + in sync with JS source ---
// The extractor (scripts/extract-lessons.mjs) is the only writer; this block
// fails CI when the mirror is stale, hand-edited into divergence, or invalid.
import { readdirSync, existsSync } from 'node:fs';
{
    let jsonFail = 0;
    const seen = new Set();
    for (const lvl of levelOrder) {
        const dir = join(ROOT, 'lessons', lvl);
        if (!existsSync(dir)) { console.error(`  FAIL: lessons/${lvl}/ missing (run scripts/extract-lessons.mjs)`); jsonFail++; continue; }
        for (const f of readdirSync(dir).filter(f => f.endsWith('.json'))) {
            const id = f.replace(/\.json$/, '');
            seen.add(`${lvl}/${id}`);
            let obj;
            try { obj = JSON.parse(readFileSync(join(dir, f), 'utf8')); }
            catch (e) { console.error(`  FAIL: lessons/${lvl}/${f} is not valid JSON (${e.message})`); jsonFail++; continue; }
            const errs = validateWithDefs(obj, `lessons/${lvl}/${f}`);
            if (errs.length) { console.error(`  FAIL: lessons/${lvl}/${f}`); errs.forEach(e => console.error(`      ${e}`)); jsonFail++; continue; }
            const src = courseDataLoaded.levels[lvl]?.lessons?.[id];
            if (!src) { console.error(`  FAIL: lessons/${lvl}/${f} has no matching JS lesson`); jsonFail++; continue; }
            const drift = [];
            for (const k of ['id', 'title', 'subtitle', 'level', 'number', 'estimatedTime', 'difficulty']) {
                if (JSON.stringify(obj[k]) !== JSON.stringify(src[k])) drift.push(k);
            }
            // `unlocked` defaults false: absent on both sides is in sync.
            if (JSON.stringify(obj.unlocked ?? false) !== JSON.stringify(src.unlocked ?? false)) drift.push('unlocked');
            if (JSON.stringify(obj.prerequisites) !== JSON.stringify(src.prerequisites)) drift.push('prerequisites');
            if (JSON.stringify(obj.concepts) !== JSON.stringify(src.concepts)) drift.push('concepts');
            if (obj.content !== src.content) drift.push('content');
            if (JSON.stringify(obj.quiz) !== JSON.stringify(src.quiz)) drift.push('quiz');
            if (JSON.stringify(obj.animation) !== JSON.stringify(src.animation)) drift.push('animation');
            if (drift.length) { console.error(`  FAIL: lessons/${lvl}/${f} drifted from JS source in: ${drift.join(', ')} (re-run extract-lessons.mjs)`); jsonFail++; }
            else console.log(`  ok:  lessons/${lvl}/${f} (schema-valid, in sync)`);
        }
    }
    // every JS lesson must have a JSON twin
    for (const lvl of levelOrder) {
        for (const id of Object.keys(courseDataLoaded.levels[lvl]?.lessons || {})) {
            if (!seen.has(`${lvl}/${id}`)) { console.error(`  FAIL: JS lesson ${lvl}/${id} has no JSON twin`); jsonFail++; }
        }
    }
    if (jsonFail > 0) { console.error(`\nJSON MIRROR FAILED (${jsonFail} finding(s))`); process.exit(1); }
    console.log('JSON MIRROR PASSED (schema-valid, zero drift)');
}