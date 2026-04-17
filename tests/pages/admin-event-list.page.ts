/**
 * 상품(이벤트) 목록 페이지 객체
 */

import { Page, Locator } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

// ============================================================================
// 이벤트 검색 조건 타입
// ============================================================================

export type EventSearchOptions = {
  name?: string;
  productCode?: string;
  albumCode?: string;
  id?: string;
  manager?: string;
  type?: "event" | "product" | "funding";
  channel?: "b2c" | "b2b";
};

// ============================================================================
// 이벤트 목록 페이지 클래스
// ============================================================================

export class EventListPage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 로케이터 정의
  // --------------------------------------------------------------------------

  // 검색 필드
  readonly nameInput: Locator;
  readonly productCodeInput: Locator;
  readonly albumCodeInput: Locator;
  readonly idInput: Locator;
  readonly managerInput: Locator;

  // 타입 필터
  readonly eventTypeFilter: Locator;
  readonly productTypeFilter: Locator;
  readonly fundingTypeFilter: Locator;

  // 채널 필터
  readonly b2cFilter: Locator;
  readonly b2bFilter: Locator;

  // 추가 검색 옵션
  readonly simpleSearchButton: Locator;

  // 액션 버튼
  readonly createProductButton: Locator;
  readonly excelDownloadButton: Locator;
  readonly shipmentExcelButton: Locator;

  // 행 액션 버튼
  readonly privateLinkButton: Locator;
  readonly previewButton: Locator;
  readonly newWindowButton: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    // 이름 검색 입력: 상세 검색 UI와 간단 검색 UI를 모두 지원
    this.nameInput = page.locator(
      'input[placeholder="이벤트 이름을 입력해주세요"], input[placeholder="검색하기"], input[placeholder="검색어를 입력해주세요"]',
    );

    // 레거시/호환성 담당자 필터
    this.managerInput = page.getByRole("textbox", {
      name: "담당자의 이름 또는 이메일을 정확히 입력해주세요",
    });

    // 레거시/호환성 검색 필드 (필터 기반)
    this.productCodeInput = page.locator(
      'input[placeholder="상품 코드를 입력해주세요"]',
    );
    this.albumCodeInput = page.locator(
      'input[placeholder="앨범 코드를 입력해주세요"]',
    );
    this.idInput = page.locator('input[placeholder="ID를 입력해주세요"]');

    // 타입 필터 초기화 (새 UI: 구분 섹션)
    this.eventTypeFilter = page.getByText("이벤트", { exact: true }).first();
    this.productTypeFilter = page.getByText("상품", { exact: true }).first();
    this.fundingTypeFilter = page.getByText("펀딩", { exact: true }).first();

    // 채널 필터 초기화 (새 UI: 전시옵션 섹션)
    this.b2cFilter = page.getByText("B2C", { exact: true }).first();
    this.b2bFilter = page.getByText("B2B", { exact: true }).first();

    // 추가 검색 옵션
    this.simpleSearchButton = page.locator('button:has-text("간단하게 검색")');

    // 액션 버튼 초기화 (새 UI에서는 "등록하기" 버튼)
    this.createProductButton = page.locator(
      'button:has-text("등록하기"), button:has-text("상품 등록")',
    );
    this.excelDownloadButton = page.getByRole("button", {
      name: "엑셀다운받기",
      exact: true,
    });
    this.shipmentExcelButton = page.getByRole("button", {
      name: "출고엑셀다운받기",
    });

    // 행 액션 버튼 초기화
    this.privateLinkButton = page.locator('button:has-text("비공개링크")');
    this.previewButton = page.locator('button:has-text("미리보기")');
    this.newWindowButton = page.locator('button:has-text("새창보기")');
  }

  // --------------------------------------------------------------------------
  // 페이지 정보 (추상 메서드 구현)
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/event/list`;
  }

  getHeadingText(): string {
    return "상품 조회/수정";
  }

  // --------------------------------------------------------------------------
  // 검색 메서드
  // --------------------------------------------------------------------------

  /**
   * 상품명으로 검색
   */
  async searchByName(name: string): Promise<void> {
    await this.page.waitForLoadState("domcontentloaded");
    await this.nameInput.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
    await this.typeInputLikeUser(this.nameInput, name);
    await this.clickSearchButton();
  }

  /**
   * 담당자로 검색 (새 UI: 유일한 텍스트 입력 필드)
   */
  async searchByManager(manager: string): Promise<void> {
    await this.page.waitForLoadState("domcontentloaded");
    if (
      await this.managerInput.isVisible({ timeout: 1000 }).catch(() => false)
    ) {
      await this.typeInputLikeUser(this.managerInput, manager);
    } else {
      await this.typeInputLikeUser(this.nameInput, manager);
    }
    await this.clickSearchButton();
  }

  /**
   * ID로 검색
   * @param id 상품 ID
   */
  async searchById(id: string): Promise<void> {
    if (await this.idInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await this.typeInputLikeUser(this.idInput, id);
    } else {
      await this.typeInputLikeUser(this.nameInput, id);
    }
    await this.clickSearchButton();
  }

  /**
   * 테이블에서 텍스트 포함 행 찾기 (페이지네이션 포함)
   * @param text 찾을 텍스트
   * @param maxPages 최대 탐색 페이지 수
   * @returns 찾은 행 Locator 또는 null
   */
  async findRowByText(
    text: string,
    maxPages: number = 3,
  ): Promise<Locator | null> {
    for (let pageIndex = 1; pageIndex <= maxPages; pageIndex += 1) {
      const row = this.tableRows.filter({ hasText: text }).first();
      if ((await row.count()) > 0) {
        return row;
      }

      const moved = await this.goToNextPage();
      if (!moved) {
        break;
      }
    }

    return null;
  }

  /**
   * 조회하기 버튼 클릭
   */
  async clickSearchButton(): Promise<void> {
    if (
      await this.searchButton.isVisible({ timeout: 1000 }).catch(() => false)
    ) {
      await this.clickWithRecovery(this.searchButton, {
        timeout: this.timeouts.medium,
      });
    } else {
      await this.nameInput.press("Enter").catch(() => {});
    }
    await this.waitForSearchComplete();
  }

  /**
   * 검색 완료 대기 (스켈레톤 로딩 → 결과/빈 상태 정착)
   *
   * 새 UI는 검색 실행 중 조회 버튼이 disabled 되고 테이블 셀이 스켈레톤으로
   * 채워진다. disabled 토글이 풀리고 네트워크가 안정될 때까지 기다린다.
   */
  async waitForSearchComplete(timeout: number = 10000): Promise<void> {
    // 1) 검색 버튼 disabled 상태가 한번 뜬 뒤 다시 enabled 로 복귀할 때까지 대기
    await this.page
      .waitForFunction(
        () => {
          const btn = document.querySelector<HTMLButtonElement>(
            ".input__right__icons button, button.input__right__icons",
          );
          if (!btn) return true;
          return !btn.disabled;
        },
        undefined,
        { timeout },
      )
      .catch(() => {});

    // 2) 네트워크 안정화
    await this.page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => {});

    // 3) 테이블 또는 "검색결과 없음" 중 하나가 안착할 때까지 대기
    await this.waitForTableOrNoResult(timeout).catch(() => {});

    // 4) 첫 행의 td 텍스트가 실제로 채워질 때까지 대기 (스켈레톤 상태에서 즉시 읽히는 flaky 방지)
    await this.page
      .waitForFunction(
        () => {
          // noResult 메시지가 보이면 통과
          const noResult = Array.from(document.querySelectorAll("*")).some(
            (el) => (el.textContent ?? "").includes("검색결과가 없습니다"),
          );
          if (noResult) return true;

          const rows = document.querySelectorAll("table tbody tr");
          if (rows.length === 0) return false;

          const firstRowTds = rows[0].querySelectorAll("td");
          if (firstRowTds.length === 0) return false;

          // 이름 컬럼(index 6) 또는 최소한 어느 데이터 셀에 텍스트가 있어야 함
          return Array.from(firstRowTds).some(
            (td) => (td.textContent ?? "").trim().length > 0,
          );
        },
        undefined,
        { timeout },
      )
      .catch(() => {});
  }

  /**
   * 타입 필터 적용
   */
  async filterByType(type: "event" | "product" | "funding"): Promise<void> {
    switch (type) {
      case "event":
        await this.eventTypeFilter.click();
        break;
      case "product":
        await this.productTypeFilter.click();
        break;
      case "funding":
        await this.fundingTypeFilter.click();
        break;
    }
    await this.clickSearchAndWait();
  }

  /**
   * 채널 필터 적용
   */
  async filterByChannel(channel: "b2c" | "b2b"): Promise<void> {
    switch (channel) {
      case "b2c":
        await this.b2cFilter.click();
        break;
      case "b2b":
        await this.b2bFilter.click();
        break;
    }
    await this.clickSearchAndWait();
  }

  /**
   * 복합 검색 조건으로 검색
   */
  async searchWithOptions(options: EventSearchOptions): Promise<void> {
    if (options.name) {
      await this.typeInputLikeUser(this.nameInput, options.name);
    }
    if (options.productCode) {
      await this.typeInputLikeUser(this.productCodeInput, options.productCode);
    }
    if (options.albumCode) {
      await this.typeInputLikeUser(this.albumCodeInput, options.albumCode);
    }
    if (options.id) {
      await this.typeInputLikeUser(this.idInput, options.id);
    }
    if (options.manager) {
      await this.typeInputLikeUser(this.managerInput, options.manager);
    }
    if (options.type) {
      await this.filterByType(options.type);
      return; // filterByType 내에서 검색 실행
    }
    if (options.channel) {
      await this.filterByChannel(options.channel);
      return; // filterByChannel 내에서 검색 실행
    }

    await this.clickSearchButton();
  }

  /**
   * 간단하게 검색 모드 전환
   */
  async toggleSimpleSearch(): Promise<void> {
    await this.clickWithRecovery(this.simpleSearchButton, {
      timeout: this.timeouts.medium,
    });
    await this.settleInteractiveUi({ timeout: this.timeouts.short });
  }

  // --------------------------------------------------------------------------
  // 액션 메서드
  // --------------------------------------------------------------------------

  /**
   * 상품 등록 페이지로 이동
   */
  async goToCreateProduct(): Promise<void> {
    await this.createProductButton.click();
    await this.waitForLoadState("domcontentloaded");
  }

  /**
   * 엑셀 다운로드
   */
  async downloadExcel(): Promise<void> {
    await this.clickWithRecovery(this.excelDownloadButton, {
      timeout: this.timeouts.medium,
    });
    await this.settleInteractiveUi({ timeout: this.timeouts.short });
  }

  /**
   * 출고 엑셀 다운로드
   */
  async downloadShipmentExcel(): Promise<void> {
    await this.clickWithRecovery(this.shipmentExcelButton, {
      timeout: this.timeouts.medium,
    });
    await this.settleInteractiveUi({ timeout: this.timeouts.short });
  }

  // --------------------------------------------------------------------------
  // 행 액션 메서드
  // --------------------------------------------------------------------------

  /**
   * 특정 행의 비공개 링크 버튼 클릭
   */
  async clickPrivateLink(rowIndex: number): Promise<void> {
    const row = this.tableRows.nth(rowIndex);
    await this.clickWithRecovery(row.locator('button:has-text("비공개링크")'), {
      timeout: this.timeouts.medium,
    });
    await this.settleInteractiveUi({ timeout: this.timeouts.short });
  }

  /**
   * 특정 행의 미리보기 버튼 클릭
   */
  async clickPreview(rowIndex: number): Promise<void> {
    const row = this.tableRows.nth(rowIndex);
    await this.clickWithRecovery(row.locator('button:has-text("미리보기")'), {
      timeout: this.timeouts.medium,
    });
    await this.settleInteractiveUi({ timeout: this.timeouts.short });
  }

  /**
   * 특정 행의 새창보기 버튼 클릭
   */
  async clickNewWindow(rowIndex: number): Promise<void> {
    const row = this.tableRows.nth(rowIndex);
    await this.clickWithRecovery(row.locator('button:has-text("새창보기")'), {
      timeout: this.timeouts.medium,
    });
    await this.settleInteractiveUi({ timeout: this.timeouts.short });
  }

  // --------------------------------------------------------------------------
  // 테이블 헬퍼
  // --------------------------------------------------------------------------

  /**
   * 브레드크럼 예상 경로
   */
  getBreadcrumbPath(): string[] {
    return ["상품관리", "상품 조회/수정"];
  }
}
