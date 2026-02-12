/**
 * Admin 테스트 공통 헬퍼 함수
 * 
 * 이 파일은 admin_*.spec.ts 테스트 파일들에서 공통으로 사용하는
 * 헬퍼 함수와 설정을 제공합니다.
 */

import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// 인증 실패 상태 파일 (worker 간 공유용)
// ============================================================================
export const AUTH_FAIL_FILE = path.join(__dirname, '..', '..', '..', '.auth-failed');

/**
 * 인증 실패 상태 확인 (파일 기반)
 */
export function isAuthFailed(): { failed: boolean; reason: string | null } {
  try {
    if (fs.existsSync(AUTH_FAIL_FILE)) {
      const data = JSON.parse(fs.readFileSync(AUTH_FAIL_FILE, 'utf-8'));
      // 1시간 이내의 실패만 유효
      if (Date.now() - data.timestamp < 60 * 60 * 1000) {
        return { failed: true, reason: data.reason };
      }
      // 오래된 파일 삭제
      fs.unlinkSync(AUTH_FAIL_FILE);
    }
  } catch {}
  return { failed: false, reason: null };
}

/**
 * 인증 실패 상태 기록 (파일 기반)
 */
export function markAuthFailed(reason: string): void {
  try {
    fs.writeFileSync(AUTH_FAIL_FILE, JSON.stringify({
      failed: true,
      reason,
      timestamp: Date.now(),
    }));
  } catch {}
}

/**
 * 인증 실패 상태 초기화
 */
export function clearAuthFailed(): void {
  try {
    if (fs.existsSync(AUTH_FAIL_FILE)) {
      fs.unlinkSync(AUTH_FAIL_FILE);
    }
  } catch {}
}

// ============================================================================
// 토큰 유효성 검사 함수
// ============================================================================
export function isTokenValidSync(): boolean {
  const authFile = path.join(__dirname, '..', '..', '..', 'auth.json');
  const tokensFile = path.join(__dirname, '..', '..', '..', 'admin-tokens.json');
  const bufferTime = 60 * 1000; // 1분 여유
  const now = Date.now();
  
  // 1. admin-tokens.json 확인
  try {
    if (fs.existsSync(tokensFile)) {
      const tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf-8'));
      const expiresAt = new Date(tokens.expiresAt).getTime();
      if (expiresAt - bufferTime > now) {
        return true;
      }
    }
  } catch {}
  
  // 2. auth.json의 refresh_token 쿠키 확인
  try {
    if (fs.existsSync(authFile)) {
      const auth = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
      const rtCookie = auth.cookies?.find((c: any) => c.name === 'refresh_token');
      if (rtCookie?.value) {
        const payload = JSON.parse(Buffer.from(rtCookie.value.split('.')[1], 'base64').toString());
        const expiresAt = payload.exp * 1000;
        if (expiresAt - bufferTime > now) {
          return true;
        }
      }
    }
  } catch {}
  
  return false;
}

/**
 * 토큰 남은 시간 반환 (시간, 분)
 */
export function getTokenRemaining(): { hours: number; minutes: number } {
  const authFile = path.join(__dirname, '..', '..', '..', 'auth.json');
  const tokensFile = path.join(__dirname, '..', '..', '..', 'admin-tokens.json');
  const now = Date.now();
  let expiresAt = 0;
  
  try {
    if (fs.existsSync(tokensFile)) {
      const tokens = JSON.parse(fs.readFileSync(tokensFile, 'utf-8'));
      expiresAt = new Date(tokens.expiresAt).getTime();
    }
  } catch {}
  
  try {
    if (fs.existsSync(authFile)) {
      const auth = JSON.parse(fs.readFileSync(authFile, 'utf-8'));
      const rtCookie = auth.cookies?.find((c: any) => c.name === 'refresh_token');
      if (rtCookie?.value) {
        const payload = JSON.parse(Buffer.from(rtCookie.value.split('.')[1], 'base64').toString());
        const rtExpires = payload.exp * 1000;
        if (rtExpires > expiresAt) {
          expiresAt = rtExpires;
        }
      }
    }
  } catch {}
  
  const remaining = expiresAt - now;
  if (remaining <= 0) return { hours: 0, minutes: 0 };
  
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, minutes };
}

// ============================================================================
// 타임아웃 설정
// ============================================================================
export const PAGE_LOAD_TIMEOUT = 30000;  // 페이지 로드 최대 30초
export const ELEMENT_TIMEOUT = 15000;    // 요소 탐색 최대 15초

// ============================================================================
// 페이지 대기 헬퍼 함수
// ============================================================================

/**
 * 페이지 안정화를 위한 대기 (테이블 로드 확인)
 * Hard Wait 대신 테이블 또는 핵심 요소 로드 대기
 */
export async function waitForPageStable(page: Page, timeout = PAGE_LOAD_TIMEOUT): Promise<void> {
  try {
    await page.waitForLoadState('domcontentloaded', { timeout });
    // 테이블 또는 핵심 컨텐츠가 로드될 때까지 대기 (Hard Wait 제거)
    await page.locator('table, h1, h2, [class*="header"], main').first().waitFor({ state: 'visible', timeout: 10000 });
  } catch (e) {
    console.log('⚠️ 페이지 로드 타임아웃, 계속 진행합니다.');
  }
}

/**
 * Multiselect 컴포넌트 옵션 선택 (Hard Wait 대신 Web-first 방식)
 * @param page Playwright Page
 * @param multiselectIndex multiselect 인덱스 (0부터)
 * @param searchText 검색할 텍스트
 * @param optionText 선택할 옵션 텍스트
 */
export async function selectMultiselectOption(
  page: Page, 
  multiselectIndex: number, 
  searchText: string, 
  optionText: string
): Promise<boolean> {
  const multiselect = page.locator('.multiselect').nth(multiselectIndex);
  const optionSelector = page.locator('.multiselect__option:visible')
    .filter({ hasNotText: /새로운|검색결과가 없습니다/ })
    .filter({ hasText: optionText })
    .first();
  
  // 1. multiselect 클릭 후 옵션 목록이 나타날 때까지 대기
  await multiselect.click();
  try {
    await page.locator('.multiselect__content:visible').waitFor({ state: 'visible', timeout: 5000 });
  } catch { /* 계속 진행 */ }
  
  // 2. 검색 입력 후 결과 로드 대기
  const searchInput = page.locator('input.multiselect__input:visible').first();
  if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await searchInput.fill(searchText);
    try {
      await optionSelector.waitFor({ state: 'visible', timeout: 5000 });
    } catch { /* 계속 진행 */ }
  }
  
  // 3. 옵션 선택
  if (await optionSelector.isVisible({ timeout: 3000 }).catch(() => false)) {
    await optionSelector.click({ force: true });
    // 선택 완료 후 태그가 생성될 때까지 대기
    try {
      await multiselect.locator('.multiselect__tag').first().waitFor({ state: 'visible', timeout: 3000 });
    } catch { /* 계속 진행 */ }
    return true;
  }
  return false;
}

/**
 * 모달 열리기 대기
 */
export async function waitForModalOpen(page: Page, timeout = 5000): Promise<void> {
  try {
    await page.locator('[role="dialog"], .modal, [class*="modal"]').first().waitFor({ state: 'visible', timeout });
  } catch { /* 계속 진행 */ }
}

/**
 * 검색 후 테이블 업데이트 대기
 */
export async function waitForTableUpdate(page: Page): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout: 5000 });
  } catch {
    // 타임아웃 시 테이블이 보일 때까지 대기
    await page.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  }
}

/**
 * 인증 상태 검증 함수
 * 로그인 페이지로 리다이렉트되었는지 확인
 */
export async function verifyAuthentication(page: Page): Promise<{ success: boolean; reason?: string }> {
  const currentUrl = page.url();
  
  // 1. 로그인 페이지로 리다이렉트되었는지 확인 (가장 확실한 방법)
  if (currentUrl.includes('/login') || currentUrl.includes('/auth') || currentUrl.includes('stage-auth')) {
    return { 
      success: false, 
      reason: '로그인 페이지로 리다이렉트됨 - 토큰이 만료되었거나 유효하지 않습니다.' 
    };
  }
  
  // 2. 관리자 페이지가 정상적으로 로드되었는지 확인
  // SKU 목록 페이지의 핵심 요소가 있는지 확인
  try {
    // 페이지 제목 또는 핵심 UI 요소 확인 (3초 타임아웃)
    const hasAdminContent = await page.locator('h1, h2, nav, table, [class*="header"], [class*="nav"]').first().isVisible({ timeout: 3000 });
    if (hasAdminContent) {
      return { success: true };
    }
  } catch {}
  
  // 3. HTTP 에러 응답 확인 (타이틀이나 body에 명시적 에러 메시지가 있는 경우)
  const pageTitle = await page.title();
  if (pageTitle.includes('401') || pageTitle.includes('403') || 
      pageTitle.includes('Unauthorized') || pageTitle.includes('Forbidden') ||
      pageTitle.includes('Error')) {
    return { 
      success: false, 
      reason: `페이지 에러: ${pageTitle}` 
    };
  }
  
  // 4. 어드민 도메인에 정상적으로 있으면 성공으로 간주
  if (currentUrl.includes('stage-new-admin.makeuni2026.com')) {
    return { success: true };
  }
  
  return { 
    success: false, 
    reason: `알 수 없는 페이지: ${currentUrl}` 
  };
}

// ============================================================================
// 자동화 테스트 번호 추출 헬퍼 함수
// ============================================================================

/**
 * 목록에서 "[자동화테스트]" 패턴의 최대 N 값 추출
 * 패턴: "[자동화테스트] 샘플 대분류 {N}"
 */
export async function getMaxAutomationTestNumber(page: Page): Promise<number> {
  let maxN = 0;
  
  try {
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    const pattern = /\[자동화테스트\]\s*샘플\s*대분류\s*(\d+)/;
    
    for (let i = 0; i < rowCount; i++) {
      const rowText = await rows.nth(i).textContent() || '';
      const match = rowText.match(pattern);
      if (match && match[1]) {
        const n = parseInt(match[1], 10);
        if (n > maxN) maxN = n;
      }
    }
    
    // 검색 기능이 있으면 "[자동화테스트]"로 필터링하여 재확인
    const keywordInput = page.locator('input[placeholder="검색어 입력"]');
    if (await keywordInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await keywordInput.fill('[자동화테스트]');
      const searchButton = page.locator('button:has-text("조회하기"), img[cursor="pointer"]').first();
      await searchButton.click();
      await waitForTableUpdate(page);
      
      const filteredRows = page.locator('table tbody tr');
      const filteredCount = await filteredRows.count();
      
      for (let i = 0; i < filteredCount; i++) {
        const rowText = await filteredRows.nth(i).textContent() || '';
        const match = rowText.match(pattern);
        if (match && match[1]) {
          const n = parseInt(match[1], 10);
          if (n > maxN) maxN = n;
        }
      }
    }
  } catch (e) {
    console.log('ℹ️ 기존 자동화테스트 대분류 조회 실패, 1부터 시작합니다:', e);
  }
  
  return maxN;
}

/**
 * SKU 목록에서 "[자동화테스트] 샘플 SKU {N}" 패턴의 최대 N 값 추출
 */
export async function getMaxSkuAutomationTestNumber(page: Page): Promise<number> {
  let maxN = 0;
  
  try {
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    const pattern = /\[자동화테스트\]\s*샘플\s*SKU\s*(\d+)/i;
    
    for (let i = 0; i < rowCount; i++) {
      const rowText = await rows.nth(i).textContent() || '';
      const match = rowText.match(pattern);
      if (match && match[1]) {
        const n = parseInt(match[1], 10);
        if (n > maxN) maxN = n;
      }
    }
  } catch (e) {
    console.log('ℹ️ 기존 자동화테스트 SKU 조회 실패, 1부터 시작합니다:', e);
  }
  
  return maxN;
}

/**
 * 상품 목록에서 "[자동화테스트] 샘플 상품 {N}" 패턴의 최대 N 값 추출
 */
export async function getMaxProductAutomationTestNumber(page: Page): Promise<number> {
  let maxN = 0;
  
  try {
    const rows = page.locator('table tbody tr');
    const rowCount = await rows.count();
    const pattern = /\[자동화테스트\]\s*샘플\s*상품\s*(\d+)/i;
    
    for (let i = 0; i < rowCount; i++) {
      const rowText = await rows.nth(i).textContent() || '';
      const match = rowText.match(pattern);
      if (match && match[1]) {
        const n = parseInt(match[1], 10);
        if (n > maxN) maxN = n;
      }
    }
  } catch (e) {
    console.log('ℹ️ 기존 자동화테스트 상품 조회 실패, 1부터 시작합니다:', e);
  }
  
  return maxN;
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD)
 */
export function formatDate(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// ============================================================================
// 테스트 설정 헬퍼
// ============================================================================

/**
 * Admin 테스트 공통 설정을 적용합니다.
 * 각 테스트 파일의 시작 부분에서 호출하세요.
 */
export function applyAdminTestConfig() {
  const tokenValid = isTokenValidSync();
  
  // 모바일 뷰포트 스킵 (관리자 페이지는 데스크톱 전용)
  test.skip(({ viewport }) => viewport !== null && viewport.width < 1024, '이 테스트는 데스크톱 뷰포트에서만 실행됩니다');
  
  // 토큰 만료 시 테스트 스킵
  test.skip(!tokenValid, `
⚠️ 토큰이 만료되었습니다!

수동으로 로그인하세요:
  node auto-refresh-token.js --setup

또는 터미널에서 실행하세요:
  npx playwright test tests/admin_test_pom.spec.ts --project=chromium
`);
  
  return { tokenValid };
}
