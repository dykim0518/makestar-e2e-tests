/**
 * Admin 배너설정 페이지 객체 (/contents/banner/list)
 *
 * 단일 화면에서 다음 기능을 제공:
 * - 좌측: 전시중/대기중 탭 + 배너 목록 + 순서 변경 + 메인배너 갯수 설정
 * - 우측: 데스크탑/모바일 구성 미리보기
 * - 우상단: 배너 등록하기 버튼 → 등록 모달
 *
 * 모달은 [role="dialog"] 미사용 — heading 텍스트로 scope를 잡는다.
 */

import { Page, Locator } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export class BannerListPage extends AdminBasePage {
  // 상단 영역
  readonly heading: Locator;
  readonly listSectionHeading: Locator;
  readonly registerButton: Locator;
  readonly orderSaveButton: Locator;
  readonly mainBannerCountButton: Locator;

  // 탭
  readonly displayedTab: Locator;
  readonly waitingTab: Locator;

  // 미리보기
  readonly previewSection: Locator;
  readonly devicePreviewToggle: Locator;

  // 메인배너 갯수 설정 모달
  readonly countModalHeading: Locator;
  readonly countModalInput: Locator;
  readonly countModalNotice: Locator;
  readonly countModalCancelButton: Locator;
  readonly countModalConfirmButton: Locator;

  // 배너 목록 — 종류 라벨 (전시중 탭의 "메인" 칩)
  readonly displayedMainTypeChips: Locator;

  // 배너 등록 모달
  readonly registerModalHeading: Locator;
  readonly registerModalCloseButton: Locator;
  readonly registerModalCategoryLabel: Locator;
  readonly registerModalImageLabel: Locator;
  readonly registerModalImageInputs: Locator;
  readonly registerModalNameInput: Locator;
  readonly registerModalDescriptionLabel: Locator;
  readonly registerModalLangButtons: Locator;
  readonly registerModalPeriodLabel: Locator;
  readonly registerModalStartDateInput: Locator;
  readonly registerModalStartTimeInput: Locator;
  readonly registerModalEndDateInput: Locator;
  readonly registerModalEndTimeInput: Locator;
  readonly registerModalMainTypeButton: Locator;
  readonly registerModalSubTypeButton: Locator;
  readonly registerModalDeviceDesktopTab: Locator;
  readonly registerModalDeviceMobileTab: Locator;
  readonly registerModalSubmitButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    // 페이지 상단
    this.heading = page.getByRole("heading", { name: "배너설정", exact: true });
    // breadcrumb의 <a>배너 목록</a>과 충돌 회피: 메인 영역의 <p> 태그만
    this.listSectionHeading = page
      .locator("p")
      .filter({ hasText: /^배너 목록$/ });
    this.registerButton = page
      .getByText("배너 등록하기", { exact: true })
      .first();
    this.orderSaveButton = page.getByRole("button", {
      name: "순서변경 저장하기",
    });
    this.mainBannerCountButton = page.getByRole("button", {
      name: "메인배너 갯수 설정",
    });

    // 탭
    this.displayedTab = page.getByText("전시중인 배너", { exact: true });
    this.waitingTab = page.getByText("대기중인 배너", { exact: true });

    // 미리보기
    this.previewSection = page.getByText("구성 미리보기", { exact: true });
    this.devicePreviewToggle = page.getByRole("button", {
      name: /데스크탑 버전 보기|모바일 버전 보기/,
    });

    // 메인배너 갯수 설정 모달 — heading은 <div>"배너갯수 설정"</div>, role 미사용
    // 모달 scope = 헤딩 텍스트 + 안내문 + input을 모두 가진 가장 외부 컨테이너
    const countModalScope = page
      .locator("div")
      .filter({ hasText: "배너갯수 설정" })
      .filter({ hasText: "메인배너는 최대 10개" })
      .filter({ has: page.locator("input") })
      .first();
    this.countModalHeading = countModalScope.getByText("배너갯수 설정", {
      exact: true,
    });
    this.countModalInput = countModalScope.locator("input").first();
    // 안내문은 "10개 까지"처럼 띄어쓰기가 들어가 있을 수 있어 정규식 유연하게
    this.countModalNotice = countModalScope.getByText(/메인배너는 최대 10개/);
    this.countModalCancelButton = countModalScope.getByRole("button", {
      name: "취소",
    });
    this.countModalConfirmButton = countModalScope.getByRole("button", {
      name: "확인",
    });

    // 종류=메인 칩 — list row 안에 단독 "메인" 텍스트로 렌더 (트리거 "메인배너 갯수 설정"·등록 모달 "메인 배너"와 exact match로 격리).
    // page-level scope. 등록 모달은 닫힌 상태 전제, 미리보기에는 "메인 배너 미리보기" 같이 단독 "메인"이 아닐 가능성 높음.
    this.displayedMainTypeChips = page.getByText("메인", { exact: true });

    // 배너 등록 모달 — heading은 <div>"배너 등록하기"</div>, role 미사용
    // 모달 scope = 등록 모달 unique 라벨("연결하는 대분류")을 가진 가장 외부 컨테이너
    const registerModalScope = page
      .locator("div")
      .filter({ hasText: "연결하는 대분류" })
      .filter({ hasText: "배너에 들어가는 문구" })
      .filter({ has: page.getByPlaceholder("배너명을 입력해주세요") })
      .first();
    // 모달 헤딩은 트리거 버튼과 같은 텍스트라 scope 안에서만 찾는다
    this.registerModalHeading = registerModalScope
      .getByText("배너 등록하기", { exact: true })
      .first();
    // X 닫기 — 모달 우상단의 svg 아이콘 (button 아닌 div+onclick인 경우가 많음)
    this.registerModalCloseButton = registerModalScope.locator("svg").first();
    this.registerModalCategoryLabel = registerModalScope.getByText(
      "연결하는 대분류",
      { exact: true },
    );
    this.registerModalImageLabel = registerModalScope
      .getByText("이미지", { exact: true })
      .first();
    this.registerModalImageInputs =
      registerModalScope.locator('input[type="file"]');
    this.registerModalNameInput =
      registerModalScope.getByPlaceholder("배너명을 입력해주세요");
    this.registerModalDescriptionLabel = registerModalScope.getByText(
      "배너에 들어가는 문구",
      { exact: true },
    );
    this.registerModalLangButtons = registerModalScope.getByRole("button", {
      name: /^(한국어|영어|중국어|일본어)$/,
    });
    this.registerModalPeriodLabel = registerModalScope.getByText("게시기간", {
      exact: true,
    });
    this.registerModalStartDateInput =
      registerModalScope.getByPlaceholder("시작 날짜 선택");
    // 시간 필드는 multiselect 컴포넌트 — input은 hidden, placeholder가 보이는 wrapper 텍스트로 검증
    this.registerModalStartTimeInput = registerModalScope.getByText(
      "시작 시간 선택",
      { exact: true },
    );
    this.registerModalEndDateInput =
      registerModalScope.getByPlaceholder("종료 날짜 선택");
    this.registerModalEndTimeInput = registerModalScope.getByText(
      "종료 시간 선택",
      { exact: true },
    );
    this.registerModalMainTypeButton = registerModalScope.getByText(
      "메인 배너",
      { exact: true },
    );
    this.registerModalSubTypeButton = registerModalScope.getByText("서브배너", {
      exact: true,
    });
    this.registerModalDeviceDesktopTab = registerModalScope.getByText(
      "데스크톱",
      { exact: true },
    );
    this.registerModalDeviceMobileTab = registerModalScope.getByText("모바일", {
      exact: true,
    });
    // 제출 버튼은 button 아닌 DIV로 렌더됨 — 트리거 버튼 "배너 등록하기"와 텍스트 다름.
    // 사이드바의 <a>배너 등록</a>이 있어 page-level에서 충돌 → portal로 body 끝에 렌더되는 모달이 last
    this.registerModalSubmitButton = page
      .getByText("배너 등록", { exact: true })
      .last();
  }

  getPageUrl(): string {
    return `${this.baseUrl}/contents/banner/list`;
  }

  getHeadingText(): string {
    return "배너설정";
  }

  /**
   * 페이지 진입 후 헤딩이 보일 때까지 대기.
   * AdminBasePage.navigate() 호출 후 사용.
   */
  async waitForReady(timeout: number = this.timeouts.long): Promise<void> {
    await this.heading.waitFor({ state: "visible", timeout });
    await this.listSectionHeading.waitFor({ state: "visible", timeout });
  }

  /** 탭 클릭 (전시중/대기중) */
  async switchTab(tab: "displayed" | "waiting"): Promise<void> {
    const target = tab === "displayed" ? this.displayedTab : this.waitingTab;
    await target.click();
    await this.page.waitForLoadState("networkidle").catch(() => {});
  }

  /** 메인배너 갯수 설정 모달 열기 */
  async openMainBannerCountModal(): Promise<void> {
    await this.mainBannerCountButton.click();
    await this.countModalHeading.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
  }

  /** 메인배너 갯수 설정 모달 닫기 (취소 버튼) */
  async closeMainBannerCountModal(): Promise<void> {
    await this.countModalCancelButton.click();
    await this.countModalHeading.waitFor({
      state: "hidden",
      timeout: this.timeouts.medium,
    });
  }

  /**
   * 메인배너 갯수를 n으로 설정한다. (모달 열기 → 값 입력 → 확인 → 모달 닫힘 대기)
   *
   * 모달 input은 React/Vue가 제어하므로 native setter + input/change 디스패치로
   * 프레임워크 상태를 강제 갱신한다. 모달 input 표시값이 항상 "1"로 보정되는
   * stage 특이동작이 있어, 변경 실효 검증은 호출 측에서 list 종류 라벨 카운트로 확인할 것.
   */
  async setMainBannerCount(n: number): Promise<void> {
    await this.openMainBannerCountModal();
    await this.countModalInput.evaluate(
      (el: HTMLInputElement, value: string) => {
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;
        nativeSetter?.call(el, value);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      },
      String(n),
    );
    await this.countModalConfirmButton.click();
    await this.countModalHeading.waitFor({
      state: "hidden",
      timeout: this.timeouts.medium,
    });
  }

  /**
   * 현재 화면에 노출된 "메인" 종류 칩 개수.
   * 전시중 탭이 활성화된 상태에서 호출해야 의미가 있다.
   */
  async countDisplayedMainTypeChips(): Promise<number> {
    return this.displayedMainTypeChips.count();
  }

  /** 배너 등록 모달 열기 */
  async openRegisterModal(): Promise<void> {
    await this.registerButton.click();
    await this.registerModalHeading.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
  }

  /** 배너 등록 모달 닫기 (X 버튼) */
  async closeRegisterModal(): Promise<void> {
    await this.registerModalCloseButton.click();
    await this.registerModalHeading.waitFor({
      state: "hidden",
      timeout: this.timeouts.medium,
    });
  }

  // ==========================================================================
  // 등록 모달 — 쓰기 동작 (negative만 지원)
  // ==========================================================================

  /**
   * 등록 모달의 "배너 등록" 버튼 클릭 (제출).
   * 유효성 실패 시 모달은 열린 상태 유지, 성공 시 닫힘.
   */
  async submitRegisterForm(): Promise<void> {
    await this.registerModalSubmitButton.click();
  }

  /**
   * 등록 모달 내 유효성 에러 메시지 노출 여부.
   * @param messageRegex 부분 매칭 정규식 (예: /대분류를 선택해주세요/)
   */
  errorMessage(messageRegex: RegExp): Locator {
    return this.page.getByText(messageRegex);
  }
}
