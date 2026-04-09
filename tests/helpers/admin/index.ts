/**
 * Admin 테스트 공통 헬퍼 모듈
 *
 * 이 모듈은 admin 관련 테스트에서 사용하는 공통 함수들을 제공합니다.
 *
 * 사용법:
 *   import {
 *     ensureValidToken,
 *     setupAuthCookies,
 *     getAuthenticatedUrl,
 *     isTokenExpired,
 *     hasValidSession
 *   } from './helpers/admin';
 */

export {
  BASE_URL,
  AUTH_DOMAIN,
  ROOT_DOMAIN,
  isTokenExpired,
  getTokenRemainingMinutes,
  getAuthenticatedUrl,
  ensureValidToken,
  hasValidSession,
  setupAuthCookies,
  resetAuthCache,
  // API 인터셉터 (Bearer Token 자동 주입)
  getSystemToken,
  setupApiInterceptor,
  resetSystemTokenCache,
} from "./auth-helper";

export { performGoogleLogin } from "./google-login";
export { initPageWithRecovery } from "./page-recovery";

export const ADMIN_BASE_URL = "https://stage-new-admin.makeuni2026.com";

// 공통 타임아웃 설정
export const TIMEOUTS = {
  NAVIGATION: 30000,
  TABLE_LOAD: 30000,
  NETWORK_IDLE: 10000,
  DEFAULT: 5000,
} as const;
