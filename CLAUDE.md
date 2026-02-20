# CLAUDE.md - Shared Playwright E2E Instructions

> 역할: Playwright + TypeScript 기반 E2E 테스트를 안정적이고 재현 가능하게 작성/수정한다.

## Project Snapshot

- 멀티 사이트 테스트 대상:
- Makestar (팬 플랫폼)
- AlbumBuddy (구매 대행)
- Admin (stage 관리자)

### 주요 구조
```text
tests/
├── pages/           # POM 계층 (BasePage -> AdminBasePage -> 세부 Page)
├── helpers/admin/   # 인증/공통 유틸
├── *_pom.spec.ts    # 주요 테스트 스펙
auth.json            # Makestar/Admin 세션
ab-auth.json         # AlbumBuddy 세션
global-setup.js      # 테스트 전 인증 상태 점검/갱신
```

## Non-Negotiables

1. POM 분리 원칙
- `tests/pages/`에 셀렉터/상호작용 로직을 둔다.
- `tests/*.spec.ts`에는 시나리오와 검증만 둔다.
- 테스트 파일에서 `page.locator()` 직접 사용은 지양하고 Page 메서드로 캡슐화한다.

2. 로케이터 우선순위
- 1순위: `getByRole()`
- 2순위: `getByLabel()`
- 3순위: `getByPlaceholder()`
- 4순위: `getByText()` (동적 텍스트 주의)
- 5순위: `getByTestId()`
- XPath/취약한 CSS 셀렉터는 불가피한 경우에만 사용하고 이유를 주석으로 남긴다.

3. 대기 전략
- `page.waitForTimeout()` / 임의 Hard wait 사용 금지
- Playwright auto-wait + web-first assertion 우선
- 공통 대기는 BasePage 계열 메서드 우선 사용:
- `waitForElement()`
- `waitForNetworkStable()`
- `waitForContentStable()`
- `waitForUrlContains()`

4. 임의 Skip 금지
- 실패를 숨기기 위한 `test.skip()` / `test.fixme()` 추가 금지
- 먼저 실패 원인(타임아웃/로케이터/Assertion)을 분석하고 수정한다.

## Test Authoring Rules

1. 테스트명은 의미가 분명한 한글 문장을 기본으로 한다.
2. 인증 의존 시나리오는 `test.describe.serial()` 사용을 우선 검토한다.
3. Admin 시나리오는 데스크톱 기준(1920x1080)을 기본으로 한다.
4. 타임아웃 상수는 `tests/pages/base.page.ts`의 설정값을 우선 사용한다.
5. Public Page 메서드에는 JSDoc을 유지/추가한다.

## Navigation Principle

- 가능한 한 URL 직접 접근보다 사용자 여정 기반 클릭 이동을 우선한다.
- `goto()`는 아래처럼 예외 상황에 한해 허용:
- 비회원/초기 진입 검증
- 성능 측정처럼 URL 직접 측정이 필요한 경우

## Execution Workflow

코드 변경 후 아래 사이클을 완료한다.
1. 테스트 실행
2. 실패 원인 확인
3. POM/테스트 로직 수정
4. 재실행으로 회귀 확인

권장 명령어:
```bash
# 전체
npx playwright test

# 단일 스펙
npx playwright test tests/<file>.spec.ts --retries=0 --reporter=list

# 특정 테스트명
npx playwright test --grep='테스트명' --retries=0

# 디버그
npx playwright test --headed --debug
npx playwright test --ui
```

## Auth & Token Notes

1. 인증 토큰은 자주 만료될 수 있으며, `global-setup.js`가 사전 점검한다.
2. 인증 문제 시 세션 갱신 테스트를 먼저 실행한다.
```bash
npx playwright test tests/save-auth.spec.ts --headed
npx playwright test tests/ab-save-auth.spec.ts --headed
```
3. `.auth-failed` 플래그가 남아 있으면 원인 해소 후 정리하고 재실행한다.

## Quick Troubleshooting

- `401 Unauthorized`: 세션 재저장 후 재실행
- Admin 테스트가 모바일에서 실패: 데스크톱 전용 조건/뷰포트 확인
- Flaky 실패 반복: 로케이터를 `getByRole()` 중심으로 재구성
- 로딩 타임아웃: 공통 wait 메서드와 타임아웃 상수 사용 여부 점검

## Key Files

- `playwright.config.js`
- `global-setup.js`
- `tests/pages/base.page.ts`
- `tests/pages/makestar.page.ts`
- `tests/pages/index.ts`
- `tests/helpers/admin/index.ts`
