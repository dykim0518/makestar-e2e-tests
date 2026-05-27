/**
 * AdminNotificationNoticeUpdatePage - 공지 수정 페이지
 *
 * URL: /notification/notice/update/:id
 *
 * 페이지 구조 (create 페이지와 동일):
 * 1. 타입선택 (필수): 공지 / B2C 공지 / B2B 공지 / 이벤트
 * 2. 프로젝트 선택 (이벤트 카테고리에서만 노출)
 * 3. 제목 (한국어/영어/중국어/일본어)
 * 4. 중요 공지로 표시 (체크박스)
 * 5. 예약발송 시간 (옵션)
 * 6. 알림 본문 (다국어 탭 + ProseMirror)
 * 7. 우측 미리보기 패널
 *
 * 사양: read-only 페이지 — 저장/취소/수정 버튼 없음 (목록에서 삭제만 제공).
 *       데이터 로드 / 필드 노출 검증 중심으로 사용.
 */

import { Page, Locator } from "@playwright/test";
import { AdminBasePage } from "./admin-base.page";
import type {
  NoticeCategory,
  NoticeLanguage,
} from "./admin-notification-notice-create.page";

const TITLE_PLACEHOLDER: Record<NoticeLanguage, string> = {
  한국어: "한글로 입력해주세요",
  영어: "영어로 입력해주세요",
  중국어: "중국어로 입력해주세요",
  일본어: "일본어로 입력해주세요",
};

export class AdminNotificationNoticeUpdatePage extends AdminBasePage {
  /** 페이지 헤딩 ("공지관리") */
  readonly pageHeading: Locator;
  /** 폼 섹션 헤딩 ("알림 수정") */
  readonly sectionHeading: Locator;
  /** 본문 에디터 (활성 언어 탭) */
  readonly contentEditor: Locator;
  /** 중요 공지 체크박스 */
  readonly importantCheckbox: Locator;
  /** 우측 미리보기 패널 헤딩 */
  readonly previewHeading: Locator;

  constructor(page: Page) {
    super(page);
    this.pageHeading = page.getByRole("heading", {
      name: "공지관리",
      exact: true,
    });
    this.sectionHeading = page.getByText("알림 수정", { exact: true }).first();
    this.contentEditor = page.locator(".ProseMirror").first();
    this.importantCheckbox = page.locator('input[type="checkbox"]').first();
    this.previewHeading = page
      .getByText("공지 미리보기", { exact: true })
      .first();
  }

  getPageUrl(): string {
    // ID는 동적으로 지정되므로 base URL만 반환
    return `${this.baseUrl}/notification/notice/update`;
  }

  getHeadingText(): string {
    return "공지관리";
  }

  /** 카테고리 버튼 locator */
  categoryButton(name: NoticeCategory): Locator {
    return this.page.getByRole("button", { name, exact: true });
  }

  /** 카테고리 활성 여부 (비활성 버튼은 class에 'bg-transparent' 포함) */
  async isCategoryActive(name: NoticeCategory): Promise<boolean> {
    const cls = (await this.categoryButton(name).getAttribute("class")) || "";
    return !/bg-transparent/.test(cls);
  }

  /** 활성 카테고리 반환 (1개만 활성이어야 함) */
  async getActiveCategory(): Promise<NoticeCategory | null> {
    const all: NoticeCategory[] = ["공지", "B2C 공지", "B2B 공지", "이벤트"];
    for (const c of all) {
      if (await this.isCategoryActive(c)) return c;
    }
    return null;
  }

  /** 특정 언어 제목 input */
  titleInput(lang: NoticeLanguage): Locator {
    return this.page.getByPlaceholder(TITLE_PLACEHOLDER[lang]);
  }

  /** 특정 언어 제목 input의 현재 값 */
  async getTitleValue(lang: NoticeLanguage): Promise<string> {
    return await this.titleInput(lang).inputValue();
  }

  /** URL에서 공지 ID 추출 (path의 마지막 segment) */
  getNoticeIdFromUrl(): string | null {
    const m = this.page.url().match(/\/notification\/notice\/update\/(\d+)/);
    return m ? m[1] : null;
  }

  /**
   * update 페이지 로드 완료 대기
   * - URL이 /update/{id} 패턴
   * - 한국어 제목 input이 visible
   */
  async waitForLoaded(timeout = 15000): Promise<void> {
    await this.page.waitForURL(/\/notification\/notice\/update\/\d+/, {
      timeout,
    });
    await this.titleInput("한국어").waitFor({ state: "visible", timeout });
  }
}
