/**
 * AlbumBuddy 로그인 세션 저장 테스트
 * 
 * 사용법:
 *   npx playwright test tests/ab-save-auth.spec.ts --headed --project=chromium
 * 
 * 브라우저가 열리면 수동으로 로그인하고, 로그인 완료 후 자동으로 세션이 저장됩니다.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AB_AUTH_FILE = path.join(__dirname, '..', 'ab-auth.json');
const ALBUMBUDDY_BASE_URL = 'https://albumbuddy.kr';

/**
 * 기존 세션이 유효한지 확인 (headless 모드용)
 */
async function checkExistingSession(page: any): Promise<boolean> {
  if (!fs.existsSync(AB_AUTH_FILE)) {
    return false;
  }
  
  try {
    const authData = JSON.parse(fs.readFileSync(AB_AUTH_FILE, 'utf-8'));
    const cookies = authData.cookies || [];
    const now = Date.now() / 1000;
    const validCookies = cookies.filter((c: any) => !c.expires || c.expires > now);
    
    if (validCookies.length === 0) {
      return false;
    }
    
    // 실제 페이지에서 세션 유효성 확인
    await page.context().addCookies(cookies);
    await page.goto(`${ALBUMBUDDY_BASE_URL}/dashboard/purchasing`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    const currentUrl = page.url();
    return currentUrl.includes('purchasing') && !currentUrl.includes('login');
  } catch {
    return false;
  }
}

test('AlbumBuddy 로그인 세션 저장 (수동 로그인)', async ({ page, context, headless }) => {
  // headless 모드에서는 기존 세션 유효성만 확인 (수동 로그인 불가)
  // @ts-ignore - headless는 playwright 테스트 컨텍스트에서 제공되지 않으므로 use 설정에서 확인
  const isHeadless = !process.env.HEADED && process.env.CI !== undefined;
  
  if (isHeadless || process.env.CI) {
    console.log('📋 Headless/CI 모드: 기존 세션 유효성 확인');
    const sessionValid = await checkExistingSession(page);
    if (sessionValid) {
      console.log('✅ 기존 세션이 유효합니다. 수동 로그인 생략.');
      return;
    }
    console.log('❌ 세션이 유효하지 않습니다. 수동 로그인이 필요합니다.');
    console.log('   npx playwright test tests/ab-save-auth.spec.ts --headed --project=chromium');
    throw new Error('세션 만료 또는 없음 - 수동 로그인 필요 (--headed 모드로 실행)');
  }
  
  test.setTimeout(300000); // 5분 timeout
  
  console.log('');
  console.log('='.repeat(70));
  console.log('🔐 AlbumBuddy 로그인 세션 저장 도구');
  console.log('='.repeat(70));
  console.log('');
  
  // AlbumBuddy 홈페이지로 이동
  console.log('🌐 AlbumBuddy 페이지로 이동 중...');
  await page.goto(`${ALBUMBUDDY_BASE_URL}/shop`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  
  // Dashboard 버튼 클릭하여 로그인 페이지로 이동
  console.log('🔄 Dashboard 클릭하여 로그인 페이지로 이동...');
  const dashboardBtn = page.getByRole('button', { name: 'Dashboard' });
  if (await dashboardBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
    await dashboardBtn.click();
    await page.waitForTimeout(2000);
  }
  
  console.log('');
  console.log('┌' + '─'.repeat(68) + '┐');
  console.log('│' + ' '.repeat(20) + '📋 로그인 안내' + ' '.repeat(33) + '│');
  console.log('├' + '─'.repeat(68) + '┤');
  console.log('│ 1. 브라우저에서 이메일/비밀번호로 로그인하세요                   │');
  console.log('│ 2. 로그인 완료 후 Dashboard 페이지로 이동되면 자동 저장됩니다    │');
  console.log('│ 3. 최대 3분 동안 대기합니다                                      │');
  console.log('└' + '─'.repeat(68) + '┘');
  console.log('');
  
  // 로그인 완료 대기
  let loginSuccess = false;
  const maxWaitTime = 180000; // 3분
  const checkInterval = 2000; // 2초마다 확인
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const currentUrl = page.url();
    
    // 로그인 성공 조건: dashboard에 있고 login/auth가 아닌 경우
    if ((currentUrl.includes('dashboard') || currentUrl.includes('purchasing') || currentUrl.includes('package')) && 
        !currentUrl.includes('login') && 
        !currentUrl.includes('auth')) {
      loginSuccess = true;
      console.log('');
      console.log('✅ 로그인 감지! 세션 저장 중...');
      break;
    }
    
    // shop 페이지에서 로그인 상태 확인 (쿠키 기반)
    if (currentUrl.includes('/shop')) {
      // Dashboard로 이동 시도
      await page.goto(`${ALBUMBUDDY_BASE_URL}/dashboard/purchasing`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      
      const afterUrl = page.url();
      if (afterUrl.includes('purchasing') && !afterUrl.includes('login')) {
        loginSuccess = true;
        console.log('');
        console.log('✅ 로그인 성공! 세션 저장 중...');
        break;
      }
    }
    
    await page.waitForTimeout(checkInterval);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    process.stdout.write(`\r⏳ 로그인 대기 중... (${elapsed}초/${maxWaitTime / 1000}초)`);
  }
  
  console.log('');
  
  if (loginSuccess) {
    // 세션 저장
    await context.storageState({ path: AB_AUTH_FILE });
    
    console.log('');
    console.log('='.repeat(70));
    console.log('🎉 AlbumBuddy 로그인 세션 저장 완료!');
    console.log('='.repeat(70));
    console.log('');
    console.log(`📁 저장 위치: ${AB_AUTH_FILE}`);
    console.log('');
    console.log('📌 다음 단계:');
    console.log('   이제 테스트를 실행하면 로그인된 상태로 시작합니다:');
    console.log('   npx playwright test tests/ab_monitoring_pom.spec.ts --project=chromium');
    console.log('');
    
    // 저장된 세션 확인
    expect(fs.existsSync(AB_AUTH_FILE)).toBeTruthy();
    const authData = JSON.parse(fs.readFileSync(AB_AUTH_FILE, 'utf-8'));
    console.log(`🍪 저장된 쿠키 수: ${authData.cookies?.length || 0}개`);
    console.log('');
    
  } else {
    console.log('');
    console.log('❌ 로그인 시간 초과');
    console.log('다시 시도: npx playwright test tests/ab-save-auth.spec.ts --headed --project=chromium');
    console.log('');
    throw new Error('로그인 시간 초과');
  }
});

test('기존 AlbumBuddy 세션 유효성 확인', async ({ page }) => {
  test.setTimeout(30000);
  
  // 세션 파일 존재 확인
  if (!fs.existsSync(AB_AUTH_FILE)) {
    console.log('❌ 세션 파일이 없습니다. 먼저 로그인 세션을 저장하세요.');
    console.log('   npx playwright test tests/ab-save-auth.spec.ts -g "로그인 세션 저장" --headed --project=chromium');
    throw new Error('세션 파일 없음');
  }
  
  // 세션 로드
  const authData = JSON.parse(fs.readFileSync(AB_AUTH_FILE, 'utf-8'));
  const cookies = authData.cookies || [];
  
  console.log(`📁 세션 파일: ${AB_AUTH_FILE}`);
  console.log(`🍪 쿠키 수: ${cookies.length}개`);
  
  // 만료된 쿠키 확인
  const now = Date.now() / 1000;
  const expiredCookies = cookies.filter((c: any) => c.expires && c.expires < now);
  const validCookies = cookies.filter((c: any) => !c.expires || c.expires > now);
  
  console.log(`✅ 유효한 쿠키: ${validCookies.length}개`);
  console.log(`❌ 만료된 쿠키: ${expiredCookies.length}개`);
  
  if (validCookies.length === 0) {
    console.log('');
    console.log('⚠️ 모든 쿠키가 만료되었습니다. 다시 로그인하세요.');
    throw new Error('세션 만료');
  }
  
  // 실제 페이지에서 세션 유효성 확인
  await page.context().addCookies(cookies);
  await page.goto(`${ALBUMBUDDY_BASE_URL}/dashboard/purchasing`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  const currentUrl = page.url();
  const isLoggedIn = currentUrl.includes('purchasing') && !currentUrl.includes('login');
  
  if (isLoggedIn) {
    console.log('');
    console.log('✅ 세션이 유효합니다. 로그인 상태로 테스트 가능합니다.');
  } else {
    console.log('');
    console.log('❌ 세션이 유효하지 않습니다. 다시 로그인하세요.');
    console.log('   npx playwright test tests/ab-save-auth.spec.ts -g "로그인 세션 저장" --headed --project=chromium');
    throw new Error('세션 무효');
  }
  
  expect(isLoggedIn).toBe(true);
});
