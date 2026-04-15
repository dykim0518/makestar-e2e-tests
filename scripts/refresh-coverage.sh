#!/usr/bin/env bash
set -euo pipefail

# 로컬 Admin 테스트 실행 → 결과를 QA Hub 커버리지 대시보드에 자동 반영.
#
# 사용법:
#   scripts/refresh-coverage.sh                         # 전체 admin_* spec
#   scripts/refresh-coverage.sh admin_order_pom         # 특정 spec만
#   scripts/refresh-coverage.sh admin_user_pom admin_artist_pom   # 여러 개
#
# 요구:
#   - QA Hub 레포: ~/Projects/makestar-qa-hub
#   - .env.local에 DATABASE_URL 설정되어 있어야 함
#   - playwright auth.json 유효해야 함

QA_HUB="${QA_HUB:-$HOME/Projects/makestar-qa-hub}"
RESULTS_FILE="/tmp/coverage-results-$(date +%s).json"
PROJECT="${PROJECT:-admin-pc}"
SUITE="${SUITE:-admin}"

cd "$(dirname "$0")/.."

if [ "$#" -eq 0 ]; then
  SPECS=(admin_artist_pom admin_auth_pom admin_excel_pom admin_excel_verify_pom admin_order_pom admin_poca_album_pom admin_poca_content_pom admin_poca_dashboard_pom admin_poca_readonly_pom admin_poca_shop_pom admin_product_pom admin_user_pom)
else
  SPECS=("$@")
fi

echo "▶ 실행 대상: ${SPECS[*]}"
echo "▶ project=$PROJECT · suite=$SUITE"
echo "▶ 결과 파일: $RESULTS_FILE"
echo

PLAYWRIGHT_JSON_OUTPUT_NAME="$RESULTS_FILE" \
  npx playwright test "${SPECS[@]}" \
  --project="$PROJECT" \
  --reporter=json \
  --retries=0 \
  --workers=2 \
  >/dev/null 2>&1 || true

if [ ! -s "$RESULTS_FILE" ]; then
  echo "❌ 결과 파일 비어있음. 로그 확인 필요."
  exit 1
fi

echo "▶ 결과 ingest 중..."
cd "$QA_HUB"
npx tsx --env-file=.env.local scripts/ingest-results.ts "$RESULTS_FILE" "$SUITE" --reconcile

echo
echo "✅ 완료. 대시보드: https://makestar-qa-hub.vercel.app/coverage"
