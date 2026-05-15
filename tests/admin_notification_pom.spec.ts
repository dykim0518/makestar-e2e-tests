/**
 * Admin 공지사항 (공지관리/팝업관리) 테스트
 *
 * - 페이지: /notification/list
 * - 탭: 공지관리 (NTC), 팝업관리 (POP)
 * - 인증: 본인 세션 쿠키만 사용 (setupApiInterceptor 사용 X)
 *   - 시스템 토큰(cloudtask-system)은 운영 메뉴 권한이 없어 forbidden 됨
 */

import { test, expect } from "@playwright/test";
import { AdminNotificationListPage } from "./pages";
import { initPageWithRecovery } from "./helpers/admin";
import { applyAdminTestConfig } from "./helpers/admin/test-helpers";

applyAdminTestConfig("공지사항");

test.describe.serial("Admin 공지사항 - 공지관리 탭", () => {
  let notiPage: AdminNotificationListPage;

  test.beforeEach(async ({ page }) => {
    notiPage = await initPageWithRecovery(
      AdminNotificationListPage,
      page,
      "공지사항",
    );
  });

  test("NTC-PAGE-01: 페이지 헤딩과 두 탭 노출", async () => {
    await expect(notiPage.heading).toBeVisible();
    await expect(notiPage.noticeTab).toBeVisible();
    await expect(notiPage.popupTab).toBeVisible();
  });

  test("NTC-TAB-01: 진입 시 공지관리 탭이 활성", async () => {
    const active = await notiPage.getActiveTabName();
    expect(active).toBe("공지관리");
  });

  test("NTC-DATA-01: 테이블 컬럼 + 행 10개 노출", async () => {
    // 마지막 컬럼은 휴지통 아이콘(빈 헤더)이라 텍스트 검증에서 제외
    await notiPage.assertTableHeaders([
      "번호",
      "제목",
      "구분",
      "생성자",
      "생성일",
    ]);
    const rowCount = await notiPage.getRowCount();
    expect(rowCount).toBeGreaterThan(0);
    expect(rowCount).toBeLessThanOrEqual(10);
  });

  test("NTC-DATA-02: 필수 컬럼(번호/제목/생성일) 빈 값 없음", async () => {
    const rowCount = await notiPage.getRowCount();
    for (let i = 0; i < Math.min(rowCount, 10); i++) {
      const id = await notiPage.getCellText(i, 0);
      const title = await notiPage.getCellText(i, 1);
      const createdAt = await notiPage.getCellText(i, 4);
      expect(notiPage.isMeaningfulValue(id), `row ${i} 번호`).toBe(true);
      expect(notiPage.isMeaningfulValue(title), `row ${i} 제목`).toBe(true);
      expect(notiPage.isMeaningfulValue(createdAt), `row ${i} 생성일`).toBe(
        true,
      );
    }
  });

  test("NTC-PAGIN-01: 진입 시 Previous 버튼 disabled", async () => {
    await expect(notiPage.previousPageButton).toBeDisabled();
  });

  test("NTC-PAGIN-02: 다음 페이지 이동 후 행 변경 확인", async () => {
    const firstRowBefore = await notiPage.getFirstRowFingerprint();
    const moved = await notiPage.goToNextPageSafely();
    expect(moved).toBe(true);
    const firstRowAfter = await notiPage.getFirstRowFingerprint();
    expect(firstRowAfter).not.toBe(firstRowBefore);
  });

  test("NTC-NAV-01: '+ 알림 생성' 클릭 시 공지 등록 페이지 이동", async ({
    page,
  }) => {
    await notiPage.clickRegisterButton();
    await expect(page).toHaveURL(/\/notification\/notice\/create$/);
  });
});

test.describe.serial("Admin 공지사항 - 팝업관리 탭", () => {
  let notiPage: AdminNotificationListPage;

  test.beforeEach(async ({ page }) => {
    notiPage = await initPageWithRecovery(
      AdminNotificationListPage,
      page,
      "공지사항",
    );
    await notiPage.switchToPopupTab();
  });

  test("POP-TAB-01: 팝업관리 탭이 활성", async () => {
    const active = await notiPage.getActiveTabName();
    expect(active).toBe("팝업관리");
  });

  test("POP-PAGE-01: 두 탭 모두 노출 + 헤딩 유지", async () => {
    await expect(notiPage.heading).toBeVisible();
    await expect(notiPage.noticeTab).toBeVisible();
    await expect(notiPage.popupTab).toBeVisible();
  });

  test("POP-DATA-01: 팝업 컬럼 헤더 + 5개 슬롯 안내 노출", async () => {
    await notiPage.assertPopupColumns();
    await notiPage.assertPopupSlotLimitNotice();
  });

  test("POP-NAV-01: '+ 팝업 생성' 클릭 시 팝업 등록 페이지 이동", async ({
    page,
  }) => {
    await notiPage.clickRegisterButton();
    await expect(page).toHaveURL(/\/notification\/popup\/create$/);
  });
});
