/**
 * POCAAlbum Admin 메뉴 탐색 테스트 (일회성)
 *
 * 9개 사이드바 메뉴의 URL, 서브메뉴, 테이블 구조, 생성 폼 필드를 자동 수집합니다.
 * 결과는 JSON 리포트로 저장됩니다.
 *
 * 실행: npx playwright test admin_pocaalbum_explore_menus --headed --project=admin-explore
 *
 * @note 이 스크립트는 CRUD 테스트 확장을 위한 사전 탐색용입니다.
 *       탐색 완료 후 삭제합니다.
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { PocaDashboardPage, POCA_SIDEBAR_MENUS } from "./pages";
import type { PocaSidebarMenu } from "./pages";
import {
  setupAuthCookies,
  setupApiInterceptor,
  resetAuthCache,
} from "./helpers/admin";
import {
  isTokenValidSync,
  getTokenRemaining,
  waitForPageStable,
  ELEMENT_TIMEOUT,
} from "./helpers/admin/test-helpers";

// ============================================================================
// 타입 정의
// ============================================================================

type MenuExploreResult = {
  menuName: string;
  mainUrl: string;
  subMenus: SubMenuInfo[];
  tableInfo: TableInfo | null;
  createInfo: CreateInfo | null;
  error: string | null;
};

type SubMenuInfo = {
  text: string;
  url: string;
  hasTable: boolean;
  hasCreateButton: boolean;
};

type TableInfo = {
  headers: string[];
  rowCount: number;
  hasSearchField: boolean;
  hasPagination: boolean;
  searchFieldPlaceholders: string[];
  buttonTexts: string[];
};

type CreateInfo = {
  url: string;
  formFields: FormFieldInfo[];
  buttonTexts: string[];
};

type FormFieldInfo = {
  tag: string;
  type: string;
  placeholder: string;
  name: string;
  id: string;
  label: string;
};

// ============================================================================
// 헬퍼 함수
// ============================================================================

/** 현재 페이지의 테이블 구조 수집 */
async function captureTableInfo(
  page: import("@playwright/test").Page,
): Promise<TableInfo | null> {
  const table = page.locator("table").first();
  const isTableVisible = await table
    .isVisible({ timeout: 5000 })
    .catch(() => false);

  if (!isTableVisible) return null;

  // 헤더 수집
  const headers = await page
    .locator("table thead th")
    .evaluateAll((ths) =>
      ths.map((th) => (th.textContent || "").trim()).filter(Boolean),
    );

  // 행 수
  const rowCount = await page.locator("table tbody tr").count();

  // 검색 필드
  const searchInputs = page.locator(
    'input[placeholder*="검색"], input[placeholder*="키워드"], input[placeholder*="입력"]',
  );
  const hasSearchField = (await searchInputs.count().catch(() => 0)) > 0;
  const searchFieldPlaceholders: string[] = [];
  const searchCount = await searchInputs.count();
  for (let i = 0; i < searchCount; i++) {
    const ph = (await searchInputs.nth(i).getAttribute("placeholder")) || "";
    if (ph) searchFieldPlaceholders.push(ph);
  }

  // 페이지네이션
  const hasPagination = await page
    .locator('nav[aria-label="Pagination"]')
    .isVisible()
    .catch(() => false);

  // 버튼 텍스트 수집
  const buttonTexts = await page
    .locator('button:visible, a.btn:visible, a[class*="button"]:visible')
    .evaluateAll((btns) =>
      btns
        .map((btn) => (btn.textContent || "").trim())
        .filter((t) => t.length > 0 && t.length < 20),
    );

  return {
    headers,
    rowCount,
    hasSearchField,
    hasPagination,
    searchFieldPlaceholders,
    buttonTexts: [...new Set(buttonTexts)],
  };
}

/** 현재 페이지의 폼 필드 수집 */
async function captureFormFields(
  page: import("@playwright/test").Page,
): Promise<FormFieldInfo[]> {
  const fields: FormFieldInfo[] = [];

  // input 필드
  const inputs = page.locator(
    'input:visible:not([type="hidden"]):not([type="checkbox"]):not([type="radio"])',
  );
  const inputCount = await inputs.count();
  for (let i = 0; i < inputCount; i++) {
    const input = inputs.nth(i);
    const type = (await input.getAttribute("type")) || "text";
    const placeholder = (await input.getAttribute("placeholder")) || "";
    const name = (await input.getAttribute("name")) || "";
    const id = (await input.getAttribute("id")) || "";

    // 라벨 찾기
    let label = "";
    if (id) {
      const labelEl = page.locator(`label[for="${id}"]`);
      label = (await labelEl.textContent().catch(() => "")) || "";
    }
    if (!label) {
      // 인접 라벨 탐색
      const parentLabel = input.locator("xpath=ancestor::label");
      label =
        (await parentLabel
          .first()
          .textContent()
          .catch(() => "")) || "";
    }

    fields.push({
      tag: "input",
      type,
      placeholder,
      name,
      id,
      label: label.trim(),
    });
  }

  // select 필드
  const selects = page.locator("select:visible");
  const selectCount = await selects.count();
  for (let i = 0; i < selectCount; i++) {
    const sel = selects.nth(i);
    fields.push({
      tag: "select",
      type: "select",
      placeholder: "",
      name: (await sel.getAttribute("name")) || "",
      id: (await sel.getAttribute("id")) || "",
      label: "",
    });
  }

  // textarea 필드
  const textareas = page.locator("textarea:visible");
  const textareaCount = await textareas.count();
  for (let i = 0; i < textareaCount; i++) {
    const ta = textareas.nth(i);
    fields.push({
      tag: "textarea",
      type: "textarea",
      placeholder: (await ta.getAttribute("placeholder")) || "",
      name: (await ta.getAttribute("name")) || "",
      id: (await ta.getAttribute("id")) || "",
      label: "",
    });
  }

  // combobox (커스텀 드롭다운)
  const comboboxes = page.locator('[role="combobox"]:visible');
  const comboboxCount = await comboboxes.count();
  for (let i = 0; i < comboboxCount; i++) {
    fields.push({
      tag: "combobox",
      type: "combobox",
      placeholder: "",
      name: "",
      id: "",
      label: "",
    });
  }

  // file input (hidden이어도 수집)
  const fileInputs = page.locator('input[type="file"]');
  const fileCount = await fileInputs.count();
  for (let i = 0; i < fileCount; i++) {
    fields.push({
      tag: "input",
      type: "file",
      placeholder: "",
      name: (await fileInputs.nth(i).getAttribute("name")) || "",
      id: (await fileInputs.nth(i).getAttribute("id")) || "",
      label: "",
    });
  }

  return fields;
}

// ============================================================================
// 테스트
// ============================================================================

const tokenValid = isTokenValidSync();

test.describe("POCAAlbum 메뉴 탐색", () => {
  let pocaPage: PocaDashboardPage;
  const results: MenuExploreResult[] = [];

  test.beforeAll(() => {
    resetAuthCache();
    const remaining = getTokenRemaining();
    console.log(
      `\n🔑 토큰 남은 시간: ${remaining.hours}시간 ${remaining.minutes}분`,
    );
  });

  test.beforeEach(async ({ page, viewport }) => {
    expect(
      viewport === null || viewport.width >= 1024,
      "데스크톱 뷰포트 필요",
    ).toBeTruthy();
    expect(tokenValid, "토큰이 만료되었습니다").toBe(true);

    await setupAuthCookies(page);
    await setupApiInterceptor(page);
    pocaPage = new PocaDashboardPage(page);
  });

  // 각 사이드바 메뉴를 개별 테스트로 탐색
  for (const menuName of POCA_SIDEBAR_MENUS) {
    test(`EXPLORE: ${menuName} 메뉴 구조 탐색`, async ({ page }) => {
      const result: MenuExploreResult = {
        menuName,
        mainUrl: "",
        subMenus: [],
        tableInfo: null,
        createInfo: null,
        error: null,
      };

      try {
        // 1. 앨범 목록 페이지로 시작 (사이드바 확실히 로드되는 페이지)
        await page.goto(
          "https://stage-new-admin.makeuni2026.com/pocaalbum/album/list",
          { waitUntil: "domcontentloaded", timeout: 30000 },
        );
        await waitForPageStable(page);

        // 2. 사이드바 로드 확인
        const sidebarLoaded = await pocaPage.ensureSidebarLoaded();
        if (!sidebarLoaded) {
          result.error = "사이드바 메뉴 로드 실패";
          results.push(result);
          console.log(`❌ ${menuName}: 사이드바 로드 실패`);
          return;
        }

        // 3. 메뉴 클릭
        await pocaPage.clickSidebarMenu(menuName as PocaSidebarMenu);
        await page.waitForLoadState("domcontentloaded").catch(() => {});
        await waitForPageStable(page);

        result.mainUrl = page.url();
        console.log(`\n📍 ${menuName} → ${result.mainUrl}`);

        // 4. 서브메뉴 탐색 (사이드바에서 하위 메뉴가 펼쳐졌는지 확인)
        const subMenuItems = page.locator(
          `.fixed.min-h-screen li.ml-4 span, .fixed.min-h-screen li ul li span, .fixed.min-h-screen [class*="sub"] span`,
        );
        const subMenuCount = await subMenuItems.count().catch(() => 0);

        if (subMenuCount > 0) {
          console.log(`  📂 서브메뉴 ${subMenuCount}개 발견`);
          for (let i = 0; i < Math.min(subMenuCount, 10); i++) {
            const subText =
              (await subMenuItems.nth(i).textContent())?.trim() || "";
            if (!subText) continue;

            try {
              await subMenuItems.nth(i).click();
              await page.waitForLoadState("domcontentloaded").catch(() => {});
              await waitForPageStable(page, 10000);

              const subUrl = page.url();
              const hasTable = await page
                .locator("table")
                .first()
                .isVisible({ timeout: 3000 })
                .catch(() => false);
              const hasCreateButton = await page
                .locator(
                  'button:has-text("등록"), button:has-text("생성"), button:has-text("추가"), a:has-text("등록"), a:has-text("생성")',
                )
                .first()
                .isVisible({ timeout: 2000 })
                .catch(() => false);

              result.subMenus.push({
                text: subText,
                url: subUrl,
                hasTable,
                hasCreateButton,
              });

              console.log(
                `    └ ${subText}: ${subUrl} (테이블: ${hasTable}, 생성버튼: ${hasCreateButton})`,
              );
            } catch (e: unknown) {
              const msg = e instanceof Error ? e.message : String(e);
              console.log(`    └ ${subText}: 클릭 실패 - ${msg}`);
            }
          }
        }

        // 5. 현재 페이지 테이블 구조 수집
        result.tableInfo = await captureTableInfo(page);
        if (result.tableInfo) {
          console.log(
            `  📊 테이블 헤더: [${result.tableInfo.headers.join(", ")}]`,
          );
          console.log(`  📊 행 수: ${result.tableInfo.rowCount}`);
          console.log(
            `  📊 검색: ${result.tableInfo.hasSearchField}, 페이지네이션: ${result.tableInfo.hasPagination}`,
          );
          console.log(
            `  📊 버튼: [${result.tableInfo.buttonTexts.join(", ")}]`,
          );
        }

        // 6. 생성 버튼 존재 시 → 생성 페이지 탐색
        const createBtn = page
          .locator(
            'button:has-text("등록"), button:has-text("생성"), button:has-text("추가"), a:has-text("등록"), a:has-text("생성"), a:has-text("추가")',
          )
          .first();
        const hasCreateBtn = await createBtn
          .isVisible({ timeout: 3000 })
          .catch(() => false);

        if (hasCreateBtn) {
          const createBtnText = (await createBtn.textContent())?.trim() || "";
          console.log(`  🆕 생성 버튼 발견: "${createBtnText}"`);

          try {
            const currentUrl = page.url();
            await createBtn.click();
            await page
              .waitForURL((url) => url.toString() !== currentUrl, {
                timeout: 10000,
              })
              .catch(() => {});
            await waitForPageStable(page, 10000);

            const createUrl = page.url();
            const formFields = await captureFormFields(page);
            const createButtons = await page
              .locator("button:visible")
              .evaluateAll((btns) =>
                btns
                  .map((b) => (b.textContent || "").trim())
                  .filter((t) => t.length > 0 && t.length < 20),
              );

            result.createInfo = {
              url: createUrl,
              formFields,
              buttonTexts: [...new Set(createButtons)],
            };

            console.log(`  🆕 생성 페이지: ${createUrl}`);
            console.log(`  🆕 폼 필드 ${formFields.length}개:`);
            for (const f of formFields) {
              console.log(
                `    - ${f.tag}[${f.type}] placeholder="${f.placeholder}" name="${f.name}" label="${f.label}"`,
              );
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            console.log(`  ⚠️ 생성 페이지 탐색 실패: ${msg}`);
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        result.error = msg;
        console.log(`❌ ${menuName}: ${msg}`);
      }

      results.push(result);
    });
  }

  // 결과 저장
  test.afterAll(() => {
    if (results.length === 0) {
      console.log("⚠️ 탐색 결과가 없습니다.");
      return;
    }

    const reportPath = path.join(__dirname, "..", "explore-menus-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), "utf-8");
    console.log(`\n📄 탐색 결과 저장: ${reportPath}`);

    // 요약 출력
    console.log("\n========== 탐색 요약 ==========");
    for (const r of results) {
      const crudFlags = [
        r.createInfo ? "C" : "-",
        r.tableInfo ? "R" : "-",
        "-", // Update는 상세 페이지 진입 후 확인 필요
        "-", // Delete는 상세 페이지 진입 후 확인 필요
      ].join("");

      console.log(
        `${r.menuName.padEnd(10)} | URL: ${r.mainUrl || "N/A"} | CRUD: ${crudFlags} | 서브메뉴: ${r.subMenus.length}개`,
      );
    }
    console.log("================================");
  });
});
