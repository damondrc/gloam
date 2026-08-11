/**
 * Checks that the three places a version lives still agree.
 *
 * The version is declared in package.json, in src-tauri/Cargo.toml and in
 * src-tauri/tauri.conf.json, and nothing has ever made them agree except
 * remembering to. They diverge silently: the app keeps building, the installer
 * keeps installing, and the number a user reports a bug against is whichever
 * of the three happens to be shown.
 *
 * package.json is treated as the source of truth because it is the one a
 * release is cut from.
 *
 * Passing a tag makes it stricter, which is what the release workflow needs:
 *
 *   node scripts/check-version.mjs            # the three files agree
 *   node scripts/check-version.mjs v0.5.0     # ...and they match the tag
 *
 * Exits non-zero on any disagreement, so it can gate a build rather than
 * warn into a log nobody reads.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const read = (...parts) => readFileSync(join(root, ...parts), "utf8");

/** The first `version = "..."` in the file; `rust-version` does not match. */
function cargoVersion(text) {
  return text.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
}

const sources = [
  { file: "package.json", version: JSON.parse(read("package.json")).version },
  {
    file: "src-tauri/Cargo.toml",
    version: cargoVersion(read("src-tauri", "Cargo.toml")),
  },
  {
    file: "src-tauri/tauri.conf.json",
    version: JSON.parse(read("src-tauri", "tauri.conf.json")).version,
  },
];

const expected = sources[0].version;
const problems = [];

for (const { file, version } of sources) {
  if (!version) problems.push(`${file}: no version found`);
  else if (version !== expected) {
    problems.push(`${file}: ${version} (expected ${expected})`);
  }
}

// Tags are written with a leading v; the files are not. A prerelease suffix is
// dropped before comparing, so v0.5.0-rc.1 is accepted on a tree that says
// 0.5.0 — a release candidate is a rehearsal of exactly that commit, and
// making the three files carry an -rc suffix for it would mean two more edits
// to undo before the real tag.
const tag = process.argv[2]?.replace(/^v/, "").replace(/-.*$/, "");
if (tag && tag !== expected) {
  problems.push(`tag: ${process.argv[2]} (expected v${expected})`);
}

if (problems.length > 0) {
  console.error("Version mismatch:");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}

console.log(`Version ${expected} is consistent across all three files.`);
