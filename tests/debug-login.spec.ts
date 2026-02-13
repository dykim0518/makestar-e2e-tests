/**
 * 로그인 페이지 구조 디버깅
 */
import { test } from '@playwright/test';
import { MakestarPage } from './pages';

test('Google 로그인 흐름 확인', async ({ page }) => {
  const makestar = new MakestarPage(page);
  
  await makestar.gotoHome();
  await makestar.handleModal();
  
  // 프로필 버튼 클릭
  const profileBtn = page.locator('button:has(svg use[href="#icon-profile-line"])').first();
  await profileBtn.click();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1000);
  
  console.log('\n=== Step 1: 로그인 페이지 도달 ===');
  console.log('URL:', page.url());
  
  // Google 로그인 버튼 클릭
  const googleBtn = page.getByRole('button', { name: /Continue with Google/i }).first();
  await googleBtn.click();
  console.log('\n=== Step 2: Google 버튼 클릭 ===');
  
  // 페이지 변화 추적
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1000);
    console.log(`[${i + 1}초] URL: ${page.url()}`);
    
    // Google 계정 선택 페이지인지 확인
    if (page.url().includes('accounts.google')) {
      console.log('\n📌 Google 계정 선택 페이지 도달!');
      
      // 계정 목록 확인
      const accounts = await page.locator('[data-email], [data-identifier]').all();
      console.log(`계정 수: ${accounts.length}`);
      
      // 이메일 표시된 요소 확인
      const emails = await page.locator('div[data-email]').all();
      for (const email of emails) {
        const addr = await email.getAttribute('data-email');
        console.log(`  계정: ${addr}`);
      }
      
      // 첫 번째 계정 클릭 시도
      const firstAccount = page.locator('[data-email], [role="link"]').first();
      const isClickable = await firstAccount.isVisible();
      console.log(`첫 번째 계정 클릭 가능: ${isClickable}`);
      
      if (isClickable) {
        await firstAccount.click().catch(() => console.log('클릭 실패'));
        await page.waitForTimeout(3000);
        console.log(`클릭 후 URL: ${page.url()}`);
      }
      break;
    }
    
    // 홈으로 돌아왔는지 확인
    if (page.url().includes('makestar.com') && !page.url().includes('auth.')) {
      console.log('\n✅ 홈으로 리다이렉트됨!');
      break;
    }
  }
  
  console.log('\n=== 최종 URL ===');
  console.log(page.url());
});
