/**
 * Admin 인증 Setup 테스트
 *
 * 어드민 페이지 접근 권한을 확인하고, 토큰 만료 시 자동으로 로그인을 실행합니다.
 * 이 테스트가 Setup Project로 먼저 실행되며, 성공해야만 다른 Admin 테스트가 실행됩니다.
 *
 * 흐름:
 * 1. 토큰 유효성 확인
 * 2. 토큰 만료 시 → 자동 로그인 시도 (브라우저 열림)
 * 3. 로그인 완료 후 → 인증 검증
 * 4. 인증 성공 → 다른 테스트 실행 가능
 *
 * @see tests/helpers/admin/test-helpers.ts
 */

import { test, expect } from "@playwright/test";
import {
  setupAuthCookies,
  resetAuthCache,
  setupApiInterceptor,
  performGoogleLogin,
} from "./helpers/admin";
import {
  isAuthFailed,
  markAuthFailed,
  clearAuthFailed,
  isTokenValidSync,
  getTokenRemaining,
  verifyAuthentication,
  PAGE_LOAD_TIMEOUT,
} from "./helpers/admin/test-helpers";

// ============================================================================
// 테스트 설정
// ============================================================================
let tokenValid = isTokenValidSync();

// ============================================================================
// 전역 설정
// ============================================================================
test.beforeAll(async () => {
  resetAuthCache();
  clearAuthFailed(); // 이전 인증 실패 상태 초기화

  if (tokenValid) {
    const { hours, minutes } = getTokenRemaining();
    console.log(`\n✅ 토큰 유효 (남은 시간: ${hours}시간 ${minutes}분)`);
  } else {
    console.log("\n⚠️ 토큰이 만료되었습니다. 자동 로그인을 시도합니다...");

    // 자동 로그인 실행
    const loginSuccess = await performGoogleLogin();

    if (loginSuccess) {
      // 토큰 상태 재확인
      tokenValid = isTokenValidSync();
      if (tokenValid) {
        const { hours, minutes } = getTokenRemaining();
        console.log(
          `✅ 로그인 후 토큰 유효 (남은 시간: ${hours}시간 ${minutes}분)`,
        );
      }
    } else {
      console.log("\n❌ 자동 로그인 실패!");
      console.log("   테스트를 다시 실행해주세요.\n");
    }
  }
});

test.beforeEach(async ({ page }, testInfo) => {
  const viewport = testInfo.project.use.viewport;
  expect(
    viewport === null || viewport.width >= 1024,
    "이 테스트는 데스크톱 뷰포트(너비 1024 이상)에서만 실행됩니다",
  ).toBeTruthy();

  const authStatus = isAuthFailed();
  expect(
    authStatus.failed,
    `인증 실패: ${authStatus.reason ?? "원인 미상"}`,
  ).toBe(false);

  await setupAuthCookies(page);

  // 시스템 토큰으로 API 요청에 Authorization 헤더 자동 추가
  await setupApiInterceptor(page);
});

// ##############################################################################
// 인증 검증 테스트
// ##############################################################################
test.describe.serial("인증 검증", () => {
  test("AUTH-VERIFY-01: 어드민 페이지 접근 인증 확인", async ({ page }) => {
    // 이 테스트가 실패하면 이후 모든 테스트는 스킵됨 (파일 기반 상태 공유)
    const adminUrl = "https://stage-new-admin.makeuni2026.com/sku/list";

    console.log("🔐 어드민 페이지 인증 검증 중...");

    // 첫 번째 인증 시도
    await page.goto(adminUrl, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_LOAD_TIMEOUT,
    });
    await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {});

    let authResult = await verifyAuthentication(page);

    // 인증 실패 시 자동 로그인 시도
    if (!authResult.success) {
      console.log(`\n⚠️ 첫 번째 인증 실패: ${authResult.reason}`);
      console.log("🔑 자동 로그인을 시도합니다...\n");

      // 자동 로그인 실행
      const loginSuccess = await performGoogleLogin();

      if (loginSuccess) {
        console.log("\n🔄 로그인 완료! 인증 재시도 중...");

        // 새 쿠키로 페이지 다시 로드
        await setupAuthCookies(page);
        await page.goto(adminUrl, {
          waitUntil: "domcontentloaded",
          timeout: PAGE_LOAD_TIMEOUT,
        });
        await page.waitForLoadState("load", { timeout: 10000 }).catch(() => {});

        // 두 번째 인증 시도
        authResult = await verifyAuthentication(page);
      } else {
        console.log("\n❌ 자동 로그인 실패!");
        console.log("   브라우저에서 로그인을 완료하지 못했습니다.\n");
      }
    }

    // 최종 인증 결과 확인
    if (!authResult.success) {
      const failReason = authResult.reason || "인증 실패";

      // 인증 실패 상태를 파일에 기록 (다른 worker들도 확인 가능)
      markAuthFailed(failReason);

      console.log(`\n❌ 최종 인증 실패: ${failReason}`);
      console.log("\n🔧 수동 해결 방법:");
      console.log("   node auto-refresh-token.js --setup");
      console.log("\n⚠️ 이후 모든 테스트는 스킵됩니다.\n");

      throw new Error(`인증 실패: ${failReason}`);
    }

    // 인증 성공 - 이전 인증 실패 상태 초기화
    clearAuthFailed();
    console.log("✅ 인증 검증 완료 - 어드민 페이지 정상 접근 가능");

    // 페이지가 정상적으로 로드되었는지 확인
    await expect(page).toHaveURL(/stage-new-admin\.makeuni2026\.com/);
  });
});
