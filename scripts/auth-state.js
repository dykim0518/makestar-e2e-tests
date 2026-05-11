const fs = require("fs");

function resolveTargetDomain(env = process.env) {
  if (env.AUTH_TARGET_DOMAIN) return env.AUTH_TARGET_DOMAIN;

  const isStg =
    env.MAKESTAR_BASE_URL?.includes("stage") ||
    env.ENVIRONMENT_INPUT === "stg";
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
  if (!token) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString(),
    );
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function getCookieExpiresMs(cookie) {
  const jwtExp = getJwtExpMs(cookie?.value);
  if (jwtExp) return jwtExp;
  if (cookie?.expires && cookie.expires > 0) return cookie.expires * 1000;
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

module.exports = {
  domainMatches,
  findRefreshTokens,
  formatRemaining,
  getCookieExpiresMs,
  getLatestRefreshTokenExpiry,
  getRefreshTokenStatuses,
  getRemainingParts,
  readStorageState,
  resolveTargetDomain,
};
