import { test } from "@playwright/test";
import { TABLET_PORTRAIT, shot, signInWithToken } from "./shot";
import { syntheticSummary, syntheticTrend } from "./synthetic";

test("centre: owner, real data", async ({ page, request }) => {
  await signInWithToken(page, request, "owner");
  await page.goto("/centre");
  await page.getByRole("heading", { name: "Measures", exact: true }).waitFor();
  await shot(page, "centre-owner");
});

test("centre: admin, a measure with missing and low-confidence values", async ({ page, request }) => {
  await signInWithToken(page, request, "admin");
  await page.goto("/centre?metric=wait_time_median_s");
  await page.getByRole("heading", { name: "Measures", exact: true }).waitFor();
  await shot(page, "centre-admin");
});

test("centre: owner, real data grouped by subject, by month", async ({ page, request }) => {
  await signInWithToken(page, request, "owner");
  await page.goto("/centre?group=subject&bucket=month");
  await page.getByRole("heading", { name: "Measures over time" }).waitFor();
  await page.locator("[data-centre-trend]").first().waitFor();
  await shot(page, "centre-owner-by-subject");
});

test("centre: owner, real data grouped by grade", async ({ page, request }) => {
  await signInWithToken(page, request, "owner");
  await page.goto("/centre?group=grade");
  await page.locator("[data-centre-trend]").first().waitFor();
  await shot(page, "centre-owner-by-grade");
});

function mockCentre(page: import("@playwright/test").Page) {
  return Promise.all([
    page.route("**/api/org/summary**", (route) => {
      const g = new URL(route.request().url()).searchParams.get("group_by");
      return route.fulfill({ json: syntheticSummary(g === "subject" || g === "grade" ? g : "teacher") });
    }),
    page.route("**/api/org/trend**", (route) => route.fulfill({ json: syntheticTrend(new URL(route.request().url()).searchParams.get("bucket") === "month" ? "month" : "week") })),
  ]);
}

test("centre: owner, synthetic weeks with gaps, few-lecture weeks and low confidence (layout review only)", async ({ page, request }) => {
  await signInWithToken(page, request, "owner");
  await mockCentre(page);
  await page.goto("/centre?metric=wait_time_median_s#h-over-time");
  await page.locator("[data-centre-trend]").first().waitFor();
  const wait = page.locator('[data-centre-trend="wait_time_median_s"]');
  await wait.scrollIntoViewIfNeeded();
  await wait.locator('[data-bucket-state="value"][data-few]').first().focus();
  await shot(page, "centre-over-time-synthetic-tooltip", { fullPage: false });
  await page.setViewportSize(TABLET_PORTRAIT);
  await page.goto("/centre?group=subject");
  await page.locator("[data-centre-trend]").first().waitFor();
  await shot(page, "centre-over-time-synthetic-portrait");
});

test("centre: owner, synthetic centre with several teachers (layout review only)", async ({ page, request }) => {
  await signInWithToken(page, request, "owner");
  await mockCentre(page);
  await page.goto("/centre?metric=wait_time_median_s");
  await page.getByRole("heading", { name: "Measures", exact: true }).waitFor();
  await shot(page, "centre-owner-synthetic");
  await page.setViewportSize(TABLET_PORTRAIT);
  await shot(page, "centre-owner-synthetic-portrait", { fullPage: false });
});

test("users: admin", async ({ page, request }) => {
  await signInWithToken(page, request, "admin");
  await page.goto("/admin/users");
  await page.getByRole("region", { name: "Active users" }).waitFor();
  await shot(page, "users-admin");
  await page.getByRole("button", { name: "Add a user" }).click();
  await shot(page, "users-admin-add", { fullPage: false });
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Change E2E teacher" }).click();
  await page.getByRole("dialog").waitFor();
  await shot(page, "users-admin-change", { fullPage: false });
});
