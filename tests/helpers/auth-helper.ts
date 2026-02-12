/**
 * 관리자 테스트용 인증 헬퍼
 * 
 * 토큰 관리 및 자동 갱신 기능을 제공합니다.
 * 
 * 사용법:
 *   import { getAuthenticatedUrl, ensureValidToken } from './helpers/auth-helper';
 *   
 *   test.beforeAll(async () => {
 *     await ensureValidToken();
 *   });
 *   
 *   const url = getAuthenticatedUrl('/product/new/list');
 */

import * as fs from 'fs';
import * as path from 'path';

// 상수 정의
const BASE_URL = 'https://stage-new-admin.makeuni2026.com';
const TOKENS_FILE = path.join(__dirname, '..', '..', 'admin-tokens.json');

// 토큰 버퍼 시간 (만료 1분 전까지 유효하게 - 최대한 오래 사용)
// 서버 토큰 유효기간: Access 3시간, Refresh 12시간
const TOKEN_BUFFER_MS = 1 * 60 * 1000;

interface TokenData {
  accessToken: string;
  refreshToken: string;
  email: string;
  userName: string;
  isAdmin: boolean;
  expiresAt: string;
  userId: number;
  savedAt: string;
}

/**
 * 토큰 파일 읽기
 */
export function getTokens(): TokenData | null {
  try {
    if (!fs.existsSync(TOKENS_FILE)) {
      console.warn('⚠️ admin-tokens.json not found.');
      return null;
    }
    return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf-8'));
  } catch (e) {
    console.error('❌ 토큰 파일 읽기 실패:', e);
    return null;
  }
}

/**
 * 토큰 만료 여부 확인
 * @param bufferMs 버퍼 시간 (기본 1분) - 최대한 오래 사용하도록 최소화
 */
export function isTokenExpired(bufferMs: number = TOKEN_BUFFER_MS): boolean {
  const tokens = getTokens();
  if (!tokens) return true;
  
  const expiresAt = new Date(tokens.expiresAt).getTime();
  const now = Date.now();
  
  return expiresAt - bufferMs <= now;
}

/**
 * 토큰 남은 시간 (분 단위)
 */
export function getTokenRemainingMinutes(): number {
  const tokens = getTokens();
  if (!tokens) return 0;
  
  const expiresAt = new Date(tokens.expiresAt).getTime();
  const now = Date.now();
  const remaining = expiresAt - now;
  
  return Math.max(0, Math.floor(remaining / (1000 * 60)));
}

/**
 * auto-refresh-token.js의 autoRefreshToken 함수 호출
 * 
 * 브라우저 세션을 사용하여 토큰을 갱신합니다.
 */
async function callAutoRefreshToken(): Promise<boolean> {
  try {
    // auto-refresh-token.js 모듈 동적 로드 (프로젝트 루트 기준)
    const path = require('path');
    const projectRoot = path.resolve(__dirname, '../../..');
    const autoRefreshModule = require(path.join(projectRoot, 'auto-refresh-token'));
    
    if (typeof autoRefreshModule.autoRefreshToken === 'function') {
      return await autoRefreshModule.autoRefreshToken();
    }
    
    console.warn('⚠️ autoRefreshToken 함수를 찾을 수 없습니다.');
    return false;
  } catch (e) {
    console.error('❌ 토큰 갱신 모듈 로드 실패:', e);
    return false;
  }
}

/**
 * 토큰이 유효한지 확인하고, 필요시 자동 갱신
 * 
 * 테스트의 beforeAll에서 호출하여 사용
 */
export async function ensureValidToken(): Promise<boolean> {
  const tokens = getTokens();
  
  if (!tokens) {
    console.error('❌ 저장된 토큰이 없습니다.');
    console.log('   다음 명령어로 로그인해주세요:');
    console.log('   node auto-refresh-token.js --setup\n');
    return false;
  }
  
  // 토큰이 아직 유효하면 그대로 사용
  if (!isTokenExpired()) {
    const remainingMinutes = getTokenRemainingMinutes();
    console.log(`✅ 토큰 유효 (남은 시간: ${Math.floor(remainingMinutes / 60)}시간 ${remainingMinutes % 60}분)`);
    return true;
  }
  
  // 토큰이 만료되었거나 곧 만료됨 - 자동 갱신 시도
  console.log('⚠️ 토큰이 만료되었거나 곧 만료됩니다. 자동 갱신을 시도합니다...');
  
  const success = await callAutoRefreshToken();
  
  if (success) {
    // 갱신 후 다시 확인
    const newRemainingMinutes = getTokenRemainingMinutes();
    console.log(`✅ 토큰 갱신 성공! (남은 시간: ${Math.floor(newRemainingMinutes / 60)}시간 ${newRemainingMinutes % 60}분)`);
    return true;
  }
  
  console.error('❌ 토큰 자동 갱신 실패');
  console.log('   다음 명령어로 재로그인해주세요:');
  console.log('   node auto-refresh-token.js --setup\n');
  return false;
}

/**
 * 인증된 URL 생성 (토큰 없이 경로만 반환)
 * 
 * 보안 개선: 토큰을 URL 쿼리에 노출하지 않습니다.
 * 대신 setupAuthCookies()를 beforeEach에서 호출하여 쿠키로 인증합니다.
 * 
 * @param targetPath 대상 경로 (예: '/product/new/list')
 * @returns 전체 URL (토큰 미포함)
 */
export function getAuthenticatedUrl(targetPath: string): string {
  return `${BASE_URL}${targetPath}`;
}

/**
 * 페이지 컨텍스트에 인증 쿠키 설정
 * 
 * auth.json에 저장된 모든 쿠키를 브라우저 컨텍스트에 주입합니다.
 * 테스트의 beforeEach에서 page.goto() 전에 호출하세요.
 * 
 * @param page Playwright Page 객체
 * @returns 설정 성공 여부
 * 
 * @example
 * test.beforeEach(async ({ page }) => {
 *   await setupAuthCookies(page);
 *   await page.goto(getAuthenticatedUrl('/product/new/list'));
 * });
 */
export async function setupAuthCookies(page: import('@playwright/test').Page): Promise<boolean> {
  // auth.json에서 모든 쿠키 로드
  const authFile = path.join(__dirname, '..', '..', 'auth.json');
  
  try {
    if (!fs.existsSync(authFile)) {
      console.warn('⚠️ auth.json 없음 - 인증 없이 접근합니다.');
      return false;
    }
    
    const auth = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
    
    if (!auth.cookies || auth.cookies.length === 0) {
      console.warn('⚠️ auth.json에 쿠키가 없습니다.');
      return false;
    }
    
    // refresh_token 유효성 확인
    const rtCookie = auth.cookies.find((c: any) => c.name === 'refresh_token');
    if (rtCookie?.value) {
      try {
        const payload = JSON.parse(Buffer.from(rtCookie.value.split('.')[1], 'base64').toString());
        const expiresAt = payload.exp * 1000;
        const now = Date.now();
        if (expiresAt <= now) {
          console.warn('⚠️ auth.json의 refresh_token이 만료되었습니다.');
          console.log('   재로그인이 필요합니다: npx playwright test tests/save-auth.spec.ts --headed');
          return false;
        }
        console.log(`✅ auth.json refresh_token 유효`);
      } catch (e) {
        console.warn('⚠️ refresh_token 파싱 실패');
      }
    }
    
    console.log(`✅ auth.json 로드됨 (쿠키 ${auth.cookies.length}개)`);
    
    const context = page.context();
    
    // admin 도메인 쿠키만 필터링 (stage-new-admin.makeuni2026.com, .makeuni2026.com)
    const adminCookies = auth.cookies.filter((cookie: any) => {
      const domain = cookie.domain || '';
      return domain.includes('makeuni2026.com') && 
             (domain.includes('admin') || domain.startsWith('.'));
    });
    
    if (adminCookies.length > 0) {
      await context.addCookies(adminCookies);
      console.log(`✅ auth.json 쿠키 설정 완료 (${adminCookies.length}개)`);
    } else {
      // 도메인 필터링 없이 모든 쿠키 설정 시도
      await context.addCookies(auth.cookies);
      console.log(`✅ auth.json 전체 쿠키 설정 완료 (${auth.cookies.length}개)`);
    }
    
    return true;
  } catch (e) {
    console.error('❌ auth.json 로드 실패:', e);
    return false;
  }
}

/**
 * 테스트에서 사용할 BASE_URL export
 */
export { BASE_URL };
