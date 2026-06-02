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
   * 메인배너 갯수를 n으로 설정하고 update_main_banner_count PUT 응답을 반환한다.
   * (모달 열기 → 값 입력 → 확인 클릭과 동시에 응답 캡처 → 모달 닫힘 대기)
   *
   * 모달 input은 React/Vue가 제어하므로 native setter + input/change 디스패치로
   * 프레임워크 상태를 강제 갱신한다. 표시값은 stage에서 항상 "1"로 보정되지만
   * PUT 요청 본문에는 n이 실린다.
   *
   * stage에는 설정값을 되읽을 UI·API 수단이 없다(모달 input은 항상 "1",
   * list_displaying_banner는 배너 목록만 반환). 따라서 백엔드 반영 검증은
   * 호출 측에서 이 PUT 응답의 status/result로만 가능하다.
   *
   * @returns update_main_banner_count PUT의 HTTP status와 응답 result 플래그
   */
  async setMainBannerCount(
    n: number,
  ): Promise<{ status: number; result: boolean }> {
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
    const [response] = await Promise.all([
      this.page.waitForResponse(
        (r) =>
          /update_main_banner_count/i.test(r.url()) &&
          r.request().method() === "PUT",
        { timeout: this.timeouts.long },
      ),
      this.countModalConfirmButton.click(),
    ]);
    await this.countModalHeading.waitFor({
      state: "hidden",
      timeout: this.timeouts.medium,
    });
    let result = false;
    try {
      const body = (await response.json()) as { result?: boolean };
      result = body?.result === true;
    } catch {
      result = false;
    }
    return { status: response.status(), result };
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
  // 등록 모달 — 쓰기 동작
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

  // --- 등록 폼 입력 헬퍼 (BNR-CREATE-05) -------------------------------------

  /**
   * 대분류 multiselect의 첫 옵션 선택.
   * "대분류 검색" input을 가진 vue-multiselect wrapper 사용.
   */
  async selectFirstCategory(): Promise<void> {
    const wrapper = this.page
      .locator(".multiselect")
      .filter({ has: this.page.getByPlaceholder("대분류 검색") })
      .first();
    await wrapper.locator(".multiselect__tags").click({ force: true });
    const option = wrapper
      .locator(".multiselect__option")
      .filter({ hasNotText: /No elements found|List is empty/ })
      .first();
    await option.waitFor({ state: "visible", timeout: this.timeouts.medium });
    await option.click({ force: true });
  }

  /**
   * 이미지 3슬롯(가로형 데스크탑, 세로형 모바일, 서브)에 같은 파일 업로드.
   *
   * - 가로형/서브: hidden `input[type="file"]`에 setInputFiles 직접 주입 (정상 동작 확인)
   * - 세로형 모바일: setInputFiles만으로는 Vue 컴포넌트의 즉시 업로드 핸들러가 반응하지 않는
   *   이력이 있어 dropzone div 클릭 + filechooser 이벤트로 우회
   * - 업로드 후 input.files는 0으로 reset되고 CDN URL이 미리보기에 박히는 즉시 업로드 패턴이라
   *   각 업로드 사이 300ms 대기 (백엔드 race 회피)
   */
  async uploadBannerImages(absolutePath: string): Promise<void> {
    // 가로형(데스크탑) — input nth(0)
    await this.registerModalImageInputs.nth(0).setInputFiles(absolutePath);
    await this.page.waitForTimeout(300);

    // 세로형(모바일) — dropzone click → filechooser
    const mobileDropzone = this.page
      .getByText("세로형(모바일)", { exact: true })
      .locator("..")
      .locator('[class*="cursor-pointer"]')
      .first();
    const [chooser] = await Promise.all([
      this.page.waitForEvent("filechooser", { timeout: this.timeouts.medium }),
      mobileDropzone.click({ force: true }),
    ]);
    await chooser.setFiles(absolutePath);
    await this.page.waitForTimeout(300);

    // 서브 — input nth(2)
    await this.registerModalImageInputs.nth(2).setInputFiles(absolutePath);
    await this.page.waitForTimeout(300);
  }

  async fillBannerName(name: string): Promise<void> {
    await this.registerModalNameInput.fill(name);
  }

  /**
   * 다국어 4개 탭(한국어/영어/중국어/일본어)에 모두 같은 문구 입력.
   * 탭 전환 시 textarea가 swap되므로 매번 fill — 어느 언어가 필수인지 명세 모호하여 안전한 풀필 정책.
   */
  async fillAllLangDescriptions(text: string): Promise<void> {
    const langs: Array<"한국어" | "영어" | "중국어" | "일본어"> = [
      "한국어",
      "영어",
      "중국어",
      "일본어",
    ];
    for (const lang of langs) {
      await this.registerModalLangButtons
        .filter({ hasText: lang })
        .click({ force: true });
      const textarea = this.page.locator("textarea").first();
      await textarea.waitFor({
        state: "visible",
        timeout: this.timeouts.medium,
      });
      await textarea.fill(text);
    }
  }

  /**
   * 캘린더 다음달 버튼을 N번 클릭한 뒤 현재 달의 day 셀 선택.
   *
   * 캘린더 헤더의 좌/우 화살표는 `img.cursor-pointer.rounded-[50px]` 두 개로 렌더되며
   * nth(1)이 다음달 버튼. 셀 선택은 popup-create POM과 동일하게 `text-primary` (현재 달)만.
   */
  async pickFutureDateByCalendar(
    dateInput: Locator,
    monthsAhead: number,
    day: number,
  ): Promise<void> {
    await dateInput.click({ force: true });
    const grid = this.page.locator(".grid.grid-cols-7").first();
    await grid.waitFor({ state: "visible", timeout: this.timeouts.medium });

    const nextButton = this.page
      .locator("img.cursor-pointer.rounded-\\[50px\\]")
      .nth(1);
    for (let i = 0; i < monthsAhead; i++) {
      await nextButton.click();
      await this.page.waitForTimeout(120);
    }

    const cell = this.page
      .locator(".grid.grid-cols-7 > div.text-primary")
      .filter({ hasText: new RegExp(`^\\s*${day}\\s*$`) })
      .first();
    await cell.waitFor({ state: "visible", timeout: this.timeouts.medium });
    await cell.click({ force: true });
  }

  /**
   * 시간 multiselect의 첫 옵션(오전 00:00) 선택.
   * `.multiselect__select`는 zero-size로 not visible → `.multiselect__tags`를 force click.
   */
  async selectFirstTimeOption(which: "start" | "end"): Promise<void> {
    const placeholder = which === "start" ? "시작 시간 선택" : "종료 시간 선택";
    const wrapper = this.page
      .locator(".multiselect")
      .filter({ has: this.page.locator(`input[placeholder="${placeholder}"]`) })
      .first();
    await wrapper.locator(".multiselect__tags").click({ force: true });
    const option = wrapper
      .locator(".multiselect__option")
      .filter({ hasNotText: /No elements found|List is empty/ })
      .first();
    await option.waitFor({ state: "visible", timeout: this.timeouts.medium });
    await option.click({ force: true });
  }

  /**
   * 게시기간을 미래(monthsAhead개월 후)의 같은 일자/시간 첫 옵션으로 세팅.
   *
   * 1년 후 같은 날 + 첫 시간(오전 00:00)으로 시작·종료 모두 지정하여 운영 데이터와 격리.
   */
  async setPeriodMonthsAhead(monthsAhead: number, day: number): Promise<void> {
    await this.pickFutureDateByCalendar(
      this.registerModalStartDateInput,
      monthsAhead,
      day,
    );
    await this.selectFirstTimeOption("start");
    await this.pickFutureDateByCalendar(
      this.registerModalEndDateInput,
      monthsAhead,
      day,
    );
    await this.selectFirstTimeOption("end");
  }

  /**
   * 등록 폼 풀 채움 → 제출 → POST 응답 + 모달 닫힘 + 목록 노출 검증.
   *
   * fail-fast 정책:
   *  - 등록 mutation(POST/PUT/PATCH) 미감지 → 폼 검증 실패로 throw
   *  - 4xx/5xx 응답 → 본문 포함 throw
   *  - 모달이 닫히지 않으면 throw
   *  - 목록(전시중·대기중 어느 쪽이든)에 `bannerName` 행이 안 보이면 reload 1회 후 재검증
   */
  async submitAndExpectListEntry(bannerName: string): Promise<void> {
    const mutations: Array<{
      url: string;
      method: string;
      status: number;
      response: import("@playwright/test").Response;
    }> = [];
    const onResponse = (resp: import("@playwright/test").Response) => {
      const method = resp.request().method();
      if (method !== "POST" && method !== "PUT" && method !== "PATCH") return;
      const url = resp.url();
      if (/\.(js|css|png|jpg|jpeg|svg|woff2?)(\?|$)/i.test(url)) return;
      mutations.push({ url, method, status: resp.status(), response: resp });
    };
    this.page.on("response", onResponse);

    try {
      await this.registerModalSubmitButton.scrollIntoViewIfNeeded();
      await this.registerModalSubmitButton.click({ force: true });

      await Promise.race([
        this.registerModalHeading.waitFor({ state: "hidden", timeout: 15000 }),
        this.page.waitForResponse(
          (r) =>
            /banner/i.test(r.url()) &&
            ["POST", "PUT", "PATCH"].includes(r.request().method()),
          { timeout: 15000 },
        ),
      ]).catch(() => {
        /* 시그널 없으면 아래에서 mutations로 fail-fast */
      });
    } finally {
      this.page.off("response", onResponse);
    }

    const createResp = mutations.find((r) => /banner/i.test(r.url));
    if (createResp && createResp.status >= 400) {
      let body = "";
      try {
        body = await createResp.response.text();
      } catch {
        body = "(응답 본문 읽기 실패)";
      }
      throw new Error(
        `등록 API 실패 — ${createResp.method} ${createResp.status} ${createResp.url}\n응답: ${body.substring(0, 500)}`,
      );
    }
    if (!createResp) {
      const otherMutations = mutations
        .map((r) => `${r.method} ${r.status} ${r.url}`)
        .join("; ");
      throw new Error(
        `등록 POST/PUT/PATCH 요청이 감지되지 않음 — 폼 검증 실패로 백엔드 호출이 발생하지 않음. 다른 mutation: ${otherMutations || "(없음)"}`,
      );
    }

    await this.registerModalHeading.waitFor({
      state: "hidden",
      timeout: this.timeouts.medium,
    });

    // 목록 노출 검증 — 전시중/대기중 둘 다 살피되, 1년 후 시작이라 보통 "대기중" 탭에 들어감
    const row = this.page.getByText(bannerName, { exact: true }).first();
    const visible = await row
      .waitFor({ state: "visible", timeout: this.timeouts.medium })
      .then(() => true)
      .catch(() => false);
    if (!visible) {
      await this.switchTab("waiting");
      await this.page.waitForLoadState("domcontentloaded");
      await row.waitFor({
        state: "visible",
        timeout: this.timeouts.long,
      });
    }
  }
}
