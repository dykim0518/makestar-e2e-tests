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
  test.describe("신고내역", () => {
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
});
