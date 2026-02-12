import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const AUTH_FILE = path.join(__dirname, '..', 'auth.json');

test('로그인 세션 저장 (수동 로그인)', async ({ page, context }) => {
  test.setTimeout(300000); // 5분 timeout
  
  console.log('');
  console.log('='.repeat(70));
  console.log('🔐 메이크스타 로그인 세션 저장 도구');
  console.log('='.repeat(70));
  console.log('');
  
  // 메이크스타 로그인 페이지로 이동
  console.log('🌐 메이크스타 로그인 페이지로 이동 중...');
  await page.goto('https://auth.makestar.com/login/?application=MAKESTAR&redirect_url=https://www.makestar.com/my-page');
  await page.waitForTimeout(2000);
  
  console.log('');
  console.log('┌' + '─'.repeat(68) + '┐');
  console.log('│' + ' '.repeat(20) + '📋 로그인 안내' + ' '.repeat(33) + '│');
  console.log('├' + '─'.repeat(68) + '┤');
  console.log('│ 1. 브라우저에서 Google 또는 다른 방법으로 로그인하세요           │');
  console.log('│ 2. 로그인 완료 후 my-page로 리다이렉트되면 자동 저장됩니다       │');
  console.log('│ 3. 최대 3분 동안 대기합니다                                      │');
  console.log('└' + '─'.repeat(68) + '┘');
  console.log('');
  
  // 로그인 완료 대기 (my-page로 리다이렉트 되는지 확인)
  let loginSuccess = false;
  const maxWaitTime = 180000; // 3분
  const checkInterval = 2000; // 2초마다 확인
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const currentUrl = page.url();
    
    // 로그인 성공 조건: my-page에 있고 auth/login이 아닌 경우
    if (currentUrl.includes('makestar.com/my-page') && 
        !currentUrl.includes('auth.makestar.com') && 
        !currentUrl.includes('login')) {
      loginSuccess = true;
      console.log('');
      console.log('✅ 로그인 감지! 세션 저장 중...');
      break;
    }
    
    // 메인 페이지로 이동한 경우도 로그인 성공으로 간주
    if (currentUrl === 'https://www.makestar.com/' || 
        currentUrl === 'https://www.makestar.com') {
      // my-page로 이동해서 확인
      await page.goto('https://www.makestar.com/my-page', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      
      const afterUrl = page.url();
      if (!afterUrl.includes('login') && !afterUrl.includes('auth')) {
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
    await context.storageState({ path: AUTH_FILE });
    
    console.log('');
    console.log('='.repeat(70));
    console.log('🎉 로그인 세션 저장 완료!');
    console.log('='.repeat(70));
    console.log('');
    console.log(`📁 저장 위치: ${AUTH_FILE}`);
    console.log('');
    console.log('📌 다음 단계:');
    console.log('   이제 테스트를 실행하면 로그인된 상태로 시작합니다:');
    console.log('   npx playwright test tests/makestar_reg2.spec.ts --headed');
    console.log('');
    
    // 저장된 세션 확인
    expect(fs.existsSync(AUTH_FILE)).toBeTruthy();
    const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    console.log(`🍪 저장된 쿠키 수: ${authData.cookies?.length || 0}개`);
    console.log('');
    
  } else {
    console.log('');
    console.log('❌ 로그인 시간 초과');
    console.log('다시 시도: npx playwright test tests/save-auth.spec.ts --headed');
    console.log('');
    throw new Error('로그인 시간 초과');
  }
});

test('Admin 로그인 세션 저장 (stage-new-admin)', async ({ page, context }) => {
  test.setTimeout(300000); // 5분 timeout
  
  console.log('');
  console.log('='.repeat(70));
  console.log('🔐 Admin 로그인 세션 저장 도구');
  console.log('='.repeat(70));
  console.log('');
  
  // Admin 로그인 페이지로 이동
  console.log('🌐 Admin 로그인 페이지로 이동 중...');
  await page.goto('https://stage-auth.makeuni2026.com/login/?application=MAKESTAR&redirect_url=https://stage-new-admin.makeuni2026.com');
  await page.waitForTimeout(2000);
  
  console.log('');
  console.log('┌' + '─'.repeat(68) + '┐');
  console.log('│' + ' '.repeat(20) + '📋 로그인 안내' + ' '.repeat(33) + '│');
  console.log('├' + '─'.repeat(68) + '┤');
  console.log('│ 1. 브라우저에서 Google 또는 다른 방법으로 로그인하세요           │');
  console.log('│ 2. 로그인 완료 후 Admin 대시보드로 리다이렉트되면 자동 저장      │');
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
    
    // 로그인 성공 조건: stage-new-admin에 있고 login이 아닌 경우
    if (currentUrl.includes('stage-new-admin.makeuni2026.com') && 
        !currentUrl.includes('login') && 
        !currentUrl.includes('auth')) {
      loginSuccess = true;
      console.log('');
      console.log('✅ Admin 로그인 감지! 세션 저장 중...');
      break;
    }
    
    await page.waitForTimeout(checkInterval);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    process.stdout.write(`\r⏳ 로그인 대기 중... (${elapsed}초/${maxWaitTime / 1000}초)`);
  }
  
  console.log('');
  
  if (loginSuccess) {
    // 세션 저장
    await context.storageState({ path: AUTH_FILE });
    
    console.log('');
    console.log('='.repeat(70));
    console.log('🎉 Admin 로그인 세션 저장 완료!');
    console.log('='.repeat(70));
    console.log('');
    console.log(`📁 저장 위치: ${AUTH_FILE}`);
    console.log('');
    console.log('📌 다음 단계:');
    console.log('   이제 Admin 테스트를 실행할 수 있습니다:');
    console.log('   npx playwright test tests/admin_test_pom.spec.ts');
    console.log('');
    
    const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    console.log(`🍪 저장된 쿠키 수: ${authData.cookies?.length || 0}개`);
    console.log('');
    
    expect(loginSuccess).toBe(true);
  } else {
    console.log('');
    console.log('❌ 로그인 실패 또는 시간 초과');
    throw new Error('Admin 로그인 시간 초과');
  }
});

test('저장된 세션 확인', async ({ page, context }) => {
  // 기존 세션 파일 확인
  if (!fs.existsSync(AUTH_FILE)) {
    console.log('❌ auth.json 파일이 없습니다.');
    console.log('먼저 로그인 세션을 저장하세요: npx playwright test tests/save-auth.spec.ts -g "로그인 세션 저장" --headed');
    test.skip();
    return;
  }
  
  // 세션 로드
  const authData = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
  console.log(`📂 auth.json 로드됨 (쿠키 ${authData.cookies?.length || 0}개)`);
  
  // 쿠키 추가
  if (authData.cookies && authData.cookies.length > 0) {
    await context.addCookies(authData.cookies);
    console.log('🍪 쿠키 적용 완료');
  }
  
  // my-page 접속하여 로그인 상태 확인
  await page.goto('https://www.makestar.com/my-page', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  
  const currentUrl = page.url();
  console.log(`📍 현재 URL: ${currentUrl}`);
  
  if (!currentUrl.includes('login') && !currentUrl.includes('auth')) {
    console.log('✅ 세션 유효! 로그인 상태입니다.');
    
    // 로그아웃 버튼 확인
    const logoutBtn = page.locator('text=로그아웃, text=Logout, text=Log out').first();
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log('✅ 로그아웃 버튼 발견 - 로그인 확인됨');
    }
  } else {
    console.log('⚠️ 세션이 만료되었거나 유효하지 않습니다.');
    console.log('다시 로그인하세요: npx playwright test tests/save-auth.spec.ts -g "로그인 세션 저장" --headed');
  }
});
