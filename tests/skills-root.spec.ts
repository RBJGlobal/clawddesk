import { test, expect } from "@playwright/test";
import os from "node:os";
import path from "node:path";

// Verifies the skills root is test-isolated (backlog P1 #2). playwright.config.ts
// sets CLAWDDESK_SKILLS_ROOT to a temp dir before any spec loads, so the
// in-process Skills/Emergent tests install there instead of the real
// ~/.claude/skills. These assertions run offline (skillInstall.ts imports only
// node built-ins — no DB, no SDK).

test("CLAWDDESK_SKILLS_ROOT is set to a temp dir for the test run", () => {
  const root = process.env.CLAWDDESK_SKILLS_ROOT;
  expect(root, "config should set the override").toBeTruthy();
  expect(root).not.toBe(path.join(os.homedir(), ".claude", "skills"));
});

test("skillInstall resolves USER_SKILLS_ROOT from the env override", async () => {
  const { __INTERNALS__ } = await import("../src/skillInstall.ts");
  const expected = path.resolve(process.env.CLAWDDESK_SKILLS_ROOT!.trim());
  expect(__INTERNALS__.USER_SKILLS_ROOT).toBe(expected);
});

test("the resolved root never points at the real ~/.claude/skills in tests", async () => {
  const { __INTERNALS__ } = await import("../src/skillInstall.ts");
  const realRoot = path.join(os.homedir(), ".claude", "skills");
  expect(__INTERNALS__.USER_SKILLS_ROOT).not.toBe(realRoot);
});
