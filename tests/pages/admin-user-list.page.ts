/**
 * 회원관리 목록 페이지 객체
 *
 * URL: /user/list
 *
 * 탭:
 * - B2C회원관리 / B2B회원관리
 *
 * 검색 필터:
 * - 키워드 검색 (placeholder="검색어를 입력해주세요")
 * - 회원상태 셀렉트 (placeholder="선택")
 * - 가입서비스 필터 버튼 (메이크스타, 포카앨범, VOTE, 스트림위드, 포카DB, 캘린돌)
 * - 가입일 날짜 범위 필터
 *
 * 테이블 컬럼:
 * [체크박스] | 상태 | E-mail | 유저코드 | 닉네임 | 이름 | 가입서비스 | 연동계정 | 국적 | 가입일
 *
 * 액션:
 * - 업체 생성하기 버튼
 * - 엑셀다운받기 버튼
 * - 행 클릭 → /user/{id} 상세 페이지 이동
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

// ============================================================================
// 타입 정의
// ============================================================================

export type UserResultMetrics = {
  rowCount: number;
  summaryCount: number | null;
  hasNoResultMessage: boolean;
  noResultState: boolean;
};

// ============================================================================
// 상수
// ============================================================================

export const USER_TABLE_HEADERS = [
  "상태",
  "E-mail",
  "유저코드",
  "닉네임",
  "이름",
  "가입서비스",
  "연동계정",
  "국적",
  "가입일",
] as const;

export const USER_SERVICE_FILTERS = [
  "메이크스타",
  "포카앨범",
  "VOTE",
  "스트림위드",
  "포카DB",
  "캘린돌",
] as const;

// ============================================================================
// UserListPage 클래스
// ============================================================================

export class UserListPage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 로케이터
  // --------------------------------------------------------------------------

  /** 키워드 검색 입력 필드 */
  readonly keywordInput: Locator;

  /** 상태 필터 셀렉트 */
  readonly statusFilter: Locator;

  /** 조회하기 버튼 */
  readonly submitSearchButton: Locator;

  /** 검색 초기화 버튼 */
  readonly searchResetButton: Locator;

  /** 엑셀다운받기 버튼 */
  readonly excelDownloadButton: Locator;

  /** 업체 생성하기 버튼 */
  readonly createCompanyButton: Locator;

  /** 페이지당 표시 개수 셀렉트 */
  readonly perPageSelect: Locator;

  /** 결과 요약 (회원 목록 n건 등) */
  readonly resultSummary: Locator;

  /** B2C회원관리 탭 */
  readonly b2cTab: Locator;

  /** B2B회원관리 탭 */
  readonly b2bTab: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    this.keywordInput = page.getByPlaceholder("검색어를 입력해주세요");
    this.statusFilter = page.locator(".multiselect").first();
    this.submitSearchButton = page.getByRole("button", {
      name: "조회하기",
      exact: true,
    });
    this.searchResetButton = page.getByRole("button", {
      name: "검색 초기화",
      exact: true,
    });
    this.excelDownloadButton = page.getByRole("button", {
      name: "엑셀다운받기",
    });
    this.createCompanyButton = page.getByRole("button", {
      name: "업체 생성하기",
    });
    this.perPageSelect = page.locator("text=10 / page").first();
    this.resultSummary = page.getByText(/회원\s*목록|총\s*\d+/i).first();

    // 탭 로케이터
    this.b2cTab = page
      .getByRole("tab", { name: "B2C회원관리" })
      .or(
        page.locator(
          'a:has-text("B2C회원관리"), button:has-text("B2C회원관리")',
        ),
      );
    this.b2bTab = page
      .getByRole("tab", { name: "B2B회원관리" })
      .or(
        page.locator(
          'a:has-text("B2B회원관리"), button:has-text("B2B회원관리")',
        ),
      );
  }

  // --------------------------------------------------------------------------
  // 추상 메서드 구현
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/user/list`;
  }

  getHeadingText(): string {
    return "회원 관리";
  }

  getBreadcrumbPath(): string[] {
    return ["고객관리", "회원관리"];
  }

  // --------------------------------------------------------------------------
  // 탭 기능
  // --------------------------------------------------------------------------

  /**
   * 탭 전환 (B2C회원관리 또는 B2B회원관리)
   */
  async selectTab(tabName: "B2C회원관리" | "B2B회원관리"): Promise<void> {
    const tab = tabName === "B2C회원관리" ? this.b2cTab : this.b2bTab;
    await tab.first().click();
    await this.page.waitForLoadState("networkidle").catch(() => {});
    await this.waitForTableOrNoResult();
  }

  /**
   * 현재 활성 탭 이름 반환
   */
  async getActiveTabName(): Promise<string> {
    // 활성 탭: aria-selected="true", 또는 특정 CSS 클래스
    for (const tabName of ["B2C회원관리", "B2B회원관리"] as const) {
      const tab = tabName === "B2C회원관리" ? this.b2cTab : this.b2bTab;
      const first = tab.first();
      if (!(await first.isVisible().catch(() => false))) continue;

      const ariaSelected = await first.getAttribute("aria-selected");
      if (ariaSelected === "true") return tabName;

      const className = (await first.getAttribute("class")) || "";
      if (
        className.includes("active") ||
        className.includes("selected") ||
        className.includes("text-white") ||
        className.includes("bg-primary")
      ) {
        return tabName;
      }
    }
    return "";
  }

  /**
   * 탭 존재 여부 확인
   */
  async hasTabNavigation(): Promise<boolean> {
    const b2cVisible = await this.b2cTab
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const b2bVisible = await this.b2bTab
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    return b2cVisible && b2bVisible;
  }

  // --------------------------------------------------------------------------
  // 검색 모드 전환
  // --------------------------------------------------------------------------

  /**
   * 검색 영역이 렌더링되었는지 확인
   */
  async isSearchAreaVisible(): Promise<boolean> {
    return await this.keywordInput
      .isVisible({ timeout: 3000 })
      .catch(() => false);
  }

  /**
   * 확장 검색 모드가 활성화되었는지 확인
   * (회원상태 셀렉트가 보이면 확장 모드)
   */
  async isExtendedSearchMode(): Promise<boolean> {
    return await this.statusFilter
      .isVisible({ timeout: 2000 })
      .catch(() => false);
  }

  /**
   * 검색 영역 확장 (간단하게 검색 → 자세하게 검색 토글)
   * @returns 확장 성공 여부
   */
  async expandSearchMode(): Promise<boolean> {
    // 1. 먼저 검색 영역 자체가 렌더링될 때까지 대기
    const searchVisible = await this.isSearchAreaVisible();
    if (!searchVisible) {
      await this.keywordInput
        .waitFor({ state: "visible", timeout: this.timeouts.medium })
        .catch(() => {});
    }

    // 2. 이미 확장 모드인지 확인
    if (await this.isExtendedSearchMode()) return true;

    // 3. "자세하게 검색" 토글 버튼 클릭
    const expandButton = this.page
      .getByText("자세하게 검색")
      .or(this.page.locator('button:has-text("자세하게")'))
      .or(this.page.locator('span:has-text("자세하게")'));

    if (
      await expandButton
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await expandButton.first().click();
      await this.statusFilter
        .waitFor({ state: "visible", timeout: this.timeouts.medium })
        .catch(() => {});
    }

    return await this.isExtendedSearchMode();
  }

  // --------------------------------------------------------------------------
  // 필터 기능
  // --------------------------------------------------------------------------

  /**
   * 회원상태 셀렉트 필터 클릭 후 첫 번째 옵션 선택
   * (확장 검색 모드에서만 사용 가능)
   */
  async selectFirstStatusOption(): Promise<string> {
    await this.expandSearchMode();

    const isVisible = await this.statusFilter
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!isVisible) return "";

    await this.statusFilter.click();
    // 드롭다운 옵션 대기
    const option = this.page.locator(".multiselect__option").first();
    await option.waitFor({ state: "visible", timeout: this.timeouts.medium });
    const optionText = (await option.textContent())?.trim() || "";
    await option.click();
    // 드롭다운 닫기
    await this.page.keyboard.press("Escape").catch(() => {});
    return optionText;
  }

  /**
   * 가입서비스 필터 버튼 클릭
   * (확장 검색 모드에서만 사용 가능)
   */
  async clickServiceFilter(serviceName: string): Promise<void> {
    await this.expandSearchMode();

    const button = this.page
      .getByRole("button", { name: serviceName, exact: true })
      .or(this.page.locator(`button:has-text("${serviceName}")`));
    await button.first().click();
  }

  /**
   * 가입서비스 필터 버튼 존재 여부 확인
   */
  async hasServiceFilterButtons(): Promise<boolean> {
    await this.expandSearchMode();
    const firstService = this.page
      .getByRole("button", { name: "메이크스타", exact: true })
      .or(this.page.locator('button:has-text("메이크스타")'));
    return await firstService
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);
  }

  /**
   * 특정 행의 체크박스 로케이터 반환
   */
  getRowCheckbox(rowIndex: number): Locator {
    return this.tableRows.nth(rowIndex).locator('input[type="checkbox"]');
  }

  /**
   * 특정 열의 모든 행 텍스트 배열 반환
   */
  async getColumnTexts(columnIndex: number): Promise<string[]> {
    const rowCount = await this.getRowCount();
    const texts: string[] = [];
    for (let i = 0; i < rowCount; i++) {
      const text = await this.getCellText(i, columnIndex);
      texts.push(text.trim());
    }
    return texts;
  }

  /**
   * 특정 행의 주요 데이터(이메일, 유저코드, 닉네임, 이름) 반환
   */
  async getRowData(rowIndex = 0): Promise<{
    rowIndex: number;
    status: string;
    email: string;
    userCode: string;
    nickname: string;
    name: string;
  }> {
    return {
      rowIndex,
      status: (await this.getCellText(rowIndex, 1)).trim(),
      email: (await this.getCellText(rowIndex, 2)).trim(),
      userCode: (await this.getCellText(rowIndex, 3)).trim(),
      nickname: (await this.getCellText(rowIndex, 4)).trim(),
      name: (await this.getCellText(rowIndex, 5)).trim(),
    };
  }

  /**
   * 첫 행의 주요 데이터 반환 (하위호환)
   */
  async getFirstRowData() {
    return this.getRowData(0);
  }

  /**
   * 프로필이 완성된 회원(닉네임+이름 모두 존재)을 목록에서 찾아 반환.
   * 없으면 첫 행 반환 + hasCompleteProfile: false
   */
  async findRowWithCompleteProfile(maxScan = 10): Promise<
    Awaited<ReturnType<typeof this.getRowData>> & {
      hasCompleteProfile: boolean;
    }
  > {
    const metrics = await this.getResultMetrics();
    const rows = Math.min(metrics.rowCount, maxScan);

    for (let i = 0; i < rows; i++) {
      const data = await this.getRowData(i);
      if (
        this.isMeaningfulValue(data.nickname) &&
        this.isMeaningfulValue(data.name)
      ) {
        return { ...data, hasCompleteProfile: true };
      }
    }

    // 완성 회원 없으면 첫 행 반환
    const first = await this.getRowData(0);
    return { ...first, hasCompleteProfile: false };
  }

  // --------------------------------------------------------------------------
  // 검색 기능
  // --------------------------------------------------------------------------

  /**
   * 키워드 검색 실행
   */
  async searchByKeyword(keyword: string): Promise<void> {
    await this.keywordInput.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
    await this.keywordInput.fill(keyword);
    await this.clickSearchAndWait();
  }

  /**
   * 조회하기 버튼 클릭 후 데이터 로드 대기
   */
  async clickSearchAndWait(): Promise<void> {
    await this.page.keyboard.press("Escape").catch(() => {});

    // 클릭 전 첫 행 텍스트를 캡처하여 데이터 변경 감지에 활용
    const prevFirstRow = await this.getFirstRow()
      .textContent()
      .catch(() => "");

    await this.submitSearchButton.click({ force: true });

    // 테이블 데이터가 갱신되거나 no-result가 표시될 때까지 대기
    await this.waitForTableOrNoResult();

    // 추가: 데이터 갱신 안정화 대기
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  /**
   * 검색 초기화 후 데이터 로드 대기
   */
  async resetFiltersAndWait(): Promise<void> {
    await this.page.keyboard.press("Escape").catch(() => {});

    if (
      await this.searchResetButton
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false)
    ) {
      const enabled = await this.searchResetButton
        .isEnabled()
        .catch(() => false);
      if (enabled) {
        await this.searchResetButton.click({ force: true });
      }
    }
    await this.waitForTableOrNoResult();
  }

  /**
   * 테이블 또는 검색결과 없음 메시지 대기
   */
  async waitForTableOrNoResult(
    timeout: number = this.timeouts.navigation,
  ): Promise<void> {
    await Promise.race([
      this.tableRows
        .first()
        .waitFor({ state: "visible", timeout })
        .catch(() => null),
      this.noResultMessage
        .waitFor({ state: "visible", timeout })
        .catch(() => null),
    ]);

    await this.page.waitForFunction(
      () => {
        const text = (document.body.innerText || "").replace(/\s+/g, " ");
        const hasNoResult = text.includes("검색결과가 없습니다");
        const rows = document.querySelectorAll("table tbody tr");
        // 스켈레톤 로딩이 아닌 실제 데이터가 있는 행 확인
        const hasRealData =
          rows.length > 0 &&
          Array.from(rows).some((row) => {
            const tds = row.querySelectorAll("td");
            return (
              tds.length > 2 && (tds[1]?.textContent?.trim().length ?? 0) > 0
            );
          });
        return hasNoResult || hasRealData;
      },
      undefined,
      { timeout },
    );
  }

  /**
   * 현재 키워드 입력값 반환
   */
  async getCurrentKeywordValue(): Promise<string> {
    return (await this.keywordInput.inputValue()).trim();
  }

  // --------------------------------------------------------------------------
  // 결과 메트릭
  // --------------------------------------------------------------------------

  /**
   * 검색 결과 메트릭 반환
   */
  async getResultMetrics(): Promise<UserResultMetrics> {
    const rowCount = await this.getRowCount();
    const hasNoResultMessage = await this.noResultMessage
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    const noResultState = rowCount === 0 || hasNoResultMessage;

    // 결과 요약에서 건수 추출 (예: "회원 목록 (123건)", "총 123")
    let summaryCount: number | null = null;
    const summaryVisible = await this.resultSummary
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (summaryVisible) {
      const summaryText = (await this.resultSummary.textContent()) || "";
      const match = summaryText.match(/(\d[\d,]*)\s*건?/);
      if (match?.[1]) {
        summaryCount = parseInt(match[1].replace(/,/g, ""), 10);
      }
    }

    return { rowCount, summaryCount, hasNoResultMessage, noResultState };
  }

  // --------------------------------------------------------------------------
  // 페이지네이션
  // --------------------------------------------------------------------------

  /**
   * 다음 페이지 이동 가능 여부
   */
  async canGoToNextPage(): Promise<boolean> {
    const isVisible = await this.nextPageButton.isVisible().catch(() => false);
    if (!isVisible) return false;
    return await this.nextPageButton.isEnabled().catch(() => false);
  }

  /**
   * 안전한 다음 페이지 이동
   */
  async goToNextPageSafely(): Promise<boolean> {
    const canGo = await this.canGoToNextPage();
    if (!canGo) return false;
    return await this.goToNextPage();
  }

  /**
   * 안전한 이전 페이지 이동
   */
  async goToPreviousPageSafely(): Promise<boolean> {
    const isEnabled = await this.previousPageButton
      .isEnabled()
      .catch(() => false);
    if (!isEnabled) return false;
    return await this.goToPreviousPage();
  }

  /**
   * 현재 페이지 번호 반환
   * (활성 버튼 스타일 또는 URL 파라미터에서 추출)
   */
  async getCurrentPageNumber(): Promise<number> {
    // 1. 페이지네이션 nav 내 활성 버튼 찾기
    //    활성 버튼은 disabled 상태이거나, aria-current, 또는 특수 스타일(bg-primary 등)
    const pageButtons = this.paginationNav.locator("button");
    const count = await pageButtons.count();

    for (let i = 0; i < count; i++) {
      const btn = pageButtons.nth(i);
      const text = (await btn.textContent())?.trim() || "";
      const num = parseInt(text, 10);
      if (isNaN(num)) continue;

      // 활성 버튼: aria-current, disabled 속성, 또는 배경색이 다른 버튼
      const ariaCurrent = await btn.getAttribute("aria-current");
      if (ariaCurrent === "page") return num;

      // 클래스명으로 활성 상태 감지
      const className = (await btn.getAttribute("class")) || "";
      if (
        className.includes("active") ||
        className.includes("bg-primary") ||
        className.includes("bg-blue") ||
        className.includes("text-white")
      ) {
        return num;
      }
    }

    // 2. URL 파라미터에서 페이지 번호 추출
    const url = this.page.url();
    const urlMatch = url.match(/[?&]page=(\d+)/);
    if (urlMatch?.[1]) {
      return parseInt(urlMatch[1], 10);
    }

    return 1;
  }

  /**
   * 첫 행 지문(fingerprint) 반환
   */
  async getFirstRowFingerprint(): Promise<string> {
    const firstRow = this.getFirstRow();
    if (await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
      return (await firstRow.textContent()) || "";
    }
    return "";
  }

  /**
   * 페이지당 표시 제한 반환
   */
  async getPerPageLimit(defaultLimit: number = 10): Promise<number> {
    try {
      const text = await this.perPageSelect.textContent();
      const match = text?.match(/(\d+)\s*\/\s*page/);
      if (match?.[1]) return parseInt(match[1], 10);
    } catch {
      // 기본값 사용
    }
    return defaultLimit;
  }

  // --------------------------------------------------------------------------
  // 상세 페이지 이동
  // --------------------------------------------------------------------------

  /**
   * 특정 행 클릭하여 상세 페이지로 이동
   * @param rowIndex 클릭할 행 인덱스 (기본 0 = 첫 행)
   * @returns 상세 페이지 URL
   */
  async clickRowAndNavigate(rowIndex = 0): Promise<string> {
    const row = this.table.locator("tbody tr").nth(rowIndex);
    // 두 번째 셀 클릭 (첫 번째는 체크박스)
    const cell = row.locator("td").nth(1);
    await cell.click();
    await this.waitForLoadState("domcontentloaded");
    await this.page.waitForLoadState("networkidle").catch(() => {});
    return this.page.url();
  }

  /**
   * 첫 번째 행 클릭하여 상세 페이지로 이동 (하위호환)
   */
  async clickFirstRowAndNavigate(): Promise<string> {
    return this.clickRowAndNavigate(0);
  }

  // --------------------------------------------------------------------------
  // Assertions
  // --------------------------------------------------------------------------

  /**
   * 테이블 헤더 컬럼 검증
   */
  async assertUserTableHeaders(): Promise<void> {
    await this.assertTableHeaders([...USER_TABLE_HEADERS]);
  }

  /**
   * 검색 영역 노출 검증
   */
  async assertSearchAreaVisible(): Promise<void> {
    await expect(this.keywordInput).toBeVisible({
      timeout: this.timeouts.medium,
    });
    await expect(this.submitSearchButton).toBeVisible({
      timeout: this.timeouts.medium,
    });
    await expect(this.searchResetButton).toBeVisible({
      timeout: this.timeouts.medium,
    });
  }

  /**
   * 액션 버튼 노출 검증
   */
  async assertActionButtonsVisible(): Promise<void> {
    await expect(this.excelDownloadButton).toBeVisible({
      timeout: this.timeouts.medium,
    });
  }
}
