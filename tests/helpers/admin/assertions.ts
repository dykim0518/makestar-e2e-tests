/**
 * Admin 테스트용 공통 Assertion 헬퍼
 */

import { Page, expect, Locator } from '@playwright/test';

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
 * 테이블 헤더 검증
 * 
 * @param page Playwright Page 객체
 * @param expectedHeaders 예상되는 헤더 텍스트 배열
 */
export async function assertTableHeaders(
  page: Page, 
  expectedHeaders: string[]
): Promise<void> {
  for (const header of expectedHeaders) {
    await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
  }
}

/**
 * 테이블 데이터 존재 여부 확인
 * 
 * @param page Playwright Page 객체
 * @returns 데이터 존재 여부
 */
export async function hasTableData(page: Page): Promise<boolean> {
  const rows = page.locator(COMMON_SELECTORS.tableRows);
  const noResultMessage = page.locator(COMMON_SELECTORS.noResultMessage);
  
  const rowCount = await rows.count();
  const hasNoResult = await noResultMessage.isVisible().catch(() => false);
  
  return rowCount > 0 && !hasNoResult;
}

/**
 * 검색 결과 없음 메시지 확인
 * 
 * @param page Playwright Page 객체
 * @param timeout 대기 시간
 */
export async function assertNoSearchResult(
  page: Page,
  timeout: number = 10000
): Promise<void> {
  const noResultMessage = page.locator(COMMON_SELECTORS.noResultMessage);
  await expect(noResultMessage).toBeVisible({ timeout });
}

/**
 * 페이지 타이틀 확인 (MAKESTAR Admin 패턴)
 * 
 * @param page Playwright Page 객체
 */
export async function assertAdminPageTitle(page: Page): Promise<void> {
  await expect(page).toHaveTitle(/MAKESTAR.*Admin/);
}

/**
 * 브레드크럼 경로 확인
 * 
 * @param page Playwright Page 객체
 * @param expectedPath 예상되는 경로 텍스트 배열
 */
export async function assertBreadcrumb(
  page: Page, 
  expectedPath: string[]
): Promise<void> {
  const breadcrumb = page.locator(COMMON_SELECTORS.breadcrumb);
  await expect(breadcrumb).toBeVisible();
  
  for (const path of expectedPath) {
    await expect(breadcrumb).toContainText(path);
  }
}

/**
 * 체크박스 전체 선택/해제 확인
 * 
 * @param page Playwright Page 객체
 * @param shouldBeChecked 체크 상태 예상값
 */
export async function assertAllCheckboxes(
  page: Page, 
  shouldBeChecked: boolean
): Promise<void> {
  const rowCheckboxes = page.locator(COMMON_SELECTORS.tableRows).locator('input[type="checkbox"]');
  const count = await rowCheckboxes.count();
  
  for (let i = 0; i < count; i++) {
    if (shouldBeChecked) {
      await expect(rowCheckboxes.nth(i)).toBeChecked();
    } else {
      await expect(rowCheckboxes.nth(i)).not.toBeChecked();
    }
  }
}

/**
 * 페이지당 표시 개수 확인 (기본 10개 이하)
 * 
 * @param page Playwright Page 객체
 * @param maxRows 최대 행 수 (기본: 10)
 */
export async function assertRowCountWithinLimit(
  page: Page, 
  maxRows: number = 10
): Promise<void> {
  const rows = page.locator(COMMON_SELECTORS.tableRows);
  const rowCount = await rows.count();
  expect(rowCount).toBeLessThanOrEqual(maxRows);
}

/**
 * 첫 번째 행의 특정 열 텍스트 검증
 * 
 * @param page Playwright Page 객체
 * @param columnIndex 열 인덱스 (0부터 시작)
 * @param pattern 검증할 정규식 패턴
 */
export async function assertFirstRowCellFormat(
  page: Page,
  columnIndex: number,
  pattern: RegExp
): Promise<void> {
  const firstRow = page.locator(COMMON_SELECTORS.tableRows).first();
  if (await firstRow.isVisible()) {
    const cell = firstRow.locator('td').nth(columnIndex);
    const cellText = await cell.textContent();
    expect(cellText).toBeTruthy();
    expect(cellText).toMatch(pattern);
  }
}
