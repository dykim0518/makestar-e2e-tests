/**
 * POCAAlbum Admin 대시보드 페이지
 *
 * /pocaalbum/test 단일 페이지 (컴포넌트 쇼케이스)
 * 사이드바 메뉴: 앨범, FAVE, BENEFIT, Shop, 당첨자조회, 알림, 신고내역, 고객관리, 시스템관리
 * 대시보드 카드: 총 매출, 사용자, 앨범, 평점
 * 테이블: ID | 앨범명 | 아티스트 | 발매일 | 상태 | 액션
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";
import type { TimeoutConfig } from "./base.page";

// ============================================================================
// 상수
// ============================================================================

/** 사이드바 메뉴 항목 */
export const POCA_SIDEBAR_MENUS = [
  "앨범",
  "FAVE",
  "BENEFIT",
  "Shop",
  "당첨자조회",
  "알림",
  "신고내역",
  "고객관리",
  "시스템관리",
] as const;

export type PocaSidebarMenu = (typeof POCA_SIDEBAR_MENUS)[number];

/** 대시보드 통계 카드 */
export const POCA_DASHBOARD_CARDS = [
  "총 매출",
  "사용자",
  "앨범",
  "평점",
] as const;

/** 테이블 컬럼 */
export const POCA_TABLE_HEADERS = [
  "ID",
  "앨범명",
  "아티스트",
  "발매일",
  "상태",
  "액션",
] as const;

/** 유효한 상태 값 */
export const POCA_VALID_STATUSES = ["활성", "비활성"] as const;

/** 컴포넌트 섹션 heading 텍스트 */
export const POCA_SECTIONS = {
  dashboard: "검보",
  salesStats: "매출 통계",
  table: "Table 컴포넌트 테스트",
  imageUpload: "ImageDetailUpload 컴포넌트 테스트",
  mobilePreview: "MobilePreview 컴포넌트 테스트",
  editor: "Editor 컴포넌트 테스트 (Toast UI Editor)",
  userSearchDialog: "UserSearchDialog 컴포넌트 테스트",
  fileUpload: "🆕 파일 업로드 Composable 테스트 (리팩토링 버전)",
  faveShot: "FaveShot 컴포넌트 테스트",
} as const;

// ============================================================================
// PocaDashboardPage 클래스
// ============================================================================

export class PocaDashboardPage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 사이드바 로케이터
  // --------------------------------------------------------------------------

  readonly sidebar: Locator;
  readonly sidebarTitle: Locator;
  readonly sidebarEmail: Locator;

  // --------------------------------------------------------------------------
  // 대시보드 로케이터
  // --------------------------------------------------------------------------

  readonly dashboardHeading: Locator;
  readonly autoLogoutTimer: Locator;

  constructor(page: Page, timeouts: TimeoutConfig = ADMIN_TIMEOUTS) {
    super(page, timeouts);

    // 현재 사이드바는 텍스트 기반 구조가 가장 안정적이다.
    this.sidebarTitle = page.getByRole("button", {
      name: "포카앨범 관리시스템",
    });
    this.sidebar = page
      .locator("div")
      .filter({ has: this.sidebarTitle })
      .first();
    this.sidebarEmail = page
      .locator("div")
      .filter({ hasText: /@/ })
      .first();

    // 대시보드
    this.dashboardHeading = page.locator('h2:has-text("검보")');
    this.autoLogoutTimer = page.locator(':text("자동 로그아웃")');
  }

  // --------------------------------------------------------------------------
  // 추상 메서드 구현
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return "/pocaalbum/test";
  }

  getHeadingText(): string {
    return "검보";
  }

  // --------------------------------------------------------------------------
  // 네비게이션 (baseUrl 포함 전체 URL 사용)
  // --------------------------------------------------------------------------

  /** POCAAlbum 테스트 페이지로 이동 */
  async navigate(retryCount: number = 3): Promise<void> {
    const url = `${this.baseUrl}${this.getPageUrl()}`;
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        await this.page.goto(url, {
          waitUntil: "domcontentloaded",
          timeout: this.timeouts.navigation,
        });
      } catch (e: unknown) {
        if (attempt < retryCount) {
          console.warn(
            `⚠️ 페이지 로드 실패 (시도 ${attempt + 1}/${retryCount + 1}) - 재시도`,
          );
          continue;
        }
        throw e;
      }

      await this.page.waitForLoadState("networkidle").catch(() => {});
      const currentUrl = this.page.url();

      if (currentUrl.includes("/login") || currentUrl.includes("/auth")) {
        if (attempt < retryCount) {
          console.warn(
            `⚠️ 로그인 페이지로 리다이렉트됨 (시도 ${attempt + 1}/${retryCount + 1})`,
          );
          continue;
        }
        throw new Error(
          `인증 실패: 로그인 페이지로 리다이렉트됨 (${currentUrl})`,
        );
      }

      return;
    }
  }

  // --------------------------------------------------------------------------
  // 사이드바
  // --------------------------------------------------------------------------

  /** 사이드바가 펼쳐지고 메뉴 항목이 렌더링될 때까지 대기 */
  async ensureSidebarLoaded(): Promise<boolean> {
    const sidebarVisible = await this.sidebarTitle
      .isVisible({ timeout: this.timeouts.medium })
      .catch(() => false);
    if (!sidebarVisible) {
      console.warn("⚠️ 사이드바 타이틀이 보이지 않습니다");
      return false;
    }

    const firstMenuSpan = this.page
      .locator("li.relative span.title-sb-medium")
      .first();
    const menuExists = await firstMenuSpan
      .isVisible({ timeout: this.timeouts.long })
      .catch(() => false);

    if (menuExists) return true;

    const toggleBtn = this.sidebar
      .locator("button")
      .first();
    if (await toggleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log("ℹ️ 사이드바 토글 클릭 시도");
      await this.clickWithRecovery(toggleBtn, {
        timeout: this.timeouts.medium,
      });
      const afterToggle = await firstMenuSpan
        .isVisible({ timeout: this.timeouts.medium })
        .catch(() => false);
      if (afterToggle) return true;
    }

    return false;
  }

  /** 사이드바 메뉴 항목 로케이터 (다중 전략) */
  getSidebarMenuItem(menuName: PocaSidebarMenu): Locator {
    return this.page
      .locator("li.relative span.title-sb-medium")
      .filter({ hasText: menuName })
      .first();
  }

  /** 사이드바 메뉴 클릭 */
  async clickSidebarMenu(menuName: PocaSidebarMenu): Promise<void> {
    const menuItem = this.getSidebarMenuItem(menuName);
    await expect(menuItem).toBeVisible({ timeout: this.timeouts.long });

    const clickable = menuItem
      .locator(
        'xpath=ancestor::li[contains(@class,"relative")][1]//div[contains(@class,"cursor-pointer")][1]',
      )
      .first();

    if (await clickable.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.clickWithRecovery(clickable, {
        timeout: this.timeouts.medium,
      });
      return;
    }

    await this.clickWithRecovery(menuItem, {
      timeout: this.timeouts.medium,
    });
  }

  /** 사이드바 메뉴 텍스트 목록 반환 */
  async getSidebarMenuTexts(): Promise<string[]> {
    const menuSpans = this.page.locator("li.relative span.title-sb-medium");
    const count = await menuSpans.count();
    const texts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await menuSpans.nth(i).textContent())?.trim() || "";
      if (text) texts.push(text);
    }
    return texts;
  }

  // --------------------------------------------------------------------------
  // 대시보드 카드
  // --------------------------------------------------------------------------

  /** 통계 카드 로케이터 */
  getDashboardCard(cardTitle: string): Locator {
    return this.page.locator(`h3:has-text("${cardTitle}")`).first();
  }

  /** 통계 카드 값 반환 */
  async getDashboardCardValue(cardTitle: string): Promise<string> {
    const card = this.getDashboardCard(cardTitle);
    // 카드 값은 h3의 형제 또는 부모 내 값 요소에 있음
    const parent = card.locator("..");
    const value = parent
      .locator('[class*="headline"], [class*="display"]')
      .first();
    return (await value.textContent())?.trim() || "";
  }

  // --------------------------------------------------------------------------
  // 테이블 (부모 클래스 메서드 활용)
  // --------------------------------------------------------------------------

  /** 예상 테이블 헤더 반환 */
  getExpectedHeaders(): string[] {
    return [...POCA_TABLE_HEADERS];
  }

  /** 첫 번째 행의 앨범명 반환 */
  async getFirstRowAlbumName(): Promise<string> {
    return (await this.getCellText(0, 1)).trim();
  }

  /** 첫 번째 행의 아티스트 반환 */
  async getFirstRowArtist(): Promise<string> {
    return (await this.getCellText(0, 2)).trim();
  }

  // --------------------------------------------------------------------------
  // 페이지네이션 (부모 클래스 메서드 활용)
  // --------------------------------------------------------------------------

  /** 페이지네이션 존재 여부 */
  async hasPagination(): Promise<boolean> {
    return await this.paginationNav.isVisible().catch(() => false);
  }

  // --------------------------------------------------------------------------
  // Assertions
  // --------------------------------------------------------------------------

  /** 사이드바 메뉴 검증 */
  async assertSidebarMenus(): Promise<void> {
    for (const menuName of POCA_SIDEBAR_MENUS) {
      const menuItem = this.getSidebarMenuItem(menuName);
      await expect(menuItem).toBeVisible({ timeout: this.timeouts.medium });
    }
  }

  /** 대시보드 통계 카드 검증 */
  async assertDashboardCards(): Promise<void> {
    for (const cardTitle of POCA_DASHBOARD_CARDS) {
      const card = this.getDashboardCard(cardTitle);
      await expect(card).toBeVisible({ timeout: this.timeouts.medium });
    }
  }

  /** 자동 로그아웃 타이머 검증 */
  async assertAutoLogoutTimer(): Promise<void> {
    await expect(this.autoLogoutTimer).toBeVisible({
      timeout: this.timeouts.medium,
    });
  }

  // --------------------------------------------------------------------------
  // 데이터 정합성
  // --------------------------------------------------------------------------

  /** 시스템 타이틀 "포카앨범 관리시스템" 검증 */
  async assertSystemTitle(): Promise<void> {
    await expect(this.sidebarTitle).toBeVisible({
      timeout: this.timeouts.medium,
    });
  }

  /** 사용자 이메일 반환 */
  async getUserEmail(): Promise<string> {
    const emailEl = this.sidebarEmail;
    return (await emailEl.textContent())?.trim() || "";
  }

  // --------------------------------------------------------------------------
  // 테이블 데이터
  // --------------------------------------------------------------------------

  /** 첫 번째 행 상태 값 반환 (컬럼 인덱스 5) */
  async getFirstRowStatus(): Promise<string> {
    return (await this.getCellText(0, 5)).trim();
  }

  /** 첫 번째 행 액션 버튼 (컬럼 인덱스 6) */
  getFirstRowActionButtons(): Locator {
    const actionCell = this.tableRows.first().locator("td").nth(6);
    return actionCell.locator("button");
  }

  // --------------------------------------------------------------------------
  // 섹션 스크롤
  // --------------------------------------------------------------------------

  /** 특정 h2 헤딩 텍스트의 섹션으로 스크롤 */
  async scrollToSection(headingText: string): Promise<Locator> {
    const heading = this.page.locator(`h2:has-text("${headingText}")`).first();
    await heading.scrollIntoViewIfNeeded();
    return heading;
  }

  // --------------------------------------------------------------------------
  // 컴포넌트: Editor (Toast UI)
  // --------------------------------------------------------------------------

  /** Editor 섹션 heading 가시성 */
  async isEditorVisible(): Promise<boolean> {
    const heading = this.page
      .locator(`h2:has-text("${POCA_SECTIONS.editor}")`)
      .first();
    await heading.scrollIntoViewIfNeeded().catch(() => {});
    return heading.isVisible({ timeout: this.timeouts.medium });
  }

  /** Editor 툴바 버튼 개수 반환 */
  async getEditorToolbarButtonCount(): Promise<number> {
    const toolbar = this.page.locator(".toastui-editor-toolbar-icons");
    return toolbar.count();
  }

  // --------------------------------------------------------------------------
  // 컴포넌트: MobilePreview
  // --------------------------------------------------------------------------

  /** MobilePreview 섹션 가시성 */
  async isMobilePreviewVisible(): Promise<boolean> {
    const heading = this.page
      .locator(`h2:has-text("${POCA_SECTIONS.mobilePreview}")`)
      .first();
    await heading.scrollIntoViewIfNeeded().catch(() => {});
    return heading.isVisible({ timeout: this.timeouts.medium });
  }

  // --------------------------------------------------------------------------
  // 컴포넌트: UserSearchDialog
  // --------------------------------------------------------------------------

  /** 유저 검색 팝업 열기 버튼 */
  getUserSearchDialogTrigger(): Locator {
    return this.page.getByRole("button", { name: "유저 검색 팝업 열기" });
  }

  /** 유저 검색 다이얼로그 열기 */
  async openUserSearchDialog(): Promise<void> {
    const trigger = this.getUserSearchDialogTrigger();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
  }

  // --------------------------------------------------------------------------
  // 컴포넌트: FaveShot
  // --------------------------------------------------------------------------

  /** FaveShot 섹션 이미지 수 */
  async getFaveShotImageCount(): Promise<number> {
    await this.scrollToSection(POCA_SECTIONS.faveShot);
    const images = this.page
      .locator(`h2:has-text("${POCA_SECTIONS.faveShot}")`)
      .locator("..")
      .locator("..")
      .locator("img");
    return images.count();
  }

  // --------------------------------------------------------------------------
  // 컴포넌트: 파일 업로드
  // --------------------------------------------------------------------------

  /** 파일 업로드 탭 버튼들 */
  getFileUploadTabs(): Locator {
    return this.page
      .locator(`h2:has-text("${POCA_SECTIONS.fileUpload}")`)
      .locator("..")
      .locator("..")
      .locator("button");
  }

  // --------------------------------------------------------------------------
  // 사이드바 네비게이션 검증
  // --------------------------------------------------------------------------

  /** 메뉴 클릭 후 에러 없이 동작하는지 검증 */
  async clickMenuAndVerifyNoError(
    menuName: PocaSidebarMenu,
  ): Promise<{ url: string; hasError: boolean }> {
    await this.clickSidebarMenu(menuName);
    // SPA 라우팅 대기
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
    await this.page
      .waitForLoadState("networkidle", { timeout: 3000 })
      .catch(() => {});

    const url = this.page.url();
    const errorCount = await this.page
      .locator(
        '[class*="error"]:visible, :text("에러"):visible, :text("오류"):visible',
      )
      .count();

    return { url, hasError: errorCount > 0 };
  }
}
