// @ts-check
import { defineConfig, devices } from '@playwright/test';
import * as fs from 'fs';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// import dotenv from 'dotenv';
// import path from 'path';
// dotenv.config({ path: path.resolve(__dirname, '.env') });

// auth.json 파일이 있고 유효한지 확인
const authFile = './auth.json';
let hasValidAuthFile = false;

if (fs.existsSync(authFile)) {
  try {
    const authData = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
    // mock 데이터가 아닌 실제 세션인지 확인
    const hasMockData = authData.cookies?.some(c => 
      c.value?.includes('mock_session') || c.value?.includes('mock_token')
    );
    
    // refresh_token JWT가 유효한지 확인
    let hasValidRefreshToken = false;
    const refreshCookie = authData.cookies?.find(c => c.name === 'refresh_token');
    if (refreshCookie?.value) {
      try {
        const payload = JSON.parse(Buffer.from(refreshCookie.value.split('.')[1], 'base64').toString());
        const expiresAt = new Date(payload.exp * 1000);
        hasValidRefreshToken = expiresAt > new Date();
        if (hasValidRefreshToken) {
          console.log(`✅ auth.json refresh_token 유효`);
        }
      } catch {}
    }
    
    hasValidAuthFile = !hasMockData && authData.cookies?.length > 5 && hasValidRefreshToken;
    if (hasValidAuthFile) {
      console.log(`✅ auth.json 로드됨 (쿠키 ${authData.cookies.length}개)`);
    } else if (!hasValidRefreshToken) {
      console.log('⚠️ auth.json의 refresh_token이 없거나 만료됨');
    }
  } catch (e) {
    console.log('⚠️ auth.json 파싱 실패');
  }
}

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Global Setup 활성화 - 토큰 이슈 시 테스트 실행 전 즉시 갱신 시도
  // 갱신 실패 시 모든 테스트를 스킵하여 불필요한 반복 방지
  globalSetup: './global-setup.js',
  testDir: './tests',
  // 백업 및 POC 파일 제외
  testIgnore: '**/backup/**',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only - 로컬에서도 2회 재시도로 인증 이슈 대응 */
  retries: process.env.CI ? 2 : 2,
  /* 로컬에서 워커 수 제한 (인증 경쟁 방지를 위해 2로 감소) */
  workers: process.env.CI ? 1 : 2,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Test timeout - 90초로 증가 (인증 재시도 시간 확보) */
  timeout: 90000,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 30000,
    
    // headless mode 설정 (true = 숨김, false = 브라우저 표시)
    // 환경변수 HEADED=true로 브라우저를 표시할 수 있음 (예: HEADED=true npx playwright test)
    headless: process.env.HEADED !== 'true',
    
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
      name: 'admin-setup',
      testMatch: ['**/admin_auth_pom.spec.ts'],
      retries: 0,  // Setup은 재시도 없이 한 번만 실행 (자동 로그인 포함)
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Setup은 항상 headed 모드로 실행 (로그인 시 필요)
        headless: false,
      },
    },
    // Admin 테스트 전용 (PC 환경만) - Setup 완료 후 실행
    {
      name: 'admin-pc',
      testMatch: ['**/admin_product_pom.spec.ts', '**/admin_order_pom_spec.ts'],
      dependencies: ['admin-setup'],  // Setup 프로젝트에 의존
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        headless: process.env.HEADED !== 'true',
      },
    },
    // 일반 테스트 (PC 환경) - Admin 테스트 제외
    {
      name: 'chromium',
      testIgnore: ['**/admin_*.spec.ts', '**/backup/**'],
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    // 모바일 뷰포트 테스트 - Admin 테스트 제외
    {
      name: 'mobile-chrome',
      testIgnore: ['**/admin_*.spec.ts', '**/backup/**'],
      use: { 
        ...devices['Pixel 5'],
        // 모바일에서도 auth 유지
        ...(hasValidAuthFile ? { storageState: authFile } : {}),
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
