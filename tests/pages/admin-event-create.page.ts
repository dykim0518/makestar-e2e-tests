/**
 * 상품(이벤트) 등록 페이지 객체
 * 
 * URL: https://stage-new-admin.makeuni2026.com/event/create
 * 
 * 상품 등록 폼 구조:
 * - 대분류 정보 선택 (multiselect)
 * - 상품명 (한국어, 영어, 중국어, 일본어)
 * - 이미지 업로드
 * - 노출 카테고리 (상품 카테고리, B2B 카테고리)
 * - 판매기간 (시작일, 종료일)
 * - 옵션(리워드) - 옵션명, 가격 등
 * - 상품설명 (tiptap 에디터)
 */

import { Page, Locator, expect } from '@playwright/test';
import { AdminBasePage, ADMIN_TIMEOUTS } from './admin-base.page';
import * as path from 'path';

// ============================================================================
// 상품 등록 옵션 타입
// ============================================================================

export interface EventCreateOptions {
  /** 상품명 (한국어) */
  nameKr?: string;
  /** 상품명 (영어) */
  nameEn?: string;
  /** 이미지 파일 경로 */
  imagePath?: string;
  /** 상품 카테고리 (예: '추천상품') */
  productCategory?: string;
  /** B2B 카테고리 (예: '앨범') */
  b2bCategory?: string;
  /** 옵션명 (한국어) */
  optionNameKr?: string;
  /** 옵션명 (영어) */
  optionNameEn?: string;
  /** 가격 정보 */
  price?: {
    /** 최종할인가 */
    finalPrice: number;
    /** 할인전 가격 */
    originalPrice: number;
    /** 할인률 */
    discountRate: number;
  };
  /** 상품설명 (한국어) */
  descriptionKr?: string;
  /** 상품설명 (영어) */
  descriptionEn?: string;
}

// ============================================================================
// 상품 등록 페이지 클래스
// ============================================================================

export class EventCreatePage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 로케이터 정의
  // --------------------------------------------------------------------------
  
  // 대분류 정보 선택
  readonly majorCategoryMultiselect: Locator;
  
  // 상품명 입력 필드
  readonly nameKrInput: Locator;
  readonly nameEnInput: Locator;
  readonly nameZhInput: Locator;
  readonly nameJaInput: Locator;
  
  // 이미지 업로드
  readonly fileInput: Locator;
  readonly imageUploadArea: Locator;
  
  // 노출 카테고리
  readonly productCategoryMultiselect: Locator;
  readonly b2bCategoryMultiselect: Locator;
  
  // 판매기간
  readonly salePeriodCheckbox: Locator;
  readonly saleStartDateInput: Locator;
  readonly saleEndDateInput: Locator;
  
  // 옵션(리워드)
  readonly addOptionButton: Locator;
  readonly optionKoTab: Locator;
  readonly optionEnTab: Locator;
  readonly optionNameInput: Locator;  // placeholder="Placeholder"
  
  // 상품설명 에디터 (tiptap)
  readonly descriptionKoTab: Locator;
  readonly descriptionEnTab: Locator;
  readonly descriptionEditor: Locator;
  
  // 액션 버튼
  readonly submitButton: Locator;
  readonly previewButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);
    
    // 대분류 정보 multiselect (index 1 - 복사등록은 index 0)
    this.majorCategoryMultiselect = page.locator('.multiselect').nth(1);
    
    // 상품명 입력 필드
    this.nameKrInput = page.getByPlaceholder('한글 값을 입력해주세요');
    this.nameEnInput = page.getByPlaceholder('영문 값을 입력해주세요');
    this.nameZhInput = page.getByPlaceholder('중문 값을 입력해주세요');
    this.nameJaInput = page.getByPlaceholder('일본어 값을 입력해주세요');
    
    // 이미지 업로드
    this.fileInput = page.locator('input[type="file"]').first();
    this.imageUploadArea = page.locator('text=여기로 파일을').locator('..');
    
    // 노출 카테고리 multiselect - 라벨 기준으로 찾기
    // 상품 카테고리: "상품 카테고리" 라벨 옆의 multiselect
    this.productCategoryMultiselect = page.locator('text=상품 카테고리').locator('..').locator('.multiselect');
    this.b2bCategoryMultiselect = page.locator('text=B2B 카테고리').locator('..').locator('.multiselect');
    
    // 판매기간
    this.salePeriodCheckbox = page.locator('input[type="checkbox"]').first();
    this.saleStartDateInput = page.getByPlaceholder('날짜 입력').first();
    this.saleEndDateInput = page.getByPlaceholder('날짜 입력').nth(1);
    
    // 옵션(리워드)
    this.addOptionButton = page.getByRole('button', { name: '옵션(리워드) 추가하기' });
    this.optionKoTab = page.locator('button:has-text("한국어")').first();
    this.optionEnTab = page.locator('button:has-text("영어")').first();
    this.optionNameInput = page.getByPlaceholder('옵션명을 입력해주세요');
    
    // 상품설명 - tiptap 에디터 (여러 개 중 해당 섹션의 것)
    this.descriptionKoTab = page.locator('text=상품설명').first().locator('..').locator('button:has-text("한국어")');
    this.descriptionEnTab = page.locator('text=상품설명').first().locator('..').locator('button:has-text("영어")');
    this.descriptionEditor = page.locator('.tiptap, .ProseMirror').first();
    
    // 액션 버튼
    this.submitButton = page.getByRole('button', { name: '지금 등록하기' });
    this.previewButton = page.getByRole('button', { name: '미리보기' });
  }

  // --------------------------------------------------------------------------
  // 페이지 정보 (추상 메서드 구현)
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/event/create`;
  }

  getHeadingText(): string {
    return '상품 등록';
  }

  // --------------------------------------------------------------------------
  // 대기 헬퍼 메서드
  // --------------------------------------------------------------------------

  /**
   * 페이지 로드 완료 대기
   */
  async waitForPageReady(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
    // 대분류 정보 multiselect가 보일 때까지 대기
    await expect(this.majorCategoryMultiselect).toBeVisible({ timeout: this.timeouts.medium });
  }

  /**
   * 로딩 오버레이 사라질 때까지 대기
   */
  async waitForOverlayToDisappear(): Promise<void> {
    // 여러 유형의 오버레이 확인
    const overlaySelectors = [
      'div[class*="fixed"][class*="z-"][class*="background-inverse"]',
      'div[class*="fixed"][class*="z-100"]',
      'div[class*="overlay"]',
      'div[class*="modal-backdrop"]',
    ];
    
    for (const selector of overlaySelectors) {
      const overlay = this.page.locator(selector).first();
      try {
        // 오버레이가 보이면 사라질 때까지 대기
        if (await overlay.isVisible({ timeout: 500 }).catch(() => false)) {
          await overlay.waitFor({ state: 'hidden', timeout: 10000 });
          console.log(`ℹ️ 오버레이 사라짐: ${selector}`);
        }
      } catch {
        // 오버레이가 없거나 이미 사라졌으면 무시
      }
    }
    
    await this.wait(300);
  }

  // --------------------------------------------------------------------------
  // 대분류 정보 선택
  // --------------------------------------------------------------------------

  /**
   * 대분류 정보 선택 (특정 대분류 또는 첫 번째 옵션 선택)
   * @param categoryName 선택할 대분류명 (선택사항, 없으면 첫 번째 선택)
   */
  async selectMajorCategory(categoryName?: string): Promise<string> {
    await this.waitForOverlayToDisappear();
    
    // multiselect 클릭하여 드롭다운 열기
    await this.majorCategoryMultiselect.click();
    await this.wait(500);
    
    // 로딩 완료 대기 - "조회 중" 텍스트가 사라질 때까지
    await this.page.locator('.multiselect__option:visible')
      .filter({ hasText: /조회 중/ })
      .waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    
    let targetOption;
    
    // 로딩 상태와 "검색결과가 없습니다" 텍스트를 제외한 유효 옵션만 필터링
    const invalidPatterns = /검색결과가 없습니다|조회 중|List is empty/i;
    
    if (categoryName) {
      // 특정 대분류 선택
      targetOption = this.page.locator('.multiselect__option:visible')
        .filter({ hasNotText: invalidPatterns })
        .filter({ hasText: categoryName })
        .first();
    } else {
      // 첫 번째 유효 옵션 선택
      targetOption = this.page.locator('.multiselect__option:visible')
        .filter({ hasNotText: invalidPatterns })
        .first();
    }
    
    const optionText = await targetOption.textContent() || '';
    
    if (await targetOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await targetOption.click({ force: true });
      console.log(`ℹ️ 대분류 선택: ${optionText.trim()}`);
    } else {
      console.log(`⚠️ 대분류 "${categoryName || '첫 번째'}" 옵션을 찾을 수 없음`);
    }
    
    await this.wait(500);
    return optionText.trim();
  }

  /**
   * 대분류 정보 선택 (가장 상위 옵션 선택) - 기존 메서드 호환용
   */
  async selectFirstMajorCategory(): Promise<string> {
    return this.selectMajorCategory();
  }

  // --------------------------------------------------------------------------
  // 이미지 업로드
  // --------------------------------------------------------------------------

  /**
   * 이미지 파일 업로드
   * @param filePath 파일 경로 (상대 또는 절대)
   */
  async uploadImage(filePath: string): Promise<void> {
    // 절대 경로 변환
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.resolve(__dirname, '..', filePath);
    
    // setInputFiles로 파일 업로드
    await this.fileInput.setInputFiles(absolutePath);
    await this.wait(1000);
    
    console.log(`ℹ️ 이미지 업로드: ${absolutePath}`);
  }

  // --------------------------------------------------------------------------
  // 노출 카테고리 선택
  // --------------------------------------------------------------------------

  /**
   * 상품 카테고리 선택
   * @param categoryName 카테고리명 (예: '추천상품')
   */
  async selectProductCategory(categoryName: string): Promise<void> {
    await this.waitForOverlayToDisappear();
    
    // 이전 드롭다운이 열려있으면 닫기
    await this.page.keyboard.press('Escape');
    await this.wait(300);
    
    // "상품 카테고리" 텍스트 기준으로 드롭다운 찾기
    const productCatContainer = this.page.locator('div:has(> div:text-is("상품 카테고리"))').first();
    
    // 컨테이너 내의 multiselect 찾기
    const multiselect = productCatContainer.locator('div.multiselect').first();
    
    if (await multiselect.isVisible({ timeout: 3000 }).catch(() => false)) {
      // 스크롤 후 Playwright click 사용 (force로 viewport 문제 회피)
      await multiselect.evaluate((el) => {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
      });
      await this.wait(300);
      
      // focus 후 클릭 - 이벤트 시뮬레이션
      await multiselect.focus();
      await this.wait(100);
      
      // dispatchEvent로 mousedown, mouseup, click 시퀀스 실행
      await multiselect.evaluate((el) => {
        el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      });
      
      await this.wait(500);
      
      // 드롭다운이 열렸는지 확인
      const isOpen = await multiselect.getAttribute('aria-expanded');
      if (isOpen !== 'true') {
        // 열리지 않았으면 input에 직접 focus
        const input = multiselect.locator('input.multiselect__input');
        if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
          await input.click({ force: true });
          await this.wait(500);
        }
      }
    } else {
      console.log('⚠️ 상품 카테고리 multiselect를 찾을 수 없음');
      return;
    }
    
    // 로딩 완료 대기
    await this.page.locator('.multiselect__option:visible').filter({ hasText: '조회 중' })
      .waitFor({ state: 'hidden', timeout: 5000 }).catch(() => {});
    
    // 검색어를 포함하는 옵션 선택
    const targetOption = this.page.locator('.multiselect__option:visible')
      .filter({ hasText: categoryName })
      .filter({ hasNotText: /검색결과가 없습니다|List is empty/i })
      .first();
    
    if (await targetOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await targetOption.click({ force: true });
      console.log(`ℹ️ 상품 카테고리 선택: ${categoryName}`);
    } else {
      // 대체: 첫 번째 유효한 옵션 선택
      console.log(`⚠️ 상품 카테고리 "${categoryName}"을 찾을 수 없음 - 첫 번째 옵션 선택 시도`);
      const fallbackOption = this.page.locator('.multiselect__option:visible')
        .filter({ hasNotText: /검색결과가 없습니다|조회 중|List is empty/i })
        .first();
      
      if (await fallbackOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        const optionText = await fallbackOption.textContent();
        await fallbackOption.click({ force: true });
        console.log(`ℹ️ 대체 상품 카테고리 선택: ${optionText?.trim()}`);
      } else {
        console.log(`⚠️ 선택 가능한 상품 카테고리 없음`);
      }
    }
    
    await this.wait(300);
  }

  /**
   * B2B 카테고리 선택
   * @param categoryName 카테고리명 (예: '앨범')
   */
  async selectB2BCategory(categoryName: string): Promise<void> {
    await this.waitForOverlayToDisappear();
    
    // 이전 드롭다운이 열려있으면 닫기
    await this.page.keyboard.press('Escape');
    await this.wait(300);
    
    // "노출 카테고리" 섹션으로 스크롤
    const categorySection = this.page.locator('text=노출 카테고리').first();
    if (await categorySection.isVisible({ timeout: 2000 }).catch(() => false)) {
      await categorySection.scrollIntoViewIfNeeded();
      await this.wait(500);
    }
    
    // B2B 카테고리 multiselect로 스크롤 후 force 클릭
    await this.b2bCategoryMultiselect.scrollIntoViewIfNeeded();
    await this.wait(300);
    await this.b2bCategoryMultiselect.click({ force: true });
    await this.wait(500);
    
    const targetOption = this.page.locator('.multiselect__option:visible')
      .filter({ hasText: categoryName })
      .first();
    
    if (await targetOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await targetOption.click({ force: true });
      console.log(`ℹ️ B2B 카테고리 선택: ${categoryName}`);
    } else {
      console.log(`⚠️ B2B 카테고리 "${categoryName}"을 찾을 수 없음`);
    }
    
    await this.wait(300);
  }

  // --------------------------------------------------------------------------
  // 판매기간 설정
  // --------------------------------------------------------------------------

  /**
   * 판매기간 당일 선택 (달력에서 오늘 날짜 클릭)
   */
  async selectTodayAsSalePeriod(): Promise<void> {
    await this.waitForOverlayToDisappear();
    
    // '판매기간' 텍스트 바로 다음에 오는 날짜 입력 필드를 찾음
    // 페이지 구조상 '판매기간' p 태그 다음 형제 요소에 날짜 입력 필드가 있음
    const salePeriodLabel = this.page.locator('p:text-is("판매기간")');
    await salePeriodLabel.scrollIntoViewIfNeeded();
    await this.wait(300);
    
    // 판매기간 레이블 상위 컨테이너에서 날짜 입력 필드 찾기
    const dateInputs = this.page.locator('input[placeholder="날짜 입력"]');
    const inputCount = await dateInputs.count();
    console.log(`ℹ️ 페이지의 날짜 입력 필드 수: ${inputCount}`);
    
    // 판매기간 필드는 일반적으로 세 번째 날짜 입력 (첫 번째: 초도특전, 두 번째: 선주문)
    // 하지만 index 순서가 다를 수 있으니 판매기간 섹션에서 찾기
    const dateInput = dateInputs.nth(2); // 세 번째 날짜 입력 필드 (0-indexed)
    
    // 입력 필드 클릭하여 달력 열기
    await dateInput.click({ force: true });
    await this.wait(500);
    
    // 오늘 날짜 가져오기
    const today = new Date();
    const todayDate = today.getDate();
    
    // 달력이 열리면 현재 달의 날짜들이 표시됨
    // 달력에서 정확히 오늘 날짜를 클릭 (현재 달에서만)
    // 달력 셀은 cursor-pointer 클래스를 가진 div 내에 숫자가 텍스트로 있음
    
    // 달력이 열렸는지 확인
    const calendarVisible = await this.page.locator('img[alt="left-arrow"]').isVisible({ timeout: 3000 }).catch(() => false);
    
    if (calendarVisible) {
      // 현재 달의 날짜만 선택하기 위해, 달력 그리드에서 오늘 날짜 찾기
      // 정확한 숫자 매칭으로 날짜 셀 클릭
      const todayCell = this.page.getByText(String(todayDate), { exact: true }).first();
      await todayCell.click();
      console.log(`ℹ️ 판매기간 시작일: ${todayDate}일 선택 완료 (달력 자동 닫힘)`);
    } else {
      // 달력이 안 열리면 날짜를 직접 입력
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      await dateInput.fill(dateStr);
      console.log(`ℹ️ 판매기간 시작일 직접 입력: ${dateStr}`);
    }
    
    await this.wait(500);
  }

  // --------------------------------------------------------------------------
  // 옵션(리워드) 설정
  // --------------------------------------------------------------------------

  /**
   * 옵션(리워드) 추가
   */
  async addOption(): Promise<void> {
    // 오버레이 대기
    await this.waitForOverlayToDisappear();
    
    await this.addOptionButton.scrollIntoViewIfNeeded();
    await this.wait(300);
    
    // force 클릭 사용
    await this.addOptionButton.click({ force: true });
    await this.wait(1000);
    console.log('ℹ️ 옵션(리워드) 추가됨');
  }

  /**
   * 옵션명 입력 (한국어)
   * @param optionName 옵션명
   */
  async fillOptionNameKr(optionName: string): Promise<void> {
    // 옵션 영역의 한국어 탭 클릭
    const optionKoTabs = this.page.locator('button:has-text("한국어")');
    const tabCount = await optionKoTabs.count();
    
    // 옵션 영역의 한국어 탭 클릭 (보통 첫 번째 또는 두 번째)
    if (tabCount > 0) {
      await optionKoTabs.nth(0).click({ force: true });
      await this.wait(300);
    }
    
    // 옵션명 입력 필드 찾기 (여러 개 있을 수 있음)
    const optionInputs = this.page.getByPlaceholder('옵션명을 입력해주세요');
    const inputCount = await optionInputs.count();
    
    if (inputCount > 0) {
      const optionInput = optionInputs.first();
      await optionInput.scrollIntoViewIfNeeded();
      await this.wait(300);
      await optionInput.click({ force: true });
      await this.wait(200);
      await optionInput.fill(optionName);
      console.log(`ℹ️ 옵션명(한국어) 입력: ${optionName}`);
    } else {
      console.log('⚠️ 옵션명 입력 필드를 찾을 수 없음');
    }
  }

  /**
   * 옵션명 입력 (영어)
   * @param optionName 옵션명
   */
  async fillOptionNameEn(optionName: string): Promise<void> {
    // 옵션 영역의 영어 탭 클릭
    const optionEnTabs = this.page.locator('button:has-text("영어")');
    const tabCount = await optionEnTabs.count();
    
    if (tabCount > 0) {
      await optionEnTabs.nth(0).click({ force: true });
      await this.wait(300);
    }
    
    // 영어 탭에서 옵션명 입력 필드 찾기
    const optionInputs = this.page.getByPlaceholder('옵션명을 입력해주세요');
    const inputCount = await optionInputs.count();
    
    if (inputCount > 0) {
      const optionInput = optionInputs.first();
      await optionInput.scrollIntoViewIfNeeded();
      await this.wait(300);
      await optionInput.click({ force: true });
      await this.wait(200);
      await optionInput.fill(optionName);
      console.log(`ℹ️ 옵션명(영어) 입력: ${optionName}`);
    } else {
      console.log('⚠️ 영어 옵션명 입력 필드를 찾을 수 없음');
    }
  }

  /**
   * 가격 설정 (팝업 사용) - 할인전/할인률 입력
   * @param originalPrice 할인전 가격
   * @param discountRate 할인률 (%)
   */
  async setPriceWithDiscount(originalPrice: number, discountRate: number): Promise<void> {
    await this.waitForOverlayToDisappear();
    
    // 옵션 테이블 영역 스크롤
    const optionSection = this.page.locator('text=옵션(리워드)').first();
    await optionSection.scrollIntoViewIfNeeded();
    await this.wait(500);
    
    // 가격 셀 찾기
    let priceCell = this.page.getByText('₩0').first();
    let hasPriceCell = await priceCell.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!hasPriceCell) {
      priceCell = this.page.locator('text=/₩[0-9,]+/').first();
      hasPriceCell = await priceCell.isVisible({ timeout: 1000 }).catch(() => false);
    }
    
    if (hasPriceCell) {
      await priceCell.click();
      await this.wait(500);
      
      // 가격 설정 팝업 대기
      const pricePopup = this.page.getByText('가격설정');
      if (await pricePopup.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('ℹ️ 가격 설정 팝업 열림');
        
        // 가격 입력 필드들 찾기
        const priceInputs = this.page.getByPlaceholder('가격을 입력하세요');
        const inputCount = await priceInputs.count();
        console.log(`ℹ️ 가격 입력 필드 수: ${inputCount}`);
        
        // 할인전 가격 입력 (첫 번째 필드)
        if (inputCount >= 1) {
          await priceInputs.nth(0).fill(String(originalPrice));
          console.log(`ℹ️ 할인전 가격 입력: ${originalPrice}`);
          await this.wait(300);
        }
        
        // 할인율 입력 - 여러 패턴 시도
        let discountFilled = false;
        
        // 패턴 1: '할인율을 입력하세요' placeholder
        const discountInput1 = this.page.getByPlaceholder('할인율을 입력하세요');
        if (await discountInput1.isVisible({ timeout: 500 }).catch(() => false)) {
          await discountInput1.fill(String(discountRate));
          console.log(`ℹ️ 할인률 입력: ${discountRate}%`);
          discountFilled = true;
        }
        
        // 패턴 2: '할인률을 입력하세요' placeholder
        if (!discountFilled) {
          const discountInput2 = this.page.getByPlaceholder('할인률을 입력하세요');
          if (await discountInput2.isVisible({ timeout: 500 }).catch(() => false)) {
            await discountInput2.fill(String(discountRate));
            console.log(`ℹ️ 할인률 입력: ${discountRate}%`);
            discountFilled = true;
          }
        }
        
        // 패턴 3: 가격 입력 필드가 3개면 두 번째가 할인율
        if (!discountFilled && inputCount >= 2) {
          await priceInputs.nth(1).fill(String(discountRate));
          console.log(`ℹ️ 할인률 입력 (두 번째 필드): ${discountRate}%`);
          discountFilled = true;
          await this.wait(300);
        }
        
        // 최종 할인가 계산해서 입력 (세 번째 필드가 있으면)
        if (inputCount >= 3) {
          const finalPrice = Math.round(originalPrice * (1 - discountRate / 100));
          await priceInputs.nth(2).fill(String(finalPrice));
          console.log(`ℹ️ 최종 할인가 입력: ${finalPrice}`);
          await this.wait(300);
        }
        
        // 적용하기 버튼 클릭
        const applyButton = this.page.getByRole('button', { name: '적용하기' });
        if (await applyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await applyButton.click();
          console.log(`ℹ️ 가격 설정 완료: 할인전 ${originalPrice}원, 할인률 ${discountRate}%`);
          await this.wait(500);
        }
      } else {
        console.log('⚠️ 가격 설정 팝업이 열리지 않음');
      }
    } else {
      console.log('ℹ️ 가격 셀을 찾을 수 없음 - 기존 가격이 설정되어 있을 수 있음');
    }
    
    await this.wait(300);
  }

  /**
   * 가격 설정 (팝업 사용)
   * @param finalPrice 최종할인가
   */
  async setPrice(finalPrice: number): Promise<void> {
    await this.waitForOverlayToDisappear();
    
    // 옵션 테이블 영역 스크롤
    const optionSection = this.page.locator('text=옵션(리워드)').first();
    await optionSection.scrollIntoViewIfNeeded();
    await this.wait(500);
    
    // 가격 셀 찾기 (여러 패턴 지원)
    // 1. ₩0 (초기 상태)
    // 2. ₩ 기호가 있는 가격 셀 (기존 가격이 있는 경우)
    let priceCell = this.page.getByText('₩0').first();
    let hasPriceCell = await priceCell.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (!hasPriceCell) {
      // 기존 가격이 있는 경우: 가격 컬럼의 셀 찾기
      // 옵션 행에서 가격 정보가 있는 영역 (₩ + 숫자 패턴)
      priceCell = this.page.locator('[ref*="e740"], [ref*="e741"], [ref*="e742"]').first();
      hasPriceCell = await priceCell.isVisible({ timeout: 1000 }).catch(() => false);
      
      if (!hasPriceCell) {
        // 대체: 가격 컬럼 헤더 "가격" 기준으로 같은 열의 셀 찾기
        priceCell = this.page.locator('text=/₩[0-9,]+/').first();
        hasPriceCell = await priceCell.isVisible({ timeout: 1000 }).catch(() => false);
      }
    }
    
    if (hasPriceCell) {
      await priceCell.click();
      await this.wait(500);
      
      // 가격 설정 팝업 대기
      const pricePopup = this.page.getByText('가격설정');
      if (await pricePopup.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('ℹ️ 가격 설정 팝업 열림');
        
        // 최종할인가 입력 (첫 번째 입력 필드)
        const priceInput = this.page.getByPlaceholder('가격을 입력하세요').first();
        await priceInput.fill(String(finalPrice));
        console.log(`ℹ️ 최종할인가 입력: ${finalPrice}`);
        
        // 적용하기 버튼 클릭
        const applyButton = this.page.getByRole('button', { name: '적용하기' });
        if (await applyButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await applyButton.click();
          console.log(`ℹ️ 가격 설정 완료: ${finalPrice}원`);
          await this.wait(500);
        }
      } else {
        console.log('⚠️ 가격 설정 팝업이 열리지 않음 - 기존 가격 유지');
      }
    } else {
      // 기존 가격이 있으면 건너뛰기 (복사 등록 모드)
      console.log('ℹ️ 가격 셀을 찾을 수 없음 - 기존 가격이 설정되어 있을 수 있음 (건너뜀)');
    }
    
    await this.wait(300);
  }

  /**
   * 옵션에 품목 추가 (필수)
   * 옵션 행의 "품목 추가" 버튼을 클릭하여 품목을 선택
   * 이미 품목이 추가된 경우 건너뜁니다
   */
  async addItemToOption(): Promise<boolean> {
    await this.waitForOverlayToDisappear();
    
    // 먼저 이미 품목이 추가되어 있는지 확인 - 여러 패턴으로 검색
    // 1. SKU 코드가 있는 경우
    // 2. 품목명에 types, random, pcs 등이 있는 경우
    // 3. 품목(KIT) 열에 텍스트박스나 이미지가 있는 경우 (type 아이콘)
    const existingItemPatterns = [
      this.page.locator('text=/\\d+types/i').first(),
      this.page.locator('text=/random \\d+pcs/i').first(),
      this.page.locator('img[alt="type"]').first(),
      this.page.locator('[ref*="e746"], [ref*="e757"], [ref*="e768"]').first(), // error-context의 품목 영역 ref
      this.page.locator('textbox').filter({ hasText: /Ver\.|types|pcs/i }).first(),
    ];
    
    for (const pattern of existingItemPatterns) {
      if (await pattern.isVisible({ timeout: 500 }).catch(() => false)) {
        console.log('ℹ️ 이미 품목이 추가되어 있음 - 건너뜀');
        return true;
      }
    }
    
    // 추가 확인: 품목(KIT) 열에 아이템이 있는지
    const kitColumn = this.page.locator('generic:has-text("품목(KIT)")').first();
    if (await kitColumn.isVisible({ timeout: 500 }).catch(() => false)) {
      // 품목 영역에서 이미지나 텍스트가 있는지 확인
      const kitContent = this.page.locator('[ref*="e743"], [ref*="e744"]');
      const contentCount = await kitContent.count();
      if (contentCount > 0) {
        const hasContent = await kitContent.first().locator('textbox, img').count() > 0;
        if (hasContent) {
          console.log('ℹ️ 이미 품목이 추가되어 있음 (KIT 열 확인) - 건너뜀');
          return true;
        }
      }
    }
    
    // 옵션 테이블에서 "품목 추가" 버튼 클릭
    const addItemButton = this.page.getByText('품목 추가').first();
    
    if (await addItemButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addItemButton.scrollIntoViewIfNeeded();
      await this.wait(300);
      await addItemButton.click();
      console.log('ℹ️ 품목 추가 버튼 클릭');
      await this.wait(1000);
      
      // 품목 추가 팝업 대기
      const popup = this.page.locator('text=옵션 품목 추가하기');
      if (await popup.isVisible({ timeout: 3000 }).catch(() => false)) {
        console.log('ℹ️ 품목 추가 팝업 열림');
        
        // 품목 테이블에서 체크박스가 있는 행 찾기
        // 검색결과가 없으면 없음
        const noResultText = this.page.getByText('검색결과가 없습니다');
        if (await noResultText.isVisible({ timeout: 1000 }).catch(() => false)) {
          console.log('⚠️ 연결된 품목(SKU)이 없습니다. 팝업 닫기');
          
          // 취소 버튼 클릭
          const cancelButton = this.page.getByRole('button', { name: '취소' });
          if (await cancelButton.isVisible({ timeout: 1000 }).catch(() => false)) {
            await cancelButton.click({ force: true });
            await this.wait(500);
          }
          return false;
        }
        
        // 품목이 있으면 첫 번째 체크박스 선택
        const firstItemCheckbox = this.page.locator('table tbody tr').first().locator('input[type="checkbox"]');
        if (await firstItemCheckbox.isVisible({ timeout: 2000 }).catch(() => false)) {
          await firstItemCheckbox.click({ force: true });
          console.log('ℹ️ 첫 번째 품목 선택');
          await this.wait(500);
          
          // "품목 추가하기" 버튼 클릭
          const addButton = this.page.getByRole('button', { name: '품목 추가하기' });
          if (await addButton.isEnabled({ timeout: 2000 })) {
            await addButton.click({ force: true });
            console.log('✅ 품목 추가 완료');
            await this.wait(500);
            return true;
          }
        }
      }
    } else {
      console.log('⚠️ 품목 추가 버튼을 찾을 수 없음');
    }
    
    return false;
  }

  /**
   * 판매량 기준 설정 (필수)
   * 옵션 행에서 판매량 기준을 선택
   * 이미 설정되어 있으면 건너뜁니다
   */
  async setSalesStandard(): Promise<void> {
    await this.waitForOverlayToDisappear();
    
    // 옵션 테이블 영역으로 스크롤
    const optionSection = this.page.locator('text=옵션(리워드)').first();
    await optionSection.scrollIntoViewIfNeeded();
    await this.wait(300);
    
    // 이미 판매량 기준이 설정되어 있는지 확인
    // 체크박스가 체크된 상태인지 확인
    const salesCheckbox = this.page.locator('input[type="checkbox"][checked]').filter({ 
      has: this.page.locator('xpath=./following-sibling::*[contains(text(), "음반") or contains(text(), "굿즈")]')
    }).first();
    
    // 대체: 이미 체크된 체크박스가 있는지 확인
    const checkedItems = this.page.locator('input[type="checkbox"]:checked');
    const checkedCount = await checkedItems.count();
    
    if (checkedCount > 0) {
      console.log('ℹ️ 판매량 기준이 이미 설정되어 있음 - 건너뜀');
      return;
    }
    
    // 판매량기준 컬럼 셀 클릭 (드롭다운 열기)
    // 옵션 행에서 판매량기준 영역 찾기
    const salesStandardCell = this.page.locator('[class*="dropdown"], [class*="select"]')
      .filter({ hasText: /판매량|음반|굿즈/i })
      .first();
    
    if (await salesStandardCell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await salesStandardCell.click();
      console.log('ℹ️ 판매량 기준 드롭다운 클릭');
      await this.wait(500);
      
      // 첫 번째 옵션 선택 (예: "음반")
      const option = this.page.locator('.multiselect__option:visible, [class*="option"]:visible')
        .filter({ hasNotText: /선택/ })
        .first();
      
      if (await option.isVisible({ timeout: 2000 }).catch(() => false)) {
        const optionText = await option.textContent() || '';
        await option.click({ force: true });
        console.log(`ℹ️ 판매량 기준 선택: ${optionText.trim()}`);
      }
    } else {
      // 대체 방법: 직접 선택하는 라디오 버튼이나 체크박스
      console.log('ℹ️ 판매량 기준 드롭다운을 찾지 못함 - 기존 값 유지');
    }
    
    await this.wait(300);
  }

  // --------------------------------------------------------------------------
  // 상품설명 입력
  // --------------------------------------------------------------------------

  /**
   * 상품설명 입력 (한국어)
   * @param description 설명 텍스트
   */
  async fillDescriptionKr(description: string): Promise<void> {
    // 상품설명 영역으로 스크롤
    const descSection = this.page.locator('text=상품설명').first();
    await descSection.scrollIntoViewIfNeeded();
    await this.wait(300);
    
    // 상품설명 영역의 한국어 탭 클릭
    const descKoTabs = this.page.locator('text=상품설명').first().locator('..').locator('..').locator('..').locator('button:has-text("한국어")');
    if (await descKoTabs.count() > 0) {
      await descKoTabs.first().click({ force: true });
      await this.wait(300);
    }
    
    // tiptap 에디터에 텍스트 입력 - contenteditable이 true인 것만 선택
    const descEditors = this.page.locator('.tiptap[contenteditable="true"], .ProseMirror[contenteditable="true"]');
    const editorCount = await descEditors.count();
    
    if (editorCount > 0) {
      // 첫 번째 편집 가능한 에디터 사용
      const editor = descEditors.first();
      
      // JavaScript로 스크롤 및 포커스 (viewport 문제 해결)
      await editor.evaluate((el: HTMLElement) => {
        el.scrollIntoView({ behavior: 'instant', block: 'center' });
      });
      await this.wait(500);
      
      // JavaScript로 focus 및 click
      await editor.evaluate((el: HTMLElement) => {
        el.focus();
        el.click();
      });
      await this.wait(300);
      
      // 텍스트 입력
      await this.page.keyboard.type(description);
      console.log(`ℹ️ 상품설명(한국어) 입력: ${description.substring(0, 30)}...`);
    } else {
      // contenteditable 에디터가 없으면 일반 textarea 시도
      const textarea = this.page.locator('textarea').first();
      if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
        await textarea.fill(description);
        console.log(`ℹ️ 상품설명(한국어) textarea 입력: ${description.substring(0, 30)}...`);
      } else {
        console.log('⚠️ 상품설명 입력 영역을 찾을 수 없음');
      }
    }
    
    await this.wait(300);
  }

  /**
   * 상품설명 입력 (영어)
   * @param description 설명 텍스트
   */
  async fillDescriptionEn(description: string): Promise<void> {
    // 상품설명 영역의 영어 탭 클릭
    const descEnTabs = this.page.locator('text=상품설명').first().locator('..').locator('..').locator('..').locator('button:has-text("영어")');
    if (await descEnTabs.count() > 0) {
      await descEnTabs.first().click({ force: true });
      await this.wait(300);
      
      // 영어 탭의 에디터에 텍스트 입력 - contenteditable이 true인 것만 선택
      const descEditors = this.page.locator('.tiptap[contenteditable="true"], .ProseMirror[contenteditable="true"]');
      const editorCount = await descEditors.count();
      
      if (editorCount > 0) {
        const editor = descEditors.first();
        
        // JavaScript로 스크롤 및 포커스 (viewport 문제 해결)
        await editor.evaluate((el: HTMLElement) => {
          el.scrollIntoView({ behavior: 'instant', block: 'center' });
        });
        await this.wait(500);
        
        // JavaScript로 focus 및 click
        await editor.evaluate((el: HTMLElement) => {
          el.focus();
          el.click();
        });
        await this.wait(300);
        
        // 텍스트 입력
        await this.page.keyboard.type(description);
        console.log(`ℹ️ 상품설명(영어) 입력: ${description.substring(0, 30)}...`);
      } else {
        console.log('⚠️ 영어 상품설명 입력 영역을 찾을 수 없음');
      }
    }
    
    await this.wait(300);
  }

  // --------------------------------------------------------------------------
  // 폼 제출
  // --------------------------------------------------------------------------

  /**
   * 상품 등록 제출 및 목록 페이지 대기
   */
  async submitAndWaitForList(): Promise<void> {
    // 지금 등록하기 버튼으로 스크롤
    await this.submitButton.scrollIntoViewIfNeeded();
    await this.wait(300);
    
    // 버튼 활성화 확인
    const isDisabled = await this.submitButton.isDisabled();
    if (isDisabled) {
      console.log('⚠️ 지금 등록하기 버튼이 비활성화 상태입니다. 필수 필드를 확인하세요.');
    }
    
    // 등록 버튼 클릭
    await this.submitButton.click();
    console.log('ℹ️ 지금 등록하기 버튼 클릭');
    
    // 목록 페이지로 리다이렉트 대기
    await this.page.waitForURL(/\/event\/list/, { timeout: this.timeouts.navigation });
    await this.page.waitForLoadState('domcontentloaded');
    
    console.log('✅ 상품 등록 완료, 목록 페이지로 이동');
  }

  /**
   * 상품 등록 전체 흐름 실행
   */
  async createProduct(options: EventCreateOptions): Promise<void> {
    // 1. 대분류 정보 선택 (가장 상위 값)
    await this.selectFirstMajorCategory();
    
    // 2. 이미지 업로드
    if (options.imagePath) {
      await this.uploadImage(options.imagePath);
    }
    
    // 3. 노출 카테고리 선택
    if (options.productCategory) {
      await this.selectProductCategory(options.productCategory);
    }
    if (options.b2bCategory) {
      await this.selectB2BCategory(options.b2bCategory);
    }
    
    // 4. 판매기간 설정 (당일)
    await this.selectTodayAsSalePeriod();
    
    // 5. 옵션(리워드) 추가 및 설정
    await this.addOption();
    
    if (options.optionNameKr) {
      await this.fillOptionNameKr(options.optionNameKr);
    }
    
    if (options.price) {
      await this.setPrice(options.price.finalPrice, options.price.originalPrice, options.price.discountRate);
    }
    
    if (options.optionNameEn) {
      await this.fillOptionNameEn(options.optionNameEn);
    }
    
    // 6. 상품설명 입력
    if (options.descriptionKr) {
      await this.fillDescriptionKr(options.descriptionKr);
    }
    if (options.descriptionEn) {
      await this.fillDescriptionEn(options.descriptionEn);
    }
    
    // 7. 등록 제출
    await this.submitAndWaitForList();
  }
}
