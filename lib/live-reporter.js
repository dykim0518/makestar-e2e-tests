// @ts-check
/**
 * Live Reporter — 테스트 실행 중 개별 결과를 대시보드 API로 실시간 전송
 *
 * 환경변수:
 *   DASHBOARD_URL         — 대시보드 URL (예: https://makestar-qa-dashboard.vercel.app)
 *   DASHBOARD_API_SECRET  — API 인증 토큰
 *   GITHUB_RUN_ID         — GitHub Actions run ID (자동 제공)
 *
 * 위 환경변수가 하나라도 없으면 무동작 (로컬 실행 안전)
 */

class LiveReporter {
  constructor() {
    this.dashboardUrl = process.env.DASHBOARD_URL || "";
    this.apiSecret = process.env.DASHBOARD_API_SECRET || "";
    this.runId = process.env.GITHUB_RUN_ID || "";
    this.suite = process.env.SUITE_INPUT || process.env.RUN_SUITE || "cmr";
    this.branch = process.env.GITHUB_REF_NAME || "";
    this.commitSha = process.env.GITHUB_SHA || "";
    this.triggeredBy = process.env.GITHUB_EVENT_NAME || "manual";
    this.environment = process.env.ENVIRONMENT_INPUT || "prod";

    this.enabled =
      Boolean(this.dashboardUrl) &&
      Boolean(this.apiSecret) &&
      Boolean(this.runId);

    this.completed = 0;
    this.totalTests = 0;
  }

  /** Fire-and-forget POST — 절대 테스트 실행을 블로킹하지 않음 */
  _post(payload) {
    if (!this.enabled) return;

    const url = `${this.dashboardUrl}/api/live-results`;
    const body = JSON.stringify({ runId: Number(this.runId), ...payload });

    fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiSecret}`,
        "Content-Type": "application/json",
      },
      body,
      signal: AbortSignal.timeout(10000),
    }).catch(() => {
      // 실패해도 무시 — 테스트 실행에 영향 없음
    });
  }

  onBegin(_config, suite) {
    this.totalTests = suite.allTests().length;
    this._post({
      event: "begin",
      suite: this.suite,
      total: this.totalTests,
      branch: this.branch,
      commitSha: this.commitSha,
      triggeredBy: this.triggeredBy,
      environment: this.environment,
    });
  }

  onTestEnd(test, result) {
    // 재시도 예정인 경우 (아직 마지막 시도가 아님) 스킵
    if (result.status === "failed" && result.retry < test.retries) {
      return;
    }

    this.completed++;

    // 재시도 후 통과 → flaky
    let status = result.status;
    if (result.retry > 0 && result.status === "passed") {
      status = "flaky";
    }
    // timedOut, interrupted → failed로 통일
    if (status === "timedOut" || status === "interrupted") {
      status = "failed";
    }

    const titlePath = test.titlePath().filter(Boolean);
    // 첫 번째는 보통 파일 경로이므로 제외
    const title =
      titlePath.length > 1 ? titlePath.slice(1).join(" > ") : test.title;

    this._post({
      event: "test-end",
      title,
      file: test.location?.file || null,
      project: test.parent?.project()?.name || null,
      status,
      durationMs: Math.round(result.duration),
      errorMessage: result.error?.message?.slice(0, 2000) || null,
      errorStack: result.error?.stack?.slice(0, 4000) || null,
    });
  }

  async onEnd(result) {
    // 최종 상태 전송
    const status = result.status === "passed" ? "passed" : "failed";
    this._post({ event: "end", status });

    // 마지막 POST가 전송될 시간 확보
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

module.exports = LiveReporter;
