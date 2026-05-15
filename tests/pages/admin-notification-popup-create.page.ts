/**
 * AdminNotificationPopupCreatePage - 팝업 등록 페이지
 *
 * URL: /notification/popup/create
 *
 * 폼 구조 (필수만):
 * 1. 타입선택 (필수): 공통 팝업 / B2C 팝업 / B2B 팝업
 * 2. 제목 (단일 input — 다국어 아님)
 * 3. 노출 기간 (필수): 시작 날짜 + 시작 시간 + 종료 날짜 + 종료 시간
 * 4. 이미지 (선택, 토글 ON 시 업로드)
 * 5. 정렬 (왼쪽/가운데)
 * 6. 본문/팝업타이틀/버튼 (선택, 토글 OFF 유지)
 *
 * 인증: 본인 세션 쿠키 (setupApiInterceptor 미사용).
 * 시간 picker는 vue-multiselect 드롭다운.
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage } from "./admin-base.page";

export type PopupCategory = "공통 팝업" | "B2C 팝업" | "B2B 팝업";
export type PopupAlignment = "왼쪽 정렬" | "가운데 정렬";

export type PopupCreateOptions = {
  category: PopupCategory;
  title: string;
  startDay: number; // 같은 달 내 일(1~31). 월 변경 미지원
  startTime: string; // 시간 옵션 텍스트 (e.g. "오후 02:30")
  endDay: number;
  endTime: string;
  alignment?: PopupAlignment;
  imagePath?: string;
  // 팝업타이틀 토글 ON + 한국어/영어 입력 (둘 다 필수)
  popupTitleKo?: string;
  popupTitleEn?: string;
};

export class AdminNotificationPopupCreatePage extends AdminBasePage {
  readonly titleInput: Locator;
  readonly startDateInput: Locator;
  readonly endDateInput: Locator;
  readonly startTimeWrapper: Locator;
  readonly endTimeWrapper: Locator;
  readonly imageToggleSwitch: Locator;
  readonly popupTitleToggle: Locator;
  readonly popupTitleKoInput: Locator;
  readonly popupTitleEnInput: Locator;
  readonly fileInput: Locator;
  readonly submitButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    super(page);

    this.titleInput = page.getByPlaceholder("리스트의 제목에 반영됩니다.");
    this.startDateInput = page.getByPlaceholder("시작 날짜 선택");
    this.endDateInput = page.getByPlaceholder("종료 날짜 선택");
    // 시간 picker는 vue-multiselect — input은 hidden, .timepicker wrapper를 placeholder로 식별
    this.startTimeWrapper = page.locator(
      '.timepicker:has(input[placeholder="시작 시간 선택"])',
    );
    this.endTimeWrapper = page.locator(
      '.timepicker:has(input[placeholder="종료 시간 선택"])',
    );
    // 토글 순서 (스크린샷 기준): 0=이미지, 1=본문, 2=팝업타이틀, 3=버튼추가
    this.imageToggleSwitch = page.locator('input[type="checkbox"]').nth(0);
    this.popupTitleToggle = page.locator('input[type="checkbox"]').nth(2);
    // 다국어 placeholder는 팝업타이틀(첫 번째 set)과 버튼(두 번째 set)
    this.popupTitleKoInput = page
      .getByPlaceholder("한글로 입력해주세요")
      .first();
    this.popupTitleEnInput = page
      .getByPlaceholder("영어로 입력해주세요")
      .first();
    this.fileInput = page.locator('input[type="file"]').first();
    this.submitButton = page.getByRole("button", {
      name: "등록하기",
      exact: true,
    });
    this.cancelButton = page.getByRole("button", { name: "취소", exact: true });
  }

  getPageUrl(): string {
    return `${this.baseUrl}/notification/popup/create`;
  }

  getHeadingText(): string {
    return "공지관리"; // 페이지 헤딩은 동일
  }

  categoryButton(name: PopupCategory): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  async isCategoryActive(name: PopupCategory): Promise<boolean> {
    const cls = (await this.categoryButton(name).getAttribute("class")) || "";
    return !/bg-transparent/.test(cls);
  }

  async selectCategory(name: PopupCategory): Promise<void> {
    await this.categoryButton(name).click({ force: true });
  }

  async fillTitle(text: string): Promise<void> {
    await expect(this.titleInput, "팝업 제목 input 미발견").toBeVisible({
      timeout: 5000,
    });
    await this.titleInput.fill(text);
  }

  /**
   * 날짜 input은 readonly — 클릭하면 캘린더 팝업이 뜨고, 일자 셀을 클릭해서 선택.
   * 같은 달 안의 단일 일자만 지원 (월간 navigation 미구현).
   */
  async pickDate(input: Locator, day: number): Promise<void> {
    await input.click({ force: true });
    // 캘린더는 dialog/popup으로 떠있음. 일자 셀은 텍스트만 가진 작은 노드.
    const cell = this.page.getByText(String(day), { exact: true }).first();
    await expect(cell, `${day}일 셀 미발견`).toBeVisible({ timeout: 5000 });
    await cell.click({ force: true });
  }

  /**
   * 시간 picker는 vue-multiselect 드롭다운.
   * .timepicker wrapper 클릭 → .multiselect__option 중 라벨 일치하는 것 클릭.
   * timeStr 형식: "오전 09:30" / "오후 03:00" 등 (30분 단위).
   */
  async pickTime(wrapper: Locator, timeStr: string): Promise<void> {
    await wrapper.click({ force: true });
    // 옵션은 wrapper 내부 (.multiselect__content)에 렌더 — wrapper 스코프로 제한
    const option = wrapper
      .locator(".multiselect__option")
      .filter({ hasText: timeStr })
      .first();
    await expect(option, `시간 옵션 "${timeStr}" 미발견`).toBeVisible({
      timeout: 5000,
    });
    await option.click({ force: true });
  }

  async setExposurePeriod(
    startDay: number,
    startTime: string,
    endDay: number,
    endTime: string,
  ): Promise<void> {
    await this.pickDate(this.startDateInput, startDay);
    await this.pickTime(this.startTimeWrapper, startTime);
    await this.pickDate(this.endDateInput, endDay);
    await this.pickTime(this.endTimeWrapper, endTime);
  }

  async selectAlignment(alignment: PopupAlignment): Promise<void> {
    // radio 라벨 옆 클릭
    await this.page
      .getByText(alignment, { exact: true })
      .first()
      .click({ force: true });
  }

  /** 이미지 토글 ON + 파일 업로드 */
  async enableImageAndUpload(absolutePath: string): Promise<void> {
    // 토글이 OFF면 ON으로
    const isOn = await this.imageToggleSwitch.isChecked().catch(() => false);
    if (!isOn) {
      await this.imageToggleSwitch.check({ force: true });
    }
    // file input은 hidden일 수 있어 setInputFiles 사용
    await this.fileInput.setInputFiles(absolutePath);
  }

  /** 팝업타이틀 토글 ON + 한국어/영어 제목 입력 (둘 다 필수) */
  async enablePopupTitle(ko: string, en: string): Promise<void> {
    const isOn = await this.popupTitleToggle.isChecked().catch(() => false);
    if (!isOn) {
      await this.popupTitleToggle.check({ force: true });
    }
    await expect(
      this.popupTitleKoInput,
      "팝업타이틀 한국어 input 미발견",
    ).toBeVisible({ timeout: 5000 });
    await this.popupTitleKoInput.fill(ko);
    await expect(
      this.popupTitleEnInput,
      "팝업타이틀 영어 input 미발견",
    ).toBeVisible({ timeout: 5000 });
    await this.popupTitleEnInput.fill(en);
  }

  async fillForm(options: PopupCreateOptions): Promise<void> {
    await this.selectCategory(options.category);
    await this.fillTitle(options.title);
    await this.setExposurePeriod(
      options.startDay,
      options.startTime,
      options.endDay,
      options.endTime,
    );
    if (options.alignment) {
      await this.selectAlignment(options.alignment);
    }
    if (options.imagePath) {
      await this.enableImageAndUpload(options.imagePath);
    }
    if (options.popupTitleKo && options.popupTitleEn) {
      await this.enablePopupTitle(options.popupTitleKo, options.popupTitleEn);
    }
  }

  /** 등록 + 모달 에러 감지 + 목록 이동 대기 */
  async submitAndWaitForList(): Promise<void> {
    await this.submitButton.scrollIntoViewIfNeeded();
    await this.submitButton.click({ force: true });

    const modal = this.page
      .locator('[role="dialog"], .fixed:has-text("알림")')
      .first();
    const hasModal = await modal
      .isVisible({ timeout: 1500 })
      .catch(() => false);
    if (hasModal) {
      const body = (await modal.textContent().catch(() => "")) || "";
      throw new Error(`등록 실패 — 모달: ${body.trim().substring(0, 200)}`);
    }

    await this.page
      .waitForFunction(() => !window.location.href.includes("/create"), {
        timeout: 15000,
      })
      .catch(() => {});

    if (this.page.url().includes("/create")) {
      throw new Error(`등록 후 목록 이동 실패 — 현재 URL: ${this.page.url()}`);
    }
    await this.page.waitForLoadState("domcontentloaded");
  }
}
