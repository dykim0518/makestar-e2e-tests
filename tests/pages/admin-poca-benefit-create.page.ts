/**
 * POCAAlbum BENEFIT 이벤트 생성 페이지 객체
 *
 * URL: /pocaalbum/benefit/event/create
 *
 * 드롭다운: Vue 커스텀 컴포넌트 (포탈 패턴)
 *   트리거: .is-placeholder (.selection-input)
 *   패널: body > .selection-dropdown-container > .menu-item > .menu-item__label
 *   커버: body > .selection-dropdown-cover-container (백드롭 오버레이)
 *
 * 폼 구조:
 * 1. 앨범 선택 (h2) — 드롭다운 "앨범을 선택하세요" + "적용하기"
 * 2. 메인이벤트 조건 — 조건제목*, 조건 앨범리스트*(드롭다운), 컬렉션팩*(드롭다운)
 * 3. 메인이벤트 혜택 — 혜택제목*
 * 4. 메인이벤트 정보 — 이벤트 제목*, 이미지*, 시작일*(달력), 종료일*(달력)
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export type BenefitCreateOptions = {
  title: string;
  imagePath?: string;
};

export class PocaBenefitCreatePage extends AdminBasePage {
  readonly titleInput: Locator;
  readonly fileInput: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    this.titleInput = page.locator('input[placeholder*="제목"]').first();
    this.fileInput = page.locator('input[type="file"]').first();
    this.createButton = page
      .getByRole("button", { name: /생성하기|등록|저장/ })
      .first();
    this.cancelButton = page.getByRole("button", { name: "취소하기" });
  }

  getPageUrl(): string {
    return `${this.baseUrl}/pocaalbum/benefit/event/create`;
  }

  getHeadingText(): string {
    return "BENEFIT";
  }

  // --------------------------------------------------------------------------
  // 드롭다운 헬퍼 (포탈 + 커버 오버레이 처리)
  // --------------------------------------------------------------------------

  /** 커버 오버레이 + 잔여 드롭다운 패널을 DOM에서 직접 제거 */
  private async dismissDropdownCover(): Promise<void> {
    await this.page.evaluate(() => {
      document
        .querySelectorAll(
          ".selection-dropdown-cover-container, .selection-dropdown-container",
        )
        .forEach((el) => el.remove());
    });
  }

  /**
   * 커스텀 드롭다운에서 첫 번째 옵션 선택
   * cover 해제 → trigger force click → 패널 attached 대기 → option force click
   */
  private async selectDropdownByIndex(dropdownIndex: number): Promise<void> {
    await this.dismissDropdownCover();

    const triggers = this.page.locator(".is-placeholder");
    const trigger = triggers.nth(dropdownIndex);
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click({ force: true });

    const dropdown = this.page.locator(".selection-dropdown-container");
    await dropdown.waitFor({ state: "attached", timeout: 3000 });

    const firstItem = dropdown.locator(".menu-item__label").first();
    await firstItem.waitFor({ state: "attached", timeout: 3000 });
    await firstItem.click({ force: true });

    await this.dismissDropdownCover();
  }

  // --------------------------------------------------------------------------
  // 폼 입력
  // --------------------------------------------------------------------------

  /** 앨범 선택 (상단 섹션) */
  async selectAlbum(): Promise<void> {
    await this.selectDropdownByIndex(0);

    const applyBtn = this.page.getByRole("button", { name: "적용하기" });
    await expect(applyBtn, "적용하기 버튼 미발견").toBeVisible({
      timeout: 5000,
    });
    await applyBtn.click();
  }

  /** 필수 텍스트 필드 입력 (placeholder 기반, disabled 제외) */
  async fillRequiredTextInputs(baseTitle: string): Promise<void> {
    const placeholders = [
      "조건 제목을 입력하세요",
      "제목을 입력해주세요",
      "한줄내용을 입력해주세요",
      "한국어 한줄내용을 입력해주세요",
      "영어 한줄내용을 입력해주세요",
    ];
    for (const ph of placeholders) {
      const inputs = this.page.locator(`input[placeholder="${ph}"]`);
      const count = await inputs.count();
      for (let i = 0; i < count; i++) {
        const disabled = await inputs.nth(i).isDisabled();
        if (!disabled) {
          await inputs.nth(i).fill(baseTitle);
        }
      }
    }
  }

  /**
   * 남은 모든 드롭다운 선택 (조건 앨범리스트, 컬렉션팩 등)
   * 동적 폼이므로 선택 후 새 드롭다운이 나타날 수 있음
   */
  async selectAllRemainingDropdowns(): Promise<void> {
    // 조건 앨범리스트 + 컬렉션팩 (최대 2회, 동적 폼 무한 루프 방지)
    for (let attempt = 0; attempt < 2; attempt++) {
      const count = await this.page.locator(".is-placeholder").count();
      if (count === 0) break;

      try {
        await this.selectDropdownByIndex(0);
      } catch {
        await this.dismissDropdownCover();
        break;
      }
    }
  }

  /** 날짜 선택 (시작일/종료일 커스텀 달력) */
  async selectDates(): Promise<void> {
    for (let i = 0; i < 2; i++) {
      const dateTrigger = this.page.getByText("날짜를 선택하세요").first();
      const isVisible = await dateTrigger
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (!isVisible) break;

      // 모든 오버레이를 DOM에서 직접 제거
      await this.page.evaluate(() => {
        document
          .querySelectorAll(".selection-dropdown-cover-container")
          .forEach((el) => el.remove());
        document
          .querySelectorAll(".selection-dropdown-container")
          .forEach((el) => el.remove());
      });

      await dateTrigger.scrollIntoViewIfNeeded();
      await dateTrigger.click();

      // 달력에서 활성화된 날짜 클릭 (시작: 15일, 종료: 20일)
      const dayNum = i === 0 ? "15" : "20";
      const dayBtn = this.page
        .locator("button:not([disabled])")
        .filter({ hasText: new RegExp(`^${dayNum}$`) })
        .first();
      await dayBtn.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
      const dayVisible = await dayBtn
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      if (dayVisible) {
        await dayBtn.click();
      }
    }
  }

  /** 이미지 업로드 */
  async uploadImages(imagePath: string): Promise<void> {
    const { resolve, isAbsolute } = await import("path");
    const absolutePath = isAbsolute(imagePath)
      ? imagePath
      : resolve(__dirname, "..", imagePath);

    const fileInputs = this.page.locator('input[type="file"]');
    const count = await fileInputs.count();
    for (let i = 0; i < count; i++) {
      await fileInputs
        .nth(i)
        .setInputFiles(absolutePath)
        .catch(() => {});
    }
  }

  /** 전체 폼 입력 */
  async fillCreateForm(options: BenefitCreateOptions): Promise<void> {
    // 1. 앨범 선택 + 적용
    await this.selectAlbum();

    // 2. 필수 텍스트 입력
    await this.fillRequiredTextInputs(options.title);

    // 3. 남은 드롭다운 선택 (조건 앨범리스트, 컬렉션팩 등)
    await this.selectAllRemainingDropdowns();

    // 4. 이미지 업로드
    if (options.imagePath) {
      await this.uploadImages(options.imagePath);
    }

    // 5. 시작일/종료일 선택
    await this.selectDates();
  }

  /** 등록 후 목록 이동 대기 */
  async submitAndWaitForList(): Promise<void> {
    this.page.once("dialog", (dialog) => dialog.accept());

    await this.createButton.scrollIntoViewIfNeeded();
    await this.createButton.click({ force: true });

    await this.page
      .waitForURL(/\/pocaalbum\/benefit/, { timeout: 15000 })
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

    const dropdowns = this.page.locator(".is-placeholder");
    const ddCount = await dropdowns.count();
    fields["dropdowns"] = `${ddCount}개 미선택 드롭다운`;

    console.log("  📋 폼 필드 탐색:", JSON.stringify(fields, null, 2));
    return fields;
  }
}
