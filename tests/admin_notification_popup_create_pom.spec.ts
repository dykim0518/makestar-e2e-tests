/**
 * Admin 팝업 등록 시나리오
 *
 * - 더미 팝업 등록 → admin 팝업관리 탭 노출 검증 → cleanup
 * - 인증: admin 본인 세션 (setupApiInterceptor 미사용)
 *
 * 더미 데이터:
 *   - 카테고리: 공통 팝업
 *   - 제목: "[E2E TEST] {timestamp}" + 팝업타이틀(한국어/영어) 동일
 *   - 노출 기간: 지금~30분 후 (시간 picker가 30분 단위라 최소 30분)
 *   - 정렬: 왼쪽 정렬
 *   - 이미지: tests/fixtures/dummy-popup.png (필수)
 *   - 본문/버튼추가: OFF
 *
 * 5개 슬롯 정책: 등록 전 [E2E TEST] prefix 누적 팝업 자동 정리.
 *
 * NOTE 프론트 모달 노출 검증(POP-FRONT-01)은 수동으로 진행:
 *  - swiper가 lazy-load + 커스텀 carousel 구조라 자동 슬라이드 navigation 비용이 큼.
 *  - admin 등록/노출/cleanup 검증으로 회귀 위험 충분히 커버.
 *  - 필요 시 stage-new.makeuni2026.com/ 진입 → 모달 ">" 버튼으로 슬라이드 확인.
 */

import { test, expect, Page } from "@playwright/test";
import { resolve } from "path";
import {
  AdminNotificationListPage,
  AdminNotificationPopupCreatePage,
} from "./pages";
import { initPageWithRecovery, setupAuthCookies } from "./helpers/admin";
import { applyAdminTestConfig } from "./helpers/admin/test-helpers";

const POPUP_LIST_PATH = "/notification/list"; // 팝업관리는 같은 URL의 별도 탭
const DUMMY_PREFIX = "[E2E TEST]";
const DUMMY_IMAGE_PATH = resolve(__dirname, "fixtures", "dummy-popup.png");

applyAdminTestConfig("팝업등록");

function makeDummyTitle(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:T.]/g, "")
    .substring(0, 14);
  return `${DUMMY_PREFIX} ${ts}`;
}

/**
 * 시간 옵션이 30분 단위라 노출 기간 최소 단위도 30분.
 * 시작: 현재 시각의 30분 단위 floor, 종료: 시작 + 30분.
 * 시간 포맷: "오전/오후 HH:MM" (12시간제).
 */
function exposurePeriod(): {
  startDay: number;
  startTime: string;
  endDay: number;
  endTime: string;
} {
  const now = new Date();
  const start = new Date(now);
  start.setMinutes(Math.floor(start.getMinutes() / 30) * 30, 0, 0);
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  const fmtTime = (d: Date) => {
    const h = d.getHours();
    const isPm = h >= 12;
    const h12 = h % 12 === 0 ? 12 : h % 12;
    const period = isPm ? "오후" : "오전";
    return `${period} ${String(h12).padStart(2, "0")}:${String(
      d.getMinutes(),
    ).padStart(2, "0")}`;
  };

  return {
    startDay: start.getDate(),
    startTime: fmtTime(start),
    endDay: end.getDate(),
    endTime: fmtTime(end),
  };
}

/** 팝업관리 탭에서 [E2E TEST] prefix 더미 팝업 일괄 삭제. */
async function cleanupAllDummyPopups(page: Page): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < 10; i++) {
    const listPage = await initPageWithRecovery(
      AdminNotificationListPage,
      page,
      "공지사항",
    );
    await listPage.switchToPopupTab();
    // 팝업관리는 div grid 구조 — text 기반 row 찾기
    const dummyRow = page
      .locator("div, tr")
      .filter({ hasText: DUMMY_PREFIX })
      .first();
    const exists = await dummyRow
      .isVisible({ timeout: 3000 })
      .catch(() => false);
    if (!exists) break;

    // 휴지통 아이콘은 행의 마지막 영역. 스크린샷 기준 row 우측 끝 휴지통.
    // 단순화: 같은 행 내의 가장 가까운 trash 아이콘 — class 또는 svg 매칭
    const rowContainer = dummyRow;
    // 행 내 모든 button/svg 중 마지막 — 휴지통일 가능성
    const trashCandidate = rowContainer.locator("button, svg").last();
    await trashCandidate.click({ force: true }).catch(() => {});
    const confirmBtn = page.getByRole("button", {
      name: "삭제하기",
      exact: true,
    });
    const ok = await confirmBtn.isVisible({ timeout: 3000 }).catch(() => false);
    if (!ok) break;
    await confirmBtn.click({ force: true });
    await page
      .getByText("정말 삭제하시겠습니까?")
      .waitFor({ state: "hidden", timeout: 15000 })
      .catch(() => {});
    deleted++;
    console.log(`🧹 prefix popup cleanup: 삭제 #${deleted}`);
  }
  return deleted;
}

test.describe.serial("Admin 팝업등록 (더미 + cleanup)", () => {
  let dummyTitle: string;
  let period: ReturnType<typeof exposurePeriod>;

  test.beforeAll(async ({ browser }) => {
    dummyTitle = makeDummyTitle();
    period = exposurePeriod();

    // 사전 정리: 5개 슬롯이 가득 차있으면 등록 불가 → [E2E TEST] prefix 먼저 비움
    const ctx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await ctx.newPage();
    try {
      await setupAuthCookies(page);
      const cleared = await cleanupAllDummyPopups(page);
      if (cleared > 0) {
        console.log(`🧹 사전 cleanup: 누적 더미 ${cleared}개 정리`);
      }
    } finally {
      await ctx.close();
    }
  });

  test.afterAll(async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await ctx.newPage();
    try {
      await setupAuthCookies(page);
      const remaining = await cleanupAllDummyPopups(page);
      if (remaining > 0) {
        console.log(`🧹 afterAll 안전망: 추가 ${remaining}개 정리`);
      }
    } finally {
      await ctx.close();
    }
  });

  test("POP-CREATE-01: 더미 팝업 등록 후 admin 팝업관리 탭에 노출", async ({
    page,
  }) => {
    const createPage = await initPageWithRecovery(
      AdminNotificationPopupCreatePage,
      page,
      "팝업등록",
    );

    await createPage.fillForm({
      category: "공통 팝업",
      title: dummyTitle,
      startDay: period.startDay,
      startTime: period.startTime,
      endDay: period.endDay,
      endTime: period.endTime,
      alignment: "왼쪽 정렬",
      imagePath: DUMMY_IMAGE_PATH,
      // 모달에서 식별 가능하도록 한국어/영어 제목 추가 (둘 다 필수)
      popupTitleKo: dummyTitle,
      popupTitleEn: dummyTitle,
    });
    expect(await createPage.isCategoryActive("공통 팝업")).toBe(true);
    await createPage.submitAndWaitForList();

    // 등록 후 자동 redirect — /notification/list?openedTab=popup 형태
    await expect(page).toHaveURL(/\/notification\/list/);

    // 자동 전환되지 않은 경우를 대비해 명시적으로 팝업 탭 보장
    const listPage = new AdminNotificationListPage(page);
    await listPage.switchToPopupTab().catch(() => {});
    await expect(
      page.getByText(dummyTitle, { exact: false }).first(),
      "등록한 팝업이 팝업관리 탭에 노출되어야 함",
    ).toBeVisible({ timeout: 10000 });
  });

  test("POP-CLEANUP-99: 누적 더미 팝업 prefix 일괄 정리", async ({ page }) => {
    const deleted = await cleanupAllDummyPopups(page);
    console.log(`🧹 누적 더미 팝업 ${deleted}개 정리 완료`);
  });
});
