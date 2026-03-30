/**
 * Admin 아티스트 메뉴 테스트 (Page Object Model 적용)
 *
 * 대상:
 * - 아티스트 > 아티스트
 * - URL: /artist/list
 *
 * 검증 범위:
 * - [PAGE] 목록 페이지 로드 및 기본 요소 검증
 * - [DATA] 셀 데이터 정합성 (빈 값, 포맷, 유효 값)
 * - [DATA] 정렬 순서 검증
 * - [DATA] 건수 일관성 검증
 * - [SEARCH] 검색 입력 필드 동작
 * - [PAGIN] 페이지네이션 동작 및 데이터 변경
 * - [NAV] 아티스트 등록 버튼 동작
 */

import { test, expect, type Page } from "@playwright/test";
import { ArtistListPage, ARTIST_TABLE_HEADERS, ARTIST_COL } from "./pages";
import type { ArtistRowData } from "./pages";
import { setupAuthCookies, resetAuthCache } from "./helpers/admin";
import {
  isAuthFailed,
  isTokenValidSync,
  getTokenRemaining,
  waitForPageStable,
  ELEMENT_TIMEOUT,
} from "./helpers/admin/test-helpers";

// ============================================================================
// 테스트 설정
// ============================================================================
const tokenValid = isTokenValidSync();

if (!tokenValid) {
  test("토큰 유효성 검증", () => {
    expect(
      tokenValid,
      "⚠️ 토큰이 만료되었습니다! 전체 테스트 실행: npx playwright test --project=admin-setup --project=admin-pc",
    ).toBe(true);
  });
}

test.beforeAll(async () => {
  resetAuthCache();
  if (tokenValid) {
    const { hours, minutes } = getTokenRemaining();
    console.log(
      `\n✅ Admin 아티스트 테스트 시작 (토큰 유효, 남은 시간: ${hours}시간 ${minutes}분)`,
    );
  }
});

test.beforeEach(async ({ page, viewport }) => {
  expect(
    viewport === null || viewport.width >= 1024,
    "이 테스트는 데스크톱 뷰포트에서만 실행됩니다",
  ).toBeTruthy();

  const authStatus = isAuthFailed();
  expect(authStatus.failed, `인증 실패: ${authStatus.reason}`).toBe(false);

  await setupAuthCookies(page);
});

/**
 * 아티스트 페이지 초기화 (인증/네비게이션 복구 포함)
 */
async function initArtistPageWithRecovery(
  seedPage: Page,
): Promise<ArtistListPage> {
  if (seedPage.isClosed()) {
    throw new Error(
      "Playwright page가 닫혀 아티스트 페이지를 초기화할 수 없습니다.",
    );
  }

  await setupAuthCookies(seedPage);

  const artistPage = new ArtistListPage(seedPage);
  await artistPage.navigate();

  const currentUrl = artistPage.currentUrl;
  const redirectedToLogin = /\/login|\/auth|stage-auth/i.test(currentUrl);
  if (redirectedToLogin) {
    resetAuthCache();
    await setupAuthCookies(seedPage);
    await artistPage.navigate();
  }

  await waitForPageStable(seedPage);

  await artistPage.waitForTableOrNoResult(15000).catch(async () => {
    const hasTable = await artistPage.table
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const hasNoResult = await artistPage.noResultMessage
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!hasTable && !hasNoResult) {
      throw new Error("아티스트 목록 영역이 로드되지 않았습니다.");
    }
  });

  return artistPage;
}

// ##############################################################################
// 아티스트 목록
// ##############################################################################
test.describe.serial("아티스트 목록", () => {
  let artistPage: ArtistListPage;

  test.beforeEach(async ({ page }) => {
    artistPage = await initArtistPageWithRecovery(page);
  });

  // ==========================================================================
  // 페이지 로드
  // ==========================================================================

  test("ART-PAGE-01: 페이지 기본 요소 검증", async () => {
    await artistPage.assertPageTitle();
    await artistPage.assertHeading();
    await expect(artistPage.searchInput).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });
    await expect(artistPage.registerButton).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });
    await expect(artistPage.listCountText).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });
  });

  test("ART-PAGE-02: 테이블 헤더 검증", async () => {
    await artistPage.assertTableHeaders([...ARTIST_TABLE_HEADERS]);
  });

  // ==========================================================================
  // 데이터 정합성
  // ==========================================================================

  test("ART-DATA-01: 필수 컬럼 빈 값 없음 검증", async () => {
    const rows = await artistPage.getSampleRows(10);
    expect(rows.length).toBeGreaterThan(0);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      // No: 반드시 값이 있어야 함
      expect(
        artistPage.isMeaningfulValue(row.no),
        `행 ${i}: No 컬럼이 비어있음`,
      ).toBe(true);

      // 아티스트명: 반드시 값이 있어야 함
      expect(
        artistPage.isMeaningfulValue(row.artist),
        `행 ${i}: 아티스트 컬럼이 비어있음`,
      ).toBe(true);

      // 타입: 반드시 값이 있어야 함
      expect(
        artistPage.isMeaningfulValue(row.type),
        `행 ${i}: 타입 컬럼이 비어있음 (아티스트: ${row.artist})`,
      ).toBe(true);
    }
  });

  test("ART-DATA-02: No 컬럼 숫자 형식 및 내림차순 정렬 검증", async () => {
    const numbers = await artistPage.getNoColumnValues(10);
    expect(numbers.length).toBeGreaterThan(1);

    // 모든 No가 양수 정수인지
    for (const num of numbers) {
      expect(num).toBeGreaterThan(0);
    }

    // 내림차순 정렬 검증 (최신순)
    for (let i = 0; i < numbers.length - 1; i++) {
      expect(
        numbers[i],
        `No 정렬 오류: ${numbers[i]} 다음에 ${numbers[i + 1]}이 와야 하는데 내림차순이 아님`,
      ).toBeGreaterThan(numbers[i + 1]);
    }
  });

  test('ART-DATA-03: 멤버수 형식 검증 ("N명" 포맷)', async () => {
    const rows = await artistPage.getSampleRows(10);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      expect(
        artistPage.isValidMemberCountFormat(row.memberCount),
        `행 ${i}: 멤버수 형식 오류 — 실제값: "${row.memberCount}", 기대: "N명" (아티스트: ${row.artist})`,
      ).toBe(true);
    }
  });

  test("ART-DATA-04: 타입 컬럼 유효 값 검증", async () => {
    const rows = await artistPage.getSampleRows(10);

    // 실제 데이터에서 타입 값 추출
    const typeValues = rows.map((r) => r.type).filter((t) => t.length > 0);
    const uniqueTypes = [...new Set(typeValues)];

    console.log(`ℹ️ 발견된 타입 값: [${uniqueTypes.join(", ")}]`);

    // 모든 타입 값이 비어있지 않은지 검증
    for (let i = 0; i < rows.length; i++) {
      expect(
        rows[i].type.length,
        `행 ${i}: 타입이 빈 문자열 (아티스트: ${rows[i].artist})`,
      ).toBeGreaterThan(0);
    }

    // 타입이 1가지 이상 존재하는지 (데이터 다양성)
    expect(uniqueTypes.length).toBeGreaterThanOrEqual(1);
  });

  test("ART-DATA-05: 소속사 컬럼 데이터 존재 검증", async () => {
    const rows = await artistPage.getSampleRows(10);

    // 소속사가 있는 행의 비율 확인 (소속사 없는 아티스트도 있을 수 있음)
    const withAgency = rows.filter((r) =>
      artistPage.isMeaningfulValue(r.agency),
    );
    const agencyRate = withAgency.length / rows.length;

    console.log(
      `ℹ️ 소속사 존재 비율: ${withAgency.length}/${rows.length} (${Math.round(agencyRate * 100)}%)`,
    );

    // 최소 50% 이상의 행에 소속사 데이터가 있어야 함
    expect(
      agencyRate,
      `소속사 데이터 비율이 너무 낮음: ${Math.round(agencyRate * 100)}%`,
    ).toBeGreaterThanOrEqual(0.5);
  });

  test("ART-DATA-06: 목록 건수와 테이블 행 수 일관성 검증", async () => {
    const totalCount = await artistPage.getListCount();
    const rowCount = await artistPage.getRowCount();

    // 총 건수가 0보다 큰지
    expect(totalCount).toBeGreaterThan(0);

    // 현재 페이지 행 수는 페이지당 표시 개수 이하 (기본 10)
    expect(rowCount).toBeLessThanOrEqual(10);
    expect(rowCount).toBeGreaterThan(0);

    // 총 건수가 현재 행 수보다 크거나 같은지 (전체 > 페이지 표시)
    expect(totalCount).toBeGreaterThanOrEqual(rowCount);
  });

  test("ART-DATA-07: 검색어 컬럼에 한글/영문 병기 패턴 검증", async () => {
    const rows = await artistPage.getSampleRows(10);

    // 검색어가 있는 행 확인
    const withKeyword = rows.filter((r) =>
      artistPage.isMeaningfulValue(r.keyword),
    );
    console.log(`ℹ️ 검색어 존재 비율: ${withKeyword.length}/${rows.length}`);

    // 검색어가 있는 행에서 "/" 구분자 패턴 확인 (한글 / 영문 병기)
    const withSeparator = withKeyword.filter((r) => r.keyword.includes("/"));
    if (withSeparator.length > 0) {
      console.log(`ℹ️ 한글/영문 병기 패턴: ${withSeparator.length}건`);
      // 병기 패턴의 경우 "/" 앞뒤에 값이 있는지
      for (const row of withSeparator) {
        const parts = row.keyword.split("/").map((p) => p.trim());
        expect(
          parts.every((p) => p.length > 0),
          `검색어 병기 패턴 오류: "${row.keyword}" (아티스트: ${row.artist})`,
        ).toBe(true);
      }
    }
  });

  // ==========================================================================
  // 검색 기능
  // NOTE: 검색 아이콘이 React synthetic event로만 동작하여
  //       키워드 검색 결과 검증은 수동으로 확인 필요합니다.
  //       프론트엔드에 data-testid 추가 요청 시 자동화 가능.
  // ==========================================================================

  test("ART-SEARCH-01: 검색 입력 필드 동작 검증", async () => {
    await artistPage.searchInput.fill("BTS");
    await expect(artistPage.searchInput).toHaveValue("BTS");
    await artistPage.searchInput.clear();
    await expect(artistPage.searchInput).toHaveValue("");
  });

  // ==========================================================================
  // 페이지네이션
  // ==========================================================================

  test("ART-PAGIN-01: 다음 페이지 이동 시 데이터 변경 검증", async () => {
    const hasData = await artistPage.hasTableData();
    if (!hasData) {
      console.log("ℹ️ 데이터가 없어 페이지네이션 검증을 건너뜁니다.");
      return;
    }

    // 1페이지 첫 행의 No 값 저장
    const firstPageNumbers = await artistPage.getNoColumnValues(10);

    const moved = await artistPage.goToNextPage();
    if (moved) {
      // 2페이지 첫 행의 No 값이 다른지 검증
      const secondPageNumbers = await artistPage.getNoColumnValues(10);

      expect(secondPageNumbers[0]).not.toBe(firstPageNumbers[0]);

      // 2페이지의 No도 내림차순인지
      for (let i = 0; i < secondPageNumbers.length - 1; i++) {
        expect(secondPageNumbers[i]).toBeGreaterThan(secondPageNumbers[i + 1]);
      }

      // 2페이지의 No는 1페이지의 마지막 No보다 작아야 함
      const lastOfFirstPage = firstPageNumbers[firstPageNumbers.length - 1];
      expect(
        secondPageNumbers[0],
        `페이지 연속성 오류: 1페이지 마지막(${lastOfFirstPage}) > 2페이지 첫번째(${secondPageNumbers[0]}) 이어야 함`,
      ).toBeLessThan(lastOfFirstPage);

      await artistPage.goToPreviousPage();
    } else {
      console.log(
        "ℹ️ 데이터가 1페이지뿐이어서 페이지네이션 이동을 건너뜁니다.",
      );
    }
  });

  test("ART-PAGIN-02: 페이지 이동 후 복귀 시 원래 데이터 복원 검증", async () => {
    const hasData = await artistPage.hasTableData();
    if (!hasData) return;

    // 1페이지 데이터 스냅샷
    const beforeNumbers = await artistPage.getNoColumnValues(10);

    // 2페이지로 이동 후 복귀
    const moved = await artistPage.goToNextPage();
    if (!moved) return;

    await artistPage.goToPreviousPage();

    // 복귀 후 데이터가 동일한지 검증 (멱등성)
    const afterNumbers = await artistPage.getNoColumnValues(10);
    expect(afterNumbers).toEqual(beforeNumbers);
  });

  // ==========================================================================
  // 네비게이션
  // ==========================================================================

  test("ART-NAV-01: 아티스트 등록 버튼 클릭 시 등록 폼 표시 검증", async () => {
    await expect(artistPage.registerButton).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });
    await expect(artistPage.registerButton).toBeEnabled();

    await artistPage.registerButton.click();
    await artistPage.page.waitForLoadState("domcontentloaded");

    // 등록 폼이 표시되었는지 검증
    const registerForm = artistPage.page.getByText("기본정보");
    const registerHeading = artistPage.page.getByText("아티스트 등록");
    const formVisible = await registerForm
      .isVisible({ timeout: ELEMENT_TIMEOUT })
      .catch(() => false);
    const headingVisible = await registerHeading
      .first()
      .isVisible({ timeout: ELEMENT_TIMEOUT })
      .catch(() => false);
    expect(formVisible || headingVisible).toBe(true);
  });
});
