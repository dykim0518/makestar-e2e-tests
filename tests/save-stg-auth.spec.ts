import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const STG_AUTH_FILE = path.join(__dirname, "..", "stg-auth.json");

test("STG 로그인 세션 저장 (수동 로그인)", async ({ page, context }) => {
  test.setTimeout(300000); // 5분 timeout

  console.log("");
  console.log("=".repeat(70));
  console.log("🔐 메이크스타 STG 로그인 세션 저장 도구");
  console.log("=".repeat(70));
  console.log("");

  // STG 로그인 페이지로 이동
  console.log("🌐 STG 로그인 페이지로 이동 중...");
  await page.goto(
    "https://stage-auth.makeuni2026.com/login/?application=MAKESTAR&redirect_url=https://stage-new.makeuni2026.com/my-page",
  );
  await page.waitForTimeout(2000);

  console.log("");
  console.log("┌" + "─".repeat(68) + "┐");
  console.log(
    "│" + " ".repeat(16) + "📋 STG 로그인 안내" + " ".repeat(33) + "│",
  );
  console.log("├" + "─".repeat(68) + "┤");
  console.log(
    "│ 1. 브라우저에서 Google 또는 다른 방법으로 로그인하세요           │",
  );
  console.log(
    "│ 2. 로그인 완료 후 my-page로 리다이렉트되면 자동 저장됩니다       │",
  );
  console.log(
    "│ 3. 최대 3분 동안 대기합니다                                      │",
  );
  console.log("└" + "─".repeat(68) + "┘");
  console.log("");

  // 로그인 완료 대기 (my-page로 리다이렉트 되는지 확인)
  let loginSuccess = false;
  const maxWaitTime = 180000; // 3분
  const checkInterval = 2000; // 2초마다 확인
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    const currentUrl = page.url();

    // 로그인 성공 조건: STG my-page에 있고 auth/login이 아닌 경우
    if (
      currentUrl.includes("stage-new.makeuni2026.com/my-page") &&
      !currentUrl.includes("stage-auth.makeuni2026.com") &&
      !currentUrl.includes("login")
    ) {
      loginSuccess = true;
      console.log("");
      console.log("✅ STG 로그인 감지! 세션 저장 중...");
      break;
    }

    // STG 메인 페이지로 이동한 경우도 로그인 성공으로 간주
    if (
      currentUrl === "https://stage-new.makeuni2026.com/" ||
      currentUrl === "https://stage-new.makeuni2026.com"
    ) {
      // my-page로 이동해서 확인
      await page.goto("https://stage-new.makeuni2026.com/my-page", {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(2000);

      const afterUrl = page.url();
      if (!afterUrl.includes("login") && !afterUrl.includes("auth")) {
        loginSuccess = true;
        console.log("");
        console.log("✅ STG 로그인 성공! 세션 저장 중...");
        break;
      }
    }

    await page.waitForTimeout(checkInterval);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    process.stdout.write(
      `\r⏳ 로그인 대기 중... (${elapsed}초/${maxWaitTime / 1000}초)`,
    );
  }

  console.log("");

  if (loginSuccess) {
    // 세션 저장
    await context.storageState({ path: STG_AUTH_FILE });

    console.log("");
    console.log("=".repeat(70));
    console.log("🎉 STG 로그인 세션 저장 완료!");
    console.log("=".repeat(70));
    console.log("");
    console.log(`📁 저장 위치: ${STG_AUTH_FILE}`);
    console.log("");
    console.log("📌 다음 단계:");
    console.log(
      '   1. stg-auth.json 내용을 GitHub Secret "STG_AUTH_JSON"에 등록',
    );
    console.log("   2. QA Hub에서 CMR + STG 선택 후 테스트 실행");
    console.log("");

    // 저장된 세션 확인
    expect(fs.existsSync(STG_AUTH_FILE)).toBeTruthy();
    const authData = JSON.parse(fs.readFileSync(STG_AUTH_FILE, "utf-8"));
    console.log(`🍪 저장된 쿠키 수: ${authData.cookies?.length || 0}개`);
    console.log("");
  } else {
    console.log("");
    console.log("❌ 로그인 시간 초과");
    console.log(
      "다시 시도: npx playwright test tests/save-stg-auth.spec.ts --headed",
    );
    console.log("");
    throw new Error("STG 로그인 시간 초과");
  }
});

test("저장된 STG 세션 확인", async ({ page, context }) => {
  // 기존 세션 파일 확인
  if (!fs.existsSync(STG_AUTH_FILE)) {
    console.log("❌ stg-auth.json 파일이 없습니다.");
    console.log(
      '먼저 STG 로그인 세션을 저장하세요: npx playwright test tests/save-stg-auth.spec.ts -g "STG 로그인 세션 저장" --headed',
    );
    throw new Error(
      "stg-auth.json 파일이 없어 저장된 세션 확인을 진행할 수 없습니다.",
    );
  }

  // 세션 로드
  const authData = JSON.parse(fs.readFileSync(STG_AUTH_FILE, "utf-8"));
  console.log(
    `📂 stg-auth.json 로드됨 (쿠키 ${authData.cookies?.length || 0}개)`,
  );

  // 쿠키 추가
  if (authData.cookies && authData.cookies.length > 0) {
    await context.addCookies(authData.cookies);
    console.log("🍪 쿠키 적용 완료");
  }

  // STG my-page 접속하여 로그인 상태 확인
  await page.goto("https://stage-new.makeuni2026.com/my-page", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  console.log(`📍 현재 URL: ${currentUrl}`);

  if (!currentUrl.includes("login") && !currentUrl.includes("auth")) {
    console.log("✅ STG 세션 유효! 로그인 상태입니다.");

    // 로그아웃 버튼 확인
    const logoutBtn = page
      .locator("text=로그아웃, text=Logout, text=Log out")
      .first();
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("✅ 로그아웃 버튼 발견 - 로그인 확인됨");
    }
  } else {
    console.log("⚠️ STG 세션이 만료되었거나 유효하지 않습니다.");
    console.log(
      '다시 로그인하세요: npx playwright test tests/save-stg-auth.spec.ts -g "STG 로그인 세션 저장" --headed',
    );
  }
});
