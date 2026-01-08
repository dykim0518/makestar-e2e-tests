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
    hasValidAuthFile = !hasMockData && authData.cookies?.length > 5;
    if (hasValidAuthFile) {
      console.log(`✅ auth.json 로드됨 (쿠키 ${authData.cookies.length}개)`);
    }
  } catch (e) {
    console.log('⚠️ auth.json 파싱 실패');
  }
}

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 1,
  /* 로컬에서 워커 수 제한 (리소스 경쟁 방지) */
  workers: process.env.CI ? 1 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Test timeout - 60초 */
  timeout: 60000,
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 30000,
    
    // headless mode 설정 (false로 설정하면 브라우저가 보임)
    headless: false,
    
    // viewport 설정 (1920x1080 Full HD)
    viewport: { width: 1920, height: 1080 },
    
    // 유효한 auth.json이 있으면 자동으로 세션 사용
    ...(hasValidAuthFile ? { storageState: authFile } : {}),
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'npm run start',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  // },
});

