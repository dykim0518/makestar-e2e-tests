/**
 * API 응답 캡처 유틸
 *
 * 페이지 탐색 중 특정 URL 패턴의 응답 JSON을 수집합니다.
 * 엑셀 다운로드 row 수 / 키 값과 비교하는 정합성 검증에 사용합니다.
 */

import type { Page, Response } from "@playwright/test";

export type CapturedResponse = {
  url: string;
  status: number;
  body: any;
};

export type ApiCapture = {
  /** 매칭된 응답 반환 (없으면 빈 배열) */
  matched: () => CapturedResponse[];
  /** 이후 추가 응답 1개 대기 */
  waitForNext: (timeoutMs?: number) => Promise<CapturedResponse>;
  stop: () => void;
};

export function captureApi(
  page: Page,
  urlPattern: RegExp | string,
): ApiCapture {
  const re =
    typeof urlPattern === "string" ? new RegExp(urlPattern) : urlPattern;
  const collected: CapturedResponse[] = [];
  const waiters: Array<(r: CapturedResponse) => void> = [];

  const handler = async (res: Response) => {
    const url = res.url();
    if (!re.test(url)) return;
    try {
      const ct = res.headers()["content-type"] || "";
      const body = ct.includes("application/json")
        ? await res.json().catch(() => null)
        : null;
      const rec: CapturedResponse = { url, status: res.status(), body };
      collected.push(rec);
      while (waiters.length) waiters.shift()!(rec);
    } catch {
      /* noop */
    }
  };

  page.on("response", handler);

  return {
    matched: () => collected.slice(),
    waitForNext: (timeoutMs = 15000) =>
      new Promise((resolve, reject) => {
        const id = setTimeout(
          () => reject(new Error(`captureApi: no match within ${timeoutMs}ms`)),
          timeoutMs,
        );
        waiters.push((r) => {
          clearTimeout(id);
          resolve(r);
        });
      }),
    stop: () => page.off("response", handler),
  };
}

/**
 * API 응답 body에서 rows 배열을 추출합니다.
 * Makestar API는 보통 { results: [...], count: N } 또는 { data: [...] } 구조.
 */
export function extractRows(body: any): { rows: any[]; total: number | null } {
  if (!body) return { rows: [], total: null };

  // Makestar: body 내부에 *_list 배열이 주로 들어있음
  let rows: any[] = [];
  if (Array.isArray(body)) rows = body;
  else if (Array.isArray(body.results)) rows = body.results;
  else if (Array.isArray(body.data)) rows = body.data;
  else if (Array.isArray(body.items)) rows = body.items;
  else {
    for (const k of Object.keys(body)) {
      if (/_list$/.test(k) && Array.isArray(body[k])) {
        rows = body[k];
        break;
      }
    }
  }

  // total: body 직속 or pagination 내부에서 추출
  const candidates = [body, body.pagination, body.meta, body.page].filter(
    Boolean,
  );
  let total: number | null = null;
  for (const c of candidates) {
    for (const k of [
      "count",
      "total",
      "totalCount",
      "total_count",
      "totalElements",
    ]) {
      if (typeof c[k] === "number") {
        total = c[k];
        break;
      }
    }
    if (total !== null) break;
  }

  return { rows, total };
}
