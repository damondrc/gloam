/**
 * Prints one version's section of the changelog.
 *
 * Release notes and the changelog say the same thing to the same people, so
 * writing them twice means maintaining two accounts of the same release and
 * eventually disagreeing with yourself. This lets the release workflow lift
 * the notes out of the file that already has them.
 *
 *   node scripts/changelog-section.mjs 0.5.0
 *   node scripts/changelog-section.mjs v0.5.0        # a tag works too
 *   node scripts/changelog-section.mjs v0.5.0-rc.1   # reads 0.5.0's section
 *
 * Exits non-zero when the section is missing, which is the useful failure:
 * tagging a version nobody wrote an entry for should stop the release rather
 * than publish an empty one.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// A prerelease reads the section of the version it is rehearsing: v0.5.0-rc.1
// is a dry run of 0.5.0 and should carry the same notes.
const version = process.argv[2]?.replace(/^v/, "").replace(/-.*$/, "");
if (!version) {
  console.error("Usage: node scripts/changelog-section.mjs <version>");
  process.exit(1);
}

const lines = readFileSync(join(root, "CHANGELOG.md"), "utf8").split(/\r?\n/);

const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
if (start === -1) {
  console.error(`No changelog section for ${version}.`);
  process.exit(1);
}

// The section ends at the next version heading, or at the block of link
// references that closes the file — whichever comes first.
const rest = lines.slice(start + 1);
const end = rest.findIndex(
  (line) => line.startsWith("## [") || /^\[[^\]]+\]:/.test(line)
);

const body = (end === -1 ? rest : rest.slice(0, end)).join("\n").trim();

if (body === "") {
  console.error(`The changelog section for ${version} is empty.`);
  process.exit(1);
}

console.log(body);
