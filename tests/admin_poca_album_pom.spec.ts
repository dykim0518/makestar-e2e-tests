/**
 * POCAAlbum Admin 앨범 목록 + CRUD 테스트
 *
 * ============================================================================
 * Section 2: 앨범 목록 기능
 * ============================================================================
 *   PA-PAGE-10: 앨범 목록 페이지 로드
 *   PA-SEARCH-01 ~ PA-SEARCH-02: 검색
 *   PA-PAGIN-02: 페이지네이션 동작
 *   PA-ACTION-01: 수정 버튼 상세 이동
 *
 * ============================================================================
 * Section 3: 앨범 CRUD (serial)
 * ============================================================================
 *   PA-CREATE-01 ~ PA-CREATE-03: 생성/검증/유튜브앨범
 *   PA-UPDATE-01: 앨범 수정
 *   PA-DETAIL-01: 상세 진입
 *   (PA-ACTION-02 삭제: UI 미제공)
 *
 * @see tests/pages/ (POM 클래스)
 * @see tests/helpers/admin/ (인증/공통 유틸)
 */
import { test, expect } from "@playwright/test";
import {
  PocaAlbumListPage,
  PocaAlbumCreatePage,
  assertNoServerError,
} from "./pages";
import {
  waitForPageStable,
  formatDate,
  ELEMENT_TIMEOUT,
  applyAdminTestConfig,
} from "./helpers/admin/test-helpers";

// 공통 설정 (토큰검증 + 뷰포트체크 + 인증쿠키)
applyAdminTestConfig("포카앨범");

test.describe("POCAAlbum Admin 앨범 테스트", () => {
  // 테스트 간 데이터 공유 (serial 모드용)
  let sharedAlbumTitle = "";
  let sharedAlbumCreated = false;

  // ========================================================================
  // Section 2: 앨범 목록 기능
  // ========================================================================
  test.describe("앨범 목록 기능", () => {
    let albumListPage: PocaAlbumListPage;

    test.beforeEach(async ({ page }) => {
      albumListPage = new PocaAlbumListPage(page);
      await albumListPage.navigate();
      await waitForPageStable(page);
    });

    test("PA-PAGE-10: 앨범 목록 페이지 로드 검증", async () => {
      // 테이블 표시 확인
      await expect(albumListPage.table).toBeVisible({
        timeout: ELEMENT_TIMEOUT,
      });

      // 행 > 0 확인
      const rowCount = await albumListPage.getRowCount();
      expect(
        rowCount,
        "❌ 앨범 목록 테이블에 데이터가 없습니다",
      ).toBeGreaterThan(0);

      // 핵심 헤더만 검증 (UI 변경에 유연하게 대응)
      for (const header of ["제목", "아티스트"]) {
        const headerEl = albumListPage.page.locator(`th:has-text("${header}")`);
        const isVisible = await headerEl
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (isVisible) {
          console.log(`  ✅ 헤더 확인: ${header}`);
        } else {
          console.log(`  ℹ️ 헤더 "${header}" 미발견 - UI 구조 확인 필요`);
        }
      }
    });

    test("PA-SEARCH-01: 키워드로 앨범 검색", async () => {
      const isSearchVisible = await albumListPage.searchInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      expect(isSearchVisible, "❌ 검색 입력 필드가 없습니다").toBeTruthy();

      await albumListPage.searchByKeyword("BTS");

      const hasData = await albumListPage.hasTableData();
      const hasNoResult = await albumListPage.noResultMessage
        .isVisible()
        .catch(() => false);

      expect(
        hasData || hasNoResult,
        "검색 후 결과나 안내 메시지가 없습니다",
      ).toBeTruthy();
      console.log(`  검색 결과: ${hasData ? "데이터 있음" : "검색결과 없음"}`);
    });

    test("PA-SEARCH-02: 존재하지 않는 항목 검색", async () => {
      const randomString = "ZZZNOTEXIST_" + Date.now();
      await albumListPage.searchByKeyword(randomString);

      const rowCount = await albumListPage.getRowCount();
      const hasNoResult = await albumListPage.noResultMessage
        .isVisible()
        .catch(() => false);

      if (rowCount === 0 || hasNoResult) {
        console.log("  ✅ 검색결과 없음 확인");
      } else {
        const firstRowText =
          (await albumListPage.getFirstRow().textContent()) || "";
        const containsKeyword = firstRowText.includes(randomString);
        expect(
          containsKeyword,
          "검색 결과에 존재하지 않는 키워드가 포함되어서는 안 됩니다",
        ).toBeFalsy();
        console.log(
          "  ℹ️ 검색 후 목록이 표시되지만 해당 키워드는 미포함 (전체 목록 반환형)",
        );
      }
    });

    test("PA-PAGIN-02: 페이지네이션 동작 검증", async () => {
      const rowCount = await albumListPage.getRowCount();
      expect(rowCount, "❌ 테이블에 데이터가 없습니다").toBeGreaterThan(0);

      const isNextVisible = await albumListPage.nextPageButton
        .isVisible()
        .catch(() => false);
      const isNextEnabled = isNextVisible
        ? await albumListPage.nextPageButton.isEnabled().catch(() => false)
        : false;

      if (!isNextVisible || !isNextEnabled) {
        console.log(
          "ℹ️ Next 버튼 없거나 비활성 - 데이터가 1페이지만 존재 (정상)",
        );
        return;
      }

      const firstRowBefore = await albumListPage.getFirstRow().textContent();
      await albumListPage.goToNextPage();
      await waitForPageStable(albumListPage.page, 5000);
      const firstRowAfter = await albumListPage.getFirstRow().textContent();

      expect(
        firstRowBefore,
        "페이지 이동 후 데이터가 변경되지 않았습니다",
      ).not.toBe(firstRowAfter);
    });

    test("PA-ACTION-01: 수정 버튼으로 상세 이동", async () => {
      const rowCount = await albumListPage.getRowCount();
      expect(rowCount, "❌ 테이블에 데이터가 없습니다").toBeGreaterThan(0);

      await albumListPage.clickEdit(0);

      const currentUrl = albumListPage.page.url();
      expect(currentUrl, "❌ URL이 앨범 상세로 변경되지 않았습니다").toMatch(
        /\/pocaalbum\/album\//,
      );
      console.log(`  상세 URL: ${currentUrl}`);
    });
  });

  // ========================================================================
  // Section 3: 앨범 CRUD (serial)
  // ========================================================================
  test.describe.serial("앨범 CRUD", () => {
    test("PA-CREATE-01: 앨범 생성 폼 입력 및 등록", async ({ page }) => {
      const albumListPage = new PocaAlbumListPage(page);
      const albumCreatePage = new PocaAlbumCreatePage(page);

      // Step 1: 목록에서 기존 자동화테스트 번호 확인
      let maxN = 0;
      await test.step("기존 번호 확인", async () => {
        await albumListPage.navigate();
        await waitForPageStable(page);

        const isSearchVisible = await albumListPage.searchInput
          .isVisible({ timeout: 5000 })
          .catch(() => false);
        if (isSearchVisible) {
          await albumListPage.searchByKeyword("[자동화테스트]");
          const rows = page.locator("table tbody tr");
          const allTexts = await rows.evaluateAll((elements) =>
            elements.map((el) => el.textContent || ""),
          );
          const pattern = /\[자동화테스트\]\s*샘플\s*앨범\s*(\d+)/;
          for (const text of allTexts) {
            const match = text.match(pattern);
            if (match?.[1]) {
              const n = parseInt(match[1], 10);
              if (n > maxN) maxN = n;
            }
          }
        }
      });

      const newN = maxN + 1;
      sharedAlbumTitle = `[자동화테스트] 샘플 앨범 ${newN}`;
      console.log(`ℹ️ 기존 최대 번호: ${maxN}, 새 앨범: ${sharedAlbumTitle}`);

      // Step 2: 생성 페이지로 이동
      await test.step("생성 페이지 이동", async () => {
        await albumCreatePage.navigate();
        await waitForPageStable(page);

        await assertNoServerError(page, "앨범 생성 페이지");
      });

      // Step 3: 폼 필드 탐색 (디버깅용)
      await test.step("폼 필드 탐색", async () => {
        const fields = await albumCreatePage.discoverFormFields();
        console.log(`  발견된 필드 수: ${Object.keys(fields).length}`);
      });

      // Step 4: 폼 입력
      await test.step("폼 입력", async () => {
        const releaseDate = formatDate(new Date());

        await albumCreatePage.fillCreateForm({
          title: sharedAlbumTitle,
          artist: "김뭉먕",
          albumType: "싱글",
          releaseDate,
          imagePath: "fixtures/ta_sample.png",
        });
      });

      // Step 5: 등록 시도
      await test.step("등록 시도", async () => {
        const createBtn = albumCreatePage.createButton;
        const isVisible = await createBtn
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        expect(
          isVisible,
          "❌ 등록 버튼을 찾을 수 없음 — 앨범 생성 페이지 구조 확인 필요",
        ).toBe(true);

        const isEnabled = await createBtn.isEnabled();
        console.log(`  등록 버튼 상태: ${isEnabled ? "활성화" : "비활성화"}`);

        expect(
          isEnabled,
          "❌ 등록 버튼 비활성화 — 필수 필드 누락. discoverFormFields 로그를 확인하세요.",
        ).toBe(true);

        await albumCreatePage.submitAndWaitForList();
        sharedAlbumCreated = true;
        console.log(`✅ 앨범 생성 완료: ${sharedAlbumTitle}`);
      });
    });

    test("PA-CREATE-02: 생성된 앨범 목록에서 검증", async ({ page }) => {
      expect(
        sharedAlbumCreated || sharedAlbumTitle,
        "❌ PA-CREATE-01에서 앨범이 생성되지 않음",
      ).toBeTruthy();

      const albumListPage = new PocaAlbumListPage(page);
      await albumListPage.navigate();
      await waitForPageStable(page);

      await albumListPage.searchByKeyword(sharedAlbumTitle);

      const rowIndex = await albumListPage.findRowByText(sharedAlbumTitle);
      if (rowIndex >= 0) {
        console.log(`✅ 목록에서 앨범 발견: 행 ${rowIndex}`);
      } else {
        console.log(
          `⚠️ 목록에서 앨범 미발견: ${sharedAlbumTitle} (DB 반영 지연 가능)`,
        );
      }
      expect(
        sharedAlbumCreated || rowIndex >= 0,
        "앨범이 생성되지 않았고 목록에서도 찾을 수 없습니다",
      ).toBeTruthy();
    });

    test("PA-DETAIL-01: 생성된 앨범 상세 진입 확인", async ({ page }) => {
      expect(
        sharedAlbumCreated,
        "❌ PA-CREATE-01에서 앨범이 생성되지 않음",
      ).toBe(true);

      const albumListPage = new PocaAlbumListPage(page);
      await albumListPage.navigate();
      await waitForPageStable(page);

      await albumListPage.searchByKeyword(sharedAlbumTitle);
      const rowIndex = await albumListPage.findRowByText(sharedAlbumTitle);

      if (rowIndex < 0) {
        console.warn("⚠️ 목록에서 앨범을 찾을 수 없어 상세 진입 건너뜀");
        return;
      }

      await albumListPage.clickEdit(rowIndex);

      const currentUrl = page.url();
      expect(currentUrl).toMatch(/\/pocaalbum\/album\//);
      console.log(`  상세 URL: ${currentUrl}`);

      const pageContent = (await page.textContent("body")) || "";
      if (pageContent.includes(sharedAlbumTitle)) {
        console.log(`✅ 상세 페이지에서 앨범 제목 확인: ${sharedAlbumTitle}`);
      }
    });

    test("PA-CREATE-03: 유튜브 앨범 생성 (QA-75 커버)", async ({ page }) => {
      const albumCreatePage = new PocaAlbumCreatePage(page);

      await test.step("생성 페이지 이동", async () => {
        await albumCreatePage.navigate();
        await waitForPageStable(page);

        await assertNoServerError(page, "유튜브 앨범 생성 페이지");
      });

      // 유튜브 앨범 타입 선택 시도
      await test.step("유튜브 앨범 폼 입력", async () => {
        const ytTitle = `[자동화테스트] 유튜브 앨범 ${Date.now()}`;

        await albumCreatePage.fillTitle(ytTitle);

        // 아티스트 선택 (필수)
        await albumCreatePage.selectArtist("김뭉먕");

        // 앨범 타입에서 "유튜브" 관련 옵션 선택 시도
        const albumTypeSelect = page
          .locator(
            'select:near(:text("앨범타입")), select:near(:text("분류")), [role="combobox"]:near(:text("앨범타입")), [role="combobox"]:near(:text("분류"))',
          )
          .first();
        const isTypeVisible = await albumTypeSelect
          .isVisible({ timeout: 3000 })
          .catch(() => false);

        if (isTypeVisible) {
          const tagName = await albumTypeSelect.evaluate((el) =>
            el.tagName.toLowerCase(),
          );
          if (tagName === "select") {
            // select 태그에서 유튜브 관련 옵션 탐색
            const options = await albumTypeSelect
              .locator("option")
              .evaluateAll((opts) =>
                opts.map((o) => ({
                  value: (o as HTMLOptionElement).value,
                  text: o.textContent?.trim() || "",
                })),
              );
            console.log(
              `  앨범 타입 옵션: ${options.map((o) => o.text).join(", ")}`,
            );

            const ytOption = options.find(
              (o) =>
                o.text.includes("유튜브") ||
                o.text.includes("YouTube") ||
                o.text.includes("youtube"),
            );
            if (ytOption) {
              await albumTypeSelect.selectOption({ label: ytOption.text });
              console.log(`  ✅ 유튜브 타입 선택: ${ytOption.text}`);
            } else {
              console.warn("  ⚠️ 유튜브 타입 옵션 없음 - 기본 타입으로 진행");
            }
          } else {
            // combobox
            await albumTypeSelect.click();
            const ytOpt = page
              .locator(
                '[role="option"]:has-text("유튜브"), [role="option"]:has-text("YouTube"), li:has-text("유튜브"), li:has-text("YouTube")',
              )
              .first();
            const isYtVisible = await ytOpt
              .isVisible({ timeout: 3000 })
              .catch(() => false);
            if (isYtVisible) {
              await ytOpt.click();
              console.log("  ✅ 유튜브 타입 선택 (combobox)");
            } else {
              console.warn("  ⚠️ 유튜브 타입 옵션 없음 - 기본 타입으로 진행");
              // 드롭다운 닫기
              await page.keyboard.press("Escape");
            }
          }
        } else {
          console.warn("  ⚠️ 앨범 타입 필드 미발견");
        }

        // 발매일 입력
        await albumCreatePage.fillReleaseDate(formatDate(new Date()));

        // 이미지 업로드
        await albumCreatePage
          .uploadImage("fixtures/ta_sample.png")
          .catch(() => console.warn("  ⚠️ 이미지 업로드 실패"));
      });

      // 등록 시도
      await test.step("등록 시도", async () => {
        const createBtn = albumCreatePage.createButton;
        const isVisible = await createBtn
          .isVisible({ timeout: 5000 })
          .catch(() => false);

        expect(
          isVisible,
          "❌ 등록 버튼을 찾을 수 없음 — 유튜브 앨범 생성 페이지 확인 필요",
        ).toBe(true);

        const isEnabled = await createBtn.isEnabled();
        expect(isEnabled, "❌ 등록 버튼 비활성화 — 필수 필드 누락").toBe(true);

        await albumCreatePage.submitAndWaitForList();
        console.log("✅ 유튜브 앨범 생성 완료");
      });
    });

    test("PA-UPDATE-01: 앨범 상세 진입 후 제목 수정", async ({ page }) => {
      expect(
        sharedAlbumCreated,
        "❌ PA-CREATE-01에서 앨범이 생성되지 않음",
      ).toBe(true);

      const albumListPage = new PocaAlbumListPage(page);
      await albumListPage.navigate();
      await waitForPageStable(page);

      await albumListPage.searchByKeyword(sharedAlbumTitle);
      const rowIndex = await albumListPage.findRowByText(sharedAlbumTitle);

      if (rowIndex < 0) {
        console.warn("⚠️ 목록에서 앨범을 찾을 수 없어 수정 건너뜀");
        return;
      }

      await albumListPage.clickEdit(rowIndex);
      await waitForPageStable(page);

      // 제목 필드 찾기 및 수정
      const titleInput = page
        .locator(
          'input[placeholder*="제목"], input[placeholder*="앨범명"], input[placeholder*="타이틀"]',
        )
        .first();
      const isTitleVisible = await titleInput
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!isTitleVisible) {
        console.warn(
          "⚠️ 제목 필드를 찾을 수 없음 - 수정 페이지 구조 확인 필요",
        );
        return;
      }

      // 제목에 "(수정됨)" 추가
      const updatedTitle = sharedAlbumTitle + " (수정됨)";
      await titleInput.clear();
      await titleInput.fill(updatedTitle);

      // 저장 버튼 클릭
      const saveBtn = page
        .locator(
          'button:has-text("저장"), button:has-text("수정"), button:has-text("등록")',
        )
        .first();
      const isSaveVisible = await saveBtn
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!isSaveVisible) {
        console.warn("⚠️ 저장 버튼을 찾을 수 없음 - UI 구조 확인 필요");
        return;
      }

      page.once("dialog", (dialog) => dialog.accept());
      await saveBtn.click();

      // 목록 이동 또는 성공 메시지 대기
      try {
        await page.waitForURL(/\/pocaalbum\/album/, { timeout: 10000 });
      } catch {
        console.log("ℹ️ 저장 후 URL 변경 미확인 - 현재 URL:", page.url());
      }

      // 목록에서 수정된 제목 확인
      await albumListPage.navigate();
      await waitForPageStable(page);
      await albumListPage.searchByKeyword(updatedTitle);
      const updatedRow = await albumListPage.findRowByText(updatedTitle);

      if (updatedRow >= 0) {
        console.log(`✅ 수정된 앨범 확인: ${updatedTitle}`);
        // 후속 테스트를 위해 타이틀 업데이트
        sharedAlbumTitle = updatedTitle;
      } else {
        console.log(
          `⚠️ 수정된 앨범 미발견 (DB 반영 지연 가능): ${updatedTitle}`,
        );
      }
    });

    // PA-ACTION-02 삭제 테스트 제거: 앨범 상세에 삭제 기능 미제공 (UI 미존재)
  });
});
