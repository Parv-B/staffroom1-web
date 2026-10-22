import { expect, test } from "@playwright/test";
import { LECTURE_ID, signIn } from "./helpers";

test("teacher: sees their own measures per lecture, with low confidence and its reason", async ({ page }) => {
  await signIn(page, "teacher");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Your measures" }).click();
  await expect(page.getByRole("heading", { name: "Your measures over time" })).toBeVisible();
  const table = page.getByRole("region", { name: "Measures by lecture" });
  await expect(table.locator(`a[href="/lectures/${LECTURE_ID}"]`)).toBeVisible();
  await expect(table.getByText("Low confidence").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notes on the values" })).toBeVisible();
  for (const word of [/\bscore/i, /\brank/i, /improv/i, /\bbetter than\b/i, /average/i]) await expect(page.getByText(word)).toHaveCount(0);
  await expect(page.getByLabel("Teacher", { exact: true })).toHaveCount(0); // no picker for teachers
});

test("teacher: one line chart per measure, keyboard-reachable points, the table below", async ({ page }) => {
  await signIn(page, "teacher");
  await page.goto("/progress");
  const charts = page.locator("[data-trend]");
  await expect(charts).toHaveCount(8);
  await expect(page.getByText(/Vertical axis: 0 to 100%, from zero/).first()).toBeVisible();
  // Wait time is low confidence in the fixture lectures: hollow markers, reason on focus.
  const wait = page.locator('[data-trend="wait_time_median_s"]');
  const low = wait.locator('[data-point-state="low-confidence"]').first();
  await expect(low).toBeVisible();
  await low.focus();
  await expect(wait.locator("[data-trend-tooltip]")).toContainText("Low confidence:");
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-trend-tooltip]")).toHaveCount(1);
  // The exact-values table is still there, after the charts.
  await expect(page.getByRole("heading", { name: "Exact values" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Measures by lecture" })).toBeVisible();
  for (const word of [/forecast/i, /\btrend\b/i, /\bgoal\b/i]) await expect(page.getByText(word)).toHaveCount(0);
});

test("owner: picks a teacher and sees the same per-lecture values", async ({ page }) => {
  await signIn(page, "owner");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Measures over time" }).click();
  await expect(page.getByText("Choose a teacher to see their measures.")).toBeVisible();
  await page.getByRole("button", { name: /Teacher/ }).click();
  await page.getByRole("option", { name: "E2E teacher" }).click();
  await expect(page).toHaveURL(/teacher=/);
  await expect(page.getByRole("heading", { name: "E2E teacher: measures over time" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Measures by lecture" }).locator(`a[href="/lectures/${LECTURE_ID}"]`)).toBeVisible();
});
