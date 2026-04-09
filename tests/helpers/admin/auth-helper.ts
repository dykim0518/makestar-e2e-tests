/**
 * 관리자 테스트용 인증 헬퍼 (TypeScript)
 *
 * auth.json 기반으로 인증을 관리합니다.
 */

import * as fs from "fs";
import * as path from "path";
import type { Page } from "@playwright/test";

// ============================================================================
// 상수
// ============================================================================

export const BASE_URL = "https://stage-new-admin.makeuni2026.com";
export const AUTH_DOMAIN = "stage-auth.makeuni2026.com";
export const ROOT_DOMAIN = ".makeuni2026.com";

const AUTH_FILE = path.join(__dirname, "..", "..", "..", "auth.json");
const TOKEN_BUFFER_MS = 1 * 60 * 1000; // 1분

// ============================================================================
// 타입 정의
// ============================================================================

type RawCookie = {
  name: string;
  value?: string;
  domain?: string;
  path?: string;
  expires?: number;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
};

type AuthData = {
  cookies?: RawCookie[];
  localStorage?: Record<string, string>;
};

type AuthSetupCache = {
  setupComplete: boolean;
  lastSetup: number;
};

// ============================================================================
// 인증 캐시
// ============================================================================

let authSetupCache: AuthSetupCache = {
  setupComplete: false,
  lastSetup: 0,
};

// ============================================================================
// 유틸리티 함수
// ============================================================================

/**
 * 토큰 만료 여부 확인
 */
export function isTokenExpired(bufferMs: number = TOKEN_BUFFER_MS): boolean {
  if (!fs.existsSync(AUTH_FILE)) return true;
  try {
    const auth: AuthData = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    const rtCookie = auth.cookies?.find((c) => c.name === "refresh_token");
    if (!rtCookie?.value) return true;
    const payload = JSON.parse(
      Buffer.from(rtCookie.value.split(".")[1], "base64").toString(),
    );
    const expiresAt = new Date(payload.exp * 1000).getTime();
    return expiresAt - bufferMs <= Date.now();
  } catch {
    return true;
  }
}

/**
 * 토큰 남은 시간 (분 단위)
 */
export function getTokenRemainingMinutes(): number {
  if (!fs.existsSync(AUTH_FILE)) return 0;
  try {
    const auth: AuthData = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    const rtCookie = auth.cookies?.find((c) => c.name === "refresh_token");
    if (!rtCookie?.value) return 0;
    const payload = JSON.parse(
      Buffer.from(rtCookie.value.split(".")[1], "base64").toString(),
    );
    const expiresAt = new Date(payload.exp * 1000).getTime();
    const remaining = expiresAt - Date.now();
    return Math.max(0, Math.floor(remaining / (1000 * 60)));
  } catch {
    return 0;
  }
}

/**
 * 인증된 URL 생성
 */
export function getAuthenticatedUrl(
  targetPath: string,
  includeToken: boolean = true,
): string {
  if (!includeToken) return BASE_URL + targetPath;
  try {
    if (fs.existsSync(AUTH_FILE)) {
      const authData: AuthData = JSON.parse(
        fs.readFileSync(AUTH_FILE, "utf-8"),
      );
      const rtCookie = authData.cookies?.find(
        (c) => c.name === "refresh_token",
      );
      if (rtCookie?.value) {
        const separator = targetPath.indexOf("?") !== -1 ? "&" : "?";
        return (
          BASE_URL +
          targetPath +
          separator +
          "refresh_token=" +
          encodeURIComponent(rtCookie.value)
        );
      }
    }
  } catch {
    // ignore
  }
  return BASE_URL + targetPath;
}

/**
 * 토큰 유효성 확인
 */
export async function ensureValidToken(): Promise<boolean> {
  if (!fs.existsSync(AUTH_FILE)) {
    console.error("❌ auth.json이 없습니다.");
    console.log("   node token-manager.js --setup 명령으로 로그인하세요.");
    return false;
  }
  if (!isTokenExpired()) {
    const remainingMinutes = getTokenRemainingMinutes();
    console.log(
      `✅ refresh_token 유효 (남은 시간: ${Math.floor(remainingMinutes / 60)}시간 ${remainingMinutes % 60}분)`,
    );
    return true;
  }
  console.warn("⚠️ refresh_token이 만료됨. node token-manager.js --setup 필요");
  return false;
}

/**
 * 세션 유효성 확인 (sessionid 쿠키 기반)
 */
export function hasValidSession(): boolean {
  if (!fs.existsSync(AUTH_FILE)) return false;
  try {
    const auth: AuthData = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    const sessionCookie = auth.cookies?.find((c) => c.name === "sessionid");
    if (sessionCookie?.value) {
      if (typeof sessionCookie.expires === "number") {
        return sessionCookie.expires * 1000 > Date.now();
      }
      return true; // expires가 없으면 세션 쿠키로 간주
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * 페이지 컨텍스트에 인증 쿠키 설정
 */
export async function setupAuthCookies(page: Page): Promise<boolean> {
  const context = page.context();
  const adminDomain = BASE_URL.replace(/^https?:\/\//, "").split("/")[0];

  // 캐시 확인 (5분 내 설정했으면 스킵)
  const now = Date.now();
  if (
    authSetupCache.setupComplete &&
    now - authSetupCache.lastSetup < 5 * 60 * 1000
  ) {
    return true;
  }

  if (!fs.existsSync(AUTH_FILE)) {
    console.warn("⚠️ auth.json이 없습니다.");
    return false;
  }

  try {
    const authData: AuthData = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));

    if (authData.cookies && authData.cookies.length > 0) {
      const targetDomains = [adminDomain, AUTH_DOMAIN, ROOT_DOMAIN];
      const whitelist = [
        "csrftoken",
        "sessionid",
        "refresh_token",
        "i18n_redirected",
      ];
      const cookiesToSet: object[] = [];

      for (const raw of authData.cookies) {
        if (!raw.domain || !raw.domain.includes("makeuni2026.com")) continue;
        if (!whitelist.includes(raw.name)) continue;

        const base = {
          name: String(raw.name),
          value: String(raw.value ?? ""),
          path: raw.path ?? "/",
          httpOnly: !!raw.httpOnly,
          secure: !!raw.secure,
          sameSite: (["Lax", "None", "Strict"].includes(raw.sameSite ?? "")
            ? raw.sameSite
            : "Lax") as "Lax" | "None" | "Strict",
          ...(typeof raw.expires === "number"
            ? { expires: Math.floor(raw.expires) }
            : {}),
        };

        for (const domain of targetDomains) {
          cookiesToSet.push({ ...base, domain });
        }
      }

      if (cookiesToSet.length > 0) {
        await context.addCookies(
          cookiesToSet as Parameters<typeof context.addCookies>[0],
        );
        console.log(`✅ auth.json 쿠키 설정 완료 (${cookiesToSet.length}개)`);
      }
    }

    // localStorage 토큰이 있으면 주입
    const ls = authData.localStorage;
    if (ls) {
      const lsAccess = ls["access_token"];
      const lsRefresh = ls["refresh_token"];

      if (lsAccess && lsRefresh) {
        await page.addInitScript(
          (tokens) => {
            localStorage.setItem("access_token", tokens.accessToken);
            localStorage.setItem("refresh_token", tokens.refreshToken);
            if (tokens.userInfo) {
              localStorage.setItem(
                "user_info",
                JSON.stringify(tokens.userInfo),
              );
            }
            if (tokens.expiresAt) {
              localStorage.setItem("token_expires_at", tokens.expiresAt);
            }
          },
          {
            accessToken: lsAccess,
            refreshToken: lsRefresh,
            userInfo: (() => {
              try {
                return JSON.parse(ls["user_info"] ?? "null");
              } catch {
                return null;
              }
            })(),
            expiresAt: ls["token_expires_at"] ?? null,
          },
        );
        console.log("✅ auth.json 로컬스토리지 토큰 설정 완료");
      }
    }

    authSetupCache.setupComplete = true;
    authSetupCache.lastSetup = now;
    return true;
  } catch (e: unknown) {
    console.warn("⚠️ auth.json 파싱 실패:", (e as Error).message);
    return false;
  }
}

/**
 * 인증 캐시 초기화
 */
export function resetAuthCache(): void {
  authSetupCache = { setupComplete: false, lastSetup: 0 };
}

// ============================================================================
// API 인터셉터 (Bearer Token 자동 주입)
// ============================================================================

const ADMIN_TOKENS_FILE = path.join(
  __dirname,
  "..",
  "..",
  "..",
  "admin-tokens.json",
);

type AdminTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  isSystemToken?: boolean;
};

let cachedSystemToken: string | null = null;

/**
 * admin-tokens.json에서 시스템 토큰(access token) 가져오기
 */
export function getSystemToken(): string | null {
  if (cachedSystemToken) return cachedSystemToken;

  try {
    if (!fs.existsSync(ADMIN_TOKENS_FILE)) {
      console.warn("⚠️ admin-tokens.json이 없습니다.");
      return null;
    }

    const tokens: AdminTokens = JSON.parse(
      fs.readFileSync(ADMIN_TOKENS_FILE, "utf-8"),
    );
    if (tokens.accessToken) {
      cachedSystemToken = tokens.accessToken;
      console.log("✅ 시스템 토큰 로드 완료 (admin-tokens.json)");
      return cachedSystemToken;
    }
  } catch (e) {
    console.warn("⚠️ admin-tokens.json 파싱 실패:", (e as Error).message);
  }

  return null;
}

/**
 * 모든 Admin API 요청에 Authorization 헤더를 자동으로 추가합니다.
 *
 * 테스트의 beforeEach 또는 페이지 초기화 시 호출해야 합니다.
 *
 * @param page - Playwright Page 인스턴스
 * @returns 설정 성공 여부
 *
 * @example
 * ```typescript
 * test.beforeEach(async ({ page }) => {
 *   await setupApiInterceptor(page);
 * });
 * ```
 */
export async function setupApiInterceptor(page: Page): Promise<boolean> {
  const token = getSystemToken();
  if (!token) {
    console.warn(
      "⚠️ 시스템 토큰을 찾을 수 없어 API 인터셉터를 설정하지 않습니다.",
    );
    return false;
  }

  // Admin API 엔드포인트 패턴
  const adminApiPattern =
    /^https:\/\/(stage-new-admin|stage-api|stage-auth)\.makeuni2026\.com\/.*/;

  await page.route(adminApiPattern, async (route, request) => {
    const headers = {
      ...request.headers(),
      Authorization: `Bearer ${token}`,
    };

    // 원래 요청을 수정된 헤더로 계속 진행
    await route.continue({ headers });
  });

  console.log("✅ API 인터셉터 설정 완료 (Bearer Token 자동 주입)");
  return true;
}

/**
 * 시스템 토큰 캐시 초기화
 */
export function resetSystemTokenCache(): void {
  cachedSystemToken = null;
}
