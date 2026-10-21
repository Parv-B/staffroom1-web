import { expect, test } from "@playwright/test";
import { API_URL, LECTURE_ID, apiToken, signIn } from "./helpers";

// A real edit would reprocess the fixture lecture (and change its findings), so the PATCH is
// answered in the browser. The real endpoint is checked with an edit that changes nothing.
const L = `/lectures/${LECTURE_ID}`;

test("teacher: edits objectives, is told what reruns, and only the changed field is sent", async ({ page }) => {
  await signIn(page, "teacher");
  const sent: unknown[] = [];
  await page.route(`**/api${L}/metadata`, async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({
      json: { lecture_id: LECTURE_ID, status: "queued", metadata: {}, changed_fields: ["objectives"], affected_stages: ["coverage", "report"], rerun_from: "coverage", job_queued: true },
    });
  });
  await page.goto(`${L}/analysis/overview`);
  await page.getByRole("link", { name: "Edit details" }).click();
  await expect(page.getByRole("heading", { name: "Edit the lecture's details" })).toBeVisible();
  await expect(page.getByLabel("Chapter")).toHaveValue("Surface Areas and Volumes");
  await expect(page.locator("aside").getByText(/Nothing has changed yet/)).toBeVisible();

  await page.getByLabel("Learning objectives, one per line").fill("Find the surface area of a combination of solids");
  await expect(page.locator("aside [data-edit-effects]")).toContainText("the coverage of objectives");
  await expect(page.locator("aside [data-edit-effects]")).not.toContainText("findings and the notes");
  await page.getByRole("button", { name: "Save details" }).click();
  const dialog = page.getByRole("alertdialog", { name: /process the lecture again/ });
  await expect(dialog).toContainText("coverage of objectives");
  await dialog.getByRole("button", { name: "Save and process again" }).click();
  await expect(page).toHaveURL(/\/status\?edited=/);
  await expect(page.getByRole("status").filter({ hasText: "Details saved" })).toContainText("coverage of objectives, the report");
  expect(sent).toEqual([{ retranscribe: false, objectives: ["Find the surface area of a combination of solids"] }]);
});

test("teacher: an edit while processing is refused with a plain message", async ({ page }) => {
  await signIn(page, "teacher");
  await page.route(`**/api${L}/metadata`, (route) => route.fulfill({ status: 409, json: { error: { code: "already_queued", message: "x" } } }));
  await page.goto(`${L}/edit`);
  await page.getByLabel("Chapter").fill("Surface Areas and Volumes (part 2)");
  await expect(page.locator("aside [data-edit-effects]")).toContainText("the lesson's structure");
  await page.getByRole("button", { name: "Save details" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Save and process again" }).click();
  await expect(page.getByRole("alert")).toContainText("already being processed");
});

test("owner: has no edit control", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(`${L}/analysis/overview`);
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Edit details" })).toHaveCount(0);
  await page.goto(`${L}/edit`);
  await expect(page.getByText("Only the lecture's teacher and the centre's admins can change its details.")).toBeVisible();
});

test("API: an edit that changes nothing queues nothing", async ({ request }) => {
  const token = await apiToken(request, "teacher");
  const res = await request.patch(`${API_URL}${L}/metadata`, { headers: { Authorization: `Bearer ${token}` }, data: { chapter: "Surface Areas and Volumes" } });
  expect(res.ok()).toBe(true);
  expect(((await res.json()) as { job_queued: boolean }).job_queued).toBe(false);
});
