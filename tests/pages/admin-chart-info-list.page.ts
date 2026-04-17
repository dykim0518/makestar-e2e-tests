/**
 * 차트 집계 목록 페이지 객체
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export type ChartResultMetrics = {
  rowCount: number;
  summaryCount: number | null;
  hasNoResultMessage: boolean;
  hasZeroSummary: boolean;
  noResultState: boolean;
};

export class ChartInfoListPage extends AdminBasePage {
  readonly submitSearchButton: Locator;
  readonly searchResetButton: Locator;
  readonly resultSummary: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    this.submitSearchButton = page.getByRole("button", {
      name: "조회하기",
      exact: true,
    });
    this.searchResetButton = page.getByRole("button", {
      name: /검색\s*초기화/i,
    });
    this.resultSummary = page
      .getByText(/전체\s*[\d,]+\s*건|차트\s*집계/i)
      .first();
  }

  getPageUrl(): string {
    return `${this.baseUrl}/chart-info/list`;
  }

  getHeadingText(): string {
    return "차트 집계/관리";
  }

  getBreadcrumbPath(): string[] {
    return ["상품관리", "차트 집계/관리"];
  }

  /**
   * 조회 버튼을 클릭하고 결과 영역이 안정화될 때까지 대기합니다.
   */
  async clickSearchAndWait(): Promise<void> {
    await this.clickWithRecovery(this.submitSearchButton, {
      escapeCount: 2,
      timeout: this.timeouts.medium,
    });
    await this.waitForTableOrNoResult();
  }

  /**
   * 검색 조건을 초기화하고 결과 영역이 안정화될 때까지 대기합니다.
   */
  async resetFiltersAndWait(): Promise<void> {
    const canReset = await this.searchResetButton
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
    if (canReset) {
      const enabled = await this.searchResetButton
        .isEnabled()
        .catch(() => false);
      if (enabled) {
        await this.clickWithRecovery(this.searchResetButton, {
          escapeCount: 2,
          timeout: this.timeouts.medium,
        });
      }
    }

    await this.waitForTableOrNoResult();
  }

  /**
   * 목록/요약/no-result 중 하나가 보일 때까지 대기합니다.
   */
  async waitForTableOrNoResult(
    timeout: number = this.timeouts.navigation,
  ): Promise<void> {
    await Promise.race([
      this.resultSummary
        .waitFor({ state: "visible", timeout })
        .catch(() => null),
      this.noResultMessage
        .waitFor({ state: "visible", timeout })
        .catch(() => null),
      this.page
        .locator("table tbody tr:visible")
        .first()
        .waitFor({ state: "visible", timeout })
        .catch(() => null),
    ]);

    await this.waitForContentStable("main", {
      timeout: Math.min(timeout, this.timeouts.long),
      stableTime: 300,
    }).catch(() => {});

    await this.page.waitForFunction(
      () => {
        const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
        const text = (document.body.innerText || "").replace(/\s+/g, " ");
        const hasNoResult = text.includes("검색결과가 없습니다");
        const hasSummary = /전체\s*[\d,]+\s*건/.test(text);
        const hasHeading = /차트\s*집계/.test(text);

        const tableRows = Array.from(
          document.querySelectorAll("table tbody tr"),
        );
        const meaningfulTableRowCount = tableRows.filter((row) => {
          const rowText = normalize((row as HTMLElement).innerText || "");
          return rowText.length > 0 && !rowText.includes("검색결과가 없습니다");
        }).length;

        const chartNodeCount = document.querySelectorAll(
          'canvas, svg, [class*="chart"], [class*="Chart"]',
        ).length;
        return (
          hasHeading &&
          (hasNoResult ||
            hasSummary ||
            meaningfulTableRowCount > 0 ||
            chartNodeCount > 0)
        );
      },
      undefined,
      { timeout },
    );
  }

  /**
   * 현재 검색 결과의 행 개수를 반환합니다.
   */
  async getRowCount(): Promise<number> {
    const tableRowCount = await this.page
      .locator("table tbody tr:visible")
      .evaluateAll((rows) => {
        const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
        return rows.filter((row) => {
          const text = normalize((row as HTMLElement).innerText || "");
          return text.length > 0 && !text.includes("검색결과가 없습니다");
        }).length;
      })
      .catch(() => 0);
    if (tableRowCount > 0) {
      return tableRowCount;
    }

    const roleRowCount = await this.page
      .locator('[role="row"]:visible')
      .evaluateAll((rows) => {
        const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
        let count = 0;
        for (let i = 1; i < rows.length; i += 1) {
          const text = normalize((rows[i] as HTMLElement).innerText || "");
          if (text.length > 0 && !text.includes("검색결과가 없습니다")) {
            count += 1;
          }
        }
        return count;
      })
      .catch(() => 0);
    return roleRowCount;
  }

  /**
   * no-result/요약/행 수 메트릭을 통합 반환합니다.
   */
  async getResultMetrics(): Promise<ChartResultMetrics> {
    const rowCount = await this.getRowCount();
    const summaryCount = await this.getSummaryTotalCount();
    const hasNoResultMessage = await this.noResultMessage
      .isVisible()
      .catch(() => false);
    const hasZeroSummary = summaryCount === 0;
    const noResultState =
      hasNoResultMessage || (rowCount === 0 && hasZeroSummary);

    return {
      rowCount,
      summaryCount,
      hasNoResultMessage,
      hasZeroSummary,
      noResultState,
    };
  }

  /**
   * 결과 요약의 전체 건수를 추출합니다.
   */
  async getSummaryTotalCount(): Promise<number | null> {
    const summaryText = this.normalize(
      await this.page
        .locator("main")
        .innerText()
        .catch(() => ""),
    );
    const match = summaryText.match(/전체\s*([\d,]+)\s*건/);
    if (!match || !match[1]) {
      return null;
    }

    const parsed = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  /**
   * 페이지당 표시 개수를 반환합니다.
   */
  async getPerPageLimit(defaultLimit: number = 10): Promise<number> {
    const perPageText = await this.page
      .locator("text=/\\d+\\s*\\/\\s*page/i")
      .first()
      .textContent()
      .catch(() => "");
    const normalized = this.normalize(perPageText || "");
    const match = normalized.match(/(\d+)\s*\/\s*page/i);
    if (!match || !match[1]) {
      return defaultLimit;
    }

    const parsed = Number(match[1]);
    return Number.isFinite(parsed) ? parsed : defaultLimit;
  }

  /**
   * 다음 페이지 이동 가능 여부를 반환합니다.
   */
  async canGoToNextPage(): Promise<boolean> {
    const visible = await this.nextPageButton.isVisible().catch(() => false);
    if (!visible) {
      return false;
    }
    return await this.nextPageButton.isEnabled().catch(() => false);
  }

  /**
   * 안전하게 다음 페이지로 이동합니다.
   */
  async goToNextPageSafely(): Promise<boolean> {
    const canMove = await this.canGoToNextPage();
    if (!canMove) {
      return false;
    }

    await this.clickWithRecovery(this.nextPageButton, {
      escapeCount: 1,
      timeout: this.timeouts.medium,
    });
    await this.waitForTableOrNoResult(15000);
    return true;
  }

  /**
   * 안전하게 이전 페이지로 이동합니다.
   */
  async goToPreviousPageSafely(): Promise<boolean> {
    const visible = await this.previousPageButton
      .isVisible()
      .catch(() => false);
    if (!visible) {
      return false;
    }
    const enabled = await this.previousPageButton
      .isEnabled()
      .catch(() => false);
    if (!enabled) {
      return false;
    }

    await this.clickWithRecovery(this.previousPageButton, {
      escapeCount: 1,
      timeout: this.timeouts.medium,
    });
    await this.waitForTableOrNoResult(15000);
    return true;
  }

  /**
   * 첫 행 식별 문자열을 반환합니다.
   */
  async getFirstRowFingerprint(): Promise<string> {
    const rows = await this.getRowTexts(1);
    return rows[0] ?? "";
  }

  /**
   * 현재 페이지 번호를 추정해서 반환합니다.
   */
  async getCurrentPageNumber(defaultPage: number = 1): Promise<number> {
    const urlPage = await this.page
      .evaluate(() => {
        try {
          const url = new URL(window.location.href);
          const pageParam = Number(url.searchParams.get("page") || "");
          return Number.isFinite(pageParam) && pageParam > 0 ? pageParam : null;
        } catch {
          return null;
        }
      })
      .catch(() => null as number | null);
    if (typeof urlPage === "number") {
      return urlPage;
    }

    const navPage = await this.page
      .evaluate(() => {
        const nav = document.querySelector('nav[aria-label="Pagination"]');
        if (!nav) {
          return null;
        }

        const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
        const parseNumber = (value: string): number | null => {
          const parsed = Number(value);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        };

        const ariaCurrent = nav.querySelector(
          '[aria-current="page"]',
        ) as HTMLElement | null;
        if (ariaCurrent) {
          return parseNumber(
            normalize(ariaCurrent.innerText || ariaCurrent.textContent || ""),
          );
        }

        const active = nav.querySelector(
          '.active, .selected, [data-active="true"]',
        ) as HTMLElement | null;
        if (active) {
          return parseNumber(
            normalize(active.innerText || active.textContent || ""),
          );
        }

        return null;
      })
      .catch(() => null as number | null);

    return typeof navPage === "number" ? navPage : defaultPage;
  }

  /**
   * 키워드 검색 입력창 존재 여부를 반환합니다.
   */
  async hasKeywordInput(): Promise<boolean> {
    const input = await this.resolveKeywordInput();
    return input !== null;
  }

  /**
   * 키워드 입력값을 설정하고 조회합니다.
   */
  async searchByKeyword(keyword: string): Promise<void> {
    await this.setKeyword(keyword);
    await this.clickSearchAndWait();
  }

  /**
   * 키워드 입력값을 설정합니다.
   */
  async setKeyword(keyword: string): Promise<void> {
    const keywordInput = await this.resolveKeywordInput();
    if (!keywordInput) {
      throw new Error("차트 집계 검색 키워드 입력창을 찾지 못했습니다.");
    }
    await keywordInput.fill(keyword);
  }

  /**
   * 현재 키워드 입력값을 반환합니다.
   */
  async getCurrentKeywordValue(): Promise<string> {
    const keywordInput = await this.resolveKeywordInput();
    if (!keywordInput) {
      throw new Error("차트 집계 검색 키워드 입력창을 찾지 못했습니다.");
    }

    const value = await keywordInput
      .evaluate((el) => {
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement
        ) {
          return el.value || "";
        }
        return (el as HTMLElement).innerText || el.textContent || "";
      })
      .catch(() => "");

    return this.normalize(value);
  }

  private async resolveKeywordInput(): Promise<Locator | null> {
    return await this.findFirstVisible([
      this.page
        .getByRole("textbox", {
          name: /검색어|키워드|차트|아티스트|상품명|코드|id/i,
        })
        .first(),
      this.page
        .getByPlaceholder(/검색어|키워드|차트|아티스트|상품명|코드|id/i)
        .first(),
      this.page.locator('main input[type="text"]:visible').first(),
    ]);
  }

  private async getRowTexts(limit: number = 10): Promise<string[]> {
    const tableRowTexts = await this.page
      .locator("table tbody tr:visible")
      .evaluateAll((rows, sampleLimit) => {
        const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
        return rows
          .map((row) => normalize((row as HTMLElement).innerText || ""))
          .filter(
            (text) => text.length > 0 && !text.includes("검색결과가 없습니다"),
          )
          .slice(0, sampleLimit as number);
      }, limit)
      .catch(() => [] as string[]);

    return tableRowTexts
      .map((text) => this.normalize(text))
      .filter((text) => text.length > 0);
  }

  private normalize(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }

  private async findFirstVisible(
    candidates: Locator[],
  ): Promise<Locator | null> {
    for (const candidate of candidates) {
      try {
        const target = candidate.first();
        if (await target.isVisible({ timeout: this.timeouts.short })) {
          return target;
        }
      } catch {
        // ignore
      }
    }
    return null;
  }
}
