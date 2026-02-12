/**
 * Admin 인증 Setup 테스트
 * 
 * 어드민 페이지 접근 권한을 확인하고, 토큰 만료 시 자동으로 로그인을 실행합니다.
 * 이 테스트가 Setup Project로 먼저 실행되며, 성공해야만 다른 Admin 테스트가 실행됩니다.
 * 
 * 흐름:
 * 1. 토큰 유효성 확인
 * 2. 토큰 만료 시 → 자동 로그인 시도 (브라우저 열림)
 * 3. 로그인 완료 후 → 인증 검증
 * 4. 인증 성공 → 다른 테스트 실행 가능
 * 
 * @see tests/helpers/admin/test-helpers.ts
 */

import { test, expect, chromium, type Page, type Browser } from '@playwright/test';
import { setupAuthCookies, resetAuthCache } from './helpers/admin';
import {
  isAuthFailed,
  markAuthFailed,
  clearAuthFailed,
  isTokenValidSync,
  getTokenRemaining,
  verifyAuthentication,
  PAGE_LOAD_TIMEOUT,
} from './helpers/admin/test-helpers';
import * as fs from 'fs';
import * as path from 'path';

// 파일 경로
const AUTH_FILE = path.join(process.cwd(), 'auth.json');
const ADMIN_URL = 'https://stage-new-admin.makeuni2026.com';

// ============================================================================
// 자동 로그인 헬퍼 함수
// ============================================================================

/**
 * 브라우저에서 Google 로그인을 실행하고 세션을 저장합니다.
 * 사용자가 수동으로 로그인을 완료할 때까지 대기합니다.
 */
async function performGoogleLogin(): Promise<boolean> {
  console.log('\n🔐 ===========================================');
  console.log('   Google 로그인이 필요합니다!');
  console.log('   브라우저가 열립니다. 로그인을 완료해주세요.');
  console.log('   ===========================================\n');
  
  let browser: Browser | null = null;
  
  try {
    browser = await chromium.launch({
      headless: false,
      slowMo: 100,
    });
    
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
    });
    
    const page = await context.newPage();
    
    // Admin 페이지로 이동 (자동으로 Google 로그인 리다이렉트)
    await page.goto(ADMIN_URL, { waitUntil: 'domcontentloaded' });
    
    console.log('👆 브라우저에서 Google 계정으로 로그인해주세요...');
    console.log('   (로그인 완료 후 자동으로 진행됩니다)\n');
    
    // 로그인 완료 대기 (최대 3분)
    // Admin 페이지에서 실제 콘텐츠가 로드될 때까지 대기
    let loginSuccess = false;
    
    try {
      // 방법 1: Admin 페이지의 실제 콘텐츠 요소 대기
      await page.waitForSelector('aside, nav, [class*="sidebar"], [class*="menu"], h1', { 
        timeout: 180000,
        state: 'visible'
      });
      
      // 로그인 페이지가 아닌지 확인
      const currentUrl = page.url();
      if (!currentUrl.includes('auth') && !currentUrl.includes('accounts.google.com')) {
        loginSuccess = true;
      }
    } catch (e) {
      // 요소를 찾지 못함
    }
    
    if (!loginSuccess) {
      console.log('⚠️ 로그인 시간 초과 또는 실패');
      return false;
    }
    
    // refresh_token 또는 access_token 쿠키가 설정될 때까지 추가 대기
    console.log('⏳ 인증 토큰 설정 대기 중...');
    let tokenFound = false;
    for (let i = 0; i < 30; i++) { // 최대 15초 대기
      const cookies = await context.cookies();
      const hasRefreshToken = cookies.some(c => c.name === 'refresh_token');
      const hasAccessToken = cookies.some(c => c.name === 'access_token');
      
      if (hasRefreshToken || hasAccessToken) {
        tokenFound = true;
        console.log(`   ✅ 토큰 쿠키 발견: ${hasRefreshToken ? 'refresh_token ' : ''}${hasAccessToken ? 'access_token' : ''}`);
        break;
      }
      
      // 페이지 새로고침 또는 대기
      await page.waitForTimeout(500);
    }
    
    if (!tokenFound) {
      console.log('   ⚠️ 토큰 쿠키를 찾지 못했습니다. 페이지 새로고침 시도...');
      // 페이지 새로고침 후 다시 시도
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);
      
      const cookies = await context.cookies();
      tokenFound = cookies.some(c => c.name === 'refresh_token' || c.name === 'access_token');
    }
    
    // 세션 저장
    const storageState = await context.storageState();
    fs.writeFileSync(AUTH_FILE, JSON.stringify(storageState, null, 2));
    
    console.log('✅ 로그인 완료! 세션이 저장되었습니다.');
    console.log(`   저장 위치: ${AUTH_FILE}`);
    console.log(`   쿠키 수: ${storageState.cookies.length}`);
    
    if (storageState.cookies.length < 10) {
      console.log('   ⚠️ 쿠키 수가 적습니다. 로그인이 완전하지 않을 수 있습니다.');
    }
    console.log('');
    
    return tokenFound || storageState.cookies.length >= 10;
    
  } catch (error: any) {
    console.log(`❌ 로그인 실패: ${error.message}`);
    return false;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// ============================================================================
// 테스트 설정
// ============================================================================
let tokenValid = isTokenValidSync();

// 모바일 뷰포트 스킵 (관리자 페이지는 데스크톱 전용)
test.skip(({ viewport }) => viewport !== null && viewport.width < 1024, '이 테스트는 데스크톱 뷰포트에서만 실행됩니다');

// ============================================================================
// 전역 설정
// ============================================================================
test.beforeAll(async () => {
  resetAuthCache();
  clearAuthFailed(); // 이전 인증 실패 상태 초기화
  
  if (tokenValid) {
    const { hours, minutes } = getTokenRemaining();
    console.log(`\n✅ 토큰 유효 (남은 시간: ${hours}시간 ${minutes}분)`);
  } else {
    console.log('\n⚠️ 토큰이 만료되었습니다. 자동 로그인을 시도합니다...');
    
    // 자동 로그인 실행
    const loginSuccess = await performGoogleLogin();
    
    if (loginSuccess) {
      // 토큰 상태 재확인
      tokenValid = isTokenValidSync();
      if (tokenValid) {
        const { hours, minutes } = getTokenRemaining();
        console.log(`✅ 로그인 후 토큰 유효 (남은 시간: ${hours}시간 ${minutes}분)`);
      }
    } else {
      console.log('\n❌ 자동 로그인 실패!');
      console.log('   테스트를 다시 실행해주세요.\n');
    }
  }
});

test.beforeEach(async ({ page }) => {
  const authStatus = isAuthFailed();
  if (authStatus.failed) {
    console.log(`\n🚫 인증 실패로 테스트 스킵: ${authStatus.reason}`);
    test.skip(true, `인증 실패: ${authStatus.reason}`);
    return;
  }
  
  await setupAuthCookies(page);
});

// ##############################################################################
// 인증 검증 테스트
// ##############################################################################
test.describe.serial('인증 검증', () => {
  test('TC-AUTH-001: 어드민 페이지 접근 인증 확인', async ({ page }) => {
    // 이 테스트가 실패하면 이후 모든 테스트는 스킵됨 (파일 기반 상태 공유)
    const adminUrl = 'https://stage-new-admin.makeuni2026.com/sku/list';
    
    console.log('🔐 어드민 페이지 인증 검증 중...');
    
    // 첫 번째 인증 시도
    await page.goto(adminUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });
    await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
    
    let authResult = await verifyAuthentication(page);
    
    // 인증 실패 시 자동 로그인 시도
    if (!authResult.success) {
      console.log(`\n⚠️ 첫 번째 인증 실패: ${authResult.reason}`);
      console.log('🔑 자동 로그인을 시도합니다...\n');
      
      // 자동 로그인 실행
      const loginSuccess = await performGoogleLogin();
      
      if (loginSuccess) {
        console.log('\n🔄 로그인 완료! 인증 재시도 중...');
        
        // 새 쿠키로 페이지 다시 로드
        await setupAuthCookies(page);
        await page.goto(adminUrl, { waitUntil: 'domcontentloaded', timeout: PAGE_LOAD_TIMEOUT });
        await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
        
        // 두 번째 인증 시도
        authResult = await verifyAuthentication(page);
      } else {
        console.log('\n❌ 자동 로그인 실패!');
        console.log('   브라우저에서 로그인을 완료하지 못했습니다.\n');
      }
    }
    
    // 최종 인증 결과 확인
    if (!authResult.success) {
      const failReason = authResult.reason || '인증 실패';
      
      // 인증 실패 상태를 파일에 기록 (다른 worker들도 확인 가능)
      markAuthFailed(failReason);
      
      console.log(`\n❌ 최종 인증 실패: ${failReason}`);
      console.log('\n🔧 수동 해결 방법:');
      console.log('   node auto-refresh-token.js --setup');
      console.log('\n⚠️ 이후 모든 테스트는 스킵됩니다.\n');
      
      throw new Error(`인증 실패: ${failReason}`);
    }
    
    // 인증 성공 - 이전 인증 실패 상태 초기화
    clearAuthFailed();
    console.log('✅ 인증 검증 완료 - 어드민 페이지 정상 접근 가능');
    
    // 페이지가 정상적으로 로드되었는지 확인
    await expect(page).toHaveURL(/stage-new-admin\.makeuni2026\.com/);
  });
});
