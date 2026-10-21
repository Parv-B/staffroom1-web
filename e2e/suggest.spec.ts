import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { API_URL, apiToken, signIn } from "./helpers";

// The UI contract for AI-suggested details. Storage and the suggestion endpoint are answered in
// the browser, so nothing is stored and no recording is sent to the transcription or AI
// services. The upload record the API creates is aborted in teardown.
let dir = "";
let filePath = "";
const uploads: string[] = [];

test.beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "staffroom1-e2e-"));
  filePath = join(dir, "short-class.mp3");
  writeFileSync(filePath, Buffer.alloc(2 * 1024 * 1024));
});

test.afterAll(async ({ request }) => {
  const token = await apiToken(request, "teacher");
  for (const id of uploads) await request.post(`${API_URL}/uploads/${id}/abort`, { headers: { Authorization: `Bearer ${token}` } });
  rmSync(dir, { recursive: true, force: true });
});

const SUGGESTION = {
  upload_id: "staged",
  cached: false,
  created_at: "2026-10-21T10:00:00Z",
  cost_usd: 0,
  timings_s: {},
  reason_if_unavailable: null,
  objectives: ["Find the volume of a combined solid"],
  fields: {
    board: { value: "CBSE", confidence: 0.4, reason: "From your earlier lectures" },
    grade: { value: "10", confidence: 0.85, reason: "At 04:31 the teacher says 'class 10'" },
    subject: { value: "Mathematics", confidence: 0.95, reason: "At 04:40 'today's maths class'" },
    chapter: { value: "Surface Areas and Volumes", confidence: 0.9, reason: "At 05:02 'surface areas and volumes'" },
    class_type: { value: "online", confidence: 0.8, reason: "At 05:55 'switch on your camera'" },
    class_composition: { value: "unknown", confidence: 0.8, reason: "The class isn't addressed as a group" },
  },
};

async function stageUpload(page: Page, suggest: (route: import("@playwright/test").Route) => Promise<void>): Promise<{ lecturePosts: () => number }> {
  let posts = 0;
  await page.route("http://127.0.0.1:8333/**", (route) => route.fulfill({ status: 200, headers: { ETag: '"staged"', "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "ETag" } }));
  await page.route("**/api/uploads/*/complete", (route) => route.fulfill({ json: { upload_id: "x", status: "completed", completed_at: null } }));
  await page.route("**/api/uploads/*/suggest-metadata*", suggest);
  await page.route("**/api/lectures", async (route) => {
    if (route.request().method() === "POST") posts++;
    await route.continue();
  });
  page.on("response", (r) => {
    if (r.url().endsWith("/api/uploads") && r.request().method() === "POST") void r.json().then((b: { upload_id: string }) => uploads.push(b.upload_id));
  });
  return { lecturePosts: () => posts };
}

test("suggestions fill only untouched fields, are marked with reasons, and never submit", async ({ page }) => {
  await signIn(page, "teacher");
  let release: () => void = () => undefined;
  const replied = new Promise<void>((r) => (release = r));
  const staged = await stageUpload(page, async (route) => {
    await replied; // the teacher types while the suggestion is running
    await route.fulfill({ json: SUGGESTION });
  });
  await page.goto("/lectures/new");
  await page.locator("input[type=file]").first().setInputFiles(filePath);
  await expect(page.getByText(/is uploaded/)).toBeVisible();
  await expect(page.getByText("Suggesting details from the recording.", { exact: false })).toBeVisible();

  await page.getByLabel("Chapter").fill("Triangles"); // typed before the suggestion arrives
  release();
  await expect(page.locator("[data-suggest-status=done]")).toContainText("marked below");

  await expect(page.getByLabel("Chapter")).toHaveValue("Triangles"); // never overwritten
  await expect(page.getByLabel("Subject")).toHaveValue("Mathematics");
  await expect(page.getByRole("radio", { name: "Online" })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Grade 10" })).toBeChecked();
  await expect(page.getByText("At 05:55 'switch on your camera'")).toBeVisible();
  await expect(page.locator("[data-suggestion=tentative]")).toContainText("From your earlier lectures"); // the weak board guess
  await expect(page.getByText("Tentative suggestion")).toBeVisible();
  await expect(page.getByRole("radio", { name: "Not sure" })).toBeChecked(); // "unknown" isn't a suggestion
  await expect(page.locator("[data-suggested-objectives]")).toContainText("Find the volume of a combined solid");

  // Keeping or editing clears the mark.
  const marks = page.locator("[data-suggestion]");
  const before = await marks.count();
  await page.locator("[data-suggestion]", { hasText: "switch on your camera" }).getByRole("button", { name: "Keep" }).click();
  await page.getByLabel("Subject").fill("Maths");
  await expect(marks).toHaveCount(before - 2);

  // Nothing was submitted on the teacher's behalf.
  await page.waitForTimeout(500);
  expect(staged.lecturePosts()).toBe(0);
});

test("with suggestions switched off, the form is left exactly as it is", async ({ page }) => {
  await signIn(page, "teacher");
  await stageUpload(page, (route) => route.fulfill({ status: 404, json: { error: { code: "not_enabled", message: "suggestions are switched off" } } }));
  await page.goto("/lectures/new");
  await page.locator("input[type=file]").first().setInputFiles(filePath);
  await expect(page.getByText(/is uploaded/)).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.locator("[data-suggest-status]")).toHaveCount(0);
  await expect(page.getByLabel("Board")).toHaveValue("");
  await expect(page.locator("[data-suggestion]")).toHaveCount(0);
});
