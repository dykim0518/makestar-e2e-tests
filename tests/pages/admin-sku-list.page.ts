/**
 * SKU 목록 페이지 객체
 */

import { Page, Locator } from '@playwright/test';
import { AdminBasePage, ADMIN_TIMEOUTS } from './admin-base.page';

// ============================================================================
// SKU 검색 조건 타입
// ============================================================================

export interface SKUSearchOptions {
  skuCode?: string;
  productCode?: string;
  vendor?: string;
  distributor?: string;
  category?: string;
  safetyStockRisk?: boolean;
}

// ============================================================================
// SKU 목록 페이지 클래스
// ============================================================================

export class SKUListPage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 로케이터 정의
  // --------------------------------------------------------------------------
  
  // 검색 필드
  readonly skuCodeInput: Locator;
  readonly productCodeInput: Locator;
  readonly vendorCombobox: Locator;
  readonly distributorCombobox: Locator;
  readonly categoryDropdown: Locator;
  readonly safetyStockCheckbox: Locator;
  
  // 액션 버튼
  readonly createSKUButton: Locator;
  readonly createBonusSKUButton: Locator;
  readonly linkCategoryButton: Locator;
  readonly bulkEditButton: Locator;
  readonly categoryManageButton: Locator;
  readonly excelUploadButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);
    
    // 검색 필드 초기화
    this.skuCodeInput = page.locator('input[placeholder="SKU코드 /상품명 입력"]');
    this.productCodeInput = page.locator('input[placeholder="제품/유통코드 입력"]');
    this.vendorCombobox = page.locator('input[placeholder="발주처를 선택해주세요"]');
    this.distributorCombobox = page.locator('input[placeholder="유통사를 선택해주세요"]');
    this.categoryDropdown = page.locator('text=카테고리를 선택해주세요');
    this.safetyStockCheckbox = page.locator('text=안전재고 위험');
    
    // 액션 버튼 초기화
    this.createSKUButton = page.getByRole('button', { name: 'SKU 생성', exact: true });
    this.createBonusSKUButton = page.locator('button:has-text("특전 SKU 생성")');
    this.linkCategoryButton = page.locator('button:has-text("대분류 연결")');
    this.bulkEditButton = page.locator('button:has-text("일괄 수정")');
    this.categoryManageButton = page.locator('button:has-text("카테고리 관리")');
    this.excelUploadButton = page.locator('button:has-text("SKU 엑셀 업로드")');
  }

  // --------------------------------------------------------------------------
  // 페이지 정보 (추상 메서드 구현)
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/sku/list`;
  }

  getHeadingText(): string {
    return 'SKU 목록';
  }

  // --------------------------------------------------------------------------
  // 검색 메서드
  // --------------------------------------------------------------------------

  /**
   * SKU 코드로 검색
   */
  async searchBySKUCode(skuCode: string): Promise<void> {
    await this.skuCodeInput.fill(skuCode);
    await this.clickSearchAndWait();
  }

  /**
   * 상품명으로 검색
   */
  async searchByProductName(productName: string): Promise<void> {
    await this.skuCodeInput.fill(productName);
    await this.clickSearchAndWait();
  }

  /**
   * 제품/유통 코드로 검색
   */
  async searchByProductCode(productCode: string): Promise<void> {
    await this.productCodeInput.fill(productCode);
    await this.clickSearchAndWait();
  }

  /**
   * 복합 검색 조건으로 검색
   */
  async searchWithOptions(options: SKUSearchOptions): Promise<void> {
    if (options.skuCode) {
      await this.skuCodeInput.fill(options.skuCode);
    }
    if (options.productCode) {
      await this.productCodeInput.fill(options.productCode);
    }
    if (options.safetyStockRisk) {
      await this.safetyStockCheckbox.click();
    }
    
    await this.clickSearchAndWait();
  }

  /**
   * 검색 조건 초기화
   */
  async resetSearch(): Promise<void> {
    await this.clickResetButton();
  }

  // --------------------------------------------------------------------------
  // 액션 메서드
  // --------------------------------------------------------------------------

  /**
   * SKU 생성 페이지로 이동
   */
  async goToCreateSKU(): Promise<void> {
    await this.createSKUButton.click();
    await this.waitForLoadState('domcontentloaded');
  }

  /**
   * 특전 SKU 생성 페이지로 이동
   */
  async goToCreateBonusSKU(): Promise<void> {
    await this.createBonusSKUButton.click();
    await this.waitForLoadState('domcontentloaded');
  }

  /**
   * 대분류 연결 다이얼로그 열기
   */
  async openLinkCategoryDialog(): Promise<void> {
    await this.linkCategoryButton.click();
    await this.wait(500);
  }

  /**
   * 일괄 수정 다이얼로그 열기
   */
  async openBulkEditDialog(): Promise<void> {
    await this.bulkEditButton.click();
    await this.wait(500);
  }

  /**
   * 카테고리 관리 페이지로 이동
   */
  async goToCategoryManage(): Promise<void> {
    await this.categoryManageButton.click();
    await this.waitForLoadState('domcontentloaded');
  }

  // --------------------------------------------------------------------------
  // 테이블 헬퍼
  // --------------------------------------------------------------------------

  /**
   * 예상되는 테이블 헤더 목록
   */
  getExpectedHeaders(): string[] {
    return [
      'SKU코드', 'SKU상품명', '카테고리', '가용재고', '안전재고',
      '박스당 수량', '발주처/유통사', '제품코드', '유통코드',
      '과세여부', '매입가', '작성일', '작성자', '사용여부'
    ];
  }

  /**
   * 브레드크럼 예상 경로
   */
  getBreadcrumbPath(): string[] {
    return ['상품관리', 'SKU 목록'];
  }

  /**
   * 첫 번째 행의 SKU 코드 반환
   */
  async getFirstRowSKUCode(): Promise<string> {
    return await this.getCellText(0, 1);
  }

  /**
   * 첫 번째 행의 상품명 반환
   */
  async getFirstRowProductName(): Promise<string> {
    return await this.getCellText(0, 2);
  }
}
