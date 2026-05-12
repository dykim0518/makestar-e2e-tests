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
  if (!accessToken) {
    return {
      ok: false,
      status: 0,
      message: `${appOrigin} storageState에 access_token이 없습니다.`,
    };
  }

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
    const response = await fetch(profileUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${accessToken}`,
        cookie: cookieHeader,
        origin: appOrigin,
        referer: `${appOrigin}/`,
      },
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

module.exports = {
  buildCookieHeader,
  checkLiveAuth,
  getLiveAuthConfig,
};
