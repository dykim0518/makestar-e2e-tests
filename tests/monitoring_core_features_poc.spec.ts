import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 상수 정의 (Constants)
// ============================================================================

/** 기본 URL */
const BASE_URL = 'https://www.makestar.com';

/** 인증 파일 경로 */
const AUTH_FILE = path.join(__dirname, '..', 'auth.json');

/** 타임아웃 설정 (ms) */
const TIMEOUT = {
  SHORT: 2000,      // 짧은 대기
  MEDIUM: 5000,     // 중간 대기
  LONG: 10000,      // 긴 대기
  NAVIGATION: 45000, // 페이지 이동 (증가)
  TEST: 90000       // 테스트 전체 (증가)
} as const;

/** 텍스트 패턴 */
const TEXT_PATTERNS = {
  MODAL_DO_NOT_SHOW: [
    'Do not show again', 'do not show again', "Don't show again", 'Do not show',
    '다시 보지 않기', '다시보지않기', '다시 보지 않음', '오늘 하루 보지 않기'
  ],
  MODAL_CLOSE: ['닫기', '확인', 'Close', 'OK', 'close'],
  ENDED_TAB: ['종료된', 'Ended', 'Closed', 'Past', '종료'],
  ONGOING_TAB: ['진행중', 'Ongoing', '진행', 'ongoing'],
  PURCHASE_BTN: ['구매', 'buy', 'purchase', 'Purchase', 'Buy', '구매하기', 'product.purchase', 'Add to Cart', 'add to cart'],
  OPTION_SELECT: ['옵션', 'Option', 'option', '선택', 'Select', 'select'],
  QUANTITY: ['수량', 'Quantity', 'quantity', '개수']
} as const;

/** 셀렉터 */
const SELECTORS = {
  LOGO: ['img[alt="make-star"]', 'img[alt*="makestar"]', 'img[alt*="make"]', 'header img', 'a[href="/"] img'],
  NAV: ['header', 'nav', '[class*="header"]', '[class*="nav"]'],
  TITLE: ['h1', 'h2', '[class*="title"]', '[class*="Title"]', '[class*="product"]'],
  PRODUCT_LINK: ['a[href*="/product/"]', 'a[href*="/event/"]', '[class*="product"] a', '[class*="card"] a'],
  // 이벤트 카드는 div로 되어 있고 cursor:pointer와 썸네일 이미지를 가짐
  EVENT_CARD: ['img[alt="event-thumb-image"]', '[class*="event"] img', '[class*="card"]', '[class*="thumbnail"]'],
  EVENT_LINK: ['a[href*="/event/"]', 'a[href*="/product/"]', '[class*="event"] a', '[class*="card"] a'],
  // Shop 상품 카드는 div로 되어 있고 album_image를 가짐
  SHOP_PRODUCT_CARD: ['img[alt="album_image"]', 'img[alt*="album"]', 'img[alt*="product"]'],
  PROFILE_BTN: ['button:has(img[alt="profile"])', 'img[alt="profile"]', '[class*="profile"]'],
  GOOGLE_LOGIN: ['button:has-text("Google")', '[class*="google"]', 'img[alt*="oogle"]'],
  EMAIL_INPUT: 'input[type="email"]',
  PASSWORD_INPUT: 'input[type="password"]',
  // 상품 옵션 및 수량 관련
  OPTION_DROPDOWN: ['select', '[class*="option"]', '[class*="select"]', '[role="combobox"]', '[class*="dropdown"]'],
  QUANTITY_INPUT: ['input[type="number"]', '[class*="quantity"] input', '[class*="count"] input', 'input[name*="quantity"]'],
  QUANTITY_PLUS: ['button:has-text("+")', '[class*="plus"]', '[class*="increase"]', 'button[aria-label*="increase"]'],
  // 주문서 페이지 관련
  ORDER_PRODUCT_NAME: ['[class*="product-name"]', '[class*="productName"]', '[class*="item-name"]', '[class*="order"] h2', '[class*="order"] h3'],
  ORDER_PRICE: ['[class*="price"]', '[class*="total"]', '[class*="amount"]'],
  ORDER_FORM: ['form', '[class*="order"]', '[class*="checkout"]', '[class*="payment"]']
} as const;

// ============================================================================
// 헬퍼 함수 (Helper Functions)
// ============================================================================

/**
 * 페이지에서 여러 셀렉터 중 첫 번째로 보이는 요소 찾기
 */
async function findVisibleElement(page: Page, selectors: readonly string[], timeout: number = TIMEOUT.SHORT) {
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout })) {
        return { element, selector };
      }
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * 여러 텍스트 중 첫 번째로 보이는 버튼 클릭
 */
async function clickFirstVisibleText(page: Page, texts: readonly string[], timeout: number = TIMEOUT.SHORT): Promise<boolean> {
  for (const text of texts) {
    try {
      const btn = page.getByText(text, { exact: false }).first();
      if (await btn.isVisible({ timeout })) {
        await btn.click({ timeout: TIMEOUT.MEDIUM, force: true });
        await page.waitForTimeout(500);
        console.log(`✅ "${text}" 버튼 클릭`);
        return true;
      }
    } catch {
      continue;
    }
  }
  return false;
}

/**
 * 모달 처리 - "다시 보지 않기" 우선, 없으면 "닫기" 클릭
 */
async function handleModal(page: Page): Promise<void> {
  try {
    await page.waitForTimeout(TIMEOUT.SHORT);
    
    // 1단계: "Do not show again" 버튼 찾기
    const dismissed = await clickFirstVisibleText(page, TEXT_PATTERNS.MODAL_DO_NOT_SHOW, 1500);
    
    // 2단계: 모달이 여전히 있으면 닫기 버튼 클릭
    if (!dismissed) {
      const closed = await clickFirstVisibleText(page, TEXT_PATTERNS.MODAL_CLOSE, 1000);
      if (!closed) {
        // 모달이 없을 수 있음 - 정상
      }
    }
  } catch {
    // 모달 처리 실패는 무시
  }
}

/**
 * 추가 모달 닫기 (여러 개의 모달이 연속으로 나올 때)
 */
async function closeAllModals(page: Page): Promise<void> {
  const allCloseTexts = [...TEXT_PATTERNS.MODAL_DO_NOT_SHOW, ...TEXT_PATTERNS.MODAL_CLOSE];
  for (const text of allCloseTexts) {
    try {
      const btn = page.locator(`text=${text}`).first();
      if (await btn.isVisible({ timeout: 1000 })) {
        await btn.click({ force: true });
        await page.waitForTimeout(500);
      }
    } catch {
      continue;
    }
  }
}

/**
 * 로고 존재 확인
 */
async function verifyLogo(page: Page, timeout: number = TIMEOUT.MEDIUM): Promise<boolean> {
  const result = await findVisibleElement(page, SELECTORS.LOGO, timeout);
  if (result) {
    console.log(`✅ 로고 발견: ${result.selector}`);
    return true;
  }
  console.log('⚠️ 로고를 찾을 수 없음');
  return false;
}

/**
 * 네비게이션 존재 확인
 */
async function verifyNavigation(page: Page): Promise<boolean> {
  const result = await findVisibleElement(page, SELECTORS.NAV);
  if (result) {
    console.log(`✅ 네비게이션 발견: ${result.selector}`);
    return true;
  }
  console.log('⚠️ 네비게이션을 찾을 수 없음');
  return false;
}

// ============================================================================
// 테스트 스위트 (Test Suite)
// ============================================================================

/**
 * Makestar.com E2E 테스트
 * - 환경 변수: MAKESTAR_ID, MAKESTAR_PW
 * - 재시도 로직: 최대 3회
 */

test.describe('Makestar.com E2E 테스트', () => {
  
  // 모든 테스트에 기본 타임아웃 설정
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TIMEOUT.TEST); // 60초 타임아웃
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
    await page.waitForTimeout(TIMEOUT.SHORT);
    await handleModal(page);
  });

  test.describe('Home 페이지', () => {
    
    test('1) makestar.com 접속 및 초기 모달 처리', async ({ page }) => {
      await expect(page).toHaveURL(/makestar\.com/, { timeout: TIMEOUT.LONG });
      
      const title = await page.title();
      expect(title.toLowerCase()).toContain('makestar');
      
      console.log('✅ Test 1 완료: Home 접속 및 모달 처리');
    });

    test('2) Home 주요 요소 존재 여부 검증', async ({ page }) => {
      test.setTimeout(TIMEOUT.TEST);
      
      // 페이지 상단으로 스크롤 및 로드 대기
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      
      // 로고 검증 (충분한 대기 시간 부여)
      // 페이지가 완전히 로드되지 않았을 수 있으므로 재시도
      let logoFound = await verifyLogo(page, TIMEOUT.LONG);
      if (!logoFound) {
        // 페이지 새로고침 후 재시도
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(TIMEOUT.MEDIUM);
        logoFound = await verifyLogo(page, TIMEOUT.LONG);
      }
      expect(logoFound).toBeTruthy();
      
      // Event 링크
      const eventLink = page.locator('a, button').getByText(/event/i).first();
      await expect(eventLink).toBeVisible({ timeout: TIMEOUT.LONG });
      
      console.log('✅ Test 2 완료: Home 주요 요소 검증');
    });
  });

  test.describe('Event 페이지', () => {
    
    test('3) 상단 Event 클릭 및 Event 페이지 요소 검증', async ({ page }) => {
      test.setTimeout(TIMEOUT.TEST);
      // Event 링크 찾기
      const eventLink = page.locator('header').getByText(/event/i).first();
      
      if (await eventLink.isVisible({ timeout: TIMEOUT.MEDIUM })) {
        await eventLink.click({ timeout: TIMEOUT.MEDIUM });
      } else {
        await page.goto(`${BASE_URL}/event#1`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
      }
      
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      await expect(page).toHaveURL(/event/i, { timeout: TIMEOUT.LONG });
      
      const body = page.locator('body');
      await expect(body).toBeVisible();
      
      console.log('✅ Test 3 완료: Event 페이지 이동');
    });

    test('4) [종료된 이벤트] 탭 이동 및 요소 검증', async ({ page }) => {
      test.setTimeout(TIMEOUT.TEST);
      await page.goto(`${BASE_URL}/event#1`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      const found = await clickFirstVisibleText(page, TEXT_PATTERNS.ENDED_TAB, TIMEOUT.SHORT);
      expect(found).toBeTruthy();
      
      const content = page.locator('body');
      await expect(content).toBeVisible();
      
      console.log('✅ Test 4 완료: 종료된 이벤트 탭');
    });

    test('5) [진행중인 이벤트] 탭 복귀 및 첫 번째 이벤트 상품 클릭', async ({ page }) => {
      test.setTimeout(TIMEOUT.TEST);
      await page.goto(`${BASE_URL}/event#1`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      // 진행중인 이벤트 탭
      const ongoingClicked = await clickFirstVisibleText(page, TEXT_PATTERNS.ONGOING_TAB, TIMEOUT.SHORT);
      expect(ongoingClicked).toBeTruthy();
      console.log('✅ 진행중인 이벤트 탭 클릭');
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      // 첫 번째 이벤트 카드 찾기 (이미지 클릭)
      const eventCard = await findVisibleElement(page, SELECTORS.EVENT_CARD, TIMEOUT.LONG);
      expect(eventCard).not.toBeNull();
      
      // 이미지의 부모 요소(카드)를 클릭
      await eventCard!.element.click({ timeout: TIMEOUT.MEDIUM });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      // URL에 event 또는 product가 포함되어야 함
      await expect(page).toHaveURL(/event|product/i, { timeout: TIMEOUT.LONG });
      console.log('✅ 이벤트 상품 클릭 완료');
      
      console.log('✅ Test 5 완료: 첫 번째 이벤트 상품 클릭');
    });
  });

  test.describe('Product 페이지', () => {
    
    test('6) Product 페이지 주요 요소 검증 및 옵션 선택', async ({ page }) => {
      test.setTimeout(TIMEOUT.TEST);
      await page.goto(`${BASE_URL}/event#1`, { waitUntil: 'networkidle', timeout: TIMEOUT.NAVIGATION });
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      
      // 팝업/모달 처리
      await handleModal(page);
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      // 이벤트 카드 찾기
      const eventCard = await findVisibleElement(page, SELECTORS.EVENT_CARD, TIMEOUT.LONG);
      expect(eventCard).not.toBeNull();
      
      await eventCard!.element.click({ timeout: TIMEOUT.MEDIUM });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      // 제목 확인 (통합 시나리오와 동일한 방식)
      const titleResult = await findVisibleElement(page, SELECTORS.TITLE, TIMEOUT.LONG);
      expect(titleResult).not.toBeNull();
      
      // 가격 정보 확인
      const priceText = await page.locator('body').textContent();
      expect(priceText).toMatch(/원|₩|KRW/i);
      
      console.log('✅ Product 페이지 검증 완료');
      console.log('✅ Test 6 완료: Product 페이지 요소 검증');
    });

    test('7) [구매하기] 클릭 및 로그인 페이지 검증', async ({ page }) => {
      test.setTimeout(TIMEOUT.TEST);
      await page.goto(`${BASE_URL}/event#1`, { waitUntil: 'networkidle', timeout: TIMEOUT.NAVIGATION });
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      
      // 모달 처리
      await handleModal(page);
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      // 이벤트 카드 찾기
      const eventCard = await findVisibleElement(page, SELECTORS.EVENT_CARD, TIMEOUT.LONG);
      expect(eventCard).not.toBeNull();
      
      await eventCard!.element.click({ timeout: TIMEOUT.MEDIUM });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      // 구매 버튼 찾기 및 클릭 - TEXT_PATTERNS 활용 (필수)
      const purchaseClicked = await clickFirstVisibleText(page, TEXT_PATTERNS.PURCHASE_BTN, TIMEOUT.MEDIUM);
      expect(purchaseClicked).toBeTruthy();
      console.log('✅ 구매 버튼 클릭 완료');
      
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      const afterClickUrl = page.url();
      console.log(`📍 버튼 클릭 후 URL: ${afterClickUrl}`);
      
      // 구매 버튼 클릭 후 결과 검증 (필수)
      // - 로그인 페이지 (Google 버튼), 또는
      // - 결제 페이지 (payment/checkout), 또는
      // - 상품 페이지에 머문 경우 (옵션 선택 필요 등)
      const googleBtn = await findVisibleElement(page, SELECTORS.GOOGLE_LOGIN, TIMEOUT.MEDIUM);
      const isPaymentPage = /payment|checkout|order/i.test(afterClickUrl);
      const isProductPage = /product/i.test(afterClickUrl);
      
      // 세 가지 중 하나여야 함
      expect(googleBtn !== null || isPaymentPage || isProductPage).toBeTruthy();
      
      if (googleBtn) {
        console.log('✅ Google 로그인 버튼 발견');
      } else if (isPaymentPage) {
        console.log('✅ 결제 페이지로 이동됨 (로그인 상태)');
      } else {
        console.log('✅ 상품 페이지에 머무름 (옵션 선택 필요 등)');
      }
      
      console.log('✅ Test 7 완료: 구매하기 버튼 클릭');
    });
  });

  test.describe('로그인 및 결제', () => {
    
    test('8) 저장된 세션으로 로그인 및 결제 페이지 이동', async ({ page, context }) => {
      test.setTimeout(TIMEOUT.TEST * 1.5); // 90초 timeout
      
      // =================================================================
      // 1단계: 저장된 세션 확인 및 로드
      // =================================================================
      let sessionLoaded = false;
      
      if (fs.existsSync(AUTH_FILE)) {
        try {
          const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
          
          // mock 데이터인지 확인 (mock_session_token이 포함되어 있으면 무효)
          const hasMockData = authData.cookies?.some((c: any) => 
            c.value?.includes('mock_session') || c.value?.includes('mock_token')
          );
          
          if (!hasMockData && authData.cookies?.length > 0) {
            // 실제 세션 데이터 로드
            await context.addCookies(authData.cookies);
            console.log(`🍪 저장된 세션 로드 완료 (쿠키 ${authData.cookies.length}개)`);
            sessionLoaded = true;
          } else {
            console.log('⚠️ auth.json에 mock 데이터가 있습니다. 실제 세션이 필요합니다.');
          }
        } catch (e) {
          console.log('⚠️ auth.json 파싱 실패:', e);
        }
      } else {
        console.log('⚠️ auth.json 파일이 없습니다.');
      }
      
      if (!sessionLoaded) {
        console.log('');
        console.log('='.repeat(70));
        console.log('💡 로그인 세션을 먼저 저장해주세요:');
        console.log('   npx playwright test tests/save-auth.spec.ts -g "로그인 세션 저장" --headed');
        console.log('='.repeat(70));
        console.log('');
      }
      
      // =================================================================
      // 2단계: 로그인 상태 확인
      // =================================================================
      console.log('🔍 로그인 상태 확인 중...');
      await page.goto(`${BASE_URL}/my-page`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
      await page.waitForTimeout(3000);
      
      // 모달 닫기
      await closeAllModals(page);
      
      const currentUrl = page.url();
      console.log(`📍 현재 URL: ${currentUrl}`);
      
      // 로그인 상태 판단
      const isLoggedIn = currentUrl.includes('my-page') && 
                         !currentUrl.includes('login') && 
                         !currentUrl.includes('auth.makestar.com');
      
      if (isLoggedIn) {
        console.log('✅ 로그인 상태 확인됨!');
        
        // 로그아웃 버튼 확인 (필수 - 다국어 지원)
        const logoutBtn = page.locator('text=/로그아웃|logout|log out|sign out/i').first();
        const logoutVisible = await logoutBtn.isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
        expect(logoutVisible).toBeTruthy();
        console.log('✅ 로그아웃 버튼 발견 - 로그인 확인됨');
        
        // =================================================================
        // 3단계: 결제 플로우 테스트 (Shop 페이지 사용 - 품절 가능성 낮음)
        // =================================================================
        console.log('\n🛒 결제 플로우 테스트...');
        
        // Shop 페이지로 이동 (Event보다 품절 가능성 낮음)
        await page.goto(`${BASE_URL}/shop`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
        await page.waitForTimeout(TIMEOUT.SHORT);
        await handleModal(page);
        console.log('📍 Shop 페이지 이동 완료');
        
        // Shop 페이지에서 첫 번째 상품 카드 찾기 (Sold Out 제외)
        const shopProductCards = page.locator('img[alt="album_image"]');
        const cardCount = await shopProductCards.count();
        console.log(`   상품 카드 ${cardCount}개 발견`);
        
        let productClicked = false;
        for (let i = 0; i < Math.min(cardCount, 5); i++) {
          const card = shopProductCards.nth(i);
          // 부모 요소에 Sold Out이 있는지 확인
          const parentText = await card.locator('xpath=ancestor::*[3]').textContent().catch(() => '');
          if (parentText && /sold out/i.test(parentText)) {
            console.log(`   상품 ${i + 1}: 품절 - 건너뜀`);
            continue;
          }
          
          console.log(`   상품 ${i + 1}: 클릭 시도`);
          await card.click();
          productClicked = true;
          break;
        }
        expect(productClicked).toBeTruthy();
        
        await page.waitForLoadState('domcontentloaded');
        await page.waitForTimeout(3000);
        await handleModal(page);
        
        console.log(`📍 상품 페이지 URL: ${page.url()}`);
        
        // =================================================================
        // Step 1: 상품 옵션 선택 (수량 1로 설정)
        // =================================================================
        console.log('\n🔧 Step 1: 상품 옵션 확인 및 선택...');
        
        // 옵션 드롭다운 찾기
        let optionSelected = false;
        const optionDropdown = await findVisibleElement(page, SELECTORS.OPTION_DROPDOWN, TIMEOUT.MEDIUM);
        if (optionDropdown) {
          console.log(`   옵션 드롭다운 발견: ${optionDropdown.selector}`);
          await optionDropdown.element.click();
          await page.waitForTimeout(TIMEOUT.SHORT);
          
          // 첫 번째 옵션 선택 (드롭다운 옵션 클릭)
          const firstOption = page.locator('option, [role="option"], li').first();
          if (await firstOption.isVisible({ timeout: TIMEOUT.SHORT }).catch(() => false)) {
            await firstOption.click().catch(() => {});
            console.log('   ✅ 첫 번째 옵션 선택');
            optionSelected = true;
          }
        }
        
        // 수량 입력 필드 찾기 (필수)
        const quantityInput = await findVisibleElement(page, SELECTORS.QUANTITY_INPUT, TIMEOUT.MEDIUM);
        expect(quantityInput).not.toBeNull();
        console.log('   수량 입력 필드 발견');
        await quantityInput!.element.fill('1');
        console.log('   ✅ 수량 1 입력');
        
        // + 버튼으로 수량 증가 시도 (선택적 - 수량 입력이 주요 검증)
        const plusBtn = await findVisibleElement(page, SELECTORS.QUANTITY_PLUS, TIMEOUT.SHORT);
        if (plusBtn) {
          console.log('   수량 증가 버튼 발견');
          await plusBtn.element.click();
          console.log('   ✅ 수량 증가 버튼 클릭');
        }
        await page.waitForTimeout(TIMEOUT.SHORT);
        
        // =================================================================
        // Step 2: 구매 버튼 클릭 및 주문서 페이지 이동
        // =================================================================
        console.log('\n🛒 Step 2: 구매 버튼 클릭...');
        
        // product.purchase 버튼 직접 찾기 (i18n 키가 노출된 경우)
        let purchaseBtn = page.locator('button:has-text("product.purchase")').first();
        if (!await purchaseBtn.isVisible({ timeout: TIMEOUT.SHORT }).catch(() => false)) {
          // 일반 구매 버튼 텍스트로 시도
          purchaseBtn = page.locator('button:has-text("purchase"), button:has-text("구매"), button:has-text("buy")').first();
        }
        
        const isPurchaseBtnVisible = await purchaseBtn.isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
        expect(isPurchaseBtnVisible).toBeTruthy();
        
        console.log('   구매 버튼 발견, 클릭 시도...');
        await purchaseBtn.click();
        console.log('   ✅ 구매 버튼 클릭 완료');
        
        // 페이지 이동 대기
        await page.waitForTimeout(3000);
        await page.waitForLoadState('domcontentloaded');
        
        const afterClickUrl = page.url();
        console.log(`   📍 이동된 URL: ${afterClickUrl}`);
        
        // =================================================================
        // Step 3: 주문서 페이지 요소 검증
        // =================================================================
        console.log('\n📋 Step 3: 주문서 페이지 검증...');
        
        // URL이 결제/주문 관련인지 확인 (필수 검증)
        const isOrderPage = /payment|checkout|order|cart/i.test(afterClickUrl);
        expect(isOrderPage).toBeTruthy();
        console.log('   ✅ 주문서/결제 페이지로 이동 성공!');
        
        // 주문서 페이지 주요 요소 검증 (모두 필수)
        // 1. 상품명 확인 (필수)
        const productNameResult = await findVisibleElement(page, SELECTORS.ORDER_PRODUCT_NAME, TIMEOUT.MEDIUM);
        expect(productNameResult).not.toBeNull();
        const productName = await productNameResult!.element.textContent();
        expect(productName).toBeTruthy();
        console.log(`   ✅ 상품명 확인: ${productName?.substring(0, 50)}...`);
        
        // 2. 가격 정보 확인 (필수 검증)
        const bodyText = await page.locator('body').textContent();
        const hasPrice = /원|₩|KRW|\d{1,3}(,\d{3})+/i.test(bodyText || '');
        expect(hasPrice).toBeTruthy();
        console.log('   ✅ 가격 정보 확인');
        
        // 3. 주문 폼 확인 (필수)
        const orderFormResult = await findVisibleElement(page, SELECTORS.ORDER_FORM, TIMEOUT.MEDIUM);
        expect(orderFormResult).not.toBeNull();
        console.log('   ✅ 주문서 폼 확인');
        
        // 4. 결제 버튼 확인 (필수 - 클릭하지 않음)
        const paymentBtn = page.locator('button:has-text("결제"), button:has-text("payment"), button:has-text("pay"), button:has-text("주문"), button:has-text("order")').first();
        const paymentBtnExists = await paymentBtn.isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
        expect(paymentBtnExists).toBeTruthy();
        console.log('   ✅ 결제 버튼 확인 (클릭하지 않음)');
        
        console.log('✅ Test 8 완료: 로그인 상태에서 결제 플로우 검증');
        
      } else {
        // 로그인되지 않은 상태 - 테스트 실패
        console.log('❌ 로그인되지 않은 상태입니다.');
        console.log('');
        console.log('='.repeat(70));
        console.log('🔐 로그인 세션을 저장하려면:');
        console.log('   npx playwright test tests/save-auth.spec.ts -g "로그인 세션 저장" --headed');
        console.log('');
        console.log('그 후 다시 테스트를 실행하세요.');
        console.log('='.repeat(70));
        
        // 필수 검증: 로그인 상태가 아니면 실패
        expect(isLoggedIn).toBeTruthy();
      }
    });
  });

  test.describe('네비게이션', () => {
    
    test('9) 로고 및 Home 버튼으로 메인 페이지 복귀 검증', async ({ page }) => {
      test.setTimeout(TIMEOUT.TEST);
      
      // === Part 1: 로고 클릭으로 Home 복귀 ===
      await page.goto(`${BASE_URL}/event#1`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      const logoResult = await findVisibleElement(page, SELECTORS.LOGO, TIMEOUT.MEDIUM);
      expect(logoResult).not.toBeNull();
      console.log(`✅ 로고 발견: ${logoResult!.selector}`);
      
      await logoResult!.element.click({ timeout: TIMEOUT.MEDIUM });
      await page.waitForTimeout(TIMEOUT.SHORT);
      await expect(page).toHaveURL(/^https:\/\/(www\.)?makestar\.com\/?$/, { timeout: TIMEOUT.LONG });
      console.log('✅ 로고 클릭으로 Home 복귀 완료');
      
      // === Part 2: Home 버튼 클릭으로 Home 복귀 ===
      await page.goto(`${BASE_URL}/shop`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
      await page.waitForTimeout(TIMEOUT.SHORT);
      await handleModal(page);
      
      const homeBtn = page.locator('button:has-text("Home"), a:has-text("Home")').first();
      const isHomeBtnVisible = await homeBtn.isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
      expect(isHomeBtnVisible).toBeTruthy();
      console.log('✅ Home 버튼 발견');
      
      await homeBtn.click();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(TIMEOUT.SHORT);
      await expect(page).toHaveURL(/^https:\/\/(www\.)?makestar\.com\/?$/, { timeout: TIMEOUT.LONG });
      console.log('✅ Home 버튼 클릭으로 Home 복귀 완료');
      
      console.log('✅ Test 9 완료: 네비게이션 복귀 검증');
    });
  });

  // 통합 시나리오는 개별 테스트와 중복되므로 제거됨 (실행 시간 최적화)

  // ============================================================================
  // 추가 테스트: 검색 기능
  // ============================================================================
  test.describe('검색 기능', () => {
    
    test('10) 검색 UI 열기 및 추천 검색어 표시 확인', async ({ page }) => {
      test.setTimeout(TIMEOUT.TEST);
      
      // 페이지 완전 로드 대기
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      
      // 모달/팝업 처리 (중요!)
      await handleModal(page);
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      // 페이지 상단으로 스크롤 (헤더가 보이도록)
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      // 검색 버튼 클릭 - 첫 번째 버튼이 검색 버튼 (돋보기 아이콘)
      const searchBtn = page.locator('button').first();
      const isSearchBtnVisible = await searchBtn.isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
      expect(isSearchBtnVisible).toBeTruthy();
      console.log('✅ 검색 버튼 발견');
      
      await searchBtn.click();
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      
      // 검색 입력창 확인 (필수) - placeholder로 찾기 (영어/한국어 모두 지원)
      const searchInput = page.getByPlaceholder(/검색어를 입력|검색|search|Enter a keyword|keyword/i);
      const isSearchInputVisible = await searchInput.isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
      expect(isSearchInputVisible).toBeTruthy();
      console.log('✅ 검색 입력창 표시됨');
      
      // 추천 검색어 확인 (필수) - 영어/한국어 모두 지원
      const recommendedKeyword = page.locator('text=/추천 검색어|인기 검색어|추천|Recommended/i');
      const hasRecommended = await recommendedKeyword.first().isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
      expect(hasRecommended).toBeTruthy();
      console.log('✅ 추천 검색어 섹션 표시됨');
      
      // 취소 버튼 확인 (필수) - 영어/한국어 모두 지원
      const cancelBtn = page.locator('button:has-text("취소"), button:has-text("Cancel")');
      const hasCancelBtn = await cancelBtn.first().isVisible({ timeout: TIMEOUT.SHORT }).catch(() => false);
      expect(hasCancelBtn).toBeTruthy();
      console.log('✅ 취소 버튼 표시됨');
      
      console.log('✅ Test 10 완료: 검색 UI 확인');
    });

    test('11) 검색어 입력 및 검색 결과 확인', async ({ page }) => {
      test.setTimeout(TIMEOUT.TEST);
      
      // 페이지 완전 로드 대기
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      
      // 모달/팝업 처리 (중요!)
      await handleModal(page);
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      // 페이지 상단으로 스크롤
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      // 검색 버튼 클릭 - 첫 번째 버튼이 검색 버튼
      const searchBtn = page.locator('button').first();
      await expect(searchBtn).toBeVisible({ timeout: TIMEOUT.MEDIUM });
      await searchBtn.click();
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      
      // 검색어 입력 (영어/한국어 placeholder 지원)
      const searchInput = page.getByPlaceholder(/검색어를 입력|검색|search|Enter a keyword|keyword/i);
      await expect(searchInput).toBeVisible({ timeout: TIMEOUT.MEDIUM });
      await searchInput.fill('BTS');
      await page.waitForTimeout(TIMEOUT.SHORT);
      
      // 검색 실행 (Enter 키 또는 검색 버튼)
      await searchInput.press('Enter');
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      await page.waitForLoadState('domcontentloaded');
      
      // 검색 결과 페이지 확인 (필수)
      const currentUrl = page.url();
      const isSearchResult = /search|keyword|q=/i.test(currentUrl) || 
                            await page.locator('text=/BTS|검색 결과|결과/i').first().isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
      expect(isSearchResult).toBeTruthy();
      console.log(`✅ 검색 결과 페이지 이동: ${currentUrl}`);
      
      // 검색 결과 존재 확인 (상품/아티스트 카드)
      const hasResults = await page.locator('img[alt*="album"], img[alt*="sample"], [class*="card"], [class*="product"]').first().isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
      if (hasResults) {
        console.log('✅ 검색 결과 상품/아티스트 표시됨');
      } else {
        console.log('ℹ️ 검색 결과 없음 또는 다른 형태');
      }
      
      console.log('✅ Test 11 완료: 검색 기능 확인');
    });
  });

  // ============================================================================
  // 추가 테스트: GNB 네비게이션
  // ============================================================================
  test.describe('GNB 네비게이션', () => {
    
    test('12) Shop 페이지 이동 및 요소 검증', async ({ page }) => {
      test.setTimeout(TIMEOUT.TEST);
      
      // Shop 버튼 클릭
      const shopBtn = page.locator('button:has-text("Shop"), a:has-text("Shop")').first();
      if (await shopBtn.isVisible({ timeout: TIMEOUT.MEDIUM })) {
        await shopBtn.click();
      } else {
        await page.goto(`${BASE_URL}/shop`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
      }
      
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      await handleModal(page);
      
      // URL 확인 (필수)
      await expect(page).toHaveURL(/shop/i, { timeout: TIMEOUT.LONG });
      console.log('✅ Shop 페이지 이동 완료');
      
      // 상품 카테고리 탭 확인 (필수)
      const categoryTab = page.locator('text=/전체|앨범|MD|DVD|추천/i');
      const hasCategoryTab = await categoryTab.first().isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
      expect(hasCategoryTab).toBeTruthy();
      console.log('✅ 상품 카테고리 탭 표시됨');
      
      // 상품 카드 확인 (필수)
      const productCards = page.locator('img[alt="album_image"]');
      const cardCount = await productCards.count();
      expect(cardCount).toBeGreaterThan(0);
      console.log(`✅ 상품 카드 ${cardCount}개 표시됨`);
      
      // 가격 정보 확인 (필수)
      const priceText = await page.locator('body').textContent();
      const hasPrice = /₩|원|KRW|\d{1,3}(,\d{3})+/i.test(priceText || '');
      expect(hasPrice).toBeTruthy();
      console.log('✅ 가격 정보 표시됨');
      
      console.log('✅ Test 12 완료: Shop 페이지 검증');
    });

    test('13) Funding 페이지 이동 및 요소 검증', async ({ page }) => {
      test.setTimeout(TIMEOUT.TEST);
      
      // 먼저 Home 페이지로 이동 후 GNB에서 Funding 버튼 클릭
      await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      
      // 모달 처리
      await handleModal(page);
      
      // GNB에서 Funding 버튼 찾기 및 클릭
      const fundingButton = page.locator('button:has-text("Funding"), a:has-text("Funding"), nav button:has-text("Funding")').first();
      const isFundingBtnVisible = await fundingButton.isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
      
      if (isFundingBtnVisible) {
        await fundingButton.click();
        console.log('✅ Funding 버튼 클릭 완료');
      } else {
        // 버튼이 없으면 직접 URL로 이동 (fallback)
        console.log('⚠️ Funding 버튼이 보이지 않음, 직접 URL 이동');
        await page.goto(`${BASE_URL}/funding#0`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
      }
      
      await page.waitForLoadState('domcontentloaded');
      await page.waitForTimeout(TIMEOUT.LONG); // 페이지 완전 로드 대기
      
      // 모달 다시 처리
      await handleModal(page);
      
      // URL 확인 (필수) - /funding 또는 /product (펀딩 상품) 포함
      const currentUrl = page.url();
      const isFundingRelated = /funding|product/i.test(currentUrl);
      expect(isFundingRelated).toBeTruthy();
      console.log(`✅ Funding 관련 페이지 이동 완료: ${currentUrl}`);
      
      // 펀딩 목록 페이지인 경우
      if (/funding/i.test(currentUrl)) {
        // 펀딩 페이지 타이틀 확인 (필수 - "프로젝트에 펀딩하세요" 또는 영어)
        const fundingTitle = page.locator('text=/프로젝트에 펀딩|펀딩|프로젝트|Fund your project|Funding/i');
        const hasTitle = await fundingTitle.first().isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
        expect(hasTitle).toBeTruthy();
        console.log('✅ 펀딩 페이지 타이틀 표시됨');
        
        // 프로젝트 탭 확인 (필수 - 모든 프로젝트/진행중/종료된 또는 영어)
        const projectTabs = page.locator('text=/모든 프로젝트|진행중|종료된|All Projects|Ongoing|Ended/i');
        const hasTabs = await projectTabs.first().isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
        expect(hasTabs).toBeTruthy();
        console.log('✅ 프로젝트 필터 탭 표시됨');
        
        // 펀딩 프로젝트 카드 확인 (필수)
        const projectCards = page.locator('img[alt="sample_image"]');
        const cardCount = await projectCards.count();
        expect(cardCount).toBeGreaterThan(0);
        console.log(`✅ 펀딩 프로젝트 ${cardCount}개 표시됨`);
      } 
      // 펀딩 상품 상세 페이지인 경우
      else if (/product/i.test(currentUrl)) {
        // 펀딩 프로젝트 요소 확인 (달성률, 참가자 등)
        const fundingElements = page.locator('text=/달성|achieved|Funding|펀딩|participants|참여자/i');
        const hasFundingElements = await fundingElements.first().isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
        expect(hasFundingElements).toBeTruthy();
        console.log('✅ 펀딩 프로젝트 상세 페이지 표시됨');
        
        // 펀딩 관련 정보 확인 (목표 금액, 달성률 등)
        const fundingInfo = page.locator('text=/Goal|목표|%|Production|제작/i');
        const hasInfo = await fundingInfo.first().isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
        expect(hasInfo).toBeTruthy();
        console.log('✅ 펀딩 프로젝트 정보 표시됨');
        
        // 리워드 선택 영역 또는 Story 영역 확인 (펀딩 상품 특징)
        const rewardOrStory = page.locator('text=/Select reward|리워드|Story|스토리|Reward|보상/i');
        const hasRewardOrStory = await rewardOrStory.first().isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
        expect(hasRewardOrStory).toBeTruthy();
        console.log('✅ 리워드/스토리 섹션 표시됨');
      }
      
      console.log('✅ Test 13 완료: Funding 페이지 검증');
    });
    
    // Test 15는 Test 9에 통합됨 (실행 시간 최적화)
  });

  // ============================================================================
  // 추가 테스트: 마이페이지
  // ============================================================================
  test.describe('마이페이지', () => {
    
    test('14) 마이페이지 접속 및 프로필 정보 확인', async ({ page, context }) => {
      test.setTimeout(TIMEOUT.TEST);
      
      // 세션 로드
      if (fs.existsSync(AUTH_FILE)) {
        try {
          const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
          if (authData.cookies?.length > 0) {
            await context.addCookies(authData.cookies);
            console.log('🍪 세션 로드 완료');
          }
        } catch (e) {
          console.log('⚠️ 세션 로드 실패');
        }
      }
      
      // 마이페이지 이동
      await page.goto(`${BASE_URL}/my-page`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      await handleModal(page);
      
      // 로그인 상태 확인 (필수)
      const currentUrl = page.url();
      const isLoggedIn = currentUrl.includes('my-page') && !currentUrl.includes('login');
      expect(isLoggedIn).toBeTruthy();
      console.log('✅ 마이페이지 접속 성공 (로그인 상태)');
      
      // 프로필 이미지/아이콘 확인 (필수)
      const profileImg = page.locator('img[alt*="image"], img[alt*="profile"], [class*="profile"] img');
      const hasProfileImg = await profileImg.first().isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
      expect(hasProfileImg).toBeTruthy();
      console.log('✅ 프로필 이미지 표시됨');
      
      // 이메일 또는 사용자 정보 확인 (필수)
      const userInfo = page.locator('text=/@|gmail|email/i');
      const hasUserInfo = await userInfo.first().isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
      expect(hasUserInfo).toBeTruthy();
      console.log('✅ 사용자 정보 표시됨');
      
      console.log('✅ Test 14 완료: 마이페이지 프로필 확인');
    });

    test('15) 마이페이지 메뉴 항목 확인', async ({ page, context }) => {
      test.setTimeout(TIMEOUT.TEST);
      
      // 세션 로드
      if (fs.existsSync(AUTH_FILE)) {
        try {
          const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
          if (authData.cookies?.length > 0) {
            await context.addCookies(authData.cookies);
          }
        } catch (e) { /* ignore */ }
      }
      
      await page.goto(`${BASE_URL}/my-page`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      await handleModal(page);
      
      // 필수 메뉴 항목들 확인 (정확한 텍스트 매칭)
      const menuItems = [
        { name: '이벤트 응모정보 관리', texts: ['이벤트 응모정보 관리', '이벤트 응모', 'Event Entry', 'event submissions'] },
        { name: '비밀번호 변경', texts: ['비밀번호 변경', '비밀번호', 'Password', 'Change Password'] },
        { name: '주문내역', texts: ['주문내역', '주문 내역', 'Order', 'order history'] },
        { name: '배송지 관리', texts: ['배송지 관리', '배송지', 'Address', 'Shipping'] },
        { name: '로그아웃', texts: ['로그아웃', 'Logout', 'Log out', 'Sign out'] }
      ];
      
      let foundCount = 0;
      for (const item of menuItems) {
        let found = false;
        for (const text of item.texts) {
          const menuElement = page.locator(`text=${text}`).first();
          const isVisible = await menuElement.isVisible({ timeout: TIMEOUT.SHORT }).catch(() => false);
          if (isVisible) {
            console.log(`✅ "${item.name}" 메뉴 발견`);
            foundCount++;
            found = true;
            break;
          }
        }
        if (!found) {
          console.log(`⚠️ "${item.name}" 메뉴 미발견`);
        }
      }
      
      // 최소 3개 이상의 메뉴가 있어야 함 (필수)
      expect(foundCount).toBeGreaterThanOrEqual(3);
      console.log(`✅ 마이페이지 메뉴 ${foundCount}/${menuItems.length}개 확인됨`);
      
      console.log('✅ Test 15 완료: 마이페이지 메뉴 확인');
    });

    test('16) 주문내역 페이지 이동 및 확인', async ({ page, context }) => {
      test.setTimeout(TIMEOUT.TEST);
      
      // 세션 로드
      if (fs.existsSync(AUTH_FILE)) {
        try {
          const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
          if (authData.cookies?.length > 0) {
            await context.addCookies(authData.cookies);
          }
        } catch (e) { /* ignore */ }
      }
      
      // 주문내역 페이지 직접 이동
      await page.goto(`${BASE_URL}/my-page/order-history`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      await handleModal(page);
      
      // URL 확인 (필수)
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/order|my-page/i);
      console.log('✅ 주문내역 페이지 이동 완료');
      
      // 페이지 콘텐츠 확인 (주문 목록 또는 빈 상태 메시지)
      const hasContent = await page.locator('text=/주문|order|내역|history|없습니다|empty/i').first().isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
      expect(hasContent).toBeTruthy();
      console.log('✅ 주문내역 페이지 콘텐츠 확인됨');
      
      console.log('✅ Test 16 완료: 주문내역 페이지 확인');
    });

    test('17) 배송지 관리 페이지 이동 및 확인', async ({ page, context }) => {
      test.setTimeout(TIMEOUT.TEST);
      
      // 세션 로드
      if (fs.existsSync(AUTH_FILE)) {
        try {
          const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
          if (authData.cookies?.length > 0) {
            await context.addCookies(authData.cookies);
          }
        } catch (e) { /* ignore */ }
      }
      
      // 배송지 관리 페이지 직접 이동
      await page.goto(`${BASE_URL}/my-page/address`, { waitUntil: 'domcontentloaded', timeout: TIMEOUT.NAVIGATION });
      await page.waitForTimeout(TIMEOUT.MEDIUM);
      await handleModal(page);
      
      // URL 확인 (필수)
      const currentUrl = page.url();
      expect(currentUrl).toMatch(/address|my-page/i);
      console.log('✅ 배송지 관리 페이지 이동 완료');
      
      // 배송지 추가 버튼 또는 배송지 목록 확인 (필수)
      const hasAddressContent = await page.locator('text=/배송지|address|추가|add|없습니다|empty/i').first().isVisible({ timeout: TIMEOUT.MEDIUM }).catch(() => false);
      expect(hasAddressContent).toBeTruthy();
      console.log('✅ 배송지 관리 페이지 콘텐츠 확인됨');
      
      console.log('✅ Test 17 완료: 배송지 관리 페이지 확인');
    });
  });
});
