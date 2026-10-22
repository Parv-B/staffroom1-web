import { expect, test, type Page } from "@playwright/test";
import { LECTURE_ID, setShared, signIn } from "./helpers";

const lecture = `/lectures/${LECTURE_ID}`;
const tab = (page: Page, name: string) => page.getByRole("navigation", { name: "Lecture" }).getByRole("link", { name, exact: true });
const STRENGTH = "f_6d29a3d6fb6f5dde"; // the 09:14 strength in the fixture lecture

test.describe.configure({ mode: "serial" });

test.afterAll(async ({ request }) => {
  // The owner test turns sharing off; whatever happened, leave the lecture shared.
  await setShared(request, true);
});

test("teacher: reads the analysis, jumps to the transcript and plays the evidence", async ({ page }) => {
  await signIn(page, "teacher");
  await page.goto(lecture);
  await expect(page).toHaveURL(new RegExp(`${lecture}/analysis/overview$`));
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Shared with the centre owner" })).toBeVisible();
  await expect(page.getByText(/Not checked for this lesson/).first()).toBeVisible();

  await tab(page, "Findings").click();
  const entry = page.locator(`#finding-${STRENGTH}`);
  await expect(entry.locator("blockquote")).toBeVisible(); // the verbatim evidence quote
  await expect(entry.getByText("Your view")).toBeVisible(); // private feedback controls

  await entry.getByRole("button", { name: "Play from 09:14" }).click();
  await expect.poll(() => page.evaluate(() => document.querySelector("audio")?.currentTime ?? 0), { timeout: 15_000 }).toBeGreaterThan(554);

  await entry.getByRole("link", { name: "Read in transcript" }).click();
  await expect(page).toHaveURL(/\/transcript\?t=554690&finding=f_6d29a3d6fb6f5dde$/);
  await expect(page.locator("#seg-s0026")).toBeInViewport();
  await expect(page.getByText("[student]").first()).toBeVisible();

  const original = page.getByRole("radio", { name: "Original, with names" });
  await original.click({ force: true });
  await expect(original).toBeChecked();
  await expect(page.getByText(/This is the original transcript/)).toBeVisible();

  await tab(page, "Processing").click();
  await expect(page.locator("[data-stage]")).toHaveCount(12);
  await expect(page.getByRole("button", { name: "Process again" })).toBeVisible();
});

test("owner: reads a shared analysis without teacher-only controls, then sees the calm not-shared state", async ({ page, request }) => {
  await signIn(page, "owner");
  await page.goto(`${lecture}/analysis/findings`);
  await expect(page.locator(`#finding-${STRENGTH}`).locator("blockquote")).toBeVisible();
  await expect(page.getByText("Your view")).toHaveCount(0);
  await expect(page.getByRole("switch")).toHaveCount(0);
  await tab(page, "Transcript").click();
  await expect(page.getByText("Teacher", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("radio", { name: "Original, with names" })).toHaveCount(0);
  await tab(page, "Processing").click();
  await expect(page.getByRole("button", { name: "Process again" })).toHaveCount(0);

  await setShared(request, false);
  try {
    await page.goto(`${lecture}/analysis/findings`);
    await expect(page.getByRole("heading", { name: "The teacher hasn't shared this analysis" })).toBeVisible();
    await expect(page.getByText("Not shared by the teacher")).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0); // a state, not an error
    await page.goto(`${lecture}/transcript`);
    await expect(page.getByRole("heading", { name: "The teacher hasn't shared this analysis" })).toBeVisible();
  } finally {
    await setShared(request, true);
  }
});

test("admin: reads everything, sees the teacher's responses read-only and can open the original transcript", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto(`${lecture}/analysis/findings`);
  const entry = page.locator(`#finding-${STRENGTH}`);
  await expect(entry.locator("blockquote")).toBeVisible(); // the verbatim evidence quote
  await expect(entry.getByText(/Teacher's response|The teacher hasn't responded/)).toBeVisible();
  await expect(page.getByText("Your view")).toHaveCount(0);
  await page.goto(`${lecture}/analysis/coverage`);
  await expect(page.locator("[data-summary-counts]")).toBeVisible();
  await page.goto(`${lecture}/transcript`);
  await expect(page.getByRole("radio", { name: "Original, with names" })).toHaveCount(1);
});
