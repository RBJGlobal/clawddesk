import { test, expect } from "@playwright/test";
import {
  maxAgentTurns,
  delegationOptions,
  maxTurnsMessage,
  isErrorResultSubtype,
  MAX_AGENT_TURNS_DEFAULT,
} from "../src/agentTurns.ts";

// Offline unit coverage for the sub-agent turn cap (backlog P1 #1). These run
// in the `smoke` project — no real SDK, fully deterministic. We import only the
// self-contained `agentTurns` module on purpose: pulling in agentRegistry would
// drag the SQLite stack into the test runner. The subAgentsFor wiring is
// covered by Reviewer (it spreads maxAgentTurns() onto each definition) and the
// real-SDK delegation path.

const ENV = "CLAWDDESK_MAX_AGENT_TURNS";

test.afterEach(() => {
  delete process.env[ENV];
});

test("maxAgentTurns falls back to the default when unset", () => {
  delete process.env[ENV];
  expect(maxAgentTurns()).toBe(MAX_AGENT_TURNS_DEFAULT);
});

test("maxAgentTurns honors a valid positive override", () => {
  process.env[ENV] = "3";
  expect(maxAgentTurns()).toBe(3);
});

test("maxAgentTurns rejects invalid overrides and falls back", () => {
  for (const bad of ["0", "-5", "abc", "2.5", ""]) {
    process.env[ENV] = bad;
    expect(maxAgentTurns()).toBe(MAX_AGENT_TURNS_DEFAULT);
  }
});

test("delegationOptions is empty for a non-router (no sub-agents)", () => {
  expect(delegationOptions(undefined)).toEqual({});
});

test("delegationOptions wires both agents and the top-level cap", () => {
  process.env[ENV] = "7";
  const subs = { comms: { description: "x" } };
  const opts = delegationOptions(subs);
  expect(opts.agents).toBe(subs);
  expect(opts.maxTurns).toBe(7);
});

test("isErrorResultSubtype recognizes SDK error subtypes only", () => {
  expect(isErrorResultSubtype("error_max_turns")).toBe(true);
  expect(isErrorResultSubtype("error_during_execution")).toBe(true);
  expect(isErrorResultSubtype("success")).toBe(false);
  expect(isErrorResultSubtype(undefined)).toBe(false);
});

test("maxTurnsMessage names the limit and is non-empty", () => {
  const msg = maxTurnsMessage(12);
  expect(msg).toContain("12");
  expect(msg).toContain("turn limit");
});
