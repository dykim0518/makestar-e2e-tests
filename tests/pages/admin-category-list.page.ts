/**
 * 대분류 목록 페이지 객체
 */

import { Page, Locator } from '@playwright/test';
import { AdminBasePage, ADMIN_TIMEOUTS } from './admin-base.page';

// ============================================================================
// 대분류 검색 조건 타입
// ============================================================================

export interface CategorySearchOptions {
  keyword?: string;
  periodType?: string;
  startDate?: string;
  endDate?: string;
}

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
    this.periodTypeSelect = page.locator('text=선택안함');
    this.dateRangeStart = page.locator('text=검색 시작일을 선택해주세요');
    this.dateRangeEnd = page.locator('text=검색 종료일을 선택해주세요');
    
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
    return '대분류 목록 조회/수정';
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

  // --------------------------------------------------------------------------
  // 액션 메서드
  // --------------------------------------------------------------------------

  /**
   * 대분류 생성 페이지로 이동
   */
  async goToCreateCategory(): Promise<void> {
    await this.createCategoryButton.click();
    await this.waitForLoadState('domcontentloaded');
  }

  /**
   * 엑셀 다운로드
   */
  async downloadExcel(): Promise<void> {
    await this.excelDownloadButton.click();
    await this.wait(1000);
  }

  // --------------------------------------------------------------------------
  // 테이블 헬퍼
  // --------------------------------------------------------------------------

  /**
   * 브레드크럼 예상 경로
   */
  getBreadcrumbPath(): string[] {
    return ['상품관리', '대분류 조회/수정'];
  }
}
