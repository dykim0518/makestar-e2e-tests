/**
 * Playwright Global Setup
 *
 * 테스트 실행 전에 현재 auth 상태만 검증합니다.
 * 브라우저를 자동으로 열어 복구하지 않고, 수동 갱신 명령을 안내합니다.
 */

const path = require("path");
const { getBrowserAuthState, formatRemaining } = require("./scripts/auth-state");

// ANSI 색상 코드
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
};

function printHeader(message, color = colors.cyan) {
  console.log(`\n${color}${'━'.repeat(70)}${colors.reset}`);
  console.log(`${color}${colors.bold}${message}${colors.reset}`);
  console.log(`${color}${'━'.repeat(70)}${colors.reset}\n`);
}

function printError(message) {
  console.log(`${colors.red}${colors.bold}❌ ${message}${colors.reset}`);
}

function printSuccess(message) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function printWarning(message) {
  console.log(`${colors.yellow}⚠️  ${message}${colors.reset}`);
}

function printInfo(message) {
  console.log(`${colors.cyan}ℹ️  ${message}${colors.reset}`);
}

async function globalSetup() {
  if (process.env.SKIP_GLOBAL_SETUP_AUTH_CHECK === "true") {
    printInfo("수동 auth 갱신 흐름이므로 globalSetup 인증 검증을 건너뜁니다.");
    return;
  }

  printHeader("🔧 Playwright Global Setup - 인증 검증", colors.blue);

  const authState = getBrowserAuthState({
    cwd: process.cwd(),
    env: process.env,
  });
  const authLabel = path.basename(authState.authFilePath);

  if (
    authState.valid &&
    authState.hasUsableCookies &&
    !authState.hasMockData
  ) {
    printSuccess(
      `${authLabel} 유효 (남은 시간: ${formatRemaining(authState.remainingMs)})`,
    );
    console.log("");
    return;
  }

  printHeader("🔑 인증 갱신 필요", colors.yellow);

  if (!authState.exists) {
    printError(`${authLabel} 파일이 없습니다.`);
  } else if (authState.parseError) {
    printError(`${authLabel} 파싱 실패: ${authState.parseError.message}`);
  } else if (!authState.hasUsableCookies) {
    printError(`${authLabel}에 쿠키가 없습니다.`);
  } else if (authState.hasMockData) {
    printError(`${authLabel}에 mock 인증 데이터가 들어 있습니다.`);
  } else {
    printError(`${authLabel}의 refresh_token이 없거나 만료되었습니다.`);
  }

  printInfo("로컬 갱신: npm run auth:refresh");
  if (process.env.CI) {
    printInfo("CI에서는 AUTH_JSON / STG_AUTH_JSON secret을 최신 값으로 유지해야 합니다.");
  }
  console.log("");

  throw new Error(
    `유효한 인증 상태가 없어 테스트를 실행할 수 없습니다. 먼저 npm run auth:refresh 로 ${authLabel}을 갱신하세요.`,
  );
}

module.exports = globalSetup;
