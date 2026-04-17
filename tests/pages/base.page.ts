/**
 * BasePage - 모든 페이지 객체의 기본 클래스
 *
 * 공통 기능:
 * - 페이지 네비게이션
 * - 모달/팝업 처리
 * - 요소 대기 및 검색
 * - 이미지 로딩 검증
 */

import { Page, Locator, expect } from "@playwright/test";

// ============================================================================
// 타입 정의
// ============================================================================

/** 타임아웃 설정 */
export type TimeoutConfig = {
  readonly micro: number;
  readonly short: number;
  readonly medium: number;
  readonly long: number;
  readonly navigation: number;
  readonly test: number;
};

/** 이미지 검증 결과 */
export type ImageVerificationResult = {
  total: number;
  broken: number;
  brokenSrcs: string[];
};

/** API 모니터링 결과 */
export type ApiMonitorResult = {
  url: string;
  status: number;
  duration: number;
  ok: boolean;
};

/** 요소 검색 결과 */
export type ElementSearchResult = {
  element: Locator;
  selector: string;
};

// ============================================================================
// 기본 타임아웃 상수
// ============================================================================

export const DEFAULT_TIMEOUTS: TimeoutConfig = {
  micro: 500,
  short: 2000,
  medium: 5000,
  long: 10000,
  navigation: 45000,
  test: 90000,
} as const;

// ============================================================================
// BasePage 클래스
// ============================================================================

export abstract class BasePage {
  protected readonly _page: Page;
  protected readonly timeouts: TimeoutConfig;

  /** 페이지 객체에 외부에서 접근 가능 (테스트용) */
  get page(): Page {
    return this._page;
  }

  constructor(page: Page, timeouts: TimeoutConfig = DEFAULT_TIMEOUTS) {
    this._page = page;
    this.timeouts = timeouts;
  }

  // --------------------------------------------------------------------------
  // 페이지 상태 확인
  // --------------------------------------------------------------------------

  /**
   * 페이지/브라우저가 닫혔는지 확인
   */
  isPageClosed(): boolean {
    try {
      // page.isClosed()가 true이면 닫힘
      return this._page.isClosed();
    } catch {
      return true;
    }
  }

  /**
   * 페이지가 유효한지 확인하고 아니면 에러 던지기
   */
  protected ensurePageOpen(): void {
    if (this.isPageClosed()) {
      throw new Error("Page is closed. Cannot perform navigation.");
    }
  }

  // --------------------------------------------------------------------------
  // 네비게이션
  // --------------------------------------------------------------------------

  /**
   * URL로 이동
   */
  async goto(
    url: string,
    options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle" },
  ): Promise<void> {
    this.ensurePageOpen();
    await this._page.goto(url, {
      waitUntil: options?.waitUntil ?? "domcontentloaded",
      timeout: this.timeouts.navigation,
    });
  }

  /**
   * 페이지 새로고침
   */
  async reload(): Promise<void> {
    await this._page.reload({
      waitUntil: "domcontentloaded",
      timeout: this.timeouts.navigation,
    });
  }

  /**
   * 현재 URL 반환
   */
  get currentUrl(): string {
    return this._page.url();
  }

  /**
   * 페이지 타이틀 반환
   */
  async getTitle(): Promise<string> {
    return await this._page.title();
  }

  // --------------------------------------------------------------------------
  // 요소 검색
  // --------------------------------------------------------------------------

  /**
   * 여러 셀렉터 중 첫 번째로 보이는 요소 찾기
   */
  async findVisibleElement(
    selectors: readonly string[],
    timeout: number = this.timeouts.short,
  ): Promise<ElementSearchResult | null> {
    for (const selector of selectors) {
      try {
        const element = this._page.locator(selector).first();
        if (await element.isVisible({ timeout })) {
          return { element, selector };
        }
      } catch {
        continue;
      }
    }
    return null;
  }

  /**
   * 여러 텍스트 중 첫 번째로 보이는 버튼 클릭
   */
  async clickFirstVisibleText(
    texts: readonly string[],
    timeout: number = this.timeouts.short,
  ): Promise<boolean> {
    for (const text of texts) {
      try {
        const btn = this._page.getByText(text, { exact: false }).first();
        if (await btn.isVisible({ timeout })) {
          await this.clickWithRecovery(btn, { timeout: this.timeouts.medium });
          // 클릭 후 버튼(모달)이 사라질 때까지 조건부 대기
          await btn
            .waitFor({ state: "hidden", timeout: this.timeouts.short })
            .catch(() => {});
          console.log(`✅ "${text}" 버튼 클릭`);
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  }

  /**
   * Escape 키를 지정된 횟수만큼 눌러 드롭다운/모달/포커스 상태를 정리
   */
  protected async pressEscape(times: number = 1): Promise<void> {
    for (let i = 0; i < times; i += 1) {
      await this._page.keyboard.press("Escape").catch(() => {});
    }
  }

  /**
   * 짧은 UI 흔들림이 잦은 admin 화면에서 클릭 전후의 인터랙티브 상태를 정리
   */
  protected async settleInteractiveUi(options: {
    escapeCount?: number;
    timeout?: number;
    stableTime?: number;
  } = {}): Promise<void> {
    const {
      escapeCount = 0,
      timeout = this.timeouts.short,
      stableTime = 150,
    } = options;

    if (escapeCount > 0) {
      await this.pressEscape(escapeCount);
    }

    await this.waitForContentStable("body", {
      timeout,
      stableTime,
    }).catch(() => {});
  }

  /**
   * 드롭다운/오버레이에 가려지기 쉬운 버튼 클릭을 재시도 포함해서 안정화
   */
  protected async clickWithRecovery(
    locator: Locator,
    options: {
      timeout?: number;
      escapeCount?: number;
      settleTimeout?: number;
      settleStableTime?: number;
    } = {},
  ): Promise<void> {
    const {
      timeout = this.timeouts.medium,
      escapeCount = 0,
      settleTimeout = this.timeouts.short,
      settleStableTime = 150,
    } = options;

    const attemptClick = async () => {
      await locator.click({ trial: true, timeout });
      await locator.click({ timeout });
    };

    await locator.waitFor({ state: "visible", timeout });
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await this.settleInteractiveUi({
      escapeCount,
      timeout: settleTimeout,
      stableTime: settleStableTime,
    });

    try {
      await attemptClick();
      return;
    } catch {
      await this.settleInteractiveUi({
        escapeCount: Math.max(escapeCount, 1),
        timeout: settleTimeout,
        stableTime: settleStableTime,
      });
      await locator.scrollIntoViewIfNeeded().catch(() => {});
      try {
        await attemptClick();
        return;
      } catch (retryError) {
        const handle = await locator.elementHandle({ timeout }).catch(
          () => null,
        );
        if (!handle) throw retryError;

        try {
          await handle.evaluate((el) => {
            (el as HTMLElement).click();
          });
        } catch {
          throw retryError;
        } finally {
          await handle.dispose().catch(() => {});
        }
      }
    }
  }

  /**
   * 실제 사용자처럼 타이핑하고 blur까지 발생시켜 입력 상태를 UI 내부 form state에 반영합니다.
   */
  protected async typeInputLikeUser(
    locator: Locator,
    value: string,
    options: {
      timeout?: number;
      blurWithTab?: boolean;
      typingDelay?: number;
    } = {},
  ): Promise<void> {
    const {
      timeout = this.timeouts.medium,
      blurWithTab = true,
      typingDelay = 40,
    } = options;

    await locator.waitFor({ state: "visible", timeout });
    await locator.click({ timeout });
    await this._page.keyboard.press("ControlOrMeta+A").catch(() => {});
    await this._page.keyboard.press("Delete").catch(() => {});
    await this._page.keyboard.type(value, { delay: typingDelay });
    await expect(locator).toHaveValue(value, { timeout });

    if (blurWithTab) {
      await locator.press("Tab").catch(() => {});
      await expect(locator).toHaveValue(value, { timeout }).catch(() => {});
    }
  }

  /**
   * 포탈 드롭다운처럼 attached 상태만 보장되는 요소 클릭
   * visible이면 일반 클릭 복구 경로를 사용하고, 아니면 DOM click으로 폴백
   */
  protected async clickAttachedElement(
    locator: Locator,
    options: {
      timeout?: number;
      escapeCount?: number;
    } = {},
  ): Promise<void> {
    const {
      timeout = this.timeouts.medium,
      escapeCount = 0,
    } = options;

    await locator.waitFor({ state: "attached", timeout });

    const isVisible = await locator
      .isVisible({ timeout: Math.min(timeout, this.timeouts.short) })
      .catch(() => false);

    if (isVisible) {
      await this.clickWithRecovery(locator, { timeout, escapeCount });
      return;
    }

    if (escapeCount > 0) {
      await this.pressEscape(escapeCount);
    }

    const handle = await locator.elementHandle({ timeout });
    if (!handle) {
      throw new Error("클릭 대상 elementHandle을 확보하지 못했습니다.");
    }

    try {
      await handle.evaluate((el) => {
        (el as HTMLElement).click();
      });
    } finally {
      await handle.dispose().catch(() => {});
    }
  }

  // --------------------------------------------------------------------------
  // 대기 (조건부 대기 우선 사용 권장)
  // --------------------------------------------------------------------------

  /**
   * 로드 상태 대기
   */
  async waitForLoadState(
    state: "load" | "domcontentloaded" | "networkidle" = "domcontentloaded",
  ): Promise<void> {
    await this._page.waitForLoadState(state, {
      timeout: this.timeouts.navigation,
    });
  }

  /**
   * 특정 요소가 나타날 때까지 대기
   * @param locator 대기할 Locator
   * @param options.state 요소 상태 ('visible' | 'attached' | 'hidden')
   * @param options.timeout 최대 대기 시간 (ms)
   */
  async waitForElement(
    locator: Locator,
    options: {
      state?: "visible" | "attached" | "hidden";
      timeout?: number;
    } = {},
  ): Promise<void> {
    const { state = "visible", timeout = this.timeouts.medium } = options;
    await locator.waitFor({ state, timeout });
  }

  /**
   * 여러 셀렉터 중 하나라도 나타날 때까지 대기
   * @param selectors 대기할 셀렉터 배열
   * @param timeout 최대 대기 시간 (ms)
   * @returns 발견된 요소 정보 또는 null
   */
  async waitForAnyElement(
    selectors: readonly string[],
    timeout: number = this.timeouts.medium,
  ): Promise<ElementSearchResult | null> {
    // Promise.any(): 첫 번째 성공 promise 반환, 모두 실패 시 AggregateError
    // Promise.race()는 null을 가장 빨리 반환하는 promise가 이겨버리는 버그 있음
    const promises = selectors.map(async (selector) => {
      const element = this._page.locator(selector).first();
      await element.waitFor({ state: "visible", timeout });
      return { element, selector };
    });

    try {
      return await Promise.any(promises);
    } catch {
      // 모든 selector에서 요소를 찾지 못함 (AggregateError)
      return null;
    }
  }

  /**
   * 네트워크 요청이 안정화될 때까지 대기
   * @param timeout 최대 대기 시간 (ms)
   */
  async waitForNetworkStable(
    timeout: number = this.timeouts.long,
  ): Promise<void> {
    await this._page.waitForLoadState("networkidle", { timeout });
  }

  /**
   * 페이지 콘텐츠가 안정화될 때까지 대기 (DOM 변경 완료)
   * @param selectorOrStableTime 안정화 기준 요소 셀렉터 또는 stableTime (ms)
   * @param options.timeout 최대 대기 시간 (ms)
   * @param options.stableTime 변경 없이 유지되어야 하는 시간 (ms)
   */
  async waitForContentStable(
    selectorOrStableTime: string | number = "body",
    options: { timeout?: number; stableTime?: number } = {},
  ): Promise<void> {
    // 첫 번째 인자가 숫자이면 stableTime으로 처리
    let selector = "body";
    let stableTime = options.stableTime ?? 300;

    if (typeof selectorOrStableTime === "number") {
      stableTime = selectorOrStableTime;
    } else {
      selector = selectorOrStableTime;
    }

    const timeout = options.timeout ?? this.timeouts.medium;

    await this._page.waitForFunction(
      ({ sel, stable }) => {
        return new Promise<boolean>((resolve) => {
          const target = document.querySelector(sel);
          if (!target) {
            resolve(true);
            return;
          }

          let timer: ReturnType<typeof setTimeout>;
          let resolved = false;

          const observer = new MutationObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(() => {
              if (!resolved) {
                resolved = true;
                observer.disconnect();
                resolve(true);
              }
            }, stable);
          });

          observer.observe(target, {
            childList: true,
            subtree: true,
            attributes: true,
          });

          // 초기 시작
          timer = setTimeout(() => {
            if (!resolved) {
              resolved = true;
              observer.disconnect();
              resolve(true);
            }
          }, stable);
        });
      },
      { sel: selector, stable: stableTime },
      { timeout },
    );
  }

  /**
   * URL이 특정 패턴을 포함할 때까지 대기
   * @param pattern URL에 포함되어야 하는 문자열 또는 정규식
   * @param timeout 최대 대기 시간 (ms)
   */
  async waitForUrlContains(
    pattern: string | RegExp,
    timeout: number = this.timeouts.long,
  ): Promise<void> {
    if (typeof pattern === "string") {
      await this._page.waitForURL(`**/*${pattern}*`, { timeout });
    } else {
      await this._page.waitForURL(pattern, { timeout });
    }
  }

  // --------------------------------------------------------------------------
  // 모달/팝업 처리
  // --------------------------------------------------------------------------

  /** 모달 닫기 텍스트 패턴 */
  protected readonly modalDoNotShowTexts: readonly string[] = [
    "Do not show again",
    "do not show again",
    "Don't show again",
    "Do not show",
    "다시 보지 않기",
    "다시보지않기",
    "다시 보지 않음",
    "오늘 하루 보지 않기",
  ];

  protected readonly modalCloseTexts: readonly string[] = [
    "닫기",
    "확인",
    "Close",
    "OK",
    "close",
  ];

  /**
   * 모달 닫기 버튼 클릭 — exact 매칭으로 "확인"이 "사업자정보확인" 등에 부분 매칭되는 것 방지
   */
  private async clickModalCloseButton(
    texts: readonly string[],
    timeout: number,
  ): Promise<boolean> {
    for (const text of texts) {
      try {
        const btn = this._page.getByText(text, { exact: true }).first();
        if (await btn.isVisible({ timeout })) {
          await this.clickWithRecovery(btn, { timeout: this.timeouts.medium });
          await btn
            .waitFor({ state: "hidden", timeout: this.timeouts.short })
            .catch(() => {});
          console.log(`✅ "${text}" 버튼 클릭`);
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  }

  /**
   * 모달 처리 - "다시 보지 않기" 우선, 없으면 "닫기" 클릭
   */
  async handleModal(): Promise<void> {
    try {
      // "다시 보지 않기" 계열은 부분 매칭 (문구 변형이 다양함)
      const dismissed = await this.clickFirstVisibleText(
        this.modalDoNotShowTexts,
        1000,
      );

      // 닫기/확인 계열은 exact 매칭 (푸터 "사업자정보확인" 오클릭 방지)
      if (!dismissed) {
        await this.clickModalCloseButton(this.modalCloseTexts, 800);
      }
    } catch {
      // 모달이 없거나 처리 실패 - 정상
    }
  }

  /**
   * 모든 모달 닫기 (여러 개의 모달이 연속으로 나올 때)
   */
  async closeAllModals(): Promise<void> {
    // "다시 보지 않기" 계열은 부분 매칭
    for (const text of this.modalDoNotShowTexts) {
      try {
        const btn = this._page.getByText(text, { exact: false }).first();
        if (await btn.isVisible({ timeout: 1000 })) {
          await this.clickWithRecovery(btn);
          await btn.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});
        }
      } catch {
        continue;
      }
    }
    // 닫기/확인 계열은 exact 매칭
    for (const text of this.modalCloseTexts) {
      try {
        const btn = this._page.getByText(text, { exact: true }).first();
        if (await btn.isVisible({ timeout: 500 })) {
          await this.clickWithRecovery(btn);
          await btn.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});
        }
      } catch {
        continue;
      }
    }
  }

  // --------------------------------------------------------------------------
  // 이미지 검증
  // --------------------------------------------------------------------------

  /**
   * 페이지 내 이미지 로딩 상태 검증
   * - 깨진 이미지(X박스) 감지
   * - naturalWidth가 0인 이미지 = 로딩 실패
   */
  async verifyImagesLoaded(): Promise<ImageVerificationResult> {
    return await this._page.evaluate(() => {
      const images = Array.from(document.querySelectorAll("img"));
      const brokenImages: string[] = [];

      for (const img of images) {
        if (img.complete && img.naturalWidth === 0) {
          if (img.src && !img.src.startsWith("data:") && img.src !== "") {
            brokenImages.push(img.src.substring(0, 100));
          }
        }
      }

      return {
        total: images.length,
        broken: brokenImages.length,
        brokenSrcs: brokenImages.slice(0, 5),
      };
    });
  }

  // --------------------------------------------------------------------------
  // API 모니터링
  // --------------------------------------------------------------------------

  /**
   * 페이지 로드 중 API 응답 상태 모니터링
   */
  async monitorApiResponses(
    urlPatterns: RegExp[],
    action: () => Promise<void>,
    timeoutThreshold: number = 5000,
  ): Promise<{ responses: ApiMonitorResult[]; errors: string[] }> {
    const responses: ApiMonitorResult[] = [];
    const errors: string[] = [];

    const responseHandler = (response: import("@playwright/test").Response) => {
      const url = response.url();
      const matchedPattern = urlPatterns.find((pattern) => pattern.test(url));

      if (matchedPattern) {
        const timing = response.request().timing();
        const duration = timing?.responseEnd || 0;

        responses.push({
          url: url.substring(0, 80),
          status: response.status(),
          duration: Math.round(duration),
          ok: response.ok(),
        });

        if (!response.ok()) {
          errors.push(`${response.status()} - ${url.substring(0, 60)}`);
        }

        if (duration > timeoutThreshold) {
          errors.push(
            `SLOW (${Math.round(duration)}ms) - ${url.substring(0, 60)}`,
          );
        }
      }
    };

    this._page.on("response", responseHandler);

    try {
      await action();
    } finally {
      this._page.removeListener("response", responseHandler);
    }

    return { responses, errors };
  }

  // --------------------------------------------------------------------------
  // Assertions (단언)
  // --------------------------------------------------------------------------

  /**
   * URL 패턴 검증
   */
  async expectUrlMatches(
    pattern: RegExp,
    timeout: number = this.timeouts.long,
  ): Promise<void> {
    await expect(this.page).toHaveURL(pattern, { timeout });
  }

  /**
   * 요소 가시성 검증
   */
  async expectVisible(
    locator: Locator,
    timeout: number = this.timeouts.medium,
  ): Promise<void> {
    await expect(locator).toBeVisible({ timeout });
  }

  /**
   * 텍스트 포함 검증
   */
  async expectTextContent(locator: Locator, pattern: RegExp): Promise<void> {
    const text = await locator.textContent();
    expect(text).toMatch(pattern);
  }
}
