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

// auth-helper에서 CommonJS로 가져오기
const authHelper = require('./auth-helper.js');

// 상수
export const BASE_URL = authHelper.BASE_URL;
export const AUTH_DOMAIN = authHelper.AUTH_DOMAIN;
export const ROOT_DOMAIN = authHelper.ROOT_DOMAIN;
export const ADMIN_BASE_URL = 'https://stage-new-admin.makeuni2026.com';

// 함수들
export const isTokenExpired = authHelper.isTokenExpired;
export const getTokenRemainingMinutes = authHelper.getTokenRemainingMinutes;
export const getAuthenticatedUrl = authHelper.getAuthenticatedUrl;
export const ensureValidToken = authHelper.ensureValidToken;
export const hasValidSession = authHelper.hasValidSession;
export const setupAuthCookies = authHelper.setupAuthCookies;
export const resetAuthCache = authHelper.resetAuthCache;

// 공통 타임아웃 설정
export const TIMEOUTS = {
  NAVIGATION: 30000,
  TABLE_LOAD: 30000,
  NETWORK_IDLE: 10000,
  DEFAULT: 5000,
} as const;

// 공통 셀렉터 패턴
export const COMMON_SELECTORS = {
  table: 'table',
  tableRows: 'table tbody tr',
  tableHeaders: 'table thead th',
  noResultMessage: 'text=검색결과가 없습니다',
  pagination: {
    nav: 'nav[aria-label="Pagination"]',
    previousButton: 'button:has-text("Previous")',
    nextButton: 'button:has-text("Next")',
    pageButton: (num: number) => `button:has-text("${num}")`,
    perPageSelect: 'text=10 / page',
  },
  breadcrumb: 'nav[aria-label="Breadcrumb"]',
  searchButton: 'button:has-text("조회하기")',
  resetButton: 'button:has-text("검색 초기화")',
} as const;
