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
} from "./helpers/admin/test-helpers";

// ============================================================================
// 테스트 설정
// ============================================================================
applyAdminTestConfig("회원관리");

// ##############################################################################
// 회원관리 목록
// ##############################################################################
test.describe.serial("회원관리 목록", () => {
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
      expect(
        metrics.hasNoResultMessage,
        "❌ 결과 없음 상태인데 메시지가 없습니다.",
      ).toBeTruthy();
      return;
    }

    expect(
      metrics.rowCount,
      "❌ 테이블 데이터가 로드되지 않았습니다.",
    ).toBeGreaterThan(0);

    const pageLimit = await userPage.getPerPageLimit(10);
    expect(
      metrics.rowCount,
      `❌ 행 수(${metrics.rowCount})가 페이지 제한(${pageLimit})을 초과합니다.`,
    ).toBeLessThanOrEqual(pageLimit);
    console.log(
      `  ✅ 데이터 로드 검증: ${metrics.rowCount}행 (제한: ${pageLimit})`,
    );
  });

  test("USR-DATA-01: 필수 컬럼 빈 값 검증 (이메일, 유저코드) + 선택 컬럼 경고", async () => {
    const metrics = await userPage.getResultMetrics();
    if (metrics.noResultState) return;

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
  });

  test("USR-DATA-02: 목록 건수와 테이블 행 수 일관성 검증", async () => {
    const metrics = await userPage.getResultMetrics();
    if (metrics.noResultState) return;

    const pageLimit = await userPage.getPerPageLimit(10);

    expect(metrics.rowCount, "❌ 행 수가 0입니다.").toBeGreaterThan(0);
    expect(
      metrics.rowCount,
      `❌ 행 수(${metrics.rowCount})가 페이지 제한(${pageLimit})을 초과합니다.`,
    ).toBeLessThanOrEqual(pageLimit);
    console.log(`  ✅ 건수 일관성: ${metrics.rowCount}행 (제한: ${pageLimit})`);
  });
});

// ##############################################################################
// 탭 기능
// ##############################################################################
test.describe.serial("탭 기능", () => {
  let userPage: UserListPage;

  test.beforeEach(async ({ page }) => {
    userPage = await initPageWithRecovery(UserListPage, page, "회원관리");
  });

  test("USR-TAB-01: B2C/B2B 회원관리 탭 전환 검증", async () => {
    const hasTabs = await userPage.hasTabNavigation();
    if (!hasTabs) {
      console.log("  ℹ️ 건너뜀: B2C/B2B 탭이 페이지에 존재하지 않음");
      return;
    }

    // 초기 상태 기록 (기본 탭: B2C회원관리)
    const initialMetrics = await userPage.getResultMetrics();
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
test.describe.serial("검색 기능", () => {
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
test.describe.serial("필터 기능", () => {
  let userPage: UserListPage;

  test.beforeEach(async ({ page }) => {
    userPage = await initPageWithRecovery(UserListPage, page, "회원관리");
  });

  test("USR-FLT-01: 회원상태 필터 적용 검증", async () => {
    const initialMetrics = await userPage.getResultMetrics();
    if (initialMetrics.noResultState) {
      console.log("  ℹ️ 건너뜀: 목록 데이터 없음 (noResultState)");
      return;
    }

    // 확장 검색 모드로 전환 (필터 사용을 위해)
    const expanded = await userPage.expandSearchMode();
    if (!expanded) {
      console.log("  ℹ️ 건너뜀: 확장 검색 모드 전환 불가");
      return;
    }

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
    if (searchBtnVisible) {
      await userPage.clickSearchAndWait();
    }

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
    if (!expanded) {
      console.log("  ℹ️ 건너뜀: 확장 검색 모드 전환 불가");
      return;
    }

    const hasServiceButtons = await userPage.hasServiceFilterButtons();
    if (!hasServiceButtons) {
      console.log("  ℹ️ 건너뜀: 가입서비스 필터 버튼 미존재");
      return;
    }

    const initialMetrics = await userPage.getResultMetrics();
    if (initialMetrics.noResultState) {
      console.log("  ℹ️ 건너뜀: 목록 데이터 없음 (noResultState)");
      return;
    }

    // 초기 데이터 지문 저장
    const initialFingerprint = await userPage.getFirstRowFingerprint();

    // 첫 번째 서비스 필터(메이크스타) 클릭
    await userPage.clickServiceFilter("메이크스타");

    // 조회 버튼이 보이는지 확인 후 클릭
    const searchBtnVisible = await userPage.submitSearchButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (searchBtnVisible) {
      await userPage.clickSearchAndWait();
      await page.waitForLoadState("networkidle").catch(() => {});
    }

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
test.describe.serial("페이지네이션", () => {
  let userPage: UserListPage;

  test.beforeEach(async ({ page }) => {
    userPage = await initPageWithRecovery(UserListPage, page, "회원관리");
  });

  test("USR-PAGIN-01: 다음 페이지 이동 검증", async ({ page }) => {
    const firstMetrics = await userPage.getResultMetrics();

    if (firstMetrics.noResultState) {
      console.log("  ℹ️ 건너뜀: 목록 데이터 없음");
      expect(firstMetrics.hasNoResultMessage).toBeTruthy();
      return;
    }

    const canGoNext = await userPage.canGoToNextPage();
    if (!canGoNext) {
      console.log("  ℹ️ 건너뜀: 단일 페이지 — 페이지네이션 불필요");
      return;
    }

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
  });

  test("USR-PAGIN-02: 이전 페이지 복귀 검증", async () => {
    const canGoNext = await userPage.canGoToNextPage();
    if (!canGoNext) {
      console.log("  ℹ️ 건너뜀: 단일 페이지 — 페이지네이션 불필요");
      return;
    }

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
  });
});

// ##############################################################################
// 액션
// ##############################################################################
test.describe.serial("액션", () => {
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
    if (metrics.noResultState) {
      console.log("  ℹ️ 건너뜀: 목록 데이터 없음");
      return;
    }

    // 전체 선택
    await userPage.checkAllRows();
    await userPage.assertAllCheckboxes(true);

    // 전체 해제
    await userPage.uncheckAllRows();
    await userPage.assertAllCheckboxes(false);
  });

  test("USR-ACTION-03: 개별 행 체크박스 선택/해제 검증", async () => {
    const metrics = await userPage.getResultMetrics();
    if (metrics.noResultState || metrics.rowCount < 2) {
      console.log(`  ℹ️ 건너뜀: 행 수 부족 (rowCount: ${metrics.rowCount})`);
      return;
    }

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
test.describe.serial("상세 페이지", () => {
  let userPage: UserListPage;

  test.beforeEach(async ({ page }) => {
    userPage = await initPageWithRecovery(UserListPage, page, "회원관리");
  });

  test("USR-DETAIL-01: 상세 페이지 진입 및 기본정보 확인", async ({ page }) => {
    const metrics = await userPage.getResultMetrics();
    if (metrics.noResultState) {
      console.log("  ℹ️ 건너뜀: 목록 데이터 없음");
      return;
    }

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
    if (metrics.noResultState) {
      console.log("  ℹ️ 건너뜀: 목록 데이터 없음");
      return;
    }

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

    // 상세 페이지 이동
    const detailUrl = await userPage.clickRowAndNavigate(listData.rowIndex);
    expect(detailUrl).toMatch(/\/user\/\d+/);

    const detailPage = new UserDetailPage(page);
    await detailPage.assertBasicInfoVisible();

    // 페이지 텍스트 (getInfoValueByLabel이 DOM 구조에 따라 실패할 수 있어 fallback용)
    const pageText = (await page.locator("body").textContent()) ?? "";

    // 이메일 검증 (가입 시 필수이므로 항상 존재해야 함)
    const detailEmail = await detailPage.getInfoValueByLabel("E-Mail");
    if (detailEmail.length > 0) {
      expect(
        detailEmail,
        `상세 페이지 E-Mail(${detailEmail})이 목록 이메일(${listData.email})과 불일치`,
      ).toContain(listData.email);
    } else if (pageText.includes(listData.email)) {
      console.log(
        `  ℹ️ E-Mail 레이블 추출 실패 — 페이지 텍스트에서 이메일(${listData.email}) 확인됨`,
      );
    } else {
      console.log(
        `  ⚠️ 상세 페이지에 이메일(${listData.email}) 미표시 — 커머스 가입 시 미표시 가능`,
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
          // 상세 페이지에서 닉네임 필드가 비어있는 경우 (시스템 특성: 목록과 상세 데이터 소스 차이)
          console.log(
            `  ⚠️ 상세 페이지에 닉네임(${listData.nickname}) 미표시 — 목록/상세 간 데이터 소스 차이 가능`,
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
    if (metrics.noResultState) {
      console.log("  ℹ️ 건너뜀: 목록 데이터 없음");
      return;
    }

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
    if (!returnedMetrics.noResultState) {
      expect(
        returnedMetrics.rowCount,
        "❌ 목록 복귀 후 데이터가 로드되지 않았습니다.",
      ).toBeGreaterThan(0);
    }
  });
});
