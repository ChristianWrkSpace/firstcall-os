import { defineConfig, devices } from "@playwright/test";

// Smoke tests run against the live deployed app — no local dev server.
// Override with PLAYWRIGHT_BASE_URL env var when testing a preview deploy.
const BASE = process.env.PLAYWRIGHT_BASE_URL ?? "https://firstcall-os.vercel.app";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: BASE,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
