# 🚀 빠른 실행 가이드 - Makestar E2E 테스트

## ⚡ 3단계로 바로 실행하기

### 1단계: 환경 변수 설정
```powershell
$env:MAKESTAR_ID="dykimqatest01@gmail.com"
$env:MAKESTAR_PW="ehdud0331"
```

### 2단계: 테스트 실행
```powershell
npx playwright test tests/makestar_reg2.spec.ts
```

### 3단계: 결과 확인
```powershell
npx playwright show-report
```

## 📋 한 줄 명령어 (All-in-One)

```powershell
$env:MAKESTAR_ID="dykimqatest01@gmail.com"; $env:MAKESTAR_PW="ehdud0331"; npx playwright test tests/makestar_reg2.spec.ts; npx playwright show-report
```

## 🎯 주요 명령어

| 명령어 | 설명 |
|--------|------|
| `npx playwright test tests/makestar_reg2.spec.ts` | 전체 테스트 실행 |
| `npx playwright test tests/makestar_reg2.spec.ts --ui` | UI 모드로 실행 |
| `npx playwright test tests/makestar_reg2.spec.ts --debug` | 디버그 모드 |
| `npx playwright test tests/makestar_reg2.spec.ts --workers=1` | 순차 실행 |
| `npx playwright test tests/makestar_reg2.spec.ts -g "Home"` | Home 테스트만 |
| `npx playwright show-report` | HTML 리포트 보기 |
| `npx playwright codegen https://www.makestar.com` | 셀렉터 생성기 |

## ✅ 체크리스트

- [ ] Node.js 설치 확인 (`node --version`)
- [ ] Playwright 설치 (`npm install`)
- [ ] 브라우저 설치 (`npx playwright install chromium`)
- [ ] 환경 변수 설정
- [ ] 테스트 실행
- [ ] 리포트 확인

## 📊 예상 결과

```
Running 10 tests using 1 worker

✓ 1) makestar.com 접속 및 초기 모달 처리 (8.4s)
⚠ 2) Home 주요 요소 존재 여부 검증 (12.8s)
✓ 3) 상단 Event 클릭 및 Event 페이지 요소 검증 (11.9s)
✓ 4) [종료된 이벤트] 탭 이동 및 요소 검증 (14.3s)
✓ 5) [진행중인 이벤트] 탭 복귀 및 첫 번째 이벤트 상품 클릭 (9.8s)
✓ 6) Product 페이지 주요 요소 검증 및 옵션 선택 (11.1s)
✓ 7) [구매하기] 클릭 및 로그인 페이지 검증 (11.2s)
✓ 8) 환경 변수 계정으로 로그인 및 payments 페이지 이동 (10.4s)
✓ 9) 상단 makestar 로고 클릭 및 Home 복귀 검증 (11.9s)
⚠ 10) 전체 시나리오 (31.9s)

8 passed, 2 failed (2.4m)
```

## 🔧 문제 해결

### 환경 변수가 안 보임
```powershell
echo $env:MAKESTAR_ID  # 확인
$env:MAKESTAR_ID="dykimqatest01@gmail.com"  # 재설정
```

### 브라우저가 설치되지 않음
```powershell
npx playwright install chromium
```

### 테스트가 너무 느림
```powershell
# 병렬 실행 (더 빠름)
npx playwright test tests/makestar_reg2.spec.ts --workers=4
```

## 📁 주요 파일

| 파일 | 설명 |
|------|------|
| `tests/makestar_reg2.spec.ts` | 테스트 스크립트 |
| `playwright.config.js` | 설정 파일 |
| `README_MAKESTAR_REG2.md` | 상세 가이드 |
| `EXECUTION_RESULT.md` | 실행 결과 |
| `DELIVERY.md` | 최종 제출물 |

## 💡 팁

1. **첫 실행은 느릴 수 있음** (모달 처리, 페이지 로드)
2. **UI 모드 추천** (`--ui` 플래그) - 디버깅에 유용
3. **리포트 확인 필수** - 실패 원인 파악에 도움
4. **순차 실행 권장** (`--workers=1`) - 더 안정적

## 🎯 다음 단계

1. ✅ 테스트 실행 완료
2. 📊 리포트 확인
3. 🔍 실패한 테스트 분석
4. 🛠️ 필요 시 셀렉터 수정
5. 🔄 재실행

---
**빠른 질문? → README_MAKESTAR_REG2.md 참조**
