/**
 * POCAAlbum 앨범 목록 페이지 객체
 *
 * URL: /pocaalbum/album/list
 * 테이블 헤더(2026-04 변경): (체크박스) | 번호 | 타입 | 제목 | 아티스트 | 발매일 | 버전 | 발행 | 복제
 * - 구 "수정" 컬럼 제거됨 → 앨범 수정은 "제목" 셀 클릭으로 진입
 * - 구 "복사" → "복제" 아이콘 버튼으로 변경
 */

import { Page, Locator } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

// ============================================================================
// PocaAlbumListPage 클래스
// ============================================================================

export class PocaAlbumListPage extends AdminBasePage {
  // --------------------------------------------------------------------------
  // 로케이터 정의
  // --------------------------------------------------------------------------

  readonly searchInput: Locator;
  readonly classificationDropdown: Locator;

  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);

    this.searchInput = page.locator('input[placeholder*="검색"]').first();
    this.classificationDropdown = page
      .locator('select, [role="combobox"]')
      .first();
  }

  // --------------------------------------------------------------------------
  // 추상 메서드 구현
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/pocaalbum/album/list`;
  }

  getHeadingText(): string {
    return "앨범";
  }

  // --------------------------------------------------------------------------
  // 검색 메서드
  // --------------------------------------------------------------------------

  /** 키워드로 앨범 검색 */
  async searchByKeyword(keyword: string): Promise<void> {
    await this.searchInput.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
    await this.searchInput.fill(keyword);
    await this.clickSearchAndWait();
  }

  /**
   * 특정 행의 제목 컬럼 텍스트 반환
   * 헤더 순서: (체크박스:0) | 번호:1 | 타입:2 | 제목:3 | 아티스트:4 | 발매일:5 | 버전:6 | 발행:7 | 복제:8
   */
  async getAlbumTitle(rowIndex: number): Promise<string> {
    return (await this.getCellText(rowIndex, 3)).trim();
  }

  /**
   * 앨범 수정 페이지 진입 — 제목 셀 클릭
   * 목록 UI에서 제목 클릭이 수정 진입 경로 (2026-04 UI 개편 이후 "수정" 버튼 제거됨).
   * 이동 URL 패턴: /pocaalbum/album/{id}
   */
  async openAlbumDetail(rowIndex: number): Promise<void> {
    const row = this.tableRows.nth(rowIndex);
    const titleCell = row.locator("td").nth(3);
    const clickable = titleCell.locator('[class*="cursor-pointer"]').first();
    await clickable.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
    await clickable.click();
    await this.page.waitForURL(/\/pocaalbum\/album\/\d+(?:[/?#]|$)/, {
      timeout: this.timeouts.navigation,
    });
  }

  /**
   * 앨범 발행 페이지 진입 — 행 내 "발행" 버튼 클릭
   * 이동 URL 패턴: /pocaalbum/album/publish/create?album_id={id}
   */
  async clickPublishButton(rowIndex: number): Promise<void> {
    const row = this.tableRows.nth(rowIndex);
    const publishBtn = row.getByRole("button", { name: "발행", exact: true });
    await publishBtn.waitFor({
      state: "visible",
      timeout: this.timeouts.medium,
    });
    await publishBtn.click();
    await this.page.waitForURL(/\/pocaalbum\/album\/publish\/create/, {
      timeout: this.timeouts.navigation,
    });
  }

  /** 테이블에서 텍스트를 포함하는 행 인덱스 반환 (-1: 없음) */
  async findRowByText(text: string): Promise<number> {
    const allTexts = await this.tableRows.evaluateAll((elements) =>
      elements.map((el) => el.textContent || ""),
    );
    for (let i = 0; i < allTexts.length; i++) {
      if (allTexts[i].includes(text)) return i;
    }
    return -1;
  }

  /** 테이블 헤더 목록 반환 (체크박스 컬럼 포함, 2026-04 UI 기준) */
  getExpectedHeaders(): string[] {
    return [
      "",
      "번호",
      "타입",
      "제목",
      "아티스트",
      "발매일",
      "버전",
      "발행",
      "복제",
    ];
  }
}
