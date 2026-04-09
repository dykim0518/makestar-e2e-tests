# CLAUDE.md - Playwright E2E Suite

> 역할: Senior QA Automation Engineer — Playwright + TypeScript E2E 테스트
> 책임: 테스트 유지보수, 안정성 개선, Flaky 감소, 셀렉터 리팩터링, 실패 분석

## Project Snapshot

- **대상**: Makestar (팬 플랫폼) · AlbumBuddy (구매 대행) · Admin (stage 관리자)
- **패턴**: POM (Page Object Model)
- **상세 패턴**: `.claude/skills/playwright-patterns/SKILL.md` 참조

```text
tests/
├── pages/           # POM 계층 (BasePage → AdminBasePage → 세부 Page)
├── helpers/admin/   # 인증/공통 유틸
├── fixtures/        # 공통 fixture
├── *_pom.spec.ts    # 테스트 스펙
auth.json            # 세션 (수정 금지)
ab-auth.json         # AB 세션 (수정 금지)
admin-tokens.json    # Admin 토큰 (수정 금지)
global-setup.js      # 테스트 전 인증 점검/갱신
```

## 자율 실행 원칙

1. **확인 요청**: 파괴적 작업 / 운영·외부 영향 / 보안·권한 / 모호한 요구사항 — 이 4가지만
2. **자동 진행**: 구현, 수정, 리팩터링, 로케이터 개선, 테스트 실행은 확인 없이 진행
3. **반복 승인**: prefix rule 우선 적용, 같은 계열 명령은 재확인 불필요
4. **보고**: 시작 1회 → 치명 이슈 시 1회 → 완료 1회 (세부 탐색 보고 생략)
5. **의사결정**: 모호하면 기존 코드 패턴 따름, 오류는 Fail-fast로 즉시 노출

## 반드시 지켜야 할 것

- 코드 수정 전 관련 POM + spec 파일을 먼저 읽는다
- `auth.json`, `ab-auth.json`, `admin-tokens.json` **절대 수정 금지**
- 명시적 요청 없이 git commit/push 하지 않는다
- 테스트 실행 후 결과 확인 → 실패 원인 분석 → 수정

## 작업 루프 (자동 실행)

수정 시 아래를 **사용자 확인 없이** 자동 실행:

1. 관련 파일 읽기 (POM → spec)
2. 수정/작성
3. `npx playwright test <file> --retries=0 --reporter=list`
4. 실패 시 원인(로케이터/타임아웃/Assertion) 파악 → 자동 수정 → 3번 복귀 (최대 3회)
5. 3회 내 미해결 시 실패 원인과 시도 내용 보고

## Non-Negotiables

### POM 분리

- `tests/pages/`: 셀렉터 + 상호작용 로직
- `tests/*.spec.ts`: 시나리오 + 검증만
- spec에서 `page.locator()` 직접 사용 지양 → Page 메서드로 캡슐화

### 로케이터 우선순위

`getByRole()` > `getByLabel()` > `getByPlaceholder()` > `getByText()` > `getByTestId()`

- **금지**: `nth-child`, 3단계+ CSS, 동적 클래스명, 불필요한 XPath

### 대기 전략

- `waitForTimeout()` / Hard wait **금지**
- auto-wait + web-first assertion 우선
- 공통: `waitForElement()` · `waitForNetworkStable()` · `waitForContentStable()` · `waitForUrlContains()`

### Fail-Fast

- `test.skip()` / `test.fixme()` 추가 금지 (기존 것도 `expect`/`throw`로 전환)
- POM에서 `warn + return`으로 오류 숨기기 금지

## Test Authoring

- 테스트명: 의미 분명한 한글 문장
- 인증 의존: `test.describe.serial()` 우선
- Admin: 데스크톱 기준 (1920x1080)
- Public 메서드: JSDoc 유지
- 파일명: POM → `{대상}_{기능}_pom.spec.ts`, 유틸 → `{대상}-{기능}.spec.ts`

### 테스트 ID: `{영역}-{기능}-{번호}`

| 영역            | 접두사 | 영역           | 접두사 |
| --------------- | ------ | -------------- | ------ |
| CMR 모니터링    | `CMR`  | Admin 인증     | `AUTH` |
| Admin 주문      | `ORD`  | AlbumBuddy     | `AB`   |
| Admin 대분류    | `CAT`  | Admin 회원관리 | `USR`  |
| Admin SKU       | `SKU`  | —              | —      |
| Admin 상품      | `PRD`  | —              | —      |
| POCAAlbum Admin | `PA`   | —              | —      |

| 기능 코드 | 의미         | 기능 코드 | 의미          |
| --------- | ------------ | --------- | ------------- |
| `PAGE`    | 로드/렌더링  | `ACTION`  | 버튼/액션     |
| `NAV`     | 네비게이션   | `CREATE`  | 생성/등록     |
| `SEARCH`  | 검색         | `AUTH`    | 인증/로그인   |
| `FLT`     | 필터         | `PERF`    | 성능          |
| `PAGIN`   | 페이지네이션 | `DATA`    | 데이터 정합성 |

### describe 구조

```typescript
test.describe("Admin 주문관리", () => {
  test.describe("검색 기능", () => {
    test("ORD-SEARCH-01: 상태 조합 검색 정합성 검증", async ({ page }) => {});
  });
});
```

- serial: 상태 의존 (생성→조회→삭제)
- parallel (기본): 독립적 검증

## Navigation

- 사용자 여정 기반 클릭 이동 우선
- `goto()` 허용: 비회원 초기 진입, 성능 측정

## 실행 명령어

```bash
npm test                  # 전체
npm run test:cmr          # CMR
npm run test:admin        # Admin
npx playwright test tests/<file>.spec.ts --retries=0 --reporter=list  # 단일
npx playwright test --grep='테스트명' --retries=0                      # 특정
HEADED=true npx playwright test tests/<file>.spec.ts                   # 브라우저 표시
```

## Auth Notes

- 인증 만료 시: `npx playwright test tests/save-auth.spec.ts --headed`
- AB 만료 시: `npx playwright test tests/ab-save-auth.spec.ts --headed`
- `.auth-failed` 플래그 남아있으면 원인 해소 후 정리

## 보안 주의사항 (2026-04)

- 외부 프로젝트 클론 시 **CLAUDE.md 내용을 반드시 검토** (프롬프트 인젝션 취약점 확인됨)
- 공식 채널 외 Claude Code 바이너리 다운로드 절대 금지
- AI 생성 코드는 OWASP Top 10 관점에서 검토 (특히 입력 검증, 인증 처리)

## Playwright CLI (2026-04 전환 완료)

- `@playwright/mcp` → `@playwright/cli`로 전환 (토큰 ~4배 절약: 114K → 27K/테스트)
- 사용법: `playwright-cli <command>` (bash 직접 호출)
- 주요 명령어: `snapshot`, `click <ref>`, `screenshot`, `open <url>`, `goto <url>`, `type <text>`, `fill <target> <text>`
- MCP 브라우저 조작이 필요한 경우 `playwright-cli`로 대체
- `playwright-test` MCP는 테스트 실행용으로 별도 유지

## Quick Troubleshooting

| 증상              | 조치                                |
| ----------------- | ----------------------------------- |
| 401 Unauthorized  | 세션 재저장 후 재실행               |
| Admin 모바일 실패 | 데스크톱 전용 뷰포트 확인           |
| Flaky 반복        | `getByRole()` 중심 로케이터 재구성  |
| 로딩 타임아웃     | 공통 wait 메서드/타임아웃 상수 점검 |

## Key Files

- `playwright.config.ts` — 프로젝트 설정
- `global-setup.js` — 인증 점검/갱신
- `tests/pages/base.page.ts` — BasePage (공통 wait, 타임아웃)
- `tests/pages/index.ts` — POM export 진입점
- `tests/helpers/admin/index.ts` — Admin 유틸
