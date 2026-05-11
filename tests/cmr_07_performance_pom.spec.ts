/**
 * Makestar.com E2E 모니터링 테스트 - performance
 *
 * Phase 5 구조 분할: 기존 cmr_monitoring_pom.spec.ts의 describe 블록을
 * 목적별 spec로 나누고, 공통 설정은 tests/helpers에서 가져옵니다.
 */

import { test, expect } from "@playwright/test";
import { BASE_URL, TEST_TIMEOUT } from "./helpers/cmr-monitoring-config";
import { MakestarPage } from "./pages/makestar.page";
import type { WebVitalsResult } from "./pages/makestar.page";

const PERF_PAGE_LOAD_THRESHOLD_MS =
  Number(process.env.CMR_PAGE_LOAD_THRESHOLD) || 3000;
const PERF_API_RESPONSE_THRESHOLD_MS =
  Number(process.env.CMR_API_RESPONSE_THRESHOLD) || 2000;

test.describe("응답성/성능 모니터링 @feature:cmr.home", () => {
  let makestar: MakestarPage;

  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(TEST_TIMEOUT);
    makestar = new MakestarPage(page);
    await makestar.gotoHome();
  });
  test("CMR-PERF-01: 주요 페이지 로딩 시간 측정 (Web Vitals 기반)", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    const pagesToTest = [
      { name: "Home", url: `${BASE_URL}/` },
      { name: "Event", url: `${BASE_URL}/event` },
      { name: "Shop", url: `${BASE_URL}/shop` },
    ];

    const results: {
      name: string;
      loadTime: number;
      vitals: WebVitalsResult;
      passed: boolean;
    }[] = [];

    console.log("📊 주요 페이지 로딩 시간 측정 (Web Vitals 기반)");
    console.log(`   기준: ${PERF_PAGE_LOAD_THRESHOLD_MS}ms 이내`);
    console.log("");

    for (const pageInfo of pagesToTest) {
      // POM 메서드 사용하여 Web Vitals 측정
      const { totalTime, vitals } = await makestar.measurePageLoadTime(
        pageInfo.url,
      );
      const passed = totalTime <= PERF_PAGE_LOAD_THRESHOLD_MS;

      results.push({
        name: pageInfo.name,
        loadTime: totalTime,
        vitals,
        passed,
      });

      const status = passed ? "✅" : "⚠️";
      console.log(
        `   ${status} ${pageInfo.name}: ${totalTime}ms (LCP: ${vitals.lcp}ms, FCP: ${vitals.fcp}ms)`,
      );

      await makestar.handleModalAndWaitForContent();
    }

    const passedCount = results.filter((r) => r.passed).length;
    const avgLoadTime = Math.round(
      results.reduce((sum, r) => sum + r.loadTime, 0) / results.length,
    );
    const avgLcp = Math.round(
      results.reduce((sum, r) => sum + r.vitals.lcp, 0) / results.length,
    );

    console.log("");
    console.log(`📈 결과 요약:`);
    console.log(`   통과: ${passedCount}/${results.length} 페이지`);
    console.log(`   평균 로딩 시간: ${avgLoadTime}ms`);
    console.log(`   평균 LCP: ${avgLcp}ms`);

    // 과반수 이상 통과하면 성공 (네트워크 상황에 따른 유연성 확보)
    const minPassRequired = Math.ceil(results.length / 2);
    expect(passedCount).toBeGreaterThanOrEqual(minPassRequired);
  });

  test("CMR-PERF-02: API 응답 시간 및 네트워크 요청 모니터링", async ({
    page,
  }) => {
    test.setTimeout(TEST_TIMEOUT);

    const apiRequests: { url: string; duration: number; status: number }[] = [];
    const responseThreshold = PERF_API_RESPONSE_THRESHOLD_MS;

    page.on("response", async (response) => {
      const url = response.url();
      const timing = response.request().timing();

      if (
        url.includes("/api/") ||
        url.includes("/v1/") ||
        url.includes("/graphql")
      ) {
        const duration = timing.responseEnd - timing.requestStart;
        apiRequests.push({
          url: url.substring(0, 100),
          duration: Math.max(0, duration),
          status: response.status(),
        });
      }
    });

    console.log("📊 API 응답 시간 모니터링");
    console.log(`   기준: ${responseThreshold}ms 이내`);
    console.log("");

    const pagesToVisit = [
      `${BASE_URL}/`,
      `${BASE_URL}/event`,
      `${BASE_URL}/shop`,
    ];

    for (const url of pagesToVisit) {
      await makestar.goto(url, { waitUntil: "networkidle" });
      await makestar.handleModalAndWaitForContent();
    }

    console.log(`   수집된 API 요청: ${apiRequests.length}개`);

    if (apiRequests.length > 0) {
      const slowRequests = apiRequests.filter(
        (r) => r.duration > responseThreshold,
      );
      const ignoredFailurePatterns = [
        /auth\.makestar\.com\/v1\/user\/profile\/me/i,
        /\/commerce\/notification/i,
        /\/commerce\/order\//i,
        /\/commerce\/product_event/i,
      ];
      const ignoredFailedRequests = apiRequests.filter(
        (r) =>
          r.status >= 400 &&
          ignoredFailurePatterns.some((pattern) => pattern.test(r.url)),
      );
      const failedRequests = apiRequests.filter(
        (r) =>
          r.status >= 400 &&
          !ignoredFailurePatterns.some((pattern) => pattern.test(r.url)),
      );
      const avgDuration = Math.round(
        apiRequests.reduce((sum, r) => sum + r.duration, 0) /
          apiRequests.length,
      );

      console.log(`   평균 응답 시간: ${avgDuration}ms`);
      console.log(
        `   느린 요청 (>${responseThreshold}ms): ${slowRequests.length}개`,
      );
      console.log(`   실패한 요청 (4xx/5xx): ${failedRequests.length}개`);
      if (ignoredFailedRequests.length > 0) {
        console.log(
          `   제외된 보호 API 실패 (예상 가능 401/403): ${ignoredFailedRequests.length}개`,
        );
      }

      if (slowRequests.length > 0) {
        console.log("");
        console.warn("   ⚠️ 느린 API 요청:");
        slowRequests.slice(0, 5).forEach((r) => {
          console.log(`      - ${r.url.substring(0, 60)}... (${r.duration}ms)`);
        });
      }

      if (failedRequests.length > 0) {
        console.log("");
        console.error("   ❌ 실패한 API 요청:");
        failedRequests.slice(0, 5).forEach((r) => {
          console.log(
            `      - ${r.url.substring(0, 60)}... (HTTP ${r.status})`,
          );
        });
      }

      const relevantRequestCount = Math.max(
        1,
        apiRequests.length - ignoredFailedRequests.length,
      );
      const failureRate = failedRequests.length / relevantRequestCount;
      expect(failureRate).toBeLessThan(0.1);
      console.log(
        `   실패율: ${(failureRate * 100).toFixed(1)}% (기준: 10% 미만)`,
      );
    } else {
      console.log(
        "   ℹ️ API 요청이 감지되지 않음 (정적 페이지 또는 캐시 사용)",
      );
    }

    const performanceMetrics = await makestar.measureWebVitals();

    console.log("");
    console.log("📈 페이지 성능 메트릭 (Web Vitals):");
    console.log(`   First Byte (TTFB): ${performanceMetrics.ttfb}ms`);
    console.log(`   First Contentful Paint (FCP): ${performanceMetrics.fcp}ms`);
    console.log(
      `   Largest Contentful Paint (LCP): ${performanceMetrics.lcp}ms`,
    );
    console.log(`   DOM Content Loaded: ${performanceMetrics.dcl}ms`);
    console.log(`   Load Complete: ${performanceMetrics.load}ms`);
    console.log(`   Cumulative Layout Shift (CLS): ${performanceMetrics.cls}`);
  });
});
