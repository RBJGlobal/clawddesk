import { test, expect } from "@playwright/test";

test.describe("ClawdDesk — chat against real SDK @engine", () => {
  test.setTimeout(120_000);

  test("sending a message to Main yields a streaming reply @engine", async ({ page }) => {
    await page.goto("/");
    await page.locator(".agent-item", { hasText: "Main" }).click();

    const input = page.locator("#input");
    await input.fill("Reply with exactly the word OK, no punctuation.");
    await page.keyboard.press("Enter");

    // User bubble appears immediately
    await expect(page.locator(".msg.user").last()).toContainText("Reply with exactly");

    // Agent bubble appears; becomes non-empty within the timeout
    const agentBubble = page.locator(".msg.agent .msg-body").last();
    await expect(agentBubble).not.toHaveClass(/streaming-empty/, { timeout: 30_000 });
    await expect(agentBubble).toContainText("OK", { timeout: 30_000 });

    // Footer shows model + auth
    const footer = page.locator(".msg.agent .msg-footer").last();
    await expect(footer).toContainText(/Sonnet|Opus|Haiku/);
    await expect(footer).toContainText(/Max plan|API key/i);
  });

  test("task classifier routes an email task to Comms @engine", async ({ page }) => {
    await page.goto("/");
    await page.locator("#tasks-btn").click();
    await expect(page.locator("#tasks-modal")).toBeVisible();

    // Unique tag so this run finds its own card (the board sorts oldest
    // first, so an unqualified `.first()` could be a stale card from an
    // earlier failed run) and so cleanup can target it by id even on failure.
    const tag = `ref qa-${Date.now()}`;
    const description = `Draft a quick thank-you email to a client (${tag})`;
    await page.locator("#task-description").fill(description);
    await page.locator("#task-create-btn").click();

    try {
      const card = page.locator(".task-card", { hasText: tag }).first();
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card.locator(".task-card-agent")).toContainText("Comms", { timeout: 30_000 });
    } finally {
      const tasks = await (await page.request.get("/api/tasks")).json();
      for (const t of tasks as Array<{ id: string; description?: string }>) {
        if (!t.description?.includes(tag)) continue;
        const del = await page.request.delete(`/api/task/${t.id}`);
        expect(del.ok()).toBeTruthy(); // a leak must fail loudly, not pile up rows
      }
    }
  });
});
