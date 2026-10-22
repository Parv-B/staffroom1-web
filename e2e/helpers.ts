import { expect, type Page } from "@playwright/test";

export type E2ERole = "teacher" | "owner" | "admin";
export const LECTURE_ID = "lec_b6899035ede4aefd";

export function credentials(role: E2ERole): { email: string; password: string } {
  const email = process.env[`E2E_${role.toUpperCase()}_EMAIL`];
  const password = process.env[`E2E_${role.toUpperCase()}_PASSWORD`];
  if (!email || !password) throw new Error(`missing credentials for ${role}`);
  return { email, password };
}

export async function signIn(page: Page, role: E2ERole): Promise<void> {
  const { email, password } = credentials(role);
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/lectures$/);
}

export const API_URL = process.env.STAFFROOM_API_URL ?? "http://127.0.0.1:8000";

/** A bearer token straight from the API, for setup and teardown steps. */
export async function apiToken(request: import("@playwright/test").APIRequestContext, role: E2ERole): Promise<string> {
  const res = await request.post(`${API_URL}/auth/login`, { data: credentials(role) });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { access_token: string }).access_token;
}
