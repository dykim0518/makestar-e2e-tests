# my-playwright-tests Remediation Plan

작성일: 2026-05-08
대상: `my-playwright-tests`
목적: 테스트 자동화 자산을 더 늘리기 전에 green 결과의 신뢰도와 실행 게이트 일관성을 회복한다.

## 결론

현재 방향은 유지한다. POM 계층, 한글 테스트명, feature 태그, Admin/CMR/AlbumBuddy 분리, CMR 결제 검증, Excel/API 역검증은 계속 가져갈 가치가 있다.

다만 지금은 새 케이스를 대량 추가할 시점이 아니다. 우선순위는 커버리지 확대보다 false-green 제거, 깨진 실행 경로 정리, 변경성 테스트 분리, 인증/게이트 정합성 개선이다.

## 검증된 사실

- `npm run typecheck` 통과.
- `npm run check:false-green` 통과.
- `npx playwright test --config=playwright.ci.config.js --list` 기준 `523 tests in 17 files`.
- `test:ops`, `test:admin:ops`는 존재하지 않는 `playwright.ops.config.js`를 참조한다.
- `test:admin:poca`는 존재하지 않는 `tests/admin_pocaalbum_pom.spec.ts`를 참조한다. 실제 파일은 `tests/admin_poca_album_pom.spec.ts`.
- 정적 검색 기준 `waitForTimeout`, `force: true`, silent catch, XPath, `.nth()` 사용이 다수 남아 있다.
- Claude 리뷰 문서의 `cmr_payment_pom.spec.ts` / `admin_excel_pom.spec.ts` 0 TC 의심은 재확인 결과 사실이 아니다. 두 파일 모두 테스트가 존재한다.

## 원칙

1. green을 믿을 수 있게 만드는 작업을 먼저 한다.
2. 테스트 실패를 숨기는 fallback은 줄이고, 필요한 fallback은 테스트 목적에 맞게 분리한다.
3. 변경성 테스트는 기본 gate에서 분리한다.
4. 인증 파일과 토큰 처리 코드는 민감 파일을 직접 수정하지 않고 구조만 개선한다.
5. 대규모 리팩터링은 먼저 실행 경로와 false-green 문제를 줄인 뒤 진행한다.

## Phase 0: 실행 경로 복구

목표: 명령어가 문서와 package script 기준으로 실제 동작하게 만든다.

작업:

- `package.json`의 `test:admin:poca` 파일명 수정.
- `test:ops`, `test:admin:ops` 처리 방향 결정.
  - 권장: ops config가 필요하면 `playwright.ops.config.js` 추가.
  - ops suite가 아직 준비되지 않았다면 script와 문서에서 제거한다.
- `playwright.config.ts`에서 CMR 스펙 중복 실행 가능성 제거.
  - 권장: 기본 `chromium` project의 ignore에 `**/cmr_*.spec.ts` 추가하고 CMR은 `cmr` project만 실행.
- README와 실제 스크립트 이름 불일치 정리.

검증:

- `npm run typecheck`
- `npm run check:false-green`
- `npx playwright test --project=cmr --list`
- `npx playwright test --project=chromium --list`
- `npm run test:admin:poca -- --list`

## Phase 1: false-green 제거

목표: 필수 검증 실패가 warn, return, silent catch로 녹색 처리되지 않게 한다.

작업:

- `scripts/check-false-green.js`에 다음 패턴 점검 추가를 검토한다.
  - spec 내부 `console.warn` 직후 `return`
  - spec 내부 `.catch(() => {})`
  - spec 내부 `.catch(() => false)` 후 필수 assertion 없이 통과
- Admin POCA 계열의 "없으면 return" 패턴을 필수/선택 조건으로 재분류한다.
- CMR의 broad OR assertion을 목적별 테스트로 분리한다.
  - 비회원 구매 진입
  - 로그인 요구
  - 결제 진입
- 데이터 조건부 skip은 fixture health 실패 또는 별도 non-gate 테스트로 분리한다.

우선 감사 대상:

- `tests/admin_poca_dashboard_pom.spec.ts`
- `tests/admin_poca_readonly_pom.spec.ts`
- `tests/admin_poca_content_pom.spec.ts`
- `tests/admin_poca_album_pom.spec.ts`
- `tests/cmr_monitoring_pom.spec.ts`
- `tests/ab_monitoring_pom.spec.ts`

검증:

- `npm run check:false-green`
- 변경한 spec 단위 `--list`
- 변경한 spec의 대표 smoke 1개 이상 실행

## Phase 2: 변경성 테스트 분리

목표: read-only gate와 mutation/ops 테스트를 분리한다.

작업:

- 삭제, 생성, 수정, 충전, 차감, 캐시 삭제 테스트에 `@suite:mutation` 또는 `@suite:ops` 태그를 붙인다.
- `playwright.ci.config.js`의 `grepInvert` 정책과 태그 명칭을 맞춘다.
- Admin gate에는 read-only 또는 안전한 생성/정리 fixture가 있는 테스트만 남긴다.

우선 감사 대상:

- `tests/admin_user_pom.spec.ts`
- `tests/admin_poca_readonly_pom.spec.ts`
- `tests/admin_poca_content_pom.spec.ts`
- `tests/admin_poca_shop_pom.spec.ts`
- `tests/admin_poca_album_pom.spec.ts`
- `tests/admin_product_pom.spec.ts`

검증:

- `npx playwright test --config=playwright.ci.config.js --project=admin-gate --list`
- mutation/ops 태그가 gate에서 제외되는지 확인

## Phase 3: wait/locator 안정화

목표: hard wait와 사용자 행동을 우회하는 click/DOM 조작을 줄인다.

작업:

- `waitForTimeout`을 이벤트 기반 대기로 치환한다.
  - 다운로드: `page.waitForEvent("download")`
  - API: `page.waitForResponse`
  - 테이블: row count, first row fingerprint, loading hidden
  - 모달/toast: visible/hidden assertion
- spec 내부 `page.locator()` 직접 사용을 POM으로 옮긴다.
- `force: true`, XPath, deep CSS, `.nth()`는 목적과 대체 가능성을 감사한다.

우선 감사 대상:

- `tests/admin_excel_pom.spec.ts`
- `tests/admin_excel_verify_pom.spec.ts`
- `tests/pages/admin-order-list.page.ts`
- `tests/pages/admin-base.page.ts`
- `tests/pages/makestar.page.ts`
- `tests/pages/albumbuddy.page.ts`

검증:

- `npm run typecheck`
- 변경 spec 단위 실행 또는 최소 `--list`

## Phase 4: 인증 구조 정리

목표: 인증 파일과 토큰 검증 로직의 경계를 명확히 한다.

작업:

- `validate-auth.js`, `ci-refresh-auth.js`, `auto-refresh-token.js`의 refresh token 파싱 중복을 공통 유틸로 이동한다.
- `AUTH_FILE_PATH=ab-auth.json`도 검증 가능한 구조로 확장한다.
- Admin 인증 검증은 URL/기본 UI만이 아니라 권한 있는 메뉴, 사용자 식별자, 핵심 API 200을 확인하도록 강화한다.
- `refresh_token`을 URL query로 붙이는 helper는 제거 또는 deprecated 처리한다.

주의:

- `auth.json`, `ab-auth.json`, `admin-tokens.json`, `.env*`는 수정하지 않는다.

검증:

- `npm run auth:validate`
- `AUTH_FILE_PATH=ab-auth.json node scripts/validate-auth.js`가 의도한 결과를 내는지 확인
- Admin auth spec 단위 실행 또는 `--list`

## Phase 5: 구조 리팩터링

목표: 큰 파일의 탐색 비용을 낮춘다.

작업:

- `tests/pages/makestar.page.ts` 분할.
  - `makestar-common.page.ts`
  - `makestar-shop.page.ts`
  - `makestar-mypage.page.ts`
  - `makestar-checkout.page.ts`
- `tests/cmr_monitoring_pom.spec.ts` 분할.
  - home/nav/search
  - mypage/auth
  - cart/product
  - performance
- POCA Admin 미니 page object는 설정 주입형 list page로 통합 가능한지 검토한다.

주의:

- Phase 5는 Phase 0~3 후 진행한다. 지금 바로 큰 분할부터 하면 회귀 원인 분석 비용이 커진다.

## Phase 6: 커버리지 보강

목표: 이미 만든 POM 투자 대비 부족한 실제 사용자 시나리오를 보강한다.

작업:

- AlbumBuddy Request item 입력/검증/제출 직전 시나리오 추가.
- AlbumBuddy Dashboard purchasing/package 상태 검증 강화.
- CMR 결제는 `PAYABLE_PRODUCT_IDS[0]` 고정 대신 후보 순회 방식으로 안정화.
- CMR 결제 성공 후 Admin 주문 조회 연계를 후속 고가치 테스트로 검토.

## 병렬 작업 분배안

### Worker A: execution gate

소유 파일:

- `package.json`
- `playwright.config.ts`
- `playwright.ci.config.js`
- `README.md`

목표:

- 깨진 script 수정.
- CMR 중복 실행 제거.
- gate/list 출력이 의도한 범위인지 확인.

### Worker B: false-green guard

소유 파일:

- `scripts/check-false-green.js`
- false-green 대표 spec 1~2개

목표:

- 정적 검사 확장.
- 명확한 false-green 대표 케이스 수정.

### Worker C: Admin mutation split

소유 파일:

- `tests/admin_user_pom.spec.ts`
- `tests/admin_poca_readonly_pom.spec.ts`
- 필요 시 관련 Admin POCA spec

목표:

- mutation/ops 태그 부여.
- read-only gate 범위 정리.

### Worker D: wait/locator cleanup

소유 파일:

- `tests/admin_excel_pom.spec.ts`
- `tests/admin_excel_verify_pom.spec.ts`
- `tests/pages/admin-order-list.page.ts`

목표:

- hard wait 제거.
- 다운로드/API/테이블 대기를 조건부 대기로 치환.

## 진행 관리 체크리스트

- [x] Phase 0 문서 기준 구현
- [x] Worker별 변경 파일 충돌 확인
- [x] `npm run typecheck`
- [x] `npm run check:false-green`
- [x] 핵심 `--list` 명령 확인
- [ ] 변경 spec 최소 smoke 실행
- [x] 남은 리스크 문서화

## 진행 결과

2026-05-08 기준으로 다수 worker를 병렬 투입해 Phase 0~3의 일부를 우선 적용했다.

완료:

- 깨진 `test:admin:poca` script를 실제 파일명으로 수정했다.
- 존재하지 않는 `playwright.ops.config.js`를 참조하던 `test:ops`, `test:admin:ops` script를 제거하고 README에 현재 미지원 상태를 명시했다.
- 기본 `chromium` project에서 `cmr_*_pom.spec.ts` 중복 실행을 제외했다.
- `scripts/check-false-green.js --strict-patterns` 진단 모드를 추가했다.
- `@suite:ops` 태그로 예치금 충전/차감, POCA 캐시 삭제, POCA Shop 생성/삭제 테스트를 admin gate에서 제외했다.
- Excel 관련 3개 파일에서 hard wait를 조건 기반 대기로 치환했다.
- API 응답 대기는 4xx/5xx를 모두 실패로 취급하도록 보강했다.

검증:

- `npm run typecheck`: 통과
- `npm run check:false-green`: 통과
- `git diff --check`: 통과
- `npx playwright test --project=chromium --list`: 통과, CMR 스펙 제외 확인
- `npx playwright test --project=cmr --list`: 통과, CMR 44개 테스트 확인
- `npm run test:admin:poca -- --list`: 통과, 12개 테스트 확인
- `npx playwright test tests/admin_excel_pom.spec.ts --project=admin-pc --list`: 통과, 12개 테스트 확인
- `npx playwright test --config=playwright.ci.config.js --project=admin-gate --list --grep "QA98|캐시|PS-CREATE|PS-ACTION" --pass-with-no-tests`: 통과, ops 태그 대상 0개 확인

남은 리스크:

- 이 worktree에는 `auth.json`, `admin-tokens.json`이 없어 Admin 실제 smoke 실행은 하지 않았다. 목록 생성은 성공했지만 실제 UI 실행은 토큰이 있는 환경에서 추가 확인이 필요하다.
- `node scripts/check-false-green.js --strict-patterns`는 현재 139건을 보고한다. 이는 새 게이트가 아니라 false-green 부채 정리용 백로그 산출 도구다.
- `test:ops`, `test:admin:ops` script 제거는 외부 자동화가 해당 npm script를 호출하고 있다면 조정이 필요하다.
