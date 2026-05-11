/**
 * Makestar.com E2E 모니터링 테스트 - search
 *
 * Phase 5 구조 분할: 기존 cmr_monitoring_pom.spec.ts의 describe 블록을
 * 목적별 spec로 나누고, 공통 설정은 tests/helpers에서 가져옵니다.
 */

import { test, expect } from "@playwright/test";
import { MakestarPage } from "./pages/makestar.page";
import { TEST_TIMEOUT } from "./helpers/cmr-monitoring-config";

test.describe("검색 기능 @feature:cmr.home", () => {
  let makestar: MakestarPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    makestar = new MakestarPage(page);
    await makestar.gotoHome();
  });
  test("CMR-SEARCH-01: 검색 UI 열기 및 추천 검색어 표시 확인", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);
    await makestar.handleModal();

    await makestar.openSearchUI();

    const hasRecommended = await makestar.verifyRecommendedKeywords();
    expect(hasRecommended).toBeTruthy();

    const hasCancelBtn = await makestar.cancelButton
      .isVisible({ timeout: 2000 });
    expect(hasCancelBtn).toBeTruthy();
  });

  test("CMR-SEARCH-02: 검색어 입력 및 검색 결과 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);
    await makestar.handleModal();

    await makestar.search("BTS");

    const isSearchResult = await makestar.hasSearchResultText("BTS");
    expect(isSearchResult, "검색 결과 페이지에 도달해야 합니다").toBe(true);
    console.log(`✅ 검색 결과 페이지 이동: ${makestar.currentUrl}`);
  });

  test("CMR-SEARCH-03: 검색 결과 페이지 UI 및 결과 표시 확인", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 사용자 시나리오: 로고 클릭으로 Home 복귀 후 검색
    await makestar.clickLogoToHome();
    await makestar.waitForContentStable();

    const searchKeyword = "BTS";
    await makestar.search(searchKeyword);
    await makestar.waitForSearchResults();

    const currentUrl = makestar.currentUrl;
    console.log(`   검색 결과 URL: ${currentUrl}`);

    expect(currentUrl).toContain("keyword=");

    // POM 로케이터 사용
    const cardCount = await makestar.getSearchResultCount();
    console.log(`   검색 결과 상품 수: ${cardCount}개`);

    expect(cardCount).toBeGreaterThan(0);
  });

  test("CMR-SEARCH-04: 검색 결과 필터링 (카테고리/탭) 확인", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 사용자 시나리오: 로고 클릭으로 Home 복귀 후 검색
    await makestar.clickLogoToHome();
    await makestar.waitForContentStable();
    await makestar.search("album");
    await makestar.waitForSearchResults();

    const currentUrl = makestar.currentUrl;
    console.log(`   검색 결과 URL: ${currentUrl}`);

    // POM 메서드 사용
    const filterFound = await makestar.hasFilterTabs();
    if (filterFound) {
      console.log("✅ 필터/탭 요소 발견");
    }

    // POM 로케이터 사용
    const cardCount = await makestar.getSearchResultCount();
    console.log(`   검색 결과 상품 수: ${cardCount}개`);

    expect(filterFound || cardCount > 0).toBeTruthy();

    if (filterFound) {
      const clicked = await makestar.clickFilterTab("전체");
      if (!clicked) {
        await makestar.clickFilterTab("All");
      }
      console.log("✅ 필터 탭 클릭 테스트 완료");
    }
  });

  test("CMR-SEARCH-05: 검색 후 추천 검색어 재표시 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 사용자 시나리오: 검색 결과 진입 후 다시 검색 UI를 열어도 추천 검색어가 보여야 함
    await makestar.clickLogoToHome();
    await makestar.waitForContentStable();

    const testKeyword = "BTS";
    await makestar.search(testKeyword);
    await makestar.waitForSearchResults();

    // 사용자 시나리오: 로고 클릭으로 Home 복귀
    await makestar.clickLogoToHome();
    await makestar.waitForContentStable();

    await makestar.openSearchUI();

    const hasRecommended = await makestar.verifyRecommendedKeywords();

    expect(
      hasRecommended,
      `검색 후 다시 열었을 때 추천 검색어가 표시되어야 합니다 (검색어: ${testKeyword})`,
    ).toBe(true);

    console.log("✅ 검색 후 추천 검색어 재표시 확인됨");
  });
});
