#!/usr/bin/env node
// README freshness guard. Exits 2 (block + feedback) when the README's test
// badge no longer matches the actual test count, so the badge can't silently
// drift the way it did before this guard existed. Wired as a Stop hook in
// .claude/settings.json — see "make sure we don't fall behind" in the project
// history.
//
// Counts line-anchored `test(` declarations across tests/*.spec.ts, which
// matches `npx playwright test --list` exactly (anchoring to line start avoids
// counting `test(` substrings inside strings/comments).

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const testsDir = join(root, "tests");
const readmePath = join(root, "README.md");

// If the layout isn't what we expect (e.g. run from elsewhere), do nothing.
if (!existsSync(testsDir) || !existsSync(readmePath)) process.exit(0);

let actual = 0;
for (const f of readdirSync(testsDir)) {
  if (!f.endsWith(".spec.ts")) continue;
  const src = readFileSync(join(testsDir, f), "utf8");
  actual += (src.match(/^\s*test\(/gm) || []).length;
}

const readme = readFileSync(readmePath, "utf8");
const m = readme.match(/tests-(\d+)_passing/);
if (!m) process.exit(0); // no badge to check

const badge = Number(m[1]);
if (badge !== actual) {
  console.error(
    `README test badge is stale: badge says ${badge}, actual test count is ${actual}.\n` +
      `Fix it in README.md — change the badge to "tests-${actual}_passing" before finishing.\n` +
      `(This guard lives in scripts/check-readme-fresh.mjs.)`,
  );
  process.exit(2); // exit 2 surfaces stderr back to the agent and blocks the stop
}

process.exit(0);
