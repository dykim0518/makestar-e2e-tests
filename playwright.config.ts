import { defineConfig, devices } from "@playwright/test";
import * as path from "path";
const { getBrowserAuthState } = require("./scripts/auth-state");

// 환경별 auth 파일 선택: STG → stg-auth.json, Prod → auth.json
const browserAuthState = getBrowserAuthState({
  cwd: process.cwd(),
  env: process.env,
  bufferMs: 0,
});
const authFile = browserAuthState.authFilePath;
let hasValidAuthFile = false;
const excludeAuthTests = process.env.EXCLUDE_AUTH_TESTS === "true";
const manualAuthSpecPatterns = [
  "**/save-auth.spec.ts",
  "**/ab-save-auth.spec.ts",
];
const testIgnorePatterns = ["**/backup/**"];
const nonAdminIgnorePatterns = ["**/admin_*.spec.ts", "**/backup/**"];

if (excludeAuthTests) {
  testIgnorePatterns.push(...manualAuthSpecPatterns);
  nonAdminIgnorePatterns.push(...manualAuthSpecPatterns);
}

if (browserAuthState.exists) {
  if (browserAuthState.parseError) {
    console.log(`⚠️ ${path.basename(authFile)} 파싱 실패`);
  } else {
    hasValidAuthFile =
      !browserAuthState.hasMockData &&
      browserAuthState.cookies.length > 5 &&
      browserAuthState.valid;

    if (hasValidAuthFile) {
      console.log(
        `✅ ${path.basename(authFile)} 로드됨 (쿠키 ${browserAuthState.cookies.length}개)`,
      );
    } else {
      console.log(
        `⚠️ ${path.basename(authFile)}의 refresh_token이 없거나 만료됨`,
      );
    }
  }
}

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Global Setup은 현재 auth 상태만 검증합니다.
  // 브라우저 자동 로그인 복구는 하지 않고, 수동 갱신 명령을 안내합니다.
  globalSetup: "./global-setup.js",
  testDir: "./tests",
  // 기본 제외 패턴(backup), EXCLUDE_AUTH_TESTS=true면 수동 인증 스펙도 제외
  testIgnore: testIgnorePatterns,
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only - 로컬에서는 Flaky 즉시 식별을 위해 재시도 없음 */
  retries: process.env.CI ? 2 : 0,
  /* 로컬에서 워커 수 제한 (인증 경쟁 방지를 위해 2로 감소) */
  workers: process.env.CI ? 1 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: "html",
  /* Test timeout - 90초로 증가 (인증 재시도 시간 확보) */
  timeout: 90000,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    navigationTimeout: 30000,

    // headless mode 설정 (true = 숨김, false = 브라우저 표시)
    // 환경변수 HEADED=true로 브라우저를 표시할 수 있음 (예: HEADED=true npx playwright test)
    headless: process.env.HEADED !== "true",

    // 브라우저 실행 속도 조절 (ms) - 동작 확인 시 유용
    // launchOptions: { slowMo: 500 },

    // viewport 설정 (1920x1080 Full HD) - PC 환경 전용
    viewport: { width: 1920, height: 1080 },

    // 유효한 auth.json이 있으면 자동으로 세션 사용
    ...(hasValidAuthFile ? { storageState: authFile } : {}),
  },

  /* Configure projects for major browsers */
  projects: [
    // =========================================================================
    // Admin Setup Project - 인증 검증을 먼저 실행
    // =========================================================================
    {
      name: "admin-setup",
      testMatch: ["**/admin_auth_pom.spec.ts"],
      retries: 0,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        headless: process.env.HEADED !== "true",
      },
    },
    // Admin 테스트 전용 (PC 환경만) - Setup 완료 후 실행
    {
      name: "admin-pc",
      testMatch: [
        "**/admin_product_pom.spec.ts",
        "**/admin_order_pom.spec.ts",
        "**/admin_poca_*_pom.spec.ts",
        "**/admin_pocaalbum_functional.spec.ts",
        "**/admin_user_pom.spec.ts",
        "**/admin_artist_pom.spec.ts",
        "**/admin_isms_*.spec.ts",
        "**/admin_excel*pom.spec.ts",
        "**/auto_*_pom.spec.ts",
      ],
      dependencies: ["admin-setup"], // Setup 프로젝트에 의존
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        headless: process.env.HEADED !== "true",
      },
    },
    // 일반 테스트 (PC 환경) - Admin 테스트 제외
    {
      name: "chromium",
      testIgnore: nonAdminIgnorePatterns,
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
    // 모바일 뷰포트 테스트 - Admin 테스트 제외
    {
      name: "mobile-chrome",
      testIgnore: nonAdminIgnorePatterns,
      use: {
        ...devices["Pixel 5"],
        // 모바일에서도 auth 유지
        ...(hasValidAuthFile ? { storageState: authFile } : {}),
      },
    },
    // CMR 묶음 — monitoring + payment 등 cmr_*_pom.spec.ts 모두 포함 (Desktop Chrome 기준)
    // QA Hub Trigger에서 `--project=cmr` 로 일괄 실행에 사용.
    {
      name: "cmr",
      testMatch: ["**/cmr_*_pom.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});
