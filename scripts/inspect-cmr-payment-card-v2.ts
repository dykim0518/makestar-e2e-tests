/**
 * CMR 카드 결제 정밀 탐색 v2
 *
 * 전략:
 *  1. Proceed 클릭 → Toss 기본(TOSSPAY) 모달 + payment-widget iframe 로드
 *  2. ESC 또는 닫기 버튼으로 TOSSPAY 모달 닫기 → payment-widget 드러나게
 *  3. payment-widget iframe 내 "신용·체크카드" force 클릭
 *  4. 메인 Proceed 재클릭 → Toss가 CARD authType으로 재호출 기대
 *  5. 카드 입력 iframe (예: authType=CARD 또는 카드 입력 Next.js 라우트) 등장 대기
 *  6. 카드 iframe DOM 완전 덤프 (input/buttons/labels/nested frames)
 *  7. Visa 4242 입력 시도 (최대한 보편적인 셀렉터로)
 *
 * 실행: AUTH_FILE=./auth.json PRODUCT_ID=15964 npx tsx scripts/inspect-cmr-payment-card-v2.ts
 */

import { chromium, Page, Frame, Response } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const BASE_URL = "https://stage-new.makeuni2026.com";
const OUT_SUFFIX = process.env.OUT_SUFFIX ? `-${process.env.OUT_SUFFIX}` : "";
const OUT_DIR = path.resolve(
  __dirname,
  `../test-results/inspect-cmr-payment-card-v2${OUT_SUFFIX}`,
);
const SHOT = (name: string) => path.join(OUT_DIR, `${name}.png`);
const LOG: string[] = [];
const log = (m: string) => {
  console.log(m);
  LOG.push(m);
};

const TEST_CARD = {
  number: "4242424242424242",
  expiry: "1230",
  cvc: "123",
};

function summarizeFrames(page: Page, label: string) {
  const frames = page.frames();
  log(`\n[frames @ ${label}] count=${frames.length}`);
  frames.forEach((f, i) => {
    log(`  [${i}] ${f.url().slice(0, 160)}`);
  });
}

async function dumpFrame(frame: Frame, label: string) {
  try {
    const info = await frame.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"))
        .map((b) => ({
          text: (b.textContent || "").trim().slice(0, 80),
          aria: b.getAttribute("aria-label") || "",
          dis: (b as HTMLButtonElement).disabled,
        }))
        .filter((b) => b.text.length > 0 || b.aria.length > 0)
        .slice(0, 30);
      const inputs = Array.from(
        document.querySelectorAll("input, [role='textbox'], [contenteditable]"),
      )
        .map((el) => ({
          tag: el.tagName,
          type: (el as HTMLInputElement).type || "",
          name: (el as HTMLInputElement).name || "",
          id: el.id,
          ph: (el as HTMLInputElement).placeholder || "",
          aria: el.getAttribute("aria-label") || "",
          cls: (el.className?.toString() || "").slice(0, 60),
          visible:
            (el as HTMLElement).offsetWidth > 0 &&
            (el as HTMLElement).offsetHeight > 0,
        }))
        .slice(0, 30);
      const text = (document.body?.innerText || "")
        .replace(/\s+/g, " ")
        .slice(0, 600);
      return { buttons, inputs, text };
    });
    log(`\n[${label}] buttons(${info.buttons.length}):`);
    info.buttons.forEach((b) =>
      log(`  - "${b.text}" aria="${b.aria}" dis=${b.dis}`),
    );
    log(`[${label}] inputs(${info.inputs.length}):`);
    info.inputs.forEach((i) =>
      log(
        `  - <${i.tag}> type=${i.type} name=${i.name} id=${i.id} ph="${i.ph}" aria="${i.aria}" visible=${i.visible}`,
      ),
    );
    log(`[${label}] text: ${info.text}`);
  } catch (e) {
    log(`[${label}] dump 실패: ${(e as Error).message.slice(0, 100)}`);
  }
}

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const authFile = process.env.AUTH_FILE || "./auth.json";
  const productId = process.env.PRODUCT_ID || "15966";
  log(`🔐 auth=${authFile} product=${productId}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: authFile,
    viewport: { width: 1920, height: 1080 },
  });

  const interesting: string[] = [];
  context.on("request", (r) => {
    const u = r.url();
    if (
      /tosspayments\.com.*(sessions|payment|cards?|auth|pc\/|charge)/i.test(u)
    ) {
      interesting.push(`${r.method()} ${u.slice(0, 200)}`);
    }
  });
  const makeOrderResponses: Array<{ status: number; body: string }> = [];
  context.on("response", async (resp: Response) => {
    if (resp.url().includes("make_order")) {
      const body = await resp.text().catch(() => "");
      makeOrderResponses.push({
        status: resp.status(),
        body: body.slice(0, 500),
      });
      log(`🔔 make_order: ${resp.status()}`);
      if (resp.status() >= 400) {
        log(`   body: ${body.slice(0, 400).replace(/\s+/g, " ")}`);
      }
    }
  });

  const page = await context.newPage();

  try {
    // 1. KRW + 상품 진입
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => localStorage.setItem("currency", "KRW"));
    await page.goto(`${BASE_URL}/product/${productId}`, {
      waitUntil: "domcontentloaded",
    });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(1500);

    // 옵션 선택
    const optionSel = page
      .locator('select, [role="combobox"], [class*="option"] button')
      .first();
    const optCount = await optionSel.count();
    log(`  option trigger count=${optCount}`);
    if (optCount > 0) {
      await optionSel.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(500);
      const optItems = await page
        .locator('[role="option"], li[data-value], option')
        .count();
      log(`  option items visible=${optItems}`);
      await page
        .locator('[role="option"], li[data-value], option')
        .nth(1)
        .click({ timeout: 2000 })
        .catch((e) =>
          log(`  option click 실패: ${(e as Error).message.slice(0, 80)}`),
        );
    }

    const purchaseLoc = page.locator('button:has-text("Purchase")').first();
    const purchaseState = await purchaseLoc
      .evaluate((b) => ({
        disabled: (b as HTMLButtonElement).disabled,
        text: (b.textContent || "").trim().slice(0, 60),
      }))
      .catch(() => ({ disabled: null, text: "N/A" }));
    log(
      `  Purchase 상태: disabled=${purchaseState.disabled} text="${purchaseState.text}"`,
    );
    await purchaseLoc.click({ timeout: 10000 });
    await page.waitForURL(/\/payments/, { timeout: 15000 });
    log(`✅ /payments 도달`);

    // 2. 스켈레톤 해제 + 동의 체크
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

    // 3. Proceed 클릭
    log(`\n=== STEP A: Proceed 클릭 (1차) ===`);
    await page.locator('button:has-text("Proceed to Payment")').last().click();

    // 4. Toss widget iframe 로드 대기
    await page
      .waitForFunction(
        () =>
          Array.from(document.querySelectorAll("iframe")).some((f) =>
            f.src.includes("payment-widget.tosspayments.com"),
          ),
        undefined,
        { timeout: 20000 },
      )
      .catch(() => log("⚠️ payment-widget 미확인"));
    await page.waitForTimeout(2500);
    summarizeFrames(page, "after 1st Proceed");
    await page.screenshot({ path: SHOT("01-after-proceed"), fullPage: true });

    // 5. TOSSPAY payment-gateway iframe 닫기 시도 — ESC + 바깥 클릭 + 내부 닫기 버튼
    log(`\n=== STEP B: TOSSPAY 모달 닫기 시도 ===`);
    const pgBefore = page
      .frames()
      .filter((f) => f.url().includes("payment-gateway-sandbox")).length;
    log(`  TOSSPAY iframe 존재: ${pgBefore > 0}`);

    // 5-a. "인증 취소" 버튼 클릭 (확인된 닫기 액션)
    const pgFrameFirst = page
      .frames()
      .find((f) => f.url().includes("payment-gateway-sandbox"));
    if (pgFrameFirst) {
      const cancelBtn = pgFrameFirst
        .locator('button[aria-label="인증 취소"]')
        .first();
      const cancelCount = await cancelBtn.count();
      log(`  "인증 취소" 버튼 count=${cancelCount}`);
      if (cancelCount > 0) {
        await cancelBtn
          .click({ force: true, timeout: 3000 })
          .then(() => log(`  ✅ "인증 취소" 클릭 성공`))
          .catch((e) =>
            log(
              `  "인증 취소" 클릭 실패: ${(e as Error).message.slice(0, 80)}`,
            ),
          );
        await page.waitForTimeout(2000);
      }
    }
    // ESC 폴백
    await page.keyboard.press("Escape");
    await page.waitForTimeout(1000);
    const pgAfterEsc = page
      .frames()
      .filter((f) => f.url().includes("payment-gateway-sandbox")).length;
    log(`  닫기 시도 후 TOSSPAY iframe: ${pgAfterEsc > 0}`);

    // 5-b. payment-gateway iframe 내부 "다른 결제수단" / "취소" 버튼 탐색
    if (pgAfterEsc > 0) {
      const pgFrame = page
        .frames()
        .find((f) => f.url().includes("payment-gateway-sandbox"));
      if (pgFrame) {
        await dumpFrame(pgFrame, "payment-gateway(TOSSPAY)");
        // 중첩 pay.toss.im frame에서도 탐색
        const innerFrame = page
          .frames()
          .find((f) => f.url().includes("pay.toss.im"));
        if (innerFrame) {
          await dumpFrame(innerFrame, "pay.toss.im");
        }
        // 범용 닫기 버튼
        const closeCandidates = [
          'button:has-text("다른 결제수단")',
          'button:has-text("취소")',
          'button:has-text("close")',
          'button:has-text("닫기")',
          'button[aria-label*="close" i]',
          'button[aria-label*="닫기"]',
        ];
        for (const sel of closeCandidates) {
          for (const f of [pgFrame, innerFrame].filter(Boolean) as Frame[]) {
            const loc = f.locator(sel).first();
            if ((await loc.count()) > 0) {
              log(`  닫기 후보 발견: ${sel} in ${f.url().slice(0, 50)}`);
              await loc.click({ force: true }).catch(() => {});
              break;
            }
          }
        }
      }
    }
    await page.waitForTimeout(1500);
    await page.screenshot({ path: SHOT("02-after-esc"), fullPage: true });

    // 6. payment-widget에서 "신용·체크카드" 선택 (force)
    log(`\n=== STEP C: "신용·체크카드" 선택 (force + JS 폴백) ===`);
    const pwFrame = page
      .frames()
      .find((f) => f.url().includes("payment-widget.tosspayments.com"));
    if (!pwFrame) throw new Error("payment-widget iframe 없음");

    const cardBtn = pwFrame
      .locator('button[aria-label^="신용·체크카드"]')
      .first();
    const cardCount = await cardBtn.count();
    log(`  card 버튼 count=${cardCount}`);
    if (cardCount > 0) {
      // scroll into view
      await cardBtn.scrollIntoViewIfNeeded().catch(() => {});
      let clicked = await cardBtn
        .click({ force: true, timeout: 4000 })
        .then(() => true)
        .catch((e) => {
          log(`  force click 실패: ${(e as Error).message.slice(0, 80)}`);
          return false;
        });
      if (!clicked) {
        // JS dispatchEvent
        clicked = await pwFrame
          .evaluate(() => {
            const b = document.querySelector(
              'button[aria-label^="신용·체크카드"]',
            ) as HTMLButtonElement | null;
            if (b) {
              b.scrollIntoView({ behavior: "instant", block: "center" });
              b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
              return true;
            }
            return false;
          })
          .catch(() => false);
        log(`  JS click: ${clicked}`);
      }
      await page.waitForTimeout(2000);
      const aria = await cardBtn.getAttribute("aria-label").catch(() => "");
      log(`  카드 버튼 현재 aria: "${aria}"`);
    }
    await page.screenshot({ path: SHOT("03-card-selected"), fullPage: true });

    // 6.4 VISA 요소의 DOM 구조 덤프 (디버깅용)
    log(`\n=== STEP C.4: VISA 주변 DOM 구조 덤프 ===`);
    const visaStructure = await pwFrame.evaluate(() => {
      const all = Array.from(document.querySelectorAll("*")) as HTMLElement[];
      const visaElements = all.filter(
        (el) =>
          /^VISA$/i.test((el.textContent || "").trim()) ||
          /VISA/i.test(el.getAttribute("aria-label") || ""),
      );
      return visaElements.slice(0, 3).map((el) => {
        const rect = el.getBoundingClientRect();
        const style = window.getComputedStyle(el);
        // parent chain 최대 4 레벨
        const ancestors: string[] = [];
        let cur: HTMLElement | null = el;
        for (let i = 0; i < 4 && cur; i++) {
          const tag = cur.tagName.toLowerCase();
          const cls = (cur.className?.toString() || "").slice(0, 60);
          const role = cur.getAttribute("role") || "";
          const aria = (cur.getAttribute("aria-label") || "").slice(0, 40);
          const id = cur.id;
          ancestors.push(
            `<${tag}${id ? `#${id}` : ""}${role ? ` role="${role}"` : ""}${aria ? ` aria="${aria}"` : ""}${cls ? ` class="${cls}"` : ""}>`,
          );
          cur = cur.parentElement;
        }
        // 부모 체인 중 첫 번째 "clickable-ish" 요소 찾기
        let clickTarget: HTMLElement | null = el;
        for (let i = 0; i < 5 && clickTarget; i++) {
          const tag = clickTarget.tagName.toLowerCase();
          const role = clickTarget.getAttribute("role") || "";
          if (
            ["button", "label", "a"].includes(tag) ||
            ["button", "radio", "option"].includes(role) ||
            clickTarget.hasAttribute("onclick")
          ) {
            break;
          }
          clickTarget = clickTarget.parentElement;
        }
        return {
          tag: el.tagName,
          text: (el.textContent || "").trim().slice(0, 40),
          aria: el.getAttribute("aria-label") || "",
          rect: {
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          },
          visible:
            rect.width > 0 &&
            rect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden",
          display: style.display,
          visibility: style.visibility,
          offsetParentNull: el.offsetParent === null,
          ancestors,
          clickTargetTag: clickTarget?.tagName,
          clickTargetRole: clickTarget?.getAttribute("role") || "",
          clickTargetClass: (clickTarget?.className?.toString() || "").slice(
            0,
            80,
          ),
          clickTargetOuterHTML: (clickTarget?.outerHTML || "").slice(0, 400),
        };
      });
    });
    log(`  VISA 후보 ${visaStructure.length}개:`);
    visaStructure.forEach((v, i) => {
      log(`  [${i}] tag=${v.tag} text="${v.text}" aria="${v.aria}"`);
      log(
        `      rect=${JSON.stringify(v.rect)} visible=${v.visible} display=${v.display} offsetParentNull=${v.offsetParentNull}`,
      );
      log(`      ancestors: ${v.ancestors.join(" > ")}`);
      log(
        `      clickTarget=<${v.clickTargetTag}> role="${v.clickTargetRole}" class="${v.clickTargetClass}"`,
      );
      log(
        `      clickTargetHTML: ${v.clickTargetOuterHTML.replace(/\s+/g, " ")}`,
      );
    });

    // 6.5 "카드사 선택" 영역이 collapsed일 가능성 → "카드 종류 선택" 펼치기 탐색
    log(`\n=== STEP C.45: "카드사 선택" 영역 펼치기 시도 ===`);
    const expandOk = await pwFrame
      .evaluate(() => {
        // collapsed 섹션 감지: "카드사 선택" 레이블이 있는 요소의 부모 중 height가 작거나 overflow가 hidden인 경우
        const labels = Array.from(
          document.querySelectorAll("*"),
        ) as HTMLElement[];
        const cardIssuerLabel = labels.find(
          (el) =>
            /카드사 선택|카드 종류|해외 카드/i.test(
              (el.textContent || "").trim(),
            ) && (el.textContent || "").trim().length < 20,
        );
        if (cardIssuerLabel) {
          // 부모 체인 중 클릭 가능한 것 찾아 클릭
          let cur: HTMLElement | null = cardIssuerLabel;
          for (let i = 0; i < 5 && cur; i++) {
            const tag = cur.tagName.toLowerCase();
            const role = cur.getAttribute("role") || "";
            if (
              tag === "button" ||
              role === "button" ||
              role === "combobox" ||
              tag === "summary"
            ) {
              cur.click();
              return { clicked: true, tag, role };
            }
            cur = cur.parentElement;
          }
          // 아예 레이블 자체 클릭
          cardIssuerLabel.click();
          return { clicked: "label", tag: cardIssuerLabel.tagName, role: "" };
        }
        return { clicked: false };
      })
      .catch((e) => ({ clicked: false, error: (e as Error).message }));
    log(`  펼치기 시도 결과: ${JSON.stringify(expandOk)}`);
    await page.waitForTimeout(1500);

    // 6.5 카드사 선택 (VISA) — native <select> 기반 (DOM 덤프로 확정)
    log(`\n=== STEP C.5: 카드사 "VISA" 선택 — native select ===`);
    let visaClicked = false;

    // 1차: native select selectOption (가장 정확)
    const selectLoc = pwFrame.locator("select").first();
    const selectCount = await selectLoc.count();
    log(`  payment-widget iframe 내 <select> 개수=${selectCount}`);
    if (selectCount > 0) {
      try {
        await selectLoc.selectOption({ label: "VISA" }, { timeout: 3000 });
        log(`  ✅ selectOption(VISA) 성공`);
        visaClicked = true;
      } catch (e) {
        log(
          `  selectOption 실패: ${(e as Error).message.slice(0, 100)} — JS 폴백 시도`,
        );
        // 2차: select.value 직접 세팅 + change 이벤트 dispatch
        const ok = await pwFrame.evaluate(() => {
          const sel = document.querySelector(
            "select",
          ) as HTMLSelectElement | null;
          if (!sel) return false;
          const visaOpt = Array.from(sel.options).find((o) =>
            /^VISA$/i.test(o.textContent?.trim() || ""),
          );
          if (!visaOpt) return false;
          sel.value = visaOpt.value;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
          sel.dispatchEvent(new Event("input", { bubbles: true }));
          return true;
        });
        log(`  JS select.value 세팅: ${ok}`);
        visaClicked = ok;
      }
    }

    // 3차: 구형 fallback (role/text based) — 유지
    const visaCandidates = [
      '[role="option"]:has-text("VISA")',
      'button:has-text("VISA")',
      'button[aria-label*="VISA" i]',
      'li:has-text("VISA")',
    ];
    for (const sel of visaCandidates) {
      if (visaClicked) break;
      const loc = pwFrame.locator(sel).first();
      const cnt = await loc.count();
      if (cnt > 0) {
        log(`  VISA 후보 발견: ${sel} count=${cnt}`);
        const clicked = await loc
          .click({ force: true, timeout: 2500 })
          .then(() => true)
          .catch((e) => {
            log(`    실패: ${(e as Error).message.slice(0, 80)}`);
            return false;
          });
        if (clicked) {
          visaClicked = true;
          break;
        }
      }
    }
    if (!visaClicked) {
      // JS evaluate로 VISA 텍스트 포함 요소 직접 클릭
      const ok = await pwFrame
        .evaluate(() => {
          const all = Array.from(
            document.querySelectorAll(
              "button, [role='button'], [role='option'], li, span",
            ),
          ) as HTMLElement[];
          const target = all.find(
            (el) =>
              (el.textContent || "").trim().toUpperCase() === "VISA" ||
              /^VISA$/i.test((el.getAttribute("aria-label") || "").trim()),
          );
          if (target) {
            target.scrollIntoView({ behavior: "instant", block: "center" });
            target.click();
            return true;
          }
          return false;
        })
        .catch(() => false);
      log(`  JS VISA click: ${ok}`);
      visaClicked = ok;
    }
    await page.waitForTimeout(2000);
    await page.screenshot({ path: SHOT("03b-visa-selected"), fullPage: true });

    // payment-widget 재덤프 (VISA 선택 후)
    log(`\n[payment-widget — VISA 선택 후 덤프]`);
    await dumpFrame(pwFrame, "pw(after VISA)");

    // 7. 메인 Proceed 재클릭 (카드로 requestPayment 기대)
    log(`\n=== STEP D: 메인 Proceed 재클릭 ===`);
    const mainProceed = page
      .locator('button:has-text("Proceed to Payment")')
      .last();
    const mpEnabled = await mainProceed.isEnabled().catch(() => false);
    log(`  main Proceed enabled=${mpEnabled}`);
    if (mpEnabled) {
      await mainProceed
        .click({ force: true })
        .catch((e) =>
          log(`  재클릭 실패: ${(e as Error).message.slice(0, 80)}`),
        );
      await page.waitForTimeout(5000);
    }
    await page.screenshot({
      path: SHOT("04-after-2nd-proceed"),
      fullPage: true,
    });
    summarizeFrames(page, "after 2nd Proceed");

    // 8. 카드 입력 iframe 탐색 (authType=CARD 또는 card input 포함 URL)
    log(`\n=== STEP E: 카드 입력 iframe 탐색 ===`);
    const cardFrameCandidates = page
      .frames()
      .filter(
        (f) =>
          /tosspayments\.com|toss\.im/.test(f.url()) &&
          !/gtm|analytics/.test(f.url()),
      );
    log(`  Toss 계열 frame ${cardFrameCandidates.length}개:`);
    cardFrameCandidates.forEach((f, i) =>
      log(`    [${i}] ${f.url().slice(0, 200)}`),
    );

    for (let i = 0; i < cardFrameCandidates.length; i++) {
      await dumpFrame(cardFrameCandidates[i], `card-frame[${i}]`);
    }

    // 9. 카드번호 input 탐색 + 입력 시도
    log(`\n=== STEP F: 카드번호 input 탐색 ===`);
    const cardNumberPatterns = [
      'input[name*="cardNumber" i]',
      'input[name*="card_number" i]',
      'input[placeholder*="카드번호"]',
      'input[placeholder*="Card" i]',
      'input[autocomplete="cc-number"]',
      'input[inputmode="numeric"][maxlength="19"]',
    ];
    let filled = false;
    for (const f of cardFrameCandidates) {
      for (const sel of cardNumberPatterns) {
        const loc = f.locator(sel).first();
        if (
          (await loc.count()) > 0 &&
          (await loc.isVisible().catch(() => false))
        ) {
          log(`  발견: frame=${f.url().slice(0, 80)} sel=${sel}`);
          try {
            await loc.fill(TEST_CARD.number, { timeout: 3000 });
            log(`  ✅ Visa 4242 입력 성공`);
            filled = true;
            break;
          } catch (e) {
            log(`  입력 실패: ${(e as Error).message.slice(0, 100)}`);
          }
        }
      }
      if (filled) break;
    }
    if (!filled) log(`  ❌ 카드번호 input 없음 — 카드 결제 UI 진입 실패`);

    await page.screenshot({ path: SHOT("05-final"), fullPage: true });

    // === STEP G: 카드 나머지 필드 입력 + Submit 탐색 ===
    if (process.env.PROBE_SUBMIT === "1") {
      log(`\n=== STEP G: 카드 4분할 재입력 + expiry/email/약관 + Submit ===`);
      const cardFrame = page
        .frames()
        .find((f) => /\/pc\/payment-method\/card\/option/.test(f.url()));
      if (!cardFrame) {
        log(`  ❌ card frame 없음`);
      } else {
        // 카드번호 4분할 각각 입력 (first() 1필드만 채우는 기존 동작 보강)
        const digits = TEST_CARD.number.replace(/\D/g, "");
        for (let i = 0; i < 4; i++) {
          await cardFrame
            .locator(`input[name="cardNumber.${i}"]`)
            .fill(digits.slice(i * 4, (i + 1) * 4), { timeout: 3000 })
            .catch((e) =>
              log(
                `  cardNumber.${i} 실패: ${(e as Error).message.slice(0, 60)}`,
              ),
            );
        }
        log(`  ✅ 4분할 카드번호 재입력 완료`);
        await cardFrame
          .locator('input[name="cardExpiry"]')
          .fill("12/30", { timeout: 3000 })
          .catch((e) =>
            log(`  expiry 실패: ${(e as Error).message.slice(0, 60)}`),
          );
        await cardFrame
          .locator('input[name="email"]')
          .fill("qa-e2e@makestar.test", { timeout: 3000 })
          .catch((e) =>
            log(`  email 실패: ${(e as Error).message.slice(0, 60)}`),
          );
        // 약관 체크박스 전체 체크 — Playwright check()로 React state 반영 보장
        const cbs = cardFrame.locator('input[type="checkbox"]');
        const cbTotal = await cbs.count();
        for (let i = 0; i < cbTotal; i++) {
          const cb = cbs.nth(i);
          if (!(await cb.isChecked().catch(() => false))) {
            await cb
              .check({ force: true, timeout: 2000 })
              .catch((e) =>
                log(
                  `  cb.${i} check 실패: ${(e as Error).message.slice(0, 60)}`,
                ),
              );
          }
        }
        log(`  ✅ 약관 체크박스 ${cbTotal}개 check`);
        log(`  폼 입력 완료, Next-VISA Pay 클릭 준비`);

        const beforeUrl = page.url();
        const networkLog: string[] = [];
        context.on("request", (r) => {
          const u = r.url();
          if (
            /tosspayments\.com|makeuni2026\.com/.test(u) &&
            !/\.js$|\.css$|\.woff|\.png|\.svg/.test(u)
          ) {
            networkLog.push(`REQ ${r.method()} ${u.slice(0, 160)}`);
          }
        });
        context.on("response", (r) => {
          const u = r.url();
          if (
            /(confirm|approve|complete|success|done|payment-key|orderId)/i.test(
              u,
            )
          ) {
            networkLog.push(`RES ${r.status()} ${u.slice(0, 160)}`);
          }
        });

        const payBtn = cardFrame.locator('button[aria-label^="Next-"]').first();
        await payBtn
          .click({ force: true, timeout: 5000 })
          .catch((e) =>
            log(`  Pay 클릭 실패: ${(e as Error).message.slice(0, 80)}`),
          );
        log(`  Pay 클릭 후 URL 변화 10초 모니터...`);

        // URL 변화 또는 타임아웃까지 대기
        await page
          .waitForURL((u) => u.toString() !== beforeUrl, { timeout: 15000 })
          .then(() => log(`  ✅ URL 변경됨: ${page.url().slice(0, 200)}`))
          .catch(() => log(`  ⚠️ URL 변경 없음 (15초)`));

        await page.waitForTimeout(3000);
        await page.screenshot({
          path: SHOT("06-after-submit"),
          fullPage: true,
        });
        log(`  최종 URL: ${page.url()}`);
        log(
          `  최종 URL 파라미터: ${new URL(page.url()).searchParams.toString()}`,
        );

        const bodyText = await page.evaluate(() =>
          (document.body?.innerText || "").replace(/\s+/g, " ").slice(0, 800),
        );
        log(`  body text (앞 800자): ${bodyText}`);

        log(`\n  network log (${networkLog.length}):`);
        networkLog.slice(0, 30).forEach((l) => log(`    ${l}`));
      }
    }

    log(`\n=== 요약 ===`);
    log(`make_order 응답 ${makeOrderResponses.length}건`);
    log(`Toss 관심 요청 ${interesting.length}건:`);
    interesting.slice(0, 20).forEach((r) => log(`  ${r}`));
  } catch (e) {
    log(`\n❌ ERROR: ${(e as Error).message}`);
    log((e as Error).stack?.slice(0, 1200) || "");
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
