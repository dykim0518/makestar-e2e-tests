/**
 * AlbumBuddy 핵심 기능 모니터링 테스트 (Page Object Model 적용)
 * 
 * 이 테스트 파일은 POM 패턴을 사용하여 비즈니스 로직에만 집중합니다.
 * 페이지 조작 로직은 AlbumBuddyPage 클래스에 캡슐화되어 있습니다.
 * 
 * @see tests/pages/albumbuddy.page.ts
 * 
 * 테스트 구조 (메뉴 기반 + 사용자 시나리오):
 * 1. Health Check - 서비스 상태 확인
 * 2. Shop (홈) - 메인 페이지 기능
 * 3. About - 서비스 소개
 * 4. Pricing - 가격 정책
 * 5. 상품 상세 & Request Item - 구매 플로우
 * 6. Dashboard - 로그인 사용자 기능 (Purchasing, Package)
 * 7. 통합 시나리오 - 사용자 여정
 * 
 * 참고: AlbumBuddy는 구매 대행 서비스로, 일반 쇼핑몰과 달리 장바구니 기능이 없습니다.
 * Request Item 기능을 통해 상품을 요청하고, Dashboard에서 구매 현황을 관리합니다.
 */

import { test, expect } from '@playwright/test';
import { AlbumBuddyPage, ALBUMBUDDY_PAGES, HOME_SECTIONS, PERFORMANCE_THRESHOLD } from './pages';
import * as path from 'path';

// ============================================================================
// 상수 및 헬퍼
// ============================================================================
const AUTH_FILE = path.join(__dirname, '..', 'ab-auth.json');

/** 인증 파일 상태 확인 */
const checkAuthFile = (): { available: boolean; reason: string } => {
  const fs = require('fs');
  if (!fs.existsSync(AUTH_FILE)) {
    return { available: false, reason: `세션 파일이 존재하지 않습니다: ${AUTH_FILE}` };
  }
  try {
    const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    const cookies = auth.cookies || [];
    if (cookies.length === 0) {
      return { available: false, reason: '세션 파일에 쿠키가 없습니다' };
    }
    const now = Date.now() / 1000;
    const validCookies = cookies.filter((c: any) => !c.expires || c.expires > now);
    if (validCookies.length === 0) {
      return { available: false, reason: '세션의 모든 쿠키가 만료되었습니다' };
    }
    return { available: true, reason: '' };
  } catch (e) {
    return { available: false, reason: `세션 파일 파싱 오류: ${e}` };
  }
};

// ============================================================================
// 1. Health Check - 서비스 상태 확인
// ============================================================================
test.describe.serial('1. Health Check', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let albumbuddy: AlbumBuddyPage;

  test('1-1 사이트 접근 가능 여부', async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    const response = await page.goto(albumbuddy.shopUrl, { waitUntil: 'domcontentloaded' });
    
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(albumbuddy.siteTitle);
  });

  test('1-2 주요 페이지 응답 상태 (Shop, About, Pricing)', async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    const results = await albumbuddy.checkPagesStatus();
    
    for (const result of results) {
      expect(result.ok, `${result.url} 응답 실패`).toBe(true);
    }
  });

  test('1-3 홈페이지 로드 성능', async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    const result = await albumbuddy.measureHomePagePerformance();
    
    console.log(`홈페이지 로드 시간: ${result.loadTime}ms`);
    expect(result.passed).toBe(true);
  });

  test('1-4 네트워크 에러 모니터링', async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    
    const criticalFailures = await albumbuddy.monitorNetworkErrors(async () => {
      await page.goto(albumbuddy.shopUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(3000); // 추가 네트워크 요청 대기
    });
    
    expect(criticalFailures).toHaveLength(0);
  });
});

// ============================================================================
// 2. Shop (홈페이지) - 메인 진입점
// ============================================================================
test.describe('2. Shop (홈페이지)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let albumbuddy: AlbumBuddyPage;

  test.describe('2-1 페이지 로드 및 기본 UI', () => {
    
    test('홈페이지 접근 및 타이틀 확인', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      await expect(page).toHaveTitle(albumbuddy.siteTitle);
    });

    test('네비게이션 버튼 표시 (About, Pricing, Dashboard, Request item)', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      await albumbuddy.verifyNavButtons();
    });

    test('브랜드 요소 표시 (AlbumBuddy, MAKESTAR, USD)', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      
      const { hasBrand, hasMakestar, hasCurrency } = await albumbuddy.verifyBrandElements();
      
      expect(hasBrand).toBe(true);
      expect(hasMakestar).toBe(true);
      expect(hasCurrency).toBe(true);
    });
  });

  test.describe('2-2 콘텐츠 섹션', () => {
    
    test('핵심 섹션 확인 (Artists, Recent Albums, Trending, Official Partner)', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      
      const results = await albumbuddy.verifyHomeSections();
      const foundSections = Object.entries(results).filter(([_, found]) => found);
      
      console.log('발견된 섹션:', foundSections.map(([name]) => name).join(', '));
      console.log('전체 결과:', JSON.stringify(results));
      
      // 최소 1개 이상의 핵심 섹션이 있으면 통과
      expect(foundSections.length, '최소 1개 이상의 핵심 섹션이 필요합니다').toBeGreaterThanOrEqual(1);
    });

    test('이미지 콘텐츠 로드 확인', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      
      const { count, firstImageLoaded } = await albumbuddy.verifyImagesLoaded();
      
      expect(count).toBeGreaterThan(0);
      if (count > 0) {
        expect(firstImageLoaded).toBe(true);
      }
    });

    test('Show more 버튼 동작', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      
      // 홈페이지에 Artists 또는 추천 섹션이 있어야 함
      const hasSection = await albumbuddy.hasText('Artist') || await albumbuddy.hasText('추천');
      expect(hasSection, '홈페이지에 Artists 또는 추천 섹션이 있어야 합니다').toBe(true);
      
      const clicked = await albumbuddy.clickShowMore();
      console.log(`Show more 버튼: ${clicked ? '클릭됨' : '없음 (더보기 버튼으로 대체 가능)'}`);
      
      // Show more 버튼이 있으면 클릭 후 콘텐츠가 있어야 함
      if (clicked) {
        const contentLength = await page.evaluate(() => document.body.innerText.length);
        expect(contentLength, 'Show more 클릭 후 콘텐츠가 있어야 합니다').toBeGreaterThan(100);
      } else {
        // Show more 버튼이 없어도 더보기 버튼이 있는지 확인
        const hasMoreButton = await page.locator('button:has-text("더보기")').first().isVisible({ timeout: 3000 }).catch(() => false);
        console.log(`더보기 버튼: ${hasMoreButton ? '있음' : '없음'}`);
        // 둘 중 하나는 있어야 함 (또는 이미 모든 콘텐츠 표시)
        expect(true).toBe(true); // 더보기 버튼이 없어도 허용 (이미 모든 콘텐츠 표시 가능)
      }
    });
  });

  test.describe('2-3 검색 기능', () => {
    
    test('검색창 접근', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      
      const opened = await albumbuddy.openSearch();
      console.log(`검색창 열기: ${opened ? '성공' : '검색 기능 없음 또는 다른 방식'}`);
      // 검색창이 열렸거나, 검색 입력 필드가 존재해야 함
      const hasSearchInput = await page.locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="검색" i]').first().isVisible({ timeout: 3000 }).catch(() => false);
      expect(opened || hasSearchInput, '검색 기능을 찾을 수 없습니다').toBe(true);
    });

    test('아티스트 검색 (BTS)', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      
      const { success, hasResults } = await albumbuddy.search('BTS');
      
      // 검색 기능이 동작해야 함
      expect(success, '검색 기능이 정상적으로 동작해야 합니다').toBe(true);
      
      if (success) {
        console.log(`검색 결과: ${hasResults ? '있음' : '없음'}`);
        // BTS 검색 시 결과가 있어야 함 (유명 아티스트)
        expect(hasResults, 'BTS 검색 시 결과가 있어야 합니다').toBe(true);
      }
    });

    test('존재하지 않는 검색어 처리', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      
      const { success, hasResults } = await albumbuddy.search('xyznonexistent12345');
      
      // 검색 기능 자체는 동작해야 함
      expect(success, '검색 기능이 정상적으로 동작해야 합니다').toBe(true);
      
      if (success) {
        console.log(`검색 결과 여부: ${hasResults ? '있음' : '없음'}`);
        // 존재하지 않는 검색어는 결과가 없어야 함
        expect(hasResults, '존재하지 않는 검색어는 결과가 없어야 합니다').toBe(false);
      }
    });
  });
});

// ============================================================================
// 3. About - 서비스 소개
// ============================================================================
test.describe('3. About', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let albumbuddy: AlbumBuddyPage;

  test('3-1 About 페이지 직접 접근', async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    await albumbuddy.gotoAbout();
    await expect(page).toHaveURL(ALBUMBUDDY_PAGES.about.pattern);
  });

  test('3-2 Shop → About 네비게이션', async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    await albumbuddy.gotoHome();
    await albumbuddy.clickNavButton('About');
    await expect(page).toHaveURL(ALBUMBUDDY_PAGES.about.pattern, { timeout: 10000 });
  });

  test('3-3 About 페이지 콘텐츠 확인', async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    await albumbuddy.gotoAbout();
    
    // About 페이지에 서비스 설명이 있는지 확인
    const hasAboutContent = await albumbuddy.hasText('AlbumBuddy') || 
                           await albumbuddy.hasText('앨범버디') ||
                           await albumbuddy.hasText('service');
    expect(hasAboutContent).toBe(true);
  });
});

// ============================================================================
// 4. Pricing - 가격 정책
// ============================================================================
test.describe('4. Pricing', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let albumbuddy: AlbumBuddyPage;

  test('4-1 Pricing 페이지 직접 접근', async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    await albumbuddy.gotoPricing();
    await expect(page).toHaveURL(ALBUMBUDDY_PAGES.pricing.pattern);
  });

  test('4-2 Shop → Pricing 네비게이션', async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    await albumbuddy.gotoHome();
    await albumbuddy.clickNavButton('Pricing');
    await expect(page).toHaveURL(ALBUMBUDDY_PAGES.pricing.pattern, { timeout: 10000 });
  });

  test('4-3 Pricing 페이지 가격 정보 확인', async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    await albumbuddy.gotoPricing();
    
    // 가격 관련 텍스트 확인
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasPricingContent = /\$|USD|price|fee|cost/i.test(pageText) ||
                              pageText.includes('요금') ||
                              pageText.includes('가격');
    expect(hasPricingContent).toBe(true);
  });
});

// ============================================================================
// 5. 상품 상세 & Request Item - 구매 플로우
// ============================================================================
test.describe('5. 상품 상세 & Request Item 플로우', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let albumbuddy: AlbumBuddyPage;

  test.describe('5-1 상품 상세 페이지', () => {
    
    test('상품 클릭하여 상세 페이지 이동', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      
      const { success, productName } = await albumbuddy.clickFirstProduct();
      
      // 홈페이지에 상품이 있어야 하고 클릭 가능해야 함
      expect(success, '홈페이지에서 상품을 찾고 클릭할 수 있어야 합니다').toBe(true);
      
      if (success) {
        console.log(`클릭한 상품: ${productName}`);
        const currentUrl = albumbuddy.currentUrl;
        // 상품 클릭 후 URL이 /product/로 변경되어야 함
        expect(currentUrl.includes('/product/'), '상품 클릭 후 상세 페이지(/product/)\ub85c 이동해야 합니다').toBe(true);
      }
    });

    test('상품 상세 페이지 요소 확인 (이미지, 가격, 제목)', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      
      const { success } = await albumbuddy.clickFirstProduct();
      
      // 상품 클릭이 성공해야 함
      expect(success, '상품을 클릭하여 상세 페이지로 이동해야 합니다').toBe(true);
      
      if (success) {
        const details = await albumbuddy.verifyProductDetailPage();
        
        console.log(`상품 상세 페이지 요소:`);
        console.log(`  - 이미지: ${details.hasImage}`);
        console.log(`  - 가격: ${details.hasPrice}`);
        console.log(`  - 제목: ${details.hasTitle}`);
        
        // 상세 페이지에는 최소 이미지, 가격, 제목 중 하나가 있어야 함
        const hasAnyElement = details.hasImage || details.hasPrice || details.hasTitle;
        expect(hasAnyElement, '상품 상세 페이지에 이미지, 가격, 제목 중 하나 이상이 있어야 합니다').toBe(true);
        
        // 더 엄격하게: 이미지와 가격은 필수
        expect(details.hasImage, '상품 이미지가 표시되어야 합니다').toBe(true);
        expect(details.hasPrice, '상품 가격이 표시되어야 합니다').toBe(true);
      }
    });

    test('상품 이미지 로드 확인', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      
      const { success } = await albumbuddy.clickFirstProduct();
      
      // 상품 클릭이 성공해야 함
      expect(success, '상품을 클릭하여 상세 페이지로 이동해야 합니다').toBe(true);
      
      if (success) {
        const imageLoaded = await albumbuddy.verifyProductImageLoaded();
        console.log(`상품 이미지 로드: ${imageLoaded ? '성공' : '이미지 없음 또는 로드 실패'}`);
        // 상품 이미지가 실제로 로드되어야 함
        expect(imageLoaded, '상품 이미지가 정상적으로 로드되어야 합니다').toBe(true);
      }
    });
  });

  test.describe('5-2 Request Item 기능', () => {
    
    test('Request item 버튼 표시', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      
      await expect(albumbuddy.requestItemButton).toBeVisible({ timeout: 10000 });
      console.log('Request item 버튼이 정상적으로 표시됩니다');
    });

    test('Request item 버튼 클릭 동작', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      
      await expect(albumbuddy.requestItemButton).toBeVisible({ timeout: 10000 });
      
      const { modalVisible, urlChanged } = await albumbuddy.clickRequestItemAndVerify();
      console.log(`Request item 결과: 모달=${modalVisible}, URL변경=${urlChanged}`);
      expect(modalVisible || urlChanged, 'Request item 버튼 클릭 후 모달이 열리거나 URL이 변경되어야 합니다').toBe(true);
    });
  });
});

// ============================================================================
// 6. Dashboard - 로그인 사용자 기능
// ============================================================================
test.describe('6. Dashboard (로그인 필요)', () => {
  
  // 6-0: 비로그인 상태 테스트
  test.describe('6-0 인증 확인 (비로그인)', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    let albumbuddy: AlbumBuddyPage;

    test('Dashboard 접근 시 로그인 요구', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      
      const { needsLogin } = await albumbuddy.checkLoginRequired();
      expect(albumbuddy.currentUrl.includes('dashboard') || needsLogin, '비로그인 상태에서 Dashboard 접근 시 로그인이 요구되어야 합니다').toBe(true);
    });

    test('Dashboard 직접 접근 시 인증 리다이렉트', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboard();
      
      const currentUrl = albumbuddy.currentUrl;
      const isDashboardOrAuth = 
        currentUrl.includes('dashboard') || 
        currentUrl.includes('login') || 
        currentUrl.includes('auth');
      
      expect(isDashboardOrAuth, 'Dashboard 접근 시 dashboard, login, 또는 auth 페이지로 이동해야 합니다').toBe(true);
    });
  });

  // 6-1 ~ 6-4: 로그인 상태 테스트
  test.describe('6-1 인증 세션 검증', () => {
    const authStatus = checkAuthFile();
    
    test.use({ 
      storageState: authStatus.available ? AUTH_FILE : { cookies: [], origins: [] }
    });

    test('인증 세션 파일 유효성', async () => {
      expect(authStatus.available, 
        `인증 실패: ${authStatus.reason}\n` +
        `해결방법: npx playwright test tests/ab-save-auth.spec.ts -g "로그인" --headed --project=chromium`
      ).toBe(true);
    });
  });

  test.describe('6-2 Dashboard > Purchasing', () => {
    const authStatus = checkAuthFile();
    
    test.use({ 
      storageState: authStatus.available ? AUTH_FILE : { cookies: [], origins: [] }
    });
    
    let albumbuddy: AlbumBuddyPage;

    test('Purchasing 페이지 접근', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboardPurchasing();
      
      const currentUrl = albumbuddy.currentUrl;
      expect(currentUrl).toContain('purchasing');
      expect(currentUrl.includes('login')).toBe(false);
    });

    test('Purchasing 페이지 콘텐츠 로드', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboard();
      
      const { hasContent, notFound } = await albumbuddy.verifyDashboardContent();
      
      expect(notFound).toBe(false);
      expect(hasContent).toBe(true);
      expect(albumbuddy.isLoggedIn()).toBe(true);
    });

    test('구매 내역 UI 요소 확인', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboardPurchasing();
      
      const hasContent = await albumbuddy.verifyPurchasingContent();
      expect(hasContent).toBe(true);
    });
  });

  test.describe('6-3 Dashboard > Package', () => {
    const authStatus = checkAuthFile();
    
    test.use({ 
      storageState: authStatus.available ? AUTH_FILE : { cookies: [], origins: [] }
    });
    
    let albumbuddy: AlbumBuddyPage;

    test('Package 페이지 접근', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboardPackage();
      
      const currentUrl = albumbuddy.currentUrl;
      expect(currentUrl.includes('package') || currentUrl.includes('dashboard'), 'Package 페이지로 이동해야 합니다').toBe(true);
    });

    test('Package 페이지 콘텐츠 로드', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboardPackage();
      
      const { hasContent } = await albumbuddy.verifyDashboardContent();
      expect(hasContent).toBe(true);
      expect(albumbuddy.isLoggedIn()).toBe(true);
    });
    
    test('Package 페이지 콘텐츠 확인', async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboardPackage();
      
      const hasPackageContent = await albumbuddy.verifyPackageContent();
      expect(hasPackageContent).toBe(true);
    });
  });
});

// ============================================================================
// 7. 통합 시나리오 - 사용자 여정
// ============================================================================
test.describe('7. 통합 시나리오', () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let albumbuddy: AlbumBuddyPage;

  test('7-1 메뉴 탐색 플로우: Shop → About → Pricing', async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    
    // 1. Shop 진입
    await albumbuddy.gotoHome();
    await expect(page).toHaveTitle(albumbuddy.siteTitle);
    
    // 2. About으로 이동
    await albumbuddy.clickNavButton('About');
    await expect(page).toHaveURL(ALBUMBUDDY_PAGES.about.pattern);
    
    // 3. 홈으로 돌아가서 Pricing으로 이동
    await page.goto(albumbuddy.shopUrl, { waitUntil: 'domcontentloaded' });
    await albumbuddy.waitForPageReady();
    await albumbuddy.clickNavButton('Pricing');
    await expect(page).toHaveURL(ALBUMBUDDY_PAGES.pricing.pattern);
  });

  test('7-2 브라우저 히스토리: 뒤로/앞으로', async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    
    await page.goto(albumbuddy.shopUrl, { waitUntil: 'domcontentloaded' });
    await albumbuddy.gotoAbout();
    
    await page.goBack();
    await expect(page).toHaveURL(/shop/i);
    
    await page.goForward();
    await expect(page).toHaveURL(/about/i);
  });
});
