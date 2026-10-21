import { expect, test } from "@playwright/test";
import { API_URL, apiToken, signIn } from "./helpers";

test("owner: centre summary lists teachers alphabetically, with N/A, low confidence and unchecked categories labelled", async ({ page }) => {
  await signIn(page, "owner");
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Centre" }).click();
  await expect(page.getByRole("heading", { name: "Centre summary" })).toBeVisible();
  const lectures = page.getByRole("region", { name: "Lectures by teacher" });
  await expect(lectures.getByRole("rowheader").first()).toHaveText("Whole centre");
  await expect(lectures.getByRole("rowheader", { name: /E2E teacher/ })).toBeVisible();
  // Content accuracy was not checked for any of the centre's lectures: never a zero.
  const findings = page.getByRole("region", { name: "Findings by teacher" });
  await expect(findings.getByText("Not checked in any lecture yet").first()).toBeVisible();
  // Wait time is low confidence in the fixture lectures.
  await page.getByRole("radio", { name: "Wait time after a question (median)" }).click({ force: true });
  await expect(page).toHaveURL(/metric=wait_time_median_s/);
  await expect(page.getByRole("region", { name: /Wait time after a question/ }).getByText(/low confidence/).first()).toBeVisible();
  for (const word of [/\brank/i, /\bscore/i, /best|worst/i]) await expect(page.getByText(word)).toHaveCount(0);

  // A reversed period is explained, not an error page.
  await page.goto("/centre?from=2026-10-30&to=2026-10-01");
  await expect(page.getByRole("alert")).toHaveText(/start date is after the end date/);
});

test("teacher: has no centre or users pages", async ({ page }) => {
  await signIn(page, "teacher");
  await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Centre" })).toHaveCount(0);
  await page.goto("/centre");
  await expect(page).toHaveURL(/\/lectures$/);
  await page.goto("/admin/users");
  await expect(page).toHaveURL(/\/lectures$/);
});

test.describe("admin: user management", () => {
  const email = `e2e-managed-${Date.now().toString(36)}@staffroom1-e2e.com`;
  const first = `Ab3-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  const second = `Cd4-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;

  test.afterAll(async ({ request }) => {
    // Accounts can't be deleted; leave the test account deactivated.
    const token = await apiToken(request, "admin");
    const headers = { Authorization: `Bearer ${token}` };
    const users = (await (await request.get(`${API_URL}/users`, { headers })).json()) as { id: string; email: string; active: boolean }[];
    const u = users.find((x) => x.email === email);
    if (u?.active) await request.patch(`${API_URL}/users/${u.id}`, { headers, data: { active: false } });
  });

  test("creates a user, changes the role, resets the password, deactivates, and sees 409 last_admin", async ({ page, request }) => {
    await signIn(page, "admin");
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Users" }).click();
    await page.getByRole("button", { name: "Add a user" }).click();
    await page.getByRole("textbox", { name: "Name" }).fill("E2E managed teacher");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByLabel("First password").fill("short");
    await page.getByRole("button", { name: "Add user" }).click();
    await expect(page.getByText("Use at least 10 characters.")).toBeVisible();
    await page.getByLabel("First password").fill(first);
    await page.getByRole("button", { name: "Add user" }).click();
    await expect(page.getByRole("status")).toContainText("E2E managed teacher was added as teacher");
    const row = page.locator(`[data-user-row="${email}"]`);
    await expect(row).toContainText("Teacher");

    // The same email again is refused on the email field.
    await page.getByRole("button", { name: "Add a user" }).click();
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByLabel("First password").fill(first);
    await page.getByRole("button", { name: "Add user" }).click();
    await expect(page.getByText("This email already has a Staffroom1 account.")).toBeVisible();
    await page.getByRole("button", { name: "Cancel" }).click();

    // Role change.
    await row.getByRole("button", { name: "Change E2E managed teacher" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("radio", { name: /Centre owner/ }).click({ force: true });
    await dialog.getByRole("button", { name: "Save name and role" }).click();
    await expect(page.getByRole("status")).toContainText("details were saved");
    await expect(row).toContainText("Centre owner");

    // Password reset: the new password works, the old one doesn't.
    await row.getByRole("button", { name: "Change E2E managed teacher" }).click();
    await dialog.getByLabel("New password").fill(second);
    await dialog.getByRole("button", { name: "Set password" }).click();
    await expect(page.getByRole("status")).toContainText("new password is set");
    expect((await request.post(`${API_URL}/auth/login`, { data: { email, password: second } })).ok()).toBe(true);
    expect((await request.post(`${API_URL}/auth/login`, { data: { email, password: first } })).status()).toBe(401);

    // Deactivate, with a confirmation step.
    await row.getByRole("button", { name: "Change E2E managed teacher" }).click();
    await dialog.getByRole("button", { name: "Deactivate E2E managed teacher" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Deactivate" }).click();
    await expect(page.getByRole("status")).toContainText("was deactivated");
    await expect(page.getByRole("region", { name: "Deactivated users" }).locator(`[data-user-row="${email}"]`)).toBeVisible();

    // The last active admin can't demote themself: the API's 409 last_admin is explained.
    const token = await apiToken(request, "admin");
    const users = (await (await request.get(`${API_URL}/users`, { headers: { Authorization: `Bearer ${token}` } })).json()) as { role: string; active: boolean }[];
    test.skip(users.filter((u) => u.role === "admin" && u.active).length !== 1, "only safe while the E2E admin is the only admin");
    await page.getByRole("button", { name: /^Change E2E admin/ }).click();
    await dialog.getByRole("radio", { name: /^Teacher/ }).click({ force: true });
    await dialog.getByRole("button", { name: "Save name and role" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /Change my role/ }).click();
    await expect(dialog.getByRole("alert")).toHaveText(/at least one active admin/);
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(page.locator('[data-user-row^="admin@"]')).toContainText("Admin");
  });
});
