/**
 * AdminNotificationPopupUpdatePage - 팝업 수정 페이지
 *
 * URL: /notification/popup/update/:id
 *
 * 페이지 구조 (create와 동일 + 데이터 pre-filled):
 * 1. 타입선택 (필수): 공통 팝업 / B2C 팝업 / B2B 팝업
 * 2. 제목 (단일 input)
 * 3. 노출 기간: 시작 날짜/시간 + 종료 날짜/시간
 * 4. 이미지 (토글 + 업로드)
 * 5. 정렬: 왼쪽 정렬 / 가운데 정렬
 * 6. 본문 (ProseMirror)
 * 7. 팝업 타이틀 (다국어 4개)
 * 8. 버튼추가 (다국어 4개 + URL)
 * 9. 우측 "팝업 미리보기" 패널
 * 10. 하단 우측: "취소" + "지금 수정하기" 버튼
 *
 * 공지 update와 달리 본 페이지는 정상 편집 가능.
 */

import { Page, Locator } from "@playwright/test";
import { AdminBasePage } from "./admin-base.page";
import type { PopupCategory } from "./admin-notification-popup-create.page";

export class AdminNotificationPopupUpdatePage extends AdminBasePage {
  /** 페이지 헤딩 ("공지관리") */
  readonly pageHeading: Locator;
  /** 폼 섹션 헤딩 ("팝업 수정") */
  readonly sectionHeading: Locator;
  /** 제목 input (단일) */
  readonly titleInput: Locator;
  /** 시작 날짜 input */
  readonly startDateInput: Locator;
  /** 종료 날짜 input */
  readonly endDateInput: Locator;
  /** 본문 ProseMirror 에디터 */
  readonly contentEditor: Locator;
  /** 우측 미리보기 패널 헤딩 */
  readonly previewHeading: Locator;
  /** "지금 수정하기" 버튼 */
  readonly saveButton: Locator;
  /** "취소" 버튼 */
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.pageHeading = page.getByRole("heading", {
      name: "공지관리",
      exact: true,
    });
    this.sectionHeading = page.getByText("팝업 수정", { exact: true }).first();
    this.titleInput = page.getByPlaceholder("리스트의 제목에 반영됩니다.");
    this.startDateInput = page.getByPlaceholder("시작 날짜 선택");
    this.endDateInput = page.getByPlaceholder("종료 날짜 선택");
    this.contentEditor = page.locator(".ProseMirror").first();
    this.previewHeading = page
      .getByText("팝업 미리보기", { exact: true })
      .first();
    this.saveButton = page.getByRole("button", {
      name: "지금 수정하기",
      exact: true,
    });
    this.cancelButton = page.getByRole("button", { name: "취소", exact: true });
  }

  getPageUrl(): string {
    return `${this.baseUrl}/notification/popup/update`;
  }

  getHeadingText(): string {
    return "공지관리";
  }

  /** 카테고리 버튼 locator */
  categoryButton(name: PopupCategory): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  /** 카테고리 활성 여부 */
  async isCategoryActive(name: PopupCategory): Promise<boolean> {
    const cls = (await this.categoryButton(name).getAttribute("class")) || "";
    return !/bg-transparent/.test(cls);
  }

  /** 활성 카테고리 반환 */
  async getActiveCategory(): Promise<PopupCategory | null> {
    const all: PopupCategory[] = ["공통 팝업", "B2C 팝업", "B2B 팝업"];
    for (const c of all) {
      if (await this.isCategoryActive(c)) return c;
    }
    return null;
  }

  /** 정렬 라디오 라벨 노출 여부 */
  alignmentLabel(label: "왼쪽 정렬" | "가운데 정렬"): Locator {
    return this.page.getByText(label, { exact: true }).first();
  }

  /** URL에서 팝업 ID 추출 */
  getPopupIdFromUrl(): string | null {
    const m = this.page.url().match(/\/notification\/popup\/update\/(\d+)/);
    return m ? m[1] : null;
  }

  /**
   * 페이지 로드 완료 대기
   * - URL이 /popup/update/{id} 패턴
   * - 제목 input이 visible
   */
  async waitForLoaded(timeout = 15000): Promise<void> {
    await this.page.waitForURL(/\/notification\/popup\/update\/\d+/, {
      timeout,
    });
    await this.titleInput.waitFor({ state: "visible", timeout });
  }
}
