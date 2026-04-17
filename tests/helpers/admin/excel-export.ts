/**
 * Excel Export 공통 헬퍼
 *
 * Admin의 엑셀 다운로드 버튼을 눌러 파일을 수신합니다.
 * 일부 페이지(주문/회원)는 ISMS 사유 입력 모달이 뜨므로 자동으로 처리합니다.
 */

import type { Page, Locator } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

export type ExcelExportOptions = {
  /** 기본 "업무상 필요" */
  reason?: string;
  /** 기본 120초 — 대용량 export 대비 */
  timeoutMs?: number;
  /** 저장 디렉터리 (기본 downloads/excel) */
  saveDir?: string;
};

export type ExcelExportResult = {
  filePath: string;
  fileName: string;
  sizeBytes: number;
  elapsedMs: number;
  hadReasonModal: boolean;
};

const DEFAULT_DIR = path.resolve(__dirname, "../../../downloads/excel");

/**
 * 엑셀 다운로드 버튼을 클릭하고 파일을 저장합니다.
 * 모달이 뜨면 사유 select + 다운로드 확인까지 자동 처리합니다.
 */
export async function clickAndDownloadExcel(
  page: Page,
  button: Locator,
  options: ExcelExportOptions = {},
): Promise<ExcelExportResult> {
  const reason = options.reason ?? "업무상 필요";
  const timeout = options.timeoutMs ?? 120_000;
  const saveDir = options.saveDir ?? DEFAULT_DIR;
  fs.mkdirSync(saveDir, { recursive: true });

  const started = Date.now();
  const downloadPromise = page.waitForEvent("download", { timeout });

  await button.click();

  // 모달 감지 (최대 3초) — "엑셀 다운로드 사유 입력" 텍스트 기반
  const modal = page
    .locator('[role="dialog"], .modal, .ant-modal, [class*="modal"]')
    .filter({ hasText: /사유|다운로드/ })
    .first();

  let hadReasonModal = false;
  const modalVisible = await modal
    .waitFor({ state: "visible", timeout: 3000 })
    .then(() => true)
    .catch(() => false);

  if (modalVisible) {
    hadReasonModal = true;
    await fillReasonModal(page, modal, reason);
  }

  const download = await downloadPromise;
  const fileName = download.suggestedFilename();
  const filePath = path.join(saveDir, `${Date.now()}__${fileName}`);
  await download.saveAs(filePath);

  const stat = fs.statSync(filePath);
  return {
    filePath,
    fileName,
    sizeBytes: stat.size,
    elapsedMs: Date.now() - started,
    hadReasonModal,
  };
}

async function fillReasonModal(page: Page, modal: Locator, reason: string) {
  // select / dropdown 전략 1: 표준 <select>
  const nativeSelect = modal.locator("select").first();
  if ((await nativeSelect.count()) > 0) {
    await nativeSelect.selectOption({ label: reason }).catch(async () => {
      await nativeSelect.selectOption({ value: reason });
    });
  } else {
    // 전략 2: 커스텀 드롭다운 (Vue/Ant 등) — 드롭다운 열고 옵션 선택
    const trigger = modal
      .locator('[role="combobox"], .ant-select, [class*="select"]')
      .first();
    await trigger.click();
    // 옵션은 모달 밖 portal에 뜰 수 있어 page 전체에서 검색 — 더 넓은 셀렉터
    const option = page
      .locator(
        '[role="option"], li, [class*="option" i], [class*="item" i], [class*="select"] div, [class*="dropdown"] div, [class*="menu"] *',
      )
      .filter({ hasText: new RegExp(reason) })
      .first();
    await option.waitFor({ state: "visible", timeout: 5000 }).catch(() => {});
    const optCount = await option.count();
    if (optCount === 0) {
      // 디버그: 현재 보이는 옵션 후보들 로깅
      const visibleTexts = await page.evaluate(() => {
        const out: string[] = [];
        document.querySelectorAll("li, [role='option'], div").forEach((el) => {
          const t = (el.textContent || "").trim();
          const style = getComputedStyle(el);
          if (
            t &&
            t.length < 30 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          ) {
            out.push(t);
          }
        });
        return Array.from(new Set(out)).slice(0, 60);
      });
      console.log("[excel-export] 옵션 후보:", visibleTexts);
      throw new Error(`옵션 "${reason}" 을 찾을 수 없음`);
    }
    await option.click({ timeout: 5000 });
  }

  // 다운로드 확인 버튼 클릭
  const confirm = modal
    .locator("button")
    .filter({ hasText: /^\s*다운로드\s*$/ })
    .first();
  await confirm.click();
}
