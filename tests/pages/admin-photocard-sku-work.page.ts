/**
 * 포토카드 SKU 작업 현황 페이지 객체
 */

import { expect, type Locator, type Page } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export class PhotocardSkuWorkPage extends AdminBasePage {
  readonly skuSearchInput: Locator;
  readonly skuSearchButton: Locator;
  readonly skuNameHeader: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    this.skuSearchInput = page.getByPlaceholder(
      "SKU 코드, 이름을 입력해주세요",
    );
    this.skuSearchButton = page.getByRole("button", {
      name: "검색",
      exact: false,
    });
    this.skuNameHeader = page
      .locator("table thead th")
      .filter({ hasText: "SKU명" });
  }

  getPageUrl(): string {
    return `${this.baseUrl}/photocard-sku/work/pending`;
  }

  getHeadingText(): string {
    return "작업 현황";
  }

  async expectSearchAreaVisible(): Promise<void> {
    await expect(
      this.skuSearchInput,
      `SKU 코드/이름 검색 입력이 노출되어야 합니다. url=${this.currentUrl}`,
    ).toBeVisible({ timeout: this.timeouts.long });

    await expect(
      this.skuSearchButton,
      `검색 버튼이 노출되어야 합니다. url=${this.currentUrl}`,
    ).toBeVisible({ timeout: this.timeouts.long });

    await expect(
      this.skuNameHeader,
      `테이블 헤더에 'SKU명' 컬럼이 있어야 합니다. url=${this.currentUrl}`,
    ).toBeVisible({ timeout: this.timeouts.long });
  }

  async expectFirstDataRowVisible(): Promise<void> {
    await expect(
      this.tableRows.first(),
      `기준선: 검색 전 목록에 데이터가 1건 이상 있어야 합니다. url=${this.currentUrl}`,
    ).toBeVisible({ timeout: this.timeouts.long });
  }

  async getSkuNameColumnIndex(): Promise<number> {
    const headers = await this.tableHeaders.allTextContents();
    const index = headers.findIndex((text) => text.trim() === "SKU명");

    expect(
      index,
      `SKU명 컬럼 인덱스를 찾아야 합니다. headers=${JSON.stringify(headers)}`,
    ).toBeGreaterThan(0);

    return index;
  }

  async getFirstSkuName(columnIndex: number): Promise<string> {
    const text = (
      await this.tableRows.first().locator("td").nth(columnIndex).textContent()
    )?.trim();

    expect(
      text && text.length > 0,
      `첫 행의 SKU명을 추출할 수 있어야 합니다. columnIndex=${columnIndex}`,
    ).toBe(true);

    return text ?? "";
  }

  async searchBySkuNameAndWaitForResults(
    searchToken: string,
    columnIndex: number,
  ): Promise<string[]> {
    const beforeFingerprint = await this.getFirstRowFingerprint();

    await this.skuSearchInput.fill(searchToken);
    await this.skuSearchButton.click({ force: true });
    await this.waitForSearchSettled(beforeFingerprint, searchToken, columnIndex);

    return await this.getSkuNameColumnTexts(columnIndex);
  }

  async searchBySkuNameAndWaitForNoResult(
    searchToken: string,
  ): Promise<{ rowCount: number; hasNoResult: boolean }> {
    await this.skuSearchInput.fill(searchToken);
    await this.skuSearchButton.click({ force: true });

    await this.page.waitForLoadState("networkidle", {
      timeout: this.timeouts.long,
    }).catch(() => {});

    await expect
      .poll(
        async () => {
          const totalRowCount = await this.tableRows.count();
          const rowCount = await this.getMeaningfulRowCount();
          const hasNoResult = await this.hasNoResultMessage();
          return totalRowCount === 0 || rowCount > 0 || hasNoResult;
        },
        {
          message:
            `존재하지 않는 SKU명 검색 시 결과 없음이 표시되어야 합니다. ` +
            `token=${searchToken}, url=${this.currentUrl}`,
          timeout: this.timeouts.navigation,
          intervals: [300, 700, 1000, 2000],
        },
      )
      .toBe(true);

    return {
      rowCount: await this.getMeaningfulRowCount(),
      hasNoResult: await this.hasNoResultMessage(),
    };
  }

  async getSkuNameColumnTexts(columnIndex: number): Promise<string[]> {
    return await this.tableRows.evaluateAll(
      (rows, index) =>
        rows
          .map((row) =>
            (row as HTMLTableRowElement)
              .querySelectorAll("td")
              [index].textContent?.trim(),
          )
          .filter((text): text is string => !!text),
      columnIndex,
    );
  }

  private async waitForSearchSettled(
    beforeFingerprint: string,
    searchToken: string,
    columnIndex: number,
  ): Promise<void> {
    await this.page.waitForLoadState("networkidle", {
      timeout: this.timeouts.long,
    }).catch(() => {});

    await expect
      .poll(
        async () => {
          const hasNoResult = await this.hasNoResultMessage();
          if (hasNoResult) return true;

          const skuNames = await this.getSkuNameColumnTexts(columnIndex);
          if (skuNames.length === 0) return "loading";

          const allRowsMatch = skuNames.every((name) =>
            name.includes(searchToken),
          );

          if (allRowsMatch) return "matched";
          const currentFingerprint = await this.getFirstRowFingerprint();
          return currentFingerprint === beforeFingerprint
            ? "waiting"
            : "mismatched";
        },
        {
          message:
            `SKU명 검색 결과가 안정화되어야 합니다. ` +
            `token=${searchToken}, url=${this.currentUrl}`,
          timeout: this.timeouts.navigation,
          intervals: [300, 700, 1000, 2000],
        },
      )
      .toBe("matched");
  }

  private async getMeaningfulRowCount(): Promise<number> {
    return await this.tableRows.evaluateAll(
      (rows) =>
        rows.filter((row) => {
          const text = (row.textContent ?? "").trim();
          return text.length > 0 && !text.includes("검색결과가 없습니다");
        }).length,
    );
  }

  private async hasNoResultMessage(): Promise<boolean> {
    return await this.noResultMessage
      .first()
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
  }
}
