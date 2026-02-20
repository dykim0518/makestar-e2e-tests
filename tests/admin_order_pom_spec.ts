/**
 * Admin 주문관리 메뉴 테스트 (Page Object Model 적용)
 *
 * 대상:
 * - 주문/배송 > 주문관리
 * - URL: /order/list
 *
 * 검증 범위:
 * - 전체/B2C주문/B2B주문/프로젝트별 주문 탭 동작
 * - 주문상태/결제상태/배송상태/재고할당 조합 검색 결과 정합성
 * - 검색 초기화 및 무효 키워드 검색
 */

import { test, expect, type Page } from '@playwright/test';
import { OrderListPage } from './pages';
import { setupAuthCookies, resetAuthCache } from './helpers/admin';
import {
  isAuthFailed,
  isTokenValidSync,
  getTokenRemaining,
  waitForPageStable,
  ELEMENT_TIMEOUT,
} from './helpers/admin/test-helpers';

// ============================================================================
// 테스트 설정
// ============================================================================
const tokenValid = isTokenValidSync();

if (!tokenValid) {
  test('토큰 유효성 검증', () => {
    expect(
      tokenValid,
      '⚠️ 토큰이 만료되었습니다! 전체 테스트 실행: npx playwright test --project=admin-setup --project=admin-pc'
    ).toBe(true);
  });
}

test.beforeAll(async () => {
  resetAuthCache();
  if (tokenValid) {
    const { hours, minutes } = getTokenRemaining();
    console.log(`\n✅ Admin 주문관리 테스트 시작 (토큰 유효, 남은 시간: ${hours}시간 ${minutes}분)`);
  }
});

test.beforeEach(async ({ page, viewport }) => {
  expect(
    viewport === null || viewport.width >= 1024,
    '이 테스트는 데스크톱 뷰포트에서만 실행됩니다'
  ).toBeTruthy();

  const authStatus = isAuthFailed();
  expect(authStatus.failed, `인증 실패: ${authStatus.reason}`).toBe(false);

  await setupAuthCookies(page);
});

/**
 * 주문관리 페이지 초기화 (인증/네비게이션 복구 포함)
 *
 * - 로그인 리다이렉트 발생 시 쿠키 재주입 후 재시도
 * - 페이지가 닫힌 경우 새 페이지를 열어 복구
 */
async function initOrderPageWithRecovery(seedPage: Page): Promise<OrderListPage> {
  const maxAttempts = 4;
  let activePage: Page = seedPage;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      if (activePage.isClosed()) {
        activePage = await seedPage.context().newPage();
      }

      await setupAuthCookies(activePage);

      const orderPage = new OrderListPage(activePage);
      await orderPage.navigate();

      const currentUrl = orderPage.currentUrl;
      const redirectedToLogin = /\/login|\/auth|stage-auth/i.test(currentUrl);
      if (redirectedToLogin) {
        resetAuthCache();
        await setupAuthCookies(activePage);
        await orderPage.navigate();
      }

      await waitForPageStable(activePage);
      await orderPage.waitForTableOrNoResult();
      return orderPage;
    } catch (error: any) {
      const message = error?.message ?? String(error);
      console.warn(`⚠️ 주문관리 초기화 실패 (${attempt}/${maxAttempts}): ${message}`);

      if (attempt === maxAttempts) {
        throw error;
      }

      if (!activePage.isClosed()) {
        await activePage.close().catch(() => {});
      }
      activePage = await seedPage.context().newPage();
    }
  }

  throw new Error('주문관리 페이지 초기화에 실패했습니다.');
}

// ##############################################################################
// 주문관리 목록
// ##############################################################################
test.describe.serial('주문관리 목록', () => {
  let orderPage: OrderListPage;

  test.beforeEach(async ({ page }) => {
    orderPage = await initOrderPageWithRecovery(page);
  });

  test('ORD-PAGE-01: 페이지 기본 요소 및 탭 노출 검증', async () => {
    await orderPage.assertPageTitle();
    await orderPage.assertHeading();
    await expect(orderPage.breadcrumb).toBeVisible({ timeout: ELEMENT_TIMEOUT });
    await orderPage.assertTabsVisible();
  });

  test('ORD-TAB-01: 전체/B2C/B2B/프로젝트별 주문 탭 전환 검증', async () => {
    await orderPage.switchTab('all');
    const allCount = await orderPage.getRowCount();

    await orderPage.switchTab('b2c');
    const b2cCount = await orderPage.getRowCount();

    await orderPage.switchTab('b2b');
    const b2bCount = await orderPage.getRowCount();

    await orderPage.switchTab('project');
    const hasSummary = await orderPage.resultSummary.isVisible({ timeout: ELEMENT_TIMEOUT }).catch(() => false);
    const hasNoResult = await orderPage.noResultMessage.isVisible({ timeout: ELEMENT_TIMEOUT }).catch(() => false);
    expect(hasSummary || hasNoResult, '프로젝트별 주문 탭에서 목록 영역이 보이지 않습니다.').toBeTruthy();

    const hasDataInAnyTab = [allCount, b2cCount, b2bCount].some((count) => count > 0);
    expect(hasDataInAnyTab, '전체/B2C/B2B 탭 모두 데이터가 없습니다.').toBeTruthy();
  });

  test('ORD-SEARCH-01: 상태 조합 검색(주문/결제/배송/재고할당) 정합성 검증', async () => {
    await orderPage.switchTab('all');
    const requestedSnapshot = await orderPage.getFilterableStatusSnapshot();

    await orderPage.resetFiltersAndWait();
    await orderPage.applyCombinedStatusFilters(requestedSnapshot);
    const appliedSnapshot = await orderPage.getSelectedStatusSnapshot();
    await orderPage.clickSearchAndWait();
    await orderPage.waitForTableOrNoResult();
    await orderPage.assertRowsMatchStatus(appliedSnapshot, 10);
  });

  test('ORD-SEARCH-02: 검색 초기화 후 동일 조건 재검색 시 재실행 가능성 검증', async () => {
    await orderPage.switchTab('all');
    const initialCount = await orderPage.getRowCount();
    expect(initialCount, '초기 주문 목록이 비어 있습니다.').toBeGreaterThan(0);

    await orderPage.clickSearchAndWait();
    await orderPage.waitForTableOrNoResult();
    const firstSearchCount = await orderPage.getRowCount();
    expect(firstSearchCount, '첫 조회 결과가 비어 있습니다.').toBeGreaterThan(0);

    await orderPage.resetFiltersAndWait();
    const resetCount = await orderPage.getRowCount();
    expect(resetCount, '검색 초기화 이후 목록이 비어 있습니다.').toBeGreaterThan(0);

    await orderPage.clickSearchAndWait();
    await orderPage.waitForTableOrNoResult();
    const rerunCount = await orderPage.getRowCount();
    expect(rerunCount, '검색 초기화 후 재조회 결과가 비어 있습니다.').toBeGreaterThan(0);
  });

  test('ORD-SEARCH-03: 존재하지 않는 주문번호 검색 시 결과 없음 검증', async () => {
    await orderPage.switchTab('all');

    const impossibleKeyword = `AUTO-NOT-FOUND-${Date.now()}`;
    await orderPage.searchByKeyword(impossibleKeyword);

    const noResult = await orderPage.hasNoResultOrEmptyTable();
    expect(noResult, '존재하지 않는 주문번호 검색에서 결과 없음 상태가 확인되지 않았습니다.').toBeTruthy();

    await orderPage.resetFiltersAndWait();
  });
});
