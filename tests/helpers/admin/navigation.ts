/**
 * Admin 테스트용 공통 네비게이션 헬퍼
 */

import { Page, expect } from '@playwright/test';

// 공통 타임아웃 설정
const TIMEOUTS = {
  NAVIGATION: 30000,
  TABLE_LOAD: 30000,
  NETWORK_IDLE: 10000,
  DEFAULT: 5000,
} as const;

// 공통 셀렉터 패턴
const COMMON_SELECTORS = {
  table: 'table',
  tableRows: 'table tbody tr',
  tableHeaders: 'table thead th',
  noResultMessage: 'text=검색결과가 없습니다',
  pagination: {
    nav: 'nav[aria-label="Pagination"]',
    previousButton: 'button:has-text("Previous")',
    nextButton: 'button:has-text("Next")',
    pageButton: (num: number) => `button:has-text("${num}")`,
    perPageSelect: 'text=10 / page',
  },
  breadcrumb: 'nav[aria-label="Breadcrumb"]',
  searchButton: 'button:has-text("조회하기")',
  resetButton: 'button:has-text("검색 초기화")',
} as const;

/**
 * 테이블 데이터 로드 대기
 * 
 * @param page Playwright Page 객체
 * @param timeout 대기 시간 (기본: 30초)
 * @returns 로드된 행 수
 */
export async function waitForTableData(
  page: Page, 
  timeout: number = TIMEOUTS.TABLE_LOAD
): Promise<number> {
  await page.waitForSelector(COMMON_SELECTORS.tableRows, { timeout });
  const rows = page.locator(COMMON_SELECTORS.tableRows);
  return await rows.count();
}

/**
 * 조회하기 버튼 클릭 후 데이터 로드 대기
 * 
 * networkidle은 폴링/분석 등으로 절대 도달하지 않아 멈춤 원인이 됨.
 * 검색 후 테이블 데이터가 실제로 로드될 때까지 명시적으로 대기.
 * 
 * @param page Playwright Page 객체
 * @param searchButtonSelector 검색 버튼 셀렉터 (기본: '조회하기')
 */
export async function clickSearchAndWait(
  page: Page,
  searchButtonSelector: string = COMMON_SELECTORS.searchButton
): Promise<void> {
  await page.locator(searchButtonSelector).click();
  
  // 검색 결과가 나타날 때까지 대기 (테이블 행 또는 "검색결과가 없습니다" 메시지)
  await Promise.race([
    page.waitForSelector(COMMON_SELECTORS.tableRows, { timeout: TIMEOUTS.TABLE_LOAD }).catch(() => null),
    page.waitForSelector(COMMON_SELECTORS.noResultMessage, { timeout: TIMEOUTS.TABLE_LOAD }).catch(() => null),
  ]);
  
  // DOM이 안정화될 때까지 짧게 대기
  await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.NETWORK_IDLE });
}

/**
 * 검색 초기화 버튼 클릭
 * 
 * @param page Playwright Page 객체
 * @param resetButtonSelector 초기화 버튼 셀렉터 (기본: '검색 초기화')
 */
export async function clickResetButton(
  page: Page,
  resetButtonSelector: string = COMMON_SELECTORS.resetButton
): Promise<void> {
  const resetButton = page.locator(resetButtonSelector);
  if (await resetButton.isEnabled()) {
    await resetButton.click();
    await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.NETWORK_IDLE });
  }
}

/**
 * 페이지 네비게이션 대기
 * 
 * networkidle 사용 시 SPA 폴링/분석 때문에 멈춤 가능 → domcontentloaded 사용.
 * 로그인 페이지로 리다이렉트되었는지 확인하고, 필요시 재시도.
 * 
 * @param page Playwright Page 객체
 * @param url 이동할 URL
 * @param retryCount 최대 재시도 횟수 (기본: 2)
 */
export async function navigateAndWait(
  page: Page,
  url: string,
  retryCount: number = 2
): Promise<void> {
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUTS.NAVIGATION });
    } catch (e: any) {
      if (attempt < retryCount) {
        console.warn(`⚠️ 페이지 로드 실패 (시도 ${attempt + 1}/${retryCount + 1}) - 재시도`);
        await page.waitForTimeout(500);
        continue;
      }
      throw e;
    }
    
    // 짧은 대기 후 URL 확인 (SPA 리다이렉트 대기) - 500ms로 단축
    await page.waitForTimeout(500);
    const currentUrl = page.url();
    
    // 로그인 페이지로 리다이렉트되었는지 확인
    if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
      if (attempt < retryCount) {
        console.warn(`⚠️ 로그인 페이지로 리다이렉트됨 (시도 ${attempt + 1}/${retryCount + 1}) - 인증 쿠키 재설정 후 재시도`);
        // 인증 쿠키 재설정을 위해 setupAuthCookies 호출 (동적 import)
        try {
          const { setupAuthCookies, resetAuthCache } = await import('../admin/auth-helper');
          // 캐시 초기화 후 재설정
          resetAuthCache();
          await setupAuthCookies(page);
          await page.waitForTimeout(300);
          continue;
        } catch (e) {
          console.error('❌ setupAuthCookies 호출 실패:', e);
        }
      } else {
        throw new Error(`인증 실패: 페이지가 로그인 페이지로 리다이렉트되었습니다. (${currentUrl})`);
      }
    } else {
      // 정상적으로 페이지 로드됨
      return;
    }
  }
}

/**
 * 페이지네이션 다음 페이지 이동
 * 
 * @param page Playwright Page 객체
 * @returns 이동 성공 여부
 */
export async function goToNextPage(page: Page): Promise<boolean> {
  const nextButton = page.locator(COMMON_SELECTORS.pagination.nextButton);
  const isEnabled = await nextButton.isEnabled().catch(() => false);
  
  if (!isEnabled) {
    console.log('ℹ️ Next 버튼이 비활성화되어 있습니다.');
    return false;
  }
  
  await nextButton.click();
  await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.NETWORK_IDLE });
  return true;
}

/**
 * 특정 페이지 번호로 이동
 * 
 * @param page Playwright Page 객체
 * @param pageNum 이동할 페이지 번호
 * @returns 이동 성공 여부
 */
export async function goToPage(page: Page, pageNum: number): Promise<boolean> {
  const paginationNav = page.locator(COMMON_SELECTORS.pagination.nav);
  const pageButton = paginationNav.getByRole('button', { name: String(pageNum), exact: true });
  
  const isVisible = await pageButton.isVisible().catch(() => false);
  if (!isVisible) {
    console.log(`ℹ️ 페이지 ${pageNum} 버튼이 없습니다.`);
    return false;
  }
  
  await paginationNav.scrollIntoViewIfNeeded();
  await pageButton.click({ force: true });
  await page.waitForLoadState('domcontentloaded', { timeout: TIMEOUTS.NETWORK_IDLE });
  return true;
}
