/**
 * POCAAlbum Admin Shop 상품 CRUD 테스트
 *
 * ============================================================================
 * Section 4: Shop 상품 CRUD
 * ============================================================================
 *   PS-PAGE-01: 목록 로드
 *   PS-SEARCH-01: 키워드 검색
 *   PS-DATA-01: 노출 상태 확인
 *   PS-CREATE-01: 생성 폼 입력 및 제출 직전 검증
 *
 * @see tests/pages/ (POM 클래스)
 * @see tests/helpers/admin/ (인증/공통 유틸)
 */
import { test, expect, type Locator } from "@playwright/test";
import {
  PocaShopListPage,
  PocaShopCreatePage,
  assertNoServerError,
} from "./pages";
import {
  waitForPageStable,
  ELEMENT_TIMEOUT,
  applyAdminTestConfig,
} from "./helpers/admin/test-helpers";

// 공통 설정 (토큰검증 + 뷰포트체크 + 인증쿠키)
applyAdminTestConfig("포카앨범");

async function readExposureState(
  exposureCell: Locator,
): Promise<boolean | null> {
  // 노출 토글은 CSS 커스텀 스위치(label.switch-button > input.switch-input)이며
  // 실제 input[type=checkbox]는 시각적으로 숨겨져 isVisible()이 false다.
  // 따라서 가시성이 아니라 존재 여부로 판단하고 checked 상태를 직접 읽는다.
  const checkbox = exposureCell.locator('input[type="checkbox"]').first();
  if ((await checkbox.count()) > 0) {
    return await checkbox.isChecked();
  }

  const ariaControl = exposureCell
    .locator('[role="switch"], button[aria-checked], button[aria-pressed]')
    .first();
  if ((await ariaControl.count()) > 0) {
    const ariaChecked = await ariaControl.getAttribute("aria-checked");
    if (ariaChecked !== null) return ariaChecked === "true";

    const ariaPressed = await ariaControl.getAttribute("aria-pressed");
    if (ariaPressed !== null) return ariaPressed === "true";
  }

  const text = ((await exposureCell.textContent()) ?? "").trim();
  const normalized = text.toUpperCase();
  if (
    /미노출|비활성|숨김/.test(text) ||
    ["OFF", "N", "FALSE"].includes(normalized)
  ) {
    return false;
  }
  if (/노출|활성|공개/.test(text) || ["ON", "Y", "TRUE"].includes(normalized)) {
    return true;
  }
  return null;
}

test.describe("POCAAlbum Admin Shop 테스트", () => {
  // ========================================================================
  // Shop 상품 목록 + 검색 + 토글
  // ========================================================================
  test.describe("Shop 상품 CRUD @feature:admin_pocaalbum.shop.list", () => {
    let shopListPage: PocaShopListPage;

    test.beforeEach(async ({ page }) => {
      shopListPage = new PocaShopListPage(page);
      await shopListPage.navigate();
      await waitForPageStable(page);
    });

    test("PS-PAGE-01: Shop 상품 목록 페이지 로드", async () => {
      await expect(shopListPage.table).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });

      const rowCount = await shopListPage.getRowCount();
      expect(rowCount, "❌ Shop 상품 데이터가 없습니다").toBeGreaterThan(0);
      console.log(`  Shop 상품 목록: ${rowCount}행`);
    });

    test("PS-SEARCH-01: Shop 상품 키워드 검색", async () => {
      await expect(shopListPage.table).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });

      await expect(
        shopListPage.searchInput,
        "❌ Shop 검색 필드가 표시되어야 합니다",
      ).toBeVisible({ timeout: 5000 });

      await shopListPage.searchByKeyword("앨범");
      const hasData = await shopListPage.hasTableData();
      const hasNoResult = await shopListPage.noResultMessage.isVisible();

      expect(
        hasData || hasNoResult,
        "검색 후 결과나 안내 메시지가 없습니다",
      ).toBeTruthy();
      console.log(
        `  Shop 검색 결과: ${hasData ? "데이터 있음" : "검색결과 없음"}`,
      );
    });

    test("PS-DATA-01: Shop 상품 노출 상태 확인", async () => {
      await expect(shopListPage.table).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });

      const rowCount = await shopListPage.getRowCount();
      expect(rowCount, "❌ Shop 상품 데이터가 없습니다").toBeGreaterThan(0);

      const exposureCell = shopListPage.tableRows.first().locator("td").nth(7);
      await expect(
        exposureCell,
        "❌ 첫 번째 상품의 노출 컬럼이 표시되어야 합니다",
      ).toBeVisible({ timeout: 5000 });

      const visibility = await readExposureState(exposureCell);
      expect(
        visibility,
        "❌ 노출 컬럼에서 ON/OFF 상태를 읽지 못했습니다 (노출 토글 셀렉터 점검 필요)",
      ).not.toBeNull();
      console.log(`  첫 번째 상품 노출 상태: ${visibility ? "ON" : "OFF"}`);
    });
  });

  // ========================================================================
  // Shop 포인트상품 생성 폼 검증
  // ========================================================================
  test.describe("Shop 포인트상품 생성 폼 @feature:admin_pocaalbum.shop.create", () => {
    test("PS-CREATE-01: 포인트상품 생성 폼 입력 및 등록 버튼 활성화 검증", async ({
      page,
    }) => {
      const shopCreatePage = new PocaShopCreatePage(page);
      await shopCreatePage.navigate();
      await waitForPageStable(page);

      await assertNoServerError(page, "Shop 생성 페이지");

      // 폼 필드 탐색
      const fields = await shopCreatePage.discoverFormFields();
      console.log(`  발견된 필드 수: ${Object.keys(fields).length}`);

      const shopTitle = `[자동화테스트] 샘플 상품 ${Date.now()}`;

      await shopCreatePage.fillCreateForm({
        title: shopTitle,
        price: "100",
        imagePath: "fixtures/ta_sample.png",
      });

      const isCreateVisible = await shopCreatePage.createButton.isVisible({
        timeout: 5000,
      });

      expect(
        isCreateVisible,
        "❌ 등록 버튼을 찾을 수 없음 — Shop 생성 페이지 구조 확인 필요",
      ).toBe(true);

      await expect(
        shopCreatePage.createButton,
        "❌ 등록 버튼 비활성화 — 필수 필드 누락. discoverFormFields 로그를 확인하세요.",
      ).toBeEnabled({ timeout: 10000 });

      test.info().annotations.push({
        type: "manual cleanup",
        description:
          "Shop 포인트상품 목록/상세 UI에 삭제 액션이 없어 자동 생성 후 정리할 수 없습니다. 제출은 수동/전용 정리 경로가 생긴 뒤 별도 ops로 검증합니다.",
      });
    });
  });
});
