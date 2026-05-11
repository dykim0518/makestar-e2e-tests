/**
 * Makestar.com E2E 모니터링 테스트 - mypage/auth
 *
 * Phase 5 구조 분할: 기존 cmr_monitoring_pom.spec.ts의 describe 블록을
 * 목적별 spec로 나누고, 공통 설정은 tests/helpers에서 가져옵니다.
 */

import { test, expect } from "@playwright/test";
import { MakestarPage } from "./pages/makestar.page";
import { TEST_TIMEOUT } from "./helpers/cmr-monitoring-config";

test.describe("마이페이지/회원 기능 @feature:cmr.mypage", () => {
  let makestar: MakestarPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    makestar = new MakestarPage(page);
    await makestar.gotoHome();
  });
  test("CMR-AUTH-01: 마이페이지 접속 및 프로필 정보 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar
      .waitForContentStable("body", { timeout: 3000 })
      .catch(() => console.log("⏱️ Test 16 Home 콘텐츠 안정화 타임아웃"));

    await makestar.gotoMyPage();
    await makestar.handleModal();
    await makestar
      .waitForContentStable("body", { timeout: 3000 })
      .catch(() => console.log("⏱️ Test 16 MyPage 콘텐츠 안정화 타임아웃"));

    const isLoggedIn = await makestar.checkLoggedIn();
    expect(
      isLoggedIn,
      `마이페이지에 로그인 상태로 접근해야 합니다 (현재 URL: ${makestar.currentUrl})`,
    ).toBe(true);

    const hasMyPageContent = await makestar.hasMyPageContent();
    expect(hasMyPageContent, "마이페이지 콘텐츠가 표시되어야 합니다").toBe(
      true,
    );
    console.log("✅ 마이페이지 접속 성공 (로그인 + 콘텐츠 확인)");
  });

  test("CMR-AUTH-02: 마이페이지 메뉴 항목 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.gotoMyPage();
    await makestar.handleModal();
    await page.evaluate(() => window.scrollTo(0, 0));

    const foundCount = await makestar.verifyMyPageMenuItems();

    expect(foundCount).toBeGreaterThanOrEqual(2);
    console.log(`✅ 마이페이지 메뉴 ${foundCount}/5개 확인됨`);
  });

  test("CMR-AUTH-03: 주문내역 페이지 이동 및 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.gotoOrderHistory();
    await makestar.waitForContentStable();

    const currentUrl = makestar.currentUrl;
    console.log(`📍 현재 URL: ${currentUrl}`);

    expect(
      /order|my-page/i.test(currentUrl),
      `주문내역 관련 URL이어야 합니다 (현재: ${currentUrl})`,
    ).toBe(true);

    const hasContent = await makestar.hasOrderHistoryContent();
    expect(hasContent, "주문내역 콘텐츠가 표시되어야 합니다").toBe(true);
    console.log(`✅ 주문내역 페이지 확인됨: ${currentUrl}`);
  });

  test("CMR-AUTH-04: 배송지 관리 페이지 이동 및 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.gotoAddress();
    await makestar.waitForContentStable();

    const currentUrl = makestar.currentUrl;
    console.log(`📍 현재 URL: ${currentUrl}`);

    expect(
      /address|my-page/i.test(currentUrl),
      `배송지 관련 URL이어야 합니다 (현재: ${currentUrl})`,
    ).toBe(true);

    const hasContent = await makestar.hasAddressContent();
    expect(hasContent, "배송지 관리 콘텐츠가 표시되어야 합니다").toBe(true);
    console.log(`✅ 배송지 관리 페이지 확인됨: ${currentUrl}`);
  });

  test("CMR-AUTH-04-1: 팔로우 관리 페이지 이동 및 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.gotoFollow();
    await makestar.waitForContentStable();

    const currentUrl = makestar.currentUrl;
    console.log(`📍 현재 URL: ${currentUrl}`);

    expect(
      currentUrl.includes("/follow"),
      `팔로우 관리 URL이어야 합니다 (현재: ${currentUrl})`,
    ).toBe(true);

    const hasContent = await makestar.hasFollowContent();
    expect(hasContent, "팔로우 관리 콘텐츠가 표시되어야 합니다").toBe(true);
    console.log(`✅ 팔로우 관리 페이지 확인됨: ${currentUrl}`);
  });

  test("CMR-AUTH-04-2: 알림 설정 페이지 이동 및 확인", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    await makestar.gotoNotification();
    await makestar.waitForContentStable();

    const currentUrl = makestar.currentUrl;
    console.log(`📍 현재 URL: ${currentUrl}`);

    expect(
      currentUrl.includes("/notification"),
      `알림 설정 URL이어야 합니다 (현재: ${currentUrl})`,
    ).toBe(true);

    const hasContent = await makestar.hasNotificationContent();
    expect(hasContent, "알림 설정 콘텐츠가 표시되어야 합니다").toBe(true);
    console.log(`✅ 알림 설정 페이지 확인됨: ${currentUrl}`);
  });

  test("CMR-AUTH-05: 비밀번호 변경 페이지 접근 및 요소 검증", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 기능 검증: URL 직접 이동 (네비게이션은 NAV-02에서 별도 검증)
    await makestar.goto(`${makestar.baseUrl}/my-page/change-password`);
    await makestar.handleModal();
    await makestar
      .waitForContentStable("body", { stableTime: 500, timeout: 3000 })
      .catch(() => console.log("⏱️ Test 20 콘텐츠 안정화 타임아웃"));

    const currentUrl = makestar.currentUrl;
    console.log(`📍 현재 URL: ${currentUrl}`);

    // 비밀번호 페이지 요소 검증 (POM 메서드 사용)
    const inputCount = await makestar.getPasswordInputCount();
    const isPasswordPage = currentUrl.includes("password") || inputCount > 0;
    expect(isPasswordPage, "비밀번호 변경 페이지에 도달해야 합니다").toBe(true);
    console.log(
      `✅ 비밀번호 변경 페이지 접근 확인 (입력 필드 ${inputCount}개)`,
    );
  });

  test("CMR-AUTH-06: 이벤트 응모정보 관리 페이지 검증", async ({ page }) => {
    test.setTimeout(TEST_TIMEOUT);

    // 메뉴 클릭 네비게이션 시도 후 URL 폴백 (마이페이지 메인 접근 불가 환경 대응)
    await makestar.gotoMyPage();
    await makestar.handleModal();

    const menuTexts = [
      "이벤트 응모정보 관리",
      "Event Entry",
      "Manage Event Submissions",
    ] as const;
    const hrefs = ["event-submissions"] as const;
    const menuResult = await makestar.clickMyPageMenuStrict(menuTexts, hrefs);

    if (!menuResult.success) {
      console.warn("⚠️ 메뉴 클릭 불가, URL 직접 이동으로 폴백");
      await makestar.goto(`${makestar.baseUrl}/my-page/event-submissions`);
    }
    await makestar.handleModal();
    await makestar
      .waitForContentStable("body", { stableTime: 500, timeout: 3000 })
      .catch(() => console.log("⏱️ Test 21 콘텐츠 안정화 타임아웃"));

    const currentUrl = makestar.currentUrl;
    console.log(`📍 현재 URL: ${currentUrl}`);

    // URL에 event-submissions가 포함되어야 함 (event만 매칭하면 다른 이벤트 페이지도 통과)
    expect(
      currentUrl.includes("event-submissions"),
      `이벤트 응모정보 URL이어야 합니다 (현재: ${currentUrl})`,
    ).toBe(true);

    const eventEntryPageFound = await makestar.hasEventEntryContent();
    expect(
      eventEntryPageFound,
      "이벤트 응모정보 관련 콘텐츠가 표시되어야 합니다",
    ).toBe(true);

    const hasContent = await makestar.hasEventEntryListContent();
    console.log(`   응모 내역/빈 상태 메시지 표시: ${hasContent}`);
  });

  test("CMR-AUTH-07: 이메일 로그인 — 이메일 입력 시 다음 버튼 활성화 검증", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    const authSession = await makestar.getAuthSessionSnapshot();
    const email = authSession.email || "qa-monitor@example.com";

    const result = await makestar.verifyEmailLoginNextButton(email);

    expect(
      result.emailPageLoaded,
      "이메일 입력 페이지가 정상 로드되어야 합니다",
    ).toBe(true);

    expect(
      result.nextButtonDisabledInitially,
      "이메일 미입력 시 다음 버튼은 비활성화 상태여야 합니다",
    ).toBe(true);

    expect(
      result.nextButtonEnabledAfterInput,
      "이메일 입력 후 다음 버튼이 활성화되어야 합니다 (CT-290 회귀 검증)",
    ).toBe(true);

    console.log(
      "✅ 이메일 로그인 다음 버튼 활성화 검증 통과 (CT-290 회귀 방지)",
    );
    if (authSession.email) {
      console.log("   auth.json 저장 사용자 이메일로 검증함");
    }

    // auth 쿠키 복원 (후속 테스트에 영향 방지)
    await makestar.restoreAuthCookies();
  });

  test("CMR-AUTH-08: auth.json 세션 기반 로그인 상태 검증", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    const authSession = await makestar.getAuthSessionSnapshot();

    expect(
      authSession.hasRefreshToken,
      "auth.json storageState에 유효한 refresh_token 쿠키가 있어야 합니다",
    ).toBe(true);
    expect(
      authSession.hasLoggedInUser,
      "auth.json storageState에 LOGGED_IN_USER 정보가 있어야 합니다",
    ).toBe(true);

    await makestar.gotoMyPage();
    const isLoggedIn = await makestar.checkLoggedIn();
    expect(
      isLoggedIn,
      `auth.json 세션으로 my-page 접근이 가능해야 합니다 (현재 URL: ${makestar.currentUrl})`,
    ).toBe(true);

    const hasMyPageContent = await makestar.hasMyPageContent();
    expect(
      hasMyPageContent,
      "auth.json 세션으로 마이페이지 콘텐츠가 표시되어야 합니다",
    ).toBe(true);

    console.log(
      `✅ auth.json 세션 로그인 검증 통과 (현재 URL: ${makestar.currentUrl})`,
    );
  });
});
