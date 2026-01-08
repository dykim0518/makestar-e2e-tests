# 메이크스타 테스트 - 로그인 가이드

## 환경 변수 설정 완료 ✅

`.env` 파일이 생성되었고, 로그인 자격증명이 설정되었습니다:
- MAKESTAR_EMAIL: dykimqatest01@gmail.com
- MAKESTAR_PASSWORD: ehdud0331

## ⚠️ 메이크스타 로그인 이슈

메이크스타 웹사이트는 자동 로그인을 막고 있어, 완전한 자동화가 어렵습니다.
대신 **수동 로그인 후 세션 저장** 방식을 사용하는 것을 권장합니다.

## 🔐 추천 방법: 수동 로그인 + 세션 저장

### 1단계: 로그인 세션 저장 스크립트 실행

```bash
npx playwright test tests/save-auth.spec.ts --headed
```

### 2단계: 브라우저가 열리면 수동으로 로그인

1. 브라우저가 자동으로 메이크스타 로그인 페이지로 이동
2. 수동으로 로그인 진행 (카카오 로그인 또는 이메일 로그인)
3. 로그인이 완료되면 자동으로 세션이 저장됨

### 3단계: 저장된 세션으로 테스트 실행

```bash
npx playwright test tests/makestar_main_features_enhanced.spec.ts --headed
```

저장된 세션(`auth.json`)을 사용하여 자동으로 로그인된 상태로 테스트가 실행됩니다.

## 📝 현재 상태

- ✅ 환경 변수 설정 완료
- ✅ dotenv 패키지 설치 완료
- ✅ 자동 로그인 로직 구현 (메이크스타가 차단 중)
- ⚠️ 수동 로그인 후 세션 저장 방식 권장

## 🛠️ 로그인 세션 저장 스크립트 생성

아래 명령어를 실행하면 로그인 세션 저장 스크립트가 생성됩니다:

```bash
# Windows PowerShell
Set-Content tests\\save-auth.spec.ts @"
import { test } from '@playwright/test';

test('로그인 세션 저장', async ({ page, context }) => {
  console.log('🌐 메이크스타 로그인 페이지로 이동...');
  await page.goto('https://www.makestar.com/login');
  
  console.log('👆 브라우저에서 수동으로 로그인하세요...');
  console.log('⏰ 2분 동안 대기합니다...');
  
  // 2분 동안 사용자가 로그인할 시간을 줌
  await page.waitForTimeout(120000);
  
  // 로그인 성공 확인
  const currentUrl = page.url();
  if (!currentUrl.includes('login')) {
    console.log('✅ 로그인 완료!');
    
    // 세션 저장
    await context.storageState({ path: 'auth.json' });
    console.log('💾 로그인 세션이 auth.json에 저장되었습니다');
  } else {
    console.log('❌ 로그인이 완료되지 않았습니다');
  }
});
"@
```

## 🚀 테스트 실행 방법

### 공개 기능만 테스트 (로그인 없이)
```bash
npx playwright test tests/makestar_main_features_enhanced.spec.ts --headed
```

### 전체 기능 테스트 (로그인 필요)
1. 먼저 로그인 세션 저장 (위의 1-2 단계)
2. 저장된 세션으로 테스트 실행

## 📞 문의

로그인 관련 문제가 계속되면:
1. `.env` 파일의 자격증명 확인
2. `auth.json` 파일 삭제 후 재시도
3. 메이크스타 웹사이트에서 직접 로그인 가능한지 확인
