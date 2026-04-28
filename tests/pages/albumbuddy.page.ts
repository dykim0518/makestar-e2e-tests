/**
 * AlbumBuddy 페이지 객체
 *
 * 이 클래스는 AlbumBuddy 웹사이트의 모든 페이지 상호작용을 캡슐화합니다.
 */

import { Page, Locator, expect } from "@playwright/test";
import { BasePage, DEFAULT_TIMEOUTS, TimeoutConfig } from "./base.page";
import * as fs from "fs";
import * as path from "path";

// ============================================================================
// 타입 정의
// ============================================================================

/** 페이지 정보 타입 */
export type PageInfo = {
  url: string;
  pattern: RegExp;
  title?: string;
};

/** 성능 측정 결과 */
export type PerformanceResult = {
  url: string;
  loadTime: number;
  passed: boolean;
};

/** AlbumBuddy 페이지 준비 대기 옵션 */
export type AlbumBuddyReadyOptions = {
  waitForNetworkIdle?: boolean;
  networkIdleTimeout?: number;
};

// ============================================================================
// AlbumBuddy 상수
// ============================================================================

export const ALBUMBUDDY_URLS = {
  base: "https://albumbuddy.kr",
  shop: "https://albumbuddy.kr/shop",
  about: "https://albumbuddy.kr/about",
  pricing: "https://albumbuddy.kr/pricing",
  dashboard: "https://albumbuddy.kr/dashboard/purchasing",
  dashboardPurchasing: "https://albumbuddy.kr/dashboard/purchasing",
  dashboardPackage: "https://albumbuddy.kr/dashboard/package",
} as const;

export const ALBUMBUDDY_PAGES: Record<string, PageInfo> = {
  home: { url: ALBUMBUDDY_URLS.shop, pattern: /shop/i, title: "ALBUM BUDDY" },
  about: { url: ALBUMBUDDY_URLS.about, pattern: /about/i },
  pricing: { url: ALBUMBUDDY_URLS.pricing, pattern: /pricing/i },
  dashboard: { url: ALBUMBUDDY_URLS.dashboard, pattern: /dashboard/i },
  dashboardPurchasing: {
    url: ALBUMBUDDY_URLS.dashboardPurchasing,
    pattern: /purchasing/i,
  },
  dashboardPackage: {
    url: ALBUMBUDDY_URLS.dashboardPackage,
    pattern: /package/i,
  },
} as const;

export const NAV_BUTTONS = [
  "About",
  "Pricing",
  "Dashboard",
  "Request item",
] as const;

// 실제 사이트의 섹션명 (한글/영문 혼용)
export const HOME_SECTIONS = [
  "Artist",
  "Recent",
  "Trending",
  "Official", // 영어
  "추천",
  "아티스트",
  "트렌딩",
  "공식",
  "파트너",
  "전체",
  "앨범", // 한국어
] as const;

export const PERFORMANCE_THRESHOLD = {
  pageLoad: 10000,
  apiResponse: 5000,
} as const;

/** 정규식 특수문자 이스케이프 */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================================================
// AlbumBuddyPage 클래스
// ============================================================================

export class AlbumBuddyPage extends BasePage {
  readonly baseUrl = ALBUMBUDDY_URLS.base;
  readonly shopUrl = ALBUMBUDDY_URLS.shop;
  readonly siteTitle = "ALBUM BUDDY";
  readonly authFilePath: string;

  // --------------------------------------------------------------------------
  // 로케이터 정의
  // --------------------------------------------------------------------------

  // 네비게이션 버튼
  readonly aboutButton: Locator;
  readonly pricingButton: Locator;
  readonly dashboardButton: Locator;
  readonly requestItemButton: Locator;

  // Show more 버튼
  readonly showMoreButton: Locator;

  // 이미지
  readonly images: Locator;

  constructor(page: Page, timeouts: TimeoutConfig = DEFAULT_TIMEOUTS) {
    super(page, timeouts);
    this.authFilePath = path.join(__dirname, "..", "..", "ab-auth.json");

    // 네비게이션 버튼 초기화
    this.aboutButton = page.getByRole("button", { name: "About" });
    this.pricingButton = page.getByRole("button", { name: "Pricing" });
    this.dashboardButton = page.getByRole("button", { name: "Dashboard" });
    this.requestItemButton = page.getByText(/^\s*Request item\s*$/i).first();

    // 기타 요소
    this.showMoreButton = page.getByText("Show more").first();
    this.images = page.locator("img");
  }

  // --------------------------------------------------------------------------
  // 인증 헬퍼
  // --------------------------------------------------------------------------

  /**
   * 인증 파일 존재 및 유효성 확인
   */
  isAuthAvailable(): boolean {
    if (!fs.existsSync(this.authFilePath)) {
      return false;
    }
    try {
      const auth = JSON.parse(fs.readFileSync(this.authFilePath, "utf-8"));
      const cookies = auth.cookies || [];
      if (cookies.length === 0) return false;

      const now = Date.now() / 1000;
      const validCookies = cookies.filter(
        (c: { expires?: number }) => !c.expires || c.expires > now,
      );
      return validCookies.length > 0;
    } catch {
      return false;
    }
  }

  // --------------------------------------------------------------------------
  // 페이지 유틸리티
  // --------------------------------------------------------------------------

  /**
   * 페이지 로딩 완료 및 오버레이 제거
   */
  async waitForPageReady(options: AlbumBuddyReadyOptions = {}): Promise<void> {
    const {
      waitForNetworkIdle = true,
      networkIdleTimeout = 30000,
    } = options;

    if (waitForNetworkIdle) {
      try {
        await this.page.waitForLoadState("networkidle", {
          timeout: networkIdleTimeout,
        });
      } catch {
        // AlbumBuddy는 분석/채팅 요청으로 networkidle이 오지 않을 수 있음
      }
    }
    await this.waitForContentStable("body", {
      timeout: this.timeouts.short,
      stableTime: 250,
    }).catch(() => {});

    // 오버레이/모달 제거
    for (let i = 0; i < 3; i++) {
      await this.page.evaluate(() => {
        Array.from(document.querySelectorAll("body *")).forEach((node) => {
          if (!(node instanceof HTMLElement)) {
            return;
          }

          const className =
            typeof node.className === "string" ? node.className : "";
          const role = node.getAttribute("role") || "";
          const ariaModal = node.getAttribute("aria-modal") === "true";
          const style = window.getComputedStyle(node);
          const zIndex = Number.parseInt(style.zIndex || "0", 10);

          const isKnownBackdrop =
            /\bmodal-overlay\b/i.test(className) ||
            /\bmodal-backdrop\b/i.test(className) ||
            /\bdrawer-backdrop\b/i.test(className) ||
            /\bbackdrop\b/i.test(className);
          const isBlockingDialog =
            (role === "dialog" || ariaModal) &&
            style.position === "fixed" &&
            style.pointerEvents !== "none" &&
            zIndex >= 20;

          if (!isKnownBackdrop && !isBlockingDialog) {
            return;
          }

          node.style.cssText =
            "display:none!important;visibility:hidden!important;pointer-events:none!important;";
        });
      });
      await this.page.keyboard.press("Escape");
      await this.waitForContentStable("body", {
        timeout: this.timeouts.short,
        stableTime: 120,
      }).catch(() => {});
    }
  }

  /**
   * 페이지 내 텍스트 존재 확인
   */
  async hasText(text: string): Promise<boolean> {
    return this.page.evaluate((t) => document.body.innerText.includes(t), text);
  }

  /**
   * 여러 텍스트 존재 확인
   */
  async hasAllTexts(
    texts: readonly string[],
  ): Promise<Record<string, boolean>> {
    return this.page.evaluate(
      (arr) => {
        const content = document.body.innerText;
        return arr.reduce(
          (acc, t) => ({ ...acc, [t]: content.includes(t) }),
          {} as Record<string, boolean>,
        );
      },
      texts as unknown as string[],
    );
  }

  /**
   * 페이지 로드 시간 측정
   */
  async measureLoadTime(url: string): Promise<number> {
    const start = Date.now();
    await this.page.goto(url, { waitUntil: "domcontentloaded" });
    return Date.now() - start;
  }

  // --------------------------------------------------------------------------
  // 네비게이션 메서드
  // --------------------------------------------------------------------------

  /**
   * 홈페이지로 이동
   */
  async gotoHome(options: AlbumBuddyReadyOptions = {}): Promise<void> {
    await this.page.goto(this.shopUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await this.waitForPageReady(options);
  }

  /**
   * About 페이지로 이동
   */
  async gotoAbout(): Promise<void> {
    await this.page.goto(ALBUMBUDDY_URLS.about, {
      waitUntil: "domcontentloaded",
    });
    await this.waitForPageReady();
  }

  /**
   * Pricing 페이지로 이동
   */
  async gotoPricing(): Promise<void> {
    await this.page.goto(ALBUMBUDDY_URLS.pricing, {
      waitUntil: "domcontentloaded",
    });
    await this.waitForPageReady();
  }

  /**
   * Dashboard 페이지로 이동
   */
  async gotoDashboard(): Promise<void> {
    await this.page.goto(ALBUMBUDDY_URLS.dashboard, {
      waitUntil: "domcontentloaded",
    });
    await this.waitForPageReady();
  }

  /**
   * Dashboard Purchasing 페이지로 이동
   */
  async gotoDashboardPurchasing(): Promise<void> {
    await this.page.goto(ALBUMBUDDY_URLS.dashboardPurchasing, {
      waitUntil: "domcontentloaded",
    });
    await this.waitForPageReady();
  }

  /**
   * Dashboard Package 페이지로 이동
   */
  async gotoDashboardPackage(): Promise<void> {
    await this.page.goto(ALBUMBUDDY_URLS.dashboardPackage, {
      waitUntil: "domcontentloaded",
    });
    await this.waitForPageReady();
  }

  /**
   * 버튼 클릭으로 네비게이션
   */
  async clickNavButton(buttonName: string): Promise<boolean> {
    const escapedName = escapeRegExp(buttonName);
    const exactNamePattern = new RegExp(`^\\s*${escapedName}\\s*$`, "i");

    await this.ensureNavigationMenuVisible(buttonName);

    const candidates = [
      this.page.getByRole("button", { name: exactNamePattern }).first(),
      this.page.getByRole("link", { name: exactNamePattern }).first(),
      this.page.getByText(exactNamePattern).first(),
      this.page
        .locator('button, a, [role="button"], [role="menuitem"]')
        .filter({ hasText: exactNamePattern })
        .first(),
    ];

    for (const candidate of candidates) {
      const visible = await candidate
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      if (!visible) continue;

      await candidate.click().catch(() => {});
      await this.wait(2000);
      return true;
    }

    return false;
  }

  // --------------------------------------------------------------------------
  // 검증 메서드
  // --------------------------------------------------------------------------

  /**
   * 네비게이션 버튼 표시 확인
   */
  async verifyNavButtons(): Promise<void> {
    const isMobile = await this.isMobileViewport();
    if (isMobile) {
      const hasVisibleNavEntry =
        (await this.isNavigationEntryVisible("About", this.timeouts.short)) ||
        (await this.isNavigationEntryVisible("Pricing", this.timeouts.short)) ||
        (await this.isNavigationEntryVisible(
          "Dashboard",
          this.timeouts.short,
        )) ||
        (await this.isNavigationEntryVisible(
          "Request item",
          this.timeouts.short,
        ));

      if (!hasVisibleNavEntry) {
        const opened = await this.openMobileMenuFallback();
        expect(opened, "모바일 메뉴를 열 수 있어야 합니다").toBe(true);
        await this.waitForContentStable("body", {
          timeout: this.timeouts.long,
          stableTime: 400,
        }).catch(() => {});
      }
    }

    await this.ensureNavigationMenuVisible("About");
    for (const btnName of NAV_BUTTONS) {
      const visible = await this.isNavigationEntryVisible(
        btnName,
        this.timeouts.long,
      );
      expect(
        visible,
        `네비게이션 항목 "${btnName}" 이(가) 노출되어야 합니다`,
      ).toBe(true);
    }
  }

  /**
   * 홈 섹션 확인
   */
  async verifyHomeSections(): Promise<Record<string, boolean>> {
    return await this.hasAllTexts(HOME_SECTIONS);
  }

  /**
   * 브랜드 요소 확인
   */
  async verifyBrandElements(): Promise<{
    hasBrand: boolean;
    hasMakestar: boolean;
    hasCurrency: boolean;
  }> {
    await this.page.evaluate(() =>
      window.scrollTo(0, document.body.scrollHeight),
    );
    await this.waitForContentStable("body", {
      timeout: this.timeouts.long,
      stableTime: 400,
    }).catch(() => {});

    const pageText = await this.page.evaluate(() => document.body.innerText);
    const hasBrand = /AlbumBuddy|앨범버디/i.test(pageText);
    const hasMakestar = /MAKESTAR/i.test(pageText);
    const hasCurrency = /USD|KRW|\$\s*\d|₩\s*\d/i.test(pageText);

    return { hasBrand, hasMakestar, hasCurrency };
  }

  /**
   * 이미지 로드 확인
   */
  async verifyImagesLoaded(): Promise<{
    count: number;
    firstImageLoaded: boolean;
  }> {
    const result = await this.page.evaluate(() => {
      const images = Array.from(
        document.querySelectorAll("img"),
      ) as HTMLImageElement[];
      const isVisible = (img: HTMLImageElement): boolean => {
        const style = window.getComputedStyle(img);
        const rect = img.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      const loadedVisibleCount = images.filter(
        (img) => isVisible(img) && img.complete && img.naturalWidth > 0,
      ).length;

      return { count: images.length, loadedVisibleCount };
    });

    return {
      count: result.count,
      firstImageLoaded: result.loadedVisibleCount > 0,
    };
  }

  /**
   * Show more 버튼 클릭
   */
  async clickShowMore(): Promise<boolean> {
    if (
      await this.showMoreButton.isVisible({ timeout: 5000 }).catch(() => false)
    ) {
      await this.showMoreButton.click();
      await this.wait(2000);
      return true;
    }
    return false;
  }

  /**
   * 상품 카드 수를 반환
   */
  async getVisibleProductCardCount(): Promise<number> {
    const albumGridCards = this.page.locator(".album__grid > div > div");
    const gridCount = await albumGridCards.count().catch(() => 0);
    if (gridCount > 0) {
      return gridCount;
    }

    return this.page
      .locator('div:has(img[alt="image"]):has(p:has-text("$"))')
      .count()
      .catch(() => 0);
  }

  /**
   * 홈/검색 타일 이미지 수를 반환
   */
  async getVisibleImageTileCount(): Promise<number> {
    return this.page.evaluate(() => {
      const images = Array.from(
        document.querySelectorAll('img[alt="image"]'),
      ) as HTMLImageElement[];

      return images.filter((img) => {
        const style = window.getComputedStyle(img);
        const rect = img.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0
        );
      }).length;
    });
  }

  /**
   * Request item 모달/페이지 확인
   */
  async clickRequestItemAndVerify(): Promise<{
    modalVisible: boolean;
    urlChanged: boolean;
    triggered: boolean;
  }> {
    const visible = await this.ensureRequestItemButtonVisible();
    let triggered = false;

    if (visible) {
      const requestItemCandidates = [
        this.requestItemButton,
        this.page.getByRole("button", { name: /^\s*Request item\s*$/i }).first(),
        this.page.getByRole("link", { name: /^\s*Request item\s*$/i }).first(),
      ];

      for (const candidate of requestItemCandidates) {
        const isVisible = await candidate
          .isVisible({ timeout: this.timeouts.short })
          .catch(() => false);
        if (!isVisible) continue;

        await candidate.click().catch(() => {});
        triggered = true;
        break;
      }
    } else {
      // 모바일에서 숨김 상태인 경우에도 정확히 Request item 엔트리만 대상으로 합니다.
      triggered = await this.page.evaluate(() => {
        const target = Array.from(
          document.querySelectorAll("*"),
        ).find(
          (el) =>
            /^request item$/i.test(
              (el.textContent || "").replace(/\s+/g, " ").trim(),
            ) &&
            window.getComputedStyle(el as Element).display !== "none" &&
            window.getComputedStyle(el as Element).visibility !== "hidden" &&
            (el as HTMLElement).getBoundingClientRect().width > 0 &&
            (el as HTMLElement).getBoundingClientRect().height > 0,
        ) as HTMLElement | undefined;
        if (!target) {
          return false;
        }
        target.click();
        return true;
      });
    }

    await this.waitForContentStable("body", {
      timeout: this.timeouts.long,
      stableTime: 400,
    }).catch(() => {});

    const modalVisible = await this.page.evaluate(() => {
      const modals = document.querySelectorAll(
        '[role="dialog"], .modal, [class*="modal"]',
      );
      return Array.from(modals).some((m) => {
        const style = window.getComputedStyle(m);
        const text = (m.textContent || "").replace(/\s+/g, " ");
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          /request item|product url|item url|vendor|submit|album|log in|sign up|continue|enter your email/i.test(
            text,
          )
        );
      });
    });

    const urlChanged = /request/i.test(this.currentUrl);

    return { modalVisible, urlChanged, triggered };
  }

  /**
   * 모바일 메뉴를 펼쳐 네비게이션 항목을 노출
   */
  async ensureNavigationMenuVisible(
    targetName: string = "About",
  ): Promise<void> {
    const alreadyVisible = await this.isNavigationEntryVisible(
      targetName,
      this.timeouts.short,
    );
    if (alreadyVisible) {
      return;
    }

    const opened = await this.openMobileMenuFallback();
    if (!opened) {
      return;
    }

    await this.waitForContentStable("body", {
      timeout: this.timeouts.long,
      stableTime: 400,
    }).catch(() => {});
  }

  /**
   * Request item 항목 노출 보장
   */
  async ensureRequestItemButtonVisible(): Promise<boolean> {
    const visible = await this.requestItemButton
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
    if (visible) {
      return true;
    }

    const roleVisible = await this.page
      .getByRole("button", { name: /^\s*Request item\s*$/i })
      .first()
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
    if (roleVisible) {
      return true;
    }

    await this.ensureNavigationMenuVisible("Request item");
    return this.requestItemButton
      .isVisible({ timeout: this.timeouts.short })
      .catch(async () =>
        this.page
          .getByRole("button", { name: /^\s*Request item\s*$/i })
          .first()
          .isVisible({ timeout: this.timeouts.short })
          .catch(() => false),
      );
  }

  /**
   * Request item 엔트리 DOM 존재 여부
   */
  async hasRequestItemEntryInDom(): Promise<boolean> {
    return (await this.requestItemButton.count()) > 0;
  }

  /**
   * 네비게이션 항목 가시성 확인 (button/link/menuitem)
   */
  private async isNavigationEntryVisible(
    name: string,
    timeout: number,
  ): Promise<boolean> {
    const escapedName = escapeRegExp(name);
    const exactNamePattern = new RegExp(`^\\s*${escapedName}\\s*$`, "i");

    const roleButton = this.page
      .getByRole("button", { name: exactNamePattern })
      .first();
    if (await roleButton.isVisible({ timeout }).catch(() => false)) {
      return true;
    }

    const roleLink = this.page
      .getByRole("link", { name: exactNamePattern })
      .first();
    if (await roleLink.isVisible({ timeout }).catch(() => false)) {
      return true;
    }

    const exactText = this.page.getByText(exactNamePattern).first();
    if (await exactText.isVisible({ timeout }).catch(() => false)) {
      return true;
    }

    const genericTarget = this.page
      .locator('button, a, [role="button"], [role="menuitem"]')
      .filter({ hasText: exactNamePattern })
      .first();
    return genericTarget.isVisible({ timeout }).catch(() => false);
  }

  /**
   * 접근성 이름이 없는 햄버거 버튼을 위한 모바일 메뉴 오픈 fallback
   */
  private async openMobileMenuFallback(): Promise<boolean> {
    const combinedHeaderMenu = this.page.locator("button.main__header__right").first();
    if (
      await combinedHeaderMenu
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false)
    ) {
      const box = await combinedHeaderMenu.boundingBox().catch(() => null);
      if (box) {
        await combinedHeaderMenu.click({
          position: {
            // 이 버튼은 검색+메뉴 아이콘을 함께 감싸므로 오른쪽 끝을 눌러 햄버거를 타겟합니다.
            x: Math.max(box.width - 16, 1),
            y: Math.max(box.height / 2, 1),
          },
        });
        return true;
      }
    }

    const namedMenuButton = this.page
      .getByRole("button", { name: /menu|navigation|more|open/i })
      .first();
    if (
      await namedMenuButton
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false)
    ) {
      await namedMenuButton.click();
      return true;
    }

    const clicked = await this.page.evaluate(() => {
      const candidates = Array.from(
        document.querySelectorAll("button"),
      ) as HTMLButtonElement[];
      const visibleTopButtons = candidates
        .filter((btn) => {
          const style = window.getComputedStyle(btn);
          const rect = btn.getBoundingClientRect();
          return (
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.top < 140
          );
        })
        .sort(
          (a, b) =>
            b.getBoundingClientRect().left - a.getBoundingClientRect().left,
        );

      const menuLike = visibleTopButtons.find((btn) => {
        const text =
          `${btn.getAttribute("aria-label") || ""} ${btn.textContent || ""}`.toLowerCase();
        return (
          text.includes("menu") ||
          text.includes("navigation") ||
          text.includes("more")
        );
      });

      const target = menuLike;
      if (!target) {
        return false;
      }
      target.click();
      return true;
    });

    return clicked;
  }

  /**
   * 모바일 뷰포트 여부
   */
  private async isMobileViewport(): Promise<boolean> {
    const width =
      this.page.viewportSize()?.width ??
      (await this.page.evaluate(() => window.innerWidth));
    return width <= 768;
  }

  /**
   * 모바일 헤더 메뉴 토글 존재 여부
   */
  private async hasMobileMenuToggle(): Promise<boolean> {
    return this.page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      return buttons.some((btn) => {
        const style = window.getComputedStyle(btn);
        const rect = btn.getBoundingClientRect();
        const visible =
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
        const inHeaderArea = rect.top < 140;
        return visible && inHeaderArea;
      });
    });
  }

  // --------------------------------------------------------------------------
  // 성능 측정 메서드
  // --------------------------------------------------------------------------

  /**
   * 홈페이지 로드 성능 측정
   */
  async measureHomePagePerformance(): Promise<PerformanceResult> {
    const loadTime = await this.measureLoadTime(this.shopUrl);
    return {
      url: this.shopUrl,
      loadTime,
      passed: loadTime < PERFORMANCE_THRESHOLD.pageLoad,
    };
  }

  /**
   * 주요 페이지 응답 상태 확인
   */
  async checkPagesStatus(): Promise<
    Array<{ url: string; status: number; ok: boolean }>
  > {
    const results: Array<{ url: string; status: number; ok: boolean }> = [];
    const pagesToCheck = [
      ALBUMBUDDY_PAGES.home,
      ALBUMBUDDY_PAGES.about,
      ALBUMBUDDY_PAGES.pricing,
    ];

    for (const pageInfo of pagesToCheck) {
      const response = await this.page.goto(pageInfo.url, {
        waitUntil: "domcontentloaded",
      });
      results.push({
        url: pageInfo.url,
        status: response?.status() ?? 0,
        ok: (response?.status() ?? 0) < 400,
      });
    }

    return results;
  }

  /**
   * 네트워크 에러 모니터링
   */
  async monitorNetworkErrors(action: () => Promise<void>): Promise<string[]> {
    const failedRequests: string[] = [];
    this.page.on("requestfailed", (req) => failedRequests.push(req.url()));

    await action();

    // 중요한 실패만 필터링
    return failedRequests.filter(
      (url) => url.includes("albumbuddy.kr") && !url.includes("analytics"),
    );
  }

  // --------------------------------------------------------------------------
  // 로그인 사용자 기능
  // --------------------------------------------------------------------------

  /**
   * 로그인 상태 확인
   */
  async isLoggedIn(): Promise<boolean> {
    return this.isLoggedInState();
  }

  /**
   * 현재 컨텍스트의 인증 세션 요약
   */
  async getAuthSessionSnapshot(): Promise<{
    hasRefreshToken: boolean;
    hasLoggedInUser: boolean;
    hasAlbumBuddyIndexedDb: boolean;
  }> {
    const state = await this.page.context().storageState({ indexedDB: true });

    const hasRefreshToken = state.cookies.some(
      (cookie) =>
        cookie.name === "refresh_token" &&
        /makestar|makeuni/i.test(cookie.domain || ""),
    );

    const hasLoggedInUser = state.origins.some(
      (origin) =>
        /makestar\.com/i.test(origin.origin) &&
        (origin.localStorage || []).some((entry) => entry.name === "LOGGED_IN_USER"),
    );

    const hasAlbumBuddyIndexedDb = state.origins.some((origin) => {
      if (!/albumbuddy\.kr/i.test(origin.origin)) {
        return false;
      }

      const indexedDbs = (
        origin as typeof origin & {
          indexedDB?: Array<{ name?: string }>;
        }
      ).indexedDB || [];

      return indexedDbs.some((db) => /firebaseLocalStorageDb/i.test(db.name || ""));
    });

    return {
      hasRefreshToken,
      hasLoggedInUser,
      hasAlbumBuddyIndexedDb,
    };
  }

  /**
   * Dashboard에서 로그인 CTA 노출 여부
   */
  async hasVisibleLoginEntry(): Promise<boolean> {
    const getCandidates = () => [
      this.page.getByRole("button", { name: /^\s*Login\s*$/i }).first(),
      this.page.getByRole("link", { name: /^\s*Login\s*$/i }).first(),
      this.page.getByRole("button", { name: /^\s*Sign in\s*$/i }).first(),
      this.page.getByRole("link", { name: /^\s*Sign in\s*$/i }).first(),
      this.page.getByText(/^\s*Login\s*$/i).first(),
      this.page.getByText(/^\s*Sign in\s*$/i).first(),
    ];

    for (const candidate of getCandidates()) {
      const visible = await candidate
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      if (visible) {
        return true;
      }
    }

    if (await this.isMobileViewport()) {
      await this.ensureNavigationMenuVisible("Login");
      for (const candidate of getCandidates()) {
        const visible = await candidate
          .isVisible({ timeout: this.timeouts.short })
          .catch(() => false);
        if (visible) {
          return true;
        }
      }
    }

    return false;
  }

  private async getDashboardSessionIndicators(): Promise<{
    hasNoItemsRegistered: boolean;
    hasOrderRows: boolean;
    hasMeaningfulCounters: boolean;
  }> {
    const pageText = await this.page.evaluate(() => document.body.innerText);
    const counterLabels = [
      "Waiting",
      "Pending",
      "Paid",
      "Ordered",
      "Shipment",
      "Canceled",
      "On hold",
    ];
    const hasMeaningfulCounters = counterLabels.some((label) =>
      new RegExp(`\\b([1-9]\\d*)\\s+${escapeRegExp(label)}\\b`, "i").test(
        pageText,
      ),
    );
    const rowCount = await this.page.locator("table tr").count().catch(() => 0);

    return {
      hasNoItemsRegistered: /No items registered\./i.test(pageText),
      hasOrderRows: rowCount > 1,
      hasMeaningfulCounters,
    };
  }

  /**
   * 실제 로그인 상태 확인
   */
  async isLoggedInState(): Promise<boolean> {
    const url = this.currentUrl.toLowerCase();
    const session = await this.getAuthSessionSnapshot();
    const pageText = await this.page.evaluate(() => document.body.innerText);

    return (
      session.hasRefreshToken &&
      session.hasLoggedInUser &&
      session.hasAlbumBuddyIndexedDb &&
      !url.includes("login") &&
      !url.includes("auth") &&
      /my orders|my packages/i.test(pageText)
    );
  }

  /**
   * 로그인 필요 여부 확인 (Dashboard 클릭 후)
   */
  async checkLoginRequired(): Promise<{
    needsLogin: boolean;
    hasLoginElement: boolean;
  }> {
    await this.clickNavButton("Dashboard");
    await this.wait(3000);

    const currentUrl = this.currentUrl;
    const hasLoginElement = await this.hasVisibleLoginEntry();

    return {
      needsLogin:
        currentUrl.includes("login") ||
        currentUrl.includes("auth") ||
        hasLoginElement,
      hasLoginElement,
    };
  }

  /**
   * Dashboard 콘텐츠 확인
   */
  async verifyDashboardContent(): Promise<{
    hasContent: boolean;
    notFound: boolean;
  }> {
    const pageContent = await this.page.evaluate(() => document.body.innerText);

    return {
      hasContent: pageContent.length > 100,
      notFound: pageContent.toLowerCase().includes("not found"),
    };
  }

  /**
   * 구매 내역 UI 요소 확인
   */
  async verifyPurchasingContent(): Promise<boolean> {
    const hasContent = await this.page.evaluate(() => {
      const text = document.body.innerText;
      return (
        text.includes("Order") ||
        text.includes("Purchase") ||
        text.includes("구매") ||
        text.includes("No ") ||
        text.includes("empty")
      );
    });
    return hasContent;
  }

  /**
   * Package 페이지 콘텐츠 확인
   */
  async verifyPackageContent(): Promise<boolean> {
    const pageText = await this.page.evaluate(() => document.body.innerText);
    return (
      pageText.includes("패키지") ||
      pageText.includes("Package") ||
      pageText.includes("패키징") ||
      pageText.includes("Packaging") ||
      pageText.includes("배송")
    );
  }

  /**
   * About 페이지 콘텐츠 상세 검증
   * 서비스 설명, 브랜드명, 스폰서 정보를 개별적으로 확인
   */
  async verifyAboutContent(): Promise<{
    hasBrandName: boolean;
    hasServiceDescription: boolean;
    hasSponsor: boolean;
  }> {
    const pageText = await this.page.evaluate(() => document.body.innerText);

    return {
      hasBrandName: pageText.includes("AlbumBuddy"),
      hasServiceDescription: /proxy buying|shipping service|구매 대행/i.test(
        pageText,
      ),
      hasSponsor: pageText.includes("MAKESTAR"),
    };
  }

  /**
   * Pricing 페이지 콘텐츠 상세 검증
   * 실제 가격 값, 서비스 항목, 요금 구조를 개별적으로 확인
   */
  async verifyPricingPageContent(): Promise<{
    hasTitle: boolean;
    hasPriceValues: boolean;
    hasServiceItems: boolean;
    hasShippingCalculator: boolean;
  }> {
    const pageText = await this.page.evaluate(() => document.body.innerText);

    // 실제 가격 값이 있는지 ($숫자 패턴)
    const hasPriceValues = /\$\s*\d+\.\d{2}/.test(pageText);

    // 핵심 서비스 항목 확인
    const serviceItems = [
      "Package Consolidation",
      "Repackaging",
      "Storage",
      "Online shop",
    ];
    const foundServices = serviceItems.filter((item) =>
      pageText.includes(item),
    );

    return {
      hasTitle: pageText.includes("Service Pricing"),
      hasPriceValues,
      hasServiceItems: foundServices.length >= 2,
      hasShippingCalculator: pageText.includes("Shipping fee calculator"),
    };
  }

  /**
   * Dashboard 콘텐츠 상세 검증
   * 단순 텍스트 길이 대신 고유 UI 요소 확인
   */
  async verifyDashboardDetailContent(): Promise<{
    hasOrderTabs: boolean;
    hasStatusCounters: boolean;
    hasPaymentSection: boolean;
    notFound: boolean;
  }> {
    const pageText = await this.page.evaluate(() => document.body.innerText);

    // 주문 탭 확인
    const hasOrderTabs =
      pageText.includes("My orders") || pageText.includes("My packages");

    // 상태 카운터 확인 (Waiting, Pending, Paid 등)
    const statusLabels = [
      "Waiting",
      "Pending",
      "Paid",
      "Ordered",
      "Shipment",
      "Canceled",
    ];
    const foundStatuses = statusLabels.filter((s) => pageText.includes(s));
    const hasStatusCounters = foundStatuses.length >= 3;

    // 결제 섹션 확인
    const hasPaymentSection =
      pageText.includes("Total") && /\$\s*\d+\.\d{2}/.test(pageText);

    return {
      hasOrderTabs,
      hasStatusCounters,
      hasPaymentSection,
      notFound:
        pageText.toLowerCase().includes("not found") ||
        pageText.toLowerCase().includes("404"),
    };
  }

  /**
   * Purchasing 페이지 콘텐츠 상세 검증
   * 구매 내역 UI 고유 요소 확인
   */
  async verifyPurchasingDetailContent(): Promise<{
    hasOrderTable: boolean;
    hasItemColumns: boolean;
    hasCostBreakdown: boolean;
  }> {
    const pageText = await this.page.evaluate(() => document.body.innerText);

    // 데스크톱 테이블 헤더 확인
    const tableHeaders = ["Vendor", "Item", "Quantity", "Price"];
    const foundHeaders = tableHeaders.filter((h) => pageText.includes(h));
    const hasOrderTable = foundHeaders.length >= 2;

    // 모바일은 카드형 목록으로 렌더링될 수 있으므로 개별 아이템 카드도 허용
    const productImageCount = await this.page
      .locator('img[alt="image"], img[alt="componentImage"]')
      .count()
      .catch(() => 0);
    const quantityFieldCount = await this.page
      .getByRole("textbox")
      .count()
      .catch(() => 0);
    const hasMobileItemCard =
      productImageCount > 0 &&
      quantityFieldCount > 0 &&
      /\$\s*\d+(\.\d+)?/.test(pageText);

    // 항목 컬럼 존재
    const hasItemColumns =
      pageText.includes("No items registered") ||
      hasOrderTable ||
      hasMobileItemCard;

    // 비용 내역 확인
    const costItems = ["Item cost", "Assisted purchasing fee", "Total"];
    const foundCosts = costItems.filter((c) => pageText.includes(c));
    const hasCostBreakdown = foundCosts.length >= 2;

    return {
      hasOrderTable,
      hasItemColumns,
      hasCostBreakdown,
    };
  }

  /**
   * Package 페이지 콘텐츠 상세 검증
   */
  async verifyPackageDetailContent(): Promise<{
    hasPackageTab: boolean;
    hasPackageContent: boolean;
  }> {
    const pageText = await this.page.evaluate(() => document.body.innerText);

    return {
      hasPackageTab: pageText.includes("My packages"),
      hasPackageContent:
        pageText.includes("Package") ||
        pageText.includes("패키지") ||
        pageText.includes("Shipping") ||
        pageText.includes("배송"),
    };
  }

  // --------------------------------------------------------------------------
  // 검색 기능 메서드
  // --------------------------------------------------------------------------

  /**
   * 검색 입력창 열기 (돋보기 아이콘 클릭)
   */
  async openSearch(): Promise<boolean> {
    try {
      // 검색 버튼/아이콘 찾기
      const searchButton = this.page
        .locator(
          '[aria-label*="search" i], [class*="search"] button, button:has(svg), .search-icon',
        )
        .first();
      if (await searchButton.isVisible({ timeout: 5000 })) {
        await searchButton.click();
        await this.wait(1000);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * 검색어 입력 및 검색 실행
   */
  async search(
    query: string,
  ): Promise<{
    success: boolean;
    hasResults: boolean;
    resultCount: number;
    finalUrl: string;
  }> {
    try {
      let searchInput = this.page
        .locator(
          'input[placeholder*="검색"], input[placeholder*="search" i], input[type="search"], textbox[name*="search" i]',
        )
        .first();

      if (!(await searchInput.isVisible({ timeout: 5000 }))) {
        await this.openSearch();
        searchInput = this.page
          .locator(
            'input[placeholder*="검색"], input[placeholder*="search" i], input[type="search"], textbox[name*="search" i]',
          )
          .first();
      }

      const inputVisible = await searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      if (!inputVisible) {
        return {
          success: false,
          hasResults: false,
          resultCount: 0,
          finalUrl: this.currentUrl,
        };
      }

      await searchInput.fill(query);
      await this.wait(500);
      await searchInput.press("Enter");
      await this.page
        .waitForFunction(
          (expected) => {
            const url = window.location.href;
            const text = (document.body?.innerText || "").replace(/\s+/g, " ");
            return (
              url.includes("/search/result") ||
              url.toLowerCase().includes(encodeURIComponent(expected).toLowerCase()) ||
              /there are no matching artists|total\s+\d+/i.test(text)
            );
          },
          query,
          { timeout: 10000 },
        )
        .catch(() => {});
      await this.wait(1000);

      const pageText = await this.page.evaluate(() => document.body.innerText);
      const finalUrl = this.currentUrl;

      const noResultsIndicators = [
        "No results",
        "검색 결과가 없",
        "결과가 없습니다",
        "not found",
        "0 result",
        "찾을 수 없",
        "There are no matching artists",
        "Total 0",
      ];

      const hasNoResults = noResultsIndicators.some((indicator) =>
        pageText.toLowerCase().includes(indicator.toLowerCase()),
      );

      const resultCount = await this.getVisibleProductCardCount();
      const albumTotalMatch = pageText.match(/Album\s+Total\s+(\d+)/i);
      const albumTotal = albumTotalMatch ? Number(albumTotalMatch[1]) : 0;
      const onSearchResultPage =
        finalUrl.includes("/search/result") ||
        finalUrl.includes("/artist/") ||
        finalUrl.includes("/buddy-shop") ||
        finalUrl.toLowerCase().includes(encodeURIComponent(query).toLowerCase());
      const hasResults = !hasNoResults && (albumTotal > 0 || resultCount > 0);

      return {
        success: onSearchResultPage || hasNoResults || hasResults,
        hasResults,
        resultCount: Math.max(albumTotal, resultCount),
        finalUrl,
      };
    } catch {
      return {
        success: false,
        hasResults: false,
        resultCount: 0,
        finalUrl: this.currentUrl,
      };
    }
  }

  /**
   * 첫 상품의 검색 키워드 추출
   */
  async getFirstProductKeyword(): Promise<string> {
    const artistKeyword = await this.page.evaluate(() => {
      const imageTiles = Array.from(
        document.querySelectorAll('img[alt="image"]'),
      ) as HTMLImageElement[];

      for (const image of imageTiles) {
        const container = image.closest("div");
        const text = (container?.textContent || "").replace(/\s+/g, " ").trim();
        if (!text) continue;
        if (text.includes("$")) continue;
        if (text.length > 40) continue;
        if (/show more|artists|trending/i.test(text)) continue;
        return text;
      }

      return "";
    });

    if (artistKeyword) {
      return artistKeyword;
    }

    const albumGridProduct = this.page.locator(".album__grid > div > div").first();
    const visible = await albumGridProduct
      .isVisible({ timeout: this.timeouts.medium })
      .catch(() => false);
    if (!visible) {
      return "";
    }

    const rawText = ((await albumGridProduct.textContent().catch(() => "")) || "")
      .replace(/\s+/g, " ")
      .trim();
    const productName = rawText.split("$")[0].trim();
    if (!productName) {
      return "";
    }

    return productName.substring(0, 40).trim();
  }

  /**
   * 검색 결과가 없는지 확인
   */
  async verifyNoSearchResults(): Promise<boolean> {
    const pageText = await this.page.evaluate(() => document.body.innerText);
    return (
      pageText.includes("No results") ||
      pageText.includes("검색 결과가 없습니다") ||
      pageText.includes("not found") ||
      pageText.includes("0 result")
    );
  }

  /**
   * 검색 자동완성 확인
   */
  async verifySearchAutocomplete(
    query: string,
  ): Promise<{ hasDropdown: boolean; suggestionCount: number }> {
    try {
      const searchInput = this.page
        .locator('input[type="search"], input[placeholder*="search" i]')
        .first();

      if (!(await searchInput.isVisible({ timeout: 3000 }))) {
        await this.openSearch();
      }

      await searchInput.fill(query);
      await this.wait(1500);

      // 자동완성 드롭다운 확인
      const dropdown = this.page
        .locator(
          '[class*="autocomplete"], [class*="suggestion"], [class*="dropdown"], [role="listbox"]',
        )
        .first();
      const hasDropdown = await dropdown
        .isVisible({ timeout: 3000 })
        .catch(() => false);

      let suggestionCount = 0;
      if (hasDropdown) {
        suggestionCount = await this.page
          .locator(
            '[class*="autocomplete"] li, [class*="suggestion"] li, [role="option"]',
          )
          .count();
      }

      return { hasDropdown, suggestionCount };
    } catch {
      return { hasDropdown: false, suggestionCount: 0 };
    }
  }

  // --------------------------------------------------------------------------
  // 상품 상세 페이지 메서드
  // --------------------------------------------------------------------------

  /**
   * 첫 번째 상품 클릭하여 상세 페이지로 이동
   * 주의: 배너 이미지가 아닌 실제 상품 카드를 클릭해야 함
   */
  async clickFirstProduct(): Promise<{
    success: boolean;
    productName: string;
  }> {
    try {
      // 페이지 로드 대기
      await this.wait(3000);

      // 팝업 닫기 (있으면)
      const closeButton = this.page.locator("text=Close").first();
      if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeButton.click();
        await this.wait(1000);
      }

      // 스크롤 다운하여 상품 섹션 노출
      await this.page.evaluate(() => window.scrollBy(0, 500));
      await this.wait(1000);

      // 방법 1: "전체 앨범" 그리드의 첫 번째 상품 클릭 (가장 신뢰성 높음)
      const albumGridProduct = this.page
        .locator(".album__grid > div > div")
        .first();
      if (
        await albumGridProduct.isVisible({ timeout: 5000 }).catch(() => false)
      ) {
        const text = (await albumGridProduct.textContent()) || "";
        const productName = text.split("$")[0].trim().substring(0, 50);
        await albumGridProduct.click();
        await this.wait(2000);

        // URL 확인
        if (this.currentUrl.includes("/product/")) {
          return { success: true, productName };
        }
      }

      // 방법 2: 가격($)이 있고 이미지(alt="image")가 있는 상품 클릭
      const productCards = this.page.locator(
        'div:has(img[alt="image"]):has(p:has-text("$"))',
      );
      const count = await productCards.count();

      for (let i = 0; i < Math.min(count, 20); i++) {
        const card = productCards.nth(i);
        const text = (await card.textContent()) || "";

        // 배너 관련 텍스트 제외
        if (text.includes("Banner") || text.includes("배너")) {
          continue;
        }

        // 가격이 포함된 상품만
        if (text.includes("$") && text.length > 10) {
          const productName = text.split("$")[0].trim().substring(0, 50);
          await card.click();
          await this.wait(2000);

          if (this.currentUrl.includes("/product/")) {
            return { success: true, productName };
          }
        }
      }

      return { success: false, productName: "" };
    } catch (e) {
      console.log("clickFirstProduct error:", e);
      return { success: false, productName: "" };
    }
  }

  /**
   * 실제로 로드된 상세 이미지를 가진 상품을 찾아 상세 페이지로 이동
   * 모니터링 관점에서 "첫 상품"보다 "이미지 검증 가능한 상품"을 우선 선택합니다.
   */
  async clickProductWithLoadedImage(
    maxCandidates: number = 4,
  ): Promise<{
    success: boolean;
    productName: string;
  }> {
    await this.gotoHome({ waitForNetworkIdle: false });
    await this.page.evaluate(() => window.scrollBy(0, 500));
    await this.waitForContentStable("body", {
      timeout: this.timeouts.short,
      stableTime: 300,
    }).catch(() => {});
    await this.waitForProductCandidatesReady();

    const gridCards = this.page.locator(".album__grid > div > div");
    const fallbackCards = this.page.locator(
      'div:has(img[alt="image"]):has(p:has-text("$"))',
    );
    const gridCount = await gridCards.count().catch(() => 0);
    const fallbackCount = await fallbackCards.count().catch(() => 0);
    const candidateCards = gridCount > 1 ? gridCards : fallbackCards;
    const attemptCount = Math.min(
      gridCount > 1 ? gridCount : fallbackCount,
      maxCandidates,
    );

    for (let i = 0; i < attemptCount; i += 1) {
      if (i > 0) {
        // 상품 상세 -> 뒤로 복귀가 간헐적으로 빈 화면에 머물러
        // 다음 후보 탐색이 끊기므로, 매번 Shop을 다시 열어 후보를 재탐색합니다.
        await this.gotoHome({ waitForNetworkIdle: false });
        await this.page.evaluate(() => window.scrollBy(0, 500));
        await this.waitForContentStable("body", {
          timeout: this.timeouts.short,
          stableTime: 300,
        }).catch(() => {});
        await this.waitForProductCandidatesReady();
      }

      const card = candidateCards.nth(i);
      const visible = await card
        .isVisible({ timeout: this.timeouts.medium })
        .catch(() => false);
      if (!visible) {
        continue;
      }

      const text = ((await card.textContent().catch(() => "")) || "").trim();
      if (text.includes("Banner") || text.includes("배너")) {
        continue;
      }
      const productName = text.split("$")[0].trim().substring(0, 50);

      await card.scrollIntoViewIfNeeded().catch(() => {});
      await card.click({ timeout: this.timeouts.medium }).catch(() => {});
      await this.waitForUrlContains(/\/product\//, this.timeouts.medium).catch(
        () => {},
      );
      await this.waitForProductDetailReady();

      if (!this.currentUrl.includes("/product/")) {
        continue;
      }

      const imageLoaded = await this.verifyProductImageLoaded();
      if (imageLoaded) {
        // SPA 전환 직후 이전 목록 DOM이 잠깐 남아 false positive가 날 수 있어
        // 상세 페이지가 안정된 뒤 한 번 더 확인합니다.
        await this.waitForContentStable("body", {
          timeout: this.timeouts.short,
          stableTime: 400,
        }).catch(() => {});
        const stableImageLoaded = await this.verifyProductImageLoaded();
        if (!stableImageLoaded) {
          console.warn(
            `상품 ${i + 1}번은 전환 직후 이미지만 보여 false positive로 판정됨 — 다음 상품 시도`,
          );
          continue;
        }
        return { success: true, productName };
      }

      console.warn(
        `상품 ${i + 1}번은 상세 이미지 검증 실패 — 다음 상품 시도`,
      );
    }

    return { success: false, productName: "" };
  }

  private async waitForProductCandidatesReady(): Promise<void> {
    await this.page
      .waitForFunction(
        () => {
          const gridCardCount = document.querySelectorAll(
            ".album__grid > div > div",
          ).length;
          const hasPricedImage = Array.from(
            document.querySelectorAll('img[alt="image"]'),
          ).some((image) => image.closest("div")?.textContent?.includes("$"));

          return gridCardCount > 0 || hasPricedImage;
        },
        undefined,
        { timeout: this.timeouts.long },
      )
      .catch(() => {});
  }

  private async waitForProductDetailReady(): Promise<void> {
    await this.page
      .waitForFunction(
        () => {
          const text = document.body.innerText || "";
          const hasPrice = /\$\s*\d+(\.\d+)?/.test(text);
          const hasDetailMarker =
            /add to assisted purchase|go to vendor/i.test(text);
          const hasProductImage =
            document.querySelectorAll(
              'img[alt="image"], img[alt="componentImage"]',
            ).length > 0;

          return hasPrice && hasDetailMarker && hasProductImage;
        },
        undefined,
        { timeout: this.timeouts.long },
      )
      .catch(() => {});

    await this.waitForContentStable("body", {
      timeout: this.timeouts.short,
      stableTime: 300,
    }).catch(() => {});
  }

  /**
   * 상품 상세 페이지 요소 확인
   * AlbumBuddy 상품 페이지 구조: /product/{uuid}?tab=description
   */
  async verifyProductDetailPage(): Promise<{
    hasImage: boolean;
    hasPrice: boolean;
    hasTitle: boolean;
    hasAddToCartButton: boolean;
  }> {
    await this.wait(1000);

    // URL이 상품 상세 페이지인지 확인
    const currentUrl = this.currentUrl;
    const isProductPage = currentUrl.includes("/product/");

    if (!isProductPage) {
      return {
        hasImage: false,
        hasPrice: false,
        hasTitle: false,
        hasAddToCartButton: false,
      };
    }

    await this.page
      .waitForFunction(() => {
        const text = document.body.innerText || "";
        const hasImage = document.querySelectorAll(
          'img[alt="image"], img[alt="componentImage"]',
        ).length > 0;
        const hasPrice = /\$\s*\d+(\.\d+)?/.test(text);
        const hasAction = /add to assisted purchasing|assisted/i.test(text);
        return hasImage || hasPrice || hasAction;
      })
      .catch(() => {});

    // 이미지 확인 (모바일에서는 viewport 밖이거나 lazy-load일 수 있어 visible만으로 보지 않음)
    const productImages = this.page.locator(
      'img[alt="image"], img[alt="componentImage"]',
    );
    const imageCount = await productImages.count().catch(() => 0);
    let hasImage = false;
    if (imageCount > 0) {
      const firstImg = productImages.first();
      const naturalWidth = await firstImg
        .evaluate((img: HTMLImageElement) => img.naturalWidth)
        .catch(() => 0);
      const visible = await firstImg.isVisible({ timeout: 3000 }).catch(() => false);
      hasImage = naturalWidth > 0 || visible;
    }

    // 가격 확인 ($ 기호가 있는 요소)
    const pageText = await this.page.evaluate(() => document.body.innerText);
    const hasPrice =
      /\$\s*\d+(\.\d+)?/.test(pageText) ||
      (await this.page
        .locator('text=/\\$\\s*\\d+(\\.\\d+)?/')
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false));

    // 타이틀/상품명 확인 (상품 제목이 포함된 요소)
    const hasTitle =
      (await this.page
        .locator(
          'generic:has-text("Album"), generic:has-text("앨범"), generic:has-text("Mini Album"), generic:has-text("Single")',
        )
        .first()
        .isVisible({ timeout: 3000 })
        .catch(() => false)) ||
      pageText.includes("Album") ||
      pageText.includes("Mini") ||
      pageText.includes("Single");

    // 구매 버튼 확인 (AlbumBuddy는 "Add to assisted purchasing" 버튼 사용)
    const hasAddToCartButton = await this.page
      .locator(
        'button:has-text("Add to assisted purchasing"), button:has-text("assisted"), button:has-text("구매 대행")',
      )
      .first()
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    return { hasImage, hasPrice, hasTitle, hasAddToCartButton };
  }

  /**
   * 상품 이미지 로드 확인
   * AlbumBuddy 상품 페이지에서 이미지가 실제로 로드되었는지 확인
   */
  async verifyProductImageLoaded(): Promise<boolean> {
    // URL이 상품 상세 페이지인지 확인
    const currentUrl = this.currentUrl;
    if (!currentUrl.includes("/product/")) {
      return false;
    }

    await this.page
      .waitForFunction(
        () => {
          const text = document.body.innerText || "";
          const hasPrice = /\$\s*\d+(\.\d+)?/.test(text);
          const hasDetailMarker =
            /add to assisted purchase|go to vendor/i.test(text);
          return hasPrice && hasDetailMarker;
        },
        { timeout: this.timeouts.medium },
      )
      .catch(() => {});
    await this.waitForContentStable("body", {
      timeout: this.timeouts.short,
      stableTime: 300,
    }).catch(() => {});

    const selector = 'img[alt="image"], img[alt="componentImage"]';
    const hasLoadedSubstantialImage = async (): Promise<boolean> =>
      this.page
        .evaluate((imageSelector: string) => {
          const images = Array.from(
            document.querySelectorAll(imageSelector),
          ) as HTMLImageElement[];

          return images.some((img) => {
            const style = window.getComputedStyle(img);
            const rect = img.getBoundingClientRect();
            const loaded = img.complete && img.naturalWidth > 0;
            const visible =
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width >= 120 &&
              rect.height >= 120;

            return loaded && visible;
          });
        }, selector)
        .catch(() => false);

    const initialLoaded = await hasLoadedSubstantialImage();
    if (initialLoaded) {
      return true;
    }

    await this.page
      .waitForFunction(
        (imageSelector: string) => {
          const images = Array.from(
            document.querySelectorAll(imageSelector),
          ) as HTMLImageElement[];

          return images.some((img) => {
            const style = window.getComputedStyle(img);
            const rect = img.getBoundingClientRect();
            const loaded = img.complete && img.naturalWidth > 0;
            const visible =
              style.display !== "none" &&
              style.visibility !== "hidden" &&
              rect.width >= 120 &&
              rect.height >= 120;

            return loaded && visible;
          });
        },
        selector,
        { timeout: this.timeouts.medium },
      )
      .catch(async () => {
        const debugStates = await this.page
          .evaluate((imageSelector: string) => {
            return Array.from(
              document.querySelectorAll(imageSelector),
            )
              .slice(0, 8)
              .map((node, index) => {
                const img = node as HTMLImageElement;
                const style = window.getComputedStyle(img);
                const rect = img.getBoundingClientRect();
                return {
                  index,
                  alt: img.getAttribute("alt"),
                  complete: img.complete,
                  naturalWidth: img.naturalWidth,
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                  display: style.display,
                  visibility: style.visibility,
                  top: Math.round(rect.top),
                  src: (img.getAttribute("src") || "").slice(0, 120),
                };
              });
          }, selector)
          .catch(() => []);

        console.warn(
          `AlbumBuddy 상세 이미지 로드 실패 상태: ${JSON.stringify(debugStates)}`,
        );
      });

    return hasLoadedSubstantialImage();
  }
}
