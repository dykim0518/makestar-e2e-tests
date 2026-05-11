/**
 * Makestar.com E2E 모니터링 테스트 - navigation
 *
 * Phase 5 구조 분할: 기존 cmr_monitoring_pom.spec.ts의 describe 블록을
 * 목적별 spec로 나누고, 공통 설정은 tests/helpers에서 가져옵니다.
 */

import { test, expect } from "@playwright/test";
import { runOptionalStep } from "./helpers/optional-step";
import { MakestarPage } from "./pages/makestar.page";
import { BASE_URL, TEST_TIMEOUT } from "./helpers/cmr-monitoring-config";

test.describe("GNB 네비게이션 @feature:cmr.home @feature:cmr.shop @feature:cmr.funding", () => {
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
      .isVisible({ timeout: 3000 });
    expect(homeButtonFound, "Home 버튼이 표시되어야 합니다").toBe(true);

    await makestar.homeButton.click();
    await makestar.waitForLoadState("domcontentloaded");
    await makestar.expectUrlMatches(
      new RegExp(`^${BASE_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\/?$`),
    );
  });
});

test.describe
  .serial("네비게이션 검증 @feature:cmr.home @feature:cmr.shop @feature:cmr.event @feature:cmr.funding @feature:cmr.mypage", () => {
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
    await runOptionalStep(() =>
      makestar.waitForContentStable("body", { timeout: 3000 }),
    );
    await makestar.prepareForGlobalNavigation();

    // GNB Shop 버튼 클릭 (POM 로케이터 사용)
    await expect(makestar.shopButton).toBeVisible({ timeout: 5000 });
    await makestar.shopButton.click();
    await makestar.waitForLoadState("domcontentloaded");
    await runOptionalStep(() =>
      makestar.waitForContentStable("body", { timeout: 3000 }),
    );

    const currentUrl = makestar.currentUrl;
    console.log(`📍 Shop 버튼 클릭 후 URL: ${currentUrl}`);

    expect(currentUrl).toContain("/shop");
  });

  test("CMR-NAV-07: GNB Event 버튼 클릭 → 이벤트 목록 페이지", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.handleModal();
    await runOptionalStep(() =>
      makestar.waitForContentStable("body", { timeout: 3000 }),
    );
    await makestar.prepareForGlobalNavigation();

    // GNB Event 버튼 클릭 (POM 로케이터 사용)
    await expect(makestar.eventButton).toBeVisible({ timeout: 5000 });
    await makestar.eventButton.click();
    await makestar.waitForLoadState("domcontentloaded");
    await runOptionalStep(() =>
      makestar.waitForContentStable("body", { timeout: 3000 }),
    );

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
    await runOptionalStep(() =>
      makestar.waitForContentStable("body", { timeout: 3000 }),
    );
    await makestar.prepareForGlobalNavigation();

    // GNB Funding 버튼 클릭 (POM 로케이터 사용)
    await expect(makestar.fundingButton).toBeVisible({ timeout: 5000 });
    await makestar.fundingButton.click();
    await makestar.waitForLoadState("domcontentloaded");
    await runOptionalStep(() =>
      makestar.waitForContentStable("body", { timeout: 3000 }),
    );

    const currentUrl = makestar.currentUrl;
    console.log(`📍 Funding 버튼 클릭 후 URL: ${currentUrl}`);

    expect(currentUrl).toContain("/funding");
  });
});
