/**
 * Admin 공지 수정 페이지 read-only 검증
 *
 * - 페이지: /notification/notice/update/:id
 * - 진입: 공지 목록(/notification/list) 첫 row 클릭
 * - 범위: 데이터 로드 / 필드 노출 검증 (저장 흐름 비포함)
 *
 * 사양: update 페이지는 read-only — 저장/취소/수정 버튼 없음 (목록에서 삭제만 제공).
 *       2026-05-27 사용자 확인. 수정·저장 시나리오 추가 금지.
 *
 * @feature:admin_makestar.notice.update
 */

import { test, expect } from "@playwright/test";
import {
  AdminNotificationListPage,
  AdminNotificationNoticeUpdatePage,
} from "./pages";
import type { NoticeLanguage } from "./pages";
import { initPageWithRecovery } from "./helpers/admin";
import { applyAdminTestConfig } from "./helpers/admin/test-helpers";

applyAdminTestConfig("공지 수정");

test.describe
  .serial("Admin 공지 수정 페이지 @feature:admin_makestar.notice.update", () => {
  let updatePage: AdminNotificationNoticeUpdatePage;
  let listFirstRowTitle: string;

  test.beforeEach(async ({ page }) => {
    // 1) 공지 목록 진입
    const listPage = await initPageWithRecovery(
      AdminNotificationListPage,
      page,
      "공지사항",
    );

    // 2) 첫 row의 제목 캡처 (수정 페이지 검증용)
    const firstRow = listPage.tableRows.first();
    await expect(
      firstRow,
      "공지 목록 첫 row가 노출되어야 합니다",
    ).toBeVisible();
    const titleCell = firstRow.locator("td").nth(1);
    const rawTitle = (await titleCell.textContent()) || "";
    listFirstRowTitle = rawTitle.replace(/^\s*중요\s*/, "").trim();

    // 3) 제목 셀 클릭 → /update/:id 진입
    await titleCell.locator("div").first().click();

    updatePage = new AdminNotificationNoticeUpdatePage(page);
    await updatePage.waitForLoaded();
  });

  test("NTC-UPDATE-01: 목록 첫 row 클릭 시 수정 페이지로 이동", async ({
    page,
  }) => {
    await expect(page).toHaveURL(/\/notification\/notice\/update\/\d+/);
    const id = updatePage.getNoticeIdFromUrl();
    expect(id, "URL에서 공지 ID 추출 실패").toBeTruthy();
  });

  test("NTC-UPDATE-02: 페이지/섹션 헤딩 노출", async () => {
    await expect(updatePage.pageHeading).toBeVisible();
    await expect(updatePage.sectionHeading).toBeVisible();
  });

  test("NTC-UPDATE-03: 카테고리 4개 노출 + 정확히 1개만 활성", async () => {
    const categories = ["공지", "B2C 공지", "B2B 공지", "이벤트"] as const;
    for (const c of categories) {
      await expect(
        updatePage.categoryButton(c),
        `카테고리 버튼 ${c} 미노출`,
      ).toBeVisible();
    }
    const active = await updatePage.getActiveCategory();
    expect(active, "활성 카테고리가 없거나 1개 초과").not.toBeNull();
  });

  test("NTC-UPDATE-04: 4개 언어 제목 input 노출", async () => {
    const langs: NoticeLanguage[] = ["한국어", "영어", "중국어", "일본어"];
    for (const lang of langs) {
      await expect(
        updatePage.titleInput(lang),
        `${lang} 제목 input 미노출`,
      ).toBeVisible();
    }
  });

  test("NTC-UPDATE-05: 한국어 제목 input에 기존 값이 채워져 있음", async () => {
    const koTitle = await updatePage.getTitleValue("한국어");
    expect(
      koTitle.trim().length,
      "한국어 제목이 비어 있음 — 데이터 로드 실패",
    ).toBeGreaterThan(0);
  });

  test("NTC-UPDATE-06: 목록 row 제목이 한국어 제목 input과 일치", async () => {
    const koTitle = (await updatePage.getTitleValue("한국어")).trim();
    expect(
      koTitle,
      `목록 제목 "${listFirstRowTitle}"과 수정 페이지 한국어 제목 "${koTitle}" 불일치`,
    ).toBe(listFirstRowTitle);
  });

  test("NTC-UPDATE-07: 본문 ProseMirror 에디터 노출", async () => {
    await expect(updatePage.contentEditor).toBeVisible();
  });

  test("NTC-UPDATE-08: 우측 공지 미리보기 패널 노출", async () => {
    await expect(updatePage.previewHeading).toBeVisible();
  });
});
