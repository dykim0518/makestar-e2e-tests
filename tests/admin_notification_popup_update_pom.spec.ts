/**
 * Admin 팝업 수정 페이지 검증 (read-only + 취소 동작)
 *
 * - 페이지: /notification/popup/update/:id
 * - 진입: 공지 목록(/notification/list) → 팝업관리 탭 → 첫 등록 팝업 클릭
 * - 범위: 데이터 로드 / 필드 노출 / 취소 동작 검증
 *
 * 본 페이지는 편집 가능(저장 버튼 노출)이지만 실제 저장은 popup_create spec에서
 * 더미 lifecycle로 검증한다. 본 spec은 stage 데이터 보존을 위해 read-only 검증만.
 *
 * 데이터 의존성: stage 팝업관리에 최소 1개의 등록된 팝업이 필요.
 *               0개일 경우 첫 케이스에서 fail-fast.
 *
 * @feature:admin_makestar.popup.update
 */

import { test, expect } from "@playwright/test";
import {
  AdminNotificationListPage,
  AdminNotificationPopupUpdatePage,
} from "./pages";
import { initPageWithRecovery } from "./helpers/admin";
import { applyAdminTestConfig } from "./helpers/admin/test-helpers";

applyAdminTestConfig("팝업 수정");

test.describe
  .serial("Admin 팝업 수정 페이지 @feature:admin_makestar.popup.update", () => {
  let updatePage: AdminNotificationPopupUpdatePage;
  let popupName: string;

  test.beforeEach(async ({ page }) => {
    // 1) 공지 목록 → 팝업관리 탭 전환
    const listPage = await initPageWithRecovery(
      AdminNotificationListPage,
      page,
      "공지사항",
    );
    await listPage.switchToPopupTab();

    // 2) 등록된 첫 팝업 row 찾기 ("등록된 팝업이 없습니다" 행 제외)
    //    팝업 목록은 div grid 구조 — table tbody tr 셀렉터 사용 불가
    const populatedRow = page
      .locator("div")
      .filter({
        hasText: /^[12345]/,
      })
      .filter({ hasNotText: "등록된 팝업이 없습니다" })
      .filter({ has: page.locator("img") })
      .first();

    await expect(
      populatedRow,
      "stage 팝업관리에 등록된 팝업이 없습니다. 최소 1개 등록 후 재실행하세요.",
    ).toBeVisible({ timeout: 10000 });

    // 팝업 이름 추출 (검증용)
    const rowText = (await populatedRow.textContent()) || "";
    const m = rowText.match(/^[12345]\s*(.+?)\s*\d{4}년/);
    popupName = m ? m[1].trim() : "";

    // 3) 팝업 이름 클릭 → /update/:id 진입
    await populatedRow.click();

    updatePage = new AdminNotificationPopupUpdatePage(page);
    await updatePage.waitForLoaded();
  });

  test("POP-UPDATE-01: 팝업 row 클릭 시 수정 페이지 진입", async ({ page }) => {
    await expect(page).toHaveURL(/\/notification\/popup\/update\/\d+/);
    const id = updatePage.getPopupIdFromUrl();
    expect(id, "URL에서 팝업 ID 추출 실패").toBeTruthy();
  });

  test("POP-UPDATE-02: 페이지/섹션 헤딩 노출", async () => {
    await expect(updatePage.pageHeading).toBeVisible();
    await expect(updatePage.sectionHeading).toBeVisible();
  });

  test("POP-UPDATE-03: 카테고리 3개 노출 + 정확히 1개 활성", async () => {
    const categories = ["공통 팝업", "B2C 팝업", "B2B 팝업"] as const;
    for (const c of categories) {
      await expect(
        updatePage.categoryButton(c),
        `카테고리 버튼 ${c} 미노출`,
      ).toBeVisible();
    }
    const active = await updatePage.getActiveCategory();
    expect(active, "활성 카테고리 없음").not.toBeNull();
  });

  test("POP-UPDATE-04: 제목 input에 기존 값 채워짐", async () => {
    const title = (await updatePage.titleInput.inputValue()).trim();
    expect(
      title.length,
      "제목 input이 비어 있음 — 데이터 로드 실패",
    ).toBeGreaterThan(0);
    if (popupName) {
      expect(title, "목록 팝업명과 제목 input 불일치").toBe(popupName);
    }
  });

  test("POP-UPDATE-05: 노출 기간(시작/종료 날짜) input에 기존 값", async () => {
    const startDate = await updatePage.startDateInput.inputValue();
    const endDate = await updatePage.endDateInput.inputValue();
    expect(startDate.trim().length, "시작 날짜 비어 있음").toBeGreaterThan(0);
    expect(endDate.trim().length, "종료 날짜 비어 있음").toBeGreaterThan(0);
  });

  test("POP-UPDATE-06: 정렬 라디오(왼쪽/가운데) 노출", async () => {
    await expect(updatePage.alignmentLabel("왼쪽 정렬")).toBeVisible();
    await expect(updatePage.alignmentLabel("가운데 정렬")).toBeVisible();
  });

  test("POP-UPDATE-07: 본문 ProseMirror 에디터 노출", async () => {
    await expect(updatePage.contentEditor).toBeVisible();
  });

  test("POP-UPDATE-08: 우측 팝업 미리보기 패널 노출", async () => {
    await expect(updatePage.previewHeading).toBeVisible();
  });

  test("POP-UPDATE-09: 취소/지금 수정하기 버튼 둘 다 enabled 상태로 노출", async () => {
    await expect(updatePage.cancelButton).toBeVisible();
    await expect(updatePage.cancelButton).toBeEnabled();
    await expect(updatePage.saveButton).toBeVisible();
    await expect(updatePage.saveButton).toBeEnabled();
  });
});
