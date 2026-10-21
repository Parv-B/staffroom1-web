import { mkdirSync } from "node:fs";
import { expect, type APIRequestContext, type Page } from "@playwright/test";
import { apiToken, type E2ERole } from "../e2e/helpers";

export const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

/** Signs the page in with a token from the API (no form, so no password on screen). */
export async function signInWithToken(page: Page, request: APIRequestContext, role: E2ERole): Promise<void> {
  const token = await apiToken(request, role);
  await page.addInitScript((t) => {
    sessionStorage.setItem("staffroom1.session", JSON.stringify({ token: t, expiresAt: Date.now() + 3_600_000 }));
  }, token);
}

export async function shot(page: Page, name: string, opts: { fullPage?: boolean } = {}): Promise<void> {
  // Let fonts and late layout settle; nothing animates under reduced motion.
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator("body")).toBeVisible();
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: opts.fullPage ?? true, animations: "disabled" });
}

export const TABLET_PORTRAIT = { width: 820, height: 1180 };
