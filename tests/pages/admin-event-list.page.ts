/**
 * 상품(이벤트) 목록 페이지 객체
 */

import { Page, Locator } from '@playwright/test';
import { AdminBasePage, ADMIN_TIMEOUTS } from './admin-base.page';

// ============================================================================
// 이벤트 검색 조건 타입
// ============================================================================

export interface EventSearchOptions {
  name?: string;
  productCode?: string;
  albumCode?: string;
  id?: string;
  manager?: string;
  type?: 'event' | 'product' | 'funding';
  channel?: 'b2c' | 'b2b';
}

// ============================================================================
// 이벤트 목록 페이지 클래스
// ============================================================================

export class EventListPage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 로케이터 정의
  // --------------------------------------------------------------------------
  
  // 검색 필드
  readonly nameInput: Locator;
  readonly productCodeInput: Locator;
  readonly albumCodeInput: Locator;
  readonly idInput: Locator;
  readonly managerInput: Locator;
  
  // 타입 필터
  readonly eventTypeFilter: Locator;
  readonly productTypeFilter: Locator;
  readonly fundingTypeFilter: Locator;
  
  // 채널 필터
  readonly b2cFilter: Locator;
  readonly b2bFilter: Locator;
  
  // 추가 검색 옵션
  readonly simpleSearchButton: Locator;
  
  // 액션 버튼
  readonly createProductButton: Locator;
  readonly excelDownloadButton: Locator;
  readonly shipmentExcelButton: Locator;
  
  // 행 액션 버튼
  readonly privateLinkButton: Locator;
  readonly previewButton: Locator;
  readonly newWindowButton: Locator;
  
  // 조회 버튼 (새 UI)
  readonly searchButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);
    
    // 새 UI: 복합 필터 검색 방식
    // 담당자 필드 (유일한 텍스트 입력 필드)
    this.managerInput = page.getByRole('textbox', { name: '담당자의 이름 또는 이메일을 정확히 입력해주세요' });
    
    // 레거시/호환성 검색 필드 (필터 기반)
    this.nameInput = this.managerInput; // 새 UI에서는 담당자 필드로 대체
    this.productCodeInput = page.locator('input[placeholder="상품 코드를 입력해주세요"]');
    this.albumCodeInput = page.locator('input[placeholder="앨범 코드를 입력해주세요"]');
    this.idInput = page.locator('input[placeholder="ID를 입력해주세요"]');
    
    // 타입 필터 초기화 (새 UI: 구분 섹션)
    this.eventTypeFilter = page.getByText('이벤트', { exact: true }).first();
    this.productTypeFilter = page.getByText('상품', { exact: true }).first();
    this.fundingTypeFilter = page.getByText('펀딩', { exact: true }).first();
    
    // 채널 필터 초기화 (새 UI: 전시옵션 섹션)
    this.b2cFilter = page.getByText('B2C', { exact: true }).first();
    this.b2bFilter = page.getByText('B2B', { exact: true }).first();
    
    // 추가 검색 옵션
    this.simpleSearchButton = page.locator('button:has-text("간단하게 검색")');
    
    // 검색 버튼 (새 UI: "조회하기")
    this.searchButton = page.getByRole('button', { name: '조회하기' });
    
    // 액션 버튼 초기화 (새 UI에서는 "등록하기" 버튼)
    this.createProductButton = page.locator('button:has-text("등록하기"), button:has-text("상품 등록")');
    this.excelDownloadButton = page.getByRole('button', { name: '엑셀다운받기', exact: true });
    this.shipmentExcelButton = page.getByRole('button', { name: '출고엑셀다운받기' });
    
    // 행 액션 버튼 초기화
    this.privateLinkButton = page.locator('button:has-text("비공개링크")');
    this.previewButton = page.locator('button:has-text("미리보기")');
    this.newWindowButton = page.locator('button:has-text("새창보기")');
  }

  // --------------------------------------------------------------------------
  // 페이지 정보 (추상 메서드 구현)
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/event/list`;
  }

  getHeadingText(): string {
    return '상품 조회/수정';
  }

  // --------------------------------------------------------------------------
  // 검색 메서드
  // --------------------------------------------------------------------------

  /**
   * 이벤트명으로 검색 (새 UI: 필터 기반 검색 - 테이블 데이터 검색)
   * 참고: 새 UI에는 통합 검색 필드가 없으며, 테이블에서 직접 데이터를 찾음
   */
  async searchByName(name: string): Promise<boolean> {
    // 페이지 안정화 대기
    await this.page.waitForLoadState('domcontentloaded');
    await this.page.waitForTimeout(500);
    
    // 새 UI에서는 테이블의 "이름" 컬럼에서 텍스트 검색
    const nameCell = this.page.locator('table').getByRole('cell').getByText(name, { exact: false });
    const isFound = await nameCell.count() > 0;
    
    return isFound;
  }

  /**
   * 담당자로 검색 (새 UI: 유일한 텍스트 입력 필드)
   */
  async searchByManager(manager: string): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    await this.managerInput.fill(manager);
    await this.searchButton.click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * ID로 검색
   * @param id 상품 ID
   */
  async searchById(id: string): Promise<void> {
    await this.idInput.fill(id);
    await this.clickSearchAndWait();
  }

  /**
   * 테이블에서 텍스트 포함 행 찾기 (페이지네이션 포함)
   * @param text 찾을 텍스트
   * @param maxPages 최대 탐색 페이지 수
   * @returns 찾은 행 Locator 또는 null
   */
  async findRowByText(text: string, maxPages: number = 3): Promise<Locator | null> {
    for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
      const row = this.tableRows.filter({ hasText: text }).first();
      if (await row.count() > 0) {
        return row;
      }

      const moved = await this.goToNextPage();
      if (!moved) {
        break;
      }
    }

    return null;
  }

  /**
   * 조회하기 버튼 클릭
   */
  async clickSearchButton(): Promise<void> {
    await this.searchButton.click();
    await this.page.waitForTimeout(2000);
  }

  /**
   * 타입 필터 적용
   */
  async filterByType(type: 'event' | 'product' | 'funding'): Promise<void> {
    switch (type) {
      case 'event':
        await this.eventTypeFilter.click();
        break;
      case 'product':
        await this.productTypeFilter.click();
        break;
      case 'funding':
        await this.fundingTypeFilter.click();
        break;
    }
    await this.clickSearchAndWait();
  }

  /**
   * 채널 필터 적용
   */
  async filterByChannel(channel: 'b2c' | 'b2b'): Promise<void> {
    switch (channel) {
      case 'b2c':
        await this.b2cFilter.click();
        break;
      case 'b2b':
        await this.b2bFilter.click();
        break;
    }
    await this.clickSearchAndWait();
  }

  /**
   * 복합 검색 조건으로 검색
   */
  async searchWithOptions(options: EventSearchOptions): Promise<void> {
    if (options.name) {
      await this.nameInput.fill(options.name);
    }
    if (options.productCode) {
      await this.productCodeInput.fill(options.productCode);
    }
    if (options.albumCode) {
      await this.albumCodeInput.fill(options.albumCode);
    }
    if (options.id) {
      await this.idInput.fill(options.id);
    }
    if (options.manager) {
      await this.managerInput.fill(options.manager);
    }
    if (options.type) {
      await this.filterByType(options.type);
      return; // filterByType 내에서 검색 실행
    }
    if (options.channel) {
      await this.filterByChannel(options.channel);
      return; // filterByChannel 내에서 검색 실행
    }
    
    await this.clickSearchAndWait();
  }

  /**
   * 간단하게 검색 모드 전환
   */
  async toggleSimpleSearch(): Promise<void> {
    await this.simpleSearchButton.click();
    await this.wait(500);
  }

  // --------------------------------------------------------------------------
  // 액션 메서드
  // --------------------------------------------------------------------------

  /**
   * 상품 등록 페이지로 이동
   */
  async goToCreateProduct(): Promise<void> {
    await this.createProductButton.click();
    await this.waitForLoadState('domcontentloaded');
  }

  /**
   * 엑셀 다운로드
   */
  async downloadExcel(): Promise<void> {
    await this.excelDownloadButton.click();
    await this.wait(1000);
  }

  /**
   * 출고 엑셀 다운로드
   */
  async downloadShipmentExcel(): Promise<void> {
    await this.shipmentExcelButton.click();
    await this.wait(1000);
  }

  // --------------------------------------------------------------------------
  // 행 액션 메서드
  // --------------------------------------------------------------------------

  /**
   * 특정 행의 비공개 링크 버튼 클릭
   */
  async clickPrivateLink(rowIndex: number): Promise<void> {
    const row = this.tableRows.nth(rowIndex);
    await row.locator('button:has-text("비공개링크")').click();
    await this.wait(500);
  }

  /**
   * 특정 행의 미리보기 버튼 클릭
   */
  async clickPreview(rowIndex: number): Promise<void> {
    const row = this.tableRows.nth(rowIndex);
    await row.locator('button:has-text("미리보기")').click();
    await this.wait(500);
  }

  /**
   * 특정 행의 새창보기 버튼 클릭
   */
  async clickNewWindow(rowIndex: number): Promise<void> {
    const row = this.tableRows.nth(rowIndex);
    await row.locator('button:has-text("새창보기")').click();
    await this.wait(500);
  }

  // --------------------------------------------------------------------------
  // 테이블 헬퍼
  // --------------------------------------------------------------------------

  /**
   * 브레드크럼 예상 경로
   */
  getBreadcrumbPath(): string[] {
    return ['상품관리', '상품 조회/수정'];
  }
}
