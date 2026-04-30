/**
 * 대분류 목록 페이지 객체
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

// ============================================================================
// 대분류 검색 조건 타입
// ============================================================================

export type CategorySearchOptions = {
  keyword?: string;
  periodType?: string;
  startDate?: string;
  endDate?: string;
};

// ============================================================================
// 대분류 목록 페이지 클래스
// ============================================================================

export class CategoryListPage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 로케이터 정의
  // --------------------------------------------------------------------------

  // 검색 필드
  readonly keywordInput: Locator;
  readonly periodTypeSelect: Locator;
  readonly dateRangeStart: Locator;
  readonly dateRangeEnd: Locator;

  // 액션 버튼
  readonly excelDownloadButton: Locator;
  readonly createCategoryButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    // 검색 필드 초기화
    this.keywordInput = page.locator('input[placeholder="검색어 입력"]');
    this.periodTypeSelect = page.locator("text=선택안함");
    this.dateRangeStart = page.locator("text=검색 시작일을 선택해주세요");
    this.dateRangeEnd = page.locator("text=검색 종료일을 선택해주세요");

    // 액션 버튼 초기화
    this.excelDownloadButton = page.locator('button:has-text("엑셀다운받기")');
    this.createCategoryButton = page.locator('button:has-text("대분류 생성")');
  }

  // --------------------------------------------------------------------------
  // 페이지 정보 (추상 메서드 구현)
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/product/new/list`;
  }

  getHeadingText(): string {
    return "대분류 목록 조회/수정";
  }

  // --------------------------------------------------------------------------
  // 검색 메서드
  // --------------------------------------------------------------------------

  /**
   * 키워드로 검색
   */
  async searchByKeyword(keyword: string): Promise<void> {
    await this.keywordInput.fill(keyword);
    await this.clickSearchAndWait();
  }

  /**
   * 복합 검색 조건으로 검색
   */
  async searchWithOptions(options: CategorySearchOptions): Promise<void> {
    if (options.keyword) {
      await this.keywordInput.fill(options.keyword);
    }

    await this.clickSearchAndWait();
  }

  /**
   * 현재 테이블에서 지정 텍스트를 포함하는 행 수를 반환합니다.
   */
  async getRowCountByText(text: string): Promise<number> {
    return await this.tableRows.filter({ hasText: text }).count();
  }

  /**
   * 현재 테이블에서 지정 텍스트를 포함하는 첫 번째 행을 반환합니다.
   */
  getRowByText(text: string): Locator {
    return this.tableRows.filter({ hasText: text }).first();
  }

  /**
   * 지정 텍스트를 포함하는 대분류 행이 노출되는지 검증합니다.
   */
  async expectRowVisible(text: string): Promise<void> {
    await expect(
      this.getRowByText(text),
      `대분류 "${text}" 행을 찾을 수 없습니다.`,
    ).toBeVisible({ timeout: this.timeouts.long });
  }

  // --------------------------------------------------------------------------
  // 액션 메서드
  // --------------------------------------------------------------------------

  /**
   * 대분류 생성 페이지로 이동
   */
  async goToCreateCategory(): Promise<void> {
    await this.createCategoryButton.click();
    await this.waitForLoadState("domcontentloaded");
  }

  /**
   * 엑셀 다운로드
   */
  async downloadExcel(): Promise<void> {
    await this.excelDownloadButton.click();
    await this.wait(1000);
  }

  /**
   * 지정 텍스트를 포함하는 대분류 행의 이름 셀을 클릭해 상세로 진입합니다.
   */
  async openDetailByText(text: string, nameCellIndex: number = 3): Promise<void> {
    const row = this.getRowByText(text);
    await expect(row, `대분류 "${text}" 행을 찾을 수 없습니다.`).toBeVisible({
      timeout: this.timeouts.long,
    });
    await row.locator("td").nth(nameCellIndex).click();
    await this.page.waitForLoadState("domcontentloaded");
  }

  // --------------------------------------------------------------------------
  // 테이블 헬퍼
  // --------------------------------------------------------------------------

  /**
   * 브레드크럼 예상 경로
   */
  getBreadcrumbPath(): string[] {
    return ["상품관리", "대분류 조회/수정"];
  }
}
