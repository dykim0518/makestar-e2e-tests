/**
 * 주문관리 목록 페이지 객체
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export type OrderTabKey = "all" | "b2c" | "b2b" | "project";
export type OrderStatusKey =
  | "orderStatus"
  | "paymentStatus"
  | "deliveryStatus"
  | "stockAllocationStatus";

export type OrderStatusSnapshot = {
  orderStatus: string;
  paymentStatus: string;
  deliveryStatus: string;
  stockAllocationStatus: string;
};

export type OrderResultMetrics = {
  rowCount: number;
  summaryCount: number | null;
  hasNoResultMessage: boolean;
  hasZeroSummary: boolean;
  noResultState: boolean;
};

export type PaymentMethodKey = "예치금" | "직접송금" | "신용카드" | "무통장";

export type OrderDetailPaymentInfo = {
  method: string;
  info: string;
};

/**
 * TODO(env): 상태 필터 순서가 변경되면 fallback 인덱스를 조정하세요.
 * 기준: 주문상태(0), 결제상태(1), 배송상태(2), 재고할당(4)
 */
const STATUS_FILTER_FALLBACK_INDEX: Record<OrderStatusKey, number> = {
  orderStatus: 0,
  paymentStatus: 1,
  deliveryStatus: 2,
  stockAllocationStatus: 4,
} as const;

export class OrderListPage extends AdminBasePage {
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
      name: "검색 초기화",
      exact: true,
    });
    this.resultSummary = page
      .getByText(/상품 주문내역|프로젝트별 주문내역/i)
      .first();
  }

  getPageUrl(): string {
    return `${this.baseUrl}/order/list`;
  }

  getHeadingText(): string {
    return "주문관리";
  }

  getBreadcrumbPath(): string[] {
    return ["주문/배송", "주문관리"];
  }

  async clickSearchAndWait(): Promise<void> {
    await this.page.keyboard.press("Escape").catch(() => {});
    await this.page.keyboard.press("Escape").catch(() => {});
    await this.submitSearchButton.click({ force: true });
    await this.waitForTableOrNoResult();
  }

  async clickResetButton(): Promise<void> {
    await this.page.keyboard.press("Escape").catch(() => {});
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
    ]);

    await this.page.waitForFunction(
      () => {
        const text = (document.body.innerText || "").replace(/\s+/g, " ");
        const hasNoResult = text.includes("검색결과가 없습니다");
        const hasList =
          text.includes("상품 주문내역") ||
          text.includes("프로젝트별 주문내역");
        const checkboxCount = document.querySelectorAll(
          'input[type="checkbox"]',
        ).length;
        const hasTable = document.querySelectorAll("table").length > 0;
        return hasNoResult || (hasList && (checkboxCount >= 1 || hasTable));
      },
      undefined,
      { timeout },
    );
  }

  async getRowCount(): Promise<number> {
    const totalCheckboxCount = await this.page
      .locator('input[type="checkbox"]')
      .count();
    const checkboxRowCount = Math.max(totalCheckboxCount - 1, 0);
    if (checkboxRowCount > 0) {
      return checkboxRowCount;
    }

    const tableRowCount = await this.page
      .locator("table tbody tr:visible")
      .count();
    if (tableRowCount > 0) {
      return tableRowCount;
    }

    const roleRowCount = await this.page
      .locator('[role="row"]:visible')
      .count();
    return Math.max(roleRowCount - 1, 0);
  }

  async assertTabsVisible(): Promise<void> {
    await expect(await this.resolveTab("all")).toBeVisible({
      timeout: this.timeouts.long,
    });
    await expect(await this.resolveTab("b2c")).toBeVisible({
      timeout: this.timeouts.long,
    });
    await expect(await this.resolveTab("b2b")).toBeVisible({
      timeout: this.timeouts.long,
    });
    await expect(await this.resolveTab("project")).toBeVisible({
      timeout: this.timeouts.long,
    });
  }

  async switchTab(tab: OrderTabKey): Promise<void> {
    await this.page.keyboard.press("Escape").catch(() => {});
    await this.page.keyboard.press("Escape").catch(() => {});
    const tabLocator = await this.resolveTab(tab);
    await tabLocator.scrollIntoViewIfNeeded().catch(() => {});
    await tabLocator.click({ force: true });
    await this.waitForTableOrNoResult();
  }

  async isProjectFilterVisible(): Promise<boolean> {
    const projectFilter = await this.findFirstVisible([
      this.page.getByRole("combobox", { name: /프로젝트|project/i }).first(),
      this.page.getByLabel(/프로젝트|project/i).first(),
      this.page
        .locator("p, span, div")
        .filter({ hasText: /프로젝트|project/i })
        .first(),
    ]);
    return projectFilter !== null;
  }

  async searchByKeyword(keyword: string): Promise<void> {
    const keywordInput = await this.findFirstVisible([
      this.page
        .getByRole("textbox", { name: /주문번호|주문 번호|검색어|keyword/i })
        .first(),
      this.page.getByPlaceholder(/주문번호|주문 번호|검색어|검색/i).first(),
      this.page.getByPlaceholder("주문번호를 입력해주세요").first(),
    ]);

    if (!keywordInput) {
      throw new Error(
        "키워드 검색 입력창을 찾지 못했습니다. TODO(env): 주문번호 입력창 셀렉터를 확인하세요.",
      );
    }

    await keywordInput.fill(keyword);
    await this.clickSearchAndWait();
  }

  /**
   * 상품코드로 검색 (CT-65 회귀 테스트용)
   */
  async searchByProductCode(productCode: string): Promise<void> {
    const productCodeInput =
      this.page.getByPlaceholder("상품코드를 입력해주세요");

    await expect(productCodeInput).toBeVisible({
      timeout: this.timeouts.medium,
    });
    await productCodeInput.fill(productCode);
    await this.clickSearchAndWait();
  }

  /**
   * 상품명으로 검색 (CT-65 회귀 테스트용)
   */
  async searchByProductName(productName: string): Promise<void> {
    const productNameInput =
      this.page.getByPlaceholder("상품명을 입력해주세요");

    await expect(productNameInput).toBeVisible({
      timeout: this.timeouts.medium,
    });
    await productNameInput.fill(productName);
    await this.clickSearchAndWait();
  }

  async resetFiltersAndWait(): Promise<void> {
    await this.clickResetButton();
  }

  async getFilterableStatusSnapshot(): Promise<OrderStatusSnapshot> {
    const rowText = await this.getFirstRowText();
    const orderStatus = await this.resolveStatusValue("orderStatus", rowText);
    const paymentStatus = await this.resolveStatusValue(
      "paymentStatus",
      rowText,
    );
    const deliveryStatus = await this.resolveStatusValue(
      "deliveryStatus",
      rowText,
    );
    const stockAllocationStatus = await this.resolveStatusValue(
      "stockAllocationStatus",
      rowText,
    );

    return {
      orderStatus,
      paymentStatus,
      deliveryStatus,
      stockAllocationStatus,
    };
  }

  private async resolveStatusValue(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    rowText: string,
  ): Promise<string> {
    const selectedValue = await this.getCurrentSelectedValue(key);
    if (this.isMeaningfulValue(selectedValue)) {
      return selectedValue;
    }
    return await this.pickStatusFromRowText(key, rowText);
  }

  async applyCombinedStatusFilters(
    snapshot: OrderStatusSnapshot,
  ): Promise<void> {
    await this.selectStatusOption("deliveryStatus", snapshot.deliveryStatus);
    await this.selectStatusOption(
      "stockAllocationStatus",
      snapshot.stockAllocationStatus,
    );
    await this.selectStatusOption("orderStatus", snapshot.orderStatus);
    await this.selectStatusOption("paymentStatus", snapshot.paymentStatus);
  }

  async applyFirstAvailableCombinedStatusFilters(): Promise<OrderStatusSnapshot> {
    await this.resetFiltersAndWait();

    const orderOptions = await this.getStatusOptions("orderStatus");
    const paymentOptions = await this.getStatusOptions("paymentStatus");
    const deliveryOptions = await this.getStatusOptions("deliveryStatus");
    const stockOptions = await this.getStatusOptions("stockAllocationStatus");

    const orderStatus = await this.resolveFirstStatusTarget(
      "orderStatus",
      orderOptions,
    );
    const paymentStatus = await this.resolveFirstStatusTarget(
      "paymentStatus",
      paymentOptions,
    );
    const deliveryStatus = await this.resolveFirstStatusTarget(
      "deliveryStatus",
      deliveryOptions,
    );
    const stockAllocationStatus = await this.resolveOptionalFirstStatusTarget(
      "stockAllocationStatus",
      stockOptions,
    );

    if (orderOptions.length > 0) {
      await this.selectStatusOption("orderStatus", orderStatus);
    }
    if (paymentOptions.length > 0) {
      await this.selectStatusOption("paymentStatus", paymentStatus);
    }
    if (deliveryOptions.length > 0) {
      await this.selectStatusOption("deliveryStatus", deliveryStatus);
    }
    if (
      stockOptions.length > 0 &&
      this.isMeaningfulValue(stockAllocationStatus)
    ) {
      await this.selectStatusOption(
        "stockAllocationStatus",
        stockAllocationStatus,
      );
    }

    return {
      orderStatus:
        (await this.getCurrentSelectedValue("orderStatus").catch(
          () => orderStatus,
        )) || orderStatus,
      paymentStatus:
        (await this.getCurrentSelectedValue("paymentStatus").catch(
          () => paymentStatus,
        )) || paymentStatus,
      deliveryStatus:
        (await this.getCurrentSelectedValue("deliveryStatus").catch(
          () => deliveryStatus,
        )) || deliveryStatus,
      stockAllocationStatus:
        (await this.getCurrentSelectedValue("stockAllocationStatus").catch(
          () => stockAllocationStatus,
        )) || stockAllocationStatus,
    };
  }

  async applyViableCombinedStatusFilters(
    maxCandidatesPerKey: number = 6,
  ): Promise<OrderStatusSnapshot> {
    await this.resetFiltersAndWait();

    const fallbackSnapshot: OrderStatusSnapshot = {
      orderStatus: "",
      paymentStatus: "",
      deliveryStatus: "",
      stockAllocationStatus: "",
    };
    const preferredSnapshot = await this.getFilterableStatusSnapshot().catch(
      () => fallbackSnapshot,
    );
    await this.clearAllStatusFilters();

    const orderStatus = await this.selectViableStatusForKey(
      "orderStatus",
      preferredSnapshot.orderStatus,
      maxCandidatesPerKey,
    );
    const paymentStatus = await this.selectViableStatusForKey(
      "paymentStatus",
      preferredSnapshot.paymentStatus,
      maxCandidatesPerKey,
    );
    const deliveryStatus = await this.selectViableStatusForKey(
      "deliveryStatus",
      preferredSnapshot.deliveryStatus,
      maxCandidatesPerKey,
    );
    const stockAllocationStatus = await this.selectViableStatusForKey(
      "stockAllocationStatus",
      preferredSnapshot.stockAllocationStatus,
      maxCandidatesPerKey,
    );

    return {
      orderStatus,
      paymentStatus,
      deliveryStatus,
      stockAllocationStatus,
    };
  }

  async getSelectedStatusSnapshot(): Promise<OrderStatusSnapshot> {
    const snapshot = {
      orderStatus: await this.getCurrentSelectedValue("orderStatus"),
      paymentStatus: await this.getCurrentSelectedValue("paymentStatus"),
      deliveryStatus: await this.getCurrentSelectedValue("deliveryStatus"),
      stockAllocationStatus: await this.getCurrentSelectedValue(
        "stockAllocationStatus",
      ),
    };

    expect(
      this.isMeaningfulValue(snapshot.orderStatus),
      "주문상태 필터 값이 비어 있습니다.",
    ).toBeTruthy();
    expect(
      this.isMeaningfulValue(snapshot.paymentStatus),
      "결제상태 필터 값이 비어 있습니다.",
    ).toBeTruthy();
    expect(
      this.isMeaningfulValue(snapshot.deliveryStatus),
      "배송상태 필터 값이 비어 있습니다.",
    ).toBeTruthy();
    expect(
      this.isMeaningfulValue(snapshot.stockAllocationStatus),
      "재고할당 필터 값이 비어 있습니다.",
    ).toBeTruthy();

    return snapshot;
  }

  async assertRowsMatchStatus(
    snapshot: OrderStatusSnapshot,
    sampleLimit: number = 10,
  ): Promise<void> {
    const rowTexts = await this.getRowTexts(sampleLimit);
    expect(rowTexts.length, "상태 조합 검색 결과가 없습니다.").toBeGreaterThan(
      0,
    );

    expect(
      this.isMeaningfulValue(snapshot.orderStatus),
      "주문상태 검증 값이 비어 있습니다.",
    ).toBeTruthy();
    expect(
      this.isMeaningfulValue(snapshot.paymentStatus),
      "결제상태 검증 값이 비어 있습니다.",
    ).toBeTruthy();
    expect(
      this.isMeaningfulValue(snapshot.deliveryStatus),
      "배송상태 검증 값이 비어 있습니다.",
    ).toBeTruthy();

    for (const rowText of rowTexts) {
      expect(
        this.rowContainsStatus("orderStatus", rowText, snapshot.orderStatus),
        `주문상태 불일치: 기대=${snapshot.orderStatus}, 행=${rowText}`,
      ).toBeTruthy();
      expect(
        this.rowContainsStatus(
          "paymentStatus",
          rowText,
          snapshot.paymentStatus,
        ),
        `결제상태 불일치: 기대=${snapshot.paymentStatus}, 행=${rowText}`,
      ).toBeTruthy();
      expect(
        this.rowContainsStatus(
          "deliveryStatus",
          rowText,
          snapshot.deliveryStatus,
        ),
        `배송상태 불일치: 기대=${snapshot.deliveryStatus}, 행=${rowText}`,
      ).toBeTruthy();
      if (this.isMeaningfulValue(snapshot.stockAllocationStatus)) {
        expect(
          this.rowContainsStatus(
            "stockAllocationStatus",
            rowText,
            snapshot.stockAllocationStatus,
          ),
          `재고할당 상태 불일치: 기대=${snapshot.stockAllocationStatus}, 행=${rowText}`,
        ).toBeTruthy();
      }
    }
  }

  async hasNoResultOrEmptyTable(): Promise<boolean> {
    const hasNoResult = await this.noResultMessage
      .isVisible()
      .catch(() => false);
    if (hasNoResult) {
      return true;
    }
    const rowCount = await this.getRowCount();
    return rowCount === 0;
  }

  async getSummaryTotalCount(): Promise<number | null> {
    const summaryText = this.normalize(
      await this.resultSummary.textContent().catch(() => ""),
    );
    const match = summaryText.match(/전체\s*([\d,]+)\s*건/);
    if (!match || !match[1]) {
      return null;
    }

    const parsed = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  async hasZeroSummaryCount(): Promise<boolean> {
    const count = await this.getSummaryTotalCount();
    return count === 0;
  }

  /**
   * 상태 필터 옵션 목록을 반환합니다.
   */
  async getStatusOptionsByKey(key: OrderStatusKey): Promise<string[]> {
    return await this.getStatusOptions(key);
  }

  /**
   * 현재 선택된 상태 필터 값을 반환합니다.
   */
  async getCurrentStatusValueByKey(key: OrderStatusKey): Promise<string> {
    return await this.getCurrentSelectedValue(key);
  }

  /**
   * 지정한 상태 필터 값을 선택합니다.
   */
  async selectStatusOptionByValue(
    key: OrderStatusKey,
    value: string,
  ): Promise<string> {
    await this.selectStatusOption(key, value);
    const selected = await this.getCurrentSelectedValue(key).catch(() => "");
    return this.isMeaningfulValue(selected) ? selected : this.normalize(value);
  }

  /**
   * 지정한 상태 필터의 첫 번째 유효 옵션을 선택합니다.
   * preferDifferentFrom이 있으면 가능한 경우 다른 옵션을 우선 선택합니다.
   */
  async selectFirstStatusOption(
    key: OrderStatusKey,
    preferDifferentFrom: string = "",
  ): Promise<string> {
    const options = await this.getStatusOptions(key);
    expect(options.length, `${key} 상태 옵션이 없습니다.`).toBeGreaterThan(0);

    let selectedTarget = options[0];
    if (this.isMeaningfulValue(preferDifferentFrom)) {
      const differentOption = options.find(
        (option) => !this.isStatusEquivalent(key, option, preferDifferentFrom),
      );
      if (differentOption) {
        selectedTarget = differentOption;
      }
    }

    await this.selectStatusOption(key, selectedTarget);
    const selected = await this.getCurrentSelectedValue(key).catch(() => "");
    return this.isMeaningfulValue(selected) ? selected : selectedTarget;
  }

  /**
   * 기준값과 다른 상태 옵션 1개를 반환합니다.
   */
  async getDifferentStatusOption(
    key: OrderStatusKey,
    baseValue: string,
  ): Promise<string | null> {
    const options = await this.getStatusOptions(key);
    const different = options.find(
      (option) => !this.isStatusEquivalent(key, option, baseValue),
    );
    return different ?? null;
  }

  /**
   * 일부 상태 필터 조합으로 결과 행을 검증합니다.
   */
  async assertRowsMatchPartialStatus(
    filters: Partial<Record<OrderStatusKey, string>>,
    sampleLimit: number = 10,
  ): Promise<void> {
    const rowTexts = await this.getRowTexts(sampleLimit);
    expect(rowTexts.length, "필터 검색 결과가 없습니다.").toBeGreaterThan(0);

    for (const rowText of rowTexts) {
      const pairs = Object.entries(filters) as Array<[OrderStatusKey, string]>;
      for (const [key, value] of pairs) {
        if (!this.isMeaningfulValue(value)) {
          continue;
        }
        expect(
          this.rowContainsStatus(key, rowText, value),
          `${key} 불일치: 기대=${value}, 행=${rowText}`,
        ).toBeTruthy();
      }
    }
  }

  /**
   * 검색 결과가 없는 상태인지 확인합니다.
   */
  async hasNoResultState(): Promise<boolean> {
    const hasNoResultMessage = await this.noResultMessage
      .isVisible()
      .catch(() => false);
    if (hasNoResultMessage) {
      return true;
    }

    const rowCount = await this.getRowCount();
    const hasZeroSummary = await this.hasZeroSummaryCount();
    return rowCount === 0 && hasZeroSummary;
  }

  /**
   * 결과 영역의 핵심 메트릭(row/summary/no-result)을 반환합니다.
   */
  async getResultMetrics(): Promise<OrderResultMetrics> {
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
   * 페이지당 표시 개수를 반환합니다. (기본값: 10)
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
    const enabled = await this.nextPageButton.isEnabled().catch(() => false);
    return enabled;
  }

  /**
   * 다음 페이지로 이동합니다. (짧은 timeout + 강제 클릭)
   */
  async goToNextPageSafely(): Promise<boolean> {
    const canMove = await this.canGoToNextPage();
    if (!canMove) {
      return false;
    }

    await this.nextPageButton.click({
      force: true,
      timeout: this.timeouts.medium,
    });
    await this.waitForTableOrNoResult(15000);
    return true;
  }

  /**
   * 이전 페이지로 이동합니다. (짧은 timeout + 강제 클릭)
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

    await this.previousPageButton.click({
      force: true,
      timeout: this.timeouts.medium,
    });
    await this.waitForTableOrNoResult(15000);
    return true;
  }

  /**
   * 현재 페이지 첫 번째 행 식별 텍스트를 반환합니다.
   */
  async getFirstRowFingerprint(): Promise<string> {
    const rows = await this.getRowTexts(1);
    return rows[0] ?? "";
  }

  private async pickStatusFromRowText(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    rowText: string,
  ): Promise<string> {
    const options = await this.getStatusOptions(key);
    const normalizedRow = this.normalize(rowText);
    const matched = options.find((option) =>
      normalizedRow.includes(this.normalize(option)),
    );

    if (matched) {
      return matched;
    }

    if (options.length > 0) {
      return options[0];
    }

    const inferred = this.inferStatusByKeyword(key, normalizedRow);
    if (this.isMeaningfulValue(inferred)) {
      return inferred;
    }

    const selectedValue = await this.getCurrentSelectedValue(key);
    if (this.isMeaningfulValue(selectedValue)) {
      return selectedValue;
    }

    throw new Error(`행 데이터와 매칭되는 상태 옵션을 찾지 못했습니다: ${key}`);
  }

  private async getStatusOptions(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
  ): Promise<string[]> {
    const fallbackIndex = STATUS_FILTER_FALLBACK_INDEX[key];
    const trigger = await this.findStatusFilterTrigger(
      this.getStatusLabelRegex(key),
      fallbackIndex,
    );

    if (!trigger) {
      throw new Error(`상태 필터를 찾지 못했습니다: ${key}`);
    }

    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    await trigger.click({ force: true });

    const optionCandidates =
      await this.collectVisibleStatusOptionTexts(trigger);

    await this.page.keyboard.press("Escape").catch(() => {});
    return optionCandidates;
  }

  private async getCurrentSelectedValue(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
  ): Promise<string> {
    const fallbackIndex = STATUS_FILTER_FALLBACK_INDEX[key];
    const trigger = await this.findStatusFilterTrigger(
      this.getStatusLabelRegex(key),
      fallbackIndex,
    );
    if (!trigger) {
      throw new Error(`선택된 상태 값을 읽을 수 없습니다: ${key}`);
    }

    const selectedValue = await trigger
      .evaluate((el) => {
        const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
        const container = el as HTMLElement;
        const listbox = container.querySelector('[role="listbox"]');

        const walker = document.createTreeWalker(
          container,
          NodeFilter.SHOW_TEXT,
        );
        const tokens: string[] = [];

        while (walker.nextNode()) {
          const node = walker.currentNode as Text;
          const parent = node.parentElement;
          if (!parent) continue;
          if (listbox && listbox.contains(parent)) continue;

          const token = normalize(node.textContent || "");
          if (!token) continue;
          if (/^-?searchbox$/i.test(token)) continue;
          tokens.push(token);
        }

        const meaningful = tokens.filter((token) => !/^선택$/i.test(token));
        return meaningful[0] || "";
      })
      .catch(() => "");

    return this.normalize(selectedValue);
  }

  private async selectStatusOption(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    optionText: string,
  ): Promise<void> {
    if (!this.isMeaningfulValue(optionText)) {
      throw new Error(
        `의미 없는 상태값으로 필터를 적용할 수 없습니다: ${key}=${optionText}`,
      );
    }

    const fallbackIndex = STATUS_FILTER_FALLBACK_INDEX[key];
    const trigger = await this.findStatusFilterTrigger(
      this.getStatusLabelRegex(key),
      fallbackIndex,
    );

    if (!trigger) {
      throw new Error(`상태 필터를 찾지 못했습니다: ${key}`);
    }

    await trigger.scrollIntoViewIfNeeded().catch(() => {});
    await trigger.click({ force: true });

    const currentText = this.normalize(
      await trigger.textContent().catch(() => ""),
    );
    if (this.isStatusEquivalent(key, currentText, optionText)) {
      await this.page.keyboard.press("Escape").catch(() => {});
      return;
    }

    const visibleOptions = await this.collectVisibleStatusOptionTexts(trigger);
    const resolvedOptionText = this.resolveStatusOptionText(
      key,
      optionText,
      visibleOptions,
    );
    if (!this.isMeaningfulValue(resolvedOptionText)) {
      await this.page.keyboard.press("Escape").catch(() => {});
      throw new Error(`상태 옵션 목록이 비어 있습니다: ${key}`);
    }

    const option = await this.findFirstVisible([
      trigger
        .locator('[role="option"]:visible, li[role="option"]:visible')
        .filter({ hasText: resolvedOptionText })
        .first(),
      trigger
        .locator(".multiselect__option:visible")
        .filter({ hasText: resolvedOptionText })
        .first(),
      this.page
        .getByRole("option", {
          name: new RegExp(`^${this.escapeRegExp(resolvedOptionText)}$`),
        })
        .first(),
      this.page
        .getByRole("option", {
          name: new RegExp(this.escapeRegExp(resolvedOptionText)),
        })
        .first(),
      this.page
        .locator(".multiselect__option:visible")
        .filter({ hasText: resolvedOptionText })
        .first(),
      this.page
        .locator('[role="option"]:visible, li[role="option"]:visible')
        .filter({ hasText: resolvedOptionText })
        .first(),
    ]);

    if (option) {
      await option.scrollIntoViewIfNeeded().catch(() => {});
      const clickedByLocator = await option
        .click({ force: true })
        .then(() => true)
        .catch(() => false);
      if (!clickedByLocator) {
        const handle = await option
          .elementHandle({ timeout: this.timeouts.short })
          .catch(() => null);
        if (handle) {
          await handle.evaluate((el) => {
            (el as HTMLElement).click();
          });
          await handle.dispose().catch(() => {});
        }
      }

      const selectedByClick = await this.waitForStatusSelection(
        key,
        trigger,
        resolvedOptionText,
      );
      if (selectedByClick) {
        await this.page.keyboard.press("Escape").catch(() => {});
        return;
      }
    }

    // 우선순위 2: combobox 내부 searchbox에 값 입력 후 Enter
    const searchInput = await this.findFirstVisible([
      trigger.locator("input").first(),
      this.page.locator('input[placeholder="선택"]:visible').first(),
      this.page.locator('input[role="textbox"]:visible').first(),
    ]);

    if (searchInput) {
      await searchInput.fill(resolvedOptionText).catch(() => {});
      await searchInput.press("Enter").catch(() => {});

      const selectedByInput = await this.waitForStatusSelection(
        key,
        trigger,
        resolvedOptionText,
      );

      if (selectedByInput) {
        await this.page.keyboard.press("Escape").catch(() => {});
        return;
      }
    }

    const fallbackOptionText = this.resolveFallbackStatusOption(
      visibleOptions,
      resolvedOptionText,
    );
    if (this.isMeaningfulValue(fallbackOptionText)) {
      const fallbackOption = await this.findFirstVisible([
        trigger
          .locator('[role="option"]:visible, li[role="option"]:visible')
          .filter({ hasText: fallbackOptionText })
          .first(),
        trigger
          .locator(".multiselect__option:visible")
          .filter({ hasText: fallbackOptionText })
          .first(),
        this.page
          .getByRole("option", {
            name: new RegExp(`^${this.escapeRegExp(fallbackOptionText)}$`),
          })
          .first(),
        this.page
          .locator(".multiselect__option:visible")
          .filter({ hasText: fallbackOptionText })
          .first(),
      ]);
      if (fallbackOption) {
        await fallbackOption.click({ force: true }).catch(() => {});
        const selectedFallback = await this.waitForStatusSelection(
          key,
          trigger,
          fallbackOptionText,
        );
        if (selectedFallback) {
          await this.page.keyboard.press("Escape").catch(() => {});
          return;
        }
      }
    }

    await trigger.click({ force: true }).catch(() => {});
    const firstMeaningfulOption = await this.findFirstVisible([
      this.page
        .locator(
          '.multiselect__option:visible, [role="option"]:visible, li[role="option"]:visible',
        )
        .filter({ hasNotText: /^선택$/ })
        .first(),
    ]);
    if (firstMeaningfulOption) {
      await firstMeaningfulOption.click({ force: true }).catch(() => {});
      const selectedAnyMeaningful =
        await this.waitForAnyMeaningfulStatusSelection(key);
      if (selectedAnyMeaningful) {
        await this.page.keyboard.press("Escape").catch(() => {});
        return;
      }
    }

    await this.page.keyboard.press("Escape").catch(() => {});
    throw new Error(
      `상태 옵션을 찾지 못했습니다: ${optionText} (resolved=${resolvedOptionText})`,
    );
  }

  private async findStatusFilterTrigger(
    labelRegex: RegExp,
    fallbackIndex: number,
  ): Promise<Locator | null> {
    return await this.findFirstVisible([
      this.page.getByRole("combobox", { name: labelRegex }).first(),
      this.page.getByLabel(labelRegex).first(),
      this.page
        .locator("p")
        .filter({ hasText: labelRegex })
        .locator("xpath=..")
        .locator('[role="combobox"]')
        .first(),
      this.page.locator('[role="combobox"]').nth(fallbackIndex),
    ]);
  }

  private getStatusLabelRegex(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
  ): RegExp {
    switch (key) {
      case "orderStatus":
        return /주문\s*상태|order\s*status/i;
      case "paymentStatus":
        return /결제\s*상태|payment\s*status/i;
      case "deliveryStatus":
        return /배송\s*상태|delivery\s*status/i;
      case "stockAllocationStatus":
        return /재고\s*할당|할당\s*상태|allocation|stock/i;
      default:
        return /상태/i;
    }
  }

  private async getFirstRowText(): Promise<string> {
    const rowTexts = await this.getRowTexts(1);
    expect(
      rowTexts.length,
      "주문 목록 행 데이터를 찾지 못했습니다.",
    ).toBeGreaterThan(0);
    return rowTexts[0];
  }

  private async getRowTexts(limit: number = 10): Promise<string[]> {
    const checkboxBasedTexts = await this.page.evaluate((sampleLimit) => {
      const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
      const checkboxes = Array.from(
        document.querySelectorAll('input[type="checkbox"]'),
      );
      const rowTexts: string[] = [];

      for (let i = 1; i < checkboxes.length; i++) {
        const checkbox = checkboxes[i] as HTMLElement;
        let current: HTMLElement | null = checkbox;
        let captured = "";

        while (current) {
          const text = normalize(current.innerText || "");
          const ownCheckboxCount = current.querySelectorAll(
            'input[type="checkbox"]',
          ).length;
          const looksLikeHeader =
            text.includes("주문 번호") && text.includes("결제 상태");

          if (!looksLikeHeader && ownCheckboxCount === 1 && text.length > 20) {
            captured = text;
            break;
          }
          current = current.parentElement;
        }

        if (captured) {
          rowTexts.push(captured);
        }
        if (rowTexts.length >= sampleLimit) {
          break;
        }
      }

      return rowTexts;
    }, limit);

    const normalizedCheckboxTexts = checkboxBasedTexts
      .map((text) => this.normalize(text))
      .filter((text) => text.length > 20);
    if (normalizedCheckboxTexts.length > 0) {
      return normalizedCheckboxTexts;
    }

    const tableRowTexts = await this.page
      .locator("table tbody tr:visible")
      .evaluateAll((rows, sampleLimit) => {
        const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
        return rows
          .map((row) => normalize((row as HTMLElement).innerText || ""))
          .filter((text) => text.length > 20)
          .slice(0, sampleLimit as number);
      }, limit)
      .catch(() => [] as string[]);
    const normalizedTableTexts = tableRowTexts
      .map((text) => this.normalize(text))
      .filter((text) => text.length > 20);
    if (normalizedTableTexts.length > 0) {
      return normalizedTableTexts;
    }

    const roleRowTexts = await this.page
      .locator('[role="row"]:visible')
      .evaluateAll((rows, sampleLimit) => {
        const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
        const texts: string[] = [];
        for (let i = 1; i < rows.length; i++) {
          const text = normalize((rows[i] as HTMLElement).innerText || "");
          if (text.length > 20) {
            texts.push(text);
          }
          if (texts.length >= (sampleLimit as number)) {
            break;
          }
        }
        return texts;
      }, limit)
      .catch(() => [] as string[]);

    return roleRowTexts
      .map((text) => this.normalize(text))
      .filter((text) => text.length > 20);
  }

  private async resolveTab(tab: OrderTabKey): Promise<Locator> {
    const labels = this.getTabLabels(tab);
    for (const label of labels) {
      const byText = this.page.getByText(label, { exact: true }).first();
      if ((await byText.count()) > 0) {
        return byText;
      }
    }
    throw new Error(
      `탭을 찾지 못했습니다: ${tab} (tried: ${labels.join(", ")})`,
    );
  }

  private getTabLabels(tab: OrderTabKey): string[] {
    switch (tab) {
      case "all":
        return ["전체"];
      case "b2c":
        return ["B2C주문", "B2C 주문"];
      case "b2b":
        return ["B2B주문", "B2B 주문"];
      case "project":
        return ["프로젝트별 주문", "프로젝트별주문"];
      default:
        return ["전체"];
    }
  }

  private getTabLabel(tab: OrderTabKey): string {
    return this.getTabLabels(tab)[0];
  }

  private normalize(value: string): string {
    return value.replace(/\s+/g, " ").trim();
  }

  private normalizeLoose(value: string): string {
    return this.normalize(value)
      .replace(/[\s/()_\-]/g, "")
      .toLowerCase();
  }

  private isMeaningfulValue(value: string): boolean {
    const normalized = this.normalize(value);
    if (normalized.length === 0) return false;
    if (normalized === "-" || normalized === "--") return false;
    if (/^선택$|^선택안함$|^전체$|^all$/i.test(normalized)) return false;
    return true;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private inferStatusByKeyword(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    rowText: string,
  ): string {
    const candidatesByKey: Record<
      keyof typeof STATUS_FILTER_FALLBACK_INDEX,
      string[]
    > = {
      orderStatus: [
        "결제완료",
        "입금확인",
        "주문접수",
        "주문취소",
        "환불완료",
        "결제실패",
      ],
      paymentStatus: [
        "결제성공",
        "결제실패",
        "결제대기",
        "입금대기",
        "환불완료",
      ],
      deliveryStatus: [
        "배송전",
        "배송준비",
        "배송요청",
        "배송중",
        "배송완료",
        "출고확정",
      ],
      stockAllocationStatus: [
        "미처리",
        "할당완료",
        "부분할당",
        "할당실패",
        "재고부족",
      ],
    };

    const candidates = candidatesByKey[key] || [];
    return candidates.find((candidate) => rowText.includes(candidate)) || "";
  }

  private async collectVisibleStatusOptionTexts(
    scope?: Locator,
  ): Promise<string[]> {
    const root = scope ?? this.page.locator("body");
    const scopedOptionCandidates = await root
      .locator(
        '.multiselect__option:visible, [role="option"]:visible, li[role="option"]:visible',
      )
      .allTextContents();
    const scopedCleaned = scopedOptionCandidates
      .map((option) => this.normalize(option))
      .filter((option) => this.isMeaningfulValue(option))
      .filter((option) => !/선택|전체|all/i.test(option));
    if (scopedCleaned.length > 0 || !scope) {
      return Array.from(new Set(scopedCleaned));
    }

    const fallbackOptionCandidates = await this.page
      .locator(
        '.multiselect__option:visible, [role="option"]:visible, li[role="option"]:visible',
      )
      .allTextContents();
    const fallbackCleaned = fallbackOptionCandidates
      .map((option) => this.normalize(option))
      .filter((option) => this.isMeaningfulValue(option))
      .filter((option) => !/선택|전체|all/i.test(option));

    return Array.from(new Set(fallbackCleaned));
  }

  private getStatusAliasGroups(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
  ): string[][] {
    if (key === "paymentStatus" || key === "orderStatus") {
      return [
        ["결제완료", "결제성공"],
        ["입금완료", "입금확인"],
      ];
    }
    if (key === "deliveryStatus") {
      return [["배송준비", "발송준비중"]];
    }
    if (key === "stockAllocationStatus") {
      return [["할당완료", "재고할당완료"]];
    }
    return [];
  }

  private isStatusEquivalent(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    left: string,
    right: string,
  ): boolean {
    const leftNormalized = this.normalize(left);
    const rightNormalized = this.normalize(right);
    if (
      !this.isMeaningfulValue(leftNormalized) ||
      !this.isMeaningfulValue(rightNormalized)
    ) {
      return false;
    }
    if (leftNormalized === rightNormalized) {
      return true;
    }

    const leftLoose = this.normalizeLoose(leftNormalized);
    const rightLoose = this.normalizeLoose(rightNormalized);
    if (leftLoose === rightLoose) {
      return true;
    }

    const aliasGroups = this.getStatusAliasGroups(key).map((group) =>
      group.map((label) => this.normalizeLoose(label)),
    );
    return aliasGroups.some(
      (group) => group.includes(leftLoose) && group.includes(rightLoose),
    );
  }

  private resolveStatusOptionText(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    requestedOption: string,
    visibleOptions: string[],
  ): string {
    const normalizedRequest = this.normalize(requestedOption);
    if (!this.isMeaningfulValue(normalizedRequest)) {
      return "";
    }

    const semanticMatch = visibleOptions.find((option) =>
      this.isStatusEquivalent(key, option, normalizedRequest),
    );
    if (semanticMatch) {
      return semanticMatch;
    }

    const requestLoose = this.normalizeLoose(normalizedRequest);
    const partialMatch = visibleOptions.find((option) => {
      const optionLoose = this.normalizeLoose(option);
      return (
        optionLoose.includes(requestLoose) || requestLoose.includes(optionLoose)
      );
    });
    if (partialMatch) {
      return partialMatch;
    }

    const inferred = this.inferStatusByKeyword(key, normalizedRequest);
    const inferredMatch = visibleOptions.find((option) =>
      this.isStatusEquivalent(key, option, inferred),
    );
    if (inferredMatch) {
      return inferredMatch;
    }

    return visibleOptions[0] || "";
  }

  private resolveFallbackStatusOption(
    visibleOptions: string[],
    preferredOption: string,
  ): string {
    if (!visibleOptions.length) return "";
    const preferredIndex = visibleOptions.findIndex(
      (option) =>
        this.normalizeLoose(option) === this.normalizeLoose(preferredOption),
    );
    if (preferredIndex >= 0 && preferredIndex < visibleOptions.length - 1) {
      return visibleOptions[preferredIndex + 1];
    }
    return visibleOptions[0];
  }

  private async waitForStatusSelection(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    trigger: Locator,
    expectedOption: string,
  ): Promise<boolean> {
    const isVisibleOnTrigger = await trigger
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
    if (!isVisibleOnTrigger) return false;

    try {
      await expect
        .poll(
          async () => {
            const selectedText = this.normalize(
              await trigger.textContent().catch(() => ""),
            );
            if (this.isStatusEquivalent(key, selectedText, expectedOption)) {
              return true;
            }
            const currentValue = await this.getCurrentSelectedValue(key).catch(
              () => "",
            );
            return this.isStatusEquivalent(key, currentValue, expectedOption);
          },
          { timeout: this.timeouts.short },
        )
        .toBe(true);
      return true;
    } catch {
      return false;
    }
  }

  private async waitForAnyMeaningfulStatusSelection(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
  ): Promise<boolean> {
    try {
      await expect
        .poll(
          async () => {
            const currentValue = await this.getCurrentSelectedValue(key).catch(
              () => "",
            );
            return this.isMeaningfulValue(currentValue);
          },
          { timeout: this.timeouts.short },
        )
        .toBe(true);
      return true;
    } catch {
      return false;
    }
  }

  private rowContainsStatus(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    rowText: string,
    expectedStatus: string,
  ): boolean {
    const normalizedRow = this.normalize(rowText);
    const expectedNormalized = this.normalize(expectedStatus);

    if (!this.isMeaningfulValue(expectedNormalized)) {
      return false;
    }
    if (normalizedRow.includes(expectedNormalized)) {
      return true;
    }

    const aliases = this.getStatusAliasGroups(key);
    for (const group of aliases) {
      const groupHasExpected = group.some((alias) =>
        this.isStatusEquivalent(key, alias, expectedNormalized),
      );
      if (!groupHasExpected) {
        continue;
      }
      if (
        group.some((alias) => normalizedRow.includes(this.normalize(alias)))
      ) {
        return true;
      }
    }

    return false;
  }

  private async selectViableStatusForKey(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    preferredOption: string,
    maxCandidatesPerKey: number,
  ): Promise<string> {
    const options = await this.getStatusOptions(key);
    const candidates = Array.from(
      new Set(
        [preferredOption, ...options]
          .map((value) => this.normalize(value))
          .filter((value) => this.isMeaningfulValue(value)),
      ),
    ).slice(0, maxCandidatesPerKey);

    expect(
      candidates.length,
      `적용 가능한 상태 옵션이 없습니다: ${key}`,
    ).toBeGreaterThan(0);

    for (const candidate of candidates) {
      await this.selectStatusOption(key, candidate);
      await this.clickSearchAndWait();

      const rowCount = await this.getRowCount();
      if (rowCount > 0) {
        const currentValue = await this.getCurrentSelectedValue(key).catch(
          () => candidate,
        );
        return this.isMeaningfulValue(currentValue) ? currentValue : candidate;
      }
    }

    throw new Error(
      `유효한 검색 결과를 만드는 상태 옵션을 찾지 못했습니다: ${key}`,
    );
  }

  private async resolveFirstStatusTarget(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    options: string[],
  ): Promise<string> {
    if (options.length > 0) {
      return options[0];
    }

    const currentValue = await this.getCurrentSelectedValue(key).catch(
      () => "",
    );
    if (this.isMeaningfulValue(currentValue)) {
      return currentValue;
    }

    throw new Error(`${key} 필터에 적용 가능한 상태값이 없습니다.`);
  }

  private async resolveOptionalFirstStatusTarget(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
    options: string[],
  ): Promise<string> {
    if (options.length > 0) {
      return options[0];
    }

    const currentValue = await this.getCurrentSelectedValue(key).catch(
      () => "",
    );
    return this.isMeaningfulValue(currentValue) ? currentValue : "";
  }

  private async clearAllStatusFilters(): Promise<void> {
    const keys: Array<keyof typeof STATUS_FILTER_FALLBACK_INDEX> = [
      "orderStatus",
      "paymentStatus",
      "deliveryStatus",
      "stockAllocationStatus",
    ];

    for (const key of keys) {
      await this.clearStatusFilter(key);
    }
    await this.clickSearchAndWait();
  }

  private async clearStatusFilter(
    key: keyof typeof STATUS_FILTER_FALLBACK_INDEX,
  ): Promise<void> {
    const fallbackIndex = STATUS_FILTER_FALLBACK_INDEX[key];
    const trigger = await this.findStatusFilterTrigger(
      this.getStatusLabelRegex(key),
      fallbackIndex,
    );
    if (!trigger) {
      throw new Error(`상태 필터를 초기화할 수 없습니다: ${key}`);
    }

    const currentValue = await this.getCurrentSelectedValue(key).catch(
      () => "",
    );
    if (!this.isMeaningfulValue(currentValue)) {
      return;
    }

    await trigger.click({ force: true });
    const defaultOption = await this.findFirstVisible([
      this.page.getByRole("option", { name: /^\s*선택\s*$/ }).first(),
      this.page
        .locator('.multiselect__option:visible, [role="option"]:visible')
        .filter({ hasText: /^\s*선택\s*$/ })
        .first(),
    ]);

    if (defaultOption) {
      await defaultOption.click({ force: true }).catch(() => {});
    } else {
      const searchInput = await this.findFirstVisible([
        trigger.locator("input").first(),
        this.page.locator('input[placeholder="선택"]:visible').first(),
      ]);
      if (searchInput) {
        await searchInput.fill("").catch(() => {});
      }
    }

    await this.page.keyboard.press("Escape").catch(() => {});
    await this.getCurrentSelectedValue(key).catch(() => "");
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

  // --------------------------------------------------------------------------
  // QA-102 회귀: B2B 예치금 결제수단 검증 헬퍼
  // --------------------------------------------------------------------------

  /**
   * B2B 주문 목록의 결제수단 드롭다운 필터를 펼친 뒤, 지정한 결제수단
   * 옵션을 선택하고 [조회하기]를 눌러 결과를 갱신합니다.
   *
   * 사용자 확정 UI 플로우:
   *   1) "결제수단" 드롭다운 트리거 클릭 → 옵션 패널 펼침
   *   2) 패널 내부 "예치금" 텍스트의 부모 컨테이너에 있는
   *      `input[type=checkbox]`를 직접 클릭 (텍스트 클릭으로는 토글되지 않음)
   *   3) [조회하기] 버튼 클릭
   *   4) 결과 안정화 대기
   *
   * STG에서 라벨 nextElementSibling 클릭/MouseEvent dispatch 방식은
   * 모두 미오픈으로 폐기되었으며, "텍스트 leaf → 부모 컨테이너의 체크박스
   * direct click" 패턴은 QA102-FLT-02 / QA100-DATA-01 에서 검증됨.
   *
   * spec에서 1회 호출을 전제로 작성되었으며, 멱등성을 위한 토글 감지는
   * 수행하지 않습니다.
   *
   * @param method - 적용할 결제수단 옵션 (예: "예치금")
   */
  async applyPaymentMethodFilter(method: PaymentMethodKey): Promise<void> {
    // 드롭다운 트리거 노출 대기
    const trigger = this.page.getByText("결제수단", { exact: false }).first();
    await expect(
      trigger,
      "결제수단 드롭다운 트리거가 노출되어야 합니다",
    ).toBeVisible({ timeout: this.timeouts.long });

    // 1) 드롭다운 펼치기: 라벨 클릭으로 옵션 패널이 펼쳐지길 기다린다.
    //    옵션 패널은 동일 라벨("예치금" 등 옵션 텍스트)이 leaf로 노출되는 시점.
    await trigger.click({ force: true });

    const optionLeaf = this.page.getByText(method, { exact: true }).first();
    await expect(
      optionLeaf,
      `결제수단 드롭다운에서 '${method}' 옵션이 노출되어야 합니다`,
    ).toBeVisible({ timeout: this.timeouts.long });

    // 2) 옵션 텍스트 leaf의 가장 가까운 체크박스 컨테이너를 찾아 input 직접 클릭.
    //    텍스트 클릭만으로는 체크박스가 토글되지 않는 STG 동작 회피.
    const checked = await this.page.evaluate((label) => {
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>("*"),
      ).filter(
        (n) =>
          n.children.length === 0 &&
          (n.textContent || "").trim() === label &&
          n.offsetParent !== null,
      );
      for (const node of candidates) {
        let parent: Element | null = node.parentElement;
        for (let depth = 0; depth < 4 && parent; depth += 1) {
          const cb = parent.querySelector(
            'input[type="checkbox"]',
          ) as HTMLInputElement | null;
          if (cb) {
            cb.click();
            return cb.checked;
          }
          parent = parent.parentElement;
        }
      }
      return null;
    }, method);

    if (checked !== true) {
      throw new Error(
        `결제수단 '${method}' 체크박스를 선택하지 못했습니다. ` +
          `evaluate 결과=${checked}`,
      );
    }

    // 드롭다운 닫기 (다른 요소를 가리지 않도록)
    await this.page.keyboard.press("Escape").catch(() => {});

    // 3) [조회하기] 버튼 클릭 → 결과 갱신
    await this.submitSearchButton.click({ force: true });

    // 4) 결과 안정화 대기
    await this.waitForTableOrNoResult();
    await this.waitForNetworkStable(this.timeouts.long).catch(() => {});
  }

  /**
   * 목록에서 결제수단 컬럼이 지정된 값과 일치하는 첫 번째 행을 클릭하여
   * 주문상세 팝업을 엽니다.
   *
   * `nth(1)` 같은 위치 의존 인덱스를 사용하지 않고, 결제수단 셀 텍스트
   * 매칭을 통해 직접 찾아 클릭합니다.
   *
   * @param method - 클릭할 행의 결제수단 값 (예: "예치금")
   */
  async openOrderDetailByPaymentMethod(
    method: PaymentMethodKey,
  ): Promise<void> {
    await expect(
      this.resultSummary,
      "주문 목록이 렌더링되어야 합니다",
    ).toBeVisible({ timeout: this.timeouts.long });

    // 결과 행이 렌더링될 때까지 대기 (최소 1개의 row checkbox)
    await this.page
      .waitForFunction(
        () => {
          const checkboxes = document.querySelectorAll(
            'input[type="checkbox"]',
          );
          // 헤더 체크박스 1개 + 본문 체크박스 N개 = 2개 이상이면 행 데이터 로딩됨
          return checkboxes.length >= 2;
        },
        undefined,
        { timeout: this.timeouts.long },
      )
      .catch(() => {});

    // 결제수단 라벨 텍스트와 일치하는 leaf 노드를 찾고, 가장 가까운 cursor:pointer
    // 조상(=클릭 가능한 행)을 클릭한다. 헤더/필터 영역 잡힘 방지를 위해 자체 행
    // 체크박스 정확히 1개 보유를 함께 요구한다.
    const clicked = await this.page.evaluate(
      ({ label }) => {
        const candidates = Array.from(
          document.querySelectorAll<HTMLElement>("*"),
        ).filter(
          (n) =>
            n.children.length === 0 &&
            (n.textContent || "").trim() === label &&
            n.offsetParent !== null,
        );

        for (const cellNode of candidates) {
          let row: HTMLElement | null = cellNode.parentElement;
          for (let depth = 0; depth < 12 && row; depth += 1) {
            const style = window.getComputedStyle(row);
            const hasPointerCursor = style.cursor === "pointer";
            const checkboxes = row.querySelectorAll('input[type="checkbox"]');
            // 본문 행 패턴: cursor:pointer + 자체 체크박스 정확히 1개
            if (hasPointerCursor && checkboxes.length === 1) {
              row.scrollIntoView({ block: "center" });
              row.click();
              return true;
            }
            row = row.parentElement;
          }
        }
        return false;
      },
      { label: method },
    );

    if (!clicked) {
      const diag = await this.page.evaluate(
        ({ label }) => {
          const matches = Array.from(
            document.querySelectorAll<HTMLElement>("*"),
          ).filter(
            (n) =>
              n.children.length === 0 && (n.textContent || "").trim() === label,
          );
          return {
            totalLeafMatches: matches.length,
            visibleMatches: matches.filter((n) => n.offsetParent !== null)
              .length,
          };
        },
        { label: method },
      );

      throw new Error(
        `목록에서 결제수단 '${method}' 행을 찾지 못했습니다. ` +
          `leaf 매칭 수=${diag.totalLeafMatches}, visible=${diag.visibleMatches}.`,
      );
    }

    // 주문상세 팝업 노출 대기
    await expect(
      this.page.getByText("주문상세정보", { exact: false }).first(),
      "주문상세정보 팝업이 노출되어야 합니다",
    ).toBeVisible({ timeout: this.timeouts.long });
  }

  /**
   * 주문상세 팝업 내 '결제수단' 및 '결제수단 정보' 필드 값을 추출합니다.
   *
   * `dt`/`dd` 또는 label/value 형제 구조를 우선 시도하고, 보조로
   * 공통 정의 패턴(라벨 텍스트 + 동일 컨테이너 텍스트)을 이용합니다.
   * 필터 영역의 '선택' placeholder 값은 결과에서 제외합니다.
   */
  async getOrderDetailPaymentInfo(): Promise<OrderDetailPaymentInfo> {
    const dialogScope = await this.findFirstVisible([
      this.page.getByRole("dialog").first(),
      this.page
        .locator(
          '[role="dialog"], .ant-modal, [class*="Modal"], [class*="modal"]',
        )
        .first(),
    ]);

    const scope: Page | Locator = dialogScope ?? this.page;

    const tryReadByLabel = async (label: string): Promise<string> => {
      const labelLocator =
        scope === this.page
          ? this.page.getByText(label, { exact: true })
          : (scope as Locator).getByText(label, { exact: true });

      const count = await labelLocator.count().catch(() => 0);
      for (let i = 0; i < count; i += 1) {
        const node = labelLocator.nth(i);
        if (
          !(await node
            .isVisible({ timeout: this.timeouts.short })
            .catch(() => false))
        ) {
          continue;
        }
        const value = await node
          .evaluate((el, lbl) => {
            const normalize = (text: string) =>
              text.replace(/\s+/g, " ").trim();

            // dt > dd 형제 패턴
            if (el.tagName.toLowerCase() === "dt") {
              const dd = el.nextElementSibling;
              if (dd && dd.tagName.toLowerCase() === "dd") {
                return normalize(dd.textContent || "");
              }
            }

            // 동일 row 안에서 라벨 다음 형제
            const sibling = el.nextElementSibling;
            if (sibling) {
              const text = normalize(sibling.textContent || "");
              if (text && text !== lbl) {
                return text;
              }
            }

            // 부모(row) 텍스트에서 라벨 제거
            const parent = el.parentElement;
            if (parent) {
              const parentText = normalize(parent.textContent || "");
              const without = parentText
                .replace(new RegExp(`^${lbl}\\s*`), "")
                .replace(new RegExp(`\\s*${lbl}\\s*`), " ")
                .trim();
              if (without && without !== lbl) {
                return without;
              }
            }

            return "";
          }, label)
          .catch(() => "");

        const cleaned = this.normalize(value);
        // '선택' placeholder만 제외하고, '-' 등 placeholder가 아닌 실제 값은 그대로 반환.
        // 빈 값/라벨 자기 자신은 다음 후보 시도.
        if (cleaned.length > 0 && cleaned !== "선택" && cleaned !== label) {
          return cleaned;
        }
      }
      return "";
    };

    const method = await tryReadByLabel("결제수단");
    const info = await tryReadByLabel("결제수단 정보");

    return { method, info };
  }
}
