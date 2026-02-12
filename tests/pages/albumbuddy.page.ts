/**
 * AlbumBuddy 페이지 객체
 * 
 * 이 클래스는 AlbumBuddy 웹사이트의 모든 페이지 상호작용을 캡슐화합니다.
 */

import { Page, Locator, expect } from '@playwright/test';
import { BasePage, DEFAULT_TIMEOUTS, TimeoutConfig } from './base.page';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 타입 정의
// ============================================================================

/** 페이지 정보 타입 */
export interface PageInfo {
  url: string;
  pattern: RegExp;
  title?: string;
}

/** 성능 측정 결과 */
export interface PerformanceResult {
  url: string;
  loadTime: number;
  passed: boolean;
}

// ============================================================================
// AlbumBuddy 상수
// ============================================================================

export const ALBUMBUDDY_URLS = {
  base: 'https://albumbuddy.kr',
  shop: 'https://albumbuddy.kr/shop',
  about: 'https://albumbuddy.kr/about',
  pricing: 'https://albumbuddy.kr/pricing',
  dashboard: 'https://albumbuddy.kr/dashboard/purchasing',
  dashboardPurchasing: 'https://albumbuddy.kr/dashboard/purchasing',
  dashboardPackage: 'https://albumbuddy.kr/dashboard/package',
} as const;

export const ALBUMBUDDY_PAGES: Record<string, PageInfo> = {
  home: { url: ALBUMBUDDY_URLS.shop, pattern: /shop/i, title: 'ALBUM BUDDY' },
  about: { url: ALBUMBUDDY_URLS.about, pattern: /about/i },
  pricing: { url: ALBUMBUDDY_URLS.pricing, pattern: /pricing/i },
  dashboard: { url: ALBUMBUDDY_URLS.dashboard, pattern: /dashboard/i },
  dashboardPurchasing: { url: ALBUMBUDDY_URLS.dashboardPurchasing, pattern: /purchasing/i },
  dashboardPackage: { url: ALBUMBUDDY_URLS.dashboardPackage, pattern: /package/i },
} as const;

export const NAV_BUTTONS = ['About', 'Pricing', 'Dashboard', 'Request item'] as const;

// 실제 사이트의 섹션명 (한글/영문 혼용)
export const HOME_SECTIONS = [
  'Artist', 'Recent', 'Trending', 'Official', // 영어
  '추천', '아티스트', '트렌딩', '공식', '파트너', '전체', '앨범' // 한국어
] as const;

export const PERFORMANCE_THRESHOLD = {
  pageLoad: 10000,
  apiResponse: 5000,
} as const;

// ============================================================================
// AlbumBuddyPage 클래스
// ============================================================================

export class AlbumBuddyPage extends BasePage {
  readonly baseUrl = ALBUMBUDDY_URLS.base;
  readonly shopUrl = ALBUMBUDDY_URLS.shop;
  readonly siteTitle = 'ALBUM BUDDY';
  readonly authFilePath: string;

  // --------------------------------------------------------------------------
  // 로케이터 정의
  // --------------------------------------------------------------------------
  
  // 네비게이션 버튼
  readonly aboutButton: Locator;
  readonly pricingButton: Locator;
  readonly dashboardButton: Locator;
  readonly requestItemButton: Locator;
  
  // Show more 버튼
  readonly showMoreButton: Locator;
  
  // 이미지
  readonly images: Locator;

  constructor(page: Page, timeouts: TimeoutConfig = DEFAULT_TIMEOUTS) {
    super(page, timeouts);
    this.authFilePath = path.join(__dirname, '..', '..', 'ab-auth.json');
    
    // 네비게이션 버튼 초기화
    this.aboutButton = page.getByRole('button', { name: 'About' });
    this.pricingButton = page.getByRole('button', { name: 'Pricing' });
    this.dashboardButton = page.getByRole('button', { name: 'Dashboard' });
    this.requestItemButton = page.getByRole('button', { name: 'Request item' });
    
    // 기타 요소
    this.showMoreButton = page.getByText('Show more').first();
    this.images = page.locator('img');
  }

  // --------------------------------------------------------------------------
  // 인증 헬퍼
  // --------------------------------------------------------------------------

  /**
   * 인증 파일 존재 및 유효성 확인
   */
  isAuthAvailable(): boolean {
    if (!fs.existsSync(this.authFilePath)) {
      return false;
    }
    try {
      const auth = JSON.parse(fs.readFileSync(this.authFilePath, 'utf-8'));
      const cookies = auth.cookies || [];
      if (cookies.length === 0) return false;

      const now = Date.now() / 1000;
      const validCookies = cookies.filter((c: any) => !c.expires || c.expires > now);
      return validCookies.length > 0;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // 페이지 유틸리티
  // --------------------------------------------------------------------------

  /**
   * 페이지 로딩 완료 및 오버레이 제거
   */
  async waitForPageReady(): Promise<void> {
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 30000 });
    } catch {
      // networkidle 타임아웃은 무시
    }
    await this.wait(2000);

    // 오버레이/모달 제거
    for (let i = 0; i < 3; i++) {
      await this.page.evaluate(() => {
        document.querySelectorAll('.modal-overlay, [class*="overlay"], [class*="modal"]').forEach((el) => {
          (el as HTMLElement).style.cssText = 'display:none!important;visibility:hidden!important;pointer-events:none!important;';
        });
      });
      await this.page.keyboard.press('Escape');
      await this.wait(200);
    }
  }

  /**
   * 페이지 내 텍스트 존재 확인
   */
  async hasText(text: string): Promise<boolean> {
    return this.page.evaluate((t) => document.body.innerText.includes(t), text);
  }

  /**
   * 여러 텍스트 존재 확인
   */
  async hasAllTexts(texts: readonly string[]): Promise<Record<string, boolean>> {
    return this.page.evaluate(
      (arr) => {
        const content = document.body.innerText;
        return arr.reduce((acc, t) => ({ ...acc, [t]: content.includes(t) }), {} as Record<string, boolean>);
      },
      texts as unknown as string[]
    );
  }

  /**
   * 페이지 로드 시간 측정
   */
  async measureLoadTime(url: string): Promise<number> {
    const start = Date.now();
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });
    return Date.now() - start;
  }

  // --------------------------------------------------------------------------
  // 네비게이션 메서드
  // --------------------------------------------------------------------------

  /**
   * 홈페이지로 이동
   */
  async gotoHome(): Promise<void> {
    await this.page.goto(this.shopUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.waitForPageReady();
  }

  /**
   * About 페이지로 이동
   */
  async gotoAbout(): Promise<void> {
    await this.page.goto(ALBUMBUDDY_URLS.about, { waitUntil: 'domcontentloaded' });
  }

  /**
   * Pricing 페이지로 이동
   */
  async gotoPricing(): Promise<void> {
    await this.page.goto(ALBUMBUDDY_URLS.pricing, { waitUntil: 'domcontentloaded' });
  }

  /**
   * Dashboard 페이지로 이동
   */
  async gotoDashboard(): Promise<void> {
    await this.page.goto(ALBUMBUDDY_URLS.dashboard, { waitUntil: 'domcontentloaded' });
    await this.waitForPageReady();
  }

  /**
   * Dashboard Purchasing 페이지로 이동
   */
  async gotoDashboardPurchasing(): Promise<void> {
    await this.page.goto(ALBUMBUDDY_URLS.dashboardPurchasing, { waitUntil: 'domcontentloaded' });
    await this.waitForPageReady();
  }

  /**
   * Dashboard Package 페이지로 이동
   */
  async gotoDashboardPackage(): Promise<void> {
    await this.page.goto(ALBUMBUDDY_URLS.dashboardPackage, { waitUntil: 'domcontentloaded' });
    await this.waitForPageReady();
  }

  /**
   * 버튼 클릭으로 네비게이션
   */
  async clickNavButton(buttonName: string): Promise<void> {
    await this.page.evaluate((name) => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.includes(name));
      if (btn) btn.click();
    }, buttonName);
    await this.wait(2000);
  }

  // --------------------------------------------------------------------------
  // 검증 메서드
  // --------------------------------------------------------------------------

  /**
   * 네비게이션 버튼 표시 확인
   */
  async verifyNavButtons(): Promise<void> {
    for (const btnName of NAV_BUTTONS) {
      await expect(this.page.getByRole('button', { name: btnName })).toBeVisible({ timeout: 10000 });
    }
  }

  /**
   * 홈 섹션 확인
   */
  async verifyHomeSections(): Promise<Record<string, boolean>> {
    return await this.hasAllTexts(HOME_SECTIONS);
  }

  /**
   * 브랜드 요소 확인
   */
  async verifyBrandElements(): Promise<{ hasBrand: boolean; hasMakestar: boolean; hasCurrency: boolean }> {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await this.wait(1000);

    const hasBrand = await this.page.evaluate(
      () => document.body.innerText.includes('AlbumBuddy') || document.body.innerText.includes('앨범버디')
    );
    const hasMakestar = await this.hasText('MAKESTAR');
    const hasCurrency = await this.hasText('USD');

    return { hasBrand, hasMakestar, hasCurrency };
  }

  /**
   * 이미지 로드 확인
   */
  async verifyImagesLoaded(): Promise<{ count: number; firstImageLoaded: boolean }> {
    const count = await this.images.count();
    let firstImageLoaded = false;

    if (count > 0) {
      const firstImg = this.images.first();
      if (await firstImg.isVisible()) {
        const naturalWidth = await firstImg.evaluate((img: HTMLImageElement) => img.naturalWidth);
        firstImageLoaded = naturalWidth > 0;
      }
    }

    return { count, firstImageLoaded };
  }

  /**
   * Show more 버튼 클릭
   */
  async clickShowMore(): Promise<boolean> {
    if (await this.showMoreButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await this.showMoreButton.click();
      await this.wait(2000);
      return true;
    }
    return false;
  }

  /**
   * Request item 모달/페이지 확인
   */
  async clickRequestItemAndVerify(): Promise<{ modalVisible: boolean; urlChanged: boolean }> {
    await this.requestItemButton.click();
    await this.wait(2000);

    const modalVisible = await this.page.evaluate(() => {
      const modals = document.querySelectorAll('[role="dialog"], .modal, [class*="modal"]');
      return Array.from(modals).some((m) => {
        const style = window.getComputedStyle(m);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
    });

    const urlChanged = !this.currentUrl.endsWith('/shop');

    return { modalVisible, urlChanged };
  }

  // --------------------------------------------------------------------------
  // 성능 측정 메서드
  // --------------------------------------------------------------------------

  /**
   * 홈페이지 로드 성능 측정
   */
  async measureHomePagePerformance(): Promise<PerformanceResult> {
    const loadTime = await this.measureLoadTime(this.shopUrl);
    return {
      url: this.shopUrl,
      loadTime,
      passed: loadTime < PERFORMANCE_THRESHOLD.pageLoad,
    };
  }

  /**
   * 주요 페이지 응답 상태 확인
   */
  async checkPagesStatus(): Promise<Array<{ url: string; status: number; ok: boolean }>> {
    const results: Array<{ url: string; status: number; ok: boolean }> = [];
    const pagesToCheck = [ALBUMBUDDY_PAGES.home, ALBUMBUDDY_PAGES.about, ALBUMBUDDY_PAGES.pricing];

    for (const pageInfo of pagesToCheck) {
      const response = await this.page.goto(pageInfo.url, { waitUntil: 'domcontentloaded' });
      results.push({
        url: pageInfo.url,
        status: response?.status() ?? 0,
        ok: (response?.status() ?? 0) < 400,
      });
    }

    return results;
  }

  /**
   * 네트워크 에러 모니터링
   */
  async monitorNetworkErrors(action: () => Promise<void>): Promise<string[]> {
    const failedRequests: string[] = [];
    this.page.on('requestfailed', (req) => failedRequests.push(req.url()));

    await action();

    // 중요한 실패만 필터링
    return failedRequests.filter((url) => url.includes('albumbuddy.kr') && !url.includes('analytics'));
  }

  // --------------------------------------------------------------------------
  // 로그인 사용자 기능
  // --------------------------------------------------------------------------

  /**
   * 로그인 상태 확인
   */
  isLoggedIn(): boolean {
    const url = this.currentUrl;
    return !url.includes('login') && !url.includes('auth');
  }

  /**
   * 로그인 필요 여부 확인 (Dashboard 클릭 후)
   */
  async checkLoginRequired(): Promise<{ needsLogin: boolean; hasLoginElement: boolean }> {
    await this.clickNavButton('Dashboard');
    await this.wait(3000);

    const currentUrl = this.currentUrl;
    const hasLoginElement = await this.page.evaluate(
      () =>
        document.body.innerText.toLowerCase().includes('sign in') ||
        document.body.innerText.toLowerCase().includes('log in') ||
        document.body.innerText.toLowerCase().includes('login') ||
        document.body.innerText.includes('로그인')
    );

    return {
      needsLogin: currentUrl.includes('login') || currentUrl.includes('auth') || hasLoginElement,
      hasLoginElement,
    };
  }

  /**
   * Dashboard 콘텐츠 확인
   */
  async verifyDashboardContent(): Promise<{ hasContent: boolean; notFound: boolean }> {
    const pageContent = await this.page.evaluate(() => document.body.innerText);

    return {
      hasContent: pageContent.length > 100,
      notFound: pageContent.toLowerCase().includes('not found'),
    };
  }

  /**
   * 구매 내역 UI 요소 확인
   */
  async verifyPurchasingContent(): Promise<boolean> {
    const hasContent = await this.page.evaluate(() => {
      const text = document.body.innerText;
      return (
        text.includes('Order') ||
        text.includes('Purchase') ||
        text.includes('구매') ||
        text.includes('No ') ||
        text.includes('empty')
      );
    });
    return hasContent;
  }

  /**
   * Package 페이지 콘텐츠 확인
   */
  async verifyPackageContent(): Promise<boolean> {
    const pageText = await this.page.evaluate(() => document.body.innerText);
    return (
      pageText.includes('패키지') ||
      pageText.includes('Package') ||
      pageText.includes('패키징') ||
      pageText.includes('Packaging') ||
      pageText.includes('배송')
    );
  }

  // --------------------------------------------------------------------------
  // 검색 기능 메서드
  // --------------------------------------------------------------------------

  /**
   * 검색 입력창 열기 (돋보기 아이콘 클릭)
   */
  async openSearch(): Promise<boolean> {
    try {
      // 검색 버튼/아이콘 찾기
      const searchButton = this.page.locator('[aria-label*="search" i], [class*="search"] button, button:has(svg), .search-icon').first();
      if (await searchButton.isVisible({ timeout: 5000 })) {
        await searchButton.click();
        await this.wait(1000);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 검색어 입력 및 검색 실행
   */
  async search(query: string): Promise<{ success: boolean; hasResults: boolean }> {
    try {
      // AlbumBuddy의 검색 입력창 찾기 (홈페이지에 바로 노출됨)
      const searchInput = this.page.locator('input[placeholder*="검색"], input[placeholder*="search" i], textbox[name*="search" i]').first();
      
      if (!(await searchInput.isVisible({ timeout: 5000 }))) {
        // 검색창이 보이지 않으면 검색 버튼 클릭
        await this.openSearch();
      }

      await searchInput.fill(query);
      await this.wait(500);
      
      // Enter 키로 검색 실행
      await searchInput.press('Enter');
      await this.wait(3000);

      // 검색 결과 확인 - 상품 카드가 있는지 확인
      const pageText = await this.page.evaluate(() => document.body.innerText);
      
      // 검색 결과 없음 메시지 확인
      const noResultsIndicators = [
        'No results',
        '검색 결과가 없',
        '결과가 없습니다',
        'not found',
        '0 result',
        '찾을 수 없'
      ];
      
      const hasNoResults = noResultsIndicators.some(indicator => 
        pageText.toLowerCase().includes(indicator.toLowerCase())
      );
      
      // 상품 카드가 있는지 확인 (가격이 있는 상품)
      const hasProductCards = pageText.includes('$') && 
        (await this.page.locator('[cursor=pointer]:has-text("$")').count()) > 0;
      
      // 검색어가 결과에 포함되어 있는지 확인
      const queryInResults = pageText.toLowerCase().includes(query.toLowerCase());

      // 결과가 있으려면: 결과 없음 메시지가 없고, 상품 카드가 있거나 검색어가 포함되어 있어야 함
      const hasResults = !hasNoResults && (hasProductCards || queryInResults);

      return { success: true, hasResults };
    } catch {
      return { success: false, hasResults: false };
    }
  }

  /**
   * 검색 결과가 없는지 확인
   */
  async verifyNoSearchResults(): Promise<boolean> {
    const pageText = await this.page.evaluate(() => document.body.innerText);
    return (
      pageText.includes('No results') ||
      pageText.includes('검색 결과가 없습니다') ||
      pageText.includes('not found') ||
      pageText.includes('0 result')
    );
  }

  /**
   * 검색 자동완성 확인
   */
  async verifySearchAutocomplete(query: string): Promise<{ hasDropdown: boolean; suggestionCount: number }> {
    try {
      const searchInput = this.page.locator('input[type="search"], input[placeholder*="search" i]').first();
      
      if (!(await searchInput.isVisible({ timeout: 3000 }))) {
        await this.openSearch();
      }

      await searchInput.fill(query);
      await this.wait(1500);

      // 자동완성 드롭다운 확인
      const dropdown = this.page.locator('[class*="autocomplete"], [class*="suggestion"], [class*="dropdown"], [role="listbox"]').first();
      const hasDropdown = await dropdown.isVisible({ timeout: 3000 }).catch(() => false);
      
      let suggestionCount = 0;
      if (hasDropdown) {
        suggestionCount = await this.page.locator('[class*="autocomplete"] li, [class*="suggestion"] li, [role="option"]').count();
      }

      return { hasDropdown, suggestionCount };
    } catch {
      return { hasDropdown: false, suggestionCount: 0 };
    }
  }

  // --------------------------------------------------------------------------
  // 상품 상세 페이지 메서드
  // --------------------------------------------------------------------------

  /**
   * 첫 번째 상품 클릭하여 상세 페이지로 이동
   * 주의: 배너 이미지가 아닌 실제 상품 카드를 클릭해야 함
   */
  async clickFirstProduct(): Promise<{ success: boolean; productName: string }> {
    try {
      // 페이지 로드 대기
      await this.wait(3000);
      
      // 팝업 닫기 (있으면)
      const closeButton = this.page.locator('text=Close').first();
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
        await this.wait(1000);
      }
      
      // 스크롤 다운하여 상품 섹션 노출
      await this.page.evaluate(() => window.scrollBy(0, 500));
      await this.wait(1000);
      
      // 방법 1: "전체 앨범" 그리드의 첫 번째 상품 클릭 (가장 신뢰성 높음)
      const albumGridProduct = this.page.locator('.album__grid > div > div').first();
      if (await albumGridProduct.isVisible({ timeout: 5000 }).catch(() => false)) {
        const text = await albumGridProduct.textContent() || '';
        const productName = text.split('$')[0].trim().substring(0, 50);
        await albumGridProduct.click();
        await this.wait(2000);
        
        // URL 확인
        if (this.currentUrl.includes('/product/')) {
          return { success: true, productName };
        }
      }
      
      // 방법 2: 가격($)이 있고 이미지(alt="image")가 있는 상품 클릭
      const productCards = this.page.locator('div:has(img[alt="image"]):has(p:has-text("$"))');
      const count = await productCards.count();
      
      for (let i = 0; i < Math.min(count, 20); i++) {
        const card = productCards.nth(i);
        const text = await card.textContent() || '';
        
        // 배너 관련 텍스트 제외
        if (text.includes('Banner') || text.includes('배너')) {
          continue;
        }
        
        // 가격이 포함된 상품만
        if (text.includes('$') && text.length > 10) {
          const productName = text.split('$')[0].trim().substring(0, 50);
          await card.click();
          await this.wait(2000);
          
          if (this.currentUrl.includes('/product/')) {
            return { success: true, productName };
          }
        }
      }

      return { success: false, productName: '' };
    } catch (e) {
      console.log('clickFirstProduct error:', e);
      return { success: false, productName: '' };
    }
  }

  /**
   * 상품 상세 페이지 요소 확인
   * AlbumBuddy 상품 페이지 구조: /product/{uuid}?tab=description
   */
  async verifyProductDetailPage(): Promise<{
    hasImage: boolean;
    hasPrice: boolean;
    hasTitle: boolean;
    hasAddToCartButton: boolean;
  }> {
    await this.wait(1000);
    
    // URL이 상품 상세 페이지인지 확인
    const currentUrl = this.currentUrl;
    const isProductPage = currentUrl.includes('/product/');
    
    if (!isProductPage) {
      return { hasImage: false, hasPrice: false, hasTitle: false, hasAddToCartButton: false };
    }
    
    // 이미지 확인 (AlbumBuddy는 img[alt="image"] 또는 img[alt="componentImage"] 사용)
    const hasImage = await this.page.locator('img[alt="image"], img[alt="componentImage"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    
    // 가격 확인 ($ 기호가 있는 요소)
    const pageText = await this.page.evaluate(() => document.body.innerText);
    const hasPrice = pageText.includes('$') && /\$\s*\d+/.test(pageText);
    
    // 타이틀/상품명 확인 (상품 제목이 포함된 요소)
    const hasTitle = await this.page.locator('generic:has-text("Album"), generic:has-text("앨범"), generic:has-text("Mini Album"), generic:has-text("Single")').first().isVisible({ timeout: 3000 }).catch(() => false) ||
                     pageText.includes('Album') || pageText.includes('Mini') || pageText.includes('Single');
    
    // 구매 버튼 확인 (AlbumBuddy는 "Add to assisted purchasing" 버튼 사용)
    const hasAddToCartButton = await this.page.locator('button:has-text("Add to assisted purchasing"), button:has-text("assisted"), button:has-text("구매 대행")').first().isVisible({ timeout: 3000 }).catch(() => false);

    return { hasImage, hasPrice, hasTitle, hasAddToCartButton };
  }

  /**
   * 상품 이미지 로드 확인
   * AlbumBuddy 상품 페이지에서 이미지가 실제로 로드되었는지 확인
   */
  async verifyProductImageLoaded(): Promise<boolean> {
    // URL이 상품 상세 페이지인지 확인
    const currentUrl = this.currentUrl;
    if (!currentUrl.includes('/product/')) {
      return false;
    }
    
    // AlbumBuddy는 img[alt="image"] 또는 img[alt="componentImage"] 사용
    const productImages = this.page.locator('img[alt="image"], img[alt="componentImage"]');
    const count = await productImages.count();
    
    if (count === 0) return false;
    
    const firstImg = productImages.first();
    if (await firstImg.isVisible()) {
      const naturalWidth = await firstImg.evaluate((img: HTMLImageElement) => img.naturalWidth);
      return naturalWidth > 0;
    }
    return false;
  }
}
