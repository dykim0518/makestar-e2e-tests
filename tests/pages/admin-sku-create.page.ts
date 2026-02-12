/**
 * SKU 생성 페이지 객체
 * 
 * URL: https://stage-new-admin.makeuni2026.com/sku/create
 * 
 * SKU 생성 폼 구조:
 * - 기본정보: 유통 코드, 제품 코드
 * - 가격: 매입가, 소비자가
 * - 메인 타이틀명 (한국어, 영어)
 * - 버전명 (한국어, 영어)
 * - SKU 상품명
 * - 카테고리 선택
 * - 발주처/유통사/아티스트 선택 (multiselect)
 * - 발매일, 초동 마감일, 발주 마감일
 * - 과세여부, 사용여부 (라디오)
 * - 상품사양: 중량, 가로, 세로, 높이, 부피
 */

import { Page, Locator, expect } from '@playwright/test';
import { AdminBasePage, ADMIN_TIMEOUTS } from './admin-base.page';

// ============================================================================
// SKU 생성 옵션 타입
// ============================================================================

export interface SkuCreateOptions {
  /** 유통 코드 */
  distributionCode?: string;
  /** 제품 코드 */
  productCode?: string;
  /** 매입가 */
  purchasePrice?: string;
  /** 소비자가 */
  consumerPrice?: string;
  /** 메인 타이틀명 (한국어) */
  mainTitleKr: string;
  /** 메인 타이틀명 (영어) */
  mainTitleEn?: string;
  /** 버전명 (한국어) */
  versionKr?: string;
  /** 버전명 (영어) */
  versionEn?: string;
  /** SKU 상품명 */
  skuProductName: string;
  /** 카테고리명 */
  category?: string;
  /** 발주처명 */
  vendor: string;
  /** 유통사명 */
  distributor: string;
  /** 아티스트명 */
  artist: string;
  /** 발매일 (YYYY-MM-DD) */
  releaseDate?: string;
  /** 초동 마감일 (YYYY-MM-DD) */
  firstWeekDeadline?: string;
  /** 발주 마감일 (YYYY-MM-DD) */
  orderDeadline?: string;
  /** 과세여부 (true: 과세, false: 비과세) */
  taxable?: boolean;
  /** 사용여부 (true: 사용, false: 미사용) */
  active?: boolean;
  /** 중량 (kg) */
  weight?: string;
  /** 가로 (mm) */
  width?: string;
  /** 세로 (mm) */
  depth?: string;
  /** 높이 (mm) */
  height?: string;
  /** 부피 (mm³) */
  volume?: string;
}

// ============================================================================
// SKU 생성 페이지 클래스
// ============================================================================

export class SkuCreatePage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 로케이터 정의
  // --------------------------------------------------------------------------
  
  // 기본정보
  readonly distributionCodeInput: Locator;
  readonly productCodeInput: Locator;
  
  // 가격
  readonly purchasePriceInput: Locator;
  readonly consumerPriceInput: Locator;
  
  // 메인 타이틀명 / 버전명 (placeholder가 동일하므로 인덱스로 구분)
  readonly mainTitleInputs: Locator;
  readonly versionInputs: Locator;
  
  // SKU 상품명
  readonly skuProductNameInput: Locator;
  
  // 카테고리
  readonly categoryInput: Locator;
  
  // 발주처/유통사/아티스트 (multiselect)
  readonly vendorMultiselect: Locator;
  readonly distributorMultiselect: Locator;
  readonly artistMultiselect: Locator;
  
  // 날짜 필드
  readonly releaseDateInput: Locator;
  readonly firstWeekDeadlineInput: Locator;
  readonly orderDeadlineInput: Locator;
  
  // 라디오 버튼
  readonly taxableRadio: Locator;
  readonly nonTaxableRadio: Locator;
  readonly activeRadio: Locator;
  readonly inactiveRadio: Locator;
  
  // 상품사양
  readonly weightInput: Locator;
  readonly widthInput: Locator;
  readonly depthInput: Locator;
  readonly heightInput: Locator;
  readonly volumeInput: Locator;
  
  // 액션 버튼
  readonly createButton: Locator;
  readonly cancelButton: Locator;
  readonly addSubSkuButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);
    
    // 기본정보
    this.distributionCodeInput = page.getByPlaceholder('유통 코드를 입력해주세요');
    this.productCodeInput = page.getByPlaceholder('제품 코드를 입력해주세요');
    
    // 가격
    this.purchasePriceInput = page.getByPlaceholder('매입가를 입력해주세요');
    this.consumerPriceInput = page.getByPlaceholder('소비자가를 입력해주세요');
    
    // 메인 타이틀명 / 버전명 (내용을 입력해주세요 placeholder 사용)
    this.mainTitleInputs = page.getByPlaceholder('내용을 입력해주세요');
    this.versionInputs = page.getByPlaceholder('내용을 입력해주세요');
    
    // SKU 상품명
    this.skuProductNameInput = page.getByPlaceholder('SKU 상품명을 입력해주세요');
    
    // 카테고리
    this.categoryInput = page.getByPlaceholder('카테고리를 선택해주세요');
    
    // Multiselect 컴포넌트들 - combobox role 기반으로 찾기
    // 페이지 구조: generic > paragraph("발주처") + combobox (placeholder 포함)
    this.vendorMultiselect = page.getByRole('combobox').filter({ has: page.getByPlaceholder('발주처를 선택해주세요') });
    this.distributorMultiselect = page.getByRole('combobox').filter({ has: page.getByPlaceholder('유통사를 선택해주세요') });
    this.artistMultiselect = page.getByRole('combobox').filter({ has: page.getByPlaceholder('아티스트를 선택해주세요') });
    
    // 날짜 필드 (placeholder 기반으로 찾기)
    this.releaseDateInput = page.getByPlaceholder('발매일을 선택해주세요');
    this.firstWeekDeadlineInput = page.getByPlaceholder('초동 마감일을 선택해주세요');
    this.orderDeadlineInput = page.getByPlaceholder('발주 마감일을 선택해주세요');
    
    // 라디오 버튼
    this.taxableRadio = page.getByText('과세', { exact: true });
    this.nonTaxableRadio = page.getByText('비과세', { exact: true });
    this.activeRadio = page.getByText('사용', { exact: true });
    this.inactiveRadio = page.getByText('미사용', { exact: true });
    
    // 상품사양
    this.weightInput = page.getByPlaceholder('중량');
    this.widthInput = page.getByPlaceholder('가로');
    this.depthInput = page.getByPlaceholder('세로');
    this.heightInput = page.getByPlaceholder('높이');
    this.volumeInput = page.getByPlaceholder('부피');
    
    // 액션 버튼
    this.createButton = page.getByRole('button', { name: 'SKU 생성하기' });
    this.cancelButton = page.getByRole('button', { name: '취소하기' });
    this.addSubSkuButton = page.getByRole('button', { name: '하위 SKU 추가하기' });
  }

  // --------------------------------------------------------------------------
  // 페이지 정보 (추상 메서드 구현)
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/sku/create`;
  }

  getHeadingText(): string {
    return 'SKU 등록';
  }

  // --------------------------------------------------------------------------
  // 헬퍼 메서드
  // --------------------------------------------------------------------------

  /**
   * 로딩 오버레이가 사라질 때까지 대기
   */
  async waitForOverlayToDisappear(): Promise<void> {
    const overlay = this.page.locator('div[class*="fixed"][class*="bg-"][class*="z-"]').first();
    try {
      await overlay.waitFor({ state: 'hidden', timeout: 5000 });
    } catch {
      // 오버레이가 없으면 무시
    }
  }

  /**
   * 열려있는 모달 닫기 (ESC 키 사용)
   */
  async closeModalIfVisible(): Promise<void> {
    const modalTitles = ['새로운 발주처 등록', '새로운 유통사 등록', '새로운 아티스트 등록'];
    
    for (const title of modalTitles) {
      const modalTitle = this.page.getByText(title);
      const isModalVisible = await modalTitle.isVisible({ timeout: 500 }).catch(() => false);
      
      if (isModalVisible) {
        await this.page.keyboard.press('Escape');
        await this.wait(300);
        console.log(`ℹ️ 모달 닫힘: ${title}`);
        return;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 폼 입력 메서드
  // --------------------------------------------------------------------------

  /**
   * 유통 코드 입력
   */
  async fillDistributionCode(code: string): Promise<void> {
    await this.distributionCodeInput.waitFor({ state: 'visible', timeout: this.timeouts.medium });
    await this.distributionCodeInput.fill(code);
  }

  /**
   * 제품 코드 입력
   */
  async fillProductCode(code: string): Promise<void> {
    await this.productCodeInput.fill(code);
  }

  /**
   * 매입가 입력
   */
  async fillPurchasePrice(price: string): Promise<void> {
    await this.purchasePriceInput.fill(price);
  }

  /**
   * 소비자가 입력
   */
  async fillConsumerPrice(price: string): Promise<void> {
    await this.consumerPriceInput.fill(price);
  }

  /**
   * 메인 타이틀명 입력 (한국어/영어)
   */
  async fillMainTitle(titleKr: string, titleEn?: string): Promise<void> {
    // 메인 타이틀명 섹션의 입력 필드들
    const inputs = this.page.getByPlaceholder('내용을 입력해주세요');
    await inputs.first().fill(titleKr);
    
    if (titleEn) {
      await inputs.nth(1).fill(titleEn);
    }
  }

  /**
   * 버전명 입력 (한국어/영어)
   */
  async fillVersion(versionKr?: string, versionEn?: string): Promise<void> {
    const inputs = this.page.getByPlaceholder('내용을 입력해주세요');
    
    if (versionKr) {
      await inputs.nth(2).fill(versionKr);
    }
    if (versionEn) {
      await inputs.nth(3).fill(versionEn);
    }
  }

  /**
   * 발매일 입력 (YYYY-MM-DD 형식)
   */
  async fillReleaseDate(date: string): Promise<void> {
    // placeholder 기반으로 발매일 입력 필드 찾기
    const releaseDateField = this.page.getByPlaceholder('발매일을 선택해주세요');
    
    // 필드가 없으면 다른 방법 시도
    if (await releaseDateField.isVisible({ timeout: 2000 }).catch(() => false)) {
      await releaseDateField.fill(date);
      await releaseDateField.press('Tab'); // blur 이벤트 발생
      console.log(`ℹ️ 발매일 입력: ${date}`);
    } else {
      // 테이블 행 기반으로 찾기
      const releaseDateRow = this.page.locator('tr:has(th:has-text("발매일"))');
      const dateInput = releaseDateRow.locator('input').first();
      
      if (await dateInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dateInput.fill(date);
        await dateInput.press('Tab');
        console.log(`ℹ️ 발매일 입력 (대체): ${date}`);
      } else {
        console.log('⚠️ 발매일 입력 필드를 찾을 수 없음');
      }
    }
    
    await this.wait(300);
  }

  /**
   * SKU 상품명 입력
   */
  async fillSkuProductName(name: string): Promise<void> {
    await this.skuProductNameInput.fill(name);
  }

  /**
   * 카테고리 선택 (모달을 통한 트리 구조 선택)
   * @param parentCategory 상위 카테고리명 (예: "음반")
   * @param childCategory 하위 카테고리명 (예: "LP", "CD")
   */
  async selectCategory(parentCategory: string, childCategory: string): Promise<void> {
    // 1. 카테고리 관리 버튼 클릭하여 모달 열기
    const categoryBtn = this.page.getByRole('button', { name: '카테고리 관리' });
    await categoryBtn.click();
    await this.wait(1000);
    console.log(`ℹ️ 카테고리 모달 열림`);
    
    // 2. 상위 카테고리 클릭 (확장)
    const parentOption = this.page.getByText(parentCategory, { exact: true });
    if (await parentOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await parentOption.click();
      await this.wait(500);
      console.log(`ℹ️ 상위 카테고리 확장: ${parentCategory}`);
    } else {
      console.log(`⚠️ 상위 카테고리를 찾을 수 없음: ${parentCategory}`);
      await this.page.keyboard.press('Escape');
      return;
    }
    
    // 3. 하위 카테고리 클릭 (선택)
    const childOption = this.page.getByText(childCategory, { exact: true });
    if (await childOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await childOption.click();
      await this.wait(500);
      console.log(`ℹ️ 하위 카테고리 선택: ${childCategory}`);
    } else {
      console.log(`⚠️ 하위 카테고리를 찾을 수 없음: ${childCategory}`);
      await this.page.keyboard.press('Escape');
      return;
    }
    
    // 4. 선택하기 버튼 클릭
    const selectBtn = this.page.getByRole('button', { name: '선택하기' });
    const isDisabled = await selectBtn.getAttribute('disabled');
    
    if (isDisabled === null) {
      await selectBtn.click();
      await this.wait(500);
      console.log(`ℹ️ 카테고리 선택 완료: ${parentCategory} > ${childCategory}`);
    } else {
      console.log(`⚠️ 선택하기 버튼이 비활성화 상태`);
      await this.page.keyboard.press('Escape');
    }
  }
  
  /**
   * 카테고리 선택 (단일 파라미터 - 하위 없는 카테고리용)
   * @param category 카테고리명
   */
  async selectSingleCategory(category: string): Promise<void> {
    // 1. 카테고리 관리 버튼 클릭
    const categoryBtn = this.page.getByRole('button', { name: '카테고리 관리' });
    await categoryBtn.click();
    await this.wait(1000);
    
    // 2. 카테고리 클릭
    const option = this.page.getByText(category, { exact: true });
    if (await option.isVisible({ timeout: 3000 }).catch(() => false)) {
      await option.click();
      await this.wait(500);
    }
    
    // 3. 선택하기 버튼 클릭
    const selectBtn = this.page.getByRole('button', { name: '선택하기' });
    const isDisabled = await selectBtn.getAttribute('disabled');
    
    if (isDisabled === null) {
      await selectBtn.click();
      await this.wait(500);
      console.log(`ℹ️ 카테고리 선택 완료: ${category}`);
    } else {
      console.log(`⚠️ 선택하기 버튼이 비활성화 상태`);
      await this.page.keyboard.press('Escape');
    }
  }

  /**
   * Multiselect에서 옵션 선택 (공통 메서드)
   * 새로운 UI 구조: combobox > textbox (검색) + 드롭다운 옵션
   */
  private async selectFromMultiselect(
    multiselect: Locator, 
    searchTerm: string, 
    fieldName: string,
    excludePatterns: RegExp
  ): Promise<void> {
    await this.waitForOverlayToDisappear();
    
    // combobox 클릭하여 드롭다운 열기
    await multiselect.click();
    await this.wait(500);
    
    // combobox 내 검색 입력 찾기 (새 UI 구조)
    const searchInput = multiselect.getByRole('textbox');
    const isInputVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (isInputVisible) {
      await searchInput.fill(searchTerm);
      await this.wait(1500); // API 응답 대기
    }
    
    // 드롭다운 옵션 대기 (listbox 또는 기존 multiselect 구조)
    const listbox = this.page.getByRole('listbox');
    const hasListbox = await listbox.isVisible({ timeout: 3000 }).catch(() => false);
    
    let selectedOption = false;
    
    if (hasListbox) {
      // 새 UI: listbox 내 option 사용
      const options = this.page.getByRole('option');
      const matchingOption = options.filter({ hasText: searchTerm }).filter({ hasNotText: excludePatterns }).first();
      
      if (await matchingOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        const optionText = await matchingOption.textContent();
        await matchingOption.click();
        console.log(`ℹ️ ${fieldName} 선택: ${optionText?.trim()}`);
        selectedOption = true;
      } else {
        // 첫 번째 유효 옵션 선택
        const firstOption = options.filter({ hasNotText: excludePatterns }).first();
        if (await firstOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          const optionText = await firstOption.textContent();
          await firstOption.click();
          console.log(`ℹ️ ${fieldName} 선택(첫번째): ${optionText?.trim()}`);
          selectedOption = true;
        }
      }
    } else {
      // 레거시 UI: multiselect 구조 사용
      await this.page.locator('.multiselect__content-wrapper:visible').waitFor({ 
        state: 'visible', 
        timeout: 5000 
      }).catch(() => {});
      
      const validOptions = this.page.locator('.multiselect__option:visible')
        .filter({ hasNotText: excludePatterns });
      
      const matchingOption = validOptions.filter({ hasText: searchTerm }).first();
      
      if (await matchingOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        const optionText = await matchingOption.textContent();
        await matchingOption.click();
        console.log(`ℹ️ ${fieldName} 선택: ${optionText?.trim()}`);
        selectedOption = true;
      } else {
        const firstValidOption = validOptions.first();
        if (await firstValidOption.isVisible({ timeout: 1000 }).catch(() => false)) {
          const optionText = await firstValidOption.textContent();
          if (optionText && !optionText.includes('undefined') && optionText.trim().length > 0) {
            await firstValidOption.click();
            console.log(`ℹ️ ${fieldName} 선택(첫번째): ${optionText?.trim()}`);
            selectedOption = true;
          }
        }
      }
    }
    
    if (!selectedOption) {
      console.log(`⚠️ ${fieldName} 옵션을 찾을 수 없음`);
    }
    
    await this.wait(300);
    await this.closeModalIfVisible();
  }

  /**
   * 발주처 선택
   */
  async selectVendor(vendorName: string): Promise<void> {
    await this.selectFromMultiselect(
      this.vendorMultiselect,
      vendorName,
      '발주처',
      /새로운 발주처 등록|검색결과가 없습니다/
    );
  }

  /**
   * 유통사 선택
   */
  async selectDistributor(distributorName: string): Promise<void> {
    await this.selectFromMultiselect(
      this.distributorMultiselect,
      distributorName,
      '유통사',
      /새로운 제작사 등록|새로운 유통사 등록|검색결과가 없습니다/
    );
  }

  /**
   * 아티스트 선택
   */
  async selectArtist(artistName: string): Promise<void> {
    await this.selectFromMultiselect(
      this.artistMultiselect,
      artistName,
      '아티스트',
      /새로운 아티스트 등록|검색결과가 없습니다/
    );
  }

  /**
   * 날짜 필드 입력 (레이블 기반)
   */
  async fillDateField(labelText: string, date: string): Promise<void> {
    // 레이블 찾기
    const label = this.page.getByText(labelText, { exact: true });
    
    // 레이블 근처의 날짜 입력 필드 찾기
    const dateContainer = label.locator('xpath=ancestor::div[contains(@class, "flex") or contains(@class, "grid")]//div[contains(@class, "date") or contains(text(), "날짜를 선택")]').first();
    
    if (await dateContainer.isVisible({ timeout: 2000 }).catch(() => false)) {
      await dateContainer.click();
      await this.wait(300);
      
      // 날짜 입력 (보통 캘린더 팝업)
      // 직접 입력 시도
      const input = this.page.locator('input:visible').filter({ hasText: '' }).last();
      await input.fill(date);
    }
  }

  /**
   * 과세여부 선택
   */
  async selectTaxable(taxable: boolean): Promise<void> {
    if (taxable) {
      await this.taxableRadio.click();
    } else {
      await this.nonTaxableRadio.click();
    }
  }

  /**
   * 사용여부 선택
   */
  async selectActive(active: boolean): Promise<void> {
    if (active) {
      await this.activeRadio.click();
    } else {
      await this.inactiveRadio.click();
    }
  }

  /**
   * 상품사양 입력
   */
  async fillSpecifications(specs: {
    weight?: string;
    width?: string;
    depth?: string;
    height?: string;
    volume?: string;
  }): Promise<void> {
    if (specs.weight) {
      await this.weightInput.fill(specs.weight);
    }
    if (specs.width) {
      await this.widthInput.fill(specs.width);
    }
    if (specs.depth) {
      await this.depthInput.fill(specs.depth);
    }
    if (specs.height) {
      await this.heightInput.fill(specs.height);
    }
    if (specs.volume) {
      await this.volumeInput.fill(specs.volume);
    }
  }

  /**
   * SKU 생성 폼 전체 입력
   */
  async fillCreateForm(options: SkuCreateOptions): Promise<void> {
    // 기본정보
    if (options.distributionCode) {
      await this.fillDistributionCode(options.distributionCode);
    }
    if (options.productCode) {
      await this.fillProductCode(options.productCode);
    }
    
    // 가격
    if (options.purchasePrice) {
      await this.fillPurchasePrice(options.purchasePrice);
    }
    if (options.consumerPrice) {
      await this.fillConsumerPrice(options.consumerPrice);
    }
    
    // 메인 타이틀명
    await this.fillMainTitle(options.mainTitleKr, options.mainTitleEn);
    
    // 버전명
    if (options.versionKr || options.versionEn) {
      await this.fillVersion(options.versionKr, options.versionEn);
    }
    
    // SKU 상품명
    await this.fillSkuProductName(options.skuProductName);
    
    // 카테고리
    if (options.category) {
      await this.selectCategory(options.category);
    }
    
    // 발주처/유통사/아티스트
    await this.selectVendor(options.vendor);
    await this.selectDistributor(options.distributor);
    await this.selectArtist(options.artist);
    
    // 과세여부
    if (options.taxable !== undefined) {
      await this.selectTaxable(options.taxable);
    }
    
    // 사용여부
    if (options.active !== undefined) {
      await this.selectActive(options.active);
    }
    
    // 상품사양
    await this.fillSpecifications({
      weight: options.weight,
      width: options.width,
      depth: options.depth,
      height: options.height,
      volume: options.volume,
    });
  }

  /**
   * SKU 생성 버튼 클릭
   */
  async clickCreate(): Promise<void> {
    // 버튼이 활성화될 때까지 대기
    await expect(this.createButton).toBeEnabled({ timeout: this.timeouts.navigation });
    console.log('ℹ️ SKU 생성하기 버튼 클릭 시도...');
    
    // 버튼이 viewport에 보이도록 스크롤
    await this.createButton.scrollIntoViewIfNeeded();
    await this.wait(300);
    
    // 클릭 (네비게이션 발생 여부 확인)
    await this.createButton.click();
    await this.wait(1000);
    
    console.log('ℹ️ 버튼 클릭 완료');
  }

  /**
   * SKU 생성 및 목록 페이지로 이동
   */
  async submitAndWaitForList(): Promise<void> {
    await this.clickCreate();
    
    // 네비게이션 대기 (최대 10초)
    try {
      await this.page.waitForURL('**/sku/list**', { timeout: 10000 });
      console.log('ℹ️ SKU 목록 페이지로 자동 이동됨');
    } catch {
      console.log('ℹ️ 네비게이션 미발생 (10초 대기)');
      console.log(`ℹ️ 버튼 클릭 후 현재 URL: ${this.page.url()}`);
      
      // 수동으로 목록 페이지로 이동
      await this.page.goto(`${this.baseUrl}/sku/list`);
      await this.page.waitForLoadState('networkidle');
      console.log('ℹ️ SKU 목록 페이지로 수동 이동...');
    }
  }
}
