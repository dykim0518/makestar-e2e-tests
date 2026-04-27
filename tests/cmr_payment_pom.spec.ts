/**
 * Makestar CMR 결제 플로우 E2E 테스트
 *
 * ⚠️ 환경 정책: **stage 환경 전용**. 같은 소스가 prod에도 배포되지만 prod에서는
 *   실제 결제/데이터 오염 방지를 위해 전체 describe를 자동 스킵한다. 판정 기준은
 *   `MAKESTAR_BASE_URL`에 `stage`/`staging` 문자열 포함 여부.
 *
 * Phase 1 (smoke/회귀):
 *  - CMR-PAY-01: Proceed 클릭 시 Toss 진입 smoke + make_order 응답 확인
 *  - CMR-PAY-02: 지역제한 상품 unavailable 경고 + Proceed disabled
 *  - CMR-PAY-03: 동의 체크박스 해제 시 Proceed disabled 회귀
 *
 * Phase 2 (카드 결제 완주):
 *  - CMR-PAY-01-CARD: Visa 카드 정보 입력 완료까지 도달 (submit 직전 검증)
 *  - CMR-PAY-01-CARD-SUBMIT: Visa 결제 승인(200) + processing URL의 orderId /
 *    paymentKey / amount 파라미터 검증
 *
 * 미래 확장:
 *  - Admin 주문조회 API로 orderId 실존/상태 검증
 *  - Master/JCB 브랜드 파라미터 확장
 *  - 결제 실패 케이스(카드 거절) 회귀
 *  - 통화 KRW/USD 전환 (서버 원복 이슈 조사 필요)
 *
 * @see tests/pages/makestar-payment.page.ts
 * @see tests/fixtures/cmr-payment.ts
 */

import { test, expect } from "@playwright/test";
import { MakestarPaymentPage } from "./pages";
import {
  PAYABLE_PRODUCT_IDS,
  RESTRICTED_PRODUCT_IDS,
  TOSS_TEST_CARDS,
} from "./fixtures/cmr-payment";

const BASE_URL =
  process.env.MAKESTAR_BASE_URL || "https://stage-new.makeuni2026.com";
const TEST_TIMEOUT = 90000;

// 환경 가드: stage 전용. prod에서는 실제 결제가 발생하므로 전체 describe를 스킵.
// URL에 "stage"/"staging" 문자열이 포함된 경우만 실행으로 간주한다.
const IS_STAGE_ENV = /stage|staging/i.test(BASE_URL);

test.describe.serial("CMR 결제 회귀", () => {
  // 같은 소스가 prod에도 배포되는 구조 — prod 실행 방지를 위한 환경 가드.
  test.skip(
    !IS_STAGE_ENV,
    `CMR 결제 테스트는 stage 환경 전용입니다. 현재 MAKESTAR_BASE_URL=${BASE_URL} 은 stage로 판정되지 않아 스킵합니다.`,
  );

  let payment: MakestarPaymentPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    payment = new MakestarPaymentPage(page, BASE_URL);

    // 테스트 간 장바구니 고립: Purchase 버튼이 카트 전체를 order-review에 싣기 때문에
    // 이전 테스트가 카트를 남겨두면 amount 누적으로 결제 금액 검증이 실패한다.
    // 병렬 워커가 같은 세션(stg-auth.json)을 공유하는 구조라 스크립트에서 격리 보장.
    await payment.clearCart();
  });

  test(
    "CMR-PAY-01: Proceed 클릭 시 Toss 결제 진입과 make_order 응답 확인",
    { tag: "@feature:cmr.payments.toss.entry" },
    async () => {
      const productId = PAYABLE_PRODUCT_IDS[0];
      await payment.setCurrency("KRW");
      await payment.openProductAndPurchase(productId);
      await payment.waitForOrderReviewLoaded();

      const hasWarning = await payment.hasUnavailableItemsWarning();
      expect(
        hasWarning,
        `결제 가능 상품 ${productId}에 unavailable 경고가 있으면 Toss 진입 테스트가 성립하지 않음 — fixture PAYABLE_PRODUCT_IDS 갱신 필요`,
      ).toBe(false);

      const { total } = await payment.checkAllAgreements();
      expect(total, "동의 체크박스가 렌더링되어야 합니다").toBeGreaterThan(0);
      await expect
        .poll(async () => await payment.isProceedDisabled(), {
          timeout: 5000,
          message: "전체 동의 체크 후 Proceed 버튼이 활성화되어야 합니다",
        })
        .toBe(false);

      const tossEntry = await payment.startTossEntry();
      expect(
        tossEntry.makeOrder.status,
        `make_order 응답이 성공이어야 합니다. 실제 status=${tossEntry.makeOrder.status}`,
      ).toBeGreaterThanOrEqual(200);
      expect(tossEntry.makeOrder.status).toBeLessThan(400);
      expect(
        tossEntry.hasWidget || tossEntry.hasGateway,
        "Proceed 클릭 후 Toss payment-widget 또는 payment-gateway가 로드되어야 합니다",
      ).toBe(true);
    },
  );

  test(
    "CMR-PAY-02: 지역제한 상품은 동의 완료 후에도 Proceed 버튼이 disabled",
    { tag: "@feature:cmr.payments.entry" },
    async () => {
      await payment.setCurrency("KRW");

      // RESTRICTED 후보를 순회하며 unavailable 경고가 실제로 뜨는 상품을 찾는다.
      // (stage 상품 데이터가 변하면 경고가 특정 ID에서만 재현되므로 fixture 전체를 시도)
      let hitProductId: number | null = null;
      let warningFound = false;

      for (const id of RESTRICTED_PRODUCT_IDS) {
        await payment.openProductAndPurchase(id);
        await payment.waitForOrderReviewLoaded();

        const { total } = await payment.checkAllAgreements();
        expect(
          total,
          `체크박스가 렌더링되어야 합니다 (product ${id})`,
        ).toBeGreaterThan(0);

        warningFound = await payment.hasUnavailableItemsWarning();
        if (warningFound) {
          hitProductId = id;
          break;
        }
      }

      expect(
        hitProductId,
        `RESTRICTED 후보(${RESTRICTED_PRODUCT_IDS.join(", ")}) 중 unavailable 경고가 나오는 상품이 없습니다 — fixture 갱신 필요`,
      ).not.toBeNull();

      const proceedDisabled = await payment.isProceedDisabled();
      expect(
        proceedDisabled,
        `지역제한 경고가 있으면 Proceed 버튼은 disabled여야 합니다 (product ${hitProductId})`,
      ).toBe(true);
    },
  );

  test(
    "CMR-PAY-03: 동의 체크박스 해제 시 Proceed 버튼 disabled 회귀",
    { tag: "@feature:cmr.payments.entry" },
    async () => {
      const productId = PAYABLE_PRODUCT_IDS[0];
      await payment.setCurrency("KRW");
      await payment.openProductAndPurchase(productId);
      await payment.waitForOrderReviewLoaded();

      // 전제 확인: 결제 가능 상품이어야 함 (경고 없어야 시나리오 성립)
      const hasWarning = await payment.hasUnavailableItemsWarning();
      expect(
        hasWarning,
        `결제 가능 상품 ${productId}에 unavailable 경고가 있으면 체크박스 회귀 테스트가 성립하지 않음 — fixture PAYABLE_PRODUCT_IDS 갱신 필요`,
      ).toBe(false);

      // Step 1: 전체 동의 체크 → Proceed enabled 확인
      const { total } = await payment.checkAllAgreements();
      expect(total, "동의 체크박스가 렌더링되어야 합니다").toBeGreaterThan(0);
      await expect
        .poll(async () => await payment.isProceedDisabled(), {
          timeout: 5000,
          message: "전체 동의 체크 후 Proceed 버튼이 활성화되어야 합니다",
        })
        .toBe(false);

      // Step 2: 첫 번째 체크박스 해제 → Proceed disabled 확인
      const uncheckedOk = await payment.uncheckAgreementAt(0);
      expect(uncheckedOk, "첫 번째 체크박스가 해제되어야 합니다").toBe(true);
      await expect
        .poll(async () => await payment.isProceedDisabled(), {
          timeout: 5000,
          message: "동의 1개 해제 시 Proceed 버튼은 비활성화되어야 합니다",
        })
        .toBe(true);

      // Step 3: 다시 전체 체크 → Proceed enabled 복귀 확인
      await payment.checkAllAgreements();
      await expect
        .poll(async () => await payment.isProceedDisabled(), {
          timeout: 5000,
          message: "체크 복구 시 Proceed 버튼이 재활성화되어야 합니다",
        })
        .toBe(false);
    },
  );

  test(
    "CMR-PAY-01-CARD: Visa 카드 정보 입력 완료까지 도달 (submit 직전)",
    { tag: "@feature:cmr.payments.toss.card" },
    async () => {
      const productId = PAYABLE_PRODUCT_IDS[0];
      await payment.setCurrency("KRW");
      await payment.openProductAndPurchase(productId);
      await payment.waitForOrderReviewLoaded();

      const hasWarning = await payment.hasUnavailableItemsWarning();
      expect(
        hasWarning,
        `결제 가능 상품 ${productId}에 unavailable 경고가 있으면 카드 결제 테스트가 성립하지 않음`,
      ).toBe(false);

      const { total } = await payment.checkAllAgreements();
      expect(total, "동의 체크박스가 렌더링되어야 합니다").toBeGreaterThan(0);

      // 1차 Proceed → Toss widget + TOSSPAY 모달 로드 + make_order 200 검증
      const entry = await payment.startTossEntry();
      expect(
        entry.makeOrder.status,
        `1차 make_order 응답은 2xx여야 합니다 (실제 ${entry.makeOrder.status})`,
      ).toBeGreaterThanOrEqual(200);
      expect(entry.makeOrder.status).toBeLessThan(400);
      expect(
        entry.hasWidget,
        "Proceed 이후 payment-widget iframe이 로드되어야 합니다",
      ).toBe(true);

      // TOSSPAY 기본 모달 닫기 (payment-gateway iframe 제거)
      const closed = await payment.closeTosspayOverlay();
      expect(closed, "TOSSPAY payment-gateway 모달이 닫혀야 합니다").toBe(true);

      // widget에서 "신용·체크카드" 선택 → 카드사 select 등장
      await payment.selectPaymentMethod("card");
      await payment.selectCardIssuer("VISA");

      // 2차 Proceed → 카드 입력 iframe 로드 + make_order 200 재확인
      const makeOrder2 = payment.captureMakeOrder();
      await payment.proceedButton().click();
      const order2 = await makeOrder2;
      expect(
        order2.status,
        `2차 make_order 응답은 2xx여야 합니다 (실제 ${order2.status})`,
      ).toBeGreaterThanOrEqual(200);
      expect(order2.status).toBeLessThan(400);

      await payment.waitForCardPaymentFrame();

      // Visa 4242 + 유효기간 + 이메일 + 약관 체크
      await payment.fillCardNumber(TOSS_TEST_CARDS.visa.number);
      await payment.fillCardExpiry("12/30");
      await payment.fillCardEmail("qa-e2e@makestar.test");
      await payment.checkAllCardAgreements();

      // 최종 Pay 버튼이 enabled여야 함 — submit은 SUBMIT 테스트에서 수행
      const cardFrame = payment.cardPaymentFrame();
      expect(cardFrame, "카드 입력 iframe이 있어야 합니다").not.toBeNull();
      const payBtn = cardFrame!.locator('button[aria-label^="Next-"]').first();
      await expect(
        payBtn,
        "Next-VISA Pay 버튼이 카드 정보 입력 후 활성화되어야 합니다",
      ).toBeEnabled({ timeout: 5000 });
    },
  );

  test(
    "CMR-PAY-01-CARD-SUBMIT: Visa 결제 승인 후 orderId/paymentKey/amount 확인",
    { tag: "@feature:cmr.payments.toss.card.submit" },
    async () => {
      const productId = PAYABLE_PRODUCT_IDS[0];
      await payment.setCurrency("KRW");
      await payment.openProductAndPurchase(productId);
      await payment.waitForOrderReviewLoaded();

      expect(
        await payment.hasUnavailableItemsWarning(),
        `결제 가능 상품 ${productId}에 unavailable 경고가 있으면 승인 테스트가 성립하지 않음`,
      ).toBe(false);

      await payment.checkAllAgreements();

      // 주문 총액을 Proceed 클릭 전에 캡처 — processing URL의 amount와 비교용.
      // 하드코딩(6000) 대신 주문서 실제 금액을 기준으로 해 상품 가격/수량 변동에 robust.
      const expectedAmount = await payment.getTotalAmountKrw();
      expect(
        expectedAmount,
        `주문 총액을 KRW로 파싱해야 합니다. Proceed 버튼 텍스트: ${await payment.getTotalAmountText()}`,
      ).not.toBeNull();
      expect(
        expectedAmount!,
        "주문 총액은 0원보다 커야 합니다",
      ).toBeGreaterThan(0);

      const entry = await payment.startTossEntry();
      expect(entry.makeOrder.status).toBeGreaterThanOrEqual(200);
      expect(entry.makeOrder.status).toBeLessThan(400);

      expect(await payment.closeTosspayOverlay()).toBe(true);
      await payment.selectPaymentMethod("card");
      await payment.selectCardIssuer("VISA");

      const makeOrder2 = payment.captureMakeOrder();
      await payment.proceedButton().click();
      const order2 = await makeOrder2;
      expect(order2.status).toBeGreaterThanOrEqual(200);
      expect(order2.status).toBeLessThan(400);

      await payment.waitForCardPaymentFrame();
      await payment.fillCardNumber(TOSS_TEST_CARDS.visa.number);
      await payment.fillCardExpiry("12/30");
      await payment.fillCardEmail("qa-e2e@makestar.test");
      await payment.checkAllCardAgreements();

      // 승인 API 응답 + processing 페이지 GET 요청을 병렬 대기하고 Pay 클릭.
      // Makestar가 processing 페이지 로드 후 URL 파라미터를 제거하는 내부 리다이렉트를
      // 수행하므로 `page.url()`로는 orderId/paymentKey를 놓친다 → waitForRequest로
      // 네트워크 레벨에서 원본 URL을 캡처한다.
      const confirmResponse = payment.page.waitForResponse(
        (r) =>
          /card-authentication\/[A-Z_]+\/confirm/.test(r.url()) &&
          r.request().method() === "POST",
        { timeout: 20000 },
      );
      const processingRequest = payment.page.waitForRequest(
        (r) =>
          /\/payments\/toss\/processing/.test(r.url()) && r.method() === "GET",
        { timeout: 25000 },
      );

      await payment.submitCardPayment();

      const confirmRes = await confirmResponse;
      expect(
        confirmRes.status(),
        `Toss 카드 승인 API(card-authentication/.../confirm)는 200이어야 합니다 (실제 ${confirmRes.status()})`,
      ).toBe(200);

      const req = await processingRequest;
      const url = new URL(req.url());
      const orderId = url.searchParams.get("orderId");
      const paymentKey = url.searchParams.get("paymentKey");
      const amount = url.searchParams.get("amount");
      // Makestar 주문번호 접두사는 CWEB/CRET 등 결제 경로에 따라 다르므로
      // 대문자 3~4자 + 숫자 구조로 관대하게 검증.
      expect(
        orderId,
        "processing URL에 orderId 파라미터가 있어야 합니다",
      ).toMatch(/^C[A-Z]{2,4}\d+$/);
      expect(
        paymentKey,
        "processing URL에 paymentKey 파라미터가 있어야 합니다",
      ).toBeTruthy();
      expect(
        Number(amount),
        `amount 파라미터는 주문 총액(${expectedAmount})과 일치해야 합니다`,
      ).toBe(expectedAmount);
    },
  );
});
