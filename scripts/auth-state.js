const fs = require("fs");
const path = require("path");

const DEFAULT_BUFFER_MS = 60 * 1000;
const GOOGLE_SESSION_COOKIE_NAMES = new Set(["SID", "SSID", "HSID"]);

function isStageEnv(env = process.env) {
  const authOverride = env.AUTH_FILE_PATH || "";
  return (
    authOverride.includes("stg-auth.json") ||
    env.MAKESTAR_BASE_URL?.includes("stage") ||
    env.ENVIRONMENT_INPUT === "stg"
  );
}

function getAuthFilePath({ cwd = process.cwd(), env = process.env } = {}) {
  if (env.AUTH_FILE_PATH) {
    return path.resolve(cwd, env.AUTH_FILE_PATH);
  }
  return path.join(cwd, isStageEnv(env) ? "stg-auth.json" : "auth.json");
}

function getAdminTokensFilePath({ cwd = process.cwd() } = {}) {
  return path.join(cwd, "admin-tokens.json");
}

function loadJsonFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, data: null, error: null };
  }

  try {
    return {
      exists: true,
      data: JSON.parse(fs.readFileSync(filePath, "utf-8")),
      error: null,
    };
  } catch (error) {
    return { exists: true, data: null, error };
  }
}

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = normalized.length % 4;
  const padded =
    padding === 0 ? normalized : normalized + "=".repeat(4 - padding);
  return Buffer.from(padded, "base64").toString("utf-8");
}

function getJwtExpMs(token) {
  if (typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function getCookieExpiryMs(cookie) {
  if (!cookie) return null;

  const jwtExp = cookie.value ? getJwtExpMs(cookie.value) : null;
  if (jwtExp) return jwtExp;

  if (typeof cookie.expires === "number" && cookie.expires > 0) {
    return cookie.expires * 1000;
  }

  return null;
}

function hasGoogleSessionCookies(cookies = []) {
  return cookies.some(
    (cookie) =>
      cookie?.domain?.includes("google.com") &&
      GOOGLE_SESSION_COOKIE_NAMES.has(cookie.name),
  );
}

function hasMockAuthData(authData) {
  return Boolean(
    authData?.cookies?.some(
      (cookie) =>
        cookie?.value?.includes("mock_session") ||
        cookie?.value?.includes("mock_token"),
    ),
  );
}

function findRefreshTokens(cookies = []) {
  return cookies.filter((cookie) => cookie?.name === "refresh_token");
}

function getRefreshTokenStates(cookies = [], now = Date.now()) {
  return findRefreshTokens(cookies)
    .map((cookie) => {
      const expiresAtMs = getCookieExpiryMs(cookie);
      const remainingMs = expiresAtMs ? expiresAtMs - now : null;

      let status = "unknown";
      if (typeof remainingMs === "number") {
        status = remainingMs > 0 ? "valid" : "expired";
      }

      return {
        cookie,
        domain: cookie.domain || "unknown",
        expiresAtMs,
        remainingMs,
        status,
      };
    })
    .sort((left, right) => {
      const leftValue = left.expiresAtMs ?? Number.NEGATIVE_INFINITY;
      const rightValue = right.expiresAtMs ?? Number.NEGATIVE_INFINITY;
      return rightValue - leftValue;
    });
}

function getBestRefreshTokenState(cookies = [], now = Date.now()) {
  return getRefreshTokenStates(cookies, now)[0] || null;
}

function getBrowserAuthState({
  cwd = process.cwd(),
  env = process.env,
  bufferMs = DEFAULT_BUFFER_MS,
} = {}) {
  const authFilePath = getAuthFilePath({ cwd, env });
  const authFile = loadJsonFile(authFilePath);
  const authData = authFile.data;
  const cookies = Array.isArray(authData?.cookies) ? authData.cookies : [];
  const refreshTokens = getRefreshTokenStates(cookies);
  const bestRefreshToken = refreshTokens[0] || null;
  const remainingMs = bestRefreshToken?.remainingMs ?? 0;

  return {
    authFilePath,
    exists: authFile.exists,
    parseError: authFile.error,
    authData,
    cookies,
    refreshTokens,
    bestRefreshToken,
    remainingMs,
    valid: remainingMs > bufferMs,
    hasUsableCookies: cookies.length > 0,
    hasGoogleSession: hasGoogleSessionCookies(cookies),
    hasMockData: hasMockAuthData(authData),
  };
}

function getSystemTokenState({
  cwd = process.cwd(),
  bufferMs = DEFAULT_BUFFER_MS,
} = {}) {
  const filePath = getAdminTokensFilePath({ cwd });
  const tokensFile = loadJsonFile(filePath);
  const expiresAtMs = tokensFile.data?.expiresAt
    ? new Date(tokensFile.data.expiresAt).getTime()
    : null;
  const remainingMs = expiresAtMs ? expiresAtMs - Date.now() : 0;

  return {
    filePath,
    exists: tokensFile.exists,
    parseError: tokensFile.error,
    tokens: tokensFile.data,
    expiresAtMs,
    remainingMs,
    valid: remainingMs > bufferMs,
  };
}

function shouldRefreshBrowserAuth({
  browserAuthState,
  thresholdMs,
  force = false,
} = {}) {
  if (force) return true;
  const remainingMs = browserAuthState?.bestRefreshToken?.remainingMs;
  if (typeof remainingMs !== "number") return true;
  return remainingMs < thresholdMs;
}

function mergeCookies(existingCookies = [], newCookies = []) {
  const map = new Map();

  for (const cookie of existingCookies) {
    map.set(`${cookie.name}@@${cookie.domain}`, cookie);
  }

  for (const cookie of newCookies) {
    map.set(`${cookie.name}@@${cookie.domain}`, cookie);
  }

  return [...map.values()];
}

function formatRemaining(ms) {
  if (!Number.isFinite(ms) || ms <= 0) {
    return "0시간 0분";
  }

  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) {
    return `${days}일 ${hours}시간`;
  }

  return `${hours}시간 ${minutes}분`;
}

module.exports = {
  DEFAULT_BUFFER_MS,
  findRefreshTokens,
  formatRemaining,
  getAdminTokensFilePath,
  getAuthFilePath,
  getBestRefreshTokenState,
  getBrowserAuthState,
  getCookieExpiryMs,
  getJwtExpMs,
  getRefreshTokenStates,
  getSystemTokenState,
  hasGoogleSessionCookies,
  hasMockAuthData,
  isStageEnv,
  loadJsonFile,
  mergeCookies,
  shouldRefreshBrowserAuth,
};
