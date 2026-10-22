import { test } from "@playwright/test";
import { TABLET_PORTRAIT, shot, signInWithToken } from "./shot";
import { syntheticLectures } from "./synthetic";

const TEACHER = "a3142824-4e16-484c-a420-371d4eaa5329"; // E2E teacher

test("progress: teacher", async ({ page, request }) => {
  await signInWithToken(page, request, "teacher");
  await page.goto("/progress");
  await page.getByRole("region", { name: "Measures by lecture" }).waitFor();
  await shot(page, "progress-teacher");
  await page.setViewportSize(TABLET_PORTRAIT);
  await shot(page, "progress-teacher-portrait", { fullPage: false });
});

test("progress: owner, one teacher", async ({ page, request }) => {
  await signInWithToken(page, request, "owner");
  await page.goto(`/progress?teacher=${TEACHER}`);
  await page.getByRole("region", { name: "Measures by lecture" }).waitFor();
  await shot(page, "progress-owner");
});

test("progress: admin, no teacher chosen", async ({ page, request }) => {
  await signInWithToken(page, request, "admin");
  await page.goto("/progress");
  await page.getByText("Choose a teacher to see their measures.").waitFor();
  await shot(page, "progress-admin-empty", { fullPage: false });
});

test("progress: teacher, synthetic 9 lectures with N/A and low confidence (layout review only)", async ({ page, request }) => {
  await signInWithToken(page, request, "teacher");
  await page.route("**/api/lectures?**", (route) => route.fulfill({ json: syntheticLectures(TEACHER) }));
  await page.goto("/progress");
  await page.locator("[data-trend]").first().waitFor();
  await shot(page, "progress-teacher-synthetic");
  // Keyboard focus on a low-confidence point shows its reason.
  await page.locator('[data-trend="wait_time_median_s"] [data-point-state="low-confidence"]').first().focus();
  await page.locator('[data-trend="wait_time_median_s"]').scrollIntoViewIfNeeded();
  await shot(page, "progress-teacher-synthetic-focus", { fullPage: false });
  await page.setViewportSize(TABLET_PORTRAIT);
  await page.locator("[data-trend]").first().scrollIntoViewIfNeeded();
  await shot(page, "progress-teacher-synthetic-portrait", { fullPage: false });
});
