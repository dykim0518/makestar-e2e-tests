import type { BrowserContext, Page } from "@playwright/test";

export async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForPageReady(
  page: Page,
  options: { networkIdleTimeout?: number } = {},
): Promise<void> {
  const { networkIdleTimeout = 15000 } = options;

  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page
    .waitForLoadState("networkidle", { timeout: networkIdleTimeout })
    .catch(() => {});
}

export type ManualLoginWaitOptions = {
  successMessage: string;
  maxWaitMs?: number;
  checkIntervalMs?: number;
  isLoginComplete: (url: string) => boolean;
  onIntermediateUrl?: (page: Page, currentUrl: string) => Promise<boolean>;
};

export async function waitForManualLogin(
  page: Page,
  options: ManualLoginWaitOptions,
): Promise<boolean> {
  const {
    successMessage,
    maxWaitMs = 180_000,
    checkIntervalMs = 2_000,
    isLoginComplete,
    onIntermediateUrl,
  } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const currentUrl = page.url();

    if (isLoginComplete(currentUrl)) {
      console.log("");
      console.log(successMessage);
      return true;
    }

    if (
      onIntermediateUrl &&
      (await onIntermediateUrl(page, currentUrl).catch(() => false))
    ) {
      console.log("");
      console.log(successMessage);
      return true;
    }

    await sleep(checkIntervalMs);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    process.stdout.write(
      `\r⏳ 로그인 대기 중... (${elapsed}초/${maxWaitMs / 1000}초)`,
    );
  }

  return false;
}

function getJwtExpiryMs(token: string | undefined): number | null {
  if (!token) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64").toString(),
    );
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export async function hasValidRefreshToken(
  context: BrowserContext,
  domainFragment: string,
): Promise<boolean> {
  const cookies = await context.cookies();
  const refreshToken = cookies.find(
    (cookie) =>
      cookie.name === "refresh_token" &&
      cookie.domain?.includes(domainFragment),
  );

  const expiresAt = getJwtExpiryMs(refreshToken?.value);
  return typeof expiresAt === "number" && expiresAt > Date.now() + 60_000;
}

export async function waitForValidRefreshToken(
  page: Page,
  domainFragment: string,
  label: string,
): Promise<boolean> {
  const context = page.context();
  await waitForPageReady(page);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (await hasValidRefreshToken(context, domainFragment)) {
      console.log(`🔑 ${label} refresh_token 확인 완료`);
      return true;
    }
    await sleep(1000);
  }

  console.warn(`⚠️ ${label} refresh_token 미확인 - 현재 페이지 재진입 시도`);

  await page.goto(page.url(), { waitUntil: "domcontentloaded" }).catch(() => {});
  await waitForPageReady(page);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (await hasValidRefreshToken(context, domainFragment)) {
      console.log(`🔑 ${label} refresh_token 확인 완료 (재진입 후)`);
      return true;
    }
    await sleep(1000);
  }

  return false;
}
