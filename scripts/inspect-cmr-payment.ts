/**
 * CMR 결제 플로우 조사 스크립트 (stage-new.makeuni2026.com)
 *
 * 목적:
 *  1. Shop → 상품 → 구매하기 → 결제 진입 경로 확인
 *  2. Toss 호출 방식(팝업 / iframe / redirect) 확인
 *  3. 결제수단 UI 노출 항목 기록
 *  4. 캡차 유무 확인
 *  5. 결제 직전 URL/DOM/iframe/window.open/network 기록
 *
 * 실행: npx tsx scripts/inspect-cmr-payment.ts
 */

import { chromium, Page, BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "https://stage-new.makeuni2026.com";
const OUT_DIR = path.resolve(__dirname, "../test-results/inspect-cmr-payment");
const SHOT = (name: string) => path.join(OUT_DIR, `${name}.png`);
const LOG: string[] = [];
const log = (msg: string) => {
  console.log(msg);
  LOG.push(msg);
};

function ensureDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function dumpFrames(page: Page, label: string) {
  const frames = page.frames();
  log(`\n[frames @ ${label}] count=${frames.length}`);
  for (const f of frames) {
    log(`  - url=${f.url()} name=${f.name()}`);
  }
}

async function dumpNetwork(requests: string[]) {
  const tossRelated = requests.filter((u) =>
    /tosspayments|toss\.im|payment|checkout|pay\./i.test(u),
  );
  log(`\n[network] tosspayments/payment 관련 요청 ${tossRelated.length}건`);
  tossRelated.slice(0, 30).forEach((u) => log(`  - ${u}`));
}

async function detectCaptcha(page: Page): Promise<string | null> {
  const found = await page.evaluate(() => {
    const text = (document.body?.innerText || "").slice(0, 10000);
    const hits: string[] = [];
    if (/위에 보이는 문자를 입력해 주세요|자동입력 방지|캡차/i.test(text))
      hits.push("text-captcha");
    if (
      document.querySelector(
        'iframe[src*="recaptcha"], [class*="captcha"], [id*="captcha"]',
      )
    )
      hits.push("recaptcha-iframe");
    if (document.querySelector('iframe[src*="hcaptcha"]'))
      hits.push("hcaptcha");
    return hits;
  });
  return found.length ? found.join(",") : null;
}

async function inspectPaymentPage(page: Page, requests: string[]) {
  await dumpFrames(page, "payment page");

  const snapshot = await page.evaluate(() => {
    const iframes = Array.from(document.querySelectorAll("iframe")).map(
      (f) => ({
        src: f.getAttribute("src") || "",
        id: f.id,
        name: f.getAttribute("name") || "",
      }),
    );
    const tossBtns = Array.from(
      document.querySelectorAll(
        'button, [class*="payment"], [class*="Payment"], [data-testid*="payment"]',
      ),
    )
      .slice(0, 30)
      .map((el) => ({
        tag: el.tagName,
        text: (el.textContent || "").trim().slice(0, 50),
        cls: (el.className.toString() || "").slice(0, 80),
      }))
      .filter((x) => x.text.length > 0);
    const bodyText = (document.body?.innerText || "").slice(0, 4000);
    const tossScript = Array.from(document.querySelectorAll("script")).some(
      (s) => (s.getAttribute("src") || "").includes("tosspayments"),
    );
    return { iframes, tossBtns, bodyText, tossScript };
  });

  log(`\n[payment DOM]`);
  log(`  tosspayments SDK 로드됨: ${snapshot.tossScript}`);
  log(`  iframe ${snapshot.iframes.length}개:`);
  snapshot.iframes.forEach((f) =>
    log(`    - id=${f.id} name=${f.name} src=${f.src.slice(0, 120)}`),
  );
  log(`  결제수단 관련 버튼/요소 (상위 ${snapshot.tossBtns.length}개):`);
  snapshot.tossBtns.forEach((b) =>
    log(`    - <${b.tag}> "${b.text}"  .${b.cls.slice(0, 60)}`),
  );
  log(`\n[body text preview]\n${snapshot.bodyText.slice(0, 1500)}`);

  await dumpNetwork(requests);
}

async function run() {
  ensureDir();
  const authFile = process.env.AUTH_FILE || "./auth.json";
  log(`🔐 auth file: ${authFile}`);
  const browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({
    storageState: authFile,
    viewport: { width: 1920, height: 1080 },
  });

  const requests: string[] = [];
  context.on("request", (r) => requests.push(r.url()));
  // 팝업 감지
  const popupPages: Page[] = [];
  context.on("page", (p) => {
    log(`\n🪟 [popup] 팝업 페이지 감지: ${p.url()}`);
    popupPages.push(p);
  });

  const page = await context.newPage();
  page.on("dialog", (d) => {
    log(`\n[dialog] ${d.type()}: ${d.message()}`);
    d.dismiss().catch(() => {});
  });

  try {
    // 1. Home 접속
    log(`\n=== STEP 1: Home 접속 (${BASE_URL}) ===`);
    await page.goto(BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.screenshot({ path: SHOT("01-home") });
    log(`  URL: ${page.url()}`);
    log(
      `  로그인 상태: ${await page.evaluate(() => !!localStorage.getItem("LOGGED_IN_USER"))}`,
    );

    // 모달 닫기 시도
    const modalClose = page
      .locator(
        'button[aria-label="close"], button:has-text("Close"), button:has-text("닫기"), [class*="close"]',
      )
      .first();
    await modalClose.click({ timeout: 2000 }).catch(() => {});

    // 2. Shop 이동
    log(`\n=== STEP 2: Shop 이동 ===`);
    await page.goto(`${BASE_URL}/shop`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.screenshot({ path: SHOT("02-shop") });

    // 3. 첫 번째 상품 클릭
    log(`\n=== STEP 3: 첫 번째 상품 카드 클릭 ===`);
    const productCards = page.locator(
      'a[href*="/product/"], [class*="product-card"] a, [class*="ProductCard"] a',
    );
    const cardCount = await productCards.count();
    log(`  상품 카드 수: ${cardCount}`);
    if (cardCount === 0) {
      throw new Error("상품 카드를 찾을 수 없음");
    }

    // 구매 가능한(품절 아닌) 상품 찾기
    let opened = false;
    for (let i = 0; i < Math.min(6, cardCount); i++) {
      try {
        await productCards.nth(i).click({ timeout: 5000 });
        await page.waitForLoadState("domcontentloaded");
        await page
          .waitForLoadState("networkidle", { timeout: 10000 })
          .catch(() => {});
        const url = page.url();
        if (/\/product\//.test(url)) {
          log(`  ✅ 상품 상세 진입 (index=${i}): ${url}`);
          opened = true;
          break;
        }
      } catch (e) {
        log(`  ⚠️ card[${i}] 클릭 실패: ${(e as Error).message.slice(0, 80)}`);
        await page.goto(`${BASE_URL}/shop`, { waitUntil: "domcontentloaded" });
      }
    }
    if (!opened) throw new Error("상품 상세 진입 실패");
    await page.screenshot({ path: SHOT("03-product-detail") });

    // 4. 옵션 선택 및 구매 버튼 클릭
    log(`\n=== STEP 4: 옵션 선택 + 구매 버튼 ===`);
    // 옵션 드롭다운 시도
    const optionSelectors = [
      "select",
      '[role="combobox"]',
      '[class*="option"] button',
      '[class*="Option"] button',
    ];
    for (const sel of optionSelectors) {
      const loc = page.locator(sel).first();
      if ((await loc.count()) > 0) {
        await loc.click({ timeout: 2000 }).catch(() => {});
        await page.waitForTimeout(500);
        const optionItem = page
          .locator('[role="option"], li[data-value], .option-item')
          .first();
        if ((await optionItem.count()) > 0) {
          await optionItem.click({ timeout: 2000 }).catch(() => {});
          log(`  옵션 선택됨 (${sel})`);
          break;
        }
      }
    }

    // 구매 버튼 탐색
    const purchaseCandidates = [
      'button:has-text("구매하기")',
      'button:has-text("Purchase")',
      'button:has-text("Buy Now")',
      'button:has-text("바로구매")',
      'button:has-text("Proceed to Payment")',
      'button:has-text("결제")',
    ];
    let purchaseClicked = false;
    for (const sel of purchaseCandidates) {
      const btn = page.locator(sel).first();
      if (
        (await btn.count()) > 0 &&
        (await btn.isVisible().catch(() => false))
      ) {
        log(`  구매 버튼 발견: ${sel}`);
        await btn.click({ timeout: 5000 }).catch(() => {});
        purchaseClicked = true;
        break;
      }
    }
    if (!purchaseClicked) {
      log(`  ⚠️ 구매 버튼을 찾지 못함. body 버튼 덤프:`);
      const btns = await page.evaluate(() =>
        Array.from(document.querySelectorAll("button"))
          .map((b) => (b.textContent || "").trim())
          .filter((t) => t.length > 0 && t.length < 40)
          .slice(0, 30),
      );
      btns.forEach((t) => log(`    - "${t}"`));
    }

    await page.waitForTimeout(3000);
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.screenshot({ path: SHOT("04-after-purchase-click") });
    log(`  버튼 클릭 후 URL: ${page.url()}`);

    // 5. 결제 페이지까지 추가 진행 시도 (주소 입력/Proceed 등)
    log(`\n=== STEP 5: 결제 단계까지 추가 진행 ===`);
    // 바텀시트/다이얼로그에서 "Proceed to Payment" 류 버튼 재시도
    for (let step = 0; step < 3; step++) {
      const nextCandidates = [
        'button:has-text("Proceed to Payment")',
        'button:has-text("결제하기")',
        'button:has-text("Continue")',
        'button:has-text("Next")',
        'button:has-text("다음")',
      ];
      let advanced = false;
      for (const sel of nextCandidates) {
        const btn = page.locator(sel).first();
        if (
          (await btn.count()) > 0 &&
          (await btn.isVisible().catch(() => false)) &&
          (await btn.isEnabled().catch(() => false))
        ) {
          log(`  다음 단계 버튼 클릭: ${sel}`);
          await btn.click({ timeout: 3000 }).catch(() => {});
          advanced = true;
          break;
        }
      }
      await page.waitForTimeout(2000);
      await page
        .waitForLoadState("networkidle", { timeout: 10000 })
        .catch(() => {});
      await page.screenshot({ path: SHOT(`05-step-${step + 1}`) });
      log(`  step ${step + 1} URL: ${page.url()}`);
      if (!advanced) break;
    }

    // 6. 캡차 감지
    log(`\n=== STEP 6: 캡차 감지 ===`);
    const captcha = await detectCaptcha(page);
    log(`  캡차 감지 결과: ${captcha || "없음"}`);
    if (popupPages.length > 0) {
      for (const pp of popupPages) {
        const ppCaptcha = await detectCaptcha(pp).catch(() => null);
        log(`  popup captcha: ${ppCaptcha || "없음"} (${pp.url()})`);
      }
    }

    // 7. 결제 페이지 구조 덤프
    log(`\n=== STEP 7: 결제 페이지 구조 덤프 ===`);
    await inspectPaymentPage(page, requests);

    // 팝업이 열렸으면 팝업도 조사
    for (const pp of popupPages) {
      log(`\n=== [POPUP] ${pp.url()} ===`);
      await pp
        .waitForLoadState("domcontentloaded", { timeout: 5000 })
        .catch(() => {});
      await inspectPaymentPage(pp, requests).catch((e) =>
        log(`  팝업 조사 실패: ${(e as Error).message}`),
      );
      await pp.screenshot({ path: SHOT("06-popup") }).catch(() => {});
    }
  } catch (e) {
    log(`\n❌ ERROR: ${(e as Error).message}`);
    await page.screenshot({ path: SHOT("99-error") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(OUT_DIR, "report.txt"), LOG.join("\n"), "utf-8");
    log(`\n📄 리포트 저장: ${path.join(OUT_DIR, "report.txt")}`);
    await context.close();
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
