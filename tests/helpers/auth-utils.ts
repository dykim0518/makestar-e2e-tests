/**
 * 인증 파일 유틸리티
 *
 * 세션 파일(auth.json, ab-auth.json)의 유효성을 검증하는 공통 함수.
 */

import * as fs from "fs";

type AuthFileStatus = {
  available: boolean;
  reason: string;
};

type CookieRequirement = {
  name?: RegExp;
  domain?: RegExp;
};

type LocalStorageRequirement = {
  origin?: RegExp;
  key?: RegExp;
};

type AuthFileOptions = {
  requiredCookies?: CookieRequirement[];
  requiredLocalStorage?: LocalStorageRequirement[];
};

/**
 * 인증 파일의 존재 여부와 쿠키 유효성을 확인합니다.
 *
 * @param authFilePath - 인증 파일 절대 경로
 * @returns available: true면 유효한 쿠키 존재, false면 reason에 사유 포함
 */
export function checkAuthFile(
  authFilePath: string,
  options: AuthFileOptions = {},
): AuthFileStatus {
  if (!fs.existsSync(authFilePath)) {
    return {
      available: false,
      reason: `세션 파일이 존재하지 않습니다: ${authFilePath}`,
    };
  }
  try {
    const auth = JSON.parse(fs.readFileSync(authFilePath, "utf-8"));
    const cookies = auth.cookies || [];
    const origins = auth.origins || [];
    if (cookies.length === 0) {
      return { available: false, reason: "세션 파일에 쿠키가 없습니다" };
    }
    const now = Date.now() / 1000;
    const validCookies = cookies.filter(
      (c: { expires?: number }) => !c.expires || c.expires > now,
    );
    if (validCookies.length === 0) {
      return { available: false, reason: "세션의 모든 쿠키가 만료되었습니다" };
    }

    for (const requirement of options.requiredCookies || []) {
      const matched = validCookies.some(
        (cookie: { name?: string; domain?: string }) =>
          (!requirement.name || requirement.name.test(cookie.name || "")) &&
          (!requirement.domain ||
            requirement.domain.test(cookie.domain || "")),
      );
      if (!matched) {
        return {
          available: false,
          reason: `필수 쿠키 조건을 만족하지 않습니다: ${requirement.name || /.*/} @ ${requirement.domain || /.*/}`,
        };
      }
    }

    for (const requirement of options.requiredLocalStorage || []) {
      const matched = origins.some(
        (origin: {
          origin?: string;
          localStorage?: Array<{ name?: string }>;
        }) =>
          (!requirement.origin ||
            requirement.origin.test(origin.origin || "")) &&
          (origin.localStorage || []).some(
            (entry) =>
              !requirement.key || requirement.key.test(entry.name || ""),
          ),
      );
      if (!matched) {
        return {
          available: false,
          reason: `필수 localStorage 조건을 만족하지 않습니다: ${requirement.key || /.*/} @ ${requirement.origin || /.*/}`,
        };
      }
    }

    return { available: true, reason: "" };
  } catch (e) {
    return { available: false, reason: `세션 파일 파싱 오류: ${e}` };
  }
}
