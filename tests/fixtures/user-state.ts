/**
 * user-state fixture — 공유 테스트 계정의 상태(배송지·통화·장바구니)를 한 줄로 강제 리셋.
 *
 * 배경: `feedback_auth_user_state_isolation` 메모리 — QA가 같은 계정으로 수동 탐색·시연한
 * 뒤 사용자 상태가 남아 자동화 결과를 오염시키는 사고가 반복. 이 fixture는 호출이 필요한
 * spec에서 명시적으로 호출하는 facade다(자동 beforeEach 부착 X — UI 기반은 5~15초 비용).
 *
 * 사용:
 * ```ts
 * import { test, expect } from "../fixtures/user-state";
 * test.beforeEach(async ({ resetUserState }) => {
 *   await resetUserState({ cart: true, currency: "KRW", address: "KR" });
 * });
 * ```
 *
 * 주의: 공유 계정에서 동시 워커가 같은 사용자 상태를 동시에 변경하면 race condition.
 * fixture 사용 spec은 가급적 `test.describe.configure({ mode: "serial" })` 권장.
 */

import { test as base, expect } from "@playwright/test";
import { MakestarMyPage } from "../pages/makestar-mypage.page";
import { MakestarPaymentPage } from "../pages/makestar-payment.page";

type Currency = "KRW" | "USD";
type ShippingCountry = "KR";

export type ResetOptions = {
  /** 장바구니 비우기 (현재 카트 페이지로 진입 → 전체 삭제) */
  cart?: boolean;
  /** 통화 강제 지정 (localStorage) */
  currency?: Currency;
  /** 기본 배송지 강제 지정 */
  address?: ShippingCountry;
};

type UserStateFixtures = {
  resetUserState: (opts: ResetOptions) => Promise<void>;
};

export const test = base.extend<UserStateFixtures>({
  resetUserState: async ({ page }, use) => {
    await use(async ({ cart, currency, address }: ResetOptions) => {
      // 순서 의도: 통화 → 배송지 → 카트.
      //  - 통화는 home 진입 + reload라 먼저 두고,
      //  - 배송지는 마이페이지 진입,
      //  - 카트는 마지막에 비워서 다음 결제 격리.
      if (currency) {
        const payment = new MakestarPaymentPage(page);
        await payment.setCurrency(currency);
      }
      if (address) {
        const mypage = new MakestarMyPage(page);
        await mypage.setDefaultShippingAddress(address);
      }
      if (cart) {
        const payment = new MakestarPaymentPage(page);
        await payment.clearCart();
      }
    });
  },
});

export { expect };
