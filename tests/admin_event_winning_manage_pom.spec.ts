/**
 * Admin 이벤트 당첨 관리 (POM)
 *
 * 메뉴: 이벤트 / 공지 > 이벤트 당첨 관리
 * URL: /event-winning-manage
 *
 * ============================================================================
 * TC명 체계: EWN-{기능}-{번호}
 * ============================================================================
 * 영역: EWN (Event WiNning)
 * 기능: PAGE / SEARCH / FLT / PAGIN / DATA / NAV / ACTION
 *
 * 자동화 제외 (수동 검증):
 *   - 추첨 실행 / 당첨자 등록·삭제 / 발표 트리거 (데이터 영향)
 *   - 메일 알림 발송 (외부 영향)
 *   - 시간 기반 상태 전이
 *
 * @see tests/pages/admin-event-winning-manage.page.ts
 * @see tests/pages/admin-event-winning-detail.page.ts
 */

import { test, expect } from "@playwright/test";
import {
  EventWinningManagePage,
  EventWinningDetailPage,
  EVENT_WINNING_STATUS_FILTERS,
  EVENT_WINNING_TABLE_HEADERS,
  type DetailTabKey,
  type WinningStatusFilter,
} from "./pages";
import {
  applyAdminTestConfig,
  ELEMENT_TIMEOUT,
  waitForPageStable,
} from "./helpers/admin/test-helpers";

// ============================================================================
// 테스트 설정 (토큰 유효성 + 데스크톱 뷰포트 검증)
// ============================================================================
applyAdminTestConfig("이벤트 당첨 관리");

// ============================================================================
// 유틸: 공백 제거 비교 (필터 라벨 vs 테이블 상태 컬럼 텍스트)
// ============================================================================
function stripSpaces(text: string): string {
  return text.replace(/\s+/g, "");
}

function safeDecodeUrlValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function normalizeSearchText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function buildEventNameSearchToken(eventName: string): string {
  const token =
    eventName.match(/[A-Za-z0-9]{4,}/)?.[0] ??
    eventName.match(/[가-힣]{2,}/)?.[0] ??
    "";

  return token.trim();
}

// 판매 기간 형식: "YYYY-MM-DD ~ YYYY-MM-DD" 또는 종료일 미정("-" / "미정") 허용
const SALE_DURATION_REGEX =
  /^\d{4}-\d{2}-\d{2}\s*~\s*(\d{4}-\d{2}-\d{2}|-|미정)$/;

/**
 * 상태 필터 적용 후 정밀 매칭 검증
 * - 결과 안정성 검증
 * - 결과가 있으면 모든 행의 상태 컬럼이 expectedNormalized 포함 (공백 무시)
 * - 결과가 비어 있으면 allowEmpty=true일 때만 허용
 */
async function assertFilterStrictMatch(
  pageObj: EventWinningManagePage,
  filter: WinningStatusFilter,
): Promise<void> {
  const expectation = EVENT_WINNING_STATUS_FILTERS[filter];
  expect(
    expectation.expectedStatus,
    `❌ "${filter}" 필터는 정밀 매칭 기대 상태가 정의되어 있어야 합니다.`,
  ).not.toBeNull();

  await pageObj.filterByStatus(filter);
  const metrics = await pageObj.getResultMetrics();
  expect(
    metrics.rowCount > 0 || metrics.noResultState,
    `❌ "${filter}" 필터 적용 후 페이지가 정상 상태가 아닙니다.`,
  ).toBe(true);

  if (metrics.noResultState) {
    expect(
      expectation.allowEmpty,
      `❌ "${filter}" 필터 결과가 비어 있는데, 빈 결과를 허용하지 않는 시나리오입니다.`,
    ).toBe(true);
    expect(
      metrics.hasNoResultMessage,
      `❌ "${filter}" 필터 빈 결과 상태인데 no-result 메시지가 없습니다.`,
    ).toBe(true);
    return;
  }

  const statuses = await pageObj.getAllStatusValues();
  expect(
    statuses.length,
    `❌ "${filter}" 필터 결과 행은 있으나 상태 컬럼 텍스트를 읽지 못했습니다.`,
  ).toBeGreaterThan(0);
  const mismatches = statuses.filter(
    (s) => !stripSpaces(s).includes(expectation.expectedStatus ?? ""),
  );
  expect(
    mismatches,
    `❌ "${filter}" 필터 결과 중 상태 컬럼이 "${expectation.expectedStatus}"가 아닌 행: ${JSON.stringify(mismatches.slice(0, 3))}`,
  ).toHaveLength(0);
}

// ##############################################################################
// Admin 이벤트 당첨 관리
// ##############################################################################
test.describe("Admin 이벤트 당첨 관리 @feature:admin_event_winning_manage", () => {
  let pageObj: EventWinningManagePage;

  // ===========================================================================
  // 페이지 로드 및 기본 요소
  // ===========================================================================
  test.describe("페이지 로드 및 기본 요소", () => {
    test.beforeEach(async ({ page }) => {
      pageObj = new EventWinningManagePage(page);
      await pageObj.navigate();
      await waitForPageStable(page);
      await pageObj.waitForResultStable();
    });

    test("EWN-PAGE-01: 페이지 헤딩 + 테이블 헤더 검증", async () => {
      await pageObj.assertHeading();
      await pageObj.assertTableHeaders([...EVENT_WINNING_TABLE_HEADERS]);
    });

    test("EWN-PAGE-02: 검색/필터 영역 노출", async () => {
      await expect(pageObj.keywordInput).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(pageObj.searchButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(pageObj.resetButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });

      const statusKeys = Object.keys(
        EVENT_WINNING_STATUS_FILTERS,
      ) as WinningStatusFilter[];
      for (const key of statusKeys) {
        await expect(pageObj.getStatusFilterButton(key)).toBeVisible({
          timeout: ELEMENT_TIMEOUT,
        });
      }

      // 정렬/추가 옵션 (1차에선 노출만 검증)
      await expect(pageObj.saleDurationButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
      await expect(pageObj.latestSortButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
    });

    test("EWN-PAGE-03: 페이지당 행 수 + 페이지네이션 노출", async () => {
      await pageObj.assertRowCountWithinLimit(10);
      await expect(pageObj.paginationNav).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
    });

    test("EWN-PAGE-04: 페이지 진입 시 서버 에러 없음", async () => {
      await pageObj.assertNoServerError("이벤트 당첨 관리 페이지 진입 후");
    });
  });

  // ===========================================================================
  // 검색 기능
  // ===========================================================================
  test.describe("검색 기능", () => {
    test.beforeEach(async ({ page }) => {
      pageObj = new EventWinningManagePage(page);
      await pageObj.navigate();
      await waitForPageStable(page);
      await pageObj.waitForResultStable();
    });

    test("EWN-SEARCH-01: 이벤트 코드 검색 → 모든 결과 코드 일치", async () => {
      const initialEventCode = await pageObj.getFirstRowEventCode();
      expect(
        initialEventCode.length,
        "❌ 첫 행 이벤트 코드를 가져오지 못했습니다.",
      ).toBeGreaterThan(0);

      expect(
        initialEventCode,
        `❌ 이벤트 코드 형식 위반: ${initialEventCode}`,
      ).toMatch(/^[A-Za-z0-9_\-]+$/);

      await pageObj.searchByKeyword(initialEventCode);

      const metrics = await pageObj.getResultMetrics();
      expect(
        metrics.noResultState,
        `❌ 현재 목록의 이벤트 코드로 검색했는데 결과가 없습니다. (검색어: ${initialEventCode})`,
      ).toBe(false);

      const eventCodes = await pageObj.getColumnTexts(
        EventWinningManagePage.COL.eventCode,
      );
      const mismatches = eventCodes.filter((code) => code !== initialEventCode);
      expect(
        eventCodes.length,
        "❌ 검색 결과 이벤트 코드 컬럼을 읽지 못했습니다.",
      ).toBeGreaterThan(0);
      expect(
        mismatches,
        `❌ "${initialEventCode}" 검색 결과에 다른 이벤트 코드가 포함됨: ${JSON.stringify(mismatches.slice(0, 3))}`,
      ).toHaveLength(0);
    });

    test("EWN-SEARCH-02: 이벤트명 일부 검색 → 모든 결과 이벤트명 포함", async () => {
      const initialEventName = await pageObj.getFirstRowEventName();
      const searchToken = buildEventNameSearchToken(initialEventName);
      expect(
        searchToken.length,
        `❌ 이벤트명 검색 토큰을 추출하지 못했습니다. (이벤트명: ${initialEventName})`,
      ).toBeGreaterThan(1);

      await pageObj.searchByKeyword(searchToken);

      const metrics = await pageObj.getResultMetrics();
      expect(
        metrics.noResultState,
        `❌ 현재 목록의 이벤트명 일부로 검색했는데 결과가 없습니다. (검색어: ${searchToken})`,
      ).toBe(false);

      const eventNames = await pageObj.getColumnTexts(
        EventWinningManagePage.COL.eventName,
      );
      const normalizedToken = normalizeSearchText(searchToken);
      const mismatches = eventNames.filter(
        (name) => !normalizeSearchText(name).includes(normalizedToken),
      );

      expect(
        eventNames.length,
        "❌ 검색 결과 이벤트명 컬럼을 읽지 못했습니다.",
      ).toBeGreaterThan(0);
      expect(
        mismatches,
        `❌ "${searchToken}" 검색 결과에 토큰 미포함 이벤트명이 존재함: ${JSON.stringify(mismatches.slice(0, 3))}`,
      ).toHaveLength(0);
    });

    test("EWN-SEARCH-03: 검색 초기화 → 입력값 비워짐", async () => {
      await pageObj.keywordInput.fill("ZZZ_NOT_EXIST_TOKEN");
      await pageObj.clickResetButton();
      await expect(pageObj.keywordInput).toHaveValue("", {
        timeout: ELEMENT_TIMEOUT,
      });
    });

    test("EWN-SEARCH-04: 결과 0건 검색 → '검색결과가 없습니다' 노출", async () => {
      // 절대 매칭되지 않을 토큰으로 검색
      const noMatchToken = `ZZZNOEXIST_${Date.now()}`;
      await pageObj.searchByKeyword(noMatchToken);

      await expect(
        pageObj.noResultMessage,
        "❌ 빈 검색 결과 메시지가 노출되지 않습니다.",
      ).toBeVisible({ timeout: ELEMENT_TIMEOUT });

      // tbody에 placeholder 행이 들어가는 케이스 대응 → 표준 noResultState 사용
      const metrics = await pageObj.getResultMetrics();
      expect(
        metrics.noResultState,
        "❌ noResult 상태로 판정되지 않았습니다 (실제 데이터 행이 존재).",
      ).toBe(true);
    });
  });

  // ===========================================================================
  // 상태 필터 (정밀 매칭)
  // ===========================================================================
  test.describe("상태 필터", () => {
    test.beforeEach(async ({ page }) => {
      pageObj = new EventWinningManagePage(page);
      await pageObj.navigate();
      await waitForPageStable(page);
      await pageObj.waitForResultStable();
    });

    test("EWN-FLT-01: 판매중 필터 → 모든 행 상태 일치", async () => {
      await assertFilterStrictMatch(pageObj, "onSale");
    });

    test("EWN-FLT-02: 당첨 발표 완료 필터 → 모든 행 상태 일치", async () => {
      await assertFilterStrictMatch(pageObj, "announceCompleted");
    });

    test("EWN-FLT-03: 전체로 복귀 → 결과 노출", async () => {
      await pageObj.filterByStatus("onSale");
      await pageObj.getResultMetrics();

      await pageObj.filterByStatus("all");
      const metrics = await pageObj.getResultMetrics();
      expect(
        metrics.rowCount,
        "❌ 전체 필터 복귀 후 결과가 비어 있습니다.",
      ).toBeGreaterThan(0);
    });

    test("EWN-FLT-04: 판매전 필터 → 모든 행 상태 일치", async () => {
      await assertFilterStrictMatch(pageObj, "preSale");
    });

    test("EWN-FLT-05: 판매 종료 필터 → 모든 행 상태 일치", async () => {
      await assertFilterStrictMatch(pageObj, "saleEnded");
    });

    test("EWN-FLT-06: 당첨 발표 예약 필터 (빈 결과 허용)", async () => {
      await assertFilterStrictMatch(pageObj, "announcePending");
    });

    test("EWN-FLT-07: 이벤트 종료 필터 → 모든 행 상태 일치", async () => {
      await assertFilterStrictMatch(pageObj, "eventEnded");
    });
  });

  // ===========================================================================
  // 페이지네이션
  // ===========================================================================
  test.describe("페이지네이션", () => {
    test.beforeEach(async ({ page }) => {
      pageObj = new EventWinningManagePage(page);
      await pageObj.navigate();
      await waitForPageStable(page);
      await pageObj.waitForResultStable();
    });

    test("EWN-PAGIN-01: 다음 페이지 이동 → 첫 행 변경", async () => {
      const metrics = await pageObj.getResultMetrics();
      if (metrics.noResultState) {
        expect(
          metrics.hasNoResultMessage,
          "❌ 목록 데이터 없음 메시지가 없습니다.",
        ).toBe(true);
        return;
      }

      const canGoNext = await pageObj.canGoToNextPage();
      if (!canGoNext) {
        expect(
          metrics.rowCount,
          "❌ 단일 페이지 행 수가 기본 페이지 크기를 초과합니다.",
        ).toBeLessThanOrEqual(10);
        return;
      }

      const before = await pageObj.getFirstRowFingerprint();
      expect(before.length, "❌ 첫 행 데이터가 비어 있습니다.").toBeGreaterThan(
        0,
      );

      const moved = await pageObj.goToNextPageSafely();
      expect(moved, "❌ 다음 페이지로 이동하지 못했습니다.").toBe(true);

      const after = await pageObj.getFirstRowFingerprint();
      expect(after, "❌ 페이지 이동 후 첫 행 데이터가 동일합니다.").not.toBe(
        before,
      );
    });

    test("EWN-PAGIN-02: 이전 페이지 복귀", async () => {
      const metrics = await pageObj.getResultMetrics();
      if (metrics.noResultState) {
        expect(
          metrics.hasNoResultMessage,
          "❌ 목록 데이터 없음 메시지가 없습니다.",
        ).toBe(true);
        return;
      }

      const canGoNext = await pageObj.canGoToNextPage();
      if (!canGoNext) {
        expect(
          metrics.rowCount,
          "❌ 단일 페이지 행 수가 기본 페이지 크기를 초과합니다.",
        ).toBeLessThanOrEqual(10);
        return;
      }

      const before = await pageObj.getFirstRowFingerprint();
      const movedNext = await pageObj.goToNextPageSafely();
      expect(movedNext, "❌ 다음 페이지 이동 실패").toBe(true);

      const movedBack = await pageObj.goToPreviousPageSafely();
      expect(movedBack, "❌ 이전 페이지 복귀 실패").toBe(true);

      await pageObj.waitForResultStable();
      const restored = await pageObj.getFirstRowFingerprint();
      expect(restored, "❌ 이전 페이지 복귀 후 첫 행이 원본과 다릅니다.").toBe(
        before,
      );
    });

    test("EWN-PAGIN-03: 페이지 사이즈 20으로 변경 → 행 ≤20", async () => {
      const hadNextPage = await pageObj.canGoToNextPage();

      await pageObj.changePageSize(20);
      const selectedPageSize = await pageObj.getSelectedPageSize();
      expect(
        selectedPageSize,
        "❌ 페이지 사이즈 20이 선택 상태로 표시되지 않습니다.",
      ).toBe(20);

      const metrics = await pageObj.getResultMetrics();
      if (metrics.noResultState) {
        expect(
          metrics.hasNoResultMessage,
          "❌ 목록 데이터 없음 메시지가 없습니다.",
        ).toBe(true);
        return;
      }

      expect(
        metrics.rowCount,
        `❌ 페이지 사이즈 20 변경 후 행 수가 20 초과: ${metrics.rowCount}`,
      ).toBeLessThanOrEqual(20);

      if (hadNextPage) {
        expect(
          metrics.rowCount,
          "❌ 10/page에서 다음 페이지가 있었는데 20/page 적용 후에도 10행 이하입니다.",
        ).toBeGreaterThan(10);
      }
    });
  });

  // ===========================================================================
  // 데이터 정합성
  // ===========================================================================
  test.describe("데이터 정합성", () => {
    test.beforeEach(async ({ page }) => {
      pageObj = new EventWinningManagePage(page);
      await pageObj.navigate();
      await waitForPageStable(page);
      await pageObj.waitForResultStable();
    });

    test("EWN-DATA-01: 첫 행 데이터 형식 검증 (ID/이벤트 코드/판매 기간)", async () => {
      const id = await pageObj.getFirstRowId();
      const eventCode = await pageObj.getFirstRowEventCode();
      const saleDuration = await pageObj.getFirstRowSaleDuration();

      expect(id, `❌ ID는 숫자여야 합니다. (실제: "${id}")`).toMatch(/^\d+$/);
      expect(
        eventCode,
        `❌ 이벤트 코드 형식 위반 — 영숫자/언더스코어/하이픈만 허용. (실제: "${eventCode}")`,
      ).toMatch(/^[A-Za-z0-9_\-]+$/);
      expect(
        saleDuration,
        `❌ 이벤트 판매 기간 형식 위반 — "YYYY-MM-DD ~ (YYYY-MM-DD | - | 미정)" 기대. (실제: "${saleDuration}")`,
      ).toMatch(SALE_DURATION_REGEX);
    });

    test("EWN-DATA-02: 첫 페이지 모든 행 데이터 형식 검증", async () => {
      const ids = await pageObj.getColumnTexts(EventWinningManagePage.COL.id);
      const codes = await pageObj.getColumnTexts(
        EventWinningManagePage.COL.eventCode,
      );
      const durations = await pageObj.getColumnTexts(
        EventWinningManagePage.COL.saleDuration,
      );

      expect(ids.length, "❌ 첫 페이지에 행이 없습니다.").toBeGreaterThan(0);

      // ────────────────────────────────────────────────────────────────────────
      // 진단성 강화: 위반 발견 시 행 번호 + 값을 콘솔에 즉시 노출
      // (assertion은 그대로 — 위반이 있으면 여전히 실패하지만 어느 행/값인지 추적 가능)
      // 행 번호는 1-based (테이블 UI와 동일하게 보이도록)
      // ────────────────────────────────────────────────────────────────────────
      const ID_REGEX = /^\d+$/;
      const EVENT_CODE_REGEX = /^[A-Za-z0-9_\-]+$/;

      type Violation = { row: number; value: string };
      const idMismatches: Violation[] = ids
        .map((value, i) => ({ row: i + 1, value }))
        .filter(({ value }) => !ID_REGEX.test(value));
      const codeMismatches: Violation[] = codes
        .map((value, i) => ({ row: i + 1, value }))
        .filter(({ value }) => !EVENT_CODE_REGEX.test(value));
      const durationMismatches: Violation[] = durations
        .map((value, i) => ({ row: i + 1, value }))
        .filter(({ value }) => !SALE_DURATION_REGEX.test(value));

      // 위반 통합 리포트 — 행 단위로 어느 컬럼이 깨졌는지 한눈에 보이도록 출력
      const totalViolations =
        idMismatches.length + codeMismatches.length + durationMismatches.length;
      if (totalViolations > 0) {
        const rowSet = new Set<number>([
          ...idMismatches.map((v) => v.row),
          ...codeMismatches.map((v) => v.row),
          ...durationMismatches.map((v) => v.row),
        ]);
        const sortedRows = Array.from(rowSet).sort((a, b) => a - b);

        // eslint-disable-next-line no-console
        console.log(
          `[EWN-DATA-02] 형식 위반 감지 — 총 ${totalViolations}건 (대상 행 ${sortedRows.length}개) / 페이지 총 ${ids.length}행`,
        );
        for (const row of sortedRows) {
          const idVal = ids[row - 1] ?? "<missing>";
          const codeVal = codes[row - 1] ?? "<missing>";
          const durVal = durations[row - 1] ?? "<missing>";
          const broken: string[] = [];
          if (!ID_REGEX.test(idVal)) broken.push("id");
          if (!EVENT_CODE_REGEX.test(codeVal)) broken.push("eventCode");
          if (!SALE_DURATION_REGEX.test(durVal)) broken.push("saleDuration");
          // eslint-disable-next-line no-console
          console.log(
            `  [row ${row}] 위반 필드=[${broken.join(", ")}] | id="${idVal}" eventCode="${codeVal}" saleDuration="${durVal}"`,
          );
        }

        // Playwright HTML 리포트에도 첨부 — CI에서 데이터팀 공유 시 캡처 용이
        test.info().annotations.push({
          type: "EWN-DATA-02 violations",
          description: JSON.stringify(
            {
              total: totalViolations,
              idMismatches,
              codeMismatches,
              durationMismatches,
            },
            null,
            2,
          ),
        });
      }

      expect(
        idMismatches,
        `❌ ID 형식 위반 — 숫자만 허용. 위반 행: ${JSON.stringify(idMismatches)}`,
      ).toHaveLength(0);

      expect(
        codeMismatches,
        `❌ 이벤트 코드 형식 위반 — 영숫자/언더스코어/하이픈만 허용. 위반 행: ${JSON.stringify(codeMismatches)}`,
      ).toHaveLength(0);

      expect(
        durationMismatches,
        `❌ 판매 기간 형식 위반 — "YYYY-MM-DD ~ (YYYY-MM-DD | - | 미정)" 기대. 위반 행: ${JSON.stringify(durationMismatches)}`,
      ).toHaveLength(0);
    });
  });

  // ===========================================================================
  // 액션 버튼 안정성 (클릭 시 서버 에러 없음만 검증 — 동작 미정의)
  // ===========================================================================
  test.describe("액션 버튼 안정성", () => {
    test.beforeEach(async ({ page }) => {
      pageObj = new EventWinningManagePage(page);
      await pageObj.navigate();
      await waitForPageStable(page);
      await pageObj.waitForResultStable();
    });

    test("EWN-ACTION-01: 최신순 클릭 → URL 정렬 쿼리 적용 + 결과 정상", async () => {
      const baselineSort = pageObj.getSortQuery();

      await pageObj.clickLatestSort();
      await pageObj.assertNoServerError("최신순 클릭 후");

      // URL에 sortBy 적용 검증
      const sort = pageObj.getSortQuery();
      expect(
        sort.sortBy,
        "❌ 최신순 클릭 후 URL에 sortBy 파라미터가 없습니다.",
      ).not.toBeNull();
      expect(
        sort.sortOrder,
        "❌ 최신순 클릭 후 URL에 sortOrder 파라미터가 없습니다.",
      ).not.toBeNull();

      const sortChanged =
        baselineSort.sortBy !== sort.sortBy ||
        baselineSort.sortOrder !== sort.sortOrder;
      const metrics = await pageObj.getResultMetrics();
      expect(
        sortChanged || metrics.rowCount > 0 || metrics.noResultState,
        "❌ 최신순 클릭 후 URL/목록 상태 변화를 확인하지 못했습니다.",
      ).toBe(true);
    });

    test("EWN-ACTION-02: 이벤트 판매 기간 정렬 옵션 선택 → URL 정렬 쿼리 적용", async () => {
      const baselineSort = pageObj.getSortQuery();

      // 클릭 전엔 popover 미노출
      await expect(
        pageObj.saleDurationPopover,
        "❌ 클릭 전 popover가 이미 노출되어 있습니다.",
      ).not.toBeVisible();

      await pageObj.openSortPopover();
      await pageObj.assertNoServerError("이벤트 판매 기간 클릭 후");
      await expect(
        pageObj.saleDurationPopover,
        "❌ 이벤트 판매 기간 클릭 후 정렬 옵션 popover가 노출되지 않습니다.",
      ).toBeVisible({ timeout: ELEMENT_TIMEOUT });
      await expect(
        pageObj.getSortPopoverOption("이벤트 판매 종료"),
      ).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });

      await pageObj.getSortPopoverOption("이벤트 판매 종료").click();
      await pageObj.waitForResultStable();
      await expect(
        pageObj.saleDurationPopover,
        "❌ 정렬 옵션 선택 후 popover가 닫히지 않습니다.",
      ).not.toBeVisible({ timeout: ELEMENT_TIMEOUT });

      const sort = pageObj.getSortQuery();
      expect(
        sort.sortBy,
        "❌ 정렬 옵션 선택 후 URL에 sortBy 파라미터가 없습니다.",
      ).not.toBeNull();
      expect(
        sort.sortOrder,
        "❌ 정렬 옵션 선택 후 URL에 sortOrder 파라미터가 없습니다.",
      ).not.toBeNull();
      expect(
        baselineSort.sortBy !== sort.sortBy ||
          baselineSort.sortOrder !== sort.sortOrder,
        `❌ 정렬 옵션 선택 후 정렬 쿼리가 변경되지 않았습니다. (${JSON.stringify(sort)})`,
      ).toBe(true);
    });
  });

  // ===========================================================================
  // 상세 페이지 진입 (NAV)
  // ===========================================================================
  test.describe("상세 페이지 진입", () => {
    let listPage: EventWinningManagePage;
    let detailPage: EventWinningDetailPage;

    test.beforeEach(async ({ page }) => {
      listPage = new EventWinningManagePage(page);
      detailPage = new EventWinningDetailPage(page);
      await listPage.navigate();
      await waitForPageStable(page);
      await listPage.waitForResultStable();
    });

    test("EWN-NAV-01: 행 클릭 → 상세 URL/이벤트명 일치", async () => {
      const { id, eventName } = await listPage.openDetailByFirstRow();
      await detailPage.assertOnDetailPage();

      expect(
        detailPage.getDetailEventId(),
        "❌ URL의 이벤트 ID가 행 ID와 다릅니다.",
      ).toBe(id);

      const urlName = detailPage.getDetailQueryParam("name");
      expect(urlName, "❌ URL에 name 파라미터가 없습니다.").not.toBeNull();

      // 이벤트명 일부가 URL에 포함되어야 함 (긴 이름의 경우 일부만 체크)
      const eventNameSnippet = eventName.slice(0, 10).trim();
      const decodedUrlName = safeDecodeUrlValue(urlName ?? "");
      expect(
        decodedUrlName,
        `❌ URL의 이벤트명이 행 이벤트명과 일치하지 않음. URL: "${decodedUrlName}" / 행: "${eventName}"`,
      ).toContain(eventNameSnippet);
    });

    test("EWN-NAV-02: 상세 페이지 5개 탭 노출", async () => {
      await listPage.openDetailByFirstRow();
      await detailPage.assertOnDetailPage();
      await detailPage.assertAllTabsVisible();
    });

    test("EWN-NAV-03: 상세 → 목록 복귀 (브라우저 back)", async ({ page }) => {
      await listPage.openDetailByFirstRow();
      await detailPage.assertOnDetailPage();

      await page.goBack();
      await listPage.waitForResultStable();

      await listPage.assertHeading();
      expect(
        page.url(),
        "❌ 목록 복귀 후 URL이 상세 패턴 그대로입니다.",
      ).not.toMatch(/\/event-winning-manage\/\d+/);
      expect(page.url(), "❌ 목록 페이지 URL이 아닙니다.").toContain(
        "/event-winning-manage",
      );
    });
  });

  // ===========================================================================
  // 상세 — 탭 진입 (실행 X, 진입만 검증)
  // ===========================================================================
  test.describe("상세 — 탭 진입 (실행 X)", () => {
    let listPage: EventWinningManagePage;
    let detailPage: EventWinningDetailPage;

    test.beforeEach(async ({ page }) => {
      listPage = new EventWinningManagePage(page);
      detailPage = new EventWinningDetailPage(page);
      await listPage.navigate();
      await waitForPageStable(page);
      await listPage.waitForResultStable();
      await listPage.openDetailByFirstRow();
      await detailPage.assertOnDetailPage();
    });

    test("EWN-ACTION-03: 읽기/알림 탭 진입 → 서버 에러 없음", async () => {
      const tabs: DetailTabKey[] = [
        "salesVolume",
        "orders",
        "mailNotification",
      ];

      for (const tab of tabs) {
        await detailPage.clickTab(tab);
        await detailPage.assertNoServerError(`${tab} 탭 진입 후`);
      }
    });

    test("EWN-ACTION-04: '당첨자 선정' 탭 클릭 → 서버 에러 없음", async () => {
      await detailPage.clickTab("winnerSelection");
      await detailPage.assertNoServerError("당첨자 선정 탭 진입 후");
    });

    test("EWN-ACTION-05: '당첨자 발표' 탭 클릭 → 서버 에러 없음", async () => {
      await detailPage.clickTab("winnerAnnouncement");
      await detailPage.assertNoServerError("당첨자 발표 탭 진입 후");
    });
  });
});
