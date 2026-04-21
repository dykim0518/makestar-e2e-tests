/**
 * Shop 전체 상품을 훑어서 Proceed to Payment가 활성화되는 상품 탐색
 * 실행: AUTH_FILE=./auth.json npx tsx scripts/inspect-cmr-payment-scan.ts
 */

import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "https://stage-new.makeuni2026.com";
const OUT_DIR = path.resolve(
  __dirname,
  "../test-results/inspect-cmr-payment-scan",
);
const LOG: string[] = [];
const log = (m: string) => {
  console.log(m);
  LOG.push(m);
};
const MAX_PRODUCTS = 15;

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const authFile = process.env.AUTH_FILE || "./auth.json";
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: authFile,
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // KRW로 전환
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.setItem("currency", "KRW"));
  await page.goto(`${BASE_URL}/shop`, { waitUntil: "domcontentloaded" });
  await page
    .waitForLoadState("networkidle", { timeout: 15000 })
    .catch(() => {});
  await page.waitForTimeout(2000);

  const productIds = await page.evaluate(() => {
    const anchors = Array.from(
      document.querySelectorAll('a[href*="/product/"]'),
    ) as HTMLAnchorElement[];
    const ids = new Set<string>();
    anchors.forEach((a) => {
      const m = a.href.match(/\/product\/(\d+)/);
      if (m) ids.add(m[1]);
    });
    return Array.from(ids);
  });
  log(
    `🛒 Shop에서 감지된 상품 ID ${productIds.length}개: ${productIds.slice(0, 20).join(", ")}`,
  );

  const results: Array<{
    id: string;
    proceedFound: boolean;
    proceedEnabled: boolean;
    unavailableWarn: boolean;
    note: string;
  }> = [];

  for (let i = 0; i < Math.min(MAX_PRODUCTS, productIds.length); i++) {
    const id = productIds[i];
    const r = {
      id,
      proceedFound: false,
      proceedEnabled: false,
      unavailableWarn: false,
      note: "",
    };
    try {
      await page.goto(`${BASE_URL}/product/${id}`, {
        waitUntil: "domcontentloaded",
        timeout: 20000,
      });
      await page
        .waitForLoadState("networkidle", { timeout: 10000 })
        .catch(() => {});
      await page.waitForTimeout(1000);

      const purchaseBtn = page
        .locator(
          'button:has-text("Purchase"), button:has-text("바로구매"), button:has-text("Buy Now")',
        )
        .first();
      if (
        (await purchaseBtn.count()) === 0 ||
        !(await purchaseBtn.isVisible().catch(() => false))
      ) {
        r.note = "Purchase 버튼 없음 (품절/비구매상품)";
        results.push(r);
        log(`  [${i + 1}/${MAX_PRODUCTS}] ${id}: ${r.note}`);
        continue;
      }

      await purchaseBtn.click({ timeout: 4000 }).catch((e) => {
        r.note = `Purchase 클릭 실패: ${(e as Error).message.slice(0, 60)}`;
      });

      // /payments 이동 또는 옵션 다이얼로그 뜨는 경우 처리
      const navigated = await page
        .waitForURL(/\/payments/, { timeout: 8000 })
        .then(() => true)
        .catch(() => false);

      if (!navigated) {
        // 옵션 바텀시트에서 Proceed/Purchase 버튼 재탐색
        const dialogPurchase = page
          .locator(
            'button:has-text("Purchase"), button:has-text("Proceed to Payment"), button:has-text("바로구매")',
          )
          .last();
        if (
          (await dialogPurchase.count()) > 0 &&
          (await dialogPurchase.isEnabled().catch(() => false))
        ) {
          await dialogPurchase.click({ force: true }).catch(() => {});
          await page
            .waitForURL(/\/payments/, { timeout: 8000 })
            .catch(() => {});
        }
      }

      if (!/\/payments/.test(page.url())) {
        r.note = r.note || `결제 페이지 미진입 (url=${page.url()})`;
        results.push(r);
        log(`  [${i + 1}/${MAX_PRODUCTS}] ${id}: ${r.note}`);
        continue;
      }

      // Proceed 버튼 대기
      const appeared = await page
        .locator('button:has-text("Proceed to Payment")')
        .first()
        .waitFor({ state: "visible", timeout: 20000 })
        .then(() => true)
        .catch(() => false);
      r.proceedFound = appeared;

      if (!appeared) {
        r.note = "Proceed 버튼 미등장";
        results.push(r);
        log(`  [${i + 1}/${MAX_PRODUCTS}] ${id}: ${r.note}`);
        continue;
      }

      // 체크박스 전부 체크
      await page.evaluate(() => {
        const cbs = Array.from(
          document.querySelectorAll('input[type="checkbox"]'),
        ) as HTMLInputElement[];
        cbs.forEach((cb) => {
          if (!cb.checked) cb.click();
        });
      });
      await page.waitForTimeout(1000);

      const proceedState = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll("button")).filter(
          (b) => /Proceed to Payment/i.test(b.textContent || ""),
        ) as HTMLButtonElement[];
        const enabled = btns.some((b) => !b.disabled);
        const warn = /items unavailable for purchase|cannot be purchased/i.test(
          document.body.innerText || "",
        );
        return { enabled, warn, count: btns.length };
      });
      r.proceedEnabled = proceedState.enabled;
      r.unavailableWarn = proceedState.warn;
      r.note = `btn=${proceedState.count}, enabled=${proceedState.enabled}, warn=${proceedState.warn}`;
      log(`  [${i + 1}/${MAX_PRODUCTS}] ${id}: ${r.note}`);

      if (r.proceedEnabled) {
        log(`\n🎯 결제 가능 상품 발견: ${id}`);
        await page.screenshot({
          path: path.join(OUT_DIR, `hit-${id}.png`),
          fullPage: true,
        });
        results.push(r);
        break;
      }
    } catch (e) {
      r.note = `예외: ${(e as Error).message.slice(0, 100)}`;
      log(`  [${i + 1}/${MAX_PRODUCTS}] ${id}: ${r.note}`);
    }
    results.push(r);
  }

  log(`\n=== 요약 ===`);
  const hit = results.find((x) => x.proceedEnabled);
  if (hit) {
    log(`✅ 결제 가능 상품: ${hit.id}`);
  } else {
    log(`❌ 스캔한 ${results.length}개 상품 중 결제 가능 상품 없음`);
  }
  fs.writeFileSync(
    path.join(OUT_DIR, "results.json"),
    JSON.stringify(results, null, 2),
    "utf-8",
  );
  fs.writeFileSync(path.join(OUT_DIR, "report.txt"), LOG.join("\n"), "utf-8");
  await context.close();
  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
