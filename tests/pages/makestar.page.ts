/**
 * MakestarPage - Makestar.com 페이지 객체
 * 
 * 이 클래스는 Makestar 웹사이트의 모든 페이지 상호작용을 캡슐화합니다.
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage, DEFAULT_TIMEOUTS, TimeoutConfig, ElementSearchResult } from './base.page';

// ============================================================================
// 타입 정의
// ============================================================================

/** 메뉴 항목 타입 */
export interface MenuItem {
  name: string;
  texts: readonly string[];
}

/** 상품 정보 타입 */
export interface ProductInfo {
  name?: string;
  price?: string;
  hasOptions: boolean;
}

/** Web Vitals 측정 결과 타입 */
export interface WebVitalsResult {
  /** First Contentful Paint (ms) */
  fcp: number;
  /** Largest Contentful Paint (ms) */
  lcp: number;
  /** Time to First Byte (ms) */
  ttfb: number;
  /** DOM Content Loaded (ms) */
  dcl: number;
  /** Load Complete (ms) */
  load: number;
  /** Cumulative Layout Shift */
  cls: number;
}

// ============================================================================
// 텍스트 패턴
// ============================================================================

export const MAKESTAR_TEXT_PATTERNS = {
  ENDED_TAB: ['종료된', 'Ended', 'Closed', 'Past', '종료'] as const,
  ONGOING_TAB: ['진행중', 'Ongoing', '진행', 'ongoing'] as const,
  PURCHASE_BTN: ['구매', 'buy', 'purchase', 'Purchase', 'Buy', '구매하기', 'product.purchase', 'Add to Cart', 'add to cart'] as const,
  OPTION_SELECT: ['옵션', 'Option', 'option', '선택', 'Select', 'select'] as const,
  QUANTITY: ['수량', 'Quantity', 'quantity', '개수'] as const,
} as const;

// ============================================================================
// MakestarPage 클래스
// ============================================================================

export class MakestarPage extends BasePage {
  // URL 정의
  readonly baseUrl = 'https://www.makestar.com';
  
  // --------------------------------------------------------------------------
  // 로케이터 정의 (멤버 변수)
  // --------------------------------------------------------------------------
  
  // 공통 요소
  readonly logo: Locator;
  readonly header: Locator;
  readonly navigation: Locator;
  
  // 검색 요소
  readonly searchButton: Locator;
  readonly searchInput: Locator;
  readonly cancelButton: Locator;
  
  // 네비게이션 버튼
  readonly homeButton: Locator;
  readonly eventButton: Locator;
  readonly shopButton: Locator;
  readonly fundingButton: Locator;
  
  // 프로필/인증 요소
  readonly profileButton: Locator;
  readonly googleLoginButton: Locator;
  readonly logoutButton: Locator;
  
  // 상품 관련 요소
  readonly eventCard: Locator;
  readonly shopProductCard: Locator;
  readonly quantityInput: Locator;
  readonly quantityPlusButton: Locator;
  readonly purchaseButton: Locator;
  readonly addToCartButton: Locator;
  
  // 장바구니 요소
  readonly cartItem: Locator;
  readonly cartCheckbox: Locator;
  readonly cartDeleteButton: Locator;

  // 검색 결과/필터 요소
  readonly searchResultCards: Locator;
  readonly filterTabs: Locator;
  readonly contentImages: Locator;

  constructor(page: Page, timeouts: TimeoutConfig = DEFAULT_TIMEOUTS) {
    super(page, timeouts);
    
    // 공통 요소 초기화
    this.logo = page.locator('img[alt="make-star"], img[alt*="makestar"]').first();
    this.header = page.locator('header').first();
    this.navigation = page.locator('nav, header, [class*="nav"]').first();
    
    // 검색 요소 초기화
    this.searchButton = page.locator('button').first();
    this.searchInput = page.getByPlaceholder(/검색어를 입력|검색|search|Enter a keyword|keyword/i);
    this.cancelButton = page.locator('button:has-text("취소"), button:has-text("Cancel")').first();
    
    // 네비게이션 버튼 초기화 - header/nav 영역 내부로 범위 제한하여 배너/카드 링크와 구분
    const navArea = page.locator('header, nav, [role="navigation"]');
    this.homeButton = navArea.getByRole('link', { name: /home/i }).first();
    this.eventButton = navArea.getByRole('link', { name: /event/i }).first();
    this.shopButton = navArea.getByRole('link', { name: /shop/i }).first();
    this.fundingButton = navArea.getByRole('link', { name: /funding/i }).first();
    
    // 프로필/인증 요소 초기화
    this.profileButton = page.locator('button:has(img[alt="profile"]), img[alt="profile"]').first();
    this.googleLoginButton = page.locator('button:has-text("Google"), [class*="google"]').first();
    this.logoutButton = page.locator('text=/로그아웃|logout|log out|sign out/i').first();
    
    // 상품 관련 요소 초기화
    this.eventCard = page.locator('img[alt="event-thumb-image"]').first();
    this.shopProductCard = page.locator('img[alt="album_image"]');
    this.quantityInput = page.locator('input[type="number"], [class*="quantity"] input').first();
    this.quantityPlusButton = page.locator('button:has-text("+"), [class*="plus"]').first();
    this.purchaseButton = page.locator('button:has-text("purchase"), button:has-text("구매"), button:has-text("buy")').first();
    this.addToCartButton = page.locator('button:has-text("장바구니"), button:has-text("cart"), button:has-text("Cart")').first();
    
    // 장바구니 요소 초기화
    this.cartItem = page.locator('img[alt="album"]');
    this.cartCheckbox = page.locator('input[type="checkbox"]');
    this.cartDeleteButton = page.locator('button:has-text("Delete")');

    // 검색 결과/필터 요소 초기화
    this.searchResultCards = page.locator('img[alt="album_image"], img[alt="sample_image"], img[alt="event-thumb-image"]');
    this.filterTabs = page.locator('[role="tablist"] [role="tab"], [class*="tab"], button:has-text("전체"), button:has-text("All")');
    
    // 콘텐츠 요소 초기화
    this.contentImages = page.locator('img[alt="sample_image"], img[alt="event-thumb-image"], img[alt="album_image"]');
  }

  // --------------------------------------------------------------------------
  // 페이지 네비게이션 메서드
  // --------------------------------------------------------------------------

  /** 홈페이지로 이동 */
  async gotoHome(): Promise<void> {
    await this.goto(this.baseUrl);
    await this.waitForLoadState('domcontentloaded');
    await this.handleModal();
  }

  /** 이벤트 페이지로 이동 */
  async gotoEvent(): Promise<void> {
    await this.goto(`${this.baseUrl}/event#1`);
    await this.waitForLoadState('domcontentloaded');
    await this.handleModal();
  }

  /** 샵 페이지로 이동 */
  async gotoShop(): Promise<void> {
    await this.goto(`${this.baseUrl}/shop`);
    await this.waitForLoadState('domcontentloaded');
    await this.handleModal();
  }

  /** 펀딩 페이지로 이동 */
  async gotoFunding(): Promise<void> {
    await this.goto(`${this.baseUrl}/funding#0`);
    await this.waitForLoadState('domcontentloaded');
    await this.handleModal();
  }

  /** 마이페이지로 이동 (리다이렉트 대응 포함) */
  async gotoMyPage(): Promise<void> {
    // 마이페이지 접근 시도
    await this.goto(`${this.baseUrl}/my-page`);
    await this.waitForLoadState('domcontentloaded');
    // 네트워크 안정화 대기 (타임아웃 시 무시)
    await this.waitForNetworkStable(5000).catch(() => {});
    await this.handleModal();
    
    // 마이페이지 접속 실패 시 재시도
    if (!this.currentUrl.includes('my-page')) {
      console.log('⚠️ 마이페이지 리다이렉트됨, 재시도...');
      await this.goto(`${this.baseUrl}/my-page`);
      await this.waitForLoadState('domcontentloaded');
      await this.waitForNetworkStable(5000).catch(() => {});
      await this.handleModal();
    }
  }

  /** 장바구니 페이지로 이동 */
  async gotoCart(): Promise<void> {
    await this.goto(`${this.baseUrl}/cart`);
    await this.waitForLoadState('domcontentloaded');
    await this.handleModal();
  }

  /** 주문내역 페이지로 이동 (리다이렉트 대응 포함) */
  async gotoOrderHistory(): Promise<void> {
    await this.goto(`${this.baseUrl}/my-page/order-history`);
    await this.waitForLoadState('domcontentloaded');
    await this.waitForNetworkStable(5000).catch(() => {});
    await this.handleModal();
    
    // 마이페이지 접속 실패 시 재시도
    if (!this.currentUrl.includes('my-page')) {
      console.log('⚠️ 주문내역 페이지 리다이렉트됨, 재시도...');
      await this.goto(`${this.baseUrl}/my-page/order-history`);
      await this.waitForLoadState('domcontentloaded');
      await this.waitForNetworkStable(5000).catch(() => {});
      await this.handleModal();
    }
  }

  /** 배송지 관리 페이지로 이동 (리다이렉트 대응 포함) */
  async gotoAddress(): Promise<void> {
    await this.goto(`${this.baseUrl}/my-page/address`);
    await this.waitForLoadState('domcontentloaded');
    await this.waitForNetworkStable(5000).catch(() => {});
    await this.handleModal();
    
    // 마이페이지 접속 실패 시 재시도
    if (!this.currentUrl.includes('my-page')) {
      console.log('⚠️ 배송지 관리 페이지 리다이렉트됨, 재시도...');
      await this.goto(`${this.baseUrl}/my-page/address`);
      await this.waitForLoadState('domcontentloaded');
      await this.waitForNetworkStable(5000).catch(() => {});
      await this.handleModal();
    }
  }

  // --------------------------------------------------------------------------
  // 로고 및 네비게이션 검증
  // --------------------------------------------------------------------------

  private readonly logoSelectors = [
    'img[alt="make-star"]', 'img[alt*="makestar"]', 'img[alt*="make"]', 
    'header img', 'a[href="/"] img'
  ] as const;

  private readonly navSelectors = [
    'header', 'nav', '[class*="header"]', '[class*="nav"]'
  ] as const;

  /** 로고 존재 확인 */
  async verifyLogo(timeout: number = this.timeouts.medium): Promise<boolean> {
    const result = await this.findVisibleElement(this.logoSelectors, timeout);
    if (result) {
      console.log(`✅ 로고 발견: ${result.selector}`);
      return true;
    }
    console.log('⚠️ 로고를 찾을 수 없음');
    return false;
  }

  /** 네비게이션 존재 확인 */
  async verifyNavigation(): Promise<boolean> {
    const result = await this.findVisibleElement(this.navSelectors);
    if (result) {
      console.log(`✅ 네비게이션 발견: ${result.selector}`);
      return true;
    }
    console.log('⚠️ 네비게이션을 찾을 수 없음');
    return false;
  }

  /** 로고 클릭으로 홈 복귀 */
  async clickLogoToHome(): Promise<void> {
    const logoResult = await this.findVisibleElement(this.logoSelectors, this.timeouts.long);
    if (!logoResult) {
      throw new Error('로고를 찾을 수 없습니다');
    }
    await logoResult.element.click({ timeout: this.timeouts.medium });
    await this.expectUrlMatches(/^https:\/\/(www\.)?makestar\.com\/?$/);
    console.log('✅ 로고 클릭으로 Home 복귀 완료');
  }

  // --------------------------------------------------------------------------
  // 검색 기능
  // --------------------------------------------------------------------------

  /** 검색 UI 열기 */
  async openSearchUI(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, 0));
    
    // 검색 버튼 클릭 전 모달 처리 (모달이 버튼을 가릴 수 있음)
    await this.handleModal();
    
    // 페이지 오류 상태 확인 및 복구
    const errorButton = this.page.locator('button:has-text("Back to Home")');
    if (await errorButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('⚠️ 페이지 오류 발견, 홈으로 복귀 후 재시도');
      await this.gotoHome();
      await this.handleModal();
    }
    
    // 페이지 로딩 대기 (조건부 대기)
    await this.waitForContentStable(500);
    
    // 검색 버튼이 보이는지 확인
    const isSearchButtonVisible = await this.searchButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (!isSearchButtonVisible) {
      console.log('⚠️ 검색 버튼이 보이지 않아 페이지 새로고침');
      await this.reload();
      await this.handleModal();
      await this.waitForContentStable(500);
    }
    
    // 재시도 로직: 최대 3번 시도
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.searchButton.click();
        await expect(this.searchInput).toBeVisible({ timeout: this.timeouts.medium });
        console.log('✅ 검색 입력창 표시됨');
        return;
      } catch (error) {
        if (attempt < 3) {
          console.log(`⚠️ 검색 UI 열기 시도 ${attempt} 실패, 재시도...`);
          await this.handleModal();
          await this.waitForContentStable(500);
        } else {
          throw error;
        }
      }
    }
  }

  /** 검색 실행 */
  async search(keyword: string): Promise<void> {
    await this.openSearchUI();
    await this.searchInput.fill(keyword);
    await this.searchInput.press('Enter');
    await this.waitForLoadState('domcontentloaded');
  }

  /** 추천 검색어 표시 확인 */
  async verifyRecommendedKeywords(): Promise<boolean> {
    const recommended = this.page.locator('text=/추천 검색어|인기 검색어|추천|Recommended/i').first();
    return await recommended.isVisible({ timeout: this.timeouts.medium }).catch(() => false);
  }

  // --------------------------------------------------------------------------
  // 이벤트 페이지 기능
  // --------------------------------------------------------------------------

  private readonly eventCardSelectors = [
    'img[alt="event-thumb-image"]', '[class*="event"] img', '[class*="card"]', '[class*="thumbnail"]'
  ] as const;

  /** 종료된 이벤트 탭 클릭 */
  async clickEndedTab(): Promise<boolean> {
    return await this.clickFirstVisibleText(MAKESTAR_TEXT_PATTERNS.ENDED_TAB, this.timeouts.short);
  }

  /** 진행중인 이벤트 탭 클릭 */
  async clickOngoingTab(): Promise<boolean> {
    return await this.clickFirstVisibleText(MAKESTAR_TEXT_PATTERNS.ONGOING_TAB, this.timeouts.medium);
  }

  /** 첫 번째 이벤트 카드 클릭 */
  async clickFirstEventCard(): Promise<void> {
    const eventCard = await this.findVisibleElement(this.eventCardSelectors, this.timeouts.long);
    if (!eventCard) {
      throw new Error('이벤트 카드를 찾을 수 없습니다');
    }
    await eventCard.element.click({ timeout: this.timeouts.medium });
    await this.waitForLoadState('domcontentloaded');
    console.log('✅ 이벤트 상품 클릭 완료');
  }

  // --------------------------------------------------------------------------
  // 샵 페이지 기능
  // --------------------------------------------------------------------------

  /** 첫 번째 샵 상품 클릭 (품절 제외) */
  async clickFirstAvailableProduct(): Promise<boolean> {
    const productCards = this.shopProductCard;
    const cardCount = await productCards.count();
    console.log(`   상품 카드 ${cardCount}개 발견`);

    for (let i = 0; i < Math.min(cardCount, 5); i++) {
      const card = productCards.nth(i);
      const parentText = await card.locator('xpath=ancestor::*[3]').textContent().catch(() => '');
      
      if (parentText && /sold out/i.test(parentText)) {
        console.log(`   상품 ${i + 1}: 품절 - 건너뜀`);
        continue;
      }

      console.log(`   상품 ${i + 1}: 클릭 시도`);
      await card.click();
      return true;
    }
    return false;
  }

  /** 카테고리 탭 표시 확인 */
  async verifyCategoryTabs(): Promise<boolean> {
    const categoryTab = this.page.locator('text=/전체|앨범|MD|DVD|추천/i').first();
    return await categoryTab.isVisible({ timeout: this.timeouts.medium }).catch(() => false);
  }

  /** 상품 카드 개수 반환 */
  async getProductCardCount(): Promise<number> {
    return await this.shopProductCard.count();
  }

  // --------------------------------------------------------------------------
  // 상품 상세 페이지 기능
  // --------------------------------------------------------------------------

  private readonly titleSelectors = [
    'h1', 'h2', '[class*="title"]', '[class*="Title"]', '[class*="product"]'
  ] as const;

  private readonly optionDropdownSelectors = [
    'select', '[class*="option"]', '[class*="select"]', '[role="combobox"]', '[class*="dropdown"]'
  ] as const;

  private readonly quantityInputSelectors = [
    'input[type="number"]', '[class*="quantity"] input', '[class*="count"] input', 'input[name*="quantity"]'
  ] as const;

  private readonly quantityPlusSelectors = [
    'button:has-text("+")', '[class*="plus"]', '[class*="increase"]', 'button[aria-label*="increase"]'
  ] as const;

  /** 상품 제목 확인 */
  async verifyProductTitle(): Promise<boolean> {
    const result = await this.findVisibleElement(this.titleSelectors, this.timeouts.long);
    return result !== null;
  }

  /** 가격 정보 확인 */
  async verifyPriceInfo(): Promise<boolean> {
    const text = await this.page.locator('body').textContent();
    return /원|₩|KRW/i.test(text || '');
  }

  /** 옵션 선택 */
  async selectFirstOption(): Promise<boolean> {
    const optionDropdown = await this.findVisibleElement(this.optionDropdownSelectors, this.timeouts.medium);
    if (!optionDropdown) return false;

    await optionDropdown.element.click();
    await this.wait(this.timeouts.short);

    const firstOption = this.page.locator('option, [role="option"], li').first();
    if (await firstOption.isVisible({ timeout: this.timeouts.short }).catch(() => false)) {
      await firstOption.click().catch(() => {});
      console.log('   ✅ 첫 번째 옵션 선택');
      return true;
    }
    return false;
  }

  /** 수량 설정 */
  async setQuantity(quantity: number): Promise<void> {
    const quantityInput = await this.findVisibleElement(this.quantityInputSelectors, this.timeouts.medium);
    if (quantityInput) {
      await quantityInput.element.fill(String(quantity));
      console.log(`   ✅ 수량 ${quantity} 입력`);
    }
  }

  /** 수량 증가 */
  async increaseQuantity(): Promise<boolean> {
    const plusBtn = await this.findVisibleElement(this.quantityPlusSelectors, this.timeouts.short);
    if (plusBtn) {
      await plusBtn.element.click();
      console.log('   ✅ 수량 증가 버튼 클릭');
      return true;
    }
    return false;
  }

  /** 구매 버튼 클릭 */
  async clickPurchaseButton(): Promise<boolean> {
    return await this.clickFirstVisibleText(MAKESTAR_TEXT_PATTERNS.PURCHASE_BTN, this.timeouts.long);
  }

  /** 장바구니 담기 버튼 클릭 */
  async clickAddToCartButton(): Promise<boolean> {
    const btn = this.page.locator('button:has-text("장바구니"):not([disabled]), button:has-text("cart"):not([disabled])').first();
    if (await btn.isVisible({ timeout: this.timeouts.short }).catch(() => false)) {
      await btn.click();
      console.log('✅ 장바구니 담기 버튼 클릭');
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // 장바구니 기능
  // --------------------------------------------------------------------------

  /** 장바구니 아이템 개수 반환 */
  async getCartItemCount(): Promise<number> {
    return await this.cartItem.count();
  }

  /** 장바구니 비우기 */
  async clearCart(): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const itemCount = await this.getCartItemCount();
      if (itemCount === 0) {
        console.log('   장바구니 비어있음');
        return;
      }

      console.log(`   기존 상품 ${itemCount}개 (삭제 시도 ${attempt + 1}/3)`);

      // 체크박스 클릭
      if (await this.cartCheckbox.count() > 0) {
        const firstCheckbox = this.cartCheckbox.first();
        const isChecked = await firstCheckbox.isChecked().catch(() => false);
        if (!isChecked) {
          await firstCheckbox.click();
          await this.waitForContentStable(500);
        }
      }

      // Delete 버튼 클릭
      if (await this.cartDeleteButton.first().isVisible({ timeout: 2000 }).catch(() => false)) {
        await this.cartDeleteButton.first().click();
        await this.waitForNetworkStable(3000);
        
        // 모달 내 Delete 버튼 클릭
        const allDeleteBtns = this.cartDeleteButton;
        if (await allDeleteBtns.count() >= 2) {
          await allDeleteBtns.last().click();
          await this.waitForNetworkStable(2000);
          await this.reload();
          await this.waitForContentStable(500);
        }
      }
    }
    console.log('   ✅ 장바구니 초기화 완료');
  }

  // --------------------------------------------------------------------------
  // 마이페이지 기능
  // --------------------------------------------------------------------------

  private readonly myPageMenuItems: readonly MenuItem[] = [
    { name: '이벤트 응모정보 관리', texts: ['이벤트 응모정보 관리', '이벤트 응모', 'Event Entry', 'event submissions'] },
    { name: '비밀번호 변경', texts: ['비밀번호 변경', '비밀번호', 'Password', 'Change Password'] },
    { name: '주문내역', texts: ['주문내역', '주문 내역', 'Order', 'order history'] },
    { name: '배송지 관리', texts: ['배송지 관리', '배송지', 'Address', 'Shipping'] },
    { name: '로그아웃', texts: ['로그아웃', 'Logout', 'Log out', 'Sign out'] },
  ] as const;

  /** 로그인 상태 확인 (비동기) */
  async checkLoggedIn(): Promise<boolean> {
    await this.waitForNetworkStable(2000); // 리다이렉트 대기
    const url = this.currentUrl;
    console.log(`📍 현재 URL: ${url}`);
    
    // 마이페이지에 머물러 있거나 로그인/인증 페이지로 리다이렉트되지 않았는지 확인
    const isOnMyPage = url.includes('my-page');
    const notRedirectedToLogin = !url.includes('login') && !url.includes('auth');
    const notRedirectedToHome = url !== `${this.baseUrl}/` && url !== this.baseUrl;
    
    return isOnMyPage && notRedirectedToLogin && notRedirectedToHome;
  }

  /** 로그인 상태 확인 (동기 - 레거시 호환) */
  isLoggedIn(): boolean {
    const url = this.currentUrl;
    return url.includes('my-page') && !url.includes('login') && !url.includes('auth');
  }

  /** 마이페이지 메뉴 항목 확인 */
  async verifyMyPageMenuItems(): Promise<number> {
    let foundCount = 0;

    for (const item of this.myPageMenuItems) {
      for (const text of item.texts) {
        const menuElement = this.page.locator(`text=${text}`).first();
        const isVisible = await menuElement.isVisible({ timeout: this.timeouts.short }).catch(() => false);
        if (isVisible) {
          console.log(`✅ "${item.name}" 메뉴 발견`);
          foundCount++;
          break;
        }
      }
    }

    return foundCount;
  }

  // --------------------------------------------------------------------------
  // 펀딩 페이지 기능
  // --------------------------------------------------------------------------

  /** 펀딩 페이지 타이틀 확인 */
  async verifyFundingTitle(): Promise<boolean> {
    const title = this.page.locator('text=/프로젝트에 펀딩|펀딩|프로젝트|Fund your project|Funding/i').first();
    return await title.isVisible({ timeout: this.timeouts.medium }).catch(() => false);
  }

  /** 펀딩 프로젝트 탭 확인 */
  async verifyFundingTabs(): Promise<boolean> {
    const tabs = this.page.locator('text=/모든 프로젝트|진행중|종료된|All Projects|Ongoing|Ended/i').first();
    return await tabs.isVisible({ timeout: this.timeouts.medium }).catch(() => false);
  }

  /** 펀딩 프로젝트 카드 개수 반환 */
  async getFundingCardCount(): Promise<number> {
    const cards = this.page.locator('img[alt="sample_image"]');
    return await cards.count();
  }

  // --------------------------------------------------------------------------
  // 상품 가격 관련 기능
  // --------------------------------------------------------------------------

  /** 현재 표시된 가격 추출 (숫자만) */
  async getCurrentPrice(): Promise<number | null> {
    const priceSelectors = [
      '[class*="price"]', '[class*="Price"]', '[class*="total"]', '[class*="Total"]',
      'text=/\\$[\\d,]+|₩[\\d,]+|[\\d,]+원/'
    ];
    
    for (const selector of priceSelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = await element.textContent();
        if (text) {
          // 숫자만 추출 ($ 기호, 원, ₩ 등 제거)
          const priceMatch = text.replace(/[^\d]/g, '');
          if (priceMatch) {
            return parseInt(priceMatch, 10);
          }
        }
      }
    }
    return null;
  }

  /** 옵션 드롭다운 클릭 및 옵션 목록 반환 */
  async getOptionList(): Promise<string[]> {
    const options: string[] = [];
    const optionDropdown = await this.findVisibleElement(this.optionDropdownSelectors, this.timeouts.medium);
    
    if (optionDropdown) {
      await optionDropdown.element.click();
      await this.waitForContentStable(500);
      
      // 옵션 목록 수집
      const optionElements = this.page.locator('option, [role="option"], li[class*="option"], [class*="dropdown"] li');
      const count = await optionElements.count();
      
      for (let i = 0; i < count; i++) {
        const text = await optionElements.nth(i).textContent();
        if (text && text.trim()) {
          options.push(text.trim());
        }
      }
    }
    
    return options;
  }

  /** 특정 인덱스의 옵션 선택 */
  async selectOptionByIndex(index: number): Promise<boolean> {
    const optionDropdown = await this.findVisibleElement(this.optionDropdownSelectors, this.timeouts.medium);
    if (!optionDropdown) return false;

    await optionDropdown.element.click();
    await this.waitForContentStable(500);

    const optionElements = this.page.locator('option, [role="option"], li[class*="option"], [class*="dropdown"] li');
    const count = await optionElements.count();
    
    if (index < count) {
      await optionElements.nth(index).click();
      console.log(`   ✅ 옵션 ${index + 1} 선택`);
      return true;
    }
    return false;
  }

  /** 로그인 페이지/모달 표시 여부 확인 */
  async isLoginPromptVisible(): Promise<boolean> {
    const loginIndicators = [
      'button:has-text("Google")',
      'button:has-text("Apple")',
      'button:has-text("카카오")',
      'button:has-text("Kakao")',
      '[class*="google"]',
      '[class*="login"]',
      'text=/로그인|Sign in|Login|Sign up/i'
    ];
    
    for (const selector of loginIndicators) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        return true;
      }
    }
    
    // URL로도 확인
    const url = this.currentUrl;
    return url.includes('login') || url.includes('auth') || url.includes('signin');
  }

  /** 로그아웃 실행 */
  async logout(): Promise<boolean> {
    // 마이페이지로 이동하여 로그아웃
    await this.gotoMyPage();
    await this.handleModal();
    
    const logoutBtn = this.page.locator('text=/로그아웃|Logout|Log out|Sign out/i').first();
    if (await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutBtn.click();
      await this.waitForNetworkStable(2000);
      console.log('✅ 로그아웃 버튼 클릭');
      return true;
    }
    return false;
  }

  /** 로그아웃 상태 확인 */
  async isLoggedOut(): Promise<boolean> {
    // 마이페이지 접근 시도
    await this.goto(`${this.baseUrl}/my-page`);
    await this.waitForLoadState('domcontentloaded');
    await this.waitForContentStable();
    
    const url = this.currentUrl;
    // 로그인 페이지로 리다이렉트되면 로그아웃 상태
    return url.includes('login') || url.includes('auth') || !url.includes('my-page');
  }

  // --------------------------------------------------------------------------
  // 검색 결과 관련 기능
  // --------------------------------------------------------------------------

  /**
   * 검색 결과 카드 개수 반환
   */
  async getSearchResultCount(): Promise<number> {
    await this.waitForElement(this.searchResultCards.first(), { timeout: this.timeouts.medium }).catch(() => {});
    return await this.searchResultCards.count();
  }

  /**
   * 검색 결과가 표시될 때까지 대기
   * @param minCount 최소 결과 개수 (기본: 1)
   */
  async waitForSearchResults(minCount: number = 1): Promise<boolean> {
    try {
      await this.page.waitForFunction(
        ({ selector, min }) => {
          const cards = document.querySelectorAll(selector);
          return cards.length >= min;
        },
        { 
          selector: 'img[alt="album_image"], img[alt="sample_image"], img[alt="event-thumb-image"]',
          min: minCount 
        },
        { timeout: this.timeouts.long }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 첫 번째 검색 결과 클릭
   */
  async clickFirstSearchResult(): Promise<boolean> {
    const hasResults = await this.waitForSearchResults();
    if (!hasResults) return false;
    
    // 검색 추천 모달이 클릭을 가로막을 수 있으므로 ESC로 닫기
    await this.page.keyboard.press('Escape');
    await this.waitForContentStable(300);
    
    // 모달이 여전히 있으면 force 옵션으로 클릭
    try {
      await this.searchResultCards.first().click({ timeout: 5000 });
    } catch {
      // 모달 가림 문제 발생 시 force 옵션 사용
      await this.searchResultCards.first().click({ force: true });
    }
    await this.waitForLoadState('domcontentloaded');
    return true;
  }

  // --------------------------------------------------------------------------
  // 필터/탭 관련 기능  
  // --------------------------------------------------------------------------

  /**
   * 필터/탭 요소 존재 확인
   */
  async hasFilterTabs(): Promise<boolean> {
    return await this.filterTabs.first().isVisible({ timeout: this.timeouts.medium }).catch(() => false);
  }

  /**
   * 필터/탭 클릭
   * @param text 클릭할 탭의 텍스트
   */
  async clickFilterTab(text: string): Promise<boolean> {
    const tab = this.page.locator(`[role="tab"]:has-text("${text}"), button:has-text("${text}")`).first();
    if (await tab.isVisible({ timeout: this.timeouts.short }).catch(() => false)) {
      await tab.click();
      await this.waitForContentStable();
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // 콘텐츠 대기 기능 (Hard wait 대체)
  // --------------------------------------------------------------------------

  /**
   * 페이지 콘텐츠(이미지/카드)가 로드될 때까지 대기
   * Hard wait 대신 사용
   */
  async waitForPageContent(): Promise<void> {
    await this.waitForLoadState('domcontentloaded');
    await Promise.race([
      this.waitForElement(this.contentImages.first(), { timeout: this.timeouts.long }),
      this.waitForNetworkStable(this.timeouts.long),
    ]).catch(() => {});
  }

  /**
   * 모달 처리 후 콘텐츠 안정화 대기
   * 기존 handleModal() + wait() 조합 대체
   */
  async handleModalAndWaitForContent(): Promise<void> {
    await this.handleModal();
    await this.waitForContentStable('body', { stableTime: 500 });
  }

  // --------------------------------------------------------------------------
  // 비회원 테스트 헬퍼
  // --------------------------------------------------------------------------

  /**
   * 비회원 상태에서 페이지 요소 검증
   * @param page Playwright Page 객체 (incognito context용)
   */
  static async verifyGuestPageElements(page: import('@playwright/test').Page): Promise<{
    logo: boolean;
    navigation: boolean;
    content: boolean;
  }> {
    const logoVisible = await page.locator('img[alt="make-star"], img[alt*="makestar"]')
      .first().isVisible({ timeout: 5000 }).catch(() => false);
    
    const navVisible = await page.getByRole('button', { name: /Home|Event|Shop/i })
      .first().isVisible({ timeout: 5000 }).catch(() => false);
    
    const contentVisible = await page.locator('img[alt="sample_image"], img[alt="event-thumb-image"], img[alt="album_image"]')
      .first().isVisible({ timeout: 5000 }).catch(() => false);

    return { logo: logoVisible, navigation: navVisible, content: contentVisible };
  }

  /**
   * 비회원 상태에서 모달 닫기
   * @param page Playwright Page 객체 (incognito context용)
   */
  static async closeGuestModal(page: import('@playwright/test').Page): Promise<void> {
    const closeSelectors = [
      'button:has-text("Close")',
      'button:has-text("닫기")',
      'button:has-text("Do not show")',
      '[aria-label="Close"]',
      '[aria-label="close"]',
    ];
    
    for (const selector of closeSelectors) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        await page.waitForLoadState('domcontentloaded');
        break;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 성능 측정 (Web Vitals)
  // --------------------------------------------------------------------------

  /**
   * Core Web Vitals 측정
   * 실제 LCP, FCP, CLS 등을 측정하여 반환
   */
  async measureWebVitals(): Promise<WebVitalsResult> {
    return await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType('paint');
      
      // FCP
      const fcpEntry = paintEntries.find(e => e.name === 'first-contentful-paint');
      const fcp = fcpEntry ? Math.round(fcpEntry.startTime) : 0;
      
      // LCP (PerformanceObserver로 이미 수집되어 있다면 사용)
      let lcp = 0;
      const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
      if (lcpEntries.length > 0) {
        lcp = Math.round((lcpEntries[lcpEntries.length - 1] as any).startTime);
      }
      
      // CLS (LayoutShift entries)
      let cls = 0;
      const layoutShiftEntries = performance.getEntriesByType('layout-shift');
      for (const entry of layoutShiftEntries) {
        if (!(entry as any).hadRecentInput) {
          cls += (entry as any).value || 0;
        }
      }
      
      return {
        fcp,
        lcp,
        ttfb: Math.round(navigation.responseStart - navigation.fetchStart),
        dcl: Math.round(navigation.domContentLoadedEventEnd - navigation.fetchStart),
        load: Math.round(navigation.loadEventEnd - navigation.fetchStart),
        cls: Math.round(cls * 1000) / 1000,
      };
    });
  }

  /**
   * 페이지 로딩 시간 측정 (개선된 버전)
   * domcontentloaded 대신 실제 LCP 기준으로 측정
   * @param url 측정할 URL
   * @returns 로딩 시간 (ms) 및 상세 메트릭
   */
  async measurePageLoadTime(url: string): Promise<{
    totalTime: number;
    vitals: WebVitalsResult;
  }> {
    const startTime = Date.now();
    
    await this.goto(url, { waitUntil: 'load' });
    await this.waitForContentStable('body', { stableTime: 500 });
    
    const totalTime = Date.now() - startTime;
    const vitals = await this.measureWebVitals();
    
    return { totalTime, vitals };
  }

  /**
   * 아티스트 관련 요소 검증
   */
  async verifyArtistElements(): Promise<{
    image: boolean;
    name: boolean;
    products: boolean;
  }> {
    const imageVisible = await this.page.locator('img[alt*="artist"], img[class*="artist"], img[class*="profile"]')
      .first().isVisible({ timeout: this.timeouts.short }).catch(() => false);
    
    const nameVisible = await this.page.locator('h1, h2, [class*="name"], [class*="title"]')
      .first().isVisible({ timeout: this.timeouts.short }).catch(() => false);
    
    const productsVisible = await this.searchResultCards
      .first().isVisible({ timeout: this.timeouts.short }).catch(() => false);

    return { image: imageVisible, name: nameVisible, products: productsVisible };
  }
}
