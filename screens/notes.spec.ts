import { test } from "@playwright/test";
import { LECTURE_ID } from "../e2e/helpers";
import { TABLET_PORTRAIT, shot, signInWithToken } from "./shot";

const DRAFT_LECTURE = "lec_aa49eb2c1a6d007c"; // pipeline draft, never edited

test("notes: teacher, approved", async ({ page, request }) => {
  await signInWithToken(page, request, "teacher");
  await page.goto(`/lectures/${LECTURE_ID}/notes`);
  await page.getByRole("article", { name: "Lecture notes" }).waitFor();
  await shot(page, "notes-teacher-approved", { fullPage: false });
});

test("notes: teacher, pipeline draft", async ({ page, request }) => {
  await signInWithToken(page, request, "teacher");
  await page.goto(`/lectures/${DRAFT_LECTURE}/notes`);
  await page.getByRole("article", { name: "Lecture notes" }).waitFor();
  await shot(page, "notes-teacher-draft", { fullPage: false });
});

test("notes: teacher, editing with the transcript panel", async ({ page, request }) => {
  await signInWithToken(page, request, "teacher");
  await page.goto(`/lectures/${LECTURE_ID}/notes`);
  await page.getByRole("button", { name: "Edit notes" }).click();
  await page.getByRole("button", { name: "Choose lines for bullet 2 of section 1", exact: true }).click();
  await shot(page, "notes-teacher-editing", { fullPage: false });
  await page.setViewportSize(TABLET_PORTRAIT);
  await shot(page, "notes-teacher-editing-portrait", { fullPage: false });
});

test("notes: admin, read only", async ({ page, request }) => {
  await signInWithToken(page, request, "admin");
  await page.goto(`/lectures/${LECTURE_ID}/notes`);
  await page.getByRole("article", { name: "Lecture notes" }).waitFor();
  await shot(page, "notes-admin", { fullPage: false });
});

test("notes: owner, shared lecture", async ({ page, request }) => {
  await signInWithToken(page, request, "owner");
  await page.goto(`/lectures/${LECTURE_ID}/notes`);
  await page.getByRole("article", { name: "Lecture notes" }).waitFor();
  await shot(page, "notes-owner", { fullPage: false });
});

test("notes: print layout", async ({ page, request }) => {
  await signInWithToken(page, request, "teacher");
  await page.goto(`/lectures/${DRAFT_LECTURE}/notes`);
  await page.getByRole("article", { name: "Lecture notes" }).waitFor();
  await page.emulateMedia({ media: "print" });
  await page.setViewportSize({ width: 794, height: 1123 });
  await shot(page, "notes-print", { fullPage: false });
});
