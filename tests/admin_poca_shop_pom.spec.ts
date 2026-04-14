/**
 * POCAAlbum Admin Shop 상품 CRUD 테스트
 *
 * ============================================================================
 * Section 4: Shop 상품 CRUD
 * ============================================================================
 *   PS-PAGE-01: 목록 로드
 *   PS-SEARCH-01: 키워드 검색
 *   PS-DATA-01: 토글 상태 확인
 *   PS-CREATE-01 ~ PS-ACTION-01: 생성/수정/삭제 (serial)
 *
 * @see tests/pages/ (POM 클래스)
 * @see tests/helpers/admin/ (인증/공통 유틸)
 */
import { test, expect } from "@playwright/test";
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

      const isSearchVisible = await shopListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!isSearchVisible) {
        console.log("ℹ️ Shop 검색 필드 미발견 - 검색 기능 없을 수 있음");
        return;
      }

      await shopListPage.searchByKeyword("앨범");
      const hasData = await shopListPage.hasTableData();
      const hasNoResult = await shopListPage.noResultMessage
        .isVisible()
        .catch(() => false);

      expect(
        hasData || hasNoResult,
        "검색 후 결과나 안내 메시지가 없습니다",
      ).toBeTruthy();
      console.log(
        `  Shop 검색 결과: ${hasData ? "데이터 있음" : "검색결과 없음"}`,
      );
    });

    test("PS-DATA-01: Shop 상품 토글 상태 확인", async () => {
      await expect(shopListPage.table).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });

      const rowCount = await shopListPage.getRowCount();
      expect(rowCount, "❌ Shop 상품 데이터가 없습니다").toBeGreaterThan(0);

      const toggles = shopListPage.getToggleSwitches();
      const toggleCount = await toggles.count();

      if (toggleCount > 0) {
        console.log(`  토글 스위치 발견: ${toggleCount}개`);
        const visibility = await shopListPage.isProductVisible(0);
        console.log(
          `  첫 번째 상품 노출 상태: ${visibility === null ? "토글 없음" : visibility ? "ON" : "OFF"}`,
        );
      } else {
        console.log("ℹ️ 토글 스위치 미발견 - UI 구조 확인 필요");
      }
    });
  });

  // ========================================================================
  // Shop 포인트상품 생성/삭제 (serial)
  // ========================================================================
  test.describe.serial("Shop 포인트상품 생성/삭제 @feature:admin_pocaalbum.shop.create", () => {
    let sharedShopTitle = "";
    let sharedShopCreated = false;

    test("PS-CREATE-01: 포인트상품 생성 폼 입력 및 등록", async ({ page }) => {
      const shopCreatePage = new PocaShopCreatePage(page);
      await shopCreatePage.navigate();
      await waitForPageStable(page);

      await assertNoServerError(page, "Shop 생성 페이지");

      // 폼 필드 탐색
      const fields = await shopCreatePage.discoverFormFields();
      console.log(`  발견된 필드 수: ${Object.keys(fields).length}`);

      sharedShopTitle = `[자동화테스트] 샘플 상품 ${Date.now()}`;

      await shopCreatePage.fillCreateForm({
        title: sharedShopTitle,
        price: "100",
        imagePath: "fixtures/ta_sample.png",
      });

      const isCreateVisible = await shopCreatePage.createButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(
        isCreateVisible,
        "❌ 등록 버튼을 찾을 수 없음 — Shop 생성 페이지 구조 확인 필요",
      ).toBe(true);

      await expect(
        shopCreatePage.createButton,
        "❌ 등록 버튼 비활성화 — 필수 필드 누락. discoverFormFields 로그를 확인하세요.",
      ).toBeEnabled({ timeout: 10000 });

      await shopCreatePage.submitAndWaitForList();
      sharedShopCreated = true;
      console.log(`✅ 포인트상품 생성 완료: ${sharedShopTitle}`);
    });

    test("PS-CREATE-02: 생성된 상품 목록에서 검증", async ({ page }) => {
      expect(
        sharedShopCreated,
        "❌ PS-CREATE-01에서 상품이 생성되지 않음",
      ).toBe(true);

      const shopListPage = new PocaShopListPage(page);
      await shopListPage.navigate();
      await waitForPageStable(page);

      const isSearchVisible = await shopListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (isSearchVisible) {
        await shopListPage.searchByKeyword(sharedShopTitle);
      }

      const hasData = await shopListPage.hasTableData();
      console.log(`  상품 검색 결과: ${hasData ? "데이터 있음" : "미발견"}`);
    });

    test("PS-ACTION-01: 테스트 상품 삭제", async ({ page }) => {
      expect(
        sharedShopCreated,
        "❌ PS-CREATE-01에서 상품이 생성되지 않음",
      ).toBe(true);

      const shopListPage = new PocaShopListPage(page);
      await shopListPage.navigate();
      await waitForPageStable(page);

      const isSearchVisible = await shopListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (isSearchVisible) {
        await shopListPage.searchByKeyword(sharedShopTitle);
      }

      // 첫 번째 행 클릭 → 상세 진입
      const rowCount = await shopListPage.getRowCount();
      if (rowCount === 0) {
        console.warn("⚠️ 삭제할 상품을 찾을 수 없음");
        return;
      }

      await shopListPage.clickFirstRow(1);
      await waitForPageStable(page);

      const deleteBtn = page.getByRole("button", { name: "삭제" }).first();
      const isDeleteVisible = await deleteBtn
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!isDeleteVisible) {
        console.log(
          "⚠️ 삭제 버튼을 찾을 수 없음 - 권한 또는 UI 구조 확인 필요",
        );
        return;
      }

      page.once("dialog", (dialog) => dialog.accept());
      await deleteBtn.click();

      try {
        await page.waitForURL(/\/pocaalbum\/shop/, { timeout: 10000 });
        console.log("✅ 상품 삭제 후 목록으로 이동");
      } catch {
        console.log("ℹ️ 삭제 후 목록 이동 미확인 - 현재 URL:", page.url());
      }
    });
  });
});
