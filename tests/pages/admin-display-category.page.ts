/**
 * 전시 카테고리 페이지 객체
 *
 * URL: https://stage-new-admin.makeuni2026.com/display-category
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export type DisplayCategoryNames = {
  ko: string;
  en: string;
  zh: string;
  ja: string;
};

export class DisplayCategoryPage extends AdminBasePage {
  readonly b2cButton: Locator;
  readonly b2bButton: Locator;
  readonly createCategoryButton: Locator;
  readonly saveChangesButton: Locator;
  readonly categoryLinks: Locator;
  readonly nameKrInput: Locator;
  readonly nameEnInput: Locator;
  readonly nameZhInput: Locator;
  readonly nameJaInput: Locator;
  readonly cancelButton: Locator;
  readonly createSubmitButton: Locator;
  readonly addProductButton: Locator;
  readonly draggableItems: Locator;
  readonly backButton: Locator;
  readonly unsavedModal: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    this.b2cButton = page.getByRole("button", { name: "B2C" });
    this.b2bButton = page.getByRole("button", { name: "B2B" });
    this.createCategoryButton = page
      .locator(
        '[class*="button-accent"]:has-text("카테고리 생성"), button:has-text("카테고리 생성")',
      )
      .first();
    this.saveChangesButton = page.getByRole("button", {
      name: /변경내용 저장/,
    });
    this.categoryLinks = page.locator('a[href*="/display-category/"]');

    this.nameKrInput = page.getByPlaceholder("한글 값을 입력해주세요");
    this.nameEnInput = page.getByPlaceholder("영문 값을 입력해주세요");
    this.nameZhInput = page.getByPlaceholder("중문 값을 입력해주세요");
    this.nameJaInput = page.getByPlaceholder("일본어 값을 입력해주세요");
    this.cancelButton = page.getByRole("button", { name: "취소" });
    this.createSubmitButton = page.getByRole("button", {
      name: "전시 카테고리 생성하기",
    });

    this.addProductButton = page.getByRole("button", { name: /상품 추가/ });
    this.draggableItems = page.locator(".draggable-item");
    this.backButton = page
      .locator('svg:has(use[href="#icon-arrow-left-line"])')
      .first();
    this.unsavedModal = page
      .locator(".modal-content")
      .filter({ hasText: "저장되지 않은 변경사항" })
      .first();
  }

  getPageUrl(): string {
    return `${this.baseUrl}/display-category`;
  }

  getHeadingText(): string {
    return "전시 카테고리";
  }

  async waitForListReady(): Promise<void> {
    await this.page.waitForLoadState("domcontentloaded");
    await this.page
      .waitForLoadState("networkidle", { timeout: this.timeouts.medium })
      .catch(() => {});
    await expect(this.b2cButton).toBeVisible({
      timeout: this.timeouts.navigation,
    });
  }

  async assertListElementsVisible(): Promise<void> {
    await expect(this.b2cButton).toBeVisible();
    await expect(this.b2bButton).toBeVisible();
    await expect(this.createCategoryButton).toBeVisible();
    await expect(this.categoryLinks.first()).toBeVisible({
      timeout: this.timeouts.navigation,
    });
    await expect(this.saveChangesButton).toBeVisible();
  }

  async openCreateModal(): Promise<void> {
    await this.createCategoryButton.click();
    await expect(this.nameKrInput).toBeVisible({
      timeout: this.timeouts.navigation,
    });
  }

  async assertCreateModalFieldsVisible(): Promise<void> {
    await expect(this.nameKrInput).toBeVisible({
      timeout: this.timeouts.navigation,
    });
    await expect(this.nameEnInput).toBeVisible();
    await expect(this.nameZhInput).toBeVisible();
    await expect(this.nameJaInput).toBeVisible();
    await expect(this.cancelButton).toBeVisible();
    await expect(this.createSubmitButton).toBeVisible();
  }

  async fillCreateModal(names: DisplayCategoryNames): Promise<void> {
    await this.nameKrInput.fill(names.ko);
    await this.nameEnInput.fill(names.en);
    await this.nameZhInput.fill(names.zh);
    await this.nameJaInput.fill(names.ja);
  }

  async createCategory(names: DisplayCategoryNames): Promise<void> {
    await this.openCreateModal();
    await this.fillCreateModal(names);
    await this.createSubmitButton.click();
    await expect(this.page.getByText(names.ko)).toBeVisible({
      timeout: this.timeouts.navigation,
    });
  }

  async openB2CDetail(categoryId: string = "34"): Promise<void> {
    const categoryLink = this.page
      .locator(
        `a[href="/display-category/${categoryId}?type=B2C"], a[href$="/display-category/${categoryId}?type=B2C"]`,
      )
      .first();

    await expect(categoryLink).toBeVisible({ timeout: this.timeouts.long });
    await categoryLink.click();
    await this.page.waitForURL(
      new RegExp(`/display-category/${categoryId}(?:\\?|$|/)`),
      { timeout: this.timeouts.long },
    );
    await this.page.waitForLoadState("domcontentloaded");
  }

  async assertDetailElementsVisible(): Promise<void> {
    await expect(
      this.saveChangesButton,
      "'변경내용 저장하기' 버튼이 노출되어야 합니다",
    ).toBeVisible({ timeout: this.timeouts.navigation });

    await expect(
      this.addProductButton,
      "'상품 추가하기' 버튼이 노출되어야 합니다",
    ).toBeVisible({ timeout: this.timeouts.navigation });

    await expect(this.draggableItems.first()).toBeVisible({
      timeout: this.timeouts.navigation,
    });
    const itemCount = await this.draggableItems.count();
    expect(
      itemCount,
      "드래그 가능한 상품 아이템이 2개 이상 있어야 순서 변경 테스트 가능",
    ).toBeGreaterThanOrEqual(2);
  }

  async clickBackToList(): Promise<void> {
    await this.backButton.click();
  }

  async expectParentListUrl(categoryId: string = "34"): Promise<void> {
    await expect(this.page).toHaveURL(
      new RegExp(`/display-category(?:\\?|$|/)(?!${categoryId})`),
      { timeout: this.timeouts.long },
    );
  }

  async assertUnsavedModalHidden(): Promise<void> {
    await expect(
      this.unsavedModal,
      "변경 없이 뒤로가기 시 미저장 가드 모달이 떠서는 안 됩니다",
    ).toBeHidden({ timeout: this.timeouts.short });
  }

  async assertSaveButtonDisabled(): Promise<void> {
    await expect
      .poll(async () => await this.saveChangesButton.isDisabled(), {
        timeout: this.timeouts.long,
        message: "드래그 전 저장 버튼은 비활성 상태여야 합니다",
      })
      .toBe(true);
  }

  async assertSaveButtonEnabled(): Promise<void> {
    await expect
      .poll(async () => await this.saveChangesButton.isDisabled(), {
        timeout: this.timeouts.long,
        message: "드래그 후 저장 버튼이 활성화되어야 합니다 (dirty state)",
      })
      .toBe(false);
  }

  async dragFirstItemBelowSecond(): Promise<string | null> {
    const firstText = await this.draggableItems.first().textContent();
    const sourceBox = await this.draggableItems
      .nth(0)
      .locator(".handle.cursor-grab")
      .boundingBox();
    const targetBox = await this.draggableItems
      .nth(1)
      .locator(".handle.cursor-grab")
      .boundingBox();

    if (!sourceBox || !targetBox) {
      throw new Error("전시 카테고리 상품 순서 변경 핸들 위치를 찾지 못했습니다.");
    }

    const sourceX = sourceBox.x + sourceBox.width / 2;
    const sourceY = sourceBox.y + sourceBox.height / 2;
    const targetX = targetBox.x + targetBox.width / 2;
    const targetY = targetBox.y + targetBox.height + 10;

    await this.page.mouse.move(sourceX, sourceY);
    await this.page.mouse.down();
    await this.page.mouse.move(targetX, targetY, { steps: 25 });
    await this.page.mouse.up();

    await expect
      .poll(async () => await this.draggableItems.first().textContent(), {
        timeout: this.timeouts.long,
        message: "드래그로 순서가 변경되어야 합니다",
      })
      .not.toBe(firstText);

    return firstText;
  }

  async openUnsavedModalFromDirtyDetail(): Promise<void> {
    await this.dragFirstItemBelowSecond();
    await this.assertSaveButtonEnabled();
    await this.clickBackToList();
    await expect(
      this.unsavedModal,
      "순서 변경 후 뒤로가기 시 미저장 가드 모달이 노출되어야 합니다",
    ).toBeVisible({ timeout: this.timeouts.long });
  }

  async cancelUnsavedNavigation(): Promise<void> {
    await this.unsavedModal.getByRole("button", { name: "취소" }).click();
    await expect(
      this.unsavedModal,
      "'취소' 클릭 후 모달이 닫혀야 합니다",
    ).toBeHidden({ timeout: this.timeouts.medium });
  }

  async confirmUnsavedNavigation(categoryId: string = "34"): Promise<void> {
    await this.unsavedModal.getByRole("button", { name: "나가기" }).click();
    await this.page.waitForURL(
      new RegExp(`/display-category(?:\\?|$|/)(?!${categoryId})`),
      { timeout: this.timeouts.long },
    );
  }
}
