/**
 * Makestar CMR 결제 플로우 E2E 테스트
 *
 * Phase 1 (smoke/회귀):
 *  - CMR-PAY-01: Proceed 클릭 시 Toss 진입 smoke + make_order 응답 확인
 *  - CMR-PAY-02: 지역제한 상품 unavailable 경고 + Proceed disabled
 *  - CMR-PAY-03: 동의 체크박스 해제 시 Proceed disabled 회귀
 *
 * Phase 2 (카드 결제 완주):
 *  - CMR-PAY-01-CARD: Visa 카드 입력 완료까지 도달 — submit은 stage 부하 고려로 스킵,
 *    대신 Next-VISA Pay 버튼 enabled 상태로 validation 통과를 검증.
 *
 * 미래 확장:
 *  - 카드결제 success/fail callback 완결 검증 (request_id ↔ Admin 주문조회 연동)
 *  - Master/JCB 브랜드 파라미터 확장
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

test.describe("CMR 결제 회귀", () => {
  let payment: MakestarPaymentPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    payment = new MakestarPaymentPage(page, BASE_URL);
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
      expect(
        orderId,
        "processing URL에 orderId 파라미터가 있어야 합니다",
      ).toMatch(/^CWEB\d+/);
      expect(
        paymentKey,
        "processing URL에 paymentKey 파라미터가 있어야 합니다",
      ).toBeTruthy();
      expect(
        Number(amount),
        "amount 파라미터는 주문 총액(KRW 6,000)과 일치해야 합니다",
      ).toBe(6000);
    },
  );
});
