// @ts-check
import { defineConfig, devices } from "@playwright/test";

/**
 * CI gate 전용 Playwright 설정
 *
 * 로컬 설정(playwright.config.js)과 분리하여 gate 실행에 최적화.
 * - globalSetup 없음 (브라우저 로그인 불가)
 * - auth.json은 GitHub Secrets에서 주입됨
 * - headless 고정, chromium만 사용
 * - @suite:ops 태그가 붙은 변경성 테스트는 제외
 * - @suite:exploratory 태그가 붙은 탐색성/비계약 테스트는 제외
 *
 * 사용법: npx playwright test --config=playwright.ci.config.js
 */
export default defineConfig({
  testDir: "./tests",
  testIgnore: ["**/backup/**", "**/save-auth*", "**/ab-save-auth*"],
  grepInvert: /@suite:ops|@suite:exploratory/,

  fullyParallel: true,
  forbidOnly: true,
  retries: 2,
  workers: 1,

  reporter: [
    ["html", { open: "never" }],
    ["list"],
    ["json", { outputFile: "test-results/results.json" }],
    ["./lib/live-reporter.js"],
  ],

  timeout: 90000,

  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    navigationTimeout: 30000,
    headless: true,
    viewport: { width: 1920, height: 1080 },
  },

  projects: [
    {
      // Monitoring + Payment(cmr_*_pom.spec.ts) 일괄 실행.
      // CMR 결제 스펙은 상단 `test.skip(!IS_STAGE_ENV)` 가드가 있어 prod에서는 자동 skip되고
      // stage 환경(`environment: stg`)에서만 실제 실행됨.
      // 네이밍 `cmr-monitoring`은 워크플로/히스토리 호환을 위해 유지.
      name: "cmr-monitoring",
      testMatch: ["**/cmr_*_pom.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        storageState: "./auth.json",
      },
    },
    {
      name: "albumbuddy-monitoring",
      testMatch: ["**/ab_monitoring_pom.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        storageState: "./ab-auth.json",
      },
    },
    {
      name: "admin-setup",
      testMatch: ["**/admin_auth_pom.spec.ts"],
      retries: 0,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        storageState: "./auth.json",
      },
    },
    {
      name: "admin-gate",
      testMatch: [
        "**/admin_product_pom.spec.ts",
        "**/admin_order_pom.spec.ts",
        "**/admin_user_pom.spec.ts",
        "**/admin_artist_pom.spec.ts",
        "**/admin_poca_album_pom.spec.ts",
        "**/admin_poca_content_pom.spec.ts",
        "**/admin_poca_dashboard_pom.spec.ts",
        "**/admin_poca_readonly_pom.spec.ts",
        "**/admin_poca_shop_pom.spec.ts",
      ],
      dependencies: ["admin-setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        storageState: "./auth.json",
      },
    },
  ],
});
