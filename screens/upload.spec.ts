import { test } from "@playwright/test";
import { TABLET_PORTRAIT, shot, signInWithToken } from "./shot";

// Invented names only. The parse endpoint is real and stores nothing.
test("upload form: participant list and chat log", async ({ page, request }) => {
  await signInWithToken(page, request, "teacher");
  await page.goto("/lectures/new");
  await page.getByLabel("Paste the participant list").fill("Asha Verma\nKabir Rao\nMeera Joshi\nNoor Haddad\n+91 98765 43210");
  await page.getByRole("button", { name: "Read the list" }).click();
  await page.getByText(/couldn't tell which name is yours/).waitFor();
  await page.getByRole("heading", { name: "Participant list" }).scrollIntoViewIfNeeded();
  await shot(page, "upload-participants-teacher-unknown", { fullPage: false });
  await page.getByRole("radiogroup", { name: "Which row is the teacher" }).getByRole("radio").first().check({ force: true });
  await shot(page, "upload-teacher");
  await page.setViewportSize(TABLET_PORTRAIT);
  await shot(page, "upload-teacher-portrait", { fullPage: false });
});

test("upload form: admin", async ({ page, request }) => {
  await signInWithToken(page, request, "admin");
  await page.goto("/lectures/new");
  await page.getByRole("heading", { name: "Upload a lecture" }).waitFor();
  await shot(page, "upload-admin");
});
