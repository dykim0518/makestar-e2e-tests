/**
 * 대분류 생성 페이지 객체
 * 
 * URL: https://stage-new-admin.makeuni2026.com/product/new/create
 * 
 * 대분류 생성 폼 구조:
 * - 대분류명 (한국어, 영어, 중국어, 일본어)
 * - 유통사/아티스트 선택 (combobox - multiselect)
 * - 발매일
 * - 이미지 업로드
 */

import { Page, Locator, expect } from '@playwright/test';
import { AdminBasePage, ADMIN_TIMEOUTS } from './admin-base.page';
import * as path from 'path';

// ============================================================================
// 대분류 생성 옵션 타입
// ============================================================================

export interface CategoryCreateOptions {
  /** 대분류명 (한국어) */
  nameKr: string;
  /** 대분류명 (영어) */
  nameEn: string;
  /** 유통사명 (검색어) */
  distributor: string;
  /** 아티스트명 (선택 텍스트) */
  artist: string;
  /** 발매일 (YYYY-MM-DD) */
  releaseDate: string;
  /** 이미지 파일 경로 */
  imagePath: string;
}

// ============================================================================
// 대분류 생성 페이지 클래스
// ============================================================================

export class CategoryCreatePage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 로케이터 정의
  // --------------------------------------------------------------------------
  
  // 폼 필드 - 실제 UI placeholder 기반
  readonly nameKrInput: Locator;
  readonly nameEnInput: Locator;
  readonly nameZhInput: Locator;
  readonly nameJaInput: Locator;
  readonly releaseDateInput: Locator;
  readonly imageUploadArea: Locator;
  readonly fileInput: Locator;
  
  // 유통사/아티스트 combobox
  readonly distributorCombobox: Locator;
  readonly artistCombobox: Locator;
  
  // 액션 버튼
  readonly createButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);
    
    // 대분류명 입력 필드
    this.nameKrInput = page.getByPlaceholder('한국어명를 입력해주세요');
    this.nameEnInput = page.getByPlaceholder('영어명을 입력해주세요');
    this.nameZhInput = page.getByPlaceholder('중국어명을 입력해주세요');
    this.nameJaInput = page.getByPlaceholder('일본어명을 입력해주세요');
    
    // 유통사/아티스트 combobox (multiselect 컴포넌트)
    this.distributorCombobox = page.locator('div:has(> div:has-text("유통사를 선택해주세요"))').first();
    this.artistCombobox = page.locator('div:has(> div:has-text("아티스트를 선택해주세요"))').first();
    
    // 발매일 입력
    this.releaseDateInput = page.getByPlaceholder('발매일을 입력해주세요 (YYYY-MM-DD)');
    
    // 이미지 업로드 영역
    this.imageUploadArea = page.locator('text=여기로 파일을 드래그').locator('..');
    this.fileInput = page.locator('input[type="file"]');
    
    // 액션 버튼
    this.createButton = page.getByRole('button', { name: '대분류 생성 완료' });
    this.cancelButton = page.getByRole('button', { name: '취소하기' });
  }

  // --------------------------------------------------------------------------
  // 페이지 정보 (추상 메서드 구현)
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/product/new/create`;
  }

  getHeadingText(): string {
    return '대분류 등록';
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

  // --------------------------------------------------------------------------
  // 폼 입력 메서드
  // --------------------------------------------------------------------------

  /**
   * 대분류명 (한국어) 입력
   */
  async fillNameKr(name: string): Promise<void> {
    await this.nameKrInput.waitFor({ state: 'visible', timeout: this.timeouts.medium });
    await this.nameKrInput.fill(name);
  }

  /**
   * 대분류명 (영어) 입력
   */
  async fillNameEn(name: string): Promise<void> {
    await this.nameEnInput.waitFor({ state: 'visible', timeout: this.timeouts.medium });
    await this.nameEnInput.fill(name);
  }

  /**
   * 열려있는 "새로운 제작사 등록" 모달 닫기
   * 주의: "취소" 버튼은 페이지의 "취소하기" 버튼과 혼동될 수 있으므로 사용하지 않음
   */
  async closeModalIfVisible(): Promise<void> {
    // "새로운 제작사 등록" 모달이 열렸는지 확인
    const modalTitle = this.page.getByText('새로운 제작사 등록');
    const isModalVisible = await modalTitle.isVisible({ timeout: 1000 }).catch(() => false);
    
    if (!isModalVisible) {
      return; // 모달이 없으면 아무것도 하지 않음
    }
    
    // 모달 헤더 옆의 X 버튼 찾기 (img 태그로 된 닫기 버튼)
    // 구조: div > p(새로운 제작사 등록) + img(cursor:pointer)
    const closeBtn = this.page.locator('text=새로운 제작사 등록').locator('xpath=following-sibling::img');
    
    if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
      await closeBtn.click();
      await this.wait(300);
      console.log('ℹ️ 모달 X 버튼으로 닫힘');
      return;
    }
    
    // 대안: ESC 키로 모달 닫기
    await this.page.keyboard.press('Escape');
    await this.wait(300);
    console.log('ℹ️ 모달 ESC로 닫힘');
  }

  /**
   * 유통사 검색 및 선택 (multiselect combobox)
   * @param searchTerm 검색어 (예: "메이크스타")
   */
  async selectDistributor(searchTerm: string): Promise<void> {
    // 오버레이가 사라질 때까지 대기
    await this.waitForOverlayToDisappear();
    
    // multiselect 컴포넌트 찾기 (유통사) - placeholder 텍스트 기반
    const distributorContainer = this.page.locator('.multiselect:has([placeholder*="유통사"])').first();
    
    // fallback: 첫 번째 multiselect
    const multiselectContainer = await distributorContainer.isVisible({ timeout: 1000 }).catch(() => false)
      ? distributorContainer
      : this.page.locator('.multiselect').first();
    
    // 컨테이너 클릭하여 드롭다운 열기
    await multiselectContainer.click({ force: true });
    await this.wait(500);
    
    // 검색 입력 필드 찾기 (드롭다운이 열리면 input이 visible됨)
    const searchInput = this.page.locator('input.multiselect__input:visible').first();
    
    // input이 보이면 검색어 입력
    const isInputVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
    if (isInputVisible) {
      await searchInput.fill(searchTerm);
      await this.wait(1500); // 검색 결과 API 응답 대기 (더 길게)
    }
    
    // 드롭다운 내용 확인을 위한 대기
    await this.page.locator('.multiselect__content-wrapper:visible').waitFor({ 
      state: 'visible', 
      timeout: 5000 
    }).catch(() => {});
    
    // 검색 결과에서 검색어를 포함하는 유효 옵션 찾기
    // "새로운 제작사 등록" / "검색결과가 없습니다" 제외
    const validOptions = this.page.locator('.multiselect__option:visible')
      .filter({ hasNotText: /새로운 제작사 등록|검색결과가 없습니다/ });
    
    // 검색어를 포함하는 옵션 찾기
    const matchingOption = validOptions.filter({ hasText: searchTerm }).first();
    
    if (await matchingOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      const optionText = await matchingOption.textContent();
      await matchingOption.click();
      console.log(`ℹ️ 유통사 선택: ${optionText?.trim()}`);
    } else {
      // 유효 옵션 중 첫 번째 선택 (정확한 매칭 실패시)
      const firstValidOption = validOptions.first();
      
      if (await firstValidOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        const optionText = await firstValidOption.textContent();
        // 텍스트가 비어있거나 "undefined" 포함이면 선택하지 않음
        if (optionText && !optionText.includes('undefined') && optionText.trim().length > 0) {
          await firstValidOption.click();
          console.log(`ℹ️ 유통사 선택(첫번째): ${optionText?.trim()}`);
        } else {
          console.log('⚠️ 유효한 유통사 옵션을 찾을 수 없음 - 검색 결과가 비어있음');
        }
      } else {
        console.log('⚠️ 유통사 옵션을 찾을 수 없음');
      }
    }
    
    await this.wait(500);
    
    // 모달이 열렸다면 닫기
    await this.closeModalIfVisible();
  }

  /**
   * 아티스트 선택 (multiselect combobox)
   * @param artistName 아티스트명 (예: "테스트123")
   */
  async selectArtist(artistName: string): Promise<void> {
    // 오버레이가 사라질 때까지 대기
    await this.waitForOverlayToDisappear();
    
    // 모달이 열려있으면 닫기
    await this.closeModalIfVisible();
    
    // 유통사/아티스트 섹션의 combobox 찾기
    // 유통사/아티스트 레이블 아래에 두 개의 combobox가 있음
    // 두 번째 combobox가 아티스트
    const comboboxes = this.page.locator('[role="combobox"]');
    const artistCombobox = comboboxes.nth(1); // 두 번째 combobox
    
    // combobox가 visible한지 확인
    const isVisible = await artistCombobox.isVisible({ timeout: 3000 }).catch(() => false);
    if (!isVisible) {
      console.log('⚠️ 아티스트 combobox를 찾을 수 없음, multiselect로 시도');
      // fallback: .multiselect 사용
      const multiselects = this.page.locator('.multiselect');
      await multiselects.nth(1).click({ force: true });
    } else {
      // combobox 클릭하여 드롭다운 열기
      await artistCombobox.click({ force: true });
    }
    await this.wait(500);
    
    // 검색 입력 필드 찾기 - :visible 사용
    const searchInput = this.page.locator('input.multiselect__input:visible').first();
    
    const isInputVisible = await searchInput.isVisible({ timeout: 3000 }).catch(() => false);
    if (isInputVisible) {
      await searchInput.fill(artistName);
      await this.wait(1500); // 검색 결과 API 응답 대기 (더 길게)
    }
    
    // 드롭다운 내용 확인을 위한 대기
    await this.page.locator('.multiselect__content-wrapper:visible').waitFor({ 
      state: 'visible', 
      timeout: 5000 
    }).catch(() => {});
    
    // 검색 결과에서 검색어를 포함하는 유효 옵션 찾기
    // "새로운 아티스트 등록" / "검색결과가 없습니다" 제외
    const validOptions = this.page.locator('.multiselect__option:visible')
      .filter({ hasNotText: /새로운 아티스트 등록|검색결과가 없습니다/ });
    
    // 검색어를 포함하는 옵션 찾기
    const matchingOption = validOptions.filter({ hasText: artistName }).first();
    
    if (await matchingOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      const optionText = await matchingOption.textContent();
      await matchingOption.click();
      console.log(`ℹ️ 아티스트 선택: ${optionText?.trim()}`);
    } else {
      // 유효 옵션 중 첫 번째 선택 (정확한 매칭 실패시)
      const firstValidOption = validOptions.first();
      
      if (await firstValidOption.isVisible({ timeout: 1000 }).catch(() => false)) {
        const optionText = await firstValidOption.textContent();
        // 텍스트가 비어있거나 잘못된 값이면 선택하지 않음
        if (optionText && !optionText.includes('undefined') && optionText.trim().length > 0 && !optionText.includes('()')) {
          await firstValidOption.click();
          console.log(`ℹ️ 아티스트 선택(첫번째): ${optionText?.trim()}`);
        } else {
          console.log('⚠️ 유효한 아티스트 옵션을 찾을 수 없음 - 검색 결과가 비어있음');
        }
      } else {
        console.log('⚠️ 아티스트 옵션을 찾을 수 없음');
      }
    }
    
    await this.wait(300);
  }

  /**
   * 발매일 입력
   * @param date YYYY-MM-DD 형식
   */
  async fillReleaseDate(date: string): Promise<void> {
    await this.releaseDateInput.waitFor({ state: 'visible', timeout: this.timeouts.medium });
    await this.releaseDateInput.fill(date);
    await this.releaseDateInput.press('Tab'); // blur 이벤트 발생
    await this.wait(300);
  }

  /**
   * 이미지 파일 업로드
   * @param filePath 파일 경로 (상대 또는 절대)
   */
  async uploadImage(filePath: string): Promise<void> {
    // 절대 경로 변환
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.resolve(__dirname, '..', filePath);
    
    // 파일 입력 필드 찾기 (hidden이어도 setInputFiles 가능)
    const fileInput = this.page.locator('input[type="file"]').first();
    
    // setInputFiles로 파일 업로드
    await fileInput.setInputFiles(absolutePath);
    await this.wait(1000);
    
    console.log(`ℹ️ 이미지 업로드 시도: ${absolutePath}`);
  }

  /**
   * 대분류 생성 폼 전체 입력
   */
  async fillCreateForm(options: CategoryCreateOptions): Promise<void> {
    // 1. 대분류명 (한국어)
    await this.fillNameKr(options.nameKr);
    
    // 2. 대분류명 (영어)
    await this.fillNameEn(options.nameEn);
    
    // 3. 유통사 선택
    await this.selectDistributor(options.distributor);
    
    // 4. 아티스트 선택
    await this.selectArtist(options.artist);
    
    // 5. 발매일 입력
    await this.fillReleaseDate(options.releaseDate);
    
    // 6. 이미지 업로드
    await this.uploadImage(options.imagePath);
  }

  // --------------------------------------------------------------------------
  // 액션 메서드
  // --------------------------------------------------------------------------

  /**
   * 대분류 생성 완료 버튼 클릭
   */
  async clickCreate(): Promise<void> {
    // 버튼이 활성화될 때까지 대기
    await expect(this.createButton).toBeEnabled({ timeout: this.timeouts.navigation });
    console.log('ℹ️ 대분류 생성 완료 버튼 클릭 시도...');
    
    // 버튼이 viewport에 보이도록 스크롤
    await this.createButton.scrollIntoViewIfNeeded();
    await this.wait(500);
    
    // 네비게이션 발생 대기하면서 클릭 (10초 타임아웃)
    await Promise.all([
      this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(e => {
        console.log('ℹ️ 네비게이션 미발생 (10초 대기)');
        return null;
      }),
      this.createButton.click({ force: true }),
    ]);
    
    console.log('ℹ️ 버튼 클릭 완료');
  }

  /**
   * 대분류 생성 완료 및 목록 페이지 이동 대기
   */
  async submitAndWaitForList(): Promise<void> {
    await this.clickCreate();
    
    // 짧은 대기 후 현재 URL 확인
    await this.wait(3000);
    const currentUrl = this.page.url();
    console.log(`ℹ️ 버튼 클릭 후 현재 URL: ${currentUrl}`);
    
    // 목록 페이지가 아니면 직접 이동
    if (!currentUrl.includes('/product/new/list')) {
      console.log('ℹ️ 목록 페이지로 수동 이동...');
      await this.page.goto(`${this.baseUrl}/product/new/list`);
    }
    
    await this.waitForLoadState('domcontentloaded');
  }

  /**
   * 취소 버튼 클릭
   */
  async clickCancel(): Promise<void> {
    await this.cancelButton.click();
    await this.waitForLoadState('domcontentloaded');
  }

  // --------------------------------------------------------------------------
  // Assertions
  // --------------------------------------------------------------------------

  /**
   * 생성 버튼 활성화 상태 검증
   */
  async assertCreateButtonEnabled(): Promise<void> {
    await expect(this.createButton).toBeEnabled({ timeout: this.timeouts.medium });
  }

  /**
   * 생성 버튼 비활성화 상태 검증
   */
  async assertCreateButtonDisabled(): Promise<void> {
    await expect(this.createButton).toBeDisabled({ timeout: this.timeouts.medium });
  }

  /**
   * 필수 입력 필드 존재 검증
   */
  async assertRequiredFieldsVisible(): Promise<void> {
    await expect(this.nameKrInput).toBeVisible({ timeout: this.timeouts.medium });
    await expect(this.nameEnInput).toBeVisible({ timeout: this.timeouts.medium });
  }
}
