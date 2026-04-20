/**
 * Makestar CMR 결제 플로우 E2E 테스트 (Phase 1)
 *
 * 범위:
 *  - CMR-PAY-01: Proceed 클릭 시 Toss 진입 smoke + make_order 응답 확인
 *  - CMR-PAY-02: 지역제한 상품 unavailable 경고 + Proceed disabled
 *  - CMR-PAY-03: 동의 체크박스 해제 시 Proceed disabled 회귀
 *
 * Phase 2로 이관:
 *  - CMR-PAY-01-CARD (Visa 카드 결제 완주):
 *    구현은 가능했으나(scripts/inspect-cmr-payment-card-v2.ts에서 수동 성공 확인)
 *    spec 반복 실행 시 Makestar가 Proceed 시 자동 호출하는 TOSSPAY iframe이
 *    `about:blank` 상태로 멈추는 간헐적 Flaky 재현. Toss widget 리렌더링 미반영 →
 *    "신용·체크카드" 클릭 후 `<select>` 카드사 요소 DOM 미등장. 안정화 선행 필요.
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
});
