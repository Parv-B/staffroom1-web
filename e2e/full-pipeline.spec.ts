import { existsSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

// The full upload-to-analysis run: real upload, real lecture, real processing (about 5 min and
// $0.80 per run). Off by default; run with STAFFROOM_E2E_FULL=1 and a recording path in
// STAFFROOM_E2E_RECORDING.
const recording = process.env.STAFFROOM_E2E_RECORDING ?? "/opt/staffroom1/eval/fixtures/example1/77921531-0d1a-41e3-9807-92b421dad97f.mp3";
test.skip(process.env.STAFFROOM_E2E_FULL !== "1", "full pipeline run is behind STAFFROOM_E2E_FULL=1");

test("upload, create and process a lecture end to end", async ({ page }) => {
  test.setTimeout(20 * 60_000);
  expect(existsSync(recording)).toBe(true);
  await signIn(page, "teacher");
  await page.goto("/lectures/new");
  await page.locator("input[type=file]").setInputFiles(recording);
  await page.getByLabel("Board").fill("CBSE");
  await page.getByLabel("Subject").fill("Mathematics");
  await page.getByRole("radio", { name: "Grade 10" }).check({ force: true });
  await page.getByLabel("Chapter").fill("Surface Areas and Volumes");
  await page.getByRole("radio", { name: "Online" }).check({ force: true });
  await expect(page.getByText(/is uploaded/)).toBeVisible({ timeout: 10 * 60_000 });
  await page.getByRole("button", { name: "Create lecture" }).click();
  await expect(page).toHaveURL(/\/lectures\/lec_[0-9a-f]+$/);
  // Until the status page polls (milestone c), reload to see the status change.
  await expect
    .poll(
      async () => {
        await page.reload();
        return page.getByText(/Analysed\.|Processing stopped\./).textContent({ timeout: 5000 }).catch(() => null);
      },
      { timeout: 18 * 60_000, intervals: [20_000] },
    )
    .toMatch(/Analysed\./);
});
