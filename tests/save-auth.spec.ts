import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import {
  waitForManualLogin,
  waitForPageReady,
  waitForValidRefreshToken,
} from "./helpers/manual-auth-session";

const AUTH_FILE = path.join(__dirname, "..", "auth.json");

/**
 * 기존 auth.json의 쿠키와 새 컨텍스트 쿠키를 병합하여 저장.
 * 같은 (name + domain) 쌍은 새 값으로 덮어쓰고, 나머지는 유지.
 */
async function mergeAndSaveStorageState(
  context: import("@playwright/test").BrowserContext,
  filePath: string,
): Promise<number> {
  const newState = await context.storageState();

  // 기존 파일이 있으면 쿠키 병합
  if (fs.existsSync(filePath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      if (existing.cookies && existing.cookies.length > 0) {
        // 새 쿠키를 맵으로
        const newMap = new Map<string, (typeof newState.cookies)[number]>();
        for (const c of newState.cookies) {
          newMap.set(`${c.name}@@${c.domain}`, c);
        }
        // 기존 쿠키 중 새 쿠키에 없는 것만 추가
        for (const c of existing.cookies) {
          const key = `${c.name}@@${c.domain}`;
          if (!newMap.has(key)) {
            newMap.set(key, c);
          }
        }
        newState.cookies = [...newMap.values()];
      }
      // origins(localStorage)도 병합
      if (existing.origins && existing.origins.length > 0) {
        const originSet = new Set(
          newState.origins.map((o: { origin: string }) => o.origin),
        );
        for (const o of existing.origins) {
          if (!originSet.has(o.origin)) {
            newState.origins.push(o);
          }
        }
      }
    } catch {
      // 파싱 실패 시 새 상태로 덮어쓰기
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(newState, null, 2));
  return newState.cookies.length;
}

test("로그인 세션 저장 (수동 로그인)", async ({ page, context }) => {
  test.setTimeout(300000); // 5분 timeout

  console.log("");
  console.log("=".repeat(70));
  console.log("🔐 메이크스타 로그인 세션 저장 도구");
  console.log("=".repeat(70));
  console.log("");

  // 메이크스타 로그인 페이지로 이동
  console.log("🌐 메이크스타 로그인 페이지로 이동 중...");
  await page.goto(
    "https://auth.makestar.com/login/?application=MAKESTAR&redirect_url=https://www.makestar.com/my-page",
  );
  await waitForPageReady(page);

  console.log("");
  console.log("┌" + "─".repeat(68) + "┐");
  console.log("│" + " ".repeat(20) + "📋 로그인 안내" + " ".repeat(33) + "│");
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

  const loginSuccess = await waitForManualLogin(page, {
    successMessage: "✅ 로그인 감지! 세션 저장 중...",
    isLoginComplete: (currentUrl) =>
      currentUrl.includes("makestar.com/my-page") &&
      !currentUrl.includes("auth.makestar.com") &&
      !currentUrl.includes("login"),
    onIntermediateUrl: async (currentUrlPage, currentUrl) => {
      if (
        currentUrl === "https://www.makestar.com/" ||
        currentUrl === "https://www.makestar.com"
      ) {
        await currentUrlPage.goto("https://www.makestar.com/my-page", {
          waitUntil: "domcontentloaded",
        });
        await waitForPageReady(currentUrlPage);

        const afterUrl = currentUrlPage.url();
        return !afterUrl.includes("login") && !afterUrl.includes("auth");
      }
      return false;
    },
  });

  console.log("");

  if (loginSuccess) {
    const tokenReady = await waitForValidRefreshToken(
      page,
      "makestar.com",
      "Makestar",
    );

    expect(
      tokenReady,
      "로그인 성공 후 .makestar.com refresh_token이 저장되지 않았습니다.",
    ).toBeTruthy();

    // 세션 저장 (기존 쿠키와 병합)
    const totalCookies = await mergeAndSaveStorageState(context, AUTH_FILE);

    console.log("");
    console.log("=".repeat(70));
    console.log("🎉 로그인 세션 저장 완료!");
    console.log("=".repeat(70));
    console.log("");
    console.log(`📁 저장 위치: ${AUTH_FILE}`);
    console.log("");
    console.log("📌 다음 단계:");
    console.log("   이제 테스트를 실행하면 로그인된 상태로 시작합니다:");
    console.log("   npx playwright test tests/makestar_reg2.spec.ts --headed");
    console.log("");

    // 저장된 세션 확인
    expect(fs.existsSync(AUTH_FILE)).toBeTruthy();
    console.log(`🍪 저장된 쿠키 수: ${totalCookies}개`);
    console.log("");
  } else {
    console.log("");
    console.error("❌ 로그인 시간 초과");
    console.log(
      "다시 시도: npx playwright test tests/save-auth.spec.ts --headed",
    );
    console.log("");
    throw new Error("로그인 시간 초과");
  }
});

test("Admin 로그인 세션 저장 (stage-new-admin)", async ({ page, context }) => {
  test.setTimeout(300000); // 5분 timeout

  console.log("");
  console.log("=".repeat(70));
  console.log("🔐 Admin 로그인 세션 저장 도구");
  console.log("=".repeat(70));
  console.log("");

  // Admin 로그인 페이지로 이동
  console.log("🌐 Admin 로그인 페이지로 이동 중...");
  await page.goto(
    "https://stage-auth.makeuni2026.com/login/?application=MAKESTAR&redirect_url=https://stage-new-admin.makeuni2026.com",
  );
  await waitForPageReady(page);

  console.log("");
  console.log("┌" + "─".repeat(68) + "┐");
  console.log("│" + " ".repeat(20) + "📋 로그인 안내" + " ".repeat(33) + "│");
  console.log("├" + "─".repeat(68) + "┤");
  console.log(
    "│ 1. 브라우저에서 Google 또는 다른 방법으로 로그인하세요           │",
  );
  console.log(
    "│ 2. 로그인 완료 후 Admin 대시보드로 리다이렉트되면 자동 저장      │",
  );
  console.log(
    "│ 3. 최대 3분 동안 대기합니다                                      │",
  );
  console.log("└" + "─".repeat(68) + "┘");
  console.log("");

  const loginSuccess = await waitForManualLogin(page, {
    successMessage: "✅ Admin 로그인 감지! 세션 저장 중...",
    isLoginComplete: (currentUrl) =>
      currentUrl.includes("stage-new-admin.makeuni2026.com") &&
      !currentUrl.includes("login") &&
      !currentUrl.includes("auth"),
  });

  console.log("");

  if (loginSuccess) {
    const tokenReady = await waitForValidRefreshToken(
      page,
      "makeuni2026.com",
      "Admin",
    );

    expect(
      tokenReady,
      "로그인 성공 후 .makeuni2026.com refresh_token이 저장되지 않았습니다.",
    ).toBeTruthy();

    // 세션 저장 (기존 쿠키와 병합)
    const totalCookies = await mergeAndSaveStorageState(context, AUTH_FILE);

    console.log("");
    console.log("=".repeat(70));
    console.log("🎉 Admin 로그인 세션 저장 완료!");
    console.log("=".repeat(70));
    console.log("");
    console.log(`📁 저장 위치: ${AUTH_FILE}`);
    console.log("");
    console.log("📌 다음 단계:");
    console.log("   이제 Admin 테스트를 실행할 수 있습니다:");
    console.log("   npx playwright test tests/admin_test_pom.spec.ts");
    console.log("");

    console.log(`🍪 저장된 쿠키 수: ${totalCookies}개`);
    console.log("");

    expect(loginSuccess).toBe(true);
  } else {
    console.log("");
    console.error("❌ 로그인 실패 또는 시간 초과");
    throw new Error("Admin 로그인 시간 초과");
  }
});

test("STG 공개 사이트 로그인 세션 저장 (stage-new)", async ({
  page,
  context,
}) => {
  test.setTimeout(300000); // 5분 timeout

  console.log("");
  console.log("=".repeat(70));
  console.log("🔐 STG 공개 사이트 로그인 세션 저장 도구");
  console.log("=".repeat(70));
  console.log("");

  // STG 인증 페이지로 이동 (공개 사이트 → my-page 리다이렉트)
  console.log("🌐 STG 로그인 페이지로 이동 중...");
  await page.goto(
    "https://stage-auth.makeuni2026.com/login/?application=MAKESTAR&redirect_url=https://stage-new.makeuni2026.com/my-page",
  );
  await waitForPageReady(page);

  console.log("");
  console.log("┌" + "─".repeat(68) + "┐");
  console.log("│" + " ".repeat(20) + "📋 로그인 안내" + " ".repeat(33) + "│");
  console.log("├" + "─".repeat(68) + "┤");
  console.log(
    "│ 1. 브라우저에서 Google 또는 다른 방법으로 로그인하세요           │",
  );
  console.log(
    "│ 2. 로그인 완료 후 STG my-page로 리다이렉트되면 자동 저장됩니다  │",
  );
  console.log(
    "│ 3. 최대 3분 동안 대기합니다                                      │",
  );
  console.log("└" + "─".repeat(68) + "┘");
  console.log("");

  const loginSuccess = await waitForManualLogin(page, {
    successMessage: "✅ STG 로그인 감지! 세션 저장 중...",
    isLoginComplete: (currentUrl) =>
      currentUrl.includes("stage-new.makeuni2026.com") &&
      !currentUrl.includes("login") &&
      !currentUrl.includes("stage-auth"),
  });

  console.log("");

  if (loginSuccess) {
    // my-page 방문하여 SPA 인증 쿠키도 확보
    await page.goto("https://stage-new.makeuni2026.com/my-page", {
      waitUntil: "domcontentloaded",
    });
    await waitForPageReady(page);

    const totalCookies = await mergeAndSaveStorageState(context, AUTH_FILE);

    console.log("");
    console.log("=".repeat(70));
    console.log("🎉 STG 공개 사이트 로그인 세션 저장 완료!");
    console.log("=".repeat(70));
    console.log("");
    console.log(`📁 저장 위치: ${AUTH_FILE}`);
    console.log(`🍪 저장된 쿠키 수: ${totalCookies}개`);
    console.log("");

    expect(loginSuccess).toBe(true);
  } else {
    console.log("");
    console.error("❌ 로그인 시간 초과");
    throw new Error("STG 공개 사이트 로그인 시간 초과");
  }
});

test("저장된 세션 확인", async ({ page, context }) => {
  // 기존 세션 파일 확인
  if (!fs.existsSync(AUTH_FILE)) {
    console.error("❌ auth.json 파일이 없습니다.");
    console.log(
      '먼저 로그인 세션을 저장하세요: npx playwright test tests/save-auth.spec.ts -g "로그인 세션 저장" --headed',
    );
    throw new Error(
      "auth.json 파일이 없어 저장된 세션 확인을 진행할 수 없습니다.",
    );
  }

  // 세션 로드
  const authData = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
  console.log(`📂 auth.json 로드됨 (쿠키 ${authData.cookies?.length || 0}개)`);

  // 쿠키 추가
  if (authData.cookies && authData.cookies.length > 0) {
    await context.addCookies(authData.cookies);
    console.log("🍪 쿠키 적용 완료");
  }

  // my-page 접속하여 로그인 상태 확인
  await page.goto("https://www.makestar.com/my-page", {
    waitUntil: "domcontentloaded",
  });
  await waitForPageReady(page);

  const currentUrl = page.url();
  console.log(`📍 현재 URL: ${currentUrl}`);

  if (!currentUrl.includes("login") && !currentUrl.includes("auth")) {
    console.log("✅ 세션 유효! 로그인 상태입니다.");

    // 로그아웃 버튼 확인
    const logoutBtn = page
      .locator("text=로그아웃, text=Logout, text=Log out")
      .first();
    if (await logoutBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      console.log("✅ 로그아웃 버튼 발견 - 로그인 확인됨");
    }
  } else {
    console.warn("⚠️ 세션이 만료되었거나 유효하지 않습니다.");
    console.log(
      '다시 로그인하세요: npx playwright test tests/save-auth.spec.ts -g "로그인 세션 저장" --headed',
    );
  }
});
