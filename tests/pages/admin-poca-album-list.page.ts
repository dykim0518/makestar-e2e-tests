/**
 * POCAAlbum 앨범 목록 페이지 객체
 *
 * URL: /pocaalbum/album/list
 * 테이블 헤더: 번호 | 분류 | 제목 | 아티스트 | 카테고리 | 발매일 | 수량 | 수정 | 복사
 */

import { Page, Locator } from '@playwright/test';
import { AdminBasePage, ADMIN_TIMEOUTS } from './admin-base.page';

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
    this.classificationDropdown = page.locator('select, [role="combobox"]').first();
  }

  // --------------------------------------------------------------------------
  // 추상 메서드 구현
  // --------------------------------------------------------------------------

  getPageUrl(): string {
    return `${this.baseUrl}/pocaalbum/album/list`;
  }

  getHeadingText(): string {
    return '앨범';
  }

  // --------------------------------------------------------------------------
  // 검색 메서드
  // --------------------------------------------------------------------------

  /** 키워드로 앨범 검색 */
  async searchByKeyword(keyword: string): Promise<void> {
    await this.searchInput.waitFor({ state: 'visible', timeout: this.timeouts.medium });
    await this.searchInput.fill(keyword);
    await this.clickSearchAndWait();
  }

  /** 특정 행의 제목 컬럼 텍스트 반환 (2번째 컬럼: index 2) */
  async getAlbumTitle(rowIndex: number): Promise<string> {
    return (await this.getCellText(rowIndex, 2)).trim();
  }

  /** 수정 버튼 클릭 → URL 변경 대기 */
  async clickEdit(rowIndex: number): Promise<void> {
    const row = this.tableRows.nth(rowIndex);
    const editBtn = row.locator('button:has-text("수정"), a:has-text("수정"), td >> nth=-2 >> button').first();
    const currentUrl = this.page.url();
    await editBtn.click();
    // 수정 클릭 시 /pocaalbum/album/{id} 또는 /pocaalbum/album/publish/create?album_id={id} 패턴
    await this.page.waitForURL(url => url.toString() !== currentUrl && url.toString().includes('/pocaalbum/album'), {
      timeout: this.timeouts.navigation,
    });
  }

  /** 테이블에서 텍스트를 포함하는 행 인덱스 반환 (-1: 없음) */
  async findRowByText(text: string): Promise<number> {
    const allTexts = await this.tableRows.evaluateAll(
      (elements) => elements.map(el => el.textContent || '')
    );
    for (let i = 0; i < allTexts.length; i++) {
      if (allTexts[i].includes(text)) return i;
    }
    return -1;
  }

  /** 테이블 헤더 목록 반환 */
  getExpectedHeaders(): string[] {
    return ['번호', '분류', '제목', '아티스트', '카테고리', '발매일', '수량', '수정', '복사'];
  }
}
