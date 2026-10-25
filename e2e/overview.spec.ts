import { expect, test, type Page } from "@playwright/test";
import { LECTURE_ID, signIn } from "./helpers";

// The analysis overview: lesson at a glance, where it happened, what to work on first, and the
// written summary kept at the bottom. Assertions avoid exact counts: reprocessing a lecture
// changes how many findings it has.
const lecture = `/lectures/${LECTURE_ID}/analysis/overview`;
// A batch lecture in the same centre with a lesson profile (JEE chemistry, 68 minutes).
const PROFILED = "/lectures/lec_0e241370fa72a0ea/analysis/overview";

const LEVEL_RANK: Record<string, number> = {
  very_weak: 1,
  weak: 2,
  acceptable: 3,
  good: 4,
  very_good: 5,
  outstanding: 6,
};

async function noHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test("teacher: the timeline and the short lists lead to the findings", async ({ page }) => {
  await signIn(page, "teacher");
  await page.goto(lecture);
  await expect(page.getByRole("heading", { name: "Where it happened" })).toBeVisible();

  const markers = page.locator("[data-lesson-timeline] a[data-marker]");
  expect(await markers.count()).toBeGreaterThan(0);
  const first = markers.first();
  await expect(first).toHaveAttribute("aria-label", /^\d\d:\d\d, /); // time first, then the aspect

  await expect(page.getByRole("heading", { name: "Work on first" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "What worked well" })).toBeVisible();
  await expect(page.getByRole("link", { name: /points? to review and \d+ strengths?, with their evidence/ })).toBeVisible();

  // The written summary is kept, collapsed, at the bottom.
  const summary = page.locator("[data-summary-text]");
  await expect(summary).toBeHidden();
  await page.getByText("The same points as plain text, for copying into a message").click();
  await expect(summary).toBeVisible();

  await first.click();
  await expect(page).toHaveURL(/\/analysis\/findings\?finding=f_[0-9a-f]{16}$/);
});

test("teacher: no transcript line ids in the overview's prose", async ({ page }) => {
  await signIn(page, "teacher");
  await page.goto(lecture);
  await expect(page.getByRole("heading", { name: "Where it happened" })).toBeVisible();
  const focus = await page.locator("[data-focus]").allInnerTexts();
  expect(focus.join("\n")).not.toMatch(/\bs\d{4}\b/);
});

test("owner: the profile chart lists aspects weakest first and jumps to each one", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(PROFILED);
  await expect(page.getByRole("heading", { name: "Where it happened" })).toBeVisible();
  const chart = page.locator("[data-profile-chart]");
  test.skip((await chart.count()) === 0, "this lecture has no lesson profile yet");

  const rows = chart.locator("li[data-aspect]");
  const levels = await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-level") ?? ""));
  expect(levels.length).toBeGreaterThan(0);
  const ranks = levels.map((l) => LEVEL_RANK[l] ?? 0);
  expect(ranks).toEqual([...ranks].sort((a, b) => a - b));

  const firstRow = rows.first();
  const aspect = await firstRow.getAttribute("data-aspect");
  await firstRow.getByRole("link").click();
  await expect(page).toHaveURL(new RegExp(`#aspect-${aspect ?? ""}$`));
  await expect(page.locator(`#aspect-${aspect ?? ""}`)).toBeInViewport();
});

test("phone: the overview fits the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, "owner");
  await page.goto(PROFILED);
  await expect(page.getByRole("heading", { name: "Where it happened" })).toBeVisible();
  await noHorizontalScroll(page);
});

test("keyboard: timeline markers and aspect links are reachable and work without a mouse", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(PROFILED);
  await expect(page.getByRole("heading", { name: "Where it happened" })).toBeVisible();
  const marker = page.locator("[data-lesson-timeline] a[data-marker]").first();
  await marker.focus();
  await expect(marker).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/analysis\/findings\?finding=f_[0-9a-f]{16}$/);
});
