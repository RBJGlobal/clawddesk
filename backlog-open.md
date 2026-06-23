# ClawdDesk — Backlog: OPEN (priority order)

> Reconciled 2026-06-16. Everything that has shipped is in [`backlog-done.md`](./backlog-done.md).
> Core development is **complete** (the user marked this 2026-06-10); every item below is a nice-to-have, a safety rail, or a polish task — none blocks daily use.
> Priority tiers: **P1 (high)** robustness/hygiene worth doing soon · **P2 (medium)** completes or extends a shipped feature · **P3 (low)** net-new nice-to-have · **Deferred**.

---

## P1 — Robustness & hygiene (do these first)

| # | Item | Effort | Why |
|---|------|--------|-----|
| 2 | **Test-isolate the skills root** | S (one-liner) | `skillInstall.ts` hardcodes `USER_SKILLS_ROOT` from `os.homedir()`, so Skills Studio tests write to the real `~/.claude/skills` (cleaned in `finally`). Make it env-overridable (e.g. `CLAWDDESK_SKILLS_ROOT`) so tests use a temp dir and never touch real user state. |

> **#1 Sub-agent depth limit — ✅ DONE 2026-06-23** (SDK-native `maxTurns` rail, env-overridable `CLAWDDESK_MAX_AGENT_TURNS`). See `backlog-done.md` → Session 2026-06-23.

## P2 — Complete / extend shipped features

| # | Item | Effort | Why |
|---|------|--------|-----|
| 3 | **Emergent skills: multi-turn capture** | S–M | `POST /api/skills/propose` distills only the last turn. Let the distiller optionally consume the last N turns (explore → act → verify). Builds on `src/emergentSkills.ts`. |
| 4 | **C12-follow-up: file rewind UI** | M (2–3h) | `enableFileCheckpointing` snapshots exist, but the rewind affordance needs holding the SDK `Query` object alive across requests (streaming-input refactor: `prompt` as `AsyncIterable<SDKUserMessage>`, track user-message UUIDs, add a rewind button per user bubble). |
| 5 | **Inline AskUserQuestion UI** | M | Wire the SDK's `AskUserQuestion` tool into the streaming pipeline so mid-run disambiguation shows up as an interactive multiple-choice card. |
| 6 | **AskUserQuestion from hooks** | M | Let a `PreToolUse` hook ask the user a question mid-tool-run (e.g., before a destructive Bash command) — a richer cousin of the approval gate. Pairs with #5. |

## P3 — Net-new nice-to-haves

| # | Item | Effort | Why |
|---|------|--------|-----|
| 7 | **"Council" mode** | M | One prompt → multiple agents weigh in → a synthesizer produces a consolidated answer. Good for decisions; strong demo. |
| 8 | **Right-panel file viewer** | M | When Ops reads a file, show it inline in a side pane so you see what the agent saw. Debugging + trust. |
| 9 | **Hook inspector** | M | Render `PreToolUse`/`PostToolUse`/`Stop` events as a per-turn timeline. Developer-facing; teaches the SDK's event model. |
| 10 | **Multi-pane chat** | M–L | Split view — two agents side by side for model comparison or parallel work. |
| 11 | **Multiple workspaces** | M–L | Switch between project contexts (different cwd + memory partition) without losing state. |
| 12 | **Auth profile switcher** | M | Toggle "personal (OAuth, Max)" vs "dev (API key)" to exercise the commercial path end-to-end. |
| 13 | **Onboarding tour** | S–M | 5-step first-run flow highlighting sidebar, chat, folder, tasks, model selector. |

## Deferred

| # | Item | Why deferred |
|---|------|--------------|
| 14 | **C07 — Electron / Tauri packaging** | LOW. Package the web UI + server as a desktop app. Revisit only if packaging becomes useful; the local-web model is fine for personal use. |

---

## Explicitly NOT building (out of scope by design)

- Multi-provider adapters (OpenAI / Gemini / Ollama / Codex) — that's Clawless's lane; ClawdDesk stays Claude-only.
- Hosted multi-tenant deployment — would require API-key auth + commercial terms.
- Org-chart primitives, git-worktree workspace isolation, governance audit — Paperclip's lane.
- ClawHub-style registry / VirusTotal skill scanning — deliberately rejected during Skills Studio (format-incompatible + privacy-violating).

---

## Issues surfaced by the 2026-06-16 regression review

The review produced **17 confirmed findings** (0 high, 2 medium, 15 low). **16 were fixed tonight** (PRs #26–#28 + the final dead-code sweep — see `backlog-done.md`): all 10 dead-code items, both scan-gate bypasses, the extractJson scan-forward bug, the skillWorthy hardening, the propose turn-pairing, the lost-race 409 shape, and the costGuard typing (tsc now 0 errors). **One was deferred** (behavior-adding UX, per the apply-safe/stage-risky rule):

| # | Item | Effort | Why deferred |
|---|------|--------|--------------|
| 15 | **Skill install: overwrite-on-collision UX** | S | `installSkill`/`acceptProposal` accept a `force` flag (the routes forward it), but no frontend caller ever sends it — so a slug collision is an unrecoverable 400 in the UI (a manual-delete workaround exists; an emergent proposal whose name collides can never be accepted). Fix: on the "already exists" 400, `confirm()` + retry with `force:true`, mirroring the existing 409-acknowledged retry. Behavior-adding UX → staged for your review rather than auto-merged. Low severity. Slots into **P2** (completes a shipped feature's UX). |
