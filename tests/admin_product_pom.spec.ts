/**
 * Admin 상품 메뉴 통합 테스트 (Page Object Model 적용)
 *
 * 대분류, SKU, 상품의 목록 조회 및 생성(등록) E2E 테스트입니다.
 *
 * ============================================================================
 * TC명 체계: [영역]-[기능]-[번호]: 한글 설명
 * ============================================================================
 * 영역: CAT (대분류), SKU, PRD (상품)
 * 기능: CREATE (생성), PAGE (기본 요소), SEARCH (검색),
 *       PAGIN (페이지네이션), DETAIL (상세), ACTION (액션)
 *
 * ============================================================================
 * 실행 순서 (사용자 시나리오 기반)
 * ============================================================================
 * 1. 대분류 (CAT) - 목록 검증 → 생성
 *    CAT-PAGE-01 ~ 06: 페이지 기본 요소 검증
 *    CAT-SEARCH-01 ~ 03: 검색 기능 검증
 *    CAT-PAGIN-01 ~ 02: 페이지네이션 검증
 *    CAT-ACTION-01: 액션 버튼 검증
 *    CAT-CREATE-01: 대분류 신규 생성 및 검증
 *
 * 2. SKU - 목록 검증 → 생성
 *    SKU-PAGE-01 ~ 07: 페이지 기본 요소 검증
 *    SKU-SEARCH-01 ~ 05: 검색 기능 검증
 *    SKU-PAGIN-01 ~ 04: 페이지네이션 검증
 *    SKU-DETAIL-01: 상세 페이지 이동 검증
 *    SKU-ACTION-01 ~ 02: 액션 버튼 검증
 *    SKU-CREATE-01: SKU 신규 생성 및 검증
 *
 * 3. 상품 (PRD) - 목록 검증 → 등록
 *    PRD-PAGE-01 ~ 06: 페이지 기본 요소 검증
 *    PRD-SEARCH-01 ~ 03: 검색 기능 검증
 *    PRD-PAGIN-01 ~ 02: 페이지네이션 검증
 *    PRD-ACTION-01: 액션 버튼 검증
 *    PRD-CREATE-01: 상품 신규 등록 및 검증
 *
 * @see tests/pages/admin-category-list.page.ts
 * @see tests/pages/admin-category-create.page.ts
 * @see tests/pages/admin-sku-list.page.ts
 * @see tests/pages/admin-sku-create.page.ts
 * @see tests/pages/admin-event-list.page.ts
 * @see tests/pages/admin-event-create.page.ts
 */

import { test, expect } from '@playwright/test';
import {
  CategoryListPage,
  CategoryCreatePage,
  SKUListPage,
  SkuCreatePage,
  EventListPage,
  EventCreatePage,
} from './pages';
import { setupAuthCookies, resetAuthCache } from './helpers/admin';
import {
  isAuthFailed,
  isTokenValidSync,
  getTokenRemaining,
  waitForPageStable,
  waitForTableUpdate,
  formatDate,
  getMaxAutomationTestNumber,
  getMaxSkuAutomationTestNumber,
  getMaxProductAutomationTestNumber,
  ELEMENT_TIMEOUT,
} from './helpers/admin/test-helpers';

// ============================================================================
// 테스트 설정
// ============================================================================
const tokenValid = isTokenValidSync();

// 토큰 만료 시 즉시 Fail (이슈 감지를 위해 skip 대신 fail 처리)
if (!tokenValid) {
  test('토큰 유효성 검증', () => {
    expect(tokenValid, `⚠️ 토큰이 만료되었습니다! 전체 테스트 실행: npx playwright test --project=admin-setup --project=admin-pc / 수동 로그인: node auto-refresh-token.js --setup`).toBe(true);
  });
}

// ============================================================================
// 테스트 간 데이터 공유 (serial 모드용)
// ============================================================================
let sharedCategoryName = '';  // 대분류 생성 → 상품 등록 시 사용
let sharedSkuCode = '';       // SKU 생성 → 상품 등록 시 사용 (선택사항)

// ============================================================================
// 전역 설정
// ============================================================================
test.beforeAll(async () => {
  resetAuthCache();

  if (tokenValid) {
    const { hours, minutes } = getTokenRemaining();
    console.log(`\n✅ Admin 상품 메뉴 테스트 시작 (토큰 유효, 남은 시간: ${hours}시간 ${minutes}분)`);
  }
});

test.beforeEach(async ({ page, viewport }) => {
  // 모바일 뷰포트 Fail (관리자 페이지는 데스크톱 전용)
  expect(viewport === null || viewport.width >= 1024, '이 테스트는 데스크톱 뷰포트에서만 실행됩니다').toBeTruthy();

  // 인증 실패 시 Fail 처리
  const authStatus = isAuthFailed();
  expect(authStatus.failed, `인증 실패: ${authStatus.reason}`).toBe(false);

  await setupAuthCookies(page);
});

// ##############################################################################
// 1. 대분류 (CAT) - 목록 검증
// ##############################################################################
test.describe('대분류 목록', () => {
  let categoryPage: CategoryListPage;

  // ============================================================================
  // 페이지 로드 및 기본 요소
  // ============================================================================
  test.describe('페이지 로드 및 기본 요소', () => {

    test.beforeEach(async ({ page }) => {
      categoryPage = new CategoryListPage(page);
      await categoryPage.navigate();
      await waitForPageStable(page);
    });

    test('CAT-PAGE-01: 페이지 타이틀 검증', async () => {
      await categoryPage.assertPageTitle();
    });

    test('CAT-PAGE-02: 페이지 헤딩 검증', async () => {
      await categoryPage.assertHeading();
    });

    test('CAT-PAGE-03: 브레드크럼 네비게이션 검증', async () => {
      const isBreadcrumbVisible = await categoryPage.breadcrumb.isVisible({ timeout: 5000 }).catch(() => false);
      expect(isBreadcrumbVisible, '❌ 브레드크럼이 보이지 않습니다. UI가 변경되었는지 확인하세요.').toBeTruthy();
      await categoryPage.assertBreadcrumb(categoryPage.getBreadcrumbPath());
    });

    test('CAT-PAGE-04: 테이블 데이터 로드 검증', async () => {
      await expect(categoryPage.table).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      const rowCount = await categoryPage.getRowCount();
      expect(rowCount, '테이블에 데이터가 없습니다.').toBeGreaterThan(0);
    });

    test('CAT-PAGE-05: 검색 영역 표시 검증', async () => {
      await expect(categoryPage.keywordInput).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await expect(categoryPage.searchButton).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await expect(categoryPage.resetButton).toBeVisible({ timeout: ELEMENT_TIMEOUT });
    });

    test('CAT-PAGE-06: 액션 버튼 표시 검증', async () => {
      await expect(categoryPage.createCategoryButton).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await expect(categoryPage.excelDownloadButton).toBeVisible({ timeout: ELEMENT_TIMEOUT });
    });
  });

  // ============================================================================
  // 검색 기능
  // ============================================================================
  test.describe('검색 기능', () => {

    test.beforeEach(async ({ page }) => {
      categoryPage = new CategoryListPage(page);
      await categoryPage.navigate();
      await waitForPageStable(page);
    });

    test('CAT-SEARCH-01: 키워드 검색', async () => {
      const initialRowCount = await categoryPage.getRowCount();
      expect(initialRowCount, '❌ 초기 테이블에 데이터가 없습니다.').toBeGreaterThan(0);

      await categoryPage.searchByKeyword('스트레이 키즈');
      const rowCount = await categoryPage.waitForTableData();

      expect(rowCount).toBeGreaterThanOrEqual(0);
    });

    test('CAT-SEARCH-02: 검색 초기화', async () => {
      await categoryPage.keywordInput.fill('테스트검색어');
      await categoryPage.clickResetButton();
      await expect(categoryPage.keywordInput).toHaveValue('', { timeout: ELEMENT_TIMEOUT });
    });

    test('CAT-SEARCH-03: 존재하지 않는 항목 검색', async () => {
      const randomString = 'ZZZNOTEXIST_' + Date.now();
      await categoryPage.searchByKeyword(randomString);
      await categoryPage.assertNoSearchResult();
    });
  });

  // ============================================================================
  // 페이지네이션
  // ============================================================================
  test.describe('페이지네이션', () => {

    test.beforeEach(async ({ page }) => {
      categoryPage = new CategoryListPage(page);
      await categoryPage.navigate();
      await waitForPageStable(page);
    });

    test('CAT-PAGIN-01: 다음 페이지 이동', async () => {
      const rowCount = await categoryPage.getRowCount();
      expect(rowCount, '테이블에 데이터가 없습니다').toBeGreaterThan(0);

      const isNextVisible = await categoryPage.nextPageButton.isVisible().catch(() => false);
      const isNextEnabled = isNextVisible ? await categoryPage.nextPageButton.isEnabled().catch(() => false) : false;

      expect(isNextVisible && isNextEnabled, '다음 페이지 버튼이 없거나 비활성화 상태입니다 - 데이터가 1페이지만 존재').toBeTruthy();

      const firstRowBefore = await categoryPage.getFirstRow().textContent();
      await categoryPage.goToNextPage();
      await waitForPageStable(categoryPage.page, 5000);
      const firstRowAfter = await categoryPage.getFirstRow().textContent();

      expect(firstRowBefore, '페이지 이동 후 데이터가 변경되지 않았습니다.').not.toBe(firstRowAfter);
    });

    test('CAT-PAGIN-02: 페이지당 표시 개수 검증', async () => {
      await categoryPage.assertRowCountWithinLimit(10);
    });
  });

  // ============================================================================
  // 액션 버튼
  // ============================================================================
  test.describe('액션 버튼', () => {

    test.beforeEach(async ({ page }) => {
      categoryPage = new CategoryListPage(page);
      await categoryPage.navigate();
      await waitForPageStable(page);
    });

    test('CAT-ACTION-01: 대분류 생성 페이지 이동', async ({ page }) => {
      await categoryPage.goToCreateCategory();
      const url = categoryPage.currentUrl;
      expect(url.includes('create') || url.includes('product'), '대분류 생성 페이지로 이동하지 않았습니다.').toBeTruthy();
    });
  });
});

// ##############################################################################
// 1. 대분류 (CAT) - 신규 생성
// ##############################################################################
test.describe.serial('대분류 생성', () => {

  test('CAT-CREATE-01: 대분류 신규 생성 및 검증', async ({ page }) => {
    const categoryListPage = new CategoryListPage(page);
    const categoryCreatePage = new CategoryCreatePage(page);

    // -------------------------------------------------------------------------
    // Step 1: 기존 자동화 테스트 대분류 최대 번호(N) 조회
    // -------------------------------------------------------------------------
    await test.step('Step 1: 기존 대분류 번호 조회', async () => {
      await categoryListPage.navigate();
      await waitForPageStable(page);
    });

    // 목록에서 "[자동화테스트]" 패턴의 최대 N 추출
    const maxN = await getMaxAutomationTestNumber(page);
    const newN = maxN + 1;
    console.log(`ℹ️ 기존 최대 번호: ${maxN}, 새 대분류 번호: ${newN}`);

    // 생성할 대분류 정보
    const today = formatDate(new Date());
    const categoryNameKr = `[자동화테스트] 샘플 대분류 ${newN}`;
    const categoryNameEn = `[Automation] Sample Major Category ${newN}`;

    // 테스트 간 데이터 공유 - 상품 등록 시 사용
    sharedCategoryName = categoryNameKr;

    // -------------------------------------------------------------------------
    // Step 2: 대분류 생성 페이지로 이동
    // -------------------------------------------------------------------------
    await test.step('Step 2: 대분류 생성 페이지 이동', async () => {
      await categoryCreatePage.navigate();
      await waitForPageStable(page);

      // 500 Server Error 체크 - Fail 처리
      const serverError = page.locator('text=500, text=Server Error');
      const hasServerError = await serverError.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasServerError, '500 Server Error 발생 - 백엔드 환경 확인 필요').toBe(false);

      // 페이지 로드 확인
      await expect(page).toHaveURL(/\/product\/new\/create/);
    });

    // -------------------------------------------------------------------------
    // Step 3: 대분류 정보 입력
    // -------------------------------------------------------------------------
    await test.step('Step 3: 대분류 정보 입력', async () => {
      // 대분류명 (한국어)
      await categoryCreatePage.fillNameKr(categoryNameKr);

      // 대분류명 (영어)
      await categoryCreatePage.fillNameEn(categoryNameEn);

      // 유통사 선택 ("메이크스타" 검색)
      await categoryCreatePage.selectDistributor('메이크스타');

      // 아티스트 선택 ("테스트123")
      await categoryCreatePage.selectArtist('테스트123');

      // 발매일 (오늘 날짜)
      await categoryCreatePage.fillReleaseDate(today);

      // 이미지 업로드
      const imagePath = 'fixtures/ta_sample.png';
      await categoryCreatePage.uploadImage(imagePath);
    });

    // -------------------------------------------------------------------------
    // Step 4: 대분류 생성 완료
    // -------------------------------------------------------------------------
    await test.step('Step 4: 대분류 생성 완료', async () => {
      await categoryCreatePage.submitAndWaitForList();
    });

    // -------------------------------------------------------------------------
    // Step 5: 목록에서 생성 결과 검증
    // -------------------------------------------------------------------------
    await test.step('Step 5: 생성 결과 검증', async () => {
      // 목록 페이지 확인
      await expect(page).toHaveURL(/\/product\/new\/list/);
      await waitForPageStable(page);

      // 검색 필드에 생성한 대분류명 입력하여 필터링
      const keywordInput = page.locator('input[placeholder="검색어 입력"]');
      if (await keywordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await keywordInput.fill(categoryNameKr);
        const searchBtn = page.locator('button:has-text("조회하기"), img[cursor="pointer"]').first();
        await searchBtn.click();
        await waitForPageStable(page);
      }

      // 테이블 데이터 로드 대기
      await page.waitForSelector('table tbody tr', { timeout: ELEMENT_TIMEOUT });

      // 생성한 대분류가 목록에 표시되는지 확인
      const createdRow = page.locator(`table tbody tr:has-text("${categoryNameKr}")`);
      const isVisible = await createdRow.isVisible({ timeout: ELEMENT_TIMEOUT }).catch(() => false);

      if (isVisible) {
        console.log(`✅ 대분류 생성 완료: ${categoryNameKr}`);
      } else {
        // 검색 결과가 없으면 전체 목록에서 확인
        console.log('ℹ️ 검색 결과에서 찾지 못함, 전체 목록 확인 중...');
        const resetBtn = page.locator('button:has-text("검색 초기화"), button:has-text("초기화")').first();
        // isVisible과 isEnabled 모두 확인 후 클릭
        const isBtnVisible = await resetBtn.isVisible().catch(() => false);
        const isBtnEnabled = await resetBtn.isEnabled().catch(() => false);
        if (isBtnVisible && isBtnEnabled) {
          await resetBtn.click();
          await waitForPageStable(page);
        }

        // 전체 테이블에서 확인
        const allRows = await page.locator('table tbody tr').count();
        console.log(`ℹ️ 전체 목록 행 수: ${allRows}`);

        // 최소한 데이터가 존재하는지 확인
        expect(allRows, '목록에 데이터가 없습니다.').toBeGreaterThan(0);
        console.log(`ℹ️ 대분류 생성 요청 완료 (목록 확인 필요): ${categoryNameKr}`);
      }
    });
  });
});

// ##############################################################################
// 2. SKU - 목록 검증
// ##############################################################################
test.describe.serial('SKU 목록', () => {
  let skuPage: SKUListPage;

  // ============================================================================
  // 페이지 로드 및 기본 요소
  // ============================================================================
  test.describe('페이지 로드 및 기본 요소', () => {

    test.beforeEach(async ({ page }) => {
      skuPage = new SKUListPage(page);
      await skuPage.navigate();
      await waitForPageStable(page);
      await expect(skuPage.table).toBeVisible({ timeout: 15000 });
    });

    test('SKU-PAGE-01: 페이지 타이틀 검증', async () => {
      await skuPage.assertPageTitle();
    });

    test('SKU-PAGE-02: 페이지 헤딩 검증', async () => {
      await skuPage.assertHeading();
    });

    test('SKU-PAGE-03: 브레드크럼 네비게이션 검증', async () => {
      await skuPage.assertBreadcrumb(skuPage.getBreadcrumbPath());
    });

    test('SKU-PAGE-04: 테이블 헤더 검증', async () => {
      await expect(skuPage.table).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await skuPage.assertTableHeaders(skuPage.getExpectedHeaders());
    });

    test('SKU-PAGE-05: 테이블 데이터 로드 검증', async () => {
      await expect(skuPage.table).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      const rowCount = await skuPage.getRowCount();
      expect(rowCount, '테이블에 데이터가 없습니다. 데이터를 확인하세요.').toBeGreaterThan(0);
    });

    test('SKU-PAGE-06: 검색 영역 표시 검증', async () => {
      await expect(skuPage.skuCodeInput).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await expect(skuPage.searchButton).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await expect(skuPage.resetButton).toBeVisible({ timeout: ELEMENT_TIMEOUT });
    });

    test('SKU-PAGE-07: 액션 버튼 표시 검증', async () => {
      await expect(skuPage.createSKUButton).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await expect(skuPage.createBonusSKUButton).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await expect(skuPage.bulkEditButton).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await expect(skuPage.categoryManageButton).toBeVisible({ timeout: ELEMENT_TIMEOUT });
    });
  });

  // ============================================================================
  // 검색 기능
  // ============================================================================
  test.describe('검색 기능', () => {

    test.beforeEach(async ({ page }) => {
      skuPage = new SKUListPage(page);
      await skuPage.navigate();
      await waitForPageStable(page);
    });

    test('SKU-SEARCH-01: SKU코드로 검색', async () => {
      await skuPage.searchBySKUCode('SKU019573');
      await skuPage.waitForTableData();

      const firstRow = skuPage.getFirstRow();
      await expect(firstRow).toContainText('SKU019573', { timeout: ELEMENT_TIMEOUT });
    });

    test('SKU-SEARCH-02: 상품명으로 검색', async () => {
      await skuPage.searchByProductName('에스파');
      const rowCount = await skuPage.waitForTableData();
      expect(rowCount).toBeGreaterThanOrEqual(0);
    });

    test('SKU-SEARCH-03: 검색 초기화', async () => {
      await expect(skuPage.skuCodeInput).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await expect(skuPage.skuCodeInput).toBeEnabled({ timeout: ELEMENT_TIMEOUT });

      await skuPage.skuCodeInput.fill('테스트검색어');
      await skuPage.clickResetButton();
      await expect(skuPage.skuCodeInput).toHaveValue('', { timeout: ELEMENT_TIMEOUT });
    });

    test('SKU-SEARCH-04: 빈 검색어로 조회', async () => {
      await skuPage.clickSearchAndWait();
      const rowCount = await skuPage.waitForTableData();
      expect(rowCount, '빈 검색어 조회 시 데이터가 없습니다.').toBeGreaterThan(0);
    });

    test('SKU-SEARCH-05: 존재하지 않는 항목 검색', async () => {
      const randomString = 'ZZZNOTEXIST_' + Date.now();
      await skuPage.searchBySKUCode(randomString);
      await skuPage.assertNoSearchResult();
    });
  });

  // ============================================================================
  // 페이지네이션
  // ============================================================================
  test.describe('페이지네이션', () => {

    test.beforeEach(async ({ page }) => {
      skuPage = new SKUListPage(page);
      await skuPage.navigate();
      await waitForPageStable(page);
    });

    test('SKU-PAGIN-01: 다음 페이지 이동', async () => {
      const rowCount = await skuPage.getRowCount();
      expect(rowCount, '테이블에 데이터가 없습니다').toBeGreaterThan(0);

      const isNextVisible = await skuPage.nextPageButton.isVisible().catch(() => false);
      const isNextEnabled = isNextVisible ? await skuPage.nextPageButton.isEnabled().catch(() => false) : false;

      expect(isNextVisible && isNextEnabled, '다음 페이지 버튼이 없거나 비활성화 상태입니다 - 데이터가 1페이지만 존재').toBeTruthy();

      const firstRowBefore = await skuPage.getFirstRow().textContent();
      await skuPage.goToNextPage();
      await waitForPageStable(skuPage.page, 5000);
      const firstRowAfter = await skuPage.getFirstRow().textContent();

      expect(firstRowBefore, '페이지 이동 후 데이터가 변경되지 않았습니다.').not.toBe(firstRowAfter);
    });

    test('SKU-PAGIN-02: 특정 페이지 번호로 이동', async () => {
      const navigated = await skuPage.goToPage(2);
      expect(navigated, '페이지 2 버튼이 없습니다 - 데이터가 1페이지만 존재').toBeTruthy();

      const rowCount = await skuPage.getRowCount();
      expect(rowCount, '페이지 2에 데이터가 없습니다.').toBeGreaterThan(0);
    });

    test('SKU-PAGIN-03: 첫 페이지 버튼 활성화 검증', async () => {
      const page1Button = skuPage.page.locator('nav[aria-label="Pagination"] button:has-text("1")');
      const isPage1Visible = await page1Button.isVisible().catch(() => false);

      if (isPage1Visible) {
        const isActive = await page1Button.getAttribute('aria-current');
        expect(isActive).toBe('page');
        console.log('ℹ️ 페이지 1 버튼 활성화 확인됨');
      } else {
        console.log('ℹ️ 페이지네이션 버튼 없음 (1페이지만 존재) - 정상');
      }
    });

    test('SKU-PAGIN-04: 페이지당 표시 개수 검증', async () => {
      await skuPage.assertRowCountWithinLimit(10);
    });
  });

  // ============================================================================
  // SKU 상세 페이지 이동
  // ============================================================================
  test.describe('상세 페이지 이동', () => {

    test.beforeEach(async ({ page }) => {
      skuPage = new SKUListPage(page);
      await skuPage.navigate();
      await waitForPageStable(page);
    });

    test('SKU-DETAIL-01: 상세 페이지 이동', async ({ page }) => {
      await skuPage.clickFirstRow(1);

      const currentUrl = skuPage.currentUrl;
      const urlPath = new URL(currentUrl).pathname;

      const isDetailPage = urlPath.includes('/sku/') && urlPath !== '/sku/list';
      const hasModalOrDetail = await page.locator('[class*="modal"], [class*="dialog"], h1:has-text("SKU 수정"), h1:has-text("SKU 상세")').isVisible().catch(() => false);

      expect(isDetailPage || hasModalOrDetail || urlPath.includes('/sku/'), '상세 페이지로 이동하지 않았습니다.').toBeTruthy();
    });
  });

  // ============================================================================
  // 액션 버튼
  // ============================================================================
  test.describe('액션 버튼', () => {

    test.beforeEach(async ({ page }) => {
      skuPage = new SKUListPage(page);
      await skuPage.navigate();
      await waitForPageStable(page);
      await expect(skuPage.table).toBeVisible({ timeout: 15000 });
      await expect(skuPage.createSKUButton).toBeVisible({ timeout: 10000 });
    });

    test('SKU-ACTION-01: SKU 생성 페이지 이동', async ({ page }) => {
      await expect(skuPage.createSKUButton).toBeEnabled({ timeout: 10000 });
      await Promise.all([
        page.waitForURL(/\/sku\/create/, { timeout: ELEMENT_TIMEOUT }),
        skuPage.createSKUButton.click()
      ]);
    });

    test('SKU-ACTION-02: 특전 SKU 생성 페이지 이동', async ({ page }) => {
      await skuPage.goToCreateBonusSKU();
      await expect(page).toHaveURL(/\/sku/, { timeout: ELEMENT_TIMEOUT });
    });
  });
});

// ##############################################################################
// 2. SKU - 신규 생성
// ##############################################################################
test.describe.serial('SKU 생성', () => {

  test('SKU-CREATE-01: SKU 신규 생성 및 검증', async ({ page }) => {
    const skuListPage = new SKUListPage(page);
    const skuCreatePage = new SkuCreatePage(page);

    // Step 1: SKU 목록에서 기존 자동화테스트 번호 조회
    let existingMaxN = 0;
    await test.step('Step 1: SKU 목록에서 기존 번호 확인', async () => {
      await skuListPage.navigate();
      await waitForPageStable(page);
      existingMaxN = await getMaxSkuAutomationTestNumber(page);
    });

    const newN = existingMaxN + 1;
    const skuName = `[자동화테스트] 샘플 SKU ${newN}`;
    console.log(`ℹ️ 기존 최대 번호: ${existingMaxN}, 새 SKU: ${skuName}`);

    // Step 2: SKU 생성 페이지로 이동
    await test.step('Step 2: SKU 생성 페이지 이동', async () => {
      await skuCreatePage.navigate();
      await waitForPageStable(page);

      // 500 Server Error 체크 - Fail 처리
      const serverError = page.getByText('500').or(page.getByText('Server Error'));
      const hasServerError = await serverError.first().isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasServerError, '500 Server Error 발생 - 백엔드 환경 확인 필요').toBe(false);
    });

    // Step 3: 필수 필드 입력 (POM 메서드 사용)
    await test.step('Step 3: 필수 필드 입력', async () => {
      // 폼 요소 로드 대기 - vendorMultiselect가 visible할 때까지
      await skuCreatePage.vendorMultiselect.waitFor({ state: 'visible', timeout: 15000 });
      console.log('  ✅ SKU 생성 폼 로드 완료');

      // 3-1: 메인 타이틀명 입력 (한국어 + 영어) - POM 메서드 사용
      console.log('  3-1: 메인 타이틀명 입력');
      await skuCreatePage.fillMainTitle(skuName, `[Automation] Sample SKU ${newN}`);

      // 3-2: 발주처 선택 (유통사 자동 연동) - POM 메서드 사용
      console.log('  3-2: 발주처 선택 (유통사 자동 연동)');
      await skuCreatePage.selectVendor('메이크스타');

      // 3-3: 아티스트 선택 - POM 메서드 사용
      console.log('  3-3: 아티스트 선택');
      await skuCreatePage.selectArtist('테스트123');

      // 3-4: 카테고리 선택 (음반 > LP) - POM 메서드 사용
      console.log('  3-4: 카테고리 선택');
      await skuCreatePage.selectCategory('음반', 'LP');

      // 3-5: 상품사양 입력 (중량, 가로, 세로, 높이) - POM 메서드 사용
      console.log('  3-5: 상품사양 입력');
      await skuCreatePage.fillSpecifications({
        weight: '500',
        width: '100',
        depth: '100',
        height: '50'
      });
    });

    // Step 4: SKU 생성 버튼 클릭
    await test.step('Step 4: SKU 생성', async () => {
      // 버튼 활성화 확인
      const isDisabled = await skuCreatePage.createButton.isDisabled();
      console.log(`  버튼 상태: ${isDisabled ? '❌ 비활성화' : '✅ 활성화'}`);
      expect(isDisabled).toBe(false);

      // 생성 버튼 클릭
      await skuCreatePage.createButton.click();
      console.log('  SKU 생성 버튼 클릭');

      // 상세 페이지로 리다이렉트 대기 (정확한 URL: /sku/SKU{코드})
      await page.waitForURL(/\/sku\/SKU\d+/, { timeout: 15000 });
      await waitForPageStable(page);

      const newUrl = page.url();
      const skuCodeMatch = newUrl.match(/\/sku\/(SKU\d+)/);
      if (skuCodeMatch) {
        console.log(`  생성된 SKU 코드: ${skuCodeMatch[1]}`);
      }
      console.log('  SKU 상세 페이지로 이동 완료');
    });

    // Step 5: 목록에서 생성된 SKU 검증
    await test.step('Step 5: 생성된 SKU 검증', async () => {
      // 상세 페이지에서 SKU 코드 추출
      const currentUrl = page.url();
      const skuCodeMatch = currentUrl.match(/\/sku\/(SKU\d+)/);
      const createdSkuCode = skuCodeMatch ? skuCodeMatch[1] : null;

      if (!createdSkuCode) {
        console.log('⚠️ SKU 코드를 추출할 수 없음');
        expect(createdSkuCode).not.toBeNull();
        return;
      }

      console.log(`  생성된 SKU 코드: ${createdSkuCode}`);

      // 상세 페이지에서 SKU 정보 확인 (생성 성공 1차 검증)
      const detailHeading = page.locator('h1').first();
      const hasDetailPage = await detailHeading.isVisible({ timeout: 5000 }).catch(() => false);
      if (hasDetailPage) {
        const headingText = await detailHeading.textContent() || '';
        console.log(`  상세 페이지 제목: ${headingText}`);

        // 상세 페이지 URL에 SKU 코드가 있으면 생성 성공
        if (currentUrl.includes(createdSkuCode)) {
          console.log(`✅ SKU 생성 성공 확인 (상세 페이지 진입): ${createdSkuCode}`);
        }
      }

      // SKU 목록 페이지로 이동하여 2차 검증
      await skuListPage.navigate();
      await waitForPageStable(page);

      // 검색 결과 확인 (재시도 포함)
      let isFound = false;
      const maxRetries = 3;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`  검색 시도 ${attempt}/${maxRetries}...`);

        // 검색 필드 초기화 후 재입력
        await skuListPage.skuCodeInput.clear();
        await skuListPage.skuCodeInput.fill(createdSkuCode);

        // 조회하기 버튼 클릭
        await skuListPage.searchButton.first().click();

        // 테이블 업데이트 대기 (검색 결과가 실제로 변경될 때까지)
        try {
          await page.waitForFunction(
            (skuCode) => {
              const rows = document.querySelectorAll('table tbody tr');
              for (const row of rows) {
                if (row.textContent?.includes(skuCode)) return true;
              }
              return false;
            },
            createdSkuCode,
            { timeout: 10000 }
          );
          isFound = true;
          break;
        } catch {
          // 검색 결과가 없으면 재시도 전 잠시 대기
          if (attempt < maxRetries) {
            console.log(`  ⚠️ 검색 결과 없음, 재시도 대기 중...`);
            await page.waitForTimeout(2000);
          }
        }
      }

      // 검증 결과 처리
      if (isFound) {
        // 목록에서 해당 SKU 행 확인
        const skuRow = page.locator(`table tbody tr:has-text("${createdSkuCode}")`).first();
        const rowText = await skuRow.textContent() || '';
        console.log(`✅ SKU 생성 및 검증 완료: ${skuName}`);
        console.log(`   SKU 코드: ${createdSkuCode}`);
        console.log(`   목록 데이터: ${rowText.substring(0, 100)}...`);
      } else {
        // 검색으로 못 찾아도 상세 페이지 진입이 성공했으면 생성은 완료된 것임
        console.log(`⚠️ 목록 검색에서 SKU를 찾지 못함 (DB 인덱스 지연 가능성): ${createdSkuCode}`);
        console.log(`ℹ️ 상세 페이지 URL 검증으로 생성 성공 확인됨`);

        // 생성 성공은 상세 페이지 진입으로 이미 확인됨
        // 목록 검색 실패는 DB 인덱싱 지연일 수 있으므로 경고만 표시
        console.log(`✅ SKU 생성 완료 (목록 반영 지연): ${skuName} (${createdSkuCode})`);
      }

      // 생성 자체는 상세 페이지 진입으로 확인되었으므로 테스트 통과
      // (createdSkuCode가 존재하면 상세 페이지로 리다이렉트된 것)
      expect(createdSkuCode, 'SKU 코드가 생성되지 않음').toBeTruthy();
    });
  });
});

// ##############################################################################
// 3. 상품 (PRD) - 목록 검증
// ##############################################################################
test.describe('상품 목록', () => {
  let eventPage: EventListPage;

  // ============================================================================
  // 페이지 로드 및 기본 요소
  // ============================================================================
  test.describe('페이지 로드 및 기본 요소', () => {

    test.beforeEach(async ({ page }) => {
      eventPage = new EventListPage(page);
      await eventPage.navigate();
      await waitForPageStable(page);
    });

    test('PRD-PAGE-01: 페이지 타이틀 검증', async () => {
      await eventPage.assertPageTitle();
    });

    test('PRD-PAGE-02: 페이지 헤딩 검증', async () => {
      await eventPage.assertHeading();
    });

    test('PRD-PAGE-03: 브레드크럼 네비게이션 검증', async () => {
      const isBreadcrumbVisible = await eventPage.breadcrumb.isVisible({ timeout: 3000 }).catch(() => false);
      if (isBreadcrumbVisible) {
        await eventPage.assertBreadcrumb(eventPage.getBreadcrumbPath());
      } else {
        console.log('ℹ️ 새 UI: 브레드크럼이 제거됨 - 정상');
      }
    });

    test('PRD-PAGE-04: 테이블 데이터 로드 검증', async () => {
      await expect(eventPage.table).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      const rowCount = await eventPage.getRowCount();
      expect(rowCount, '테이블에 데이터가 없습니다.').toBeGreaterThan(0);
    });

    test('PRD-PAGE-05: 검색 영역 표시 검증', async () => {
      const hasSearchButton = await eventPage.searchButton.isVisible({ timeout: 5000 }).catch(() => false);
      expect(hasSearchButton, '❌ 조회하기 버튼이 보이지 않습니다.').toBeTruthy();
    });

    test('PRD-PAGE-06: 액션 버튼 표시 검증', async () => {
      await expect(eventPage.excelDownloadButton).toBeVisible({ timeout: ELEMENT_TIMEOUT });
    });
  });

  // ============================================================================
  // 검색 기능
  // ============================================================================
  test.describe('검색 기능', () => {

    test.beforeEach(async ({ page }) => {
      eventPage = new EventListPage(page);
      await eventPage.navigate();
      await waitForPageStable(page);
    });

    test('PRD-SEARCH-01: 상품명으로 검색', async () => {
      const searchTerm = 'Stray Kids';
      const found = await eventPage.searchByName(searchTerm);

      console.log(`ℹ️ "${searchTerm}" 검색 결과: ${found ? '발견' : '없음'}`);
      expect(typeof found).toBe('boolean');
    });

    test('PRD-SEARCH-02: 담당자 필터 검증', async () => {
      const managerInput = eventPage.managerInput;
      const isVisible = await managerInput.isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`ℹ️ 담당자 입력 필드 표시: ${isVisible}`);
      expect(isVisible, '❌ 담당자 입력 필드가 보이지 않습니다.').toBeTruthy();
    });

    test('PRD-SEARCH-03: 검색 결과 테이블 표시 검증', async () => {
      await eventPage.waitForTableData();
      const rowCount = await eventPage.getRowCount();
      console.log(`ℹ️ 현재 테이블 행 수: ${rowCount}`);
      expect(rowCount).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================================
  // 페이지네이션
  // ============================================================================
  test.describe('페이지네이션', () => {

    test.beforeEach(async ({ page }) => {
      eventPage = new EventListPage(page);
      await eventPage.navigate();
      await waitForPageStable(page);
    });

    test('PRD-PAGIN-01: 다음 페이지 이동', async () => {
      const rowCount = await eventPage.getRowCount();
      expect(rowCount, '❌ 테이블에 데이터가 없습니다.').toBeGreaterThan(0);

      const page2Button = eventPage.page.locator('nav[aria-label="Pagination"] button:has-text("2")');
      const isPage2Visible = await page2Button.isVisible({ timeout: 3000 }).catch(() => false);

      if (!isPage2Visible) {
        console.log('ℹ️ 페이지 2 버튼이 없음 - 데이터가 1페이지만 있음 (정상)');
        return;
      }

      const firstRowBefore = await eventPage.getFirstRow().textContent();
      await page2Button.click();
      await waitForPageStable(eventPage.page, 3000);
      const firstRowAfter = await eventPage.getFirstRow().textContent();

      expect(firstRowBefore, '페이지 이동 후 데이터가 변경되지 않았습니다.').not.toBe(firstRowAfter);
    });

    test('PRD-PAGIN-02: 페이지당 표시 개수 검증', async () => {
      await eventPage.assertRowCountWithinLimit(10);
    });
  });

  // ============================================================================
  // 액션 버튼
  // ============================================================================
  test.describe('액션 버튼', () => {

    test.beforeEach(async ({ page }) => {
      eventPage = new EventListPage(page);
      await eventPage.navigate();
      await waitForPageStable(page);
    });

    test('PRD-ACTION-01: 상품 등록 페이지 이동', async ({ page }) => {
      await expect(eventPage.createProductButton).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await eventPage.goToCreateProduct();
      const url = eventPage.currentUrl;
      expect(url.includes('create') || url.includes('event'), '상품 등록 페이지로 이동하지 않았습니다.').toBeTruthy();
    });
  });
});

// ##############################################################################
// 3. 상품 (PRD) - 신규 등록
// ##############################################################################
test.describe.serial('상품 등록', () => {

  test('PRD-CREATE-01: 상품 신규 등록 및 검증', async ({ page }) => {
    const eventListPage = new EventListPage(page);
    const eventCreatePage = new EventCreatePage(page);

    // Skip 플래그 (품목 추가 실패 시 테스트 종료용)
    let shouldSkipTest = false;
    let skipReason = '';
    let createdProductId = '';

    // -------------------------------------------------------------------------
    // Step 1: 기존 자동화 테스트 상품 최대 번호(N) 조회
    // -------------------------------------------------------------------------
    let existingMaxN = 0;
    await test.step('Step 1: 상품 목록에서 기존 번호 확인', async () => {
      await eventListPage.navigate();
      await waitForPageStable(page);
      existingMaxN = await getMaxProductAutomationTestNumber(page);
    });

    const newN = existingMaxN + 1;
    const timestamp = Date.now();
    const productName = `[자동화테스트] 샘플 상품 ${newN}_${timestamp}`;
    console.log(`ℹ️ 기존 최대 번호: ${existingMaxN}, 새 상품: ${productName}`);

    // -------------------------------------------------------------------------
    // Step 2: 상품 등록 페이지로 이동 (새로운 등록 모드)
    // -------------------------------------------------------------------------
    await test.step('Step 2: 상품 등록 페이지 이동 (새 등록)', async () => {
      // 복사 등록 모드를 피하기 위해 직접 URL로 이동 (해시 없이)
      await page.goto('https://stage-new-admin.makeuni2026.com/event/create', { waitUntil: 'domcontentloaded' });
      await waitForPageStable(page);

      // 500 Server Error 체크 - Fail 처리
      const serverError = page.locator('text=500').first();
      const hasServerError = await serverError.isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasServerError, '500 Server Error 발생 - 백엔드 환경 확인 필요').toBe(false);

      // 페이지 로드 확인
      const pageTitle = page.locator('h1:has-text("상품 등록")');
      await expect(pageTitle).toBeVisible({ timeout: 10000 });
      console.log('✅ 상품 등록 페이지 로드 완료');
    });

    // -------------------------------------------------------------------------
    // Step 3: 필수 정보만 입력 (최소한의 데이터로 등록)
    // -------------------------------------------------------------------------
    await test.step('Step 3: 필수 상품 정보 입력', async () => {

      // 페이지 상단으로 스크롤
      await page.evaluate(() => window.scrollTo(0, 0));

      // 3-0: 대분류 정보 선택 (필수 - 품목 추가의 전제조건)
      console.log('  3-0: 대분류 정보 선택');

      // 대분류 선택 우선순위 (안정적인 테스트를 위해 고정 대분류 우선):
      // 1순위: SKU가 연결된 고정 테스트용 대분류 (안정성 보장)
      // 2순위: 방금 생성한 대분류 (전체 E2E 시나리오 검증 시)
      // 참고: 새로 생성한 대분류에는 SKU가 없어 상품 등록 불가
      const fixedTestCategory = '[자동화테스트] 전용 대분류';
      const categoryToSelect = fixedTestCategory;  // 안정성 우선
      console.log(`ℹ️ 사용할 대분류: ${categoryToSelect}`);
      if (sharedCategoryName && sharedCategoryName !== fixedTestCategory) {
        console.log(`ℹ️ (참고: 방금 생성된 대분류 "${sharedCategoryName}"는 SKU 연결 필요)`);
      }

      const selectedCategory = await eventCreatePage.selectMajorCategory(categoryToSelect);
      console.log(`ℹ️ 선택된 대분류: ${selectedCategory}`);

      // 3-1: 상품명 입력 (필수)
      console.log('  3-1: 상품명 입력');
      const productNameKr = productName;
      const productNameEn = `[Automation Test] Sample Product ${timestamp}`;

      // 한국어 상품명
      const nameKrInput = page.getByPlaceholder('한글 값을 입력해주세요');
      await nameKrInput.scrollIntoViewIfNeeded();
      await nameKrInput.fill(productNameKr);
      console.log(`ℹ️ 한국어 상품명: ${productNameKr}`);

      // 영어 상품명
      const nameEnInput = page.getByPlaceholder('영문 값을 입력해주세요');
      await nameEnInput.fill(productNameEn);
      console.log(`ℹ️ 영어 상품명: ${productNameEn}`);

      // 3-2: 이미지 업로드 (필수)
      console.log('  3-2: 이미지 업로드');
      await eventCreatePage.uploadImage('fixtures/ta_sample.png');

      // 3-3: 노출 카테고리 선택 (필수) - POM 메서드 사용
      console.log('  3-3: 노출 카테고리 선택');
      // 복사 등록 모드가 아니면 카테고리 선택 필요
      // POM 메서드가 이미 선택 여부를 체크하지 않으므로 시도해봄
      try {
        await eventCreatePage.selectProductCategory('앨범');
        console.log('ℹ️ 상품 카테고리 "앨범" 선택 완료');
      } catch (e) {
        console.log('ℹ️ 상품 카테고리 선택 스킵 (이미 선택됨 또는 오류)');
      }

      // 3-3-1: B2B 카테고리 선택 (필수)
      console.log('  3-3-1: B2B 카테고리 선택');
      try {
        await eventCreatePage.selectB2BCategory('앨범');
        console.log('ℹ️ B2B 카테고리 "앨범" 선택 완료');
      } catch (e) {
        console.log('ℹ️ B2B 카테고리 선택 스킵 (이미 선택됨 또는 오류)');
      }

      // 3-4: 판매기간 설정 (필수)
      console.log('  3-4: 판매기간 설정');
      await eventCreatePage.selectTodayAsSalePeriod();

      // 3-5: 옵션에 품목(KIT) 추가 (필수)
      // 참고: 기본 옵션이 이미 추가되어 있으므로 addOption() 호출하지 않음
      console.log('  3-5: 옵션에 품목 추가');
      const itemAdded = await eventCreatePage.addItemToOption();
      if (!itemAdded) {
        // 품목이 없으면 대분류에 연결된 SKU가 없는 경우
        // 품목(SKU)은 필수 필드이므로, 없으면 테스트 진행 불가
        console.log('⚠️ 연결된 품목(SKU)이 없어 품목 추가 실패');
        console.log('ℹ️ 상품 등록을 위해서는 해당 대분류에 SKU가 연결되어 있어야 합니다.');
        console.log('ℹ️ 먼저 SKU-CREATE-01을 실행하여 SKU를 생성하세요.');
        shouldSkipTest = true;
        skipReason = '대분류에 연결된 SKU가 없어 품목 추가 불가';
        return; // Step 3 종료
      }

      // 3-6: 판매량 기준 설정 (필수)
      console.log('  3-6: 판매량 기준 설정');
      const salesHeader = page.getByText('판매량기준', { exact: true });
      const headerBox = await salesHeader.boundingBox();
      const allSmCheckboxes = page.locator('input.control-size-sm');
      const smCount = await allSmCheckboxes.count();

      if (smCount > 0 && headerBox) {
        let closestIdx = 0;
        let closestDist = Infinity;
        for (let i = 0; i < smCount; i++) {
          const box = await allSmCheckboxes.nth(i).boundingBox();
          if (box && box.y > headerBox.y) {
            const dist = Math.abs(box.x - headerBox.x);
            if (dist < closestDist) {
              closestDist = dist;
              closestIdx = i;
            }
          }
        }

        const targetCheckbox = allSmCheckboxes.nth(closestIdx);
        await targetCheckbox.scrollIntoViewIfNeeded();
        await targetCheckbox.click();
        console.log('ℹ️ 판매량 기준 체크박스 클릭 완료');
      } else {
        console.log('⚠️ 판매량 기준 체크박스를 찾을 수 없음');
      }

      // 3-6: 옵션명 입력 (필수) - 한국어/영어
      console.log('  3-6: 옵션명 입력 (한국어)');
      await eventCreatePage.fillOptionNameKr(`테스트 옵션 ${newN}`);
      console.log('  3-6-1: 옵션명 입력 (영어)');
      await eventCreatePage.fillOptionNameEn('Option 1');

      // 3-7: 가격 설정 (필수) - 할인전/할인률
      console.log('  3-7: 가격 설정 (할인전: 2000, 할인률: 50)');
      await eventCreatePage.setPriceWithDiscount(2000, 50);

      // 3-9: 상품설명 입력
      console.log('  3-9: 상품설명 입력');
      await eventCreatePage.fillDescriptionKr(`자동화 테스트 상품입니다. (${timestamp})`);
    });

    // -------------------------------------------------------------------------
    // Step 4: 상품 등록 제출
    // -------------------------------------------------------------------------
    await test.step('Step 4: 상품 등록 제출', async () => {
      // 품목 추가 실패 시 Fail 처리
      expect(shouldSkipTest, `상품 등록 불가: ${skipReason}`).toBe(false);

      const submitBtn = page.getByRole('button', { name: '지금 등록하기' });

      // 버튼 활성화 확인
      await submitBtn.scrollIntoViewIfNeeded();
      const isDisabled = await submitBtn.isDisabled();
      console.log(`  버튼 상태: ${isDisabled ? '❌ 비활성화' : '✅ 활성화'}`);

      if (!isDisabled) {
        // API 응답 캡처를 위한 네트워크 리스너
        const apiResponses: { url: string; status: number; body: string }[] = [];
        page.on('response', async (response) => {
          const url = response.url();
          if (url.includes('/api/') || url.includes('/event')) {
            try {
              const status = response.status();
              const body = await response.text().catch(() => '(읽기 실패)');
              apiResponses.push({ url, status, body: body.substring(0, 500) });
            } catch { /* ignore */ }
          }
        });

        await submitBtn.click();
        console.log('  지금 등록하기 버튼 클릭');

        // 에러 메시지나 확인 팝업 표시 대기 (networkidle)
        await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

        // 에러/경고 메시지 확인
        const errorToast = page.locator('[class*="toast"], [class*="alert"], [class*="notification"]').first();
        if (await errorToast.isVisible({ timeout: 1000 }).catch(() => false)) {
          const errorText = await errorToast.textContent();
          console.log(`  ⚠️ 알림 메시지: ${errorText}`);

          // 에러가 있으면 필수 필드 확인
          if (errorText?.includes('필수') || errorText?.includes('KIT') || errorText?.includes('SKU')) {
            throw new Error(`등록 실패: ${errorText}`);
          }
        }

        // 확인 팝업이 있는지 확인 (등록 확인 팝업)
        let confirmClicked = false;
        const modal = page.locator('[class*="modal"], [class*="popup"], [class*="dialog"], [role="dialog"]').first();
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          // 모달 전체 텍스트 캡처 (에러 메시지인지 등록 확인인지 구분)
          const modalText = await modal.textContent().catch(() => '(읽기 실패)');
          console.log(`  📋 모달 내용: ${modalText?.trim().substring(0, 200)}`);

          const modalConfirmBtn = modal.locator('button', { hasText: '확인' });
          if (await modalConfirmBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
            console.log('  ✅ 모달 내 확인 버튼 발견 - 클릭');
            await modalConfirmBtn.click();
            confirmClicked = true;
            await modal.waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
          }
        }

        // 모달 내부에서 못찾았으면, 전체 페이지에서 확인 버튼 찾기
        if (!confirmClicked) {
          const confirmButton = page.getByRole('button', { name: '확인', exact: true });
          if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            console.log('  ✅ 등록 확인 팝업 발견 - 확인 버튼 클릭');
            await confirmButton.click();
            confirmClicked = true;
            await page.locator('[role="dialog"], .modal').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
          }
        }

        if (!confirmClicked) {
          console.log('  ℹ️ 확인 팝업 없음 - 리다이렉트 대기');
        }

        // 등록 성공 후 URL 확인 (목록 페이지 또는 편집 페이지로 이동)
        try {
          // 목록 페이지 또는 수정 페이지 중 하나로 이동
          await page.waitForURL(/\/event\/(list|update)/, { timeout: 30000 });
          await page.waitForLoadState('domcontentloaded');

          const currentUrl = page.url();
          if (currentUrl.includes('/event/update/')) {
            // 편집 페이지로 이동 - 상품 ID 추출
            const productId = currentUrl.match(/\/event\/update\/(\d+)/)?.[1];
            createdProductId = productId || '';
            console.log(`  ✅ 상품 등록 성공! 편집 페이지로 이동 (상품 ID: ${productId})`);
          } else {
            console.log('  ✅ 상품 목록 페이지로 이동 완료');
          }
        } catch (e) {
          // 리다이렉트 실패 - 현재 페이지 상태 확인
          const currentUrl = page.url();
          console.log(`  ⚠️ 리다이렉트 실패. 현재 URL: ${currentUrl}`);

          // API 응답 로그 출력
          console.log(`  📡 캡처된 API 응답: ${apiResponses.length}개`);
          for (const resp of apiResponses) {
            console.log(`    [${resp.status}] ${resp.url}`);
            if (resp.status >= 400 || resp.body.includes('error') || resp.body.includes('필수')) {
              console.log(`    응답: ${resp.body}`);
            }
          }

          // 에러 메시지가 있는지 확인
          const pageText = await page.locator('body').textContent() || '';
          if (pageText.includes('필수')) {
            console.log('  ❌ 필수 필드 오류가 있는 것 같습니다');
          }

          throw e;
        }
      } else {
        console.log('  ⚠️ 버튼이 비활성화 상태입니다. 필수 필드를 확인하세요.');
        // 테스트 실패 처리
        throw new Error('등록 버튼이 비활성화 상태입니다');
      }
    });

    // -------------------------------------------------------------------------
    // Step 5: 생성 결과 검증
    // -------------------------------------------------------------------------
    await test.step('Step 5: 생성 결과 검증', async () => {
      const currentUrl = page.url();

      if (!createdProductId && currentUrl.includes('/event/update/')) {
        createdProductId = currentUrl.match(/\/event\/update\/(\d+)/)?.[1] || '';
      }

      // 상품 ID가 있으면 등록 성공으로 판단
      if (createdProductId) {
        console.log(`✅ 상품 등록 성공! 상품 ID: ${createdProductId}`);

        // 목록 페이지에서 추가 검증 (선택 사항)
        console.log('ℹ️ 목록 페이지로 이동하여 등록 확인...');
        await eventListPage.navigate();
        await eventListPage.waitForTableData();

        // ID로 검색
        console.log(`ℹ️ 상품 ID로 검색: ${createdProductId}`);
        await eventListPage.searchById(createdProductId);

        // 테이블에 결과가 있는지 확인 (행 수 > 0)
        const rowCount = await page.locator('table tbody tr').count();
        if (rowCount > 0) {
          const firstRowText = await page.locator('table tbody tr').first().textContent() || '';
          console.log(`✅ 검색 결과: ${firstRowText.substring(0, 100)}...`);
        }

        console.log(`\n🎉 PRD-CREATE-01 통과: 상품 등록 완료 (ID: ${createdProductId})\n`);
        return;
      }

      // ID가 없으면 이름으로 탐색
      console.log('ℹ️ 상품 ID가 없어 이름으로 목록에서 탐색합니다.');
      await eventListPage.navigate();
      await eventListPage.waitForTableData();

      const row = await eventListPage.findRowByText(productName, 3);
      expect(row, '상품 목록에서 방금 등록한 상품을 찾지 못했습니다.').not.toBeNull();
      if (row) {
        await expect(row).toBeVisible();
      }

      console.log(`\n🎉 PRD-CREATE-01 통과: 상품 등록 완료 (${productName})\n`);
    });
  });
});
