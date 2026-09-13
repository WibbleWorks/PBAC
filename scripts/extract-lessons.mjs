// scripts/extract-lessons.mjs
//
// Dumps the merged COURSE_DATA into individual JSON files under
// lessons/<level>/<id>.json. The JSON mirror is a first-class artifact:
// scripts/validate-lessons.mjs validates every JSON file against
// docs/lesson.schema.json AND verifies it matches the JS source field for
// field, so CI fails on drift. The runtime loader still reads inline JS
// (fetch() of lesson partials would break file:// usage); the JSON mirror
// exists for audits, diffs, and non-developer review.
//
// Run locally:
//   node scripts/extract-lessons.mjs [--out=lessons]

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// DOM shim + vm context (same pattern as scripts/validate-lessons.mjs)
import vm from 'node:vm';
const ctx = {
    console, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp,
    parseInt, parseFloat, isNaN, Infinity, NaN, undefined,
    Set, Map, Promise, Symbol, Proxy, Reflect,
    setTimeout: () => {}, setInterval: () => {}, clearInterval: () => {},
    Intl,
    requestAnimationFrame: () => {}, cancelAnimationFrame: () => {},
    window: {
        animations: { startAnimation: () => {}, stopAnimation: () => {}, drawFrame: () => {} },
        quiz: { cancelQuiz: () => {} },
        course: { completedLessons: new Set(), markLessonComplete: () => {}, adaptiveLearning: () => {},
                  logActivity: () => {}, findLesson: () => null, showLesson: () => {},
                  startAnimation: () => {}, startQuiz: () => {},
                  buildNavigation: () => {}, updateProgress: () => {}, updateNavigation: () => {},
                  currentLessonId: null, currentLevel: 'beginner',
                  completedLessonsEl: null, avgScoreEl: null, currentScoreEl: null,
                  masteredTopicsEl: null, confidenceLevelEl: null,
                  progressFill: { setAttribute: () => {}, style: {} },
                  progressText: null, courseNav: null, confidenceLevels: {}, scores: {} },
        pbacCopy: () => {}, runCurrentCode: () => {},
    },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}, body: null },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    CanvasRenderingContext2D: class {}, Image: class {},
    COURSE_DATA: undefined,
};
try { ctx.navigator = { clipboard: { writeText: async () => {} } }; } catch (e) {}
try { ctx.location = { reload: () => {} }; } catch (e) {}
vm.createContext(ctx);

const cd = readFileSync(join(ROOT, 'course-data.js'), 'utf8');
const pe = readFileSync(join(ROOT, 'practical-examples.js'), 'utf8');
vm.runInContext(cd + '\n;globalThis.COURSE_DATA = COURSE_DATA;', ctx, { filename: 'course-data.js' });
ctx.window.COURSE_DATA = ctx.COURSE_DATA;
vm.runInContext(pe + '\n;globalThis.COURSE_DATA = COURSE_DATA;', ctx, { filename: 'practical-examples.js' });
const COURSE_DATA = ctx.COURSE_DATA;

const outDir = resolve(ROOT, 'lessons');
const levelOrder = ['beginner', 'intermediate', 'advanced', 'expert', 'research'];

let count = 0;
for (const lvl of levelOrder) {
    const lessons = COURSE_DATA.levels[lvl]?.lessons || {};
    const dir = join(outDir, lvl);
    mkdirSync(dir, { recursive: true });
    for (const [id, lesson] of Object.entries(lessons)) {
        // Write the lesson as clean JSON (no JSDOM/window round-trip)
        const out = {
            id: lesson.id, title: lesson.title, subtitle: lesson.subtitle,
            level: lesson.level, number: lesson.number,
            estimatedTime: lesson.estimatedTime, difficulty: lesson.difficulty,
            prerequisites: lesson.prerequisites,
            // content is HTML — keep it as-is; this is the proof-of-concept
            content: lesson.content,
            concepts: lesson.concepts,
            quiz: lesson.quiz,
            animation: lesson.animation,
        };
        writeFileSync(join(dir, `${id}.json`), JSON.stringify(out, null, 2));
        count++;
        console.log(`  wrote: lessons/${lvl}/${id}.json`);
    }
}
console.log(`\nExtracted ${count} lessons to ${outDir}.`);
console.log('JSON mirror is validated by scripts/validate-lessons.mjs (schema + drift check).');