/**
 * Admin 공지 등록 시나리오
 *
 * - 더미 공지 등록 → admin 목록 검증 → 프론트 노출 검증 → 누적 prefix 일괄 cleanup
 * - 인증: admin은 본인 세션 쿠키 (setupApiInterceptor 미사용)
 *         프론트는 신규 비로그인 BrowserContext
 *
 * 더미 데이터:
 *   - 카테고리: 공지
 *   - 제목: "[E2E TEST] {timestamp}"
 *   - 한국어 + 영어만 채움 (필수)
 *   - 본문: NOTICE_BODY_TEXT
 *   - 중요 표시: OFF, 이미지: 없음
 *
 * cleanup: NTC-CLEANUP-99 + afterAll(안전망)에서 prefix 일괄 정리.
 */

import { test, expect, Page } from "@playwright/test";
import {
  AdminNotificationListPage,
  AdminNotificationNoticeCreatePage,
} from "./pages";
import { initPageWithRecovery, setupAuthCookies } from "./helpers/admin";
import { applyAdminTestConfig } from "./helpers/admin/test-helpers";

const FRONTEND_NOTICE_LIST_URL =
  "https://stage-new.makeuni2026.com/notice/list";
const NOTICE_BODY_TEXT = "E2E 자동화 테스트 — 자동 삭제 예정";
const DUMMY_PREFIX = "[E2E TEST]";

applyAdminTestConfig("공지등록");

function makeDummyTitle(): string {
  const ts = new Date()
    .toISOString()
    .replace(/[-:T.]/g, "")
    .substring(0, 14); // YYYYMMDDHHMMSS
  return `${DUMMY_PREFIX} ${ts}`;
}

/** "[E2E TEST]" prefix로 시작하는 모든 누적 더미 row 일괄 삭제. */
async function cleanupAllDummyNotices(page: Page): Promise<number> {
  let deleted = 0;
  // 안전장치: 무한루프 방지 — 최대 20개까지 순회
  for (let i = 0; i < 20; i++) {
    const listPage = await initPageWithRecovery(
      AdminNotificationListPage,
      page,
      "공지사항",
    );
    const row = listPage.tableRows.filter({ hasText: DUMMY_PREFIX }).first();
    const exists = await row.isVisible({ timeout: 3000 }).catch(() => false);
    if (!exists) break;

    const title = (
      (await row
        .locator("td")
        .nth(1)
        .textContent()
        .catch(() => "")) || ""
    ).trim();
    await row.locator("td").last().click({ force: true });
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
    await row.waitFor({ state: "hidden", timeout: 10000 }).catch(() => {});
    deleted++;
    console.log(`🧹 prefix cleanup: 삭제 "${title}"`);
  }
  return deleted;
}

test.describe.serial("Admin 공지등록 + 프론트 노출 검증", () => {
  // 한 번 생성한 dummyTitle을 모든 test가 공유 (등록 → 프론트 검증 → cleanup)
  let dummyTitle: string;

  test.beforeAll(() => {
    dummyTitle = makeDummyTitle();
  });

  // 안전망: test fail로 CLEANUP-99가 못 돌아도 stage 누적 방지
  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();
    try {
      await setupAuthCookies(page);
      const remaining = await cleanupAllDummyNotices(page);
      if (remaining > 0) {
        console.log(`🧹 afterAll 안전망: 추가 ${remaining}개 정리`);
      }
    } finally {
      await context.close();
    }
  });

  test("NTC-CREATE-01: 더미 공지 등록 후 admin 목록에 노출", async ({
    page,
  }) => {
    const createPage = await initPageWithRecovery(
      AdminNotificationNoticeCreatePage,
      page,
      "공지등록",
    );

    await createPage.fillForm({
      category: "공지",
      titles: { 한국어: dummyTitle, 영어: dummyTitle },
      content: NOTICE_BODY_TEXT,
    });
    expect(await createPage.isCategoryActive("공지")).toBe(true);
    await createPage.submitAndWaitForList();

    await expect(page).toHaveURL(/\/notification\/list$/);
    const row = page
      .locator("table tbody tr")
      .filter({ hasText: dummyTitle })
      .first();
    await expect(row, "등록한 공지가 admin 목록에 노출되어야 함").toBeVisible({
      timeout: 10000,
    });
  });

  test("NTC-FRONT-01: 프론트 공지 목록 노출 + 상세 본문 노출", async ({
    browser,
  }) => {
    // 신규 비로그인 컨텍스트 — admin 쿠키와 격리
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });
    const page = await context.newPage();

    try {
      // 1) 목록 노출 — 캐시/지연 대응 reload 재시도 (최대 3회)
      let titleLink = page.getByText(dummyTitle, { exact: false }).first();
      let found = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt === 0) {
          await page.goto(FRONTEND_NOTICE_LIST_URL, {
            waitUntil: "domcontentloaded",
            timeout: 20000,
          });
        } else {
          await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
        }
        await page
          .waitForLoadState("networkidle", { timeout: 8000 })
          .catch(() => {});
        titleLink = page.getByText(dummyTitle, { exact: false }).first();
        if (await titleLink.isVisible({ timeout: 5000 }).catch(() => false)) {
          found = true;
          break;
        }
        console.log(
          `⏳ 프론트 노출 미확인 (시도 ${attempt + 1}/3) — reload 재시도`,
        );
      }
      expect(
        found,
        `프론트 공지 목록에 "${dummyTitle}" 노출 실패 (3회 reload 재시도 후)`,
      ).toBe(true);

      // 2) 제목 클릭 → 상세 진입
      await titleLink.click();
      await page
        .waitForLoadState("domcontentloaded", { timeout: 10000 })
        .catch(() => {});

      // 3) 상세 본문 텍스트 노출 검증
      await expect(
        page.getByText(NOTICE_BODY_TEXT).first(),
        "상세 페이지에서 본문 텍스트가 노출되어야 함",
      ).toBeVisible({ timeout: 10000 });
    } finally {
      await context.close();
    }
  });

  test("NTC-CLEANUP-99: 누적 더미('[E2E TEST]' prefix) 일괄 정리", async ({
    page,
  }) => {
    const deleted = await cleanupAllDummyNotices(page);
    console.log(`🧹 누적 더미 ${deleted}개 정리 완료`);
  });
});
