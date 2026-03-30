# E2E 테스트 자동화 워크플로우 가이드

> 대상: Makestar Playwright E2E 테스트 프로젝트
> 작성: 2026-03-30
> 도구: Claude Code + Playwright Test Agents + POM 패턴

---

## 도구 맵

작업 목적별로 어떤 도구를 쓰면 되는지 한눈에 파악합니다.

| 목적             | 명령/도구                         | 언제 사용                    |
| ---------------- | --------------------------------- | ---------------------------- |
| 테스트 계획      | `/generate-e2e` → Planner         | 새 기능/페이지 테스트 설계   |
| 테스트 코드 생성 | `/generate-e2e` → Generator       | 계획 승인 후 코드 자동 생성  |
| 테스트 실행      | `/test-run`                       | 일상적 테스트 실행           |
| 실패 분석        | `test-analyzer` 에이전트          | 실패 원인 파악               |
| 자동 수정        | `playwright-test-healer` 에이전트 | 셀렉터/타이밍 문제 자동 수정 |
| Flaky 정리       | `/analyze-flaky`                  | 간헐적 실패 패턴 감지 + 수정 |
| 커버리지 점검    | `/review-coverage`                | 누락 시나리오 파악           |
| 로케이터 품질    | `locator-optimizer` 에이전트      | POM 셀렉터 감사              |
| 탐색적 테스트    | `/explore-test`                   | 신규 페이지 이슈 탐색        |
| 결과 리포트      | `/test-report`                    | 팀 공유용 상세 리포트        |
| 커밋             | `/commit`                         | 변경사항 커밋                |

---

## 시나리오별 워크플로우

### 1. 새 기능이 배포되었을 때

가장 빈번한 상황입니다. 새 기능/페이지에 대한 E2E 테스트를 추가합니다.

```
[탐색] /explore-test → 페이지 구조 파악, 초기 이슈 발견
  ↓
[설계] /generate-e2e {대상} → Planner가 브라우저 탐색 → specs/에 테스트 계획 저장
  ↓
[검토] 계획 확인 → 시나리오 추가/제외/우선순위 조정
  ↓
[생성] Generator가 코드 생성 → POM 분리 확인
  ↓
[실행] /test-run {파일} → 결과 확인
  ↓
[수정] 실패 시 Healer 자동 수정 (최대 3회) → 재실행
  ↓
[커밋] /commit
```

**실전 예시:**

```
나: "Admin 포카앨범 > 위너 관리 페이지 E2E 테스트 만들어줘"

→ /explore-test https://stage-new-admin.makeuni2026.com /pocaalbum/winner/list
  (페이지 구조 파악, 초기 이슈 리포트)

→ /generate-e2e Admin 위너관리
  (Planner가 계획 생성 → 확인 → Generator가 코드 생성)

→ /test-run admin_pocaalbum_winner_pom.spec.ts
  (실행 → 실패 시 자동 수정)
```

### 2. CI에서 기존 테스트가 깨졌을 때

```
[분석] /test-run {실패 파일} → 실패 재현
  ↓
[진단] test-analyzer 에이전트가 원인 분류
       (Timeout / Assertion / Locator / Auth / Network)
  ↓
  ├── Locator/Timing → Healer 자동 수정 → 재실행 → /commit
  ├── Auth → "npx playwright test tests/save-auth.spec.ts --headed" 안내
  └── Network/로직 → 수동 확인 필요 보고
```

**실전 예시:**

```
나: "admin_order_pom.spec.ts에서 ORD-SEARCH-02 실패해"

→ Claude가 spec + POM 읽기 → 테스트 실행 → 원인 분석
→ 셀렉터 변경이 원인이면 → POM 수정 → 재실행 → 결과 보고
→ API 응답 변경이면 → "서버 측 변경 확인 필요" 보고
```

### 3. Flaky 테스트를 정리할 때

주기적으로 (스프린트 시작 또는 릴리즈 전) 실행합니다.

```
[감지] /analyze-flaky {대상} → 3회 반복 실행 → flaky 목록 추출
  ↓
[분류] Timing / Selector / Network / Auth / State로 원인 분류
  ↓
[수정] Timing/Selector → Healer 자동 수정 → 3회 재실행으로 안정성 확인
  ↓
[보고] 수동 확인 필요한 항목 목록 + 자동 수정 결과
  ↓
[커밋] /commit
```

**실전 예시:**

```
나: "/analyze-flaky admin"

→ Admin 전체 테스트 3회 반복 실행
→ "PA-PAGE-03: 2/3 실패 (Timing) → waitForNetworkStable() 추가로 안정화"
→ "ORD-FLT-02: 1/3 실패 (Network) → API 응답 지연 의심, 수동 확인 필요"
```

### 4. 스프린트 시작 — 커버리지 점검

어디에 테스트가 부족한지 파악하고 우선순위를 정합니다.

```
[분석] /review-coverage {영역} → POM 메서드 활용률 + TC 분포 맵
  ↓
[판단] 높음 우선순위 갭 확인 → 이번 스프린트 목표 선정
  ↓
[생성] /generate-e2e → 선정된 TC 생성
  ↓
[반복] 목표한 TC 수만큼 반복
```

**실전 예시:**

```
나: "/review-coverage pocaalbum"

→ "PA 영역: 총 TC 20개, POM 활용률 72%"
→ "갭: PA-CREATE 계열 2개, PA-ACTION 계열 3개 부족"
→ "높음 우선순위: 앨범 삭제 후 목록 갱신 검증 (PA-ACTION-05)"

나: "/generate-e2e Admin 앨범 삭제 기능"
→ 해당 TC 생성
```

### 5. POM 품질 개선

로케이터가 취약해지면 flaky 테스트의 근본 원인이 됩니다.

```
[감사] "locator-optimizer로 tests/pages/ 전체 감사해줘"
  ↓
[확인] OK / WARN / ERROR 분류 결과 검토
  ↓
[수정] ERROR 항목 우선 수정 → WARN 항목 점진 개선
  ↓
[검증] /test-run → 수정 후 기존 테스트 깨짐 없는지 확인
  ↓
[커밋] /commit
```

---

## 스프린트 사이클 통합

```
스프린트 시작 (Day 1)
│
├── /review-coverage → 이번 스프린트 TC 목표 설정
│
├── 기능 배포마다 반복:
│   ├── /explore-test → 신규 페이지 탐색
│   ├── /generate-e2e → TC 생성
│   └── /test-run → 검증
│
├── 중간 점검 (주 1회):
│   ├── /analyze-flaky → 불안정 테스트 정리
│   └── locator-optimizer → 셀렉터 품질 유지
│
├── CI 실패 발생 시:
│   ├── /test-run → 재현
│   ├── test-analyzer → 원인 분석
│   └── Healer 또는 수동 수정
│
└── 스프린트 종료
    ├── /test-report → 최종 리포트
    └── /review-coverage → 다음 스프린트 갭 확인
```

---

## 도구 조합 팁

### AI가 잘하는 것 (적극 활용)

- POM 보일러플레이트 생성 (새 Page 클래스 골격)
- 로케이터 제안 (getByRole 기반 변환)
- 반복적 TC 코드 생성 (CRUD 패턴)
- 실패 원인 분류 (로그 → 유형 매핑)
- 탐색적 테스트 (페이지 구조 자동 파악)

### AI가 못하는 것 (사람이 판단)

- 테스트 전략 수립 (어디를 얼마나 테스트할지)
- 의미 있는 assertion 설계 (무엇을 검증해야 하는지)
- 도메인 특화 엣지 케이스 (비즈니스 로직 기반)
- 비결정적 실패 판단 (Network/Auth/State 문제)
- Generator 출력의 POM 분리 품질 검증

### 효율적 프롬프트 패턴

```
# 구체적으로 요청 (좋음)
"Admin 주문관리 > 검색 기능에서 상태 조합 필터 테스트 만들어줘.
 기존 AdminOrderPage의 searchByStatus() 메서드를 활용하고,
 배송완료 + 결제취소 조합을 검증해야 해."

# 모호하게 요청 (나쁨)
"주문 테스트 만들어줘"
```

```
# 컨텍스트 제공 (좋음)
"이 테스트가 flaky한데, 최근에 프론트엔드에서 검색 API 엔드포인트를
 /api/v1/orders에서 /api/v2/orders로 변경했어. 관련이 있을까?"

# 컨텍스트 없이 (나쁨)
"이 테스트 고쳐줘"
```

---

## 주의사항 체크리스트

### 항상 확인

- [ ] Generator 출력 → POM에 셀렉터가 분리되었는지
- [ ] 새 TC → Test ID 형식(`{AREA}-{FUNCTION}-{NUMBER}`) 준수
- [ ] 로케이터 → `getByRole()` 우선순위 준수
- [ ] Hard wait → `waitForTimeout()` 사용 여부 (금지)
- [ ] Auth 파일 → `auth.json` 등 수정되지 않았는지

### AI 수정 후 반드시 직접 확인

- Network/Auth/State 유형 실패의 AI 수정안
- 새로 생성된 assertion의 기대값이 실제 비즈니스 로직과 맞는지
- `test.fixme()` / `test.skip()` 이 추가되지 않았는지 (금지)

---

## Quick Reference

| 명령                                    | 단축 사용법              |
| --------------------------------------- | ------------------------ |
| `/test-run cmr`                         | CMR 모니터링 테스트 실행 |
| `/test-run admin`                       | Admin 전체 (setup → pc)  |
| `/test-run admin_pocaalbum_pom.spec.ts` | 단일 파일 실행           |
| `/generate-e2e Admin 앨범관리`          | 앨범관리 E2E 생성        |
| `/analyze-flaky admin`                  | Admin flaky 분석         |
| `/review-coverage pocaalbum`            | POCAAlbum 커버리지 점검  |
| `/explore-test`                         | 탐색적 테스트 (대화형)   |
| `/test-report`                          | 상세 리포트              |
| `/commit`                               | 스마트 커밋              |
