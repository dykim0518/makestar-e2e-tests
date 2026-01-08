# Makestar.com E2E Test Suite 🚀

Playwright + TypeScript를 사용한 makestar.com (K-pop 팬 플랫폼) E2E 테스트 자동화

## ✨ 주요 기능

- ✅ 18개 통합 테스트 케이스
- 🔐 Google 로그인 자동화
- 🛒 장바구니 기능 검증
- 🎯 이벤트/상품 페이지 테스트
- 📊 결제 플로우 검증
- 🌐 한국어/영어 언어 지원

## 📋 테스트 목록

1. Home 페이지 접속 및 모달 처리
2. Home 주요 요소 검증
3. Event 페이지 이동
4. 종료된 이벤트 탭
5. 진행 중인 이벤트 및 상품 클릭
6. Product 페이지 검증
7. 구매하기 클릭
8. 로그인 및 결제 페이지
9. GNB 네비게이션
10. 검색 기능 (BTS 검색)
11. 검색 결과 페이지
12. Shop 페이지 브라우징
13. Funding 페이지
14-17. MyPage 기능 (주문 조회, 프로필, 배송지 등)
18. **장바구니 기능** (신규: 담기, 수량 변경, 삭제)

## 🚀 빠른 시작

### 1. 환경 설정
\\\ash
npm install
npx playwright install
\\\

### 2. 로그인 세션 저장 (처음 한 번만)
\\\ash
npx playwright test tests/save-auth.spec.ts --headed
\\\
- 브라우저가 열리면 Google로 로그인하세요
- 자동으로 \uth.json\ 파일이 생성됩니다

### 3. 테스트 실행
\\\ash
# 모든 테스트 실행
npx playwright test tests/monitoring_core_features_poc.spec.ts

# 특정 테스트만 실행
npx playwright test --grep "장바구니"

# 브라우저 열고 실행 (디버깅)
npx playwright test --headed

# 느린 모션으로 실행
npx playwright test --headed --headed-slow-mo=1000
\\\

## 📊 테스트 결과 확인
\\\ash
# HTML 리포트 열기
npx playwright show-report
\\\

## 🛠️ 환경 변수 설정 (선택)

### Windows PowerShell
\\\powershell
\="your-email@gmail.com"
\="your-password"
npx playwright test
\\\

### Linux/Mac
\\\ash
export MAKESTAR_ID="your-email@gmail.com"
export MAKESTAR_PW="your-password"
npm test
\\\

## 📁 프로젝트 구조
\\\
makestar-e2e-tests/
├── tests/
│   ├── monitoring_core_features_poc.spec.ts  (메인 테스트)
│   └── save-auth.spec.ts                      (로그인 세션 저장)
├── playwright.config.js                       (설정)
├── package.json
├── .gitignore
├── .env.example                               (템플릿)
├── README.md
└── LOGIN_GUIDE.md
\\\

## 🔐 보안 주의사항

⚠️ **절대 GitHub에 업로드하면 안 됨:**
- \.env\ 파일 (비밀번호 포함)
- \uth.json\ 파일 (세션 쿠키 포함)
- 개인 정보

✅ **안전하게 사용하기:**
1. \.env.example\ 파일에 템플릿만 작성
2. 로컬에서 \.env\ 파일 생성 후 사용
3. 모든 민감한 파일은 \.gitignore\에 등록

## 🧪 테스트 특징

- **다국어 지원**: 한국어/영어 모드 자동 감지
- **자동 모달 처리**: 팝업 자동 닫기
- **동적 셀렉터**: 요소가 변해도 대응
- **재시도 로직**: 불안정한 네트워크 대응
- **상세 로깅**: 각 단계별 진행 상황 출력

## 📝 로그인 가이드

자세한 로그인 방법은 [LOGIN_GUIDE.md](LOGIN_GUIDE.md) 참조

## 🐛 문제 해결

### 테스트가 실패할 때
1. \playwright-report/\ 폴더에서 HTML 리포트 확인
2. \	est-results/\ 폴더에서 스크린샷 확인
3. \--headed\ 옵션으로 브라우저 열어서 확인

### Google 로그인 안 될 때
\\\ash
npx playwright test tests/save-auth.spec.ts --headed --debug
\\\

## 📚 추가 정보

- [Playwright 공식 문서](https://playwright.dev)
- [makestar.com](https://www.makestar.com)

## 🤝 기여

버그 리포트나 개선 사항은 Issues에서 제출해주세요.

## 📄 라이선스

MIT License - 자유롭게 사용하세요!

---

**최종 업데이트**: 2026년 1월 8일
