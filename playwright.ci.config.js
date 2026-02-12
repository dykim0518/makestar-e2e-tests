// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * CI 전용 Playwright 설정
 *
 * 로컬 설정(playwright.config.js)과 분리하여 CI 환경에 최적화.
 * - globalSetup 없음 (브라우저 로그인 불가)
 * - auth.json은 GitHub Secrets에서 주입됨 (유효성 검증 불필요)
 * - headless 고정, chromium만 사용
 *
 * 사용법: npx playwright test --config=playwright.ci.config.js
 */
export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/backup/**', '**/save-auth*', '**/ab-save-auth*'],

  fullyParallel: true,
  forbidOnly: true,
  retries: 2,
  workers: 1,

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  timeout: 90000,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 30000,
    headless: true,
    viewport: { width: 1920, height: 1080 },
    storageState: './auth.json',
  },

  projects: [
    {
      name: 'cmr-monitoring',
      testMatch: ['**/cmr_monitoring_pom.spec.ts'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
  ],
});
