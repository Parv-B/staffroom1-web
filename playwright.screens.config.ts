import { defineConfig, devices } from "@playwright/test";

// Review screenshots (npm run screens). Separate from the E2E suite: every page here is signed in
// by putting an API token into sessionStorage, so the sign-in form is never filled in and no
// password can appear on screen. Traces and videos stay off; the only images are the explicit
// page.screenshot() calls, written to screenshots/.
export default defineConfig({
  testDir: "screens",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "off",
    video: "off",
    screenshot: "off",
    ...devices["Desktop Chrome"],
    viewport: { width: 1180, height: 820 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
