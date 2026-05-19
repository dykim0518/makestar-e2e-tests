/**
 * MakestarMyPage — Makestar 마이페이지(특히 배송지 관리) POM.
 *
 * 자동화 테스트 격리를 위한 사용자 상태 리셋 책임을 진다. 현재는 배송지만 다루지만
 * 향후 프로필·이벤트 응모 등 다른 마이페이지 영역도 여기로 흡수한다.
 */

import { Page, expect } from "@playwright/test";
import { BasePage, DEFAULT_TIMEOUTS, TimeoutConfig } from "./base.page";
import { STG_TEST_ACCOUNT } from "../fixtures/test-account";

type ShippingCountry = "KR";

export class MakestarMyPage extends BasePage {
  readonly baseUrl =
    process.env.MAKESTAR_BASE_URL || "https://www.makestar.com";

  constructor(page: Page, timeouts: TimeoutConfig = DEFAULT_TIMEOUTS) {
    super(page, timeouts);
  }

  private async assertNoAccessDenied(context: string): Promise<void> {
    const accessDeniedHeading = this._page.getByRole("heading", {
      name: /Access Denied/i,
    });
    const accessDeniedBody = this._page.getByText(
      /IP address is not authorized/i,
    );
    const isAccessDenied =
      (await accessDeniedHeading
        .waitFor({ state: "visible", timeout: 1000 })
        .then(() => true)
        .catch(() => false)) ||
      (await accessDeniedBody
        .waitFor({ state: "visible", timeout: 1000 })
        .then(() => true)
        .catch(() => false));

    if (isAccessDenied) {
      throw new Error(
        `${context} 실패: Access Denied 페이지가 표시되었습니다. ` +
          `현재 실행 환경의 IP가 ${this.baseUrl} 접근 허용 대상인지 확인하세요. ` +
          `현재 URL ${this._page.url()}`,
      );
    }
  }

  /** 배송지 관리 목록(`/my-page/address`) 진입 */
  async gotoAddressBook(): Promise<void> {
    await this._page.goto(`${this.baseUrl}/my-page/address`, {
      waitUntil: "domcontentloaded",
    });
    await this._page
      .waitForLoadState("networkidle", { timeout: this.timeouts.long })
      .catch(() => {});
    await this.assertNoAccessDenied("배송지 관리 페이지 진입");
    if (!this._page.url().includes("/my-page")) {
      throw new Error(
        `배송지 관리 페이지 진입 실패: 현재 URL ${this._page.url()}. storageState 만료 가능성.`,
      );
    }
  }

  /**
   * 지정 국가의 등록된 주소를 기본 배송지로 강제 지정.
   *
   * 현재는 KR만 지원하며, 테스트 계정의 KR 주소 ID를 fixture 상수로 하드코딩한다
   * (`STG_TEST_ACCOUNT.KR_DEFAULT_ADDRESS_ID`). 해당 주소가 존재하지 않으면 fail-fast.
   *
   * 멱등 — 이미 기본인 경우에는 저장 버튼이 disabled일 수 있으므로 저장 없이 통과한다.
   */
  async setDefaultShippingAddress(country: ShippingCountry): Promise<void> {
    if (country !== "KR") {
      throw new Error(
        `setDefaultShippingAddress: ${country}는 미지원. KR만 지원.`,
      );
    }

    const addressId = STG_TEST_ACCOUNT.KR_DEFAULT_ADDRESS_ID;
    await this._page.goto(
      `${this.baseUrl}/my-page/address/update/${addressId}`,
      { waitUntil: "domcontentloaded" },
    );
    await this._page
      .waitForLoadState("networkidle", { timeout: this.timeouts.long })
      .catch(() => {});
    await this.assertNoAccessDenied("KR 기본 주소 edit 화면 진입");

    if (!this._page.url().includes(`/address/update/${addressId}`)) {
      throw new Error(
        `KR 기본 주소(${addressId}) edit 화면 진입 실패: 현재 URL ${this._page.url()}. ` +
          `테스트 계정에서 해당 주소가 삭제되었을 수 있음.`,
      );
    }

    const setMainCheckbox = this._page.getByRole("checkbox", {
      name: /Set as Main Address|기본 배송지/i,
    });
    await expect(
      setMainCheckbox,
      "Set as Main Address 체크박스를 찾을 수 없음 — 마이페이지 UI 변경 가능성",
    ).toBeVisible({ timeout: this.timeouts.medium });
    if (await setMainCheckbox.isChecked()) {
      return;
    }

    await setMainCheckbox.check();

    const saveButton = this._page.getByRole("button", {
      name: /^Save$|^저장$/i,
    });
    await expect(
      saveButton,
      "Save 버튼을 찾을 수 없음 — 마이페이지 UI 변경 가능성",
    ).toBeEnabled({ timeout: this.timeouts.medium });
    await saveButton.click();

    await this._page
      .waitForURL(/\/my-page\/address(?:$|\?)/, {
        timeout: this.timeouts.navigation,
      })
      .catch(() => {});
    await this._page
      .waitForLoadState("networkidle", { timeout: this.timeouts.long })
      .catch(() => {});
  }
}
