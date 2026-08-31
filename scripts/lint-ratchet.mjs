// Ratchets the ESLint *warning* count in both directions.
//
// `bun run lint` already fails the build on error-severity rules via its own
// exit code, but every obsidianmd rule this repo trips is warn-severity, so
// lint alone reports success no matter how many warnings pile up. That makes
// it a gate that cannot fail for the findings it actually produces. This
// script is the part that can fail.
//
// Both directions on purpose: a ceiling that only guards upward silently
// becomes a lie once the number is paid down, because it keeps accepting
// every count below a baseline nobody ever lowered. Dropping below BASELINE
// fails too, with instructions to lower BASELINE in the same commit that
// fixed the warnings — so the recorded number always describes the tree.
//
// Usage: bun run lint:ratchet

import { spawnSync } from "node:child_process";

// Every entry is a real statement about hand-written runtime code; rules that
// only describe in-app plugin behaviour are scoped away from test files in
// eslint.config.mjs rather than being absorbed into this number.
const BASELINE = 7;

const run = spawnSync("npx", ["eslint", "src/**/*.ts", "--format", "json"], {
	encoding: "utf8",
	shell: process.platform === "win32",
});

// eslint exits 1 when it reports errors; that is a real failure, but it still
// writes the JSON report, so parse first and let the count comparison below
// speak. A crash (no parseable stdout) is what actually aborts here.
const start = run.stdout.indexOf("[");
if (start === -1) {
	console.error("eslint produced no JSON report:");
	console.error(run.stderr || run.stdout);
	process.exit(1);
}

/** @type {{ filePath: string, messages: { ruleId: string, line: number, severity: number }[] }[]} */
const report = JSON.parse(run.stdout.slice(start));

// Liveness: a scan-based check that walks nothing and passes is worse than no
// check at all, so assert the walker actually saw the source tree.
if (report.length === 0) {
	console.error("eslint linted 0 files — the ratchet scanned nothing. Check the glob in this script.");
	process.exit(1);
}

let errors = 0;
let warnings = 0;
const warningLines = [];
for (const file of report) {
	for (const message of file.messages) {
		if (message.severity === 2) {
			errors++;
		} else if (message.severity === 1) {
			warnings++;
			warningLines.push(`  ${file.filePath}:${message.line}  ${message.ruleId}`);
		}
	}
}

if (errors > 0) {
	console.error(`${errors} ESLint error(s) — run "bun run lint" for detail.`);
	process.exit(1);
}

if (warnings > BASELINE) {
	console.error(`ESLint warnings rose to ${warnings}, above the recorded baseline of ${BASELINE}:`);
	console.error(warningLines.join("\n"));
	console.error(`\nFix the new warning(s). Do not raise BASELINE in scripts/lint-ratchet.mjs to make this pass.`);
	process.exit(1);
}

if (warnings < BASELINE) {
	console.error(
		`ESLint warnings fell to ${warnings}, below the recorded baseline of ${BASELINE}.`,
	);
	console.error(
		`Lower BASELINE in scripts/lint-ratchet.mjs to ${warnings} in this same commit, so the baseline keeps describing the tree.`,
	);
	process.exit(1);
}

console.log(`ESLint: 0 errors, ${warnings} warnings (baseline ${BASELINE}) across ${report.length} files.`);
