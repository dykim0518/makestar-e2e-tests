/**
 * POCAAlbum Shop 포인트상품 생성 페이지 객체
 *
 * URL: /pocaalbum/shop/product/create
 *
 * 필수 필드 (*):
 * - 상품종류* (드롭다운)
 * - 포인트 소모방식* (드롭다운)
 * - 순번* (spinbutton, 기본값 100)
 * - 상품명* (textbox "입력해주세요")
 * - 포인트* (spinbutton)
 * - 로고이미지* (파일 업로드)
 * - 메인이미지* (파일 업로드)
 */

import { Page, Locator } from "@playwright/test";
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

    // "상품명*" 필드 — placeholder "입력해주세요" 중 "상품명" 라벨 아래에 위치
    this.titleInput = page.getByRole("textbox", { name: "상품명" });
    // "포인트*" 필드
    this.priceInput = page.getByRole("spinbutton", { name: "포인트" });
    this.descriptionInput = page
      .locator('textarea:visible, [contenteditable="true"]')
      .first();
    this.fileInput = page.locator('input[type="file"]').first();
    this.createButton = page.getByRole("button", { name: /등록|저장/ }).first();
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
   * 커스텀 드롭다운에서 옵션 선택
   * POCA Admin의 드롭다운은 "선택해주세요" 텍스트를 클릭하면 옵션 목록이 나타남
   */
  private async selectDropdownOption(
    labelText: string,
    optionText: string,
  ): Promise<boolean> {
    // 라벨 근처의 드롭다운 트리거 찾기
    const label = this.page.getByText(labelText, { exact: false }).first();
    const isLabelVisible = await label
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!isLabelVisible) {
      console.log(`  ⚠️ 라벨 "${labelText}" 미발견`);
      return false;
    }

    // "선택해주세요" 드롭다운 트리거 클릭
    const trigger = label.locator("..").locator('[cursor="pointer"]').first();
    const isTriggerVisible = await trigger
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (isTriggerVisible) {
      await trigger.click();
    } else {
      // fallback: 라벨 부모의 부모에서 찾기
      const trigger2 = label
        .locator("xpath=ancestor::*[2]")
        .locator('[cursor="pointer"]')
        .first();
      await trigger2.click().catch(async () => {
        // 최후 수단: page.evaluate로 직접 클릭
        await this.page.evaluate((lt) => {
          const labels = Array.from(document.querySelectorAll("*"));
          const found = labels.find(
            (el) => el.textContent?.includes(lt) && el.textContent!.length < 30,
          );
          if (found) {
            const parent = found.closest("[class]")?.parentElement;
            const clickable = parent?.querySelector(
              '[style*="cursor"]',
            ) as HTMLElement;
            clickable?.click();
          }
        }, labelText);
      });
    }

    // 옵션 선택
    await this.page.waitForTimeout(500); // 드롭다운 애니메이션 대기
    const option = this.page.getByText(optionText, { exact: true }).first();
    const optionVisible = await option
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (optionVisible) {
      await option.click();
      return true;
    }

    // fallback: 첫 번째 옵션 선택
    const firstOption = this.page
      .locator('[role="option"], [class*="option"]')
      .first();
    const hasOption = await firstOption
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (hasOption) {
      await firstOption.click();
      return true;
    }

    await this.page.keyboard.press("Escape");
    console.log(
      `  ⚠️ 드롭다운 "${labelText}"에서 옵션 "${optionText}" 선택 실패`,
    );
    return false;
  }

  // --------------------------------------------------------------------------
  // 폼 입력
  // --------------------------------------------------------------------------

  /** 상품명 입력 */
  async fillTitle(title: string): Promise<void> {
    // 1순위: role 기반
    const roleVisible = await this.titleInput
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (roleVisible) {
      await this.titleInput.fill(title);
      return;
    }

    // 2순위: "상품명" 라벨 근처의 textbox
    const label = this.page.getByText("상품명", { exact: false }).first();
    const input = label
      .locator("..")
      .locator("..")
      .getByRole("textbox")
      .first();
    const inputVisible = await input
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (inputVisible) {
      await input.fill(title);
      return;
    }

    // 3순위: placeholder "입력해주세요" 중 두 번째 (첫 번째는 다른 필드일 수 있음)
    const placeholders = this.page.getByPlaceholder("입력해주세요");
    const count = await placeholders.count();
    if (count > 0) {
      await placeholders.first().fill(title);
    }
  }

  /** 포인트 입력 */
  async fillPrice(price: string): Promise<void> {
    const isVisible = await this.priceInput
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (isVisible) {
      await this.priceInput.fill(price);
      return;
    }

    // fallback: spinbutton 중 빈 값인 것
    const spinbuttons = this.page.getByRole("spinbutton");
    const count = await spinbuttons.count();
    for (let i = 0; i < count; i++) {
      const value = await spinbuttons.nth(i).inputValue();
      if (!value || value === "0") {
        await spinbuttons.nth(i).fill(price);
        return;
      }
    }
  }

  /** 전체 폼 입력 */
  async fillCreateForm(options: ShopProductCreateOptions): Promise<void> {
    // 1. 상품종류 선택 (필수)
    await this.selectDropdownOption("상품종류", "PACK");

    // 2. 포인트 소모방식 선택 (필수)
    await this.selectDropdownOption("소모방식", "소모");

    // 3. 상품명 입력 (필수)
    await this.fillTitle(options.title);

    // 4. 포인트 입력
    if (options.price) {
      await this.fillPrice(options.price);
    }

    // 5. 이미지 업로드 (로고이미지 필수)
    if (options.imagePath) {
      const { resolve, isAbsolute } = await import("path");
      const absolutePath = isAbsolute(options.imagePath)
        ? options.imagePath
        : resolve(__dirname, "..", options.imagePath);
      // 첫 번째 file input에 업로드
      const fileInputs = this.page.locator('input[type="file"]');
      const fileCount = await fileInputs.count();
      for (let i = 0; i < Math.min(fileCount, 2); i++) {
        await fileInputs.nth(i).setInputFiles(absolutePath);
      }
    }
  }

  /** 등록 후 목록 이동 대기 */
  async submitAndWaitForList(): Promise<void> {
    await this.createButton.scrollIntoViewIfNeeded();
    await this.createButton.click({ force: true });

    // 다이얼로그 자동 확인
    this.page.once("dialog", (dialog) => dialog.accept());

    await this.page
      .waitForURL(/\/pocaalbum\/shop/, { timeout: 15000 })
      .catch(() => {});
    await this.waitForLoadState("domcontentloaded");
  }

  /** 폼 필드 자동 탐색 (디버깅용) */
  async discoverFormFields(): Promise<Record<string, string>> {
    const fields: Record<string, string> = {};

    // textbox
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

    // spinbutton
    const spins = this.page.getByRole("spinbutton");
    const spCount = await spins.count();
    for (let i = 0; i < spCount; i++) {
      const val = await spins
        .nth(i)
        .inputValue()
        .catch(() => "");
      fields[`spinbutton[${i}]`] = `value="${val}"`;
    }

    // 드롭다운 (선택해주세요)
    const dropdowns = this.page.getByText("선택해주세요");
    const ddCount = await dropdowns.count();
    fields["dropdowns"] = `${ddCount}개 미선택 드롭다운`;

    console.log("  📋 폼 필드 탐색:", JSON.stringify(fields, null, 2));
    return fields;
  }
}
