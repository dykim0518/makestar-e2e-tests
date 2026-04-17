/**
 * POCAAlbum Shop 상품 목록 페이지 객체
 *
 * URL: /pocaalbum/shop/product/list
 */

import { Page, Locator } from '@playwright/test';
import { AdminBasePage, ADMIN_TIMEOUTS } from './admin-base.page';

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
    return '상품';
  }

  // --------------------------------------------------------------------------
  // 검색 메서드
  // --------------------------------------------------------------------------

  /** 키워드로 상품 검색 */
  async searchByKeyword(keyword: string): Promise<void> {
    await this.searchInput.waitFor({ state: 'visible', timeout: this.timeouts.medium });
    await this.searchInput.fill(keyword);
    await this.clickSearchAndWait();
  }

  /** 특정 행의 상품명 반환 */
  async getProductName(rowIndex: number): Promise<string> {
    // 상품명 컬럼 위치는 테이블에 따라 다를 수 있으므로 2번째 컬럼 기본
    return (await this.getCellText(rowIndex, 1)).trim();
  }

  /** 테이블에서 텍스트를 포함하는 행 인덱스 반환 (-1: 없음) */
  async findRowByText(text: string): Promise<number> {
    const allTexts = await this.tableRows.evaluateAll((elements) =>
      elements.map((el) => el.textContent || ""),
    );
    for (let i = 0; i < allTexts.length; i += 1) {
      if (allTexts[i].includes(text)) {
        return i;
      }
    }
    return -1;
  }

  /** 상품명 셀 클릭 → 상세 페이지 이동 */
  async openProductDetailByTitle(title: string): Promise<void> {
    const row = this.tableRows.filter({ hasText: title }).first();
    await row.waitFor({ state: "visible", timeout: this.timeouts.medium });

    const clickableTitle = row.getByText(title, { exact: false }).first();
    const currentUrl = this.page.url();
    await this.clickWithRecovery(clickableTitle, {
      timeout: this.timeouts.medium,
    });

    await this.page.waitForURL(
      (url) =>
        url.toString() !== currentUrl &&
        url.toString().includes("/pocaalbum/shop/product/") &&
        !url.toString().includes("/list"),
      {
        timeout: this.timeouts.navigation,
      },
    );
  }

  /** 토글 스위치 존재 및 상태 확인 (읽기만) */
  async isProductVisible(rowIndex: number): Promise<boolean | null> {
    const row = this.tableRows.nth(rowIndex);
    const toggle = row.locator('input[type="checkbox"], [role="switch"], button[class*="toggle"]').first();
    const isVisible = await toggle.isVisible({ timeout: 3000 }).catch(() => false);
    if (!isVisible) return null;

    // checkbox인 경우
    const isChecked = await toggle.isChecked().catch(() => null);
    if (isChecked !== null) return isChecked;

    // switch/toggle 버튼인 경우 aria-checked 확인
    const ariaChecked = await toggle.getAttribute('aria-checked');
    if (ariaChecked !== null) return ariaChecked === 'true';

    return null;
  }

  /** 토글 스위치 로케이터 반환 (행 기준) */
  getToggleSwitches(): Locator {
    return this.tableRows.locator('input[type="checkbox"], [role="switch"], button[class*="toggle"]');
  }
}
