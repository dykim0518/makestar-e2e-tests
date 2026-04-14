/**
 * MakestarPage - Makestar.com 페이지 객체
 *
 * 이 클래스는 Makestar 웹사이트의 모든 페이지 상호작용을 캡슐화합니다.
 */

import { Page, Locator, expect } from "@playwright/test";
import {
  BasePage,
  DEFAULT_TIMEOUTS,
  TimeoutConfig,
  ElementSearchResult,
} from "./base.page";

// ============================================================================
// 타입 정의
// ============================================================================

/** 메뉴 항목 타입 */
export type MenuItem = {
  name: string;
  texts: readonly string[];
};

/** 상품 정보 타입 */
export type ProductInfo = {
  name?: string;
  price?: string;
  hasOptions: boolean;
};

/** Shop -> 상품 상세 -> 아티스트 페이지 이동 결과 */
export type ArtistProfileNavigationResult = {
  success: boolean;
  productIndex?: number;
  detailUrl?: string;
  artistUrl?: string;
  selector?: string;
  reason?: string;
};

/** Web Vitals 측정 결과 타입 */
export type WebVitalsResult = {
  /** First Contentful Paint (ms) */
  fcp: number;
  /** Largest Contentful Paint (ms) */
  lcp: number;
  /** Time to First Byte (ms) */
  ttfb: number;
  /** DOM Content Loaded (ms) */
  dcl: number;
  /** Load Complete (ms) */
  load: number;
  /** Cumulative Layout Shift */
  cls: number;
};

// ============================================================================
// 텍스트 패턴
// ============================================================================

export const MAKESTAR_TEXT_PATTERNS = {
  ENDED_TAB: ["종료된", "Ended", "Closed", "Past", "종료"] as const,
  ONGOING_TAB: ["진행중", "Ongoing", "진행", "ongoing"] as const,
  OPTION_SELECT: [
    "옵션",
    "Option",
    "option",
    "선택",
    "Select",
    "select",
  ] as const,
  QUANTITY: ["수량", "Quantity", "quantity", "개수"] as const,
} as const;

// ============================================================================
// MakestarPage 클래스
// ============================================================================

export class MakestarPage extends BasePage {
  // URL 정의
  readonly baseUrl =
    process.env.MAKESTAR_BASE_URL || "https://www.makestar.com";

  // --------------------------------------------------------------------------
  // 로케이터 정의 (멤버 변수)
  // --------------------------------------------------------------------------

  // 공통 요소
  readonly logo: Locator;
  readonly header: Locator;
  readonly navigation: Locator;

  // 검색 요소
  readonly searchButton: Locator;
  readonly searchInput: Locator;
  readonly cancelButton: Locator;

  // 네비게이션 버튼
  readonly homeButton: Locator;
  readonly eventButton: Locator;
  readonly shopButton: Locator;
  readonly fundingButton: Locator;

  // 프로필/인증 요소
  readonly profileButton: Locator;
  readonly googleLoginButton: Locator;
  readonly logoutButton: Locator;

  // 상품 관련 요소
  readonly eventCard: Locator;
  readonly shopProductCard: Locator;
  readonly quantityInput: Locator;
  readonly quantityPlusButton: Locator;
  readonly purchaseButton: Locator;
  readonly addToCartButton: Locator;

  // 장바구니 요소
  readonly cartItem: Locator;
  readonly cartCheckbox: Locator;
  readonly cartDeleteButton: Locator;

  // 검색 결과/필터 요소
  readonly searchResultCards: Locator;
  readonly filterTabs: Locator;
  readonly contentImages: Locator;

  constructor(page: Page, timeouts: TimeoutConfig = DEFAULT_TIMEOUTS) {
    super(page, timeouts);

    // 공통 요소 초기화
    this.logo = page
      .locator('img[alt="make-star"], img[alt*="makestar"]')
      .first();
    this.header = page.locator("header").first();
    this.navigation = page.locator('nav, header, [class*="nav"]').first();

    // 검색 요소 초기화
    // 검색 버튼: SVG use href="#icon-search-line"을 포함하는 버튼
    this.searchButton = page
      .locator(
        'button:has(svg use[href="#icon-search-line"]), button.icon-style:has(svg)',
      )
      .first();
    this.searchInput = page.getByPlaceholder(
      /검색어를 입력|검색|search|Enter a keyword|keyword/i,
    );
    this.cancelButton = page
      .locator('button:has-text("취소"), button:has-text("Cancel")')
      .first();

    // GNB 네비게이션 링크 초기화
    // 실제 DOM 구조: <li><a href="/shop">Shop</a></li>
    // <button>이 아닌 <a> 태그이므로 getByRole("link") 사용
    // (2026-03-19 확인: getByRole("button") → count=0, getByRole("link") → count=1)
    this.homeButton = page.getByRole("link", { name: "Home", exact: true });
    this.eventButton = page.getByRole("link", { name: "Event", exact: true });
    this.shopButton = page.getByRole("link", { name: "Shop", exact: true });
    this.fundingButton = page.getByRole("link", {
      name: "Funding",
      exact: true,
    });

    // 프로필/인증 요소 초기화
    // 로그인: a[href="/my-page"].icon-style (GNB 프로필 링크)
    // 비로그인: button > SVG icon-profile-line
    // 주의: header/nav 태그 없음 — Nuxt SPA이므로 div 기반 GNB
    this.profileButton = page
      .locator(
        'a[href="/my-page"][class*="icon-style"], a[href="/my-page"]:has(img[alt="profile"]), button:has(svg use[href="#icon-profile-line"])',
      )
      .first();
    this.googleLoginButton = page
      .locator('button:has-text("Google"), [class*="google"]')
      .first();
    this.logoutButton = page
      .locator("text=/로그아웃|logout|log out|sign out/i")
      .first();

    // 상품 관련 요소 초기화
    this.eventCard = page.locator('img[alt="event-thumb-image"]').first();
    this.shopProductCard = page.locator('img[alt="album_image"]');
    this.quantityInput = page
      .locator('input[type="number"], [class*="quantity"] input')
      .first();
    this.quantityPlusButton = page
      .locator('button:has-text("+"), [class*="plus"]')
      .first();
    this.purchaseButton = page
      .locator(
        'button:has-text("purchase"), button:has-text("구매"), button:has-text("buy")',
      )
      .first();
    this.addToCartButton = page
      .locator(
        'button:has-text("장바구니"), button:has-text("cart"), button:has-text("Cart")',
      )
      .first();

    // 장바구니 요소 초기화
    this.cartItem = page.locator('img[alt="album"]');
    this.cartCheckbox = page.locator('input[type="checkbox"]');
    this.cartDeleteButton = page.locator('button:has-text("Delete")');

    // 검색 결과/필터 요소 초기화
    this.searchResultCards = page.locator(
      'img[alt="album_image"], img[alt="sample_image"], img[alt="event-thumb-image"]',
    );
    this.filterTabs = page.locator(
      '[role="tablist"] [role="tab"], [class*="tab"], button:has-text("전체"), button:has-text("All")',
    );

    // 콘텐츠 요소 초기화
    this.contentImages = page.locator(
      'img[alt="sample_image"], img[alt="event-thumb-image"], img[alt="album_image"]',
    );
  }

  // --------------------------------------------------------------------------
  // 페이지 네비게이션 메서드
  // --------------------------------------------------------------------------

  /** 홈페이지로 이동 */
  async gotoHome(): Promise<void> {
    await this.goto(this.baseUrl);
    await this.waitForLoadState("domcontentloaded");
    await this.handleModal();
  }

  /** 이벤트 페이지로 이동 */
  async gotoEvent(): Promise<void> {
    await this.goto(`${this.baseUrl}/event#1`);
    await this.waitForLoadState("domcontentloaded");
    await this.handleModal();
  }

  /** 샵 페이지로 이동 */
  async gotoShop(): Promise<void> {
    await this.goto(`${this.baseUrl}/shop`);
    await this.waitForLoadState("domcontentloaded");
    await this.handleModal();
  }

  /** 펀딩 페이지로 이동 */
  async gotoFunding(): Promise<void> {
    await this.goto(`${this.baseUrl}/funding#0`);
    await this.waitForLoadState("domcontentloaded");
    await this.handleModal();
  }

  /** 마이페이지로 이동 (리다이렉트 대응 포함, 인증 실패 시 즉시 에러) */
  async gotoMyPage(): Promise<void> {
    // Step 1: SPA auth 프라이밍 — 홈페이지 먼저 방문하여 클라이언트 auth 상태 초기화
    if (!this.currentUrl.includes("makestar.com")) {
      await this.goto(`${this.baseUrl}/`);
      await this.waitForLoadState("domcontentloaded");
      await this.waitForNetworkStable(3000).catch(() => {});
    }

    // Step 2: 마이페이지 메인으로 이동
    await this.goto(`${this.baseUrl}/my-page`);
    await this.waitForLoadState("domcontentloaded");
    await this.waitForNetworkStable(5000).catch(() => {});
    await this.handleModal();

    // 정확히 /my-page에 도달했으면 완료
    if (this.currentUrl.includes("my-page")) return;

    // Step 3: 리다이렉트됨 — CI 환경에서 SPA auth 미인식 가능성
    // 하위 페이지 방문으로 auth 상태 프라이밍 시도
    console.log(
      `⚠️ 마이페이지 리다이렉트됨 (현재: ${this.currentUrl}), 워밍업 시도...`,
    );
    const warmupPaths = [
      "/my-page/change-password",
      "/my-page/event-submissions",
    ];
    for (const path of warmupPaths) {
      await this.goto(`${this.baseUrl}${path}`);
      await this.waitForLoadState("domcontentloaded");
      await this.waitForNetworkStable(3000).catch(() => {});
    }

    // 워밍업 후에도 my-page 영역이 아니면 인증 실패 확정
    if (!this.page.url().includes("my-page")) {
      throw new Error(
        `마이페이지 인증 실패: storageState 쿠키가 만료되었거나 SPA auth를 인식하지 못합니다. 현재 URL: ${this.page.url()}`,
      );
    }

    // Step 4: 워밍업 성공 → /my-page 메인으로 재시도
    console.log("✅ auth 워밍업 성공, /my-page 재시도");
    await this.goto(`${this.baseUrl}/my-page`);
    await this.waitForLoadState("domcontentloaded");
    await this.waitForNetworkStable(5000).catch(() => {});
    await this.handleModal();
  }

  /** 장바구니 페이지로 이동 */
  async gotoCart(): Promise<void> {
    await this.goto(`${this.baseUrl}/cart`);
    await this.waitForLoadState("domcontentloaded");
    await this.handleModal();
  }

  /** 주문내역 페이지로 이동 (리다이렉트 대응 포함) */
  async gotoOrderHistory(): Promise<void> {
    await this.goto(`${this.baseUrl}/my-page/order-history`);
    await this.waitForLoadState("domcontentloaded");
    await this.waitForNetworkStable(5000).catch(() => {});
    await this.handleModal();

    // 마이페이지 접속 실패 시 재시도
    if (!this.currentUrl.includes("my-page")) {
      console.warn("⚠️ 주문내역 페이지 리다이렉트됨, 재시도...");
      await this.goto(`${this.baseUrl}/my-page/order-history`);
      await this.waitForLoadState("domcontentloaded");
      await this.waitForNetworkStable(5000).catch(() => {});
      await this.handleModal();
    }
  }

  /** 배송지 관리 페이지로 이동 (리다이렉트 대응 포함) */
  async gotoAddress(): Promise<void> {
    await this.goto(`${this.baseUrl}/my-page/address`);
    await this.waitForLoadState("domcontentloaded");
    await this.waitForNetworkStable(5000).catch(() => {});
    await this.handleModal();

    // 마이페이지 접속 실패 시 재시도
    if (!this.currentUrl.includes("my-page")) {
      console.warn("⚠️ 배송지 관리 페이지 리다이렉트됨, 재시도...");
      await this.goto(`${this.baseUrl}/my-page/address`);
      await this.waitForLoadState("domcontentloaded");
      await this.waitForNetworkStable(5000).catch(() => {});
      await this.handleModal();
    }
  }

  /** 팔로우 관리 페이지로 이동 (리다이렉트 대응 포함) */
  async gotoFollow(): Promise<void> {
    await this.goto(`${this.baseUrl}/my-page/follow`);
    await this.waitForLoadState("domcontentloaded");
    await this.waitForNetworkStable(5000).catch(() => {});
    await this.handleModal();

    if (!this.currentUrl.includes("my-page")) {
      console.warn("⚠️ 팔로우 관리 페이지 리다이렉트됨, 재시도...");
      await this.goto(`${this.baseUrl}/my-page/follow`);
      await this.waitForLoadState("domcontentloaded");
      await this.waitForNetworkStable(5000).catch(() => {});
      await this.handleModal();
    }
  }

  /** 알림 설정 페이지로 이동 (리다이렉트 대응 포함) */
  async gotoNotification(): Promise<void> {
    await this.goto(`${this.baseUrl}/my-page/notification`);
    await this.waitForLoadState("domcontentloaded");
    await this.waitForNetworkStable(5000).catch(() => {});
    await this.handleModal();

    if (!this.currentUrl.includes("my-page")) {
      console.warn("⚠️ 알림 설정 페이지 리다이렉트됨, 재시도...");
      await this.goto(`${this.baseUrl}/my-page/notification`);
      await this.waitForLoadState("domcontentloaded");
      await this.waitForNetworkStable(5000).catch(() => {});
      await this.handleModal();
    }
  }

  // --------------------------------------------------------------------------
  // GNB 버튼 클릭 네비게이션 (사용자 시나리오 기반, URL 직접 이동 없음)
  // --------------------------------------------------------------------------

  /**
   * GNB 버튼 클릭 전 모달/오버레이 완전 제거
   * locator 기반으로 오버레이 감지 (page.evaluate 사용하지 않아 네비게이션 중 context 파괴에 안전)
   * 텍스트 버튼 → Escape 키 → JS 강제 제거 순으로 시도
   */
  private async dismissAllBlockingModals(): Promise<void> {
    const overlayLocator = this._page.locator('div.fixed[class*="z-[40]"]');

    for (let i = 0; i < 3; i++) {
      // 1) locator 기반 오버레이 존재 확인 (context 파괴에 안전)
      const overlayCount = await overlayLocator.count().catch(() => 0);
      if (overlayCount === 0) break;

      // 2) 오버레이 내부에서 닫기 텍스트 클릭 시도
      const closeTexts = [
        "Do not show again",
        "다시 보지 않기",
        "Close",
        "닫기",
        "확인",
      ];
      let dismissed = false;

      for (const text of closeTexts) {
        const closeBtn = overlayLocator.locator(`text=${text}`).first();
        if (await closeBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await closeBtn.click({ force: true }).catch(() => {});
          await this._page.waitForTimeout(300);
          dismissed = true;
          console.log(`✅ 오버레이 닫기: "${text}" 클릭`);
          break;
        }
      }

      if (dismissed) continue;

      // 3) Escape 키 시도
      await this._page.keyboard.press("Escape");
      await this._page.waitForTimeout(300);

      // 4) 여전히 있으면 locator 기반으로 개별 제거 (evaluate 사용하지 않아 context 파괴에 안전)
      const stillCount = await overlayLocator.count().catch(() => 0);
      if (stillCount > 0) {
        for (let j = stillCount - 1; j >= 0; j--) {
          await overlayLocator
            .nth(j)
            .evaluate((el) => el.remove())
            .catch(() => {});
        }
        console.warn("⚠️ 오버레이 locator 기반 제거");
      }
    }
  }

  /** Event 페이지로 이동 (GNB 링크 클릭) */
  async navigateToEvent(): Promise<void> {
    await this.dismissAllBlockingModals();
    try {
      await this.eventButton.click({ timeout: 5000 });
    } catch {
      await this.dismissAllBlockingModals();
      await this.eventButton.click({ timeout: 5000 });
    }
    await this.waitForLoadState("domcontentloaded");
    await this.handleModal();
  }

  /** Shop 페이지로 이동 (GNB 링크 클릭) */
  async navigateToShop(): Promise<void> {
    await this.dismissAllBlockingModals();
    try {
      await this.shopButton.click({ timeout: 5000 });
    } catch {
      await this.dismissAllBlockingModals();
      await this.shopButton.click({ timeout: 5000 });
    }
    await this.waitForLoadState("domcontentloaded");
    await this.handleModal();
  }

  /** Funding 페이지로 이동 (GNB 링크 클릭) */
  async navigateToFunding(): Promise<void> {
    await this.dismissAllBlockingModals();
    try {
      await this.fundingButton.click({ timeout: 5000 });
    } catch {
      await this.dismissAllBlockingModals();
      await this.fundingButton.click({ timeout: 5000 });
    }
    await this.waitForLoadState("domcontentloaded");
    await this.handleModal();
  }

  // --------------------------------------------------------------------------
  // 마이페이지 버튼 클릭 네비게이션 (사용자 시나리오 기반)
  // --------------------------------------------------------------------------

  /**
   * 프로필 버튼 클릭 (단순 버전 - 네비게이션 검증용)
   * @description 프로필 버튼 클릭 → 드롭다운에서 마이페이지 링크 클릭
   * @returns 버튼 클릭 성공 여부와 이동된 URL 정보
   */
  async clickProfileButtonOnce(): Promise<{
    success: boolean;
    url: string;
    reason?: string;
  }> {
    await this.dismissAllBlockingModals();

    let profileBtn = this.profileButton;

    let isVisible = await profileBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!isVisible) {
      // 모바일 폴백: 모바일에서는 프로필 버튼 대신 햄버거 메뉴 버튼 사용
      // (rounded-full 클래스 + SVG를 포함, search 버튼의 icon-style 클래스와 구별)
      profileBtn = this.page
        .locator('button[class*="rounded-full"]:has(svg)')
        .first();
      isVisible = await profileBtn
        .isVisible({ timeout: 3000 })
        .catch(() => false);
    }

    if (!isVisible) {
      return {
        success: false,
        url: this.currentUrl,
        reason: "프로필 버튼을 찾을 수 없음",
      };
    }

    // 1. 프로필 버튼 클릭
    await profileBtn.click({ timeout: 5000 });
    console.log("📍 1단계: 프로필 버튼 클릭");

    // Case A: 로그인 상태에서 a[href*="my-page"] 직접 클릭 → 즉시 네비게이션
    // 네비게이션 또는 드롭다운 중 먼저 발생하는 것을 대기
    await Promise.race([
      this.page.waitForURL(/my-page/, { timeout: 3000 }),
      this.page.waitForSelector(
        'a:has-text("My Page"), a:has-text("마이페이지")',
        { state: "visible", timeout: 3000 },
      ),
    ]).catch(() => {});

    let currentUrl = this.page.url();
    if (currentUrl.includes("my-page")) {
      console.log("📍 프로필 버튼 클릭으로 직접 마이페이지 도달");
      return { success: true, url: currentUrl };
    }

    // Case B: 드롭다운이 나타난 경우 → 마이페이지 링크 클릭
    const myPageLink = this.page
      .locator('a:has-text("My Page"), a:has-text("마이페이지")')
      .first();
    if (await myPageLink.isVisible({ timeout: 1000 }).catch(() => false)) {
      await myPageLink.click({ timeout: 5000 });
      console.log("📍 2단계: 드롭다운 마이페이지 링크 클릭");
      await this.waitForLoadState("domcontentloaded");
      await this.waitForNetworkStable(5000).catch(() => {});
      currentUrl = this.page.url();
      if (currentUrl.includes("my-page")) {
        return { success: true, url: currentUrl };
      }
    }

    // Case C: 로그인 페이지로 리다이렉트 (CI 환경, auth 미인식)
    // gotoMyPage()로 SPA auth 프라이밍 시도
    currentUrl = this.page.url();
    console.log(
      `⚠️ 마이페이지 미도달 (현재: ${currentUrl}), gotoMyPage() 워밍업 시도`,
    );
    await this.gotoMyPage();
    currentUrl = this.page.url();

    if (currentUrl.includes("my-page")) {
      return { success: true, url: currentUrl };
    }

    return {
      success: false,
      url: currentUrl,
      reason: "마이페이지로 이동하지 않음",
    };
  }

  /**
   * 프로필 버튼 클릭 (SSO 흐름 포함 - 실제 사용자 시나리오)
   * @description 프로필 버튼 → 로그인 페이지 → Google 로그인 → 홈 → 다시 프로필 → 마이페이지
   * @returns 최종 결과 (마이페이지 도달 여부)
   */
  async clickProfileButton(): Promise<{
    success: boolean;
    url: string;
    reason?: string;
  }> {
    await this.dismissAllBlockingModals();

    // 1. 첫 번째 프로필 버튼 클릭
    const profileBtn = this.profileButton;

    const isVisible = await profileBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!isVisible) {
      return {
        success: false,
        url: this.currentUrl,
        reason: "프로필 버튼을 찾을 수 없음",
      };
    }

    await profileBtn.click({ timeout: 5000 });
    console.log("📍 1단계: 프로필 버튼 클릭");
    await this.waitForLoadState("domcontentloaded");
    await this.waitForNetworkStable(5000).catch(() => {});

    let currentUrl = this.page.url();

    // 2. 로그인 페이지로 리다이렉트된 경우 → Google 로그인 버튼 클릭
    if (currentUrl.includes("auth.") || currentUrl.includes("/login")) {
      console.log("📍 2단계: 로그인 페이지 감지 → Google 로그인 시도");

      // Google 로그인 버튼 클릭
      const googleBtn = this.page
        .getByRole("button", { name: /Continue with Google|Google|구글/i })
        .first();
      const googleBtnVisible = await googleBtn
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (googleBtnVisible) {
        await googleBtn.click({ timeout: 5000 });
        console.log("📍 3단계: Google 로그인 버튼 클릭");

        // Google OAuth 완료 후 리다이렉트 대기 (폴링 방식, 최대 20초)
        let oauthSuccess = false;
        for (let i = 0; i < 20; i++) {
          await this.page.waitForTimeout(1000);
          const url = this.page.url();
          console.log(`  [${i + 1}초] URL: ${url}`);

          if (
            !url.includes("auth.") &&
            !url.includes("/login") &&
            !url.includes("accounts.google")
          ) {
            console.log("📍 4단계: OAuth 완료, 리다이렉트됨");
            oauthSuccess = true;
            break;
          }
        }

        if (!oauthSuccess) {
          return {
            success: false,
            url: this.page.url(),
            reason: "Google OAuth 실패 (수동 로그인 필요)",
          };
        }
      } else {
        return {
          success: false,
          url: currentUrl,
          reason: "Google 로그인 버튼을 찾을 수 없음",
        };
      }

      currentUrl = this.page.url();
      await this.waitForLoadState("domcontentloaded");
      await this.handleModal();
      await this.waitForContentStable("body", { timeout: 5000 }).catch(
        () => {},
      );

      // 5. 홈으로 돌아왔으면 다시 프로필 버튼 클릭
      if (!currentUrl.includes("my-page")) {
        console.log("📍 5단계: 홈에서 다시 프로필 버튼 클릭");

        // 페이지 완전 로드 대기
        await this.waitForLoadState("networkidle").catch(() => {});
        await this.dismissAllBlockingModals();

        // 프로필 버튼 대기 (최대 10초)
        const profileBtnAgain = this.profileButton;
        const isVisibleAgain = await profileBtnAgain
          .isVisible({ timeout: 10000 })
          .catch(() => false);

        if (!isVisibleAgain) {
          // 디버그: 현재 페이지 상태 출력
          const bodyHtml = await this.page
            .locator("body")
            .innerHTML()
            .catch(() => "");
          console.log(
            "⚠️ 프로필 버튼 미검출. SVG 아이콘 확인:",
            bodyHtml.includes("icon-profile-line"),
          );
          return {
            success: false,
            url: currentUrl,
            reason: "두 번째 프로필 버튼을 찾을 수 없음",
          };
        }

        await profileBtnAgain.click({ timeout: 5000 });
        await this.waitForLoadState("domcontentloaded");
        await this.waitForNetworkStable(5000).catch(() => {});
        await this.handleModal();

        currentUrl = this.page.url();
      }
    }

    // 6. 마이페이지 도달 확인
    if (currentUrl.includes("my-page")) {
      console.log("✅ 마이페이지 도달 성공");
      return { success: true, url: currentUrl };
    }

    return {
      success: false,
      url: currentUrl,
      reason: "마이페이지로 이동하지 않음",
    };
  }

  /**
   * 마이페이지 메뉴 클릭 (폴백 없음 - 네비게이션 검증용)
   * @param menuTexts 메뉴 텍스트 배열
   * @returns 메뉴 클릭 성공 여부와 이동된 URL 정보
   */
  async clickMyPageMenuStrict(
    menuTexts: readonly string[],
    hrefs?: readonly string[],
  ): Promise<{ success: boolean; url: string; reason?: string }> {
    // 마이페이지에 있는지 확인
    if (!this.currentUrl.includes("my-page")) {
      return {
        success: false,
        url: this.currentUrl,
        reason: "마이페이지가 아님",
      };
    }

    // 하위 경로에 있으면 마이페이지 메인으로 직접 이동
    const isSubPage = /\/my-page\/[a-z-]+/.test(this.currentUrl);
    if (isSubPage) {
      console.log("📍 마이페이지 하위 경로 감지, 메인으로 직접 이동");
      await this.goto(`${this.baseUrl}/my-page`);
      await this.waitForLoadState("domcontentloaded");
      await this.waitForNetworkStable(3000).catch(() => {});
      await this.handleModal();

      // 여전히 하위 경로라면 메뉴 목록이 없을 수 있음
      if (/\/my-page\/[a-z-]+/.test(this.currentUrl)) {
        console.warn("⚠️ 마이페이지 메인 접근 불가 (SPA auth 문제)");
      }
    }

    await this.waitForContentStable("body", {
      stableTime: 500,
      timeout: 3000,
    }).catch(() => {});

    // 1. href 기반으로 먼저 시도 (가장 안정적)
    if (hrefs?.length) {
      for (const href of hrefs) {
        const menuItem = this.page.locator(`a[href*="${href}"]`).first();
        const isVisible = await menuItem
          .isVisible({ timeout: 2000 })
          .catch(() => false);
        if (isVisible) {
          await menuItem.click({ timeout: 5000 });
          console.log(`✅ href 기반 메뉴 클릭: ${href}`);
          await this.waitForLoadState("domcontentloaded");
          await this.waitForContentStable("body", {
            stableTime: 500,
            timeout: 5000,
          }).catch(() => {});
          await this.handleModal();
          return { success: true, url: this.page.url() };
        }
      }
    }

    // 2. 텍스트 기반으로 시도
    for (const text of menuTexts) {
      const menuItem = this.page
        .getByRole("link", { name: text, exact: false })
        .or(this.page.getByRole("button", { name: text }))
        .or(this.page.locator(`text=${text}`).first());

      const isVisible = await menuItem
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (isVisible) {
        await menuItem.click({ timeout: 5000 });
        console.log(`✅ 텍스트 기반 메뉴 클릭: ${text}`);
        await this.waitForLoadState("domcontentloaded");
        await this.waitForContentStable("body", {
          stableTime: 500,
          timeout: 5000,
        }).catch(() => {});
        await this.handleModal();
        return { success: true, url: this.page.url() };
      }
    }

    return {
      success: false,
      url: this.currentUrl,
      reason: `메뉴를 찾을 수 없음: ${menuTexts.join(", ")}`,
    };
  }

  /**
   * 마이페이지로 이동 (프로필 버튼 클릭)
   * @description 로그인 상태에서 프로필 버튼을 클릭하여 마이페이지로 이동
   * @note 프로필 버튼 클릭 시 인증 페이지로 리다이렉트될 수 있어 URL 확인 후 폴백 처리
   */
  async navigateToMyPage(): Promise<void> {
    await this.dismissAllBlockingModals();

    // 프로필 버튼 로케이터 (SVG 아이콘 또는 사용자 프로필 이미지)
    const profileBtn = this.profileButton;

    const isVisible = await profileBtn
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (isVisible) {
      await profileBtn.click({ timeout: 5000 });
      console.log("✅ 프로필 버튼 클릭 (SVG 아이콘)");
      await this.waitForLoadState("domcontentloaded");
      await this.waitForNetworkStable(5000).catch(() => {});

      // 리다이렉트 감지: 로그인 페이지로 이동되었는지 확인
      const currentUrl = this.page.url();
      if (currentUrl.includes("auth.") || currentUrl.includes("/login")) {
        console.warn("⚠️ 로그인 페이지로 리다이렉트됨, URL로 직접 이동");
        await this.gotoMyPage();
        await this.waitForLoadState("domcontentloaded");
        await this.waitForNetworkStable(5000).catch(() => {});
      }

      await this.handleModal();

      // 마이페이지 도달 확인
      const finalUrl = this.page.url();
      if (finalUrl.includes("my-page")) {
        console.log("✅ 마이페이지 이동 완료 (프로필 버튼 → URL 폴백)");
      } else {
        console.warn(`⚠️ 마이페이지 이동 실패, 현재 URL: ${finalUrl}`);
      }
      return;
    }

    // 폴백: 마이페이지 관련 링크 찾기
    const myPageLink = this.page
      .getByRole("link", { name: /my page|마이페이지|my-page/i })
      .first();
    const linkVisible = await myPageLink
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (linkVisible) {
      await myPageLink.click({ timeout: 5000 });
      await this.waitForLoadState("domcontentloaded");
      await this.waitForNetworkStable(5000).catch(() => {});
      await this.handleModal();
      console.log("✅ 마이페이지 이동 완료 (링크 클릭)");
      return;
    }

    // 최종 폴백: URL 직접 이동
    console.warn("⚠️ 프로필 버튼을 찾을 수 없어 URL로 직접 이동");
    await this.gotoMyPage();

    await this.waitForLoadState("domcontentloaded");
    await this.waitForNetworkStable(5000).catch(() => {});
    await this.handleModal();
    console.log("✅ 마이페이지 이동 완료 (URL 직접)");
  }

  /**
   * 마이페이지에서 특정 메뉴 클릭
   * @param menuTexts 메뉴 텍스트 배열 (한국어/영어 모두 포함)
   * @returns 성공 여부
   */
  private async clickMyPageMenu(
    menuTexts: readonly string[],
  ): Promise<boolean> {
    // 마이페이지에 있는지 확인하고 없으면 이동
    if (!this.currentUrl.includes("my-page")) {
      await this.navigateToMyPage();
    }

    // 콘텐츠 안정화 대기 (타임아웃 시 무시)
    await this.waitForContentStable("body", {
      stableTime: 500,
      timeout: 3000,
    }).catch(() => {});

    // 메뉴 텍스트로 요소 찾아서 클릭
    for (const text of menuTexts) {
      const menuItem = this.page
        .getByRole("link", { name: text })
        .or(this.page.getByRole("button", { name: text }))
        .or(this.page.locator(`text=${text}`).first());

      const isVisible = await menuItem
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (isVisible) {
        await menuItem.click({ timeout: 5000 });
        await this.waitForLoadState("domcontentloaded");
        // 페이지 이동 후 안정화 대기 (타임아웃 시 무시하고 계속 진행)
        await this.waitForContentStable("body", {
          stableTime: 500,
          timeout: 5000,
        }).catch(() => {});
        await this.handleModal();
        console.log(`✅ 마이페이지 메뉴 클릭: ${text}`);
        return true;
      }
    }

    console.warn(`⚠️ 마이페이지 메뉴를 찾을 수 없음: ${menuTexts.join(", ")}`);
    return false;
  }

  /**
   * 비밀번호 변경 페이지로 이동 (마이페이지 메뉴 클릭)
   * @description 마이페이지에서 "비밀번호 변경" 메뉴를 클릭하여 이동
   */
  async navigateToPasswordPage(): Promise<void> {
    const menuTexts = [
      "비밀번호 변경",
      "비밀번호",
      "Password",
      "Change Password",
    ] as const;
    const clicked = await this.clickMyPageMenu(menuTexts);

    if (!clicked) {
      console.warn("⚠️ 메뉴 클릭 실패, URL로 직접 이동");
      await this.goto(`${this.baseUrl}/my-page/change-password`);
      await this.waitForLoadState("domcontentloaded");
      await this.handleModal();
    }
  }

  /**
   * 이벤트 응모정보 관리 페이지로 이동 (마이페이지 메뉴 클릭)
   * @description 마이페이지에서 "이벤트 응모정보 관리" 메뉴를 클릭하여 이동
   */
  async navigateToEventEntryPage(): Promise<void> {
    const menuTexts = [
      "이벤트 응모정보 관리",
      "이벤트 응모",
      "Event Entry",
      "event submissions",
    ] as const;
    const clicked = await this.clickMyPageMenu(menuTexts);

    if (!clicked) {
      console.warn("⚠️ 메뉴 클릭 실패, URL로 직접 이동");
      await this.goto(`${this.baseUrl}/my-page/event-submissions`);
      await this.waitForLoadState("domcontentloaded");
      await this.handleModal();
    }
  }

  // --------------------------------------------------------------------------
  // 로고 및 네비게이션 검증
  // --------------------------------------------------------------------------

  private readonly logoSelectors = [
    'img[alt="make-star"]',
    'img[alt*="makestar"]',
    'img[alt*="make"]',
    "header img",
    'a[href="/"] img',
  ] as const;

  private readonly navSelectors = [
    "header",
    "nav",
    '[class*="header"]',
    '[class*="nav"]',
  ] as const;

  /** 로고 존재 확인 */
  async verifyLogo(timeout: number = this.timeouts.medium): Promise<boolean> {
    const result = await this.findVisibleElement(this.logoSelectors, timeout);
    if (result) {
      console.log(`✅ 로고 발견: ${result.selector}`);
      return true;
    }
    console.warn("⚠️ 로고를 찾을 수 없음");
    return false;
  }

  /** 네비게이션 존재 확인 */
  async verifyNavigation(): Promise<boolean> {
    const result = await this.findVisibleElement(this.navSelectors);
    if (result) {
      console.log(`✅ 네비게이션 발견: ${result.selector}`);
      return true;
    }
    console.warn("⚠️ 네비게이션을 찾을 수 없음");
    return false;
  }

  /** 로고 클릭으로 홈 복귀 (모달이 열려있으면 먼저 닫음) */
  async clickLogoToHome(): Promise<void> {
    // 팝업 모달 처리 (Close, 닫기 등)
    await this.handleModal();

    if (await this.cancelButton.isVisible({ timeout: 500 }).catch(() => false)) {
      await this.cancelButton.click().catch(() => {});
      await this.waitForContentStable(300).catch(() => {});
    }

    // 검색 모달/오버레이가 로고를 가릴 수 있으므로 닫기 시도
    const overlaySelector =
      'div.fixed[class*="z-[40]"], div.fixed.w-\\[100vw\\], div[class*="bg-[rgba(0,0,0"]';
    const overlay = this.page.locator(overlaySelector).first();

    if (await overlay.isVisible({ timeout: 500 }).catch(() => false)) {
      // ESC 키로 닫기 시도
      await this.page.keyboard.press("Escape");
      await overlay.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});

      // 여전히 보이면 handleModal 재시도
      if (await overlay.isVisible({ timeout: 300 }).catch(() => false)) {
        await this.handleModal();
        await overlay
          .waitFor({ state: "hidden", timeout: 1000 })
          .catch(() => {});
      }
      console.log("✅ 오버레이 닫기 시도 완료");
    }

    const logoResult = await this.findVisibleElement(
      this.logoSelectors,
      this.timeouts.long,
    );
    if (!logoResult) {
      throw new Error("로고를 찾을 수 없습니다");
    }
    await logoResult.element.click({ timeout: this.timeouts.medium });
    const escapedBaseUrl = this.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    await this.expectUrlMatches(new RegExp(`^${escapedBaseUrl}\\/?$`));
    console.log("✅ 로고 클릭으로 Home 복귀 완료");
  }

  // --------------------------------------------------------------------------
  // 검색 기능
  // --------------------------------------------------------------------------

  /** 검색 UI 열기 */
  async openSearchUI(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, 0));

    // 검색 버튼 클릭 전 모달 처리 (모달이 버튼을 가릴 수 있음)
    await this.handleModal();

    // 페이지 오류 상태 확인 및 복구
    const errorButton = this.page.locator('button:has-text("Back to Home")');
    if (await errorButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.warn("⚠️ 페이지 오류 발견, 홈으로 복귀 후 재시도");
      await this.gotoHome();
      await this.handleModal();
    }

    // 페이지 로딩 대기 (조건부 대기)
    await this.waitForContentStable(500);

    // 검색 버튼이 보이는지 확인
    const isSearchButtonVisible = await this.searchButton
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (!isSearchButtonVisible) {
      console.warn("⚠️ 검색 버튼이 보이지 않아 페이지 새로고침");
      await this.reload();
      await this.handleModal();
      await this.waitForContentStable(500);
    }

    // 재시도 로직: 최대 3번 시도
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.searchButton.click();
        await expect(this.searchInput).toBeVisible({
          timeout: this.timeouts.medium,
        });
        console.log("✅ 검색 입력창 표시됨");
        return;
      } catch (error) {
        if (attempt < 3) {
          console.warn(`⚠️ 검색 UI 열기 시도 ${attempt} 실패, 재시도...`);
          await this.handleModal();
          await this.waitForContentStable(500);
        } else {
          throw error;
        }
      }
    }
  }

  /** 검색 실행 */
  async search(keyword: string): Promise<void> {
    await this.openSearchUI();
    await this.searchInput.fill(keyword);
    await this.searchInput.press("Enter");
    await this.waitForLoadState("domcontentloaded");
  }

  /** 추천 검색어 표시 확인 */
  async verifyRecommendedKeywords(): Promise<boolean> {
    const recommended = this.page
      .locator("text=/추천 검색어|인기 검색어|추천|Recommended/i")
      .first();
    return await recommended
      .isVisible({ timeout: this.timeouts.medium })
      .catch(() => false);
  }

  // --------------------------------------------------------------------------
  // 이벤트 페이지 기능
  // --------------------------------------------------------------------------

  private readonly eventCardSelectors = [
    'img[alt="event-thumb-image"]',
    '[class*="event"] img',
    '[class*="card"]',
    '[class*="thumbnail"]',
  ] as const;

  /** 종료된 이벤트 탭 클릭 */
  async clickEndedTab(): Promise<boolean> {
    return await this.clickFirstVisibleText(
      MAKESTAR_TEXT_PATTERNS.ENDED_TAB,
      this.timeouts.short,
    );
  }

  /** 진행중인 이벤트 탭 클릭 */
  async clickOngoingTab(): Promise<boolean> {
    return await this.clickFirstVisibleText(
      MAKESTAR_TEXT_PATTERNS.ONGOING_TAB,
      this.timeouts.medium,
    );
  }

  /** 첫 번째 이벤트 카드 클릭 */
  async clickFirstEventCard(): Promise<void> {
    const linkCandidates = [
      this.page.locator('main a[href*="/product/"]').first(),
      this.page.locator('a[href*="/product/"]').first(),
      this.page
        .locator('a[href*="/artist/"][href*="tab=Event"], a[href*="/artist/"][href*="#"]')
        .first(),
    ];

    for (const candidate of linkCandidates) {
      const visible = await candidate
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      if (!visible) continue;

      await candidate.click({ timeout: this.timeouts.medium });
      await this.waitForLoadState("domcontentloaded").catch(() => {});
      await this.waitForNetworkStable(3000).catch(() => {});
      console.log("✅ 이벤트 상품 클릭 완료");
      return;
    }

    const eventCard = await this.findVisibleElement(
      this.eventCardSelectors,
      this.timeouts.long,
    );
    if (!eventCard) {
      throw new Error("이벤트 카드를 찾을 수 없습니다");
    }
    await eventCard.element.click({ timeout: this.timeouts.medium });
    await this.waitForLoadState("domcontentloaded").catch(() => {});
    await this.waitForNetworkStable(3000).catch(() => {});
    console.log("✅ 이벤트 상품 클릭 완료");
  }

  // --------------------------------------------------------------------------
  // 샵 페이지 기능
  // --------------------------------------------------------------------------

  /** 첫 번째 샵 상품 클릭 (품절 제외) */
  async clickFirstAvailableProduct(): Promise<boolean> {
    const productCards = this.shopProductCard;
    const cardCount = await productCards.count();
    console.log(`   상품 카드 ${cardCount}개 발견`);

    for (let i = 0; i < Math.min(cardCount, 8); i++) {
      const card = productCards.nth(i);
      const cardLink = card.locator("xpath=ancestor::a[1]").first();
      const href = (await cardLink.getAttribute("href").catch(() => "")) || "";
      const parentText = await cardLink
        .textContent()
        .catch(() => "");

      if (parentText && /sold out/i.test(parentText)) {
        console.log(`   상품 ${i + 1}: 품절 - 건너뜀`);
        continue;
      }

      if (!/\/product\//i.test(href)) {
        console.log(`   상품 ${i + 1}: 상품 상세 링크 아님 (${href || "href 없음"})`);
        continue;
      }

      console.log(`   상품 ${i + 1}: 클릭 시도`);
      await cardLink.click();
      await this.waitForLoadState("domcontentloaded").catch(() => {});
      await this.waitForNetworkStable(3000).catch(() => {});

      if (/\/product\/\d+/i.test(this.currentUrl)) {
        console.log(`   ✅ 상품 상세 진입 완료: ${this.currentUrl}`);
        return true;
      }

      console.warn(`   ⚠️ 상품 ${i + 1}: 상세 페이지 진입 실패 (${this.currentUrl})`);
      await this.goto(`${this.baseUrl}/shop`);
      await this.waitForPageContent();
    }
    return false;
  }

  private async hasActiveCartOrPurchaseCta(): Promise<boolean> {
    for (const selector of this.addToCartSelectors) {
      const button = this.page.locator(selector).first();
      const visible = await button
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      if (!visible) continue;

      const enabled = await button.isEnabled().catch(() => false);
      if (enabled) {
        return true;
      }
    }

    const purchaseVisible = await this.purchaseButton
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
    if (!purchaseVisible) {
      return false;
    }

    return await this.purchaseButton.isEnabled().catch(() => false);
  }

  private async hasSalesEndedState(): Promise<boolean> {
    return await this.page
      .getByText(/This product's sales have ended|Sales Ended|판매 종료|판매가 종료/i)
      .first()
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
  }

  async openFirstCartEligibleProduct(maxProducts: number = 8): Promise<boolean> {
    const cardCount = await this.shopProductCard.count();
    const attemptCount = Math.min(cardCount, maxProducts);

    for (let i = 0; i < attemptCount; i++) {
      const opened = await this.clickProductCardByIndex(i);
      if (!opened) continue;

      await this.handleModal().catch(() => {});
      await this.waitForContentStable(300).catch(() => {});

      if (await this.hasSalesEndedState()) {
        console.log(`   상품 ${i + 1}: 판매 종료 상품 - 건너뜀`);
        await this.returnToProductListing();
        continue;
      }

      await this.setQuantity(1).catch(() => {});
      await this.selectFirstOption().catch(() => false);
      await this.waitForContentStable(300).catch(() => {});

      if (await this.hasActiveCartOrPurchaseCta()) {
        console.log(`   ✅ 장바구니 가능 상품 ${i + 1}번 선택`);
        return true;
      }

      console.log(`   상품 ${i + 1}: 활성 장바구니/구매 CTA 없음 - 다음 상품 시도`);
      await this.returnToProductListing();
    }

    return false;
  }

  /** 카테고리 탭 표시 확인 */
  async verifyCategoryTabs(): Promise<boolean> {
    const categoryTab = this.page
      .locator("text=/전체|앨범|MD|DVD|추천/i")
      .first();
    return await categoryTab
      .isVisible({ timeout: this.timeouts.medium })
      .catch(() => false);
  }

  /** 상품 카드 개수 반환 */
  async getProductCardCount(): Promise<number> {
    return await this.shopProductCard.count();
  }

  // --------------------------------------------------------------------------
  // 상품 상세 페이지 기능
  // --------------------------------------------------------------------------

  private readonly titleSelectors = [
    "h1",
    "h2",
    '[class*="title"]',
    '[class*="Title"]',
    '[class*="product"]',
  ] as const;

  private readonly optionDropdownSelectors = [
    "select",
    '[class*="option"]',
    '[class*="select"]',
    '[role="combobox"]',
    '[class*="dropdown"]',
  ] as const;

  private readonly optionCardSelectors = [
    '[role="dialog"] div[class*="rounded"][class*="border"]',
    'div[class*="fixed"][class*="z-40"] div[class*="rounded"][class*="border"]',
  ] as const;

  private readonly quantityInputSelectors = [
    'input[type="number"]',
    '[class*="quantity"] input',
    '[class*="count"] input',
    'input[name*="quantity"]',
  ] as const;

  private readonly quantityPlusSelectors = [
    'button:has-text("+")',
    '[class*="plus"]',
    '[class*="increase"]',
    'button[aria-label*="increase"]',
  ] as const;

  private readonly addToCartSelectors = [
    'button:has-text("장바구니 담기"):not([disabled])',
    'button:has-text("Add to Cart"):not([disabled])',
    'button:has-text("장바구니"):not([disabled])',
    'button:has-text("Cart"):not([disabled])',
    'button:has-text("cart"):not([disabled])',
    '[role="dialog"] button:has-text("장바구니"):not([disabled])',
    '[role="dialog"] button:has-text("Cart"):not([disabled])',
  ] as const;

  private readonly artistEntrySelectors = [
    'button:has(img[alt="arrow_right"])',
    'button:has(svg use[href*="arrow"])',
    'a[href*="/artist/"]',
    'a[href*="artist"]',
    'a[href*="/brand/"]',
    'button:has-text("ARTIST")',
    'a:has-text("ARTIST")',
    'button:has-text("아티스트")',
    'a:has-text("아티스트")',
    '[class*="artist"] a',
    '[class*="artist"] button',
    '[class*="brand"] a',
  ] as const;

  private readonly shopCategoryFallbacks = ["BEST", "ALBUM", "All"] as const;
  private readonly artistKeywordFallbacks = ["SEVENTEEN", "BTS"] as const;

  private isProductDetailUrl(url: string): boolean {
    return /\/product\/\d+/i.test(url) || /\/shop\/\d+/i.test(url);
  }

  private isArtistProfileUrl(url: string): boolean {
    return /\/artist(\/|$|\?)/i.test(url);
  }

  private async isSoldOutProductCard(card: Locator): Promise<boolean> {
    return await card
      .evaluate((node) => {
        let current: HTMLElement | null = node as HTMLElement;
        for (let depth = 0; depth < 5 && current; depth++) {
          const text = current.innerText || "";
          if (/sold out/i.test(text)) {
            return true;
          }
          current = current.parentElement;
        }
        return false;
      })
      .catch(() => false);
  }

  private async clickProductCardByIndex(index: number): Promise<boolean> {
    const card = this.shopProductCard.nth(index);
    if (
      !(await card
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false))
    ) {
      return false;
    }

    const isSoldOut = await this.isSoldOutProductCard(card);
    if (isSoldOut) {
      console.log(`   상품 ${index + 1}: 품절 - 건너뜀`);
      return false;
    }

    const clickTargets = [
      card.locator("xpath=ancestor::a[1]"),
      card.locator("xpath=ancestor::button[1]"),
      card.locator(
        'xpath=ancestor::div[contains(@class, "cursor-pointer")][1]',
      ),
      card,
    ];

    for (const target of clickTargets) {
      if (
        !(await target
          .isVisible({ timeout: this.timeouts.short })
          .catch(() => false))
      ) {
        continue;
      }

      await target.click({ timeout: this.timeouts.medium }).catch(() => {});
      await this.waitForLoadState("domcontentloaded").catch(() => {});
      await this.waitForContentStable("body", {
        stableTime: 400,
        timeout: this.timeouts.medium,
      }).catch(() => {});

      if (this.isProductDetailUrl(this.currentUrl)) {
        console.log(`✅ 상품 ${index + 1}번 카드 클릭 (구매 가능)`);
        return true;
      }
    }

    return false;
  }

  private async returnToProductListing(): Promise<void> {
    await this.page
      .goBack({
        waitUntil: "domcontentloaded",
        timeout: this.timeouts.navigation,
      })
      .catch(() => {});
    await this.waitForLoadState("domcontentloaded").catch(() => {});

    const currentUrl = this.currentUrl;
    if (!currentUrl.includes("/shop") && !currentUrl.includes("keyword=")) {
      await this.navigateToShop();
    }
    await this.waitForPageContent();
  }

  private async clickShopCategory(category: string): Promise<boolean> {
    const categoryTargets = [
      this.page.getByRole("link", { name: category, exact: true }).first(),
      this.page.getByRole("button", { name: category, exact: true }).first(),
      this.page
        .locator(`a:has-text("${category}"), button:has-text("${category}")`)
        .first(),
    ];

    for (const target of categoryTargets) {
      if (
        !(await target
          .isVisible({ timeout: this.timeouts.short })
          .catch(() => false))
      ) {
        continue;
      }
      await target.click({ timeout: this.timeouts.medium }).catch(() => {});
      await this.waitForLoadState("domcontentloaded").catch(() => {});
      await this.waitForPageContent();
      return true;
    }

    return false;
  }

  private async searchProductsByKeyword(keyword: string): Promise<boolean> {
    await this.gotoHome();
    await this.waitForContentStable("body", {
      stableTime: 400,
      timeout: this.timeouts.long,
    }).catch(() => {});
    await this.openSearchUI();
    await this.searchInput.fill(keyword);
    await this.searchInput.press("Enter");
    await this.waitForLoadState("domcontentloaded").catch(() => {});
    await this.waitForSearchResults(1).catch(() => false);
    return (await this.getSearchResultCount()) > 0;
  }

  private async tryOpenArtistProfileFromCurrentListing(
    maxProducts: number,
    contextLabel: string,
  ): Promise<ArtistProfileNavigationResult> {
    const totalProductCount = await this.getProductCardCount();
    if (totalProductCount === 0) {
      return {
        success: false,
        reason: `${contextLabel}: 상품 카드가 없습니다`,
      };
    }

    const attemptCount = Math.min(totalProductCount, maxProducts);

    for (let i = 0; i < attemptCount; i++) {
      const movedToDetail = await this.clickProductCardByIndex(i);
      if (!movedToDetail) {
        continue;
      }

      const detailUrl = this.currentUrl;
      const artistResult = await this.clickArtistEntryFromProductDetail();
      if (artistResult.success) {
        return {
          success: true,
          productIndex: i,
          detailUrl,
          artistUrl: artistResult.url,
          selector: artistResult.selector,
        };
      }

      console.log(
        `ℹ️ 상품 ${i + 1}번: 아티스트 진입 포인트 미발견, 다음 상품 시도`,
      );
      await this.returnToProductListing();
    }

    return {
      success: false,
      reason: `${contextLabel}: 상위 ${attemptCount}개 상품에서 아티스트 진입 포인트를 찾지 못했습니다`,
    };
  }

  /**
   * 상품 상세 페이지에서 아티스트 진입 포인트 클릭
   */
  async clickArtistEntryFromProductDetail(): Promise<{
    success: boolean;
    url: string;
    selector?: string;
  }> {
    const tryArtistTarget = async (
      target: Locator,
      label: string,
    ): Promise<{
      success: boolean;
      url: string;
      selector?: string;
    }> => {
      if (
        !(await target
          .isVisible({ timeout: this.timeouts.short })
          .catch(() => false))
      ) {
        return { success: false, url: this.currentUrl };
      }

      console.log(`✅ 아티스트 링크 발견: ${label}`);
      await target.click({ timeout: this.timeouts.medium }).catch(() => {});

      await Promise.race([
        this.waitForUrlContains(/\/artist(\/|$|\?)/i, this.timeouts.medium),
        this.waitForLoadState("domcontentloaded"),
      ]).catch(() => {});
      await this.waitForContentStable("body", {
        stableTime: 400,
        timeout: this.timeouts.medium,
      }).catch(() => {});

      const currentUrl = this.currentUrl;
      if (this.isArtistProfileUrl(currentUrl)) {
        return { success: true, url: currentUrl, selector: label };
      }

      return { success: false, url: currentUrl };
    };

    for (const selector of this.artistEntrySelectors) {
      const selectorResult = await tryArtistTarget(
        this.page.locator(selector).first(),
        selector,
      );
      if (selectorResult.success) {
        return selectorResult;
      }
    }

    const semanticTargets: Array<{ label: string; locator: Locator }> = [
      {
        label: "role=link[name~artist]",
        locator: this.page
          .getByRole("link", { name: /artist|아티스트|brand|브랜드/i })
          .first(),
      },
      {
        label: "role=button[name~artist]",
        locator: this.page
          .getByRole("button", { name: /artist|아티스트|brand|브랜드/i })
          .first(),
      },
    ];

    for (const target of semanticTargets) {
      const semanticResult = await tryArtistTarget(
        target.locator,
        target.label,
      );
      if (semanticResult.success) {
        return semanticResult;
      }
    }

    return { success: false, url: this.currentUrl };
  }

  /**
   * Shop 페이지에서 상품 상세를 거쳐 아티스트 프로필 페이지로 이동
   * @param options.maxProducts 최대 시도 상품 수 (기본 8)
   */
  async openArtistProfileFromShop(
    options: { maxProducts?: number } = {},
  ): Promise<ArtistProfileNavigationResult> {
    const maxProducts = options.maxProducts ?? 8;
    const reasons: string[] = [];

    const primaryAttempt = await this.tryOpenArtistProfileFromCurrentListing(
      maxProducts,
      "Shop 기본 목록",
    );
    if (primaryAttempt.success) {
      return primaryAttempt;
    }
    reasons.push(primaryAttempt.reason ?? "Shop 기본 목록 탐색 실패");

    for (const category of this.shopCategoryFallbacks) {
      const categoryClicked = await this.clickShopCategory(category);
      if (!categoryClicked) {
        reasons.push(`카테고리 ${category}: 탭 클릭 실패`);
        continue;
      }
      const categoryAttempt = await this.tryOpenArtistProfileFromCurrentListing(
        Math.min(maxProducts, 4),
        `카테고리 ${category}`,
      );
      if (categoryAttempt.success) {
        return categoryAttempt;
      }
      reasons.push(categoryAttempt.reason ?? `카테고리 ${category} 탐색 실패`);
    }

    for (const keyword of this.artistKeywordFallbacks) {
      const hasSearchResults = await this.searchProductsByKeyword(keyword);
      if (!hasSearchResults) {
        reasons.push(`검색 ${keyword}: 결과 없음`);
        continue;
      }

      const searchAttempt = await this.tryOpenArtistProfileFromCurrentListing(
        Math.min(maxProducts, 4),
        `검색 ${keyword}`,
      );
      if (searchAttempt.success) {
        return searchAttempt;
      }
      reasons.push(searchAttempt.reason ?? `검색 ${keyword} 탐색 실패`);
    }

    return {
      success: false,
      reason: reasons.join(" | "),
    };
  }

  /** 상품 제목 확인 */
  async verifyProductTitle(): Promise<boolean> {
    const result = await this.findVisibleElement(
      this.titleSelectors,
      this.timeouts.long,
    );
    return result !== null;
  }

  /** 가격 정보 확인 */
  async verifyPriceInfo(): Promise<boolean> {
    const text = await this.page.locator("body").textContent();
    return /원|₩|KRW/i.test(text || "");
  }

  /** 옵션 선택 */
  async selectFirstOption(): Promise<boolean> {
    // 패턴 1: spinbutton 방식 (Makestar — 각 옵션에 수량 스피너)
    // 구조: [img minus] [spinbutton "0"] [img plus(라벨은 minus)]
    const firstSpinner = this.page.getByRole("spinbutton").first();
    // SPA 네비게이션 후 React 렌더링 대기 + 모바일 스크롤
    try {
      await firstSpinner.waitFor({
        state: "attached",
        timeout: this.timeouts.medium,
      });
      await firstSpinner.scrollIntoViewIfNeeded().catch(() => {});
    } catch {
      // spinbutton이 DOM에 없음 — 패턴 2로 진행
    }
    if (
      await firstSpinner
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false)
    ) {
      const value = await firstSpinner.inputValue().catch(() => "0");
      if (parseInt(value, 10) === 0) {
        // spinbutton의 부모 컨테이너에서 마지막 img 클릭 (plus 버튼)
        const container = firstSpinner.locator("xpath=..");
        const plusBtn = container.locator("img").last();
        if (
          await plusBtn
            .isVisible({ timeout: this.timeouts.short })
            .catch(() => false)
        ) {
          await plusBtn.click();
          // 값 변경 확인
          const newValue = await firstSpinner.inputValue().catch(() => "0");
          if (parseInt(newValue, 10) > 0) {
            console.log(
              `   ✅ 첫 번째 옵션 수량 ${newValue}로 설정 (spinbutton)`,
            );
            return true;
          }
        }
        // fallback: spinbutton에 직접 값 입력 후 change 이벤트 발생
        await firstSpinner.fill("1");
        await firstSpinner.dispatchEvent("change");
        console.log("   ✅ 첫 번째 옵션 수량 1로 설정 (fill)");
        return true;
      }
    }

    // 패턴 2: 모바일 옵션 카드 방식 (바텀시트)
    const optionCards = await this.getVisibleOptionCards();
    if (optionCards.length > 0) {
      const selected = await this.selectOptionCard(optionCards[0]);
      if (selected) {
        console.log("   ✅ 첫 번째 옵션 선택 (option card)");
        return true;
      }
    }

    // 패턴 3: 드롭다운 방식 (일반 셀렉트/커스텀 드롭다운)
    const optionDropdown = await this.findVisibleElement(
      this.optionDropdownSelectors,
      this.timeouts.medium,
    );
    if (!optionDropdown) return false;

    await optionDropdown.element.click();
    await this.wait(this.timeouts.short);

    // 옵션 컨테이너 내부에서 검색 (페이지 전역 li 검색 시 GNB 링크를 클릭하는 버그 방지)
    const firstOption = optionDropdown.element
      .locator('option, [role="option"], li')
      .first();
    if (
      await firstOption
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false)
    ) {
      await firstOption.click().catch(() => {});
      console.log("   ✅ 첫 번째 옵션 선택 (dropdown)");
      return true;
    }
    return false;
  }

  /** 수량 설정 */
  async setQuantity(quantity: number): Promise<void> {
    const quantityInput = await this.findVisibleElement(
      this.quantityInputSelectors,
      this.timeouts.medium,
    );
    if (quantityInput) {
      await quantityInput.element.fill(String(quantity));
      console.log(`   ✅ 수량 ${quantity} 입력`);
    }
  }

  /** 수량 증가 */
  async increaseQuantity(): Promise<boolean> {
    const plusBtn = await this.findVisibleElement(
      this.quantityPlusSelectors,
      this.timeouts.short,
    );
    if (plusBtn) {
      await plusBtn.element.click();
      console.log("   ✅ 수량 증가 버튼 클릭");
      return true;
    }

    // 장바구니 페이지 fallback: 수량 input 뒤의 + 버튼을 CSS selector로 직접 탐색
    // DOM 구조: <div> <button>-</button> <input "수량"/> <button>+</button> </div>
    // (wrapper div가 있을 수 있으므로 여러 패턴 시도)
    const cartPlusBtnSelectors = [
      'input[aria-label*="수량"] ~ button:last-of-type',
      'input[aria-label*="Quantity"] ~ button:last-of-type',
      'input[placeholder*="수량"] ~ button:last-of-type',
    ];
    for (const selector of cartPlusBtnSelectors) {
      const btn = this.page.locator(selector).first();
      if (
        await btn.isVisible({ timeout: this.timeouts.short }).catch(() => false)
      ) {
        await btn.click();
        console.log("   ✅ 장바구니 수량 증가 버튼 클릭 (CSS fallback)");
        return true;
      }
    }

    // 최종 fallback: 장바구니 페이지의 수량 영역에서 마지막 버튼
    const qtyTextbox = this.page
      .getByRole("textbox", { name: /Quantity|수량/i })
      .first();
    if (
      await qtyTextbox
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false)
    ) {
      // evaluate: input → 부모 1~4단계에서 button 2개(-, +) 포함 컨테이너를 찾아 마지막 button(+) 클릭
      const clicked = await qtyTextbox.evaluate((el) => {
        let ancestor: HTMLElement | null = el.parentElement;
        for (let depth = 0; depth < 4 && ancestor; depth++) {
          const buttons = ancestor.querySelectorAll("button");
          if (buttons.length >= 2) {
            // input 앞뒤의 button 중 마지막 = + 버튼
            (buttons[buttons.length - 1] as HTMLElement).click();
            return true;
          }
          ancestor = ancestor.parentElement;
        }
        return false;
      });
      if (clicked) {
        console.log("   ✅ 장바구니 수량 증가 버튼 클릭 (evaluate)");
        return true;
      }
    }

    return false;
  }

  /** 구매 버튼 클릭 */
  async clickPurchaseButton(): Promise<boolean> {
    const patterns = [
      /^\s*구매하기\s*$/i,
      /^\s*구매\s*$/i,
      /^\s*Buy Now\s*$/i,
      /^\s*Buy\s*$/i,
      /^\s*Purchase\s*$/i,
    ];

    for (const pattern of patterns) {
      const candidates = [
        {
          locator: this.page.getByRole("button", { name: pattern }).last(),
          label: `role=button ${pattern}`,
        },
        {
          locator: this.page.locator("button").filter({ hasText: pattern }).last(),
          label: `button ${pattern}`,
        },
        {
          locator: this.page
            .locator('[role="button"]')
            .filter({ hasText: pattern })
            .last(),
          label: `[role="button"] ${pattern}`,
        },
      ];

      for (const candidate of candidates) {
        const visible = await candidate.locator
          .isVisible({ timeout: this.timeouts.short })
          .catch(() => false);
        if (!visible) continue;

        const enabled = await candidate.locator.isEnabled().catch(() => false);
        if (!enabled) continue;

        await candidate.locator.click();
        console.log(`✅ 구매 CTA 클릭: ${candidate.label}`);
        return true;
      }
    }

    return false;
  }

  /** 장바구니 담기 버튼 클릭 */
  async clickAddToCartButton(): Promise<boolean> {
    const tryClickCartButton = async (): Promise<boolean> => {
      for (const sel of this.addToCartSelectors) {
        const btn = this.page.locator(sel).first();
        const visible = await btn
          .isVisible({ timeout: this.timeouts.short })
          .catch(() => false);
        if (!visible) continue;

        const enabled = await btn.isEnabled().catch(() => false);
        if (!enabled) continue;

        await btn.click();
        console.log(`✅ 장바구니 담기 버튼 클릭: ${sel}`);
        return true;
      }
      return false;
    };

    if (await tryClickCartButton()) {
      return true;
    }

    // 모바일 상품 상세는 바텀시트/다이얼로그를 구매 CTA로 먼저 여는 경우가 있음.
    const purchaseButtonVisible = await this.purchaseButton
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
    if (!purchaseButtonVisible) {
      return false;
    }

    const purchaseButtonEnabled = await this.purchaseButton
      .isEnabled()
      .catch(() => false);
    if (!purchaseButtonEnabled) {
      return false;
    }

    await this.purchaseButton.click();
    await this.waitForNetworkStable(3000).catch(() => {});
    await this.waitForContentStable(500).catch(() => {});

    // 시트가 열린 뒤 옵션/수량 UI가 나타날 수 있어 한 번 더 맞춰줌.
    await this.selectFirstOption().catch(() => false);
    await this.setQuantity(1).catch(() => {});
    await this.waitForContentStable(300).catch(() => {});

    return await tryClickCartButton();
  }

  // --------------------------------------------------------------------------
  // 장바구니 기능
  // --------------------------------------------------------------------------

  /** 장바구니 아이템 개수 반환 */
  async getCartItemCount(): Promise<number> {
    return await this.cartItem.count();
  }

  /** 장바구니 수량 입력값 반환 (EN/KO 다국어 지원) */
  async getCartQuantity(): Promise<number> {
    // spinbutton (수량 +/- 컨트롤) 또는 textbox 중 보이는 것을 사용
    const candidates = [
      this.page.getByRole("spinbutton").first(),
      this.page.getByRole("textbox", { name: /Quantity|수량/i }),
      this.page.locator('input[type="number"]').first(),
    ];

    for (const input of candidates) {
      if (
        await input
          .isVisible({ timeout: this.timeouts.short })
          .catch(() => false)
      ) {
        const value = await input.inputValue();
        return parseInt(value, 10) || 0;
      }
    }
    return 0;
  }

  /** 장바구니 총 금액 반환 (정수, 원화 또는 센트) — EN/KO 다국어 지원 */
  async getCartTotalPrice(): Promise<number | null> {
    // "Total price" 또는 "총 상품금액" 등 다국어 라벨 탐색
    const totalLabel = this.page
      .getByText(/Total price|총\s*상품금액|총\s*금액/i)
      .first();
    if (
      await totalLabel
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false)
    ) {
      const parent = totalLabel.locator("xpath=..");
      const parentText = await parent.textContent().catch(() => "");
      if (parentText) {
        return this.parsePriceText(parentText);
      }
    }
    return null;
  }

  /** 가격 문자열에서 숫자를 추출 (달러→센트, 원화→정수, ₩ 기호 지원) */
  private parsePriceText(text: string): number | null {
    // 달러: $203.10 → 20310
    const dollarMatch = text.match(/\$([\d,]+\.?\d*)/);
    if (dollarMatch) {
      const dollars = parseFloat(dollarMatch[1].replace(/,/g, ""));
      if (!isNaN(dollars)) return Math.round(dollars * 100);
    }
    // 원화 기호: ₩68,000 또는 ￦68,000
    const wonSymbolMatch = text.match(/[₩￦]([\d,]+)/);
    if (wonSymbolMatch) {
      return parseInt(wonSymbolMatch[1].replace(/,/g, ""), 10);
    }
    // 원화 텍스트: 68,000원
    const wonTextMatch = text.match(/([\d,]+)\s*원/);
    if (wonTextMatch) {
      return parseInt(wonTextMatch[1].replace(/,/g, ""), 10);
    }
    return null;
  }

  /** 장바구니 비우기 */
  async clearCart(): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const itemCount = await this.getCartItemCount();
      if (itemCount === 0) {
        console.log("   장바구니 비어있음");
        return;
      }

      console.log(`   기존 상품 ${itemCount}개 (삭제 시도 ${attempt + 1}/3)`);

      // 체크박스 클릭
      if ((await this.cartCheckbox.count()) > 0) {
        const firstCheckbox = this.cartCheckbox.first();
        const isChecked = await firstCheckbox.isChecked().catch(() => false);
        if (!isChecked) {
          await firstCheckbox.click();
          await this.waitForContentStable(500);
        }
      }

      // Delete 버튼 클릭
      if (
        await this.cartDeleteButton
          .first()
          .isVisible({ timeout: 2000 })
          .catch(() => false)
      ) {
        await this.cartDeleteButton.first().click();
        await this.waitForNetworkStable(3000).catch(() => {});

        // 모달 내 Delete 버튼 클릭
        const allDeleteBtns = this.cartDeleteButton;
        if ((await allDeleteBtns.count()) >= 2) {
          await allDeleteBtns.last().click();
          await this.waitForNetworkStable(2000).catch(() => {});
          await this.reload();
          await this.waitForContentStable(500);
        }
      }
    }
    console.log("   ✅ 장바구니 초기화 완료");
  }

  // --------------------------------------------------------------------------
  // 마이페이지 기능
  // --------------------------------------------------------------------------

  private readonly myPageMenuItems: readonly MenuItem[] = [
    {
      name: "이벤트 응모정보 관리",
      texts: [
        "이벤트 응모정보 관리",
        "이벤트 응모",
        "Event Entry",
        "Manage Event Submissions",
      ],
    },
    {
      name: "비밀번호 변경",
      texts: ["비밀번호 변경", "비밀번호", "Password", "Change Password"],
    },
    {
      name: "팔로우 관리",
      texts: ["팔로우 관리", "팔로우", "Follow", "Manage Follows"],
    },
    {
      name: "주문내역",
      texts: ["주문내역", "주문 내역", "Order", "Order History"],
    },
    {
      name: "배송지 관리",
      texts: ["배송지 관리", "배송지", "Address", "Manage Delivery Address"],
    },
    {
      name: "알림 설정",
      texts: ["알림 설정", "알림", "Notification", "Notification Settings"],
    },
    { name: "로그아웃", texts: ["로그아웃", "Logout", "Log out", "Sign out"] },
  ] as const;

  /** 로그인 상태 확인 (비동기) */
  async checkLoggedIn(): Promise<boolean> {
    await this.waitForNetworkStable(2000).catch(() => {}); // 리다이렉트 대기
    const url = this.currentUrl;
    console.log(`📍 현재 URL: ${url}`);

    // 마이페이지에 머물러 있거나 로그인/인증 페이지로 리다이렉트되지 않았는지 확인
    const isOnMyPage = url.includes("my-page");
    const notRedirectedToLogin =
      !url.includes("login") && !url.includes("auth");
    const notRedirectedToHome =
      url !== `${this.baseUrl}/` && url !== this.baseUrl;

    return isOnMyPage && notRedirectedToLogin && notRedirectedToHome;
  }

  /** 로그인 상태 확인 (동기 - 레거시 호환) */
  isLoggedIn(): boolean {
    const url = this.currentUrl;
    return (
      url.includes("my-page") && !url.includes("login") && !url.includes("auth")
    );
  }

  /** 마이페이지 메뉴 항목 확인 */
  async verifyMyPageMenuItems(): Promise<number> {
    let foundCount = 0;

    for (const item of this.myPageMenuItems) {
      for (const text of item.texts) {
        const menuElement = this.page.locator(`text=${text}`).first();
        const isVisible = await menuElement
          .isVisible({ timeout: this.timeouts.short })
          .catch(() => false);
        if (isVisible) {
          console.log(`✅ "${item.name}" 메뉴 발견`);
          foundCount++;
          break;
        }
      }
    }

    return foundCount;
  }

  // --------------------------------------------------------------------------
  // 펀딩 페이지 기능
  // --------------------------------------------------------------------------

  /** 펀딩 페이지 타이틀 확인 */
  async verifyFundingTitle(): Promise<boolean> {
    const title = this.page
      .locator(
        "text=/프로젝트에 펀딩|펀딩|프로젝트|Fund your project|Funding/i",
      )
      .first();
    return await title
      .isVisible({ timeout: this.timeouts.medium })
      .catch(() => false);
  }

  /** 펀딩 프로젝트 탭 확인 */
  async verifyFundingTabs(): Promise<boolean> {
    const tabs = this.page
      .locator("text=/모든 프로젝트|진행중|종료된|All Projects|Ongoing|Ended/i")
      .first();
    return await tabs
      .isVisible({ timeout: this.timeouts.medium })
      .catch(() => false);
  }

  /** 펀딩 프로젝트 카드 개수 반환 */
  async getFundingCardCount(): Promise<number> {
    const cards = this.page.locator('a[href*="/product/"] img');
    return await cards.count();
  }

  // --------------------------------------------------------------------------
  // 상품 가격 관련 기능
  // --------------------------------------------------------------------------

  /** 현재 표시된 가격 추출 (숫자만) */
  async getCurrentPrice(): Promise<number | null> {
    const bodyText = await this.page.locator("body").innerText().catch(() => "");
    if (bodyText) {
      const totalPriceMatch = bodyText.match(
        /(?:Total price|총\s*상품금액|총\s*금액)[\s:]*([₩￦][\d,]+|\$[\d,]+(?:\.\d+)?|[\d,]+\s*원)/i,
      );
      if (totalPriceMatch) {
        const parsed = this.parsePriceText(totalPriceMatch[1]);
        if (parsed !== null) {
          return parsed;
        }
      }
    }

    const summaryLabels = [
      this.page.getByText(/총\s*상품금액|Total price|총\s*금액/i).first(),
      this.page.locator('text=/총\\s*상품금액|Total price|총\\s*금액/i').first(),
    ];

    for (const label of summaryLabels) {
      const visible = await label
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      if (!visible) continue;

      const parentText = await label
        .locator("xpath=ancestor::*[self::div or self::section][1]")
        .textContent()
        .catch(() => "");
      if (parentText) {
        const parsed = this.parsePriceText(parentText);
        if (parsed !== null) {
          return parsed;
        }
      }
    }

    const selectedSpinbuttonTotalPrice =
      await this.getSelectedSpinbuttonTotalPrice();
    if (selectedSpinbuttonTotalPrice !== null) {
      return selectedSpinbuttonTotalPrice;
    }

    const priceSelectors = [
      '[class*="price"]',
      '[class*="Price"]',
      '[class*="total"]',
      '[class*="Total"]',
      "text=/\\$[\\d,]+|₩[\\d,]+|[\\d,]+원/",
    ];

    for (const selector of priceSelectors) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
        const text = await element.textContent();
        if (text) {
          const parsed = this.parsePriceText(text);
          if (parsed !== null) {
            return parsed;
          }
        }
      }
    }
    return null;
  }

  private isMobileViewport(): boolean {
    const viewportWidth = this.page.viewportSize()?.width ?? 1280;
    return viewportWidth < 1024;
  }

  private async getVisibleOptionCards(): Promise<Locator[]> {
    const cards: Locator[] = [];
    const seenTexts = new Set<string>();

    for (const selector of this.optionCardSelectors) {
      const candidates = this.page.locator(selector);
      const count = await candidates.count().catch(() => 0);

      for (let i = 0; i < count; i++) {
        const candidate = candidates.nth(i);
        const visible = await candidate
          .isVisible({ timeout: this.timeouts.short })
          .catch(() => false);
        if (!visible) continue;

        const text = ((await candidate.textContent().catch(() => "")) || "")
          .replace(/\s+/g, " ")
          .trim();
        if (!text) continue;
        if (/총\s*상품금액|장바구니|구매하기|옵션 선택/i.test(text)) {
          continue;
        }
        if (!(/[₩￦]/.test(text) || /\d[\d,]*\s*원/.test(text))) {
          continue;
        }
        if (seenTexts.has(text)) continue;

        seenTexts.add(text);
        cards.push(candidate);
      }

      if (cards.length > 0) {
        return cards;
      }
    }

    return cards;
  }

  private async getSpinbuttonContextText(spinbutton: Locator): Promise<string> {
    let fallbackText = "";

    for (let depth = 1; depth <= 4; depth++) {
      const container = spinbutton.locator(
        `xpath=ancestor::*[self::div or self::li][${depth}]`,
      );
      const text = ((await container.textContent().catch(() => "")) || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;

      if (!fallbackText || text.length > fallbackText.length) {
        fallbackText = text;
      }

      if (
        /[₩￦]/.test(text) ||
        /\d[\d,]*\s*원/.test(text) ||
        /\$[\d,]+(?:\.\d+)?/.test(text)
      ) {
        return text;
      }
    }

    return fallbackText;
  }

  private async getSelectedSpinbuttonTotalPrice(): Promise<number | null> {
    const spinbuttons = this.page.getByRole("spinbutton");
    const spinCount = await spinbuttons.count().catch(() => 0);
    let totalPrice = 0;
    let hasSelectedOption = false;

    for (let i = 0; i < spinCount; i++) {
      const spinbutton = spinbuttons.nth(i);
      const visible = await spinbutton
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      if (!visible) continue;

      const quantity = parseInt(
        (await spinbutton.inputValue().catch(() => "0")) || "0",
        10,
      );
      if (Number.isNaN(quantity) || quantity <= 0) continue;

      const rowText = await this.getSpinbuttonContextText(spinbutton);
      const rowPrice = this.parsePriceText(rowText);
      if (rowPrice === null) continue;

      totalPrice += rowPrice * quantity;
      hasSelectedOption = true;
    }

    return hasSelectedOption ? totalPrice : null;
  }

  private async selectOptionCard(card: Locator): Promise<boolean> {
    const previousPrice = await this.getCurrentPrice();
    await card.scrollIntoViewIfNeeded().catch(() => {});
    await card.click({ force: true }).catch(() => {});
    await this.waitForContentStable(300).catch(() => {});

    const nextPrice = await this.getCurrentPrice();
    if (nextPrice !== null && (previousPrice === null || nextPrice !== previousPrice)) {
      return true;
    }

    const selectedClass = (await card.getAttribute("class").catch(() => "")) || "";
    return /selected|active|accent|primary/i.test(selectedClass);
  }

  async ensureOptionSelectionVisible(): Promise<boolean> {
    const firstSpinnerVisible = await this.page
      .getByRole("spinbutton")
      .first()
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
    if (firstSpinnerVisible) return true;

    const optionCards = await this.getVisibleOptionCards();
    if (optionCards.length > 0) return true;

    const optionDropdown = await this.findVisibleElement(
      this.optionDropdownSelectors,
      this.timeouts.short,
    );
    if (optionDropdown) return true;

    if (!this.isMobileViewport()) {
      return false;
    }

    const purchaseClicked = await this.clickPurchaseButton().catch(() => false);
    if (!purchaseClicked) {
      return false;
    }

    await this.waitForNetworkStable(2000).catch(() => {});
    await this.waitForContentStable(400).catch(() => {});

    if (/dialog=open/i.test(this.currentUrl)) {
      return true;
    }

    const refreshedOptionCards = await this.getVisibleOptionCards();
    return refreshedOptionCards.length > 0;
  }

  /** 옵션 드롭다운 클릭 및 옵션 목록 반환 */
  async getOptionList(): Promise<string[]> {
    const options: string[] = [];

    const spinbuttons = this.page.getByRole("spinbutton");
    const spinCount = await spinbuttons.count().catch(() => 0);
    for (let i = 0; i < spinCount; i++) {
      const spinbutton = spinbuttons.nth(i);
      const visible = await spinbutton
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      if (!visible) continue;

      const rowText = await this.getSpinbuttonContextText(spinbutton);
      options.push(
        rowText?.replace(/\s+/g, " ").trim() || `option-${i + 1}`,
      );
    }

    if (options.length > 0) {
      return options;
    }

    const optionCards = await this.getVisibleOptionCards();
    for (let i = 0; i < optionCards.length; i++) {
      const text = ((await optionCards[i].textContent().catch(() => "")) || "")
        .replace(/\s+/g, " ")
        .trim();
      if (text) {
        options.push(text);
      }
    }

    if (options.length > 0) {
      return options;
    }

    const optionDropdown = await this.findVisibleElement(
      this.optionDropdownSelectors,
      this.timeouts.medium,
    );

    if (optionDropdown) {
      await optionDropdown.element.click();
      await this.waitForContentStable(500);

      // 옵션 목록 수집
      const optionElements = this.page.locator(
        'option, [role="option"], li[class*="option"], [class*="dropdown"] li',
      );
      const count = await optionElements.count();

      for (let i = 0; i < count; i++) {
        const text = await optionElements.nth(i).textContent();
        if (text && text.trim()) {
          options.push(text.trim());
        }
      }
    }

    return options;
  }

  /** 특정 인덱스의 옵션 선택 */
  async selectOptionByIndex(index: number): Promise<boolean> {
    await this.ensureOptionSelectionVisible().catch(() => false);

    const spinbutton = this.page.getByRole("spinbutton").nth(index);
    const spinVisible = await spinbutton
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
    if (!spinVisible) {
      return false;
    }

    const previousValue = parseInt(
      (await spinbutton.inputValue().catch(() => "0")) || "0",
      10,
    );
    const container = spinbutton.locator("xpath=..");
    const plusCandidates = [
      container.locator("img").last(),
      container.locator("button").last(),
    ];

    for (const plusButton of plusCandidates) {
      const visible = await plusButton
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      if (!visible) continue;

      await plusButton.click().catch(() => {});
      await this.waitForContentStable(300).catch(() => {});

      const nextValue = parseInt(
        (await spinbutton.inputValue().catch(() => "0")) || "0",
        10,
      );
      if (nextValue > previousValue) {
        console.log(`   ✅ 옵션 ${index + 1} 선택 (spinbutton)`);
        return true;
      }
    }

    const optionCards = await this.getVisibleOptionCards();
    if (index < optionCards.length) {
      const selected = await this.selectOptionCard(optionCards[index]);
      if (selected) {
        console.log(`   ✅ 옵션 ${index + 1} 선택 (option card)`);
        return true;
      }
    }

    const optionDropdown = await this.findVisibleElement(
      this.optionDropdownSelectors,
      this.timeouts.medium,
    );
    if (!optionDropdown) return false;

    await optionDropdown.element.click();
    await this.waitForContentStable(500);

    const optionElements = this.page.locator(
      'option, [role="option"], li[class*="option"], [class*="dropdown"] li',
    );
    const count = await optionElements.count();

    if (index < count) {
      await optionElements.nth(index).click();
      console.log(`   ✅ 옵션 ${index + 1} 선택 (dropdown)`);
      return true;
    }

    return false;
  }

  /** 로그인 페이지/모달 표시 여부 확인 */
  async isLoginPromptVisible(): Promise<boolean> {
    const loginIndicators = [
      'button:has-text("Google")',
      'button:has-text("Apple")',
      'button:has-text("카카오")',
      'button:has-text("Kakao")',
      '[class*="google"]',
      '[class*="login"]',
      "text=/로그인|Sign in|Login|Sign up/i",
    ];

    for (const selector of loginIndicators) {
      const element = this.page.locator(selector).first();
      if (await element.isVisible({ timeout: 3000 }).catch(() => false)) {
        return true;
      }
    }

    // URL로도 확인
    const url = this.currentUrl;
    return (
      url.includes("login") || url.includes("auth") || url.includes("signin")
    );
  }

  /** 로그아웃 실행 */
  async logout(): Promise<boolean> {
    // 마이페이지로 이동하여 로그아웃
    await this.gotoMyPage();
    await this.handleModal();

    const logoutBtn = this.page
      .locator("text=/로그아웃|Logout|Log out|Sign out/i")
      .first();
    if (await logoutBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutBtn.click();
      await this.waitForNetworkStable(2000);
      console.log("✅ 로그아웃 버튼 클릭");
      return true;
    }
    return false;
  }

  /** 로그아웃 상태 확인 */
  async isLoggedOut(): Promise<boolean> {
    // 마이페이지 접근 시도
    await this.goto(`${this.baseUrl}/my-page`);
    await this.waitForLoadState("domcontentloaded");
    await this.waitForContentStable();

    const url = this.currentUrl;
    // 로그인 페이지로 리다이렉트되면 로그아웃 상태
    return (
      url.includes("login") || url.includes("auth") || !url.includes("my-page")
    );
  }

  // --------------------------------------------------------------------------
  // 검색 결과 관련 기능
  // --------------------------------------------------------------------------

  /**
   * 검색 결과 카드 개수 반환
   */
  async getSearchResultCount(): Promise<number> {
    await this.waitForElement(this.searchResultCards.first(), {
      timeout: this.timeouts.medium,
    }).catch(() => {});
    return await this.searchResultCards.count();
  }

  /**
   * 검색 결과가 표시될 때까지 대기
   * @param minCount 최소 결과 개수 (기본: 1)
   */
  async waitForSearchResults(minCount: number = 1): Promise<boolean> {
    try {
      await this.page.waitForFunction(
        ({ selector, min }) => {
          const cards = document.querySelectorAll(selector);
          return cards.length >= min;
        },
        {
          selector:
            'img[alt="album_image"], img[alt="sample_image"], img[alt="event-thumb-image"]',
          min: minCount,
        },
        { timeout: this.timeouts.long },
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 첫 번째 검색 결과 클릭
   */
  async clickFirstSearchResult(): Promise<boolean> {
    const hasResults = await this.waitForSearchResults();
    if (!hasResults) return false;

    // 검색 추천 모달이 클릭을 가로막을 수 있으므로 ESC로 닫기
    await this.page.keyboard.press("Escape");
    await this.waitForContentStable(300);

    // 모달이 여전히 있으면 force 옵션으로 클릭
    try {
      await this.searchResultCards.first().click({ timeout: 5000 });
    } catch {
      // 모달 가림 문제 발생 시 force 옵션 사용
      await this.searchResultCards.first().click({ force: true });
    }
    await this.waitForLoadState("domcontentloaded");
    return true;
  }

  // --------------------------------------------------------------------------
  // 필터/탭 관련 기능
  // --------------------------------------------------------------------------

  /**
   * 필터/탭 요소 존재 확인
   */
  async hasFilterTabs(): Promise<boolean> {
    return await this.filterTabs
      .first()
      .isVisible({ timeout: this.timeouts.medium })
      .catch(() => false);
  }

  /**
   * 필터/탭 클릭
   * @param text 클릭할 탭의 텍스트
   */
  async clickFilterTab(text: string): Promise<boolean> {
    const tab = this.page
      .locator(`[role="tab"]:has-text("${text}"), button:has-text("${text}")`)
      .first();
    if (
      await tab.isVisible({ timeout: this.timeouts.short }).catch(() => false)
    ) {
      await tab.click();
      await this.waitForContentStable();
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // 콘텐츠 대기 기능 (Hard wait 대체)
  // --------------------------------------------------------------------------

  /**
   * 페이지 콘텐츠(이미지/카드)가 로드될 때까지 대기
   * Hard wait 대신 사용
   */
  async waitForPageContent(): Promise<void> {
    await this.waitForLoadState("domcontentloaded");
    await Promise.race([
      this.waitForElement(this.contentImages.first(), {
        timeout: this.timeouts.long,
      }),
      this.waitForNetworkStable(this.timeouts.long),
    ]).catch(() => {});
  }

  /**
   * 모달 처리 후 콘텐츠 안정화 대기
   * 기존 handleModal() + wait() 조합 대체
   */
  async handleModalAndWaitForContent(): Promise<void> {
    await this.handleModal();
    await this.waitForContentStable("body", { stableTime: 500 });
  }

  // --------------------------------------------------------------------------
  // 비회원 테스트 헬퍼
  // --------------------------------------------------------------------------

  /**
   * 비회원 상태에서 페이지 요소 검증
   * @param page Playwright Page 객체 (incognito context용)
   */
  static async verifyGuestPageElements(
    page: import("@playwright/test").Page,
  ): Promise<{
    logo: boolean;
    navigation: boolean;
    content: boolean;
  }> {
    const logoVisible = await page
      .locator('img[alt="make-star"], img[alt*="makestar"]')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const navVisible = await page
      .getByRole("link", { name: /Home|Event|Shop/i })
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    const contentVisible = await page
      .locator(
        'img[alt="sample_image"], img[alt="event-thumb-image"], img[alt="album_image"]',
      )
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    return {
      logo: logoVisible,
      navigation: navVisible,
      content: contentVisible,
    };
  }

  /**
   * 비회원 상태에서 모달 닫기
   * @param page Playwright Page 객체 (incognito context용)
   */
  static async closeGuestModal(
    page: import("@playwright/test").Page,
  ): Promise<void> {
    const closeSelectors = [
      'button:has-text("Do not show")',
      'button:has-text("Close")',
      'button:has-text("닫기")',
      '[aria-label="Close"]',
      '[aria-label="close"]',
    ];

    // 모달이 여러 겹일 수 있으므로 최대 3회 반복
    for (let round = 0; round < 3; round++) {
      let dismissed = false;
      for (const selector of closeSelectors) {
        const btn = page.locator(selector).first();
        if (await btn.isVisible({ timeout: 1500 }).catch(() => false)) {
          await btn.click();
          await page.waitForTimeout(500);
          dismissed = true;
          break;
        }
      }
      if (!dismissed) break;
    }
  }

  // --------------------------------------------------------------------------
  // 성능 측정 (Web Vitals)
  // --------------------------------------------------------------------------

  /**
   * Core Web Vitals 측정
   * 실제 LCP, FCP, CLS 등을 측정하여 반환
   */
  async measureWebVitals(): Promise<WebVitalsResult> {
    return await this.page.evaluate(() => {
      type LCPEntry = PerformanceEntry & { startTime: number };
      type LayoutShiftEntry = PerformanceEntry & {
        hadRecentInput: boolean;
        value: number;
      };

      const navigation = performance.getEntriesByType(
        "navigation",
      )[0] as PerformanceNavigationTiming;
      const paintEntries = performance.getEntriesByType("paint");

      // FCP
      const fcpEntry = paintEntries.find(
        (e) => e.name === "first-contentful-paint",
      );
      const fcp = fcpEntry ? Math.round(fcpEntry.startTime) : 0;

      // LCP (PerformanceObserver로 이미 수집되어 있다면 사용)
      let lcp = 0;
      const lcpEntries = performance.getEntriesByType(
        "largest-contentful-paint",
      );
      if (lcpEntries.length > 0) {
        lcp = Math.round(
          (lcpEntries[lcpEntries.length - 1] as LCPEntry).startTime,
        );
      }

      // CLS (LayoutShift entries)
      let cls = 0;
      const layoutShiftEntries = performance.getEntriesByType("layout-shift");
      for (const entry of layoutShiftEntries) {
        const shift = entry as LayoutShiftEntry;
        if (!shift.hadRecentInput) {
          cls += shift.value || 0;
        }
      }

      return {
        fcp,
        lcp,
        ttfb: Math.round(navigation.responseStart - navigation.fetchStart),
        dcl: Math.round(
          navigation.domContentLoadedEventEnd - navigation.fetchStart,
        ),
        load: Math.round(navigation.loadEventEnd - navigation.fetchStart),
        cls: Math.round(cls * 1000) / 1000,
      };
    });
  }

  /**
   * 페이지 로딩 시간 측정 (개선된 버전)
   * domcontentloaded 대신 실제 LCP 기준으로 측정
   * @param url 측정할 URL
   * @returns 로딩 시간 (ms) 및 상세 메트릭
   */
  async measurePageLoadTime(url: string): Promise<{
    totalTime: number;
    vitals: WebVitalsResult;
  }> {
    const startTime = Date.now();

    await this.goto(url, { waitUntil: "load" });
    await this.waitForContentStable("body", { stableTime: 500 });

    const totalTime = Date.now() - startTime;
    const vitals = await this.measureWebVitals();

    return { totalTime, vitals };
  }

  /**
   * 아티스트 관련 요소 검증
   */
  async verifyArtistElements(): Promise<{
    image: boolean;
    name: boolean;
    products: boolean;
  }> {
    const imageVisible = await this.page
      .locator(
        'img[alt*="artist"], img[class*="artist"], img[class*="profile"]',
      )
      .first()
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);

    const nameVisible = await this.page
      .locator('h1, h2, [class*="name"], [class*="title"]')
      .first()
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);

    const productsVisible = await this.searchResultCards
      .first()
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);

    return {
      image: imageVisible,
      name: nameVisible,
      products: productsVisible,
    };
  }

  // --------------------------------------------------------------------------
  // 페이지 콘텐츠 확인 메서드 (spec에서 직접 locator 사용 방지)
  // --------------------------------------------------------------------------

  /** Event 링크 존재 확인 (GNB eventButton 폴백) */
  async hasEventLink(timeout = 5000): Promise<boolean> {
    const eventLink = this.page
      .getByRole("link", { name: /event/i })
      .or(this.page.locator('a[href*="event"]'))
      .first();
    return await eventLink.isVisible({ timeout }).catch(() => false);
  }

  /** 검색 결과 텍스트 확인 (URL 또는 화면에서 검색 키워드/결과 텍스트 존재 확인) */
  async hasSearchResultText(keyword: string): Promise<boolean> {
    const currentUrl = this.currentUrl;
    if (/search|keyword|q=/i.test(currentUrl)) return true;
    return await this.page
      .locator(`text=/${keyword}|검색 결과|결과/i`)
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
  }

  /** 최근 검색어 관련 요소 표시 확인 */
  async hasRecentSearchIndicators(keyword: string): Promise<boolean> {
    const sectionIndicators = [
      this.page.getByText(/최근 검색어|Recent searches|최근 검색|검색 기록/i),
      this.page.locator('[class*="recent"], [class*="history"]'),
    ];

    const keywordPattern = new RegExp(
      keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );

    for (const indicator of sectionIndicators) {
      const container = indicator.first();
      const visible = await container
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      if (!visible) continue;

      const text = (await container.textContent().catch(() => "")) || "";
      if (keywordPattern.test(text)) {
        return true;
      }
    }

    const recentLabelVisible = await this.page
      .getByText(/최근 검색어|Recent searches|최근 검색|검색 기록/i)
      .first()
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
    if (!recentLabelVisible) return false;

    return await this.page
      .getByText(keyword, { exact: false })
      .first()
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
  }

  /** 마이페이지 콘텐츠 존재 확인 */
  async hasMyPageContent(timeout = 5000): Promise<boolean> {
    return await this.page
      .getByText(/마이페이지|My Page|내 정보|profile|주문|order/i)
      .first()
      .isVisible({ timeout })
      .catch(() => false);
  }

  /** 주문내역 페이지 콘텐츠 존재 확인 */
  async hasOrderHistoryContent(timeout = 5000): Promise<boolean> {
    return await this.page
      .getByText(
        /주문|우충전 주문|order|내역|history|없습니다|empty|Order History/i,
      )
      .first()
      .isVisible({ timeout })
      .catch(() => false);
  }

  /** 배송지 관리 페이지 콘텐츠 존재 확인 */
  async hasAddressContent(timeout = 5000): Promise<boolean> {
    return await this.page
      .getByText(/배송지|address|추가|add|없습니다|empty|Shipping|Address/i)
      .first()
      .isVisible({ timeout })
      .catch(() => false);
  }

  /** 비밀번호 입력 필드 존재 확인 및 개수 반환 */
  async getPasswordInputCount(timeout = 5000): Promise<number> {
    const roleInput = this.page
      .getByRole("textbox", { name: /password|비밀번호/i })
      .first();
    const typeInput = this.page.locator('input[type="password"]').first();
    const hasInput = await roleInput
      .or(typeInput)
      .isVisible({ timeout })
      .catch(() => false);
    if (!hasInput) return 0;
    return await this.page.locator('input[type="password"]').count();
  }

  /** 이벤트 응모정보 페이지 콘텐츠 존재 확인 */
  async hasEventEntryContent(timeout = 5000): Promise<boolean> {
    const selectors = [
      "text=/이벤트 응모|Event Entry|Event Submissions|Manage Event Submissions|응모 정보|응모정보|이벤트 참여|Submission/i",
      "text=/응모 내역|참여 내역|Entry History|Register Submission/i",
      '[class*="event-submissions"]',
      '[class*="entry"]',
    ];
    for (const selector of selectors) {
      const visible = await this.page
        .locator(selector)
        .first()
        .isVisible({ timeout })
        .catch(() => false);
      if (visible) return true;
    }
    return false;
  }

  /** 이벤트 응모 내역/빈 상태 메시지 존재 확인 */
  async hasEventEntryListContent(timeout = 5000): Promise<boolean> {
    return await this.page
      .locator(
        "text=/응모|참여|entry|submission|내역|없습니다|empty|No entries|Register/i",
      )
      .first()
      .isVisible({ timeout })
      .catch(() => false);
  }

  /** 팔로우 관리 페이지 콘텐츠 존재 확인 */
  async hasFollowContent(timeout = 5000): Promise<boolean> {
    return await this.page
      .getByText(/팔로우|Follow|Following|팔로잉|없습니다|empty|No follows/i)
      .first()
      .isVisible({ timeout })
      .catch(() => false);
  }

  /** 알림 설정 페이지 콘텐츠 존재 확인 */
  async hasNotificationContent(timeout = 5000): Promise<boolean> {
    return await this.page
      .getByText(/알림|Notification|푸시|Push|이메일|Email|설정|Settings/i)
      .first()
      .isVisible({ timeout })
      .catch(() => false);
  }

  /** 이메일 로그인 테스트 전에 백업한 쿠키 (테스트 후 복원용) */
  private savedCookiesBeforeEmailLogin: Awaited<
    ReturnType<import("@playwright/test").BrowserContext["cookies"]>
  > = [];

  /**
   * 이메일 로그인 페이지로 이동 (공통 헬퍼).
   * auth 도메인 쿠키를 클리어한 후 로그인 선택 → Email로 계속하기 → 이메일 입력 페이지까지 이동합니다.
   */
  private async navigateToEmailLoginPage(): Promise<boolean> {
    const authBaseUrl = this.baseUrl.includes("stage")
      ? "https://stage-auth.makeuni2026.com"
      : "https://auth.makestar.com";

    // 쿠키 백업 후 auth 도메인만 클리어 (기존 세션이 로그인 플로우를 간섭하지 않도록)
    this.savedCookiesBeforeEmailLogin = await this.page.context().cookies();
    await this.page.context().clearCookies({ domain: /auth/ });

    // 로그인 페이지 이동
    await this.goto(
      `${authBaseUrl}/login/?application=MAKESTAR&redirect_url=${this.baseUrl}/my-page`,
    );
    await this.waitForLoadState("domcontentloaded");
    await this.waitForNetworkStable(5000).catch(() => {});

    // Email로 계속하기 클릭 + /login/email 페이지 전환 대기
    const emailBtn = this.page
      .getByRole("button", { name: /Email로 계속하기/i })
      .first();
    await emailBtn.click({ timeout: 10000 });

    // URL이 /login/email로 변경될 때까지 대기
    await this.page
      .waitForURL(/\/login\/email/, { timeout: 10000 })
      .catch(() => {});
    await this.waitForLoadState("domcontentloaded");

    // 이메일 입력 필드 표시 확인
    const emailInput = this.page.getByRole("textbox", {
      name: /이메일 아이디/i,
    });
    return await emailInput.isVisible({ timeout: 10000 }).catch(() => false);
  }

  /** 이메일 로그인 테스트 후 원래 쿠키를 복원합니다. */
  async restoreAuthCookies(): Promise<void> {
    if (this.savedCookiesBeforeEmailLogin.length > 0) {
      await this.page.context().clearCookies();
      await this.page.context().addCookies(this.savedCookiesBeforeEmailLogin);
      this.savedCookiesBeforeEmailLogin = [];
    }
  }

  /**
   * 현재 컨텍스트에 적용된 auth storageState 요약을 반환합니다.
   * auth.json 기반 세션이 정상 주입되었는지 점검할 때 사용합니다.
   */
  async getAuthSessionSnapshot(): Promise<{
    hasRefreshToken: boolean;
    hasLoggedInUser: boolean;
    email: string | null;
  }> {
    const state = await this.page.context().storageState();
    const hasRefreshToken = state.cookies.some(
      (cookie) =>
        cookie.name === "refresh_token" &&
        /makestar|makeuni/i.test(cookie.domain ?? ""),
    );

    let hasLoggedInUser = false;
    let email: string | null = null;

    for (const origin of state.origins) {
      if (!/makestar\.com|makeuni/i.test(origin.origin)) continue;

      const loggedInUser = origin.localStorage?.find(
        (item) => item.name === "LOGGED_IN_USER",
      );
      if (!loggedInUser?.value) continue;

      hasLoggedInUser = true;
      try {
        const parsed = JSON.parse(loggedInUser.value) as { email?: string };
        email = parsed.email?.trim() || null;
      } catch {
        // localStorage 값이 손상된 경우에도 존재 여부는 유지
      }
      break;
    }

    return {
      hasRefreshToken,
      hasLoggedInUser,
      email,
    };
  }

  /**
   * 이메일 로그인 페이지로 이동하여 이메일 입력 후 "다음" 버튼 활성화 여부를 검증합니다.
   * React SPA 특성상 fill() 대신 keyboard.type() + Tab(blur)으로 상태를 동기화합니다.
   *
   * @returns 이메일 입력 단계 검증 결과 (다음 버튼 활성화 여부 포함)
   */
  async verifyEmailLoginNextButton(email: string): Promise<{
    emailPageLoaded: boolean;
    nextButtonDisabledInitially: boolean;
    nextButtonEnabledAfterInput: boolean;
  }> {
    const emailPageLoaded = await this.navigateToEmailLoginPage();

    if (!emailPageLoaded) {
      return {
        emailPageLoaded: false,
        nextButtonDisabledInitially: false,
        nextButtonEnabledAfterInput: false,
      };
    }

    // 초기 상태: "다음" 버튼 disabled 확인
    const nextButton = this.page.getByRole("button", { name: "다음" });
    const nextButtonDisabledInitially = await nextButton
      .isDisabled()
      .catch(() => false);

    // 이메일 입력 (keyboard.type + Tab으로 React state 동기화)
    const emailInput = this.page.getByRole("textbox", {
      name: /이메일 아이디/i,
    });
    await emailInput.click();
    await this.page.keyboard.type(email);
    await this.page.keyboard.press("Tab");
    await this.page.waitForTimeout(500);

    // "다음" 버튼 활성화 확인
    const nextButtonEnabledAfterInput = await nextButton
      .isEnabled({ timeout: 5000 })
      .catch(() => false);

    return {
      emailPageLoaded,
      nextButtonDisabledInitially,
      nextButtonEnabledAfterInput,
    };
  }

  /**
   * 이메일 + 비밀번호로 전체 로그인 플로우를 실행합니다.
   * 로그인 성공 시 리다이렉트된 URL을 반환합니다.
   *
   * @returns 로그인 결과 (성공 여부 + 최종 URL)
   */
  async loginWithEmail(
    email: string,
    password: string,
  ): Promise<{ success: boolean; finalUrl: string; reason?: string }> {
    const emailPageLoaded = await this.navigateToEmailLoginPage();
    if (!emailPageLoaded) {
      return {
        success: false,
        finalUrl: this.currentUrl,
        reason: "이메일 입력 필드 미표시",
      };
    }

    // 이메일 입력
    const emailInput = this.page.getByRole("textbox", {
      name: /이메일 아이디/i,
    });
    await emailInput.click();
    await this.page.keyboard.type(email);
    await this.page.keyboard.press("Tab");
    await this.page.waitForTimeout(500);

    // 다음 버튼 클릭 (이메일 단계)
    const nextBtnEmail = this.page.getByRole("button", { name: "다음" });
    const emailNextEnabled = await nextBtnEmail
      .isEnabled({ timeout: 5000 })
      .catch(() => false);
    if (!emailNextEnabled) {
      return {
        success: false,
        finalUrl: this.currentUrl,
        reason: "이메일 입력 후 다음 버튼 미활성화",
      };
    }
    await nextBtnEmail.click();

    // /login/password 페이지 전환 대기
    await this.page
      .waitForURL(/\/login\/password/, { timeout: 10000 })
      .catch(() => {});
    await this.waitForLoadState("domcontentloaded");

    // 비밀번호 입력
    const passwordInput = this.page.getByRole("textbox", {
      name: /비밀번호/i,
    });
    const passwordVisible = await passwordInput
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    if (!passwordVisible) {
      return {
        success: false,
        finalUrl: this.currentUrl,
        reason: "비밀번호 입력 필드 미표시",
      };
    }

    await passwordInput.click();
    await this.page.keyboard.type(password);
    await this.page.keyboard.press("Tab");
    await this.page.waitForTimeout(500);

    // 다음 버튼 클릭 (비밀번호 단계)
    const nextBtnPassword = this.page.getByRole("button", { name: "다음" });
    const pwNextEnabled = await nextBtnPassword
      .isEnabled({ timeout: 5000 })
      .catch(() => false);
    if (!pwNextEnabled) {
      return {
        success: false,
        finalUrl: this.currentUrl,
        reason: "비밀번호 입력 후 다음 버튼 미활성화",
      };
    }
    await nextBtnPassword.click();

    // 리다이렉트 대기
    await this.page
      .waitForURL((url) => !url.href.includes("auth."), { timeout: 15000 })
      .catch(() => {});
    await this.waitForLoadState("domcontentloaded");

    const finalUrl = this.currentUrl;
    const success = !finalUrl.includes("auth.") && !finalUrl.includes("/login");

    return {
      success,
      finalUrl,
      reason: success ? undefined : "로그인 리다이렉트 실패",
    };
  }

  /** Shop 페이지에서 품절 상품 표시 여부 확인 */
  async hasSoldOutIndicator(timeout = 3000): Promise<boolean> {
    const selectors = [
      "text=/Sold Out|sold out|품절|SOLD OUT/i",
      '[class*="sold-out"]',
      '[class*="soldout"]',
      '[class*="out-of-stock"]',
    ];
    for (const selector of selectors) {
      const visible = await this.page
        .locator(selector)
        .first()
        .isVisible({ timeout })
        .catch(() => false);
      if (visible) return true;
    }
    return false;
  }
}
