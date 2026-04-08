/**
 * AlbumBuddy 핵심 기능 모니터링 테스트 (Page Object Model 적용)
 *
 * 이 테스트 파일은 POM 패턴을 사용하여 비즈니스 로직에만 집중합니다.
 * 페이지 조작 로직은 AlbumBuddyPage 클래스에 캡슐화되어 있습니다.
 *
 * @see tests/pages/albumbuddy.page.ts
 *
 * 테스트 구조 (메뉴 기반 + 사용자 시나리오):
 * - Health Check - 서비스 상태 확인
 * - 홈페이지 - 메인 페이지 기능
 * - About 페이지 - 서비스 소개
 * - Pricing 페이지 - 가격 정책
 * - 상품 상세 및 Request Item - 구매 플로우
 * - Dashboard - 로그인 사용자 기능 (Purchasing, Package)
 * - 통합 시나리오 - 사용자 여정
 *
 * 참고: AlbumBuddy는 구매 대행 서비스로, 일반 쇼핑몰과 달리 장바구니 기능이 없습니다.
 * Request Item 기능을 통해 상품을 요청하고, Dashboard에서 구매 현황을 관리합니다.
 */

import { test, expect } from "@playwright/test";
import {
  AlbumBuddyPage,
  ALBUMBUDDY_PAGES,
  HOME_SECTIONS,
  PERFORMANCE_THRESHOLD,
} from "./pages";
import * as path from "path";
import { checkAuthFile } from "./helpers/auth-utils";

// ============================================================================
// 상수 및 헬퍼
// ============================================================================
const AUTH_FILE = path.join(__dirname, "..", "ab-auth.json");

// ============================================================================
// Health Check - 서비스 상태 확인
// ============================================================================
test.describe.serial("Health Check", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let albumbuddy: AlbumBuddyPage;

  test("AB-HC-01: 사이트 접근 가능 여부", async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    const response = await page.goto(albumbuddy.shopUrl, {
      waitUntil: "domcontentloaded",
    });

    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(albumbuddy.siteTitle);
  });

  test("AB-HC-02: 주요 페이지 응답 상태 (Shop, About, Pricing)", async ({
    page,
  }) => {
    albumbuddy = new AlbumBuddyPage(page);
    const results = await albumbuddy.checkPagesStatus();

    for (const result of results) {
      expect(result.ok, `${result.url} 응답 실패`).toBe(true);
    }
  });

  test("AB-PERF-01: 홈페이지 로드 성능", async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    const result = await albumbuddy.measureHomePagePerformance();

    console.log(`홈페이지 로드 시간: ${result.loadTime}ms`);
    expect(result.passed).toBe(true);
  });

  test("AB-HC-03: 네트워크 에러 모니터링", async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);

    const criticalFailures = await albumbuddy.monitorNetworkErrors(async () => {
      await page.goto(albumbuddy.shopUrl, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page
        .waitForLoadState("networkidle", { timeout: 10000 })
        .catch(() => {});
    });

    expect(criticalFailures).toHaveLength(0);
  });
});

// ============================================================================
// 홈페이지 - 메인 진입점
// ============================================================================
test.describe("홈페이지", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let albumbuddy: AlbumBuddyPage;

  test.describe("페이지 로드 및 기본 UI", () => {
    test("AB-PAGE-01: 홈페이지 접근 및 타이틀 확인", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      await expect(page).toHaveTitle(albumbuddy.siteTitle);
    });

    test("AB-PAGE-02: 네비게이션 버튼 표시 (About, Pricing, Dashboard, Request item)", async ({
      page,
    }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();
      await albumbuddy.verifyNavButtons();
    });

    test("AB-PAGE-03: 브랜드 요소 표시 (AlbumBuddy, MAKESTAR, USD)", async ({
      page,
    }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();

      const { hasBrand, hasMakestar, hasCurrency } =
        await albumbuddy.verifyBrandElements();

      expect(hasBrand).toBe(true);
      expect(hasMakestar).toBe(true);
      expect(hasCurrency).toBe(true);
    });
  });

  test.describe("콘텐츠 섹션", () => {
    test("AB-PAGE-04: 핵심 섹션 확인 (Artists, Recent Albums, Trending, Official Partner)", async ({
      page,
    }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();

      const results = await albumbuddy.verifyHomeSections();
      const foundSections = Object.entries(results).filter(
        ([_, found]) => found,
      );

      console.log(
        "발견된 섹션:",
        foundSections.map(([name]) => name).join(", "),
      );
      console.log("전체 결과:", JSON.stringify(results));

      // 필수 섹션 개별 검증
      expect(
        results["Artist"] || results["아티스트"],
        "Artist 섹션이 있어야 합니다",
      ).toBe(true);
      expect(
        results["Recent"] || results["앨범"],
        "Recent/앨범 섹션이 있어야 합니다",
      ).toBe(true);
      expect(
        results["Trending"] || results["트렌딩"],
        "Trending 섹션이 있어야 합니다",
      ).toBe(true);

      // 전체 최소 3개 이상
      expect(
        foundSections.length,
        "최소 3개 이상의 핵심 섹션이 필요합니다",
      ).toBeGreaterThanOrEqual(3);
    });

    test("AB-PAGE-05: 이미지 콘텐츠 로드 확인", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();

      const { count, firstImageLoaded } = await albumbuddy.verifyImagesLoaded();

      expect(
        count,
        "홈페이지에 최소 5개 이상의 이미지가 있어야 합니다",
      ).toBeGreaterThanOrEqual(5);
      expect(firstImageLoaded, "첫 번째 이미지가 정상 로드되어야 합니다").toBe(
        true,
      );
    });

    test("AB-ACTION-01: Show more 버튼 동작", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();

      // 홈페이지에 Artists 또는 추천 섹션이 있어야 함
      const hasSection =
        (await albumbuddy.hasText("Artist")) ||
        (await albumbuddy.hasText("추천"));
      expect(
        hasSection,
        "홈페이지에 Artists 또는 추천 섹션이 있어야 합니다",
      ).toBe(true);

      const clicked = await albumbuddy.clickShowMore();
      console.log(`Show more 버튼: ${clicked ? "클릭됨" : "없음"}`);

      if (clicked) {
        const contentLength = await page.evaluate(
          () => document.body.innerText.length,
        );
        expect(
          contentLength,
          "Show more 클릭 후 콘텐츠가 있어야 합니다",
        ).toBeGreaterThan(100);
      } else {
        // Show more 버튼이 없으면 상품이 이미 모두 표시되어 있는지 확인
        const productCount = await page
          .locator(".album__grid > div > div")
          .count();
        expect(
          productCount,
          "Show more 없이도 상품이 표시되어야 합니다",
        ).toBeGreaterThan(0);
        console.log(`Show more 없음 — 표시된 상품: ${productCount}개`);
      }
    });
  });

  test.describe("검색 기능", () => {
    test("AB-SEARCH-01: 검색창 접근", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();

      const opened = await albumbuddy.openSearch();
      console.log(
        `검색창 열기: ${opened ? "성공" : "검색 기능 없음 또는 다른 방식"}`,
      );
      // 검색창이 열렸거나, 검색 입력 필드가 존재해야 함
      const hasSearchInput = await page
        .locator(
          'input[type="search"], input[placeholder*="search" i], input[placeholder*="검색" i]',
        )
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      expect(opened || hasSearchInput, "검색 기능을 찾을 수 없습니다").toBe(
        true,
      );
    });

    test("AB-SEARCH-02: 아티스트 검색 (BTS)", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();

      const { success, hasResults } = await albumbuddy.search("BTS");

      // 검색 기능이 동작해야 함
      expect(success, "검색 기능이 정상적으로 동작해야 합니다").toBe(true);

      if (success) {
        console.log(`검색 결과: ${hasResults ? "있음" : "없음"}`);
        // BTS 검색 시 결과가 있어야 함 (유명 아티스트)
        expect(hasResults, "BTS 검색 시 결과가 있어야 합니다").toBe(true);
      }
    });

    test("AB-SEARCH-03: 존재하지 않는 검색어 처리", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();

      const { success, hasResults } = await albumbuddy.search(
        "xyznonexistent12345",
      );

      // 검색 기능 자체는 동작해야 함
      expect(success, "검색 기능이 정상적으로 동작해야 합니다").toBe(true);

      if (success) {
        console.log(`검색 결과 여부: ${hasResults ? "있음" : "없음"}`);
        // 존재하지 않는 검색어는 결과가 없어야 함
        expect(hasResults, "존재하지 않는 검색어는 결과가 없어야 합니다").toBe(
          false,
        );
      }
    });
  });
});

// ============================================================================
// About 페이지 - 서비스 소개
// ============================================================================
test.describe("About 페이지", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let albumbuddy: AlbumBuddyPage;

  test("AB-NAV-01: About 페이지 직접 접근", async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    await albumbuddy.gotoAbout();
    await expect(page).toHaveURL(ALBUMBUDDY_PAGES.about.pattern);
  });

  test("AB-NAV-02: Shop → About 네비게이션", async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    await albumbuddy.gotoHome();
    await albumbuddy.clickNavButton("About");
    await expect(page).toHaveURL(ALBUMBUDDY_PAGES.about.pattern, {
      timeout: 10000,
    });
  });

  test("AB-PAGE-06: About 페이지 콘텐츠 확인", async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    await albumbuddy.gotoAbout();

    const aboutContent = await albumbuddy.verifyAboutContent();

    expect(
      aboutContent.hasBrandName,
      "About 페이지에 브랜드명(AlbumBuddy)이 있어야 합니다",
    ).toBe(true);
    expect(
      aboutContent.hasServiceDescription,
      "About 페이지에 서비스 설명(proxy buying/shipping)이 있어야 합니다",
    ).toBe(true);
    expect(
      aboutContent.hasSponsor,
      "About 페이지에 스폰서(MAKESTAR) 정보가 있어야 합니다",
    ).toBe(true);
  });
});

// ============================================================================
// Pricing 페이지 - 가격 정책
// ============================================================================
test.describe("Pricing 페이지", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let albumbuddy: AlbumBuddyPage;

  test("AB-NAV-03: Pricing 페이지 직접 접근", async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    await albumbuddy.gotoPricing();
    await expect(page).toHaveURL(ALBUMBUDDY_PAGES.pricing.pattern);
  });

  test("AB-NAV-04: Shop → Pricing 네비게이션", async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    await albumbuddy.gotoHome();
    await albumbuddy.clickNavButton("Pricing");
    await expect(page).toHaveURL(ALBUMBUDDY_PAGES.pricing.pattern, {
      timeout: 10000,
    });
  });

  test("AB-PAGE-07: Pricing 페이지 가격 정보 확인", async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);
    await albumbuddy.gotoPricing();

    const pricingContent = await albumbuddy.verifyPricingPageContent();

    expect(
      pricingContent.hasTitle,
      "Pricing 페이지에 'Service Pricing' 제목이 있어야 합니다",
    ).toBe(true);
    expect(
      pricingContent.hasPriceValues,
      "Pricing 페이지에 실제 가격 값($X.XX)이 있어야 합니다",
    ).toBe(true);
    expect(
      pricingContent.hasServiceItems,
      "Pricing 페이지에 서비스 항목이 2개 이상 있어야 합니다",
    ).toBe(true);
    expect(
      pricingContent.hasShippingCalculator,
      "Pricing 페이지에 배송비 계산기가 있어야 합니다",
    ).toBe(true);
  });
});

// ============================================================================
// 상품 상세 및 Request Item - 구매 플로우
// ============================================================================
test.describe("상품 상세 및 Request Item", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let albumbuddy: AlbumBuddyPage;

  test.describe("상품 상세 페이지", () => {
    test("AB-NAV-05: 상품 클릭하여 상세 페이지 이동", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();

      const { success, productName } = await albumbuddy.clickFirstProduct();

      // 홈페이지에 상품이 있어야 하고 클릭 가능해야 함
      expect(success, "홈페이지에서 상품을 찾고 클릭할 수 있어야 합니다").toBe(
        true,
      );

      if (success) {
        console.log(`클릭한 상품: ${productName}`);
        const currentUrl = albumbuddy.currentUrl;
        // 상품 클릭 후 URL이 /product/로 변경되어야 함
        expect(
          currentUrl.includes("/product/"),
          "상품 클릭 후 상세 페이지(/product/)로 이동해야 합니다",
        ).toBe(true);
      }
    });

    test("AB-PAGE-08: 상품 상세 페이지 요소 확인 (이미지, 가격, 제목)", async ({
      page,
    }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();

      const { success } = await albumbuddy.clickFirstProduct();

      // 상품 클릭이 성공해야 함
      expect(success, "상품을 클릭하여 상세 페이지로 이동해야 합니다").toBe(
        true,
      );

      if (success) {
        const details = await albumbuddy.verifyProductDetailPage();

        console.log(`상품 상세 페이지 요소:`);
        console.log(`  - 이미지: ${details.hasImage}`);
        console.log(`  - 가격: ${details.hasPrice}`);
        console.log(`  - 제목: ${details.hasTitle}`);

        // 상세 페이지에는 최소 이미지, 가격, 제목 중 하나가 있어야 함
        const hasAnyElement =
          details.hasImage || details.hasPrice || details.hasTitle;
        expect(
          hasAnyElement,
          "상품 상세 페이지에 이미지, 가격, 제목 중 하나 이상이 있어야 합니다",
        ).toBe(true);

        // 더 엄격하게: 이미지와 가격은 필수
        expect(details.hasImage, "상품 이미지가 표시되어야 합니다").toBe(true);
        expect(details.hasPrice, "상품 가격이 표시되어야 합니다").toBe(true);
      }
    });

    test("AB-DATA-01: 상품 이미지 로드 확인", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();

      const { success } = await albumbuddy.clickFirstProduct();

      // 상품 클릭이 성공해야 함
      expect(success, "상품을 클릭하여 상세 페이지로 이동해야 합니다").toBe(
        true,
      );

      if (success) {
        const imageLoaded = await albumbuddy.verifyProductImageLoaded();
        console.log(
          `상품 이미지 로드: ${imageLoaded ? "성공" : "이미지 없음 또는 로드 실패"}`,
        );
        // 상품 이미지가 실제로 로드되어야 함
        expect(imageLoaded, "상품 이미지가 정상적으로 로드되어야 합니다").toBe(
          true,
        );
      }
    });
  });

  test.describe("Request Item 기능", () => {
    test("AB-ACTION-02: Request item 버튼 표시", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();

      const isRequestItemVisible =
        await albumbuddy.ensureRequestItemButtonVisible();
      if (isRequestItemVisible) {
        await expect(albumbuddy.requestItemButton).toBeVisible({
          timeout: 10000,
        });
        console.log("Request item 버튼이 정상적으로 표시됩니다");
      } else {
        const hasRequestItemDom = await albumbuddy.hasRequestItemEntryInDom();
        expect(
          hasRequestItemDom,
          "모바일에서는 Request item CTA가 숨김이어도 DOM에는 존재해야 합니다",
        ).toBe(true);
        console.log("Request item CTA가 모바일 숨김 상태로 존재합니다");
      }
    });

    test("AB-ACTION-03: Request item 버튼 클릭 동작", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();

      const isRequestItemVisible =
        await albumbuddy.ensureRequestItemButtonVisible();
      if (isRequestItemVisible) {
        await expect(albumbuddy.requestItemButton).toBeVisible({
          timeout: 10000,
        });
      } else {
        const hasRequestItemDom = await albumbuddy.hasRequestItemEntryInDom();
        expect(hasRequestItemDom, "Request item CTA를 찾을 수 없습니다").toBe(
          true,
        );
      }

      const { modalVisible, urlChanged, triggered } =
        await albumbuddy.clickRequestItemAndVerify();
      expect(triggered, "Request item 액션 트리거에 실패했습니다").toBe(true);
      console.log(
        `Request item 결과: 모달=${modalVisible}, URL변경=${urlChanged}, 트리거=${triggered}`,
      );
      expect(
        modalVisible || urlChanged,
        "Request item 버튼 클릭 후 모달이 열리거나 URL이 변경되어야 합니다",
      ).toBe(true);
    });
  });
});

// ============================================================================
// Dashboard - 로그인 사용자 기능
// ============================================================================
test.describe("Dashboard", () => {
  // 비로그인 상태 테스트
  test.describe("비로그인 인증 확인", () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    let albumbuddy: AlbumBuddyPage;

    test("AB-AUTH-01: Dashboard 접근 시 비로그인 상태 확인", async ({
      page,
    }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoHome();

      const { needsLogin, hasLoginElement } =
        await albumbuddy.checkLoginRequired();

      const currentUrl = albumbuddy.currentUrl;
      const redirectedToAuth =
        currentUrl.includes("login") || currentUrl.includes("auth");
      const onDashboard = currentUrl.includes("dashboard");

      // 비로그인 상태에서: 로그인 요구되거나, Dashboard에 빈 데이터로 접근 가능
      expect(
        needsLogin || redirectedToAuth || onDashboard,
        "비로그인 상태에서 Dashboard 접근 시 로그인 요구 또는 빈 Dashboard가 표시되어야 합니다",
      ).toBe(true);

      if (onDashboard && !redirectedToAuth) {
        // Dashboard에 접근 가능한 경우: Login 요소가 DOM에 존재해야 함
        const hasLoginInDom =
          (await page
            .locator('button:has-text("Login"), a:has-text("Login")')
            .count()) > 0;
        expect(
          hasLoginInDom,
          "비로그인 상태에서 Login 요소가 DOM에 존재해야 합니다",
        ).toBe(true);
      }
    });

    test("AB-AUTH-02: Dashboard 직접 접근 시 비로그인 상태 확인", async ({
      page,
    }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboard();

      const currentUrl = albumbuddy.currentUrl;
      const redirectedToAuth =
        currentUrl.includes("login") || currentUrl.includes("auth");

      if (redirectedToAuth) {
        // 리다이렉트된 경우: 인증 페이지인지 확인
        expect(
          redirectedToAuth,
          "비로그인 시 인증 페이지로 리다이렉트되어야 합니다",
        ).toBe(true);
      } else {
        // 리다이렉트 없이 Dashboard에 접근 가능한 경우: 비로그인 상태 표시 확인
        expect(currentUrl, "Dashboard URL이어야 합니다").toContain("dashboard");
        const hasLoginInDom =
          (await page
            .locator('button:has-text("Login"), a:has-text("Login")')
            .count()) > 0;
        expect(
          hasLoginInDom,
          "비로그인 상태에서 Login 요소가 DOM에 존재해야 합니다",
        ).toBe(true);
      }
    });
  });

  // 로그인 상태 테스트
  test.describe("인증 세션 검증", () => {
    const authStatus = checkAuthFile(AUTH_FILE);

    test.use({
      storageState: authStatus.available
        ? AUTH_FILE
        : { cookies: [], origins: [] },
    });

    test("AB-AUTH-03: 인증 세션 파일 유효성", async () => {
      expect(
        authStatus.available,
        `인증 실패: ${authStatus.reason}\n` +
          `해결방법: npx playwright test tests/ab-save-auth.spec.ts -g "로그인" --headed --project=chromium`,
      ).toBe(true);
    });
  });

  test.describe("Purchasing", () => {
    const authStatus = checkAuthFile(AUTH_FILE);

    test.use({
      storageState: authStatus.available
        ? AUTH_FILE
        : { cookies: [], origins: [] },
    });

    let albumbuddy: AlbumBuddyPage;

    test("AB-PAGE-09: Purchasing 페이지 접근", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboardPurchasing();

      const currentUrl = albumbuddy.currentUrl;
      expect(currentUrl).toContain("purchasing");
      expect(currentUrl.includes("login")).toBe(false);
    });

    test("AB-PAGE-10: Purchasing 페이지 콘텐츠 로드", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboard();

      const dashContent = await albumbuddy.verifyDashboardDetailContent();

      expect(
        dashContent.notFound,
        "Dashboard에 404/Not Found가 없어야 합니다",
      ).toBe(false);
      expect(
        dashContent.hasOrderTabs,
        "Dashboard에 주문/패키지 탭이 있어야 합니다",
      ).toBe(true);
      expect(
        dashContent.hasStatusCounters,
        "Dashboard에 상태 카운터(Waiting, Pending 등)가 있어야 합니다",
      ).toBe(true);
      expect(albumbuddy.isLoggedIn()).toBe(true);
    });

    test("AB-PAGE-11: 구매 내역 UI 요소 확인", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboardPurchasing();

      const purchasingContent =
        await albumbuddy.verifyPurchasingDetailContent();

      expect(
        purchasingContent.hasItemColumns,
        "구매 내역 테이블/목록이 있어야 합니다",
      ).toBe(true);
      expect(
        purchasingContent.hasCostBreakdown,
        "비용 내역(Item cost, Total 등)이 있어야 합니다",
      ).toBe(true);
    });
  });

  test.describe("Package", () => {
    const authStatus = checkAuthFile(AUTH_FILE);

    test.use({
      storageState: authStatus.available
        ? AUTH_FILE
        : { cookies: [], origins: [] },
    });

    let albumbuddy: AlbumBuddyPage;

    test("AB-PAGE-12: Package 페이지 접근", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboardPackage();

      const currentUrl = albumbuddy.currentUrl;
      expect(
        currentUrl.includes("package") || currentUrl.includes("dashboard"),
        "Package 페이지로 이동해야 합니다",
      ).toBe(true);
    });

    test("AB-PAGE-13: Package 페이지 콘텐츠 로드", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboardPackage();

      const dashContent = await albumbuddy.verifyDashboardDetailContent();
      expect(
        dashContent.notFound,
        "Package 페이지에 404/Not Found가 없어야 합니다",
      ).toBe(false);
      expect(
        dashContent.hasOrderTabs,
        "Package 페이지에 주문/패키지 탭이 있어야 합니다",
      ).toBe(true);
      expect(albumbuddy.isLoggedIn()).toBe(true);
    });

    test("AB-PAGE-14: Package 페이지 콘텐츠 확인", async ({ page }) => {
      albumbuddy = new AlbumBuddyPage(page);
      await albumbuddy.gotoDashboardPackage();

      const packageContent = await albumbuddy.verifyPackageDetailContent();
      expect(
        packageContent.hasPackageTab,
        "My packages 탭이 있어야 합니다",
      ).toBe(true);
      expect(
        packageContent.hasPackageContent,
        "Package 관련 콘텐츠가 있어야 합니다",
      ).toBe(true);
    });
  });
});

// ============================================================================
// 통합 시나리오 - 사용자 여정
// ============================================================================
test.describe("통합 시나리오", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  let albumbuddy: AlbumBuddyPage;

  test("AB-NAV-06: 메뉴 탐색 플로우: Shop → About → Pricing", async ({
    page,
  }) => {
    albumbuddy = new AlbumBuddyPage(page);

    // 1. Shop 진입
    await albumbuddy.gotoHome();
    await expect(page).toHaveTitle(albumbuddy.siteTitle);

    // 2. About으로 이동
    await albumbuddy.clickNavButton("About");
    await expect(page).toHaveURL(ALBUMBUDDY_PAGES.about.pattern);

    // 3. 홈으로 돌아가서 Pricing으로 이동
    await page.goto(albumbuddy.shopUrl, { waitUntil: "domcontentloaded" });
    await albumbuddy.waitForPageReady();
    await albumbuddy.clickNavButton("Pricing");
    await expect(page).toHaveURL(ALBUMBUDDY_PAGES.pricing.pattern);
  });

  test("AB-NAV-07: 브라우저 히스토리: 뒤로/앞으로", async ({ page }) => {
    albumbuddy = new AlbumBuddyPage(page);

    await page.goto(albumbuddy.shopUrl, { waitUntil: "domcontentloaded" });
    await albumbuddy.gotoAbout();

    await page.goBack();
    await expect(page).toHaveURL(/shop/i);

    await page.goForward();
    await expect(page).toHaveURL(/about/i);
  });
});
