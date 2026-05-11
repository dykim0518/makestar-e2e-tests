/**
 * CI용 auth.json 토큰 유효성 검증
 *
 * 검증 대상:
 *   - refresh_token 쿠키 존재 여부
 *   - refresh_token 만료 시간 (JWT exp 또는 cookie expires)
 *
 * 종료 코드:
 *   0 = 유효 (잔여 > WARN_THRESHOLD)
 *   0 + warning = 유효하지만 곧 만료 (잔여 < WARN_THRESHOLD)
 *   1 = 만료됨 또는 토큰 없음
 *
 * 환경변수:
 *   AUTH_WARN_HOURS  — 경고 임계치 (기본: 6시간)
 *   AUTH_FILE_PATH   — auth.json 경로 (기본: ./auth.json)
 *   AUTH_TARGET_DOMAIN — 검증할 refresh_token 도메인 직접 지정
 *   ENVIRONMENT_INPUT / MAKESTAR_BASE_URL — stg/prod 환경 판별
 */

const fs = require("fs");
const path = require("path");
const {
  domainMatches,
  findRefreshTokens,
  formatRemaining,
  getRefreshTokenStatuses,
  readStorageState,
  resolveTargetDomain,
} = require("./auth-state");

const AUTH_FILE =
  process.env.AUTH_FILE_PATH || path.join(process.cwd(), "auth.json");
const AUTH_FILE_LABEL = path.basename(AUTH_FILE);
const WARN_HOURS = Number(process.env.AUTH_WARN_HOURS) || 6;
const WARN_THRESHOLD_MS = WARN_HOURS * 60 * 60 * 1000;
const TARGET_DOMAIN = resolveTargetDomain();

function main() {
  const authState = readStorageState(AUTH_FILE);
  if (!authState.ok) {
    const message =
      authState.code === "missing"
        ? `${AUTH_FILE_LABEL} 파일이 없습니다.`
        : `${AUTH_FILE_LABEL} 파싱 실패: ${authState.message}`;
    console.log(`::error::${message}`);
    process.exit(1);
  }

  const cookies = authState.cookies;
  if (cookies.length === 0) {
    console.log(
      `::error::${AUTH_FILE_LABEL}에 쿠키가 없습니다 (빈 상태). AUTH_JSON secret을 갱신하세요.`,
    );
    outputRefreshGuide("쿠키 없음");
    process.exit(1);
  }

  const refreshTokens = findRefreshTokens(cookies);
  if (refreshTokens.length === 0) {
    console.log(
      "::error::refresh_token 쿠키를 찾을 수 없습니다. AUTH_JSON secret을 갱신하세요.",
    );
    outputRefreshGuide("refresh_token 없음");
    process.exit(1);
  }

  const targetRefreshTokens = refreshTokens.filter((rt) =>
    domainMatches(rt.domain, TARGET_DOMAIN),
  );
  if (targetRefreshTokens.length === 0) {
    console.log(
      `::error::${TARGET_DOMAIN} refresh_token 쿠키를 찾을 수 없습니다. 실행 환경에 맞는 AUTH_JSON/STG_AUTH_JSON secret을 갱신하세요.`,
    );
    outputRefreshGuide(`${TARGET_DOMAIN} refresh_token 없음`);
    process.exit(1);
  }

  const now = Date.now();
  let hasValid = false;
  let minRemaining = Infinity;
  const results = getRefreshTokenStatuses(cookies, TARGET_DOMAIN, now);

  for (const result of results) {
    if (result.isTarget && result.status === "valid" && result.remaining) {
      hasValid = true;
      minRemaining = Math.min(minRemaining, result.remaining);
    }
  }

  // 결과 출력
  console.log(`=== ${AUTH_FILE_LABEL} 토큰 검증 ===`);
  console.log(`검증 대상 도메인: ${TARGET_DOMAIN}`);
  for (const r of results) {
    const icon =
      r.status === "valid" ? "✅" : r.status === "expired" ? "❌" : "❓";
    const remainStr = r.remaining
      ? formatRemaining(Math.abs(r.remaining))
      : "N/A";
    const label =
      r.status === "expired"
        ? `만료됨 (${remainStr} 전)`
        : `잔여: ${remainStr}`;
    const targetLabel = r.isTarget ? "대상" : "참고";
    console.log(
      `${icon} refresh_token @ ${r.domain} (${targetLabel}) — ${label}`,
    );
  }

  // GitHub Actions output 설정
  const ghOutput = process.env.GITHUB_OUTPUT;
  if (ghOutput) {
    fs.appendFileSync(ghOutput, `auth_valid=${hasValid}\n`);
    fs.appendFileSync(
      ghOutput,
      `auth_remaining_hours=${hasValid ? Math.floor(minRemaining / 3600000) : 0}\n`,
    );
  }

  if (!hasValid) {
    console.log("");
    console.log(
      `::error::${TARGET_DOMAIN} refresh_token이 만료되었습니다. 테스트 실행을 중단합니다.`,
    );
    outputRefreshGuide(`${TARGET_DOMAIN} 토큰 만료`);
    process.exit(1);
  }

  if (minRemaining < WARN_THRESHOLD_MS) {
    console.log("");
    console.log(
      `::warning::refresh_token 잔여 시간이 ${WARN_HOURS}시간 미만입니다 (${formatRemaining(minRemaining)}). 갱신을 권장합니다.`,
    );
    outputRefreshGuide("만료 임박");
    // 경고만 하고 테스트는 계속 진행
    process.exit(0);
  }

  console.log(`\n✅ 토큰 유효 (최소 잔여: ${formatRemaining(minRemaining)})`);
}

function outputRefreshGuide(reason) {
  const guide = [
    "",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `🔑 토큰 갱신 필요 — ${reason}`,
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "",
    "로컬에서 아래 명령어를 실행하세요:",
    "",
    "  npm run auth:refresh",
    "",
    "(브라우저에서 로그인 → 자동 저장 → GitHub Secret 동기화)",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  ];
  console.log(guide.join("\n"));

  // GitHub Actions step summary에도 기록
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const md = [
      "## 🔑 인증 토큰 갱신 필요",
      "",
      `**사유**: ${reason}`,
      "",
      "로컬에서 다음 명령어를 실행하세요:",
      "",
      "```bash",
      "npm run auth:refresh",
      "```",
      "",
      "> 브라우저에서 로그인 완료 후 자동으로 auth.json 저장 + GitHub Secret 동기화됩니다.",
    ];
    fs.appendFileSync(summaryPath, md.join("\n") + "\n");
  }
}

main();
