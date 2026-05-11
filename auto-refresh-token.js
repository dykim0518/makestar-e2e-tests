/**
 * 자동 토큰 갱신 시스템
 *
 * Playwright storageState를 활용한 세션 관리
 *
 * 사용법:
 *   1. 최초 1회: node auto-refresh-token.js --setup (구글 로그인)
 *   2. 이후 테스트 실행 시 자동으로 세션 확인 및 갱신
 *
 * Playwright globalSetup에서 자동 호출됨
 */

const { chromium } = require("@playwright/test");
const fs = require("fs");
const path = require("path");
const {
  buildAdminTokenData,
  extractTokenPairFromCookies,
  extractTokenPairFromLocalStorage,
  extractTokenPairFromUrl,
  getAdminTokenExpiryMs,
  getLatestRefreshTokenExpiry,
  getRemainingParts,
  mergeTokenPairs,
  readStorageState,
  resolveTargetDomain,
} = require("./scripts/auth-state");

// 환경별 파일 경로: STG → stg-auth.json, Prod → auth.json
const isSTG = process.env.MAKESTAR_BASE_URL?.includes("stage");
const SESSION_FILE = path.join(__dirname, "playwright-session.json");
const ADMIN_TOKENS_FILE =
  process.env.ADMIN_TOKENS_FILE_PATH ||
  path.join(__dirname, "admin-tokens.json");
const AUTH_FILE =
  process.env.AUTH_FILE_PATH ||
  path.join(__dirname, isSTG ? "stg-auth.json" : "auth.json");
const BASE_URL = "https://stage-new-admin.makeuni2026.com";
const TARGET_REFRESH_DOMAIN = resolveTargetDomain({
  ...process.env,
  ENVIRONMENT_INPUT: process.env.ENVIRONMENT_INPUT || (isSTG ? "stg" : "prod"),
});

function getBestTokenExpiryMs() {
  const candidates = [];
  const adminTokenExpiry = getAdminTokenExpiryMs(ADMIN_TOKENS_FILE);
  if (adminTokenExpiry) candidates.push(adminTokenExpiry);

  const authState = readStorageState(AUTH_FILE);
  if (authState.ok) {
    const refreshTokenExpiry = getLatestRefreshTokenExpiry(
      authState.cookies,
      TARGET_REFRESH_DOMAIN,
    );
    if (refreshTokenExpiry) candidates.push(refreshTokenExpiry);
  }

  return candidates.length > 0 ? Math.max(...candidates) : null;
}

async function readPageLocalStorage(page) {
  return page.evaluate(() => {
    const items = {};
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key) items[key] = window.localStorage.getItem(key);
    }
    return items;
  });
}

async function collectTokenPair(page, context, currentUrl) {
  const localStorage = await readPageLocalStorage(page);
  const cookies = await context.cookies();
  const tokens = mergeTokenPairs(
    extractTokenPairFromUrl(currentUrl),
    extractTokenPairFromLocalStorage(localStorage),
    extractTokenPairFromCookies(cookies),
  );
  return { ...tokens, cookies, localStorage };
}

function saveAdminTokens(tokens, userInfoOverride = null) {
  if (!tokens.accessToken || !tokens.refreshToken) return null;
  const tokenData = buildAdminTokenData({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    userInfo: userInfoOverride || tokens.userInfo,
    expiresAt: tokens.expiresAt,
  });
  fs.writeFileSync(ADMIN_TOKENS_FILE, JSON.stringify(tokenData, null, 2));
  return tokenData;
}

async function saveCurrentAuthState(context, page) {
  await context.storageState({ path: SESSION_FILE });
  const cookies = await context.cookies();
  const localStorage = await readPageLocalStorage(page);
  const authData = {
    cookies,
    localStorage,
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2));
  console.log(`💾 auth.json 업데이트됨 (쿠키 ${cookies.length}개)`);
  return { cookies, localStorage };
}

function logTokenSaved(tokenData) {
  const expiresAtMs = new Date(tokenData.expiresAt).getTime();
  if (!Number.isFinite(expiresAtMs)) {
    console.log("💾 토큰 갱신 완료 (만료 시간 확인 불가)");
    return;
  }
  const { hours, minutes } = getRemainingParts(expiresAtMs);
  console.log(`💾 토큰 갱신 완료 (남은 시간: ${hours}시간 ${minutes}분)`);
}

/**
 * 토큰 유효성 확인
 *
 * 1순위: admin-tokens.json의 expiresAt 확인
 * 2순위: auth.json의 refresh_token 쿠키 확인
 */
function isTokenValid() {
  const bufferTime = 1 * 60 * 1000; // 1분 여유
  const expiresAt = getBestTokenExpiryMs();
  return expiresAt !== null && expiresAt - bufferTime > Date.now();
}

/**
 * 토큰 남은 시간 가져오기 (시간, 분 반환)
 */
function getTokenRemaining() {
  const expiresAt = getBestTokenExpiryMs();
  if (!expiresAt) return { hours: 0, minutes: 0 };
  return getRemainingParts(expiresAt);
}

/**
 * 세션 파일 존재 확인
 */
function hasSession() {
  return fs.existsSync(SESSION_FILE);
}

/**
 * 최초 설정 - Google 로그인하여 전체 세션 저장
 */
async function setupGoogleSession() {
  console.log("🔐 Google 세션 설정을 시작합니다...");
  console.log("   브라우저가 열리면 Google 계정으로 로그인해주세요.\n");

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // 관리자 페이지로 이동
    await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "domcontentloaded" });

    // Google 로그인 버튼이 있으면 클릭
    try {
      const googleBtn = page.locator('button:has-text("Google")').first();
      await googleBtn.waitFor({ state: "visible", timeout: 5000 });
      await googleBtn.click();
      console.log("🖱️ Google 로그인 버튼 클릭됨");
    } catch {
      console.log("ℹ️ 이미 로그인 페이지에 있습니다.");
    }

    console.log("⏳ Google 로그인을 완료해주세요... (최대 3분 대기)");

    // 로그인 완료 후 관리자 도메인으로 돌아올 때까지 대기 (URL 파라미터 토큰 유무 무관)
    // stage-auth 도메인을 지나 최종 관리자 도메인(BASE_URL) 도달을 기다림
    await page.waitForURL("**stage-new-admin.makeuni2026.com/**", {
      timeout: 180000,
    });
    await page.waitForLoadState("domcontentloaded");
    const currentUrl = page.url();
    console.log("✅ 로그인 리다이렉트 감지:", currentUrl);

    const tokenSource = await collectTokenPair(page, context, currentUrl);
    const tokenData = saveAdminTokens(tokenSource);
    if (tokenData) {
      console.log(`💾 토큰 저장됨 (만료: ${tokenData.expiresAt})`);
      await page.waitForLoadState("networkidle");
      await saveCurrentAuthState(context, page);
      await browser.close();
      return true;
    }

    console.log(
      "⚠️ URL/로컬스토리지에서 토큰을 찾을 수 없습니다. 쿠키 확인 중...",
    );
    // 그래도 현재 세션 쿠키/스토리지는 저장하여 쿠키 기반 실행을 가능하게 함
    try {
      await page.waitForLoadState("networkidle");
      const { cookies } = await saveCurrentAuthState(context, page);

      // 저장된 auth.json에서 refresh_token 쿠키가 유효한지 확인
      const refreshTokenExpiry = getLatestRefreshTokenExpiry(
        cookies,
        TARGET_REFRESH_DOMAIN,
      );
      if (refreshTokenExpiry && refreshTokenExpiry > Date.now()) {
        console.log(
          `✅ 쿠키에서 유효한 refresh_token 발견! (만료: ${new Date(refreshTokenExpiry).toISOString()})`,
        );
        await browser.close();
        return true; // 쿠키 기반 인증 가능
      }
      console.log("⚠️ 유효한 refresh_token을 찾을 수 없습니다.");
    } catch {}
    await browser.close();
    return false;
  } catch (e) {
    console.error("❌ 설정 실패:", e.message);
    await browser.close();
    return false;
  }
}

/**
 * 저장된 세션으로 자동 로그인 및 토큰 갱신
 */
async function autoRefreshToken() {
  if (!hasSession()) {
    console.log(
      "⚠️ 저장된 세션이 없습니다. --setup 옵션으로 먼저 설정해주세요.",
    );
    return false;
  }

  console.log("🔄 토큰 자동 갱신 중... (헤드리스 브라우저 기동)");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: SESSION_FILE });
  const page = await context.newPage();

  try {
    console.log("   → 대시보드 접속 시도 (최대 30초)");
    await page.goto(`${BASE_URL}/dashboard`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // 잠시 대기 후 URL 확인 (리다이렉트 대기)
    await page.waitForTimeout(3000);
    let currentUrl = page.url();

    // 로그인 페이지로 리다이렉트되었는지 확인
    if (currentUrl.includes("login") || currentUrl.includes("/auth")) {
      console.log("📝 로그인 페이지 감지 - Google 자동 로그인 시도...");

      // Google 로그인 버튼 클릭 시도
      try {
        const googleBtn = page.locator('button:has-text("Google")').first();
        await googleBtn.waitFor({ state: "visible", timeout: 5000 });
        await googleBtn.click();

        // Google OAuth 리다이렉트 대기 (이미 로그인된 상태면 바로 돌아옴)
        await page.waitForURL("**/dashboard**", { timeout: 30000 });
        currentUrl = page.url();
        console.log("✅ Google 자동 로그인 성공");
      } catch (e) {
        console.log("⚠️ Google 자동 로그인 실패 - 수동 로그인 필요");
        console.log("   실행: node auto-refresh-token.js --setup");
        await browser.close();
        return false;
      }
    }

    const tokenSource = await collectTokenPair(page, context, currentUrl);
    const tokenData = saveAdminTokens(tokenSource);
    if (tokenData) {
      logTokenSaved(tokenData);
      await saveCurrentAuthState(context, page);
      await browser.close();
      return true;
    }

    // dashboard에 정상 접근했지만 URL에 토큰이 없는 경우
    if (
      currentUrl.includes("dashboard") &&
      !currentUrl.includes("access_token")
    ) {
      console.log(
        "⚠️ 대시보드 접근했으나 새 토큰 없음 - 로그아웃 후 재로그인 시도...",
      );

      // 로그아웃 시도
      try {
        await page.goto(`${BASE_URL}/auth/logout`, {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        await page.waitForTimeout(1000);

        // 다시 로그인 페이지로
        await page.goto(`${BASE_URL}/dashboard`, {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        await page.waitForTimeout(2000);
        currentUrl = page.url();

        if (currentUrl.includes("login") || currentUrl.includes("/auth")) {
          // Google 로그인 버튼 클릭
          const googleBtn = page.locator('button:has-text("Google")').first();
          await googleBtn.waitFor({ state: "visible", timeout: 5000 });
          await googleBtn.click();

          // 리다이렉트 대기 (토큰 쿼리 유무 무관)
          await page.waitForURL("**makeuni2026.com/**", { timeout: 30000 });
          currentUrl = page.url();

          const retryTokenSource = await collectTokenPair(
            page,
            context,
            currentUrl,
          );
          const retryTokenData = saveAdminTokens(retryTokenSource);
          if (retryTokenData) {
            logTokenSaved(retryTokenData);
            await saveCurrentAuthState(context, page);
            await browser.close();
            return true;
          }
        }
      } catch (e) {
        console.log("⚠️ 재로그인 실패:", e.message);
      }

      // 여전히 실패하면 수동 로그인 필요
      console.log("❌ 자동 갱신 실패 - 수동 로그인 필요");
      console.log("   실행: node auto-refresh-token.js --setup");
      await browser.close();
      return false;
    }

    console.log("⚠️ 예상치 못한 페이지:", currentUrl);
    await browser.close();
    return false;
  } catch (e) {
    console.error("❌ 자동 갱신 실패:", e.message);
    await browser.close();
    return false;
  }
}

/**
 * 메인 실행
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--setup")) {
    // 최초 설정 모드 (브라우저 열어서 수동 로그인)
    await setupGoogleSession();
  } else if (args.includes("--force")) {
    // 강제 갱신
    await autoRefreshToken();
  } else if (args.includes("--auto")) {
    // 자동 갱신 모드 (VS Code 테스트 탐색기에서 호출됨)
    // 토큰이 만료되었을 때만 갱신 시도, 성공/실패 결과를 반환
    if (isTokenValid()) {
      const { hours, minutes } = getTokenRemaining();
      console.log(`✅ 토큰 유효 (남은 시간: ${hours}시간 ${minutes}분)`);
      process.exit(0);
    }

    console.log("🔄 토큰 만료 - 자동 갱신 시도...");
    const success = await autoRefreshToken();

    if (success) {
      console.log("✅ 토큰 자동 갱신 성공!");
      process.exit(0);
    } else {
      console.log("❌ 토큰 자동 갱신 실패");
      console.log("   수동 로그인 필요: node auto-refresh-token.js --setup");
      process.exit(1);
    }
  } else {
    // 기본 모드: 토큰이 유효하면 스킵, 아니면 갱신
    if (isTokenValid()) {
      console.log("✅ 토큰이 아직 유효합니다.");
      const { hours, minutes } = getTokenRemaining();
      console.log(`   남은 시간: ${hours}시간 ${minutes}분`);
    } else {
      console.log("⚠️ 토큰이 만료되었거나 곧 만료됩니다.");
      await autoRefreshToken();
    }
  }
}

// 모듈 export (globalSetup에서 사용)
module.exports = {
  isTokenValid,
  autoRefreshToken,
  setupGoogleSession,
  hasSession,
  getTokenRemaining,
};

// 직접 실행 시
if (require.main === module) {
  main().catch(console.error);
}
