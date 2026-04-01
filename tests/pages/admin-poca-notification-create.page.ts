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

  /** 내용 입력 */
  async fillContent(content: string): Promise<void> {
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
    this.page.once("dialog", (dialog) => dialog.accept());

    await this.createButton.scrollIntoViewIfNeeded();
    await this.createButton.click({ force: true });

    await this.page
      .waitForURL(/\/pocaalbum\/notice/, { timeout: 15000 })
      .catch(() => {});
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
