import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45000,
  expect: { timeout: 15000 },
  fullyParallel: true,
  workers: 2,
  use: {
    baseURL: process.env.LIVE_URL || "http://127.0.0.1:4173/poker/",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: "webkit-mobile",
      use: {
        browserName: "webkit",
        viewport: { width: 430, height: 932 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: process.env.LIVE_URL
    ? undefined
    : {
        command: "node scripts/serve-test.js",
        url: "http://127.0.0.1:4173/poker/",
        reuseExistingServer: !process.env.CI,
      },
  reporter: [["list"]],
});
