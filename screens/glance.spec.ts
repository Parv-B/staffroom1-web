import { test } from "@playwright/test";
import { OUT, signInWithToken } from "./shot";

// The redesigned overview on a real lecture (chem1): close-ups at desktop and phone widths.
const L = "/lectures/lec_0e241370fa72a0ea";

test("overview at a glance", async ({ page, request }) => {
  await signInWithToken(page, request, "owner");
  for (const [name, w, h] of [["desktop", 1180, 1500], ["phone", 390, 1500]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${L}/analysis/overview`);
    await page.locator("[data-lesson-timeline]").waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${OUT}/glance-${name}-top.png`, animations: "disabled" });
    await page.locator("#when-h").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -20));
    await page.screenshot({ path: `${OUT}/glance-${name}-mid.png`, animations: "disabled" });
  }
});
