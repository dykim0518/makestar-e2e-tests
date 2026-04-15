/**
 * Admin 아티스트 메뉴 통합 테스트 (Page Object Model 적용)
 *
 * 대상:
 * - 아티스트 > 아티스트
 * - URL: /artist/list
 *
 * ============================================================================
 * TC명 체계: [영역]-[기능]-[번호]: 한글 설명
 * ============================================================================
 * 영역: ART (아티스트)
 * 기능: PAGE (기본 요소), DATA (데이터 정합성), SEARCH (검색),
 *       PAGIN (페이지네이션), FLT (필터), NAV (네비게이션)
 *
 * ============================================================================
 * 실행 순서 (사용자 시나리오 기반)
 * ============================================================================
 * 1. 페이지 로드 및 기본 요소
 *    ART-PAGE-01 ~ 02: 페이지 타이틀, 헤딩, 검색, 등록 버튼, 건수
 *
 * 2. 데이터 정합성
 *    ART-DATA-01 ~ 07: 필수 컬럼 빈 값, 정렬, 포맷, 유효 값, 건수 일관성
 *
 * 3. 검색 기능
 *    ART-SEARCH-01: 검색 입력 필드 동작
 *    NOTE: 검색 아이콘이 React synthetic event로만 동작하여
 *          결과 검증은 수동 확인 필요. data-testid 추가 요청 시 자동화 가능.
 *
 * 4. 노출여부 필터
 *    ART-FLT-01: 필터 드롭다운 존재 및 옵션 검증
 *
 * 5. 페이지네이션
 *    ART-PAGIN-01 ~ 03: 다음 페이지, 복귀, 페이지 연속성
 *
 * 6. 네비게이션
 *    ART-NAV-01: 아티스트 등록 버튼 → 등록 폼 표시
 *    ART-NAV-02: 등록 폼 기본 구조 검증
 *
 * @see tests/pages/admin-artist-list.page.ts
 */

import { test, expect } from "@playwright/test";
import {
  ArtistListPage,
  ARTIST_TABLE_HEADERS,
  ARTIST_COL,
  assertNoServerError,
} from "./pages";
import type { ArtistRowData } from "./pages";
import {
  waitForPageStable,
  ELEMENT_TIMEOUT,
  applyAdminTestConfig,
} from "./helpers/admin/test-helpers";

// ============================================================================
// 테스트 설정
// ============================================================================
applyAdminTestConfig("아티스트");

// ##############################################################################
// 아티스트 목록 - 페이지 로드 및 기본 요소
// ##############################################################################
test.describe("아티스트 목록", () => {
  // ============================================================================
  // 페이지 로드 및 기본 요소
  // ============================================================================
  test.describe("페이지 로드 및 기본 요소 @feature:admin_makestar.artist.list", () => {
    let artistPage: ArtistListPage;

    test.beforeEach(async ({ page }) => {
      artistPage = new ArtistListPage(page);
      await artistPage.navigate();
      await waitForPageStable(page);
    });

    test("ART-PAGE-01: 페이지 타이틀 및 헤딩 검증", async () => {
      await artistPage.assertPageTitle();
      await artistPage.assertHeading();
    });

    test("ART-PAGE-02: 핵심 UI 요소 표시 검증", async () => {
      // 검색 입력 필드
      await expect(artistPage.searchInput).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });

      // 아티스트 등록 버튼
      await expect(
        artistPage.registerButton,
        "❌ 아티스트 등록 버튼이 보이지 않습니다.",
      ).toBeVisible({ timeout: ELEMENT_TIMEOUT });

      // 목록 건수 텍스트 (예: "아티스트 목록 • 1965")
      await expect(
        artistPage.listCountText,
        "❌ 목록 건수 텍스트가 보이지 않습니다.",
      ).toBeVisible({ timeout: ELEMENT_TIMEOUT });

      // 노출여부 필터 드롭다운
      await expect(
        artistPage.exposureFilter,
        "❌ 노출여부 필터가 보이지 않습니다.",
      ).toBeVisible({ timeout: ELEMENT_TIMEOUT });
    });

    test("ART-PAGE-03: 테이블 헤더 검증", async () => {
      await expect(artistPage.table).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await artistPage.assertTableHeaders([...ARTIST_TABLE_HEADERS]);
    });

    test("ART-PAGE-04: 테이블 데이터 로드 검증", async () => {
      await expect(artistPage.table).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      const rowCount = await artistPage.getRowCount();
      expect(
        rowCount,
        "❌ 테이블에 데이터가 없습니다. 아티스트 데이터를 확인하세요.",
      ).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // 데이터 정합성
  // ============================================================================
  test.describe("데이터 정합성 @feature:admin_makestar.artist.list", () => {
    let artistPage: ArtistListPage;

    test.beforeEach(async ({ page }) => {
      artistPage = new ArtistListPage(page);
      await artistPage.navigate();
      await waitForPageStable(page);
      await expect(artistPage.table).toBeVisible({ timeout: 15000 });
    });

    test("ART-DATA-01: 필수 컬럼 빈 값 없음 검증 (No, 아티스트명, 타입)", async () => {
      const rows = await artistPage.getSampleRows(10);
      expect(rows.length, "❌ 샘플링할 데이터가 없습니다.").toBeGreaterThan(0);

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        expect(
          artistPage.isMeaningfulValue(row.no),
          `❌ 행 ${i}: No 컬럼이 비어있음`,
        ).toBe(true);

        expect(
          artistPage.isMeaningfulValue(row.artist),
          `❌ 행 ${i}: 아티스트 컬럼이 비어있음`,
        ).toBe(true);

        expect(
          artistPage.isMeaningfulValue(row.type),
          `❌ 행 ${i}: 타입 컬럼이 비어있음 (아티스트: ${row.artist})`,
        ).toBe(true);
      }
      console.log(`  ✅ ${rows.length}개 행 필수 컬럼 검증 완료`);
    });

    test("ART-DATA-02: No 컬럼 숫자 형식 및 내림차순 정렬 검증", async () => {
      const numbers = await artistPage.getNoColumnValues(10);
      expect(numbers.length, "❌ No 컬럼 데이터가 부족합니다.").toBeGreaterThan(
        1,
      );

      for (const num of numbers) {
        expect(num, `❌ No 값이 양수가 아닙니다: ${num}`).toBeGreaterThan(0);
      }

      for (let i = 0; i < numbers.length - 1; i++) {
        expect(
          numbers[i],
          `❌ 정렬 오류: No ${numbers[i]} → ${numbers[i + 1]} (내림차순이 아님)`,
        ).toBeGreaterThan(numbers[i + 1]);
      }
      console.log(
        `  ✅ No 정렬 검증 완료: ${numbers[0]} ~ ${numbers[numbers.length - 1]}`,
      );
    });

    test('ART-DATA-03: 멤버수 형식 검증 ("N명" 포맷)', async () => {
      const rows = await artistPage.getSampleRows(10);

      for (let i = 0; i < rows.length; i++) {
        expect(
          artistPage.isValidMemberCountFormat(rows[i].memberCount),
          `❌ 행 ${i}: 멤버수 형식 오류 — 실제: "${rows[i].memberCount}", 기대: "N명" (아티스트: ${rows[i].artist})`,
        ).toBe(true);
      }
    });

    test("ART-DATA-04: 타입 컬럼 유효 값 검증", async () => {
      const rows = await artistPage.getSampleRows(10);
      const uniqueTypes = [
        ...new Set(rows.map((r) => r.type).filter((t) => t.length > 0)),
      ];

      console.log(`  ℹ️ 발견된 타입 값: [${uniqueTypes.join(", ")}]`);

      for (let i = 0; i < rows.length; i++) {
        expect(
          rows[i].type.length,
          `❌ 행 ${i}: 타입이 빈 문자열 (아티스트: ${rows[i].artist})`,
        ).toBeGreaterThan(0);
      }

      expect(
        uniqueTypes.length,
        "❌ 타입 종류가 0개입니다. 데이터를 확인하세요.",
      ).toBeGreaterThanOrEqual(1);
    });

    test("ART-DATA-05: 소속사 컬럼 데이터 존재 비율 검증", async () => {
      const rows = await artistPage.getSampleRows(10);
      const withAgency = rows.filter((r) =>
        artistPage.isMeaningfulValue(r.agency),
      );
      const rate = Math.round((withAgency.length / rows.length) * 100);

      console.log(
        `  ℹ️ 소속사 존재 비율: ${withAgency.length}/${rows.length} (${rate}%)`,
      );

      expect(
        withAgency.length / rows.length,
        `❌ 소속사 데이터 비율 ${rate}%로 기준(50%) 미달`,
      ).toBeGreaterThanOrEqual(0.5);
    });

    test("ART-DATA-06: 목록 건수와 테이블 행 수 일관성 검증", async () => {
      const totalCount = await artistPage.getListCount();
      const rowCount = await artistPage.getRowCount();

      expect(totalCount, "❌ 총 건수가 0입니다.").toBeGreaterThan(0);
      expect(rowCount, "❌ 현재 페이지 행 수가 0입니다.").toBeGreaterThan(0);
      expect(
        rowCount,
        "❌ 페이지당 표시 개수(10)를 초과합니다.",
      ).toBeLessThanOrEqual(10);
      expect(
        totalCount,
        `❌ 총 건수(${totalCount})가 현재 행 수(${rowCount})보다 작습니다.`,
      ).toBeGreaterThanOrEqual(rowCount);

      console.log(
        `  ✅ 건수 일관성: 총 ${totalCount}건, 현재 페이지 ${rowCount}건`,
      );
    });

    test("ART-DATA-07: 검색어 컬럼 한글/영문 병기 패턴 검증", async () => {
      const rows = await artistPage.getSampleRows(10);
      const withKeyword = rows.filter((r) =>
        artistPage.isMeaningfulValue(r.keyword),
      );
      const withSeparator = withKeyword.filter((r) => r.keyword.includes("/"));

      console.log(
        `  ℹ️ 검색어 존재: ${withKeyword.length}/${rows.length}, 병기 패턴: ${withSeparator.length}건`,
      );

      for (const row of withSeparator) {
        const parts = row.keyword.split("/").map((p) => p.trim());
        expect(
          parts.every((p) => p.length > 0),
          `❌ 검색어 병기 패턴 오류: "${row.keyword}" — "/" 앞뒤에 빈 값 (아티스트: ${row.artist})`,
        ).toBe(true);
      }
    });
  });

  // ============================================================================
  // 검색 기능
  // ============================================================================
  test.describe("검색 기능 @feature:admin_makestar.artist.list", () => {
    let artistPage: ArtistListPage;

    test.beforeEach(async ({ page }) => {
      artistPage = new ArtistListPage(page);
      await artistPage.navigate();
      await waitForPageStable(page);
    });

    test("ART-SEARCH-01: 검색 입력 필드 텍스트 입력/삭제 검증", async () => {
      // 입력 필드가 활성화되어 있는지
      await expect(artistPage.searchInput).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(artistPage.searchInput).toBeEnabled({
        timeout: ELEMENT_TIMEOUT,
      });

      // 텍스트 입력
      await artistPage.searchInput.fill("BTS");
      await expect(artistPage.searchInput).toHaveValue("BTS");

      // 텍스트 삭제
      await artistPage.searchInput.clear();
      await expect(artistPage.searchInput).toHaveValue("");

      // 한글 입력
      await artistPage.searchInput.fill("방탄소년단");
      await expect(artistPage.searchInput).toHaveValue("방탄소년단");
    });
  });

  // ============================================================================
  // 노출여부 필터
  // ============================================================================
  test.describe("노출여부 필터 @feature:admin_makestar.artist.list", () => {
    let artistPage: ArtistListPage;

    test.beforeEach(async ({ page }) => {
      artistPage = new ArtistListPage(page);
      await artistPage.navigate();
      await waitForPageStable(page);
    });

    test("ART-FLT-01: 노출여부 필터 드롭다운 존재 및 기본값 검증", async () => {
      const filterVisible = await artistPage.exposureFilter
        .isVisible({ timeout: ELEMENT_TIMEOUT })
        .catch(() => false);

      expect(
        filterVisible,
        "❌ 노출여부 필터 드롭다운이 보이지 않습니다.",
      ).toBe(true);

      // 기본값이 "전체(노출여부)"인지 확인
      const filterText = await artistPage.exposureFilter.textContent();
      expect(
        filterText,
        `❌ 필터 기본값이 "전체(노출여부)"가 아닙니다. 실제: "${filterText}"`,
      ).toContain("전체");

      console.log(`  ✅ 노출여부 필터 기본값: "${filterText}"`);
    });
  });

  // ============================================================================
  // 페이지네이션
  // ============================================================================
  test.describe("페이지네이션 @feature:admin_makestar.artist.list", () => {
    let artistPage: ArtistListPage;

    test.beforeEach(async ({ page }) => {
      artistPage = new ArtistListPage(page);
      await artistPage.navigate();
      await waitForPageStable(page);
    });

    test("ART-PAGIN-01: 다음 페이지 이동 시 데이터 변경 검증", async () => {
      const rowCount = await artistPage.getRowCount();
      expect(rowCount, "❌ 테이블에 데이터가 없습니다.").toBeGreaterThan(0);

      const isNextVisible = await artistPage.nextPageButton
        .isVisible()
        .catch(() => false);
      const isNextEnabled = isNextVisible
        ? await artistPage.nextPageButton.isEnabled().catch(() => false)
        : false;

      expect(
        isNextVisible && isNextEnabled,
        "❌ 다음 페이지 버튼이 없거나 비활성화 — 데이터가 1페이지만 존재",
      ).toBeTruthy();

      const firstPageNumbers = await artistPage.getNoColumnValues(10);
      await artistPage.goToNextPage();
      const secondPageNumbers = await artistPage.getNoColumnValues(10);

      expect(
        secondPageNumbers[0],
        `❌ 페이지 이동 후 데이터가 변경되지 않음 (동일 No: ${firstPageNumbers[0]})`,
      ).not.toBe(firstPageNumbers[0]);

      console.log(
        `  ✅ 1페이지: No ${firstPageNumbers[0]}~${firstPageNumbers[firstPageNumbers.length - 1]} → 2페이지: No ${secondPageNumbers[0]}~${secondPageNumbers[secondPageNumbers.length - 1]}`,
      );
    });

    test("ART-PAGIN-02: 페이지 간 데이터 연속성 검증", async () => {
      const firstPageNumbers = await artistPage.getNoColumnValues(10);
      const moved = await artistPage.goToNextPage();
      if (!moved) {
        console.log("  ℹ️ 1페이지만 존재 - 연속성 검증 건너뜀");
        return;
      }

      const secondPageNumbers = await artistPage.getNoColumnValues(10);

      // 2페이지도 내림차순 유지
      for (let i = 0; i < secondPageNumbers.length - 1; i++) {
        expect(
          secondPageNumbers[i],
          `❌ 2페이지 정렬 오류: No ${secondPageNumbers[i]} → ${secondPageNumbers[i + 1]}`,
        ).toBeGreaterThan(secondPageNumbers[i + 1]);
      }

      // 1페이지 마지막 No > 2페이지 첫 No (페이지 간 연속)
      const lastOfFirst = firstPageNumbers[firstPageNumbers.length - 1];
      expect(
        secondPageNumbers[0],
        `❌ 페이지 연속성 오류: 1페이지 마지막(${lastOfFirst}) > 2페이지 첫(${secondPageNumbers[0]}) 이어야 함`,
      ).toBeLessThan(lastOfFirst);
    });

    test("ART-PAGIN-03: 페이지 이동 후 복귀 시 원래 데이터 복원 검증", async () => {
      const beforeNumbers = await artistPage.getNoColumnValues(10);
      const moved = await artistPage.goToNextPage();
      if (!moved) return;

      await artistPage.goToPreviousPage();
      const afterNumbers = await artistPage.getNoColumnValues(10);

      expect(
        afterNumbers,
        "❌ 복귀 후 데이터가 원래와 다릅니다 (멱등성 위반)",
      ).toEqual(beforeNumbers);
    });

    test("ART-PAGIN-04: 페이지당 표시 개수 검증", async () => {
      await artistPage.assertRowCountWithinLimit(10);
    });
  });

  // ============================================================================
  // 네비게이션
  // ============================================================================
  test.describe("네비게이션 @feature:admin_makestar.artist.create", () => {
    let artistPage: ArtistListPage;

    test.beforeEach(async ({ page }) => {
      artistPage = new ArtistListPage(page);
      await artistPage.navigate();
      await waitForPageStable(page);
    });

    test("ART-NAV-01: 아티스트 등록 버튼 클릭 시 등록 폼 표시 검증", async ({
      page,
    }) => {
      await expect(
        artistPage.registerButton,
        "❌ 아티스트 등록 버튼이 비활성화 상태입니다.",
      ).toBeEnabled({ timeout: ELEMENT_TIMEOUT });

      await artistPage.registerButton.click();
      await page.waitForLoadState("domcontentloaded");

      // 등록 폼이 표시되었는지 검증
      const formVisible = await page
        .getByText("기본정보")
        .isVisible({ timeout: ELEMENT_TIMEOUT })
        .catch(() => false);
      const headingVisible = await page
        .getByText("아티스트 등록")
        .first()
        .isVisible({ timeout: ELEMENT_TIMEOUT })
        .catch(() => false);

      expect(
        formVisible || headingVisible,
        "❌ 등록 버튼 클릭 후 등록 폼이 표시되지 않습니다.",
      ).toBe(true);

      console.log("  ✅ 아티스트 등록 폼 표시 확인");
    });

    test("ART-NAV-02: 등록 폼 기본 구조 검증", async ({ page }) => {
      await artistPage.registerButton.click();

      // 등록 폼이 나타날 때까지 명시적 대기 (기본정보 또는 아티스트 등록 텍스트)
      await page.waitForFunction(
        () => {
          const text = document.body.innerText || "";
          return text.includes("기본정보") || text.includes("아티스트 이미지");
        },
        { timeout: ELEMENT_TIMEOUT },
      );
      await waitForPageStable(page);

      // 서버 에러 체크
      await assertNoServerError(page, "아티스트 등록 폼");

      // 등록 폼 필수 섹션 존재 여부
      const sections = ["기본정보", "아티스트 이미지", "아티스트 연관 정보"];
      const foundSections: string[] = [];

      for (const section of sections) {
        const visible = await page
          .getByText(section)
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (visible) foundSections.push(section);
      }

      console.log(`  ℹ️ 등록 폼 섹션: [${foundSections.join(", ")}]`);
      expect(
        foundSections.length,
        `❌ 등록 폼 섹션이 하나도 없습니다. 발견: [${foundSections.join(", ")}]`,
      ).toBeGreaterThanOrEqual(1);

      // 등록/취소 버튼 존재
      const submitBtn = page.getByRole("button", { name: /등록|저장/ });
      const cancelBtn = page.getByRole("button", { name: /취소|돌아가기/ });

      const hasSubmit = await submitBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      const hasCancel = await cancelBtn
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      console.log(
        `  ℹ️ 등록 버튼: ${hasSubmit ? "✅" : "❌"}, 취소 버튼: ${hasCancel ? "✅" : "❌"}`,
      );
      expect(hasSubmit || hasCancel, "❌ 등록/취소 버튼이 모두 없습니다.").toBe(
        true,
      );
    });
  });
});
