/**
 * POCAAlbum 앨범 생성 페이지 객체
 *
 * URL: /pocaalbum/album/create
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";
import * as path from "path";

// ============================================================================
// 앨범 생성 옵션 타입
// ============================================================================

export interface AlbumCreateOptions {
  title: string;
  artist?: string;
  albumType?: string;
  releaseDate?: string;
  imagePath?: string;
}

// ============================================================================
// PocaAlbumCreatePage 클래스
// ============================================================================

export class PocaAlbumCreatePage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 로케이터 정의
  // --------------------------------------------------------------------------

  readonly titleInput: Locator;
  readonly albumTypeSelect: Locator;
  readonly releaseDateInput: Locator;
  readonly fileInput: Locator;
  readonly createButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    // 제목 입력 - placeholder 기반 (폴백: input 탐색)
    this.titleInput = page
      .locator(
        'input[placeholder*="제목"], input[placeholder*="앨범명"], input[placeholder*="타이틀"]',
      )
      .first();
    // 앨범타입 드롭다운
    this.albumTypeSelect = page
      .locator(
        'select:near(:text("앨범타입")), [role="combobox"]:near(:text("앨범타입"))',
      )
      .first();
    // 발매일 입력 (커스텀 date picker 포함)
    this.releaseDateInput = page
      .locator(
        'input[placeholder*="발매일"], input[placeholder*="선택하세요"]:near(:text("발매일")), input[type="date"]',
      )
      .first();
    // 이미지 업로드
    this.fileInput = page.locator('input[type="file"]').first();
    // 등록하기 버튼 (pink 계열)
    this.createButton = page
      .locator(
        'button:has-text("등록"), button:has-text("저장"), button:has-text("생성")',
      )
      .first();
    // 취소하기 버튼
    this.cancelButton = page.locator('button:has-text("취소")').first();
  }

  // --------------------------------------------------------------------------
  // 추상 메서드 구현
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/pocaalbum/album/create`;
  }

  getHeadingText(): string {
    return "앨범";
  }

  // --------------------------------------------------------------------------
  // 폼 입력 메서드
  // --------------------------------------------------------------------------

  /** 제목 입력 */
  async fillTitle(title: string): Promise<void> {
    await this.titleInput.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
    await this.titleInput.fill(title);
  }

  /** 앨범타입 선택 */
  async selectAlbumType(type: string): Promise<void> {
    const isVisible = await this.albumTypeSelect
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!isVisible) {
      console.log("ℹ️ 앨범타입 필드를 찾을 수 없음 - 건너뜀");
      return;
    }

    // select 태그인 경우
    const tagName = await this.albumTypeSelect.evaluate((el) =>
      el.tagName.toLowerCase(),
    );
    if (tagName === "select") {
      await this.albumTypeSelect.selectOption({ label: type });
    } else {
      // combobox 클릭 → 옵션 선택
      await this.albumTypeSelect.click();
      await this.page
        .locator(`[role="option"]:has-text("${type}"), li:has-text("${type}")`)
        .first()
        .click();
    }
  }

  /** 발매일 입력 (커스텀 캘린더 피커 대응) */
  async fillReleaseDate(_date: string): Promise<void> {
    // input 기반 시도
    const isInputVisible = await this.releaseDateInput
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (isInputVisible) {
      await this.releaseDateInput.fill(_date);
      await this.releaseDateInput.press("Tab");
      return;
    }

    // 커스텀 날짜 피커: "발매일을 선택하세요" 클릭 → 캘린더 → "오늘" 클릭
    const datePicker = this.page.getByText("발매일을 선택하세요").first();
    const isPickerVisible = await datePicker
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!isPickerVisible) {
      console.log("ℹ️ 발매일 필드를 찾을 수 없음 - 건너뜀");
      return;
    }

    await datePicker.click();

    // "오늘" 버튼으로 오늘 날짜 선택
    const todayBtn = this.page.getByText("오늘", { exact: true }).first();
    const hasTodayBtn = await todayBtn
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (hasTodayBtn) {
      await todayBtn.click();
      console.log("  ✅ 발매일 선택: 오늘");
    } else {
      // 오늘 버튼이 없으면 현재 달의 첫 번째 날짜 클릭
      const dayCell = this.page
        .locator('button:has-text("1"), td:has-text("1")')
        .first();
      await dayCell.click();
      console.log("  ✅ 발매일 선택: 1일");
    }
  }

  /** 이미지 파일 업로드 */
  async uploadImage(filePath: string): Promise<void> {
    const absolutePath = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(__dirname, "..", filePath);

    const fileInput = this.page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(absolutePath);
    console.log(`ℹ️ 이미지 업로드 시도: ${absolutePath}`);
  }

  /** 아티스트 선택 (커스텀 드롭다운) */
  async selectArtist(artist: string): Promise<void> {
    // placeholder 텍스트로 아티스트 드롭다운 찾기
    const artistDropdown = this.page
      .locator(':text("아티스트를 선택하세요")')
      .first();
    const isVisible = await artistDropdown
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (!isVisible) {
      console.log("ℹ️ 아티스트 드롭다운을 찾을 수 없음 - 건너뜀");
      return;
    }

    await artistDropdown.click();

    // 검색 필드에 아티스트명 입력
    const searchInput = this.page
      .locator('textbox[name="Search..."], input[placeholder="Search..."]')
      .first();
    const hasSearch = await searchInput
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (hasSearch) {
      await searchInput.fill(artist);
    }

    // 드롭다운 옵션에서 아티스트 선택 (커스텀 div 구조)
    const option = this.page
      .locator(
        `div[cursor="pointer"]:has-text("${artist}"), [cursor="pointer"]:text("${artist}")`,
      )
      .first();
    await option.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});

    // 텍스트 매칭으로 폴백
    const optionFallback = this.page.getByText(artist, { exact: true }).first();
    await optionFallback.click();
    console.log(`  ✅ 아티스트 선택: ${artist}`);
  }

  /** 전체 폼 입력 통합 */
  async fillCreateForm(options: AlbumCreateOptions): Promise<void> {
    await this.fillTitle(options.title);

    if (options.artist) {
      await this.selectArtist(options.artist);
    }

    if (options.albumType) {
      await this.selectAlbumType(options.albumType);
    }

    if (options.releaseDate) {
      await this.fillReleaseDate(options.releaseDate);
    }

    if (options.imagePath) {
      await this.uploadImage(options.imagePath);
    }
  }

  /** 등록 클릭 + 목록 이동 대기 */
  async submitAndWaitForList(): Promise<void> {
    await this.createButton.scrollIntoViewIfNeeded();
    await this.createButton.click({ force: true });

    // 모달 에러 알림 감지 (필수 필드 누락 시 나타남)
    const confirmBtn = this.page
      .locator(
        '.fixed button:has-text("확인"), [role="dialog"] button:has-text("확인")',
      )
      .first();
    const hasModal = await confirmBtn
      .isVisible({ timeout: 2000 })
      .catch(() => false);
    if (hasModal) {
      const modalContainer = this.page
        .locator(".fixed, [role='dialog']")
        .first();
      const modalText = (await modalContainer.textContent()) || "";
      await confirmBtn.click().catch(() => {});
      throw new Error(`등록 실패 — 모달 알림: ${modalText.trim()}`);
    }

    // 목록 페이지로 이동 대기 (create URL에서 벗어나면 성공)
    await this.page
      .waitForFunction(() => !window.location.href.includes("/create"), {
        timeout: 15000,
      })
      .catch(() => {});

    const currentUrl = this.page.url();
    if (currentUrl.includes("/create")) {
      throw new Error(`등록 후 목록 이동 실패 — 현재 URL: ${currentUrl}`);
    }

    await this.waitForLoadState("domcontentloaded");
  }

  /**
   * 폼 필드 자동 탐색 (디버깅용)
   * 첫 실행 시 폼의 정확한 필드 구조 파악
   */
  async discoverFormFields(): Promise<Record<string, string>> {
    const fields: Record<string, string> = {};

    // input 필드 탐색
    const inputs = this.page.locator("input:visible");
    const inputCount = await inputs.count();
    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const type = (await input.getAttribute("type")) || "text";
      const placeholder = (await input.getAttribute("placeholder")) || "";
      const name = (await input.getAttribute("name")) || "";
      const id = (await input.getAttribute("id")) || "";
      fields[`input[${i}]`] =
        `type=${type}, placeholder="${placeholder}", name="${name}", id="${id}"`;
    }

    // select 필드 탐색
    const selects = this.page.locator("select:visible");
    const selectCount = await selects.count();
    for (let i = 0; i < selectCount; i++) {
      const sel = selects.nth(i);
      const name = (await sel.getAttribute("name")) || "";
      const id = (await sel.getAttribute("id")) || "";
      fields[`select[${i}]`] = `name="${name}", id="${id}"`;
    }

    // textarea 필드 탐색
    const textareas = this.page.locator("textarea:visible");
    const textareaCount = await textareas.count();
    for (let i = 0; i < textareaCount; i++) {
      const ta = textareas.nth(i);
      const placeholder = (await ta.getAttribute("placeholder")) || "";
      const name = (await ta.getAttribute("name")) || "";
      fields[`textarea[${i}]`] = `placeholder="${placeholder}", name="${name}"`;
    }

    console.log("📋 폼 필드 탐색 결과:");
    for (const [key, value] of Object.entries(fields)) {
      console.log(`  ${key}: ${value}`);
    }

    return fields;
  }
}
