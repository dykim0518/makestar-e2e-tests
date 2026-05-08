/**
 * 이벤트 당첨 관리 페이지 객체
 *
 * URL: /event-winning-manage
 * 메뉴: 이벤트 / 공지 > 이벤트 당첨 관리
 */

import { Page, Locator } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

// ============================================================================
// 당첨 상태 필터 키 / 라벨 매핑
// ============================================================================

export type WinningStatusFilter =
  | "all"
  | "preSale"
  | "onSale"
  | "saleEnded"
  | "announcePending"
  | "announceCompleted"
  | "eventEnded";

export type WinningStatusExpectation = {
  label: string;
  expectedStatus: string | null;
  allowEmpty: boolean;
};

export const EVENT_WINNING_STATUS_FILTERS: Record<
  WinningStatusFilter,
  WinningStatusExpectation
> = {
  all: { label: "전체", expectedStatus: null, allowEmpty: false },
  preSale: { label: "판매전", expectedStatus: "판매전", allowEmpty: false },
  onSale: { label: "판매중", expectedStatus: "판매중", allowEmpty: false },
  saleEnded: {
    label: "판매 종료",
    expectedStatus: "판매종료",
    allowEmpty: false,
  },
  announcePending: {
    label: "당첨 발표 예약",
    expectedStatus: "당첨발표예약",
    allowEmpty: true,
  },
  announceCompleted: {
    label: "당첨 발표 완료",
    expectedStatus: "당첨발표완료",
    allowEmpty: false,
  },
  eventEnded: {
    label: "이벤트 종료",
    expectedStatus: "이벤트종료",
    allowEmpty: false,
  },
};

export const EVENT_WINNING_TABLE_HEADERS = [
  "ID",
  "상태",
  "이벤트 코드",
  "이벤트명",
  "이벤트 판매 기간",
  "이벤트 판매 종료",
  "당첨자 발표",
  "담당자",
] as const;

export type EventWinningSortOption =
  | "이벤트 판매 기간"
  | "이벤트 판매 종료"
  | "당첨자 발표";

// ============================================================================
// 이벤트 당첨 관리 페이지 클래스
// ============================================================================

export class EventWinningManagePage extends AdminBasePage {
  // 컬럼 인덱스 (0-based)
  static readonly COL = {
    id: 0,
    status: 1,
    eventCode: 2,
    eventName: 3,
    saleDuration: 4,
    saleEnd: 5,
    announcement: 6,
    manager: 7,
  } as const;

  // ---- 검색 영역 ----
  readonly keywordInput: Locator;

  // ---- 정렬/추가 옵션 (1차에선 노출 검증만) ----
  readonly saleDurationButton: Locator;
  readonly latestSortButton: Locator;

  // ---- 페이지 사이즈 combobox ----
  readonly pageSizeCombobox: Locator;

  // ---- searchButton override ----
  // admin-base 기본 셀렉터는 "조회하기" 매칭 → 이 페이지는 "검색하기"이므로 override
  override readonly searchButton: Locator = this.page.getByRole("button", {
    name: "검색하기",
    exact: true,
  });

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    this.keywordInput = page.getByPlaceholder("검색어를 입력해주세요");
    this.saleDurationButton = page.getByRole("button", {
      name: "이벤트 판매 기간",
      exact: true,
    });
    this.latestSortButton = page.getByRole("button", {
      name: "최신순",
      exact: true,
    });
    this.pageSizeCombobox = page
      .getByRole("combobox")
      .filter({ hasText: /\d+\s*\/\s*page/ });
  }

  // --------------------------------------------------------------------------
  // 페이지 정보 (추상 메서드 구현)
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/event-winning-manage`;
  }

  getHeadingText(): string {
    return "이벤트 당첨 관리";
  }

  /** 예상 테이블 헤더 (8개) */
  getExpectedHeaders(): string[] {
    return [...EVENT_WINNING_TABLE_HEADERS];
  }

  // --------------------------------------------------------------------------
  // 상태 필터
  // --------------------------------------------------------------------------

  /** 상태 필터 버튼 Locator */
  getStatusFilterButton(status: WinningStatusFilter): Locator {
    return this.page.getByRole("button", {
      name: EVENT_WINNING_STATUS_FILTERS[status].label,
      exact: true,
    });
  }

  /**
   * 상태 필터 적용 후 결과 안정 대기
   */
  async filterByStatus(status: WinningStatusFilter): Promise<void> {
    await this.getStatusFilterButton(status).click();
    await this.waitForResultStable();
  }

  // --------------------------------------------------------------------------
  // 검색
  // --------------------------------------------------------------------------

  /**
   * 키워드로 검색 (입력 → 검색하기 클릭 → 결과 대기)
   */
  async searchByKeyword(keyword: string): Promise<void> {
    await this.keywordInput.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
    await this.keywordInput.fill(keyword);
    await this.clickSearchAndWait();
  }

  // --------------------------------------------------------------------------
  // 결과 안정 대기 (검색/필터 공통)
  // --------------------------------------------------------------------------

  /**
   * 검색/필터 결과 안정 대기
   * - 스켈레톤 사라짐
   * - 테이블 또는 noResult 안착
   */
  async waitForResultStable(
    timeout: number = this.timeouts.long,
  ): Promise<void> {
    await this.page
      .waitForSelector(".animate-pulse", { state: "hidden", timeout })
      .catch(() => null);

    await Promise.race([
      this.tableRows.first().waitFor({ state: "visible", timeout }),
      this.noResultMessage.waitFor({ state: "visible", timeout }),
    ]);

    await this.page
      .waitForLoadState("networkidle", {
        timeout: Math.min(timeout, this.timeouts.medium),
      })
      .catch(() => null);
  }

  // --------------------------------------------------------------------------
  // 테이블 데이터 헬퍼
  // --------------------------------------------------------------------------

  /**
   * 모든 행의 특정 컬럼 텍스트
   */
  async getColumnTexts(columnIndex: number): Promise<string[]> {
    return await this.tableRows.evaluateAll(
      (rows, index) =>
        rows
          .map((row) =>
            (row.querySelectorAll("td")[index]?.textContent ?? "").trim(),
          )
          .filter(Boolean),
      columnIndex,
    );
  }

  /** 첫 번째 행의 ID 셀 텍스트 */
  async getFirstRowId(): Promise<string> {
    return await this.getCellText(0, EventWinningManagePage.COL.id);
  }

  /** 첫 번째 행의 이벤트 코드 */
  async getFirstRowEventCode(): Promise<string> {
    return await this.getCellText(0, EventWinningManagePage.COL.eventCode);
  }

  /** 첫 번째 행의 이벤트명 */
  async getFirstRowEventName(): Promise<string> {
    return await this.getCellText(0, EventWinningManagePage.COL.eventName);
  }

  /** 첫 번째 행의 이벤트 판매 기간 */
  async getFirstRowSaleDuration(): Promise<string> {
    return await this.getCellText(0, EventWinningManagePage.COL.saleDuration);
  }

  /** 모든 행의 상태 컬럼 텍스트 */
  async getAllStatusValues(): Promise<string[]> {
    return await this.getColumnTexts(EventWinningManagePage.COL.status);
  }

  // --------------------------------------------------------------------------
  // 정렬 (최신순 / 이벤트 판매 기간)
  // --------------------------------------------------------------------------

  /**
   * "최신순" 버튼 클릭 후 결과 안정 대기
   * 클릭 시 URL에 ?sortBy=...&sortOrder=... 추가됨
   */
  async clickLatestSort(): Promise<void> {
    await this.latestSortButton.click();
    await this.waitForResultStable();
  }

  /**
   * "이벤트 판매 기간" 버튼 클릭 후 안정 대기
   * 클릭 시 정렬 방향(SVG icon down/up) 토글
   */
  async clickSaleDurationSort(): Promise<void> {
    await this.saleDurationButton.click();
    await this.waitForResultStable();
  }

  /**
   * 현재 URL의 정렬 쿼리 파라미터 반환
   */
  getSortQuery(): { sortBy: string | null; sortOrder: string | null } {
    try {
      const url = new URL(this.page.url());
      return {
        sortBy: url.searchParams.get("sortBy"),
        sortOrder: url.searchParams.get("sortOrder"),
      };
    } catch {
      return { sortBy: null, sortOrder: null };
    }
  }

  /**
   * "이벤트 판매 기간" 클릭 시 노출되는 정렬 옵션 popover
   */
  get saleDurationPopover(): Locator {
    return this.page
      .locator('[class*="z-101"][class*="fixed"]')
      .filter({ hasText: /이벤트 판매 기간|이벤트 판매 종료|당첨자 발표/ })
      .first();
  }

  /**
   * 정렬 옵션 popover를 열고 노출을 확인합니다.
   */
  async openSortPopover(): Promise<void> {
    await this.saleDurationButton.click();
    await this.saleDurationPopover.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
  }

  /**
   * 정렬 옵션 항목 Locator
   */
  getSortPopoverOption(option: EventWinningSortOption): Locator {
    return this.saleDurationPopover.getByText(option, { exact: true });
  }

  /**
   * 정렬 옵션 선택 후 결과 안정 대기
   */
  async selectSortOption(option: EventWinningSortOption): Promise<void> {
    await this.openSortPopover();
    await this.getSortPopoverOption(option).click();
    await this.waitForResultStable();
  }

  // --------------------------------------------------------------------------
  // 페이지 사이즈 변경
  // --------------------------------------------------------------------------

  /**
   * 페이지 사이즈 변경 (10/20/50)
   */
  async changePageSize(size: 10 | 20 | 50): Promise<void> {
    await this.pageSizeCombobox.click();
    await this.page
      .getByRole("option", { name: `${size} / page`, exact: true })
      .click();
    await this.waitForResultStable();
  }

  /**
   * 현재 선택된 페이지 사이즈 반환
   */
  async getSelectedPageSize(): Promise<number | null> {
    const text = (await this.pageSizeCombobox.textContent()) ?? "";
    const match = text.match(/(\d+)\s*\/\s*page/i);
    if (!match?.[1]) return null;

    const size = Number(match[1]);
    return Number.isFinite(size) ? size : null;
  }

  // --------------------------------------------------------------------------
  // 상세 페이지 진입
  // --------------------------------------------------------------------------

  /**
   * 첫 행 클릭하여 상세 페이지 진입
   * URL은 /event-winning-manage/{id}?... 패턴으로 변경됨
   */
  async openDetailByFirstRow(): Promise<{ id: string; eventName: string }> {
    const id = await this.getFirstRowId();
    const eventName = await this.getFirstRowEventName();

    const beforeUrl = this.page.url();
    await this.tableRows.first().click();
    await this.page.waitForURL((u) => u.toString() !== beforeUrl, {
      timeout: 10000,
    });
    await this.page.waitForLoadState("domcontentloaded");

    return { id, eventName };
  }
}
