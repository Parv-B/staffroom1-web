import { expect, test } from "@playwright/test";
import { LECTURE_ID } from "../e2e/helpers";
import { TABLET_PORTRAIT, shot, signInWithToken } from "./shot";

const L = `/lectures/${LECTURE_ID}`;
const ROLES = ["teacher", "owner", "admin"] as const;

test("sign-in", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: "Sign in" }).waitFor();
  await shot(page, "sign-in", { fullPage: false });
});

for (const role of ROLES) {
  test(`lectures list: ${role}`, async ({ page, request }) => {
    await signInWithToken(page, request, role);
    await page.goto("/lectures");
    await page.locator(`a[href="${L}"]`).waitFor();
    await shot(page, `lectures-${role}`);
    if (role === "teacher") {
      await page.setViewportSize(TABLET_PORTRAIT);
      await shot(page, "lectures-teacher-portrait", { fullPage: false });
    }
  });

  test(`analysis: ${role}`, async ({ page, request }) => {
    await signInWithToken(page, request, role);
    for (const tab of role === "teacher" ? ["overview", "findings", "structure", "coverage", "metrics"] : ["overview", "findings"]) {
      await page.goto(`${L}/analysis/${tab}`);
      await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 15_000 });
      await shot(page, `analysis-${tab}-${role}`, { fullPage: false });
    }
  });

  test(`transcript and status: ${role}`, async ({ page, request }) => {
    await signInWithToken(page, request, role);
    await page.goto(`${L}/transcript?t=554690`);
    await page.locator("#seg-s0026").waitFor();
    await shot(page, `transcript-${role}`, { fullPage: false });
    if (role === "teacher") {
      await page.setViewportSize(TABLET_PORTRAIT);
      await shot(page, "transcript-teacher-portrait", { fullPage: false });
      await page.setViewportSize({ width: 1180, height: 820 });
    }
    await page.goto(`${L}/status`);
    await page.locator("[data-stage]").first().waitFor();
    await shot(page, `status-${role}`);
  });
}

test("account: change password", async ({ page, request }) => {
  await signInWithToken(page, request, "teacher");
  await page.goto("/account/password");
  await page.getByRole("heading").first().waitFor();
  await shot(page, "password-teacher", { fullPage: false });
});

test("states: empty list, failed load, unknown lecture", async ({ page, request }) => {
  await signInWithToken(page, request, "teacher");
  await page.route("**/api/lectures?**", (route) => route.fulfill({ json: { items: [], total: 0, limit: 20, offset: 0 } }));
  await page.goto("/lectures");
  await page.getByRole("heading", { name: "Your lectures" }).waitFor();
  await expect(page.getByText(/^Loading/)).toHaveCount(0);
  await shot(page, "state-lectures-empty-teacher", { fullPage: false });
  await page.unroute("**/api/lectures?**");

  await page.route(`**/api${L}/analysis`, (route) => route.fulfill({ status: 500, json: { error: { code: "internal_error", message: "" } } }));
  await page.goto(`${L}/analysis/overview`);
  await page.getByRole("alert").waitFor();
  await shot(page, "state-analysis-error-teacher", { fullPage: false });

  await page.goto("/lectures/lec_0000000000000000");
  await page.getByText(/doesn't exist, or it isn't one you can see/).waitFor();
  await shot(page, "state-lecture-not-found-teacher", { fullPage: false });
});
