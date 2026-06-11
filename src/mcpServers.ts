// MCP server configuration — per-agent Model Context Protocol servers that
// light up as tools when that agent runs. Three transports, matching the SDK's
// McpServerConfig union:
//   - stdio: spawns a local process (command + args + env)
//   - http:  connects to an HTTP MCP endpoint (url + headers)
//   - sse:   connects to an SSE MCP endpoint (url + headers)
//
// Storage + retrieval only. The host (server.ts) composes mcpOptionsFor() into
// every query() call: it returns the SDK `mcpServers` map for the agent's
// enabled servers PLUS the `mcp__<name>` allow-tokens to append to allowedTools
// (otherwise the connected tools would be blocked by the agent's allowlist).
//
// Imports `db` from memory.ts (one-directional; memory.ts never imports this).

import { randomUUID } from "node:crypto";
import { db } from "./memory.js";

// ============================================================================
// Schema
// ============================================================================

db.exec(`
  CREATE TABLE IF NOT EXISTS mcp_servers (
    id          TEXT PRIMARY KEY,
    agent_id    TEXT NOT NULL,
    name        TEXT NOT NULL,           -- key in the mcpServers map, e.g. "filesystem"
    transport   TEXT NOT NULL CHECK (transport IN ('stdio', 'http', 'sse')),
    command     TEXT,                    -- stdio
    args_json   TEXT,                    -- stdio: JSON string[]
    env_json    TEXT,                    -- stdio: JSON Record<string,string>
    url         TEXT,                    -- http | sse
    headers_json TEXT,                   -- http | sse: JSON Record<string,string>
    enabled     INTEGER NOT NULL DEFAULT 1,
    created_at  INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_mcp_agent ON mcp_servers(agent_id, created_at DESC);
`);

// ============================================================================
// Types
// ============================================================================

export type McpTransport = "stdio" | "http" | "sse";

export type McpServerRow = {
  id: string;
  agentId: string;
  name: string;
  transport: McpTransport;
  command: string | null;
  args: string[];
  env: Record<string, string>;
  url: string | null;
  headers: Record<string, string>;
  enabled: boolean;
  createdAt: number;
};

// SDK-shaped config for a single server (the value side of the mcpServers map).
type SdkMcpConfig =
  | { type: "stdio"; command: string; args?: string[]; env?: Record<string, string> }
  | { type: "http"; url: string; headers?: Record<string, string> }
  | { type: "sse"; url: string; headers?: Record<string, string> };

const NAME_RE = /^[a-zA-Z0-9_-]{1,40}$/;

// ============================================================================
// Helpers
// ============================================================================

function safeParseObj(s: string | null): Record<string, string> {
  if (!s) return {};
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function safeParseArr(s: string | null): string[] {
  if (!s) return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function row(r: any): McpServerRow {
  return {
    id: r.id,
    agentId: r.agent_id,
    name: r.name,
    transport: r.transport,
    command: r.command,
    args: safeParseArr(r.args_json),
    env: safeParseObj(r.env_json),
    url: r.url,
    headers: safeParseObj(r.headers_json),
    enabled: r.enabled === 1,
    createdAt: r.created_at,
  };
}

// Mask the VALUES of env / headers for display (keys preserved). env vars and
// HTTP headers commonly carry tokens; never round-trip raw secret values to
// the browser. The stored value is what query() uses at runtime.
function maskValues(obj: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k] ?? "";
    out[k] = v.length <= 4 ? "••••" : "••••" + v.slice(-4);
  }
  return out;
}

// ============================================================================
// CRUD
// ============================================================================

// For UI display — env/header VALUES masked.
export function listMcpServersMasked(agentId: string): McpServerRow[] {
  return listMcpServersRaw(agentId).map((s) => ({
    ...s,
    env: maskValues(s.env),
    headers: maskValues(s.headers),
  }));
}

// Internal / runtime — real values.
export function listMcpServersRaw(agentId: string): McpServerRow[] {
  const rows = db
    .prepare("SELECT * FROM mcp_servers WHERE agent_id = ? ORDER BY created_at DESC")
    .all(agentId);
  return rows.map(row);
}

export type CreateMcpInput = {
  agentId: string;
  name: string;
  transport: McpTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
};

export function createMcpServer(input: CreateMcpInput): McpServerRow {
  const agentId = (input.agentId ?? "").trim();
  if (!agentId) throw new Error("agentId required");
  const name = (input.name ?? "").trim();
  if (!NAME_RE.test(name)) {
    throw new Error("name must be 1-40 chars, letters/digits/_/- only");
  }
  const transport: McpTransport = input.transport;
  if (transport !== "stdio" && transport !== "http" && transport !== "sse") {
    throw new Error("transport must be stdio, http, or sse");
  }

  let command: string | null = null;
  let argsJson: string | null = null;
  let envJson: string | null = null;
  let url: string | null = null;
  let headersJson: string | null = null;

  if (transport === "stdio") {
    command = (input.command ?? "").trim();
    if (!command) throw new Error("command required for stdio transport");
    argsJson = JSON.stringify(input.args ?? []);
    envJson = JSON.stringify(input.env ?? {});
  } else {
    url = (input.url ?? "").trim();
    if (!/^https?:\/\//i.test(url)) {
      throw new Error("url must be an http(s) URL for http/sse transport");
    }
    headersJson = JSON.stringify(input.headers ?? {});
  }

  const id = randomUUID();
  const createdAt = Date.now();
  db.prepare(
    `INSERT INTO mcp_servers
       (id, agent_id, name, transport, command, args_json, env_json, url, headers_json, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(id, agentId, name, transport, command, argsJson, envJson, url, headersJson, createdAt);

  const created = db.prepare("SELECT * FROM mcp_servers WHERE id = ?").get(id);
  return row(created);
}

export function setMcpEnabled(id: string, enabled: boolean): boolean {
  const r = db
    .prepare("UPDATE mcp_servers SET enabled = ? WHERE id = ?")
    .run(enabled ? 1 : 0, id);
  return r.changes > 0;
}

export function deleteMcpServer(id: string): boolean {
  const r = db.prepare("DELETE FROM mcp_servers WHERE id = ?").run(id);
  return r.changes > 0;
}

export function getMcpServerRaw(id: string): McpServerRow | null {
  const r = db.prepare("SELECT * FROM mcp_servers WHERE id = ?").get(id);
  return r ? row(r as any) : null;
}

// ============================================================================
// Runtime composition
// ============================================================================

function toSdkConfig(s: McpServerRow): SdkMcpConfig {
  if (s.transport === "stdio") {
    return {
      type: "stdio",
      command: s.command ?? "",
      ...(s.args.length ? { args: s.args } : {}),
      ...(Object.keys(s.env).length ? { env: s.env } : {}),
    };
  }
  return {
    type: s.transport,
    url: s.url ?? "",
    ...(Object.keys(s.headers).length ? { headers: s.headers } : {}),
  };
}

/**
 * Build the SDK `mcpServers` map for an agent's ENABLED servers, plus the
 * `mcp__<name>` allow-tokens that must be appended to allowedTools so the
 * connected tools aren't blocked by the agent's allowlist. Returns null when
 * the agent has no enabled servers (caller omits the mcpServers option).
 */
export function mcpServersFor(
  agentId: string,
): { servers: Record<string, SdkMcpConfig>; allowTokens: string[] } | null {
  const enabled = listMcpServersRaw(agentId).filter((s) => s.enabled);
  if (enabled.length === 0) return null;

  const servers: Record<string, SdkMcpConfig> = {};
  const allowTokens: string[] = [];
  for (const s of enabled) {
    // Last-write-wins on duplicate names (shouldn't happen; defensive).
    servers[s.name] = toSdkConfig(s);
    allowTokens.push(`mcp__${s.name}`);
  }
  return { servers, allowTokens };
}

/**
 * Convenience for the 5 query() call sites: given an agent id and its base
 * allowedTools, returns the final allowedTools (with mcp__<name> tokens
 * appended) plus the optional mcpServers map. When the agent has no enabled
 * MCP servers, allowedTools is returned unchanged and mcpServers is undefined.
 */
export function mcpOptionsFor(
  agentId: string,
  baseAllowedTools: string[],
): { allowedTools: string[]; mcpServers?: Record<string, SdkMcpConfig> } {
  const mcp = mcpServersFor(agentId);
  if (!mcp) return { allowedTools: baseAllowedTools };
  return {
    allowedTools: [...baseAllowedTools, ...mcp.allowTokens],
    mcpServers: mcp.servers,
  };
}

// Build just the SDK config map for a single server row (used by the
// connection-test route, which spins up one server in isolation).
export function singleServerConfig(s: McpServerRow): Record<string, SdkMcpConfig> {
  return { [s.name]: toSdkConfig(s) };
}
