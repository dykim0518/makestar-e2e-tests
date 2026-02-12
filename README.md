# Makestar E2E Tests

Makestar.com 서비스 E2E 모니터링 테스트 (Playwright + Page Object Model)

## 프로젝트 구조

```
├── playwright.config.js          # 로컬 실행용 설정
├── playwright.ci.config.js       # CI 전용 설정
├── global-setup.js               # 테스트 전 토큰 검증/갱신
├── auto-refresh-token.js         # 토큰 자동 갱신 모듈
├── .github/workflows/
│   └── playwright.yml            # GitHub Actions CI 워크플로우
└── tests/
    ├── cmr_monitoring_pom.spec.ts      # CMR 모니터링 (29개 TC)
    ├── ab_monitoring_pom.spec.ts       # AlbumBuddy 모니터링
    ├── admin_auth_pom.spec.ts          # Admin 인증 Setup
    ├── admin_product_pom.spec.ts       # Admin 상품 관리
    ├── save-auth.spec.ts               # CMR 로그인 세션 저장
    ├── ab-save-auth.spec.ts            # AB 로그인 세션 저장
    ├── pages/                          # Page Object Models
    │   ├── base.page.ts                #   공통 베이스
    │   ├── makestar.page.ts            #   CMR 페이지
    │   ├── albumbuddy.page.ts          #   AlbumBuddy 페이지
    │   └── admin-*.page.ts             #   Admin 페이지들
    ├── helpers/                        # 헬퍼 유틸리티
    │   ├── auth-helper.ts              #   인증 헬퍼
    │   └── admin/                      #   Admin 전용 헬퍼
    └── fixtures/                       # 테스트 데이터
```

## 로컬 실행

### 사전 준비

```bash
npm install
npx playwright install chromium
```

### 최초 로그인 (세션 저장)

```bash
# CMR 세션
npx playwright test tests/save-auth.spec.ts --headed

# AlbumBuddy 세션
npx playwright test tests/ab-save-auth.spec.ts --headed --project=chromium
```

### 테스트 실행

```bash
# CMR 모니터링
npm run test:cmr

# Admin 테스트 (인증 Setup 포함)
npm run test:admin

# 전체 실행
npm test

# 특정 테스트만 실행
npx playwright test -g "TC-HOME"

# 브라우저 표시 모드
HEADED=true npm run test:cmr
```

## CI (GitHub Actions)

`main`/`master` 브랜치에 push 또는 PR 시 자동 실행됩니다.

### 필요한 GitHub Secret

| Secret | 설명 |
|--------|------|
| `AUTH_JSON` | `auth.json` 파일 내용 (로그인 세션) |

Settings > Secrets and variables > Actions > New repository secret

### 수동 실행

Actions 탭 > Playwright Tests > Run workflow
- `test_grep`: 특정 테스트 패턴 (예: `TC-HOME`, `TC-SEARCH`)

### CI 설정 (`playwright.ci.config.js`)

- headless 고정
- chromium만 사용
- `cmr_monitoring_pom.spec.ts`만 실행
- globalSetup 비활성 (CI에서 수동 로그인 불가)

## 테스트 목록 (CMR 모니터링)

| 그룹 | TC ID | 설명 |
|------|-------|------|
| A. 기본 페이지 | TC-HOME ~ TC-PRODUCT | Home, Event, Product 페이지 |
| B. GNB | TC-NAV-SHOP ~ TC-NAV-FUNDING | Shop, Funding 이동 |
| C. 검색 | TC-SEARCH ~ TC-RECENT | 검색 UI, 결과, 필터 |
| D. 마이페이지 | TC-MYPAGE ~ TC-RAFFLE | 주문, 배송지, 응모 |
| E. 상품/장바구니 | TC-OPTION ~ TC-GUEST | 옵션, 품절, 장바구니 |
| F. 아티스트 | TC-ARTIST ~ TC-FILTER | 프로필, 필터링 |
