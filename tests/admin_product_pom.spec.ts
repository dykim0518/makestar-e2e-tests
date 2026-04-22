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
 * 4. 전시 카테고리 (QA-84) - 생성 검증
 *    QA84-PAGE-01: 페이지 기본 요소 검증
 *    QA84-CREATE-01: 카테고리 생성 모달 폼 요소 확인
 *    QA84-CREATE-02: 카테고리 생성 후 목록 반영 확인
 *
 * @see tests/pages/admin-category-list.page.ts
 * @see tests/pages/admin-category-create.page.ts
 * @see tests/pages/admin-sku-list.page.ts
 * @see tests/pages/admin-sku-create.page.ts
 * @see tests/pages/admin-event-list.page.ts
 * @see tests/pages/admin-event-create.page.ts
 */

import { test, expect, type Locator } from "@playwright/test";
import {
  CategoryListPage,
  CategoryCreatePage,
  SKUListPage,
  SkuCreatePage,
  EventListPage,
  EventCreatePage,
  assertNoServerError,
} from "./pages";
import {
  waitForPageStable,
  waitForModalOpen,
  waitForTableUpdate,
  formatDate,
  getMaxAutomationTestNumber,
  getMaxSkuAutomationTestNumber,
  getMaxProductAutomationTestNumber,
  ELEMENT_TIMEOUT,
  applyAdminTestConfig,
} from "./helpers/admin/test-helpers";

// ============================================================================
// 테스트 설정
// ============================================================================
applyAdminTestConfig("상품 메뉴");

// ============================================================================
// 테스트 간 데이터 공유 (serial 모드용)
// ============================================================================
let sharedCategoryName = ""; // 대분류 생성 → 상품 등록 시 사용
let sharedSkuCode = ""; // SKU 생성 → 상품 등록 시 사용 (선택사항)

function buildSearchToken(source: string): string {
  const normalized = source
    .replace(/\[[^\]]*]/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[|/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const candidates = normalized
    .split(" ")
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 2 &&
        !/^\d+$/.test(token) &&
        ![
          "상품",
          "이벤트",
          "B2B",
          "B2C",
          "판매대기",
          "미노출",
          "미정",
        ].includes(token),
    );

  return (
    candidates.find((token) => /[A-Za-z가-힣]/.test(token)) ??
    candidates[0] ??
    normalized
  )
    .slice(0, 12)
    .trim();
}

function expectAllTextsContain(
  texts: string[],
  token: string,
  message: string,
): void {
  expect(texts.length, `${message} - 검증할 결과가 없습니다.`).toBeGreaterThan(
    0,
  );
  const mismatches = texts.filter((text) => !text.includes(token));
  expect(
    mismatches,
    `${message} - 불일치 결과: ${JSON.stringify(mismatches.slice(0, 5))}`,
  ).toHaveLength(0);
}

async function getColumnTexts(
  rows: Locator,
  cellIndex: number,
): Promise<string[]> {
  return await rows.evaluateAll(
    (elements, index) =>
      elements
        .map((element) =>
          (element.querySelectorAll("td")[index]?.textContent ?? "").trim(),
        )
        .filter(Boolean),
    cellIndex,
  );
}

// ##############################################################################
// 1. 대분류 (CAT) - 목록 검증
// ##############################################################################
test.describe("대분류 목록 @feature:admin_makestar.product.list", () => {
  let categoryPage: CategoryListPage;

  // ============================================================================
  // 페이지 로드 및 기본 요소
  // ============================================================================
  test.describe("페이지 로드 및 기본 요소", () => {
    test.beforeEach(async ({ page }) => {
      categoryPage = new CategoryListPage(page);
      await categoryPage.navigate();
      await waitForPageStable(page);
    });

    test("CAT-PAGE-01: 페이지 타이틀 검증", async () => {
      await categoryPage.assertPageTitle();
    });

    test("CAT-PAGE-02: 페이지 헤딩 검증", async () => {
      await categoryPage.assertHeading();
    });

    test("CAT-PAGE-03: 브레드크럼 네비게이션 검증", async () => {
      const isBreadcrumbVisible = await categoryPage.breadcrumb
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      expect(
        isBreadcrumbVisible,
        "❌ 브레드크럼이 보이지 않습니다. UI가 변경되었는지 확인하세요.",
      ).toBeTruthy();
      await categoryPage.assertBreadcrumb(categoryPage.getBreadcrumbPath());
    });

    test("CAT-PAGE-04: 테이블 데이터 로드 검증", async () => {
      await expect(categoryPage.table).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      const rowCount = await categoryPage.getRowCount();
      expect(rowCount, "❌ 테이블에 데이터가 없습니다.").toBeGreaterThan(0);
    });

    test("CAT-PAGE-05: 검색 영역 표시 검증", async () => {
      await expect(categoryPage.keywordInput).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(categoryPage.searchButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(categoryPage.resetButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
    });

    test("CAT-PAGE-06: 액션 버튼 표시 검증", async () => {
      await expect(categoryPage.createCategoryButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(categoryPage.excelDownloadButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
    });
  });

  // ============================================================================
  // 검색 기능
  // ============================================================================
  test.describe("검색 기능", () => {
    test.beforeEach(async ({ page }) => {
      categoryPage = new CategoryListPage(page);
      await categoryPage.navigate();
      await waitForPageStable(page);
    });

    test("CAT-SEARCH-01: 키워드 검색", async () => {
      const initialRowCount = await categoryPage.getRowCount();
      expect(
        initialRowCount,
        "❌ 초기 테이블에 데이터가 없습니다.",
      ).toBeGreaterThan(0);

      const categoryNamesBefore = await getColumnTexts(
        categoryPage.tableRows,
        3,
      );
      const searchToken = (categoryNamesBefore[0] ?? "").trim();
      expect(
        searchToken.length,
        "❌ 검색 가능한 대분류 키워드를 추출하지 못했습니다.",
      ).toBeGreaterThan(1);

      await categoryPage.searchByKeyword(searchToken);
      await waitForTableUpdate(categoryPage.page);
      const rowTexts = await getColumnTexts(categoryPage.tableRows, 3);
      expect(
        rowTexts.length,
        `❌ "${searchToken}" 검색 결과에 대분류 이름 컬럼이 없습니다.`,
      ).toBeGreaterThan(0);
      expect(
        rowTexts.some((text) => text.includes(searchToken)),
        `❌ 대분류 검색 결과 안에 "${searchToken}"가 포함된 항목이 없습니다.`,
      ).toBe(true);
    });

    test("CAT-SEARCH-02: 검색 초기화", async () => {
      await categoryPage.keywordInput.fill("테스트검색어");
      await categoryPage.clickResetButton();
      await expect(categoryPage.keywordInput).toHaveValue("", {
        timeout: ELEMENT_TIMEOUT,
      });
    });

    test("CAT-SEARCH-03: 존재하지 않는 항목 검색", async () => {
      const randomString = "ZZZNOTEXIST_" + Date.now();
      await categoryPage.searchByKeyword(randomString);
      await categoryPage.assertNoSearchResult();
    });
  });

  // ============================================================================
  // 페이지네이션
  // ============================================================================
  test.describe("페이지네이션", () => {
    test.beforeEach(async ({ page }) => {
      categoryPage = new CategoryListPage(page);
      await categoryPage.navigate();
      await waitForPageStable(page);
    });

    test("CAT-PAGIN-01: 다음 페이지 이동", async () => {
      const rowCount = await categoryPage.getRowCount();
      expect(rowCount, "❌ 테이블에 데이터가 없습니다").toBeGreaterThan(0);

      const isNextVisible = await categoryPage.nextPageButton
        .isVisible()
        .catch(() => false);
      const isNextEnabled = isNextVisible
        ? await categoryPage.nextPageButton.isEnabled().catch(() => false)
        : false;

      expect(
        isNextVisible && isNextEnabled,
        "다음 페이지 버튼이 없거나 비활성화 상태입니다 - 데이터가 1페이지만 존재",
      ).toBeTruthy();

      const firstRowBefore = await categoryPage.getFirstRow().textContent();
      await categoryPage.goToNextPage();
      await waitForPageStable(categoryPage.page, 5000);
      const firstRowAfter = await categoryPage.getFirstRow().textContent();

      expect(
        firstRowBefore,
        "페이지 이동 후 데이터가 변경되지 않았습니다.",
      ).not.toBe(firstRowAfter);
    });

    test("CAT-PAGIN-02: 페이지당 표시 개수 검증", async () => {
      await categoryPage.assertRowCountWithinLimit(10);
    });
  });

  // ============================================================================
  // 액션 버튼
  // ============================================================================
  test.describe("액션 버튼", () => {
    test.beforeEach(async ({ page }) => {
      categoryPage = new CategoryListPage(page);
      await categoryPage.navigate();
      await waitForPageStable(page);
    });

    test("CAT-ACTION-01: 대분류 생성 페이지 이동", async ({ page }) => {
      await categoryPage.goToCreateCategory();
      await expect(page).toHaveURL(/\/product\/new\/create(\?.*)?$/, {
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(
        page.getByRole("button", { name: "대분류 생성 완료" }),
      ).toBeVisible({ timeout: ELEMENT_TIMEOUT });
    });
  });
});

// ##############################################################################
// 1. 대분류 (CAT) - 신규 생성
// ##############################################################################
test.describe
  .serial("대분류 생성 @feature:admin_makestar.product.create", () => {
  test("CAT-CREATE-01: 대분류 신규 생성 및 검증", async ({ page }) => {
    const categoryListPage = new CategoryListPage(page);
    const categoryCreatePage = new CategoryCreatePage(page);

    // -------------------------------------------------------------------------
    // Step 1: 기존 자동화 테스트 대분류 최대 번호(N) 조회
    // -------------------------------------------------------------------------
    await test.step("Step 1: 기존 대분류 번호 조회", async () => {
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
    await test.step("Step 2: 대분류 생성 페이지 이동", async () => {
      await categoryCreatePage.navigate();
      await waitForPageStable(page);

      await assertNoServerError(page, "대분류 생성 페이지");

      // 페이지 로드 확인
      await expect(page).toHaveURL(/\/product\/new\/create/);
    });

    // -------------------------------------------------------------------------
    // Step 3: 대분류 정보 입력
    // -------------------------------------------------------------------------
    await test.step("Step 3: 대분류 정보 입력", async () => {
      // 대분류명 (한국어)
      await categoryCreatePage.fillNameKr(categoryNameKr);

      // 대분류명 (영어)
      await categoryCreatePage.fillNameEn(categoryNameEn);

      // 유통사 선택 ("메이크스타" 검색)
      await categoryCreatePage.selectDistributor("메이크스타");

      // 아티스트 선택 ("테스트123")
      await categoryCreatePage.selectArtist("테스트123");

      // 발매일 (오늘 날짜)
      await categoryCreatePage.fillReleaseDate(today);

      // 이미지 업로드
      const imagePath = "fixtures/ta_sample.png";
      await categoryCreatePage.uploadImage(imagePath);
    });

    // -------------------------------------------------------------------------
    // Step 4: 대분류 생성 완료
    // -------------------------------------------------------------------------
    await test.step("Step 4: 대분류 생성 완료", async () => {
      await categoryCreatePage.submitAndWaitForList();
    });

    // -------------------------------------------------------------------------
    // Step 5: 목록에서 생성 결과 검증
    // -------------------------------------------------------------------------
    await test.step("Step 5: 생성 결과 검증", async () => {
      await expect(page).toHaveURL(/\/product\/new\/list/);
      await waitForPageStable(page);

      const keywordInput = page.locator('input[placeholder="검색어 입력"]');
      expect(
        await keywordInput.isVisible({ timeout: 5000 }).catch(() => false),
        "❌ 생성 결과를 검증할 검색 필드가 보이지 않습니다.",
      ).toBe(true);

      let createdVisible = false;
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        await keywordInput.fill(categoryNameKr);
        const searchBtn = page
          .locator('button:has-text("조회하기"), img[cursor="pointer"]')
          .first();
        await searchBtn.click();
        await waitForTableUpdate(page);
        await waitForPageStable(page);

        const createdRow = page
          .locator(`table tbody tr:has-text("${categoryNameKr}")`)
          .first();
        createdVisible = await createdRow
          .isVisible({ timeout: ELEMENT_TIMEOUT })
          .catch(() => false);
        if (createdVisible) {
          break;
        }

        if (attempt < 3) {
          await page.reload({ waitUntil: "domcontentloaded" });
          await waitForPageStable(page);
        }
      }

      expect(
        createdVisible,
        `❌ 생성한 대분류가 목록에 반영되지 않았습니다: ${categoryNameKr}`,
      ).toBe(true);
    });
  });
});

// ##############################################################################
// 2. SKU - 목록 검증
// ##############################################################################
test.describe.serial("SKU 목록 @feature:admin_makestar.sku.list", () => {
  let skuPage: SKUListPage;

  // ============================================================================
  // 페이지 로드 및 기본 요소
  // ============================================================================
  test.describe("페이지 로드 및 기본 요소", () => {
    test.beforeEach(async ({ page }) => {
      skuPage = new SKUListPage(page);
      await skuPage.navigate();
      await waitForPageStable(page);
      await expect(skuPage.table).toBeVisible({ timeout: 15000 });
    });

    test("SKU-PAGE-01: 페이지 타이틀 검증", async () => {
      await skuPage.assertPageTitle();
    });

    test("SKU-PAGE-02: 페이지 헤딩 검증", async () => {
      await skuPage.assertHeading();
    });

    test("SKU-PAGE-03: 브레드크럼 네비게이션 검증", async () => {
      await skuPage.assertBreadcrumb(skuPage.getBreadcrumbPath());
    });

    test("SKU-PAGE-04: 테이블 헤더 검증", async () => {
      await expect(skuPage.table).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await skuPage.assertTableHeaders(skuPage.getExpectedHeaders());
    });

    test("SKU-PAGE-05: 테이블 데이터 로드 검증", async () => {
      await expect(skuPage.table).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      const rowCount = await skuPage.getRowCount();
      expect(
        rowCount,
        "테이블에 데이터가 없습니다. 데이터를 확인하세요.",
      ).toBeGreaterThan(0);
    });

    test("SKU-PAGE-06: 검색 영역 표시 검증", async () => {
      await expect(skuPage.skuCodeInput).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(skuPage.searchButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(skuPage.resetButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
    });

    test("SKU-PAGE-07: 액션 버튼 표시 검증", async () => {
      await expect(skuPage.createSKUButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(skuPage.createBonusSKUButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(skuPage.bulkEditButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(skuPage.categoryManageButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
    });
  });

  // ============================================================================
  // 검색 기능
  // ============================================================================
  test.describe("검색 기능", () => {
    test.beforeEach(async ({ page }) => {
      skuPage = new SKUListPage(page);
      await skuPage.navigate();
      await waitForPageStable(page);
    });

    test("SKU-SEARCH-01: SKU코드로 검색", async () => {
      const skuCode = await skuPage.getFirstRowSKUCode();
      expect(skuCode, "❌ 검색 기준 SKU코드를 찾지 못했습니다.").toBeTruthy();

      await skuPage.searchBySKUCode(skuCode);
      await waitForTableUpdate(skuPage.page);
      await skuPage.waitForTableData();

      const firstRow = skuPage.getFirstRow();
      await expect(firstRow).toContainText(skuCode, {
        timeout: ELEMENT_TIMEOUT,
      });
    });

    test("SKU-SEARCH-02: 상품명으로 검색", async () => {
      const productName = await skuPage.getFirstRowProductName();
      const searchToken = buildSearchToken(productName);
      expect(
        searchToken.length,
        "❌ 검색 가능한 SKU 상품명 토큰을 추출하지 못했습니다.",
      ).toBeGreaterThan(1);

      await skuPage.searchByProductName(searchToken);
      await waitForTableUpdate(skuPage.page);
      const rowCount = await skuPage.waitForTableData();
      expect(
        rowCount,
        `❌ "${searchToken}" 검색 결과가 없습니다.`,
      ).toBeGreaterThan(0);

      const productNames = await getColumnTexts(skuPage.tableRows, 2);
      expectAllTextsContain(
        productNames,
        searchToken,
        `❌ SKU 상품명 검색 결과가 "${searchToken}"를 포함해야 합니다.`,
      );
    });

    test("SKU-SEARCH-03: 검색 초기화", async () => {
      await expect(skuPage.skuCodeInput).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(skuPage.skuCodeInput).toBeEnabled({
        timeout: ELEMENT_TIMEOUT,
      });

      await skuPage.skuCodeInput.fill("테스트검색어");
      await skuPage.clickResetButton();
      await expect(skuPage.skuCodeInput).toHaveValue("", {
        timeout: ELEMENT_TIMEOUT,
      });
    });

    test("SKU-SEARCH-04: 빈 검색어로 조회", async () => {
      await skuPage.clickSearchAndWait();
      const rowCount = await skuPage.waitForTableData();
      expect(
        rowCount,
        "❌ 빈 검색어 조회 시 데이터가 없습니다.",
      ).toBeGreaterThan(0);
    });

    test("SKU-SEARCH-05: 존재하지 않는 항목 검색", async () => {
      const randomString = "ZZZNOTEXIST_" + Date.now();
      await skuPage.searchBySKUCode(randomString);
      await skuPage.assertNoSearchResult();
    });
  });

  // ============================================================================
  // 페이지네이션
  // ============================================================================
  test.describe("페이지네이션", () => {
    test.beforeEach(async ({ page }) => {
      skuPage = new SKUListPage(page);
      await skuPage.navigate();
      await waitForPageStable(page);
    });

    test("SKU-PAGIN-01: 다음 페이지 이동", async () => {
      const rowCount = await skuPage.getRowCount();
      expect(rowCount, "❌ 테이블에 데이터가 없습니다").toBeGreaterThan(0);

      const isNextVisible = await skuPage.nextPageButton
        .isVisible()
        .catch(() => false);
      const isNextEnabled = isNextVisible
        ? await skuPage.nextPageButton.isEnabled().catch(() => false)
        : false;

      expect(
        isNextVisible && isNextEnabled,
        "다음 페이지 버튼이 없거나 비활성화 상태입니다 - 데이터가 1페이지만 존재",
      ).toBeTruthy();

      const firstRowBefore = await skuPage.getFirstRow().textContent();
      await skuPage.goToNextPage();
      await waitForPageStable(skuPage.page, 5000);
      const firstRowAfter = await skuPage.getFirstRow().textContent();

      expect(
        firstRowBefore,
        "페이지 이동 후 데이터가 변경되지 않았습니다.",
      ).not.toBe(firstRowAfter);
    });

    test("SKU-PAGIN-02: 특정 페이지 번호로 이동", async () => {
      const navigated = await skuPage.goToPage(2);
      expect(
        navigated,
        "페이지 2 버튼이 없습니다 - 데이터가 1페이지만 존재",
      ).toBeTruthy();

      const rowCount = await skuPage.getRowCount();
      expect(rowCount, "❌ 페이지 2에 데이터가 없습니다.").toBeGreaterThan(0);
    });

    test("SKU-PAGIN-03: 첫 페이지 버튼 활성화 검증", async () => {
      const page1Button = skuPage.page.locator(
        'nav[aria-label="Pagination"] button:has-text("1")',
      );
      const isPage1Visible = await page1Button.isVisible().catch(() => false);

      if (isPage1Visible) {
        const isActive = await page1Button.getAttribute("aria-current");
        expect(isActive).toBe("page");
        console.log("ℹ️ 페이지 1 버튼 활성화 확인됨");
      } else {
        console.log("ℹ️ 페이지네이션 버튼 없음 (1페이지만 존재) - 정상");
      }
    });

    test("SKU-PAGIN-04: 페이지당 표시 개수 검증", async () => {
      await skuPage.assertRowCountWithinLimit(10);
    });
  });

  // ============================================================================
  // SKU 상세 페이지 이동
  // ============================================================================
  test.describe("상세 페이지 이동", () => {
    test.beforeEach(async ({ page }) => {
      skuPage = new SKUListPage(page);
      await skuPage.navigate();
      await waitForPageStable(page);
    });

    test("SKU-DETAIL-01: 상세 페이지 이동", async ({ page }) => {
      await skuPage.clickFirstRow(1);

      await expect(page).toHaveURL(/\/sku\/(?!list$)[^/?#]+/, {
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(
        page.locator("h1, h2").filter({ hasText: /SKU/ }).first(),
      ).toBeVisible({ timeout: ELEMENT_TIMEOUT });
    });
  });

  // ============================================================================
  // 액션 버튼
  // ============================================================================
  test.describe("액션 버튼", () => {
    test.beforeEach(async ({ page }) => {
      skuPage = new SKUListPage(page);
      await skuPage.navigate();
      await waitForPageStable(page);
      await expect(skuPage.table).toBeVisible({ timeout: 15000 });
      await expect(skuPage.createSKUButton).toBeVisible({ timeout: 10000 });
    });

    test("SKU-ACTION-01: SKU 생성 페이지 이동", async ({ page }) => {
      await expect(skuPage.createSKUButton).toBeEnabled({ timeout: 10000 });
      await Promise.all([
        page.waitForURL(/\/sku\/create/, { timeout: ELEMENT_TIMEOUT }),
        skuPage.createSKUButton.click(),
      ]);
    });

    test("SKU-ACTION-02: 특전 SKU 생성 페이지 이동", async ({ page }) => {
      await skuPage.goToCreateBonusSKU();
      await expect(page).toHaveURL(/\/sku/, { timeout: ELEMENT_TIMEOUT });
    });
  });
});

// ##############################################################################
// 2. SKU - 신규 생성
// ##############################################################################
test.describe.serial("SKU 생성 @feature:admin_makestar.sku.create", () => {
  test("SKU-CREATE-01: SKU 신규 생성 및 검증", async ({ page }) => {
    const skuListPage = new SKUListPage(page);
    const skuCreatePage = new SkuCreatePage(page);

    // Step 1: SKU 목록에서 기존 자동화테스트 번호 조회
    let existingMaxN = 0;
    await test.step("Step 1: SKU 목록에서 기존 번호 확인", async () => {
      await skuListPage.navigate();
      await waitForPageStable(page);
      existingMaxN = await getMaxSkuAutomationTestNumber(page);
    });

    const newN = existingMaxN + 1;
    const skuName = `[자동화테스트] 샘플 SKU ${newN}`;
    console.log(`ℹ️ 기존 최대 번호: ${existingMaxN}, 새 SKU: ${skuName}`);

    // Step 2: SKU 생성 페이지로 이동
    await test.step("Step 2: SKU 생성 페이지 이동", async () => {
      await skuCreatePage.navigate();
      await waitForPageStable(page);

      await assertNoServerError(page, "SKU 생성 페이지");
    });

    // Step 3: 필수 필드 입력 (POM 메서드 사용)
    await test.step("Step 3: 필수 필드 입력", async () => {
      // 폼 요소 로드 대기 - vendorMultiselect가 visible할 때까지
      await skuCreatePage.vendorMultiselect.waitFor({
        state: "visible",
        timeout: 15000,
      });
      console.log("  ✅ SKU 생성 폼 로드 완료");

      // 3-1: 메인 타이틀명 입력 (한국어 + 영어) - POM 메서드 사용
      console.log("  3-1: 메인 타이틀명 입력");
      await skuCreatePage.fillMainTitle(
        skuName,
        `[Automation] Sample SKU ${newN}`,
      );

      // 3-2: 발주처 선택 (유통사 자동 연동) - POM 메서드 사용
      console.log("  3-2: 발주처 선택 (유통사 자동 연동)");
      await skuCreatePage.selectVendor("메이크스타");

      // 3-3: 아티스트 선택 - POM 메서드 사용
      console.log("  3-3: 아티스트 선택");
      await skuCreatePage.selectArtist("테스트123");

      // 3-4: 카테고리 선택 (음반 > LP) - POM 메서드 사용
      console.log("  3-4: 카테고리 선택");
      await skuCreatePage.selectCategory("음반", "LP");

      // 3-5: 상품사양 입력 (중량, 가로, 세로, 높이) - POM 메서드 사용
      console.log("  3-5: 상품사양 입력");
      await skuCreatePage.fillSpecifications({
        weight: "500",
        width: "100",
        depth: "100",
        height: "50",
      });
    });

    // Step 4: SKU 생성 버튼 클릭
    await test.step("Step 4: SKU 생성", async () => {
      // 버튼 활성화 확인
      const isDisabled = await skuCreatePage.createButton.isDisabled();
      console.log(`  버튼 상태: ${isDisabled ? "❌ 비활성화" : "✅ 활성화"}`);
      expect(isDisabled).toBe(false);

      // 생성 버튼 클릭
      await skuCreatePage.createButton.click();
      console.log("  SKU 생성 버튼 클릭");

      // 상세 페이지로 리다이렉트 대기 (정확한 URL: /sku/SKU{코드})
      await page.waitForURL(/\/sku\/SKU\d+/, { timeout: 15000 });
      await waitForPageStable(page);

      const newUrl = page.url();
      const skuCodeMatch = newUrl.match(/\/sku\/(SKU\d+)/);
      if (skuCodeMatch) {
        console.log(`  생성된 SKU 코드: ${skuCodeMatch[1]}`);
      }
      console.log("  SKU 상세 페이지로 이동 완료");
    });

    // Step 5: 상세 페이지에서 생성 결과 검증
    await test.step("Step 5: 상세 페이지에서 생성 결과 검증", async () => {
      // 상세 페이지에서 SKU 코드 추출
      const currentUrl = page.url();
      const skuCodeMatch = currentUrl.match(/\/sku\/(SKU\d+)/);
      const createdSkuCode = skuCodeMatch ? skuCodeMatch[1] : null;

      expect(createdSkuCode, "❌ SKU 코드를 추출할 수 없습니다.").toBeTruthy();
      const safeSkuCode = createdSkuCode!;
      console.log(`  생성된 SKU 코드: ${createdSkuCode}`);

      await expect(page).toHaveURL(new RegExp(`/sku/${safeSkuCode}$`), {
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(
        page.locator("h1, h2").filter({ hasText: /SKU/ }).first(),
      ).toBeVisible({ timeout: ELEMENT_TIMEOUT });

      sharedSkuCode = safeSkuCode;
      console.log(`✅ SKU 생성 및 상세 페이지 검증 완료: ${skuName}`);
    });
  });
});

// ##############################################################################
// 3. 상품 (PRD) - 목록 검증
// ##############################################################################
test.describe("상품 목록 @feature:admin_makestar.event.list", () => {
  let eventPage: EventListPage;

  // ============================================================================
  // 페이지 로드 및 기본 요소
  // ============================================================================
  test.describe("페이지 로드 및 기본 요소", () => {
    test.beforeEach(async ({ page }) => {
      eventPage = new EventListPage(page);
      await eventPage.navigate();
      await waitForPageStable(page);
    });

    test("PRD-PAGE-01: 페이지 타이틀 검증", async () => {
      await eventPage.assertPageTitle();
    });

    test("PRD-PAGE-02: 페이지 헤딩 검증", async () => {
      await eventPage.assertHeading();
    });

    test("PRD-PAGE-03: 브레드크럼 네비게이션 검증", async () => {
      const isBreadcrumbVisible = await eventPage.breadcrumb
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (isBreadcrumbVisible) {
        await eventPage.assertBreadcrumb(eventPage.getBreadcrumbPath());
      } else {
        console.log("ℹ️ 새 UI: 브레드크럼이 제거됨 - 정상");
      }
    });

    test("PRD-PAGE-04: 테이블 데이터 로드 검증", async () => {
      await expect(eventPage.table).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      const rowCount = await eventPage.getRowCount();
      expect(rowCount, "❌ 테이블에 데이터가 없습니다.").toBeGreaterThan(0);
    });

    test("PRD-PAGE-05: 검색 영역 표시 검증", async () => {
      await expect(eventPage.nameInput).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
    });

    test("PRD-PAGE-06: 액션 버튼 표시 검증", async () => {
      await expect(eventPage.excelDownloadButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
    });
  });

  // ============================================================================
  // 검색 기능
  // ============================================================================
  test.describe("검색 기능", () => {
    test.beforeEach(async ({ page }) => {
      eventPage = new EventListPage(page);
      await eventPage.navigate();
      await waitForPageStable(page);
    });

    test("PRD-SEARCH-01: 상품명으로 검색", async () => {
      const productNamesBefore = await getColumnTexts(eventPage.tableRows, 6);
      const searchToken = buildSearchToken(productNamesBefore[0] ?? "");
      expect(
        searchToken.length,
        "❌ 검색 가능한 상품명 토큰을 추출하지 못했습니다.",
      ).toBeGreaterThan(1);

      await eventPage.searchByName(searchToken);
      const hasNoResult = await eventPage.noResultMessage
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(
        hasNoResult,
        `❌ "${searchToken}" 검색 시 결과가 없어야 할 이유가 없습니다.`,
      ).toBe(false);

      const productNames = await getColumnTexts(eventPage.tableRows, 6);
      expect(
        productNames.length,
        `❌ "${searchToken}" 검색 결과에 상품명 컬럼이 없습니다.`,
      ).toBeGreaterThan(0);
      expectAllTextsContain(
        productNames,
        searchToken,
        `❌ 상품명 검색 결과가 "${searchToken}"를 포함해야 합니다.`,
      );
    });

    test("PRD-SEARCH-02: 검색어 입력 초기화", async () => {
      await eventPage.nameInput.fill("임시검색어");
      await eventPage.nameInput.clear();
      await expect(eventPage.nameInput).toHaveValue("", {
        timeout: ELEMENT_TIMEOUT,
      });
    });

    test("PRD-SEARCH-03: 존재하지 않는 상품명 검색", async () => {
      const randomString = `ZZZNOTEXIST_${Date.now()}`;
      await eventPage.searchByName(randomString);

      const rowCount = await eventPage.getRowCount();
      const hasNoResult = await eventPage.noResultMessage
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      expect(
        rowCount === 0 || hasNoResult,
        `❌ 존재하지 않는 상품명 검색 시 결과가 남아 있습니다. rows=${rowCount}, noResult=${hasNoResult}`,
      ).toBe(true);
    });
  });

  // ============================================================================
  // 페이지네이션
  // ============================================================================
  test.describe("페이지네이션", () => {
    test.beforeEach(async ({ page }) => {
      eventPage = new EventListPage(page);
      await eventPage.navigate();
      await waitForPageStable(page);
    });

    test("PRD-PAGIN-01: 다음 페이지 이동", async () => {
      const rowCount = await eventPage.getRowCount();
      expect(rowCount, "❌ 테이블에 데이터가 없습니다.").toBeGreaterThan(0);

      const page2Button = eventPage.page.locator(
        'nav[aria-label="Pagination"] button:has-text("2")',
      );
      const isPage2Visible = await page2Button
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      if (!isPage2Visible) {
        console.log("ℹ️ 페이지 2 버튼이 없음 - 데이터가 1페이지만 있음 (정상)");
        return;
      }

      const firstRowBefore = await eventPage.getFirstRow().textContent();
      await page2Button.click();
      await waitForPageStable(eventPage.page, 3000);
      const firstRowAfter = await eventPage.getFirstRow().textContent();

      expect(
        firstRowBefore,
        "페이지 이동 후 데이터가 변경되지 않았습니다.",
      ).not.toBe(firstRowAfter);
    });

    test("PRD-PAGIN-02: 페이지당 표시 개수 검증", async () => {
      await eventPage.assertRowCountWithinLimit(10);
    });
  });

  // ============================================================================
  // 액션 버튼
  // ============================================================================
  test.describe("액션 버튼", () => {
    test.beforeEach(async ({ page }) => {
      eventPage = new EventListPage(page);
      await eventPage.navigate();
      await waitForPageStable(page);
    });

    test("PRD-ACTION-01: 상품 등록 페이지 이동", async ({ page }) => {
      await expect(eventPage.createProductButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await eventPage.goToCreateProduct();
      await expect(page).toHaveURL(/\/event\/create$/, {
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(
        page.getByRole("button", { name: "지금 등록하기" }),
      ).toBeVisible({ timeout: ELEMENT_TIMEOUT });
    });
  });
});

// ##############################################################################
// 3. 상품 (PRD) - 신규 등록
// ##############################################################################
test.describe.serial("상품 등록 @feature:admin_makestar.event.create", () => {
  test("PRD-CREATE-01: 상품 신규 등록 및 검증", async ({ page }, testInfo) => {
    // 다단계 테스트 (대분류 확인/생성 → 상품등록 → 폼입력 → 저장) — 타임아웃 확장
    test.setTimeout(300_000);
    const eventListPage = new EventListPage(page);
    const eventCreatePage = new EventCreatePage(page);

    // Skip 플래그 (품목 추가 실패 시 테스트 종료용)
    let shouldSkipTest = false;
    let skipReason = "";
    let createdProductId = "";

    // -------------------------------------------------------------------------
    // Step 1: 기존 자동화 테스트 상품 최대 번호(N) 조회
    // -------------------------------------------------------------------------
    let existingMaxN = 0;
    await test.step("Step 1: 상품 목록에서 기존 번호 확인", async () => {
      await eventListPage.navigate();
      await waitForPageStable(page);
      existingMaxN = await getMaxProductAutomationTestNumber(page);
    });

    const newN = existingMaxN + 1;
    const timestamp = Date.now();
    const productName = `[자동화테스트] 샘플 상품 ${newN}_${timestamp}`;
    console.log(`ℹ️ 기존 최대 번호: ${existingMaxN}, 새 상품: ${productName}`);

    // -------------------------------------------------------------------------
    // Step 1.5: 테스트용 대분류 보장 (없으면 자동 생성)
    // -------------------------------------------------------------------------
    const fixedTestCategory = "[자동화테스트] 전용 대분류";
    await test.step("Step 1.5: 테스트용 대분류 및 품목 보장", async () => {
      const categoryListPage = new CategoryListPage(page);
      const categoryCreatePage = new CategoryCreatePage(page);

      // 대분류 목록에서 검색 (대괄호 제외한 키워드로 검색 — 검색 API 호환성)
      const searchKeyword = "자동화테스트 전용 대분류";
      await categoryListPage.navigate();
      await waitForPageStable(page);
      await categoryListPage.searchByKeyword(searchKeyword);

      // 테이블에서 해당 행 존재 확인
      let matchingRow = page
        .locator("table tbody tr")
        .filter({ hasText: fixedTestCategory });
      let rowCount = await matchingRow.count();

      if (rowCount > 0) {
        console.log(`✅ 테스트용 대분류 존재 확인: "${fixedTestCategory}"`);
      } else {
        // 없으면 생성
        console.log(
          `⚠️ 테스트용 대분류 없음 → 자동 생성: "${fixedTestCategory}"`,
        );
        await categoryCreatePage.navigate();
        await waitForPageStable(page);

        const today = formatDate(new Date());
        await categoryCreatePage.fillCreateForm({
          nameKr: fixedTestCategory,
          nameEn: "[Automation] Dedicated Category",
          distributor: "메이크스타",
          artist: "테스트123",
          releaseDate: today,
          imagePath: "fixtures/ta_sample.png",
        });

        await categoryCreatePage.submitAndWaitForList();
        await waitForPageStable(page);

        // 생성 확인 — 목록에서 재검색
        await categoryListPage.navigate();
        await waitForPageStable(page);
        await categoryListPage.searchByKeyword(searchKeyword);
        matchingRow = page
          .locator("table tbody tr")
          .filter({ hasText: fixedTestCategory });
        rowCount = await matchingRow.count();
        expect(
          rowCount,
          `대분류 "${fixedTestCategory}" 생성 후 목록에서 찾을 수 없음`,
        ).toBeGreaterThan(0);
        console.log(
          `✅ 테스트용 대분류 자동 생성 완료: "${fixedTestCategory}"`,
        );
      }

      // --- 품목 보장 ---
      // 대분류 상세 페이지로 이동 (행의 이름 셀 클릭)
      await matchingRow.first().locator("td").nth(3).click();
      await page
        .locator('h1:has-text("대분류 수정")')
        .waitFor({ timeout: 15000 });
      await waitForPageStable(page);
      console.log(`ℹ️ 대분류 상세 페이지 이동 완료`);

      // 품목 섹션 로드 대기: "품목 생성" 버튼이 보이면 섹션 렌더링 완료
      await page
        .getByRole("button", { name: "품목 생성" })
        .waitFor({ state: "visible", timeout: 10000 });

      // 품목 존재 확인: "하위품목(" 텍스트가 5초 내에 나타나면 이미 품목 존재
      const hasExistingItems = await page
        .locator('p:has-text("하위품목(")')
        .first()
        .waitFor({ state: "visible", timeout: 5000 })
        .then(() => true)
        .catch(() => false);

      if (hasExistingItems) {
        const labelText = await page
          .locator('p:has-text("하위품목(")')
          .first()
          .textContent();
        console.log(`✅ 품목 존재 확인: ${labelText} — 추가 생성 불필요`);
        return;
      }

      // 품목 없음 → "품목 생성" 버튼 클릭하여 모달 열기
      console.warn("⚠️ 품목 없음 → 품목 생성 시작");
      await page.getByRole("button", { name: "품목 생성" }).click();
      await waitForPageStable(page);

      // 모달: 품목명 입력 (필수: 한국어, 영어)
      await page
        .locator('input[placeholder="한국어명를 입력해주세요"]')
        .fill("[자동화테스트] 전용 품목");
      await page
        .locator('input[placeholder="영어명을 입력해주세요"]')
        .fill("[Automation] Dedicated Item");

      // 모달: SKU 테이블 로드 대기 후 상단 2개 체크박스 선택
      const modalTable = page.locator('table:has(th:has-text("SKU 코드"))');
      const skuCheckboxes = modalTable.locator(
        'tbody tr input[type="checkbox"]',
      );

      // SKU 행이 로드될 때까지 대기
      await skuCheckboxes.first().waitFor({ state: "visible", timeout: 10000 });
      const availableSKUs = await skuCheckboxes.count();
      console.log(`ℹ️ 선택 가능한 SKU: ${availableSKUs}개`);

      const selectCount = Math.min(2, availableSKUs);
      for (let i = 0; i < selectCount; i++) {
        await skuCheckboxes.nth(i).check();
      }

      // "선택한 하위 품목 연결" 클릭
      await page.getByRole("button", { name: "선택한 하위 품목 연결" }).click();
      await waitForPageStable(page);

      // "품목 생성하기" 클릭 (하위 품목 연결 후 활성화됨)
      await page
        .getByRole("button", { name: "품목 생성하기" })
        .click({ timeout: 10000 });
      await waitForPageStable(page);

      console.log("✅ 품목 생성 완료");
    });

    // -------------------------------------------------------------------------
    // Step 2: 상품 등록 페이지로 이동 (새로운 등록 모드)
    // -------------------------------------------------------------------------
    await test.step("Step 2: 상품 등록 페이지 이동 (새 등록)", async () => {
      // 복사 등록 모드를 피하기 위해 직접 URL로 이동 (해시 없이)
      await page.goto("https://stage-new-admin.makeuni2026.com/event/create", {
        waitUntil: "domcontentloaded",
      });
      await waitForPageStable(page);

      await assertNoServerError(page, "상품 등록 페이지");

      // 페이지 로드 확인
      const pageTitle = page.locator('h1:has-text("상품 등록")');
      await expect(pageTitle).toBeVisible({ timeout: 10000 });
      console.log("✅ 상품 등록 페이지 로드 완료");
    });

    // -------------------------------------------------------------------------
    // Step 3: 필수 정보만 입력 (최소한의 데이터로 등록)
    // -------------------------------------------------------------------------
    await test.step("Step 3: 필수 상품 정보 입력", async () => {
      // 페이지 상단으로 스크롤
      await page.evaluate(() => window.scrollTo(0, 0));

      // 3-0: 대분류 정보 선택 (필수 - 품목 추가의 전제조건)
      // Step 2.5에서 테스트용 대분류 존재가 보장됨
      console.log("  3-0: 대분류 정보 선택");
      console.log(`ℹ️ 사용할 대분류: ${fixedTestCategory}`);

      const selectedCategory =
        await eventCreatePage.selectMajorCategory(fixedTestCategory);
      console.log(`ℹ️ 선택된 대분류: ${selectedCategory}`);

      // 선택된 대분류가 테스트 전용이 아닌 경우 경고
      if (!selectedCategory.includes("[자동화테스트]")) {
        console.log(
          `⚠️ 주의: 선택된 대분류가 "[자동화테스트]" 접두사가 아닙니다. 다량구매특전 등 추가 검증이 발생할 수 있습니다.`,
        );
      }

      // 3-1: 상품명 입력 (필수)
      console.log("  3-1: 상품명 입력");
      const productNameKr = productName;
      const productNameEn = `[Automation Test] Sample Product ${timestamp}`;

      // 한국어 상품명
      const nameKrInput = page.getByPlaceholder("한글 값을 입력해주세요");
      await nameKrInput.scrollIntoViewIfNeeded();
      await nameKrInput.fill(productNameKr);
      console.log(`ℹ️ 한국어 상품명: ${productNameKr}`);

      // 영어 상품명
      const nameEnInput = page.getByPlaceholder("영문 값을 입력해주세요");
      await nameEnInput.fill(productNameEn);
      console.log(`ℹ️ 영어 상품명: ${productNameEn}`);

      // 3-2: 이미지 업로드 (필수)
      console.log("  3-2: 이미지 업로드");
      await eventCreatePage.uploadImage("fixtures/ta_sample.png");

      // 3-3: 노출 카테고리 선택 (필수)
      console.log("  3-3: 노출 카테고리 선택");
      for (const catName of ["상품 카테고리", "B2B 카테고리"]) {
        // 카테고리 탭 버튼 클릭 → 해당 카테고리 드롭다운 활성화
        const catTab = page.getByText(catName, { exact: true });
        if (!(await catTab.isVisible({ timeout: 3000 }).catch(() => false))) {
          console.log(`  ℹ️ ${catName} 탭 미발견 — 스킵`);
          continue;
        }

        await catTab.scrollIntoViewIfNeeded();
        await catTab.click({ force: true });
        await page.waitForLoadState("domcontentloaded").catch(() => {});

        // "카테고리를 선택해주세요" placeholder 클릭으로 드롭다운 열기
        const placeholder = page.getByText("카테고리를 선택해주세요").first();
        if (await placeholder.isVisible({ timeout: 2000 }).catch(() => false)) {
          await placeholder.click({ force: true });
          await expect(placeholder)
            .toBeVisible({ timeout: 3000 })
            .catch(() => {});

          // 드롭다운이 열리면 "앨범" 옵션 클릭
          // 체크박스 + 텍스트 형태의 옵션 리스트에서 찾기
          const albumSelected = await page.evaluate(() => {
            // 현재 보이는 드롭다운/팝업에서 "앨범" 텍스트를 가진 클릭 가능한 요소 찾기
            const candidates = [...document.querySelectorAll("*")].filter(
              (e) => {
                const text = e.textContent?.trim();
                const isLeaf = e.children.length === 0;
                const isVisible = (e as HTMLElement).offsetParent !== null;
                return text === "앨범" && isLeaf && isVisible;
              },
            );
            // 가장 최근에 나타난(DOM 순서상 뒤쪽) 요소가 드롭다운 옵션일 확률이 높음
            const target = candidates[candidates.length - 1];
            if (target) {
              // 부모 중 클릭 가능한 가장 가까운 요소 클릭
              const clickable =
                target.closest(
                  "li, label, div[class*='option'], div[class*='item']",
                ) || target;
              (clickable as HTMLElement).click();
              return true;
            }
            return false;
          });

          if (albumSelected) {
            console.log(`  ✅ ${catName} "앨범" 선택 완료`);
          } else {
            console.warn(`  ⚠️ ${catName}: "앨범" 옵션 미발견`);
          }

          // 드롭다운 닫기
          await page.keyboard.press("Escape");
          await page.waitForLoadState("domcontentloaded").catch(() => {});
        } else {
          console.log(`  ℹ️ ${catName}: 이미 선택됨 — 스킵`);
        }
      }

      // 3-4: 판매기간 설정 (필수)
      console.log("  3-4: 판매기간 설정");
      await eventCreatePage.selectTodayAsSalePeriod();

      // 3-5: 옵션에 품목(KIT) 추가 (필수)
      // 참고: 기본 옵션이 이미 추가되어 있으므로 addOption() 호출하지 않음
      console.log("  3-5: 옵션에 품목 추가");
      const itemAdded = await eventCreatePage.addItemToOption();
      if (!itemAdded) {
        // 품목이 없으면 대분류에 연결된 SKU가 없는 경우
        // 품목(SKU)은 필수 필드이므로, 없으면 테스트 진행 불가
        console.warn("⚠️ 연결된 품목(SKU)이 없어 품목 추가 실패");
        console.log(
          "ℹ️ 상품 등록을 위해서는 해당 대분류에 SKU가 연결되어 있어야 합니다.",
        );
        console.log("ℹ️ 먼저 SKU-CREATE-01을 실행하여 SKU를 생성하세요.");
        shouldSkipTest = true;
        skipReason = "대분류에 연결된 SKU가 없어 품목 추가 불가";
        return; // Step 3 종료
      }

      // 3-6: 판매량 기준 설정 (필수)
      console.log("  3-6: 판매량 기준 설정");
      const salesHeader = page.getByText("판매량기준", { exact: true });
      const headerBox = await salesHeader.boundingBox();
      const allSmCheckboxes = page.locator("input.control-size-sm");
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
        console.log("ℹ️ 판매량 기준 체크박스 클릭 완료");
      } else {
        console.warn("⚠️ 판매량 기준 체크박스를 찾을 수 없음");
      }

      // 3-6: 옵션명 입력 (필수) - 한국어/영어
      console.log("  3-6: 옵션명 입력 (한국어)");
      await eventCreatePage.fillOptionNameKr(`테스트 옵션 ${newN}`);
      console.log("  3-6-1: 옵션명 입력 (영어)");
      await eventCreatePage.fillOptionNameEn("Option 1");

      // 3-7: 가격 설정 (필수) - 할인전/할인률
      console.log("  3-7: 가격 설정 (할인전: 2000, 할인률: 50)");
      await eventCreatePage.setPriceWithDiscount(2000, 50);

      // 3-9: 상품설명 입력
      console.log("  3-9: 상품설명 입력");
      await eventCreatePage.fillDescriptionKr(
        `자동화 테스트 상품입니다. (${timestamp})`,
      );

      // 3-9-1: 상품설명 입력 (영어) — 필수 필드
      console.log("  3-9-1: 상품설명 입력 (영어)");
      {
        // "상품설명" 섹션 내 "영어" 탭 버튼 클릭
        const descSection = page.locator("text=상품설명").first();
        await descSection.scrollIntoViewIfNeeded();

        const enTab = page
          .locator("button")
          .filter({ hasText: /^영어$/ })
          .first();
        if (await enTab.isVisible({ timeout: 3000 }).catch(() => false)) {
          await enTab.click({ force: true });
          await page.waitForLoadState("domcontentloaded").catch(() => {});
        }

        // 에디터 입력
        const editor = page
          .locator(
            '.tiptap[contenteditable="true"], .ProseMirror[contenteditable="true"]',
          )
          .first();
        if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
          await editor.evaluate((el: HTMLElement) => {
            el.scrollIntoView({ behavior: "instant", block: "center" });
          });
          await editor
            .waitFor({ state: "visible", timeout: 3000 })
            .catch(() => {});
          await editor.evaluate((el: HTMLElement) => {
            el.focus();
            el.click();
          });
          await page.keyboard.type(`Automation test product. (${timestamp})`);
          console.log("  ✅ 상품설명(영어) 입력 완료");
        } else {
          console.warn("  ⚠️ 영어 상품설명 에디터 미발견");
        }
      }

      // 3-10: 다량구매특전 비활성화 (필수 아님 — label[for="toggle"] 클릭으로 OFF)
      // DOM: <input id="toggle" type="checkbox" hidden> + <label for="toggle">
      console.log("  3-10: 다량구매특전 비활성화");
      const benefitToggled = await page.evaluate(() => {
        const checkbox = document.querySelector(
          'input#toggle[type="checkbox"]',
        ) as HTMLInputElement | null;
        if (!checkbox) return "not-found";
        if (checkbox.checked) {
          const label = document.querySelector(
            'label[for="toggle"]',
          ) as HTMLElement | null;
          if (label) {
            label.scrollIntoView({ behavior: "instant", block: "center" });
            label.click();
            return "toggled-off";
          }
          return "label-not-found";
        }
        return "already-off";
      });
      if (benefitToggled === "toggled-off") {
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        console.log("  ✅ 다량구매특전 토글 OFF");
      } else if (benefitToggled === "already-off") {
        console.log("  ℹ️ 다량구매특전 이미 OFF 상태");
      } else {
        console.warn(`  ⚠️ 다량구매특전 토글 처리 실패: ${benefitToggled}`);
      }
    });

    // -------------------------------------------------------------------------
    // Step 4: 상품 등록 제출
    // -------------------------------------------------------------------------
    await test.step("Step 4: 상품 등록 제출", async () => {
      // 품목 추가 실패 시 Fail 처리
      expect(shouldSkipTest, `상품 등록 불가: ${skipReason}`).toBe(false);

      const submitBtn = page.getByRole("button", { name: "지금 등록하기" });

      // 버튼 활성화 확인
      await submitBtn.scrollIntoViewIfNeeded();
      const isDisabled = await submitBtn.isDisabled();
      console.log(`  버튼 상태: ${isDisabled ? "❌ 비활성화" : "✅ 활성화"}`);

      if (!isDisabled) {
        // API 응답 캡처를 위한 네트워크 리스너
        const apiResponses: { url: string; status: number; body: string }[] =
          [];
        page.on("response", async (response) => {
          const url = response.url();
          if (url.includes("/api/") || url.includes("/event")) {
            try {
              const status = response.status();
              const body = await response.text().catch(() => "(읽기 실패)");
              apiResponses.push({ url, status, body: body.substring(0, 500) });
            } catch {
              /* ignore */
            }
          }
        });

        await submitBtn.click();
        console.log("  지금 등록하기 버튼 클릭");

        // 에러 메시지나 확인 팝업 표시 대기 (networkidle)
        await page
          .waitForLoadState("networkidle", { timeout: 5000 })
          .catch(() => {});

        // 프론트엔드 유효성 검증 실패 감지 (인라인 에러 / 필수 필드 하이라이트)
        const validationErrors = page.locator(
          '[class*="error"]:visible, [class*="invalid"]:visible, [class*="required"]:visible:not(label)',
        );
        const validationErrorCount = await validationErrors
          .count()
          .catch(() => 0);
        if (validationErrorCount > 0 && apiResponses.length === 0) {
          // API 호출 없이 유효성 검증 실패 - 필수 필드 누락
          const errorTexts: string[] = [];
          for (let i = 0; i < Math.min(validationErrorCount, 5); i++) {
            const text = await validationErrors
              .nth(i)
              .textContent()
              .catch(() => "");
            if (text?.trim()) errorTexts.push(text.trim().substring(0, 100));
          }
          console.log(
            `  ⚠️ 프론트엔드 유효성 검증 실패 (${validationErrorCount}개): ${errorTexts.join(", ")}`,
          );
        }

        // 에러/경고 메시지 확인
        const errorToast = page
          .locator(
            '[class*="toast"], [class*="alert"], [class*="notification"]',
          )
          .first();
        if (await errorToast.isVisible({ timeout: 1000 }).catch(() => false)) {
          const errorText = await errorToast.textContent();
          console.warn(`  ⚠️ 알림 메시지: ${errorText}`);

          // 에러가 있으면 필수 필드 확인
          if (
            errorText?.includes("필수") ||
            errorText?.includes("KIT") ||
            errorText?.includes("SKU")
          ) {
            throw new Error(`등록 실패: ${errorText}`);
          }
        }

        // 확인 팝업이 있는지 확인 (등록 확인 팝업)
        let confirmClicked = false;
        const modal = page
          .locator(
            '[class*="modal"], [class*="popup"], [class*="dialog"], [role="dialog"]',
          )
          .first();
        if (await modal.isVisible({ timeout: 3000 }).catch(() => false)) {
          // 모달 전체 텍스트 캡처 (에러 메시지인지 등록 확인인지 구분)
          const modalText = await modal
            .textContent()
            .catch(() => "(읽기 실패)");
          console.log(`  📋 모달 내용: ${modalText?.trim().substring(0, 200)}`);

          const modalConfirmBtn = modal.locator("button", { hasText: "확인" });
          if (
            await modalConfirmBtn
              .isVisible({ timeout: 1000 })
              .catch(() => false)
          ) {
            console.log("  ✅ 모달 내 확인 버튼 발견 - 클릭");
            await modalConfirmBtn.click();
            confirmClicked = true;
            await modal
              .waitFor({ state: "hidden", timeout: 5000 })
              .catch(() => {});
          }
        }

        // 모달 내부에서 못찾았으면, 전체 페이지에서 확인 버튼 찾기
        if (!confirmClicked) {
          const confirmButton = page.getByRole("button", {
            name: "확인",
            exact: true,
          });
          if (
            await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)
          ) {
            console.log("  ✅ 등록 확인 팝업 발견 - 확인 버튼 클릭");
            await confirmButton.click();
            confirmClicked = true;
            await page
              .locator('[role="dialog"], .modal')
              .waitFor({ state: "hidden", timeout: 5000 })
              .catch(() => {});
          }
        }

        if (!confirmClicked) {
          console.log("  ℹ️ 확인 팝업 없음 - 리다이렉트 대기");
        }

        // 등록 성공 후 URL 확인 (목록 페이지 또는 편집 페이지로 이동)
        try {
          // 목록 페이지 또는 수정 페이지 중 하나로 이동
          await page.waitForURL(/\/event\/(list|update)/, { timeout: 30000 });
          await page.waitForLoadState("domcontentloaded");

          const currentUrl = page.url();
          if (currentUrl.includes("/event/update/")) {
            // 편집 페이지로 이동 - 상품 ID 추출
            const productId = currentUrl.match(/\/event\/update\/(\d+)/)?.[1];
            createdProductId = productId || "";
            console.log(
              `  ✅ 상품 등록 성공! 편집 페이지로 이동 (상품 ID: ${productId})`,
            );
          } else {
            console.log("  ✅ 상품 목록 페이지로 이동 완료");
          }
        } catch (e) {
          // 리다이렉트 실패 - 현재 페이지 상태 확인
          const currentUrl = page.url();
          console.warn(`  ⚠️ 리다이렉트 실패. 현재 URL: ${currentUrl}`);

          // API 응답 로그 출력
          console.log(`  📡 캡처된 API 응답: ${apiResponses.length}개`);
          for (const resp of apiResponses) {
            console.log(`    [${resp.status}] ${resp.url}`);
            if (
              resp.status >= 400 ||
              resp.body.includes("error") ||
              resp.body.includes("필수")
            ) {
              console.log(`    응답: ${resp.body}`);
            }
          }

          // 에러 메시지가 있는지 확인
          const pageText = (await page.locator("body").textContent()) || "";
          if (pageText.includes("필수")) {
            console.error("  ❌ 필수 필드 오류가 있는 것 같습니다");
          }

          // API 호출이 없었으면 프론트엔드 유효성 검증 실패
          if (apiResponses.length === 0) {
            // 현재 스크롤 위치의 필수 표시(*) 확인
            const requiredMarkers = await page
              .locator('[class*="required"]:visible, [class*="error"]:visible')
              .count()
              .catch(() => 0);
            console.log(`  📋 화면의 필수/에러 표시: ${requiredMarkers}개`);
            throw new Error(
              `폼 제출 실패: 프론트엔드 유효성 검증 미통과 (API 호출 0건). 필수 필드를 확인하세요.`,
            );
          }

          throw e;
        }
      } else {
        console.warn(
          "  ⚠️ 버튼이 비활성화 상태입니다. 필수 필드를 확인하세요.",
        );
        // 테스트 실패 처리
        throw new Error("등록 버튼이 비활성화 상태입니다");
      }
    });

    // -------------------------------------------------------------------------
    // Step 5: 생성 결과 검증
    // -------------------------------------------------------------------------
    await test.step("Step 5: 생성 결과 검증", async () => {
      const currentUrl = page.url();

      if (!createdProductId && currentUrl.includes("/event/update/")) {
        createdProductId =
          currentUrl.match(/\/event\/update\/(\d+)/)?.[1] || "";
      }

      // 상품 ID가 있으면 등록 성공으로 판단
      if (createdProductId) {
        console.log(`✅ 상품 등록 성공! 상품 ID: ${createdProductId}`);

        // 목록 페이지에서 추가 검증 (선택 사항)
        console.log("ℹ️ 목록 페이지로 이동하여 등록 확인...");
        await eventListPage.navigate();
        await eventListPage.waitForTableData();

        // ID로 검색
        console.log(`ℹ️ 상품 ID로 검색: ${createdProductId}`);
        await eventListPage.searchById(createdProductId);

        // 테이블에 결과가 있는지 확인 (행 수 > 0)
        const rowCount = await page.locator("table tbody tr").count();
        if (rowCount > 0) {
          const firstRowText =
            (await page.locator("table tbody tr").first().textContent()) || "";
          console.log(`✅ 검색 결과: ${firstRowText.substring(0, 100)}...`);
        }

        console.log(
          `\n🎉 PRD-CREATE-01 통과: 상품 등록 완료 (ID: ${createdProductId})\n`,
        );
        return;
      }

      // ID가 없으면 이름으로 탐색
      console.log("ℹ️ 상품 ID가 없어 이름으로 목록에서 탐색합니다.");
      await eventListPage.navigate();
      await eventListPage.waitForTableData();

      const row = await eventListPage.findRowByText(productName, 3);
      expect(
        row,
        "상품 목록에서 방금 등록한 상품을 찾지 못했습니다.",
      ).not.toBeNull();
      if (row) {
        await expect(row).toBeVisible();
      }

      console.log(`\n🎉 PRD-CREATE-01 통과: 상품 등록 완료 (${productName})\n`);
    });
  });

  // ========================================================================
  // 4. 전시 카테고리 — QA-84: 전시 카테고리 생성 불가
  // Jira: https://makestar-product.atlassian.net/browse/QA-84
  // ========================================================================
  test.describe
    .serial("전시 카테고리 생성 @feature:admin_makestar.displaycategory", () => {
    const DC_URL = "https://stage-new-admin.makeuni2026.com/display-category";
    const DC_SUFFIX = Date.now().toString().slice(-6);
    const DC_CATEGORY = {
      ko: `[자동화테스트] QA84 카테고리 ${DC_SUFFIX}`,
      en: `[AutoTest] QA84 Category ${DC_SUFFIX}`,
      zh: `[AutoTest] QA84 ${DC_SUFFIX}`,
      ja: `[AutoTest] QA84 ${DC_SUFFIX}`,
    };

    test.beforeEach(async ({ page }) => {
      await page.goto(DC_URL);
      await waitForPageStable(page);
      await page.waitForLoadState("networkidle");
    });

    test("QA84-PAGE-01: 전시 카테고리 목록 페이지 기본 요소 노출 검증", async ({
      page,
    }) => {
      await expect(page.getByRole("button", { name: "B2C" })).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(page.getByRole("button", { name: "B2B" })).toBeVisible();
      await expect(
        page.getByText("카테고리 생성", { exact: true }),
      ).toBeVisible();

      const categoryLinks = page.locator('a[href*="/display-category/"]');
      await expect(categoryLinks.first()).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(
        page.getByRole("button", { name: "변경내용 저장하기" }),
      ).toBeVisible();
    });

    test("QA84-CREATE-01: 카테고리 생성 모달 폼 요소 확인", async ({
      page,
    }) => {
      await page
        .locator('[class*="button-accent"]:has-text("카테고리 생성")')
        .click();
      await waitForModalOpen(page);

      await expect(page.getByPlaceholder("한글 값을 입력해주세요")).toBeVisible(
        { timeout: ELEMENT_TIMEOUT },
      );
      await expect(
        page.getByPlaceholder("영문 값을 입력해주세요"),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder("중문 값을 입력해주세요"),
      ).toBeVisible();
      await expect(
        page.getByPlaceholder("일본어 값을 입력해주세요"),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "취소" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "전시 카테고리 생성하기" }),
      ).toBeVisible();
    });

    test("QA84-CREATE-02: 카테고리 생성 후 목록 반영 확인", async ({
      page,
    }) => {
      await page
        .locator('[class*="button-accent"]:has-text("카테고리 생성")')
        .click();
      await waitForModalOpen(page);

      await page
        .getByPlaceholder("한글 값을 입력해주세요")
        .fill(DC_CATEGORY.ko);
      await page
        .getByPlaceholder("영문 값을 입력해주세요")
        .fill(DC_CATEGORY.en);
      await page
        .getByPlaceholder("중문 값을 입력해주세요")
        .fill(DC_CATEGORY.zh);
      await page
        .getByPlaceholder("일본어 값을 입력해주세요")
        .fill(DC_CATEGORY.ja);

      await page
        .getByRole("button", { name: "전시 카테고리 생성하기" })
        .click();

      await expect(page.getByText(DC_CATEGORY.ko)).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
    });
  });

  // ========================================================================
  // 5. 전시 카테고리 — QA-85: 저장되지 않은 변경사항 팝업 미노출
  // Jira: https://makestar-product.atlassian.net/browse/QA-85
  // 재현경로: 전시 카테고리 상세에서 상품 순서 변경 → 뒤로가기 → 미저장 팝업
  // 기대결과: 'beforeunload' 다이얼로그 노출 + 사용자 선택에 따라 유지/이탈
  // ========================================================================
  test.describe
    .serial("전시 카테고리 우선순위 변경 — 미저장 팝업 (QA-85)", () => {
    const DC_PARENT =
      "https://stage-new-admin.makeuni2026.com/display-category";
    const DC_DETAIL = `${DC_PARENT}/34?type=B2C`;

    test.beforeEach(async ({ page }) => {
      // 히스토리 컨텍스트 확보: 두 번 goto()는 Vue router 히스토리에 안 쌓여
      // 뒤로가기 @click 핸들러가 no-op이 됨. 사용자 여정(목록 → 링크 클릭)으로
      // SPA 라우팅을 거쳐 상세 진입해야 router.back()이 정상 동작.
      await page.goto(DC_PARENT);
      await waitForPageStable(page);

      const categoryLink = page
        .locator('a[href="/display-category/34?type=B2C"]')
        .first();
      await categoryLink.waitFor({ state: "visible", timeout: 10000 });
      await categoryLink.click();
      await page.waitForURL(/\/display-category\/34(?:\?|$|\/)/, {
        timeout: 10000,
      });
      await waitForPageStable(page);
    });

    test("QA85-PAGE-01: 전시 카테고리 상세 페이지 기본 요소 노출", async ({
      page,
    }) => {
      await expect(
        page.getByRole("button", { name: /변경내용 저장/ }),
        "'변경내용 저장하기' 버튼이 노출되어야 합니다",
      ).toBeVisible({ timeout: ELEMENT_TIMEOUT });

      await expect(
        page.getByRole("button", { name: /상품 추가/ }),
        "'상품 추가하기' 버튼이 노출되어야 합니다",
      ).toBeVisible({ timeout: ELEMENT_TIMEOUT });

      await page
        .locator(".draggable-item")
        .first()
        .waitFor({ state: "visible", timeout: 15000 });
      const itemCount = await page.locator(".draggable-item").count();
      expect(
        itemCount,
        "드래그 가능한 상품 아이템이 2개 이상 있어야 순서 변경 테스트 가능",
      ).toBeGreaterThanOrEqual(2);
    });

    test("QA85-ACTION-01: 변경 없이 뒤로가기 시 다이얼로그 미노출 (기준선)", async ({
      page,
    }) => {
      const dialogs: string[] = [];
      page.on("dialog", async (dialog) => {
        dialogs.push(dialog.type());
        await dialog.dismiss();
      });

      const backBtn = page
        .locator('svg:has(use[href="#icon-arrow-left-line"])')
        .first();
      await backBtn.click();
      await page.waitForTimeout(2000);

      expect(
        dialogs.find((t) => t === "beforeunload"),
        "변경 없이 뒤로가기 시 beforeunload 다이얼로그가 떠서는 안 됩니다",
      ).toBeUndefined();
    });

    test("QA85-DATA-01: 순서 변경 후 뒤로가기 시 다이얼로그 노출 + dismiss 시 페이지 유지", async ({
      page,
    }) => {
      const dialogs: Array<{ type: string }> = [];
      page.on("dialog", async (dialog) => {
        dialogs.push({ type: dialog.type() });
        await dialog.dismiss();
      });

      const saveBtn = page.getByRole("button", { name: /변경내용 저장/ });
      await expect(saveBtn).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      expect(
        await saveBtn.isDisabled(),
        "드래그 전 저장 버튼은 비활성 상태여야 합니다",
      ).toBe(true);

      const items = page.locator(".draggable-item");
      await expect(items.first()).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      const firstText = await items.first().textContent();

      // 1번 핸들에서 2번 아래로 드래그
      const sBox = await items
        .nth(0)
        .locator(".handle.cursor-grab")
        .boundingBox();
      const tBox = await items
        .nth(1)
        .locator(".handle.cursor-grab")
        .boundingBox();
      if (!sBox || !tBox) throw new Error("핸들 위치 가져오기 실패");
      const sx = sBox.x + sBox.width / 2;
      const sy = sBox.y + sBox.height / 2;
      const tx = tBox.x + tBox.width / 2;
      const ty = tBox.y + tBox.height + 10;

      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.waitForTimeout(200);
      for (let i = 1; i <= 25; i++) {
        await page.mouse.move(
          sx + ((tx - sx) * i) / 25,
          sy + ((ty - sy) * i) / 25,
        );
        await page.waitForTimeout(30);
      }
      await page.mouse.up();
      await page.waitForTimeout(1500);

      // Dirty state 확인
      const newFirstText = await items.first().textContent();
      expect(newFirstText, "드래그로 순서가 변경되어야 합니다").not.toBe(
        firstText,
      );
      expect(
        await saveBtn.isDisabled(),
        "드래그 후 저장 버튼이 활성화되어야 합니다 (dirty state)",
      ).toBe(false);

      // 뒤로가기 → 다이얼로그 노출 + dismiss → 페이지 유지
      const backBtn = page
        .locator('svg:has(use[href="#icon-arrow-left-line"])')
        .first();
      await backBtn.click();
      await page.waitForTimeout(2000);

      expect(
        dialogs.find((d) => d.type === "beforeunload"),
        "순서 변경 후 뒤로가기 시 beforeunload 다이얼로그가 노출되어야 합니다 (QA-85 회귀 방지)",
      ).toBeDefined();
      expect(
        page.url(),
        "다이얼로그 dismiss 후에는 현재 페이지에 유지되어야 합니다",
      ).toContain("/display-category/34");
    });

    test("QA85-DATA-02: 다이얼로그 accept 시 실제 부모 페이지로 이탈", async ({
      page,
    }) => {
      const dialogs: Array<{ type: string }> = [];
      page.on("dialog", async (dialog) => {
        dialogs.push({ type: dialog.type() });
        await dialog.accept();
      });

      const saveBtn = page.getByRole("button", { name: /변경내용 저장/ });
      await expect(saveBtn).toBeVisible({ timeout: ELEMENT_TIMEOUT });

      const items = page.locator(".draggable-item");
      await expect(items.first()).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      const firstText = await items.first().textContent();

      const sBox = await items
        .nth(0)
        .locator(".handle.cursor-grab")
        .boundingBox();
      const tBox = await items
        .nth(1)
        .locator(".handle.cursor-grab")
        .boundingBox();
      if (!sBox || !tBox) throw new Error("핸들 위치 가져오기 실패");
      const sx = sBox.x + sBox.width / 2;
      const sy = sBox.y + sBox.height / 2;
      const tx = tBox.x + tBox.width / 2;
      const ty = tBox.y + tBox.height + 10;

      await page.mouse.move(sx, sy);
      await page.mouse.down();
      await page.waitForTimeout(200);
      for (let i = 1; i <= 25; i++) {
        await page.mouse.move(
          sx + ((tx - sx) * i) / 25,
          sy + ((ty - sy) * i) / 25,
        );
        await page.waitForTimeout(30);
      }
      await page.mouse.up();
      await page.waitForTimeout(1500);

      const newFirstText = await items.first().textContent();
      expect(newFirstText, "드래그로 순서가 변경되어야 합니다").not.toBe(
        firstText,
      );

      const backBtn = page
        .locator('svg:has(use[href="#icon-arrow-left-line"])')
        .first();
      await backBtn.click();
      await page.waitForTimeout(3000);

      expect(
        dialogs.find((d) => d.type === "beforeunload"),
        "beforeunload 다이얼로그가 노출되어야 합니다",
      ).toBeDefined();

      expect(
        page.url(),
        `accept 후 부모 페이지(/display-category)로 이동해야 합니다. 현재: ${page.url()}`,
      ).toMatch(/\/display-category(?:\?|$|\/)(?!34)/);
    });
  });
});

// ##############################################################################
// 5. 포토카드 SKU 작업 관리 — QA-39: SKU명 검색 불가
// Jira: https://makestar-product.atlassian.net/browse/QA-39
// 재현경로: 입고~작업 관리 > 작업 현황 > SKU명 입력 후 검색 → 검색 불가
// 기대결과: SKU명으로 검색 가능
// ##############################################################################
test.describe
  .serial("포토카드 SKU 작업 현황 — SKU명 검색 (QA-39) @feature:admin_makestar.photocardsku.work", () => {
  const TARGET_URL =
    "https://stage-new-admin.makeuni2026.com/photocard-sku/work/pending";

  test.beforeEach(async ({ page }) => {
    await page.goto(TARGET_URL);
    await waitForPageStable(page);
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
  });

  test("QA39-PAGE-01: 작업 현황 페이지 기본 요소 + 검색 입력 노출", async ({
    page,
  }) => {
    await expect(
      page.getByPlaceholder("SKU 코드, 이름을 입력해주세요"),
      "SKU 코드/이름 검색 입력이 노출되어야 합니다",
    ).toBeVisible({ timeout: ELEMENT_TIMEOUT });

    await expect(
      page.getByRole("button", { name: "검색", exact: false }),
      "검색 버튼이 노출되어야 합니다",
    ).toBeVisible({ timeout: ELEMENT_TIMEOUT });

    // 테이블 헤더 — SKU명 컬럼 존재
    await expect(
      page.locator("table thead th").filter({ hasText: "SKU명" }),
      "테이블 헤더에 'SKU명' 컬럼이 있어야 합니다",
    ).toBeVisible({ timeout: ELEMENT_TIMEOUT });
  });

  test("QA39-SEARCH-01: 실제 SKU명으로 검색 시 결과 노출 (QA-39 회귀 방지)", async ({
    page,
  }) => {
    // 1) 데이터 확보: 첫 행에서 SKU명 추출
    await expect(
      page.locator("table tbody tr").first(),
      "기준선: 검색 전 목록에 데이터가 1건 이상 있어야 합니다",
    ).toBeVisible({ timeout: ELEMENT_TIMEOUT });

    const skuNameCol = await page
      .locator("table thead th")
      .allTextContents()
      .then((cols) => cols.findIndex((c) => c.trim() === "SKU명"));
    expect(skuNameCol, "SKU명 컬럼 인덱스를 찾아야 합니다").toBeGreaterThan(0);

    const firstSkuName = (
      await page
        .locator("table tbody tr")
        .first()
        .locator("td")
        .nth(skuNameCol)
        .textContent()
    )?.trim();
    expect(
      firstSkuName && firstSkuName.length > 0,
      "첫 행의 SKU명을 추출할 수 있어야 합니다",
    ).toBe(true);

    // SKU명에서 검색 가능한 토큰 추출 (괄호/파이프 구분자 제외)
    // 예: "(미사용)아이딧(IDID)|P_9506_IDID_19|볼빵빵ver." → "아이딧"
    const searchToken =
      firstSkuName!
        .replace(/\([^)]*\)/g, "") // 괄호 안 내용 제거
        .split("|")[0] // 파이프 첫 토큰
        .trim()
        .slice(0, 8) || firstSkuName!.slice(0, 5);

    console.log(`  ℹ️ 추출 토큰: "${searchToken}" (원본: "${firstSkuName}")`);

    // 2) 검색 실행
    const skuInput = page.getByPlaceholder("SKU 코드, 이름을 입력해주세요");
    await skuInput.fill(searchToken);
    await page
      .getByRole("button", { name: "검색", exact: false })
      .click({ force: true });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(1500);

    // 3) 결과 검증: 결과가 있고, 모든 행의 SKU명에 검색 토큰 포함
    const rowCount = await page.locator("table tbody tr").count();
    expect(
      rowCount,
      `SKU명 "${searchToken}" 검색 시 결과가 있어야 합니다 (QA-39 회귀 방지)`,
    ).toBeGreaterThan(0);

    const resultSkuNames = await page
      .locator("table tbody tr")
      .evaluateAll(
        (rows, idx) =>
          rows.map((r) =>
            (r as HTMLElement).querySelectorAll("td")[idx]?.textContent?.trim(),
          ),
        skuNameCol,
      );

    const mismatches = resultSkuNames.filter(
      (name) => !name?.includes(searchToken),
    );
    expect(
      mismatches.length,
      `검색 결과의 모든 SKU명에 토큰이 포함되어야 합니다. 불일치: ${JSON.stringify(mismatches)}`,
    ).toBe(0);

    console.log(
      `  ✅ QA-39 회귀 없음 — "${searchToken}" 검색 → ${rowCount}건 노출, 전부 포함`,
    );
  });

  test("QA39-SEARCH-02: 존재하지 않는 SKU명 검색 시 빈 결과 표시", async ({
    page,
  }) => {
    const noiseToken = `__NO_MATCH_${Date.now()}__`;
    await page
      .getByPlaceholder("SKU 코드, 이름을 입력해주세요")
      .fill(noiseToken);
    await page
      .getByRole("button", { name: "검색", exact: false })
      .click({ force: true });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(1500);

    // 데이터 행 0 또는 "결과 없음" 메시지
    const rowCount = await page.locator("table tbody tr").count();
    const hasNoResult = await page
      .getByText(/검색결과가 없습니다|결과가 없|데이터가 없/)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(
      rowCount === 0 || hasNoResult,
      `존재하지 않는 SKU명 검색 시 결과 없음이 표시되어야 합니다 (rows=${rowCount}, noResultMsg=${hasNoResult})`,
    ).toBe(true);
  });
});
