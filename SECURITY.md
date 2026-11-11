# Security policy

ClawdDesk is a personal, local-only app: it binds to `127.0.0.1` by default and runs on your own machine. Outbound traffic goes to Anthropic, to the CDN that serves the UI's Markdown libraries, to websites your agents fetch or browse (WebFetch, WebSearch, and browser automation limited to allow-listed domains), and to any MCP server, Telegram bridge or WhisprDesk instance you connect. There is no hosted service and no shared data. Even so, bugs that let a web page, a tool result or a connected service do more than the user intended matter, and we want to hear about them.

## Reporting a vulnerability

Please report security issues privately by email to **info@clawddesk.ai** rather than in a public issue or pull request. Include:

- what you found and where (file, route or UI surface),
- how to reproduce it,
- what an attacker could do with it,
- the commit or version you tested.

We will reply from that mailbox. Please give us a reasonable window to fix the problem before you publish anything about it.

## What is in scope

- The Express server in `src/` (routes under `/api/*`, the SDK call sites, hooks, sub-agent delegation, cost guard, scheduler, Telegram bridge).
- Browser automation and its domain allow-list gate (`src/browser.ts`).
- The browser UI in `public/`.
- Skill install and scan gates, MCP server configuration, and the settings store.

## What is out of scope

- The intentionally unrestricted folder picker (`/api/cwd`, `/api/browse`). It lets the local user reach their own files, which is the documented personal-use threat model. It would be addressed before any multi-user or commercial path ships.
- Issues in the Claude Agent SDK, Claude Code, or other dependencies. Please report those upstream; a note to us is still welcome so we can pin or work around them.
- Findings that need the attacker to already have local code execution as the same user.

## Supported versions

Only the current `main` branch is supported. There are no release branches.
