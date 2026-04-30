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
   *
   * 데스크톱: 페이지 본체 옵션 select → Purchase 클릭 → 즉시 `/payments` 이동.
   * 모바일: Purchase 클릭이 "Select option" 바텀시트를 띄우는 분기 — 모달 내부의
   * Purchase를 다시 눌러야 `/payments`로 진행한다. 첫 클릭 후 짧게 URL 진입을
   * 기다려 보고 미진입이면 모달 처리로 fall-through.
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

    // 데스크톱은 클릭 즉시 /payments로 이동(보통 1초 미만). 5초 timeout으로 우선권을 주고,
    // 진입 못 하면 모바일 옵션 모달이 떴다고 보고 fallback. race로 두면 데스크톱에서도
    // 페이지 어딘가의 "Select option"-유사 텍스트가 잠깐 visible해지는 순간 false-positive로
    // 모달 분기에 빠질 수 있어, deterministic한 timeout-fallback 패턴을 사용한다.
    const directNav = await this._page
      .waitForURL(/\/payments/, {
        timeout: this.timeouts.medium,
        waitUntil: "commit",
      })
      .then(() => true)
      .catch(() => false);
    if (directNav) return;

    await this._confirmOptionModalPurchase(productId);
    await this._page.waitForURL(/\/payments/, {
      timeout: this.timeouts.navigation,
      waitUntil: "commit",
    });
  }

  /**
   * "Select option" 바텀시트가 열린 상태에서 모달 내부 Purchase를 클릭한다.
   * 모달은 페이지 본체 Purchase 버튼과 동일 텍스트의 버튼을 가지므로 last()로 잡는다.
   */
  private async _confirmOptionModalPurchase(
    productId: number | string,
  ): Promise<void> {
    const modalHeader = this._page.getByText(/Select option/i).first();
    const headerVisible = await modalHeader
      .waitFor({ state: "visible", timeout: this.timeouts.medium })
      .then(() => true)
      .catch(() => false);
    if (!headerVisible) {
      throw new Error(
        `Purchase 클릭 후 /payments 진입에 실패했고 옵션 모달도 감지되지 않음 (상품 ${productId}).`,
      );
    }
    const modalPurchase = this._page
      .locator('button:has-text("Purchase")')
      .last();
    await modalPurchase.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
    await modalPurchase.click({ timeout: this.timeouts.medium });
  }

  /** 바로 /payments 경로로 이동 — 이미 카트에 상품이 있을 때만 사용 */
  async gotoPayments(): Promise<void> {
    await this._page.goto(`${this.baseUrl}/payments`, {
      waitUntil: "domcontentloaded",
    });
  }

  /**
   * 장바구니를 비운다. 각 결제 테스트가 격리되도록 beforeEach에서 호출.
   *
   * Purchase 버튼은 장바구니 전체를 order-review로 싣는 플로우이므로, 이전 테스트가
   * 장바구니를 남긴 채 종료하면 amount가 누적되어 결제 금액 검증이 실패한다.
   * 병렬 워커가 같은 세션을 공유하는 구조라 테스트 간 고립을 스크립트에서 보장해야 한다.
   *
   * `/cart` 페이지에서 체크박스 전체 선택 → Delete → 모달 확인의 흐름. 삭제가 안 되면 throw.
   */
  async clearCart(maxAttempts = 3): Promise<void> {
    await this._page.goto(`${this.baseUrl}/cart`, {
      waitUntil: "domcontentloaded",
    });
    await this._page
      .waitForLoadState("networkidle", { timeout: this.timeouts.long })
      .catch(() => {});

    const isEmpty = async (): Promise<boolean> => {
      return this._page.evaluate(() => {
        const hasEmptyIndicator = /cart is empty|장바구니.*비어|no items/i.test(
          document.body.innerText || "",
        );
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        return hasEmptyIndicator || checkboxes.length === 0;
      });
    };

    if (await isEmpty()) return;

    const checkbox = this._page.locator('input[type="checkbox"]').first();
    const deleteBtn = this._page.locator('button:has-text("Delete")');

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (await isEmpty()) return;

      if ((await checkbox.count()) > 0) {
        await checkbox
          .check({ force: true, timeout: this.timeouts.short })
          .catch(() => {});
      }

      if (
        (await deleteBtn.first().count()) > 0 &&
        (await deleteBtn
          .first()
          .isVisible()
          .catch(() => false))
      ) {
        await deleteBtn
          .first()
          .click({ timeout: this.timeouts.short })
          .catch(() => {});
        await this._page
          .waitForLoadState("networkidle", { timeout: this.timeouts.medium })
          .catch(() => {});

        // 모달 내 확인 Delete 버튼 — 삭제 버튼이 2개 이상이면 마지막이 모달
        if ((await deleteBtn.count()) >= 2) {
          await deleteBtn
            .last()
            .click({ timeout: this.timeouts.short })
            .catch(() => {});
          await this._page
            .waitForLoadState("networkidle", { timeout: this.timeouts.medium })
            .catch(() => {});
        }
      }

      await this._page.reload({ waitUntil: "domcontentloaded" });
      await this._page
        .waitForLoadState("networkidle", { timeout: this.timeouts.medium })
        .catch(() => {});
    }

    if (!(await isEmpty())) {
      throw new Error(
        `clearCart 실패: ${maxAttempts}회 시도 후에도 장바구니가 비워지지 않았습니다. /cart 페이지 수동 확인 필요.`,
      );
    }
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

  /**
   * 주문 총액을 KRW 정수로 반환. `getTotalAmountText()` 문자열에서 ₩ 기호 뒤 숫자를 파싱.
   * USD 통화 상태이거나 파싱 실패 시 null.
   *
   * processing URL의 `amount` 파라미터와 비교해 장바구니 누적/상품 가격 변경을 감지하는 용도.
   */
  async getTotalAmountKrw(): Promise<number | null> {
    const text = await this.getTotalAmountText();
    if (!text) return null;
    const m = text.match(/[₩￦]\s*([\d,]+)/);
    if (!m) return null;
    const n = parseInt(m[1].replace(/,/g, ""), 10);
    return Number.isFinite(n) ? n : null;
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
  async closeTosspayOverlay(timeout = 10000): Promise<boolean> {
    // gateway iframe이 등장할 때까지 짧게 대기. 안 뜨면 닫을 모달이 없는 것으로 간주.
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
    if (!gatewayLoaded) return true;

    // TOSSPAY 모달 기본 탭이 "휴대폰번호"(인증 취소 버튼) / "QR코드"(닫기 X 아이콘)로
    // 랜덤하게 뜨므로 두 변형을 모두 시도하고 pay.toss.im 중첩 iframe까지 탐색한다.
    const closeSelectors = [
      'button[aria-label="인증 취소"]',
      'button[aria-label="닫기"]',
      'button[aria-label*="close" i]',
    ];

    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      // pg iframe src가 순간적으로 host를 미포함한 값으로 바뀌는 false-positive가 있어,
      // 500ms 후 재확인해 연속 미존재일 때만 제거 판정.
      if (this.paymentGatewayFrame() === null) {
        await this._page.waitForTimeout(500);
        if (this.paymentGatewayFrame() === null) return true;
      }

      const frames = [
        this.paymentGatewayFrame(),
        ...this._page.frames().filter((f) => f.url().includes("pay.toss.im")),
      ].filter((f): f is Frame => f !== null);

      let clicked = false;
      for (const f of frames) {
        for (const sel of closeSelectors) {
          const btn = f.locator(sel).first();
          if (
            (await btn.count().catch(() => 0)) > 0 &&
            (await btn.isVisible().catch(() => false))
          ) {
            await btn
              .click({ force: true, timeout: this.timeouts.short })
              .catch(() => {});
            clicked = true;
            break;
          }
        }
        if (clicked) break;
      }
      if (!clicked) {
        await this._page.keyboard.press("Escape").catch(() => {});
      }

      await this._page.waitForTimeout(1000);
    }
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

    // TOSSPAY 기본 모달이 QR/휴대폰 탭 상태로 남아 widget 위 dimmed overlay를 덮는
    // 케이스가 있어 Playwright force click도 이벤트가 전달 안 될 수 있음.
    // widget iframe 내부에서 직접 DOM click()을 호출해 overlay를 우회.
    await pw.evaluate((prefix) => {
      const btn = document.querySelector(
        `button[aria-label^="${prefix}"]`,
      ) as HTMLButtonElement | null;
      if (btn) btn.click();
    }, ariaPrefix);

    if (method === "card") {
      // 카드사 <select>는 "카드사 선택" combobox가 열려야 DOM에 attach되는 케이스
      // (Radix-like UI)가 있어 combobox도 함께 JS click으로 토글.
      await pw.evaluate(() => {
        const cb = document.querySelector(
          '[role="combobox"]',
        ) as HTMLElement | null;
        if (cb) cb.click();
      });
      await pw
        .locator("select")
        .first()
        .waitFor({ state: "attached", timeout: this.timeouts.long });
    }
  }

  /** payment-widget iframe에서 카드사(해외카드) 선택 */
  async selectCardIssuer(
    label: "VISA" | "MASTER" | "UNIONPAY" | "JCB",
  ): Promise<void> {
    const pw = this.paymentWidgetFrame();
    if (!pw) throw new Error("payment-widget iframe 없음");

    // 2026-04 기준 Toss widget은 hidden 빈 <select> + Radix combobox/listbox 조합으로 렌더링된다.
    // native option이 있는 구버전 UI는 selectOption으로 처리하고, 현 UI는 role 기반으로 선택한다.
    const nativeSelect = pw.locator("select").first();
    if ((await nativeSelect.count().catch(() => 0)) > 0) {
      const optionCount = await nativeSelect
        .locator("option")
        .count()
        .catch(() => 0);
      if (optionCount > 0) {
        await nativeSelect.selectOption(
          { label },
          { timeout: this.timeouts.medium },
        );
        return;
      }
    }

    const issuerCombobox = pw
      .getByRole("combobox", { name: /카드사 선택/ })
      .first();
    await issuerCombobox.waitFor({
      state: "visible",
      timeout: this.timeouts.long,
    });

    if ((await issuerCombobox.getAttribute("aria-expanded")) !== "true") {
      await issuerCombobox.click({
        force: true,
        timeout: this.timeouts.short,
      });
    }

    const issuerOption = pw
      .getByRole("option", { name: label, exact: true })
      .first();
    await issuerOption.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
    await issuerOption.click({ force: true, timeout: this.timeouts.medium });

    await pw.waitForFunction(
      (selectedLabel) =>
        Array.from(document.querySelectorAll('[role="combobox"]')).some((el) =>
          (el.textContent || "").includes(selectedLabel),
        ),
      label,
      { timeout: this.timeouts.medium },
    );
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

  /**
   * 카드 입력 iframe 등장 대기 (2차 Proceed 이후).
   * Toss Widget은 iframe element의 src attribute를 유지한 채 JS navigation으로
   * 내용만 바꾸므로 page context의 `iframe.src` 체크는 miss한다 →
   * Playwright `frame.url()`로 직접 polling한다.
   */
  async waitForCardPaymentFrame(timeout = 20000): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const found = this._page
        .frames()
        .some((f) => /\/pc\/payment-method\/card\/option/.test(f.url()));
      if (found) return;
      await this._page.waitForTimeout(200);
    }
    const current = this._page
      .frames()
      .filter((f) => /tosspayments\.com|toss\.im/.test(f.url()))
      .map((f) => f.url().slice(0, 140))
      .join(" | ");
    throw new Error(
      `카드 입력 iframe 미발견 (${timeout}ms). 현재 Toss 프레임: ${current}`,
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

  /**
   * 카드 iframe 내 약관 체크박스 전체 체크.
   * DOM 레벨 `input.click()`만으론 Toss 폼의 React state가 갱신되지 않아 submit 시
   * "약관 미동의" 검증에 걸림 → Playwright `check({ force: true })`로 사용자 클릭 재현.
   */
  async checkAllCardAgreements(): Promise<{ total: number; toggled: number }> {
    const f = this.cardPaymentFrame();
    if (!f) throw new Error("card iframe 없음");
    const cbs = f.locator('input[type="checkbox"]');
    const total = await cbs.count();
    let toggled = 0;
    for (let i = 0; i < total; i++) {
      const cb = cbs.nth(i);
      if (!(await cb.isChecked().catch(() => false))) {
        await cb.check({ force: true, timeout: this.timeouts.short });
        toggled += 1;
      }
    }
    return { total, toggled };
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
