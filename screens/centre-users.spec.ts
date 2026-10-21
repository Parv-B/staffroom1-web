import { test } from "@playwright/test";
import { TABLET_PORTRAIT, shot, signInWithToken } from "./shot";
import { syntheticSummary } from "./synthetic";

test("centre: owner, real data", async ({ page, request }) => {
  await signInWithToken(page, request, "owner");
  await page.goto("/centre");
  await page.getByRole("heading", { name: "Measures" }).waitFor();
  await shot(page, "centre-owner");
});

test("centre: admin, a measure with missing and low-confidence values", async ({ page, request }) => {
  await signInWithToken(page, request, "admin");
  await page.goto("/centre?metric=wait_time_median_s");
  await page.getByRole("heading", { name: "Measures" }).waitFor();
  await shot(page, "centre-admin");
});

test("centre: owner, synthetic centre with several teachers (layout review only)", async ({ page, request }) => {
  await signInWithToken(page, request, "owner");
  await page.route("**/api/org/summary**", (route) => route.fulfill({ json: syntheticSummary() }));
  await page.goto("/centre?metric=wait_time_median_s");
  await page.getByRole("heading", { name: "Measures" }).waitFor();
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
