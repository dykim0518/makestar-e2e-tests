/**
 * BasePage - 모든 페이지 객체의 기본 클래스
 * 
 * 공통 기능:
 * - 페이지 네비게이션
 * - 모달/팝업 처리
 * - 요소 대기 및 검색
 * - 이미지 로딩 검증
 */

import { Page, Locator, expect } from '@playwright/test';

// ============================================================================
// 타입 정의
// ============================================================================

/** 타임아웃 설정 */
export interface TimeoutConfig {
  readonly micro: number;
  readonly short: number;
  readonly medium: number;
  readonly long: number;
  readonly navigation: number;
  readonly test: number;
}

/** 이미지 검증 결과 */
export interface ImageVerificationResult {
  total: number;
  broken: number;
  brokenSrcs: string[];
}

/** API 모니터링 결과 */
export interface ApiMonitorResult {
  url: string;
  status: number;
  duration: number;
  ok: boolean;
}

/** 요소 검색 결과 */
export interface ElementSearchResult {
  element: Locator;
  selector: string;
}

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
      throw new Error('Page is closed. Cannot perform navigation.');
    }
  }

  // --------------------------------------------------------------------------
  // 네비게이션
  // --------------------------------------------------------------------------

  /**
   * URL로 이동
   */
  async goto(url: string, options?: { waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' }): Promise<void> {
    this.ensurePageOpen();
    await this._page.goto(url, {
      waitUntil: options?.waitUntil ?? 'domcontentloaded',
      timeout: this.timeouts.navigation,
    });
  }

  /**
   * 페이지 새로고침
   */
  async reload(): Promise<void> {
    await this._page.reload({ waitUntil: 'domcontentloaded', timeout: this.timeouts.navigation });
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
    timeout: number = this.timeouts.short
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
    timeout: number = this.timeouts.short
  ): Promise<boolean> {
    for (const text of texts) {
      try {
        const btn = this._page.getByText(text, { exact: false }).first();
        if (await btn.isVisible({ timeout })) {
          await btn.click({ timeout: this.timeouts.medium, force: true });
          await this._page.waitForTimeout(500);
          console.log(`✅ "${text}" 버튼 클릭`);
          return true;
        }
      } catch {
        continue;
      }
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // 대기 (조건부 대기 우선 사용 권장)
  // --------------------------------------------------------------------------

  /**
   * 지정 시간 대기
   * @deprecated Hard wait는 CI 환경에서 불안정합니다. 
   *             waitForElement(), waitForContentStable() 등 조건부 대기 메서드를 사용하세요.
   */
  async wait(ms: number): Promise<void> {
    await this._page.waitForTimeout(ms);
  }

  /**
   * 로드 상태 대기
   */
  async waitForLoadState(
    state: 'load' | 'domcontentloaded' | 'networkidle' = 'domcontentloaded'
  ): Promise<void> {
    await this._page.waitForLoadState(state, { timeout: this.timeouts.navigation });
  }

  /**
   * 특정 요소가 나타날 때까지 대기
   * @param locator 대기할 Locator
   * @param options.state 요소 상태 ('visible' | 'attached' | 'hidden')
   * @param options.timeout 최대 대기 시간 (ms)
   */
  async waitForElement(
    locator: Locator,
    options: { state?: 'visible' | 'attached' | 'hidden'; timeout?: number } = {}
  ): Promise<void> {
    const { state = 'visible', timeout = this.timeouts.medium } = options;
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
    timeout: number = this.timeouts.medium
  ): Promise<ElementSearchResult | null> {
    const promises = selectors.map(async (selector) => {
      try {
        const element = this._page.locator(selector).first();
        await element.waitFor({ state: 'visible', timeout });
        return { element, selector };
      } catch {
        return null;
      }
    });

    try {
      const result = await Promise.race(promises);
      return result;
    } catch {
      return null;
    }
  }

  /**
   * 네트워크 요청이 안정화될 때까지 대기
   * @param timeout 최대 대기 시간 (ms)
   */
  async waitForNetworkStable(timeout: number = this.timeouts.long): Promise<void> {
    await this._page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * 페이지 콘텐츠가 안정화될 때까지 대기 (DOM 변경 완료)
   * @param selectorOrStableTime 안정화 기준 요소 셀렉터 또는 stableTime (ms)
   * @param options.timeout 최대 대기 시간 (ms)
   * @param options.stableTime 변경 없이 유지되어야 하는 시간 (ms)
   */
  async waitForContentStable(
    selectorOrStableTime: string | number = 'body',
    options: { timeout?: number; stableTime?: number } = {}
  ): Promise<void> {
    // 첫 번째 인자가 숫자이면 stableTime으로 처리
    let selector = 'body';
    let stableTime = options.stableTime ?? 300;
    
    if (typeof selectorOrStableTime === 'number') {
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
      { timeout }
    );
  }

  /**
   * URL이 특정 패턴을 포함할 때까지 대기
   * @param pattern URL에 포함되어야 하는 문자열 또는 정규식
   * @param timeout 최대 대기 시간 (ms)
   */
  async waitForUrlContains(
    pattern: string | RegExp,
    timeout: number = this.timeouts.long
  ): Promise<void> {
    if (typeof pattern === 'string') {
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
    'Do not show again', 'do not show again', "Don't show again", 'Do not show',
    '다시 보지 않기', '다시보지않기', '다시 보지 않음', '오늘 하루 보지 않기',
  ];

  protected readonly modalCloseTexts: readonly string[] = [
    '닫기', '확인', 'Close', 'OK', 'close',
  ];

  /**
   * 모달 처리 - "다시 보지 않기" 우선, 없으면 "닫기" 클릭
   */
  async handleModal(): Promise<void> {
    try {
      await this.wait(this.timeouts.micro);

      // 1단계: "Do not show again" 버튼 찾기
      const dismissed = await this.clickFirstVisibleText(this.modalDoNotShowTexts, 1000);

      // 2단계: 모달이 여전히 있으면 닫기 버튼 클릭
      if (!dismissed) {
        await this.clickFirstVisibleText(this.modalCloseTexts, 800);
      }
    } catch {
      // 모달이 없거나 처리 실패 - 정상
    }
  }

  /**
   * 모든 모달 닫기 (여러 개의 모달이 연속으로 나올 때)
   */
  async closeAllModals(): Promise<void> {
    const allCloseTexts = [...this.modalDoNotShowTexts, ...this.modalCloseTexts];
    for (const text of allCloseTexts) {
      try {
        const btn = this._page.locator(`text=${text}`).first();
        if (await btn.isVisible({ timeout: 1000 })) {
          await btn.click({ force: true });
          await this.wait(500);
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
      const images = Array.from(document.querySelectorAll('img'));
      const brokenImages: string[] = [];

      for (const img of images) {
        if (img.complete && img.naturalWidth === 0) {
          if (img.src && !img.src.startsWith('data:') && img.src !== '') {
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
    timeoutThreshold: number = 5000
  ): Promise<{ responses: ApiMonitorResult[]; errors: string[] }> {
    const responses: ApiMonitorResult[] = [];
    const errors: string[] = [];

    const responseHandler = (response: any) => {
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
          errors.push(`SLOW (${Math.round(duration)}ms) - ${url.substring(0, 60)}`);
        }
      }
    };

    this._page.on('response', responseHandler);

    try {
      await action();
    } finally {
      this._page.removeListener('response', responseHandler);
    }

    return { responses, errors };
  }

  // --------------------------------------------------------------------------
  // Assertions (단언)
  // --------------------------------------------------------------------------

  /**
   * URL 패턴 검증
   */
  async expectUrlMatches(pattern: RegExp, timeout: number = this.timeouts.long): Promise<void> {
    await expect(this.page).toHaveURL(pattern, { timeout });
  }

  /**
   * 요소 가시성 검증
   */
  async expectVisible(locator: Locator, timeout: number = this.timeouts.medium): Promise<void> {
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
