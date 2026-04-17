/**
 * AdminPage - Admin 관리자 페이지 기본 클래스
 *
 * 이 클래스는 Admin 사이트의 공통 기능을 제공합니다.
 */

import { Page, Locator, expect } from "@playwright/test";
import { BasePage, DEFAULT_TIMEOUTS, TimeoutConfig } from "./base.page";

// ============================================================================
// 타입 정의
// ============================================================================

/** 검색 조건 타입 */
export type SearchCriteria = {
  field: string;
  value: string;
};

/** 테이블 행 데이터 타입 */
export type TableRowData = {
  [key: string]: string;
};

/** 페이지네이션 정보 */
export type PaginationInfo = {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

/** 결과 메트릭스 (주문 spec 표준 패턴) */
export type ResultMetrics = {
  rowCount: number;
  hasNoResultMessage: boolean;
  noResultState: boolean;
};

// ============================================================================
// Admin 타임아웃 설정
// ============================================================================

export const ADMIN_TIMEOUTS: TimeoutConfig = {
  micro: 500,
  short: 2000,
  medium: 5000,
  long: 10000,
  navigation: 30000,
  test: 90000,
} as const;

// ============================================================================
// Admin 공통 셀렉터
// ============================================================================

export const ADMIN_SELECTORS = {
  table: "table",
  tableRows: "table tbody tr",
  tableHeaders: "table thead th",
  noResultMessage: ':text("검색결과가 없습니다")',
  pagination: {
    nav: 'nav[aria-label="Pagination"]',
    // Next/Previous 버튼은 Pagination nav 바깥에 위치함
    previousButton: 'button:has-text("Previous")',
    nextButton: 'button:has-text("Next")',
    pageButton: (num: number) =>
      `nav[aria-label="Pagination"] button:has-text("${num}")`,
    perPageSelect: ':text("10 / page")',
  },
  breadcrumb: 'nav[aria-label="Breadcrumb"]',
  resetButton: 'button:has-text("검색 초기화"), button:has-text("초기화")',
  checkbox: 'input[type="checkbox"]',
} as const;

// ============================================================================
// AdminBasePage 클래스
// ============================================================================

export abstract class AdminBasePage extends BasePage {
  readonly baseUrl = "https://stage-new-admin.makeuni2026.com";

  // --------------------------------------------------------------------------
  // 공통 로케이터
  // --------------------------------------------------------------------------

  readonly table: Locator;
  readonly tableRows: Locator;
  readonly tableHeaders: Locator;
  readonly noResultMessage: Locator;
  readonly searchButton: Locator;
  readonly resetButton: Locator;
  readonly breadcrumb: Locator;
  readonly paginationNav: Locator;
  readonly nextPageButton: Locator;
  readonly previousPageButton: Locator;

  constructor(page: Page, timeouts: TimeoutConfig = ADMIN_TIMEOUTS) {
    super(page, timeouts);

    // 테이블 관련 로케이터
    this.table = page.locator(ADMIN_SELECTORS.table);
    this.tableRows = page.locator(ADMIN_SELECTORS.tableRows);
    this.tableHeaders = page.locator(ADMIN_SELECTORS.tableHeaders);
    this.noResultMessage = page.locator(ADMIN_SELECTORS.noResultMessage);

    // 검색 관련 로케이터
    this.searchButton = page
      .getByRole("button", { name: /^(조회하기|검색)$/ })
      .first();
    this.resetButton = page.locator(ADMIN_SELECTORS.resetButton);

    // 네비게이션 로케이터
    this.breadcrumb = page.locator(ADMIN_SELECTORS.breadcrumb);

    // 페이지네이션 로케이터
    this.paginationNav = page.locator(ADMIN_SELECTORS.pagination.nav);
    this.nextPageButton = page.locator(ADMIN_SELECTORS.pagination.nextButton);
    this.previousPageButton = page.locator(
      ADMIN_SELECTORS.pagination.previousButton,
    );
  }

  // --------------------------------------------------------------------------
  // 추상 메서드 (서브클래스에서 구현)
  // --------------------------------------------------------------------------

  /** 페이지 URL 반환 */
  abstract getPageUrl(): string;

  /** 페이지 헤딩 텍스트 반환 */
  abstract getHeadingText(): string;

  // --------------------------------------------------------------------------
  // 페이지 네비게이션
  // --------------------------------------------------------------------------

  /**
   * 페이지로 이동 (인증 상태 확인 포함)
   *
   * 로그인 페이지로 리다이렉트되면 대시보드를 통해 토큰 갱신을 시도합니다.
   */
  async navigate(retryCount: number = 3): Promise<void> {
    const url = this.getPageUrl();

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        await this.goto(url);
      } catch (e: unknown) {
        if (attempt < retryCount) {
          console.warn(
            `⚠️ 페이지 로드 실패 (시도 ${attempt + 1}/${retryCount + 1}) - 재시도`,
          );
          continue;
        }
        throw e;
      }

      await this.page.waitForLoadState("networkidle").catch(() => {});
      const currentUrl = this.currentUrl;

      // 로그인 페이지로 리다이렉트되었는지 확인
      if (currentUrl.includes("/login") || currentUrl.includes("/auth")) {
        if (attempt < retryCount) {
          console.warn(
            `⚠️ 로그인 페이지로 리다이렉트됨 (시도 ${attempt + 1}/${retryCount + 1})`,
          );

          // 첫 번째 시도 실패 시 대시보드로 이동하여 토큰 갱신 시도
          if (attempt === 0) {
            try {
              console.log("   → 대시보드를 통한 토큰 갱신 시도...");
              await this.page.goto(`${this.baseUrl}/dashboard`, {
                waitUntil: "domcontentloaded",
                timeout: 15000,
              });
              await this.page.waitForLoadState("networkidle").catch(() => {});

              // 대시보드에서 토큰이 갱신되었는지 확인 (localStorage)
              const lsTokens = await this.page.evaluate(() => ({
                accessToken: window.localStorage?.getItem("access_token"),
                refreshToken: window.localStorage?.getItem("refresh_token"),
              }));

              if (lsTokens.accessToken && lsTokens.refreshToken) {
                console.log("   → 토큰 갱신 성공, 대상 페이지로 재이동");
              }
            } catch (e) {
              console.warn("   → 대시보드 접근 실패:", e);
            }
          }

          continue;
        } else {
          throw new Error(
            `인증 실패: 페이지가 로그인 페이지로 리다이렉트되었습니다. (${currentUrl})`,
          );
        }
      } else {
        return;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 테이블 기능
  // --------------------------------------------------------------------------

  /**
   * 테이블 데이터 로드 대기
   */
  async waitForTableData(
    timeout: number = this.timeouts.navigation,
  ): Promise<number> {
    await this.page.waitForSelector(ADMIN_SELECTORS.tableRows, { timeout });
    return await this.tableRows.count();
  }

  /**
   * 테이블 행 개수 반환
   */
  async getRowCount(): Promise<number> {
    return await this.tableRows.count();
  }

  /**
   * 테이블 데이터 존재 여부 확인
   */
  async hasTableData(): Promise<boolean> {
    const rowCount = await this.tableRows.count();
    const hasNoResult = await this.noResultMessage
      .isVisible()
      .catch(() => false);
    return rowCount > 0 && !hasNoResult;
  }

  /**
   * 첫 번째 행 반환
   */
  getFirstRow(): Locator {
    return this.tableRows.first();
  }

  /**
   * 특정 행의 특정 열 텍스트 반환
   */
  async getCellText(rowIndex: number, columnIndex: number): Promise<string> {
    const row = this.tableRows.nth(rowIndex);
    const cell = row.locator("td").nth(columnIndex);
    return (await cell.textContent()) || "";
  }

  /**
   * 첫 번째 행 클릭 (상세 페이지 이동)
   */
  async clickFirstRow(columnIndex: number = 1): Promise<void> {
    const firstRow = this.getFirstRow();
    const cell = firstRow.locator("td").nth(columnIndex);
    await cell.click();
    await this.waitForLoadState("domcontentloaded");
  }

  // --------------------------------------------------------------------------
  // 검색 기능
  // --------------------------------------------------------------------------

  /**
   * 조회하기 버튼 클릭 후 데이터 로드 대기
   */
  async clickSearchAndWait(): Promise<void> {
    const searchTriggers = [
      this.page
        .getByRole("button", { name: /^(조회하기|검색)$/ })
        .first(),
      this.page.locator(".input__right__icons").first(),
      this.page.locator('img[cursor="pointer"]').first(),
    ];

    let clicked = false;
    for (const trigger of searchTriggers) {
      const isVisible = await trigger
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      if (!isVisible) {
        continue;
      }

      await this.clickWithRecovery(trigger, {
        timeout: this.timeouts.medium,
      });
      clicked = true;
      break;
    }

    if (!clicked) {
      throw new Error("검색 트리거를 찾지 못했습니다.");
    }

    await this.page
      .waitForLoadState("networkidle", { timeout: this.timeouts.medium })
      .catch(() => null);

    // 스켈레톤 로딩 행이 사라질 때까지 대기
    await this.page
      .waitForSelector(".animate-pulse", {
        state: "hidden",
        timeout: this.timeouts.navigation,
      })
      .catch(() => null);

    await this.waitForTableOrNoResult();
    await this.waitForLoadState("domcontentloaded");
  }

  /**
   * 검색 초기화
   */
  async clickResetButton(): Promise<void> {
    if (await this.resetButton.isEnabled()) {
      await this.resetButton.click();
      await this.waitForLoadState("domcontentloaded");
    }
  }

  // --------------------------------------------------------------------------
  // 페이지네이션 기능
  // --------------------------------------------------------------------------

  /**
   * 다음 페이지로 이동
   * 테이블 첫 번째 행의 데이터가 변경될 때까지 기다림
   */
  async goToNextPage(): Promise<boolean> {
    const isVisible = await this.nextPageButton.isVisible().catch(() => false);
    if (!isVisible) {
      console.log("ℹ️ Next 버튼이 보이지 않습니다.");
      return false;
    }

    const isEnabled = await this.nextPageButton.isEnabled().catch(() => false);
    if (!isEnabled) {
      console.log("ℹ️ Next 버튼이 비활성화되어 있습니다.");
      return false;
    }

    // 현재 첫 번째 행의 텍스트 저장
    const firstRowBefore = await this.getFirstRow()
      .textContent()
      .catch(() => "");

    await this.nextPageButton.click();

    // 테이블 데이터가 변경될 때까지 대기 (최대 10초)
    try {
      await this.page.waitForFunction(
        (prevText) => {
          const row = document.querySelector("table tbody tr");
          return row && row.textContent !== prevText;
        },
        firstRowBefore,
        { timeout: 10000 },
      );
    } catch {
      // 타임아웃 시 추가 대기
      await this.page.waitForLoadState("networkidle").catch(() => {});
    }

    return true;
  }

  /**
   * 이전 페이지로 이동
   */
  async goToPreviousPage(): Promise<boolean> {
    const isEnabled = await this.previousPageButton
      .isEnabled()
      .catch(() => false);
    if (!isEnabled) {
      console.log("ℹ️ Previous 버튼이 비활성화되어 있습니다.");
      return false;
    }

    await this.previousPageButton.click();
    await this.waitForLoadState("domcontentloaded");
    return true;
  }

  /**
   * 특정 페이지 번호로 이동
   */
  async goToPage(pageNum: number): Promise<boolean> {
    const pageButton = this.paginationNav.getByRole("button", {
      name: String(pageNum),
      exact: true,
    });
    const isVisible = await pageButton.isVisible().catch(() => false);

    if (!isVisible) {
      console.log(`ℹ️ 페이지 ${pageNum} 버튼이 없습니다.`);
      return false;
    }

    await this.paginationNav.scrollIntoViewIfNeeded();
    await this.clickWithRecovery(pageButton, {
      timeout: this.timeouts.medium,
      escapeCount: 1,
    });
    await this.waitForLoadState("domcontentloaded");
    return true;
  }

  // --------------------------------------------------------------------------
  // 체크박스 기능
  // --------------------------------------------------------------------------

  /**
   * 모든 체크박스 선택
   */
  async checkAllRows(): Promise<void> {
    const headerCheckbox = this.tableHeaders
      .locator(ADMIN_SELECTORS.checkbox)
      .first();
    if (await headerCheckbox.isVisible()) {
      await headerCheckbox.check();
    }
  }

  /**
   * 모든 체크박스 해제
   */
  async uncheckAllRows(): Promise<void> {
    const headerCheckbox = this.tableHeaders
      .locator(ADMIN_SELECTORS.checkbox)
      .first();
    if (await headerCheckbox.isVisible()) {
      await headerCheckbox.uncheck();
    }
  }

  /**
   * 특정 행 체크박스 선택
   */
  async checkRow(rowIndex: number): Promise<void> {
    const row = this.tableRows.nth(rowIndex);
    const checkbox = row.locator(ADMIN_SELECTORS.checkbox);
    await checkbox.check();
  }

  // --------------------------------------------------------------------------
  // Assertions
  // --------------------------------------------------------------------------

  /**
   * 페이지 타이틀 검증
   */
  async assertPageTitle(): Promise<void> {
    await expect(this.page).toHaveTitle(/MAKESTAR.*Admin/);
  }

  /**
   * 페이지 헤딩 검증 (h1, h2, p 태그 모두 지원)
   */
  async assertHeading(): Promise<void> {
    const headingText = this.getHeadingText();
    // h1, h2, p 태그 중 하나에서 헤딩 텍스트 찾기
    const heading = this.page
      .locator(
        `h1:has-text("${headingText}"), h2:has-text("${headingText}"), p:text("${headingText}")`,
      )
      .first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    await expect(heading).toContainText(headingText);
  }

  /**
   * 브레드크럼 경로 검증
   */
  async assertBreadcrumb(expectedPath: string[]): Promise<void> {
    await expect(this.breadcrumb).toBeVisible();
    for (const path of expectedPath) {
      await expect(this.breadcrumb).toContainText(path);
    }
  }

  /**
   * 테이블 헤더 검증
   */
  async assertTableHeaders(expectedHeaders: string[]): Promise<void> {
    for (const header of expectedHeaders) {
      await expect(this.page.locator(`th:has-text("${header}")`)).toBeVisible();
    }
  }

  /**
   * 검색 결과 없음 검증
   */
  async assertNoSearchResult(timeout: number = 10000): Promise<void> {
    await expect(this.noResultMessage).toBeVisible({ timeout });
  }

  /**
   * 페이지당 표시 개수 검증
   */
  async assertRowCountWithinLimit(maxRows: number = 10): Promise<void> {
    const rowCount = await this.getRowCount();
    expect(rowCount).toBeLessThanOrEqual(maxRows);
  }

  /**
   * 모든 체크박스 상태 검증
   */
  async assertAllCheckboxes(shouldBeChecked: boolean): Promise<void> {
    const rowCheckboxes = this.tableRows.locator(ADMIN_SELECTORS.checkbox);
    const count = await rowCheckboxes.count();

    for (let i = 0; i < count; i++) {
      if (shouldBeChecked) {
        await expect(rowCheckboxes.nth(i)).toBeChecked();
      } else {
        await expect(rowCheckboxes.nth(i)).not.toBeChecked();
      }
    }
  }

  // --------------------------------------------------------------------------
  // 표준 검증 패턴 (주문 spec 기준)
  // 서브클래스에서 오버라이드 가능
  // --------------------------------------------------------------------------

  /**
   * 테이블 또는 검색결과 없음 메시지 대기
   * 서브클래스에서 추가 조건(resultSummary 등)이 필요하면 오버라이드
   */
  async waitForTableOrNoResult(
    timeout: number = this.timeouts.navigation,
  ): Promise<void> {
    await this.page.waitForFunction(
      () => {
        const text = (document.body.innerText || "").replace(/\s+/g, " ");
        if (
          text.includes("검색결과가 없습니다") ||
          text.includes("조회된 데이터가 없습니다") ||
          text.includes("데이터가 없습니다")
        ) {
          return true;
        }

        const rows = Array.from(document.querySelectorAll("table tbody tr"));
        if (rows.length === 0) return true;

        return rows.some((row) => {
          const tds = row.querySelectorAll("td");
          if (tds.length === 0) return false;
          return Array.from(tds).some(
            (td) => (td.textContent ?? "").trim().length > 0,
          );
        });
      },
      undefined,
      { timeout },
    );
    await this.page.waitForLoadState("domcontentloaded");
  }

  /**
   * 결과 메트릭스 수집 (주문 spec 표준 패턴)
   *
   * 서브클래스에서 summaryCount 등 추가 필드가 필요하면 오버라이드하여 확장
   */
  async getResultMetrics(): Promise<ResultMetrics> {
    const rowCount = await this.getRowCount();
    const hasNoResultMessage = await this.noResultMessage
      .isVisible()
      .catch(() => false);
    const noResultState = hasNoResultMessage || rowCount === 0;

    return { rowCount, hasNoResultMessage, noResultState };
  }

  /**
   * 첫 번째 행의 텍스트 핑거프린트 (페이지 변경 감지용)
   */
  async getFirstRowFingerprint(): Promise<string> {
    const firstRow = this.getFirstRow();
    return (await firstRow.textContent().catch(() => "")) || "";
  }

  /**
   * 다음 페이지 이동 가능 여부 확인
   */
  async canGoToNextPage(): Promise<boolean> {
    const isVisible = await this.nextPageButton.isVisible().catch(() => false);
    if (!isVisible) return false;
    return await this.nextPageButton.isEnabled().catch(() => false);
  }

  /**
   * 안전한 다음 페이지 이동 (가능 여부 확인 + 데이터 변경 대기)
   */
  async goToNextPageSafely(): Promise<boolean> {
    if (!(await this.canGoToNextPage())) return false;
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
   * 현재 활성 페이지 번호 반환
   */
  async getCurrentPageNumber(): Promise<number> {
    const activeButton = this.paginationNav.locator(
      'button[aria-current="page"]',
    );
    const isVisible = await activeButton.isVisible().catch(() => false);
    if (!isVisible) return 1;
    const text = await activeButton.textContent();
    return parseInt(text || "1", 10);
  }

  /**
   * 값이 의미 있는지 확인 (빈 값, 대시, N/A 제외)
   */
  isMeaningfulValue(value: string): boolean {
    const trimmed = value.trim();
    return (
      trimmed.length > 0 &&
      trimmed !== "-" &&
      trimmed !== "—" &&
      trimmed !== "N/A"
    );
  }

  /**
   * 서버 에러(500, Server Error, Page not found) 발생 여부를 확인합니다.
   * 에러가 발견되면 expect 실패를 발생시킵니다.
   *
   * @param context - 에러 메시지에 표시할 컨텍스트 (예: "앨범 생성 후")
   */
  async assertNoServerError(context?: string): Promise<void> {
    await assertNoServerError(this.page, context);
  }
}

/**
 * 서버 에러(500 Server Error, Page not found) 발생 여부를 확인합니다.
 * POM 인스턴스 없이 page만으로 호출 가능한 standalone 버전.
 *
 * @param page - Playwright Page
 * @param context - 에러 메시지에 표시할 컨텍스트 (예: "대분류 생성 후")
 */
export async function assertNoServerError(
  page: Page,
  context?: string,
): Promise<void> {
  const label = context ? ` (${context})` : "";

  const bodyText = await page
    .locator("body")
    .textContent()
    .catch(() => "");

  const hasServerError =
    /500\s*(Internal\s*)?Server\s*Error/i.test(bodyText ?? "") ||
    /Page\s*not\s*found/i.test(bodyText ?? "");

  expect(
    hasServerError,
    `❌ 서버 에러 발생${label} — 백엔드 환경 확인 필요`,
  ).toBe(false);
}
