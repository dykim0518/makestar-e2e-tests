/**
 * Admin 상품 수정 회귀 테스트 (Page Object Model 적용)
 *
 * Hotfix 이슈에서 발견된 상품 수정 관련 버그의 회귀 테스트입니다.
 *
 * ============================================================================
 * TC명 체계: PRD-UPDATE-[번호]: 한글 설명
 * ============================================================================
 *
 * CT-232: 공지 체크박스 설정 자동 초기화 현상
 *   - 상품 수정 시 공지 체크박스 설정을 변경한 후 저장하면
 *     기존 설정으로 자동 복귀하는 버그 회귀 테스트
 *   - Jira: https://makestar-product.atlassian.net/browse/CT-232
 *
 * @see tests/pages/admin-event-update.page.ts
 */

import { test, expect } from "@playwright/test";
import { EventUpdatePage, assertNoServerError } from "./pages";
import {
  waitForPageStable,
  ELEMENT_TIMEOUT,
  applyAdminTestConfig,
} from "./helpers/admin/test-helpers";

// ============================================================================
// 테스트 설정
// ============================================================================
applyAdminTestConfig("상품 수정");

// ============================================================================
// 테스트 대상 데이터
// ============================================================================

// CT-232 테스트 대상 상품 (폼 데이터가 정상 로드되는 유효한 이벤트)
const CT232_EVENT_ID = "15952";

// ##############################################################################
// 상품 수정 - 회귀 테스트
// ##############################################################################
test.describe("상품 수정 회귀 테스트", () => {
  // ==========================================================================
  // CT-232: 공지 체크박스 설정 유지 검증
  // ==========================================================================
  test.describe("CT-232: 공지 체크박스 설정 유지 검증", () => {
    let updatePage: EventUpdatePage;

    test.beforeEach(async ({ page }) => {
      updatePage = new EventUpdatePage(page, CT232_EVENT_ID);
      await updatePage.navigate();
      await waitForPageStable(page);
      await updatePage.waitForPageReady();
      // 로드 시 발생하는 에러 토스트 닫기
      await updatePage.dismissErrorToast();
    });

    test("PRD-UPDATE-01: 상품 수정 페이지 정상 로드", async ({ page }) => {
      // 페이지 URL 확인
      expect(page.url()).toContain(`/event/update/${CT232_EVENT_ID}`);

      // 서버 에러 없음 확인
      await assertNoServerError(page);

      // 저장 버튼 존재 확인
      await expect(updatePage.saveButton).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });
    });

    test("PRD-UPDATE-02: 공지 체크박스 섹션 존재 확인", async () => {
      // 공지 섹션으로 스크롤
      await updatePage.scrollToNoticeSection();

      // 각 공지 체크박스가 존재하는지 확인
      const states = await updatePage.getAllNoticeCheckboxStates();
      expect(states.length).toBe(3);

      for (const state of states) {
        const checkbox = updatePage.getNoticeCheckbox(state.label);
        await expect(checkbox).toBeAttached();
      }
    });

    test("PRD-UPDATE-03: 공지 체크박스 변경 후 저장 시 유지 확인", async () => {
      // CT-232 핵심 시나리오:
      // "한터/서클 차트 안내" 체크 변경 → 저장 → 리로드 → 유지 확인
      // (날짜 입력 불필요한 체크박스를 대상으로 테스트)

      // Step 1: 공지 섹션으로 스크롤
      await updatePage.scrollToNoticeSection();

      // Step 2: 현재 "한터/서클 차트 안내" 체크 상태 기록
      const originalState =
        await updatePage.getNoticeCheckboxState("한터/서클 차트 안내");

      // Step 3: 체크박스 토글
      const newState =
        await updatePage.toggleNoticeCheckbox("한터/서클 차트 안내");
      expect(newState).not.toBe(originalState);

      // Step 4: 저장 후 페이지 재진입
      await updatePage.saveAndReload();

      // Step 5: 체크박스가 변경된 값으로 유지되는지 검증
      await updatePage.scrollToNoticeSection();
      const savedState =
        await updatePage.getNoticeCheckboxState("한터/서클 차트 안내");
      expect(savedState).toBe(newState);

      // Step 6: 원래 상태로 복원 (테스트 데이터 정리)
      if (savedState !== originalState) {
        await updatePage.setNoticeCheckbox(
          "한터/서클 차트 안내",
          originalState,
        );
        await updatePage.saveWithConfirm();
      }
    });

    test("PRD-UPDATE-04: 다른 항목 수정 후 저장 시 체크박스 유지 확인", async ({
      page,
    }) => {
      // CT-232 핵심 시나리오:
      // 체크박스 변경 없이 다른 영역 접근 → 저장 → 체크박스 유지 확인

      // Step 1: 공지 섹션으로 스크롤 후 현재 체크 상태 기록
      await updatePage.scrollToNoticeSection();
      const beforeStates = await updatePage.getAllNoticeCheckboxStates();

      // Step 2: 페이지 상단으로 이동 (다른 영역 접근 시뮬레이션)
      await page.evaluate(() => window.scrollTo(0, 0));
      await waitForPageStable(page);

      // Step 3: 저장
      await updatePage.saveAndReload();

      // Step 4: 모든 체크박스가 변경되지 않고 유지되는지 확인
      await updatePage.scrollToNoticeSection();
      const afterStates = await updatePage.getAllNoticeCheckboxStates();

      for (let i = 0; i < beforeStates.length; i++) {
        expect(afterStates[i].checked).toBe(beforeStates[i].checked);
      }
    });
  });
});
