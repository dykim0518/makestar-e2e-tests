#!/usr/bin/env bash
#
# auth.json 갱신 + GitHub Secret 동기화
#
# 사용법: npm run auth:refresh
#
# 동작:
#   1. save-auth.spec.ts 실행 (브라우저에서 수동 로그인)
#   2. auth.json 갱신 확인
#   3. gh secret set AUTH_JSON 으로 CI secret 동기화
#

set -euo pipefail

cd "$(dirname "$0")/.."

CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

echo -e "${CYAN}${BOLD}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔑 auth.json 갱신 + GitHub Secret 동기화"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${NC}"

# 갱신 전 타임스탬프 기록
BEFORE_TS=0
if [ -f auth.json ]; then
  BEFORE_TS=$(stat -f %m auth.json 2>/dev/null || stat -c %Y auth.json 2>/dev/null || echo 0)
fi

# Step 1: Makestar 공개 사이트 로그인
echo -e "${YELLOW}[1/5]${NC} Makestar 공개 사이트 로그인 (최대 3분 대기)..."
echo ""
SKIP_GLOBAL_SETUP_AUTH_CHECK=true npx playwright test tests/save-auth.spec.ts --headed --retries=0 --workers=1 --project=chromium --reporter=list -g "^로그인 세션 저장 \\(수동 로그인\\)$"

# Step 2: Admin 로그인
echo ""
echo -e "${YELLOW}[2/5]${NC} Admin 로그인 (최대 3분 대기)..."
echo ""
SKIP_GLOBAL_SETUP_AUTH_CHECK=true npx playwright test tests/save-auth.spec.ts --headed --retries=0 --workers=1 --project=chromium --reporter=list -g "^Admin 로그인 세션 저장 \\(stage-new-admin\\)$"

# Step 3: auth.json 갱신 확인
AFTER_TS=$(stat -f %m auth.json 2>/dev/null || stat -c %Y auth.json 2>/dev/null || echo 0)

if [ "$AFTER_TS" -le "$BEFORE_TS" ]; then
  echo -e "${RED}❌ auth.json이 갱신되지 않았습니다. 로그인이 완료되지 않은 것 같습니다.${NC}"
  exit 1
fi

echo -e "${GREEN}✅ auth.json 갱신 완료${NC}"
echo ""

echo -e "${YELLOW}[3/5]${NC} 토큰 검증 중..."
node scripts/validate-auth.js

# 토큰 잔여 시간 출력
node -e "
  const auth = JSON.parse(require('fs').readFileSync('auth.json','utf8'));
  const rt = auth.cookies?.find(c => c.name === 'refresh_token' && c.domain?.includes('makestar'));
  if (rt?.expires) {
    const h = ((rt.expires - Date.now()/1000) / 3600).toFixed(1);
    console.log('   refresh_token 잔여: ' + h + '시간');
  }
"

# Step 3: GitHub Secret 동기화
echo ""
echo -e "${YELLOW}[4/5]${NC} GitHub Secret 동기화 중..."

if ! command -v gh &> /dev/null; then
  echo -e "${RED}❌ gh CLI가 설치되어 있지 않습니다. 수동으로 동기화하세요:${NC}"
  echo "   gh secret set AUTH_JSON < auth.json"
  exit 1
fi

if ! gh auth status &> /dev/null; then
  echo -e "${RED}❌ gh CLI 인증이 필요합니다. 먼저 실행: gh auth login${NC}"
  exit 1
fi

gh secret set AUTH_JSON < auth.json

echo -e "${GREEN}✅ AUTH_JSON secret 동기화 완료${NC}"
echo ""

# 완료
echo -e "${YELLOW}[5/5]${NC} 검증..."
UPDATED=$(gh secret list | grep AUTH_JSON | awk '{print $2}')
echo -e "   SECRET 갱신 시각: ${UPDATED}"

echo ""
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}${BOLD}  ✅ 완료! 이제 CI 테스트를 다시 실행하세요.${NC}"
echo -e "${GREEN}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
