/**
 * Admin 배너설정 테스트 (/contents/banner/list)
 *
 * read-only:
 *   BNR-PAGE-01: 헤딩·목록·미리보기 영역 노출
 *   BNR-PAGE-02: 전시중/대기중 탭 전환
 *   BNR-ACTION-01: 메인배너 갯수 설정 모달 열기
 *   BNR-ACTION-02: 메인배너 갯수 설정 모달 취소 닫기
 *   BNR-ACTION-03: 갯수 변경 시 종류 라벨 반영 및 새로고침 후 유지 (@write)
 *   BNR-CREATE-01: 배너 등록 모달 열기
 *   BNR-CREATE-02: 배너 등록 모달 필드 노출 검증
 *   BNR-CREATE-03: 배너 등록 모달 X 버튼 닫기
 *
 * 쓰기:
 *   BNR-CREATE-04: 빈 폼 제출 → "대분류를 선택해주세요" 유효성 (negative)
 *   BNR-CREATE-05: 필수값 입력 후 등록 → 모달 닫힘 + 목록(대기중) 노출
 *
 * 보류 (별도 follow-up):
 *   BNR-DELETE-*: 등록 행 삭제 액션 미구현 (인라인/편집 모달 어디에도 없음). 누적 정리는 별도 작업.
 *
 * @see tests/pages/admin-banner-list.page.ts
 */
import { test, expect } from "@playwright/test";
import path from "path";
import { BannerListPage } from "./pages";
import {
  waitForPageStable,
  applyAdminTestConfig,
} from "./helpers/admin/test-helpers";
import { setupAuthCookies } from "./helpers/admin";

applyAdminTestConfig("배너설정");

test.describe("Admin 배너설정 @feature:admin_makestar.banner.list", () => {
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

    // stage에는 설정값을 되읽을 UI·API 수단이 없다(모달 input은 항상 "1"로 보정,
    // list_displaying_banner는 배너 목록만 반환). "종류=메인" 칩 수도 설정 갯수가 아니라
    // 실제 전시중 배너 수에 종속되어 설정값 검증에 쓸 수 없다.
    // 따라서 갯수 변경의 백엔드 반영은 update_main_banner_count PUT 응답(200 + result:true)으로만
    // 검증 가능하다(영속성/UI 반영 검증은 수단 부재로 불가). finally에서 기존 값으로 복원.
    test("BNR-ACTION-03: 메인배너 갯수 변경 요청이 백엔드에서 수락됨 (PUT 200·result) @write", async () => {
      // 모달 input이 항상 "1"이라 현재 설정값을 읽을 수 없어, stage 시드 기준값(1)을
      // 복원값으로 두고 1 → 2 → 1 변경 쌍으로만 다룬다.
      const original = 1;
      const target = 2;

      try {
        const changed = await bannerPage.setMainBannerCount(target);
        expect(
          changed.status,
          `❌ 갯수 변경 PUT이 200이어야 함 (받은 status: ${changed.status})`,
        ).toBe(200);
        expect(
          changed.result,
          "❌ 갯수 변경 PUT 응답 result가 true여야 함 (백엔드 수락 검증)",
        ).toBe(true);
      } finally {
        const restored = await bannerPage.setMainBannerCount(original);
        expect(
          restored.status,
          `❌ 원상복귀 PUT이 200이어야 함 (받은 status: ${restored.status})`,
        ).toBe(200);
        expect(
          restored.result,
          "❌ 원상복귀 PUT 응답 result가 true여야 함",
        ).toBe(true);
      }
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
  // 데이터 변경 (쓰기) — 유효성(negative)과 성공 케이스. 갯수 변경은 위 모달 describe.
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

  // 등록 성공 케이스 — 데이터 누적되므로 별도 describe로 격리.
  // 1년 후 일자/오전 00:00 시간으로 등록해 운영 노출과 격리.
  test.describe("배너 등록 — 성공 @write", () => {
    test("BNR-CREATE-05: 필수값 입력 후 등록 시 모달 닫힘 + 목록에 신규 행 노출", async () => {
      const ts = Date.now();
      const bannerName = `AUTOTEST_BNR_${ts}`;
      const imagePath = path.resolve("tests/fixtures/dummy-popup.png");

      await bannerPage.openRegisterModal();

      await bannerPage.selectFirstCategory();
      await bannerPage.uploadBannerImages(imagePath);
      await bannerPage.fillBannerName(bannerName);
      await bannerPage.fillAllLangDescriptions(`자동화 등록 ${ts}`);
      // 시작/종료 모두 12개월 후 오늘 일자 + 시간은 첫 옵션(오전 00:00)
      await bannerPage.setPeriodMonthsAhead(12, new Date().getDate());

      await bannerPage.submitAndExpectListEntry(bannerName);
    });
  });
});
