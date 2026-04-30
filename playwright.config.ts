import { defineConfig, devices } from "@playwright/test";
import * as fs from "fs";

type StoredCookie = {
  name: string;
  value: string;
  expires?: number;
  domain?: string;
};

function getRefreshTokenExpiresAt(cookie: StoredCookie): Date | null {
  if (cookie.value) {
    try {
      const payload = JSON.parse(
        Buffer.from(cookie.value.split(".")[1], "base64").toString(),
      );
      if (payload.exp) {
        return new Date(payload.exp * 1000);
      }
    } catch {
      // JWT 파싱 실패 시 cookie expires를 확인
    }
  }

  if (cookie.expires && cookie.expires > 0) {
    return new Date(cookie.expires * 1000);
  }

  return null;
}

// 환경별 auth 파일 선택:
// - STG는 stg-auth.json을 우선 사용하되, 없으면 auth.json의 .makeuni2026.com 토큰을 fallback으로 사용
// - Prod는 auth.json만 사용
const isSTG = process.env.MAKESTAR_BASE_URL?.includes("stage");
const authFileCandidates = isSTG
  ? ["./stg-auth.json", "./auth.json"]
  : ["./auth.json"];
const authFile =
  authFileCandidates.find((candidate) => fs.existsSync(candidate)) ??
  authFileCandidates[0];
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

if (fs.existsSync(authFile)) {
  try {
    const authData = JSON.parse(fs.readFileSync(authFile, "utf-8"));
    // mock 데이터가 아닌 실제 세션인지 확인
    const hasMockData = authData.cookies?.some(
      (c: StoredCookie) =>
        c.value?.includes("mock_session") || c.value?.includes("mock_token"),
    );

    // refresh_token 유효성 확인
    // STG 실행은 .makeuni2026.com 토큰만 storageState로 자동 적용한다.
    // 기본 실행(auth.json)에 STG Admin 토큰만 있는 경우에는 유효성을 로그로만 알리고
    // prod storageState로 오인 적용하지 않는다.
    let hasValidRefreshToken = false;
    const targetDomain = isSTG ? ".makeuni2026.com" : ".makestar.com";
    const refreshCookies = (authData.cookies ?? []).filter(
      (c: StoredCookie) => c.name === "refresh_token",
    );
    const refreshCookie = refreshCookies.find(
      (c: StoredCookie) =>
        c.name === "refresh_token" && c.domain === targetDomain,
    );
    if (refreshCookie?.value) {
      const expiresAt = getRefreshTokenExpiresAt(refreshCookie);
      hasValidRefreshToken = !!expiresAt && expiresAt > new Date();
      if (hasValidRefreshToken) {
        console.log(
          `✅ ${authFile} refresh_token 유효 (${targetDomain}, 만료: ${expiresAt?.toISOString()})`,
        );
      }
    }

    hasValidAuthFile =
      !hasMockData && authData.cookies?.length > 5 && hasValidRefreshToken;
    if (hasValidAuthFile) {
      console.log(`✅ ${authFile} 로드됨 (쿠키 ${authData.cookies.length}개)`);
    } else if (!hasValidRefreshToken) {
      const otherValidDomains = refreshCookies
        .map((cookie: StoredCookie) => {
          const expiresAt = getRefreshTokenExpiresAt(cookie);
          if (!expiresAt || expiresAt <= new Date()) return null;
          return `${cookie.domain ?? "unknown"} (${expiresAt.toISOString()})`;
        })
        .filter((value: string | null): value is string => !!value);

      if (otherValidDomains.length > 0) {
        console.log(
          `ℹ️ ${authFile}에 ${targetDomain} refresh_token은 없지만 다른 유효 토큰이 있습니다: ${otherValidDomains.join(", ")}`,
        );
      } else {
        console.log(`⚠️ ${authFile}의 refresh_token이 없거나 만료됨`);
      }
    }
  } catch (e) {
    console.log(`⚠️ ${authFile} 파싱 실패`);
  }
}

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Global Setup 활성화 - 토큰 이슈 시 테스트 실행 전 즉시 갱신 시도
  // 갱신 실패 시 모든 테스트를 스킵하여 불필요한 반복 방지
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
    // Admin Setup Project - 인증 테스트를 먼저 실행
    // 토큰 만료 시 자동으로 브라우저를 열어 로그인 유도
    // =========================================================================
    {
      name: "admin-setup",
      testMatch: ["**/admin_auth_pom.spec.ts"],
      retries: 0, // Setup은 재시도 없이 한 번만 실행 (자동 로그인 포함)
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
        // Setup은 항상 headed 모드로 실행 (로그인 시 필요)
        headless: false,
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
