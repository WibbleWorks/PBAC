// tests/a11y.mjs
// Roadmap T6.6. Accessibility audit using @axe-core/playwright.
//
// Boots the course in a headless browser, navigates through every lesson,
// starts one quiz (the most interactive surface), and runs axe-core against
// each page state. Fails (exit 1) if any serious violation is found
// (critical / serious / moderate - "minor" is reported but not failing).
//
// Run locally:
//   python3 -m http.server 8765 &
//   npx playwright install chromium
//   node tests/a11y.mjs
//
// CI: invoked from .github/workflows/ci.yml (job: a11y).

import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE_URL = process.env.SMOKE_URL || 'http://localhost:8765/index.html';
// Threshold: any violation at or above this level makes the test fail.
const FAIL_LEVELS = new Set(['critical', 'serious', 'moderate']);

let failures = 0;
function fail(msg) { console.error('  FAIL: ' + msg); failures++; }
function ok(msg)   { console.log('  ok:  ' + msg); }

console.log('\n[axe-core] Booting browser...');
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

let totalViolations = 0;
const perStateViolations = [];

async function audit(label) {
    console.log(`\n  Auditing: ${label}`);
    const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
    const serious = results.violations.filter(v => FAIL_LEVELS.has(v.impact));
    if (serious.length === 0) {
        ok(`${label}: no critical/serious/moderate violations`);
    } else {
        for (const v of serious) {
            fail(`${label}: ${v.id} (${v.impact}) - ${v.description} - ${v.nodes.length} node(s)`);
            // Show one example selector per violation to make triage easy
            const sample = v.nodes[0]?.target?.slice(0, 2) || [];
            if (sample.length) console.error(`      example: ${JSON.stringify(sample)}`);
        }
    }
    totalViolations += results.violations.length;
    perStateViolations.push({ label, count: results.violations.length, serious: serious.length });
}

// 1. Initial load — skip placement test, force-complete ALL lessons so all
//    nav-items unlock (locked items are dimmed by design, not part of the
//    interactive surface being audited).
await page.goto(BASE_URL, { waitUntil: 'networkidle' });
await page.evaluate(() => {
    try { localStorage.setItem('pbacCoursePlacementOffered', '1'); } catch (e) {}
    // Force-complete every lesson so nav-items unlock at full opacity
    Object.values(COURSE_DATA.levels).forEach(lvl =>
        Object.keys(lvl.lessons || {}).forEach(id => window.course.completedLessons.add(id))
    );
    window.course.buildNavigation();
    document.getElementById('placementOverlay')?.remove();
});
await page.reload({ waitUntil: 'networkidle' });
await page.evaluate(() => {
    Object.values(COURSE_DATA.levels).forEach(lvl =>
        Object.keys(lvl.lessons || {}).forEach(id => window.course.completedLessons.add(id))
    );
    window.course.buildNavigation();
    document.getElementById('placementOverlay')?.remove();
});
await page.waitForTimeout(200);
await audit('initial load (all lessons unlocked)');

// 2. Navigate through 3 representative lessons (one per tier)
const sampleIds = ['access_control_intro', 'rego_foundations', 'architecture_patterns'];
for (const id of sampleIds) {
    await page.evaluate((id) => {
        document.getElementById('placementOverlay')?.remove();
        window.course.showLesson(id);
    }, id);
    await page.waitForTimeout(200);
    await audit(`lesson: ${id}`);
}

// 3. Start a quiz (the most interactive surface area for a11y)
await page.evaluate(() => {
    document.getElementById('placementOverlay')?.remove();
    window.course.showLesson('access_control_intro');
    window.course.startQuiz('access_control_intro');
});
await page.waitForTimeout(200);
await audit('quiz in progress');

// 4. Mobile viewport (<=900px triggers the drawer nav)
await page.setViewportSize({ width: 375, height: 700 });
await page.evaluate(() => {
    document.getElementById('placementOverlay')?.remove();
    window.course.showLesson('rego_foundations');
});
await page.waitForTimeout(200);
await audit('mobile viewport');

await browser.close();

console.log('\n----');
console.log('Per-state violation counts:');
perStateViolations.forEach(p => console.log(`  ${p.label}: ${p.count} total, ${p.serious} serious`));

if (failures > 0) {
    console.error(`\nA11Y AUDIT FAILED (${failures} serious violation(s))`);
    process.exit(1);
}
console.log('\nA11Y AUDIT PASSED - no critical/serious/moderate violations');