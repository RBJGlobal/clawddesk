import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

// Isolate skill installs to a throwaway temp dir. This config is loaded in each
// worker process before any spec imports skillInstall.ts, so the in-process
// Skills/Emergent tests write here instead of the real ~/.claude/skills. Honors
// an externally-set value (e.g. CI) rather than clobbering it.
process.env.CLAWDDESK_SKILLS_ROOT ||= path.join(os.tmpdir(), "clawddesk-test-skills");

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3333",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "smoke",
      grepInvert: /@engine/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "engine",
      grep: /@engine/,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run serve",
    url: "http://localhost:3333/api/cwd",
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
