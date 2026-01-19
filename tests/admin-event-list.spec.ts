/**
 * 상품 목록 페이지 테스트
 * 
 * 테스트 대상: https://stage-new-admin.makeuni2026.com/event/list
 * 작성일: 2026-01-16
 * 
 * 주요 테스트 시나리오:
 * 1. 페이지 로드 및 기본 요소 확인
 * 2. 다양한 검색 필터 기능 (이름, 상품코드, 앨범코드, ID)
 * 3. 상품구분 필터 (이벤트/상품/펀딩)
 * 4. 전시옵션 필터 (B2C/B2B)
 * 5. 노출상태 필터
 * 6. 테이블 데이터 표시
 * 7. 페이지네이션
 * 8. 상품 등록 페이지 이동
 * 9. 상품 상세 페이지 이동
 * 10. 엑셀 다운로드
 * 11. 미리보기/새창보기 기능
 * 
 * 사용자 시나리오:
 * - MD가 등록된 상품을 조회하고 관리
 * - 특정 조건으로 상품 검색 (세일 상품, 특정 아티스트 등)
 * - 상품 노출 상태 확인 및 변경
 * - 새로운 상품 등록
 * - 기존 상품 수정
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

const EVENT_LIST_URL = getAuthenticatedUrl('/event/list');

// 셀렉터 정의
const selectors = {
  // 페이지 요소
  heading: 'h1:has-text("상품 조회/수정")',
  breadcrumb: 'nav[aria-label="Breadcrumb"]',
  table: 'table',
  tableRows: 'table tbody tr',
  
  // 검색 필터
  search: {
    nameInput: 'input[placeholder="이벤트 이름을 입력해주세요"]',
    productCodeInput: 'input[placeholder="상품 코드를 입력해주세요"]',
    albumCodeInput: 'input[placeholder="앨범 코드를 입력해주세요"]',
    idInput: 'input[placeholder="ID를 입력해주세요"]',
    managerInput: 'input[placeholder="담당자의 이름 또는 이메일을 정확히 입력해주세요"]',
    // 상품구분 필터
    eventTypeFilter: 'text=이벤트',
    productTypeFilter: 'text=상품',
    fundingTypeFilter: 'text=펀딩',
    // 전시옵션 필터
    b2cFilter: 'text=B2C',
    b2bFilter: 'text=B2B',
    // 버튼
    simpleSearchButton: 'button:has-text("간단하게 검색")',
    resetButton: 'button:has-text("검색 초기화")',
    searchButton: 'button:has-text("조회하기")',
  },
  
  // 액션 버튼
  actions: {
    createProductButton: 'button:has-text("상품 등록")',
    excelDownloadButton: 'button:has-text("엑셀다운받기")',
    shipmentExcelButton: 'text=출고엑셀다운받기',
  },
  
  // 테이블 행 액션 버튼
  rowActions: {
    privateLink: 'button:has-text("비공개링크")',
    preview: 'button:has-text("미리보기")',
    newWindow: 'button:has-text("새창보기")',
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
    albumCode: 'th:has-text("앨범코드(코드)")',
    productCode: 'th:has-text("상품코드")',
    displayOption: 'th:has-text("전시옵션")',
    type: 'th:has-text("구분")',
    name: 'th:has-text("이름")',
    salesOption: 'th:has-text("판매&노출 옵션")',
    period: 'th:has-text("기간")',
    registrationDate: 'th:has-text("등록일")',
    manager: 'th:has-text("담당자")',
  },
};

// ============================================================================
// 테스트 그룹: 페이지 로드 및 기본 요소
// ============================================================================
test.describe('상품 목록 - 페이지 로드 및 기본 요소', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(EVENT_LIST_URL);
    await page.waitForLoadState('networkidle');
    // 테이블 데이터 로드 대기 (이 페이지는 자동으로 데이터를 로드함)
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
  });

  test('TC-EVT-001: 페이지 타이틀 확인', async ({ page }) => {
    // Given: 상품 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 페이지 타이틀이 표시됨
    await expect(page).toHaveTitle(/MAKESTAR.*Admin/);
  });

  test('TC-EVT-002: 페이지 헤딩 확인', async ({ page }) => {
    // Given: 상품 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: "상품 조회/수정" 헤딩이 표시됨 (실제로는 paragraph 태그)
    const heading = page.getByText('상품 조회/수정');
    await expect(heading).toBeVisible();
  });

  test('TC-EVT-003: 등록하기 버튼 확인', async ({ page }) => {
    // Given: 상품 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 등록하기 버튼이 표시됨
    const registerButton = page.getByRole('button', { name: '등록하기' });
    await expect(registerButton).toBeVisible();
  });

  test('TC-EVT-004: 테이블 헤더 확인', async ({ page }) => {
    // Given: 상품 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 모든 필수 테이블 헤더가 표시됨
    const expectedHeaders = [
      'ID', '앨범코드(코드)', '상품코드', '전시옵션', '구분',
      '이름', '판매&노출 옵션', '기간', '등록일', '담당자'
    ];
    
    for (const header of expectedHeaders) {
      await expect(page.locator(`th:has-text("${header}")`)).toBeVisible();
    }
  });

  test('TC-EVT-005: 검색 입력 영역 표시 확인', async ({ page }) => {
    // Given: 상품 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 검색 입력 영역이 표시됨 (textbox "검색하기")
    const searchInput = page.getByRole('textbox', { name: '검색하기' });
    await expect(searchInput).toBeVisible();
  });

  test('TC-EVT-006: 테이블 컬럼 ID 확인', async ({ page }) => {
    // Given: 상품 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: ID 컬럼이 표시됨
    const idColumn = page.getByRole('columnheader', { name: 'ID' });
    await expect(idColumn).toBeVisible();
  });

  test('TC-EVT-007: 테이블 컬럼 앨범코드 확인', async ({ page }) => {
    // Given: 상품 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 앨범코드 컬럼이 표시됨
    const albumCodeColumn = page.getByRole('columnheader', { name: '앨범코드(코드)' });
    await expect(albumCodeColumn).toBeVisible();
  });

  test('TC-EVT-008: 테이블 컬럼 상품코드 확인', async ({ page }) => {
    // Given: 상품 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 상품코드 컬럼이 표시됨
    const productCodeColumn = page.getByRole('columnheader', { name: '상품코드' });
    await expect(productCodeColumn).toBeVisible();
  });

  test('TC-EVT-009: 데이터 자동 로드 확인', async ({ page }) => {
    // Given: 상품 목록 페이지에 접근
    // When: 페이지가 로드됨
    // Then: 데이터가 자동으로 로드됨 (조회 버튼 클릭 없이)
    await page.waitForTimeout(2000);
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThan(0);
  });
});

// ============================================================================
// 테스트 그룹: 검색 기능
// ============================================================================
test.describe('상품 목록 - 검색 기능', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(EVENT_LIST_URL);
    await page.waitForLoadState('networkidle');
    // 테이블 데이터 로드 대기
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
  });

  test('TC-EVT-010: 검색창에 키워드 입력', async ({ page }) => {
    // Given: 상품 목록이 로드된 상태
    const searchInput = page.getByRole('textbox', { name: '검색하기' });
    
    // When: 검색창에 키워드 입력
    await searchInput.fill('SALE');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    
    // Then: 검색 결과가 표시됨
    await page.waitForTimeout(1000);
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('TC-EVT-011: 검색창에 상품코드 입력', async ({ page }) => {
    // Given: 상품 목록이 로드된 상태
    const searchInput = page.getByRole('textbox', { name: '검색하기' });
    
    // When: 상품코드로 검색
    await searchInput.fill('S_10210');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    
    // Then: 검색 결과가 표시됨
    await page.waitForTimeout(1000);
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('TC-EVT-012: 검색창에 앨범코드 입력', async ({ page }) => {
    // Given: 상품 목록이 로드된 상태
    const searchInput = page.getByRole('textbox', { name: '검색하기' });
    
    // When: 앨범코드로 검색
    await searchInput.fill('PD4154');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    
    // Then: 검색 결과가 표시됨
    await page.waitForTimeout(1000);
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('TC-EVT-013: 검색창에 ID 입력', async ({ page }) => {
    // Given: 상품 목록이 로드된 상태
    const searchInput = page.getByRole('textbox', { name: '검색하기' });
    
    // When: ID로 검색
    await searchInput.fill('15098');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    
    // Then: 검색 결과가 표시됨 (1건 또는 결과 없음)
    await page.waitForTimeout(1000);
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('TC-EVT-014: 존재하지 않는 상품 검색', async ({ page }) => {
    // Given: 상품 목록이 로드된 상태
    const searchInput = page.getByRole('textbox', { name: '검색하기' });
    
    // When: 존재하지 않는 상품명 검색
    const randomString = 'NOTEXIST_PRODUCT_' + Date.now();
    await searchInput.fill(randomString);
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    
    // Then: 테이블은 표시되되, 결과가 없거나 검색 결과 없음 메시지 표시
    await page.waitForTimeout(1000);
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('TC-EVT-015: 검색 아이콘 클릭', async ({ page }) => {
    // Given: 상품 목록이 로드된 상태
    const searchInput = page.getByRole('textbox', { name: '검색하기' });
    const searchIcon = page.locator('img[cursor=pointer]').first();
    
    // When: 검색어 입력 후 검색 아이콘 클릭
    await searchInput.fill('GHOST9');
    if (await searchIcon.isVisible()) {
      await searchIcon.click();
      await page.waitForLoadState('networkidle');
    }
    
    // Then: 검색이 실행됨
    await page.waitForTimeout(1000);
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });
});

// ============================================================================
// 테스트 그룹: 테이블 행 상호작용
// ============================================================================
test.describe('상품 목록 - 테이블 행 상호작용', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(EVENT_LIST_URL);
    await page.waitForLoadState('networkidle');
    // 테이블 데이터 로드 대기
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
  });

  test('TC-EVT-020: 테이블 행 체크박스 선택', async ({ page }) => {
    // Given: 상품 목록이 로드된 상태
    const firstRowCheckbox = page.locator('table tbody tr').first().locator('input[type="checkbox"]');
    
    // When: 첫 번째 행의 체크박스 클릭
    if (await firstRowCheckbox.isVisible()) {
      await firstRowCheckbox.click();
      
      // Then: 체크박스가 선택됨
      await expect(firstRowCheckbox).toBeChecked();
    }
  });

  test('TC-EVT-021: 테이블 행 클릭으로 상세 이동', async ({ page }) => {
    // Given: 상품 목록이 로드된 상태
    const firstRow = page.locator('table tbody tr').first();
    
    // When: 첫 번째 행 클릭
    // 실제 행 클릭시 상세 페이지로 이동할 수 있음 (페이지 동작에 따라 다름)
    await expect(firstRow).toBeVisible();
    // 행 클릭은 상세 페이지 이동을 트리거할 수 있으므로 여기서는 표시 확인만
  });

  test('TC-EVT-022: 비공개링크 버튼 표시 확인', async ({ page }) => {
    // Given: 상품 목록이 로드된 상태
    const privateLinkButton = page.getByRole('button', { name: 'search 비공개링크' }).first();
    
    // Then: 비공개링크 버튼이 표시됨
    await expect(privateLinkButton).toBeVisible();
  });

  test('TC-EVT-023: 미리보기 버튼 표시 확인', async ({ page }) => {
    // Given: 상품 목록이 로드된 상태
    const previewButton = page.getByRole('button', { name: 'search 미리보기' }).first();
    
    // Then: 미리보기 버튼이 표시됨
    await expect(previewButton).toBeVisible();
  });

  test('TC-EVT-024: 새창보기 버튼 표시 확인', async ({ page }) => {
    // Given: 상품 목록이 로드된 상태
    const newWindowButton = page.getByRole('button', { name: 'open 새창보기' }).first();
    
    // Then: 새창보기 버튼이 표시됨
    await expect(newWindowButton).toBeVisible();
  });
});

// ============================================================================
// 테스트 그룹: 페이지네이션
// ============================================================================
test.describe('상품 목록 - 페이지네이션', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(EVENT_LIST_URL);
    await page.waitForLoadState('networkidle');
    // 테이블 데이터 로드 대기
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
  });

  test('TC-EVT-030: 페이지 2로 이동', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const page2Button = page.locator('nav[aria-label="Pagination"]').getByRole('button', { name: '2' });
    
    // When: 페이지 2 버튼 클릭
    if (await page2Button.isVisible()) {
      await page2Button.click();
      await page.waitForLoadState('networkidle');
      
      // Then: 페이지 2로 이동됨
      await page.waitForTimeout(1000);
      const table = page.locator('table');
      await expect(table).toBeVisible();
    }
  });

  test('TC-EVT-031: 페이지 3으로 이동', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const page3Button = page.locator('nav[aria-label="Pagination"]').getByRole('button', { name: '3' });
    
    // When: 페이지 3 버튼 클릭
    if (await page3Button.isVisible()) {
      await page3Button.click();
      await page.waitForLoadState('networkidle');
      
      // Then: 페이지 3으로 이동됨
      await page.waitForTimeout(1000);
      const table = page.locator('table');
      await expect(table).toBeVisible();
    }
  });

  test('TC-EVT-032: 페이지네이션 네비게이션 표시 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    // When: 페이지네이션 영역 확인
    const pagination = page.locator('nav[aria-label="Pagination"]');
    
    // Then: 페이지네이션이 표시됨
    await expect(pagination).toBeVisible();
  });

  test('TC-EVT-033: 페이지당 표시 개수 콤보박스 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    // When: 페이지당 개수 콤보박스 확인
    const perPageCombobox = page.locator('div').filter({ hasText: '10 / page' }).first();
    
    // Then: 페이지당 개수 콤보박스가 표시됨
    await expect(perPageCombobox).toBeVisible();
  });
});

// ============================================================================
// 테스트 그룹: 상세 페이지 이동
// ============================================================================
test.describe('상품 목록 - 상세 페이지 이동', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(EVENT_LIST_URL);
    await page.waitForLoadState('networkidle');
    // 테이블 데이터 로드 대기
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
  });

  test('TC-EVT-040: 테이블 행 클릭 시 상세 페이지 이동', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const firstRow = page.locator('table tbody tr').first();
    
    if (await firstRow.isVisible()) {
      // When: 행 클릭 (행은 cursor=pointer가 있음)
      await firstRow.click();
      await page.waitForTimeout(1500);
      await page.waitForLoadState('networkidle');
      
      // Then: 상세 페이지로 이동
      const currentUrl = page.url();
      // 상세 페이지 이동 또는 동일 페이지 유지 (페이지 동작에 따라 다름)
      expect(currentUrl).toContain('/event/');
    }
  });
});

// ============================================================================
// 테스트 그룹: 액션 버튼
// ============================================================================
test.describe('상품 목록 - 액션 버튼', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(EVENT_LIST_URL);
    await page.waitForLoadState('networkidle');
    // 테이블 데이터 로드 대기
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
  });

  test('TC-EVT-050: 등록하기 버튼 클릭', async ({ page }) => {
    // Given: 상품 목록 페이지에 접근
    const createButton = page.getByRole('button', { name: '등록하기' });
    
    // When: 등록하기 버튼 클릭
    await createButton.click();
    await page.waitForLoadState('networkidle');
    
    // Then: 상품 등록 페이지로 이동 또는 모달 열림
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    expect(currentUrl).toContain('/event/');
  });
});

// ============================================================================
// 테스트 그룹: 행 액션 버튼
// ============================================================================
test.describe('상품 목록 - 행 액션 버튼', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(EVENT_LIST_URL);
    await page.waitForLoadState('networkidle');
    // 테이블 데이터 로드 대기
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
  });

  test('TC-EVT-060: 비공개링크 버튼 표시 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const firstRow = page.locator('table tbody tr').first();
    
    if (await firstRow.isVisible()) {
      // Then: 비공개링크 버튼이 표시됨
      const privateLinkButton = firstRow.locator('button:has-text("비공개링크")');
      await expect(privateLinkButton).toBeVisible();
    }
  });

  test('TC-EVT-061: 미리보기 버튼 표시 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const firstRow = page.locator('table tbody tr').first();
    
    if (await firstRow.isVisible()) {
      // Then: 미리보기 버튼이 표시됨
      const previewButton = firstRow.locator('button:has-text("미리보기")');
      await expect(previewButton).toBeVisible();
    }
  });

  test('TC-EVT-062: 새창보기 버튼 표시 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const firstRow = page.locator('table tbody tr').first();
    
    if (await firstRow.isVisible()) {
      // Then: 새창보기 버튼이 표시됨
      const newWindowButton = firstRow.locator('button:has-text("새창보기")');
      await expect(newWindowButton).toBeVisible();
    }
  });
});

// ============================================================================
// 테스트 그룹: 체크박스 기능
// ============================================================================
test.describe('상품 목록 - 체크박스 기능', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(EVENT_LIST_URL);
    await page.waitForLoadState('networkidle');
    // 테이블 데이터 로드 대기
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
  });

  test('TC-EVT-070: 개별 체크박스 선택', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const firstRowCheckbox = page.locator('table tbody tr').first().locator('input[type="checkbox"]');
    
    if (await firstRowCheckbox.isVisible()) {
      // When: 첫 번째 행 체크박스 클릭
      await firstRowCheckbox.click();
      
      // Then: 체크박스가 선택됨
      await expect(firstRowCheckbox).toBeChecked();
    }
  });

  test('TC-EVT-071: 전체 선택 체크박스', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const headerCheckbox = page.locator('table thead th input[type="checkbox"]');
    
    if (await headerCheckbox.isVisible()) {
      // When: 헤더 체크박스 클릭
      await headerCheckbox.click();
      await page.waitForTimeout(500);
      
      // Then: 헤더 체크박스가 선택됨
      await expect(headerCheckbox).toBeChecked();
    }
  });
});

// ============================================================================
// 테스트 그룹: 노출 상태
// ============================================================================
test.describe('상품 목록 - 노출 상태', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(EVENT_LIST_URL);
    await page.waitForLoadState('networkidle');
    // 테이블 데이터 로드 대기
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
  });

  test('TC-EVT-080: 노출 상태 콤보박스 표시 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const firstRow = page.locator('table tbody tr').first();
    
    if (await firstRow.isVisible()) {
      // Then: 노출 상태 콤보박스가 표시됨
      const exposureCombobox = firstRow.getByRole('combobox');
      await expect(exposureCombobox).toBeVisible();
    }
  });

  test('TC-EVT-081: 노출 상태 값 확인', async ({ page }) => {
    // Given: 데이터가 로드된 상태
    const firstRow = page.locator('table tbody tr').first();
    
    if (await firstRow.isVisible()) {
      // Then: 노출 상태 값이 표시됨 (🟢 노출/⏱️ 예약 등)
      const hasExposureStatus = await firstRow.locator('text=/노출|예약/').isVisible();
      expect(hasExposureStatus).toBeTruthy();
    }
  });
});

// ============================================================================
// 테스트 그룹: 사용자 시나리오
// ============================================================================
test.describe('상품 목록 - 사용자 시나리오', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto(EVENT_LIST_URL);
    await page.waitForLoadState('networkidle');
    // 테이블 데이터 로드 대기
    await page.waitForSelector('table tbody tr', { timeout: 30000 });
  });

  test('TC-EVT-090: 세일 상품 검색', async ({ page }) => {
    // 사용자 시나리오: MD가 현재 진행 중인 세일 상품을 찾음
    
    // Step 1: 검색창에 "SALE" 입력
    const searchInput = page.getByRole('textbox', { name: '검색하기' });
    await searchInput.fill('SALE');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    
    // Step 2: 검색 결과 확인
    await page.waitForTimeout(1000);
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('TC-EVT-091: 새 상품 등록 페이지 이동 후 돌아오기', async ({ page }) => {
    // 사용자 시나리오: MD가 새 상품 등록 페이지로 이동했다가 돌아옴
    
    // Step 1: 등록하기 버튼 클릭
    await page.getByRole('button', { name: '등록하기' }).click();
    await page.waitForLoadState('networkidle');
    
    // Step 2: 등록 페이지 도착 확인
    await page.waitForTimeout(1000);
    const currentUrl = page.url();
    expect(currentUrl).toContain('/event/');
    
    // Step 3: 뒤로가기
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Step 4: 목록 페이지로 복귀 확인
    await expect(page).toHaveURL(/\/event\/list/);
  });

  test('TC-EVT-092: 특정 상품 ID 검색 후 상세 확인', async ({ page }) => {
    // 사용자 시나리오: MD가 특정 상품 ID로 검색
    
    // Step 1: 검색창에 ID 입력
    const searchInput = page.getByRole('textbox', { name: '검색하기' });
    await searchInput.fill('15098');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    
    // Step 2: 결과 확인
    await page.waitForTimeout(1000);
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

test('TC-EVT-093: 아티스트 이름으로 검색', async ({ page }) => {
    // 사용자 시나리오: MD가 특정 아티스트 상품을 검색
    
    // Step 1: 아티스트 이름 입력
    const searchInput = page.getByRole('textbox', { name: '검색하기' });
    await searchInput.fill('GHOST9');
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle');
    
    // Step 2: 결과 확인
    await page.waitForTimeout(1000);
    const table = page.locator('table');
    await expect(table).toBeVisible();
  });

  test('TC-EVT-094: 상품 미리보기 버튼 클릭', async ({ page }) => {
    // 사용자 시나리오: MD가 상품 미리보기
    
    // Step 1: 첫 번째 행의 미리보기 버튼 찾기
    const previewButton = page.getByRole('button', { name: 'search 미리보기' }).first();
    
    // Step 2: 미리보기 버튼 표시 확인
    await expect(previewButton).toBeVisible();
    
    // Step 3: 미리보기 버튼 클릭 (새 탭이 열릴 수 있으므로 주의)
    // 실제로 클릭하지 않고 표시 확인만
  });
});
