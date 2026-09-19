#!/usr/bin/env node
// scripts/lint-version-pinning.js
//
// Roadmap T6.5. Scans every pip-install line in the JS source for missing
// version pins. The roadmap "Last verified" stamps go hand-in-hand with this:
// any install line MUST pin (e.g. `pip install transformers>=4.44` or
// `pip install "scikit-learn>=1.5 pandas"`).
//
// Usage:
//   node scripts/lint-version-pinning.js
// Exit code 0 = clean; 1 = at least one unpinned install found.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILES = [
    'practical-examples.js',
    'course-data.js',
    'index.html',
    'main.js',
];

// A pip install line is "pinned" if every token after `pip install`
// (ignoring flags like -U / --force-reinstall) ends with a version specifier,
// an SDK plugin marker (qiskit-aer, langchain-openai), or is a local project
// path (./, .). We keep this conservative and noisy.
// Trailing class includes end-of-line ($ handled per-line) plus quote/backtick
// delimiters so `pip install foo` at EOL is still scanned.
const PIP_LINE = /pip\s+install\s+(.+?)(?:[<"`'\n]|$)/g;
// Recognize version markers, including HTML-escaped forms (&gt; / &lt;) which
// appear when the install line is rendered inside <pre><code> blocks.
const VERSION_MARKER = /(?:&gt;|&lt;|[><=!~])/;             // >= == ~= > < !=
const FLAGS = new Set(['-U', '--upgrade', '--force-reinstall', '--no-deps', '--quiet', '-q']);

function checkFile(file) {
    const full = path.join(ROOT, file);
    if (!fs.existsSync(full)) return [];
    const src = fs.readFileSync(full, 'utf8');
    const findings = [];
    src.split(/\r?\n/).forEach((line, i) => {
        // Docker / OPA / Cedar pins: flag :latest or unversioned downloads
        if (/docker\s+run[^`"'<\n]*openfga\/openfga:(latest)?(\s|$|`|"|')/.test(line) && !/openfga\/openfga:v[0-9]+\.[0-9]+\.[0-9]+/.test(line)) {
            findings.push({ file, line: i + 1, text: line.trim(), unpinned: ['openfga docker tag (pin vX.Y.Z)'] });
        }
        if (/openpolicyagent\.org\/downloads\//.test(line) && !/openpolicyagent\.org\/downloads\/v[0-9]+\.[0-9]+\.[0-9]+/.test(line)) {
            findings.push({ file, line: i + 1, text: line.trim(), unpinned: ['OPA download (pin vX.Y.Z)'] });
        }
        if (/cargo\s+install\s+cedar-policy/.test(line) && !/--version|@.*[0-9]/.test(line)) {
            findings.push({ file, line: i + 1, text: line.trim(), unpinned: ['cedar-policy-cli (add --version X.Y.Z)'] });
        }
        let m;
        // Reset regex state per line (it's a sticky global regex)
        const re = new RegExp(PIP_LINE.source, 'g');
        while ((m = re.exec(line)) !== null) {
            const args = m[1].trim();
            // Split on whitespace but keep quoted groups intact (simple splitter)
            const tokens = args.split(/\s+/).filter(Boolean);
            let anyUnpinned = false;
            const unpinned = [];
            for (const raw of tokens) {
                const t = raw.replace(/^["']|["']$/g, '');
                if (FLAGS.has(t)) continue;
                // Allow extras in brackets: foo[bar]>=1.2 still counts as pinned
                // Strip extras: package[extras] -> package
                const pkg = t.replace(/\[[^\]]*\]/, '');
                if (!pkg) continue;
                if (pkg.startsWith('.') || pkg.startsWith('/')) continue; // local path
                if (!VERSION_MARKER.test(t)) {
                    anyUnpinned = true;
                    unpinned.push(t);
                }
            }
            if (anyUnpinned) {
                findings.push({
                    file, line: i + 1,
                    text: line.trim(),
                    unpinned
                });
            }
        }
    });
    return findings;
}

function main() {
    let failures = 0;
    for (const f of FILES) {
        const findings = checkFile(f);
        if (findings.length === 0) {
            console.log(`OK  ${f}: all pip installs are version-pinned`);
        } else {
            console.error(`FAIL ${f}: ${findings.length} unpinned install(s):`);
            for (const x of findings) {
                console.error(`  ${f}:${x.line}  missing version on: ${x.unpinned.join(', ')}`);
                console.error(`    ${x.text}`);
            }
            failures += findings.length;
        }
    }
    if (failures > 0) {
        console.error(`\n${failures} unpinned pip install(s) found. Pin them and update the "Last verified" stamp.`);
        console.error(`Example fix:  pip install foo            ->  pip install "foo>=1.2"`);
        process.exit(1);
    }
    console.log('\nAll pip installs are pinned.');
}

if (require.main === module) main();
module.exports = { checkFile };