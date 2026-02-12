/**
 * Playwright Global Setup
 * 
 * 테스트 실행 전 자동으로 토큰 유효성을 확인하고 필요시 갱신합니다.
 * 
 * 중요: 토큰 이슈 시 자동으로 브라우저를 열어 로그인을 유도합니다.
 * ISMS 심사로 인해 하루에 한 번은 재로그인이 필요할 수 있습니다.
 */

const { isTokenValid, autoRefreshToken, hasSession, getTokenRemaining, setupGoogleSession } = require('./auto-refresh-token');
const fs = require('fs');
const path = require('path');

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
  printHeader('🔧 Playwright Global Setup - 토큰 검증', colors.blue);
  
  // 1. 토큰 유효성 확인
  if (isTokenValid()) {
    const { hours, minutes } = getTokenRemaining();
    printSuccess(`토큰 유효 (남은 시간: ${hours}시간 ${minutes}분)`);
    console.log('');
    return; // 테스트 계속 진행
  }
  
  // 2. 토큰 만료 - 자동 갱신 시도
  printWarning('토큰이 만료되었습니다!');
  printInfo('자동 갱신을 시도합니다... (최대 1~2분 소요)');
  console.log('');
  
  // 3. 세션이 있으면 먼저 자동 갱신 시도
  if (hasSession()) {
    const success = await autoRefreshToken();
    
    if (success) {
      printSuccess('토큰 자동 갱신 완료!');
      console.log('');
      return; // 테스트 계속 진행
    }
  }
  
  // 4. 자동 갱신 실패 또는 세션 없음 - 브라우저 열어서 로그인 유도
  printHeader('🔐 Google 로그인 필요', colors.yellow);
  console.log(`${colors.yellow}${colors.bold}브라우저가 열립니다. Google 계정으로 로그인해주세요!${colors.reset}`);
  console.log('💡 ISMS 심사로 인해 하루 1회 이상 재로그인이 필요합니다.\n');
  console.log(`${colors.cyan}로그인 완료 후 자동으로 테스트가 시작됩니다...${colors.reset}\n`);
  
  // 브라우저 열어서 Google 로그인 실행
  const loginSuccess = await setupGoogleSession();
  
  if (loginSuccess) {
    printSuccess('Google 로그인 완료! 테스트를 시작합니다.');
    console.log('');
    return; // 테스트 계속 진행
  }
  
  // 5. 로그인도 실패한 경우
  printHeader('❌ 로그인 실패', colors.red);
  console.log('Google 로그인이 완료되지 않았습니다.\n');
  console.log('다시 시도하려면 테스트를 재실행하거나,');
  console.log(`${colors.cyan}${colors.bold}   node auto-refresh-token.js --setup${colors.reset}\n`);
  console.log('명령어를 직접 실행하세요.\n');
  
  // 테스트 실행 중단
  throw new Error('\n\n🚫 로그인이 완료되지 않아 테스트를 실행할 수 없습니다.\n   테스트를 다시 실행하면 브라우저가 열립니다.\n');
}

module.exports = globalSetup;
