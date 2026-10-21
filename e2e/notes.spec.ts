import { expect, test, type APIRequestContext } from "@playwright/test";
import { API_URL, LECTURE_ID, apiToken, signIn } from "./helpers";

// Edits the fixture lecture's approved notes and puts them back exactly as they were (content
// re-saved and re-approved) whatever happens.
const notesUrl = `/lectures/${LECTURE_ID}/notes`;
type Notes = { sections: { heading: string; bullets: { text: string; segment_ids: string[] }[] }[]; status: string };
let original: Notes | null = null;

async function teacherApi(request: APIRequestContext) {
  const token = await apiToken(request, "teacher");
  return { Authorization: `Bearer ${token}` };
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ request }) => {
  const res = await request.get(`${API_URL}${notesUrl}`, { headers: await teacherApi(request) });
  expect(res.ok()).toBe(true);
  original = (await res.json()) as Notes;
});

test.afterAll(async ({ request }) => {
  if (!original) return;
  const headers = await teacherApi(request);
  const put = await request.put(`${API_URL}${notesUrl}`, { headers, data: { sections: original.sections } });
  expect(put.ok()).toBe(true);
  if (original.status === "approved") {
    const ok = await request.post(`${API_URL}${notesUrl}/approve`, { headers });
    expect(ok.ok()).toBe(true);
  }
});

test("teacher: edits a bullet, cites a line from the transcript panel, saves, approves and downloads", async ({ page }) => {
  await signIn(page, "teacher");
  await page.goto(notesUrl);
  await expect(page.getByText(/Approved by you|Draft, not approved/).first()).toBeVisible();
  await expect(page.getByText(/send to students/i)).toHaveCount(0);

  await page.getByRole("button", { name: "Edit notes" }).click();
  const bullet = page.getByRole("textbox", { name: "Bullet 1 of section 1", exact: true });
  await bullet.fill("E2E edit: total surface area of the combined solid.");
  await page.getByRole("button", { name: "Choose lines for bullet 1 of section 1", exact: true }).click();
  const panel = page.locator("[data-citation-panel]");
  await expect(panel.getByText(/Choosing lines for bullet 1 of section 1/)).toBeVisible();
  const unticked = panel.getByRole("checkbox", { checked: false }).first();
  await unticked.check({ force: true });
  await panel.getByRole("button", { name: "Done choosing" }).click();

  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Notes saved" })).toBeVisible();
  await expect(page.getByText("Draft, not approved")).toBeVisible();
  await expect(page.getByText("E2E edit: total surface area of the combined solid.")).toBeVisible();

  await page.getByRole("button", { name: "Approve notes" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Notes approved." })).toBeVisible();
  await expect(page.getByText(/Approved by you on/)).toBeVisible();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download as Markdown" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe(`${LECTURE_ID}-notes.md`);
});

test("teacher: problems are shown beside the heading or bullet, before and after the API checks", async ({ page }) => {
  await signIn(page, "teacher");
  await page.goto(notesUrl);
  await page.getByRole("button", { name: "Edit notes" }).click();

  // A check the page runs itself: nothing is sent.
  let puts = 0;
  await page.route(`**/api${notesUrl}`, async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    puts += 1;
    // The API's answer when a bullet holds a detected student name: locations only.
    await route.fulfill({
      status: 422,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "name_in_notes", message: "x", fields: [{ loc: ["body", "sections", 1, "bullets", 0, "text"], msg: "contains a student's name", type: "name" }] } }),
    });
  });
  const heading = page.getByRole("textbox", { name: "Section 1 heading" });
  await heading.fill("   ");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(heading).toHaveAttribute("aria-invalid", "true");
  await expect(heading).toBeFocused();
  await expect(page.getByText("Give this section a heading.")).toBeVisible();
  expect(puts).toBe(0);

  await heading.fill("Surface area of combined solids");
  await page.getByRole("button", { name: "Save notes" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "detected as a student's name" })).toBeVisible();
  const flagged = page.getByRole("textbox", { name: "Bullet 1 of section 2", exact: true });
  await expect(flagged).toHaveAttribute("aria-invalid", "true");
  await expect(page.locator('[data-bullet-key]').filter({ has: flagged }).getByText(/detected as a student's name/)).toBeVisible();
  expect(puts).toBe(1);

  // Editing that bullet clears the API's mark on it.
  await flagged.fill("A student explained the method.");
  await expect(flagged).not.toHaveAttribute("aria-invalid", "true");

  // Leaving with unsaved changes asks first.
  await page.getByRole("link", { name: "All lectures" }).click();
  await expect(page.getByRole("alertdialog", { name: "Leave without saving?" })).toBeVisible();
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page).toHaveURL(new RegExp(`${notesUrl}$`));
  await page.getByRole("button", { name: "Discard changes" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Discard changes" }).click();
  await expect(page.getByRole("button", { name: "Edit notes" })).toBeVisible();
});

test("admin: reads the notes and downloads them, with no editing", async ({ page }) => {
  await signIn(page, "admin");
  await page.goto(notesUrl);
  await expect(page.getByRole("article", { name: "Lecture notes" })).toBeVisible();
  await expect(page.getByText("Only the lecture's teacher can edit or approve these notes.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit notes" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Approve notes" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Download as Markdown" })).toBeVisible();
});

test("owner: reads the shared notes read-only", async ({ page }) => {
  await signIn(page, "owner");
  await page.goto(notesUrl);
  await expect(page.getByRole("article", { name: "Lecture notes" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit notes" })).toHaveCount(0);
});
