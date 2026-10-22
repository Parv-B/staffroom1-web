import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { API_URL, apiToken, signIn } from "./helpers";

// The full upload-to-analysis run: real upload, real lecture, real processing (about 5 min and
// $0.80 per run), with a participant list and a Zoom cloud-recording chat file. Off by default;
// run with STAFFROOM_E2E_FULL=1 (recording path in STAFFROOM_E2E_RECORDING). The lecture it
// creates stays in the E2E centre (lectures can't be deleted). Names are invented.
const recording = process.env.STAFFROOM_E2E_RECORDING ?? "/opt/staffroom1/eval/fixtures/example1/77921531-0d1a-41e3-9807-92b421dad97f.mp3";
test.skip(process.env.STAFFROOM_E2E_FULL !== "1", "full pipeline run is behind STAFFROOM_E2E_FULL=1");

test("upload with a participant list and chat log, create, and process end to end", async ({ page, request }) => {
  test.setTimeout(25 * 60_000);
  expect(existsSync(recording)).toBe(true);
  const dir = mkdtempSync(join(tmpdir(), "staffroom1-e2e-"));
  const chat = join(dir, "GMT20261021-zoom_chat.txt");
  writeFileSync(chat, "00:05:10\tKabir Rao:\tyes\n00:09:30\tMeera Joshi:\th plus 2r\n00:15:40\tNeha Kapoor:\tcheck the figure\n");
  try {
    await signIn(page, "teacher");
    await page.goto("/lectures/new");
    await page.locator("input[type=file]").first().setInputFiles(recording);
    await page.getByLabel("Board").fill("CBSE");
    await page.getByLabel("Subject").fill("Mathematics");
    await page.getByRole("radio", { name: "Grade 10" }).check({ force: true });
    await page.getByLabel("Chapter").fill("Surface Areas and Volumes");
    await page.getByRole("radio", { name: "Online" }).check({ force: true });

    await page.getByLabel("Paste the participant list").fill("Neha Kapoor (Host, me)\nKabir Rao\nMeera Joshi\nAsha Verma");
    await page.getByRole("button", { name: "Read the list" }).click();
    await expect(page.locator('[data-participant-row="teacher"]')).toHaveCount(1);
    await expect(page.locator('[data-participant-row="student"]')).toHaveCount(3);
    await page.locator("input[type=file]").last().setInputFiles(chat);
    await expect(page.getByText("GMT20261021-zoom_chat.txt uploaded.")).toBeVisible();

    await expect(page.getByText(/is uploaded/)).toBeVisible({ timeout: 10 * 60_000 });
    await page.getByRole("button", { name: "Create lecture" }).click();
    await expect(page).toHaveURL(/\/lectures\/lec_[0-9a-f]+(\/status)?$/);
    const lectureId = /lec_[0-9a-f]+/.exec(page.url())?.[0] ?? "";
    // eslint-disable-next-line no-console -- the run prints which lecture it created
    console.log(`full pipeline: created ${lectureId}`);

    const token = await apiToken(request, "teacher");
    let detail: { status: string; participant_count: number | null; has_chat: boolean } = { status: "", participant_count: null, has_chat: false };
    await expect
      .poll(
        async () => {
          const res = await request.get(`${API_URL}/lectures/${lectureId}`, { headers: { Authorization: `Bearer ${token}` } });
          detail = (await res.json()) as typeof detail;
          return detail.status;
        },
        { timeout: 20 * 60_000, intervals: [20_000] },
      )
      .toMatch(/^(done|failed)$/);
    expect(detail.status).toBe("done");
    expect(detail.participant_count).toBe(3);
    expect(detail.has_chat).toBe(true);

    await page.goto(`/lectures/${lectureId}`);
    await expect(page.getByText("Uploaded with a participant list with 3 students and the meeting's chat.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    await page.goto(`/lectures/${lectureId}/analysis/metrics`);
    await expect(page.getByText(/chat/i).first()).toBeVisible(); // the wait-time reason mentions the chat either way
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
