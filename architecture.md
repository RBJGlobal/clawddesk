# ClawdDesk — Architecture

> Last updated: 2026-04-23

## Mental model

The SDK is not a chat API. It's the same agent loop Claude Code runs, exposed as a TypeScript function. You hand it a prompt + options and iterate over an async stream of events (`system.init`, `assistant`, `tool_use`, `tool_result`, `result`). Everything you see in Claude Code — tool use, plan mode, hooks, sub-agents, sessions — is available as an option on `query()`.

ClawdDesk takes that raw primitive and wraps it in the thinnest possible UI layer. Express for HTTP, vanilla JS for the browser, zero build pipeline for the frontend. The SDK does the hard work; we render it.

---

## Process topology

```
┌─────────────────┐         ┌──────────────────────────────────┐
│  Browser        │         │  Node.js process (tsx src/server.ts)
│  public/*       │◄────────┤   ├── Express (port 3333)
│  vanilla JS     │  JSON   │   │   ├── /api/agents
└────────┬────────┘         │   │   ├── /api/cwd, /api/browse, /api/files
         │                  │   │   ├── /api/model/:agentId
         │ /api/chat        │   │   └── /api/chat   ──┐
         └──────────────────►   │                      │
                            │   ├── state (in-memory) │
                            │   │   ├── sessionByAgent
                            │   │   ├── modelOverride │
                            │   │   └── currentCwd    │
                            │   │                      │
                            │   └── Claude Agent SDK  ◄┘
                            │       ├── query({...})
                            │       └── spawns `claude` subprocess
                            └──────────────┬───────────────────┘
                                           │ OAuth session
                                           ▼
                            Claude Max subscription (~/.claude/...)
```

One OS process. No IPC, no WebSockets (yet), no secondary server. The `claude` binary that the SDK spawns is the only child process.

---

## File map

| Path | Role | LOC |
|---|---|---|
| `src/server.ts` | Express app, all `/api/*` routes, SDK call sites for chat + chat/stream + task runs, classifier, .env loader, WhisprDesk proxy, Settings + Sessions + custom-agent CRUD wiring | ~700 |
| `src/agents.ts` | Built-in agent configs (Main / Comms / Content / Ops) + MODELS table | ~120 |
| `src/agentRegistry.ts` | Merges built-ins + custom agents at runtime; `findAgent()`, `allAgents()`, `subAgentsFor()` (stamps each sub-agent with `maxTurns`), `isBuiltInAgent()`, `builtInIds()` | ~45 |
| `src/agentTurns.ts` | Sub-agent delegation turn cap. `maxAgentTurns()` (env `CLAWDDESK_MAX_AGENT_TURNS`, default 30), `delegationOptions()` (spreads `{agents, maxTurns}` into router `query()` calls), `maxTurnsMessage()`, `isErrorResultSubtype()`. Self-contained (no other `src/` imports) so the offline tests can exercise it directly. The only in-flight rail against a runaway cascade — CostGuard only records post-query | ~65 |
| `src/customAgents.ts` | SQLite CRUD for `custom_agents` table — create / update / delete / find | ~140 |
| `src/memory.ts` | better-sqlite3 init (shared db at `data/lab.db`), `memories` schema + CRUD, `memoryBlockFor()` injection helper. (`augmentedSystemPrompt()` moved to `contextPins.ts` to compose memory + pins without a circular import) | ~140 |
| `src/contextPins.ts` | `context_pins` table + CRUD; `pinnedBlockFor()` re-reads `file` pins from disk each turn (size-capped, no-throw); owns `augmentedSystemPrompt()` composing memory + pins. Imports `db`+`memoryBlockFor` from memory.ts | ~210 |
| `src/mcpServers.ts` | `mcp_servers` table + CRUD; env/header values masked for display, raw at runtime; `mcpOptionsFor()` returns `{allowedTools (+ mcp__<name> tokens), mcpServers}` spread into every `query()`; per-agent stdio/http/sse | ~270 |
| `src/skills.ts` | `agent_skills` table; `discoverSkills(cwd)` scans `.claude/skills/*/SKILL.md` (project + user) parsing frontmatter; `skillsOptionsFor()` returns `{settingSources, skills}` when an agent has enabled skills | ~150 |
| `src/settings.ts` | `settings` table + schema, `configValue(dbKey, envKey)` reader with env-fallback, masked-secret API for the UI | ~150 |
| `src/sessions.ts` | `sessions` + `session_messages` tables, transactional `appendTurn()`, auto-titling, restore helpers | ~160 |
| `src/hello.ts` | One-shot URL summarizer (smoke test entry; `npm run hello`) | ~15 |
| `public/index.html` | All UI markup — sidebar, chat, modals (folder, tasks, memory, settings, agent editor, history) | ~140 |
| `public/style.css` | Dark dashboard theme; markdown rendering; modal + popover + voice indicator styles | ~900 |
| `public/app.js` | Frontend — agents, streaming chat with WAV-conversion mic, folder picker, @file + slash-command popovers, task board, memory + settings + agent + history modals, slash dispatcher, /think + /export + /plan, mic ⌥V shortcut, session usage chip, restore flow | ~1,100 |
| `scripts/screenshot.mjs` | Playwright script that regenerates all 14 README screenshots | ~140 |
| `scripts/launch-clawddesk.command` | Move-safe Desktop launcher (auto-locates project via candidate list; pkill + lsof retries) | ~150 |
| `playwright.config.ts` | Two projects: `smoke` (offline) + `engine` (@engine-tagged, real SDK) | — |
| `tests/smoke.spec.ts` | 7 offline UI tests | — |
| `tests/features.spec.ts` | 14 offline feature tests (memory, slash, custom agents, settings, etc.) | — |
| `tests/chat.spec.ts` | 2 @engine tests (streaming reply, task classifier) | — |

Total hand-written: ~18,500 LOC across the whole project. By design. Everything the SDK gives us for free stays in the SDK.

### Module dependency map

```
       ┌────────────┐
       │ memory.ts  │   ← opens the shared SQLite db (data/lab.db)
       └─────┬──────┘
             │ exports `db`
   ┌─────────┼──────────────┬──────────────┐
   ▼         ▼              ▼              ▼
settings  customAgents   sessions      (memory itself)
   │         │              │
   └─────────┼──────────────┘
             │
             ▼
      agentRegistry.ts ── merges built-ins + custom
             │
             ▼
         server.ts ── wires it all up + API surface
```

`memory.ts` is the dependency root because it owns the shared SQLite handle. Every other DB-touching module imports `db` from there. `agentRegistry` is the only module that can answer "is this agent built-in or custom?"

---

## State model

All state is in-memory on the server. Restart = fresh.

| State | Type | Where | Reset on |
|---|---|---|---|
| Session IDs per agent | `Map<agentId, sessionId>` | `server.ts:17` | `/api/reset/:agentId`, `cwd` change, model override |
| Model overrides | `Map<agentId, string>` | `server.ts:18` | `POST /api/model/:agentId` with empty body |
| Current working directory | `string` (default: `os.homedir()`) | `server.ts:19` | `POST /api/cwd` |
| Chat history (UI only) | `state.conversations[agentId]` | `app.js:4` | New chat button, cwd change, model change |

**Frontend history is cosmetic** — it shows what the user and agent have said in the current browser session. The *actual* conversation context lives in the SDK session (`resume:`). Reload the browser and history is empty, but if the server still has the session ID, the agent still remembers.

This duality is deliberate. Cleaner than trying to persist + sync. Persistence is tracked as C04 (SQLite-backed memory that survives restarts).

---

## API contract

### `POST /api/chat/stream` (C02)
Same body as `/api/chat`; returns NDJSON (one JSON object per line). Event `kind` field:
- `init` — `{sessionId, model, apiKeySource}` captured from SDK init
- `text_delta` — `{text}` incremental assistant text from `includePartialMessages: true`
- `tool_use` — `{name, input}` tool invocation (Agent = delegation)
- `result` — `{text}` authoritative final text
- `error` — `{message}`
- `done` — end of stream

Used by the UI for token-by-token rendering. Original `/api/chat` retained for tests and fallback.

### `GET /api/tasks` / `POST /api/task` / `POST /api/task/:id/run` / `DELETE /api/task/:id` (C03)
- Create → classifier (Haiku) picks an agent unless caller supplies `agentId` override
- Run → executes task via `query()` with the assigned agent's config; **no `resume:`** (fresh context per task)
- Task state machine: `queued → active → done | error`
- Task includes `createdAt`, `startedAt`, `completedAt`, `result`, `error`

### `POST /api/chat`
Request:
```json
{ "agentId": "main", "message": "..." }
```
Response:
```json
{
  "reply": "...",
  "toolUses": [{"name": "Read", "input": {...}}],
  "model": "claude-sonnet-4-6",
  "apiKeySource": "none",
  "cwd": "/Users/you/project"
}
```

Server:
1. Resolves `agent` from `agents.ts`
2. Looks up `resumeId` from `sessionByAgent.get(agentId)`
3. Resolves `modelId` via `effectiveModel(agentId)` (override → default)
4. Calls `query({ prompt, options: { allowedTools, systemPrompt, resume, cwd, model } })`
5. Iterates the async stream:
   - `system.init` → captures `session_id`, `model`, `apiKeySource`
   - `assistant` with `tool_use` blocks → appends to `toolUses[]`
   - result with `result` string → final text
6. Persists new `session_id` to `sessionByAgent`
7. Returns JSON

The route is buffered (full response before response sent). Streaming is C02.

### Other routes
All synchronous, all return JSON, all reject bad input with `{ error }` + 400.

---

## Agent configuration (`src/agents.ts`)

```ts
{
  id: string            // route key: "main" | "comms" | "content" | "ops"
  name: string          // display name
  emoji: string         // avatar glyph
  accent: string        // color (sidebar icon, etc.)
  description: string   // one-line summary for sidebar
  systemPrompt: string  // personality + role
  allowedTools: string[] // SDK tool allowlist
  model: string         // default model
}
```

Current defaults:

| Agent | Tools | Model | Why |
|---|---|---|---|
| Main | (none) | Sonnet 4.6 | Pure reasoning, routing, triage |
| Comms | `WebFetch` | Sonnet 4.6 | Draft messages; sometimes pull context |
| Content | `WebSearch`, `WebFetch` | **Opus 4.8** | Best creative output |
| Ops | `Read`, `Glob`, `Grep` | Sonnet 4.6 | Read files in current cwd |

Adding a new agent = one entry in this file. No server changes needed.

---

## Session handling

The SDK's `resume: sessionId` option is how multi-turn conversations work. We capture `session_id` from the first `system.init` message of each `query()` call and store it under the agent's ID. Next message → pass `resume:` → SDK loads the prior conversation's context.

Gotcha: **changing `cwd` mid-session confuses the agent** (context includes the old cwd). We work around this by clearing all agent sessions (`sessionByAgent.clear()`) on `POST /api/cwd`. Same for model overrides — changing the model per-agent clears that agent's session.

---

## Model selection

Three models wired via `MODELS` in `agents.ts`:
- `claude-opus-4-8` — best creative/reasoning
- `claude-sonnet-4-6` — balanced default
- `claude-haiku-4-5` — fastest/cheapest

Per-agent default in the config file. Runtime override via `POST /api/model/:agentId`. The UI surfaces both: sidebar shows each agent's current model as a chip; `<select>` in the chat header changes it. The model used for each specific reply is echoed back in the response's `model` field and shown in the message footer — so you always know what answered you.

---

## Auth path

The SDK checks in order:
1. `ANTHROPIC_API_KEY` env var (if set, uses it)
2. Falls back to the `claude` CLI's stored OAuth session (`~/.claude/...`)
3. If neither, errors out

Currently the env var is unset, so every call rides on the Max subscription via OAuth. The response's `apiKeySource` field is `"none"` when OAuth is active — we translate that to "Max plan · subscription" in the UI for clarity.

**Commercial distribution would require API key auth.** Not a todo for this project; that's Clawless territory.

---

## Frontend model

Pure vanilla JS. No framework. Global `state` object holds:
- `agents` — loaded once from `/api/agents`
- `models` — loaded once from `/api/models`
- `activeAgentId` — current selection
- `conversations` — `{ [agentId]: Array<{role, text, toolUses?, model?, apiKeySource?}> }`
- `cwd`, `home`, `browse`, `filePopover` — UI helpers

Rendering is re-render-the-world on every state change (cheap at this scale). `renderMessages()` rebuilds the chat log from `state.conversations[activeAgentId]`.

No client-side routing. No persistence. Deliberate simplicity.

---

## Design decisions worth calling out

- **Why vanilla JS and not React?** The point is to make SDK concepts visible. A framework adds abstraction between the learner and the primitive. When the primitives stabilize in the dev's mind, a framework is fine.
- **Why Express 5 and not Fastify / Hono?** Express is the least surprising thing in Node. This is a learning project.
- **Why one server instead of separate main/renderer (Electron)?** Electron is the right call when you need native OS integration (filesystem, menus, notifications). The Agent SDK already has filesystem access via `Read/Write/Bash`; notifications + packaging are a later concern tracked as `C07`.
- **Why in-memory state?** Fastest path to seeing the concepts. Persistence (C04) upgrades this to SQLite when the agents start remembering useful things across restarts.

---

## Known constraints

- Personal use only (Max OAuth).
- Single user, single browser tab. No concurrent users.
- Restarts lose all chat history and agent sessions.
- No rate-limit handling beyond what the SDK does for us.
- Error handling is minimal — if `query()` throws, the UI shows the message and the session may or may not be usable; safest fix is "New chat".
