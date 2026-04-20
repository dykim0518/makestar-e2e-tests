/**
 * Toss 카드 결제 iframe 심층 조사
 * - payment-widget iframe 내부 DOM 덤프
 * - 카드 선택 → 카드 입력 iframe 탐색
 * - Luhn-valid 테스트 카드번호 입력 시도
 * - 최종 결제 버튼 클릭 → make_order 응답 관찰
 *
 * 실행: AUTH_FILE=./auth.json PRODUCT_ID=15964 npx tsx scripts/inspect-cmr-payment-card.ts
 */

import { chromium, Page, Frame } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "https://stage-new.makeuni2026.com";
const OUT_DIR = path.resolve(
  __dirname,
  "../test-results/inspect-cmr-payment-card",
);
const SHOT = (name: string) => path.join(OUT_DIR, `${name}.png`);
const LOG: string[] = [];
const log = (m: string) => {
  console.log(m);
  LOG.push(m);
};

// Toss 공식 sandbox 테스트 카드 (Makestar Notion 문서: 결제 테스트)
// Visa: 4242 4242 4242 4242 — 거래 승인
const TEST_CARD = {
  number: "4242424242424242",
  expMonth: "12",
  expYear: "30",
  cvc: "123",
  birthOrBiz: "900101", // 생년월일 YYMMDD (개인) 또는 사업자번호
  password2: "00", // 카드 비밀번호 앞 2자리
};

function dumpFrameTree(page: Page, label: string) {
  const frames = page.frames();
  log(`\n[frame tree @ ${label}] count=${frames.length}`);
  frames.forEach((f, i) => {
    const parent = f.parentFrame();
    log(
      `  [${i}] url=${f.url().slice(0, 160)} name="${f.name()}" parent=${
        parent ? parent.url().slice(0, 80) : "(main)"
      }`,
    );
  });
}

async function dumpFrameContent(frame: Frame, label: string, maxButtons = 20) {
  try {
    const content = await frame.evaluate((max) => {
      const buttons = Array.from(document.querySelectorAll("button"))
        .map((b) => ({
          text: (b.textContent || "").trim().slice(0, 60),
          id: b.id,
          cls: (b.className?.toString() || "").slice(0, 60),
          ariaLabel: b.getAttribute("aria-label") || "",
          disabled: (b as HTMLButtonElement).disabled,
        }))
        .filter((b) => b.text.length > 0)
        .slice(0, max);
      const inputs = Array.from(document.querySelectorAll("input"))
        .map((i) => ({
          type: i.type,
          name: i.name,
          id: i.id,
          placeholder: i.placeholder,
          ariaLabel: i.getAttribute("aria-label") || "",
        }))
        .slice(0, max);
      const iframes = Array.from(document.querySelectorAll("iframe")).map(
        (f) => ({ src: f.src.slice(0, 200), name: f.name }),
      );
      const labels = Array.from(document.querySelectorAll("label"))
        .map((l) => (l.textContent || "").trim())
        .filter((t) => t.length > 0 && t.length < 60)
        .slice(0, max);
      const bodyPreview = (document.body?.innerText || "")
        .replace(/\s+/g, " ")
        .slice(0, 800);
      return { buttons, inputs, iframes, labels, bodyPreview };
    }, maxButtons);
    log(`\n[${label}] buttons(${content.buttons.length}):`);
    content.buttons.forEach((b) =>
      log(`  - "${b.text}" id=${b.id} aria="${b.ariaLabel}" dis=${b.disabled}`),
    );
    log(`[${label}] inputs(${content.inputs.length}):`);
    content.inputs.forEach((i) =>
      log(
        `  - type=${i.type} name=${i.name} id=${i.id} ph="${i.placeholder}" aria="${i.ariaLabel}"`,
      ),
    );
    log(
      `[${label}] labels(${content.labels.length}): ${content.labels.join(" | ")}`,
    );
    log(`[${label}] nested iframes(${content.iframes.length}):`);
    content.iframes.forEach((f) => log(`  - name=${f.name} src=${f.src}`));
    log(`[${label}] text preview: ${content.bodyPreview}`);
  } catch (e) {
    log(`[${label}] dump 실패: ${(e as Error).message.slice(0, 120)}`);
  }
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const authFile = process.env.AUTH_FILE || "./auth.json";
  const productId = process.env.PRODUCT_ID || "15964";
  log(`🔐 auth=${authFile} product=${productId}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: authFile,
    viewport: { width: 1920, height: 1080 },
  });

  // 네트워크 수집
  const allNet: Array<{ method: string; url: string; status?: number }> = [];
  const tossNet: Array<{ method: string; url: string; status?: number }> = [];
  const makeOrderResp: Array<{ status: number; body: string }> = [];

  context.on("request", (r) => {
    const rec = { method: r.method(), url: r.url() };
    allNet.push(rec);
    if (/tosspayments\.com|toss\.im/i.test(rec.url)) tossNet.push(rec);
  });
  context.on("response", async (resp) => {
    const u = resp.url();
    if (u.includes("make_order")) {
      let body = "(unread)";
      try {
        body = (await resp.text()).slice(0, 600);
      } catch {}
      makeOrderResp.push({ status: resp.status(), body });
      log(`\n🔔 make_order 응답: ${resp.status()} — body: ${body}`);
    }
    if (/tosspayments\.com.*payment-widget.*keys|confirm|payments/i.test(u)) {
      log(`  ↩︎ TOSS resp: ${resp.status()} ${u.slice(0, 160)}`);
    }
  });

  const page = await context.newPage();
  page.on("dialog", (d) => {
    log(`[dialog] ${d.type()}: ${d.message()}`);
    d.dismiss().catch(() => {});
  });

  try {
    // 0. KRW 전환
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("currency", "KRW"));

    // 1. 상품 → Purchase → /payments
    log(`\n=== STEP 1: 상품 ${productId} → Purchase ===`);
    await page.goto(`${BASE_URL}/product/${productId}`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(1500);

    // 옵션 선택 (Purchase 활성화용)
    const optionSel = page
      .locator('select, [role="combobox"], [class*="option"] button')
      .first();
    if ((await optionSel.count()) > 0) {
      await optionSel.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
      const opt = page
        .locator('[role="option"], li[data-value], .option-item, option')
        .nth(1);
      if ((await opt.count()) > 0) {
        await opt.click({ timeout: 2000 }).catch(() => {});
        log(`  옵션 선택됨`);
      }
    }
    await page.waitForTimeout(1000);

    const purchase = page.locator('button:has-text("Purchase")').first();
    const purchaseEnabled = await purchase.isEnabled().catch(() => false);
    log(`  Purchase enabled=${purchaseEnabled}`);
    if (!purchaseEnabled) {
      throw new Error(
        "Purchase 버튼이 disabled — 옵션 선택 실패 또는 재고 없음",
      );
    }
    await purchase.click();
    await page.waitForURL(/\/payments/, { timeout: 15000 });
    log(`  /payments 진입: ${page.url()}`);

    // 2. Proceed 버튼 등장 대기 + 동의 체크
    await page
      .locator('button:has-text("Proceed to Payment")')
      .first()
      .waitFor({ state: "visible", timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      Array.from(document.querySelectorAll('input[type="checkbox"]'))
        .filter((c) => !(c as HTMLInputElement).checked)
        .forEach((c) => (c as HTMLInputElement).click());
    });
    await page.screenshot({ path: SHOT("01-before-proceed"), fullPage: true });

    // 3. Proceed 클릭 → Toss iframe 로드 대기
    log(`\n=== STEP 2: Proceed 클릭 → Toss iframe 로드 대기 ===`);
    await page.locator('button:has-text("Proceed to Payment")').last().click();

    // Toss iframe 등장 대기
    await page
      .waitForFunction(
        () =>
          Array.from(document.querySelectorAll("iframe")).some((f) =>
            f.src.includes("payment-widget.tosspayments.com"),
          ),
        undefined,
        { timeout: 20000 },
      )
      .catch(() => log("⚠️ payment-widget iframe 미확인"));
    await page.waitForTimeout(3000);
    await page.screenshot({ path: SHOT("02-toss-loaded"), fullPage: true });

    dumpFrameTree(page, "after Proceed");

    // 4. payment-widget 메인 iframe 내용 덤프
    log(`\n=== STEP 3: payment-widget iframe 내용 덤프 ===`);
    const pwFrame = page
      .frames()
      .find((f) => f.url().includes("payment-widget.tosspayments.com"));
    if (!pwFrame) {
      log("❌ payment-widget iframe 미발견");
      throw new Error("Toss iframe 없음");
    }
    log(`  frame url: ${pwFrame.url()}`);
    await dumpFrameContent(pwFrame, "payment-widget", 30);

    // 4.5 payment-gateway(토스페이 기본호출) iframe 닫기 시도
    log(`\n=== STEP 3.5: 토스페이 payment-gateway iframe 닫기 시도 ===`);
    const pgFrame = page
      .frames()
      .find(
        (f) =>
          f.url().includes("payment-gateway-sandbox.tosspayments.com") ||
          f.url().includes("pay.toss.im"),
      );
    if (pgFrame) {
      log(`  payment-gateway frame 발견: ${pgFrame.url().slice(0, 120)}`);
      await dumpFrameContent(pgFrame, "payment-gateway", 20);
      // 닫기/취소/뒤로 버튼 탐색
      const closeSelectors = [
        'button[aria-label*="닫기"]',
        'button[aria-label*="close" i]',
        'button:has-text("닫기")',
        'button:has-text("Close")',
        'button:has-text("취소")',
        'button:has-text("Cancel")',
        'button:has-text("뒤로")',
        '[class*="close" i] button',
        'button[class*="close" i]',
      ];
      for (const sel of closeSelectors) {
        const loc = pgFrame.locator(sel).first();
        if ((await loc.count()) > 0) {
          log(`  닫기 후보: ${sel}`);
          await loc
            .click({ force: true, timeout: 2000 })
            .catch((e) =>
              log(`    실패: ${(e as Error).message.slice(0, 80)}`),
            );
          break;
        }
      }
    } else {
      log("  payment-gateway frame 없음 (스킵)");
    }
    await page.waitForTimeout(1500);

    // 5. 카드 결제수단 선택 — force 클릭 + dispatchEvent fallback
    log(`\n=== STEP 4: "신용·체크카드" 결제수단 선택 (force) ===`);
    const cardBtn = pwFrame
      .locator('button[aria-label^="신용·체크카드"]')
      .first();
    const cardBtnCount = await cardBtn.count();
    log(`  카드 버튼 count=${cardBtnCount}`);

    if (cardBtnCount > 0) {
      // 1차: force click
      let ok = await cardBtn
        .click({ force: true, timeout: 4000 })
        .then(() => true)
        .catch((e) => {
          log(`  force click 실패: ${(e as Error).message.slice(0, 100)}`);
          return false;
        });
      // 2차: frame 내부 JS로 직접 클릭
      if (!ok) {
        log(`  JS dispatchEvent 폴백`);
        ok = await pwFrame
          .evaluate(() => {
            const b = document.querySelector(
              'button[aria-label^="신용·체크카드"]',
            ) as HTMLButtonElement | null;
            if (b) {
              b.scrollIntoView({ behavior: "instant", block: "center" });
              b.click();
              return true;
            }
            return false;
          })
          .catch(() => false);
        log(`  JS click 결과: ${ok}`);
      }
      await page.waitForTimeout(2000);
      // 선택 상태 재확인
      const nowLabel = await pwFrame
        .locator('button[aria-label^="신용·체크카드"]')
        .first()
        .getAttribute("aria-label")
        .catch(() => "");
      log(`  클릭 후 aria-label: "${nowLabel}"`);
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: SHOT("03-card-selected"), fullPage: true });
    dumpFrameTree(page, "after card select");

    // 카드 선택 후 payment-widget 재덤프
    log(`\n[payment-widget 재덤프 — 카드 선택 후]`);
    await dumpFrameContent(pwFrame, "payment-widget(after card)", 40);

    // 카드 선택이 됐다면 메인 페이지의 Proceed 버튼 재클릭 → requestPayment(CARD) 트리거 기대
    log(`\n=== STEP 4.5: 메인 Proceed 재클릭 (카드로 requestPayment) ===`);
    const mainProceed = page
      .locator('button:has-text("Proceed to Payment")')
      .last();
    const proceedEnabled = await mainProceed.isEnabled().catch(() => false);
    log(`  main Proceed enabled=${proceedEnabled}`);
    if (proceedEnabled) {
      await mainProceed
        .click({ force: true })
        .catch((e) =>
          log(`  재클릭 실패: ${(e as Error).message.slice(0, 80)}`),
        );
      await page.waitForTimeout(4000);
    }

    // 6. 카드 입력 iframe 들/inputs 덤프
    log(`\n=== STEP 5: 카드 입력 UI 덤프 ===`);
    // 카드 입력용 서브 iframe이 있을 수 있음
    const subFrames = page
      .frames()
      .filter(
        (f) =>
          f.url().includes("tosspayments.com") || f.url().includes("toss.im"),
      );
    log(`  Toss 관련 iframe ${subFrames.length}개 발견`);
    for (let i = 0; i < subFrames.length; i++) {
      await dumpFrameContent(subFrames[i], `toss-frame[${i}]`, 15);
    }

    // 7. 카드 번호 입력 시도
    log(`\n=== STEP 6: 테스트 카드번호 입력 시도 ===`);
    // 카드번호 후보 입력 필드 탐색 (모든 Toss 프레임 순회)
    const cardNumberPatterns = [
      'input[name*="cardNumber" i]',
      'input[name*="card_number" i]',
      'input[placeholder*="카드번호"]',
      'input[placeholder*="Card" i]',
      'input[aria-label*="카드번호"]',
      'input[autocomplete="cc-number"]',
      'input[inputmode="numeric"]',
    ];
    let inputFrame: Frame | null = null;
    let inputSelector = "";
    for (const f of [pwFrame, ...subFrames]) {
      for (const sel of cardNumberPatterns) {
        const loc = f.locator(sel).first();
        if ((await loc.count()) > 0) {
          inputFrame = f;
          inputSelector = sel;
          log(
            `  카드번호 input 발견: frame=${f.url().slice(0, 80)} sel=${sel}`,
          );
          break;
        }
      }
      if (inputFrame) break;
    }

    if (inputFrame) {
      try {
        await inputFrame.locator(inputSelector).first().fill(TEST_CARD.number);
        log(`  카드번호 입력 완료: ${TEST_CARD.number}`);
      } catch (e) {
        log(`  카드번호 입력 실패: ${(e as Error).message.slice(0, 120)}`);
      }
      // 유효기간, CVC, 기타 입력
      const fillMap: Array<{
        name: string;
        value: string;
        patterns: string[];
      }> = [
        {
          name: "expiry(MM)",
          value: TEST_CARD.expMonth,
          patterns: [
            'input[autocomplete="cc-exp-month"]',
            'input[name*="expiryMonth" i]',
            'input[name*="expMonth" i]',
            'input[placeholder*="MM"]',
            'input[aria-label*="월"]',
          ],
        },
        {
          name: "expiry(YY)",
          value: TEST_CARD.expYear,
          patterns: [
            'input[autocomplete="cc-exp-year"]',
            'input[name*="expiryYear" i]',
            'input[name*="expYear" i]',
            'input[placeholder*="YY"]',
            'input[aria-label*="년"]',
          ],
        },
        {
          name: "expiry(MM/YY)",
          value: `${TEST_CARD.expMonth}/${TEST_CARD.expYear}`,
          patterns: [
            'input[autocomplete="cc-exp"]',
            'input[placeholder*="MM/YY" i]',
            'input[placeholder*="유효기간"]',
          ],
        },
        {
          name: "cvc",
          value: TEST_CARD.cvc,
          patterns: [
            'input[autocomplete="cc-csc"]',
            'input[name*="cvc" i]',
            'input[name*="securityCode" i]',
            'input[aria-label*="CVC"]',
          ],
        },
        {
          name: "birth",
          value: TEST_CARD.birthOrBiz,
          patterns: [
            'input[name*="birth" i]',
            'input[placeholder*="생년월일"]',
            'input[placeholder*="YYMMDD" i]',
          ],
        },
        {
          name: "password2",
          value: TEST_CARD.password2,
          patterns: [
            'input[name*="password" i]',
            'input[placeholder*="비밀번호"]',
            'input[aria-label*="비밀번호"]',
          ],
        },
      ];
      for (const f of [pwFrame, ...subFrames]) {
        for (const field of fillMap) {
          for (const sel of field.patterns) {
            const loc = f.locator(sel).first();
            if ((await loc.count()) > 0) {
              try {
                await loc.fill(field.value, { timeout: 2000 });
                log(`  ${field.name} 입력 완료 (${sel}) = ${field.value}`);
              } catch (e) {
                log(
                  `  ${field.name} 입력 실패 (${sel}): ${(e as Error).message.slice(0, 80)}`,
                );
              }
              break;
            }
          }
        }
      }
    } else {
      log(
        "  ❌ 카드번호 input 미발견 — 카드 선택이 안 됐거나 iframe 구조 다름",
      );
    }

    await page.waitForTimeout(1500);
    await page.screenshot({ path: SHOT("04-card-filled"), fullPage: true });

    // 8. 최종 결제 버튼 (Proceed to Payment 또는 결제하기)
    log(`\n=== STEP 7: 최종 결제 버튼 클릭 ===`);
    const finalBtnCandidates = [
      'button:has-text("Proceed to Payment")',
      'button:has-text("결제하기")',
      'button:has-text("Pay Now")',
      'button:has-text("₩")',
    ];
    let finalClicked = false;
    for (const sel of finalBtnCandidates) {
      const loc = page.locator(sel).last();
      const count = await loc.count();
      if (count === 0) continue;
      const enabled = await loc.isEnabled().catch(() => false);
      const visible = await loc.isVisible().catch(() => false);
      log(
        `  후보 ${sel}: count=${count} enabled=${enabled} visible=${visible}`,
      );
      if (enabled && visible) {
        await loc
          .click({ force: true })
          .catch((e) =>
            log(`  클릭 실패: ${(e as Error).message.slice(0, 100)}`),
          );
        finalClicked = true;
        log(`  ✅ 최종 버튼 클릭: ${sel}`);
        break;
      }
    }
    if (!finalClicked) log("  ⚠️ 최종 결제 버튼 클릭 실패");

    // 9. 결과 대기 (30초)
    log(`\n=== STEP 8: 결제 결과 대기 (30초) ===`);
    const start = Date.now();
    let finalUrl = page.url();
    while (Date.now() - start < 30000) {
      await page.waitForTimeout(1000);
      if (makeOrderResp.length > 0) {
        log(`  make_order 응답 수신 (${makeOrderResp.length}건), 5초 더 대기`);
        await page.waitForTimeout(5000);
        break;
      }
      const u = page.url();
      if (u !== finalUrl) {
        log(`  URL 전환: ${finalUrl} → ${u}`);
        finalUrl = u;
      }
      if (!/\/payments/.test(u)) {
        log(`  /payments 페이지 벗어남`);
        break;
      }
    }
    await page.screenshot({ path: SHOT("05-final"), fullPage: true });
    log(`  최종 URL: ${page.url()}`);
    log(
      `  최종 body preview: ${(await page.evaluate(() => (document.body.innerText || "").slice(0, 400))).replace(/\s+/g, " ")}`,
    );

    log(`\n=== Toss 요청 요약 (${tossNet.length}건) ===`);
    tossNet
      .filter((r) => !/\.(svg|woff2|css|js)\b/i.test(r.url))
      .slice(0, 30)
      .forEach((r) => log(`  ${r.method} ${r.url.slice(0, 200)}`));

    log(`\n=== make_order 응답 (${makeOrderResp.length}건) ===`);
    makeOrderResp.forEach((r, i) =>
      log(`  [${i}] status=${r.status} body=${r.body}`),
    );
  } catch (e) {
    log(`\n❌ ERROR: ${(e as Error).message}`);
    log((e as Error).stack?.slice(0, 1200) || "");
    await page.screenshot({ path: SHOT("99-error") }).catch(() => {});
  } finally {
    fs.writeFileSync(path.join(OUT_DIR, "report.txt"), LOG.join("\n"), "utf-8");
    fs.writeFileSync(
      path.join(OUT_DIR, "toss-net.json"),
      JSON.stringify(tossNet, null, 2),
    );
    log(`\n📄 리포트: ${path.join(OUT_DIR, "report.txt")}`);
    await context.close();
    await browser.close();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
