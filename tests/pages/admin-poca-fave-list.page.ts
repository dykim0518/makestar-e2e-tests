/**
 * POCAAlbum FAVE 팩 목록 페이지 객체
 *
 * URL: /pocaalbum/fave/pack/list
 */

import { Page, Locator } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export class PocaFaveListPage extends AdminBasePage {
  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);
    this.searchInput = page.locator('input[placeholder*="검색"]').first();
  }

  getPageUrl(): string {
    return `${this.baseUrl}/pocaalbum/fave/pack/list`;
  }

  getHeadingText(): string {
    return "FAVE";
  }

  /** 키워드로 FAVE 팩 검색 */
  async searchByKeyword(keyword: string): Promise<void> {
    await this.searchInput.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
    await this.searchInput.fill(keyword);
    await this.clickSearchAndWait();
  }

  /** 특정 행의 팩명 반환 */
  async getPackName(rowIndex: number): Promise<string> {
    return (await this.getCellText(rowIndex, 1)).trim();
  }

  /** 테이블에서 텍스트를 포함하는 행 인덱스 반환 (-1: 없음) */
  async findRowByText(text: string): Promise<number> {
    const allTexts = await this.tableRows.evaluateAll((elements) =>
      elements.map((el) => el.textContent || ""),
    );
    for (let i = 0; i < allTexts.length; i++) {
      if (allTexts[i].includes(text)) return i;
    }
    return -1;
  }
}
