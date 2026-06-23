// Sub-agent delegation safety rail (backlog P1 #1).
//
// The SDK exposes `maxTurns` in two places: the top-level `query()` options
// (bounds the router's own agent loop) and each per-agent `AgentDefinition`
// (bounds an individual sub-agent's loop). Setting both gives a finite,
// predictable bound on a delegation cascade — the router can only spin so many
// turns, and every sub-agent it dispatches is independently capped.
//
// This is a turn / total-work cap, NOT a literal recursion-depth counter.
// Built-in delegation is already depth-1 (the specialists carry no `Agent`
// tool and `subAgentsFor` passes no nested `agents`), so the only way to nest
// further is a user-created router agent. `maxTurns` is the right rail because
// it bounds total work regardless of shape, and it is the ONLY in-flight rail:
// CostGuard records usage *after* a query completes, so it can't interrupt a
// runaway loop mid-stream.
//
// Self-contained on purpose (no other `src/` imports) so the offline test
// suite can exercise it directly.

/** Default cap when `CLAWDDESK_MAX_AGENT_TURNS` is unset or invalid. */
export const MAX_AGENT_TURNS_DEFAULT = 30;

/**
 * Resolve the per-loop turn cap. Reads `CLAWDDESK_MAX_AGENT_TURNS` at call time
 * (not module load) so tests can flip it without re-importing. Anything that
 * isn't a positive integer falls back to the default.
 */
export function maxAgentTurns(): number {
  const raw = process.env.CLAWDDESK_MAX_AGENT_TURNS;
  if (raw === undefined || raw.trim() === "") return MAX_AGENT_TURNS_DEFAULT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return MAX_AGENT_TURNS_DEFAULT;
  return n;
}

/**
 * Build the delegation-related slice of a `query()` options object. When the
 * agent is a router (sub-agents present) it contributes both the `agents` map
 * and a top-level `maxTurns` cap; otherwise it contributes nothing, leaving a
 * directly-invoked agent unconstrained. Spread into the options at each call
 * site: `...delegationOptions(subAgents)`.
 */
export function delegationOptions(
  subAgents: Record<string, any> | undefined,
): { agents?: Record<string, any>; maxTurns?: number } {
  if (!subAgents) return {};
  return { agents: subAgents, maxTurns: maxAgentTurns() };
}

/** User-facing message when a run stops because it hit the turn cap. */
export function maxTurnsMessage(numTurns?: number): string {
  const cap = typeof numTurns === "number" ? numTurns : maxAgentTurns();
  return `Stopped after ${cap} turns — hit the agent turn limit (CLAWDDESK_MAX_AGENT_TURNS). Try a narrower request, or raise the cap.`;
}

/** True for SDK `result` subtypes that mean the run terminated abnormally. */
export function isErrorResultSubtype(subtype: unknown): boolean {
  return typeof subtype === "string" && subtype.startsWith("error_");
}
