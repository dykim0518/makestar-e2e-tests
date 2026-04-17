/**
 * POCAAlbum Admin 대시보드 테스트
 *
 * ============================================================================
 * Section 1: 대시보드 컴포넌트 검증 (/pocaalbum/test)
 * ============================================================================
 *   PA-PAGE-01 ~ PA-PAGE-09: 페이지 접근 / 기본 요소
 *   PA-NAV-01 ~ PA-NAV-02:  시스템 타이틀 / 사이드바 네비게이션
 *   PA-DATA-01 ~ PA-DATA-02: 통계 카드 / 사용자 이메일
 *   PA-TABLE-01 ~ PA-TABLE-05: 앨범 테이블 검증
 *   PA-COMP-01 ~ PA-COMP-06: 컴포넌트 기능 검증
 *   PA-PAGIN-01: 페이지네이션
 *
 * @see tests/pages/ (POM 클래스)
 * @see tests/helpers/admin/ (인증/공통 유틸)
 */
import { test, expect } from "@playwright/test";
import {
  PocaDashboardPage,
  POCA_SIDEBAR_MENUS,
  POCA_DASHBOARD_CARDS,
  POCA_VALID_STATUSES,
  POCA_SECTIONS,
} from "./pages";
import { setupApiInterceptor } from "./helpers/admin";
import {
  waitForPageStable,
  applyAdminTestConfig,
} from "./helpers/admin/test-helpers";

// 공통 설정 (토큰검증 + 뷰포트체크 + 인증쿠키)
applyAdminTestConfig("포카앨범");

// ##############################################################################
// Section 1: 대시보드 컴포넌트 검증 (/pocaalbum/test)
// ##############################################################################
test.describe("POCAAlbum Admin 대시보드 @suite:exploratory", () => {
  let pocaPage: PocaDashboardPage;

  test.beforeEach(async ({ page }) => {
    await setupApiInterceptor(page);
    pocaPage = new PocaDashboardPage(page);
    await pocaPage.navigate();
    await waitForPageStable(page);
  });

  // ========================================================================
  // P0: 페이지 접근 및 기본 요소
  // ========================================================================
  test.describe("페이지 로드 및 기본 요소", () => {
    test("PA-PAGE-01: 페이지 타이틀에 MAKESTAR Admin 포함", async () => {
      await pocaPage.assertPageTitle();
    });

    test('PA-PAGE-02: 대시보드 헤딩 "검보" 표시', async () => {
      await pocaPage.assertHeading();
    });

    test("PA-PAGE-03: 자동 로그아웃 타이머 표시", async () => {
      await pocaPage.assertAutoLogoutTimer();
    });

    test("PA-PAGE-04: 사이드바 구조 및 메뉴 표시", async () => {
      // 사이드바 컨테이너 가시성 검증
      await expect(pocaPage.sidebar).toBeVisible({ timeout: 10000 });

      // 사이드바 타이틀 검증
      await expect(pocaPage.sidebarTitle).toBeVisible({ timeout: 5000 });

      const email = await pocaPage.getUserEmail();
      expect(
        email,
        "❌ 사이드바에 사용자 이메일이 표시되어야 합니다",
      ).toContain("@");

      const sidebarButtons = pocaPage.sidebar.locator("button");
      const buttonCount = await sidebarButtons.count();
      expect(
        buttonCount,
        "❌ 사이드바 상단 컨트롤 버튼이 2개 이상이어야 합니다",
      ).toBeGreaterThanOrEqual(2);
    });

    test("PA-PAGE-05: 대시보드 통계 카드 4개 표시", async () => {
      await pocaPage.assertDashboardCards();
    });

    test("PA-PAGE-06: 테이블 렌더링 확인", async () => {
      await expect(pocaPage.table.first()).toBeVisible({ timeout: 10000 });
    });

    test("PA-PAGE-07: 테이블 헤더 컬럼 검증", async () => {
      await pocaPage.assertTableHeaders(pocaPage.getExpectedHeaders());
    });

    test("PA-PAGE-08: 테이블 데이터 행 1개 이상 존재", async () => {
      await expect(pocaPage.tableRows.first()).toBeVisible({ timeout: 10000 });
      const rowCount = await pocaPage.tableRows.count();
      expect(rowCount).toBeGreaterThan(0);
    });

    test("PA-PAGE-09: 페이지네이션 컴포넌트 표시", async () => {
      const pagination = pocaPage.paginationNav.first();
      await pagination.scrollIntoViewIfNeeded().catch(() => {});
      await expect(pagination).toBeVisible({ timeout: 10000 });
    });
  });

  // ========================================================================
  // P0-P1: 데이터 정합성
  // ========================================================================
  test.describe("데이터 정합성", () => {
    test('PA-NAV-01: 시스템 타이틀 "포카앨범 관리시스템" 표시', async () => {
      await pocaPage.assertSystemTitle();
    });

    test("PA-DATA-01: 통계 카드 제목 4개 표시", async () => {
      for (const cardTitle of POCA_DASHBOARD_CARDS) {
        const card = pocaPage.getDashboardCard(cardTitle);
        await expect(card).toBeVisible({ timeout: 5000 });
        const text = await card.textContent();
        expect(text?.trim()).toBeTruthy();
      }
    });

    test("PA-DATA-02: 사용자 이메일이 사이드바에 표시", async () => {
      const email = await pocaPage.getUserEmail();
      expect(email).toContain("@");
    });
  });

  // ========================================================================
  // P0-P1: 앨범 테이블 검증
  // ========================================================================
  test.describe("앨범 테이블 검증", () => {
    test("PA-TABLE-01: 테이블 체크박스 존재 확인", async ({ page }) => {
      const checkboxes = page.getByRole("checkbox");
      await expect(checkboxes.first()).toBeVisible({ timeout: 10000 });
      const count = await checkboxes.count();
      expect(count).toBeGreaterThan(0);
    });

    test("PA-TABLE-02: 첫 번째 행 앨범명이 비어있지 않음", async () => {
      const albumName = await pocaPage.getFirstRowAlbumName();
      expect(albumName).toBeTruthy();
      expect(albumName.length).toBeGreaterThan(0);
    });

    test("PA-TABLE-03: 첫 번째 행 아티스트가 비어있지 않음", async () => {
      const artist = await pocaPage.getFirstRowArtist();
      expect(artist).toBeTruthy();
      expect(artist.length).toBeGreaterThan(0);
    });

    test("PA-TABLE-04: 상태 컬럼에 유효한 값 표시", async () => {
      const status = await pocaPage.getFirstRowStatus();
      expect(POCA_VALID_STATUSES as readonly string[]).toContain(status);
    });

    test("PA-TABLE-05: 액션 컬럼에 수정/삭제 버튼 존재", async () => {
      const actionButtons = pocaPage.getFirstRowActionButtons();
      const count = await actionButtons.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // 수정, 삭제 버튼 텍스트 확인
      const texts: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = (await actionButtons.nth(i).textContent())?.trim() || "";
        texts.push(text);
      }
      expect(texts).toContain("수정");
      expect(texts).toContain("삭제");
    });
  });

  // ========================================================================
  // P1: 사이드바 네비게이션
  // ========================================================================
  test.describe("사이드바 네비게이션", () => {
    test("PA-NAV-02: 사이드바 상단 컨트롤이 노출된다", async () => {
      const sidebarButtons = pocaPage.sidebar.locator("button");
      const buttonCount = await sidebarButtons.count();
      expect(
        buttonCount,
        "❌ 사이드바 상단 컨트롤 버튼이 보이지 않습니다",
      ).toBeGreaterThanOrEqual(2);

      await expect(sidebarButtons.first()).toBeVisible({ timeout: 5000 });
      await expect(sidebarButtons.nth(1)).toBeVisible({ timeout: 5000 });

      const errorCount = await pocaPage.page
        .locator(
          '[class*="error"]:visible, :text("에러"):visible, :text("오류"):visible',
        )
        .count();
      expect(errorCount, "❌ 대시보드 초기 렌더링 중 오류 요소가 감지되었습니다").toBe(
        0,
      );
    });
  });

  // ========================================================================
  // P1-P2: 컴포넌트 기능 검증
  // ========================================================================
  test.describe("컴포넌트 기능 검증", () => {
    test("PA-COMP-01: Editor 렌더링 + 툴바 버튼 존재", async () => {
      const visible = await pocaPage.isEditorVisible();
      expect(visible).toBe(true);

      const toolbarCount = await pocaPage.getEditorToolbarButtonCount();
      expect(toolbarCount).toBeGreaterThan(5);
    });

    test("PA-COMP-02: ImageDetailUpload 영역 렌더링", async ({ page }) => {
      const heading = await pocaPage.scrollToSection(POCA_SECTIONS.imageUpload);
      await expect(heading).toBeVisible();

      const uploadBtn = page.getByRole("button", { name: "업로드 하기" });
      await expect(uploadBtn).toBeVisible({ timeout: 5000 });
    });

    test("PA-COMP-03: MobilePreview 프레임 렌더링", async () => {
      const visible = await pocaPage.isMobilePreviewVisible();
      expect(visible).toBe(true);
    });

    test("PA-COMP-04: FaveShot 카드 렌더링 + 이미지 4개 표시", async ({
      page,
    }) => {
      const heading = await pocaPage.scrollToSection(POCA_SECTIONS.faveShot);
      await expect(heading).toBeVisible();

      for (const name of ["사엔", "민지", "하늘", "지우"]) {
        await expect(page.getByAltText(name)).toBeVisible({ timeout: 5000 });
      }
    });

    test("PA-COMP-05: UserSearchDialog 열기", async ({ page }) => {
      await pocaPage.scrollToSection(POCA_SECTIONS.userSearchDialog);
      const trigger = pocaPage.getUserSearchDialogTrigger();
      await expect(trigger).toBeVisible({ timeout: 5000 });

      await pocaPage.openUserSearchDialog();

      const dialog = page
        .getByRole("dialog")
        .or(page.locator('[class*="dialog"], [class*="modal"]'))
        .first();
      await expect(dialog).toBeVisible({ timeout: 5000 });
    });

    test("PA-COMP-06: 파일 업로드 탭 전환", async ({ page }) => {
      await pocaPage.scrollToSection(POCA_SECTIONS.fileUpload);

      // 이미지 업로드, 비디오 업로드, 비교표 탭 확인
      const imageTab = page.getByRole("button", { name: "이미지 업로드" });
      const videoTab = page.getByRole("button", { name: "비디오 업로드" });
      const compareTab = page.getByRole("button", { name: "비교표" });

      await expect(imageTab).toBeVisible({ timeout: 5000 });
      await expect(videoTab).toBeVisible({ timeout: 5000 });
      await expect(compareTab).toBeVisible({ timeout: 5000 });

      // 비디오 업로드 탭 클릭
      await videoTab.click();
      // 탭 활성화 확인 (brand1 색상 클래스)
      await expect(videoTab).toHaveClass(/text-brand1/);

      // 비교표 탭 클릭
      await compareTab.click();
      await expect(compareTab).toHaveClass(/text-brand1/);
    });
  });

  // ========================================================================
  // P1: 페이지네이션
  // ========================================================================
  test.describe("페이지네이션", () => {
    test("PA-PAGIN-01: 페이지네이션 버튼 클릭 동작", async () => {
      const hasPagination = await pocaPage.hasPagination();
      if (!hasPagination) {
        const rowCount = await pocaPage.tableRows.count();
        expect(
          rowCount,
          `❌ 페이지네이션이 없는데 행 수(${rowCount})가 단일 페이지 기준을 벗어났습니다.`,
        ).toBeLessThanOrEqual(10);
        console.log("  ✅ 단일 페이지 상태 확인 — 페이지네이션 없음");
      } else {
        // 페이지 1 버튼이 존재하는지 확인
        const page1Button = pocaPage.paginationNav.getByRole("button", {
          name: "1",
          exact: true,
        });
        await expect(page1Button).toBeVisible();
      }
    });
  });
});
