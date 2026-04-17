/**
 * AlbumBuddy 로그인 세션 저장 테스트
 *
 * 사용법:
 *   npx playwright test tests/ab-save-auth.spec.ts --headed --project=chromium
 *
 * 브라우저가 열리면 수동으로 로그인하고, 로그인 완료 후 자동으로 세션이 저장됩니다.
 */

import {
  test,
  expect,
  Page,
  Browser,
  BrowserContext,
  Locator,
} from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { sleep, waitForPageReady } from "./helpers/manual-auth-session";

type StoredCookie = { name: string; value: string; expires?: number };
type StorageState = Awaited<ReturnType<BrowserContext["storageState"]>>;
type AuthSnapshot = {
  hasRefreshToken: boolean;
  hasLoggedInUser: boolean;
  hasAlbumBuddyIndexedDb: boolean;
};

const AB_AUTH_FILE = path.join(__dirname, "..", "ab-auth.json");
const AB_SESSION_FILE = path.join(__dirname, "..", "ab-session-storage.json");
const GLOBAL_AUTH_FILE = path.join(__dirname, "..", "auth.json");
const ALBUMBUDDY_BASE_URL = "https://albumbuddy.kr";
const ALBUMBUDDY_DASHBOARD_URL = `${ALBUMBUDDY_BASE_URL}/dashboard/purchasing`;
const ALBUMBUDDY_AUTH_URL =
  "https://auth.makestar.com/login/?application=MAKESTAR&redirect_url=https://albumbuddy.kr/dashboard/purchasing";

test.use({ storageState: { cookies: [], origins: [] } });

function getLoginEntryCandidates(page: Page) {
  return [
    page.getByRole("button", { name: /^\s*Login\s*$/i }).first(),
    page.getByRole("link", { name: /^\s*Login\s*$/i }).first(),
    page.getByRole("button", { name: /^\s*Sign in\s*$/i }).first(),
    page.getByRole("link", { name: /^\s*Sign in\s*$/i }).first(),
    page.getByText(/^\s*Login\s*$/i).first(),
    page.getByText(/^\s*Sign in\s*$/i).first(),
  ];
}

async function hasVisibleLoginEntry(page: Page): Promise<boolean> {
  const candidates = getLoginEntryCandidates(page);

  for (const candidate of candidates) {
    const visible = await candidate
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (visible) {
      return true;
    }
  }

  return false;
}

async function clickVisibleLoginEntry(page: Page): Promise<boolean> {
  for (const candidate of getLoginEntryCandidates(page)) {
    const visible = await candidate
      .isVisible({ timeout: 1000 })
      .catch(() => false);
    if (!visible) {
      continue;
    }

    await clickLocatorWithFallback(candidate);
    await waitForPageReady(page, { networkIdleTimeout: 5000 });
    return true;
  }

  return false;
}

function getLatestOpenPage(context: BrowserContext): Page | null {
  const openPages = context
    .pages()
    .filter((candidate) => !candidate.isClosed());
  return openPages.at(-1) || null;
}

async function clickVisibleLoginEntryAndResolvePage(page: Page): Promise<Page> {
  const popupPromise = page
    .context()
    .waitForEvent("page", { timeout: 5000 })
    .catch(() => null);
  const clicked = await clickVisibleLoginEntry(page);
  if (!clicked) {
    return page;
  }

  const popup = await popupPromise;
  if (popup && !popup.isClosed()) {
    await waitForPageReady(popup, { networkIdleTimeout: 5000 });
    return popup;
  }

  if (page.isClosed()) {
    return getLatestOpenPage(page.context()) || page;
  }

  return page;
}

function resolveActivePage(page: Page): Page {
  if (!page.isClosed()) {
    return page;
  }
  return getLatestOpenPage(page.context()) || page;
}

async function dismissBlockingModals(page: Page): Promise<void> {
  const doNotShowTexts = [
    "Do not show again",
    "do not show again",
    "Don't show again",
    "Do not show",
    "다시 보지 않기",
    "다시보지않기",
    "다시 보지 않음",
    "오늘 하루 보지 않기",
  ];

  const closeTexts = ["닫기", "확인", "Close", "OK", "close"];

  for (const text of doNotShowTexts) {
    const candidate = page.getByText(text, { exact: false }).first();
    if (await candidate.isVisible({ timeout: 800 }).catch(() => false)) {
      await clickLocatorWithFallback(candidate).catch(() => {});
      await candidate.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});
    }
  }

  for (const text of closeTexts) {
    const candidate = page.getByText(text, { exact: true }).first();
    if (await candidate.isVisible({ timeout: 800 }).catch(() => false)) {
      await clickLocatorWithFallback(candidate).catch(() => {});
      await candidate.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});
    }
  }

  const overlay = page
    .locator('.modal-overlay, [class*="overlay"], [class*="modal"]')
    .first();
  if (await overlay.isVisible({ timeout: 500 }).catch(() => false)) {
    await page.keyboard.press("Escape").catch(() => {});
    await overlay.waitFor({ state: "hidden", timeout: 1000 }).catch(() => {});
  }
}

async function clickLocatorWithFallback(locator: Locator): Promise<void> {
  await locator.scrollIntoViewIfNeeded().catch(() => {});
  await locator.click({ timeout: 3000 }).catch(async () => {
    const handle = await locator.elementHandle();
    if (!handle) {
      throw new Error("클릭 대상 elementHandle을 찾지 못했습니다.");
    }
    try {
      await handle.evaluate((el) => {
        (el as HTMLElement).click();
      });
    } finally {
      await handle.dispose().catch(() => {});
    }
  });
}

function getAuthSnapshotFromState(state: StorageState): AuthSnapshot {
  const hasRefreshToken = state.cookies.some(
    (cookie) =>
      cookie.name === "refresh_token" &&
      /makestar|makeuni/i.test(cookie.domain || ""),
  );

  const hasLoggedInUser = state.origins.some(
    (origin) =>
      /makestar\.com/i.test(origin.origin) &&
      (origin.localStorage || []).some(
        (entry) => entry.name === "LOGGED_IN_USER",
      ),
  );

  const hasAlbumBuddyIndexedDb = state.origins.some((origin) => {
    if (!/albumbuddy\.kr/i.test(origin.origin)) {
      return false;
    }

    const indexedDbs =
      (
        origin as typeof origin & {
          indexedDB?: Array<{ name?: string }>;
        }
      ).indexedDB || [];

    return indexedDbs.some((db) =>
      /firebaseLocalStorageDb/i.test(db.name || ""),
    );
  });

  return {
    hasRefreshToken,
    hasLoggedInUser,
    hasAlbumBuddyIndexedDb,
  };
}

async function getAuthSnapshot(page: Page): Promise<AuthSnapshot> {
  return getAuthSnapshotFromState(
    await page.context().storageState({ indexedDB: true }),
  );
}

async function gotoWithRetry(page: Page, url: string): Promise<void> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      break;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        attempt === 2 ||
        !/interrupted by another navigation|about:blank/i.test(message)
      ) {
        throw error;
      }
      await sleep(1000);
    }
  }
}

async function saveAlbumBuddySessionStorage(page: Page): Promise<void> {
  const entries = await page.evaluate(() => {
    const data: Record<string, string> = {};
    for (let i = 0; i < window.sessionStorage.length; i += 1) {
      const key = window.sessionStorage.key(i);
      if (!key) continue;
      data[key] = window.sessionStorage.getItem(key) || "";
    }
    return data;
  });

  fs.writeFileSync(
    AB_SESSION_FILE,
    JSON.stringify(
      {
        origin: ALBUMBUDDY_BASE_URL,
        entries,
      },
      null,
      2,
    ),
  );
}

async function restoreAlbumBuddySessionStorage(page: Page): Promise<void> {
  if (fs.existsSync(AB_SESSION_FILE)) {
    const payload = JSON.parse(fs.readFileSync(AB_SESSION_FILE, "utf-8"));
    await page.addInitScript((data) => {
      if (window.location.origin === data.origin) {
        for (const [key, value] of Object.entries(data.entries || {})) {
          window.sessionStorage.setItem(key, String(value));
        }
      }
    }, payload);
  }
}

async function getDashboardSessionIndicators(page: Page): Promise<{
  hasNoItemsRegistered: boolean;
  hasOrderRows: boolean;
  hasMeaningfulCounters: boolean;
}> {
  const bodyText = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  const counterLabels = [
    "Waiting",
    "Pending",
    "Paid",
    "Ordered",
    "Shipment",
    "Canceled",
    "On hold",
  ];
  const hasMeaningfulCounters = counterLabels.some((label) =>
    new RegExp(`\\b([1-9]\\d*)\\s+${label}\\b`, "i").test(bodyText),
  );
  const rowCount = await page
    .locator("table tr")
    .count()
    .catch(() => 0);

  return {
    hasNoItemsRegistered: /No items registered\./i.test(bodyText),
    hasOrderRows: rowCount > 1,
    hasMeaningfulCounters,
  };
}

async function isAuthenticatedDashboard(page: Page): Promise<boolean> {
  const currentUrl = page.url();
  if (
    !(
      currentUrl.includes("dashboard") ||
      currentUrl.includes("purchasing") ||
      currentUrl.includes("package")
    )
  ) {
    return false;
  }

  if (currentUrl.includes("login") || currentUrl.includes("auth")) {
    return false;
  }

  const session = await getAuthSnapshot(page);
  if (
    !session.hasRefreshToken ||
    !session.hasLoggedInUser ||
    !session.hasAlbumBuddyIndexedDb
  ) {
    return false;
  }

  const bodyText = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  return (
    !/log in or sign up|enter your email|continue/i.test(bodyText) &&
    /my orders|my packages/i.test(bodyText)
  );
}

async function waitForAuthenticatedDashboard(
  page: Page,
  timeoutMs: number = 15000,
): Promise<boolean> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await isAuthenticatedDashboard(page)) {
      return true;
    }
    await sleep(1000);
  }
  return false;
}

async function waitForAlbumBuddyRedirect(
  page: Page,
  timeoutMs: number = 15000,
): Promise<void> {
  const startedAt = Date.now();
  let redirected = false;
  while (Date.now() - startedAt < timeoutMs) {
    if (page.isClosed()) {
      break;
    }

    const currentUrl = page.url();
    if (currentUrl.includes("albumbuddy.kr")) {
      redirected = true;
      break;
    }

    await sleep(1000);
  }

  if (redirected) {
    await page.waitForLoadState("domcontentloaded").catch(() => {});
  }
}

async function verifySavedSession(browser: Browser | null): Promise<boolean> {
  if (!browser || !fs.existsSync(AB_AUTH_FILE)) {
    return false;
  }

  const verifyContext = await browser.newContext({
    storageState: AB_AUTH_FILE,
  });
  const verifyPage = await verifyContext.newPage();
  await restoreAlbumBuddySessionStorage(verifyPage);
  await gotoWithRetry(
    verifyPage,
    `${ALBUMBUDDY_BASE_URL}/dashboard/purchasing`,
  );
  await waitForPageReady(verifyPage, { networkIdleTimeout: 5000 });
  const verified = await isAuthenticatedDashboard(verifyPage);
  await verifyContext.close();
  return verified;
}

async function tryBootstrapFromGlobalAuth(
  browser: Browser | null,
): Promise<boolean> {
  if (!browser || !fs.existsSync(GLOBAL_AUTH_FILE)) {
    return false;
  }

  try {
    const authData = JSON.parse(fs.readFileSync(GLOBAL_AUTH_FILE, "utf-8"));
    const snapshot = getAuthSnapshotFromState(authData);
    if (!snapshot.hasRefreshToken || !snapshot.hasLoggedInUser) {
      return false;
    }

    const seededContext = await browser.newContext({
      storageState: GLOBAL_AUTH_FILE,
    });
    const seededPage = await seededContext.newPage();
    await gotoWithRetry(seededPage, ALBUMBUDDY_AUTH_URL);
    await waitForAlbumBuddyRedirect(seededPage, 15000);
    await waitForPageReady(seededPage, { networkIdleTimeout: 5000 });
    await dismissBlockingModals(seededPage);

    const seededSnapshot = await getAuthSnapshot(seededPage);
    const seededLoginVisible = await hasVisibleLoginEntry(seededPage);
    const seededBodyText = await seededPage
      .locator("body")
      .innerText()
      .catch(() => "");
    const seededHasAuthPrompt =
      /log in or sign up|enter your email|continue/i.test(seededBodyText);
    const seededLoginControls = await seededPage
      .locator('button, a, [role="button"], [role="link"]')
      .evaluateAll((nodes) =>
        nodes
          .map((node) => ({
            text: (node.textContent || "").replace(/\s+/g, " ").trim(),
            aria: node.getAttribute("aria-label") || "",
            tag: node.tagName,
            className: node.className || "",
          }))
          .filter(
            (item) =>
              /^\s*(login|sign in)\s*$/i.test(item.text) ||
              /^\s*(login|sign in)\s*$/i.test(item.aria),
          )
          .slice(0, 5),
      )
      .catch(() => []);
    console.log(
      `[bootstrap] url=${seededPage.url()} refresh=${seededSnapshot.hasRefreshToken} user=${seededSnapshot.hasLoggedInUser} abIndexedDb=${seededSnapshot.hasAlbumBuddyIndexedDb} loginVisible=${seededLoginVisible} authPrompt=${seededHasAuthPrompt}`,
    );
    if (seededLoginControls.length > 0) {
      console.log(
        `[bootstrap-login-controls] ${JSON.stringify(seededLoginControls)}`,
      );
    }

    let activeSeededPage = seededPage;
    if (
      seededSnapshot.hasRefreshToken &&
      seededSnapshot.hasLoggedInUser &&
      !seededHasAuthPrompt &&
      (seededPage.url().includes("auth.makestar.com") ||
        seededPage.url().includes("www.makestar.com"))
    ) {
      console.log(
        "[bootstrap] Makestar 인증 상태에서 dashboard로 직접 이동 시도",
      );
      await gotoWithRetry(seededPage, ALBUMBUDDY_DASHBOARD_URL);
      await waitForPageReady(seededPage, { networkIdleTimeout: 5000 });
      await dismissBlockingModals(seededPage);
    }

    activeSeededPage = resolveActivePage(activeSeededPage);
    if (!(await waitForAuthenticatedDashboard(activeSeededPage))) {
      await seededContext.close();
      return false;
    }

    await seededContext.storageState({ path: AB_AUTH_FILE, indexedDB: true });
    await saveAlbumBuddySessionStorage(activeSeededPage);
    await seededContext.close();

    return verifySavedSession(browser);
  } catch {
    return false;
  }
}

/**
 * 기존 세션이 유효한지 확인 (headless 모드용)
 */
async function checkExistingSession(page: Page): Promise<boolean> {
  if (!fs.existsSync(AB_AUTH_FILE)) {
    return false;
  }

  try {
    const authData = JSON.parse(fs.readFileSync(AB_AUTH_FILE, "utf-8"));
    const cookies = authData.cookies || [];
    const snapshot = getAuthSnapshotFromState(authData);
    if (!snapshot.hasRefreshToken || !snapshot.hasLoggedInUser) {
      return false;
    }

    // 실제 페이지에서 세션 유효성 확인
    await page.context().addCookies(cookies);
    await restoreAlbumBuddySessionStorage(page);
    await gotoWithRetry(page, `${ALBUMBUDDY_BASE_URL}/dashboard/purchasing`);
    await waitForPageReady(page, { networkIdleTimeout: 5000 });

    return isAuthenticatedDashboard(page);
  } catch {
    return false;
  }
}

test("AlbumBuddy 로그인 세션 저장 (수동 로그인)", async ({
  page,
  context,
}) => {
  const runtimeBrowser = page.context().browser();
  let activePage = page;

  // headless 모드에서는 기존 세션 유효성만 확인 (수동 로그인 불가)
  const isHeadless = !process.env.HEADED && process.env.CI !== undefined;

  if (isHeadless || process.env.CI) {
    console.log("📋 Headless/CI 모드: 기존 세션 유효성 확인");
    const sessionValid = await checkExistingSession(page);
    expect(
      sessionValid,
      "Headless/CI 모드에서는 기존 AlbumBuddy 세션이 유효해야 합니다",
    ).toBe(true);
    if (sessionValid) {
      console.log("✅ 기존 세션이 유효합니다. 수동 로그인 생략.");
    } else {
      console.error("❌ 세션이 유효하지 않습니다. 수동 로그인이 필요합니다.");
      console.log(
        "   npx playwright test tests/ab-save-auth.spec.ts --headed --project=chromium",
      );
      throw new Error(
        "세션 만료 또는 없음 - 수동 로그인 필요 (--headed 모드로 실행)",
      );
    }
  } else {
    test.setTimeout(300000); // 5분 timeout

    console.log("");
    console.log("=".repeat(70));
    console.log("🔐 AlbumBuddy 로그인 세션 저장 도구");
    console.log("=".repeat(70));
    console.log("");

    const bootstrapped = await tryBootstrapFromGlobalAuth(runtimeBrowser);
    if (bootstrapped) {
      console.log("✅ auth.json 기반으로 AlbumBuddy 세션 저장 완료");
    } else {
      // AlbumBuddy 인증 페이지로 직접 이동
      console.log("🌐 AlbumBuddy 로그인 페이지로 이동 중...");
      await gotoWithRetry(page, ALBUMBUDDY_AUTH_URL);
      await waitForAlbumBuddyRedirect(page, 15000);
      await waitForPageReady(page, { networkIdleTimeout: 5000 });
      await dismissBlockingModals(page);

      console.log("");
      console.log("┌" + "─".repeat(68) + "┐");
      console.log("│" + " ".repeat(20) + "📋 로그인 안내" + " ".repeat(33) + "│");
      console.log("├" + "─".repeat(68) + "┤");
      console.log(
        "│ 1. 브라우저에서 이메일/비밀번호로 로그인하세요                   │",
      );
      console.log(
        "│ 2. 로그인 완료 후 Dashboard 페이지로 이동되면 자동 저장됩니다    │",
      );
      console.log(
        "│ 3. 최대 3분 동안 대기합니다                                      │",
      );
      console.log("└" + "─".repeat(68) + "┘");
      console.log("");

      // 로그인 완료 대기
      let loginSuccess = false;
      const maxWaitTime = 180000; // 3분
      const checkInterval = 2000; // 2초마다 확인
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitTime) {
        activePage = resolveActivePage(activePage);
        if (activePage.isClosed()) {
          throw new Error("로그인 도중 활성 페이지를 찾을 수 없습니다");
        }

        const currentUrl = activePage.url();
        const activeSnapshot = await getAuthSnapshot(activePage);
        const activeBodyText = await activePage
          .locator("body")
          .innerText()
          .catch(() => "");
        const activeHasAuthPrompt =
          /log in or sign up|enter your email|continue/i.test(activeBodyText);

        // 로그인 성공 조건: 보호 페이지에 있고, guest shell이 아니라 실제 로그인 상태일 것
        if (await isAuthenticatedDashboard(activePage)) {
          loginSuccess = true;
          console.log("");
          console.log("✅ 로그인 감지! 세션 저장 중...");
          break;
        }

        if (
          (currentUrl.includes("auth.makestar.com") ||
            currentUrl.includes("www.makestar.com")) &&
          activeSnapshot.hasRefreshToken &&
          activeSnapshot.hasLoggedInUser &&
          !activeHasAuthPrompt
        ) {
          await gotoWithRetry(activePage, ALBUMBUDDY_DASHBOARD_URL);
          await waitForPageReady(activePage, { networkIdleTimeout: 5000 });
          await dismissBlockingModals(activePage);
          activePage = resolveActivePage(activePage);

          if (await isAuthenticatedDashboard(activePage)) {
            loginSuccess = true;
            console.log("");
            console.log("✅ auth 페이지에서 dashboard 진입 성공! 세션 저장 중...");
            break;
          }
        }

        // 인증 완료 후 홈/기타 페이지에 떨어진 경우 dashboard로 재확인
        // (auth 신호가 있을 때만 navigate — 로그인 입력 중 깜빡임 방지)
        if (
          currentUrl.includes("albumbuddy.kr") &&
          !currentUrl.includes("/dashboard/") &&
          activeSnapshot.hasRefreshToken &&
          activeSnapshot.hasLoggedInUser &&
          !activeHasAuthPrompt
        ) {
          await dismissBlockingModals(activePage);

          // Dashboard로 이동 시도
          await gotoWithRetry(activePage, ALBUMBUDDY_DASHBOARD_URL);
          await waitForPageReady(activePage, { networkIdleTimeout: 5000 });
          activePage = resolveActivePage(activePage);

          if (await isAuthenticatedDashboard(activePage)) {
            loginSuccess = true;
            console.log("");
            console.log("✅ 로그인 성공! 세션 저장 중...");
            break;
          }
        }

        await sleep(checkInterval);
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        process.stdout.write(
          `\r⏳ 로그인 대기 중... (${elapsed}초/${maxWaitTime / 1000}초)`,
        );
      }

      console.log("");

      if (loginSuccess) {
        // 세션 저장
        await context.storageState({ path: AB_AUTH_FILE, indexedDB: true });
        await saveAlbumBuddySessionStorage(activePage);

        console.log("");
        console.log("=".repeat(70));
        console.log("🎉 AlbumBuddy 로그인 세션 저장 완료!");
        console.log("=".repeat(70));
        console.log("");
        console.log(`📁 저장 위치: ${AB_AUTH_FILE}`);
        console.log("");
        console.log("📌 다음 단계:");
        console.log("   이제 테스트를 실행하면 로그인된 상태로 시작합니다:");
        console.log(
          "   npx playwright test tests/ab_monitoring_pom.spec.ts --project=chromium",
        );
        console.log("");

        // 저장된 세션 확인
        expect(fs.existsSync(AB_AUTH_FILE)).toBeTruthy();
        const authData = JSON.parse(fs.readFileSync(AB_AUTH_FILE, "utf-8"));
        console.log(`🍪 저장된 쿠키 수: ${authData.cookies?.length || 0}개`);
        console.log(`🧠 저장된 sessionStorage 파일: ${AB_SESSION_FILE}`);
        console.log("");

        const verified = await verifySavedSession(runtimeBrowser);
        expect(
          verified,
          "방금 저장한 세션이 새 컨텍스트에서도 실제 로그인 상태여야 합니다",
        ).toBe(true);
      } else {
        console.log("");
        console.error("❌ 로그인 시간 초과");
        console.log(
          "다시 시도: npx playwright test tests/ab-save-auth.spec.ts --headed --project=chromium",
        );
        console.log("");
        throw new Error("로그인 시간 초과");
      }
    }
  }
});

test("기존 AlbumBuddy 세션 유효성 확인", async ({ page }) => {
  test.setTimeout(30000);

  // 세션 파일 존재 확인
  if (!fs.existsSync(AB_AUTH_FILE)) {
    console.error("❌ 세션 파일이 없습니다. 먼저 로그인 세션을 저장하세요.");
    console.log(
      '   npx playwright test tests/ab-save-auth.spec.ts -g "로그인 세션 저장" --headed --project=chromium',
    );
    throw new Error("세션 파일 없음");
  }

  // 세션 로드
  const authData = JSON.parse(fs.readFileSync(AB_AUTH_FILE, "utf-8"));
  const cookies = authData.cookies || [];
  const fileSnapshot = getAuthSnapshotFromState(authData);

  console.log(`📁 세션 파일: ${AB_AUTH_FILE}`);
  console.log(`🍪 쿠키 수: ${cookies.length}개`);

  // 만료된 쿠키 확인
  const now = Date.now() / 1000;
  const expiredCookies = cookies.filter(
    (c: StoredCookie) => c.expires && c.expires < now,
  );
  const validCookies = cookies.filter(
    (c: StoredCookie) => !c.expires || c.expires > now,
  );

  console.log(`✅ 유효한 쿠키: ${validCookies.length}개`);
  console.error(`❌ 만료된 쿠키: ${expiredCookies.length}개`);

  if (validCookies.length === 0) {
    console.log("");
    console.warn("⚠️ 모든 쿠키가 만료되었습니다. 다시 로그인하세요.");
    throw new Error("세션 만료");
  }

  expect(
    fileSnapshot.hasRefreshToken,
    "세션 파일에 Makestar refresh_token 쿠키가 있어야 합니다",
  ).toBe(true);
  expect(
    fileSnapshot.hasLoggedInUser,
    "세션 파일에 LOGGED_IN_USER 정보가 있어야 합니다",
  ).toBe(true);
  expect(
    fileSnapshot.hasAlbumBuddyIndexedDb,
    "세션 파일에 AlbumBuddy IndexedDB(firebaseLocalStorageDb)가 있어야 합니다",
  ).toBe(true);

  // 실제 재사용 경로와 동일하게 storageState로 새 컨텍스트를 열어 검증
  const browser = page.context().browser();
  if (!browser) {
    throw new Error("브라우저 인스턴스를 찾을 수 없습니다");
  }

  const verifyContext = await browser.newContext({
    storageState: AB_AUTH_FILE,
  });
  const verifyPage = await verifyContext.newPage();
  await restoreAlbumBuddySessionStorage(verifyPage);
  await gotoWithRetry(
    verifyPage,
    `${ALBUMBUDDY_BASE_URL}/dashboard/purchasing`,
  );
  await waitForPageReady(verifyPage, { networkIdleTimeout: 5000 });

  const isLoggedIn = await isAuthenticatedDashboard(verifyPage);

  if (isLoggedIn) {
    console.log("");
    console.log("✅ 세션이 유효합니다. 로그인 상태로 테스트 가능합니다.");
  } else {
    console.log("");
    console.error("❌ 세션이 유효하지 않습니다. 다시 로그인하세요.");
    console.log(
      '   npx playwright test tests/ab-save-auth.spec.ts -g "로그인 세션 저장" --headed --project=chromium',
    );
    await verifyContext.close();
    throw new Error("세션 무효");
  }

  await verifyContext.close();
  expect(isLoggedIn).toBe(true);
});
