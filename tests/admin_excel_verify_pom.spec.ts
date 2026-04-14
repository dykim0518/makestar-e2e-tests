/**
 * Admin 엑셀 심층 정합성 검증
 *
 * 빠른 smoke 검증은 admin_excel_pom.spec.ts 참조.
 *
 * 검증 범위:
 *  1. 키 컬럼 교집합 (API 최신 → Excel 존재): 대분류 / 회원 B2C
 *  2. 주문 Excel → API 역검증 (유령 데이터 없음): V1 / V2 / 기본 / SKU(ZIP)
 *  3. 필터 조합 (주문 상태 / 주문번호 검색)
 *
 * 제외:
 *  - 주문 엑셀은 상한이 비최신순이라 키 교집합 검증 부적합 → 역방향 검증으로 대체
 *  - 이벤트/상품 : API ↔ Excel 집계 레벨 상이 (그룹 vs 개인 등)
 */

import { test, expect } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { OrderListPage } from "./pages";
import { setupAuthCookies, resetAuthCache } from "./helpers/admin/auth-helper";
import { initPageWithRecovery } from "./helpers/admin";
import { clickAndDownloadExcel } from "./helpers/admin/excel-export";
import { parseExcelOrZip } from "./helpers/excel-parser";
import { captureApi, extractRows } from "./helpers/admin/api-capture";
import { fetchJson } from "./helpers/admin/api-fetch";

const BASE =
  process.env.MAKESTAR_BASE_URL || "https://stage-new-admin.makeuni2026.com";

const ORDER_SEARCH_API = (userOrderNumber: string) =>
  `${BASE}/api/external/admin/apis/admin/commerce/order/?search=&period_type=all&start_date=&end_date=&user_order_number=${encodeURIComponent(
    userOrderNumber,
  )}&payment_status=&page=1&size=10`;

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
    if (((await el.textContent()) || "").trim() === text) return el;
  }
  return candidates.first();
}

function findColumn(headers: string[], preferred: string): string | null {
  if (headers.includes(preferred)) return preferred;
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const target = norm(preferred);
  for (const h of headers) if (norm(h) === target) return h;
  for (const h of headers) if (norm(h).includes(target)) return h;
  return null;
}

// ===========================================================================
// 1) 키 컬럼 교집합 검증 (API 최신 N건 → Excel 존재)
// ===========================================================================

type KeyMatchTarget = {
  id: string;
  name: string;
  url: string;
  buttonText: string;
  preAction?: "user-b2b-tab";
  listApiPattern: RegExp;
  apiIdGetter: (row: any) => string | number | null;
  excelIdHeader: string;
  sampleSize: number;
};

const KEY_MATCH_TARGETS: KeyMatchTarget[] = [
  {
    id: "CAT-KEY-01",
    name: "대분류: API 최신 10건 ID가 엑셀에 존재",
    url: `${BASE}/product/new/list`,
    buttonText: "엑셀다운받기",
    listApiPattern: /\/admin\/commerce\/product\/\?/,
    apiIdGetter: (r) => r?.id ?? null,
    excelIdHeader: "ID",
    sampleSize: 10,
  },
  {
    id: "USR-KEY-B2C",
    name: "회원 B2C: API 최신 10건 회원ID가 엑셀에 존재",
    url: `${BASE}/user/list`,
    buttonText: "엑셀다운받기",
    listApiPattern: /\/admin\/user\/list_new_commerce_user\/\?/,
    apiIdGetter: (r) => r?.id ?? r?.user_id ?? null,
    excelIdHeader: "ID",
    sampleSize: 10,
  },
];

test.describe("Admin 엑셀 키 컬럼 교집합 (API → Excel)", () => {
  for (const t of KEY_MATCH_TARGETS) {
    test(`${t.id}: ${t.name}`, async ({ page }) => {
      const capture = captureApi(page, t.listApiPattern);

      resetAuthCache();
      await setupAuthCookies(page);
      await page.goto(t.url, { waitUntil: "domcontentloaded" });
      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => {});
      await page.waitForTimeout(5000);

      if (t.preAction === "user-b2b-tab") {
        const tab = page.locator('div:text-is("B2B 회원 관리")').first();
        await tab.waitFor({ state: "visible", timeout: 10000 });
        await tab.click();
        await page.waitForTimeout(3000);
      }
      await page.waitForTimeout(2000);

      const apiResponses = capture.matched();
      expect(apiResponses.length, "API 응답 캡처 실패").toBeGreaterThan(0);
      const lastApi = apiResponses[apiResponses.length - 1];
      const { rows: apiRows } = extractRows(lastApi.body);
      expect(apiRows.length, "API row 없음").toBeGreaterThan(0);

      const apiIds = apiRows
        .slice(0, t.sampleSize)
        .map(t.apiIdGetter)
        .filter((v) => v !== null && v !== undefined && v !== "")
        .map((v) => String(v));
      expect(apiIds.length, "API ID 추출 실패").toBeGreaterThan(0);

      const button = await findButton(page, t.buttonText, true);
      await expect(button).toBeVisible({ timeout: 20000 });
      const dl = await clickAndDownloadExcel(page, button, {
        timeoutMs: 90_000,
      });
      const parsed = parseExcelOrZip(dl.filePath);
      const sheet = parsed.files[0].sheets[0];

      const col = findColumn(sheet.headers, t.excelIdHeader);
      expect(col, `엑셀에서 "${t.excelIdHeader}" 컬럼 없음`).not.toBeNull();

      const excelIds = new Set(
        sheet.rows.map((r) => String(r[col!] ?? "").trim()).filter((v) => v),
      );
      const missing = apiIds.filter((id) => !excelIds.has(id));

      console.log(
        `[${t.id}] API 최신 ${apiIds.length}건 vs Excel ${excelIds.size}건 unique → 누락 ${missing.length}`,
      );

      expect(
        missing.length,
        `API 최신 ${apiIds.length}건 중 ${missing.length}건이 엑셀에 없음: ${missing.slice(0, 3).join(", ")}`,
      ).toBe(0);

      capture.stop();
    });
  }
});

// ===========================================================================
// 2) 주문 Excel → API 역검증 (유령 데이터 없음)
// ===========================================================================

type OrderVerifyTarget = {
  id: string;
  name: string;
  buttonText: string;
  excelOrderNumberHeader: string;
  zipPrimaryFileMatcher?: RegExp;
  sampleSize: number;
};

const ORDER_VERIFY_TARGETS: OrderVerifyTarget[] = [
  {
    id: "ORD-VERIFY-V2",
    name: "주문 V2 엑셀 → API",
    buttonText: "주문 엑셀 다운로드 V2",
    excelOrderNumberHeader: "주문번호",
    sampleSize: 5,
  },
  {
    id: "ORD-VERIFY-V1",
    name: "주문 V1 엑셀 → API",
    buttonText: "주문 엑셀 다운로드",
    excelOrderNumberHeader: "주문번호",
    sampleSize: 5,
  },
  {
    id: "ORD-VERIFY-BASIC",
    name: "주문 엑셀다운받기 → API",
    buttonText: "엑셀다운받기",
    excelOrderNumberHeader: "주문번호",
    sampleSize: 5,
  },
  {
    id: "ORD-VERIFY-SKU",
    name: "주문-SKU ZIP 엑셀 → API",
    buttonText: "주문-SKU 엑셀 다운로드",
    excelOrderNumberHeader: "주문번호",
    zipPrimaryFileMatcher: /\.xlsx$/i,
    sampleSize: 5,
  },
];

test.describe("Admin 주문 엑셀 → API 역검증", () => {
  for (const t of ORDER_VERIFY_TARGETS) {
    test(`${t.id}: ${t.name}`, async ({ page }) => {
      resetAuthCache();
      await setupAuthCookies(page);
      await page.goto(`${BASE}/order/list`, { waitUntil: "domcontentloaded" });
      await page
        .waitForLoadState("networkidle", { timeout: 15000 })
        .catch(() => {});
      await page.waitForTimeout(5000);

      const button = await findButton(page, t.buttonText, true);
      await expect(button).toBeVisible({ timeout: 20000 });
      const dl = await clickAndDownloadExcel(page, button, {
        timeoutMs: 90_000,
      });
      const parsed = parseExcelOrZip(dl.filePath);

      const targetFile = t.zipPrimaryFileMatcher
        ? (parsed.files.find((f) =>
            t.zipPrimaryFileMatcher!.test(f.fileName),
          ) ?? parsed.files[0])
        : parsed.files[0];
      const sheet = targetFile.sheets[0];

      const col = findColumn(sheet.headers, t.excelOrderNumberHeader);
      expect(
        col,
        `엑셀에서 "${t.excelOrderNumberHeader}" 컬럼 없음`,
      ).not.toBeNull();

      // 주문번호는 [A-Z]-XXX 포맷. 숫자 전용(송장번호 등) 값은 제외.
      const ORDER_NUMBER_PATTERN = /^[A-Z]-[A-Z0-9]+$/i;
      const allOrderNumbers = Array.from(
        new Set(
          sheet.rows
            .map((r) => String(r[col!] ?? "").trim())
            .filter((v) => v && ORDER_NUMBER_PATTERN.test(v)),
        ),
      );
      expect(
        allOrderNumbers.length,
        "엑셀에서 주문번호 추출 실패",
      ).toBeGreaterThan(0);

      const samples = allOrderNumbers.slice(0, t.sampleSize);
      const notFound: string[] = [];
      const apiErrors: Array<{ orderNo: string; status: number }> = [];

      for (const orderNo of samples) {
        const { status, body } = await fetchJson(
          page,
          ORDER_SEARCH_API(orderNo),
        );
        if (status !== 200) {
          apiErrors.push({ orderNo, status });
          continue;
        }
        const { rows } = extractRows(body);
        const found = rows.some(
          (r: any) => String(r?.user_order_number ?? "") === orderNo,
        );
        if (!found) notFound.push(orderNo);
      }

      console.log(
        `[${t.id}] 파일="${targetFile.fileName}" 고유주문=${allOrderNumbers.length}건 검증=${samples.length}건 → 존재 ${samples.length - notFound.length - apiErrors.length} / 누락 ${notFound.length} / 오류 ${apiErrors.length}`,
      );

      expect(apiErrors.length, `API 오류: ${JSON.stringify(apiErrors)}`).toBe(
        0,
      );
      expect(
        notFound.length,
        `엑셀 주문번호 중 ${notFound.length}건 API에 없음 (유령 데이터 가능성): ${notFound.join(", ")}`,
      ).toBe(0);
    });
  }
});

// ===========================================================================
// 3) 필터 조합 검증
// ===========================================================================

test.describe("Admin 엑셀 필터 조합", () => {
  test("ORD-FILTER-01: 주문 상태='결제완료' 필터 → 엑셀에 이전 단계 상태 없음", async ({
    page,
  }) => {
    const orderPage = await initPageWithRecovery(
      OrderListPage,
      page,
      "주문관리",
    );

    const options = await orderPage.getStatusOptionsByKey("orderStatus");
    expect(options.length, "주문상태 옵션 없음").toBeGreaterThan(0);
    const preferred = options.find((o) => o.includes("결제완료")) ?? options[0];
    console.log(`[ORD-FILTER-01] 선택 옵션: "${preferred}"`);

    await orderPage.selectStatusOptionByValue("orderStatus", preferred);
    await orderPage.clickSearchAndWait();
    await page.waitForTimeout(2000);

    const btn = await findButton(page, "주문 엑셀 다운로드 V2", true);
    await expect(btn).toBeVisible({ timeout: 20000 });
    const dl = await clickAndDownloadExcel(page, btn, { timeoutMs: 90_000 });
    const parsed = parseExcelOrZip(dl.filePath);
    const sheet = parsed.files[0].sheets[0];

    const statusCol =
      sheet.headers.find((h) => h.replace(/\s+/g, "") === "주문상태") ??
      sheet.headers.find((h) => h.includes("주문")) ??
      null;
    expect(statusCol, `엑셀에서 주문상태 컬럼 없음`).not.toBeNull();

    const values = sheet.rows.map((r) => String(r[statusCol!] ?? "").trim());
    const unique = Array.from(new Set(values));
    const matched = values.filter((v) => v === preferred).length;

    console.log(
      `[ORD-FILTER-01] rows=${sheet.rowCount} / "${preferred}" 매칭=${matched} / unique=${unique.length} (${unique.slice(0, 5).join(", ")})`,
    );

    // ⚠️ 주문상태 필터는 "단계적 포함" 동작 (결제완료 선택 시 이후 단계도 포함).
    // 약한 검증: 선택한 상태가 포함되어야 하고, 이전 단계 상태는 없어야.
    expect(
      unique,
      `필터="${preferred}" 가 엑셀에 전혀 포함되지 않음`,
    ).toContain(preferred);

    const EARLIER_STATES = [
      "결제취소",
      "결제 대기",
      "결제대기",
      "주문취소",
      "주문 취소",
    ];
    const earlierInExcel = unique.filter((u) => EARLIER_STATES.includes(u));
    expect(
      earlierInExcel,
      `필터="${preferred}" 이전 단계 상태가 엑셀에 포함됨: ${earlierInExcel.join(", ")}`,
    ).toEqual([]);
  });

  test("ORD-FILTER-02: 주문번호 검색 → 해당 주문번호만 엑셀에 포함", async ({
    page,
  }) => {
    const orderPage = await initPageWithRecovery(
      OrderListPage,
      page,
      "주문관리",
    );

    // 실 주문번호 확보
    const sampleBtn = await findButton(page, "주문 엑셀 다운로드 V2", true);
    const preDl = await clickAndDownloadExcel(page, sampleBtn, {
      timeoutMs: 90_000,
    });
    const preParsed = parseExcelOrZip(preDl.filePath);
    const preSheet = preParsed.files[0].sheets[0];
    const orderCol = preSheet.headers.find(
      (h) => h.replace(/\s+/g, "") === "주문번호",
    )!;
    const targetOrderNo = String(preSheet.rows[0][orderCol] ?? "").trim();
    console.log(`[ORD-FILTER-02] 타겟 주문번호: ${targetOrderNo}`);

    await orderPage.resetFiltersAndWait();
    await orderPage.searchByKeyword(targetOrderNo);
    await page.waitForTimeout(2000);

    const btn = await findButton(page, "주문 엑셀 다운로드 V2", true);
    const dl = await clickAndDownloadExcel(page, btn, { timeoutMs: 90_000 });
    const parsed = parseExcelOrZip(dl.filePath);
    const sheet = parsed.files[0].sheets[0];

    const values = sheet.rows.map((r) => String(r[orderCol] ?? "").trim());
    const unique = Array.from(new Set(values));

    console.log(
      `[ORD-FILTER-02] rows=${sheet.rowCount} unique=${unique.length} (${unique.slice(0, 3).join(", ")})`,
    );

    expect(
      unique,
      `검색="${targetOrderNo}" 지만 엑셀에 다른 주문번호도 포함됨`,
    ).toEqual([targetOrderNo]);
  });
});
