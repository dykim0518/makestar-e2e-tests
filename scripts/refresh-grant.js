/**
 * refresh_token grant — 브라우저 없이 access_token 재발급
 *
 * SimpleJWT refresh 엔드포인트(POST /user/registration/token_refresh/)를 호출해
 * refresh_token으로 새 access_token을 받는다. Google OAuth 브라우저 플로우 없이
 * access 만료를 해소하므로, admin(통합매니저)의 Google challenge 데드락을 우회한다.
 *
 * refresh_token(admin 7일 / makestar 30일)이 살아 있는 동안은 사람 개입 없이
 * access(3일)를 자동 재발급할 수 있다.
 */

// 검증된 경로: /apis/ prefix 필수 (makestar-admin CLI references/auth-cli.md).
// 축약형 /user/registration/token_refresh/ 는 live 테스트에서 404.
const TOKEN_REFRESH_PATH = "/apis/user/registration/token_refresh/";

/**
 * @param {object} params
 * @param {string} params.refreshToken  현재 refresh_token (JWT)
 * @param {string} params.authHost      인증 호스트 (stage-auth.makeuni2026.com | auth.makestar.com)
 * @param {number} [params.timeoutMs=15000]
 * @returns {Promise<{ok:true, status:number, access:string, refresh:string|null}
 *                   | {ok:false, status:number, message?:string}>}
 */
async function refreshAccessToken({
  refreshToken,
  authHost,
  timeoutMs = 15000,
}) {
  if (!refreshToken) {
    return { ok: false, status: 0, message: "refresh_token 없음" };
  }
  if (!authHost) {
    return { ok: false, status: 0, message: "authHost 없음" };
  }

  const url = `https://${authHost}${TOKEN_REFRESH_PATH}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ refresh: refreshToken }),
      signal: controller.signal,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      // 본문이 JSON이 아니면 data는 null로 둔다.
    }

    if (!res.ok) {
      const detail = data?.detail || data?.code || "";
      return {
        ok: false,
        status: res.status,
        message: `token_refresh ${res.status}${detail ? ` (${detail})` : ""}`,
      };
    }

    // 응답 형식: { result, message, code, external_data, access_token, refresh_token }
    // (SimpleJWT 표준 {access}가 아니라 access_token/refresh_token 명명 + rotation)
    const access = data?.access_token;
    const refresh = data?.refresh_token;
    if (!access) {
      return {
        ok: false,
        status: res.status,
        message: "응답에 access_token 없음",
      };
    }

    return {
      ok: true,
      status: res.status,
      access,
      refresh: refresh || null, // 매 호출 새 refresh 발급(rotation)
    };
  } catch (e) {
    const aborted = e?.name === "AbortError";
    return {
      ok: false,
      status: 0,
      message: aborted ? `타임아웃 (${timeoutMs}ms)` : e.message,
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { refreshAccessToken, TOKEN_REFRESH_PATH };
