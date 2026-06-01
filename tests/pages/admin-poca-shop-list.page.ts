/**
 * POCAAlbum Shop 상품 목록 페이지 객체
 *
 * URL: /pocaalbum/shop/product/list
 */

import { Page, Locator } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

// ============================================================================
// PocaShopListPage 클래스
// ============================================================================

export class PocaShopListPage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 로케이터 정의
  // --------------------------------------------------------------------------

  readonly searchInput: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    this.searchInput = page.locator('input[placeholder*="검색"]').first();
  }

  // --------------------------------------------------------------------------
  // 추상 메서드 구현
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/pocaalbum/shop/product/list`;
  }

  getHeadingText(): string {
    return "상품";
  }

  // --------------------------------------------------------------------------
  // 검색 메서드
  // --------------------------------------------------------------------------

  /** 키워드로 상품 검색 */
  async searchByKeyword(keyword: string): Promise<void> {
    await this.searchInput.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
    await this.searchInput.fill(keyword);
    await this.clickSearchAndWait();
  }

  /** 특정 행의 상품명 반환 */
  async getProductName(rowIndex: number): Promise<string> {
    // 상품명 컬럼 위치는 테이블에 따라 다를 수 있으므로 2번째 컬럼 기본
    return (await this.getCellText(rowIndex, 1)).trim();
  }
}
