/**
 * Google 로그인 헬퍼
 *
 * 브라우저에서 Google 로그인을 실행하고 세션을 auth.json에 저장합니다.
 * 사용자가 수동으로 로그인을 완료할 때까지 대기합니다.
 *
 * @see admin_auth_pom.spec.ts
 */

import { chromium, type Browser } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const AUTH_FILE = path.join(__dirname, "..", "..", "..", "auth.json");
const ADMIN_URL = "https://stage-new-admin.makeuni2026.com";

/** 최소 쿠키 수 (로그인 완전성 판단 기준) */
const MIN_COOKIE_COUNT = 10;

/**
 * 브라우저에서 Google 로그인을 실행하고 세션을 저장합니다.
 * 사용자가 수동으로 로그인을 완료할 때까지 대기합니다 (최대 3분).
 */
export async function performGoogleLogin(): Promise<boolean> {
  console.log("\n🔐 ===========================================");
  console.log("   Google 로그인이 필요합니다!");
  console.log("   브라우저가 열립니다. 로그인을 완료해주세요.");
  console.log("   ===========================================\n");

  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: false,
      slowMo: 100,
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });

    const page = await context.newPage();

    // Admin 페이지로 이동 (자동으로 Google 로그인 리다이렉트)
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });

    console.log("👆 브라우저에서 Google 계정으로 로그인해주세요...");
    console.log("   (로그인 완료 후 자동으로 진행됩니다)\n");

    // 로그인 완료 대기 (최대 3분)
    let loginSuccess = false;

    try {
      await page.waitForSelector(
        'aside, nav, [class*="sidebar"], [class*="menu"], h1',
        {
          timeout: 180000,
          state: "visible",
        },
      );

      const currentUrl = page.url();
      if (
        !currentUrl.includes("auth") &&
        !currentUrl.includes("accounts.google.com")
      ) {
        loginSuccess = true;
      }
    } catch {
      // 요소를 찾지 못함
    }

    if (!loginSuccess) {
      console.log("⚠️ 로그인 시간 초과 또는 실패");
      return false;
    }

    // refresh_token 또는 access_token 쿠키가 설정될 때까지 대기
    console.log("⏳ 인증 토큰 설정 대기 중...");
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    let tokenFound = false;
    const cookies = await context.cookies();
    const hasRefreshToken = cookies.some((c) => c.name === "refresh_token");
    const hasAccessToken = cookies.some((c) => c.name === "access_token");
    tokenFound = hasRefreshToken || hasAccessToken;
    if (tokenFound) {
      console.log(
        `   ✅ 토큰 쿠키 발견: ${hasRefreshToken ? "refresh_token " : ""}${hasAccessToken ? "access_token" : ""}`,
      );
    }

    if (!tokenFound) {
      console.log("   ⚠️ 토큰 쿠키를 찾지 못했습니다. 페이지 새로고침 시도...");
      await page.reload({ waitUntil: "networkidle" });
      const refreshedCookies = await context.cookies();
      tokenFound = refreshedCookies.some(
        (c) => c.name === "refresh_token" || c.name === "access_token",
      );
    }

    // 세션 저장
    const storageState = await context.storageState();
    fs.writeFileSync(AUTH_FILE, JSON.stringify(storageState, null, 2));

    console.log("✅ 로그인 완료! 세션이 저장되었습니다.");
    console.log(`   저장 위치: ${AUTH_FILE}`);
    console.log(`   쿠키 수: ${storageState.cookies.length}`);

    if (storageState.cookies.length < MIN_COOKIE_COUNT) {
      console.log(
        "   ⚠️ 쿠키 수가 적습니다. 로그인이 완전하지 않을 수 있습니다.",
      );
    }
    console.log("");

    return tokenFound || storageState.cookies.length >= MIN_COOKIE_COUNT;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.log(`❌ 로그인 실패: ${msg}`);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
