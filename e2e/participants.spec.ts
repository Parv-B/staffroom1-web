import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { API_URL, apiToken, signIn } from "./helpers";

// The participant list goes through the real (stateless) parse endpoint. Storage and lecture
// creation are answered in the browser, so no lecture is created and nothing is processed.
// Names are invented.
let dir = "";
let recording = "";
let chatFile = "";
const uploads: string[] = [];

test.beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "staffroom1-e2e-"));
  recording = join(dir, "class.mp3");
  writeFileSync(recording, Buffer.alloc(1024 * 1024));
  chatFile = join(dir, "meeting_saved_chat.txt");
  writeFileSync(chatFile, "00:01:05\tKabir Rao:\tyes sir\n00:01:09\tMeera Joshi:\t2 pi r h\n");
});

test.afterAll(async ({ request }) => {
  const token = await apiToken(request, "teacher");
  for (const id of uploads) await request.post(`${API_URL}/uploads/${id}/abort`, { headers: { Authorization: `Bearer ${token}` } });
  rmSync(dir, { recursive: true, force: true });
});

async function stage(page: Page) {
  const bodies: unknown[] = [];
  await page.route("http://127.0.0.1:8333/**", (route) => route.fulfill({ status: 200, headers: { ETag: '"staged"', "Access-Control-Allow-Origin": "*", "Access-Control-Expose-Headers": "ETag" } }));
  await page.route("**/api/uploads/*/complete", (route) => route.fulfill({ json: { upload_id: "x", status: "completed", completed_at: null } }));
  await page.route("**/api/uploads/*/suggest-metadata*", (route) => route.fulfill({ status: 404, json: { error: { code: "not_enabled", message: "off" } } }));
  await page.route("**/api/lectures", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    bodies.push(route.request().postDataJSON());
    await route.fulfill({ status: 422, json: { error: { code: "invalid_participants", message: "x", fields: [] } } });
  });
  page.on("response", (r) => {
    if (r.url().endsWith("/api/uploads") && r.request().method() === "POST") void r.json().then((b: { upload_id: string }) => uploads.push(b.upload_id));
  });
  return bodies;
}

test("teacher: pastes a participant list, confirms their own row, adds a chat log, and both are sent", async ({ page }) => {
  await signIn(page, "teacher");
  const bodies = await stage(page);
  await page.goto("/lectures/new");
  await page.locator("input[type=file]").first().setInputFiles(recording);
  await expect(page.getByText(/is uploaded/)).toBeVisible();
  await page.getByLabel("Board").fill("CBSE");
  await page.getByRole("radio", { name: "Grade 10" }).check({ force: true });
  await page.getByLabel("Subject").fill("Mathematics");
  await page.getByLabel("Chapter").fill("Surface Areas and Volumes");
  await page.getByRole("radio", { name: "Online" }).check({ force: true });

  await expect(page.getByText(/Student names on this list are removed from the transcript before any analysis/)).toBeVisible();
  // No host mark and no matching name: the teacher must pick their row.
  await page.getByLabel("Paste the participant list").fill("Asha Verma\nKabir Rao\nMeera Joshi\n+91 98765 43210");
  await page.getByRole("button", { name: "Read the list" }).click();
  await expect(page.getByText(/couldn't tell which name is yours/)).toBeVisible();
  await expect(page.locator("[data-participant-row]")).toHaveCount(3); // the phone number is dropped
  await page.getByRole("button", { name: "Create lecture" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "participant list needs a change" })).toBeVisible();
  expect(bodies).toHaveLength(0);

  await page.getByRole("radiogroup", { name: "Which row is the teacher" }).getByRole("radio").first().check({ force: true });
  await expect(page.getByText("Teacher (you)")).toBeVisible();

  await page.locator("input[type=file]").last().setInputFiles(chatFile);
  await expect(page.getByText("meeting_saved_chat.txt uploaded.")).toBeVisible();

  await page.getByRole("button", { name: "Create lecture" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "participant list wasn't accepted" })).toBeVisible();
  expect(bodies).toHaveLength(1);
  const body = bodies[0] as { participants: { teacher: { display_name: string }; students: { display_name: string }[] }; chat_upload_id: string | null };
  expect(body.participants.teacher.display_name).toBe("Asha Verma");
  expect(body.participants.students.map((s) => s.display_name)).toEqual(["Kabir Rao", "Meera Joshi"]);
  expect(body.chat_upload_id).toMatch(/.+/);
});

test("a host-marked row is recognised as the teacher", async ({ page }) => {
  await signIn(page, "teacher");
  await stage(page);
  await page.goto("/lectures/new");
  await page.getByLabel("Paste the participant list").fill("Asha Verma (Host, me)\nKabir Rao");
  await page.getByRole("button", { name: "Read the list" }).click();
  await expect(page.locator('[data-participant-row="teacher"]')).toHaveCount(1);
  await expect(page.getByText(/couldn't tell which name/)).toHaveCount(0);
});
