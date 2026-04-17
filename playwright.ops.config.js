// @ts-check
import { defineConfig, devices } from '@playwright/test';

/**
 * 변경성/운영용 Playwright 설정
 *
 * - @suite:ops 태그가 붙은 테스트만 실행
 * - @suite:exploratory 태그가 붙은 탐색성 테스트는 제외
 * - 생성/수정/삭제 계열은 재시도하지 않음
 * - self-hosted 또는 로컬 수동 실행 전용
 */
export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/backup/**', '**/save-auth*', '**/ab-save-auth*'],
  grepInvert: /@suite:exploratory/,

  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  workers: 1,

  reporter: [
    ['html', { open: 'never' }],
    ['list'],
    ['json', { outputFile: 'test-results/results.json' }],
    ['./lib/live-reporter.js'],
  ],

  timeout: 120000,

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    navigationTimeout: 30000,
    headless: true,
    viewport: { width: 1920, height: 1080 },
  },

  projects: [
    {
      name: 'admin-setup',
      testMatch: ['**/admin_auth_pom.spec.ts'],
      retries: 0,
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        storageState: './auth.json',
      },
    },
    {
      name: 'admin-ops',
      testMatch: [
        '**/admin_product_pom.spec.ts',
        '**/admin_order_pom.spec.ts',
        '**/admin_user_pom.spec.ts',
        '**/admin_artist_pom.spec.ts',
        '**/admin_poca_album_pom.spec.ts',
        '**/admin_poca_content_pom.spec.ts',
        '**/admin_poca_dashboard_pom.spec.ts',
        '**/admin_poca_readonly_pom.spec.ts',
        '**/admin_poca_shop_pom.spec.ts',
      ],
      grep: /@suite:ops/,
      dependencies: ['admin-setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        storageState: './auth.json',
      },
    },
  ],
});
