import { query } from "@anthropic-ai/claude-agent-sdk";

const url = process.argv[2] ?? "https://docs.claude.com/en/api/agent-sdk/overview";

for await (const message of query({
  prompt: `Fetch ${url} and give me a 3-sentence plain-English summary.`,
  options: {
    allowedTools: ["WebFetch"],
    permissionMode: "default", // keep the allowlist as the only gate (SDK 0.3.286+)
  },
})) {
  if ("result" in message) console.log(message.result);
}
