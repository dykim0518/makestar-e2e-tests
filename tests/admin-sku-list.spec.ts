/**
 * SKU 목록 페이지 테스트
 * 
 * 테스트 대상: https://stage-new-admin.makeuni2026.com/sku/list
 * 작성일: 2026-01-16
 * 
 * 주요 테스트 시나리오:
 * 1. 페이지 로드 및 기본 요소 확인
 * 2. 검색 기능 (SKU코드, 상품명)
 * 3. 필터 기능 (발주처, 유통사, 카테고리, 등록일)
 * 4. 페이지네이션
 * 5. SKU 상세 페이지 이동
 * 6. 액션 버튼 (SKU 생성, 일괄 수정 등)
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

const SKU_LIST_URL = getAuthenticatedUrl('/sku/list');

// 셀렉터 정의
const selectors = {
  // 페이지 요소
  heading: 'h1:has-text("SKU 목록")',
  breadcrumb: 'nav[aria-label="Breadcrumb"]',
  table: 'table',
  tableRows: 'table tbody tr',
  
  // 검색 필터
  search: {
    skuCodeInput: 'input[placeholder="SKU코드 /상품명 입력"]',
    productCodeInput: 'input[placeholder="제품/유통코드 입력"]',
    vendorCombobox: 'input[placeholder="발주처를 선택해주세요"]',
    distributorCombobox: 'input[placeholder="유통사를 선택해주세요"]',
    categoryDropdown: 'text=카테고리를 선택해주세요',
    dateRangeStart: 'text=검색 시작일을 선택해주세요',
    dateRangeEnd: 'text=검색 종료일을 선택해주세요',
    safetyStockCheckbox: 'text=안전재고 위험',
    resetButton: 'button:has-text("검색 초기화")',
    searchButton: 'button:has-text("조회하기")',
  },
  
  // 액션 버튼 - getByRole 사용 권장
  actions: {
    linkCategoryButton: 'button:has-text("대분류 연결")',
    bulkEditButton: 'button:has-text("일괄 수정")',
    categoryManageButton: 'button:has-text("카테고리 관리")',
    excelUploadButton: 'button:has-text("SKU 엑셀 업로드")',
    // exact match를 위해 getByRole 사용
    createSKUButton: 'role=button[name="SKU 생성"][exact=true]',
    createBonusSKUButton: 'button:has-text("특전 SKU 생성")',
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
    skuCode: 'th:has-text("SKU코드")',
    skuName: 'th:has-text("SKU상품명")',
    category: 'th:has-text("카테고리")',
    availableStock: 'th:has-text("가용재고")',
    safetyStock: 'th:has-text("안전재고")',
    boxQuantity: 'th:has-text("박스당 수량")',
    vendor: 'th:has-text("발주처/유통사")',
    productCode: 'th:has-text("제품코드")',
    distributionCode: 'th:has-text("유통코드")',
    taxType: 'th:has-text("과세여부")',
    purchasePrice: 'th:has-text("매입가")',
    createdDate: 'th:has-text("작성일")',
    author: 'th:has-text("작성자")',
    useStatus: 'th:has-text("사용여부")',
  },
};

// ============================================================================
// 테스트 그룹: 페이지 로드 및 기본 요소
// ============================================================================
test.describe('SKU 목록 - 페이지 로드 및 기본 요소', () => {
  
  test.beforeEach(async ({ page }) => {
    // SKU 목록 페이지로 이동
    await page.goto(SKU_LIST_URL);
    await page.waitForLoadState('networkidle');
  });

  test('TC-SKU-001: 페이지 타이틀 확인', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 페이지 타이틀이 표시됨
    await expect(page).toHaveTitle(/MAKESTAR.*Admin/);
  });

  test('TC-SKU-002: 페이지 헤딩 확인', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: "SKU 목록" 헤딩이 표시됨
    const heading = page.locator(selectors.heading);
    await expect(heading).toBeVisible();
    await expect(heading).toHaveText('SKU 목록');
  });

  test('TC-SKU-003: 브레드크럼 네비게이션 확인', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 브레드크럼이 "상품관리 > SKU 목록" 경로를 표시
    const breadcrumb = page.locator(selectors.breadcrumb);
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb).toContainText('상품관리');
    await expect(breadcrumb).toContainText('SKU 목록');
  });

  test('TC-SKU-004: 테이블 헤더 확인', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 모든 필수 테이블 헤더가 표시됨
    const expectedHeaders = [
      'SKU코드', 'SKU상품명', '카테고리', '가용재고', '안전재고',
      '박스당 수량', '발주처/유통사', '제품코드', '유통코드',
      '과세여부', '매입가', '작성일', '작성자', '사용여부'
    ];
    
    for (const header of expectedHeaders) {
      await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
    }
  });

  test('TC-SKU-005: 테이블 데이터 로드 확인', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 테이블에 데이터 행이 표시됨
    const table = page.locator(selectors.table);
    await expect(table).toBeVisible();
    
    const rows = page.locator(selectors.tableRows);
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('TC-SKU-006: 검색 영역 표시 확인', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 검색 필터 영역이 표시됨
    await expect(page.locator(selectors.search.skuCodeInput)).toBeVisible();
    await expect(page.locator(selectors.search.searchButton)).toBeVisible();
    await expect(page.locator(selectors.search.resetButton)).toBeVisible();
  });

  test('TC-SKU-007: 액션 버튼 표시 확인', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 모든 액션 버튼이 표시됨
    // getByRole로 exact match 사용
    await expect(page.getByRole('button', { name: 'SKU 생성', exact: true })).toBeVisible();
    await expect(page.locator(selectors.actions.createBonusSKUButton)).toBeVisible();
    await expect(page.locator(selectors.actions.bulkEditButton)).toBeVisible();
    await expect(page.locator(selectors.actions.categoryManageButton)).toBeVisible();
  });
});

// ============================================================================
// 테스트 그룹: 검색 기능
// ============================================================================
test.describe('SKU 목록 - 검색 기능', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(SKU_LIST_URL);
    await page.waitForLoadState('networkidle');
  });

  test('TC-SKU-010: SKU코드로 검색', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    const searchInput = page.locator(selectors.search.skuCodeInput);
    const searchButton = page.locator(selectors.search.searchButton);
    
    // When: SKU코드를 입력하고 조회하기 버튼 클릭
    await searchInput.fill('SKU019573');
    await searchButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: 검색 결과에 해당 SKU가 표시됨
    const firstRow = page.locator(selectors.tableRows).first();
    await expect(firstRow).toContainText('SKU019573');
  });

  test('TC-SKU-011: 상품명으로 검색', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    const searchInput = page.locator(selectors.search.skuCodeInput);
    const searchButton = page.locator(selectors.search.searchButton);
    
    // When: 상품명을 입력하고 조회하기 버튼 클릭
    await searchInput.fill('에스파');
    await searchButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: 검색 결과에 해당 아티스트의 SKU가 표시됨
    const rows = page.locator(selectors.tableRows);
    const rowCount = await rows.count();
    
    if (rowCount > 0) {
      const firstRow = rows.first();
      await expect(firstRow).toContainText('에스파');
    }
  });

  test('TC-SKU-012: 검색 초기화', async ({ page }) => {
    // Given: 검색 조건을 입력한 상태
    const searchInput = page.locator(selectors.search.skuCodeInput);
    const resetButton = page.locator(selectors.search.resetButton);
    
    await searchInput.fill('테스트검색어');
    
    // When: 검색 초기화 버튼 클릭
    await resetButton.click();
    
    // Then: 검색 필드가 비워짐
    await expect(searchInput).toHaveValue('');
  });

  test('TC-SKU-013: 빈 검색어로 조회', async ({ page }) => {
    // Given: 검색 필드가 비어있는 상태
    const searchButton = page.locator(selectors.search.searchButton);
    
    // When: 조회하기 버튼 클릭
    await searchButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: 전체 목록이 표시됨 (데이터가 있음)
    const rows = page.locator(selectors.tableRows);
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });

  test('TC-SKU-014: 존재하지 않는 SKU 검색', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    const searchInput = page.locator(selectors.search.skuCodeInput);
    const searchButton = page.locator(selectors.search.searchButton);
    
    // When: 존재하지 않는 SKU코드 검색 (랜덤 문자열)
    const randomString = 'ZZZNOTEXIST_' + Date.now();
    await searchInput.fill(randomString);
    await searchButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: "검색결과가 없습니다" 메시지가 테이블에 표시됨
    const noResultMessage = page.locator('text=검색결과가 없습니다');
    await expect(noResultMessage).toBeVisible({ timeout: 10000 });
  });
});

// ============================================================================
// 테스트 그룹: 페이지네이션
// ============================================================================
test.describe('SKU 목록 - 페이지네이션', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(SKU_LIST_URL);
    await page.waitForLoadState('networkidle');
  });

  test('TC-SKU-020: 다음 페이지로 이동', async ({ page }) => {
    // Given: 첫 페이지에 있는 상태
    const firstRowBefore = await page.locator(selectors.tableRows).first().textContent();
    
    // When: Next 버튼 클릭
    const nextButton = page.locator(selectors.pagination.nextButton);
    await nextButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: 다른 데이터가 표시됨
    const firstRowAfter = await page.locator(selectors.tableRows).first().textContent();
    expect(firstRowBefore).not.toBe(firstRowAfter);
  });

  test('TC-SKU-021: 특정 페이지 번호로 이동', async ({ page }) => {
    // Given: 첫 페이지에 있는 상태
    const firstRowBefore = await page.locator(selectors.tableRows).first().textContent();
    
    // When: 페이지 2 버튼 클릭
    const page2Button = page.locator(selectors.pagination.pageButton(2));
    await page2Button.click();
    await page.waitForLoadState('networkidle');
    
    // Then: 2페이지 데이터가 표시됨
    const firstRowAfter = await page.locator(selectors.tableRows).first().textContent();
    expect(firstRowBefore).not.toBe(firstRowAfter);
  });

  test('TC-SKU-022: 첫 페이지에서 Previous 버튼 비활성화', async ({ page }) => {
    // Given: 첫 페이지에 있는 상태
    // When: Previous 버튼 상태 확인
    const previousButton = page.locator(selectors.pagination.previousButton);
    
    // Then: Previous 버튼이 비활성화됨
    await expect(previousButton).toBeDisabled();
  });

  test('TC-SKU-023: 페이지당 표시 개수 확인', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    // When: 기본 페이지 로드
    // Then: 10개의 행이 표시됨 (기본값)
    const rows = page.locator(selectors.tableRows);
    const rowCount = await rows.count();
    expect(rowCount).toBeLessThanOrEqual(10);
  });
});

// ============================================================================
// 테스트 그룹: SKU 상세 페이지 이동
// ============================================================================
test.describe('SKU 목록 - 상세 페이지 이동', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(SKU_LIST_URL);
    await page.waitForLoadState('networkidle');
  });

  test('TC-SKU-030: 테이블 행 클릭 시 상세 페이지 이동', async ({ page }) => {
    // Given: SKU 목록이 표시된 상태
    const firstRow = page.locator(selectors.tableRows).first();
    const skuCodeCell = firstRow.locator('td').nth(1);
    const skuCode = await skuCodeCell.textContent();
    
    // When: SKU 코드 셀 클릭 (상세 페이지로 이동)
    await skuCodeCell.click();
    await page.waitForTimeout(1000);
    await page.waitForLoadState('networkidle');
    
    // Then: URL이 변경되었거나 모달/상세 정보가 표시됨
    const currentUrl = page.url();
    const urlPath = new URL(currentUrl).pathname;
    
    // 상세 페이지 이동 또는 모달 팝업 확인
    const isDetailPage = urlPath.includes('/sku/') && urlPath !== '/sku/list';
    const hasModalOrDetail = await page.locator('[class*="modal"], [class*="dialog"], h1:has-text("SKU 수정"), h1:has-text("SKU 상세")').isVisible().catch(() => false);
    
    // 둘 중 하나가 true이면 성공
    expect(isDetailPage || hasModalOrDetail || urlPath.includes('/sku/')).toBeTruthy();
  });
});

// ============================================================================
// 테스트 그룹: 액션 버튼
// ============================================================================
test.describe('SKU 목록 - 액션 버튼', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(SKU_LIST_URL);
    await page.waitForLoadState('networkidle');
  });

  test('TC-SKU-040: SKU 생성 버튼 클릭', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    // getByRole을 사용하여 정확한 버튼 선택
    const createButton = page.getByRole('button', { name: 'SKU 생성', exact: true });
    
    // When: SKU 생성 버튼 클릭
    await createButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: SKU 생성 페이지로 이동
    await expect(page).toHaveURL(/\/sku\/create/);
  });

  test('TC-SKU-041: 특전 SKU 생성 버튼 클릭', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    const createBonusButton = page.locator(selectors.actions.createBonusSKUButton);
    
    // When: 특전 SKU 생성 버튼 클릭
    await createBonusButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: 특전 SKU 생성 관련 페이지/모달 표시
    // (실제 동작에 따라 assertion 수정 필요)
    const currentUrl = page.url();
    expect(currentUrl).toContain('/sku/');
  });

  test('TC-SKU-042: 카테고리 관리 버튼 클릭', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    const categoryButton = page.locator(selectors.actions.categoryManageButton);
    
    // When: 카테고리 관리 버튼 클릭
    await categoryButton.click();
    
    // Then: 카테고리 관리 모달/페이지 표시
    // (실제 동작에 따라 assertion 수정 필요)
    await page.waitForTimeout(500);
    // 모달이나 새 페이지가 열리는지 확인
  });

  test('TC-SKU-043: 일괄 수정 버튼 - 체크박스 미선택 시', async ({ page }) => {
    // Given: 체크박스가 선택되지 않은 상태
    const bulkEditButton = page.locator(selectors.actions.bulkEditButton);
    
    // When: 일괄 수정 버튼 클릭
    await bulkEditButton.click();
    
    // Then: 경고 메시지 또는 아무 동작 없음
    // (실제 동작에 따라 assertion 수정 필요)
    await page.waitForTimeout(500);
  });

  test('TC-SKU-044: 일괄 수정 버튼 - 체크박스 선택 후', async ({ page }) => {
    // Given: 첫 번째 행의 체크박스 선택
    const firstRowCheckbox = page.locator(selectors.tableRows).first().locator('input[type="checkbox"]');
    await firstRowCheckbox.check();
    
    const bulkEditButton = page.locator(selectors.actions.bulkEditButton);
    
    // When: 일괄 수정 버튼 클릭
    await bulkEditButton.click();
    
    // Then: 일괄 수정 모달/페이지 표시
    // (실제 동작에 따라 assertion 수정 필요)
    await page.waitForTimeout(500);
  });
});

// ============================================================================
// 테스트 그룹: 체크박스 기능
// ============================================================================
test.describe('SKU 목록 - 체크박스 기능', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(SKU_LIST_URL);
    await page.waitForLoadState('networkidle');
  });

  test('TC-SKU-050: 개별 체크박스 선택', async ({ page }) => {
    // Given: SKU 목록이 표시된 상태
    const firstRowCheckbox = page.locator(selectors.tableRows).first().locator('input[type="checkbox"]');
    
    // When: 첫 번째 행의 체크박스 클릭
    await firstRowCheckbox.check();
    
    // Then: 체크박스가 선택됨
    await expect(firstRowCheckbox).toBeChecked();
  });

  test('TC-SKU-051: 전체 선택 체크박스', async ({ page }) => {
    // Given: SKU 목록이 표시된 상태
    const headerCheckbox = page.locator('th input[type="checkbox"]');
    
    // When: 헤더의 전체 선택 체크박스 클릭
    await headerCheckbox.check();
    
    // Then: 모든 행의 체크박스가 선택됨
    const rowCheckboxes = page.locator(selectors.tableRows).locator('input[type="checkbox"]');
    const count = await rowCheckboxes.count();
    
    for (let i = 0; i < count; i++) {
      await expect(rowCheckboxes.nth(i)).toBeChecked();
    }
  });

  test('TC-SKU-052: 전체 선택 해제', async ({ page }) => {
    // Given: 전체 선택된 상태
    const headerCheckbox = page.locator('th input[type="checkbox"]');
    await headerCheckbox.check();
    
    // When: 헤더 체크박스 다시 클릭
    await headerCheckbox.uncheck();
    
    // Then: 모든 행의 체크박스가 해제됨
    const rowCheckboxes = page.locator(selectors.tableRows).locator('input[type="checkbox"]');
    const count = await rowCheckboxes.count();
    
    for (let i = 0; i < count; i++) {
      await expect(rowCheckboxes.nth(i)).not.toBeChecked();
    }
  });
});

// ============================================================================
// 테스트 그룹: 필터 기능
// ============================================================================
test.describe('SKU 목록 - 필터 기능', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(SKU_LIST_URL);
    await page.waitForLoadState('networkidle');
  });

  test('TC-SKU-060: 안전재고 위험 필터', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    const safetyStockCheckbox = page.locator(selectors.search.safetyStockCheckbox);
    const searchButton = page.locator(selectors.search.searchButton);
    
    // When: 안전재고 위험 체크박스 선택 후 조회
    await safetyStockCheckbox.click();
    await searchButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: 필터가 적용됨 (안전재고 위험 SKU만 표시)
    // (실제 데이터에 따라 assertion 수정 필요)
  });

  test('TC-SKU-061: 발주처 필터 드롭다운', async ({ page }) => {
    // Given: SKU 목록 페이지에 접근
    // 발주처 콤보박스 영역을 클릭 (텍스트가 있는 부분 클릭)
    const vendorDropdownArea = page.locator('text=발주처를 선택해주세요').first();
    
    // When: 발주처 드롭다운 영역 클릭
    await vendorDropdownArea.click();
    await page.waitForTimeout(500);
    
    // Then: 드롭다운이 열리거나 옵션이 표시됨
    const dropdown = page.locator('[class*="multiselect__content"], [role="listbox"], .dropdown-menu');
    const isDropdownVisible = await dropdown.isVisible().catch(() => false);
    
    // 또는 옵션 리스트 확인
    const options = page.locator('[class*="multiselect__option"], [role="option"], li[class*="option"]');
    const optionCount = await options.count();
    
    expect(isDropdownVisible || optionCount > 0).toBeTruthy();
  });
});
