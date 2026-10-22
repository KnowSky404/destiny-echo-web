import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  outputDir: join(tmpdir(), "destiny-echo-test-results"),
  fullyParallel: false,
  workers: 1,
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:5187",
    viewport: { width: 1505, height: 1045 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      testMatch: "desktop.spec.ts",
      use: {
        browserName: "chromium",
        launchOptions: {
          args: [
            "--enable-unsafe-swiftshader",
            "--use-angle=swiftshader",
            "--disable-dev-shm-usage",
          ],
        },
      },
    },
    {
      name: "firefox",
      testMatch: "desktop.spec.ts",
      use: {
        browserName: "firefox",
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
          firefoxUserPrefs: {
            "webgl.force-enabled": true,
            "webgl.disable-fail-if-major-performance-caveat": true,
          },
        },
      },
    },
    { name: "webkit", testMatch: "desktop.spec.ts", use: { browserName: "webkit" } },
    {
      name: "mobile-chromium",
      testMatch: "mobile.spec.ts",
      use: {
        ...devices["Pixel 7"],
        browserName: "chromium",
        launchOptions: {
          args: [
            "--enable-unsafe-swiftshader",
            "--use-angle=swiftshader",
            "--disable-dev-shm-usage",
          ],
        },
      },
    },
  ],
  webServer: [
    {
      command: "bun run dev --mode test --port 5187",
      url: "http://127.0.0.1:5187",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "bun run preview --port 4187",
      url: "http://127.0.0.1:4187",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
