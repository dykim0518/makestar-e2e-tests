# Admin Order 안정화 파일럿 계획

> 작성일: 2026-04-29
> 대상 저장소: `my-playwright-tests`
> 파일럿 대상: `tests/admin_order_pom.spec.ts`
> 목적: 기존 Admin 주문관리 테스트의 flaky 가능성을 줄이고, 실패 원인 파악 속도를 높인다.

---

## 1. 배경

### 검증된 사실

- `tests/admin_order_pom.spec.ts`에는 32개의 테스트가 있다.
- 같은 파일 안에 `page.waitForTimeout()` 사용이 10건 있다.
- 같은 파일 안에 `page.locator()` 직접 사용은 0건이다.
- QA102/QA100 영역에는 `page.getByText()`, `page.getByRole()`, `page.evaluate()` 기반의 직접 조작이 남아 있다.
- 공통 기반으로 `AdminBasePage`, `OrderListPage`, `initPageWithRecovery`, `waitForTableOrNoResult`가 이미 존재한다.
- 프로젝트 규칙상 임의 hard wait는 지양하고, POM과 조건부 대기를 우선해야 한다.

### 추정

- 현재 가장 큰 개선 여지는 새 테스트 추가가 아니라 QA102/QA100 영역의 대기와 직접 조작을 `OrderListPage` 메서드로 모으는 데 있다.
- `waitForTimeout()`은 대부분 드롭다운/체크박스 토글과 검색 결과 반영을 기다리기 위한 보완 대기로 보인다.
- `page.evaluate()`로 DOM을 직접 탐색하는 결제수단 체크박스 선택 로직은 UI 변경에 취약할 가능성이 있다.

---

## 2. 참고 사례에서 가져올 원칙

### 토스인컴 E2E 자동화 사례

- Functional POM으로 테스트 본문을 시나리오 중심으로 유지한다.
- 페이지 이동, 새 탭, 클릭 실패, 대기 실패를 공통 레이어에서 다룬다.
- 실패 메시지는 어떤 단계에서 무엇을 기대했는지 드러나야 한다.

### 배민 커머스 어드민 사례

- 어드민 테스트는 메뉴/기능 단위로 실행과 결과 확인이 가능해야 한다.
- 다만 이번 파일럿에서는 QA Hub 확장보다 테스트 자체 안정화를 우선한다.

### DoorDash 테스트 격리 사례

- 테스트 데이터 격리는 장기적으로 필요하다.
- 이번 파일럿에서는 데이터 생성/정리 체계 도입을 제외하고, 기존 데이터 기반 검증의 안정성만 다룬다.

---

## 3. 파일럿 목표

1. `admin_order_pom.spec.ts`의 QA102/QA100 영역에서 hard wait를 조건부 대기로 대체한다.
2. 결제수단 필터 선택, 조회 실행, 결과 안정화 확인을 `OrderListPage` 메서드로 이동한다.
3. 실패 메시지에 현재 URL, 대상 필터명, 기대 상태, 실제 관측값을 포함한다.
4. 기존 테스트 의미와 검증 강도는 낮추지 않는다.
5. 변경 패턴을 `admin_product`와 `cmr_monitoring`으로 확장 가능한 형태로 남긴다.

---

## 4. 포함 범위

### 대상 파일

- `tests/admin_order_pom.spec.ts`
- `tests/pages/admin-order-list.page.ts`
- 필요 시 `tests/pages/admin-base.page.ts`
- 필요 시 `tests/helpers/admin/test-helpers.ts`

### 우선 정리 대상

1. `QA102-FLT-01`
   - 결제수단 `예치금` 필터 선택
   - 조회 후 결과 영역 확인

2. `QA102-FLT-02`
   - 예치금 필터 적용
   - 결과 내 다른 결제수단 미노출 검증

3. `QA100-DATA-01`
   - 예치금 필터 적용
   - 결제상태 `결제완료` 노출 검증

4. 공통 중복 로직
   - 결제수단 드롭다운 열기
   - 필터 옵션 선택
   - 검색 실행 후 테이블/검색결과 없음/요약 영역 대기
   - body 텍스트 기반 카운트 수집

---

## 5. 제외 범위

- QA Hub UI 변경
- Slack 알림 변경
- GitHub Actions workflow 변경
- 테스트 데이터 registry/cleanup 도입
- Maestro 모바일 자동화 개선
- `admin_product`, `cmr_monitoring` 실제 수정
- 대규모 POM 구조 재설계
- `auth.json`, `ab-auth.json`, `admin-tokens.json` 수정
- commit/push

---

## 6. 변경 원칙

1. 테스트 본문은 시나리오와 assertion 중심으로 유지한다.
2. 셀렉터와 UI 조작은 가능한 한 `OrderListPage`에 둔다.
3. `waitForTimeout()` 제거는 기계적으로 하지 않는다. 대체 조건이 명확한 경우에만 제거한다.
4. `catch(() => {})`는 실패를 숨기지 않는 범위에서만 사용한다.
5. 실패 메시지는 다음 정보를 포함한다.
   - 실행 단계
   - 대상 필터 또는 탭
   - 현재 URL
   - 기대값
   - 실제 관측값
6. 데이터가 없을 수 있는 경우는 `검색결과 없음` 또는 `전체 0건`처럼 제품이 제공하는 빈 상태를 검증한다.
7. 검증 강도는 낮추지 않는다. 불안정한 assertion을 제거하는 대신 관측 조건을 명확히 한다.

---

## 7. 제안 구현 단위

### 1단계: 현황 감사

- `QA102-*`, `QA100-*` 테스트에서 중복된 동작을 목록화한다.
- `OrderListPage`에 이미 있는 결제수단 관련 메서드를 확인한다.
- 기존 메서드 재사용 가능 여부를 먼저 판단한다.

완료 기준:

- 유지할 테스트 의미와 POM으로 옮길 동작이 구분되어 있다.

### 2단계: POM 메서드 보강

예상 후보:

- `applyPaymentMethodFilter(paymentMethod: string)`
- `clickSearchAndWaitForOrderResult()`
- `expectOrderResultAreaLoaded(context: string)`
- `getVisiblePaymentMethodCounts()`
- `getVisiblePaymentStatusCounts()`

완료 기준:

- QA102/QA100 테스트 본문에서 직접 UI 조작이 줄어든다.
- 실패 메시지가 POM 메서드 안에서 구체화된다.

### 3단계: spec 정리

- QA102/QA100 테스트를 POM 메서드 중심으로 재작성한다.
- assertion은 기존 의도를 유지한다.
- 테스트명은 유지한다.

완료 기준:

- `tests/admin_order_pom.spec.ts`의 `page.waitForTimeout()`이 감소한다.
- 같은 파일의 테스트 본문이 더 짧고 읽기 쉬워진다.

### 4단계: 검증

기본 검증:

```bash
npm run typecheck
npm run check:false-green
npx playwright test tests/admin_order_pom.spec.ts --project=admin-setup --project=admin-pc --retries=0 --reporter=list
```

가능하면 반복 검증:

```bash
for i in 1 2 3; do
  npx playwright test tests/admin_order_pom.spec.ts --project=admin-setup --project=admin-pc --retries=0 --reporter=list
done
```

인증 문제 시:

```bash
npm run auth:validate
```

주의:

- 인증 파일은 직접 수정하지 않는다.
- 인증 만료가 원인이면 테스트 안정화 작업과 분리해서 처리한다.

---

## 8. 성공 기준

### 정량 기준

- `tests/admin_order_pom.spec.ts`의 `page.waitForTimeout()` 10건 중 QA102/QA100 관련 사용을 우선 제거 또는 축소한다.
- QA102/QA100 테스트 본문에서 직접 UI 조작 중복을 제거한다.
- `npm run typecheck`가 통과한다.
- `npm run check:false-green`이 통과한다.
- `admin_order` 단일 스펙 실행이 통과한다.

### 정성 기준

- 실패 로그만 봐도 결제수단 필터 선택 실패, 조회 결과 로드 실패, 결과 정합성 실패를 구분할 수 있다.
- `OrderListPage` 메서드 이름만으로 테스트 시나리오 흐름을 이해할 수 있다.
- 이후 `admin_product`나 `cmr_monitoring` 안정화에 재사용할 수 있는 패턴이 남는다.

---

## 9. 리스크와 대응

| 리스크 | 영향 | 대응 |
| --- | --- | --- |
| Admin 인증 만료 | 테스트 실행 실패 | `auth:validate`로 분리 확인, 인증 파일 직접 수정 금지 |
| STG 데이터 변동 | 결과 assertion 실패 | 빈 상태와 실제 데이터 상태를 제품 UI 기준으로 검증 |
| 결제수단 UI 구조 변경 | 필터 선택 실패 | role/label/text 우선, 불가피한 DOM 탐색은 POM에 격리 |
| networkidle 불안정 | 검색 결과 대기 실패 | 테이블, no-result, summary 중 하나가 안정화되는 조건으로 대체 |
| 공통 메서드 과도한 일반화 | 유지보수 비용 증가 | 주문관리에서 실제 쓰는 동작만 추출 |

---

## 10. 후속 확장 후보

파일럿이 성공하면 다음 순서로 확장한다.

1. `admin_product_pom.spec.ts`
   - 상품/SKU/카테고리 생성과 검색 결과 대기 안정화

2. `cmr_monitoring_pom.spec.ts`
   - 상품 선택, 장바구니, 옵션 선택의 hard wait와 console 로그 정리

3. QA Hub
   - 실패 trace/video/screenshot 링크 노출
   - flaky fingerprint 묶음
   - Slack 알림 개선

4. 테스트 데이터 관리
   - 자동화 데이터 prefix/owner/TTL 규칙
   - 생성 데이터 registry
   - 안전한 cleanup 또는 비활성화 정책

---

## 11. 다음 작업 프롬프트

구현을 시작할 때 사용할 요청:

```text
admin_order 안정화 파일럿을 시작해줘.
docs/admin-order-stabilization-plan.md 범위만 지키고,
QA102/QA100 영역의 hard wait와 직접 UI 조작을 OrderListPage 중심으로 정리해줘.
QA Hub, Slack, GitHub Actions, 테스트 데이터 registry는 건드리지 마.
수정 후 typecheck, false-green check, admin_order 단일 스펙을 실행해서 결과를 알려줘.
```

---

## 12. 실행 결과

### 검증된 사실

- `tests/admin_order_pom.spec.ts`의 QA102/QA100 영역에서 직접 `page.getBy*`, `page.evaluate()`, `page.waitForTimeout()`로 수행하던 결제수단 필터 조작을 `OrderListPage` 메서드로 이동했다.
- `tests/admin_order_pom.spec.ts` 안의 `waitForTimeout` 사용은 0건이다.
- `OrderListPage`에 다음 메서드를 추가 또는 보강했다.
  - `expectPaymentMethodFilterVisible()`
  - `applyPaymentMethodFilter()`
  - `expectOrderResultAreaLoaded()`
  - `getVisiblePaymentMethodCounts()`
  - `getVisiblePaymentStatusCounts()`
- Admin STG 인증은 `auth.json`의 `.makeuni2026.com` refresh token 기준으로 유효하다.
- CMR STG 실행도 `MAKESTAR_BASE_URL=https://stage-new.makeuni2026.com` 환경에서 같은 `.makeuni2026.com` refresh token을 인식한다.
- 확인 시점 기준 refresh token 잔여 시간은 약 89일 23시간이다.

### 검증 결과

```bash
npm run auth:validate
# 통과: refresh_token @ .makeuni2026.com, 잔여 약 89일 23시간

MAKESTAR_BASE_URL=https://stage-new.makeuni2026.com npx playwright test tests/cmr_monitoring_pom.spec.ts --project=cmr --grep='CMR-AUTH-08' --list
# 통과: CMR STG에서 auth.json 로드 및 CMR-AUTH-08 대상 테스트 확인

npx playwright test tests/admin_order_pom.spec.ts --project=admin-setup --project=admin-pc --grep='QA102|QA100' --retries=0 --reporter=list
# 통과: 6 passed

npm run typecheck
# 통과

npm run check:false-green
# 통과

npx playwright test tests/admin_order_pom.spec.ts --project=admin-setup --project=admin-pc --retries=0 --reporter=list
# 통과: 33 passed
```

### 남은 한계

- 전체 Playwright suite는 실행하지 않았다.
- 이번 검증 신뢰도는 typecheck, false-green check, CMR STG auth 로드 확인, Admin 주문관리 단일 스펙 전체 실행에 한정한다.
- `auth.json`, `playwright-session.json`은 공식 인증 플로우로 갱신된 로컬 파일이며 git 추적 대상이 아니다.

---

## 13. 후속 확장: Admin Product QA-39

### 검증된 사실

- `admin_product_pom.spec.ts`의 QA-39 포토카드 SKU 작업 현황 블록에서 남아 있던 `waitForTimeout()` 2건을 제거했다.
- 포토카드 SKU 작업 현황 전용 POM인 `PhotocardSkuWorkPage`를 추가했다.
- SKU명 검색 입력, 검색 버튼, SKU명 컬럼 확인, 검색 실행 후 결과 안정화 대기를 POM으로 이동했다.
- `setupAuthCookies()`의 5분 캐시를 전역 단일 값에서 BrowserContext별 캐시로 변경했다.
  - 기존 구조는 첫 테스트 컨텍스트에만 쿠키를 넣고, 다음 테스트 컨텍스트에서는 쿠키 주입을 건너뛸 수 있었다.
  - 이로 인해 QA-39 두 번째 테스트가 `stage-auth` 로그인 페이지로 리다이렉트되는 문제가 재현되었다.

### 검증 결과

```bash
npm run typecheck
# 통과

npx playwright test tests/admin_product_pom.spec.ts --project=admin-setup --project=admin-pc --grep='QA39' --retries=0 --reporter=list
# 통과: 4 passed

npm run check:false-green
# 통과

npm run auth:validate
# 통과: refresh_token @ .makeuni2026.com, 잔여 약 89일 23시간

npx playwright test tests/admin_order_pom.spec.ts --project=admin-setup --project=admin-pc --grep='QA102|QA100' --retries=0 --reporter=list
# 통과: 6 passed
```

### 남은 한계

- `admin_product_pom.spec.ts` 전체 스펙은 실행하지 않았다.
- 이번 확장은 QA-39 검색 블록과 공유 auth 쿠키 주입 안정화에 한정한다.
