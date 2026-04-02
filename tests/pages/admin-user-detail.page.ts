/**
 * 회원관리 상세 페이지 객체
 *
 * URL: /user/{userId}
 *
 * 상세 페이지 구조:
 * - 기본정보: 마지막 방문일, 이벤트 구매횟수, 쇼핑 구매횟수, 가입 후 누적금액
 * - 회원정보: 이름, 닉네임, 가입계정, 생년월일, 거주국가, E-Mail, 전화번호, 성별,
 *            회원상태, 활동상태, 가입일, 가입서비스, 배송정보 수신, 마케팅 제공동의
 * - 활동현황 (테이블)
 * - 배송지
 * - 차액지불현황 (테이블: No, 결제번호, 주문번호, 주문상태, 프로젝트/상품명, 차액, 요청일, 링크 복사하기)
 * - 이벤트 당첨현황 (테이블: No, 주문번호, 프로젝트/상품명, 이벤트 구분, 당첨일자)
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

// ============================================================================
// 상수
// ============================================================================

export const USER_DETAIL_INFO_LABELS = [
  "이름",
  "닉네임",
  "가입계정",
  "E-Mail",
  "회원상태",
  "가입일",
  "가입서비스",
] as const;

export const USER_DETAIL_SECTIONS = [
  "기본정보",
  "활동현황",
  "배송지",
  "차액지불현황",
  "이벤트 당첨현황",
] as const;

// ============================================================================
// UserDetailPage 클래스
// ============================================================================

export class UserDetailPage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 로케이터
  // --------------------------------------------------------------------------

  /** 기본정보 섹션 */
  readonly basicInfoSection: Locator;

  /** 활동현황 섹션 */
  readonly activitySection: Locator;

  /** 차액지불현황 섹션 */
  readonly paymentDiffSection: Locator;

  /** 이벤트 당첨현황 섹션 */
  readonly eventWinSection: Locator;

  private userId: string;

  constructor(page: Page, userId: string = "") {
    super(page, ADMIN_TIMEOUTS);
    this.userId = userId;

    this.basicInfoSection = page
      .getByRole("heading", { name: "기본정보" })
      .or(page.getByText("기본정보", { exact: true }));
    this.activitySection = page
      .getByRole("heading", { name: "활동현황" })
      .or(page.getByText("활동현황", { exact: true }));
    this.paymentDiffSection = page
      .getByRole("heading", { name: "차액지불현황" })
      .or(page.getByText("차액지불현황", { exact: true }));
    this.eventWinSection = page
      .getByRole("heading", { name: "이벤트 당첨현황" })
      .or(page.getByText("이벤트 당첨현황", { exact: true }));
  }

  // --------------------------------------------------------------------------
  // 추상 메서드 구현
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/user/${this.userId}`;
  }

  getHeadingText(): string {
    return "회원 관리";
  }

  // --------------------------------------------------------------------------
  // 검증 메서드
  // --------------------------------------------------------------------------

  /**
   * 기본정보 섹션 표시 검증
   */
  async assertBasicInfoVisible(): Promise<void> {
    await expect(this.basicInfoSection).toBeVisible({
      timeout: this.timeouts.medium,
    });
  }

  /**
   * 회원정보 레이블 검증
   */
  async assertInfoLabelsVisible(): Promise<void> {
    for (const label of USER_DETAIL_INFO_LABELS) {
      const locator = this.page.getByText(label, { exact: false }).first();
      await expect(locator).toBeVisible({ timeout: this.timeouts.medium });
    }
  }

  /**
   * 주요 섹션 표시 검증
   */
  async assertSectionsVisible(): Promise<void> {
    for (const section of USER_DETAIL_SECTIONS) {
      const locator = this.page
        .getByRole("heading", { name: section })
        .or(this.page.getByText(section, { exact: true }))
        .first();
      await expect(locator).toBeVisible({ timeout: this.timeouts.medium });
    }
  }

  /**
   * 특정 레이블에 해당하는 값 텍스트 반환
   *
   * DOM 구조 (Nuxt Admin 2열 레이아웃):
   *   div.w-full.py-[18px].flex          ← 행
   *     div.basis-1/2                    ← 왼쪽 셀
   *       div.w-[160px]                  ← 레이블 컨테이너
   *         div > p.title-sb-medium      ← 레이블
   *       div.grow (nextSibling)         ← 값
   *     div.basis-1/2                    ← 오른쪽 셀 (동일 구조)
   */
  async getInfoValueByLabel(label: string): Promise<string> {
    const value = await this.page
      .evaluate((targetLabel: string) => {
        // 레이블 <p> 요소 찾기
        const candidates = document.querySelectorAll("p.title-sb-medium");
        for (const el of candidates) {
          if (el.textContent?.trim() !== targetLabel) continue;

          // 레이블 컨테이너(w-[160px])의 nextSibling에서 값 추출
          // p → div(flex) → div(w-[160px]) → nextSibling(div.grow)
          const labelContainer = el.closest('div[class*="w-[160px]"]');
          if (labelContainer?.nextElementSibling) {
            return labelContainer.nextElementSibling.textContent?.trim() || "";
          }

          // fallback: 조상을 거슬러 올라가며 nextSibling 탐색
          let ancestor: Element | null = el;
          for (let i = 0; i < 5; i++) {
            ancestor = ancestor?.parentElement ?? null;
            if (ancestor?.nextElementSibling) {
              const text =
                ancestor.nextElementSibling.textContent?.trim() || "";
              if (text.length > 0 && text !== targetLabel) return text;
            }
          }
          return "";
        }
        return "";
      }, label)
      .catch(() => "");

    return value;
  }

  /**
   * 목록 페이지로 복귀 (브라우저 뒤로가기)
   */
  async goBackToList(): Promise<void> {
    await this.page.goBack({ waitUntil: "domcontentloaded" });
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  /**
   * 브레드크럼을 통해 목록 페이지로 복귀
   */
  async goBackToListViaBreadcrumb(): Promise<void> {
    const listLink = this.page
      .locator('nav[aria-label="Breadcrumb"]')
      .getByText("회원관리")
      .first();
    if (await listLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await listLink.click();
      await this.page.waitForLoadState("networkidle").catch(() => {});
    } else {
      await this.goBackToList();
    }
  }
}
