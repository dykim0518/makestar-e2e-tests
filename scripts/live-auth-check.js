const { resolveTargetDomain } = require("./auth-state");

function normalizeDomain(domain) {
  return String(domain || "").replace(/^\./, "");
}

function cookieAppliesToHost(cookie, host) {
  const domain = normalizeDomain(cookie.domain);
  if (!domain) return false;
  return host === domain || host.endsWith(`.${domain}`);
}

function isStageEnv(env = process.env) {
  return (
    env.MAKESTAR_BASE_URL?.includes("stage") || env.ENVIRONMENT_INPUT === "stg"
  );
}

function getLiveAuthConfig(env = process.env) {
  const isStg = isStageEnv(env);
  const authHost = isStg ? "stage-auth.makeuni2026.com" : "auth.makestar.com";
  const appOrigin = isStg
    ? "https://stage-new.makeuni2026.com"
    : "https://www.makestar.com";
  return {
    authHost,
    appOrigin,
    profileUrl: `https://${authHost}/v1/user/profile/me/`,
    targetDomain: resolveTargetDomain(env),
  };
}

function buildCookieHeader(cookies, authHost, targetDomain) {
  return (cookies || [])
    .filter((cookie) => {
      if (!cookie?.name || cookie.value === undefined) return false;
      return (
        cookieAppliesToHost(cookie, authHost) ||
        cookieAppliesToHost(cookie, normalizeDomain(targetDomain))
      );
    })
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ");
}

function getStorageState(authInput) {
  if (Array.isArray(authInput)) {
    return { cookies: authInput, origins: [] };
  }
  return {
    cookies: Array.isArray(authInput?.cookies) ? authInput.cookies : [],
    origins: Array.isArray(authInput?.origins) ? authInput.origins : [],
    localStorage: authInput?.localStorage || null,
  };
}

function localStorageEntriesToRecord(entries = []) {
  return entries.reduce((record, entry) => {
    if (entry?.name) record[entry.name] = entry.value || "";
    return record;
  }, {});
}

function getAccessTokenFromStorage(authInput, appOrigin) {
  const state = getStorageState(authInput);
  if (state.localStorage?.access_token) return state.localStorage.access_token;

  for (const origin of state.origins) {
    if (origin.origin !== appOrigin) continue;
    const values = localStorageEntriesToRecord(origin.localStorage || []);
    if (values.access_token) return values.access_token;
  }

  return (
    state.cookies.find((cookie) => cookie.name === "access_token")?.value || ""
  );
}

async function checkLiveAuth(authInput, options = {}) {
  const env = options.env || process.env;
  if (env.AUTH_LIVE_CHECK === "false") {
    return { ok: true, skipped: true, message: "live auth check disabled" };
  }

  const { authHost, appOrigin, profileUrl, targetDomain } =
    getLiveAuthConfig(env);
  const state = getStorageState(authInput);
  const accessToken = getAccessTokenFromStorage(authInput, appOrigin);
  const cookieHeader = buildCookieHeader(state.cookies, authHost, targetDomain);
  if (!cookieHeader) {
    return {
      ok: false,
      status: 0,
      message: `${authHost}로 보낼 인증 쿠키가 없습니다.`,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    Number(env.AUTH_LIVE_CHECK_TIMEOUT_MS) || 15000,
  );

  try {
    const headers = {
      accept: "application/json",
      cookie: cookieHeader,
      origin: appOrigin,
      referer: `${appOrigin}/`,
    };
    if (accessToken) headers.authorization = `Bearer ${accessToken}`;

    const response = await fetch(profileUrl, {
      method: "GET",
      headers,
      signal: controller.signal,
    });

    if (response.ok) {
      return {
        ok: true,
        status: response.status,
        message: `live auth OK (${response.status})`,
      };
    }

    const body = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      message: [
        `live auth 실패: ${profileUrl} -> HTTP ${response.status}`,
        accessToken ? "" : " (access_token 없이 cookie-only 요청)",
        body ? ` (${body.slice(0, 200)})` : "",
      ].join(""),
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: `live auth 요청 실패: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isLoginUrl(url, authHost) {
  return url.hostname === authHost || url.href.includes("/login");
}

async function waitForUrlToSettle(page, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let previousUrl = page.url();
  let stableCount = 0;

  while (Date.now() < deadline) {
    await wait(250);
    const currentUrl = page.url();
    if (currentUrl === previousUrl) {
      stableCount += 1;
      if (stableCount >= 4) return currentUrl;
    } else {
      previousUrl = currentUrl;
      stableCount = 0;
    }
  }

  return page.url();
}

async function checkLivePageAuth(authInput, options = {}) {
  const env = options.env || process.env;
  if (env.AUTH_PAGE_CHECK !== "true") {
    return {
      ok: true,
      skipped: true,
      message: "live page auth check disabled",
    };
  }

  let chromium;
  try {
    chromium = require("@playwright/test").chromium;
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: `Playwright 브라우저 로드 실패: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  const { authHost, appOrigin } = getLiveAuthConfig(env);
  const targetUrl = `${appOrigin}/my-page`;
  const timeoutMs = Number(env.AUTH_PAGE_CHECK_TIMEOUT_MS) || 30000;
  const settleMs = Number(env.AUTH_PAGE_CHECK_SETTLE_MS) || 5000;
  const state = getStorageState(authInput);
  let browser;

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      storageState: state,
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();
    const response = await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: timeoutMs,
    });
    const finalUrl = new URL(await waitForUrlToSettle(page, settleMs));

    if (isLoginUrl(finalUrl, authHost)) {
      return {
        ok: false,
        status: response?.status() || 0,
        message: `/my-page 진입이 로그인 페이지로 리다이렉트되었습니다: ${finalUrl.href}`,
      };
    }

    if (finalUrl.origin !== appOrigin) {
      return {
        ok: false,
        status: response?.status() || 0,
        message: `/my-page 진입 후 예상 origin이 아닙니다: ${finalUrl.href}`,
      };
    }

    if (!finalUrl.pathname.startsWith("/my-page")) {
      return {
        ok: false,
        status: response?.status() || 0,
        message: `/my-page 진입 후 인증 UI가 아닌 경로로 이동했습니다: ${finalUrl.href}`,
      };
    }

    return {
      ok: true,
      status: response?.status() || 200,
      message: `live page auth OK (${finalUrl.href})`,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      message: `live page auth 요청 실패: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  } finally {
    if (browser) await browser.close();
  }
}

module.exports = {
  buildCookieHeader,
  checkLiveAuth,
  checkLivePageAuth,
  getLiveAuthConfig,
};
