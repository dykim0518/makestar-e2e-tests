/**
 * Admin 배너설정 테스트 (/contents/banner/list)
 *
 * read-only:
 *   BNR-PAGE-01: 헤딩·목록·미리보기 영역 노출
 *   BNR-PAGE-02: 전시중/대기중 탭 전환
 *   BNR-ACTION-01: 메인배너 갯수 설정 모달 열기
 *   BNR-ACTION-02: 메인배너 갯수 설정 모달 취소 닫기
 *   BNR-CREATE-01: 배너 등록 모달 열기
 *   BNR-CREATE-02: 배너 등록 모달 필드 노출 검증
 *   BNR-CREATE-03: 배너 등록 모달 X 버튼 닫기
 *   BNR-CREATE-04: 빈 폼 제출 → "대분류를 선택해주세요" 유효성 (negative)
 *
 * 보류 (별도 follow-up):
 *   BNR-ACTION-03: 갯수 변경 — stage 백엔드 보정 추정, 수동 재현 후 결정
 *   BNR-CREATE-05: 필수값 입력 후 등록 — Vue multiselect 시간 dropdown + 데이터 누적 부담
 *
 * @see tests/pages/admin-banner-list.page.ts
 */
import { test, expect } from "@playwright/test";
import { BannerListPage } from "./pages";
import {
  waitForPageStable,
  applyAdminTestConfig,
} from "./helpers/admin/test-helpers";
import { setupAuthCookies } from "./helpers/admin";

applyAdminTestConfig("배너설정");

test.describe("Admin 배너설정", () => {
  let bannerPage: BannerListPage;

  test.beforeEach(async ({ page }) => {
    await setupAuthCookies(page);
    bannerPage = new BannerListPage(page);
    await bannerPage.navigate();
    await bannerPage.waitForReady();
    await waitForPageStable(page);
  });

  test.describe("페이지 기본", () => {
    test("BNR-PAGE-01: 배너설정 페이지 로드 시 헤딩·목록·미리보기 노출", async () => {
      await expect(bannerPage.heading).toBeVisible();
      await expect(bannerPage.listSectionHeading).toBeVisible();
      await expect(bannerPage.previewSection).toBeVisible();
      await expect(bannerPage.displayedTab).toBeVisible();
      await expect(bannerPage.waitingTab).toBeVisible();
      await expect(bannerPage.registerButton).toBeVisible();
      await expect(bannerPage.mainBannerCountButton).toBeVisible();
    });

    test("BNR-PAGE-02: 전시중·대기중 탭 전환 동작", async () => {
      await bannerPage.switchTab("waiting");
      await expect(bannerPage.waitingTab).toBeVisible();
      await expect(bannerPage.listSectionHeading).toBeVisible();

      await bannerPage.switchTab("displayed");
      await expect(bannerPage.displayedTab).toBeVisible();
      await expect(bannerPage.listSectionHeading).toBeVisible();
    });
  });

  test.describe("메인배너 갯수 설정 모달", () => {
    test("BNR-ACTION-01: 모달 열기 시 헤딩·input·안내문·취소·확인 버튼 노출", async () => {
      await bannerPage.openMainBannerCountModal();
      await expect(bannerPage.countModalHeading).toBeVisible();
      await expect(bannerPage.countModalInput).toBeVisible();
      await expect(bannerPage.countModalNotice).toBeVisible();
      await expect(bannerPage.countModalCancelButton).toBeVisible();
      await expect(bannerPage.countModalConfirmButton).toBeVisible();
    });

    test("BNR-ACTION-02: 취소 버튼 클릭 시 모달 닫힘", async () => {
      await bannerPage.openMainBannerCountModal();
      await expect(bannerPage.countModalHeading).toBeVisible();
      await bannerPage.closeMainBannerCountModal();
      await expect(bannerPage.countModalHeading).toBeHidden();
    });
  });

  test.describe("배너 등록 모달", () => {
    test("BNR-CREATE-01: 등록 버튼 클릭 시 모달 노출", async () => {
      await bannerPage.openRegisterModal();
      await expect(bannerPage.registerModalHeading).toBeVisible();
    });

    test("BNR-CREATE-02: 등록 모달 필수 폼 필드 노출", async () => {
      await bannerPage.openRegisterModal();

      // 라벨
      await expect(bannerPage.registerModalCategoryLabel).toBeVisible();
      await expect(bannerPage.registerModalImageLabel).toBeVisible();
      await expect(bannerPage.registerModalDescriptionLabel).toBeVisible();
      await expect(bannerPage.registerModalPeriodLabel).toBeVisible();

      // 이미지 업로드 3종 (가로형/세로형/서브)
      await expect(bannerPage.registerModalImageInputs).toHaveCount(3);

      // 입력 필드
      await expect(bannerPage.registerModalNameInput).toBeVisible();
      await expect(bannerPage.registerModalStartDateInput).toBeVisible();
      await expect(bannerPage.registerModalStartTimeInput).toBeVisible();
      await expect(bannerPage.registerModalEndDateInput).toBeVisible();
      await expect(bannerPage.registerModalEndTimeInput).toBeVisible();

      // 다국어 4개 탭
      await expect(bannerPage.registerModalLangButtons).toHaveCount(4);

      // 메인/서브 배너 토글
      await expect(bannerPage.registerModalMainTypeButton).toBeVisible();
      await expect(bannerPage.registerModalSubTypeButton).toBeVisible();

      // 디바이스 탭
      await expect(bannerPage.registerModalDeviceDesktopTab).toBeVisible();
      await expect(bannerPage.registerModalDeviceMobileTab).toBeVisible();

      // 제출 버튼
      await expect(bannerPage.registerModalSubmitButton).toBeVisible();
    });

    test("BNR-CREATE-03: 등록 모달 닫기 버튼으로 모달 닫힘 (데이터 변경 없음)", async () => {
      await bannerPage.openRegisterModal();
      await expect(bannerPage.registerModalHeading).toBeVisible();
      await bannerPage.closeRegisterModal();
      await expect(bannerPage.registerModalHeading).toBeHidden();
    });
  });

  // ==========================================================================
  // 데이터 변경 (쓰기) — negative만. 등록 성공·갯수 변경은 별도 follow-up
  // ==========================================================================

  test.describe("배너 등록 — 유효성 @write", () => {
    test("BNR-CREATE-04: 빈 폼 제출 시 대분류 필수 유효성 메시지 노출 (negative)", async () => {
      await bannerPage.openRegisterModal();
      await bannerPage.submitRegisterForm();

      const error = bannerPage.errorMessage(/대분류를 선택해주세요/);
      await expect(
        error,
        "❌ '대분류를 선택해주세요' 유효성 메시지가 노출되지 않음",
      ).toBeVisible();

      // 모달은 열린 상태 유지 (저장 시도 후 닫히지 않아야 함)
      await expect(bannerPage.registerModalHeading).toBeVisible();
      await bannerPage.closeRegisterModal();
    });
  });
});
