/**
 * POCAAlbum 공지사항 생성 페이지 객체
 *
 * URL: /pocaalbum/notice/create
 *
 * 폼 구조:
 * 1. 공지사항 정보
 *    - 제목 (textbox, placeholder "제목을 입력하세요")
 * 2. 공지사항 내용
 *    - 언어 탭 (한국어, 영어, 중국어 등)
 *    - 내용 (textarea)
 * 3. 등록하기 버튼
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export type NotificationCreateOptions = {
  title: string;
  content?: string;
  imagePath?: string;
};

export class PocaNotificationCreatePage extends AdminBasePage {
  readonly titleInput: Locator;
  readonly contentInput: Locator;
  readonly fileInput: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    this.titleInput = page.getByPlaceholder("제목을 입력하세요").first();
    this.contentInput = page
      .locator('textarea:visible, [contenteditable="true"]')
      .first();
    this.fileInput = page.locator('input[type="file"]').first();
    this.createButton = page
      .getByRole("button", { name: /등록하기|저장|생성/ })
      .first();
    this.cancelButton = page.getByRole("button", { name: "취소하기" });
  }

  getPageUrl(): string {
    return `${this.baseUrl}/pocaalbum/notice/create`;
  }

  getHeadingText(): string {
    return "공지사항";
  }

  /** 제목 입력 */
  async fillTitle(title: string): Promise<void> {
    await expect(this.titleInput, "제목 입력 필드 미발견").toBeVisible({
      timeout: 5000,
    });
    await this.titleInput.fill(title);
  }

  /** 내용 입력 (Toast UI Editor WYSIWYG 모드 대응) */
  async fillContent(content: string): Promise<void> {
    // Toast UI Editor WYSIWYG 모드 (toastui-editor-contents 클래스)
    const wwEditor = this.page
      .locator(".toastui-editor-contents.ProseMirror")
      .first();
    const isWwEditor = await wwEditor
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isWwEditor) {
      await wwEditor.click();
      await this.page.keyboard.type(content);
      return;
    }

    // 일반 ProseMirror 폴백
    const proseMirror = this.page.locator(".ProseMirror").first();
    const isProseMirror = await proseMirror
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isProseMirror) {
      await proseMirror.click();
      await this.page.keyboard.type(content);
      return;
    }

    // textarea 폴백
    const isVisible = await this.contentInput
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!isVisible) return;
    await this.contentInput.fill(content);
  }

  /** 전체 폼 입력 */
  async fillCreateForm(options: NotificationCreateOptions): Promise<void> {
    await this.fillTitle(options.title);

    if (options.content) {
      await this.fillContent(options.content);
    }

    if (options.imagePath) {
      const hasFileInput = await this.fileInput
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (hasFileInput) {
        const { resolve, isAbsolute } = await import("path");
        const absolutePath = isAbsolute(options.imagePath)
          ? options.imagePath
          : resolve(__dirname, "..", options.imagePath);
        await this.fileInput.setInputFiles(absolutePath);
      }
    }
  }

  /** 등록 후 목록 이동 대기 */
  async submitAndWaitForList(): Promise<void> {
    await this.createButton.scrollIntoViewIfNeeded();
    await this.createButton.click();

    // 모달 에러 알림 감지 (필수 필드 누락 시 나타남)
    const modal = this.page.locator(
      '.fixed :text("알림"), [role="dialog"] :text("알림")',
    );
    const hasModal = await modal
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (hasModal) {
      const modalBody =
        (await this.page
          .locator(".fixed, [role='dialog']")
          .first()
          .textContent()) || "";
      await this.page
        .locator('button:has-text("확인")')
        .first()
        .click()
        .catch(() => {});
      throw new Error(`등록 실패 — 모달 알림: ${modalBody.trim()}`);
    }

    // 목록 페이지로 이동 대기 (create URL에서 벗어나면 성공)
    await this.page
      .waitForFunction(() => !window.location.href.includes("/create"), {
        timeout: 15000,
      })
      .catch(() => {});

    const currentUrl = this.page.url();
    if (currentUrl.includes("/create")) {
      throw new Error(`등록 후 목록 이동 실패 — 현재 URL: ${currentUrl}`);
    }

    await this.waitForLoadState("domcontentloaded");
  }

  /** 폼 필드 자동 탐색 (디버깅용) */
  async discoverFormFields(): Promise<Record<string, string>> {
    const fields: Record<string, string> = {};
    const inputs = this.page.locator("input:visible");
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const type = (await input.getAttribute("type")) || "text";
      const placeholder = (await input.getAttribute("placeholder")) || "";
      fields[`input[${i}]`] = `type=${type}, placeholder="${placeholder}"`;
    }
    return fields;
  }
}
