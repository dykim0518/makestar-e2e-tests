/**
 * AdminNotificationListPage - 공지사항 목록 페이지 (공지관리/팝업관리 탭)
 *
 * URL: /notification/list (탭 전환은 클라이언트 사이드, URL 동일)
 * 페이지 헤딩: "공지관리" 고정 (탭 전환과 무관)
 * 탭은 semantic role 없이 div + cursor-pointer로 구현됨.
 *
 * 인증 주의: 본 페이지는 운영(공지/팝업) 권한이 필요. 시스템 토큰
 * (cloudtask-system)으로 API 인터셉터를 켜면 forbidden되므로,
 * spec에서 setupApiInterceptor를 사용하지 않고 본인 세션 쿠키만 사용.
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage } from "./admin-base.page";

export type NotificationTab = "공지관리" | "팝업관리";

export class AdminNotificationListPage extends AdminBasePage {
  readonly heading: Locator;
  readonly tabContainer: Locator;
  readonly noticeTab: Locator;
  readonly popupTab: Locator;
  readonly registerButton: Locator;
  readonly perPageSelector: Locator;

  constructor(page: Page) {
    super(page);

    this.heading = page.getByRole("heading", { name: "공지관리", exact: true });
    this.tabContainer = page.locator("div.flex.px-6.gap-4");
    this.noticeTab = this.tabContainer.getByText("공지관리", { exact: true });
    this.popupTab = this.tabContainer.getByText("팝업관리", { exact: true });
    // 활성 탭에 따라 라벨이 다름 — 두 패턴 모두 매칭
    this.registerButton = page.getByText(/^(알림 생성|팝업 생성)$/);
    this.perPageSelector = page.getByText("/ page", { exact: false });
  }

  getPageUrl(): string {
    return `${this.baseUrl}/notification/list`;
  }

  getHeadingText(): string {
    return "공지관리";
  }

  /** 활성 탭 이름 반환 — 비활성 탭은 text-secondary 클래스를 가짐 */
  async getActiveTabName(): Promise<NotificationTab | null> {
    const tabs: NotificationTab[] = ["공지관리", "팝업관리"];
    for (const name of tabs) {
      const tab = this.tabContainer.getByText(name, { exact: true });
      const klass = (await tab.getAttribute("class").catch(() => "")) || "";
      if (!/text-secondary/.test(klass)) return name;
    }
    return null;
  }

  /** 공지관리 탭으로 전환 */
  async switchToNoticeTab(): Promise<void> {
    await this.noticeTab.click({ force: true });
    await this.waitForContentStable();
  }

  /** 팝업관리 탭으로 전환 */
  async switchToPopupTab(): Promise<void> {
    await this.popupTab.click({ force: true });
    await this.waitForContentStable();
  }

  /** "+ 알림 생성" 버튼 클릭 → 활성 탭에 따라 등록 페이지로 이동 */
  async clickRegisterButton(): Promise<void> {
    await this.registerButton.click({ force: true });
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  /** N행의 삭제(휴지통) 아이콘 (마지막 컬럼) */
  getDeleteIconForRow(rowIndex: number): Locator {
    return this.tableRows.nth(rowIndex).locator("td").last();
  }

  /**
   * 팝업관리 탭 컬럼 헤더 검증.
   * 팝업관리는 `<table>`이 아닌 div grid 구조라 AdminBasePage.assertTableHeaders 사용 불가.
   */
  async assertPopupColumns(): Promise<void> {
    for (const col of ["순서", "배너", "이름", "게시기간"]) {
      await expect(
        this.page.getByText(col, { exact: true }).first(),
      ).toBeVisible();
    }
  }

  /** "최대 5개까지 등록 가능합니다" 안내 문구 가시성 */
  async assertPopupSlotLimitNotice(): Promise<void> {
    await expect(
      this.page.getByText(/최대 5개까지 등록 가능합니다/),
    ).toBeVisible();
  }
}
