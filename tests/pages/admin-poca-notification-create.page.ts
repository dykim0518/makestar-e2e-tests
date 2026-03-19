/**
 * POCAAlbum 알림 생성 페이지 객체
 *
 * URL: /pocaalbum/notification/notice/create (예상 - 탐색 후 확정)
 */

import { Page, Locator } from "@playwright/test";
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

    this.titleInput = page
      .locator('input[placeholder*="제목"], input[placeholder*="알림"]')
      .first();
    this.contentInput = page
      .locator('textarea:visible, [contenteditable="true"]')
      .first();
    this.fileInput = page.locator('input[type="file"]').first();
    this.createButton = page
      .locator(
        'button:has-text("등록"), button:has-text("저장"), button:has-text("생성")',
      )
      .first();
    this.cancelButton = page.locator('button:has-text("취소")').first();
  }

  getPageUrl(): string {
    return `${this.baseUrl}/pocaalbum/notification/notice/create`;
  }

  getHeadingText(): string {
    return "알림";
  }

  /** 제목 입력 */
  async fillTitle(title: string): Promise<void> {
    await this.titleInput.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
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
      const { resolve, isAbsolute } = await import("path");
      const absolutePath = isAbsolute(options.imagePath)
        ? options.imagePath
        : resolve(__dirname, "..", options.imagePath);
      await this.fileInput.setInputFiles(absolutePath);
    }
  }

  /** 등록 후 목록 이동 대기 */
  async submitAndWaitForList(): Promise<void> {
    await this.createButton.scrollIntoViewIfNeeded();

    await Promise.all([
      this.page
        .waitForNavigation({
          waitUntil: "domcontentloaded",
          timeout: 15000,
        })
        .catch(() => null),
      this.createButton.click({ force: true }),
    ]);

    const currentUrl = this.page.url();
    if (!currentUrl.includes("/pocaalbum/notification")) {
      this.page.once("dialog", (dialog) => dialog.accept());
      await this.page
        .waitForURL(/\/pocaalbum\/notification/, { timeout: 10000 })
        .catch(() => {});
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
      const name = (await input.getAttribute("name")) || "";
      fields[`input[${i}]`] =
        `type=${type}, placeholder="${placeholder}", name="${name}"`;
    }
    return fields;
  }
}
