const fs = require("fs");

function resolveTargetDomain(env = process.env) {
  if (env.AUTH_TARGET_DOMAIN) return env.AUTH_TARGET_DOMAIN;

  const isStg =
    env.MAKESTAR_BASE_URL?.includes("stage") || env.ENVIRONMENT_INPUT === "stg";
  return isStg ? ".makeuni2026.com" : ".makestar.com";
}

function normalizeDomain(domain) {
  if (!domain) return "";
  return domain.startsWith(".") ? domain : `.${domain}`;
}

function domainMatches(cookieDomain, targetDomain) {
  return normalizeDomain(cookieDomain) === normalizeDomain(targetDomain);
}

function getJwtExpMs(token) {
  const payload = getJwtPayload(token);
  return payload?.exp ? payload.exp * 1000 : null;
}

function getJwtPayload(token) {
  if (!token) return null;
  try {
    return JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString());
  } catch {
    return null;
  }
}

function getCookieExpiresMs(cookie) {
  if (cookie?.expires && cookie.expires > 0) return cookie.expires * 1000;
  const jwtExp = getJwtExpMs(cookie?.value);
  if (jwtExp) return jwtExp;
  return null;
}

function readStorageState(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      ok: false,
      code: "missing",
      message: `세션 파일이 없습니다: ${filePath}`,
    };
  }

  try {
    const state = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    return {
      ok: true,
      state,
      cookies: Array.isArray(state.cookies) ? state.cookies : [],
      origins: Array.isArray(state.origins) ? state.origins : [],
    };
  } catch (error) {
    return {
      ok: false,
      code: "parse",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function findRefreshTokens(cookies, targetDomain) {
  const refreshTokens = (cookies || []).filter(
    (cookie) => cookie.name === "refresh_token",
  );
  if (!targetDomain) return refreshTokens;
  return refreshTokens.filter((cookie) =>
    domainMatches(cookie.domain, targetDomain),
  );
}

function getRefreshTokenStatuses(cookies, targetDomain, now = Date.now()) {
  return findRefreshTokens(cookies).map((cookie) => {
    const expiresMs = getCookieExpiresMs(cookie);
    const remaining = expiresMs === null ? null : expiresMs - now;
    return {
      domain: cookie.domain || "unknown",
      isTarget: domainMatches(cookie.domain, targetDomain),
      remaining,
      status:
        remaining === null ? "unknown" : remaining > 0 ? "valid" : "expired",
    };
  });
}

function getLatestRefreshTokenExpiry(cookies, targetDomain) {
  const expiresValues = findRefreshTokens(cookies, targetDomain)
    .map(getCookieExpiresMs)
    .filter((value) => typeof value === "number");
  return expiresValues.length > 0 ? Math.max(...expiresValues) : null;
}

function formatRemaining(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) return `${Math.floor(hours / 24)}일 ${hours % 24}시간`;
  return `${hours}시간 ${minutes}분`;
}

function getRemainingParts(expiresAtMs, now = Date.now()) {
  const remaining = expiresAtMs - now;
  if (remaining <= 0) return { hours: 0, minutes: 0 };

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, minutes };
}

function getAdminTokenExpiryMs(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    const tokens = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const expiresAt = new Date(tokens.expiresAt).getTime();
    return Number.isFinite(expiresAt) ? expiresAt : null;
  } catch {
    return null;
  }
}

function getTokenExpiryIso(token, fallbackMs = 3 * 60 * 60 * 1000) {
  const jwtExp = getJwtExpMs(token);
  if (jwtExp) return new Date(jwtExp).toISOString();
  return new Date(Date.now() + fallbackMs).toISOString();
}

function extractTokenPairFromUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    return {
      accessToken: parsed.searchParams.get("access_token"),
      refreshToken: parsed.searchParams.get("refresh_token"),
    };
  } catch {
    const query = String(rawUrl).split("?")[1] || "";
    const params = new URLSearchParams(query);
    return {
      accessToken: params.get("access_token"),
      refreshToken: params.get("refresh_token"),
    };
  }
}

function extractTokenPairFromLocalStorage(localStorage = {}) {
  return {
    accessToken: localStorage.access_token || null,
    refreshToken: localStorage.refresh_token || null,
    expiresAt: localStorage.token_expires_at || null,
    userInfo: parseJson(localStorage.user_info),
  };
}

function extractTokenPairFromCookies(cookies = []) {
  const accessCookie = cookies.find((cookie) => cookie.name === "access_token");
  const refreshCookie = cookies.find(
    (cookie) => cookie.name === "refresh_token",
  );
  return {
    accessToken: accessCookie?.value || null,
    refreshToken: refreshCookie?.value || null,
  };
}

function mergeTokenPairs(...pairs) {
  return pairs.reduce(
    (merged, pair) => ({
      accessToken: merged.accessToken || pair?.accessToken || null,
      refreshToken: merged.refreshToken || pair?.refreshToken || null,
      expiresAt: merged.expiresAt || pair?.expiresAt || null,
      userInfo: merged.userInfo || pair?.userInfo || null,
    }),
    {
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      userInfo: null,
    },
  );
}

function buildAdminTokenData({
  accessToken,
  refreshToken,
  userInfo,
  expiresAt,
  fallbackExpiresInMs,
}) {
  const jwtPayload = getJwtPayload(accessToken) || {};
  const jwtInfo = jwtPayload.info || {};
  const fallbackInfo = userInfo || {};
  return {
    accessToken,
    refreshToken,
    email:
      jwtInfo.email ||
      jwtInfo.nickname ||
      fallbackInfo.email ||
      fallbackInfo.nickname ||
      "unknown",
    userName:
      jwtInfo.userName ||
      jwtInfo.name ||
      fallbackInfo.userName ||
      fallbackInfo.name ||
      "unknown",
    isAdmin: Boolean(
      fallbackInfo.isAdmin || jwtInfo.isAdmin || jwtPayload.is_admin,
    ),
    expiresAt: expiresAt || getTokenExpiryIso(accessToken, fallbackExpiresInMs),
    userId: jwtInfo.userId || fallbackInfo.userId || jwtPayload.user_id || 0,
    savedAt: new Date().toISOString(),
  };
}

function mergeCookies(existingCookies, newCookies) {
  const map = new Map();
  for (const cookie of existingCookies || []) {
    map.set(`${cookie.name}@@${cookie.domain}`, cookie);
  }
  for (const cookie of newCookies || []) {
    map.set(`${cookie.name}@@${cookie.domain}`, cookie);
  }
  return [...map.values()];
}

function parseJson(value) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * refresh grant로 받은 새 토큰을 storageState JSON에 주입한다 (in-place 수정 후 반환).
 * - access_token: appOrigin localStorage에 반영 (live-auth-check가 여기서 읽음)
 * - refresh_token(rotation 시에만 전달): appOrigin localStorage + cookieDomain refresh_token
 *   쿠키에 반영. needsRefresh는 쿠키 refresh_token 만료를 보므로 쿠키 갱신이 필수다.
 */
function applyTokenPair(state, { access, refresh, appOrigin, cookieDomain }) {
  if (!state || typeof state !== "object") return state;
  state.origins = Array.isArray(state.origins) ? state.origins : [];
  state.cookies = Array.isArray(state.cookies) ? state.cookies : [];

  let origin = state.origins.find((o) => o.origin === appOrigin);
  if (!origin) {
    origin = { origin: appOrigin, localStorage: [] };
    state.origins.push(origin);
  }
  origin.localStorage = Array.isArray(origin.localStorage)
    ? origin.localStorage
    : [];

  const setItem = (name, value) => {
    const entry = origin.localStorage.find((e) => e.name === name);
    if (entry) entry.value = value;
    else origin.localStorage.push({ name, value });
  };

  if (access) setItem("access_token", access);

  if (refresh) {
    setItem("refresh_token", refresh);
    const expMs = getJwtExpMs(refresh);
    const expiresSec = expMs ? Math.floor(expMs / 1000) : undefined;
    for (const cookie of state.cookies) {
      if (
        cookie.name === "refresh_token" &&
        (!cookieDomain || domainMatches(cookie.domain, cookieDomain))
      ) {
        cookie.value = refresh;
        if (expiresSec !== undefined) cookie.expires = expiresSec;
      }
    }
  }

  return state;
}

module.exports = {
  applyTokenPair,
  buildAdminTokenData,
  domainMatches,
  extractTokenPairFromCookies,
  extractTokenPairFromLocalStorage,
  extractTokenPairFromUrl,
  findRefreshTokens,
  formatRemaining,
  getAdminTokenExpiryMs,
  getCookieExpiresMs,
  getJwtPayload,
  getLatestRefreshTokenExpiry,
  getRefreshTokenStatuses,
  getRemainingParts,
  getTokenExpiryIso,
  mergeCookies,
  mergeTokenPairs,
  readStorageState,
  resolveTargetDomain,
};
