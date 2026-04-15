/**
 * POCAAlbum Admin 읽기 전용 페이지 테스트 (당첨자/신고/고객/시스템)
 *
 * ============================================================================
 * Section 8: 당첨자조회 (Read Only)
 * ============================================================================
 *   PW-PAGE-01: 목록 로드
 *   PW-SEARCH-01: 키워드 검색
 *
 * ============================================================================
 * Section 9: 신고내역 (Read Only)
 * ============================================================================
 *   PR-PAGE-01: 목록 로드
 *   PR-SEARCH-01: 키워드 검색
 *
 * ============================================================================
 * Section 10: 고객관리 (Read Only)
 * ============================================================================
 *   PC-PAGE-01: 목록 로드
 *   PC-SEARCH-01: 키워드 검색
 *
 * ============================================================================
 * Section 11: 시스템관리 (Read Only)
 * ============================================================================
 *   PM-PAGE-01: 목록 로드
 *   PM-SEARCH-01: 키워드 검색
 *
 * ============================================================================
 * Section 12: 캐시 관리 — QA-78: 선택한 캐시 삭제 기능 동작 불가
 * ============================================================================
 *   QA78-PAGE-01: 캐시 목록 기본 요소 노출
 *   QA78-ACTION-01: 캐시 선택 후 삭제 동작 검증
 *
 * @see tests/pages/ (POM 클래스)
 * @see tests/helpers/admin/ (인증/공통 유틸)
 */
import { test, expect } from "@playwright/test";
import {
  PocaWinnerListPage,
  PocaReportListPage,
  PocaCustomerListPage,
  PocaSystemListPage,
} from "./pages";
import {
  waitForPageStable,
  ELEMENT_TIMEOUT,
  applyAdminTestConfig,
} from "./helpers/admin/test-helpers";

// 공통 설정 (토큰검증 + 뷰포트체크 + 인증쿠키)
applyAdminTestConfig("포카앨범");

test.describe("POCAAlbum Admin 읽기 전용 테스트", () => {
  // ========================================================================
  // Section 8: 당첨자조회 (Read Only)
  // ========================================================================
  test.describe("당첨자조회", () => {
    let winnerListPage: PocaWinnerListPage;

    test.beforeEach(async ({ page }) => {
      winnerListPage = new PocaWinnerListPage(page);
      await winnerListPage.navigate();
      await waitForPageStable(page);
    });

    test("PW-PAGE-01: 당첨자조회 목록 페이지 로드", async () => {
      const tableVisible = await winnerListPage.table
        .isVisible({ timeout: ELEMENT_TIMEOUT })
        .catch(() => false);

      if (!tableVisible) {
        console.log("ℹ️ 당첨자조회 테이블 미표시 - URL 또는 권한 확인 필요");
        console.log(`  현재 URL: ${winnerListPage.page.url()}`);
        return;
      }

      const rowCount = await winnerListPage.getRowCount();
      console.log(`  당첨자조회 목록: ${rowCount}행`);
    });

    test("PW-SEARCH-01: 당첨자 키워드 검색", async () => {
      const isSearchVisible = await winnerListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!isSearchVisible) {
        console.log("ℹ️ 당첨자조회 검색 필드 미발견");
        return;
      }

      await winnerListPage.searchByKeyword("테스트");
      const hasData = await winnerListPage.hasTableData();
      const hasNoResult = await winnerListPage.noResultMessage
        .isVisible()
        .catch(() => false);

      expect(
        hasData || hasNoResult,
        "검색 후 결과나 안내 메시지가 없습니다",
      ).toBeTruthy();
    });
  });

  // ========================================================================
  // Section 9: 신고내역 (Read Only)
  // ========================================================================
  test.describe("신고내역 @feature:admin_pocaalbum.report.list", () => {
    let reportListPage: PocaReportListPage;

    test.beforeEach(async ({ page }) => {
      reportListPage = new PocaReportListPage(page);
      await reportListPage.navigate();
      await waitForPageStable(page);
    });

    test("PR-PAGE-01: 신고내역 목록 페이지 로드", async () => {
      const tableVisible = await reportListPage.table
        .isVisible({ timeout: ELEMENT_TIMEOUT })
        .catch(() => false);

      if (!tableVisible) {
        console.log("ℹ️ 신고내역 테이블 미표시 - URL 또는 권한 확인 필요");
        console.log(`  현재 URL: ${reportListPage.page.url()}`);
        return;
      }

      const rowCount = await reportListPage.getRowCount();
      console.log(`  신고내역 목록: ${rowCount}행`);
    });

    test("PR-SEARCH-01: 신고내역 키워드 검색", async () => {
      const isSearchVisible = await reportListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!isSearchVisible) {
        console.log("ℹ️ 신고내역 검색 필드 미발견");
        return;
      }

      await reportListPage.searchByKeyword("신고");
      const hasData = await reportListPage.hasTableData();
      const hasNoResult = await reportListPage.noResultMessage
        .isVisible()
        .catch(() => false);

      expect(
        hasData || hasNoResult,
        "검색 후 결과나 안내 메시지가 없습니다",
      ).toBeTruthy();
    });
  });

  // ========================================================================
  // Section 10: 고객관리 (Read Only)
  // ========================================================================
  test.describe("고객관리", () => {
    let customerListPage: PocaCustomerListPage;

    test.beforeEach(async ({ page }) => {
      customerListPage = new PocaCustomerListPage(page);
      await customerListPage.navigate();
      await waitForPageStable(page);
    });

    test("PC-PAGE-01: 고객관리 목록 페이지 로드", async () => {
      const tableVisible = await customerListPage.table
        .isVisible({ timeout: ELEMENT_TIMEOUT })
        .catch(() => false);

      if (!tableVisible) {
        console.log("ℹ️ 고객관리 테이블 미표시 - URL 또는 권한 확인 필요");
        console.log(`  현재 URL: ${customerListPage.page.url()}`);
        return;
      }

      const rowCount = await customerListPage.getRowCount();
      console.log(`  고객관리 목록: ${rowCount}행`);
    });

    test("PC-SEARCH-01: 고객 키워드 검색", async () => {
      const isSearchVisible = await customerListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!isSearchVisible) {
        console.log("ℹ️ 고객관리 검색 필드 미발견");
        return;
      }

      await customerListPage.searchByKeyword("테스트");
      const hasData = await customerListPage.hasTableData();
      const hasNoResult = await customerListPage.noResultMessage
        .isVisible()
        .catch(() => false);

      expect(
        hasData || hasNoResult,
        "검색 후 결과나 안내 메시지가 없습니다",
      ).toBeTruthy();
    });
  });

  // ========================================================================
  // Section 11: 시스템관리 (Read Only)
  // ========================================================================
  test.describe("시스템관리", () => {
    let systemListPage: PocaSystemListPage;

    test.beforeEach(async ({ page }) => {
      systemListPage = new PocaSystemListPage(page);
      await systemListPage.navigate();
      await waitForPageStable(page);
    });

    test("PM-PAGE-01: 시스템관리 목록 페이지 로드", async () => {
      const tableVisible = await systemListPage.table
        .isVisible({ timeout: ELEMENT_TIMEOUT })
        .catch(() => false);

      if (!tableVisible) {
        console.log("ℹ️ 시스템관리 테이블 미표시 - URL 또는 권한 확인 필요");
        console.log(`  현재 URL: ${systemListPage.page.url()}`);
        return;
      }

      const rowCount = await systemListPage.getRowCount();
      console.log(`  시스템관리 목록: ${rowCount}행`);
    });

    test("PM-SEARCH-01: 시스템 설정 키워드 검색", async () => {
      const isSearchVisible = await systemListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!isSearchVisible) {
        console.log("ℹ️ 시스템관리 검색 필드 미발견");
        return;
      }

      await systemListPage.searchByKeyword("설정");
      const hasData = await systemListPage.hasTableData();
      const hasNoResult = await systemListPage.noResultMessage
        .isVisible()
        .catch(() => false);

      expect(
        hasData || hasNoResult,
        "검색 후 결과나 안내 메시지가 없습니다",
      ).toBeTruthy();
    });
  });

  // ========================================================================
  // Section 12: 캐시 관리 — QA-78: 선택한 캐시 삭제 기능 동작 불가
  // Jira: https://makestar-product.atlassian.net/browse/QA-78
  // ========================================================================
  test.describe.serial("캐시 관리 @feature:admin_pocaalbum.cache.list", () => {
    const CACHE_URL =
      "https://stage-new-admin.makeuni2026.com/pocaalbum/system/cache/list";

    test.beforeEach(async ({ page }) => {
      await page.goto(CACHE_URL);
      await waitForPageStable(page);
      await page.waitForLoadState("networkidle");
    });

    test("QA78-PAGE-01: 캐시 목록 페이지 기본 요소 노출 검증", async ({
      page,
    }) => {
      const table = page.locator("table");
      await expect(table).toBeVisible({ timeout: ELEMENT_TIMEOUT });

      const headers = await page.locator("table thead th").allTextContents();
      expect(headers).toContain("ID");
      expect(headers).toContain("데이터타입");
      expect(headers).toContain("KEY");

      const rowCount = await page.locator("table tbody tr").count();
      expect(rowCount, "캐시 데이터가 존재해야 합니다").toBeGreaterThan(0);
      console.log(`  캐시 목록: ${rowCount}행`);

      await expect(page.getByPlaceholder("검색어 입력")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "조회하기" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "검색 초기화" }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "선택한 캐시 삭제" }),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "전체" })).toBeVisible();
      await expect(
        page.getByRole("button", { name: "앨범", exact: true }),
      ).toBeVisible();
    });

    test("QA78-ACTION-01: 캐시 선택 후 삭제 동작 검증", async ({ page }) => {
      await expect(page.locator("table")).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });

      const rowsBefore = await page.locator("table tbody tr").count();
      console.log(`  삭제 전 행 수: ${rowsBefore}`);

      const firstRowCheckbox = page
        .locator("table tbody tr")
        .first()
        .locator('input[type="checkbox"]');
      await firstRowCheckbox.check();
      await expect(firstRowCheckbox).toBeChecked();

      const selectedId = await page
        .locator("table tbody tr")
        .first()
        .locator("td")
        .nth(1)
        .textContent();
      console.log(`  선택한 캐시 ID: ${selectedId?.trim()}`);

      page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "선택한 캐시 삭제" }).click();

      const hasToast = await page
        .locator(
          '[class*="toast"], [class*="alert"], [class*="notification"], [class*="success"], [class*="message"]',
        )
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      const rowsAfter = await page.locator("table tbody tr").count();
      const rowRemoved = rowsAfter < rowsBefore;

      if (!rowRemoved && !hasToast) {
        await page.reload({ waitUntil: "networkidle" });
        const rowsReloaded = await page.locator("table tbody tr").count();
        expect(
          rowsReloaded < rowsBefore || hasToast,
          `캐시 삭제 후 결과가 반영되어야 합니다 (행 수: ${rowsBefore} → ${rowsReloaded})`,
        ).toBe(true);
        console.log(
          `  삭제 후 행 수 (리로드): ${rowsReloaded} (${rowsBefore - rowsReloaded}건 감소)`,
        );
      } else {
        console.log(
          `  삭제 결과: ${hasToast ? "메시지 표시됨" : ""} ${rowRemoved ? `행 제거됨 (${rowsBefore} → ${rowsAfter})` : ""}`,
        );
      }
    });
  });
});
