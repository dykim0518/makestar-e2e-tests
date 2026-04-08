/**
 * Admin 페이지 초기화 + 인증 복구 제네릭 헬퍼
 *
 * 로그인 리다이렉트 감지 시 쿠키 재주입 후 자동 재시도합니다.
 * Order, User 등 Admin 목록 페이지 공통 초기화에 사용합니다.
 */

import type { Page } from "@playwright/test";
import type { AdminBasePage } from "../../pages/admin-base.page";
import { setupAuthCookies, resetAuthCache } from "./auth-helper";
import { waitForPageStable } from "./test-helpers";

const LOGIN_REDIRECT_PATTERN = /\/login|\/auth|stage-auth/i;

type AdminPageConstructor<T extends AdminBasePage> = new (page: Page) => T;

/**
 * Admin 목록 페이지를 초기화합니다.
 * 로그인 리다이렉트 발생 시 쿠키 재주입 후 재시도합니다.
 *
 * @param PageClass - AdminBasePage를 상속한 POM 클래스
 * @param seedPage - Playwright Page 인스턴스
 * @param pageName - 에러 메시지에 표시할 페이지 이름 (예: "주문관리")
 */
export async function initPageWithRecovery<T extends AdminBasePage>(
  PageClass: AdminPageConstructor<T>,
  seedPage: Page,
  pageName: string,
): Promise<T> {
  if (seedPage.isClosed()) {
    throw new Error(
      `Playwright page가 닫혀 ${pageName} 페이지를 초기화할 수 없습니다.`,
    );
  }

  await setupAuthCookies(seedPage);

  const pageInstance = new PageClass(seedPage);
  await pageInstance.navigate();

  const currentUrl = pageInstance.currentUrl;
  if (LOGIN_REDIRECT_PATTERN.test(currentUrl)) {
    resetAuthCache();
    await setupAuthCookies(seedPage);
    await pageInstance.navigate();
  }

  await waitForPageStable(seedPage);

  await pageInstance.waitForTableOrNoResult(15000).catch(async () => {
    const hasNoResult = await pageInstance.noResultMessage
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    const hasTable = await pageInstance.table
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!hasNoResult && !hasTable) {
      throw new Error(`${pageName} 목록 영역이 로드되지 않았습니다.`);
    }
  });

  return pageInstance;
}
