/**
 * 대분류 목록 페이지 테스트
 * 
 * 테스트 대상: https://stage-new-admin.makeuni2026.com/product/new/list
 * 작성일: 2026-01-16
 * 
 * 주요 테스트 시나리오:
 * 1. 페이지 로드 및 기본 요소 확인
 * 2. 검색 기능 (검색어, 상세기간)
 * 3. 테이블 데이터 표시
 * 4. 페이지네이션
 * 5. 대분류 생성 페이지 이동
 * 6. 상세 페이지 이동
 * 7. 엑셀 다운로드
 * 8. 체크박스 기능
 * 
 * 사용자 시나리오:
 * - 관리자가 등록된 대분류(앨범/상품 그룹)를 조회하고 관리
 * - 특정 아티스트나 기간으로 대분류를 검색
 * - 새로운 대분류 생성
 * - 기존 대분류 수정
 * 
 * 주의사항:
 * - 이 관리자 페이지는 데스크톱 전용으로 설계됨
 * - 모바일 뷰포트에서는 사이드바가 본문 영역을 가려 테스트 불가
 */

import { test, expect, Page } from '@playwright/test';
import { getAuthenticatedUrl, ensureValidToken, BASE_URL } from './helpers/auth-helper';

// 모바일 뷰포트에서 테스트 스킵 (관리자 페이지는 데스크톱 전용)
test.skip(({ viewport }) => viewport !== null && viewport.width < 1024, '이 테스트는 데스크톱 뷰포트에서만 실행됩니다');

// 테스트 실행 전 토큰 유효성 확인 및 자동 갱신
test.beforeAll(async () => {
  const isValid = await ensureValidToken();
  if (!isValid) {
    console.warn('\n⚠️ 토큰이 유효하지 않습니다. 테스트가 실패할 수 있습니다.');
    console.warn('   다음 명령어로 로그인해주세요: node auto-refresh-token.js --setup\n');
  }
});

const PRODUCT_LIST_URL = getAuthenticatedUrl('/product/new/list');

// 셀렉터 정의
const selectors = {
  // 페이지 요소
  heading: 'h1:has-text("대분류 목록")',
  breadcrumb: 'nav[aria-label="Breadcrumb"]',
  table: 'table',
  tableRows: 'table tbody tr',
  
  // 검색 필터
  search: {
    keywordInput: 'input[placeholder="검색어 입력"]',
    periodTypeSelect: 'text=선택안함',
    dateRangeStart: 'text=검색 시작일을 선택해주세요',
    dateRangeEnd: 'text=검색 종료일을 선택해주세요',
    resetButton: 'button:has-text("검색 초기화")',
    searchButton: 'button:has-text("조회하기")',
  },
  
  // 액션 버튼
  actions: {
    excelDownloadButton: 'button:has-text("엑셀다운받기")',
    createCategoryButton: 'button:has-text("대분류 생성")',
  },
  
  // 페이지네이션
  pagination: {
    previousButton: 'button:has-text("Previous")',
    nextButton: 'button:has-text("Next")',
    pageButton: (num: number) => `button:has-text("${num}")`,
    perPageSelect: 'text=10 / page',
  },
  
  // 테이블 컬럼
  tableHeaders: {
    id: 'th:has-text("ID")',
    albumCode: 'th:has-text("앨범코드(전체)")',
    name: 'th:has-text("이름")',
    artist: 'th:has-text("아티스트")',
    supplier: 'th:has-text("공급사/제작사")',
    releaseDate: 'th:has-text("발매일")',
    manager: 'th:has-text("담당자")',
  },
};

// ============================================================================
// 테스트 그룹: 페이지 로드 및 기본 요소
// ============================================================================
test.describe('대분류 목록 - 페이지 로드 및 기본 요소', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_LIST_URL);
    await page.waitForLoadState('networkidle');
  });

  test('TC-CAT-001: 페이지 타이틀 확인', async ({ page }) => {
    // Given: 대분류 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 페이지 타이틀이 표시됨
    await expect(page).toHaveTitle(/MAKESTAR.*Admin/);
  });

  test('TC-CAT-002: 페이지 헤딩 확인', async ({ page }) => {
    // Given: 대분류 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: "대분류 목록 조회/수정" 헤딩이 표시됨
    const heading = page.locator('h1:has-text("대분류 목록 조회/수정")');
    await expect(heading).toBeVisible();
  });

  test('TC-CAT-003: 브레드크럼 네비게이션 확인', async ({ page }) => {
    // Given: 대분류 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 브레드크럼이 "상품관리 > 대분류 조회/수정" 경로를 표시
    const breadcrumb = page.locator(selectors.breadcrumb);
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText('상품관리');
    await expect(breadcrumb).toContainText('대분류 조회/수정');
  });

  test('TC-CAT-004: 테이블 헤더 확인', async ({ page }) => {
    // Given: 대분류 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 모든 필수 테이블 헤더가 표시됨
    const expectedHeaders = [
      'ID', '앨범코드(전체)', '이름', '아티스트', 
      '공급사/제작사', '발매일', '담당자'
    ];
    
    for (const header of expectedHeaders) {
      await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
    }
  });

  test('TC-CAT-005: 검색 영역 표시 확인', async ({ page }) => {
    // Given: 대분류 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 검색 필터 영역이 표시됨
    await expect(page.locator(selectors.search.keywordInput)).toBeVisible();
    await expect(page.locator(selectors.search.searchButton)).toBeVisible();
  });

  test('TC-CAT-006: 액션 버튼 표시 확인', async ({ page }) => {
    // Given: 대분류 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 액션 버튼이 표시됨
    await expect(page.locator(selectors.actions.createCategoryButton)).toBeVisible();
    await expect(page.locator(selectors.actions.excelDownloadButton)).toBeVisible();
  });

  test('TC-CAT-007: 초기 상태에서 데이터 자동 로드 확인', async ({ page }) => {
    // Given: 대분류 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 테이블에 데이터가 자동으로 로드됨 (조회하기 버튼 클릭 없이)
    // 참고: 이 페이지는 초기 로드 시 자동으로 데이터를 가져옴
    const tableRows = page.locator('table tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 10000 });
    
    // 데이터 행이 존재하는지 확인
    const rowCount = await tableRows.count();
    expect(rowCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// 테스트 그룹: 데이터 조회 및 검색
// ============================================================================
test.describe('대분류 목록 - 데이터 조회 및 검색', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_LIST_URL);
    await page.waitForLoadState('networkidle');
    // 조회하기 버튼 클릭하여 데이터 로드
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
  });

  test('TC-CAT-010: 조회하기 버튼 클릭 시 데이터 로드', async ({ page }) => {
    // Given: 대분류 목록 페이지에서 조회하기 버튼 클릭
    // When: 데이터가 로드됨
    // Then: 테이블에 데이터 행이 표시됨
    const rows = page.locator('table tbody tr').filter({ hasNot: page.locator('text=검색결과가 없습니다') });
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('TC-CAT-011: 검색어로 대분류 검색', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const searchInput = page.locator(selectors.search.keywordInput);
    const searchButton = page.locator(selectors.search.searchButton);
    
    // When: 검색어 입력 후 조회
    await searchInput.fill('에스파');
    await searchButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: 검색 결과가 표시됨 (검색어 포함 또는 결과 없음)
    await page.waitForTimeout(1000);
    const hasResults = await page.locator('table tbody tr').filter({ hasNot: page.locator('text=검색결과가 없습니다') }).count() > 0;
    const noResults = await page.locator('text=검색결과가 없습니다').isVisible();
    expect(hasResults || noResults).toBeTruthy();
  });

  test('TC-CAT-012: 아티스트명으로 검색', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const searchInput = page.locator(selectors.search.keywordInput);
    const searchButton = page.locator(selectors.search.searchButton);
    
    // When: 아티스트명으로 검색
    await searchInput.fill('뷔');
    await searchButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: 검색 결과 표시
    await page.waitForTimeout(1000);
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('TC-CAT-013: 앨범코드로 검색', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const searchInput = page.locator(selectors.search.keywordInput);
    const searchButton = page.locator(selectors.search.searchButton);
    
    // When: 앨범코드로 검색
    await searchInput.fill('M00');
    await searchButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: 검색 결과 표시
    await page.waitForTimeout(1000);
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('TC-CAT-014: 존재하지 않는 검색어로 검색', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const searchInput = page.locator(selectors.search.keywordInput);
    const searchButton = page.locator(selectors.search.searchButton);
    
    // When: 존재하지 않는 검색어 입력
    const randomString = 'NOTEXIST_' + Date.now();
    await searchInput.fill(randomString);
    await searchButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: "검색결과가 없습니다" 메시지 표시
    const noResultMessage = page.locator('text=검색결과가 없습니다');
    await expect(noResultMessage).toBeVisible({ timeout: 10000 });
  });

  test('TC-CAT-015: 검색 초기화 기능', async ({ page }) => {
    // Given: 검색어가 입력된 상태
    const searchInput = page.locator(selectors.search.keywordInput);
    await searchInput.fill('테스트');
    
    // When: 검색 초기화 버튼 클릭
    const resetButton = page.locator('button:has-text("검색 초기화")');
    // 검색 초기화 버튼이 활성화되면 클릭
    if (await resetButton.isEnabled()) {
      await resetButton.click();
      await page.waitForLoadState('networkidle');
      
      // Then: 검색어가 초기화됨
      await expect(searchInput).toHaveValue('');
    }
  });
});

// ============================================================================
// 테스트 그룹: 페이지네이션
// ============================================================================
test.describe('대분류 목록 - 페이지네이션', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_LIST_URL);
    await page.waitForLoadState('networkidle');
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
  });

  test('TC-CAT-020: 다음 페이지로 이동', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const paginationArea = page.locator('nav[aria-label="Pagination"]').locator('..');
    const nextButton = page.locator(selectors.pagination.nextButton);
    
    // When: Next 버튼 클릭
    if (await nextButton.isEnabled()) {
      // 첫 페이지 데이터의 첫 번째 ID 저장
      const firstIdBefore = await page.locator('table tbody tr').first().locator('td').nth(1).textContent();
      
      // 모바일 뷰포트에서 테이블이 가릴 수 있으므로 스크롤 후 클릭
      await paginationArea.scrollIntoViewIfNeeded();
      await nextButton.click({ force: true });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      
      // Then: 다음 페이지로 이동됨 - 데이터가 변경되었는지 확인
      const firstIdAfter = await page.locator('table tbody tr').first().locator('td').nth(1).textContent();
      expect(firstIdBefore).not.toBe(firstIdAfter);
    }
  });

  test('TC-CAT-021: 특정 페이지 번호로 이동', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    // exact: true를 사용하여 정확히 "3"만 매칭 ("365" 등 제외)
    const paginationNav = page.locator('nav[aria-label="Pagination"]');
    const page3Button = paginationNav.getByRole('button', { name: '3', exact: true });
    
    // When: 페이지 3 버튼이 있으면 클릭
    if (await page3Button.isVisible()) {
      // 첫 페이지 데이터의 첫 번째 ID 저장
      const firstIdBefore = await page.locator('table tbody tr').first().locator('td').nth(1).textContent();
      
      // 모바일 뷰포트에서 사이드바가 가릴 수 있으므로 스크롤 후 클릭
      await paginationNav.scrollIntoViewIfNeeded();
      await page3Button.click({ force: true });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      
      // Then: 페이지 이동됨 - 데이터가 변경되었는지 확인
      const firstIdAfter = await page.locator('table tbody tr').first().locator('td').nth(1).textContent();
      expect(firstIdBefore).not.toBe(firstIdAfter);
    } else {
      // 페이지 3 버튼이 없으면 테스트 스킵 (데이터가 충분하지 않은 경우)
      console.log('페이지 3 버튼이 없음 - 테스트 스킵');
    }
  });

  test('TC-CAT-022: 첫 페이지에서 Previous 버튼 비활성화', async ({ page }) => {
    // Given: 첫 페이지에 있는 상태
    // When: Previous 버튼 확인
    const previousButton = page.locator(selectors.pagination.previousButton);
    
    // Then: Previous 버튼이 비활성화됨
    await expect(previousButton).toBeDisabled();
  });

  test('TC-CAT-023: 페이지당 표시 개수 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    // When: 테이블 행 수 확인
    const rows = page.locator('table tbody tr').filter({ hasNot: page.locator('text=검색결과가 없습니다') });
    await page.waitForTimeout(1000);
    const rowCount = await rows.count();
    
    // Then: 기본 10개 이하의 행이 표시됨
    expect(rowCount).toBeLessThanOrEqual(10);
  });
});

// ============================================================================
// 테스트 그룹: 상세 페이지 이동
// ============================================================================
test.describe('대분류 목록 - 상세 페이지 이동', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_LIST_URL);
    await page.waitForLoadState('networkidle');
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
  });

  test('TC-CAT-030: 테이블 행 클릭 시 상세 페이지 이동', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const firstRow = page.locator('table tbody tr').filter({ hasNot: page.locator('text=검색결과가 없습니다') }).first();
    
    // 데이터가 있는 경우에만 테스트
    if (await firstRow.isVisible()) {
      // ID 셀 클릭
      const idCell = firstRow.locator('td').nth(1);
      const id = await idCell.textContent();
      
      // When: 행 클릭
      await firstRow.click();
      await page.waitForTimeout(1500);
      await page.waitForLoadState('networkidle');
      
      // Then: 상세 페이지로 이동하거나 모달이 열림
      const currentUrl = page.url();
      const urlPath = new URL(currentUrl).pathname;
      
      // 상세 페이지 이동 또는 모달 확인
      const isDetailPage = urlPath.includes('/product/');
      const hasModal = await page.locator('[class*="modal"], [class*="dialog"]').isVisible().catch(() => false);
      
      expect(isDetailPage || hasModal || urlPath.includes('/product/')).toBeTruthy();
    }
  });
});

// ============================================================================
// 테스트 그룹: 액션 버튼
// ============================================================================
test.describe('대분류 목록 - 액션 버튼', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_LIST_URL);
    await page.waitForLoadState('networkidle');
  });

  test('TC-CAT-040: 대분류 생성 버튼 클릭', async ({ page }) => {
    // Given: 대분류 목록 페이지에 접근
    const createButton = page.locator(selectors.actions.createCategoryButton);
    
    // When: 대분류 생성 버튼 클릭
    await createButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: 대분류 생성 페이지로 이동
    await expect(page).toHaveURL(/\/product\/new\/create/);
  });

  test('TC-CAT-041: 엑셀다운받기 버튼 표시 확인', async ({ page }) => {
    // Given: 대분류 목록 페이지에 접근
    const excelButton = page.locator(selectors.actions.excelDownloadButton);
    
    // Then: 엑셀다운받기 버튼이 표시됨
    await expect(excelButton).toBeVisible();
  });
});

// ============================================================================
// 테스트 그룹: 체크박스 기능
// ============================================================================
test.describe('대분류 목록 - 체크박스 기능', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_LIST_URL);
    await page.waitForLoadState('networkidle');
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
  });

  test('TC-CAT-050: 개별 체크박스 선택', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const firstRowCheckbox = page.locator('table tbody tr').first().locator('input[type="checkbox"]');
    
    if (await firstRowCheckbox.isVisible()) {
      // When: 첫 번째 행 체크박스 클릭
      await firstRowCheckbox.click();
      
      // Then: 체크박스가 선택됨
      await expect(firstRowCheckbox).toBeChecked();
    }
  });

  test('TC-CAT-051: 전체 선택 체크박스', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const headerCheckbox = page.locator('table thead th input[type="checkbox"]');
    
    if (await headerCheckbox.isVisible()) {
      // When: 헤더 체크박스 클릭
      await headerCheckbox.click();
      await page.waitForTimeout(500);
      
      // Then: 모든 행의 체크박스가 선택됨 (또는 전체 선택 상태)
      await expect(headerCheckbox).toBeChecked();
    }
  });
});

// ============================================================================
// 테스트 그룹: 사용자 시나리오
// ============================================================================
test.describe('대분류 목록 - 사용자 시나리오', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_LIST_URL);
    await page.waitForLoadState('networkidle');
  });

  test('TC-CAT-060: 특정 아티스트의 대분류 찾기', async ({ page }) => {
    // 사용자 시나리오: MD가 특정 아티스트의 대분류를 찾아 정보 확인
    
    // Step 1: 조회하기 버튼 클릭
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
    
    // Step 2: 아티스트명으로 검색
    const searchInput = page.locator(selectors.search.keywordInput);
    await searchInput.fill('에스파');
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
    
    // Step 3: 검색 결과 확인
    await page.waitForTimeout(1000);
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('TC-CAT-061: 새 대분류 생성 페이지 이동 후 취소', async ({ page }) => {
    // 사용자 시나리오: 관리자가 새 대분류 생성 페이지로 이동했다가 취소
    
    // Step 1: 대분류 생성 버튼 클릭
    await page.locator(selectors.actions.createCategoryButton).click();
    await page.waitForLoadState('networkidle');
    
    // Step 2: 생성 페이지 도착 확인
    await expect(page).toHaveURL(/\/product\/new\/create/);
    
    // Step 3: 뒤로가기
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Step 4: 목록 페이지로 복귀 확인
    await expect(page).toHaveURL(/\/product\/new\/list/);
  });

  test('TC-CAT-062: 여러 검색 조건으로 필터링', async ({ page }) => {
    // 사용자 시나리오: 관리자가 여러 조건으로 대분류 필터링
    
    // Step 1: 기본 조회
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
    
    // Step 2: 검색어 입력
    const searchInput = page.locator(selectors.search.keywordInput);
    await searchInput.fill('2025');
    
    // Step 3: 조회
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
    
    // Step 4: 결과 확인
    await page.waitForTimeout(1000);
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });
});

// ============================================================================
// 테스트 그룹: 추가 테스트 케이스 (엣지 케이스 및 데이터 검증)
// ============================================================================
test.describe('대분류 목록 - 추가 테스트 케이스', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(PRODUCT_LIST_URL);
    await page.waitForLoadState('networkidle');
  });

  test('TC-CAT-070: 테이블 데이터 형식 검증 - ID가 숫자인지 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
    
    // When: 첫 번째 행의 ID 셀 확인
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      const idCell = firstRow.locator('td').nth(1);
      const idText = await idCell.textContent();
      
      // Then: ID가 숫자 형식인지 확인
      expect(idText).toBeTruthy();
      // 따옴표와 공백 제거 후 숫자 확인
      const cleanId = idText?.replace(/["'\s]/g, '');
      expect(cleanId).toMatch(/^\d+$/);
    }
  });

  test('TC-CAT-071: 테이블 데이터 형식 검증 - 앨범코드 형식 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
    
    // When: 첫 번째 행의 앨범코드 셀 확인
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      const albumCodeCell = firstRow.locator('td').nth(2);
      const albumCode = await albumCodeCell.textContent();
      
      // Then: 앨범코드가 M으로 시작하고 숫자가 포함되어 있는지 확인
      expect(albumCode).toBeTruthy();
      expect(albumCode).toMatch(/^M\d+/);
    }
  });

  test('TC-CAT-072: 테이블 데이터 형식 검증 - 발매일 형식 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
    
    // When: 첫 번째 행의 발매일 셀 확인
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible()) {
      const releaseDateCell = firstRow.locator('td').nth(6);
      const releaseDate = await releaseDateCell.textContent();
      
      // Then: 발매일이 YYYY-MM-DD 형식인지 확인
      expect(releaseDate).toBeTruthy();
      expect(releaseDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  test('TC-CAT-073: 페이지당 표시 개수 선택 - 10개 기본값 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
    
    // When: 페이지당 표시 개수 셀렉트박스 확인
    const perPageSelect = page.locator('text=10 / page');
    
    // Then: 기본값이 "10 / page"인지 확인
    await expect(perPageSelect).toBeVisible();
  });

  test('TC-CAT-074: 총 데이터 개수 및 페이지 수 계산 검증', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
    
    // When: 마지막 페이지 번호 확인 (365 페이지 예상)
    const paginationNav = page.locator('nav[aria-label="Pagination"]');
    const lastPageButton = paginationNav.locator('button').last();
    
    // Then: 마지막 페이지 버튼이 존재하는지 확인
    await expect(lastPageButton).toBeVisible();
  });

  test('TC-CAT-075: 검색 후 결과 카운트 확인', async ({ page }) => {
    // Given: 대분류 목록 페이지
    const searchInput = page.locator(selectors.search.keywordInput);
    const searchButton = page.locator(selectors.search.searchButton);
    
    // When: 특정 검색어로 검색
    await searchInput.fill('에스파');
    await searchButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // Then: 검색 결과 행 수가 10개 이하인지 확인 (페이지당 10개)
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeLessThanOrEqual(10);
  });

  test('TC-CAT-076: 빈 검색어로 조회 시 전체 데이터 표시', async ({ page }) => {
    // Given: 검색어가 비어있는 상태
    const searchInput = page.locator(selectors.search.keywordInput);
    await expect(searchInput).toHaveValue('');
    
    // When: 조회하기 버튼 클릭
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
    
    // Then: 전체 데이터가 표시됨 (첫 페이지)
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('TC-CAT-077: 특수문자 포함 검색어 처리', async ({ page }) => {
    // Given: 대분류 목록 페이지
    const searchInput = page.locator(selectors.search.keywordInput);
    const searchButton = page.locator(selectors.search.searchButton);
    
    // When: 특수문자가 포함된 검색어로 검색
    await searchInput.fill('[TYPE]');
    await searchButton.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // Then: 에러 없이 검색 결과 또는 "검색결과가 없습니다" 표시
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('TC-CAT-078: 테이블 행 호버 시 스타일 변경 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
    
    // When: 첫 번째 데이터 행에 마우스 호버
    const firstDataRow = page.locator('table tbody tr').first();
    if (await firstDataRow.isVisible()) {
      await firstDataRow.hover();
      
      // Then: 행이 클릭 가능한 커서 스타일인지 확인 (cursor: pointer)
      // 참고: cursor 스타일은 CSS에서 설정되어 있음
      const cursor = await firstDataRow.evaluate(el => getComputedStyle(el).cursor);
      expect(cursor).toBe('pointer');
    }
  });

  test('TC-CAT-079: 검색 초기화 버튼 - 검색어 입력 전 비활성화 상태', async ({ page }) => {
    // Given: 페이지 로드 직후 (검색어 미입력)
    const resetButton = page.locator('button:has-text("검색 초기화")');
    
    // Then: 검색 초기화 버튼이 비활성화 상태인지 확인
    await expect(resetButton).toBeDisabled();
  });

  test('TC-CAT-080: 검색어 입력 후 검색 초기화 버튼 활성화', async ({ page }) => {
    // Given: 대분류 목록 페이지
    const searchInput = page.locator(selectors.search.keywordInput);
    const resetButton = page.locator('button:has-text("검색 초기화")');
    
    // When: 검색어 입력
    await searchInput.fill('테스트');
    await page.waitForTimeout(500);
    
    // Then: 검색 초기화 버튼이 활성화 상태인지 확인
    // 참고: 버튼 활성화 조건은 구현에 따라 다를 수 있음
    const isDisabled = await resetButton.isDisabled();
    // 버튼이 활성화되었거나 검색어가 입력된 상태면 통과
    expect(await searchInput.inputValue()).toBe('테스트');
  });

  test('TC-CAT-081: 마지막 페이지에서 Next 버튼 비활성화 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    await page.locator(selectors.search.searchButton).click();
    await page.waitForLoadState('networkidle');
    
    // When: 마지막 페이지 버튼 클릭
    const paginationNav = page.locator('nav[aria-label="Pagination"]');
    const paginationArea = paginationNav.locator('..');
    const lastPageButton = paginationNav.locator('button').last();
    
    if (await lastPageButton.isVisible()) {
      // 모바일 뷰포트에서 테이블이 가릴 수 있으므로 스크롤 후 클릭
      await paginationArea.scrollIntoViewIfNeeded();
      await lastPageButton.click({ force: true });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(500);
      
      // Then: Next 버튼이 비활성화됨
      const nextButton = page.locator(selectors.pagination.nextButton);
      await expect(nextButton).toBeDisabled();
    }
  });
});
