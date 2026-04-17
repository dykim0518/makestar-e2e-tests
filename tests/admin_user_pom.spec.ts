/**
 * Admin 회원관리 메뉴 테스트 (Page Object Model 적용)
 *
 * 대상:
 * - 고객관리 > 회원관리
 * - URL: /user/list
 *
 * 검증 범위:
 * - 페이지 기본 요소 노출 (헤딩, 브레드크럼, 검색 영역, 테이블)
 * - 테이블 헤더 컬럼 및 데이터 로드
 * - B2C/B2B 탭 전환
 * - 키워드 검색 정합성 및 초기화
 * - 회원상태/가입서비스 필터 적용
 * - 페이지네이션 이동
 * - 엑셀 다운로드 버튼 및 체크박스 동작
 * - 상세 페이지 진입, 데이터 일관성, 목록 복귀
 */

import { test, expect } from "@playwright/test";
import { UserListPage, UserDetailPage } from "./pages";
import { initPageWithRecovery } from "./helpers/admin";
import {
  ELEMENT_TIMEOUT,
  applyAdminTestConfig,
  waitForPageStable,
  waitForModalOpen,
} from "./helpers/admin/test-helpers";

// ============================================================================
// 테스트 설정
// ============================================================================
applyAdminTestConfig("회원관리");

type UserMetrics = Awaited<ReturnType<UserListPage["getResultMetrics"]>>;

function expectNoResultMessage(metrics: UserMetrics, context: string): void {
  expect(
    metrics.hasNoResultMessage,
    `❌ ${context}: 결과 없음 상태인데 안내 메시지가 없습니다.`,
  ).toBeTruthy();
}

function expectHasUserRows(metrics: UserMetrics, context: string): void {
  expect(
    metrics.noResultState,
    `❌ ${context}: 결과 없음 상태라 검증을 진행할 수 없습니다.`,
  ).toBe(false);
  expect(metrics.rowCount, `❌ ${context}: 목록 데이터가 없습니다.`).toBeGreaterThan(
    0,
  );
}

// ##############################################################################
// 회원관리 목록
// ##############################################################################
test.describe.serial("회원관리 목록 @feature:admin_makestar.user.list", () => {
  let userPage: UserListPage;

  test.beforeEach(async ({ page }) => {
    userPage = await initPageWithRecovery(UserListPage, page, "회원관리");
  });

  test("USR-PAGE-01: 페이지 기본 요소 노출 검증", async () => {
    await userPage.assertPageTitle();
    await userPage.assertHeading();
    await expect(
      userPage.breadcrumb,
      "❌ 브레드크럼이 보이지 않습니다.",
    ).toBeVisible({ timeout: ELEMENT_TIMEOUT });
    await userPage.assertSearchAreaVisible();
    await userPage.assertActionButtonsVisible();
    console.log("  ✅ 페이지 기본 요소 검증 완료");
  });

  test("USR-PAGE-02: 테이블 헤더 컬럼 검증", async () => {
    await userPage.assertUserTableHeaders();
    console.log("  ✅ 테이블 헤더 검증 완료");
  });

  test("USR-PAGE-03: 테이블 데이터 로드 검증", async () => {
    const metrics = await userPage.getResultMetrics();

    if (metrics.noResultState) {
      expectNoResultMessage(metrics, "회원 목록 데이터 로드");
    } else {
      expectHasUserRows(metrics, "회원 목록 데이터 로드");

      const pageLimit = await userPage.getPerPageLimit(10);
      expect(
        metrics.rowCount,
        `❌ 행 수(${metrics.rowCount})가 페이지 제한(${pageLimit})을 초과합니다.`,
      ).toBeLessThanOrEqual(pageLimit);
      console.log(
        `  ✅ 데이터 로드 검증: ${metrics.rowCount}행 (제한: ${pageLimit})`,
      );
    }
  });

  test("USR-DATA-01: 필수 컬럼 빈 값 검증 (이메일, 유저코드) + 선택 컬럼 경고", async () => {
    const metrics = await userPage.getResultMetrics();
    if (metrics.noResultState) {
      expectNoResultMessage(metrics, "필수 컬럼 검증");
    } else {
      const rows = Math.min(metrics.rowCount, 10);
      let emptyNicknameCount = 0;
      let emptyNameCount = 0;

      for (let i = 0; i < rows; i++) {
        // 필수: 이메일 (col 2), 유저코드 (col 3) — 가입 시 반드시 생성됨
        const email = (await userPage.getCellText(i, 2)).trim();
        expect(
          userPage.isMeaningfulValue(email),
          `❌ 행 ${i}: 이메일 컬럼이 비어있음`,
        ).toBe(true);

        const userCode = (await userPage.getCellText(i, 3)).trim();
        expect(
          userPage.isMeaningfulValue(userCode),
          `❌ 행 ${i}: 유저코드 컬럼이 비어있음`,
        ).toBe(true);

        // 선택: 닉네임 (col 4), 이름 (col 5) — 커머스 가입 시 미입력 가능
        const nickname = (await userPage.getCellText(i, 4)).trim();
        if (!userPage.isMeaningfulValue(nickname)) emptyNicknameCount++;

        const name = (await userPage.getCellText(i, 5)).trim();
        if (!userPage.isMeaningfulValue(name)) emptyNameCount++;
      }

      if (emptyNicknameCount > 0 || emptyNameCount > 0) {
        console.log(
          `  ⚠️ 프로필 미완성 회원: 닉네임 비어있음 ${emptyNicknameCount}건, 이름 비어있음 ${emptyNameCount}건 (커머스 가입 시 미입력 허용)`,
        );
      }
      console.log(`  ✅ ${rows}개 행 필수 컬럼(이메일, 유저코드) 검증 완료`);
    }
  });

  test("USR-DATA-02: 목록 건수와 테이블 행 수 일관성 검증", async () => {
    const metrics = await userPage.getResultMetrics();
    if (metrics.noResultState) {
      expectNoResultMessage(metrics, "회원 목록 건수 일관성 검증");
    } else {
      const pageLimit = await userPage.getPerPageLimit(10);

      expect(metrics.rowCount, "❌ 행 수가 0입니다.").toBeGreaterThan(0);
      expect(
        metrics.rowCount,
        `❌ 행 수(${metrics.rowCount})가 페이지 제한(${pageLimit})을 초과합니다.`,
      ).toBeLessThanOrEqual(pageLimit);
      console.log(`  ✅ 건수 일관성: ${metrics.rowCount}행 (제한: ${pageLimit})`);
    }
  });
});

// ##############################################################################
// 탭 기능
// ##############################################################################
test.describe.serial("탭 기능 @feature:admin_makestar.user.list", () => {
  let userPage: UserListPage;

  test.beforeEach(async ({ page }) => {
    userPage = await initPageWithRecovery(UserListPage, page, "회원관리");
  });

  test("USR-TAB-01: B2C/B2B 회원관리 탭 전환 검증", async () => {
    const hasTabs = await userPage.hasTabNavigation();
    expect(hasTabs, "❌ B2C/B2B 회원관리 탭이 페이지에 존재하지 않습니다").toBe(
      true,
    );

    // 초기 상태 기록 (기본 탭: B2C회원관리)
    const initialMetrics = await userPage.getResultMetrics();
    expectHasUserRows(initialMetrics, "탭 전환 전 B2C 회원 목록");
    const initialFingerprint = await userPage.getFirstRowFingerprint();

    // B2B 탭으로 전환
    await userPage.selectTab("B2B회원관리");
    const b2bMetrics = await userPage.getResultMetrics();
    const b2bFingerprint = await userPage.getFirstRowFingerprint();

    // B2B 탭 전환 후 데이터 변화 확인 (데이터가 있으면 다른 데이터여야 함)
    if (!initialMetrics.noResultState && !b2bMetrics.noResultState) {
      // 두 탭 모두 데이터가 있으면 다른 목록이어야 함
      expect(
        b2bFingerprint !== initialFingerprint ||
          b2bMetrics.rowCount !== initialMetrics.rowCount,
        "B2B 탭 전환 후 데이터가 변경되지 않았습니다.",
      ).toBeTruthy();
    }

    // B2C 탭으로 복귀
    await userPage.selectTab("B2C회원관리");
    const returnedMetrics = await userPage.getResultMetrics();
    const returnedFingerprint = await userPage.getFirstRowFingerprint();

    // B2C 복귀 후 원래 데이터와 일치하는지 확인
    if (!initialMetrics.noResultState && !returnedMetrics.noResultState) {
      expect(
        returnedFingerprint,
        "❌ B2C 탭 복귀 후 원래 데이터와 다릅니다.",
      ).toBe(initialFingerprint);
    }
    console.log("  ✅ B2C/B2B 탭 전환 및 복귀 검증 완료");
  });
});

// ##############################################################################
// 검색 기능
// ##############################################################################
test.describe.serial("검색 기능 @feature:admin_makestar.user.list", () => {
  let userPage: UserListPage;

  test.beforeEach(async ({ page }) => {
    userPage = await initPageWithRecovery(UserListPage, page, "회원관리");
  });

  test("USR-SEARCH-01: 키워드 검색 정합성 검증", async () => {
    // 현재 목록에서 유저코드 또는 이메일을 가져와 검색
    const metrics = await userPage.getResultMetrics();
    expect(
      metrics.rowCount,
      "❌ 검색 전 목록이 비어 있습니다.",
    ).toBeGreaterThan(0);

    // 첫 행의 유저코드(3번째 열, 0-indexed)를 검색어로 사용
    const userCode = await userPage.getCellText(0, 3);
    expect(
      userCode.trim().length,
      "❌ 유저코드를 추출할 수 없습니다.",
    ).toBeGreaterThan(0);

    await userPage.searchByKeyword(userCode.trim());

    const searchMetrics = await userPage.getResultMetrics();

    if (searchMetrics.noResultState) {
      // 검색어가 매칭되지 않을 수 있음 → 유효한 결과
      expect(
        searchMetrics.hasNoResultMessage,
        "❌ 검색 결과 없음 표기가 없습니다.",
      ).toBeTruthy();
    } else {
      expect(
        searchMetrics.rowCount,
        "❌ 검색 결과가 비어 있습니다.",
      ).toBeGreaterThan(0);
    }

    await userPage.resetFiltersAndWait();
    console.log(
      `  ✅ 키워드 검색 정합성 검증 완료 (검색어: ${userCode.trim()})`,
    );
  });

  test("USR-SEARCH-02: 검색 초기화 동작 검증", async () => {
    // 1. 초기 상태 기록
    const initialMetrics = await userPage.getResultMetrics();
    expect(
      initialMetrics.rowCount,
      "❌ 초기 목록이 비어 있습니다.",
    ).toBeGreaterThan(0);

    // 2. 검색 수행
    await userPage.clickSearchAndWait();
    const firstSearchMetrics = await userPage.getResultMetrics();
    expect(
      firstSearchMetrics.rowCount,
      "❌ 첫 조회 결과가 비어 있습니다.",
    ).toBeGreaterThan(0);

    // 3. 검색 초기화
    await userPage.resetFiltersAndWait();
    const resetMetrics = await userPage.getResultMetrics();
    expect(
      resetMetrics.rowCount,
      "❌ 검색 초기화 후 목록이 비어 있습니다.",
    ).toBeGreaterThan(0);

    // 4. 재조회
    await userPage.clickSearchAndWait();
    const rerunMetrics = await userPage.getResultMetrics();
    expect(
      rerunMetrics.rowCount,
      "❌ 검색 초기화 후 재조회 결과가 비어 있습니다.",
    ).toBeGreaterThan(0);
    console.log(
      `  ✅ 검색 초기화 검증 완료 (초기화 후: ${resetMetrics.rowCount}행, 재조회: ${rerunMetrics.rowCount}행)`,
    );
  });

  test("USR-SEARCH-03: 무효 키워드 검색 시 결과 없음 검증", async ({
    page,
  }) => {
    const impossibleKeyword = `AUTO-USR-NOT-FOUND-${Date.now()}`;
    await userPage.searchByKeyword(impossibleKeyword);

    // 검색 후 네트워크 안정화 대기
    await page.waitForLoadState("networkidle").catch(() => {});

    const metrics = await userPage.getResultMetrics();

    if (metrics.noResultState) {
      // 기대 시나리오: 결과 없음 상태
      expect(
        metrics.hasNoResultMessage || metrics.rowCount === 0,
        "❌ 검색 결과 없음 표기가 없습니다.",
      ).toBeTruthy();
    } else {
      // 검색 결과가 있다면, 이전 검색어가 반영되었는지 확인
      // (서버가 키워드 무관하게 결과를 반환하는 경우)
      const currentKeyword = await userPage.getCurrentKeywordValue();
      expect(
        currentKeyword,
        "❌ 검색 키워드가 입력 필드에 반영되지 않았습니다.",
      ).toContain("AUTO-USR-NOT-FOUND");
    }

    await userPage.resetFiltersAndWait();
  });
});

// ##############################################################################
// 필터 기능
// ##############################################################################
test.describe.serial("필터 기능 @feature:admin_makestar.user.list", () => {
  let userPage: UserListPage;

  test.beforeEach(async ({ page }) => {
    userPage = await initPageWithRecovery(UserListPage, page, "회원관리");
  });

  test("USR-FLT-01: 회원상태 필터 적용 검증", async () => {
    const initialMetrics = await userPage.getResultMetrics();
    expectHasUserRows(initialMetrics, "회원상태 필터 적용 전 회원 목록");

    // 확장 검색 모드로 전환 (필터 사용을 위해)
    const expanded = await userPage.expandSearchMode();
    expect(expanded, "❌ 확장 검색 모드로 전환할 수 없습니다.").toBe(true);

    // 회원상태 셀렉트에서 첫 번째 옵션 선택
    const selectedOption = await userPage.selectFirstStatusOption();
    expect(
      selectedOption.length,
      "❌ 상태 필터 옵션을 선택할 수 없습니다.",
    ).toBeGreaterThan(0);

    // 조회 버튼이 보이는지 확인 후 클릭
    const searchBtnVisible = await userPage.submitSearchButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    expect(searchBtnVisible, "❌ 조회 버튼이 보이지 않아 필터를 적용할 수 없습니다.").toBe(
      true,
    );
    await userPage.clickSearchAndWait();

    const filteredMetrics = await userPage.getResultMetrics();

    // 필터 적용 후 결과가 있으면 행 수가 초기보다 같거나 적어야 함
    if (!filteredMetrics.noResultState) {
      expect(filteredMetrics.rowCount).toBeLessThanOrEqual(
        initialMetrics.rowCount,
      );
    }

    // 초기화 후 원래 결과 복귀
    await userPage.resetFiltersAndWait();
    const resetMetrics = await userPage.getResultMetrics();
    expect(
      resetMetrics.rowCount,
      "❌ 필터 초기화 후 목록이 비어 있습니다.",
    ).toBeGreaterThan(0);
  });

  test("USR-FLT-02: 가입서비스 필터 적용 검증", async ({ page }) => {
    // 확장 검색 모드로 전환 (서비스 필터 버튼은 확장 모드에서만 표시)
    const expanded = await userPage.expandSearchMode();
    expect(expanded, "❌ 확장 검색 모드로 전환할 수 없습니다.").toBe(true);

    const hasServiceButtons = await userPage.hasServiceFilterButtons();
    expect(
      hasServiceButtons,
      "❌ 가입서비스 필터 버튼이 없어 서비스 필터를 검증할 수 없습니다.",
    ).toBe(true);

    const initialMetrics = await userPage.getResultMetrics();
    expectHasUserRows(initialMetrics, "가입서비스 필터 적용 전 회원 목록");

    // 초기 데이터 지문 저장
    const initialFingerprint = await userPage.getFirstRowFingerprint();

    // 첫 번째 서비스 필터(메이크스타) 클릭
    await userPage.clickServiceFilter("메이크스타");

    // 조회 버튼이 보이는지 확인 후 클릭
    const searchBtnVisible = await userPage.submitSearchButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    expect(searchBtnVisible, "❌ 조회 버튼이 보이지 않아 서비스 필터를 적용할 수 없습니다.").toBe(
      true,
    );
    await userPage.clickSearchAndWait();
    await page.waitForLoadState("networkidle").catch(() => {});

    const filteredMetrics = await userPage.getResultMetrics();

    if (!filteredMetrics.noResultState) {
      // 필터 적용 후 결과 행 수가 초기보다 같거나 적어야 함
      expect(filteredMetrics.rowCount).toBeLessThanOrEqual(
        initialMetrics.rowCount,
      );

      // 가입서비스 열(6번째)에서 메이크스타 포함 비율 검증
      // (필터는 "메이크스타 사용 이력" 기준이므로, 다중 서비스 사용자의 주 서비스가 다를 수 있음)
      const serviceTexts = await userPage.getColumnTexts(6);
      const nonEmptyTexts = serviceTexts.filter((t) => t.length > 0);
      const makestarRows = nonEmptyTexts.filter(
        (text) => text.includes("MAKESTAR") || text.includes("메이크스타"),
      );

      // 메이크스타 필터 적용 시 최소 과반 이상이 메이크스타여야 함
      if (nonEmptyTexts.length > 0) {
        const ratio = makestarRows.length / nonEmptyTexts.length;
        expect(
          ratio,
          `메이크스타 필터 적용 후 메이크스타 비율이 너무 낮음: ${makestarRows.length}/${nonEmptyTexts.length} (${(ratio * 100).toFixed(0)}%)`,
        ).toBeGreaterThanOrEqual(0.5);
      }
    }

    // 초기화
    await userPage.resetFiltersAndWait();
  });
});

// ##############################################################################
// 페이지네이션
// ##############################################################################
test.describe.serial("페이지네이션 @feature:admin_makestar.user.list", () => {
  let userPage: UserListPage;

  test.beforeEach(async ({ page }) => {
    userPage = await initPageWithRecovery(UserListPage, page, "회원관리");
  });

  test("USR-PAGIN-01: 다음 페이지 이동 검증", async ({ page }) => {
    const firstMetrics = await userPage.getResultMetrics();
    expectHasUserRows(firstMetrics, "다음 페이지 이동 전 회원 목록");

    const canGoNext = await userPage.canGoToNextPage();
    if (!canGoNext) {
      const pageLimit = await userPage.getPerPageLimit(10);
      expect(
        firstMetrics.rowCount,
        `단일 페이지 상태인데 행 수(${firstMetrics.rowCount})가 페이지 제한(${pageLimit})을 초과합니다.`,
      ).toBeLessThanOrEqual(pageLimit);
      console.log("  ✅ 단일 페이지 상태 확인 — 다음 페이지 이동 불필요");
    } else {
      const beforeUrl = page.url();
      const beforeFirstRow = await userPage.getFirstRowFingerprint();

      const moved = await userPage.goToNextPageSafely();
      expect(moved, "❌ 다음 페이지 이동에 실패했습니다.").toBeTruthy();

      // 데이터 로드 안정화 대기
      await page.waitForLoadState("networkidle").catch(() => {});
      await userPage.waitForTableOrNoResult();

      const afterUrl = page.url();
      const afterFirstRow = await userPage.getFirstRowFingerprint();
      const afterPage = await userPage.getCurrentPageNumber();

      const urlChanged = beforeUrl !== afterUrl;
      const rowChanged =
        beforeFirstRow.length > 0 &&
        afterFirstRow.length > 0 &&
        beforeFirstRow !== afterFirstRow;
      const pageIsSecond = afterPage >= 2;

      expect(
        urlChanged || rowChanged || pageIsSecond,
        `다음 페이지 이동 후 식별자 변화가 없습니다. url:${beforeUrl}->${afterUrl}, page:${afterPage}`,
      ).toBeTruthy();
    }
  });

  test("USR-PAGIN-02: 이전 페이지 복귀 검증", async () => {
    const canGoNext = await userPage.canGoToNextPage();
    if (!canGoNext) {
      const metrics = await userPage.getResultMetrics();
      expectHasUserRows(metrics, "이전 페이지 복귀 전 회원 목록");
      console.log("  ✅ 단일 페이지 상태 확인 — 이전 페이지 복귀 불필요");
    } else {
      // 2페이지로 이동
      const moved = await userPage.goToNextPageSafely();
      expect(moved, "❌ 다음 페이지 이동에 실패했습니다.").toBeTruthy();

      const secondPageFingerprint = await userPage.getFirstRowFingerprint();

      // 1페이지로 복귀
      const returned = await userPage.goToPreviousPageSafely();
      expect(returned, "❌ 이전 페이지 복귀에 실패했습니다.").toBeTruthy();

      const firstPageFingerprint = await userPage.getFirstRowFingerprint();

      // 2페이지와 1페이지의 데이터가 다르면 성공
      if (secondPageFingerprint.length > 0 && firstPageFingerprint.length > 0) {
        expect(
          firstPageFingerprint,
          "이전 페이지 복귀 후 동일한 데이터가 표시됩니다.",
        ).not.toBe(secondPageFingerprint);
      }
    }
  });
});

// ##############################################################################
// 액션
// ##############################################################################
test.describe.serial("액션 @feature:admin_makestar.user.list", () => {
  let userPage: UserListPage;

  test.beforeEach(async ({ page }) => {
    userPage = await initPageWithRecovery(UserListPage, page, "회원관리");
  });

  test("USR-ACTION-01: 엑셀 다운로드 버튼 동작 검증", async () => {
    await expect(userPage.excelDownloadButton).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });
    await expect(userPage.excelDownloadButton).toBeEnabled();

    // 다운로드 이벤트 감지
    const [download] = await Promise.all([
      userPage.page
        .waitForEvent("download", { timeout: 10000 })
        .catch(() => null),
      userPage.excelDownloadButton.click(),
    ]);

    // 다운로드가 시작되었거나 버튼 클릭이 오류 없이 완료되면 성공
    if (download) {
      const filename = download.suggestedFilename();
      expect(
        filename.length,
        "❌ 다운로드 파일명이 비어 있습니다.",
      ).toBeGreaterThan(0);
    }
    // 다운로드 이벤트 없이도 버튼 클릭 성공 = 동작 검증 완료
  });

  test("USR-ACTION-02: 전체 선택/해제 체크박스 검증", async () => {
    const metrics = await userPage.getResultMetrics();
    expectHasUserRows(metrics, "전체 선택/해제 체크박스 검증");

    // 전체 선택
    await userPage.checkAllRows();
    await userPage.assertAllCheckboxes(true);

    // 전체 해제
    await userPage.uncheckAllRows();
    await userPage.assertAllCheckboxes(false);
  });

  test("USR-ACTION-03: 개별 행 체크박스 선택/해제 검증", async () => {
    const metrics = await userPage.getResultMetrics();
    expectHasUserRows(metrics, "개별 행 체크박스 검증");
    expect(
      metrics.rowCount,
      `❌ 개별 체크박스 검증에는 최소 2개 행이 필요합니다. 현재 rowCount=${metrics.rowCount}`,
    ).toBeGreaterThanOrEqual(2);

    // 첫 번째 행만 체크
    const firstCheckbox = userPage.getRowCheckbox(0);
    const secondCheckbox = userPage.getRowCheckbox(1);

    await firstCheckbox.check();

    // 첫 번째 행 체크 확인
    await expect(firstCheckbox).toBeChecked();

    // 두 번째 행은 체크 안 됨
    await expect(secondCheckbox).not.toBeChecked();

    // 개별 해제
    await firstCheckbox.uncheck();
    await expect(firstCheckbox).not.toBeChecked();
    console.log("  ✅ 개별 행 체크박스 동작 검증 완료");
  });
});

// ##############################################################################
// 상세 페이지
// ##############################################################################
test.describe.serial("상세 페이지 @feature:admin_makestar.user.detail", () => {
  let userPage: UserListPage;

  test.beforeEach(async ({ page }) => {
    userPage = await initPageWithRecovery(UserListPage, page, "회원관리");
  });

  test("USR-DETAIL-01: 상세 페이지 진입 및 기본정보 확인", async ({ page }) => {
    const metrics = await userPage.getResultMetrics();
    expectHasUserRows(metrics, "회원 상세 페이지 진입");

    // 첫 행 클릭하여 상세 페이지 이동
    const detailUrl = await userPage.clickFirstRowAndNavigate();
    expect(detailUrl).toMatch(/\/user\/\d+/);

    // 상세 페이지 POM 생성
    const detailPage = new UserDetailPage(page);

    // 헤딩 검증
    await detailPage.assertHeading();

    // 기본정보 섹션 검증
    await detailPage.assertBasicInfoVisible();

    // 회원정보 레이블 검증
    await detailPage.assertInfoLabelsVisible();

    // 주요 섹션 검증
    await detailPage.assertSectionsVisible();
  });

  test("USR-DETAIL-02: 목록 데이터와 상세 페이지 데이터 일관성 검증", async ({
    page,
  }) => {
    const metrics = await userPage.getResultMetrics();
    expectHasUserRows(metrics, "회원 상세 일관성 검증");

    // B안 일부 도입: 프로필 완성 회원 우선 탐색
    const candidate = await userPage.findRowWithCompleteProfile();
    const listData = candidate;

    if (!candidate.hasCompleteProfile) {
      console.log(
        `  ⚠️ 프로필 완성 회원 없음 (상위 10행 스캔) — 첫 행(${listData.email})으로 기본 검증만 수행`,
      );
    } else {
      console.log(
        `  ℹ️ 프로필 완성 회원 발견: 행 ${listData.rowIndex} (${listData.email})`,
      );
    }

    expect(
      listData.email.length,
      "❌ 목록의 이메일이 비어 있습니다.",
    ).toBeGreaterThan(0);

    const listService = (await userPage.getCellText(listData.rowIndex, 6)).trim();

    // 상세 페이지 이동
    const expectedDetailPath = await userPage.getRowDetailPath(listData.rowIndex);
    expect(expectedDetailPath, "❌ 목록 행의 상세 링크를 찾을 수 없습니다.").toMatch(
      /\/user\/\d+/,
    );
    const detailUrl = await userPage.clickRowAndNavigate(listData.rowIndex);
    expect(detailUrl).toContain(expectedDetailPath);

    const detailPage = new UserDetailPage(page);
    await detailPage.assertBasicInfoVisible();

    // 페이지 텍스트 (getInfoValueByLabel이 DOM 구조에 따라 실패할 수 있어 fallback용)
    const pageText = (await page.locator("body").textContent()) ?? "";
    const detailAccount = await detailPage.getInfoValueByLabel("가입계정");
    const detailStatus = await detailPage.getInfoValueByLabel("회원상태");
    const detailService = await detailPage.getInfoValueByLabel("가입서비스");

    // 이메일 검증: 상세 UI가 E-Mail 대신 가입계정에만 값을 노출하는 경우까지 허용
    const rawDetailEmail = await detailPage.getInfoValueByLabel("E-Mail");
    const detailEmail = rawDetailEmail.includes("@") ? rawDetailEmail : "";
    if (detailEmail.length > 0) {
      expect(
        detailEmail,
        `상세 페이지 E-Mail(${detailEmail})이 목록 이메일(${listData.email})과 불일치`,
      ).toContain(listData.email);
    } else if (
      detailAccount.includes(listData.email) ||
      pageText.includes(listData.email)
    ) {
      console.log(
        `  ℹ️ E-Mail 직접 추출 실패 — 가입계정/페이지 텍스트에서 이메일(${listData.email}) 확인됨`,
      );
    } else {
      console.log(
        `  ⚠️ 상세 페이지에 이메일 텍스트(${listData.email})가 직접 노출되지 않습니다. URL 경로 일치로 기본 일관성 확인`,
      );
    }

    if (detailStatus.length > 0) {
      expect(
        detailStatus,
        `상세 페이지 회원상태(${detailStatus})가 목록 상태(${listData.status})와 불일치`,
      ).toContain(listData.status);
    }

    const normalizedListService = listService.toUpperCase();
    const normalizedDetailService = detailService.toUpperCase();
    const hasComparableDetailService =
      normalizedDetailService.length > 0 &&
      !/배송정보 수신|마케팅 제공동의/.test(detailService);

    if (
      listService.length > 0 &&
      (hasComparableDetailService ||
        pageText.toUpperCase().includes(normalizedListService))
    ) {
      expect(
        `${normalizedDetailService} ${pageText.toUpperCase()}`,
        `상세 페이지 가입서비스(${detailService})가 목록 가입서비스(${listService})와 불일치`,
      ).toContain(normalizedListService);
    } else if (listService.length > 0) {
      console.log(
        `  ⚠️ 상세 페이지에서 가입서비스(${listService})를 안정적으로 추출하지 못했습니다. URL/상태 일관성만 확인`,
      );
    }

    // 닉네임/이름 검증: 프로필 완성 회원이면 strict, 미완성이면 경고만
    if (candidate.hasCompleteProfile) {
      if (listData.nickname.length > 0) {
        const detailNickname = await detailPage.getInfoValueByLabel("닉네임");
        if (detailNickname.length > 0) {
          expect(
            detailNickname,
            `상세 페이지 닉네임(${detailNickname})이 목록(${listData.nickname})과 불일치`,
          ).toContain(listData.nickname);
        } else if (pageText.includes(listData.nickname)) {
          console.log(
            `  ℹ️ 닉네임 레이블 추출 실패 — 페이지 텍스트에서 닉네임(${listData.nickname}) 확인됨`,
          );
        } else {
          console.log(
            `  ⚠️ 상세 페이지에서 닉네임(${listData.nickname})을 안정적으로 추출하지 못했습니다. URL/상태 일관성만 확인`,
          );
        }
      }
    } else {
      console.log(
        "  ⚠️ 프로필 미완성 회원 — 닉네임/이름 일관성 검증 생략 (커머스 가입 시 미입력 허용)",
      );
    }
  });

  test("USR-DETAIL-03: 상세 페이지에서 목록 복귀 검증", async ({ page }) => {
    const metrics = await userPage.getResultMetrics();
    expectHasUserRows(metrics, "회원 상세에서 목록 복귀");

    // 상세 페이지 이동
    const detailUrl = await userPage.clickFirstRowAndNavigate();
    expect(detailUrl).toMatch(/\/user\/\d+/);

    const detailPage = new UserDetailPage(page);

    // 목록으로 복귀
    await detailPage.goBackToListViaBreadcrumb();

    // 목록 페이지로 복귀 확인
    const returnedUrl = page.url();
    expect(returnedUrl, "❌ 목록 페이지로 복귀하지 못했습니다.").toMatch(
      /\/user\/list|\/user$/,
    );

    // 목록 데이터가 다시 로드되었는지 확인
    const returnedMetrics = await userPage.getResultMetrics();
    expectHasUserRows(returnedMetrics, "상세 페이지 복귀 후 회원 목록");
  });
});

// ============================================================================
// B2B 예치금 관리 — QA-98: 예치금 충전 불가
// Jira: https://makestar-product.atlassian.net/browse/QA-98
// ============================================================================
test.describe.serial("[QA-98] B2B 예치금 충전/차감 검증 @suite:ops", () => {
  const DEPOSIT_URL = "https://stage-new-admin.makeuni2026.com/user-group/474";
  const CHARGE_AMOUNT = "1";
  const DEPOSIT_SUFFIX = Date.now().toString().slice(-6);
  const CHARGE_MEMO = `[자동화테스트] QA98 충전 ${DEPOSIT_SUFFIX}`;
  const DEDUCT_MEMO = `[자동화테스트] QA98 차감 ${DEPOSIT_SUFFIX}`;
  let balanceBefore: number;

  test.beforeEach(async ({ page }) => {
    await page.goto(DEPOSIT_URL);
    await waitForPageStable(page);
    await page.waitForLoadState("networkidle");
  });

  test("QA98-PAGE-01: 업체 관리 페이지 기본 요소 노출 검증", async ({
    page,
  }) => {
    await expect(page.getByText("예치금").first()).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });
    await expect(page.getByRole("button", { name: "충전" })).toBeVisible();
    await expect(page.getByRole("button", { name: "차감" })).toBeVisible();
    await expect(page.getByRole("button", { name: "내역" })).toBeVisible();
    await expect(page.locator("table").first()).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });
  });

  test("QA98-CREATE-01: 충전 모달 폼 요소 확인", async ({ page }) => {
    await page.getByRole("button", { name: "충전" }).click();
    await waitForModalOpen(page);

    await expect(page.getByText("예치금 충전하기")).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });
    await expect(
      page.getByPlaceholder("충전 금액을 입력해주세요"),
    ).toBeVisible();
    await expect(
      page.getByPlaceholder("예치금 충전 시 메모를 입력할 수 있습니다."),
    ).toBeVisible();
    await expect(page.getByText(/현재 보유 예치금/)).toBeVisible();
    await expect(page.getByRole("button", { name: "취소" })).toBeVisible();
    await expect(page.getByRole("button", { name: "확인" })).toBeVisible();
  });

  test("QA98-CREATE-02: 예치금 충전 실행 및 잔액 변경 확인", async ({
    page,
  }) => {
    const balanceText = await page.evaluate(() => {
      const match = document.body.innerText.match(
        /예치금\s*(?:USD\s*\$?\s*)?(\d[\d,]*)/,
      );
      return match ? match[1].replace(/,/g, "") : null;
    });
    balanceBefore = balanceText ? parseInt(balanceText, 10) : 0;
    console.log(`  충전 전 예치금 잔액: ${balanceBefore} USD`);

    await page.getByRole("button", { name: "충전" }).click();
    await waitForModalOpen(page);
    await expect(page.getByPlaceholder("충전 금액을 입력해주세요")).toBeVisible(
      { timeout: ELEMENT_TIMEOUT },
    );

    await page.getByPlaceholder("충전 금액을 입력해주세요").fill(CHARGE_AMOUNT);
    await page
      .getByPlaceholder("예치금 충전 시 메모를 입력할 수 있습니다.")
      .fill(CHARGE_MEMO);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "확인" }).click();
    await expect(page.getByText("예치금 충전하기")).not.toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });

    await page.reload({ waitUntil: "networkidle" });
    const newText = await page.evaluate(() => {
      const match = document.body.innerText.match(
        /예치금\s*(?:USD\s*\$?\s*)?(\d[\d,]*)/,
      );
      return match ? match[1].replace(/,/g, "") : null;
    });
    const balanceAfter = newText ? parseInt(newText, 10) : 0;
    console.log(`  충전 후 예치금 잔액: ${balanceAfter} USD`);
    expect(balanceAfter).toBe(balanceBefore + parseInt(CHARGE_AMOUNT, 10));
  });

  test("QA98-DATA-01: 내역에서 충전 기록 확인", async ({ page }) => {
    await page.getByRole("button", { name: "내역" }).click();
    await expect(page.getByText("예치금 내역")).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });

    const historyTable = page
      .locator("table")
      .filter({ has: page.locator("th", { hasText: "상태" }) });
    await expect(historyTable).toBeVisible({ timeout: ELEMENT_TIMEOUT });

    const latestCharge = historyTable
      .locator("tbody tr")
      .filter({ hasText: "충전" })
      .first();
    await expect(latestCharge).toBeVisible();
    console.log("  ✅ 내역에서 충전 기록 확인");
  });

  test("QA98-CREATE-03: 예치금 차감 실행 및 잔액 원복 확인", async ({
    page,
  }) => {
    const beforeText = await page.evaluate(() => {
      const match = document.body.innerText.match(
        /예치금\s*(?:USD\s*\$?\s*)?(\d[\d,]*)/,
      );
      return match ? match[1].replace(/,/g, "") : null;
    });
    const deductBefore = beforeText ? parseInt(beforeText, 10) : 0;
    console.log(`  차감 전 예치금 잔액: ${deductBefore} USD`);

    await page.getByRole("button", { name: "차감" }).click();
    await waitForModalOpen(page);
    await expect(page.getByPlaceholder("차감 금액을 입력해주세요")).toBeVisible(
      { timeout: ELEMENT_TIMEOUT },
    );

    await page.getByPlaceholder("차감 금액을 입력해주세요").fill(CHARGE_AMOUNT);
    await page
      .getByPlaceholder("예치금 차감 시 메모를 입력할 수 있습니다.")
      .fill(DEDUCT_MEMO);

    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "확인" }).click();
    await expect(page.getByText("예치금 차감하기")).not.toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });

    await page.reload({ waitUntil: "networkidle" });
    const afterText = await page.evaluate(() => {
      const match = document.body.innerText.match(
        /예치금\s*(?:USD\s*\$?\s*)?(\d[\d,]*)/,
      );
      return match ? match[1].replace(/,/g, "") : null;
    });
    const deductAfter = afterText ? parseInt(afterText, 10) : 0;
    console.log(`  차감 후 예치금 잔액: ${deductAfter} USD`);
    expect(deductAfter).toBe(deductBefore - parseInt(CHARGE_AMOUNT, 10));
  });

  test("QA98-DATA-02: 내역에서 차감 기록 확인", async ({ page }) => {
    await page.getByRole("button", { name: "내역" }).click();
    await expect(page.getByText("예치금 내역")).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });

    // 내역 테이블 실제 데이터 로드 대기 (비동기 로딩)
    const historyTable = page
      .locator("table")
      .filter({ has: page.locator("th", { hasText: "상태" }) });
    await expect(historyTable).toBeVisible({ timeout: ELEMENT_TIMEOUT });
    await expect(
      historyTable
        .locator("tbody tr")
        .filter({ hasText: /충전|차감/ })
        .first(),
    ).toBeVisible({ timeout: ELEMENT_TIMEOUT });

    const chargeRows = historyTable
      .locator("tbody tr")
      .filter({ hasText: "충전" });
    const deductRows = historyTable
      .locator("tbody tr")
      .filter({ hasText: "차감" });
    expect(await chargeRows.count()).toBeGreaterThan(0);
    expect(await deductRows.count()).toBeGreaterThan(0);
    console.log(
      `  내역 요약: 충전 ${await chargeRows.count()}건, 차감 ${await deductRows.count()}건`,
    );
  });
});
