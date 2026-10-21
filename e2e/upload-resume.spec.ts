import { mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// A resumed multipart upload against the real API and S3. Nothing is processed: the final
// /complete call is blocked and the multipart upload is aborted in teardown, so no lecture is
// created and no storage is left behind.
const API = process.env.STAFFROOM_API_URL ?? "http://127.0.0.1:8000";
const MiB = 1024 * 1024;

let dir = "";
let filePath = "";
let uploadId: string | null = null;
let token: string | null = null;

test.beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "staffroom1-e2e-"));
  filePath = join(dir, "resume-test.mp3");
  writeFileSync(filePath, Buffer.alloc(150 * MiB)); // > 100 MiB: multipart, 3 parts of 64 MiB
  const t = new Date("2026-01-01T00:00:00Z");
  utimesSync(filePath, t, t); // same lastModified on both selections
});

test.afterAll(async ({ request }) => {
  if (uploadId && token) {
    const res = await request.post(`${API}/uploads/${uploadId}/abort`, { headers: { Authorization: `Bearer ${token}` } });
    expect([200, 409]).toContain(res.status()); // 409: already aborted or completed
  }
  rmSync(dir, { recursive: true, force: true });
});

test("a multipart upload resumes after a refresh, re-signing only the missing part", async ({ page }) => {
  test.setTimeout(180_000);
  page.on("dialog", (d) => void d.accept()); // the "leave while uploading?" prompt on reload
  await signIn(page, "teacher");
  token = await page.evaluate(() => {
    const raw = sessionStorage.getItem("staffroom1.session");
    return raw ? (JSON.parse(raw) as { token: string }).token : null;
  });

  // First attempt: part 2 never completes (the connection to S3 hangs).
  await page.route("http://127.0.0.1:8333/**", async (route) => {
    if (route.request().method() === "PUT" && /[?&]partNumber=2(&|$)/.test(route.request().url())) {
      await new Promise(() => undefined);
      return;
    }
    await route.continue();
  });
  await page.goto("/lectures/new");
  const created = page.waitForResponse((r) => r.url().endsWith("/api/uploads") && r.request().method() === "POST");
  await page.locator("input[type=file]").setInputFiles(filePath);
  const body = (await (await created).json()) as { upload_id: string; mode: string; part_count: number };
  uploadId = body.upload_id;
  expect(body.mode).toBe("multipart");
  expect(body.part_count).toBe(3);
  await expect(page.getByText(/2 of 3 parts stored/)).toBeVisible({ timeout: 90_000 });

  // Refresh mid-upload, with S3 behaving normally again.
  await page.unrouteAll({ behavior: "ignoreErrors" });
  await page.reload();
  await expect(page.getByText("Unfinished uploads on this device")).toBeVisible();
  await expect(page.getByText(/2 of 3 parts stored\. Choose the same file below/)).toBeVisible();

  // Second attempt: the same file. Block the final /complete so nothing is created.
  let completeBody: { parts: { part_number: number; etag: string }[] } | null = null;
  await page.route("**/api/uploads/*/complete", async (route) => {
    completeBody = route.request().postDataJSON() as typeof completeBody;
    await route.abort();
  });
  const resigned = page.waitForRequest((r) => /\/api\/uploads\/[^/]+\/parts$/.test(r.url()));
  await page.locator("input[type=file]").setInputFiles(filePath);
  await expect(page.getByText("Continuing the earlier upload of this file.")).toBeVisible();
  expect((await resigned).postDataJSON()).toEqual({ part_numbers: [2] });

  await expect.poll(() => completeBody, { timeout: 90_000 }).not.toBeNull();
  const parts = (completeBody as unknown as { parts: { part_number: number; etag: string }[] }).parts;
  expect(parts.map((p) => p.part_number)).toEqual([1, 2, 3]);
  for (const p of parts) expect(p.etag).toMatch(/^"[0-9a-f-]+"$/);
});
