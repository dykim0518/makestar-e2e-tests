/**
 * CMR 결제 테스트 상수
 *
 * 출처:
 *  - Toss 테스트 카드: Makestar Notion "결제 테스트" 문서
 *  - 상품 ID: scripts/inspect-cmr-payment-scan.ts 로 확보 (2026-04-20)
 *
 * 상품 ID 갱신 절차:
 *  AUTH_FILE=./auth.json npx tsx scripts/inspect-cmr-payment-scan.ts
 */

export type TestCard = {
  number: string;
  brand: "Visa" | "Master" | "JCB";
};

export const TOSS_TEST_CARDS = {
  visa: { number: "4242424242424242", brand: "Visa" },
  master: { number: "5555555555554444", brand: "Master" },
  jcb: { number: "3530111333300000", brand: "JCB" },
} as const satisfies Record<string, TestCard>;

/**
 * 결제 완주 가능한 stage 상품 (지역 제한 없음).
 * 첫 번째 항목이 우선 사용되며, 재고 소진 시 다음 후보로 fallback 권장.
 *
 * 최근 확인(2026-04-20):
 *  - 16006 "결제 테스트 자동화 상품" — QA팀 생성 테스트 전용. 재고/가격/판매기간 안정. [최우선]
 *    옵션 선택 UX가 있으나 기본 변형이 자동 선택되어 Purchase 즉시 enabled.
 *  - 15966 — 옵션 없는 단일 상품. 일반 상품이라 운영 변동 가능.
 *  - 15964 — make_order 누적 후 간헐적 disabled 보고됨, 마지막 fallback.
 */
export const PAYABLE_PRODUCT_IDS = [16006, 15966, 15964] as const;

/** "지역/국가 제한" 회귀 검증용 상품 */
export const RESTRICTED_PRODUCT_IDS = [15980, 15979, 15978] as const;

/** 필수 동의 체크박스 개수 (order review 기준) */
export const REQUIRED_AGREEMENT_COUNT = 6;

/** /payments API 엔드포인트 패턴 */
export const PAYMENT_API_PATTERNS = {
  makeOrder: /\/commerce\/order\/make_order\//,
  orderInfo: /\/commerce\/order\/get_order_information\//,
  shippingFee: /\/commerce\/order\/calculate_shipping_fee\//,
} as const;

/** Toss Widget 식별자 */
export const TOSS_IDENTIFIERS = {
  widgetHost: "payment-widget.tosspayments.com",
  gatewayHost: "payment-gateway-sandbox.tosspayments.com",
  sdkUrl: "https://js.tosspayments.com/v2/standard",
  variantKey: "Commerce-krw-b2c-t",
} as const;
