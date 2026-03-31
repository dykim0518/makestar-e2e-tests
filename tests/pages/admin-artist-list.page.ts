/**
 * 아티스트 목록 페이지 객체
 *
 * 대상: 아티스트 > 아티스트 (/artist/list)
 *
 * 페이지 특징:
 * - 브레드크럼 없음
 * - 조회하기/검색 초기화 버튼 없음 (텍스트박스 + SVG 아이콘 검색)
 * - 노출여부 필터 드롭다운
 * - 테이블 헤더: No, 아티스트, 멤버수, 검색어, 타입, 소속사, 노출여부
 */

import { Page, Locator, expect } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

/** 테이블 헤더 목록 */
export const ARTIST_TABLE_HEADERS = [
  "No",
  "아티스트",
  "멤버수",
  "검색어",
  "타입",
  "소속사",
  "노출여부",
] as const;

/** 테이블 컬럼 인덱스 */
export const ARTIST_COL = {
  no: 0,
  artist: 1,
  memberCount: 2,
  keyword: 3,
  type: 4,
  agency: 5,
  exposure: 6,
} as const;

/** 행 데이터 구조 */
export type ArtistRowData = {
  no: string;
  artist: string;
  memberCount: string;
  keyword: string;
  type: string;
  agency: string;
  exposure: string;
};

export class ArtistListPage extends AdminBasePage {
  /** 검색 입력 필드 */
  readonly searchInput: Locator;
  /** 아티스트 등록 버튼 */
  readonly registerButton: Locator;
  /** 노출여부 필터 드롭다운 */
  readonly exposureFilter: Locator;
  /** 목록 건수 표시 텍스트 */
  readonly listCountText: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    this.searchInput = page.getByPlaceholder("아티스트 키워드를 입력해주세요");
    this.registerButton = page.getByRole("button", { name: "아티스트 등록" });
    this.exposureFilter = page.getByText("전체(노출여부)");
    this.listCountText = page.getByText(/아티스트 목록/);
  }

  getPageUrl(): string {
    return `${this.baseUrl}/artist/list`;
  }

  getHeadingText(): string {
    return "아티스트관리";
  }

  getBreadcrumbPath(): string[] {
    return ["아티스트", "아티스트"];
  }

  // --------------------------------------------------------------------------
  // 검색
  // NOTE: 검색 아이콘이 React synthetic event로만 동작하여
  // Playwright 자동화 클릭이 불안정합니다.
  // 향후 data-testid 추가 시 searchByKeyword/clearSearch 구현 예정.
  // --------------------------------------------------------------------------

  // waitForTableOrNoResult()는 AdminBasePage에서 상속

  // --------------------------------------------------------------------------
  // 목록 정보
  // --------------------------------------------------------------------------

  /**
   * 목록 총 건수 텍스트 반환 (예: "아티스트 목록 • 1965")
   */
  async getListCountText(): Promise<string> {
    return (await this.listCountText.textContent()) || "";
  }

  /**
   * 목록 총 건수 숫자만 추출
   */
  async getListCount(): Promise<number> {
    const text = await this.getListCountText();
    const match = text.match(/[\d,]+/);
    return match ? parseInt(match[0].replace(/,/g, ""), 10) : 0;
  }

  // --------------------------------------------------------------------------
  // 행 데이터 추출
  // --------------------------------------------------------------------------

  /**
   * 특정 행의 구조화된 데이터 반환
   */
  async getRowData(rowIndex: number): Promise<ArtistRowData> {
    const row = this.tableRows.nth(rowIndex);
    const cells = row.locator("td");

    return {
      no: ((await cells.nth(ARTIST_COL.no).textContent()) || "").trim(),
      artist: ((await cells.nth(ARTIST_COL.artist).textContent()) || "").trim(),
      memberCount: (
        (await cells.nth(ARTIST_COL.memberCount).textContent()) || ""
      ).trim(),
      keyword: (
        (await cells.nth(ARTIST_COL.keyword).textContent()) || ""
      ).trim(),
      type: ((await cells.nth(ARTIST_COL.type).textContent()) || "").trim(),
      agency: ((await cells.nth(ARTIST_COL.agency).textContent()) || "").trim(),
      exposure: (
        (await cells.nth(ARTIST_COL.exposure).textContent()) || ""
      ).trim(),
    };
  }

  /**
   * 여러 행의 데이터를 샘플링하여 반환
   */
  async getSampleRows(sampleLimit: number = 10): Promise<ArtistRowData[]> {
    const rowCount = await this.getRowCount();
    const limit = Math.min(rowCount, sampleLimit);
    const rows: ArtistRowData[] = [];

    for (let i = 0; i < limit; i++) {
      rows.push(await this.getRowData(i));
    }

    return rows;
  }

  /**
   * No 컬럼 값 배열 반환
   */
  async getNoColumnValues(sampleLimit: number = 10): Promise<number[]> {
    const rows = await this.getSampleRows(sampleLimit);
    return rows.map((r) => parseInt(r.no, 10)).filter((n) => !isNaN(n));
  }

  /**
   * 타입 컬럼에서 고유값 추출
   */
  async getUniqueTypeValues(sampleLimit: number = 10): Promise<string[]> {
    const rows = await this.getSampleRows(sampleLimit);
    const types = new Set(rows.map((r) => r.type).filter((t) => t.length > 0));
    return [...types];
  }

  // isMeaningfulValue()는 AdminBasePage에서 상속

  /**
   * 멤버수 형식 검증 (예: "0명", "5명")
   */
  isValidMemberCountFormat(value: string): boolean {
    return /^\d+명$/.test(value.trim());
  }

  // --------------------------------------------------------------------------
  // 노출여부 필터
  // --------------------------------------------------------------------------

  /**
   * 노출여부 필터 드롭다운의 옵션 목록 추출
   */
  async getExposureFilterOptions(): Promise<string[]> {
    // 드롭다운 클릭하여 옵션 표시
    await this.exposureFilter.click();

    // listbox 또는 option 역할의 요소들에서 텍스트 추출
    const options = await this.page.evaluate(() => {
      const items = document.querySelectorAll(
        '[role="option"], [role="listbox"] li, .ant-select-item-option-content',
      );
      if (items.length > 0) {
        return Array.from(items).map(
          (el) => (el as HTMLElement).textContent?.trim() || "",
        );
      }
      // fallback: 드롭다운 근처의 모든 선택 가능 항목 탐색
      const dropdownItems = document.querySelectorAll(
        '[class*="dropdown"] [class*="item"], [class*="menu"] [class*="item"]',
      );
      return Array.from(dropdownItems).map(
        (el) => (el as HTMLElement).textContent?.trim() || "",
      );
    });

    // ESC로 드롭다운 닫기
    await this.page.keyboard.press("Escape");

    return options.filter((o) => o.length > 0);
  }

  /**
   * 노출여부 필터에서 특정 옵션 선택
   */
  async selectExposureFilter(optionText: string): Promise<void> {
    const prevCount = await this.getListCountText();

    await this.exposureFilter.click();

    // 옵션 텍스트로 클릭
    const option = this.page.getByText(optionText, { exact: true });
    await option.click({ timeout: this.timeouts.medium }).catch(async () => {
      // fallback: role=option으로 시도
      await this.page
        .getByRole("option", { name: optionText })
        .click({ timeout: this.timeouts.medium });
    });

    // 목록이 갱신될 때까지 대기
    await this.page
      .waitForFunction(
        (prev) => {
          const texts = Array.from(document.querySelectorAll("p")).map(
            (p) => p.textContent || "",
          );
          const countText = texts.find((t) => t.includes("아티스트 목록"));
          return countText && countText !== prev;
        },
        prevCount,
        { timeout: this.timeouts.navigation },
      )
      .catch(() => {});

    await this.page.waitForLoadState("domcontentloaded");
  }

  // --------------------------------------------------------------------------
  // 테이블 데이터 접근
  // --------------------------------------------------------------------------

  /**
   * 첫 번째 행 클릭으로 상세 페이지 이동
   */
  async clickFirstRowToDetail(): Promise<void> {
    const firstRow = this.getFirstRow();
    await firstRow.click();
    await this.waitForLoadState("domcontentloaded");
  }
}
