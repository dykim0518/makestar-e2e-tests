/**
 * 이벤트 당첨 관리 — 이벤트 상세 페이지 객체
 *
 * URL 패턴: /event-winning-manage/{id}?name=...&code=...&status=...
 * 진입 경로: 이벤트 당첨 관리 목록 → 행 클릭
 *
 * 5개 탭: 판매량 / 주문내역 / 당첨자 선정 / 당첨자 발표 / 메일 알림
 *
 * ⚠️ 자동화 안전 영역:
 *   - 탭 노출 / 탭 클릭 / URL·헤딩 검증
 *
 * ⚠️ 자동화 제외 (수동 검증 영역):
 *   - 추첨 실행, 당첨자 등록/삭제, 발표 트리거 (데이터 영향)
 *   - 메일 알림 발송 (외부 영향)
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

// ============================================================================
// 탭 키 / 라벨
// ============================================================================

export type DetailTabKey =
  | "salesVolume"
  | "orders"
  | "winnerSelection"
  | "winnerAnnouncement"
  | "mailNotification";

const DETAIL_TAB_LABEL: Record<DetailTabKey, string> = {
  salesVolume: "판매량",
  orders: "주문내역",
  winnerSelection: "당첨자 선정",
  winnerAnnouncement: "당첨자 발표",
  mailNotification: "메일 알림",
};

// ============================================================================
// 이벤트 당첨 관리 — 상세 페이지 클래스
// ============================================================================

export class EventWinningDetailPage extends AdminBasePage {
  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);
  }

  // --------------------------------------------------------------------------
  // 페이지 정보 (추상 메서드 구현)
  // --------------------------------------------------------------------------

  /**
   * 상세 페이지는 ID 기반으로 동적 진입하므로 일반 navigate 미사용.
   * 부모 navigate() 호출 방지를 위해 base URL만 반환 (실제로 호출하지 말 것).
   */
  getPageUrl(): string {
    return `${this.baseUrl}/event-winning-manage`;
  }

  /**
   * 헤딩은 이벤트명이라 동적 → assertHeading 직접 사용 안 함.
   * 빈 문자열 반환 (필요 시 assertHeadingContains 사용).
   */
  getHeadingText(): string {
    return "";
  }

  // --------------------------------------------------------------------------
  // URL / 메타데이터
  // --------------------------------------------------------------------------

  /** 현재 URL이 상세 페이지인지 검증 (/event-winning-manage/{숫자}) */
  async assertOnDetailPage(): Promise<void> {
    await expect(this.page).toHaveURL(/\/event-winning-manage\/\d+(\?.*)?$/);
  }

  /** URL path에서 이벤트 ID 추출 */
  getDetailEventId(): string | null {
    const match = this.page.url().match(/\/event-winning-manage\/(\d+)/);
    return match?.[1] ?? null;
  }

  /** URL query string 파라미터 추출 (name, code, status 등) */
  getDetailQueryParam(key: string): string | null {
    try {
      const url = new URL(this.page.url());
      return url.searchParams.get(key);
    } catch {
      return null;
    }
  }

  // --------------------------------------------------------------------------
  // 탭
  // --------------------------------------------------------------------------

  /** 탭 Locator */
  getTab(tab: DetailTabKey): Locator {
    return this.page.getByRole("button", {
      name: DETAIL_TAB_LABEL[tab],
      exact: true,
    });
  }

  /** 모든 탭 노출 검증 */
  async assertAllTabsVisible(): Promise<void> {
    const keys: DetailTabKey[] = [
      "salesVolume",
      "orders",
      "winnerSelection",
      "winnerAnnouncement",
      "mailNotification",
    ];
    for (const key of keys) {
      await expect(
        this.getTab(key),
        `❌ "${DETAIL_TAB_LABEL[key]}" 탭이 노출되지 않습니다.`,
      ).toBeVisible({ timeout: this.timeouts.long });
    }
  }

  /**
   * 탭 클릭 (실제 액션 실행 없음 — 탭 진입만)
   */
  async clickTab(tab: DetailTabKey): Promise<void> {
    await this.getTab(tab).click();
    await this.waitForLoadState("domcontentloaded");
  }
}
