/**
 * POCAAlbum FAVE 팩 생성 페이지 객체
 *
 * URL: /pocaalbum/fave/pack/create (예상)
 */

import { Page, Locator } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export type FaveCreateOptions = {
  title: string;
  imagePath?: string;
};

export class PocaFaveCreatePage extends AdminBasePage {
  readonly titleInput: Locator;
  readonly fileInput: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    // "제목*" 레이블 옆 입력 필드 (placeholder: "내용을 입력하세요")
    this.titleInput = page
      .locator(
        'input[placeholder*="내용을 입력"], input[placeholder*="제목"], input[placeholder*="팩"], input[placeholder*="이름"]',
      )
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
    return `${this.baseUrl}/pocaalbum/fave/pack/create`;
  }

  getHeadingText(): string {
    return "FAVE";
  }

  /** 제목 입력 */
  async fillTitle(title: string): Promise<void> {
    await this.titleInput.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
    await this.titleInput.fill(title);
  }

  /** 전체 폼 입력 */
  async fillCreateForm(options: FaveCreateOptions): Promise<void> {
    await this.fillTitle(options.title);

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
      } else {
        console.log("ℹ️ 파일 업로드 필드 없음 — 이미지 업로드 스킵");
      }
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
    if (!currentUrl.includes("/pocaalbum/fave")) {
      this.page.once("dialog", (dialog) => dialog.accept());
      await this.page
        .waitForURL(/\/pocaalbum\/fave/, { timeout: 10000 })
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
