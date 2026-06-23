import { AGENTS, AGENT_LIST, type AgentConfig } from "./agents.js";
import { listCustomAgents, findCustomAgent } from "./customAgents.js";
import { maxAgentTurns } from "./agentTurns.js";

export function allAgents(): AgentConfig[] {
  return [...AGENT_LIST, ...listCustomAgents()];
}

export function findAgent(id: string): AgentConfig | undefined {
  if (AGENTS[id]) return AGENTS[id];
  return findCustomAgent(id);
}

export function isBuiltInAgent(id: string): boolean {
  return !!AGENTS[id];
}

/**
 * For a router agent, returns a map of OTHER agents shaped as SDK
 * AgentDefinitions. Built-ins and custom agents both participate.
 */
export function subAgentsFor(agentId: string): Record<string, any> | undefined {
  const agent = findAgent(agentId);
  if (!agent?.isRouter) return undefined;
  const subs: Record<string, any> = {};
  const cap = maxAgentTurns();
  for (const candidate of allAgents()) {
    if (candidate.id === agentId) continue;
    subs[candidate.id] = {
      description: candidate.description,
      prompt: candidate.systemPrompt,
      tools: candidate.allowedTools,
      model: candidate.model,
      // Cap each sub-agent's own loop so a single delegated task can't run away
      // (the top-level router cap bounds the router's own turns — see agentTurns).
      maxTurns: cap,
    };
  }
  return subs;
}

export function builtInIds(): Set<string> {
  return new Set(Object.keys(AGENTS));
}
