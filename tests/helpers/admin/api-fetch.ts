/**
 * 페이지 내부에서 API GET을 실행하는 유틸.
 * 쿠키 + 기존 interceptor(Bearer) 를 그대로 활용합니다.
 */

import type { Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

let cachedToken: string | null = null;
function getAccessToken(): string | null {
  if (cachedToken) return cachedToken;
  const p = path.resolve(__dirname, "../../../admin-tokens.json");
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8"));
    cachedToken = raw.accessToken ?? null;
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

export async function fetchJson<T = any>(
  page: Page,
  url: string,
): Promise<{ status: number; body: T | null }> {
  const token = getAccessToken();
  return page.evaluate(
    async ({ u, t }) => {
      const headers: Record<string, string> = { Accept: "application/json" };
      if (t) headers.Authorization = `Bearer ${t}`;
      const res = await fetch(u, {
        method: "GET",
        credentials: "include",
        headers,
      });
      let body: any = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body };
    },
    { u: url, t: token },
  );
}
