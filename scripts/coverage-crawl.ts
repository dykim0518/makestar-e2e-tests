/**
 * 커버리지 대시보드 PoC 크롤러
 *
 * 기능 inventory 초안을 만들기 위해 각 프로덕트의 네비게이션을 훑어
 * URL + 페이지 타이틀을 수집. 읽기 전용(클릭/폼 조작 없음, 링크 href만 수집).
 *
 * 실행:
 *   npx tsx scripts/coverage-crawl.ts --product=cmr
 *   npx tsx scripts/coverage-crawl.ts --product=admin
 *   npx tsx scripts/coverage-crawl.ts --product=albumbuddy
 *
 * 출력: coverage-crawl-{product}.json
 */
import { chromium, type Page, type BrowserContext } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

type Product = "cmr" | "admin" | "albumbuddy";

type ProductConfig = {
  baseUrl: string;
  storageState?: string;
  startPaths: string[];
  sameOriginOnly: boolean;
};

type CrawlItem = {
  url: string;
  normalizedPath: string;
  title: string;
  h1: string | null;
  depth: number;
  discoveredFrom: string;
  source: "seed" | "link" | "spa_click";
};

const MAX_PAGES_DEFAULT = 120;
const MAX_DEPTH_DEFAULT = 2;
const MAX_SPA_CLICKS_PER_PAGE = 25;

const ROOT = path.resolve(__dirname, "..");

const PRODUCTS: Record<Product, ProductConfig> = {
  cmr: {
    baseUrl: "https://stage-new.makeuni2026.com",
    storageState: path.join(ROOT, "auth.json"),
    startPaths: ["/"],
    sameOriginOnly: true,
  },
  admin: {
    baseUrl: "https://stage-new-admin.makeuni2026.com",
    storageState: path.join(ROOT, "auth.json"),
    startPaths: ["/"],
    sameOriginOnly: true,
  },
  albumbuddy: {
    baseUrl: "https://albumbuddy.kr",
    storageState: path.join(ROOT, "ab-auth.json"),
    startPaths: ["/"],
    sameOriginOnly: true,
  },
};

const MAX_DEPTH = MAX_DEPTH_DEFAULT;
const MAX_PAGES = MAX_PAGES_DEFAULT;
const NAV_TIMEOUT = 15000;
const SEEDS_PATH = path.join(__dirname, "coverage-seeds.json");

function loadSeeds(product: Product): string[] {
  if (!fs.existsSync(SEEDS_PATH)) return [];
  const data = JSON.parse(fs.readFileSync(SEEDS_PATH, "utf-8"));
  return Array.isArray(data[product]) ? data[product] : [];
}

function normalizePath(pathname: string): string {
  return (
    pathname
      .replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        "/:uuid",
      )
      .replace(/\/\d{3,}/g, "/:id")
      .replace(/\/+$/, "") || "/"
  );
}

function parseArgs(): { product: Product } {
  const arg = process.argv.find((a) => a.startsWith("--product="));
  const product = arg?.split("=")[1] as Product | undefined;
  if (!product || !(product in PRODUCTS)) {
    throw new Error(
      `--product= 필수. 가능값: ${Object.keys(PRODUCTS).join(", ")}`,
    );
  }
  return { product };
}

async function collectLinks(
  page: Page,
  baseUrl: string,
  sameOriginOnly: boolean,
): Promise<string[]> {
  const hrefs = await page.evaluate(() => {
    const anchors = Array.from(document.querySelectorAll("a[href]"));
    return anchors
      .map((a) => (a as HTMLAnchorElement).href)
      .filter(
        (h) => h && !h.startsWith("javascript:") && !h.startsWith("mailto:"),
      );
  });
  const base = new URL(baseUrl);
  const uniq = new Set<string>();
  for (const h of hrefs) {
    try {
      const u = new URL(h);
      if (sameOriginOnly && u.origin !== base.origin) continue;
      u.hash = "";
      u.search = "";
      uniq.add(u.toString());
    } catch {
      // skip
    }
  }
  return Array.from(uniq);
}

/**
 * SPA에서 <a href> 없이 onClick으로 라우팅되는 네비 항목을 탐지.
 * 사이드바/상단 네비의 버튼/리스트 아이템을 클릭해서 URL 변화만 기록, 즉시 원복.
 */
async function discoverSpaNavUrls(
  page: Page,
  baseUrl: string,
): Promise<string[]> {
  const startUrl = page.url();
  const discovered = new Set<string>();
  const selectors = [
    "aside button",
    "aside [role='button']",
    "aside li",
    "nav button",
    "[role='navigation'] button",
    "[role='menuitem']",
  ];
  let candidateHandles: Awaited<ReturnType<Page["locator"]>>[] = [];
  try {
    const combined = page.locator(selectors.join(", "));
    const count = Math.min(
      await combined.count().catch(() => 0),
      MAX_SPA_CLICKS_PER_PAGE,
    );
    for (let i = 0; i < count; i++) {
      candidateHandles.push(combined.nth(i) as never);
    }
  } catch {
    return [];
  }

  for (const handle of candidateHandles) {
    try {
      const loc = handle as unknown as ReturnType<Page["locator"]>;
      if (!(await loc.isVisible({ timeout: 200 }).catch(() => false))) continue;
      await loc.click({ timeout: 1500, trial: false });
      await page
        .waitForLoadState("domcontentloaded", { timeout: 3000 })
        .catch(() => {});
      const nowUrl = page.url();
      if (nowUrl !== startUrl) {
        try {
          const u = new URL(nowUrl);
          if (u.origin === new URL(baseUrl).origin) {
            u.hash = "";
            u.search = "";
            discovered.add(u.toString());
          }
        } catch {
          // ignore
        }
        // 원래 페이지로 복귀 — 다음 후보 탐색 위해
        await page.goto(startUrl, {
          timeout: NAV_TIMEOUT,
          waitUntil: "domcontentloaded",
        });
      }
    } catch {
      // 클릭 실패는 무시
    }
  }
  return Array.from(discovered);
}

async function crawl(product: Product): Promise<CrawlItem[]> {
  const cfg = PRODUCTS[product];
  const hasAuth = cfg.storageState && fs.existsSync(cfg.storageState);
  if (cfg.storageState && !hasAuth) {
    console.warn(
      `[warn] auth file not found: ${cfg.storageState} — 비로그인 상태로 진행`,
    );
  }

  const browser = await chromium.launch({ headless: true });
  const context: BrowserContext = await browser.newContext({
    storageState: hasAuth ? cfg.storageState : undefined,
  });
  const page = await context.newPage();

  const visited = new Map<string, CrawlItem>();
  type QueueItem = {
    url: string;
    depth: number;
    from: string;
    source: CrawlItem["source"];
  };
  const seeds = loadSeeds(product);
  const queue: QueueItem[] = [
    ...cfg.startPaths.map((p) => ({
      url: new URL(p, cfg.baseUrl).toString(),
      depth: 0,
      from: "start",
      source: "link" as const,
    })),
    ...seeds.map((p) => ({
      url: new URL(p, cfg.baseUrl).toString(),
      depth: 0,
      from: "seed",
      source: "seed" as const,
    })),
  ];
  console.log(`seeds: ${seeds.length}, startPaths: ${cfg.startPaths.length}`);

  while (queue.length && visited.size < MAX_PAGES) {
    const { url, depth, from, source } = queue.shift()!;
    const normalized = normalizePath(new URL(url).pathname);
    if (visited.has(normalized)) continue;

    try {
      await page.goto(url, {
        timeout: NAV_TIMEOUT,
        waitUntil: "domcontentloaded",
      });
      const title = (await page.title()) || "";
      const h1 = await page
        .locator("h1")
        .first()
        .innerText({ timeout: 1500 })
        .catch(() => null);
      visited.set(normalized, {
        url,
        normalizedPath: normalized,
        title,
        h1: h1?.trim() || null,
        depth,
        discoveredFrom: from,
        source,
      });
      console.log(
        `[${visited.size}] d${depth} ${source} ${normalized} — ${h1?.trim() || title}`,
      );

      if (depth < MAX_DEPTH) {
        const links = await collectLinks(page, cfg.baseUrl, cfg.sameOriginOnly);
        for (const link of links) {
          const np = normalizePath(new URL(link).pathname);
          if (!visited.has(np)) {
            queue.push({
              url: link,
              depth: depth + 1,
              from: normalized,
              source: "link",
            });
          }
        }

        // SPA click-walker: <a> 없이 onClick으로 라우팅되는 네비 항목 탐지
        const spaUrls = await discoverSpaNavUrls(page, cfg.baseUrl);
        for (const link of spaUrls) {
          const np = normalizePath(new URL(link).pathname);
          if (!visited.has(np)) {
            queue.push({
              url: link,
              depth: depth + 1,
              from: normalized,
              source: "spa_click",
            });
          }
        }
      }
    } catch (err) {
      console.warn(`[skip] ${url}: ${(err as Error).message}`);
    }
  }

  await browser.close();
  return Array.from(visited.values()).sort((a, b) =>
    a.normalizedPath.localeCompare(b.normalizedPath),
  );
}

async function main() {
  const { product } = parseArgs();
  console.log(`crawling product=${product}`);
  const items = await crawl(product);
  const outPath = path.join(ROOT, `coverage-crawl-${product}.json`);
  fs.writeFileSync(outPath, JSON.stringify(items, null, 2), "utf-8");
  console.log(`\n✅ ${items.length} pages → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
