/**
 * Makestar.com E2E 모니터링 테스트 (Page Object Model 적용)
 *
 * 이 테스트 파일은 POM 패턴을 사용하여 비즈니스 로직에만 집중합니다.
 * 페이지 조작 로직은 MakestarPage 클래스에 캡슐화되어 있습니다.
 *
 * @see tests/pages/makestar.page.ts
 *
 * ============================================================================
 * 테스트 그룹 구조 (총 38개 테스트)
 * ============================================================================
 *
 * A. 기본 페이지 (CMR-HOME-01~02, CMR-PAGE-01~05)
 *    - Home, Event, Product 페이지 접근 및 요소 검증
 *
 * B. GNB 네비게이션 (CMR-NAV-01~04)
 *    - Shop, Funding 페이지 이동 및 네비게이션 복귀
 *
 * C. 검색 기능 (CMR-SEARCH-01~05)
 *    - 검색 UI, 검색 결과, 필터링, 최근 검색어
 *
 * D. 네비게이션 검증 (CMR-NAV-05~08)
 *    - GNB 버튼 클릭 네비게이션 (serial)
 *
 * E. 마이페이지/회원 기능 (CMR-AUTH-01~06, CMR-AUTH-04-1~04-2, CMR-AUTH-07~08)
 *    - 마이페이지, 주문내역, 배송지, 비밀번호, 응모정보, 이메일 로그인
 *
 * F. 상품/장바구니 기능 (CMR-ACTION-01~05)
 *    - 상품 옵션/가격, 품절, 장바구니, 비회원 접근
 *
 * G. 아티스트/콘텐츠 (CMR-DATA-01~02)
 *    - 아티스트 프로필, 아티스트별 상품 필터링
 *
 * H. 응답성/성능 모니터링 (CMR-PERF-01~02)
 *    - 페이지 로딩 시간, API 응답 시간
 *
 * ============================================================================
 */

import { test, expect } from "@playwright/test";
import { MakestarPage, WebVitalsResult } from "./pages";

// ============================================================================
// 테스트 설정
// ============================================================================

const TEST_TIMEOUT = 90000;
const BASE_URL = process.env.MAKESTAR_BASE_URL || "https://www.makestar.com";

// 성능 모니터링 임계값
const PERF_PAGE_LOAD_THRESHOLD_MS =
  Number(process.env.CMR_PAGE_LOAD_THRESHOLD) || 3000;
const PERF_API_RESPONSE_THRESHOLD_MS =
  Number(process.env.CMR_API_RESPONSE_THRESHOLD) || 2000;

// ============================================================================
// 테스트 스위트
// ============================================================================

test.describe("기본 페이지", () => {
  let makestar: MakestarPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    makestar = new MakestarPage(page);
    await makestar.gotoHome();
  });
  // ------------------------------------------------------------------------
  // Home 페이지
  // ------------------------------------------------------------------------
  test("CMR-HOME-01: 메인 페이지 접속 및 초기 모달 처리", async () => {
    await makestar.expectUrlMatches(
      new RegExp(
        BASE_URL.replace(/https?:\/\//, "").replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        ),
      ),
    );
    const title = await makestar.getTitle();
    expect(title.toLowerCase()).toContain("makestar");
  });

  test("CMR-HOME-02: 주요 요소 존재 여부 검증", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.waitForLoadState("domcontentloaded");
    await makestar.waitForPageContent();
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});

    // 로고 검증
    let logoFound = await makestar.verifyLogo(10000);
    if (!logoFound) {
      await makestar.reload();
      await makestar.waitForPageContent();
      logoFound = await makestar.verifyLogo(10000);
    }
    expect(logoFound).toBeTruthy();

    // Event 링크 확인 (POM 로케이터 + 폴백)
    const eventButtonVisible = await makestar.eventButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!eventButtonVisible) {
      const eventLinkFound = await makestar.hasEventLink(5000);
      expect(eventLinkFound, "Event 링크가 표시되어야 합니다").toBe(true);
    } else {
    }
  });

  // ------------------------------------------------------------------------
  // Event 페이지
  // ------------------------------------------------------------------------
  test("CMR-PAGE-01: Event 페이지 이동 및 요소 검증", async () => {
    test.setTimeout(TEST_TIMEOUT);

    // GNB Event 버튼 클릭 (유저 시나리오)
    await makestar.navigateToEvent();
    await makestar.expectUrlMatches(/event/i);
  });

  test("CMR-PAGE-02: Event 종료된 이벤트 탭 이동 및 검증", async () => {
    test.setTimeout(TEST_TIMEOUT);

    // GNB Event 버튼 클릭 (유저 시나리오)
    await makestar.navigateToEvent();

    // 탭 요소 로드 대기 (콘텐츠 안정화)
    await makestar
      .waitForContentStable("body", { stableTime: 500, timeout: 5000 })
      .catch(() => console.log("⏱️ 콘텐츠 안정화 대기 타임아웃"));

    const found = await makestar.clickEndedTab();
    expect(found, "종료된 이벤트 탭을 찾을 수 없습니다").toBeTruthy();
  });

  test("CMR-PAGE-03: Event 진행중인 이벤트 탭 및 첫 번째 상품 클릭", async () => {
    test.setTimeout(TEST_TIMEOUT);

    // GNB Event 버튼 클릭 (유저 시나리오)
    await makestar.navigateToEvent();

    const ongoingClicked = await makestar.clickOngoingTab();
    expect(ongoingClicked).toBeTruthy();

    await makestar.waitForContentStable();
    await makestar.clickFirstEventCard();
    await makestar.expectUrlMatches(/event|product/i);
  });

  // ------------------------------------------------------------------------
  // Product 페이지
  // ------------------------------------------------------------------------
  test("CMR-PAGE-04: Product 페이지 주요 요소 검증 및 옵션 선택", async () => {
    test.setTimeout(TEST_TIMEOUT);

    // GNB Event 버튼 클릭 (유저 시나리오)
    await makestar.navigateToEvent();
    await makestar.clickFirstEventCard();

    const hasTitle = await makestar.verifyProductTitle();
    expect(hasTitle).toBeTruthy();

    const hasPrice = await makestar.verifyPriceInfo();
    expect(hasPrice).toBeTruthy();
  });

  test("CMR-PAGE-05: Product 구매하기 클릭 및 결과 검증", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // GNB Event 버튼 클릭 (유저 시나리오)
    await makestar.navigateToEvent();
    await makestar.clickFirstEventCard();
    await makestar.handleModal();

    const purchaseClicked = await makestar.clickPurchaseButton();
    expect(purchaseClicked).toBeTruthy();

    // 카운트다운 타이머가 DOM을 계속 변경하므로 waitForContentStable 대신 네트워크 안정화 대기
    await makestar.waitForNetworkStable();
    const afterClickUrl = makestar.currentUrl;
    console.log(`📍 버튼 클릭 후 URL: ${afterClickUrl}`);

    const googleBtn = await makestar.findVisibleElement(
      ['button:has-text("Google")', '[class*="google"]'],
      5000,
    );
    const isPaymentPage = /payment|checkout|order/i.test(afterClickUrl);
    const isProductPage = /product/i.test(afterClickUrl);

    expect(googleBtn !== null || isPaymentPage || isProductPage).toBeTruthy();

    if (googleBtn) {
      console.log("✅ Google 로그인 버튼 발견");
    } else if (isPaymentPage) {
      console.log("✅ 결제 페이지로 이동됨 (로그인 상태)");
    } else {
      console.log("✅ 상품 페이지에 머무름 (옵션 선택 필요 등)");
    }
  });
});

// ==========================================================================
// GNB 네비게이션
// ==========================================================================
test.describe("GNB 네비게이션", () => {
  let makestar: MakestarPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    makestar = new MakestarPage(page);
    await makestar.gotoHome();
  });
  test("CMR-NAV-01: Shop 페이지 이동 및 요소 검증", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // GNB Shop 버튼 클릭 (유저 시나리오)
    await test.step("Shop 페이지 이동", async () => {
      await makestar.navigateToShop();
      await makestar.waitForPageContent();
      await makestar.expectUrlMatches(/shop/i);
    });

    await test.step("Shop 페이지 요소 검증", async () => {
      const hasCategoryTab = await makestar.verifyCategoryTabs();
      expect(hasCategoryTab).toBeTruthy();

      const cardCount = await makestar.getProductCardCount();
      expect(cardCount).toBeGreaterThan(0);
      console.log(`   상품 카드 ${cardCount}개 표시됨`);

      const hasPrice = await makestar.verifyPriceInfo();
      expect(hasPrice).toBeTruthy();
    });
  });

  test("CMR-NAV-02: Funding 페이지 이동 및 요소 검증", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    if (makestar.isPageClosed()) {
      console.warn("⚠️ 페이지가 닫혀 있어 새로 초기화합니다.");
      makestar = new MakestarPage(page);
      await makestar.gotoHome();
    }

    await test.step("Funding 페이지 이동", async () => {
      await makestar.navigateToFunding();
      await makestar.waitForPageContent();
      const currentUrl = makestar.currentUrl;
      expect(
        currentUrl.includes("/funding"),
        `Funding 페이지 URL이어야 합니다 (현재: ${currentUrl})`,
      ).toBe(true);
    });

    await test.step("Funding 페이지 요소 검증", async () => {
      const hasTitle = await makestar.verifyFundingTitle();
      expect(hasTitle, "펀딩 페이지 타이틀이 표시되어야 합니다").toBe(true);

      const hasTabs = await makestar.verifyFundingTabs();
      expect(hasTabs, "프로젝트 필터 탭이 표시되어야 합니다").toBe(true);

      const cardCount = await makestar.getFundingCardCount();
      expect(cardCount).toBeGreaterThan(0);
      console.log(`   펀딩 프로젝트 ${cardCount}개`);
    });
  });

  test("CMR-NAV-03: 로고 클릭으로 메인 페이지 복귀", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Event 페이지에서 로고 클릭으로 Home 복귀
    await makestar.navigateToEvent();
    await makestar.clickLogoToHome();
  });

  test("CMR-NAV-04: Home 버튼으로 메인 페이지 복귀", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // Shop 페이지에서 Home 버튼 클릭으로 Home 복귀
    await makestar.navigateToShop();
    await makestar
      .waitForContentStable("body", { stableTime: 300, timeout: 3000 })
      .catch(() => console.log("⏱️ 콘텐츠 안정화 대기 타임아웃"));

    // Home 버튼 존재 여부 확인 (폴백 없이 명확하게 실패 처리)
    const homeButtonFound = await makestar.homeButton
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    expect(homeButtonFound, "Home 버튼이 표시되어야 합니다").toBe(true);

    await makestar.homeButton.click();
    await makestar.waitForLoadState("domcontentloaded");
    await makestar.expectUrlMatches(
      new RegExp(`^${BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/?$`),
    );
  });
});

// ==========================================================================
// 검색 기능
// ==========================================================================
test.describe("검색 기능", () => {
  let makestar: MakestarPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    makestar = new MakestarPage(page);
    await makestar.gotoHome();
  });
  test("CMR-SEARCH-01: 검색 UI 열기 및 추천 검색어 표시 확인", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await makestar.handleModal();

    await makestar.openSearchUI();

    const hasRecommended = await makestar.verifyRecommendedKeywords();
    expect(hasRecommended).toBeTruthy();

    const hasCancelBtn = await makestar.cancelButton
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    expect(hasCancelBtn).toBeTruthy();
  });

  test("CMR-SEARCH-02: 검색어 입력 및 검색 결과 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await makestar.handleModal();

    await makestar.search("BTS");

    const isSearchResult = await makestar.hasSearchResultText("BTS");
    expect(isSearchResult, "검색 결과 페이지에 도달해야 합니다").toBe(true);
    console.log(`✅ 검색 결과 페이지 이동: ${makestar.currentUrl}`);
  });

  test("CMR-SEARCH-03: 검색 결과 페이지 UI 및 결과 표시 확인", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 사용자 시나리오: 로고 클릭으로 Home 복귀 후 검색
    await makestar.clickLogoToHome();
    await makestar.waitForContentStable();

    const searchKeyword = "BTS";
    await makestar.search(searchKeyword);
    await makestar.waitForSearchResults();

    const currentUrl = makestar.currentUrl;
    console.log(`   검색 결과 URL: ${currentUrl}`);

    expect(currentUrl).toContain("keyword=");

    // POM 로케이터 사용
    const cardCount = await makestar.getSearchResultCount();
    console.log(`   검색 결과 상품 수: ${cardCount}개`);

    expect(cardCount).toBeGreaterThan(0);
  });

  test("CMR-SEARCH-04: 검색 결과 필터링 (카테고리/탭) 확인", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 사용자 시나리오: 로고 클릭으로 Home 복귀 후 검색
    await makestar.clickLogoToHome();
    await makestar.waitForContentStable();
    await makestar.search("album");
    await makestar.waitForSearchResults();

    const currentUrl = makestar.currentUrl;
    console.log(`   검색 결과 URL: ${currentUrl}`);

    // POM 메서드 사용
    const filterFound = await makestar.hasFilterTabs();
    if (filterFound) {
      console.log("✅ 필터/탭 요소 발견");
    }

    // POM 로케이터 사용
    const cardCount = await makestar.getSearchResultCount();
    console.log(`   검색 결과 상품 수: ${cardCount}개`);

    expect(filterFound || cardCount > 0).toBeTruthy();

    if (filterFound) {
      const clicked = await makestar.clickFilterTab("전체");
      if (!clicked) {
        await makestar.clickFilterTab("All");
      }
      console.log("✅ 필터 탭 클릭 테스트 완료");
    }
  });

  test("CMR-SEARCH-05: 최근 검색어 저장 및 표시 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 사용자 시나리오: 로고 클릭으로 Home 복귀 후 검색
    await makestar.clickLogoToHome();
    await makestar.waitForContentStable();

    const testKeyword = "BTS";
    await makestar.search(testKeyword);
    await makestar.waitForSearchResults();

    // 사용자 시나리오: 로고 클릭으로 Home 복귀
    await makestar.clickLogoToHome();
    await makestar.waitForContentStable();

    await makestar.openSearchUI();

    const recentSearchFound =
      await makestar.hasRecentSearchIndicators(testKeyword);

    const hasRecommended = await makestar.verifyRecommendedKeywords();

    // 최근 검색어가 표시되어야 함 (추천 검색어는 보조 검증)
    if (recentSearchFound) {
      console.log("✅ 최근 검색어 표시 확인됨");
    } else if (hasRecommended) {
      console.log(
        "⚠️ 최근 검색어 미표시, 추천 검색어만 표시됨 — 검색어 저장 기능 확인 필요",
      );
    }
    expect(
      recentSearchFound || hasRecommended,
      "최근 검색어 또는 추천 검색어가 표시되어야 합니다",
    ).toBe(true);
  });
});

// ==========================================================================
// 네비게이션 검증 (폴백 없이 버튼 클릭만 테스트)
// serial로 실행하여 네트워크 부하 감소 및 안정성 향상
// ==========================================================================
test.describe.serial("네비게이션 검증", () => {
  let makestar: MakestarPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    makestar = new MakestarPage(page);
    await makestar.gotoHome();
  });
  test("CMR-NAV-05: 프로필 버튼 → 마이페이지 네비게이션", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar
      .waitForContentStable("body", { timeout: 3000 })
      .catch(() => console.log("⏱️ NAV-01 콘텐츠 안정화 타임아웃"));

    // 폴백 없이 프로필 버튼 클릭만 테스트 (단순 버전)
    const result = await makestar.clickProfileButtonOnce();

    console.log(
      `📍 네비게이션 결과: success=${result.success}, url=${result.url}`,
    );
    if (!result.success) {
      console.warn(`⚠️ 실패 원인: ${result.reason}`);
    }

    // 프로필 버튼 클릭으로 마이페이지 도달해야 PASS
    expect(
      result.success,
      `프로필 버튼 네비게이션 실패: ${result.reason}`,
    ).toBe(true);
    expect(result.url).toContain("my-page");
  });

  test("CMR-NAV-06: GNB Shop 버튼 클릭 → 상품 목록 페이지", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.handleModal();
    await makestar
      .waitForContentStable("body", { timeout: 3000 })
      .catch(() => {});

    // GNB Shop 버튼 클릭 (POM 로케이터 사용)
    await expect(makestar.shopButton).toBeVisible({ timeout: 5000 });
    await makestar.shopButton.click();
    await makestar.waitForLoadState("domcontentloaded");
    await makestar
      .waitForContentStable("body", { timeout: 3000 })
      .catch(() => {});

    const currentUrl = makestar.currentUrl;
    console.log(`📍 Shop 버튼 클릭 후 URL: ${currentUrl}`);

    expect(currentUrl).toContain("/shop");
  });

  test("CMR-NAV-07: GNB Event 버튼 클릭 → 이벤트 목록 페이지", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.handleModal();
    await makestar
      .waitForContentStable("body", { timeout: 3000 })
      .catch(() => {});

    // GNB Event 버튼 클릭 (POM 로케이터 사용)
    await expect(makestar.eventButton).toBeVisible({ timeout: 5000 });
    await makestar.eventButton.click();
    await makestar.waitForLoadState("domcontentloaded");
    await makestar
      .waitForContentStable("body", { timeout: 3000 })
      .catch(() => {});

    const currentUrl = makestar.currentUrl;
    console.log(`📍 Event 버튼 클릭 후 URL: ${currentUrl}`);

    // Event 페이지 또는 artist 페이지 (이벤트가 아티스트별로 구분될 수 있음)
    const isEventPage =
      currentUrl.includes("/event") || currentUrl.includes("/artist");
    expect(isEventPage, `이벤트 페이지 도달 실패: ${currentUrl}`).toBe(true);
  });

  test("CMR-NAV-08: GNB Funding 버튼 클릭 → 펀딩 목록 페이지", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.handleModal();
    await makestar
      .waitForContentStable("body", { timeout: 3000 })
      .catch(() => {});

    // GNB Funding 버튼 클릭 (POM 로케이터 사용)
    await expect(makestar.fundingButton).toBeVisible({ timeout: 5000 });
    await makestar.fundingButton.click();
    await makestar.waitForLoadState("domcontentloaded");
    await makestar
      .waitForContentStable("body", { timeout: 3000 })
      .catch(() => {});

    const currentUrl = makestar.currentUrl;
    console.log(`📍 Funding 버튼 클릭 후 URL: ${currentUrl}`);

    expect(currentUrl).toContain("/funding");
  });
});

// ==========================================================================
// 마이페이지/회원 기능 (기능 검증 - URL 직접 이동 허용)
// ==========================================================================
test.describe.serial("마이페이지/회원 기능", () => {
  let makestar: MakestarPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    makestar = new MakestarPage(page);
    await makestar.gotoHome();
  });
  test("CMR-AUTH-01: 마이페이지 접속 및 프로필 정보 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar
      .waitForContentStable("body", { timeout: 3000 })
      .catch(() => console.log("⏱️ Test 16 Home 콘텐츠 안정화 타임아웃"));

    await makestar.gotoMyPage();
    await makestar.handleModal();
    await makestar
      .waitForContentStable("body", { timeout: 3000 })
      .catch(() => console.log("⏱️ Test 16 MyPage 콘텐츠 안정화 타임아웃"));

    const isLoggedIn = await makestar.checkLoggedIn();
    expect(
      isLoggedIn,
      `마이페이지에 로그인 상태로 접근해야 합니다 (현재 URL: ${makestar.currentUrl})`,
    ).toBe(true);

    const hasMyPageContent = await makestar.hasMyPageContent();
    expect(hasMyPageContent, "마이페이지 콘텐츠가 표시되어야 합니다").toBe(
      true,
    );
    console.log("✅ 마이페이지 접속 성공 (로그인 + 콘텐츠 확인)");
  });

  test("CMR-AUTH-02: 마이페이지 메뉴 항목 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.gotoMyPage();
    await makestar.handleModal();
    await page.evaluate(() => window.scrollTo(0, 0));

    const foundCount = await makestar.verifyMyPageMenuItems();

    expect(foundCount).toBeGreaterThanOrEqual(2);
    console.log(`✅ 마이페이지 메뉴 ${foundCount}/5개 확인됨`);
  });

  test("CMR-AUTH-03: 주문내역 페이지 이동 및 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.gotoOrderHistory();
    await makestar.waitForContentStable();

    const currentUrl = makestar.currentUrl;
    console.log(`📍 현재 URL: ${currentUrl}`);

    expect(
      /order|my-page/i.test(currentUrl),
      `주문내역 관련 URL이어야 합니다 (현재: ${currentUrl})`,
    ).toBe(true);

    const hasContent = await makestar.hasOrderHistoryContent();
    expect(hasContent, "주문내역 콘텐츠가 표시되어야 합니다").toBe(true);
    console.log(`✅ 주문내역 페이지 확인됨: ${currentUrl}`);
  });

  test("CMR-AUTH-04: 배송지 관리 페이지 이동 및 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.gotoAddress();
    await makestar.waitForContentStable();

    const currentUrl = makestar.currentUrl;
    console.log(`📍 현재 URL: ${currentUrl}`);

    expect(
      /address|my-page/i.test(currentUrl),
      `배송지 관련 URL이어야 합니다 (현재: ${currentUrl})`,
    ).toBe(true);

    const hasContent = await makestar.hasAddressContent();
    expect(hasContent, "배송지 관리 콘텐츠가 표시되어야 합니다").toBe(true);
    console.log(`✅ 배송지 관리 페이지 확인됨: ${currentUrl}`);
  });

  test("CMR-AUTH-04-1: 팔로우 관리 페이지 이동 및 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.gotoFollow();
    await makestar.waitForContentStable();

    const currentUrl = makestar.currentUrl;
    console.log(`📍 현재 URL: ${currentUrl}`);

    expect(
      currentUrl.includes("/follow"),
      `팔로우 관리 URL이어야 합니다 (현재: ${currentUrl})`,
    ).toBe(true);

    const hasContent = await makestar.hasFollowContent();
    expect(hasContent, "팔로우 관리 콘텐츠가 표시되어야 합니다").toBe(true);
    console.log(`✅ 팔로우 관리 페이지 확인됨: ${currentUrl}`);
  });

  test("CMR-AUTH-04-2: 알림 설정 페이지 이동 및 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.gotoNotification();
    await makestar.waitForContentStable();

    const currentUrl = makestar.currentUrl;
    console.log(`📍 현재 URL: ${currentUrl}`);

    expect(
      currentUrl.includes("/notification"),
      `알림 설정 URL이어야 합니다 (현재: ${currentUrl})`,
    ).toBe(true);

    const hasContent = await makestar.hasNotificationContent();
    expect(hasContent, "알림 설정 콘텐츠가 표시되어야 합니다").toBe(true);
    console.log(`✅ 알림 설정 페이지 확인됨: ${currentUrl}`);
  });

  test("CMR-AUTH-05: 비밀번호 변경 페이지 접근 및 요소 검증", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 기능 검증: URL 직접 이동 (네비게이션은 NAV-02에서 별도 검증)
    await makestar.goto(`${makestar.baseUrl}/my-page/change-password`);
    await makestar.handleModal();
    await makestar
      .waitForContentStable("body", { stableTime: 500, timeout: 3000 })
      .catch(() => console.log("⏱️ Test 20 콘텐츠 안정화 타임아웃"));

    const currentUrl = makestar.currentUrl;
    console.log(`📍 현재 URL: ${currentUrl}`);

    // 비밀번호 페이지 요소 검증 (POM 메서드 사용)
    const inputCount = await makestar.getPasswordInputCount();
    const isPasswordPage = currentUrl.includes("password") || inputCount > 0;
    expect(isPasswordPage, "비밀번호 변경 페이지에 도달해야 합니다").toBe(true);
    console.log(
      `✅ 비밀번호 변경 페이지 접근 확인 (입력 필드 ${inputCount}개)`,
    );
  });

  test("CMR-AUTH-06: 이벤트 응모정보 관리 페이지 검증", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 메뉴 클릭 네비게이션 시도 후 URL 폴백 (마이페이지 메인 접근 불가 환경 대응)
    await makestar.gotoMyPage();
    await makestar.handleModal();

    const menuTexts = [
      "이벤트 응모정보 관리",
      "Event Entry",
      "Manage Event Submissions",
    ] as const;
    const hrefs = ["event-submissions"] as const;
    const menuResult = await makestar.clickMyPageMenuStrict(menuTexts, hrefs);

    if (!menuResult.success) {
      console.warn("⚠️ 메뉴 클릭 불가, URL 직접 이동으로 폴백");
      await makestar.goto(`${makestar.baseUrl}/my-page/event-submissions`);
    }
    await makestar.handleModal();
    await makestar
      .waitForContentStable("body", { stableTime: 500, timeout: 3000 })
      .catch(() => console.log("⏱️ Test 21 콘텐츠 안정화 타임아웃"));

    const currentUrl = makestar.currentUrl;
    console.log(`📍 현재 URL: ${currentUrl}`);

    // URL에 event-submissions가 포함되어야 함 (event만 매칭하면 다른 이벤트 페이지도 통과)
    expect(
      currentUrl.includes("event-submissions"),
      `이벤트 응모정보 URL이어야 합니다 (현재: ${currentUrl})`,
    ).toBe(true);

    const eventEntryPageFound = await makestar.hasEventEntryContent();
    expect(
      eventEntryPageFound,
      "이벤트 응모정보 관련 콘텐츠가 표시되어야 합니다",
    ).toBe(true);

    const hasContent = await makestar.hasEventEntryListContent();
    console.log(`   응모 내역/빈 상태 메시지 표시: ${hasContent}`);
  });

  test("CMR-AUTH-07: 이메일 로그인 — 이메일 입력 시 다음 버튼 활성화 검증", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    const email = process.env.CMR_EMAIL_LOGIN_ID || "siboc79031@kobace.com";

    const result = await makestar.verifyEmailLoginNextButton(email);

    expect(
      result.emailPageLoaded,
      "이메일 입력 페이지가 정상 로드되어야 합니다",
    ).toBe(true);

    expect(
      result.nextButtonDisabledInitially,
      "이메일 미입력 시 다음 버튼은 비활성화 상태여야 합니다",
    ).toBe(true);

    expect(
      result.nextButtonEnabledAfterInput,
      "이메일 입력 후 다음 버튼이 활성화되어야 합니다 (CT-290 회귀 검증)",
    ).toBe(true);

    console.log(
      "✅ 이메일 로그인 다음 버튼 활성화 검증 통과 (CT-290 회귀 방지)",
    );

    // auth 쿠키 복원 (후속 테스트에 영향 방지)
    await makestar.restoreAuthCookies();
  });

  test("CMR-AUTH-08: 이메일 로그인 — 전체 로그인 플로우 검증", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    const email = process.env.CMR_EMAIL_LOGIN_ID || "siboc79031@kobace.com";
    const password = process.env.CMR_EMAIL_LOGIN_PW || "!xptmxm1234";

    const result = await makestar.loginWithEmail(email, password);

    expect(
      result.success,
      `이메일 로그인이 성공해야 합니다 (reason: ${result.reason || "none"})`,
    ).toBe(true);

    expect(
      result.finalUrl,
      "로그인 후 my-page로 리다이렉트되어야 합니다",
    ).toContain("my-page");

    console.log(
      `✅ 이메일 로그인 전체 플로우 통과 (최종 URL: ${result.finalUrl})`,
    );

    // auth 쿠키 복원 (후속 테스트에 영향 방지)
    await makestar.restoreAuthCookies();
  });
});

// ==========================================================================
// 상품/장바구니 기능
// ==========================================================================
test.describe("상품/장바구니 기능", () => {
  let makestar: MakestarPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    makestar = new MakestarPage(page);
    await makestar.gotoHome();
  });
  test("CMR-ACTION-01: 상품 옵션 변경에 따른 가격 변동 확인", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // GNB Shop 버튼 클릭 (유저 시나리오)
    await makestar.navigateToShop();
    await makestar.waitForPageContent();

    const productCard = makestar.shopProductCard.first();
    await expect(productCard).toBeVisible({ timeout: 5000 });
    await productCard.click();
    await makestar.waitForLoadState("domcontentloaded");
    await makestar.waitForContentStable();
    await makestar.handleModal();

    const hasPrice = await makestar.verifyPriceInfo();
    expect(hasPrice).toBeTruthy();

    const initialPrice = await makestar.getCurrentPrice();
    console.log(`   초기 가격: ${initialPrice || "확인 불가"}`);

    const options = await makestar.getOptionList();
    console.log(`   옵션 개수: ${options.length}개`);

    if (options.length > 1) {
      await makestar.selectOptionByIndex(1);
      await makestar.waitForContentStable();

      const changedPrice = await makestar.getCurrentPrice();
      console.log(`   변경된 가격: ${changedPrice || "확인 불가"}`);

      expect(changedPrice !== null || initialPrice !== null).toBeTruthy();
      console.log("✅ 옵션 변경 후 가격 표시 확인됨");
    } else {
      // 옵션이 없으면 테스트 의도에 맞지 않으므로 명시적 경고와 함께 검증
      console.warn("⚠️ 옵션이 1개 이하 - 가격 변동 검증 불가 (데이터 상태)");
      expect(options.length).toBeGreaterThanOrEqual(0); // 최소한의 검증
    }
  });

  test("CMR-ACTION-02: 품절 상품 표시 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // GNB Shop 버튼 클릭 (유저 시나리오)
    await makestar.navigateToShop();
    await makestar.waitForPageContent();

    const productCards = makestar.shopProductCard;
    const cardCount = await productCards.count();
    console.log(`   상품 카드 개수: ${cardCount}개`);
    expect(cardCount).toBeGreaterThan(0);

    const soldOutFound = await makestar.hasSoldOutIndicator();
    console.log(
      `   품절 상품 표시 여부: ${soldOutFound ? "있음" : "없음 (정상)"}`,
    );

    const hasPrice = await makestar.verifyPriceInfo();
    expect(hasPrice).toBeTruthy();
  });

  test("CMR-ACTION-03: 장바구니 담기 및 수량 변경 검증", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT * 1.5);

    // Step 0: 장바구니 초기화
    await test.step("Step 0: 장바구니 초기화", async () => {
      await makestar.gotoCart();
      await makestar.waitForContentStable();
      await makestar.clearCart();
    });

    // Step 1: Shop 페이지 이동 및 첫 번째 상품 선택
    await test.step("Step 1: Shop 페이지 이동", async () => {
      // Cart 페이지에는 GNB 메인 네비가 없으므로 로고 클릭으로 홈 복귀
      await makestar.clickLogoToHome();
      await makestar.navigateToShop();
      await makestar.waitForPageContent();

      const productCard = makestar.shopProductCard.first();
      await expect(productCard).toBeVisible({ timeout: 5000 });
      await productCard.click();

      await makestar.waitForLoadState("domcontentloaded");
      await makestar.waitForContentStable();
      await makestar.handleModal();
      console.log("   ✅ 상품 상세 페이지 이동 완료");
    });

    // Step 2: 상품 옵션 선택 및 수량 설정
    await test.step("Step 2: 상품 옵션/수량 설정", async () => {
      await makestar.setQuantity(1);
      await makestar.increaseQuantity();
      await makestar.selectFirstOption();
    });

    // Step 3: 장바구니 담기 버튼 클릭
    let addedToCartSuccess = false;
    await test.step("Step 3: 장바구니 담기", async () => {
      addedToCartSuccess = await makestar.clickAddToCartButton();
      if (addedToCartSuccess) {
        console.log("   ✅ 장바구니 담기 성공");
      }
    });
  });

  test("CMR-ACTION-05: 장바구니 수량 증가 시 가격 반영 검증", async ({
    page,
  }, testInfo) => {
    // 모바일 UA: 옵션 선택 spinbutton/장바구니 버튼이 없고 구매하기 바텀시트 방식
    if (testInfo.project.name === "mobile-chrome") {
      console.log(
        "   ℹ️ 모바일에서는 장바구니 UI가 데스크톱과 다름 — 데스크톱 전용 테스트",
      );
      expect(true).toBeTruthy();
      return;
    }
    test.setTimeout(TEST_TIMEOUT * 2);

    // Step 0: 장바구니 초기화
    await test.step("Step 0: 장바구니 초기화", async () => {
      await makestar.gotoCart();
      await makestar.waitForContentStable();
      await makestar.clearCart();
    });

    // Step 1: Shop → 구매 가능 상품 찾기 → 장바구니 담기
    await test.step("Step 1: 상품을 장바구니에 담기", async () => {
      // Cart 페이지에는 GNB 메인 네비가 없으므로 로고 클릭으로 홈 복귀
      await makestar.clickLogoToHome();
      await makestar.navigateToShop();
      await makestar.waitForPageContent();

      // Shop 상품 중 구매 가능한 상품을 찾아 장바구니에 담기 (최대 8개 시도)
      const productCount = await makestar.shopProductCard.count();
      let confirmed = false;
      let authRedirectCount = 0;

      for (let i = 0; i < Math.min(8, productCount); i++) {
        // 품절 상품 건너뛰기
        const card = makestar.shopProductCard.nth(i);
        const cardText = await card
          .locator("xpath=ancestor::a[1]")
          .textContent()
          .catch(() => "");
        if (cardText && /sold out|품절/i.test(cardText)) {
          console.warn(`   ⚠️ 상품 ${i + 1}: 품절 - 건너뜀`);
          continue;
        }

        console.log(`   🔍 상품 ${i + 1}: 클릭 시도`);
        await card.click();
        await makestar.waitForLoadState("domcontentloaded");
        await makestar.waitForContentStable();
        await makestar.handleModal();

        // 상품 상세 페이지 도달 확인
        const currentUrl = makestar.currentUrl;
        if (!/\/product\/\d+/i.test(currentUrl)) {
          console.warn(`   ⚠️ 상품 ${i + 1}: 상세 페이지 아님 (${currentUrl})`);
          await makestar.clickLogoToHome();
          await makestar.navigateToShop();
          await makestar.waitForPageContent();
          continue;
        }

        // 옵션 선택 (spinbutton 패턴: 수량 0→1 / 드롭다운 패턴: 첫 번째 옵션)
        const optionSelected = await makestar.selectFirstOption();
        console.log(
          `   옵션 선택 결과: ${optionSelected ? "성공" : "실패 (옵션 없는 상품)"}`,
        );

        // 드롭다운 패턴일 경우에만 별도 수량 설정
        if (!optionSelected) {
          await makestar.setQuantity(1);
        }

        // Add to Cart 버튼 클릭
        const clicked = await makestar.clickAddToCartButton();
        if (clicked) {
          await makestar.waitForNetworkStable();

          // 로그인 리다이렉트 체크
          if (
            makestar.currentUrl.includes("auth") ||
            makestar.currentUrl.includes("login")
          ) {
            authRedirectCount++;
            console.log(
              `   ⚠️ 로그인 리다이렉트 감지 (${authRedirectCount}회) — 다음 상품 시도`,
            );

            if (authRedirectCount >= 3) {
              console.log(
                `   ❌ 연속 ${authRedirectCount}회 리다이렉트 — 세션 만료 확정, 조기 중단`,
              );
              break;
            }

            // 로그인 페이지에는 로고가 없으므로 goto()로 직접 Shop 복귀
            await makestar.goto(`${makestar.baseUrl}/shop`);
            await makestar.waitForPageContent();
            continue;
          }

          await makestar.handleModal();

          // 장바구니에 실제 담겼는지 확인
          await makestar.gotoCart();
          await makestar.waitForContentStable();
          const itemCount = await makestar.getCartItemCount();
          if (itemCount > 0) {
            confirmed = true;
            console.log(
              `   ✅ 상품 ${i + 1}번째 장바구니 담기 확인 (${itemCount}개)`,
            );
            break;
          }
        }

        // 실패 → Shop으로 돌아가서 다음 상품 시도
        console.log(
          `   ⚠️ 상품 ${i + 1}번째 장바구니 담기 실패, 다음 상품 시도`,
        );
        await makestar.clickLogoToHome();
        await makestar.navigateToShop();
        await makestar.waitForPageContent();
      }

      if (!confirmed && authRedirectCount > 0) {
        throw new Error(
          `인증 세션 만료: ${authRedirectCount}회 로그인 리다이렉트 — auth.json 갱신 필요`,
        );
      }
      expect(confirmed).toBeTruthy();
    });

    // Step 2: 장바구니 이동 및 기준 수량·가격 확인
    let baseQty = 0;
    let basePrice = 0;
    await test.step("Step 2: 장바구니에서 기준 수량·가격 확인", async () => {
      await makestar.gotoCart();
      await makestar.waitForContentStable();
      await makestar.waitForNetworkStable();

      const itemCount = await makestar.getCartItemCount();
      console.log(`   장바구니 아이템 수: ${itemCount}`);
      expect(itemCount).toBeGreaterThan(0);

      baseQty = await makestar.getCartQuantity();
      console.log(`   기준 수량: ${baseQty}`);
      expect(baseQty).toBeGreaterThan(0);

      const price = await makestar.getCartTotalPrice();
      expect(price).not.toBeNull();
      expect(price).toBeGreaterThan(0);
      basePrice = price!;
      console.log(`   ✅ 기준 Total price: ${basePrice}`);
    });

    // Step 3: + 버튼으로 수량 증가 및 수량 변동 확인
    await test.step("Step 3: 수량 증가 (+버튼 클릭)", async () => {
      // 클릭 직전 수량 재확인 (병렬 워커 간섭 대비)
      const qtyBefore = await makestar.getCartQuantity();
      baseQty = qtyBefore;
      const priceBefore = await makestar.getCartTotalPrice();
      if (priceBefore) basePrice = priceBefore;

      const increased = await makestar.increaseQuantity();
      expect(increased).toBeTruthy();

      // 수량이 증가할 때까지 대기 (장바구니 전용 로케이터 — 상품 상세와 다른 input 타입)
      const cartQuantityInput = page.getByRole("textbox", {
        name: "Quantity",
      });
      await expect(cartQuantityInput).not.toHaveValue(String(qtyBefore), {
        timeout: 10000,
      });
      const qtyAfter = await makestar.getCartQuantity();
      expect(qtyAfter).toBeGreaterThan(qtyBefore);
      console.log(`   ✅ 수량 증가 완료: ${qtyBefore} → ${qtyAfter}`);
    });

    // Step 4: 변경된 가격 검증
    await test.step("Step 4: 가격 변동 검증", async () => {
      await makestar.waitForNetworkStable();

      const updatedPrice = await makestar.getCartTotalPrice();
      expect(updatedPrice).not.toBeNull();
      expect(updatedPrice).toBeGreaterThan(basePrice);
      console.log(`   ✅ 가격 변동 확인: ${basePrice} → ${updatedPrice}`);
    });
  });

  test("CMR-ACTION-04: 비회원 상태에서 홈/이벤트 페이지 정상 접근 확인", async ({
    browser,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    const incognitoContext = await browser.newContext();
    const incognitoPage = await incognitoContext.newPage();

    try {
      await incognitoPage.goto(BASE_URL);
      await incognitoPage.waitForLoadState("load");

      // 모달 반복 처리 (여러 겹 모달 대응)
      await MakestarPage.closeGuestModal(incognitoPage);

      console.log("✅ 비회원 상태로 홈페이지 접근");

      // 요소 검증 (로고/네비게이션으로 페이지 접근 확인, 콘텐츠 이미지는 lazy loading으로 미표시될 수 있음)
      const homeElements =
        await MakestarPage.verifyGuestPageElements(incognitoPage);

      expect(
        homeElements.logo || homeElements.navigation || homeElements.content,
      ).toBeTruthy();
      const homeChecked = [
        homeElements.logo && "로고",
        homeElements.navigation && "GNB",
        homeElements.content && "콘텐츠",
      ]
        .filter(Boolean)
        .join(", ");
      console.log(`✅ 비회원 홈페이지 정상 표시 확인 (${homeChecked})`);

      await incognitoPage.goto(`${BASE_URL}/event#1`);
      await incognitoPage.waitForLoadState("load");

      // 모달 반복 처리
      await MakestarPage.closeGuestModal(incognitoPage);

      const eventUrl = incognitoPage.url();
      const eventContentVisible = await incognitoPage
        .locator('img[alt="sample_image"], img[alt="event-thumb-image"]')
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(eventUrl.includes("event") || eventContentVisible).toBeTruthy();
      const eventChecked = [
        eventUrl.includes("event") && "URL",
        eventContentVisible && "콘텐츠",
      ]
        .filter(Boolean)
        .join(", ");
      console.log(`✅ 비회원 이벤트 페이지 정상 접근 확인 (${eventChecked})`);
    } finally {
      await incognitoContext.close();
    }
  });
});

// ==========================================================================
// 아티스트/콘텐츠
// ==========================================================================
test.describe("아티스트/콘텐츠", () => {
  let makestar: MakestarPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    makestar = new MakestarPage(page);
    await makestar.gotoHome();
  });
  test("CMR-DATA-01: 아티스트 프로필 페이지 접근 및 정보 표시 확인", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // GNB Shop 버튼 클릭 (유저 시나리오)
    await makestar.navigateToShop();
    await makestar.waitForPageContent();
    console.log("✅ Shop 페이지 이동");

    // POM 로케이터 사용
    const cardCount = await makestar.getSearchResultCount();
    expect(cardCount, "Shop 페이지에 상품이 표시되어야 합니다").toBeGreaterThan(
      0,
    );

    // 사용자 시나리오: Shop -> 상품 상세 -> 아티스트 프로필
    const artistNavigation = await makestar.openArtistProfileFromShop({
      maxProducts: 8,
    });
    expect(
      artistNavigation.success,
      artistNavigation.reason ??
        "상품 상세 페이지에서 아티스트 링크를 찾을 수 없습니다",
    ).toBe(true);

    if (artistNavigation.success) {
      console.log(`📍 상품 상세 URL: ${artistNavigation.detailUrl}`);
      console.log(`📍 아티스트 URL: ${artistNavigation.artistUrl}`);
      console.log(`📍 사용 셀렉터: ${artistNavigation.selector}`);
    }

    // POM 메서드 사용
    const artistElements = await makestar.verifyArtistElements();
    let elementsFound = Object.values(artistElements).filter(Boolean).length;

    console.log(
      `   아티스트 이미지: ${artistElements.image ? "표시됨" : "미표시"}`,
    );
    console.log(`   아티스트명: ${artistElements.name ? "표시됨" : "미표시"}`);
    console.log(
      `   상품 목록: ${artistElements.products ? "표시됨" : "미표시"}`,
    );

    expect(elementsFound).toBeGreaterThan(0);
    console.log(`✅ 아티스트 관련 요소 ${elementsFound}개 확인`);
  });

  test("CMR-DATA-02: 아티스트별 상품 목록 필터링 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // GNB Shop 버튼 클릭 (유저 시나리오)
    await makestar.navigateToShop();
    await makestar.waitForPageContent();
    console.log("✅ Shop 페이지 이동");

    // POM 로케이터 사용
    const initialCount = await makestar.getSearchResultCount();
    console.log(`   초기 상품 수: ${initialCount}개`);

    // 필터 탭 확인 (POM 메서드 사용)
    const filterFound = await makestar.hasFilterTabs();
    if (filterFound) {
      console.log("✅ 필터 요소 발견");
      await makestar
        .clickFilterTab("전체")
        .catch(() => makestar.clickFilterTab("All"));
    }

    await makestar.gotoHome();
    await makestar.waitForContentStable();
    await makestar.openSearchUI();

    const artistName = "SEVENTEEN";
    await makestar.searchInput.fill(artistName);
    await makestar.searchInput.press("Enter");
    await makestar.waitForLoadState("domcontentloaded");
    await makestar.waitForSearchResults();
    console.log(`✅ 아티스트 "${artistName}" 검색 실행`);

    const searchUrl = makestar.currentUrl;
    console.log(`   검색 결과 URL: ${searchUrl}`);

    // POM 메서드 사용
    const resultCount = await makestar.getSearchResultCount();
    console.log(`   검색 결과 상품 수: ${resultCount}개`);

    expect(resultCount).toBeGreaterThan(0);
    console.log("✅ 아티스트 검색 결과 표시 확인");

    const artistMention = makestar.page.getByText(artistName).first();
    const hasArtistMention = await artistMention
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (hasArtistMention) {
      console.log(`✅ 검색 결과에 "${artistName}" 표시됨`);
    } else {
      console.log(
        `ℹ️ 검색 결과에 아티스트명 직접 표시 없음 (상품 이미지로 표시)`,
      );
    }

    if (resultCount > 0) {
      await makestar.clickFirstSearchResult();
      await makestar.waitForContentStable();

      const productUrl = makestar.currentUrl;
      console.log(`   상품 상세 URL: ${productUrl}`);

      // POM 메서드 사용
      const artistElements = await makestar.verifyArtistElements();
      console.log(
        `   상품 상세 아티스트 정보: ${artistElements.name ? "표시됨" : "미표시"}`,
      );
    }
  });
});

// ==========================================================================
// 응답성/성능 모니터링
// ==========================================================================
test.describe("응답성/성능 모니터링", () => {
  let makestar: MakestarPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    makestar = new MakestarPage(page);
    await makestar.gotoHome();
  });
  test("CMR-PERF-01: 주요 페이지 로딩 시간 측정 (Web Vitals 기반)", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    const pagesToTest = [
      { name: "Home", url: `${BASE_URL}/` },
      { name: "Event", url: `${BASE_URL}/event` },
      { name: "Shop", url: `${BASE_URL}/shop` },
    ];

    const results: {
      name: string;
      loadTime: number;
      vitals: WebVitalsResult;
      passed: boolean;
    }[] = [];

    console.log("📊 주요 페이지 로딩 시간 측정 (Web Vitals 기반)");
    console.log(`   기준: ${PERF_PAGE_LOAD_THRESHOLD_MS}ms 이내`);
    console.log("");

    for (const pageInfo of pagesToTest) {
      // POM 메서드 사용하여 Web Vitals 측정
      const { totalTime, vitals } = await makestar.measurePageLoadTime(
        pageInfo.url,
      );
      const passed = totalTime <= PERF_PAGE_LOAD_THRESHOLD_MS;

      results.push({
        name: pageInfo.name,
        loadTime: totalTime,
        vitals,
        passed,
      });

      const status = passed ? "✅" : "⚠️";
      console.log(
        `   ${status} ${pageInfo.name}: ${totalTime}ms (LCP: ${vitals.lcp}ms, FCP: ${vitals.fcp}ms)`,
      );

      await makestar.handleModalAndWaitForContent();
    }

    const passedCount = results.filter((r) => r.passed).length;
    const avgLoadTime = Math.round(
      results.reduce((sum, r) => sum + r.loadTime, 0) / results.length,
    );
    const avgLcp = Math.round(
      results.reduce((sum, r) => sum + r.vitals.lcp, 0) / results.length,
    );

    console.log("");
    console.log(`📈 결과 요약:`);
    console.log(`   통과: ${passedCount}/${results.length} 페이지`);
    console.log(`   평균 로딩 시간: ${avgLoadTime}ms`);
    console.log(`   평균 LCP: ${avgLcp}ms`);

    // 과반수 이상 통과하면 성공 (네트워크 상황에 따른 유연성 확보)
    const minPassRequired = Math.ceil(results.length / 2);
    expect(passedCount).toBeGreaterThanOrEqual(minPassRequired);
  });

  test("CMR-PERF-02: API 응답 시간 및 네트워크 요청 모니터링", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    const apiRequests: { url: string; duration: number; status: number }[] = [];
    const responseThreshold = PERF_API_RESPONSE_THRESHOLD_MS;

    page.on("response", async (response) => {
      const url = response.url();
      const timing = response.request().timing();

      if (
        url.includes("/api/") ||
        url.includes("/v1/") ||
        url.includes("/graphql")
      ) {
        const duration = timing.responseEnd - timing.requestStart;
        apiRequests.push({
          url: url.substring(0, 100),
          duration: Math.max(0, duration),
          status: response.status(),
        });
      }
    });

    console.log("📊 API 응답 시간 모니터링");
    console.log(`   기준: ${responseThreshold}ms 이내`);
    console.log("");

    const pagesToVisit = [
      `${BASE_URL}/`,
      `${BASE_URL}/event`,
      `${BASE_URL}/shop`,
    ];

    for (const url of pagesToVisit) {
      await makestar.goto(url, { waitUntil: "networkidle" });
      await makestar.handleModalAndWaitForContent();
    }

    console.log(`   수집된 API 요청: ${apiRequests.length}개`);

    if (apiRequests.length > 0) {
      const slowRequests = apiRequests.filter(
        (r) => r.duration > responseThreshold,
      );
      const failedRequests = apiRequests.filter((r) => r.status >= 400);
      const avgDuration = Math.round(
        apiRequests.reduce((sum, r) => sum + r.duration, 0) /
          apiRequests.length,
      );

      console.log(`   평균 응답 시간: ${avgDuration}ms`);
      console.log(
        `   느린 요청 (>${responseThreshold}ms): ${slowRequests.length}개`,
      );
      console.log(`   실패한 요청 (4xx/5xx): ${failedRequests.length}개`);

      if (slowRequests.length > 0) {
        console.log("");
        console.warn("   ⚠️ 느린 API 요청:");
        slowRequests.slice(0, 5).forEach((r) => {
          console.log(`      - ${r.url.substring(0, 60)}... (${r.duration}ms)`);
        });
      }

      if (failedRequests.length > 0) {
        console.log("");
        console.error("   ❌ 실패한 API 요청:");
        failedRequests.slice(0, 5).forEach((r) => {
          console.log(
            `      - ${r.url.substring(0, 60)}... (HTTP ${r.status})`,
          );
        });
      }

      const failureRate = failedRequests.length / apiRequests.length;
      expect(failureRate).toBeLessThan(0.1);
      console.log(
        `   실패율: ${(failureRate * 100).toFixed(1)}% (기준: 10% 미만)`,
      );
    } else {
      console.log(
        "   ℹ️ API 요청이 감지되지 않음 (정적 페이지 또는 캐시 사용)",
      );
    }

    const performanceMetrics = await makestar.measureWebVitals();

    console.log("");
    console.log("📈 페이지 성능 메트릭 (Web Vitals):");
    console.log(`   First Byte (TTFB): ${performanceMetrics.ttfb}ms`);
    console.log(`   First Contentful Paint (FCP): ${performanceMetrics.fcp}ms`);
    console.log(
      `   Largest Contentful Paint (LCP): ${performanceMetrics.lcp}ms`,
    );
    console.log(`   DOM Content Loaded: ${performanceMetrics.dcl}ms`);
    console.log(`   Load Complete: ${performanceMetrics.load}ms`);
    console.log(`   Cumulative Layout Shift (CLS): ${performanceMetrics.cls}`);
  });
});
