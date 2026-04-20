/**
 * CMR 결제 플로우 **심층** 조사 (Proceed to Payment 클릭 → Toss 호출 감지)
 *
 * 실행: AUTH_FILE=./auth.json npx tsx scripts/inspect-cmr-payment-deep.ts
 */

import { chromium, Page, BrowserContext, Request } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "https://stage-new.makeuni2026.com";
const OUT_DIR = path.resolve(
  __dirname,
  "../test-results/inspect-cmr-payment-deep",
);
const SHOT = (name: string) => path.join(OUT_DIR, `${name}.png`);
const LOG: string[] = [];
const log = (msg: string) => {
  console.log(msg);
  LOG.push(msg);
};

type PopupInfo = { url: string; capturedAt: number };

async function getProductUrl(
  context: BrowserContext,
  requests: Request[],
): Promise<string> {
  const id = process.env.PRODUCT_ID || "15978";
  return `${BASE_URL}/product/${id}`;
}

async function checkAllAgreements(page: Page): Promise<number> {
  // 모든 checkbox 체크 시도
  const result = await page.evaluate(() => {
    const checkboxes = Array.from(
      document.querySelectorAll('input[type="checkbox"]'),
    ) as HTMLInputElement[];
    let clicked = 0;
    checkboxes.forEach((cb) => {
      if (!cb.checked) {
        cb.click();
        clicked += 1;
      }
    });
    return { total: checkboxes.length, clicked };
  });
  log(`  체크박스 ${result.clicked}/${result.total}개 클릭`);

  // "전체 동의" 버튼이 있으면 시도
  const agreeAll = page
    .locator(
      'label:has-text("I have reviewed") input, [class*="agree-all"] input, button:has-text("전체 동의")',
    )
    .first();
  if ((await agreeAll.count()) > 0) {
    await agreeAll.click({ force: true }).catch(() => {});
  }

  return result.clicked;
}

async function handleItemsUnavailableIfAny(page: Page) {
  // "Remove and Proceed" / "제거하고 진행" 같은 버튼 처리
  const removeBtns = [
    'button:has-text("Remove")',
    'button:has-text("remove these items")',
    'button:has-text("제거")',
  ];
  for (const sel of removeBtns) {
    const btn = page.locator(sel).first();
    if ((await btn.count()) > 0 && (await btn.isVisible().catch(() => false))) {
      log(`  unavailable items 제거 버튼 클릭: ${sel}`);
      await btn.click({ timeout: 3000 }).catch(() => {});
      await page.waitForTimeout(1500);
      return true;
    }
  }
  return false;
}

async function clickProceed(page: Page): Promise<boolean> {
  const proceedBtn = page
    .locator('button:has-text("Proceed to Payment")')
    .last(); // 마지막(활성) 버튼 우선
  const count = await proceedBtn.count();
  log(`  Proceed to Payment 버튼 count=${count}`);
  if (count === 0) return false;

  const isDisabled = await proceedBtn.isDisabled().catch(() => null);
  const isVisible = await proceedBtn.isVisible().catch(() => false);
  log(`  visible=${isVisible}, disabled=${isDisabled}`);

  if (!isVisible) {
    // 스크롤 시도
    await proceedBtn.scrollIntoViewIfNeeded().catch(() => {});
  }

  await proceedBtn.click({ force: true, timeout: 5000 }).catch((e) => {
    log(`  클릭 실패: ${(e as Error).message.slice(0, 100)}`);
  });
  return true;
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const authFile = process.env.AUTH_FILE || "./auth.json";
  log(`🔐 auth file: ${authFile}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: authFile,
    viewport: { width: 1920, height: 1080 },
  });

  const allRequests: string[] = [];
  const tossRequests: string[] = [];
  const paymentApiRequests: string[] = [];
  context.on("request", (r) => {
    const u = r.url();
    allRequests.push(u);
    if (/tosspayments\.com|toss\.im|js\.tosspayments/i.test(u)) {
      tossRequests.push(`${r.method()} ${u}`);
      log(`  🎯 TOSS: ${r.method()} ${u.slice(0, 150)}`);
    }
    if (/\/payment|\/checkout|\/order/i.test(u) && u.includes("makeuni2026")) {
      paymentApiRequests.push(`${r.method()} ${u}`);
    }
  });

  const popups: PopupInfo[] = [];
  context.on("page", async (p) => {
    popups.push({ url: p.url(), capturedAt: Date.now() });
    log(`\n🪟 [popup 생성] ${p.url()}`);
    p.on("framenavigated", (f) => {
      if (f === p.mainFrame()) {
        log(`🪟 [popup nav] ${f.url()}`);
      }
    });
  });

  const page = await context.newPage();
  page.on("dialog", (d) => {
    log(`[dialog] ${d.type()}: ${d.message()}`);
    d.dismiss().catch(() => {});
  });

  try {
    // 0. Home → 통화 KRW 전환 (localStorage + UI)
    log(`\n=== STEP 0: 통화 KRW 전환 ===`);
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    const prevCurrency = await page.evaluate(() =>
      localStorage.getItem("currency"),
    );
    log(`  이전 currency: ${prevCurrency}`);
    await page.evaluate(() => localStorage.setItem("currency", "KRW"));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    const nowCurrency = await page.evaluate(() =>
      localStorage.getItem("currency"),
    );
    log(`  변경 후 currency: ${nowCurrency}`);
    await page.screenshot({ path: SHOT("00-home-krw") });

    // 1. 상품 상세 직접 이동
    const productUrl = await getProductUrl(context, []);
    log(`\n=== STEP 1: 상품 상세 (${productUrl}) ===`);
    await page.goto(productUrl, { waitUntil: "domcontentloaded" });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.screenshot({ path: SHOT("01-product") });

    // 2. Purchase 클릭
    log(`\n=== STEP 2: Purchase 클릭 ===`);
    const purchaseBtn = page.locator('button:has-text("Purchase")').first();
    await purchaseBtn.click({ timeout: 5000 });
    await page.waitForURL(/\/payments/, { timeout: 15000 });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    log(`  결제 페이지 URL: ${page.url()}`);

    // 스켈레톤 해제까지 명시적 대기 — Proceed to Payment 버튼 등장
    log(`  Proceed to Payment 버튼 등장 대기 (최대 30초)...`);
    const proceedAppeared = await page
      .locator('button:has-text("Proceed to Payment")')
      .first()
      .waitFor({ state: "visible", timeout: 30000 })
      .then(() => true)
      .catch(() => false);
    log(`  Proceed 버튼 등장: ${proceedAppeared}`);

    await page.waitForTimeout(2000);
    await page.evaluate(() =>
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior: "instant" as ScrollBehavior,
      }),
    );
    await page.waitForTimeout(2000);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);

    // DOM 현황 덤프
    const pageState = await page.evaluate(() => {
      const checkboxes = document.querySelectorAll(
        'input[type="checkbox"]',
      ).length;
      const radios = document.querySelectorAll('input[type="radio"]').length;
      const buttons = Array.from(document.querySelectorAll("button"))
        .map((b) => ({
          text: (b.textContent || "").trim().slice(0, 60),
          disabled: b.disabled,
        }))
        .filter((b) => b.text.length > 0 && b.text.length < 80);
      return { checkboxes, radios, buttons };
    });
    log(
      `  DOM: checkboxes=${pageState.checkboxes}, radios=${pageState.radios}, buttons=${pageState.buttons.length}`,
    );
    pageState.buttons
      .slice(0, 30)
      .forEach((b) => log(`    - "${b.text}" disabled=${b.disabled}`));
    await page.screenshot({ path: SHOT("02-payments-page"), fullPage: true });

    // 3. 동의 체크 + unavailable 처리
    log(`\n=== STEP 3: 동의/필수 항목 처리 ===`);
    await handleItemsUnavailableIfAny(page);
    await checkAllAgreements(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: SHOT("03-agreed"), fullPage: true });

    // 4. Proceed 버튼 상태 재확인 + 클릭
    log(`\n=== STEP 4: Proceed to Payment 클릭 ===`);
    const tossBefore = tossRequests.length;
    const popupBefore = popups.length;
    await clickProceed(page);

    // 5. Toss 호출 or 다음 페이지 대기
    log(`\n=== STEP 5: Toss 호출 / 전환 감지 (최대 20초 대기) ===`);
    const start = Date.now();
    let detected = false;
    while (Date.now() - start < 20000) {
      await page.waitForTimeout(1000);
      const tossNew = tossRequests.length - tossBefore;
      const popupNew = popups.length - popupBefore;
      const currentUrl = page.url();
      if (
        tossNew > 0 ||
        popupNew > 0 ||
        /tosspayments|checkout|pay\./i.test(currentUrl) ||
        !currentUrl.includes("/payments")
      ) {
        log(
          `  변화 감지: tossReq=+${tossNew}, popup=+${popupNew}, url=${currentUrl}`,
        );
        detected = true;
        break;
      }
    }
    if (!detected) {
      log(`  ⚠️ 20초 내 Toss 호출/페이지 전환 감지 안 됨`);
    }
    await page.screenshot({ path: SHOT("04-after-proceed") });
    log(`  최종 URL: ${page.url()}`);

    // 6. 메인 페이지 DOM 덤프
    log(`\n=== STEP 6: 메인 페이지 상태 덤프 ===`);
    const mainDump = await page.evaluate(() => {
      const iframes = Array.from(document.querySelectorAll("iframe")).map(
        (f) => ({ src: f.src, id: f.id, name: f.name }),
      );
      const scripts = Array.from(document.querySelectorAll("script"))
        .map((s) => s.src)
        .filter((src) => /toss|payment/i.test(src));
      const dialogs = Array.from(
        document.querySelectorAll(
          '[role="dialog"], [class*="Modal"], [class*="Dialog"]',
        ),
      )
        .slice(0, 3)
        .map((el) => ({
          tag: el.tagName,
          text: (el.textContent || "").slice(0, 300).replace(/\s+/g, " "),
        }));
      return { iframes, scripts, dialogs, url: location.href };
    });
    log(`  URL: ${mainDump.url}`);
    log(`  Toss/payment script src: ${JSON.stringify(mainDump.scripts)}`);
    log(`  iframes(${mainDump.iframes.length}):`);
    mainDump.iframes.forEach((f) =>
      log(`    - id=${f.id} src=${f.src.slice(0, 150)}`),
    );
    log(`  dialogs/modals(${mainDump.dialogs.length}):`);
    mainDump.dialogs.forEach((d) =>
      log(`    - <${d.tag}> "${d.text.slice(0, 150)}"`),
    );

    // 7. 팝업 덤프
    if (popups.length > 0) {
      log(`\n=== STEP 7: 팝업 ${popups.length}개 상세 덤프 ===`);
      const ctxPages = context.pages();
      for (let i = 0; i < ctxPages.length; i++) {
        const p = ctxPages[i];
        if (p === page) continue;
        try {
          await p
            .waitForLoadState("domcontentloaded", { timeout: 5000 })
            .catch(() => {});
          const info = await p.evaluate(() => ({
            url: location.href,
            title: document.title,
            iframes: Array.from(document.querySelectorAll("iframe")).map(
              (f) => ({
                src: f.src,
                name: f.name,
              }),
            ),
            textPreview: (document.body?.innerText || "").slice(0, 800),
          }));
          log(`  [popup ${i}] url=${info.url}`);
          log(`  [popup ${i}] title=${info.title}`);
          log(`  [popup ${i}] iframes(${info.iframes.length}):`);
          info.iframes.forEach((f) =>
            log(`    - name=${f.name} src=${f.src.slice(0, 200)}`),
          );
          log(`  [popup ${i}] text preview:\n${info.textPreview}`);
          await p.screenshot({ path: SHOT(`05-popup-${i}`) }).catch(() => {});
        } catch (e) {
          log(`  팝업 ${i} 덤프 실패: ${(e as Error).message}`);
        }
      }
    }

    // 8. Toss 요청 요약
    log(`\n=== STEP 8: Toss 네트워크 요청 요약 (${tossRequests.length}건) ===`);
    tossRequests.slice(0, 30).forEach((r) => log(`  ${r.slice(0, 200)}`));

    log(
      `\n=== STEP 9: payment API 요청 요약 (${paymentApiRequests.length}건) ===`,
    );
    paymentApiRequests.slice(0, 20).forEach((r) => log(`  ${r.slice(0, 200)}`));
  } catch (e) {
    log(`\n❌ ERROR: ${(e as Error).message}`);
    log((e as Error).stack || "");
    await page.screenshot({ path: SHOT("99-error") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(OUT_DIR, "report.txt"), LOG.join("\n"), "utf-8");
    log(`\n📄 리포트: ${path.join(OUT_DIR, "report.txt")}`);
    await context.close();
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
