/**
 * Admin 주문관리 메뉴 테스트 (Page Object Model 적용)
 *
 * 대상:
 * - 주문/배송 > 주문관리
 * - URL: /order/list
 *
 * 검증 범위:
 * - 전체/B2C주문/B2B주문/프로젝트별 주문 탭 동작
 * - 주문상태/결제상태/배송상태/재고할당 조합 검색 결과 정합성
 * - 검색 초기화 및 무효 키워드 검색
 */

import { test, expect } from "@playwright/test";
import {
  OrderListPage,
  PurchaseListPage,
  ChartInfoListPage,
  type OrderStatusKey,
  type OrderTabKey,
  type PurchaseTabKey,
} from "./pages";
import { initPageWithRecovery } from "./helpers/admin";
import {
  ELEMENT_TIMEOUT,
  applyAdminTestConfig,
} from "./helpers/admin/test-helpers";

// ============================================================================
// 테스트 설정
// ============================================================================
applyAdminTestConfig("주문관리");

// ##############################################################################
// 주문관리 목록
// ##############################################################################
test.describe.serial("주문관리 목록 @feature:admin_makestar.order.list", () => {
  let orderPage: OrderListPage;

  test.beforeEach(async ({ page }) => {
    orderPage = await initPageWithRecovery(OrderListPage, page, "주문관리");
  });

  test("ORD-PAGE-01: 페이지 기본 요소 및 탭 노출 검증", async () => {
    await orderPage.assertPageTitle();
    await orderPage.assertHeading();
    await expect(orderPage.breadcrumb).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });
    await orderPage.assertTabsVisible();
  });

  test("ORD-TAB-01: 전체/B2C/B2B/프로젝트별 주문 탭 전환 검증", async () => {
    await orderPage.switchTab("all");
    const allCount = await orderPage.getRowCount();

    await orderPage.switchTab("b2c");
    const b2cCount = await orderPage.getRowCount();

    await orderPage.switchTab("b2b");
    const b2bCount = await orderPage.getRowCount();

    await orderPage.switchTab("project");
    const hasSummary = await orderPage.resultSummary
      .isVisible({ timeout: ELEMENT_TIMEOUT })
      .catch(() => false);
    const hasNoResult = await orderPage.noResultMessage
      .isVisible({ timeout: ELEMENT_TIMEOUT })
      .catch(() => false);
    expect(
      hasSummary || hasNoResult,
      "프로젝트별 주문 탭에서 목록 영역이 보이지 않습니다.",
    ).toBeTruthy();

    const hasDataInAnyTab = [allCount, b2cCount, b2bCount].some(
      (count) => count > 0,
    );
    expect(
      hasDataInAnyTab,
      "전체/B2C/B2B 탭 모두 데이터가 없습니다.",
    ).toBeTruthy();
  });

  test("ORD-SEARCH-01: 상태 조합 검색(주문/결제/배송/재고할당) 정합성 검증", async () => {
    const candidateTabs: OrderTabKey[] = ["all", "b2c", "b2b"];
    const errors: string[] = [];
    let verified = false;

    for (const tab of candidateTabs) {
      await orderPage.switchTab(tab);
      try {
        const appliedSnapshot =
          await orderPage.applyFirstAvailableCombinedStatusFilters();
        await orderPage.clickSearchAndWait();

        const isNoResult = await orderPage.hasNoResultOrEmptyTable();
        if (isNoResult) {
          const hasNoResultBanner = await orderPage.noResultMessage
            .isVisible({ timeout: ELEMENT_TIMEOUT })
            .catch(() => false);
          const hasZeroSummary = await orderPage.hasZeroSummaryCount();
          expect(
            hasNoResultBanner || hasZeroSummary,
            `${tab} 탭 조합 검색 결과 0건이지만 no-result 문구/요약(전체 0건)이 확인되지 않습니다.`,
          ).toBeTruthy();
          verified = true;
          break;
        }

        await orderPage.assertRowsMatchStatus(appliedSnapshot, 10);
        verified = true;
        break;
      } catch (error: unknown) {
        errors.push(
          `${tab}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    expect(
      verified,
      `상태 조합 검색 검증을 수행할 수 있는 탭이 없습니다.\n${errors.join("\n")}`,
    ).toBeTruthy();
  });

  test("ORD-SEARCH-02: 검색 초기화 후 동일 조건 재검색 시 재실행 가능성 검증", async () => {
    await orderPage.switchTab("all");
    const initialCount = await orderPage.getRowCount();
    expect(initialCount, "초기 주문 목록이 비어 있습니다.").toBeGreaterThan(0);

    await orderPage.clickSearchAndWait();
    await orderPage.waitForTableOrNoResult();
    const firstSearchCount = await orderPage.getRowCount();
    expect(firstSearchCount, "첫 조회 결과가 비어 있습니다.").toBeGreaterThan(
      0,
    );

    await orderPage.resetFiltersAndWait();
    const resetCount = await orderPage.getRowCount();
    expect(
      resetCount,
      "검색 초기화 이후 목록이 비어 있습니다.",
    ).toBeGreaterThan(0);

    await orderPage.clickSearchAndWait();
    await orderPage.waitForTableOrNoResult();
    const rerunCount = await orderPage.getRowCount();
    expect(
      rerunCount,
      "검색 초기화 후 재조회 결과가 비어 있습니다.",
    ).toBeGreaterThan(0);
  });

  test("ORD-SEARCH-03: 존재하지 않는 주문번호 검색 시 결과 없음 검증", async () => {
    await orderPage.switchTab("all");

    const impossibleKeyword = `AUTO-NOT-FOUND-${Date.now()}`;
    await orderPage.searchByKeyword(impossibleKeyword);

    const noResult = await orderPage.hasNoResultOrEmptyTable();
    expect(
      noResult,
      "존재하지 않는 주문번호 검색에서 결과 없음 상태가 확인되지 않았습니다.",
    ).toBeTruthy();

    await orderPage.resetFiltersAndWait();
  });

  // ==========================================================================
  // CT-65 회귀: 상품코드/상품명 검색 (Jira CT-65)
  // ==========================================================================

  test("ORD-SEARCH-10: 상품코드 검색 시 에러 없이 완료 확인", async () => {
    await orderPage.switchTab("all");
    await orderPage.resetFiltersAndWait();
    await orderPage.searchByProductCode("S634NCTDREAM22");

    const hasSummary = await orderPage.resultSummary
      .isVisible({ timeout: ELEMENT_TIMEOUT })
      .catch(() => false);
    const hasNoResult = await orderPage.hasNoResultOrEmptyTable();

    expect(
      hasSummary || hasNoResult,
      "상품코드 검색이 정상적으로 완료되어야 합니다 (결과 영역 또는 결과 없음)",
    ).toBeTruthy();
  });

  test("ORD-SEARCH-11: 상품명 검색 시 에러 없이 완료 확인", async () => {
    await orderPage.switchTab("all");
    await orderPage.resetFiltersAndWait();
    await orderPage.searchByProductName("NCT");

    const hasSummary = await orderPage.resultSummary
      .isVisible({ timeout: ELEMENT_TIMEOUT })
      .catch(() => false);
    const hasNoResult = await orderPage.hasNoResultOrEmptyTable();

    expect(
      hasSummary || hasNoResult,
      "상품명 검색이 정상적으로 완료되어야 합니다",
    ).toBeTruthy();
  });

  test("ORD-SEARCH-12: 상품코드 검색 후 초기화 시 전체 목록 복원 확인", async () => {
    await orderPage.switchTab("all");
    const initialCount = await orderPage.getRowCount();

    await orderPage.searchByProductCode("S634NCTDREAM22");
    await orderPage.resetFiltersAndWait();

    const resetCount = await orderPage.getRowCount();
    expect(
      resetCount,
      "상품코드 검색 초기화 후 목록이 복원되어야 합니다",
    ).toBeGreaterThanOrEqual(initialCount);
  });

  test("ORD-SEARCH-13: 존재하지 않는 상품코드 검색 시 빈 결과 확인", async () => {
    await orderPage.switchTab("all");
    await orderPage.searchByProductCode("NONEXISTENT_CODE_99999");

    const noResult = await orderPage.hasNoResultOrEmptyTable();
    expect(
      noResult,
      "존재하지 않는 상품코드 검색에서 빈 결과가 확인되어야 합니다",
    ).toBeTruthy();

    await orderPage.resetFiltersAndWait();
  });

  test("ORD-FLT-01: 단일 상태 필터 검색 정합성 검증", async () => {
    await orderPage.switchTab("all");

    const statusKeys: OrderStatusKey[] = [
      "orderStatus",
      "paymentStatus",
      "deliveryStatus",
      "stockAllocationStatus",
    ];
    const validatedKeys: string[] = [];
    const unavailableKeys: string[] = [];

    for (const key of statusKeys) {
      await orderPage.resetFiltersAndWait();
      const options = await orderPage.getStatusOptionsByKey(key);
      if (options.length === 0) {
        unavailableKeys.push(key);
        continue;
      }

      const selected = await orderPage.selectFirstStatusOption(key);
      await orderPage.clickSearchAndWait();

      const metrics = await orderPage.getResultMetrics();
      if (metrics.noResultState) {
        expect(
          metrics.hasNoResultMessage || metrics.hasZeroSummary,
          `${key} 단일 필터 0건 결과 표기가 없습니다.`,
        ).toBeTruthy();
      } else {
        const partial: Partial<Record<OrderStatusKey, string>> = {
          [key]: selected,
        };
        await orderPage.assertRowsMatchPartialStatus(partial, 10);
      }

      validatedKeys.push(key);
    }

    expect(
      validatedKeys.length,
      `검증 가능한 단일 상태 필터가 없습니다. 누락: ${unavailableKeys.join(", ") || "none"}`,
    ).toBeGreaterThan(0);
  });

  test("ORD-FLT-02: 상태 2개 조합(Pairwise) 검색 정합성 검증", async () => {
    await orderPage.switchTab("all");

    const pairs: Array<[OrderStatusKey, OrderStatusKey]> = [
      ["orderStatus", "paymentStatus"],
      ["orderStatus", "deliveryStatus"],
      ["paymentStatus", "deliveryStatus"],
      ["deliveryStatus", "stockAllocationStatus"],
    ];

    let validatedPairs = 0;
    const skippedPairs: string[] = [];
    const failedPairs: string[] = [];

    for (const [leftKey, rightKey] of pairs) {
      try {
        await orderPage.resetFiltersAndWait();

        const leftOptions = await orderPage.getStatusOptionsByKey(leftKey);
        const rightOptions = await orderPage.getStatusOptionsByKey(rightKey);

        if (leftOptions.length === 0 || rightOptions.length === 0) {
          skippedPairs.push(`${leftKey}+${rightKey}`);
          continue;
        }

        const leftSelected = await orderPage.selectFirstStatusOption(leftKey);
        const rightSelected = await orderPage.selectFirstStatusOption(rightKey);
        await orderPage.clickSearchAndWait();

        const metrics = await orderPage.getResultMetrics();
        if (metrics.noResultState) {
          expect(
            metrics.hasNoResultMessage || metrics.hasZeroSummary,
            `${leftKey}+${rightKey} pairwise 0건 결과 표기가 없습니다.`,
          ).toBeTruthy();
        } else {
          const partial: Partial<Record<OrderStatusKey, string>> = {
            [leftKey]: leftSelected,
            [rightKey]: rightSelected,
          };
          await orderPage.assertRowsMatchPartialStatus(partial, 10);
        }

        validatedPairs += 1;
      } catch (error: unknown) {
        failedPairs.push(
          `${leftKey}+${rightKey}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    expect(
      validatedPairs,
      `검증 가능한 pairwise 조합이 없습니다. 누락: ${skippedPairs.join(", ") || "none"}\n실패: ${failedPairs.join("\n") || "none"}`,
    ).toBeGreaterThan(0);
  });

  test("ORD-FLT-03: 탭 전환 시 주문상태 필터 격리 검증", async () => {
    await orderPage.switchTab("all");
    await orderPage.resetFiltersAndWait();

    const baseOptions = await orderPage.getStatusOptionsByKey("orderStatus");
    expect(
      baseOptions.length,
      "ALL 탭 주문상태 옵션이 없습니다.",
    ).toBeGreaterThan(0);

    const allSelected = await orderPage.selectFirstStatusOption("orderStatus");
    await orderPage.clickSearchAndWait();

    const secondaryTabs: OrderTabKey[] = ["b2c", "b2b"];
    let isolationValidated = false;

    for (const tab of secondaryTabs) {
      await orderPage.switchTab(tab);
      await orderPage.resetFiltersAndWait();

      const secondaryOptions =
        await orderPage.getStatusOptionsByKey("orderStatus");
      if (secondaryOptions.length === 0) {
        continue;
      }

      const secondaryDifferent = await orderPage.getDifferentStatusOption(
        "orderStatus",
        allSelected,
      );
      if (!secondaryDifferent) {
        continue;
      }

      await orderPage.selectStatusOptionByValue(
        "orderStatus",
        secondaryDifferent,
      );
      await orderPage.clickSearchAndWait();

      await orderPage.switchTab("all");
      const restored =
        await orderPage.getCurrentStatusValueByKey("orderStatus");
      const isRestoredByIsolationPolicy =
        restored === "" || restored === allSelected;
      expect(
        isRestoredByIsolationPolicy,
        `${tab} 탭 전환 후 ALL 탭 주문상태 값이 정책(유지/초기화)과 다릅니다. restored=${restored}, before=${allSelected}`,
      ).toBeTruthy();
      expect(restored).not.toBe(secondaryDifferent);
      isolationValidated = true;
      break;
    }

    expect(
      isolationValidated,
      "탭 격리 검증을 수행할 수 있는 보조 탭/옵션을 찾지 못했습니다.",
    ).toBeTruthy();
  });

  test("ORD-DATA-01: 검색 결과 요약 카운트와 목록 데이터 일관성 검증", async () => {
    await orderPage.switchTab("all");
    await orderPage.resetFiltersAndWait();
    await orderPage.clickSearchAndWait();

    const metrics = await orderPage.getResultMetrics();
    const pageLimit = await orderPage.getPerPageLimit(10);

    if (metrics.noResultState) {
      expect(
        metrics.rowCount,
        "no-result 상태인데 행 데이터가 존재합니다.",
      ).toBe(0);
      expect(
        metrics.hasNoResultMessage || metrics.hasZeroSummary,
        "no-result 상태 표시(메시지/전체 0건)가 없습니다.",
      ).toBeTruthy();
      return;
    }

    expect(
      metrics.summaryCount,
      "결과 요약 카운트를 찾지 못했습니다.",
    ).not.toBeNull();
    if (metrics.summaryCount !== null) {
      expect(metrics.summaryCount).toBeGreaterThanOrEqual(metrics.rowCount);
    }
    expect(metrics.rowCount).toBeLessThanOrEqual(pageLimit);
  });

  test("ORD-PAGE-02: 페이징 이동 및 페이지당 표시 개수 검증", async () => {
    await orderPage.switchTab("all");
    await orderPage.resetFiltersAndWait();
    await orderPage.clickSearchAndWait();

    const firstMetrics = await orderPage.getResultMetrics();
    const pageLimit = await orderPage.getPerPageLimit(10);

    if (firstMetrics.noResultState) {
      expect(firstMetrics.rowCount).toBe(0);
      return;
    }

    expect(firstMetrics.rowCount).toBeLessThanOrEqual(pageLimit);

    const canGoNext = await orderPage.canGoToNextPage();
    if (!canGoNext) {
      if (firstMetrics.summaryCount !== null) {
        expect(firstMetrics.summaryCount).toBeLessThanOrEqual(pageLimit);
      }
      return;
    }

    const firstRowBefore = await orderPage.getFirstRowFingerprint();
    const moved = await orderPage.goToNextPageSafely();
    expect(moved, "다음 페이지 이동에 실패했습니다.").toBeTruthy();

    const secondMetrics = await orderPage.getResultMetrics();
    expect(secondMetrics.rowCount).toBeLessThanOrEqual(pageLimit);

    if (firstRowBefore.length > 0 && secondMetrics.rowCount > 0) {
      const firstRowAfter = await orderPage.getFirstRowFingerprint();
      expect(
        firstRowAfter,
        "다음 페이지 첫 번째 행이 비어 있습니다.",
      ).toBeTruthy();
    }

    await orderPage.goToPreviousPageSafely();
  });
});

// ##############################################################################
// B2B 예치금 주문 회귀 검증 (QA-102, QA-100)
// QA-102: 주문상세정보 > 결제정보 > 결제수단 미노출
// QA-100: B2B 예치금 주문 > 결제 상태 미노출
// Jira: https://makestar-product.atlassian.net/browse/QA-102
//       https://makestar-product.atlassian.net/browse/QA-100
// ##############################################################################
test.describe
  .serial("B2B 예치금 주문 회귀 (QA-102, QA-100) @feature:admin_makestar.order.list", () => {
  const TARGET_URL =
    "https://stage-new-admin.makeuni2026.com/order/list?openedTab=b2b";
  let qa102OrderPage: OrderListPage;

  test.beforeEach(async ({ page }) => {
    qa102OrderPage = await initPageWithRecovery(
      OrderListPage,
      page,
      "주문관리(B2B)",
    );
    if (!page.url().includes("openedTab=b2b")) {
      await page.goto(TARGET_URL);
      await qa102OrderPage.waitForTableOrNoResult(20000).catch(() => {});
    }
  });

  test("QA102-PAGE-01: B2B 주문 목록 + 결제수단 필터 노출", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: "조회하기", exact: true }),
      "조회하기 버튼이 노출되어야 합니다",
    ).toBeVisible({ timeout: ELEMENT_TIMEOUT });

    await expect(
      page.getByText("결제수단", { exact: false }).first(),
      "결제수단 필터가 노출되어야 합니다",
    ).toBeVisible({ timeout: ELEMENT_TIMEOUT });
  });

  test("QA102-FLT-01: 결제수단 '예치금' 필터 적용 가능", async ({ page }) => {
    await page.getByText("결제수단", { exact: false }).first().click();
    await page.waitForTimeout(500);
    await page.getByText("예치금", { exact: true }).first().click();
    await page.waitForTimeout(300);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    await page
      .getByRole("button", { name: "조회하기", exact: true })
      .click({ force: true });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(1500);

    const hasSummary = await page
      .getByText("상품 주문내역")
      .first()
      .isVisible({ timeout: ELEMENT_TIMEOUT })
      .catch(() => false);
    const hasNoResult = await page
      .getByText(/검색결과가 없습니다/)
      .first()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    expect(
      hasSummary || hasNoResult,
      "조회 후 '상품 주문내역' 또는 '검색결과 없음'이 노출되어야 합니다",
    ).toBe(true);
  });

  test("QA102-FLT-02: 예치금 필터 결과의 결제수단 정합성 (다른 결제수단 0건)", async ({
    page,
  }) => {
    await expect(page.getByText("예치금", { exact: true }).first()).toBeVisible(
      { timeout: 15000 },
    );
    await page.waitForTimeout(500);

    // 텍스트 클릭으로는 체크박스가 토글되지 않아 input[checkbox] 직접 클릭
    const checked = await page.evaluate(() => {
      const deposits = Array.from(document.querySelectorAll("*")).filter(
        (n) => n.children.length === 0 && n.textContent?.trim() === "예치금",
      );
      for (const n of deposits) {
        let node: Element | null = n.parentElement;
        for (let i = 0; i < 4 && node; i++) {
          const cb = node.querySelector(
            'input[type="checkbox"]',
          ) as HTMLInputElement | null;
          if (cb) {
            cb.click();
            return cb.checked;
          }
          node = node.parentElement;
        }
      }
      return null;
    });
    expect(checked, "예치금 체크박스를 선택할 수 있어야 합니다").toBe(true);

    await page.waitForTimeout(500);
    await page
      .getByRole("button", { name: "조회하기", exact: true })
      .click({ force: true });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(2000);

    const counts = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        예치금: (text.match(/예치금/g) || []).length,
        직접송금: (text.match(/직접송금/g) || []).length,
        신용카드: (text.match(/신용카드|카드결제/g) || []).length,
        무통장: (text.match(/무통장/g) || []).length,
      };
    });

    expect(counts.예치금, "예치금 텍스트가 노출되어야 합니다").toBeGreaterThan(
      0,
    );
    expect(
      counts.직접송금 + counts.신용카드 + counts.무통장,
      `예치금 필터 결과에 다른 결제수단이 포함되어서는 안 됩니다: ${JSON.stringify(counts)}`,
    ).toBe(0);
  });

  test("QA102-DATA-01: 주문상세 팝업의 결제수단 + 결제수단 정보 필드 검증", async () => {
    // 1) 결제수단 = '예치금' 필터를 적용하여 결과 목록을 예치금 주문만으로 좁힌다.
    //    데이터 변동(첫 페이지 예치금 노출 보장 X) 시에도 안정적으로 동작.
    await qa102OrderPage.applyPaymentMethodFilter("예치금");

    // 2) 필터 결과 목록에서 결제수단=예치금 행을 매칭하여 주문상세 팝업을 연다.
    await qa102OrderPage.openOrderDetailByPaymentMethod("예치금");

    const paymentInfo = await qa102OrderPage.getOrderDetailPaymentInfo();

    // QA-102 회귀 방지 의도:
    // 주문상세 팝업의 결제정보 영역에 결제수단 식별 정보가 노출되어야 한다.
    // 사용자 확정 STG 데이터 패턴: 모든 예치금 주문에서
    //   - 결제수단      = "-"   (정상)
    //   - 결제수단 정보 = "예치금" (정상)
    // → 강한 검증으로 변경: '결제수단 정보' 필드는 반드시 "예치금"을 포함해야 한다.
    expect(
      paymentInfo.info.includes("예치금"),
      `결제수단 정보 필드는 '예치금'을 포함해야 합니다 (QA-102 회귀 방지). ` +
        `실제: 결제수단="${paymentInfo.method}", 결제수단 정보="${paymentInfo.info}"`,
    ).toBe(true);
  });

  test("QA100-DATA-01: 예치금 필터 후 결제상태 '결제완료' 노출 + 정합성 검증", async ({
    page,
  }) => {
    await expect(page.getByText("예치금", { exact: true }).first()).toBeVisible(
      { timeout: 15000 },
    );
    await page.waitForTimeout(500);

    const checked = await page.evaluate(() => {
      const deposits = Array.from(document.querySelectorAll("*")).filter(
        (n) => n.children.length === 0 && n.textContent?.trim() === "예치금",
      );
      for (const n of deposits) {
        let node: Element | null = n.parentElement;
        for (let i = 0; i < 4 && node; i++) {
          const cb = node.querySelector(
            'input[type="checkbox"]',
          ) as HTMLInputElement | null;
          if (cb) {
            cb.click();
            return cb.checked;
          }
          node = node.parentElement;
        }
      }
      return null;
    });
    expect(checked).toBe(true);

    await page.waitForTimeout(500);
    await page
      .getByRole("button", { name: "조회하기", exact: true })
      .click({ force: true });
    await page
      .waitForLoadState("networkidle", { timeout: 15000 })
      .catch(() => {});
    await page.waitForTimeout(2000);

    const counts = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        결제완료: (text.match(/결제완료/g) || []).length,
        결제실패: (text.match(/결제실패/g) || []).length,
        결제취소: (text.match(/결제취소/g) || []).length,
      };
    });

    expect(
      counts.결제완료,
      "예치금 주문에 '결제완료' 결제상태가 노출되어야 합니다 (QA-100 회귀 방지)",
    ).toBeGreaterThan(0);

    expect(
      counts.결제실패 + counts.결제취소,
      `예치금 주문 목록에 '결제실패/결제취소'가 노출되어서는 안 됩니다: ${JSON.stringify(counts)}`,
    ).toBe(0);
  });
});

// ##############################################################################
// [추가 위치] 발주/입고 목록 (주문관리 목록 블록 아래에 추가)
// ##############################################################################

// ##############################################################################
// 발주/입고 목록
// ##############################################################################
test.describe
  .serial("발주/입고 목록 @feature:admin_makestar.purchase.list", () => {
  let purchasePage: PurchaseListPage;
  const sortFilterSnapshot = (
    filters: Array<{ label: string; value: string }>,
  ): string[] =>
    filters
      .map(
        (filter) =>
          `${filter.label.replace(/\s+/g, " ").trim().toLowerCase()}::${filter.value.replace(/\s+/g, " ").trim().toLowerCase()}`,
      )
      .sort();

  test.beforeEach(async ({ page }) => {
    purchasePage = await initPageWithRecovery(
      PurchaseListPage,
      page,
      "발주/입고",
    );
  });

  test("PUR-PAGE-01: 페이지 기본 요소 및 탭 노출 검증", async () => {
    await purchasePage.assertPageTitle();
    await purchasePage.assertHeading();
    await expect(purchasePage.breadcrumb).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });
    await purchasePage.assertTabsVisible();
  });

  test("PUR-TAB-01: 발주 요청관리/발주관리/입고내역 탭 전환 검증", async () => {
    const tabs: PurchaseTabKey[] = ["request", "manage", "inbound"];

    for (const tab of tabs) {
      await purchasePage.switchTab(tab);
      const metrics = await purchasePage.getResultMetrics();

      if (metrics.noResultState) {
        expect(
          metrics.hasNoResultMessage || metrics.hasZeroSummary,
          `${tab} 탭에서 no-result 표기가 누락되었습니다.`,
        ).toBeTruthy();
      } else {
        expect(
          metrics.rowCount,
          `${tab} 탭에서 조회 결과가 없습니다.`,
        ).toBeGreaterThan(0);
      }
    }
  });

  test("PUR-SEARCH-01: 탭별 검색항목+필터 조합 조회 정합성 검증", async () => {
    const tabs: PurchaseTabKey[] = ["request", "manage", "inbound"];
    const validatedTabs: string[] = [];
    const failures: string[] = [];

    for (const tab of tabs) {
      try {
        await purchasePage.switchTab(tab);
        await purchasePage.resetFiltersAndWait();

        const baselineMetrics = await purchasePage.getResultMetrics();
        if (baselineMetrics.noResultState) {
          expect(
            baselineMetrics.hasNoResultMessage ||
              baselineMetrics.hasZeroSummary,
            `${tab} 탭 기본 조회에서 no-result 표기가 없습니다.`,
          ).toBeTruthy();
          validatedTabs.push(`${tab}(empty)`);
          continue;
        }

        const searchSeed = await purchasePage.buildSearchSeedFromCurrentRows(2);
        await purchasePage.clickSearchAndWait();

        let metrics = await purchasePage.getResultMetrics();
        if (metrics.noResultState && searchSeed.filters.length > 0) {
          await purchasePage.resetFiltersAndWait();
          if (searchSeed.keyword) {
            await purchasePage.searchByKeyword(searchSeed.keyword);
          } else {
            await purchasePage.clickSearchAndWait();
          }
          metrics = await purchasePage.getResultMetrics();
        }

        if (metrics.noResultState) {
          expect(
            metrics.hasNoResultMessage || metrics.hasZeroSummary,
            `${tab} 탭 검색 결과 0건 표기가 없습니다.`,
          ).toBeTruthy();
        } else {
          await purchasePage.assertRowsMatchSearchSeed(searchSeed, 10);
        }

        validatedTabs.push(tab);
      } catch (error: unknown) {
        failures.push(
          `${tab}: ${error instanceof Error ? error.message : String(error)}`,
        );
      } finally {
        await purchasePage.resetFiltersAndWait();
      }
    }

    expect(
      validatedTabs.length,
      `탭별 조합 검색 정합성 검증 실패\n성공: ${validatedTabs.join(", ") || "none"}\n실패:\n${failures.join("\n") || "none"}`,
    ).toBe(tabs.length);
  });

  test("PUR-SEARCH-02: 검색 초기화 후 동일 조건 재조회(idempotent) 검증", async () => {
    await purchasePage.switchTab("request");
    await purchasePage.resetFiltersAndWait();

    const baselineMetrics = await purchasePage.getResultMetrics();
    if (baselineMetrics.noResultState) {
      expect(
        baselineMetrics.hasNoResultMessage || baselineMetrics.hasZeroSummary,
        "기본 조회 no-result 표기가 없습니다.",
      ).toBeTruthy();
      return;
    }

    const searchSeed = await purchasePage.buildSearchSeedFromCurrentRows(2);
    await purchasePage.clickSearchAndWait();

    const firstMetrics = await purchasePage.getResultMetrics();
    const firstFingerprint = !firstMetrics.noResultState
      ? await purchasePage.getFirstRowFingerprint()
      : "";
    if (!firstMetrics.noResultState) {
      await purchasePage.assertRowsMatchSearchSeed(searchSeed, 5);
    }

    await purchasePage.resetFiltersAndWait();
    await purchasePage.applySearchSeed(searchSeed);
    await purchasePage.clickSearchAndWait();

    const rerunMetrics = await purchasePage.getResultMetrics();
    const rerunFingerprint = !rerunMetrics.noResultState
      ? await purchasePage.getFirstRowFingerprint()
      : "";
    if (!rerunMetrics.noResultState) {
      await purchasePage.assertRowsMatchSearchSeed(searchSeed, 5);
    }

    const firstIsZero = firstMetrics.noResultState;
    const rerunIsZero = rerunMetrics.noResultState;
    expect(firstIsZero, "동일 조건 재조회 시 결과 상태가 변경되었습니다.").toBe(
      rerunIsZero,
    );
    expect(
      firstMetrics.summaryCount,
      "동일 조건 재조회 시 요약 카운트가 변경되었습니다.",
    ).toBe(rerunMetrics.summaryCount);
    if (
      !firstIsZero &&
      !rerunIsZero &&
      firstFingerprint.length > 0 &&
      rerunFingerprint.length > 0
    ) {
      expect(
        rerunFingerprint,
        "동일 조건 재조회 시 첫 행 식별자가 변경되었습니다.",
      ).toBe(firstFingerprint);
    }
  });

  test("PUR-SEARCH-03: 존재하지 않는 발주번호 검색 시 결과 없음 표기 검증", async () => {
    await purchasePage.switchTab("request");
    await purchasePage.resetFiltersAndWait();

    const impossibleKeyword = `AUTO-PUR-NOT-FOUND-${Date.now()}`;
    await purchasePage.searchByKeyword(impossibleKeyword);

    const metrics = await purchasePage.getResultMetrics();
    expect(
      metrics.rowCount,
      "존재하지 않는 발주번호 검색 결과에 데이터 행이 존재합니다.",
    ).toBe(0);
    expect(
      metrics.hasNoResultMessage || metrics.hasZeroSummary,
      "결과 없음 상태인데 no-result 문구 또는 전체 0건 표기가 없습니다.",
    ).toBeTruthy();

    await purchasePage.resetFiltersAndWait();
  });

  test("PUR-FLT-01: 탭 전환 시 키워드 검색조건 격리 검증", async () => {
    await purchasePage.switchTab("request");
    await purchasePage.resetFiltersAndWait();

    const requestKeyword = `REQ-ISO-${Date.now()}`;
    await purchasePage.searchByKeyword(requestKeyword);

    const requestMetrics = await purchasePage.getResultMetrics();
    expect(
      requestMetrics.hasNoResultMessage || requestMetrics.hasZeroSummary,
      "request 탭의 키워드 검색 결과 없음 표기가 확인되지 않습니다.",
    ).toBeTruthy();

    await purchasePage.switchTab("manage");
    const manageKeyword = `MNG-ISO-${Date.now()}`;
    await purchasePage.searchByKeyword(manageKeyword);

    await purchasePage.switchTab("request");
    const restoredKeyword = await purchasePage.getCurrentKeywordValue();
    const isRestoredByIsolationPolicy =
      restoredKeyword === "" || restoredKeyword === requestKeyword;

    expect(
      isRestoredByIsolationPolicy,
      `탭 전환 후 request 키워드가 정책(유지/초기화)과 다릅니다. restored=${restoredKeyword}, before=${requestKeyword}`,
    ).toBeTruthy();
    expect(
      restoredKeyword,
      "다른 탭 키워드가 request 탭으로 누수되었습니다.",
    ).not.toBe(manageKeyword);

    await purchasePage.resetFiltersAndWait();
  });

  test("PUR-RESET-01: 검색 초기화 시 키워드/필터 상태 복원 검증", async () => {
    await purchasePage.switchTab("request");
    await purchasePage.resetFiltersAndWait();

    const baselineKeyword = await purchasePage.getCurrentKeywordValue();
    const baselineFilterSnapshot = sortFilterSnapshot(
      await purchasePage.getCurrentAppliedFilters(),
    );
    const baselineMetrics = await purchasePage.getResultMetrics();

    if (!baselineMetrics.noResultState) {
      await purchasePage.buildSearchSeedFromCurrentRows(2);
    }

    const forcedKeyword = `RESET-${Date.now()}`;
    await purchasePage.setKeyword(forcedKeyword);
    await purchasePage.clickSearchAndWait();

    const keywordBeforeReset = await purchasePage.getCurrentKeywordValue();
    expect(
      keywordBeforeReset,
      "검색 적용 후 키워드 입력값이 반영되지 않았습니다.",
    ).toContain(forcedKeyword);

    await purchasePage.resetFiltersAndWait();

    const keywordAfterReset = await purchasePage.getCurrentKeywordValue();
    const afterFilterSnapshot = sortFilterSnapshot(
      await purchasePage.getCurrentAppliedFilters(),
    );
    expect(
      keywordAfterReset,
      "검색 초기화 후 키워드 입력값이 초기 상태로 복원되지 않았습니다.",
    ).toBe(baselineKeyword);
    expect(
      afterFilterSnapshot,
      "검색 초기화 후 필터 선택값이 초기 상태로 복원되지 않았습니다.",
    ).toEqual(baselineFilterSnapshot);
  });

  test("PUR-PAGE-02: 검색 결과 요약/페이지네이션 정합성 검증", async () => {
    const tabs: PurchaseTabKey[] = ["request", "manage", "inbound"];
    let validated = false;
    const skippedReasons: string[] = [];

    for (const tab of tabs) {
      await purchasePage.switchTab(tab);
      await purchasePage.resetFiltersAndWait();
      await purchasePage.clickSearchAndWait();

      const firstMetrics = await purchasePage.getResultMetrics();
      const pageLimit = await purchasePage.getPerPageLimit(10);

      if (firstMetrics.noResultState) {
        expect(firstMetrics.rowCount).toBe(0);
        expect(
          firstMetrics.hasNoResultMessage || firstMetrics.hasZeroSummary,
          `${tab} 탭 no-result 상태 표기가 없습니다.`,
        ).toBeTruthy();
        skippedReasons.push(`${tab}: no-result`);
        continue;
      }

      expect(firstMetrics.rowCount).toBeLessThanOrEqual(pageLimit);
      if (firstMetrics.summaryCount !== null) {
        expect(firstMetrics.summaryCount).toBeGreaterThanOrEqual(
          firstMetrics.rowCount,
        );
      }

      const canGoNext = await purchasePage.canGoToNextPage();
      if (!canGoNext) {
        if (firstMetrics.summaryCount !== null) {
          expect(firstMetrics.summaryCount).toBeLessThanOrEqual(pageLimit);
        }
        validated = true;
        break;
      }

      const firstRowBefore = await purchasePage.getFirstRowFingerprint();
      const moved = await purchasePage.goToNextPageSafely();
      expect(moved, "다음 페이지 이동에 실패했습니다.").toBeTruthy();

      const secondMetrics = await purchasePage.getResultMetrics();
      expect(secondMetrics.rowCount).toBeLessThanOrEqual(pageLimit);

      if (firstRowBefore.length > 0 && secondMetrics.rowCount > 0) {
        const firstRowAfter = await purchasePage.getFirstRowFingerprint();
        expect(
          firstRowAfter,
          "다음 페이지 첫 번째 행이 비어 있습니다.",
        ).toBeTruthy();
      }

      await purchasePage.goToPreviousPageSafely();
      validated = true;
      break;
    }

    expect(
      validated,
      `요약/페이지네이션 검증 가능한 탭이 없습니다. ${skippedReasons.join(", ")}`,
    ).toBeTruthy();
  });

  test("PUR-PAGE-03: 다음 페이지 이동 시 페이지 식별자 변화 검증", async () => {
    const tabs: PurchaseTabKey[] = ["request", "manage", "inbound"];
    let validated = false;
    const skippedReasons: string[] = [];

    for (const tab of tabs) {
      await purchasePage.switchTab(tab);
      await purchasePage.resetFiltersAndWait();
      await purchasePage.clickSearchAndWait();

      const firstMetrics = await purchasePage.getResultMetrics();
      if (firstMetrics.noResultState) {
        expect(
          firstMetrics.hasNoResultMessage || firstMetrics.hasZeroSummary,
        ).toBeTruthy();
        skippedReasons.push(`${tab}: no-result`);
        continue;
      }

      const canGoNext = await purchasePage.canGoToNextPage();
      if (!canGoNext) {
        skippedReasons.push(`${tab}: single-page`);
        continue;
      }

      const beforePage = await purchasePage.getCurrentPageNumber();
      const beforeUrl = purchasePage.currentUrl;
      const beforeFirstRow = await purchasePage.getFirstRowFingerprint();

      const moved = await purchasePage.goToNextPageSafely();
      expect(moved, "다음 페이지 이동에 실패했습니다.").toBeTruthy();

      const afterMetrics = await purchasePage.getResultMetrics();
      const afterPage = await purchasePage.getCurrentPageNumber();
      const afterUrl = purchasePage.currentUrl;
      const afterFirstRow = !afterMetrics.noResultState
        ? await purchasePage.getFirstRowFingerprint()
        : "";

      const pageChanged = beforePage !== afterPage;
      const urlChanged = beforeUrl !== afterUrl;
      const rowChanged =
        beforeFirstRow.length > 0 &&
        afterFirstRow.length > 0 &&
        beforeFirstRow !== afterFirstRow;

      expect(
        pageChanged || urlChanged || rowChanged,
        `다음 페이지 이동 후 식별자 변화가 없습니다. page:${beforePage}->${afterPage}, url:${beforeUrl}->${afterUrl}`,
      ).toBeTruthy();

      const returned = await purchasePage.goToPreviousPageSafely();
      expect(returned, "이전 페이지 복귀에 실패했습니다.").toBeTruthy();

      validated = true;
      break;
    }

    expect(
      validated,
      `페이지 이동 검증 가능한 탭이 없습니다. ${skippedReasons.join(", ")}`,
    ).toBeTruthy();
  });
});

// ##############################################################################
// 차트 집계 목록
// ##############################################################################
test.describe
  .serial("차트 집계 목록 @feature:admin_makestar.chart.info", () => {
  let chartPage: ChartInfoListPage;

  test.beforeEach(async ({ page }) => {
    chartPage = await initPageWithRecovery(
      ChartInfoListPage,
      page,
      "차트 집계",
    );
  });

  test("CHART-PAGE-01: 페이지 기본 요소 및 검색 영역 노출 검증", async () => {
    await chartPage.assertPageTitle();
    await chartPage.assertHeading();
    await expect(chartPage.breadcrumb).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });
    await chartPage.assertBreadcrumb(chartPage.getBreadcrumbPath());
    await expect(chartPage.submitSearchButton).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });
    await expect(chartPage.searchResetButton).toBeVisible({
      timeout: ELEMENT_TIMEOUT,
    });
  });

  test("CHART-DATA-01: 기본 조회 결과 영역 정합성 검증", async () => {
    await chartPage.resetFiltersAndWait();
    await chartPage.clickSearchAndWait();

    const metrics = await chartPage.getResultMetrics();
    const pageLimit = await chartPage.getPerPageLimit(10);

    if (metrics.noResultState) {
      expect(
        metrics.rowCount,
        "no-result 상태인데 데이터 행이 존재합니다.",
      ).toBe(0);
      expect(
        metrics.hasNoResultMessage || metrics.hasZeroSummary,
        "no-result 상태인데 메시지/요약(0건) 표기가 없습니다.",
      ).toBeTruthy();
      return;
    }

    expect(metrics.rowCount, "기본 조회 결과가 없습니다.").toBeGreaterThan(0);
    expect(metrics.rowCount).toBeLessThanOrEqual(pageLimit);
    if (metrics.summaryCount !== null) {
      expect(metrics.summaryCount).toBeGreaterThanOrEqual(metrics.rowCount);
    }
  });

  test("CHART-SEARCH-01: 존재하지 않는 키워드 검색 시 결과 없음 표기 검증", async () => {
    await chartPage.resetFiltersAndWait();

    const hasKeywordInput = await chartPage.hasKeywordInput();
    expect(
      hasKeywordInput,
      "차트 집계 검색 키워드 입력창을 찾지 못했습니다.",
    ).toBeTruthy();

    const impossibleKeyword = `AUTO-CHART-NOT-FOUND-${Date.now()}`;
    await chartPage.searchByKeyword(impossibleKeyword);

    const metrics = await chartPage.getResultMetrics();
    expect(
      metrics.rowCount,
      "존재하지 않는 키워드 검색 결과에 데이터 행이 존재합니다.",
    ).toBe(0);
    expect(
      metrics.hasNoResultMessage || metrics.hasZeroSummary,
      "결과 없음 상태인데 no-result 문구 또는 전체 0건 표기가 없습니다.",
    ).toBeTruthy();

    await chartPage.resetFiltersAndWait();
  });

  test("CHART-PAGE-02: 페이지네이션 이동 정합성 검증", async () => {
    await chartPage.resetFiltersAndWait();
    await chartPage.clickSearchAndWait();

    const firstMetrics = await chartPage.getResultMetrics();
    if (firstMetrics.noResultState) {
      expect(
        firstMetrics.hasNoResultMessage || firstMetrics.hasZeroSummary,
      ).toBeTruthy();
      return;
    }

    const canGoNext = await chartPage.canGoToNextPage();
    if (!canGoNext) {
      const pageLimit = await chartPage.getPerPageLimit(10);
      if (firstMetrics.summaryCount !== null) {
        expect(firstMetrics.summaryCount).toBeLessThanOrEqual(pageLimit);
      }
      return;
    }

    const beforePage = await chartPage.getCurrentPageNumber();
    const beforeUrl = chartPage.currentUrl;
    const beforeFirstRow = await chartPage.getFirstRowFingerprint();

    const moved = await chartPage.goToNextPageSafely();
    expect(moved, "다음 페이지 이동에 실패했습니다.").toBeTruthy();

    const secondMetrics = await chartPage.getResultMetrics();
    const afterPage = await chartPage.getCurrentPageNumber();
    const afterUrl = chartPage.currentUrl;
    const afterFirstRow = !secondMetrics.noResultState
      ? await chartPage.getFirstRowFingerprint()
      : "";

    const pageChanged = beforePage !== afterPage;
    const urlChanged = beforeUrl !== afterUrl;
    const rowChanged =
      beforeFirstRow.length > 0 &&
      afterFirstRow.length > 0 &&
      beforeFirstRow !== afterFirstRow;

    expect(
      pageChanged || urlChanged || rowChanged,
      `다음 페이지 이동 후 식별자 변화가 없습니다. page:${beforePage}->${afterPage}, url:${beforeUrl}->${afterUrl}`,
    ).toBeTruthy();

    const returned = await chartPage.goToPreviousPageSafely();
    expect(returned, "이전 페이지 복귀에 실패했습니다.").toBeTruthy();
  });
});
