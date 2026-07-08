import { defineConfig, devices } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ["html", { outputFolder: "tests/reports/playwright-report" }],
    ["list"],
  ],
  timeout: process.env.CI ? 60000 : 30000,
  expect: { timeout: 10000 },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chromium"],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
      },
    },
    {
      name: "tablet",
      use: {
        ...devices["iPad Pro 11"],
        viewport: { width: 768, height: 1024 },
      },
    },
    {
      name: "laptop",
      use: {
        ...devices["Desktop Chromium"],
        viewport: { width: 1366, height: 768 },
      },
    },
  ],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },
  globalSetup: path.resolve(__dirname, "tests/helpers/global-setup.ts"),
  webServer: {
    command: "npm run dev:web",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    cwd: path.resolve(__dirname),
  },
});
