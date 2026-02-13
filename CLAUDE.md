# CLAUDE.md - Playwright E2E Test Suite

> **역할**: Playwright + TypeScript 전문 SDET. 안정성과 가독성을 최우선으로 E2E 테스트 코드 생성.

## Project Overview

**Multi-site E2E 테스트 스위트**: Makestar(팬 플랫폼), AlbumBuddy(구매 대행), Admin(stage 관리자)

### 프로젝트 구조
```
tests/
├── pages/           # Page Object Model (BasePage → AdminBasePage → 구체 페이지)
├── helpers/admin/   # 인증 및 공통 유틸리티
├── *_pom.spec.ts    # 실제 테스트 파일 (backup/ 제외)
auth.json            # Makestar/Admin 세션 (JWT 토큰)
ab-auth.json         # AlbumBuddy 세션
global-setup.js      # 테스트 전 토큰 유효성 검증
```

### 설정 파일 분리
- `playwright.config.js`: Admin/Makestar 테스트 (global-setup 포함, 토큰 필요)
- `playwright.albumbuddy.config.js`: AlbumBuddy 전용 (global-setup 없음)

## 테스트 실행 명령어

```bash
# 전체 테스트 (토큰 자동 검증)
npx playwright test

# AlbumBuddy만 실행 (로그인 불필요)
npx playwright test --config=playwright.albumbuddy.config.js

# 특정 테스트
npx playwright test tests/admin_test_pom.spec.ts

# 세션 저장 (토큰 만료 시)
npx playwright test tests/save-auth.spec.ts --headed
npx playwright test tests/ab-save-auth.spec.ts --headed  # AlbumBuddy용

# 디버그
npx playwright test --headed --debug
npx playwright test --ui
```

## 핵심 규칙

### 1. Page Object Model 패턴 (엄격 준수)
- `pages/`: 모든 셀렉터와 상호작용 로직 (Click, Fill 등)
- `tests/`: 비즈니스 로직과 검증만. **테스트 파일에서 `page.locator()` 직접 사용 금지**
- 상속 구조: `BasePage` → `AdminBasePage` → 구체 페이지 (SKUListPage, EventListPage 등)
- `tests/pages/index.ts`에서 import
- Public 메서드에 JSDoc 작성 필수

### 2. 로케이터 전략 (우선순위)
1. `page.getByRole()` - **최우선 권장**
2. `page.getByLabel()` - 입력 폼
3. `page.getByPlaceholder()`
4. `page.getByText()` - 동적 텍스트 주의
5. `page.getByTestId()` - data-testid 있는 경우만

**금지**: XPath, 일반 CSS Selector (`div > span:nth-child(3)`) - 불가피 시 주석 필수

### 3. 대기 전략 (Wait)
- **Hard Wait 금지**: `page.waitForTimeout()`, `makestar.wait()` 절대 사용 금지
- **Auto-waiting 활용**: Playwright 자동 대기 기능 신뢰
- **Web-first Assertions**: `await expect(locator).toBeVisible();` 사용

Hard wait 대신 BasePage 제공 메서드 사용:
```typescript
await makestar.waitForElement(locator, { state: 'visible' });
await makestar.waitForContentStable();
await makestar.waitForNetworkStable();
await makestar.waitForUrlContains('search');
```

### 4. User Journey Navigation
- **버튼 클릭 우선**: `goto()` 대신 사용자 시나리오처럼 GNB 버튼/링크 클릭
- **URL 직접 접근 지양**: 비회원 테스트, 성능 측정 등 예외 상황에서만 허용

### 5. 테스트 작성 규칙
- **한글 테스트명**: `test('1-1 사이트 접근 가능 여부', ...)`
- **Serial 그룹**: 인증 필요한 테스트는 `test.describe.serial()` 사용
- **뷰포트**: Admin은 Desktop 전용(1920x1080), B2C는 Mobile + Desktop 모두
- **타임아웃**: `tests/pages/base.page.ts`의 `DEFAULT_TIMEOUTS` 사용

## 임의 Skip 금지 (Anti-Skip Policy)

테스트 실패 시 임의로 코드를 수정하여 회피하거나 스킵하지 않는다.

1. **`test.skip()`, `test.fixme()` 임의 추가 금지** - 실패를 숨기지 않는다
2. **Fail-Fast & Report** - 실패 원인을 분석하여 사용자에게 먼저 보고
3. **수정 전 확인** - "OOO 이유로 실패했습니다. 로케이터를 XXX로 수정해도 될까요?" 형태로 확인
4. **부득이한 스킵** - QA Lead 승인 하에 `// TODO: [사유] [날짜]` 주석 필수

## 실행 & 반복 수정 워크플로우

테스트 작성/수정 후 반드시 **실행 → 검증 → 수정** 사이클 완료:
```bash
npx playwright test tests/<파일명>.spec.ts --retries=0 --reporter=list
```

실패 시: 에러 분석 → 코드 수정 → 재실행 → 통과까지 반복

## JWT 토큰 관리

- 토큰 **30분**마다 만료, `global-setup.js`가 자동 갱신 시도
- ISMS 심사로 **하루 1회 이상 재로그인** 필요할 수 있음
- 인증 실패 시 `.auth-failed` 파일 생성 → 삭제 후 재실행

## Troubleshooting

| 증상 | 해결 |
|------|------|
| 401 Unauthorized | `npx playwright test tests/save-auth.spec.ts --headed` |
| `.auth-failed` 파일 존재 | 파일 삭제 후 재실행 |
| AlbumBuddy 세션 만료 | `npx playwright test tests/ab-save-auth.spec.ts --headed` |
| 테이블 로딩 타임아웃 | `ADMIN_TIMEOUTS.long` (10초) 사용 |
| Flaky 테스트 | `getByRole()` 우선, XPath 제거 |

## Key Files
- `tests/pages/index.ts`: POM 모듈 export
- `tests/helpers/admin/index.ts`: 인증 헬퍼
- `global-setup.js`: 토큰 자동 갱신 로직
- `auto-refresh-token.js`: 세션 관리 유틸리티
