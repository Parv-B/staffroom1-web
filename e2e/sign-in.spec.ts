import { expect, test } from "@playwright/test";
import { LECTURE_ID, credentials, signIn, type E2ERole } from "./helpers";

test("an unknown account gets the one neutral message", async ({ page }) => {
  // An address that doesn't exist, so no real account moves towards its lockout limit.
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill("nobody@staffroom1-e2e.com");
  await page.getByLabel("Password").fill("not-a-real-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("That email and password don't match an active account. Check both and try again.");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("signed-out visitors are sent to sign-in and back afterwards", async ({ page }) => {
  await page.goto("/lectures?status=done");
  await expect(page).toHaveURL(/\/sign-in\?redirect=/);
  const { email, password } = credentials("teacher");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/lectures\?status=done$/);
});

const expectations: Record<E2ERole, { heading: string; teacherFilter: boolean; roleLabel: string }> = {
  teacher: { heading: "Your lectures", teacherFilter: false, roleLabel: "Teacher" },
  owner: { heading: "Lectures", teacherFilter: true, roleLabel: "Centre owner" },
  admin: { heading: "Lectures", teacherFilter: true, roleLabel: "Admin" },
};

for (const role of ["teacher", "owner", "admin"] as const) {
  test(`${role}: signs in, sees the scoped list, signs out`, async ({ page }) => {
    await signIn(page, role);
    const e = expectations[role];
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(e.heading);
    await expect(page.getByRole("button", { name: /^Account/ })).toContainText(e.roleLabel);
    await expect(page.getByText("Teacher", { exact: true }).locator("xpath=..").getByRole("button")).toHaveCount(e.teacherFilter ? 1 : 0);

    const link = page.locator(`a[href="/lectures/${LECTURE_ID}"]`);
    const row = page.getByRole("listitem").filter({ has: link });
    await expect(row).toBeVisible();
    // Credibility in the list: a low-confidence measure is badged with its reason.
    await expect(row.getByText("Low confidence").first()).toBeVisible();
    // The list can't tell per lecture which categories were released (FRONTEND_REQUESTS.md #2),
    // so it must not claim "none" for any of them.
    await expect(row.getByText("Other categories: open the analysis")).toBeVisible();
    await expect(row.getByText("none", { exact: true })).toHaveCount(0);
    await expect(link).toHaveText("Surface Areas and Volumes");

    await page.getByRole("button", { name: /^Account/ }).click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/sign-in/);
    await page.goto("/lectures");
    await expect(page).toHaveURL(/\/sign-in/);
  });
}

test("change password rejects a wrong current password without changing anything", async ({ page }) => {
  await signIn(page, "teacher");
  await page.goto("/account/password");
  await page.getByLabel("Current password").fill("definitely-not-current");
  await page.getByLabel("New password", { exact: true }).fill("a-new-password-123");
  await page.getByLabel("New password again").fill("a-new-password-123");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText("Your current password isn't right. Check it and try again.")).toBeVisible();
});

test("a lecture opened in a new tab stays signed in, and signing out ends every tab", async ({ page, context }) => {
  await signIn(page, "teacher");
  const [tab] = await Promise.all([context.waitForEvent("page"), page.locator(`a[href="/lectures/${LECTURE_ID}"]`).click({ modifiers: ["Control"] })]);
  await expect(tab).toHaveURL(new RegExp(`/lectures/${LECTURE_ID}/analysis/overview$`));
  await expect(tab.getByRole("heading", { name: "Summary" })).toBeVisible();

  await page.getByRole("button", { name: /^Account/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in/);
  await tab.reload();
  await expect(tab).toHaveURL(/\/sign-in/);
});
