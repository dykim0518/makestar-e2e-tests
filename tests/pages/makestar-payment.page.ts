/**
 * MakestarPaymentPage - Makestar 결제 페이지 (/payments) 페이지 객체
 *
 * 책임:
 *  - 상품 상세 → 결제 페이지 진입 플로우
 *  - 결제 페이지 내 동의 체크박스 · 금액 · 지역제한 경고 제어
 *  - Toss Payment Widget iframe 접근 및 결제수단 선택 (Phase 1.5+)
 *  - make_order 네트워크 응답 캡처
 *
 * 조사 결과 기반: scripts/inspect-cmr-payment{-deep,-card}.ts (2026-04-20)
 */

import { Page, Frame, Locator, Response } from "@playwright/test";
import { BasePage } from "./base.page";
import {
  PAYMENT_API_PATTERNS,
  TOSS_IDENTIFIERS,
} from "../fixtures/cmr-payment";

type Currency = "KRW" | "USD";

export type MakeOrderResponse = {
  status: number;
  body: string;
  requestId?: string;
};

export class MakestarPaymentPage extends BasePage {
  readonly baseUrl: string;

  constructor(page: Page, baseUrl = "https://stage-new.makeuni2026.com") {
    super(page);
    this.baseUrl = baseUrl;
  }

  // --------------------------------------------------------------------------
  // 통화 / 초기화
  // --------------------------------------------------------------------------

  /** Home 진입 후 통화 localStorage에 저장하고 reload. Proceed/금액 단위에 영향. */
  async setCurrency(currency: Currency): Promise<void> {
    await this._page.goto(this.baseUrl, { waitUntil: "domcontentloaded" });
    await this._page.evaluate(
      (value) => localStorage.setItem("currency", value),
      currency.toLowerCase(),
    );
    await this._page.reload({ waitUntil: "domcontentloaded" });
    await this._page
      .waitForLoadState("networkidle", { timeout: this.timeouts.long })
      .catch(() => {});
  }

  /** 현재 통화 반환 (localStorage) */
  async getCurrency(): Promise<string | null> {
    return this._page.evaluate(() => localStorage.getItem("currency"));
  }

  // --------------------------------------------------------------------------
  // 진입 플로우
  // --------------------------------------------------------------------------

  /**
   * 상품 상세 페이지 진입 후 옵션 선택 + Purchase 클릭 → /payments 이동까지.
   * 옵션이 필요한 상품은 첫 번째 옵션 자동 선택.
   */
  async openProductAndPurchase(productId: number | string): Promise<void> {
    await this._page.goto(`${this.baseUrl}/product/${productId}`, {
      waitUntil: "domcontentloaded",
    });
    await this._page
      .waitForLoadState("networkidle", { timeout: this.timeouts.long })
      .catch(() => {});

    await this._selectFirstOptionIfNeeded();

    const purchase = this._page.locator('button:has-text("Purchase")').first();
    await purchase.waitFor({ state: "visible", timeout: this.timeouts.long });
    const enabled = await purchase.isEnabled().catch(() => false);
    if (!enabled) {
      throw new Error(
        `Purchase 버튼이 활성화되지 않음 (상품 ${productId}). 옵션 선택 실패 또는 재고 소진일 수 있음.`,
      );
    }
    await purchase.click();
    await this._page.waitForURL(/\/payments/, {
      timeout: this.timeouts.navigation,
    });
  }

  /** 바로 /payments 경로로 이동 — 이미 카트에 상품이 있을 때만 사용 */
  async gotoPayments(): Promise<void> {
    await this._page.goto(`${this.baseUrl}/payments`, {
      waitUntil: "domcontentloaded",
    });
  }

  private async _selectFirstOptionIfNeeded(): Promise<boolean> {
    const triggers = [
      "select",
      '[role="combobox"]',
      '[class*="option"] button',
      '[class*="Option"] button',
    ];
    for (const sel of triggers) {
      const loc = this._page.locator(sel).first();
      if ((await loc.count()) === 0) continue;
      await loc.click({ timeout: this.timeouts.short }).catch(() => {});
      const option = this._page
        .locator('[role="option"], li[data-value], .option-item, option')
        .nth(1);
      if ((await option.count()) > 0) {
        await option.click({ timeout: this.timeouts.short }).catch(() => {});
        return true;
      }
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // 결제 페이지 — 스켈레톤 해제 / 금액 / 경고
  // --------------------------------------------------------------------------

  /** React 스켈레톤이 해제되어 Proceed 버튼이 visible 상태가 될 때까지 대기 */
  async waitForOrderReviewLoaded(timeout = 30000): Promise<void> {
    await this._page
      .locator('button:has-text("Proceed to Payment")')
      .first()
      .waitFor({ state: "visible", timeout });
  }

  /** 메인 Proceed 버튼 Locator (last = 화면 하단 최종 버튼) */
  proceedButton(): Locator {
    return this._page.locator('button:has-text("Proceed to Payment")').last();
  }

  /**
   * "There are items unavailable for purchase" 경고 노출 여부.
   * 경고는 order_information API 응답 후 비동기로 렌더링되므로
   * 짧은 polling(기본 3초)으로 안정화.
   */
  async hasUnavailableItemsWarning(timeoutMs = 3000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const has = await this._page.evaluate(() =>
        /items unavailable for purchase|cannot be purchased/i.test(
          document.body.innerText || "",
        ),
      );
      if (has) return true;
      await new Promise((r) => setTimeout(r, 300));
    }
    return false;
  }

  /** Proceed 버튼 disabled 여부 (둘 다 disabled이면 true) */
  async isProceedDisabled(): Promise<boolean> {
    return this._page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll("button")).filter((b) =>
        /Proceed to Payment/i.test(b.textContent || ""),
      ) as HTMLButtonElement[];
      if (btns.length === 0) return true;
      return btns.every((b) => b.disabled);
    });
  }

  /** 결제 금액 원문 텍스트 (예: "₩ 19,560", "$ 1.59") */
  async getTotalAmountText(): Promise<string | null> {
    return this._page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /Proceed to Payment/i.test(b.textContent || ""),
      );
      return btn ? (btn.textContent || "").trim() : null;
    });
  }

  // --------------------------------------------------------------------------
  // 동의 체크박스
  // --------------------------------------------------------------------------

  async getAgreementCount(): Promise<number> {
    return this._page.evaluate(
      () => document.querySelectorAll('input[type="checkbox"]').length,
    );
  }

  /**
   * 전체 동의 체크박스를 체크 상태로 맞춘다.
   * 반환: 전체 체크박스 수(total), 이번 호출로 토글한 개수(toggled).
   * 체크박스가 이미 모두 체크되어 있어도 total > 0 이면 정상.
   */
  async checkAllAgreements(): Promise<{ total: number; toggled: number }> {
    return this._page.evaluate(() => {
      const cbs = Array.from(
        document.querySelectorAll('input[type="checkbox"]'),
      ) as HTMLInputElement[];
      let toggled = 0;
      cbs.forEach((cb) => {
        if (!cb.checked) {
          cb.click();
          toggled += 1;
        }
      });
      return { total: cbs.length, toggled };
    });
  }

  /** 지정 인덱스 체크박스 해제 (Proceed disabled 회귀 테스트용) */
  async uncheckAgreementAt(index: number): Promise<boolean> {
    return this._page.evaluate((i) => {
      const cbs = Array.from(
        document.querySelectorAll('input[type="checkbox"]'),
      ) as HTMLInputElement[];
      const target = cbs[i];
      if (!target) return false;
      if (target.checked) target.click();
      return !target.checked;
    }, index);
  }

  // --------------------------------------------------------------------------
  // Toss Payment Widget iframe — Phase 1.5+ (카드 결제 구현 시 사용)
  // --------------------------------------------------------------------------

  /** payment-widget iframe Frame 객체 (Proceed 클릭 후 로드됨) */
  paymentWidgetFrame(): Frame | null {
    return (
      this._page
        .frames()
        .find((f) => f.url().includes(TOSS_IDENTIFIERS.widgetHost)) ?? null
    );
  }

  /** payment-gateway(토스페이 기본) iframe — 카드 선택 전 닫아야 할 대상 */
  paymentGatewayFrame(): Frame | null {
    return (
      this._page
        .frames()
        .find((f) => f.url().includes(TOSS_IDENTIFIERS.gatewayHost)) ?? null
    );
  }

  /**
   * Proceed 클릭 후 payment-widget iframe 등장까지 대기.
   * Makestar가 make_order + requestPayment를 동시에 호출하는 구조.
   */
  async waitForTossWidget(timeout = 20000): Promise<void> {
    await this._page.waitForFunction(
      (host) =>
        Array.from(document.querySelectorAll("iframe")).some((f) =>
          f.src.includes(host),
        ),
      TOSS_IDENTIFIERS.widgetHost,
      { timeout },
    );
  }

  /**
   * Proceed 이후 Toss 진입이 시작됐는지 확인.
   * payment-widget 또는 payment-gateway 중 하나만 떠도 진입으로 본다.
   */
  async waitForTossEntry(timeout = 20000): Promise<{
    hasWidget: boolean;
    hasGateway: boolean;
  }> {
    await this._page.waitForFunction(
      ([widgetHost, gatewayHost]) =>
        Array.from(document.querySelectorAll("iframe")).some(
          (iframe) =>
            iframe.src.includes(widgetHost) || iframe.src.includes(gatewayHost),
        ),
      [TOSS_IDENTIFIERS.widgetHost, TOSS_IDENTIFIERS.gatewayHost],
      { timeout },
    );

    return {
      hasWidget: this.paymentWidgetFrame() !== null,
      hasGateway: this.paymentGatewayFrame() !== null,
    };
  }

  /**
   * Proceed 클릭 후 make_order 응답과 Toss 진입 상태를 함께 반환.
   */
  async startTossEntry(timeout = 30000): Promise<{
    makeOrder: MakeOrderResponse;
    hasWidget: boolean;
    hasGateway: boolean;
  }> {
    const makeOrderPromise = this.captureMakeOrder(timeout);
    await this.proceedButton().click();
    const entry = await this.waitForTossEntry(timeout);

    return {
      makeOrder: await makeOrderPromise,
      ...entry,
    };
  }

  // --------------------------------------------------------------------------
  // Toss Widget 내 결제수단/카드사 선택
  // --------------------------------------------------------------------------

  /**
   * TOSSPAY 기본 모달 닫기 — "인증 취소" 버튼 클릭으로 payment-gateway iframe 제거.
   * Makestar가 Proceed 시 토스페이를 자동 호출하므로, 카드 결제 전 반드시 닫아야 함.
   *
   * payment-gateway iframe은 프록시드 Next.js 페이지라 내부 버튼 렌더링에 시간이 걸림 →
   * "인증 취소" 버튼 visible 될 때까지 대기 후 클릭.
   */
  async closeTosspayOverlay(timeout = 5000): Promise<boolean> {
    // 1) gateway iframe 등장을 짧게 대기 (optional).
    //    Toss는 Proceed 시점에 iframe을 먼저 만들고 URL을 주입하는 2-step 구조라,
    //    src가 host 매칭될 때까지만 기다린다. flaky하게 src가 안 주입되면 스킵.
    const gatewayLoaded = await this._page
      .waitForFunction(
        (host) =>
          Array.from(document.querySelectorAll("iframe")).some((f) =>
            f.src.includes(host),
          ),
        TOSS_IDENTIFIERS.gatewayHost,
        { timeout },
      )
      .then(() => true)
      .catch(() => false);

    // gateway 자체가 안 떴거나 about:blank로만 머무는 경우 → 닫을 모달이 없으니 통과.
    if (!gatewayLoaded) return true;
    const pg = this.paymentGatewayFrame();
    if (!pg) return true;

    const cancelBtn = pg.locator('button[aria-label="인증 취소"]').first();
    const appeared = await cancelBtn
      .waitFor({ state: "visible", timeout })
      .then(() => true)
      .catch(() => false);
    // 버튼이 안 보이면 모달 자체가 이미 해제된 상태로 간주.
    if (!appeared) return true;

    await cancelBtn.click({ force: true, timeout: this.timeouts.short });
    await this._page
      .waitForFunction(
        (host) =>
          !Array.from(document.querySelectorAll("iframe")).some((f) =>
            f.src.includes(host),
          ),
        TOSS_IDENTIFIERS.gatewayHost,
        { timeout },
      )
      .catch(() => {});
    return this.paymentGatewayFrame() === null;
  }

  /**
   * payment-widget iframe에서 결제수단 선택.
   * 확인된 aria-label 접두사: "신용·체크카드", "가상계좌", "퀵계좌이체", "휴대폰"
   */
  async selectPaymentMethod(
    method: "card" | "virtual" | "transfer" | "phone",
  ): Promise<void> {
    const pw = this.paymentWidgetFrame();
    if (!pw)
      throw new Error("payment-widget iframe 없음 — Proceed 먼저 클릭 필요");
    const ariaPrefix = {
      card: "신용·체크카드",
      virtual: "가상계좌",
      transfer: "퀵계좌이체",
      phone: "휴대폰",
    }[method];
    // widget 내부 UI가 결제수단 버튼을 렌더링할 때까지 먼저 대기
    await pw
      .locator(`button[aria-label^="${ariaPrefix}"]`)
      .first()
      .waitFor({ state: "visible", timeout: this.timeouts.long });
    await pw
      .locator(`button[aria-label^="${ariaPrefix}"]`)
      .first()
      .click({ force: true, timeout: this.timeouts.medium });
    // 선택 상태로 UI가 리렌더링될 때까지 대기 (카드면 아래 카드사 select 등장)
    await pw
      .locator(`button[aria-label="${ariaPrefix} 결제 수단 선택됨"]`)
      .waitFor({ state: "visible", timeout: this.timeouts.medium })
      .catch(() => {});
  }

  /** payment-widget iframe의 native <select>에서 카드사(해외카드) 선택 */
  async selectCardIssuer(
    label: "VISA" | "MASTER" | "UNIONPAY" | "JCB",
  ): Promise<void> {
    const pw = this.paymentWidgetFrame();
    if (!pw) throw new Error("payment-widget iframe 없음");
    const selectLoc = pw.locator("select").first();
    // 카드 수단 선택 후 <select>가 DOM에 붙기까지 대기
    await selectLoc.waitFor({
      state: "attached",
      timeout: this.timeouts.medium,
    });
    await selectLoc.selectOption({ label }, { timeout: this.timeouts.medium });
  }

  // --------------------------------------------------------------------------
  // 카드 입력 iframe (payment-gateway-sandbox/pc/payment-method/card/option)
  // --------------------------------------------------------------------------

  /** 카드 입력 iframe Frame 객체 (2차 Proceed 후 로드됨) */
  cardPaymentFrame(): Frame | null {
    return (
      this._page
        .frames()
        .find((f) => /\/pc\/payment-method\/card\/option/.test(f.url())) ?? null
    );
  }

  /** 카드 입력 iframe 등장 대기 (2차 Proceed 이후) */
  async waitForCardPaymentFrame(timeout = 20000): Promise<void> {
    await this._page.waitForFunction(
      () =>
        Array.from(document.querySelectorAll("iframe")).some((f) =>
          /\/pc\/payment-method\/card\/option/.test(f.src),
        ),
      undefined,
      { timeout },
    );
  }

  /** 카드번호 16자리 — Toss는 4분할 input 사용 */
  async fillCardNumber(cardNumber16: string): Promise<void> {
    const f = this.cardPaymentFrame();
    if (!f) throw new Error("card iframe 없음 — 2차 Proceed 후 사용");
    const digits = cardNumber16.replace(/\D/g, "");
    if (digits.length !== 16) {
      throw new Error(`카드번호는 16자리여야 합니다 (입력: ${digits.length})`);
    }
    await f.locator('input[name="cardNumber.0"]').fill(digits.slice(0, 4));
    await f.locator('input[name="cardNumber.1"]').fill(digits.slice(4, 8));
    await f.locator('input[name="cardNumber.2"]').fill(digits.slice(8, 12));
    await f.locator('input[name="cardNumber.3"]').fill(digits.slice(12, 16));
  }

  /** 유효기간 (MM/YY 포맷, 예: "12/30") */
  async fillCardExpiry(mmYy: string): Promise<void> {
    const f = this.cardPaymentFrame();
    if (!f) throw new Error("card iframe 없음");
    await f.locator('input[name="cardExpiry"]').fill(mmYy);
  }

  /** 영수증 이메일 */
  async fillCardEmail(email: string): Promise<void> {
    const f = this.cardPaymentFrame();
    if (!f) throw new Error("card iframe 없음");
    await f.locator('input[name="email"]').fill(email);
  }

  /** 카드 iframe 내 약관 체크박스 전체 체크 */
  async checkAllCardAgreements(): Promise<{ total: number; toggled: number }> {
    const f = this.cardPaymentFrame();
    if (!f) throw new Error("card iframe 없음");
    return f.evaluate(() => {
      const cbs = Array.from(
        document.querySelectorAll('input[type="checkbox"]'),
      ) as HTMLInputElement[];
      let toggled = 0;
      cbs.forEach((cb) => {
        if (!cb.checked) {
          cb.click();
          toggled += 1;
        }
      });
      return { total: cbs.length, toggled };
    });
  }

  /** 최종 결제 버튼 ("Next-VISA Pay" 등 브랜드 종속 aria-label) 클릭 */
  async submitCardPayment(): Promise<void> {
    const f = this.cardPaymentFrame();
    if (!f) throw new Error("card iframe 없음");
    await f
      .locator('button[aria-label^="Next-"]')
      .first()
      .click({ force: true, timeout: this.timeouts.medium });
  }

  // --------------------------------------------------------------------------
  // 네트워크 — make_order 응답 캡처
  // --------------------------------------------------------------------------

  /**
   * make_order 응답 1건을 수집하는 waiter 반환.
   * 사용 예:
   *   const makeOrder = payment.captureMakeOrder();
   *   await payment.proceedButton().click();
   *   const result = await makeOrder;
   */
  captureMakeOrder(timeout = 30000): Promise<MakeOrderResponse> {
    return this._page
      .waitForResponse(
        (resp) => PAYMENT_API_PATTERNS.makeOrder.test(resp.url()),
        { timeout },
      )
      .then(async (resp: Response) => {
        const body = await resp.text().catch(() => "");
        return {
          status: resp.status(),
          body,
          requestId: this._extractRequestId(body),
        };
      });
  }

  private _extractRequestId(body: string): string | undefined {
    const m = body.match(/"request_id"\s*:\s*"([^"]+)"/);
    return m?.[1];
  }
}
