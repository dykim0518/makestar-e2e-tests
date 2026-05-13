/**
 * MakestarCartPage - Makestar cart page interactions.
 *
 * MakestarPage extends this class as a facade, so existing specs can keep using
 * the same public API while cart-specific behavior lives in a smaller module.
 */

import { Page, Locator } from "@playwright/test";
import { BasePage, DEFAULT_TIMEOUTS, TimeoutConfig } from "./base.page";

export class MakestarCartPage extends BasePage {
  readonly baseUrl =
    process.env.MAKESTAR_BASE_URL || "https://www.makestar.com";

  readonly cartItem: Locator;
  readonly cartCheckbox: Locator;
  readonly cartDeleteButton: Locator;

  constructor(page: Page, timeouts: TimeoutConfig = DEFAULT_TIMEOUTS) {
    super(page, timeouts);

    this.cartItem = page.locator('img[alt="album"]');
    this.cartCheckbox = page.locator('input[type="checkbox"]');
    this.cartDeleteButton = page.locator(
      'button:has-text("Delete"), button:has-text("삭제"), button:has-text("Remove")',
    );
  }

  /** 장바구니 페이지로 이동 */
  async gotoCart(): Promise<void> {
    await this.goto(`${this.baseUrl}/cart`);
    await this.waitForLoadState("domcontentloaded");
    await this.handleModal();
  }

  /** 장바구니 아이템 개수 반환 */
  async getCartItemCount(): Promise<number> {
    const isCartEmpty = await this.page
      .getByText(/Your cart is empty|cart is empty|장바구니.*비어/i)
      .first()
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
    if (isCartEmpty) {
      return 0;
    }

    const imageCount = await this.cartItem
      .evaluateAll((images) => {
        return images.filter((image) => {
          if (!(image instanceof HTMLElement)) return false;
          const rect = image.getBoundingClientRect();
          const style = window.getComputedStyle(image);
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none"
          );
        }).length;
      })
      .catch(() => 0);
    if (imageCount > 0) {
      return imageCount;
    }

    const visibleCheckboxCount = await this.cartCheckbox
      .evaluateAll((checkboxes) => {
        return checkboxes.filter((checkbox) => {
          if (!(checkbox instanceof HTMLInputElement)) return false;
          const rect = checkbox.getBoundingClientRect();
          const style = window.getComputedStyle(checkbox);
          return (
            !checkbox.disabled &&
            rect.width > 0 &&
            rect.height > 0 &&
            style.visibility !== "hidden" &&
            style.display !== "none"
          );
        }).length;
      })
      .catch(() => 0);
    return Math.max(0, visibleCheckboxCount - 1);
  }

  async waitForCartItemCountAtLeast(
    minCount: number = 1,
    timeout: number = this.timeouts.long,
  ): Promise<number> {
    const deadline = Date.now() + timeout;
    let lastItemCount = 0;

    while (Date.now() < deadline) {
      await this.waitForNetworkStable(2000).catch(() => {});
      await this.waitForContentStable(300).catch(() => {});

      lastItemCount = await this.getCartItemCount();
      if (lastItemCount >= minCount) {
        return lastItemCount;
      }

      if (this.currentUrl.includes("/cart")) {
        await this.reload().catch(() => {});
      } else {
        await this.gotoCart().catch(() => {});
      }
    }

    throw new Error(
      `장바구니 아이템 수가 ${timeout}ms 안에 ${minCount}개 이상이 되지 않았습니다. 마지막 확인: ${lastItemCount}개`,
    );
  }

  private async clickFirstCartRowDeleteButton(): Promise<boolean> {
    const firstItem = this.cartItem.first();
    if (
      !(await firstItem
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false))
    ) {
      return false;
    }

    const itemRow = firstItem.locator(
      'xpath=ancestor::*[.//input[@type="checkbox"] and .//button and (.//input[@aria-label="Quantity"] or .//input[contains(@class, "number-input")] or .//input[@role="spinbutton"] or .//input[@type="text"])][1]',
    );
    const deleteButtons = itemRow.locator(
      [
        'button:has(use[href*="cancel" i])',
        'button:has(use[href*="delete" i])',
        'button:has(use[href*="remove" i])',
        'button:has(use[href*="trash" i])',
        'button[aria-label*="delete" i]',
        'button[aria-label*="remove" i]',
        'button[title*="delete" i]',
        'button[title*="remove" i]',
      ].join(", "),
    );
    const buttonCount = await deleteButtons.count().catch(() => 0);

    for (let i = buttonCount - 1; i >= 0; i--) {
      const button = deleteButtons.nth(i);
      const visible = await button
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      const enabled = await button.isEnabled().catch(() => false);
      if (!visible || !enabled) continue;

      await button.click();
      return true;
    }

    return false;
  }

  private async confirmCartDeleteIfNeeded(): Promise<void> {
    const hasConfirmDialog = await this.page
      .getByText(/Are you sure you want to delete|delete this item|삭제.*하시겠/i)
      .first()
      .waitFor({ state: "visible", timeout: this.timeouts.short })
      .then(() => true)
      .catch(() => false);
    if (!hasConfirmDialog) {
      return;
    }

    const confirmButtons = this.page
      .getByRole("button", {
        name: /^(Delete|삭제|Remove|Confirm|확인)$/i,
      })
      .or(this.page.locator("button.background-negative"));
    const confirmCount = await confirmButtons.count().catch(() => 0);

    for (let i = confirmCount - 1; i >= 0; i--) {
      const button = confirmButtons.nth(i);
      const visible = await button
        .isVisible({ timeout: this.timeouts.short })
        .catch(() => false);
      const enabled = await button.isEnabled().catch(() => false);
      if (!visible || !enabled) continue;

      await button.click().catch(() => {});
      await this.waitForNetworkStable(3000).catch(() => {});
      await this.waitForContentStable(500).catch(() => {});
      await this.page
        .getByText(/Your cart is empty|cart is empty|장바구니.*비어/i)
        .first()
        .waitFor({ state: "visible", timeout: this.timeouts.medium })
        .catch(() => {});
      break;
    }
  }

  /**
   * 장바구니 비우기 — 3회 시도 후에도 남아있으면 throw.
   * 호출자는 사전에 `gotoCart()`로 `/cart` 페이지에 있어야 한다.
   */
  async clearCart(maxAttempts = 3): Promise<void> {
    let lastItemCount = -1;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.waitForNetworkStable(3000).catch(() => {});
      await this.waitForContentStable(500).catch(() => {});

      const itemCount = await this.getCartItemCount();
      if (itemCount === 0) {
        if (attempt > 0) console.log("   ✅ 장바구니 초기화 완료");
        return;
      }
      lastItemCount = itemCount;

      console.log(
        `   기존 상품 ${itemCount}개 (삭제 시도 ${attempt + 1}/${maxAttempts})`,
      );

      const checkboxCount = await this.cartCheckbox.count();
      for (let i = 0; i < checkboxCount; i++) {
        const checkbox = this.cartCheckbox.nth(i);
        const visible = await checkbox
          .isVisible({ timeout: this.timeouts.short })
          .catch(() => false);
        const enabled = await checkbox.isEnabled().catch(() => false);
        if (!visible || !enabled) continue;

        const isChecked = await checkbox.isChecked().catch(() => false);
        if (!isChecked) {
          await checkbox.click();
          await this.waitForContentStable(500);
        }
        break;
      }

      let deleteClicked = await this.clickFirstCartRowDeleteButton();

      if (!deleteClicked) {
        const deleteButtonCount = await this.cartDeleteButton.count();
        for (let i = 0; i < deleteButtonCount; i++) {
          const button = this.cartDeleteButton.nth(i);
          const visible = await button
            .isVisible({ timeout: this.timeouts.short })
            .catch(() => false);
          const enabled = await button.isEnabled().catch(() => false);
          if (!visible || !enabled) continue;

          await button.click();
          deleteClicked = true;
          await this.waitForNetworkStable(3000).catch(() => {});
          await this.waitForContentStable(500).catch(() => {});
          break;
        }
      }

      if (deleteClicked) {
        await this.confirmCartDeleteIfNeeded();
      }

      await this.reload();
      await this.waitForContentStable(500).catch(() => {});
    }

    throw new Error(
      `clearCart 실패: ${maxAttempts}회 시도 후에도 장바구니에 상품 ${lastItemCount}개가 남아있습니다. 수동으로 정리하거나 클리어 API 구현이 필요합니다.`,
    );
  }
}
