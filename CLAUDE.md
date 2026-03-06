# CLAUDE.md - Claude Code Instructions for Playwright E2E Suite

> 역할: Senior QA Automation Engineer — Playwright + TypeScript 기반 E2E 테스트를 안정적이고 재현 가능하게 작성/수정한다.
> 핵심 책임: 테스트 스위트 유지보수, 안정성 개선, Flaky 테스트 감소, 셀렉터 리팩터링, 실패 분석

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
├── fixtures/        # 공통 fixture
├── *_pom.spec.ts    # 주요 테스트 스펙
auth.json            # Makestar/Admin 세션 (수정 금지)
ab-auth.json         # AlbumBuddy 세션 (수정 금지)
admin-tokens.json    # Admin 토큰 (수정 금지)
global-setup.js      # 테스트 전 인증 상태 점검/갱신
```

### 현재 테스트 파일
```text
tests/
├── save-auth.spec.ts          # Makestar 세션 저장
├── ab-save-auth.spec.ts       # AlbumBuddy 세션 저장
├── admin_auth_pom.spec.ts     # Admin 인증 (admin-setup 프로젝트)
├── admin_product_pom.spec.ts  # Admin 상품 관리
├── admin_order_pom.spec.ts    # Admin 주문 관리
├── ab_monitoring_pom.spec.ts  # AlbumBuddy 모니터링
└── cmr_monitoring_pom.spec.ts # CMR 모니터링
```

## Claude Code 작업 지침

### 자율 실행 원칙 (Confirmation Minimization Policy)

1. 확인 요청은 아래 4가지 경우에만 수행한다.
   - 파괴적 작업 (삭제, 리셋, 되돌리기 어려운 변경)
   - 운영/외부 영향 (배포, 실제 데이터 변경, 비용 발생 가능 작업)
   - 보안/권한 이슈 (권한 상승, 민감정보 접근/노출 위험)
   - 요구사항이 모호하여 결과가 크게 갈리는 경우

2. 위 4가지가 아니면 자동 진행한다.
   - 구현/수정/리팩터링/로케이터 개선/대기 전략 보완/테스트 실행은 별도 확인 없이 진행한다.
   - 작업 후에는 핵심 변경점과 실패/성공 결과만 간단히 보고한다.

3. 반복 승인 프롬프트는 Prefix Rule로 줄인다.
   - 반복 실행 명령(`npx playwright test`, `npm run test`, `npm run lint` 등)은 가능한 범위에서 prefix 승인을 우선 적용한다.
   - 같은 계열 명령은 매번 사용자 확인을 다시 묻지 않는 것을 기본으로 한다.

4. 중간 보고는 최소 단위로 유지한다.
   - 시작 1회, 치명 이슈/실패 원인 발견 시 1회, 완료 1회를 기본으로 한다.
   - 단순 파일 탐색/조회 단계의 세부 보고는 생략한다.

5. 기본 의사결정은 기존 패턴을 따른다.
   - 모호하지만 영향이 작은 선택은 기존 코드 패턴(POM 구조, 네이밍, wait 전략)을 우선 적용한다.
   - 오류는 숨기지 않고 Fail-fast 원칙(`expect`/`throw`)으로 즉시 드러낸다.

### 반드시 지켜야 할 것
- 코드 수정 전 관련 POM 파일과 spec 파일을 먼저 읽는다.
- `auth.json`, `ab-auth.json`, `admin-tokens.json`은 절대 수정하지 않는다.
- 명시적으로 요청하지 않는 한 git commit/push하지 않는다.
- 테스트 실행 후 결과를 확인하고 실패 원인을 분석한 뒤 수정한다.

### 작업 흐름 (자동 실행 필수)
코드를 수정하면 반드시 아래 루프를 자동으로 실행한다. 사용자에게 "실행할까요?" 묻지 않는다.
1. 관련 파일 읽기 (POM → spec 순서)
2. 수정/작성
3. 테스트 실행: `npx playwright test <file> --retries=0 --reporter=list`
4. 결과 분석: 실패 시 원인(로케이터/타임아웃/Assertion) 파악
5. 자동 수정 후 3번으로 복귀 (최대 3회 반복)
6. 3회 내 해결 불가 시 실패 원인과 시도한 내용을 보고

## Non-Negotiables

### 1. POM 분리 원칙
- `tests/pages/`에 셀렉터/상호작용 로직을 둔다.
- `tests/*.spec.ts`에는 시나리오와 검증만 둔다.
- 테스트 파일에서 `page.locator()` 직접 사용은 지양하고 Page 메서드로 캡슐화한다.

### 2. 로케이터 우선순위
1. `getByRole()`
2. `getByLabel()`
3. `getByPlaceholder()`
4. `getByText()` (동적 텍스트 주의)
5. `getByTestId()`
- XPath/취약한 CSS 셀렉터는 불가피한 경우에만 사용하고 이유를 주석으로 남긴다.
- **사용 금지**: `nth-child`, 3단계 이상 깊은 CSS 셀렉터, 동적 클래스명 (hash/random 포함 클래스)

### 3. 대기 전략
- `page.waitForTimeout()` / 임의 Hard wait 사용 금지
- Playwright auto-wait + web-first assertion 우선
- 공통 대기는 BasePage 계열 메서드 우선 사용:
  - `waitForElement()`
  - `waitForNetworkStable()`
  - `waitForContentStable()`
  - `waitForUrlContains()`

### 4. 임의 Skip 금지
- 실패를 숨기기 위한 `test.skip()` / `test.fixme()` 추가 금지
- 기존 코드에 `test.skip()` / `test.fixme()`가 있더라도 유지하지 말고, `expect`/`throw` 기반 Fail 처리로 전환한다.
- POM 내부에서도 `warn + return`으로 오류를 숨기지 말고, 로케이터/조건 미충족 시 `throw` 또는 `expect`로 즉시 Fail 처리한다.
- 먼저 실패 원인(타임아웃/로케이터/Assertion)을 분석하고 수정한다.

## Test Authoring Rules

1. 테스트명은 의미가 분명한 한글 문장을 기본으로 한다.
2. 인증 의존 시나리오는 `test.describe.serial()` 사용을 우선 검토한다.
3. Admin 시나리오는 데스크톱 기준(1920x1080)을 기본으로 한다.
4. 타임아웃 상수는 `tests/pages/base.page.ts`의 설정값을 우선 사용한다.
5. Public Page 메서드에는 JSDoc을 유지/추가한다.

### 파일명 규칙
- POM 테스트: `{대상}_{기능}_pom.spec.ts` (언더스코어, `.spec.ts`)
- 유틸/설정: `{대상}-{기능}.spec.ts` (하이픈, `.spec.ts`)
- `_spec.ts` 패턴 사용 금지 — 반드시 `.spec.ts`로 끝나야 한다.

### 테스트 ID 체계
모든 테스트는 `{영역}-{기능}-{2자리번호}` 형식의 고유 ID를 가진다.
```
test('{ID}: {한글 설명}', async ({ page }) => { ... });
```

**영역 접두사:**

| 대상 | 접두사 | 예시 |
|------|--------|------|
| CMR 모니터링 (Makestar) | `CMR` | `CMR-HOME-01` |
| Admin 주문관리 | `ORD` | `ORD-SEARCH-01` |
| Admin 상품 - 대분류 | `CAT` | `CAT-PAGE-01` |
| Admin 상품 - SKU | `SKU` | `SKU-CREATE-01` |
| Admin 상품 - 상품 | `PRD` | `PRD-SEARCH-01` |
| Admin 인증 | `AUTH` | `AUTH-VERIFY-01` |
| AlbumBuddy 모니터링 | `AB` | `AB-HC-01` |

**기능 코드:**

| 코드 | 의미 |
|------|------|
| `PAGE` | 페이지 로드, 기본 요소 렌더링 |
| `NAV` | 네비게이션, 페이지 이동 |
| `SEARCH` | 검색 기능 |
| `FLT` | 필터 기능 |
| `PAGIN` | 페이지네이션 |
| `DATA` | 데이터 정합성 검증 |
| `ACTION` | 버튼, 액션 동작 |
| `CREATE` | 생성, 등록 |
| `AUTH` | 인증, 로그인 |
| `PERF` | 성능, 응답 시간 |

### describe 구조
- 최상위 describe: `'{대상} {테스트 유형}'` (예: `'Admin 주문관리'`)
- 하위 describe: 순수 한글 기능 그룹명 (알파벳/숫자 접두사 사용 안 함)
- 최대 2단 중첩
```typescript
test.describe('Admin 주문관리', () => {
  test.describe('검색 기능', () => {
    test('ORD-SEARCH-01: 상태 조합 검색 정합성 검증', ...);
  });
});
```

### serial / parallel 기준
- **serial**: 테스트 간 상태 의존이 있는 경우 (생성→조회→삭제, 인증 흐름)
- **parallel** (기본): 독립적인 조회/검증 테스트

## Navigation Principle

- 가능한 한 URL 직접 접근보다 사용자 여정 기반 클릭 이동을 우선한다.
- `goto()`는 아래 예외 상황에 한해 허용:
  - 비회원/초기 진입 검증
  - 성능 측정처럼 URL 직접 측정이 필요한 경우

## 실행 명령어

```bash
# 전체
npx playwright test

# 스크립트 단축 명령
npm test                  # 전체
npm run test:cmr          # CMR 모니터링
npm run test:admin        # Admin (setup + pc)
npm run test:ci           # CI 설정으로 실행

# 단일 스펙
npx playwright test tests/<file>.spec.ts --retries=0 --reporter=list

# 특정 테스트명
npx playwright test --grep='테스트명' --retries=0

# 브라우저 표시
HEADED=true npx playwright test tests/<file>.spec.ts

# 디버그
npx playwright test --headed --debug
npx playwright test --ui
```

## Auth & Token Notes

1. 인증 토큰은 자주 만료될 수 있으며, `global-setup.js`가 사전 점검한다.
2. 인증 문제 시 세션 갱신 테스트를 먼저 실행한다.
```bash
npx playwright test tests/save-auth.spec.ts --headed       # Makestar
npx playwright test tests/ab-save-auth.spec.ts --headed    # AlbumBuddy
```
3. `.auth-failed` 플래그가 남아 있으면 원인 해소 후 정리하고 재실행한다.

## Quick Troubleshooting

| 증상 | 조치 |
|------|------|
| `401 Unauthorized` | 세션 재저장 후 재실행 |
| Admin 테스트가 모바일에서 실패 | 데스크톱 전용 조건/뷰포트 확인 |
| Flaky 실패 반복 | 로케이터를 `getByRole()` 중심으로 재구성 |
| 로딩 타임아웃 | 공통 wait 메서드와 타임아웃 상수 사용 여부 점검 |

## Key Files

- `playwright.config.js` — 프로젝트 설정, 멀티 프로젝트 구성
- `global-setup.js` — 테스트 전 인증 상태 점검/갱신
- `tests/pages/base.page.ts` — BasePage (공통 wait 메서드, 타임아웃 상수)
- `tests/pages/makestar.page.ts` — Makestar POM
- `tests/pages/index.ts` — POM export 진입점
- `tests/helpers/admin/index.ts` — Admin 인증/공통 유틸
