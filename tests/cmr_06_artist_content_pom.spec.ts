/**
 * Makestar.com E2E 모니터링 테스트 - artist/content
 *
 * Phase 5 구조 분할: 기존 cmr_monitoring_pom.spec.ts의 describe 블록을
 * 목적별 spec로 나누고, 공통 설정은 tests/helpers에서 가져옵니다.
 */

import { test, expect } from "@playwright/test";
import { MakestarPage } from "./pages/makestar.page";
import { TEST_TIMEOUT } from "./helpers/cmr-monitoring-config";

test.describe("아티스트/콘텐츠 @feature:cmr.artist", () => {
  let makestar: MakestarPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    makestar = new MakestarPage(page);
    await makestar.gotoHome();
  });
  test("CMR-DATA-01: 아티스트 프로필 페이지 접근 및 정보 표시 확인", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // GNB Shop 버튼 클릭 (유저 시나리오)
    await makestar.navigateToShop();
    await makestar.waitForPageContent();
    console.log("✅ Shop 페이지 이동");

    // POM 로케이터 사용
    const cardCount = await makestar.getSearchResultCount();
    expect(cardCount, "Shop 페이지에 상품이 표시되어야 합니다").toBeGreaterThan(
      0,
    );

    // 사용자 시나리오: Shop -> 상품 상세 -> 아티스트 프로필
    const artistNavigation = await makestar.openArtistProfileFromShop({
      maxProducts: 8,
    });
    expect(
      artistNavigation.success,
      artistNavigation.reason ??
        "상품 상세 페이지에서 아티스트 링크를 찾을 수 없습니다",
    ).toBe(true);

    if (artistNavigation.success) {
      console.log(`📍 상품 상세 URL: ${artistNavigation.detailUrl}`);
      console.log(`📍 아티스트 URL: ${artistNavigation.artistUrl}`);
      console.log(`📍 사용 셀렉터: ${artistNavigation.selector}`);
    }

    // POM 메서드 사용
    const artistElements = await makestar.verifyArtistElements();
    let elementsFound = Object.values(artistElements).filter(Boolean).length;

    console.log(
      `   아티스트 이미지: ${artistElements.image ? "표시됨" : "미표시"}`,
    );
    console.log(`   아티스트명: ${artistElements.name ? "표시됨" : "미표시"}`);
    console.log(
      `   상품 목록: ${artistElements.products ? "표시됨" : "미표시"}`,
    );

    expect(elementsFound).toBeGreaterThan(0);
    console.log(`✅ 아티스트 관련 요소 ${elementsFound}개 확인`);
  });

  test("CMR-DATA-02: 아티스트별 상품 목록 필터링 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // GNB Shop 버튼 클릭 (유저 시나리오)
    await makestar.navigateToShop();
    await makestar.waitForPageContent();
    console.log("✅ Shop 페이지 이동");

    // POM 로케이터 사용
    const initialCount = await makestar.getSearchResultCount();
    console.log(`   초기 상품 수: ${initialCount}개`);

    // 필터 탭 확인 (POM 메서드 사용)
    const filterFound = await makestar.hasFilterTabs();
    if (filterFound) {
      console.log("✅ 필터 요소 발견");
      await makestar
        .clickFilterTab("전체")
        .catch(() => makestar.clickFilterTab("All"));
    }

    await makestar.gotoHome();
    await makestar.waitForContentStable();
    await makestar.openSearchUI();

    const artistName = "SEVENTEEN";
    await makestar.searchInput.fill(artistName);
    await makestar.searchInput.press("Enter");
    await makestar.waitForLoadState("domcontentloaded");
    await makestar.waitForSearchResults();
    console.log(`✅ 아티스트 "${artistName}" 검색 실행`);

    const searchUrl = makestar.currentUrl;
    console.log(`   검색 결과 URL: ${searchUrl}`);

    // POM 메서드 사용
    const resultCount = await makestar.getSearchResultCount();
    console.log(`   검색 결과 상품 수: ${resultCount}개`);

    expect(resultCount).toBeGreaterThan(0);
    console.log("✅ 아티스트 검색 결과 표시 확인");

    const artistMention = makestar.page.getByText(artistName).first();
    const hasArtistMention = await artistMention
      .isVisible({ timeout: 5000 });

    if (hasArtistMention) {
      console.log(`✅ 검색 결과에 "${artistName}" 표시됨`);
    } else {
      console.log(
        `ℹ️ 검색 결과에 아티스트명 직접 표시 없음 (상품 이미지로 표시)`,
      );
    }

    if (resultCount > 0) {
      await makestar.clickFirstSearchResult();
      await makestar.waitForContentStable();

      const productUrl = makestar.currentUrl;
      console.log(`   상품 상세 URL: ${productUrl}`);

      // POM 메서드 사용
      const artistElements = await makestar.verifyArtistElements();
      console.log(
        `   상품 상세 아티스트 정보: ${artistElements.name ? "표시됨" : "미표시"}`,
      );
    }
  });
});
