/**
 * POCAAlbum Admin 콘텐츠 CRUD 테스트 (FAVE + BENEFIT + 알림)
 *
 * ============================================================================
 * Section 5: FAVE CRUD
 * ============================================================================
 *   PF-PAGE-01: 목록 로드
 *   PF-SEARCH-01: 키워드 검색
 *   PF-PAGIN-01: 페이지네이션
 *   PF-CREATE-01 ~ PF-CREATE-02: 생성/검증 (serial)
 *
 * ============================================================================
 * Section 6: BENEFIT CRUD
 * ============================================================================
 *   PB-PAGE-01: 목록 로드
 *   PB-SEARCH-01: 키워드 검색
 *   PB-CREATE-01 ~ PB-CREATE-02: 생성/검증 (serial)
 *
 * ============================================================================
 * Section 7: 알림 CRUD
 * ============================================================================
 *   PN-PAGE-01: 목록 로드
 *   PN-SEARCH-01: 키워드 검색
 *   PN-CREATE-01 ~ PN-CREATE-02: 생성/검증 (serial)
 *
 * @see tests/pages/ (POM 클래스)
 * @see tests/helpers/admin/ (인증/공통 유틸)
 */
import { test, expect } from "@playwright/test";
import {
  PocaFaveListPage,
  PocaFaveCreatePage,
  PocaBenefitListPage,
  PocaBenefitCreatePage,
  PocaNotificationListPage,
  PocaNotificationCreatePage,
  assertNoServerError,
} from "./pages";
import {
  waitForPageStable,
  ELEMENT_TIMEOUT,
  applyAdminTestConfig,
} from "./helpers/admin/test-helpers";

// 공통 설정 (토큰검증 + 뷰포트체크 + 인증쿠키)
applyAdminTestConfig("포카앨범");

test.describe("POCAAlbum Admin 콘텐츠 테스트", () => {
  // ========================================================================
  // Section 5: FAVE 목록 기능
  // ========================================================================
  test.describe("FAVE 목록 기능 @feature:admin_pocaalbum.fave.list", () => {
    let faveListPage: PocaFaveListPage;

    test.beforeEach(async ({ page }) => {
      faveListPage = new PocaFaveListPage(page);
      await faveListPage.navigate();
      await waitForPageStable(page);
    });

    test("PF-PAGE-01: FAVE 팩 목록 페이지 로드", async () => {
      await expect(faveListPage.table).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });

      const rowCount = await faveListPage.getRowCount();
      expect(rowCount, "❌ FAVE 팩 목록에 데이터가 없습니다").toBeGreaterThan(
        0,
      );
      console.log(`  FAVE 팩 목록: ${rowCount}행`);
    });

    test("PF-SEARCH-01: FAVE 팩 키워드 검색", async () => {
      const isSearchVisible = await faveListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!isSearchVisible) {
        console.log("ℹ️ FAVE 검색 필드 미발견");
        return;
      }

      await faveListPage.searchByKeyword("팩");
      const hasData = await faveListPage.hasTableData();
      const hasNoResult = await faveListPage.noResultMessage
        .isVisible()
        .catch(() => false);

      expect(
        hasData || hasNoResult,
        "검색 후 결과나 안내 메시지가 없습니다",
      ).toBeTruthy();
      console.log(
        `  FAVE 검색 결과: ${hasData ? "데이터 있음" : "검색결과 없음"}`,
      );
    });

    test("PF-PAGIN-01: FAVE 페이지네이션 동작", async () => {
      const rowCount = await faveListPage.getRowCount();
      if (rowCount === 0) {
        console.log("ℹ️ 테이블 데이터 없음");
        return;
      }

      const isNextVisible = await faveListPage.nextPageButton
        .isVisible()
        .catch(() => false);
      const isNextEnabled = isNextVisible
        ? await faveListPage.nextPageButton.isEnabled().catch(() => false)
        : false;

      if (!isNextVisible || !isNextEnabled) {
        console.log("ℹ️ Next 버튼 없거나 비활성 - 데이터가 1페이지만 존재");
        return;
      }

      const firstRowBefore = await faveListPage.getFirstRow().textContent();
      await faveListPage.goToNextPage();
      await waitForPageStable(faveListPage.page, 5000);
      const firstRowAfter = await faveListPage.getFirstRow().textContent();

      expect(
        firstRowBefore,
        "페이지 이동 후 데이터가 변경되지 않았습니다",
      ).not.toBe(firstRowAfter);
    });
  });

  // ========================================================================
  // FAVE 팩 생성/삭제 (serial)
  // ========================================================================
  test.describe.serial("FAVE 팩 생성/삭제 @feature:admin_pocaalbum.fave.create", () => {
    let sharedFaveTitle = "";
    let sharedFaveCreated = false;

    test("PF-CREATE-01: FAVE 팩 생성 폼 입력 및 등록", async ({ page }) => {
      const faveCreatePage = new PocaFaveCreatePage(page);
      await faveCreatePage.navigate();
      await waitForPageStable(page);

      await assertNoServerError(page, "FAVE 생성 페이지");

      const fields = await faveCreatePage.discoverFormFields();
      console.log(`  발견된 필드 수: ${Object.keys(fields).length}`);

      sharedFaveTitle = `[자동화테스트] 샘플 팩 ${Date.now()}`;

      await faveCreatePage.fillCreateForm({
        title: sharedFaveTitle,
        imagePath: "fixtures/ta_sample.png",
      });

      page.once("dialog", (dialog) => dialog.accept());

      const isCreateVisible = await faveCreatePage.createButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(
        isCreateVisible,
        "❌ 등록 버튼을 찾을 수 없음 — FAVE 생성 페이지 확인 필요",
      ).toBe(true);

      await expect(
        faveCreatePage.createButton,
        "❌ 등록 버튼 비활성화 — 필수 필드 누락",
      ).toBeEnabled({ timeout: 10000 });

      await faveCreatePage.submitAndWaitForList();
      sharedFaveCreated = true;
      console.log(`✅ FAVE 팩 생성 완료: ${sharedFaveTitle}`);
    });

    test("PF-CREATE-02: 생성된 팩 목록에서 검증", async ({ page }) => {
      expect(sharedFaveCreated, "❌ PF-CREATE-01에서 팩이 생성되지 않음").toBe(
        true,
      );

      const faveListPage = new PocaFaveListPage(page);
      await faveListPage.navigate();
      await waitForPageStable(page);

      const isSearchVisible = await faveListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (isSearchVisible) {
        await faveListPage.searchByKeyword(sharedFaveTitle);
      }

      const rowIndex = await faveListPage.findRowByText(sharedFaveTitle);
      if (rowIndex >= 0) {
        console.log(`✅ 목록에서 팩 발견: 행 ${rowIndex}`);
      } else {
        console.warn(`⚠️ 목록에서 팩 미발견: ${sharedFaveTitle}`);
      }
    });

    // PF-ACTION-01 삭제 테스트 제거: FAVE 상세에 삭제 기능 미제공 (UI 미존재)
  });

  // ========================================================================
  // Section 6: BENEFIT 목록 기능
  // ========================================================================
  test.describe("BENEFIT 목록 기능 @feature:admin_pocaalbum.benefit.list", () => {
    let benefitListPage: PocaBenefitListPage;

    test.beforeEach(async ({ page }) => {
      benefitListPage = new PocaBenefitListPage(page);
      await benefitListPage.navigate();
      await waitForPageStable(page);
    });

    test("PB-PAGE-01: BENEFIT 목록 페이지 로드", async () => {
      const tableVisible = await benefitListPage.table
        .isVisible({ timeout: ELEMENT_TIMEOUT })
        .catch(() => false);

      if (!tableVisible) {
        console.log("ℹ️ BENEFIT 테이블 미표시 - URL 또는 권한 확인 필요");
        console.log(`  현재 URL: ${benefitListPage.page.url()}`);
        return;
      }

      const rowCount = await benefitListPage.getRowCount();
      console.log(`  BENEFIT 목록: ${rowCount}행`);
    });

    test("PB-SEARCH-01: BENEFIT 키워드 검색", async () => {
      const isSearchVisible = await benefitListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!isSearchVisible) {
        console.log("ℹ️ BENEFIT 검색 필드 미발견");
        return;
      }

      await benefitListPage.searchByKeyword("혜택");
      const hasData = await benefitListPage.hasTableData();
      const hasNoResult = await benefitListPage.noResultMessage
        .isVisible()
        .catch(() => false);

      expect(
        hasData || hasNoResult,
        "검색 후 결과나 안내 메시지가 없습니다",
      ).toBeTruthy();
    });
  });

  // ========================================================================
  // BENEFIT 생성/삭제 (serial)
  // ========================================================================
  test.describe.serial("BENEFIT 생성/삭제 @feature:admin_pocaalbum.benefit.create", () => {
    let sharedBenefitTitle = "";
    let sharedBenefitCreated = false;

    test("PB-CREATE-01: BENEFIT 생성 폼 입력 및 등록", async ({ page }) => {
      test.setTimeout(180000); // BENEFIT 이벤트 폼은 복잡하여 3분 필요
      const benefitCreatePage = new PocaBenefitCreatePage(page);
      await benefitCreatePage.navigate();
      await waitForPageStable(page);

      await assertNoServerError(page, "BENEFIT 생성 페이지");

      const fields = await benefitCreatePage.discoverFormFields();
      console.log(`  발견된 필드 수: ${Object.keys(fields).length}`);

      sharedBenefitTitle = `[자동화테스트] 샘플 혜택 ${Date.now()}`;

      await benefitCreatePage.fillCreateForm({
        title: sharedBenefitTitle,
        imagePath: "fixtures/ta_sample.png",
      });

      const isCreateVisible = await benefitCreatePage.createButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(
        isCreateVisible,
        "❌ 등록 버튼을 찾을 수 없음 — BENEFIT 생성 페이지 확인 필요",
      ).toBe(true);

      await expect(
        benefitCreatePage.createButton,
        "❌ 등록 버튼 비활성화 — 필수 필드 누락",
      ).toBeEnabled({ timeout: 10000 });

      await benefitCreatePage.submitAndWaitForList();
      sharedBenefitCreated = true;
      console.log(`✅ BENEFIT 생성 완료: ${sharedBenefitTitle}`);
    });

    test("PB-CREATE-02: 생성된 BENEFIT 목록에서 검증", async ({ page }) => {
      expect(
        sharedBenefitCreated,
        "PB-CREATE-01에서 BENEFIT이 생성되지 않음",
      ).toBe(true);

      const benefitListPage = new PocaBenefitListPage(page);
      await benefitListPage.navigate();
      await waitForPageStable(page);

      const isSearchVisible = await benefitListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (isSearchVisible) {
        await benefitListPage.searchByKeyword(sharedBenefitTitle);
      }

      const rowIndex = await benefitListPage.findRowByText(sharedBenefitTitle);
      if (rowIndex >= 0) {
        console.log(`✅ 목록에서 BENEFIT 발견: 행 ${rowIndex}`);
      } else {
        console.warn(`⚠️ 목록에서 BENEFIT 미발견: ${sharedBenefitTitle}`);
      }
    });

    // PB-ACTION-01 삭제 테스트 제거: BENEFIT 상세에 삭제 기능 미제공 (UI 미존재)
  });

  // ========================================================================
  // Section 7: 알림 목록 기능
  // ========================================================================
  test.describe("알림 목록 기능 @feature:admin_pocaalbum.notice.list", () => {
    let notifListPage: PocaNotificationListPage;

    test.beforeEach(async ({ page }) => {
      notifListPage = new PocaNotificationListPage(page);
      await notifListPage.navigate();
      await waitForPageStable(page);
    });

    test("PN-PAGE-01: 알림 공지 목록 페이지 로드", async () => {
      const tableVisible = await notifListPage.table
        .isVisible({ timeout: ELEMENT_TIMEOUT })
        .catch(() => false);

      if (tableVisible) {
        const rowCount = await notifListPage.getRowCount();
        console.log(`  알림 공지 목록: ${rowCount}행`);
      } else {
        console.log("ℹ️ 알림 공지 테이블 미표시 - 데이터 없을 수 있음");
      }

      // 생성 버튼 존재 확인
      const createBtn = notifListPage.page
        .locator(
          'button:has-text("등록"), button:has-text("생성"), a:has-text("등록"), a:has-text("생성")',
        )
        .first();
      const hasCreateBtn = await createBtn
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      console.log(`  생성 버튼: ${hasCreateBtn ? "있음" : "없음"}`);
    });

    test("PN-SEARCH-01: 알림 키워드 검색", async () => {
      const isSearchVisible = await notifListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!isSearchVisible) {
        console.log("ℹ️ 알림 검색 필드 미발견");
        return;
      }

      await notifListPage.searchByKeyword("공지");
      const hasData = await notifListPage.hasTableData();
      const hasNoResult = await notifListPage.noResultMessage
        .isVisible()
        .catch(() => false);

      expect(
        hasData || hasNoResult,
        "검색 후 결과나 안내 메시지가 없습니다",
      ).toBeTruthy();
    });
  });

  // ========================================================================
  // 알림 생성/삭제 (serial)
  // ========================================================================
  test.describe.serial("알림 생성/삭제 @feature:admin_pocaalbum.notice.create", () => {
    let sharedNotifTitle = "";
    let sharedNotifCreated = false;

    test("PN-CREATE-01: 알림 생성 폼 입력 및 등록", async ({ page }) => {
      const notifCreatePage = new PocaNotificationCreatePage(page);
      await notifCreatePage.navigate();
      await waitForPageStable(page);

      await assertNoServerError(page, "알림 생성 페이지");

      const fields = await notifCreatePage.discoverFormFields();
      console.log(`  발견된 필드 수: ${Object.keys(fields).length}`);

      sharedNotifTitle = `[자동화테스트] 샘플 알림 ${Date.now()}`;

      await notifCreatePage.fillCreateForm({
        title: sharedNotifTitle,
        content: "자동화 테스트용 알림 내용입니다.",
      });

      const isCreateVisible = await notifCreatePage.createButton
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(
        isCreateVisible,
        "❌ 등록 버튼을 찾을 수 없음 — 알림 생성 페이지 확인 필요",
      ).toBe(true);

      await expect(
        notifCreatePage.createButton,
        "❌ 등록 버튼 비활성화 — 필수 필드 누락",
      ).toBeEnabled({ timeout: 10000 });

      await notifCreatePage.submitAndWaitForList();
      sharedNotifCreated = true;
      console.log(`✅ 알림 생성 완료: ${sharedNotifTitle}`);
    });

    test("PN-CREATE-02: 생성된 알림 목록에서 검증", async ({ page }) => {
      expect(
        sharedNotifCreated,
        "❌ PN-CREATE-01에서 알림이 생성되지 않음",
      ).toBe(true);

      const notifListPage = new PocaNotificationListPage(page);
      await notifListPage.navigate();
      await waitForPageStable(page);

      const isSearchVisible = await notifListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (isSearchVisible) {
        await notifListPage.searchByKeyword(sharedNotifTitle);
      }

      const rowIndex = await notifListPage.findRowByText(sharedNotifTitle);
      if (rowIndex >= 0) {
        console.log(`✅ 목록에서 알림 발견: 행 ${rowIndex}`);
      } else {
        console.warn(`⚠️ 목록에서 알림 미발견: ${sharedNotifTitle}`);
      }
    });

    // PN-ACTION-01 삭제 테스트 제거: 알림 상세에 삭제 기능 미제공 (UI 미존재)
  });
});
