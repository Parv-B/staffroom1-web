import { defineConfig, devices } from "@playwright/test";

// Runs against the real local API through the dev server. Traces, videos and screenshots are
// off: they would record typed passwords and transcript text.
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  projects: [{ name: "tablet", use: { ...devices["Desktop Chrome"], viewport: { width: 1180, height: 820 } } }],
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
