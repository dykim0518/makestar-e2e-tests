/**
 * POCAAlbum 신고내역 목록 페이지 객체
 *
 * URL: /pocaalbum/report/list (STG 사이드바 탐색으로 확정)
 * Read Only — 이 페이지에는 검색 UI가 없음 (목록/페이지네이션만 제공)
 */

import { Page } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export class PocaReportListPage extends AdminBasePage {
  constructor(page: Page) {
    super(page, ADMIN_TIMEOUTS);
  }

  getPageUrl(): string {
    return `${this.baseUrl}/pocaalbum/report/list`;
  }

  getHeadingText(): string {
    return "신고내역 리스트";
  }

  /** 특정 행의 신고 제목/내용 반환 */
  async getReportTitle(rowIndex: number): Promise<string> {
    return (await this.getCellText(rowIndex, 1)).trim();
  }

  /** 테이블에서 텍스트를 포함하는 행 인덱스 반환 */
  async findRowByText(text: string): Promise<number> {
    const allTexts = await this.tableRows.evaluateAll((elements) =>
      elements.map((el) => el.textContent || ""),
    );
    for (let i = 0; i < allTexts.length; i++) {
      if (allTexts[i].includes(text)) return i;
    }
    return -1;
  }
}
