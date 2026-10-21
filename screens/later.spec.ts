import { test } from "@playwright/test";
import { LECTURE_ID } from "../e2e/helpers";
import { shot, signInWithToken } from "./shot";

const L = `/lectures/${LECTURE_ID}`;

test("edit details: teacher, with a change", async ({ page, request }) => {
  await signInWithToken(page, request, "teacher");
  await page.goto(`${L}/edit`);
  await page.getByLabel("Learning objectives, one per line").fill("Find the surface area of a combination of solids");
  await page.locator("aside [data-edit-effects]").waitFor();
  await shot(page, "edit-details-teacher", { fullPage: false });
  await page.getByRole("button", { name: "Save details" }).click();
  await page.getByRole("alertdialog").waitFor();
  await shot(page, "edit-details-confirm-teacher", { fullPage: false });
  // Not confirmed: nothing is sent.
});

test("responses to findings: admin", async ({ page, request }) => {
  await signInWithToken(page, request, "admin");
  await page.goto("/admin/feedback");
  await page.getByRole("region", { name: "Responses by category" }).waitFor();
  await shot(page, "feedback-admin");
});

test("new results mark: teacher (list answer adjusted in the browser)", async ({ page, request }) => {
  await signInWithToken(page, request, "teacher");
  await page.route("**/api/lectures?**", async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { items: { lecture_id: string; has_unseen_results: boolean }[] };
    for (const i of body.items) if (i.lecture_id === LECTURE_ID) i.has_unseen_results = true;
    await route.fulfill({ response: res, json: body });
  });
  await page.goto("/lectures");
  await page.locator("[data-new-results]").waitFor();
  await shot(page, "lectures-new-results-teacher", { fullPage: false });
});
