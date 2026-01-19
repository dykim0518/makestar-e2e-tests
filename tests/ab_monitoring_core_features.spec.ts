/**
 * AlbumBuddy 핵심 기능 모니터링 테스트
 * 매출 직결 Top 5 시나리오 기반 - 안정화 버전
 * 
 * 테스트 대상: https://albumbuddy.kr
 * 
 * 참고: 이 사이트는 첫 방문 시 팝업/모달이 있어 테스트가 불안정할 수 있음
 *       직접 URL 접근 테스트가 가장 안정적임
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'https://albumbuddy.kr/shop';

// 빈 storageState로 깨끗한 상태에서 시작
test.use({ 
  viewport: { width: 1280, height: 720 },
  actionTimeout: 30000,
  storageState: { cookies: [], origins: [] }
});

// 페이지 로딩 + overlay 제거 (안정화)
async function setupPage(page: Page): Promise<void> {
  // 완전 로딩 대기
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(4000);  // Vue hydration + 모달 로딩 대기
  
  // overlay 제거 시도 (5회 반복)
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => {
      document.querySelectorAll('.modal-overlay, [class*="overlay"], [class*="modal"]').forEach(el => {
        const htmlEl = el as HTMLElement;
        htmlEl.style.display = 'none';
        htmlEl.style.visibility = 'hidden';
        htmlEl.style.pointerEvents = 'none';
        htmlEl.style.opacity = '0';
      });
    });
    await page.waitForTimeout(300);
  }
  
  // ESC 키 여러 번 누르기
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
  }
  
  await page.waitForTimeout(500);
}

// ============================================================================
// 시나리오 1: 핵심 페이지 접근 테스트 (안정적)
// ============================================================================
test.describe('시나리오 1: 핵심 페이지 접근', () => {
  
  test('1-1. 홈페이지 타이틀 확인', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle('ALBUM BUDDY');
  });

  test('1-2. About 페이지 직접 접근', async ({ page }) => {
    await page.goto('https://albumbuddy.kr/about', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/about/i);
  });

  test('1-3. Pricing 페이지 직접 접근', async ({ page }) => {
    await page.goto('https://albumbuddy.kr/pricing', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/pricing/i);
  });

  test('1-4. Dashboard 페이지 직접 접근', async ({ page }) => {
    await page.goto('https://albumbuddy.kr/dashboard/purchasing', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/dashboard/i);
  });
});

// ============================================================================
// 시나리오 2: 네비게이션 버튼 테스트 (setupPage 후)
// ============================================================================
test.describe('시나리오 2: 네비게이션 버튼', () => {
  
  test('2-1. About 버튼 표시', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    await expect(page.getByRole('button', { name: 'About' })).toBeVisible({ timeout: 15000 });
  });

  test('2-2. Pricing 버튼 표시', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    await expect(page.getByRole('button', { name: 'Pricing' })).toBeVisible({ timeout: 15000 });
  });

  test('2-3. Dashboard 버튼 표시', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible({ timeout: 15000 });
  });

  test('2-4. Request item 버튼 표시', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    await expect(page.getByRole('button', { name: 'Request item' })).toBeVisible({ timeout: 15000 });
  });
});

// ============================================================================
// 시나리오 3: 네비게이션 이동 테스트 (JS 클릭)
// ============================================================================
test.describe('시나리오 3: 페이지 이동', () => {
  
  test('3-1. About 페이지로 이동', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent?.includes('About'));
      if (btn) btn.click();
    });
    
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/about/i, { timeout: 15000 });
  });

  test('3-2. Pricing 페이지로 이동', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent?.includes('Pricing'));
      if (btn) btn.click();
    });
    
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/pricing/i, { timeout: 15000 });
  });

  test('3-3. Dashboard 페이지로 이동', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent?.includes('Dashboard'));
      if (btn) btn.click();
    });
    
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/dashboard/i, { timeout: 15000 });
  });
});

// ============================================================================
// 시나리오 4: 브랜딩 테스트
// ============================================================================
test.describe('시나리오 4: 브랜딩', () => {
  
  test('4-1. MAKESTAR 스폰서 표시', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    // 스크롤 하단으로
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1500);
    
    // JavaScript로 텍스트 존재 확인
    const hasMakestar = await page.evaluate(() => {
      return document.body.innerText.includes('MAKESTAR');
    });
    
    expect(hasMakestar).toBe(true);
  });

  test('4-2. USD 통화 표시', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    // JavaScript로 텍스트 존재 확인
    const hasUSD = await page.evaluate(() => {
      return document.body.innerText.includes('USD');
    });
    
    expect(hasUSD).toBe(true);
  });

  test('4-3. AlbumBuddy 로고/텍스트 표시', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    const hasAlbumBuddy = await page.evaluate(() => {
      return document.body.innerText.includes('AlbumBuddy') || 
             document.body.innerText.includes('앨범버디');
    });
    
    expect(hasAlbumBuddy).toBe(true);
  });
});

// ============================================================================
// 시나리오 5: 핵심 컨텐츠 테스트 (JS 체크)
// ============================================================================
test.describe('시나리오 5: 핵심 컨텐츠', () => {
  
  test('5-1. Artists 섹션 존재', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    const hasSection = await page.evaluate(() => {
      return document.body.innerText.includes('Artists');
    });
    
    expect(hasSection).toBe(true);
  });

  test('5-2. Recent Albums 섹션 존재', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    const hasSection = await page.evaluate(() => {
      return document.body.innerText.includes('Recent Albums');
    });
    
    expect(hasSection).toBe(true);
  });

  test('5-3. Trending 섹션 존재', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    const hasSection = await page.evaluate(() => {
      return document.body.innerText.includes('Trending');
    });
    
    expect(hasSection).toBe(true);
  });

  test('5-4. Official Partner 섹션 존재', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    const hasSection = await page.evaluate(() => {
      return document.body.innerText.includes('Official Partner');
    });
    
    expect(hasSection).toBe(true);
  });

  test('5-5. Show more 버튼 존재', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    const hasButton = await page.evaluate(() => {
      return document.body.innerText.includes('Show more');
    });
    
    expect(hasButton).toBe(true);
  });
});

// ============================================================================
// E2E 통합 테스트
// ============================================================================
test.describe('E2E 통합 테스트', () => {
  
  test('E2E-1. 홈 → About → 홈 네비게이션', async ({ page }) => {
    // 홈페이지
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    await expect(page).toHaveTitle('ALBUM BUDDY');
    
    // About으로 이동
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent?.includes('About'));
      if (btn) btn.click();
    });
    await page.waitForTimeout(3000);
    await expect(page).toHaveURL(/about/i);
    
    // 다시 홈으로
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle('ALBUM BUDDY');
  });

  test('E2E-2. 전체 URL 접근 확인', async ({ page }) => {
    // 홈
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle('ALBUM BUDDY');
    
    // About
    await page.goto('https://albumbuddy.kr/about');
    await expect(page).toHaveURL(/about/i);
    
    // Pricing
    await page.goto('https://albumbuddy.kr/pricing');
    await expect(page).toHaveURL(/pricing/i);
    
    // Dashboard
    await page.goto('https://albumbuddy.kr/dashboard');
    await expect(page).toHaveURL(/dashboard/i);
  });

  test('E2E-3. 핵심 컨텐츠 전체 확인', async ({ page }) => {
    await page.goto(BASE_URL, { waitUntil: 'networkidle' });
    await setupPage(page);
    
    // 모든 핵심 컨텐츠 한번에 체크 (영어 사이트)
    const pageContent = await page.evaluate(() => document.body.innerText);
    
    expect(pageContent).toContain('Artists');
    expect(pageContent).toContain('Recent Albums');
    expect(pageContent).toContain('Show more');
  });
});
