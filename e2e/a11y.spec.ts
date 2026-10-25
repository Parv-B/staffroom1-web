import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { LECTURE_ID, signIn, type E2ERole } from "./helpers";

// WCAG 2.1 A/AA checks with axe on every screen, per role. Failures report the rule and the
// element's selector only (never its text, which may be transcript content).
const L = `/lectures/${LECTURE_ID}`;
const TEACHER_ID = "a3142824-4e16-484c-a420-371d4eaa5329";
const SCREENS: Record<E2ERole, string[]> = {
  teacher: ["/lectures", "/lectures/new", "/progress", "/account/password", `${L}/analysis/overview`, `${L}/analysis/findings`, `${L}/analysis/structure`, `${L}/analysis/coverage`, `${L}/analysis/metrics`, `${L}/transcript`, `${L}/notes`, `${L}/status`, `${L}/edit`],
  owner: ["/lectures", "/lectures/lec_0e241370fa72a0ea/analysis/overview", "/centre", "/centre?group=subject&bucket=month", `/progress?teacher=${TEACHER_ID}`, `${L}/analysis/overview`, `${L}/notes`, `${L}/status`],
  admin: ["/lectures", "/lectures/new", "/centre", "/centre?group=grade", "/admin/users", "/admin/feedback", `${L}/analysis/findings`, `${L}/transcript`],
};

async function audit(page: Page, where: string): Promise<string[]> {
  // Wait for the screen to settle: no "Loading" text left.
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByText(/^Loading/)).toHaveCount(0, { timeout: 15_000 });
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations.flatMap((v) => v.nodes.map((n) => `${where}: ${v.id} at ${n.target.join(" ")}`));
}

test("signed out: sign-in has no WCAG A/AA violations", async ({ page }) => {
  await page.goto("/sign-in");
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

for (const role of ["teacher", "owner", "admin"] as const) {
  test(`${role}: every screen passes axe (WCAG 2.1 A/AA)`, async ({ page }) => {
    test.setTimeout(180_000);
    await signIn(page, role);
    const problems: string[] = [];
    for (const path of SCREENS[role]) {
      await page.goto(path);
      problems.push(...(await audit(page, path)));
    }
    expect(problems).toEqual([]);
  });
}

test("keyboard: skip link, then the notes editor's transcript panel without a mouse", async ({ page }) => {
  await signIn(page, "teacher");
  await page.goto("/lectures");
  await expect(page.getByRole("heading", { name: "Your lectures" })).toBeVisible();
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();

  await page.goto(`${L}/notes`);
  await page.getByRole("button", { name: "Edit notes" }).focus();
  await page.keyboard.press("Enter");
  const choose = page.getByRole("button", { name: "Choose lines for bullet 1 of section 1", exact: true });
  await choose.focus();
  await page.keyboard.press("Enter");
  const panel = page.locator("[data-citation-panel]");
  await expect(panel.getByText(/Choosing lines for bullet 1 of section 1/)).toBeVisible();
  const box = panel.getByRole("checkbox").first();
  await box.focus();
  await expect(box).toBeFocused();
  const before = await box.isChecked();
  await page.keyboard.press("Space");
  await expect(box).toBeChecked({ checked: !before });
  // Leave without saving: discard through the keyboard too.
  await page.getByRole("button", { name: "Discard changes" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.keyboard.press("Tab");
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard changes" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Edit notes" })).toBeVisible();
});

test("editors and dialogs pass axe too", async ({ page }) => {
  test.setTimeout(120_000);
  const problems: string[] = [];
  await signIn(page, "teacher");
  await page.goto(`${L}/notes`);
  await page.getByRole("button", { name: "Edit notes" }).click();
  await page.getByRole("button", { name: "Choose lines for bullet 1 of section 1", exact: true }).click();
  problems.push(...(await audit(page, "notes editor")));
  await page.getByRole("button", { name: "Stop editing" }).click();

  await page.getByRole("button", { name: /account menu$/ }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await signIn(page, "admin");
  await page.goto("/admin/users");
  await page.getByRole("button", { name: "Add a user" }).click();
  problems.push(...(await audit(page, "add user")));
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Change E2E teacher" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  problems.push(...(await audit(page, "change user dialog")));
  expect(problems).toEqual([]);
});
