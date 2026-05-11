/**
 * Makestar.com E2E 모니터링 테스트 - home/pages
 *
 * Phase 5 구조 분할: 기존 cmr_monitoring_pom.spec.ts의 describe 블록을
 * 목적별 spec로 나누고, 공통 설정은 tests/helpers에서 가져옵니다.
 */

import { test, expect } from "@playwright/test";
import { runOptionalStep } from "./helpers/optional-step";
import { MakestarPage } from "./pages/makestar.page";
import { BASE_URL, TEST_TIMEOUT } from "./helpers/cmr-monitoring-config";

test.describe("기본 페이지 @feature:cmr.home @feature:cmr.event @feature:cmr.product", () => {
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
    await runOptionalStep(() => page.evaluate(() => window.scrollTo(0, 0)));

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
      .isVisible({ timeout: 5000 });
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

    // 탭 요소 로드 대기 (콘텐츠 안정화) — PAGE-02와 동일 패턴
    await makestar
      .waitForContentStable("body", { stableTime: 500, timeout: 5000 })
      .catch(() => console.log("⏱️ 콘텐츠 안정화 대기 타임아웃"));

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
    const ongoingClicked = await makestar.clickOngoingTab();
    if (!ongoingClicked) {
      console.log("ℹ️ 진행중인 이벤트 탭 클릭 불가 - 기본 이벤트 목록에서 진행");
    }
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
    const ongoingClicked = await makestar.clickOngoingTab();
    if (!ongoingClicked) {
      console.log("ℹ️ 진행중인 이벤트 탭 클릭 불가 - 기본 이벤트 목록에서 진행");
    }
    try {
      await makestar.clickFirstEventCard();
    } catch (error) {
      console.warn(
        `⚠️ Event 목록에서 진입 실패, Shop 상품으로 폴백합니다: ${error instanceof Error ? error.message : String(error)}`,
      );
      await makestar.clickLogoToHome();
      await makestar.navigateToShop();
      await makestar.waitForPageContent();
      const openedFromShop = await makestar.clickFirstAvailableProduct();
      expect(
        openedFromShop,
        "Event/Shop 어느 경로에서도 상품 상세 페이지로 진입하지 못했습니다.",
      ).toBe(true);
    }
    await makestar.handleModal();

    const optionSelected = await makestar.selectFirstOption();
    if (!optionSelected) {
      await makestar.setQuantity(1);
      console.log("ℹ️ 옵션 선택 UI 미발견, 기본 수량만 설정 후 구매 시도");
    }

    const purchaseClicked = await makestar.clickPurchaseButton();
    expect(purchaseClicked).toBeTruthy();

    // 결제/로그인 진입은 비동기 라우팅이라 초기 URL을 너무 빨리 읽으면 거짓 실패가 날 수 있음
    await runOptionalStep(() =>
      page.waitForFunction(
        () => {
          const url = window.location.href;
          const text = (document.body?.innerText || "").replace(/\s+/g, " ");
          return (
            /payments?|checkout|order|login|auth|dialog=open/i.test(url) ||
            /Proceed to Payment|Delivery Address|Payment Currency|Shipping Infomations|위에 보이는 문자를 입력해 주세요|Google/i.test(
              text,
            )
          );
        },
        undefined,
        { timeout: 10000 },
      ),
    );

    await makestar.waitForNetworkStable();
    const afterClickUrl = page.url();
    console.log(`📍 버튼 클릭 후 URL: ${afterClickUrl}`);

    const googleBtn = await makestar.findVisibleElement(
      ['button:has-text("Google")', '[class*="google"]'],
      5000,
    );
    const captchaPrompt = await makestar.findVisibleElement(
      [
        "text=/위에 보이는 문자를 입력해 주세요/i",
        'button:has-text("입력")',
        'button:has-text("새로고침")',
      ],
      5000,
    );
    const paymentIndicators = await makestar.findVisibleElement(
      [
        "text=/Proceed to Payment|Delivery Address|Payment Currency|Shipping Infomations/i",
      ],
      5000,
    );
    const isPaymentPage = /payments?|checkout|order/i.test(afterClickUrl);
    const isAuthPage = /login|auth/i.test(afterClickUrl);
    const isPurchaseDialogOpen = /dialog=open/i.test(afterClickUrl);

    expect(
      googleBtn !== null ||
        captchaPrompt !== null ||
        isPaymentPage ||
        paymentIndicators !== null ||
        isAuthPage ||
        isPurchaseDialogOpen,
      `구매 버튼 클릭 후 로그인/결제/인증 단계로 진입해야 합니다 (현재 URL: ${afterClickUrl})`,
    ).toBeTruthy();

    if (googleBtn) {
      console.log("✅ Google 로그인 버튼 발견");
    } else if (captchaPrompt) {
      console.log("✅ 캡차/문자 인증 단계로 이동됨");
    } else if (isPaymentPage) {
      console.log("✅ 결제 페이지로 이동됨 (로그인 상태)");
    } else if (paymentIndicators) {
      console.log("✅ 결제 화면 주요 요소가 표시됨");
    } else if (isPurchaseDialogOpen) {
      console.log("✅ 구매 옵션 다이얼로그/바텀시트가 열림");
    } else {
      console.log("✅ 로그인/인증 페이지로 이동됨");
    }
  });
});
