import { expect, test } from "@playwright/test";
import { LECTURE_ID, signIn } from "./helpers";

test("admin: responses to findings by category, with no names or per-lecture rows", async ({ page }) => {
  await signIn(page, "admin");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Responses to findings" }).click();
  await expect(page.getByRole("heading", { name: "Responses to findings" })).toBeVisible();
  const table = page.getByRole("region", { name: "Responses by category" });
  await expect(table.locator("[data-feedback-row]")).toHaveCount(5);
  await expect(table.locator('[data-feedback-row="strength"]')).toContainText("What worked well");
  await expect(table.getByText(/E2E teacher/)).toHaveCount(0);
  for (const word of [/\bscore/i, /\brank/i, /%/]) await expect(page.getByText(word)).toHaveCount(0);
});

test("owner and teacher: no responses page", async ({ page }) => {
  await signIn(page, "owner");
  await expect(page.getByRole("link", { name: "Responses to findings" })).toHaveCount(0);
  await page.goto("/admin/feedback");
  await expect(page).toHaveURL(/\/lectures$/);
});

test("teacher: a 'New results' mark, cleared with Mark as seen", async ({ page }) => {
  await signIn(page, "teacher");
  let seen = 0;
  // The fixture lectures have no unseen results, so the list answer is adjusted in the browser.
  await page.route("**/api/lectures?**", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { items: { lecture_id: string; has_unseen_results: boolean }[] };
    for (const i of body.items) if (i.lecture_id === LECTURE_ID) i.has_unseen_results = seen === 0;
    await route.fulfill({ response: res, json: body });
  });
  await page.route(`**/api/lectures/${LECTURE_ID}/seen`, async (route) => {
    seen += 1;
    await route.fulfill({ json: { lecture_id: LECTURE_ID, has_unseen_results: false, seen_at: "2026-10-21T21:00:00Z" } });
  });
  await page.goto("/lectures");
  const row = page.getByRole("listitem").filter({ has: page.locator(`a[href="/lectures/${LECTURE_ID}"]`) });
  await expect(row.getByText("New results")).toBeVisible();
  await row.getByRole("button", { name: "Mark as seen" }).click();
  await expect(row.getByText("New results")).toHaveCount(0);
  expect(seen).toBe(1);
});
