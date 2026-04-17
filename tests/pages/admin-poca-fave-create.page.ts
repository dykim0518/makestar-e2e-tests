/**
 * POCAAlbum FAVE 팩 생성 페이지 객체
 *
 * URL: /pocaalbum/fave/pack/create
 *
 * 폼 구조:
 * 1. 앨범 선택* (드롭다운 → 적용하기)
 * 2. FAVE PACK 정보 입력
 *    - 제목* (textbox "내용을 입력하세요")
 *    - 해시태그 (textbox)
 *    - 상세내용 (textbox)
 * 3. 등록하기 버튼 (필수 필드 채워야 활성화)
 */

import { Page, Locator, expect } from "@playwright/test";
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

    // "제목*" 필드 — placeholder "내용을 입력하세요"
    this.titleInput = page.getByPlaceholder("내용을 입력하세요").first();
    this.fileInput = page.locator('input[type="file"]').first();
    this.createButton = page
      .getByRole("button", { name: /등록하기|저장|생성/ })
      .first();
    this.cancelButton = page.getByRole("button", { name: "취소하기" });
  }

  getPageUrl(): string {
    return `${this.baseUrl}/pocaalbum/fave/pack/create`;
  }

  getHeadingText(): string {
    return "FAVE";
  }

  /**
   * 앨범 선택 드롭다운에서 첫 번째 앨범 선택 후 적용
   *
   * 드롭다운: "앨범을 선택하세요" 클릭 → .selection-dropdown-container 포탈 → .menu-item__label 클릭
   * 적용: "적용하기" 버튼 클릭
   */
  async selectAlbum(): Promise<void> {
    const albumTrigger = this.page.locator(".is-placeholder").first();
    await expect(albumTrigger, "앨범 선택 드롭다운 미발견").toBeVisible({
      timeout: 5000,
    });
    await this.clickWithRecovery(albumTrigger, { timeout: this.timeouts.medium });

    // 포탈 드롭다운 대기 (height:0으로 렌더 — attached로 체크)
    const dropdown = this.page.locator(".selection-dropdown-container");
    await dropdown.waitFor({ state: "attached", timeout: 5000 });

    const firstAlbum = dropdown.locator(".menu-item__label").first();
    await firstAlbum.waitFor({ state: "attached", timeout: 5000 });
    const albumName = await firstAlbum.textContent();
    await this.clickAttachedElement(firstAlbum, { timeout: 5000 });
    console.log(`  앨범 선택: ${albumName?.trim()}`);

    // 커버 오버레이 닫기
    const cover = this.page.locator(".selection-dropdown-cover-container");
    const coverVisible = await cover
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (coverVisible) {
      await this.pressEscape();
      await cover.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
    }

    // 적용하기 버튼 클릭
    const applyBtn = this.page.getByRole("button", { name: "적용하기" });
    await expect(applyBtn, "적용하기 버튼 미발견").toBeVisible({
      timeout: 5000,
    });
    await this.clickWithRecovery(applyBtn, { timeout: this.timeouts.medium });

    // 폼 영역이 로드될 때까지 대기
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});
  }

  /** 제목 입력 */
  async fillTitle(title: string): Promise<void> {
    await expect(this.titleInput, "제목 입력 필드 미발견").toBeVisible({
      timeout: 5000,
    });
    await this.titleInput.fill(title);
  }

  /**
   * FAVE 카드 추가
   *
   * "FAVE 추가하기" 버튼을 클릭하면 FAVE 카드 섹션이 나타남.
   * 이름 입력 + 이미지 업로드가 필요함.
   */
  async addFaveCard(name: string, imagePath?: string): Promise<void> {
    const addBtn = this.page.getByText("FAVE 추가하기");
    await expect(addBtn, "FAVE 추가하기 버튼 미발견").toBeVisible({
      timeout: 5000,
    });
    await this.clickWithRecovery(addBtn, { timeout: this.timeouts.medium });

    // FAVE 카드 섹션 로드 대기 — "FAVE 1" 헤더가 나타날 때까지
    const faveSection = this.page.getByText("FAVE 1");
    await expect(faveSection, "FAVE 카드 섹션 미표시").toBeVisible({
      timeout: 5000,
    });

    // FAVE 이름 입력 — 두 번째 "내용을 입력하세요" text input
    // nth(0)=팩 제목(이미 채움), nth(1)=FAVE 이름
    const faveNameInput = this.page
      .locator('input[type="text"][placeholder*="내용을 입력"]')
      .nth(1);
    await expect(faveNameInput, "FAVE 이름 입력 필드 미발견").toBeVisible({
      timeout: 5000,
    });
    await faveNameInput.fill(name);

    // FAVE 이미지 업로드 — FAVE 카드 섹션의 file input
    if (imagePath) {
      const { resolve, isAbsolute } = await import("path");
      const absolutePath = isAbsolute(imagePath)
        ? imagePath
        : resolve(__dirname, "..", imagePath);
      const fileInputs = this.page.locator('input[type="file"]');
      const fCount = await fileInputs.count();
      for (let i = 0; i < fCount; i++) {
        await fileInputs
          .nth(i)
          .setInputFiles(absolutePath)
          .catch(() => {});
      }
    }
  }

  /** 전체 폼 입력 */
  async fillCreateForm(options: FaveCreateOptions): Promise<void> {
    // 1. 앨범 선택 (필수)
    await this.selectAlbum();

    // 2. 팩 제목 입력 (필수)
    await this.fillTitle(options.title);

    // 3. FAVE 카드 추가 (필수 — 최소 1개의 FAVE 카드 필요)
    const faveCardName = `${options.title} 카드`;
    await this.addFaveCard(faveCardName, options.imagePath);
  }

  /** 등록 후 목록 이동 대기 */
  async submitAndWaitForList(): Promise<void> {
    this.page.once("dialog", (dialog) => dialog.accept());

    await this.createButton.scrollIntoViewIfNeeded();
    await this.clickWithRecovery(this.createButton, {
      timeout: this.timeouts.medium,
    });

    await this.page
      .waitForURL(/\/pocaalbum\/fave/, { timeout: 15000 })
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
      const name = (await input.getAttribute("name")) || "";
      fields[`input[${i}]`] =
        `type=${type}, placeholder="${placeholder}", name="${name}"`;
    }
    return fields;
  }
}
