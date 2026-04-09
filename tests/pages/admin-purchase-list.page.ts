/**
 * 발주/입고 목록 페이지 객체
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export type PurchaseTabKey = "request" | "manage" | "inbound";

export type PurchaseAppliedFilter = {
  label: string;
  value: string;
};

export type PurchaseSearchSeed = {
  keyword: string;
  filters: PurchaseAppliedFilter[];
};

export type PurchaseResultMetrics = {
  rowCount: number;
  summaryCount: number | null;
  hasNoResultMessage: boolean;
  hasZeroSummary: boolean;
  noResultState: boolean;
};

type PurchaseFilterControl = {
  locator: Locator;
  label: string;
  kind: "select" | "custom";
};

const PURCHASE_TAB_LABELS: Record<PurchaseTabKey, string> = {
  request: "발주 요청관리",
  manage: "발주관리",
  inbound: "입고내역",
} as const;

export class PurchaseListPage extends AdminBasePage {
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
      .getByText(/전체\s*[\d,]+\s*건|발주 요청관리|발주관리|입고내역/i)
      .first();
  }

  getPageUrl(): string {
    return `${this.baseUrl}/purchase?page=1#request`;
  }

  getHeadingText(): string {
    return "발주 & 입고";
  }

  getBreadcrumbPath(): string[] {
    return ["주문/배송", "발주/입고"];
  }

  async clickSearchAndWait(): Promise<void> {
    await this.page.keyboard.press("Escape").catch(() => {});
    await this.page.keyboard.press("Escape").catch(() => {});
    await this.submitSearchButton.click({ force: true });
    await this.waitForTableOrNoResult();
  }

  async resetFiltersAndWait(): Promise<void> {
    await this.page.keyboard.press("Escape").catch(() => {});
    await this.page.keyboard.press("Escape").catch(() => {});

    const canReset = await this.searchResetButton
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
    if (canReset) {
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
        const tableRows = Array.from(
          document.querySelectorAll("table tbody tr"),
        );
        const meaningfulTableRowCount = tableRows.filter((row) => {
          const rowText = normalize((row as HTMLElement).innerText || "");
          return rowText.length > 0 && !rowText.includes("검색결과가 없습니다");
        }).length;
        const checkboxCount = document.querySelectorAll(
          'input[type="checkbox"]',
        ).length;
        return (
          hasNoResult ||
          hasSummary ||
          meaningfulTableRowCount > 0 ||
          checkboxCount > 1
        );
      },
      undefined,
      { timeout },
    );
  }

  async assertTabsVisible(): Promise<void> {
    await expect(await this.resolveTab("request")).toBeVisible({
      timeout: this.timeouts.long,
    });
    await expect(await this.resolveTab("manage")).toBeVisible({
      timeout: this.timeouts.long,
    });
    await expect(await this.resolveTab("inbound")).toBeVisible({
      timeout: this.timeouts.long,
    });
  }

  async switchTab(tab: PurchaseTabKey): Promise<void> {
    const tabLocator = await this.resolveTab(tab);
    await tabLocator.scrollIntoViewIfNeeded().catch(() => {});
    await tabLocator.click({ force: true });
    await this.waitForTableOrNoResult();
  }

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
        for (let i = 1; i < rows.length; i++) {
          const text = normalize((rows[i] as HTMLElement).innerText || "");
          if (text.length > 0 && !text.includes("검색결과가 없습니다")) {
            count += 1;
          }
        }
        return count;
      })
      .catch(() => 0);
    if (roleRowCount > 0) {
      return roleRowCount;
    }

    const tableCheckboxRowCount = await this.page
      .locator('table tbody tr:visible input[type="checkbox"]')
      .count()
      .catch(() => 0);
    return tableCheckboxRowCount;
  }

  async getResultMetrics(): Promise<PurchaseResultMetrics> {
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

  async hasNoResultOrEmptyTable(): Promise<boolean> {
    const hasNoResult = await this.noResultMessage
      .isVisible()
      .catch(() => false);
    if (hasNoResult) {
      return true;
    }

    const noResultRowCount = await this.page
      .locator("table tbody tr:visible")
      .filter({ hasText: /검색결과가 없습니다/ })
      .count()
      .catch(() => 0);
    if (noResultRowCount > 0) {
      return true;
    }

    const rowCount = await this.getRowCount();
    return rowCount === 0;
  }

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

  async hasZeroSummaryCount(): Promise<boolean> {
    const summary = await this.getSummaryTotalCount();
    return summary === 0;
  }

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

  async canGoToNextPage(): Promise<boolean> {
    const visible = await this.nextPageButton.isVisible().catch(() => false);
    if (!visible) {
      return false;
    }
    const enabled = await this.nextPageButton.isEnabled().catch(() => false);
    return enabled;
  }

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

  async getFirstRowFingerprint(): Promise<string> {
    const rows = await this.getRowTexts(1);
    return rows[0] ?? "";
  }

  async setKeyword(keyword: string): Promise<void> {
    await this.fillKeyword(keyword);
  }

  async getCurrentKeywordValue(): Promise<string> {
    const keywordInput = await this.resolveKeywordInput();
    if (!keywordInput) {
      throw new Error("검색 키워드 입력창을 찾지 못했습니다.");
    }

    const value = await keywordInput
      .evaluate((el) => {
        if (
          el instanceof HTMLInputElement ||
          el instanceof HTMLTextAreaElement
        ) {
          return el.value || "";
        }
        const editable = el as HTMLElement;
        return editable.innerText || editable.textContent || "";
      })
      .catch(() => "");

    return this.normalize(value);
  }

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
          const parsed = parseNumber(
            normalize(ariaCurrent.innerText || ariaCurrent.textContent || ""),
          );
          if (parsed !== null) {
            return parsed;
          }
        }

        const active = nav.querySelector(
          '.active, .selected, [data-active="true"]',
        ) as HTMLElement | null;
        if (active) {
          const parsed = parseNumber(
            normalize(active.innerText || active.textContent || ""),
          );
          if (parsed !== null) {
            return parsed;
          }
        }

        return null;
      })
      .catch(() => null as number | null);

    if (typeof navPage === "number") {
      return navPage;
    }

    return defaultPage;
  }

  async getCurrentAppliedFilters(
    maxControls: number = 8,
  ): Promise<PurchaseAppliedFilter[]> {
    const controls = await this.collectSearchFilterControls(maxControls);
    const applied: PurchaseAppliedFilter[] = [];

    for (const control of controls) {
      const value = await this.getFilterControlCurrentValue(control).catch(
        () => "",
      );
      if (!this.isMeaningfulOption(value)) {
        continue;
      }
      applied.push({
        label: control.label,
        value,
      });
    }

    return applied;
  }

  async searchByKeyword(keyword: string): Promise<void> {
    await this.fillKeyword(keyword);
    await this.clickSearchAndWait();
  }

  async buildSearchSeedFromCurrentRows(
    maxFilters: number = 2,
  ): Promise<PurchaseSearchSeed> {
    const firstRow = await this.getFirstRowText();
    const keyword = this.extractKeywordFromRowText(firstRow);
    if (this.isMeaningfulValue(keyword)) {
      await this.fillKeyword(keyword);
    }

    const filters = await this.applyDynamicFiltersFromRowText(
      firstRow,
      maxFilters,
    );

    return {
      keyword,
      filters,
    };
  }

  async applySearchSeed(seed: PurchaseSearchSeed): Promise<void> {
    if (this.isMeaningfulValue(seed.keyword)) {
      await this.fillKeyword(seed.keyword);
    }

    if (!seed.filters.length) {
      return;
    }

    const controls = await this.collectSearchFilterControls();
    for (const filter of seed.filters) {
      if (!this.isMeaningfulValue(filter.value)) {
        continue;
      }

      const matchedControl =
        controls.find(
          (control) =>
            this.normalizeLoose(control.label) ===
            this.normalizeLoose(filter.label),
        ) ??
        controls.find((control) =>
          this.normalizeLoose(control.label).includes(
            this.normalizeLoose(filter.label),
          ),
        );
      if (!matchedControl) {
        continue;
      }

      await this.selectFilterControlOption(matchedControl, filter.value).catch(
        () => {},
      );
    }
  }

  async assertRowsMatchSearchSeed(
    seed: PurchaseSearchSeed,
    sampleLimit: number = 10,
  ): Promise<void> {
    const rowTexts = await this.getRowTexts(sampleLimit);
    expect(rowTexts.length, "조회 결과 행이 없습니다.").toBeGreaterThan(0);

    if (this.isMeaningfulValue(seed.keyword)) {
      for (const rowText of rowTexts) {
        expect(
          this.rowContainsToken(rowText, seed.keyword),
          `키워드 불일치: keyword=${seed.keyword}, row=${rowText}`,
        ).toBeTruthy();
      }
    }

    for (const filter of seed.filters) {
      if (!this.isMeaningfulValue(filter.value)) {
        continue;
      }

      const matchedRowCount = rowTexts.filter((rowText) =>
        this.rowContainsToken(rowText, filter.value),
      ).length;
      expect(
        matchedRowCount,
        `필터 정합성 불일치: ${filter.label}=${filter.value}, sample=${rowTexts.join(" | ")}`,
      ).toBeGreaterThan(0);
    }
  }

  private async fillKeyword(keyword: string): Promise<void> {
    if (!this.isMeaningfulValue(keyword)) {
      return;
    }

    const keywordInput = await this.resolveKeywordInput();

    if (!keywordInput) {
      // TODO(env): 검색 키워드 입력창 셀렉터가 변경되면 위 locator 후보를 환경에 맞게 보강하세요.
      throw new Error("검색 키워드 입력창을 찾지 못했습니다.");
    }

    await keywordInput.fill(keyword);
  }

  private async resolveKeywordInput(): Promise<Locator | null> {
    return await this.findFirstVisible([
      this.page
        .getByRole("textbox", {
          name: /검색어|키워드|발주번호|입고번호|상품명|코드/i,
        })
        .first(),
      this.page
        .getByPlaceholder(/검색어|키워드|발주번호|입고번호|상품명|코드|번호/i)
        .first(),
      this.page.locator('main input[type="text"]:visible').first(),
    ]);
  }

  private async getFirstRowText(): Promise<string> {
    const rowTexts = await this.getRowTexts(1);
    expect(
      rowTexts.length,
      "검색 가능한 목록 데이터가 없습니다.",
    ).toBeGreaterThan(0);
    return rowTexts[0];
  }

  private async getRowTexts(limit: number = 10): Promise<string[]> {
    const checkboxBased = await this.page.evaluate((sampleLimit) => {
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
          if (ownCheckboxCount === 1 && text.length > 0) {
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

    const normalizedCheckboxTexts = checkboxBased
      .map((text) => this.normalize(text))
      .filter(
        (text) => text.length > 0 && !text.includes("검색결과가 없습니다"),
      );
    if (normalizedCheckboxTexts.length > 0) {
      return normalizedCheckboxTexts;
    }

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
    const normalizedTableTexts = tableRowTexts
      .map((text) => this.normalize(text))
      .filter(
        (text) => text.length > 0 && !text.includes("검색결과가 없습니다"),
      );
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
          if (text.length > 0) {
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
      .filter(
        (text) => text.length > 0 && !text.includes("검색결과가 없습니다"),
      );
  }

  private extractKeywordFromRowText(rowText: string): string {
    const normalized = this.normalize(rowText);
    const alphaNumericTokens =
      normalized.match(/[A-Za-z0-9][A-Za-z0-9/_\-]{3,}/g) ?? [];

    const preferredAlphaToken = alphaNumericTokens.find(
      (token) => !/^\d{4,}$/.test(token) && !/^(true|false)$/i.test(token),
    );
    if (preferredAlphaToken) {
      return preferredAlphaToken;
    }

    const koreanTokens = normalized.match(/[가-힣][가-힣0-9]{1,}/g) ?? [];
    const preferredKoreanToken = koreanTokens.find(
      (token) => token.length >= 2,
    );
    if (preferredKoreanToken) {
      return preferredKoreanToken;
    }

    return "";
  }

  private async applyDynamicFiltersFromRowText(
    rowText: string,
    maxFilters: number,
  ): Promise<PurchaseAppliedFilter[]> {
    const controls = await this.collectSearchFilterControls();
    const applied: PurchaseAppliedFilter[] = [];

    for (const control of controls) {
      if (applied.length >= maxFilters) {
        break;
      }

      const options = await this.getFilterControlOptions(control);
      if (!options.length) {
        continue;
      }

      const matchingOption = options.find((option) =>
        this.rowContainsToken(rowText, option),
      );
      const targetOption = matchingOption ?? options[0];
      if (!this.isMeaningfulValue(targetOption)) {
        continue;
      }

      const selected = await this.selectFilterControlOption(
        control,
        targetOption,
      );
      if (!selected) {
        continue;
      }

      const currentValue = await this.getFilterControlCurrentValue(
        control,
      ).catch(() => "");
      const resolvedValue = this.isMeaningfulValue(currentValue)
        ? currentValue
        : targetOption;

      applied.push({
        label: control.label,
        value: resolvedValue,
      });
    }

    return applied;
  }

  private async collectSearchFilterControls(
    maxControls: number = 8,
  ): Promise<PurchaseFilterControl[]> {
    const controls: PurchaseFilterControl[] = [];
    const seenLabels = new Set<string>();

    const addControl = async (
      locator: Locator,
      kind: PurchaseFilterControl["kind"],
      fallbackLabel: string,
    ): Promise<void> => {
      if (controls.length >= maxControls) {
        return;
      }

      const visible = await locator
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      if (!visible) {
        return;
      }

      const enabled = await locator.isEnabled().catch(() => true);
      if (!enabled) {
        return;
      }

      const label = await this.inferFilterLabel(locator, fallbackLabel);
      if (
        !this.isMeaningfulValue(label) ||
        this.shouldIgnoreFilterLabel(label)
      ) {
        return;
      }

      const labelKey = this.normalizeLoose(label);
      if (seenLabels.has(labelKey)) {
        return;
      }

      seenLabels.add(labelKey);
      controls.push({ locator, kind, label });
    };

    const selectLocator = this.page.locator("main select:visible");
    const selectCount = await selectLocator.count();
    for (let i = 0; i < selectCount; i++) {
      await addControl(selectLocator.nth(i), "select", `select-${i + 1}`);
    }

    const customLocator = this.page.locator(
      'main [role="combobox"]:visible, main .multiselect:visible',
    );
    const customCount = await customLocator.count();
    for (let i = 0; i < customCount; i++) {
      await addControl(customLocator.nth(i), "custom", `filter-${i + 1}`);
    }

    return controls;
  }

  private async getFilterControlOptions(
    control: PurchaseFilterControl,
  ): Promise<string[]> {
    if (control.kind === "select") {
      const options = await control.locator
        .evaluate((el) => {
          const select = el as HTMLSelectElement;
          return Array.from(select.options).map((option) =>
            (option.textContent || "").replace(/\s+/g, " ").trim(),
          );
        })
        .catch(() => [] as string[]);

      return Array.from(
        new Set(
          options
            .map((option) => this.normalize(option))
            .filter((option) => this.isMeaningfulOption(option)),
        ),
      );
    }

    await control.locator.click({ force: true }).catch(() => {});

    const options = await this.page
      .locator(
        '.multiselect__option:visible, [role="option"]:visible, li[role="option"]:visible',
      )
      .allTextContents()
      .catch(() => [] as string[]);

    await this.page.keyboard.press("Escape").catch(() => {});

    return Array.from(
      new Set(
        options
          .map((option) => this.normalize(option))
          .filter((option) => this.isMeaningfulOption(option)),
      ),
    );
  }

  private async selectFilterControlOption(
    control: PurchaseFilterControl,
    optionText: string,
  ): Promise<boolean> {
    if (!this.isMeaningfulValue(optionText)) {
      return false;
    }

    if (control.kind === "select") {
      const selectedByLabel = await control.locator
        .selectOption({ label: optionText })
        .catch(() => [] as string[]);
      if (!selectedByLabel.length) {
        const fallbackValue = await control.locator
          .evaluate((el, targetOption) => {
            const select = el as HTMLSelectElement;
            const target = Array.from(select.options).find((option) => {
              const text = (option.textContent || "")
                .replace(/\s+/g, " ")
                .trim();
              return (
                text === targetOption || text.includes(targetOption as string)
              );
            });
            return target?.value || "";
          }, optionText)
          .catch(() => "");

        if (fallbackValue) {
          await control.locator.selectOption(fallbackValue).catch(() => {});
        }
      }

      const current = await this.getFilterControlCurrentValue(control).catch(
        () => "",
      );
      return this.rowContainsToken(current, optionText);
    }

    await control.locator.click({ force: true }).catch(() => {});

    const escaped = this.escapeRegExp(optionText);
    const exactOption = this.page
      .locator(
        '.multiselect__option:visible, [role="option"]:visible, li[role="option"]:visible',
      )
      .filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`) })
      .first();

    let clicked = false;
    if (
      await exactOption
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false)
    ) {
      await exactOption.click({ force: true }).catch(() => {});
      clicked = true;
    }

    if (!clicked) {
      const partialOption = this.page
        .locator(
          '.multiselect__option:visible, [role="option"]:visible, li[role="option"]:visible',
        )
        .filter({ hasText: new RegExp(escaped) })
        .first();
      if (
        await partialOption
          .isVisible({ timeout: this.timeouts.short })
          .catch(() => false)
      ) {
        await partialOption.click({ force: true }).catch(() => {});
        clicked = true;
      }
    }

    await this.page.keyboard.press("Escape").catch(() => {});
    const current = await this.getFilterControlCurrentValue(control).catch(
      () => "",
    );
    return clicked || this.rowContainsToken(current, optionText);
  }

  private async getFilterControlCurrentValue(
    control: PurchaseFilterControl,
  ): Promise<string> {
    if (control.kind === "select") {
      const selectedText = await control.locator
        .evaluate((el) => {
          const select = el as HTMLSelectElement;
          const selected = select.options[select.selectedIndex];
          return (selected?.textContent || "").replace(/\s+/g, " ").trim();
        })
        .catch(() => "");
      return this.normalize(selectedText);
    }

    const selectedText = await control.locator
      .evaluate((el) => {
        const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
        const root = el as HTMLElement;

        const preferredNodes = root.querySelectorAll(
          '.multiselect__single, .multiselect__tag, [aria-selected="true"], .selected',
        );
        for (const node of Array.from(preferredNodes)) {
          const text = normalize(
            (node as HTMLElement).innerText || node.textContent || "",
          );
          if (text && text !== "선택" && text !== "전체") {
            return text;
          }
        }

        const input = root.querySelector("input") as HTMLInputElement | null;
        if (input?.value) {
          return normalize(input.value);
        }

        return normalize(root.innerText || root.textContent || "");
      })
      .catch(() => "");

    return this.normalize(selectedText);
  }

  private async inferFilterLabel(
    locator: Locator,
    fallback: string,
  ): Promise<string> {
    const label = await locator
      .evaluate((el) => {
        const normalize = (value: string) => value.replace(/\s+/g, " ").trim();
        const element = el as HTMLElement;

        const ariaLabel = normalize(element.getAttribute("aria-label") || "");
        if (ariaLabel) {
          return ariaLabel;
        }

        const id = element.getAttribute("id");
        if (id) {
          const forLabel = document.querySelector(`label[for="${id}"]`);
          if (forLabel) {
            const text = normalize(forLabel.textContent || "");
            if (text) {
              return text;
            }
          }
        }

        const nearby = element.closest("div, section, form");
        if (nearby) {
          const labelNode = nearby.querySelector("label, p, span, strong");
          if (labelNode) {
            const text = normalize(labelNode.textContent || "");
            if (text && text.length <= 30) {
              return text;
            }
          }
        }

        const previous = element.previousElementSibling as HTMLElement | null;
        if (previous) {
          const text = normalize(
            previous.innerText || previous.textContent || "",
          );
          if (text && text.length <= 30) {
            return text;
          }
        }

        return "";
      })
      .catch(() => "");

    const normalized = this.normalize(label || fallback);
    return normalized.slice(0, 30);
  }

  private shouldIgnoreFilterLabel(label: string): boolean {
    const normalized = this.normalize(label);
    return /발주\s*요청관리|발주관리|입고내역|조회하기|검색\s*초기화|pagination|previous|next|\/\s*page|page|페이지|정렬|sort/i.test(
      normalized,
    );
  }

  private isMeaningfulOption(value: string): boolean {
    if (!this.isMeaningfulValue(value)) {
      return false;
    }
    return !/^선택$|^전체$|^all$|^none$|^없음$/i.test(this.normalize(value));
  }

  private async resolveTab(tab: PurchaseTabKey): Promise<Locator> {
    const label = PURCHASE_TAB_LABELS[tab];
    const exactRegex = new RegExp(`^\\s*${this.escapeRegExp(label)}\\s*$`);
    const headingArea = this.page
      .locator("h1, h2")
      .filter({ hasText: /발주\/입고|발주|입고/i })
      .first()
      .locator("xpath=following-sibling::*[1]");

    const resolved = await this.findFirstVisible([
      headingArea.getByText(label, { exact: true }).first(),
      headingArea
        .locator("div, button, a, span, p")
        .filter({ hasText: exactRegex })
        .first(),
      this.page.getByRole("tab", { name: label, exact: true }).first(),
      this.page.getByRole("button", { name: label, exact: true }).first(),
      this.page
        .locator("main")
        .locator("div, button, a, span, p")
        .filter({ hasText: exactRegex })
        .first(),
    ]);

    if (!resolved) {
      // TODO(env): 탭 구조가 변경되면 resolveTab의 locator 후보를 환경에 맞게 보강하세요.
      throw new Error(`탭을 찾지 못했습니다: ${tab}`);
    }

    return resolved;
  }

  private rowContainsToken(rowText: string, token: string): boolean {
    const rowLoose = this.normalizeLoose(rowText);
    const tokenLoose = this.normalizeLoose(token);
    if (!tokenLoose) {
      return false;
    }
    return rowLoose.includes(tokenLoose);
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
    if (!normalized.length) return false;
    if (normalized === "-" || normalized === "--") return false;
    return true;
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
