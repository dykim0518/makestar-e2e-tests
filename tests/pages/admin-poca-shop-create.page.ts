/**
 * POCAAlbum Shop 포인트상품 생성 페이지 객체
 *
 * URL: /pocaalbum/shop/product/create
 *
 * 드롭다운 구조 (Vue 커스텀 컴포넌트):
 *   트리거: .single-selection-container > .selection-wrapper > .custom-trigger > .selection > .is-placeholder
 *   옵션 패널: body > .selection-dropdown-container > .menu-item > .menu-item__label (포탈)
 *
 * 필수 필드 (*):
 * - 상품종류* (드롭다운: 앨범초기화, FAVE초기화, 스티커, 포카앨범)
 * - 포인트 소모방식* (드롭다운: 무료포인트, 무료/유료포인트, 유료포인트, 포인트소모없음)
 * - 순번* (spinbutton, 기본값 100)
 * - 상품명* (textbox "입력해주세요")
 * - 포인트* (spinbutton)
 * - 로고이미지* (파일 업로드)
 * - 메인이미지* (파일 업로드)
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export type ShopProductCreateOptions = {
  title: string;
  price?: string;
  description?: string;
  imagePath?: string;
};

export class PocaShopCreatePage extends AdminBasePage {
  readonly titleInput: Locator;
  readonly priceInput: Locator;
  readonly descriptionInput: Locator;
  readonly fileInput: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    this.titleInput = page.getByRole("textbox", { name: "상품명" });
    this.priceInput = page.getByRole("spinbutton", { name: "포인트" });
    this.descriptionInput = page
      .locator('textarea:visible, [contenteditable="true"]')
      .first();
    this.fileInput = page.locator('input[type="file"]').first();
    this.createButton = page
      .getByRole("button", { name: /생성하기|등록|저장/ })
      .first();
    this.cancelButton = page.getByRole("button", { name: "취소하기" });
  }

  getPageUrl(): string {
    return `${this.baseUrl}/pocaalbum/shop/product/create`;
  }

  getHeadingText(): string {
    return "상품";
  }

  // --------------------------------------------------------------------------
  // 드롭다운 선택 헬퍼
  // --------------------------------------------------------------------------

  /**
   * POCA Admin 커스텀 드롭다운에서 옵션 선택
   *
   * 동작 방식:
   * 1. 라벨 텍스트로 드롭다운 영역 특정
   * 2. 해당 영역의 .selection-input (트리거) 클릭
   * 3. body에 포탈로 렌더되는 .selection-dropdown-container 대기
   * 4. .menu-item__label 중 일치하는 옵션 클릭
   */
  async selectDropdownOption(
    labelText: string,
    optionText: string,
  ): Promise<void> {
    // 라벨 찾기
    const label = this.page.getByText(labelText, { exact: false }).first();
    await expect(label, `라벨 "${labelText}" 미발견`).toBeVisible({
      timeout: 5000,
    });

    // 라벨의 부모 컨테이너에서 드롭다운 트리거 찾기
    const container = label.locator("xpath=ancestor::div[1]");
    const trigger = container.locator(".selection-input").first();
    const isTriggerInContainer = await trigger
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isTriggerInContainer) {
      await this.clickWithRecovery(trigger, { timeout: 5000 });
    } else {
      // 형제 div에서 트리거 찾기 (라벨과 드롭다운이 같은 레벨)
      const siblingTrigger = label
        .locator("xpath=following::div[contains(@class,'selection-input')]")
        .first();
      await this.clickWithRecovery(siblingTrigger, { timeout: 5000 });
    }

    // 포탈로 렌더된 드롭다운 패널 대기 (height:0으로 렌더되어 isVisible이 false)
    const dropdown = this.page.locator(".selection-dropdown-container");
    await dropdown.waitFor({ state: "attached", timeout: 5000 });

    const option = dropdown
      .locator(".menu-item__label")
      .filter({ hasText: optionText });
    const optionCount = await option.count();

    if (optionCount > 0) {
      await this.clickAttachedElement(option.first(), { timeout: 5000 });
    } else {
      const firstItem = dropdown.locator(".menu-item__label").first();
      const firstText = await firstItem.textContent();
      console.log(
        `  ⚠️ "${optionText}" 미발견, 첫 번째 옵션 "${firstText}" 선택`,
      );
      await this.clickAttachedElement(firstItem, { timeout: 5000 });
    }

    // 커버 오버레이 닫기
    const cover = this.page.locator(".selection-dropdown-cover-container");
    const coverVisible = await cover
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (coverVisible) {
      await this.pressEscape();
      await cover.waitFor({ state: "hidden", timeout: 3000 }).catch(() => {});
    }
  }

  // --------------------------------------------------------------------------
  // 폼 입력
  // --------------------------------------------------------------------------

  /** 상품명 입력 — "상품명*" 라벨 아래의 textbox */
  async fillTitle(title: string): Promise<void> {
    const label = this.page.getByText("상품명", { exact: false }).first();
    const input = label
      .locator("xpath=ancestor::div[1]")
      .getByRole("textbox")
      .first();
    const isVisible = await input
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isVisible) {
      await input.fill(title);
      return;
    }

    // fallback: 라벨 다음 형제에서 찾기
    const siblingInput = label
      .locator("xpath=following::input[@type='text']")
      .first();
    await expect(siblingInput, "상품명 입력 필드 미발견").toBeVisible({
      timeout: 5000,
    });
    await siblingInput.fill(title);
  }

  /** 포인트 입력 — "포인트*" 라벨 다음의 number input */
  async fillPrice(price: string): Promise<void> {
    const input = this.page
      .getByText("포인트*")
      .first()
      .locator("xpath=following::input[@type='number']")
      .first();
    const isVisible = await input
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    if (isVisible) {
      await input.fill(price);
    }
  }

  /** 전체 폼 입력 */
  async fillCreateForm(options: ShopProductCreateOptions): Promise<void> {
    // 1. 상품종류 선택 (필수)
    await this.selectDropdownOption("상품종류", "포카앨범");

    // 2. 포인트 소모방식 선택 (필수)
    await this.selectDropdownOption("소모방식", "무료포인트");

    // 3. FAVE PACK 선택 (필수 — 첫 번째 항목 자동 선택)
    const favePack = this.page.locator(".is-placeholder");
    const favePackCount = await favePack.count();
    if (favePackCount > 0) {
      await this.selectDropdownOption("FAVE PACK", "");
    }

    // 4. 순번 확인/입력 (필수 — 드롭다운 선택 후 리셋될 수 있음)
    const orderInput = this.page
      .getByText("순번")
      .first()
      .locator("xpath=following::input[@type='number']")
      .first();
    const orderVisible = await orderInput
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (orderVisible) {
      const orderVal = await orderInput.inputValue();
      if (!orderVal) {
        await orderInput.fill("100");
      }
    }

    // 5. 상품명 입력 (필수)
    await this.fillTitle(options.title);

    // 6. 포인트 입력
    if (options.price) {
      await this.fillPrice(options.price);
    }

    // 6. 이미지 업로드 (로고이미지 + 메인이미지 필수)
    if (options.imagePath) {
      const { resolve, isAbsolute } = await import("path");
      const absolutePath = isAbsolute(options.imagePath)
        ? options.imagePath
        : resolve(__dirname, "..", options.imagePath);
      const fileInputs = this.page.locator('input[type="file"]');
      const fileCount = await fileInputs.count();
      for (let i = 0; i < Math.min(fileCount, 2); i++) {
        await fileInputs.nth(i).setInputFiles(absolutePath);
      }
    }
  }

  /** 등록 후 목록 이동 대기 */
  async submitAndWaitForList(): Promise<void> {
    // 다이얼로그 자동 확인 (클릭 전 등록)
    this.page.once("dialog", (dialog) => dialog.accept());

    await this.createButton.scrollIntoViewIfNeeded();
    await this.clickWithRecovery(this.createButton, {
      timeout: this.timeouts.medium,
    });

    await this.page
      .waitForURL(/\/pocaalbum\/shop/, { timeout: 15000 })
      .catch(() => {});
    await this.waitForLoadState("domcontentloaded");
  }

  /** 폼 필드 자동 탐색 (디버깅용) */
  async discoverFormFields(): Promise<Record<string, string>> {
    const fields: Record<string, string> = {};

    const textboxes = this.page.getByRole("textbox");
    const tbCount = await textboxes.count();
    for (let i = 0; i < tbCount; i++) {
      const ph = (await textboxes.nth(i).getAttribute("placeholder")) || "";
      const val = await textboxes
        .nth(i)
        .inputValue()
        .catch(() => "");
      fields[`textbox[${i}]`] = `placeholder="${ph}", value="${val}"`;
    }

    const spins = this.page.getByRole("spinbutton");
    const spCount = await spins.count();
    for (let i = 0; i < spCount; i++) {
      const val = await spins
        .nth(i)
        .inputValue()
        .catch(() => "");
      fields[`spinbutton[${i}]`] = `value="${val}"`;
    }

    const dropdowns = this.page.locator(".is-placeholder");
    const ddCount = await dropdowns.count();
    fields["dropdowns"] = `${ddCount}개 미선택 드롭다운`;

    console.log("  📋 폼 필드 탐색:", JSON.stringify(fields, null, 2));
    return fields;
  }
}
