/**
 * AdminNotificationNoticeCreatePage - 공지 등록 페이지
 *
 * URL: /notification/notice/create
 *
 * 폼 구조:
 * 1. 타입선택 (필수): 공지 / B2C 공지 / B2B 공지 / 이벤트
 * 2. 제목 (한국어/영어 필수, 중국어/일본어 선택)
 * 3. 중요 공지로 표시 (체크박스, 선택)
 * 4. 이미지 (선택)
 * 5. 알림 본문 (다국어 탭 + ProseMirror, 선택)
 * 6. 등록하기 / 취소
 *
 * 인증: 본인 세션 쿠키만 사용 (setupApiInterceptor 미사용).
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage } from "./admin-base.page";

export type NoticeCategory = "공지" | "B2C 공지" | "B2B 공지" | "이벤트";
export type NoticeLanguage = "한국어" | "영어" | "중국어" | "일본어";

const TITLE_PLACEHOLDER: Record<NoticeLanguage, string> = {
  한국어: "한글로 입력해주세요",
  영어: "영어로 입력해주세요",
  중국어: "중국어로 입력해주세요",
  일본어: "일본어로 입력해주세요",
};

export type NoticeCreateOptions = {
  category: NoticeCategory;
  titles: Partial<Record<NoticeLanguage, string>>; // 한/영 최소
  content?: string; // 현재 활성 본문 탭에 입력
  important?: boolean;
  imagePath?: string;
};

export class AdminNotificationNoticeCreatePage extends AdminBasePage {
  readonly importantCheckbox: Locator;
  readonly fileInput: Locator;
  readonly contentEditor: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);

    // 페이지에 visible checkbox는 "중요 공지로 표시" 단 1개 (file 제외)
    this.importantCheckbox = page.locator('input[type="checkbox"]').first();
    this.fileInput = page.locator('input[type="file"]').first();
    this.contentEditor = page.locator(".ProseMirror").first();
    this.submitButton = page.getByRole("button", {
      name: "등록하기",
      exact: true,
    });
    this.cancelButton = page.getByRole("button", { name: "취소", exact: true });
  }

  getPageUrl(): string {
    return `${this.baseUrl}/notification/notice/create`;
  }

  getHeadingText(): string {
    return "공지관리";
  }

  /** 카테고리 버튼 locator */
  categoryButton(name: NoticeCategory): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  /** 카테고리 활성 여부 — 비활성 버튼은 class에 'bg-transparent' 포함 */
  async isCategoryActive(name: NoticeCategory): Promise<boolean> {
    const cls = (await this.categoryButton(name).getAttribute("class")) || "";
    return !/bg-transparent/.test(cls);
  }

  /** 카테고리 선택 */
  async selectCategory(name: NoticeCategory): Promise<void> {
    await this.categoryButton(name).click({ force: true });
  }

  /** 특정 언어의 제목 input */
  titleInput(lang: NoticeLanguage): Locator {
    return this.page.getByPlaceholder(TITLE_PLACEHOLDER[lang]);
  }

  /** 다국어 제목 입력 */
  async fillTitles(
    titles: Partial<Record<NoticeLanguage, string>>,
  ): Promise<void> {
    for (const [lang, value] of Object.entries(titles) as [
      NoticeLanguage,
      string,
    ][]) {
      if (!value) continue;
      const input = this.titleInput(lang);
      await expect(input, `${lang} 제목 입력 필드 미발견`).toBeVisible({
        timeout: 5000,
      });
      await input.fill(value);
    }
  }

  /** 본문 입력 (현재 활성 탭) — ProseMirror */
  async fillContent(content: string): Promise<void> {
    await expect(this.contentEditor, "본문 에디터 미발견").toBeVisible({
      timeout: 5000,
    });
    await this.contentEditor.click();
    await this.page.keyboard.type(content);
  }

  /** "중요 공지로 표시" 체크박스 토글 */
  async setImportant(checked: boolean): Promise<void> {
    if (checked) await this.importantCheckbox.check({ force: true });
    else await this.importantCheckbox.uncheck({ force: true });
  }

  /** 이미지 업로드 */
  async uploadImage(absolutePath: string): Promise<void> {
    await this.fileInput.setInputFiles(absolutePath);
  }

  /** 폼 일괄 입력 */
  async fillForm(options: NoticeCreateOptions): Promise<void> {
    await this.selectCategory(options.category);
    await this.fillTitles(options.titles);
    if (options.important !== undefined) {
      await this.setImportant(options.important);
    }
    if (options.imagePath) {
      await this.uploadImage(options.imagePath);
    }
    if (options.content) {
      await this.fillContent(options.content);
    }
  }

  /** 등록 버튼 클릭 후 모달 에러 감지 + 목록 페이지 이동 대기 */
  async submitAndWaitForList(): Promise<void> {
    await this.submitButton.scrollIntoViewIfNeeded();
    await this.submitButton.click({ force: true });

    // 모달 에러(필수 필드 누락 등) 감지
    const modal = this.page
      .locator('[role="dialog"], .fixed:has-text("알림")')
      .first();
    const hasModal = await modal
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    if (hasModal) {
      const body = (await modal.textContent().catch(() => "")) || "";
      throw new Error(`등록 실패 — 모달: ${body.trim().substring(0, 200)}`);
    }

    // /create URL을 벗어나면 성공
    await this.page
      .waitForFunction(() => !window.location.href.includes("/create"), {
        timeout: 15000,
      })
      .catch(() => {});

    if (this.page.url().includes("/create")) {
      throw new Error(`등록 후 목록 이동 실패 — 현재 URL: ${this.page.url()}`);
    }
    await this.page.waitForLoadState("domcontentloaded");
  }
}
