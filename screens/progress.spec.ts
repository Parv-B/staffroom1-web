import { test } from "@playwright/test";
import { TABLET_PORTRAIT, shot, signInWithToken } from "./shot";

const TEACHER = "a3142824-4e16-484c-a420-371d4eaa5329"; // E2E teacher

test("progress: teacher", async ({ page, request }) => {
  await signInWithToken(page, request, "teacher");
  await page.goto("/progress");
  await page.getByRole("region", { name: "Measures by lecture" }).waitFor();
  await shot(page, "progress-teacher");
  await page.setViewportSize(TABLET_PORTRAIT);
  await shot(page, "progress-teacher-portrait", { fullPage: false });
});

test("progress: owner, one teacher", async ({ page, request }) => {
  await signInWithToken(page, request, "owner");
  await page.goto(`/progress?teacher=${TEACHER}`);
  await page.getByRole("region", { name: "Measures by lecture" }).waitFor();
  await shot(page, "progress-owner");
});

test("progress: admin, no teacher chosen", async ({ page, request }) => {
  await signInWithToken(page, request, "admin");
  await page.goto("/progress");
  await page.getByText("Choose a teacher to see their measures.").waitFor();
  await shot(page, "progress-admin-empty", { fullPage: false });
});
