# ClawdDesk — Backlog: DONE

> Reconciled 2026-06-16 against the git history, the code, and the change log in `backlog.md`.
> Everything below is **shipped and verified** (merged to `main`, covered by the test suite where applicable).
> Companion file: [`backlog-open.md`](./backlog-open.md) — what's still open, in priority order.
>
> **Current state:** 100 automated tests green (98 Playwright smoke + 2 @engine). Repo: `RBJGlobal/clawddesk`. Domain: clawddesk.ai.

---

## Foundation (F1–F7) — 2026-04-23

| # | Item | Notes |
|---|------|-------|
| F1 | Project scaffold | Express + `tsx` + Claude Agent SDK + vanilla UI, one process on :3333 |
| F2 | Multi-agent sidebar | Main / Comms / Content / Ops, rendered from `/api/agents` |
| F3 | Per-agent system prompts, tools, session persistence | `resume: sessionId` per agent |
| F4 | Folder picker + cwd scoping | `/api/cwd`, `/api/browse`; `cwd` passed to `query()` |
| F5 | `@file` autocomplete | `/api/files`; composer dropdown with keyboard nav |
| F6 | Per-agent model selector | Opus / Sonnet / Haiku; runtime override via `/api/model/:agentId` |
| F7 | Model + auth footer on each reply | Captured from `system.init`; "Max plan" when OAuth |

## Phase 1 — Sub-agent + real-time UX

| # | Item | Date | Notes |
|---|------|------|-------|
| C01 | Sub-agent delegation | 2026-04-23 | Main auto-routes via SDK `agents:` option; 🤝 delegation chips |
| C02 | Token-by-token streaming | 2026-04-23 | `includePartialMessages: true`; NDJSON from `/api/chat/stream` |
| C03 | Task queue + Haiku auto-routing | 2026-04-23 | 3-column board, priority, agent override |
| C06 | Playwright smoke + engine tests | 2026-04-23 | `smoke` (offline) + `engine` (@engine, real SDK) projects |
| C08 | Markdown rendering in chat | 2026-04-24 | `marked` + `DOMPurify` + `highlight.js` |
| C09 | Persistent memory (SQLite) | 2026-04-24 | `data/lab.db`; injected as `<persistent-memory>` block; per-agent or global (this is the old C04 concept, shipped) |
| C10 | Slash commands + autocomplete | 2026-04-24 | `/help` `/clear` `/model` `/agents` `/plan` `/think` `/export` + popover |
| C11 | Plan mode toggle | 2026-04-24 | Per-agent `permissionMode: 'plan'` |
| C12 | File checkpointing (PARTIAL) | 2026-04-24 | `enableFileCheckpointing` flag set, then **pulled in the audit**; rewind UI deferred → see `backlog-open.md` |
| C13 | Voice (WhisprDesk) | 2026-04-24 | Mic + SSE listener + speak button; WebM→WAV in browser; ⌥V |
| C14 | Settings modal | 2026-04-24 | SQLite-backed, secrets masked, env fallback; per-section save (PR #8) |
| C15 | Custom agents (CRUD) | 2026-04-24 | `+ New agent`; `custom_agents` table; built-ins read-only |
| A1 | Cost & token tracking | 2026-04-25 | OAuth-aware (no fake $ for Max); per-message + session totals |
| A2 | Session history + restore | 2026-04-25 | `sessions` + `session_messages` tables; click any past session to resume |
| A3 | Conversation export | 2026-04-25 | `/export md` / `/export json` client-side downloads |

## Phase 2 — Autonomous Operations (C16 epic, fully shipped)

| # | Item | Date | Notes |
|---|------|------|-------|
| C16b | Durable task queue (SQLite + atomic checkout) | 2026-04-27 | `src/taskQueue.ts` (host-agnostic); lease-based crash recovery; full Reviewer/QA/Perf/Security passes |
| C16c | Budget caps (CostGuard) | 2026-04-27 | `src/costGuard.ts` preflight before every `query()`; cost cap + rate cap; OAuth-aware |
| C16a | Cron-style scheduler | 2026-04-28 | `src/scheduler.ts`; OAuth-rotation auto-pause; 3-strike fallback; next-3-fires preview |
| C16d | Per-task approval gates | 2026-04-29 | `src/approvals.ts`; `PreToolUse` hook genuine SDK pause; production-cwd auto-elevation; per-task-vs-per-tool analysis in `docs/analysis/` |

## Channels, capabilities, and shortcuts

| Item | Date | Notes |
|------|------|-------|
| Keyboard shortcuts (⌘K palette + direct) | 2026-04-29 | PR #6; filterable palette, ⌘; ⌘⇧T ⌘⇧S ⌘⇧M ⌘⇧H, Esc modal-stack |
| C05 — Telegram bridge | 2026-04-29 | `src/telegram.ts`; long-poll listener, allowlist-gated, `/agent` routing, token-rotation without restart |
| Settings UX polish | 2026-04-30 | PR #8; per-section save, auto-save on Test, dirty-state cue |
| Context pins + MCP config UI + Skills panel | 2026-06-10 | `contextPins.ts` / `mcpServers.ts` / `skills.ts`; per-agent; **close of core development** |

## Clawless cross-pollination — the 5 ports — 2026-06-11

| # | Item | Notes |
|---|------|-------|
| Port 1 | Browser automation | `src/browser.ts`; per-agent Playwright behind a domain allow-list + private-IP/SSRF `PreToolUse` gate; open mode removed after security audit (3 HIGH fixed) |
| Port 2 | Agent personality / Soul Builder | `src/personality.ts`; presets + custom voice over LOCKED privacy/boundary sections; identity-preserving; sanitized (incl. ASCII closing-tag escape) |
| Port 3 | Skills Studio | `src/skillInstall.ts`; build/install/scan/delete SDK-native skills; path-confined; paste-tier scan gate; **no ClawHub, no VirusTotal** (deliberate) |
| Port 4 | Emergent skills (B68) | `src/emergentSkills.ts`; 💡 nudge distills a turn → reviewable proposal; paste-tier accept gate; tools anchored to observed |
| Port 5 | Cron result destinations + run history | `src/scheduleRuns.ts`; in-app/file/telegram delivery; per-schedule run history; file output confined to `~/.clawddesk/reports/` |

## Rebrand + website support — 2026-06-12

| Item | Notes |
|------|-------|
| Rebrand → ClawdDesk | "Command Center" / "Claude Agent Lab" → **ClawdDesk** (one word); repo transferred `jaysidd/claude-agent-lab` → `RBJGlobal/clawddesk`; PRs #22, #23 |
| Stale-LOC + wordmark finalize | LOC corrected to ~18.5k; wordmark locked to one word |
| Architecture-flow spec | `docs/architecture-flow-spec.md` — React Flow node/edge spec for the marketing site |
| Screenshots refreshed (+4 new surfaces) | All 15 regenerated + browser/personality/skills/scheduler captures; PR #24 |
| Em-dash cleanup | 45 em-dashes stripped from guide pages (RBJ Global house-style launch blocker); PR #24 |
| Website handed off | Brief at `.notes/clawddesk-website-brief.md`; Global Sites Developer launched clawddesk.ai |

## Docs & infrastructure

| Item | Notes |
|------|-------|
| User guide corpus (21 pages) | PR #16; `docs/guide/` one page per surface, Clawless-KB-style, `[Live]` badges |
| README freshness Stop hook | PR #15; `scripts/check-readme-fresh.mjs` blocks on a stale test badge |
| Models bumped to Opus 4.8 | PR #13 |
| GitHub Pages | live docs site |

---

## Stabilization session — 2026-06-16

| Item | Notes |
|------|-------|
| Node-25 / better-sqlite3 rebuild | App wouldn't boot after a Node upgrade (NODE_MODULE_VERSION 137→141); fixed with `npm rebuild better-sqlite3` |
| Full regression baseline | 100/100 green (98 smoke + 2 engine) confirmed on the current environment |
| Multi-agent regression review | 4-dimension review (correctness/dead-code/security/consistency) + adversarial verification: 19 raw → 17 confirmed findings |
| PR #25 — backlog reconciliation | This file + `backlog-open.md` + `backlog.md` header |
| PR #26 — dead-code removal | 65 lines: unused `getScheduler`/`clearMemories`/dead `subAgentsFor`/CostGuard `db` field/4 unused imports/5 orphaned `__INTERNALS__` seams |
| PR #27 — correctness + type-cleanliness | extractJson scan-forward, skillWorthy "false"-string hardening, propose turn-pairing, lost-race 409 error shape, **costGuard typing → `tsc` now 0 errors (was 5)** |
| PR #28 — scan-gate hardening | rm split/long-flag bypass + download-then-exec + interpreter fetch-exec now trip HIGH; prototyped against benign prose for zero false positives |
| Dead-code sweep clean | `tsc --noUnusedLocals --noUnusedParameters` → 0 (removed a final orphan, `TERMINAL_STATUSES`); plain `tsc --noEmit` → 0 |

**End state:** `tsc` clean (0 errors), 0 unused locals/params, 100 tests green. 16 of 17 review findings fixed; 1 deferred (see `backlog-open.md`).
