/**
 * Makestar.com E2E 모니터링 테스트 - cart/product
 *
 * Phase 5 구조 분할: 기존 cmr_monitoring_pom.spec.ts의 describe 블록을
 * 목적별 spec로 나누고, 공통 설정은 tests/helpers에서 가져옵니다.
 */

import { test, expect } from "@playwright/test";
import { getPriceOptionProductIds } from "./fixtures/cmr-products";
import { runOptionalStep } from "./helpers/optional-step";
import { BASE_URL, TEST_TIMEOUT } from "./helpers/cmr-monitoring-config";
import { verifyCurrentProductOptionPriceChange } from "./helpers/cmr-product-option";
import { MakestarPage } from "./pages/makestar.page";

const PRICE_OPTION_SCAN_LIMIT = 10;
const PRICE_OPTION_PRODUCT_IDS = getPriceOptionProductIds(BASE_URL);

test.describe("상품/장바구니 기능 @feature:cmr.cart @feature:cmr.product @feature:cmr.shop", () => {
  let makestar: MakestarPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    makestar = new MakestarPage(page);
    await makestar.gotoHome();
  });
  test("CMR-ACTION-01: 상품 옵션 변경에 따른 가격 변동 확인", async ({}, testInfo) => {
    test.setTimeout(TEST_TIMEOUT);

    let priceChanged = false;
    let optionCandidateFound = false;
    let verificationDetail =
      "옵션 변경에 따라 가격이 달라지는 상품을 찾지 못했습니다.";
    const checkedDetails: string[] = [];

    for (const productId of PRICE_OPTION_PRODUCT_IDS) {
      await makestar.goto(`${makestar.baseUrl}/product/${productId}`);
      await makestar.waitForLoadState("domcontentloaded");
      await makestar.waitForContentStable();
      await makestar.handleModal();

      const result = await verifyCurrentProductOptionPriceChange(
        makestar,
        `고정 상품 ${productId}`,
      );
      optionCandidateFound ||= result.optionCandidateFound;
      priceChanged ||= result.priceChanged;
      verificationDetail = result.detail;
      checkedDetails.push(result.detail);

      if (priceChanged) {
        console.log(`✅ 옵션 변경 후 가격 변동 확인됨 (${verificationDetail})`);
        break;
      }
    }

    if (PRICE_OPTION_PRODUCT_IDS.length > 0) {
      expect(
        priceChanged,
        `고정 가격 옵션 상품(${PRICE_OPTION_PRODUCT_IDS.join(", ")})에서 가격 변동을 확인하지 못했습니다. ${checkedDetails.join(" | ")}`,
      ).toBe(true);
      return;
    }

    // GNB Shop 버튼 클릭 (유저 시나리오)
    await makestar.navigateToShop();
    await makestar.waitForPageContent();
    // `waitForPageContent`는 배너·썸네일 이미지 중 하나라도 보이면 조기 통과하므로
    // 상품 그리드 렌더를 별도로 보장한다.
    await makestar.waitForShopProductsLoaded();

    const productCount = await makestar.shopProductCard.count();
    expect(
      productCount,
      "Shop 페이지에 상품이 표시되어야 합니다",
    ).toBeGreaterThan(0);

    for (
      let productIndex = 0;
      productIndex < Math.min(PRICE_OPTION_SCAN_LIMIT, productCount);
      productIndex++
    ) {
      const productCard = makestar.shopProductCard.nth(productIndex);
      await expect(productCard).toBeVisible({ timeout: 5000 });
      await productCard.click();
      await makestar.waitForLoadState("domcontentloaded");
      await makestar.waitForContentStable();
      await makestar.handleModal();

      const result = await verifyCurrentProductOptionPriceChange(
        makestar,
        `상품 ${productIndex + 1}`,
      );
      optionCandidateFound ||= result.optionCandidateFound;
      priceChanged ||= result.priceChanged;
      verificationDetail = result.detail;
      checkedDetails.push(result.detail);

      if (priceChanged) {
        console.log(`✅ 옵션 변경 후 가격 변동 확인됨 (${verificationDetail})`);
        break;
      }

      await makestar.goto(`${makestar.baseUrl}/shop`);
      await makestar.handleModal();
      await makestar.waitForPageContent();
    }

    if (!priceChanged) {
      const reason = optionCandidateFound
        ? `옵션은 2개 이상인 상품이 있었지만 가격 변동 상품은 없습니다. 마지막 상태: ${verificationDetail}`
        : `옵션 가격 변동 검증 가능한 상품이 현재 데이터셋에 없습니다. 마지막 상태: ${verificationDetail}`;
      testInfo.annotations.push({
        type: "data-unavailable",
        description: checkedDetails.join(" | "),
      });
      test.skip(
        !priceChanged,
        `데이터 조건 미충족으로 가격 변동 검증을 건너뜁니다. ${reason}`,
      );
    }
  });

  test("CMR-ACTION-02: 품절 상품 표시 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // GNB Shop 버튼 클릭 (유저 시나리오)
    await makestar.navigateToShop();
    await makestar.waitForPageContent();
    await makestar.waitForShopProductsLoaded();

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

      const openedProduct = await makestar.openFirstCartEligibleProduct();
      expect(
        openedProduct,
        "장바구니 담기 가능한 상품 상세 페이지로 진입해야 합니다",
      ).toBe(true);
      console.log("   ✅ 장바구니 가능 상품 상세 페이지 이동 완료");
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

    await test.step("Step 4: 장바구니 반영 확인", async () => {
      expect(
        addedToCartSuccess,
        "장바구니 담기 버튼 클릭이 성공해야 합니다",
      ).toBe(true);

      await runOptionalStep(() => makestar.waitForNetworkStable());
      await makestar.handleModal();
      await makestar.gotoCart();
      await makestar.waitForContentStable();

      const itemCount = await makestar.waitForCartItemCountAtLeast();
      expect(
        itemCount,
        "장바구니에 상품이 실제로 담겨야 합니다",
      ).toBeGreaterThan(0);
      console.log(`   ✅ 장바구니 반영 확인 (${itemCount}개)`);
    });
  });

  test("CMR-ACTION-05: 장바구니 수량 증가 시 가격 반영 검증", async ({}, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile-chrome",
      "모바일은 장바구니 UI가 데스크톱과 달라 데스크톱 전용으로 검증",
    );
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
      // 배너·이벤트 썸네일이 먼저 뜨면 `waitForPageContent`가 조기 통과하므로
      // Shop 상품 그리드 렌더를 명시적으로 보장.
      await makestar.waitForShopProductsLoaded();

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
          const itemCount = await makestar
            .waitForCartItemCountAtLeast()
            .catch(() => 0);
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

      // 수량이 증가할 때까지 대기 (장바구니 row의 양수 수량 기준)
      await expect
        .poll(async () => await makestar.getCartQuantity(), {
          timeout: 10000,
          message: "장바구니 수량이 증가해야 합니다",
        })
        .toBeGreaterThan(qtyBefore);
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
        .isVisible({ timeout: 5000 });

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
