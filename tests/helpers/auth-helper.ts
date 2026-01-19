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

// 토큰 버퍼 시간 (만료 30분 전에 갱신)
const TOKEN_BUFFER_MS = 30 * 60 * 1000;

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
 * @param bufferMs 버퍼 시간 (기본 30분)
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
    // auto-refresh-token.js 모듈 동적 로드
    const autoRefreshModule = require('../../auto-refresh-token');
    
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
 * 인증된 URL 생성
 * 
 * @param targetPath 대상 경로 (예: '/product/new/list')
 * @returns 토큰이 포함된 전체 URL
 */
export function getAuthenticatedUrl(targetPath: string): string {
  const tokens = getTokens();
  
  if (!tokens) {
    console.warn('⚠️ 토큰 없음 - 인증 없이 접근합니다.');
    return `${BASE_URL}${targetPath}`;
  }
  
  const params = new URLSearchParams({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });
  
  return `${BASE_URL}${targetPath}?${params.toString()}`;
}

/**
 * 테스트에서 사용할 BASE_URL export
 */
export { BASE_URL };
