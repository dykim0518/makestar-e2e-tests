/**
 * 상품(이벤트) 수정 페이지 객체
 *
 * URL: https://stage-new-admin.makeuni2026.com/event/update/:id
 *
 * CT-232 회귀 테스트용 POM
 * - 공지 체크박스 설정 변경 후 저장 시 유지 여부 검증
 */

import { type Page, type Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

// ============================================================================
// 타입 정의
// ============================================================================

/** 공지 체크박스 항목명 */
export type NoticeCheckboxLabel =
  | "한터/서클 차트 안내"
  | "초도특전 안내"
  | "선주문 마감기한 안내";

/** 공지 체크박스 상태 스냅샷 */
export type NoticeCheckboxState = {
  label: NoticeCheckboxLabel;
  checked: boolean;
};

// ============================================================================
// 상품 수정 페이지 클래스
// ============================================================================

export class EventUpdatePage extends AdminBasePage {
  /** 상품 수정 페이지 이벤트 ID */
  readonly eventId: string;

  /** 저장 버튼 */
  readonly saveButton: Locator;

  /** 페이지 헤딩 */
  readonly pageHeading: Locator;

  constructor(page: Page, eventId: string) {
    super(page, ADMIN_TIMEOUTS);
    this.eventId = eventId;

    this.saveButton = page.getByRole("button", {
      name: "지금 수정하기",
    });

    this.pageHeading = page.locator("h1, h2").first();
  }

  // --------------------------------------------------------------------------
  // 페이지 정보
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/event/update/${this.eventId}`;
  }

  getHeadingText(): string {
    return "상품 수정";
  }

  // --------------------------------------------------------------------------
  // 페이지 대기 메서드
  // --------------------------------------------------------------------------

  /**
   * 수정 페이지 로드 완료 대기
   */
  async waitForPageReady(): Promise<void> {
    await this.page.waitForLoadState("domcontentloaded");
    await this.page.waitForLoadState("networkidle").catch(() => {});
    await expect(this.saveButton).toBeVisible({
      timeout: this.timeouts.long,
    });
  }

  // --------------------------------------------------------------------------
  // 공지 체크박스 메서드
  // --------------------------------------------------------------------------

  /**
   * 공지 체크박스 로케이터 반환
   */
  getNoticeCheckbox(label: NoticeCheckboxLabel): Locator {
    return this.page
      .locator(".b2b-input-container")
      .filter({ hasText: label })
      .locator('input[type="checkbox"]');
  }

  /**
   * 공지 체크박스의 현재 체크 상태 조회
   */
  async getNoticeCheckboxState(label: NoticeCheckboxLabel): Promise<boolean> {
    const checkbox = this.getNoticeCheckbox(label);
    await expect(checkbox).toBeAttached({ timeout: this.timeouts.medium });
    return await checkbox.isChecked();
  }

  /**
   * 모든 공지 체크박스 상태 스냅샷 반환
   */
  async getAllNoticeCheckboxStates(): Promise<NoticeCheckboxState[]> {
    const labels: NoticeCheckboxLabel[] = [
      "한터/서클 차트 안내",
      "초도특전 안내",
      "선주문 마감기한 안내",
    ];
    const states: NoticeCheckboxState[] = [];
    for (const label of labels) {
      const checked = await this.getNoticeCheckboxState(label);
      states.push({ label, checked });
    }
    return states;
  }

  /**
   * 공지 체크박스 토글
   */
  async toggleNoticeCheckbox(label: NoticeCheckboxLabel): Promise<boolean> {
    const checkbox = this.getNoticeCheckbox(label);
    await checkbox.scrollIntoViewIfNeeded();
    const wasBefore = await checkbox.isChecked();
    if (wasBefore) {
      await checkbox.uncheck();
    } else {
      await checkbox.check();
    }
    return !wasBefore;
  }

  /**
   * 공지 체크박스를 특정 상태로 설정
   */
  async setNoticeCheckbox(
    label: NoticeCheckboxLabel,
    checked: boolean,
  ): Promise<void> {
    const checkbox = this.getNoticeCheckbox(label);
    await checkbox.scrollIntoViewIfNeeded();
    if (checked) {
      await checkbox.check();
    } else {
      await checkbox.uncheck();
    }
  }

  /**
   * 공지 체크박스 섹션으로 스크롤
   */
  async scrollToNoticeSection(): Promise<void> {
    const firstCheckbox = this.getNoticeCheckbox("한터/서클 차트 안내");
    await firstCheckbox.scrollIntoViewIfNeeded();
  }

  // --------------------------------------------------------------------------
  // 저장 메서드
  // --------------------------------------------------------------------------

  /**
   * 저장 후 "기록작성 후 수정반영" 모달 처리
   *
   * 상품 수정 시 수정 사유를 입력하는 모달이 나타남.
   * 모든 textarea에 사유를 입력하고 "적용하기" 클릭.
   */
  async saveWithModificationLog(
    reason: string = "자동화 테스트",
  ): Promise<void> {
    await this.saveButton.scrollIntoViewIfNeeded();
    await this.saveButton.click();

    // "기록작성 후 수정반영" 모달 대기
    const applyBtn = this.page.getByRole("button", { name: "적용하기" });

    // 모달이 나타나는지 확인 (나타나지 않으면 validation 에러 모달일 수 있음)
    const validationModal = this.page
      .locator('[class*="modal"]')
      .filter({ hasText: "저장할 수 없음" });

    const result = await Promise.race([
      applyBtn
        .waitFor({ state: "visible", timeout: this.timeouts.medium })
        .then(() => "apply" as const),
      validationModal
        .first()
        .waitFor({ state: "visible", timeout: this.timeouts.medium })
        .then(() => "validation" as const),
    ]).catch(() => "timeout" as const);

    if (result === "validation") {
      const errorText = (await validationModal.first().textContent()) ?? "";
      // 확인 버튼 클릭하여 닫기
      const okBtn = this.page.getByRole("button", { name: /확인|OK/ });
      if (
        await okBtn
          .isVisible({ timeout: this.timeouts.micro })
          .catch(() => false)
      ) {
        await okBtn.click();
      }
      throw new Error(
        `저장 실패 - validation 에러: ${errorText.trim().substring(0, 200)}`,
      );
    }

    if (result === "timeout") {
      throw new Error("저장 실패 - 모달이 나타나지 않음");
    }

    // 모든 visible textarea에 수정 사유 입력
    const textareas = this.page.locator("textarea:visible");
    const count = await textareas.count();
    for (let i = 0; i < count; i++) {
      await textareas.nth(i).fill(reason);
    }

    // 적용하기 버튼이 활성화될 때까지 대기
    await expect(applyBtn).toBeEnabled({ timeout: this.timeouts.medium });
    await applyBtn.click();

    // 저장 API 응답 대기
    await this.page
      .waitForLoadState("networkidle", { timeout: this.timeouts.long })
      .catch(() => {});
  }

  /**
   * 저장 후 확인 다이얼로그 처리 (간단한 확인 모달)
   */
  async saveWithConfirm(): Promise<void> {
    await this.saveWithModificationLog();
  }

  /**
   * 에러 토스트 알림 닫기 (있는 경우)
   */
  async dismissErrorToast(): Promise<void> {
    const closeBtn = this.page
      .locator('[role="alert"]')
      .locator("..")
      .locator("..")
      .getByRole("button", { name: "Close" });
    try {
      if (await closeBtn.isVisible({ timeout: this.timeouts.micro })) {
        await closeBtn.click();
      }
    } catch {
      // 토스트가 없는 경우 무시
    }
  }

  /**
   * 저장 후 페이지 재진입 (저장 결과 확인용)
   */
  async saveAndReload(): Promise<void> {
    await this.saveWithConfirm();

    // 저장 후 목록으로 이동하는 경우 다시 수정 페이지로 진입
    if (!this.page.url().includes(`/event/update/${this.eventId}`)) {
      await this.navigate();
    } else {
      await this.page.reload({
        waitUntil: "domcontentloaded",
        timeout: this.timeouts.navigation,
      });
    }
    await this.waitForPageReady();
    await this.dismissErrorToast();
  }
}
