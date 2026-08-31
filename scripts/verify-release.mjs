// Verifies the three release files agree before a tag is published.
//
// Obsidian's plugin catalog reads versions.json to decide which release a
// given app version may install. manifest.json's own minAppVersion is only
// advisory to the catalog, so a versions.json that is missing the new version
// — or maps it to a different minAppVersion — serves the release to app
// versions it was never built for, and no build step notices.
//
// Usage: bun run scripts/verify-release.mjs [tag]
// With no argument, checks the repo's internal consistency only (manifest vs
// versions.json), which is what the pre-publish local check wants. CI passes
// the pushed tag so the tag itself is checked too.

import { readFileSync } from "node:fs";

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

const manifest = read("../manifest.json");
const versions = read("../versions.json");

const tag = process.argv[2]?.trim();
const failures = [];

if (tag && tag !== manifest.version) {
	failures.push(`tag "${tag}" does not match manifest.json version "${manifest.version}"`);
}

if (!(manifest.version in versions)) {
	failures.push(
		`versions.json has no entry for "${manifest.version}" — add {"${manifest.version}": "${manifest.minAppVersion}"}`,
	);
} else if (versions[manifest.version] !== manifest.minAppVersion) {
	failures.push(
		`versions.json["${manifest.version}"] is "${versions[manifest.version]}" but manifest.json minAppVersion is "${manifest.minAppVersion}"`,
	);
}

if (failures.length > 0) {
	for (const failure of failures) console.error(`✖ ${failure}`);
	process.exit(1);
}

console.log(
	`Release metadata consistent: version ${manifest.version}, minAppVersion ${manifest.minAppVersion}${tag ? `, tag ${tag}` : ""}.`,
);
