/**
 * Admin 엑셀 다운로드 Smoke 검증 (전체 11개 버튼)
 *
 * 빠른 회귀용: 다운로드 가능 + 파일 무결성만 확인.
 * 깊은 정합성 검증은 admin_excel_verify_pom.spec.ts 참조.
 *
 * 검증 항목:
 *  1. 다운로드 가능 여부 (파일 수신, 크기 > 0, 확장자 일치)
 *  2. 사유 모달 출현 여부 일치
 *  3. 파일 무결성 (xlsx 파싱 성공, 시트/헤더/row 존재)
 *  4. ZIP은 내부 xlsx 전체 파싱
 */

import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { setupAuthCookies, resetAuthCache } from "./helpers/admin/auth-helper";
import { clickAndDownloadExcel } from "./helpers/admin/excel-export";
import { parseExcelOrZip } from "./helpers/excel-parser";

const BASE =
  process.env.ADMIN_BASE_URL || "https://stage-new-admin.makeuni2026.com";

type PreAction = "user-b2b-tab" | "event-winner-menu" | "sales-tab";

type Target = {
  id: string;
  name: string;
  url: string;
  buttonText: string;
  exact?: boolean;
  preAction?: PreAction;
  expect: {
    hasReasonModal: boolean;
    isZip: boolean;
    /** ZIP이면 내부 파일 최소 수 */
    minFiles?: number;
  };
};

const TARGETS: Target[] = [
  // === 상품 ===
  {
    id: "CAT-EXCEL-01",
    name: "대분류 목록 > 엑셀다운받기 @feature:admin_makestar.product.list",
    url: `${BASE}/product/new/list`,
    buttonText: "엑셀다운받기",
    exact: true,
    expect: { hasReasonModal: false, isZip: false },
  },
  {
    id: "PRD-EXCEL-01",
    name: "상품 목록 > 엑셀다운받기 @feature:admin_makestar.event.list",
    url: `${BASE}/event/list`,
    buttonText: "엑셀다운받기",
    exact: true,
    expect: { hasReasonModal: false, isZip: false },
  },
  {
    id: "PRD-SHIP-01",
    name: "상품 목록 > 출고엑셀다운받기 @feature:admin_makestar.event.list",
    url: `${BASE}/event/list`,
    buttonText: "출고엑셀다운받기",
    exact: true,
    expect: { hasReasonModal: false, isZip: false },
  },
  // === 주문 ===
  {
    id: "ORD-SKU-01",
    name: "주문관리 > 주문-SKU 엑셀 다운로드 @feature:admin_makestar.order.list",
    url: `${BASE}/order/list`,
    buttonText: "주문-SKU 엑셀 다운로드",
    exact: true,
    expect: { hasReasonModal: true, isZip: true, minFiles: 1 },
  },
  {
    id: "ORD-V1-01",
    name: "주문관리 > 주문 엑셀 다운로드 @feature:admin_makestar.order.list",
    url: `${BASE}/order/list`,
    buttonText: "주문 엑셀 다운로드",
    exact: true,
    expect: { hasReasonModal: true, isZip: false },
  },
  {
    id: "ORD-V2-01",
    name: "주문관리 > 주문 엑셀 다운로드 V2 @feature:admin_makestar.order.list",
    url: `${BASE}/order/list`,
    buttonText: "주문 엑셀 다운로드 V2",
    exact: true,
    expect: { hasReasonModal: true, isZip: false },
  },
  {
    id: "ORD-BASIC-01",
    name: "주문관리 > 엑셀다운받기 @feature:admin_makestar.order.list",
    url: `${BASE}/order/list`,
    buttonText: "엑셀다운받기",
    exact: true,
    expect: { hasReasonModal: true, isZip: false },
  },
  // === 회원 ===
  {
    id: "USR-B2C-01",
    name: "회원목록 > B2C 회원 관리 > 엑셀다운받기 @feature:admin_makestar.user.list",
    url: `${BASE}/user/list`,
    buttonText: "엑셀다운받기",
    exact: true,
    expect: { hasReasonModal: true, isZip: false },
  },
  {
    id: "USR-B2B-01",
    name: "회원목록 > B2B 회원 관리 > 엑셀다운받기 @feature:admin_makestar.user.list",
    url: `${BASE}/user/list`,
    buttonText: "엑셀다운받기",
    exact: true,
    preAction: "user-b2b-tab",
    expect: { hasReasonModal: true, isZip: false },
  },
  // === 이벤트 ===
  {
    id: "EVT-WINNER-01",
    name: "이벤트 당첨자 > 당첨자 선정 엑셀 다운로드 @feature:admin_makestar.eventwinner.detail",
    url: `${BASE}/event-winner/15636?eventTitle=IVE+THE+2ND+ALBUM+%3CREVIVE%2B%3E+MEET%26CALL+EVENT`,
    buttonText: "당첨자 선정 엑셀 다운로드",
    exact: false,
    preAction: "event-winner-menu",
    expect: { hasReasonModal: true, isZip: false },
  },
  {
    id: "EVT-SALES-01",
    name: "이벤트 당첨 관리 > 판매량 정보 다운로드 @feature:admin_makestar.eventwinningmanage.detail",
    url: `${BASE}/event-winning-manage/15761?name=NMIXX%201st%20Full%20Album%20[Blue%20Valentine]%20SPECIAL%20LUCKY%20DRAW%20EVENT&code=P_9723_NMIXX_78&status=SALES_END`,
    buttonText: "판매량 정보 다운로드",
    exact: false,
    preAction: "sales-tab",
    expect: { hasReasonModal: false, isZip: false },
  },
];

// ===========================================================================
// 공통 유틸
// ===========================================================================

async function findButton(
  page: Page,
  text: string,
  exact: boolean,
): Promise<Locator> {
  if (!exact) return page.locator(`button:has-text("${text}")`).first();

  const candidates = page.locator(`button:has-text("${text}")`);
  const n = await candidates.count();
  for (let i = 0; i < n; i++) {
    const el = candidates.nth(i);
    const t = ((await el.textContent()) || "").trim();
    if (t === text) return el;
  }
  // 정확 일치 없으면 첫 후보 반환 (디버그 용이)
  return candidates.first();
}

async function runPreAction(page: Page, action: PreAction) {
  if (action === "user-b2b-tab") {
    const tab = page.locator('div:text-is("B2B 회원 관리")').first();
    await tab.waitFor({ state: "visible", timeout: 10000 });
    await tab.click();
    await page.waitForTimeout(3000);
  } else if (action === "event-winner-menu") {
    // "엑셀다운로드" 트리거 먼저 열기
    const trigger = page
      .locator(
        'button:has-text("엑셀다운로드"), div:text-is("엑셀다운로드"), [role="button"]:has-text("엑셀다운로드")',
      )
      .first();
    await trigger.waitFor({ state: "visible", timeout: 10000 });
    await trigger.click();
    await page.waitForTimeout(1500);
  } else if (action === "sales-tab") {
    const tab = page
      .locator(
        '[role="tab"]:has-text("판매량"), button:has-text("판매량"), div:text-is("판매량")',
      )
      .first();
    if ((await tab.count()) > 0) {
      await tab.click();
      await page.waitForTimeout(3000);
    }
  }
}

// ===========================================================================
// 스펙
// ===========================================================================

test.describe("Admin 엑셀 다운로드 검증", () => {
  for (const t of TARGETS) {
    test(`${t.id}: ${t.name}`, async ({ page }) => {
      resetAuthCache();
      await setupAuthCookies(page);
      await page.goto(t.url, { waitUntil: "domcontentloaded" });
      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => {});
      await page.waitForTimeout(5000);

      if (t.preAction) await runPreAction(page, t.preAction);

      const button = await findButton(page, t.buttonText, t.exact ?? false);
      await expect(button, `버튼 "${t.buttonText}" 로드 실패`).toBeVisible({
        timeout: 20000,
      });

      const result = await clickAndDownloadExcel(page, button, {
        timeoutMs: 90_000,
      });

      // === 1) 다운로드 가능 여부 ===
      expect(result.sizeBytes, "파일 크기 0").toBeGreaterThan(0);
      expect(result.hadReasonModal, "사유 모달 출현 불일치").toBe(
        t.expect.hasReasonModal,
      );
      const isZip = /\.zip$/i.test(result.fileName);
      expect(isZip, "파일 형식 불일치").toBe(t.expect.isZip);

      // === 2) 파일 무결성 ===
      const parsed = parseExcelOrZip(result.filePath);
      expect(parsed.files.length, "파싱된 파일 없음").toBeGreaterThanOrEqual(
        t.expect.minFiles ?? 1,
      );

      for (const f of parsed.files) {
        expect(f.sheets.length, `시트 없음: ${f.fileName}`).toBeGreaterThan(0);
        const sheet = f.sheets[0];
        expect(
          sheet.headers.length,
          `헤더 없음: ${f.fileName}`,
        ).toBeGreaterThan(0);
      }

      const head = parsed.files[0].sheets[0];
      const summary =
        `[${t.id}] ✅ "${result.fileName}" ${result.sizeBytes}B ${result.elapsedMs}ms ` +
        `files=${parsed.files.length} headers=${head.headers.length} rows=${head.rowCount}`;
      console.log(summary);
      if (parsed.isZip) {
        for (const f of parsed.files) {
          console.log(
            `    - ${f.fileName} / rows=${f.sheets[0]?.rowCount ?? 0}`,
          );
        }
      }
    });
  }
});
