# ClawdDesk — Stabilization Report (2026-06-16)

An aggressive regression + cleanup pass: verify stability, remove dead code,
reconcile the backlog, and polish. Architect + code-reviewer perspectives were
run as a multi-agent review with adversarial verification of every finding.

## TL;DR

- **App is stable.** Full regression **100/100 green** (98 Playwright smoke + 2 @engine real-SDK) at start and end.
- **`tsc` is now fully clean** — 0 errors (was 5 pre-existing TS2554s in costGuard).
- **No dead code** — `tsc --noUnusedLocals --noUnusedParameters` → 0; the multi-agent review's 10 dead-code findings plus one it missed all removed (~70 lines).
- **Backlog reconciled** into `backlog-done.md` + `backlog-open.md` (priority-ordered).
- **16 of 17 review findings fixed** and merged; 1 deferred (behavior-adding UX) and documented.

## Environment blocker fixed first

The app would not boot: Node had been upgraded to v25.5.0, but `better-sqlite3`'s
native binding was compiled for an older ABI (NODE_MODULE_VERSION 137 vs required
141). `npm rebuild better-sqlite3` fixed it. (Node 25 is newer than the README's
"tested on 24.14.1"; worth pinning/documenting a supported Node range later.)

## Method

A `regression-review` workflow fanned out **4 dimension reviewers** — correctness,
dead code, security, consistency — over the whole codebase, then **adversarially
verified every finding** against the real code (dead-code claims had to be
grep-confirmed). Result: **19 raw → 17 confirmed** (2 dropped as false positives),
0 high / 2 medium / 15 low.

## What changed (all merged to main)

| PR | Scope | Highlights |
|----|-------|-----------|
| #25 | Backlog reconciliation | Split into done + open (priority) files; the stale checkboxes/Future list (many shipped items still marked "Not started") flagged historical |
| #26 | Dead-code removal | 65 lines: `getScheduler`, `clearMemories`, dead duplicate `subAgentsFor`, CostGuard `db` field, 4 unused imports, 5 orphaned `__INTERNALS__` test-seams |
| #27 | Correctness + type-cleanliness | extractJson scan-forward (stray-brace degradation), skillWorthy "false"-string hardening, propose turn-pairing, lost-race 409 error shape, **costGuard typing → tsc 0 errors** |
| #28 | Scan-gate hardening (security) | `rm` split/long-flag bypass + download-then-exec + interpreter fetch-exec now trip HIGH; prototyped against benign prose for **zero false positives** |
| #29 | Wrap-up | Final orphan (`TERMINAL_STATUSES`) removed; backlog files finalized |

## The one deferred finding

**Skill install: overwrite-on-collision UX** (low severity). `installSkill`/
`acceptProposal` accept a `force` flag the routes forward, but no frontend caller
sends it, so a slug collision is an unrecoverable 400 in the UI (manual-delete
workaround exists). The fix is behavior-adding UX (confirm + retry with force),
so per the apply-safe/stage-risky rule it was **staged for review**, not
auto-merged. Tracked as item #15 in `backlog-open.md`.

## Verification

- Server boots clean after every change (proves no live code was removed).
- Each fix shipped as its own PR with the full suite green before squash-merge.
- Final: `tsc --noEmit` 0 errors · `tsc --noUnusedLocals --noUnusedParameters` 0 · 100/100 tests green.

## Follow-ups (non-blocking)

- Pin/document a supported Node range (the v25 ABI break cost a boot).
- Consider wiring `tsc --noEmit` into CI / a pre-PR check now that it's clean, to keep it that way.
- The deferred overwrite-UX item (`backlog-open.md` #15).
