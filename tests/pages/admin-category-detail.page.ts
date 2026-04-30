/**
 * 대분류 상세/수정 페이지 객체
 *
 * URL 예시: https://stage-new-admin.makeuni2026.com/product/new/{id}/?edit=true
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export type CategoryItemCreateOptions = {
  nameKr: string;
  nameEn: string;
  skuSelectCount?: number;
};

export class CategoryDetailPage extends AdminBasePage {
  readonly heading: Locator;
  readonly createItemButton: Locator;
  readonly itemSummary: Locator;
  readonly itemNameKrInput: Locator;
  readonly itemNameEnInput: Locator;
  readonly skuTable: Locator;
  readonly skuCheckboxes: Locator;
  readonly connectSelectedSubItemsButton: Locator;
  readonly createItemSubmitButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    this.heading = page.locator('h1:has-text("대분류 수정")').first();
    this.createItemButton = page.getByRole("button", {
      name: "품목 생성",
      exact: true,
    });
    this.itemSummary = page.locator('p:has-text("하위품목(")').first();
    this.itemNameKrInput = page.getByPlaceholder("한국어명를 입력해주세요");
    this.itemNameEnInput = page.getByPlaceholder("영어명을 입력해주세요");
    this.skuTable = page.locator('table:has(th:has-text("SKU 코드"))');
    this.skuCheckboxes = this.skuTable.locator(
      'tbody tr input[type="checkbox"]',
    );
    this.connectSelectedSubItemsButton = page.getByRole("button", {
      name: "선택한 하위 품목 연결",
    });
    this.createItemSubmitButton = page.getByRole("button", {
      name: "품목 생성하기",
    });
  }

  getPageUrl(): string {
    return `${this.baseUrl}/product/new/list`;
  }

  getHeadingText(): string {
    return "대분류 수정";
  }

  /**
   * 대분류 상세 화면과 품목 섹션이 준비될 때까지 기다립니다.
   */
  async waitForReady(): Promise<void> {
    await expect(this.heading).toBeVisible({
      timeout: this.timeouts.navigation,
    });
    await expect(this.createItemButton).toBeVisible({
      timeout: this.timeouts.long,
    });
  }

  /**
   * 이미 연결된 하위품목 요약 텍스트를 반환합니다.
   */
  async getExistingItemSummary(): Promise<string | null> {
    const visible = await this.itemSummary
      .isVisible({ timeout: this.timeouts.medium })
      .catch(() => false);
    if (!visible) {
      return null;
    }

    return (await this.itemSummary.textContent())?.trim() ?? "";
  }

  /**
   * 하위품목이 없으면 생성하고, 이미 있으면 기존 상태를 유지합니다.
   */
  async ensureItemExists(options: CategoryItemCreateOptions): Promise<string> {
    await this.waitForReady();

    const existingSummary = await this.getExistingItemSummary();
    if (existingSummary) {
      console.log(`✅ 품목 존재 확인: ${existingSummary} — 추가 생성 불필요`);
      return existingSummary;
    }

    console.log("ℹ️ 품목 없음 → 품목 생성 시작");
    await this.createItem(options);
    return "품목 생성 완료";
  }

  /**
   * 품목 생성 모달에서 첫 SKU 일부를 연결해 품목을 생성합니다.
   */
  async createItem(options: CategoryItemCreateOptions): Promise<void> {
    await this.createItemButton.click();
    await expect(this.itemNameKrInput).toBeVisible({
      timeout: this.timeouts.long,
    });

    await this.itemNameKrInput.fill(options.nameKr);
    await this.itemNameEnInput.fill(options.nameEn);

    await expect(this.skuCheckboxes.first()).toBeVisible({
      timeout: this.timeouts.long,
    });

    const availableSkuCount = await this.skuCheckboxes.count();
    const selectCount = Math.min(
      options.skuSelectCount ?? 2,
      availableSkuCount,
    );

    if (selectCount === 0) {
      throw new Error("품목 생성 모달에서 선택 가능한 SKU가 없습니다.");
    }

    console.log(`ℹ️ 선택 가능한 SKU: ${availableSkuCount}개`);
    for (let index = 0; index < selectCount; index += 1) {
      await this.skuCheckboxes.nth(index).check({ force: true });
    }

    await this.connectSelectedSubItemsButton.click();
    await expect(this.createItemSubmitButton).toBeEnabled({
      timeout: this.timeouts.long,
    });
    await this.createItemSubmitButton.click();
    await this.page.waitForLoadState("domcontentloaded").catch(() => {});

    console.log("✅ 품목 생성 완료");
  }
}
