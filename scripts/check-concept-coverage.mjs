#!/usr/bin/env node
// scripts/check-concept-coverage.mjs
//
// Council A15 (2026-09-13). A concept listed in lesson.concepts is a mastery
// claim: if no quiz question tags it, the outcome is advertised but never
// assessed. This script fails when:
//   - any concept in concepts[] is tagged by zero questions (untested claim)
//   - any question's concept tag is missing from concepts[] (mistag — breaks
//     adaptive reinforcement, which keys mastery off concept tags)
//   - lesson numbers are not contiguous 1..N, or a prerequisite id is dangling
//
// Usage: node scripts/check-concept-coverage.mjs  (exit 0 = clean)

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const ctx = {
    console, Math, Date, JSON, Object, Array, String, Number, Boolean,
    RegExp, parseInt, parseFloat, isNaN, Infinity, NaN, undefined,
    Set, Map, Promise, Symbol, Proxy, Reflect,
    setTimeout: () => {}, setInterval: () => {}, clearInterval: () => {},
    Intl, requestAnimationFrame: () => {}, cancelAnimationFrame: () => {},
    window: { pbacCopy: () => {} },
    document: { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} },
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
    COURSE_DATA: undefined,
};
vm.createContext(ctx);
const cd = readFileSync(path.join(ROOT, 'course-data.js'), 'utf8');
const pe = readFileSync(path.join(ROOT, 'practical-examples.js'), 'utf8');
vm.runInContext(cd + '\n;globalThis.COURSE_DATA = COURSE_DATA;', ctx, { filename: 'course-data.js' });
ctx.window.COURSE_DATA = ctx.COURSE_DATA;
vm.runInContext(pe + '\n;globalThis.COURSE_DATA = COURSE_DATA;', ctx, { filename: 'practical-examples.js' });
const COURSE_DATA = ctx.COURSE_DATA || ctx.window.COURSE_DATA;

let failures = 0;
const fail = (m) => { console.error('  FAIL: ' + m); failures++; };
const ok = (m) => console.log('  ok:  ' + m);

const lessons = [];
for (const [lvl, level] of Object.entries(COURSE_DATA.levels)) {
    for (const [id, lesson] of Object.entries(level.lessons || {})) lessons.push({ lvl, id, lesson });
}

// 1. numbering contiguous 1..N
const nums = lessons.map(l => l.lesson.number).sort((a, b) => a - b);
const expectNums = Array.from({ length: lessons.length }, (_, i) => i + 1);
if (JSON.stringify(nums) === JSON.stringify(expectNums)) ok(`numbering contiguous 1..${lessons.length}`);
else fail(`numbering not contiguous: got [${nums}]`);

// 2. prereqs resolve
const ids = new Set(lessons.map(l => l.id));
for (const l of lessons) {
    for (const p of (l.lesson.prerequisites || [])) {
        if (!ids.has(p)) fail(`${l.id}: dangling prerequisite '${p}'`);
    }
}
ok('all prerequisites resolve');

// 3. concept coverage both directions
for (const l of lessons) {
    const declared = new Set(l.lesson.concepts || []);
    const used = new Set((l.lesson.quiz?.questions || []).map(q => q.concept));
    for (const c of declared) {
        if (!used.has(c)) fail(`${l.id}: concept '${c}' advertised but never assessed`);
    }
    for (const q of (l.lesson.quiz?.questions || [])) {
        if (!declared.has(q.concept)) fail(`${l.id} ${q.id}: mistag '${q.concept}' not in concepts[]`);
        const correct = (q.options || []).filter(o => o.isCorrect).length;
        if ((q.options || []).length !== 4 || correct !== 1) fail(`${l.id} ${q.id}: ${q.options?.length} options / ${correct} correct (need 4/1)`);
    }
    const bankN = (l.lesson.quiz?.questions || []).length;
    const sampleN = l.lesson.quiz?.sampleSize || bankN;
    if (bankN < 8) fail(`${l.id}: bank has ${bankN} questions (need >= 8 for sampling)`);
    if (sampleN !== 5) fail(`${l.id}: sampleSize is ${sampleN} (course convention: 5)`);
    if (failures === 0) ok(`${l.id}: ${declared.size} concepts, all assessed; tags valid`);
}

console.log('\n----');
if (failures > 0) { console.error(`CONCEPT COVERAGE FAILED (${failures} finding(s))`); process.exit(1); }
console.log(`CONCEPT COVERAGE PASSED (${lessons.length} lessons, zero untested concepts, zero mistags)`);
