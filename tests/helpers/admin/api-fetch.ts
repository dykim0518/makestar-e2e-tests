/**
 * 페이지 내부에서 API GET을 실행하는 유틸.
 * admin-tokens.json이 없으면 화면 런타임(Nuxt/Pinia)의 Bearer 토큰을 사용합니다.
 */

import type { Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

let cachedToken: string | null = null;
function getAccessToken(): string | null {
  if (cachedToken) return cachedToken;
  const p = path.resolve(__dirname, "../../../admin-tokens.json");
  try {
    const raw = JSON.parse(fs.readFileSync(p, "utf-8")) as {
      accessToken?: unknown;
    };
    cachedToken = typeof raw.accessToken === "string" ? raw.accessToken : null;
  } catch {
    cachedToken = null;
  }
  return cachedToken;
}

type AdminRuntimeWindow = Window & {
  __NUXT__?: {
    pinia?: {
      auth?: {
        accessToken?: string;
      };
    };
  };
};

export async function fetchJson<T = unknown>(
  page: Page,
  url: string,
): Promise<{ status: number; body: T | null }> {
  const token = getAccessToken();
  const result = await page.evaluate(
    async ({ u, t }) => {
      const headers: Record<string, string> = { Accept: "application/json" };
      const runtimeToken = (window as AdminRuntimeWindow).__NUXT__?.pinia?.auth
        ?.accessToken;
      const authToken = t || runtimeToken;
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      const res = await fetch(u, {
        method: "GET",
        credentials: "include",
        headers,
      });
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      return { status: res.status, body };
    },
    { u: url, t: token },
  );
  return { status: result.status, body: result.body as T | null };
}
