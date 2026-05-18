// @ts-check
import { defineConfig, devices } from "@playwright/test";

const AUTH_STORAGE_STATE = process.env.AUTH_FILE_PATH || "./auth.json";
const AB_AUTH_STORAGE_STATE = process.env.AB_AUTH_FILE_PATH || "./ab-auth.json";
const INCLUDE_CMR_PAYMENT = process.env.INCLUDE_CMR_PAYMENT === "true";

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
      // CMR prod monitoring 전용. 결제 스펙은 실제 결제/주문 데이터를 만들 수 있어
      // `cmr-payment-stg` project로 분리한다.
      // 네이밍 `cmr-monitoring`은 워크플로/히스토리 호환을 위해 유지.
      name: "cmr-monitoring",
      testMatch: ["**/cmr_*_pom.spec.ts"],
      testIgnore: ["**/cmr_payment_pom.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        storageState: AUTH_STORAGE_STATE,
        // ubuntu-latest 기본 locale은 en-US이며, makestar 클라이언트가 이를 보고
        // base_currency=usd로 매핑한다. USD 통화 흐름에서 cart-add PUT 직전
        // client-side 가드가 logout으로 분기되는 회귀가 잡혀(2026-05-15~18 CMR 실패)
        // 수동 환경(KST)과 동일한 KRW 흐름으로 정렬한다.
        locale: "ko-KR",
        timezoneId: "Asia/Seoul",
      },
    },
    {
      // STG 결제 회귀 전용. spec 내부에도 stage 가드가 있어 prod 오작동 시 skip된다.
      // 전체 CI 실행에 섞이지 않도록 명시적으로 opt-in 될 때만 수집한다.
      name: "cmr-payment-stg",
      testMatch: INCLUDE_CMR_PAYMENT ? ["**/cmr_payment_pom.spec.ts"] : [],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        storageState: AUTH_STORAGE_STATE,
      },
    },
    {
      name: "albumbuddy-monitoring",
      testMatch: ["**/ab_monitoring_pom.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        storageState: AB_AUTH_STORAGE_STATE,
      },
    },
    {
      name: "admin-setup",
      testMatch: ["**/admin_auth_pom.spec.ts"],
      retries: 0,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        storageState: AUTH_STORAGE_STATE,
      },
    },
    {
      name: "admin-full",
      testMatch: ["**/admin_*.spec.ts"],
      testIgnore: ["**/admin_auth_pom.spec.ts"],
      dependencies: ["admin-setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        storageState: AUTH_STORAGE_STATE,
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
        storageState: AUTH_STORAGE_STATE,
      },
    },
  ],
});
