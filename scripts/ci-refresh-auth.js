/**
 * CI용 headless 브라우저 토큰 자동 갱신
 *
 * auth.json에 저장된 Google 세션 쿠키(~400일 유효)를 활용하여
 * headless 브라우저에서 Google OAuth를 자동 완료하고 새 토큰을 발급받음.
 *
 * 동작 흐름:
 *   1. auth.json 쿠키를 브라우저에 로드
 *   2. Makestar 로그인 페이지 접근
 *   3. Google OAuth 자동 완료 (기존 Google 세션 활용)
 *   4. 새 refresh_token/sessionid로 auth.json 갱신
 *
 * 사용법:
 *   node scripts/ci-refresh-auth.js          # 기본 (만료 시에만 갱신)
 *   node scripts/ci-refresh-auth.js --force  # 강제 갱신
 *
 * 종료 코드:
 *   0 = 갱신 성공 또는 갱신 불필요
 *   1 = 갱신 실패
 */

const { chromium } = require("@playwright/test");
const fs = require("fs");
const {
  formatRemaining,
  getBrowserAuthState,
  mergeCookies,
  shouldRefreshBrowserAuth,
} = require("./auth-state");

const FORCE = process.argv.includes("--force");
const REFRESH_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2시간 이내면 갱신 시도

// STG 환경 감지: MAKESTAR_BASE_URL 또는 ENVIRONMENT_INPUT으로 판별
const isSTG =
  process.env.MAKESTAR_BASE_URL?.includes("stage") ||
  process.env.ENVIRONMENT_INPUT === "stg";

const LOGIN_URL = isSTG
  ? "https://stage-auth.makeuni2026.com/login/?application=MAKESTAR&redirect_url=https://stage-new.makeuni2026.com/my-page"
  : "https://auth.makestar.com/login/?application=MAKESTAR&redirect_url=https://www.makestar.com/my-page";
const LOGIN_PATTERNS = isSTG
  ? [/stage-auth\.makeuni2026\.com/, /accounts\.google\.com/]
  : [/auth\.makestar\.com/, /accounts\.google\.com/];
const SUCCESS_HOSTNAME = isSTG
  ? "stage-new.makeuni2026.com"
  : "www.makestar.com";

function isSuccessUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === SUCCESS_HOSTNAME &&
      parsed.pathname.includes("/my-page")
    );
  } catch {
    return false;
  }
}

function log(msg) {
  const ts = new Date().toISOString().slice(11, 19);
  console.log(`[${ts}] ${msg}`);
}

async function refreshAuth() {
  const browserAuthState = getBrowserAuthState({
    cwd: process.cwd(),
    env: process.env,
    bufferMs: 0,
  });
  const authFile = browserAuthState.authFilePath;

  // 1. auth.json 로드
  if (!browserAuthState.exists) {
    log("auth.json 없음 — 갱신 불가");
    return false;
  }

  if (browserAuthState.parseError || !browserAuthState.authData) {
    log(`auth.json 파싱 실패: ${browserAuthState.parseError?.message || "unknown error"}`);
    return false;
  }

  const auth = browserAuthState.authData;
  const cookies = browserAuthState.cookies;
  if (cookies.length === 0) {
    log("auth.json에 쿠키 없음 — 갱신 불가");
    return false;
  }

  // 2. 갱신 필요 여부 확인
  if (
    !shouldRefreshBrowserAuth({
      browserAuthState,
      thresholdMs: REFRESH_THRESHOLD_MS,
      force: FORCE,
    })
  ) {
    log(
      `refresh_token 잔여 ${formatRemaining(browserAuthState.remainingMs)} — 갱신 불필요`,
    );
    return true; // 갱신 불필요 = 성공
  }

  if (browserAuthState.bestRefreshToken?.remainingMs <= 0) {
    log("refresh_token 만료됨");
  } else if (typeof browserAuthState.remainingMs === "number") {
    log(
      `refresh_token 잔여 ${formatRemaining(browserAuthState.remainingMs)} — 갱신 필요`,
    );
  }

  // 3. Google 세션 쿠키 존재 확인
  if (!browserAuthState.hasGoogleSession) {
    log("Google 세션 쿠키 없음 — headless 갱신 불가");
    return false;
  }
  const googleCookieCount = cookies.filter((c) =>
    c.domain?.includes("google.com"),
  ).length;
  log(`Google 세션 쿠키 ${googleCookieCount}개 확인`);

  // 4. headless 브라우저 시작
  log("headless 브라우저 시작...");
  const browser = await chromium.launch({ headless: true });

  try {
    // auth.json을 storageState 형식으로 변환
    const storageState = {
      cookies: cookies,
      origins: auth.origins || [],
    };

    const context = await browser.newContext({
      storageState: storageState,
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: { width: 1920, height: 1080 },
    });

    const page = await context.newPage();

    // 5. 로그인 페이지 접근
    log(`로그인 페이지 접근: ${LOGIN_URL}`);
    await page.goto(LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    let currentUrl = page.url();
    log(`현재 URL: ${currentUrl}`);

    // 6. 이미 로그인된 상태 (my-page로 바로 리다이렉트)
    if (isSuccessUrl(currentUrl)) {
      log("이미 로그인 상태 — 세션 유효");
      const newCookies = await context.cookies();
      await saveRefreshedAuth(authFile, auth, newCookies);
      await browser.close();
      return true;
    }

    // 7. Google 로그인 버튼 클릭 시도
    if (currentUrl.includes("auth.makestar.com")) {
      log("로그인 페이지 감지 — Google 로그인 시도...");

      try {
        // Google 로그인 버튼 찾기 (다양한 셀렉터 시도)
        const googleBtn = page
          .locator(
            [
              'button:has-text("Google")',
              'a:has-text("Google")',
              '[class*="google"]',
              '[data-provider="google"]',
            ].join(", "),
          )
          .first();

        await googleBtn.waitFor({ state: "visible", timeout: 10000 });
        log("Google 버튼 발견 — 클릭");
        await googleBtn.click();

        // Google OAuth 페이지 또는 성공 리다이렉트 대기
        await page.waitForURL(
          (url) => {
            const href = url.toString();
            return isSuccessUrl(href) || href.includes("accounts.google.com");
          },
          { timeout: 15000 },
        );

        currentUrl = page.url();
        log(`Google 버튼 클릭 후: ${currentUrl}`);
      } catch (e) {
        log(`Google 버튼 클릭 실패: ${e.message}`);

        // 버튼 없이 자동 리다이렉트 될 수도 있으므로 현재 URL 재확인
        currentUrl = page.url();
        if (isSuccessUrl(currentUrl)) {
          log("자동 리다이렉트로 로그인 성공");
          const newCookies = await context.cookies();
          await saveRefreshedAuth(authFile, auth, newCookies);
          await browser.close();
          return true;
        }
      }
    }

    // 8. Google 계정 선택 페이지 처리
    if (currentUrl.includes("accounts.google.com")) {
      log("Google 계정 선택 페이지 감지");

      try {
        // 계정 선택 (첫 번째 계정 클릭)
        const accountBtn = page
          .locator('[data-email], [data-identifier], div[role="link"]')
          .first();
        await accountBtn.waitFor({ state: "visible", timeout: 10000 });
        log("계정 선택 — 클릭");
        await accountBtn.click();

        // 성공 리다이렉트 대기
        await page.waitForURL((url) => isSuccessUrl(url.toString()), {
          timeout: 30000,
        });
        currentUrl = page.url();
        log(`계정 선택 후: ${currentUrl}`);
      } catch (e) {
        log(`계정 선택 실패: ${e.message}`);
        currentUrl = page.url();
      }
    }

    // 9. 최종 확인
    if (isSuccessUrl(currentUrl)) {
      log("로그인 성공!");
      const newCookies = await context.cookies();
      await saveRefreshedAuth(authFile, auth, newCookies);
      await browser.close();
      return true;
    }

    // 10. 마지막 시도: 페이지 안정화 후 재확인
    log("추가 대기 중 (10초)...");
    await page.waitForTimeout(10000);
    currentUrl = page.url();
    log(`최종 URL: ${currentUrl}`);

    if (isSuccessUrl(currentUrl)) {
      log("지연 리다이렉트로 로그인 성공");
      const newCookies = await context.cookies();
      await saveRefreshedAuth(authFile, auth, newCookies);
      await browser.close();
      return true;
    }

    log(`갱신 실패 — 최종 URL: ${currentUrl}`);
    await browser.close();
    return false;
  } catch (e) {
    log(`오류 발생: ${e.message}`);
    await browser.close();
    return false;
  }
}

async function saveRefreshedAuth(authFile, originalAuth, newCookies) {
  const merged = mergeCookies(originalAuth.cookies || [], newCookies);
  const updated = {
    cookies: merged,
    origins: originalAuth.origins || [],
  };

  fs.writeFileSync(authFile, JSON.stringify(updated, null, 2));

  // 갱신된 토큰 확인
  const updatedState = getBrowserAuthState({
    cwd: process.cwd(),
    env: { ...process.env, AUTH_FILE_PATH: authFile },
    bufferMs: 0,
  });
  if (typeof updatedState.remainingMs === "number" && updatedState.remainingMs > 0) {
    log(
      `auth.json 저장 완료 — 새 refresh_token 잔여: ${formatRemaining(updatedState.remainingMs)}`,
    );
  } else {
    log("auth.json 저장 완료 (refresh_token exp 확인 불가)");
  }
}

async function main() {
  log("=== CI 토큰 자동 갱신 시작 ===");

  const success = await refreshAuth();

  if (success) {
    log("=== 갱신 완료 ===");
    process.exit(0);
  } else {
    log("=== 갱신 실패 — 수동 갱신 필요: npm run auth:refresh ===");
    process.exit(1);
  }
}

main();
