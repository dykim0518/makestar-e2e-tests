import { expect, type Locator, type Page } from "@playwright/test";
import { AdminBasePage, ADMIN_TIMEOUTS } from "./admin-base.page";

export type AlbumbuddyCoreKey =
  | "artist.list"
  | "artist.create"
  | "seller.list"
  | "goods.list"
  | "goods.detail"
  | "report.list"
  | "order.list"
  | "purchase.list"
  | "bunjang.list"
  | "stock.list"
  | "stock.detail"
  | "stock.create"
  | "warehouse.list"
  | "warehouse.detail"
  | "packaging.list"
  | "packaging.detail"
  | "delivery-payment.list"
  | "shipping.list"
  | "shipping.detail"
  | "user.list"
  | "point.manage"
  | "point.list";

type AlbumbuddyCorePageConfig = {
  expectedPath?: RegExp | string;
  heading: string;
  pageName: string;
  path: string;
  primaryActionText?: string;
  requireHeading?: boolean;
};

export const ALBUMBUDDY_CORE_PAGE_CONFIG: Record<
  AlbumbuddyCoreKey,
  AlbumbuddyCorePageConfig
> = {
  "artist.list": {
    path: "/albumbuddy/artist/list",
    heading: "아티스트 관리",
    pageName: "아티스트 목록",
    primaryActionText: "아티스트 등록",
  },
  "artist.create": {
    path: "/albumbuddy/artist/create",
    heading: "아티스트 등록",
    pageName: "아티스트 등록",
    primaryActionText: "지금 등록하기",
  },
  "seller.list": {
    path: "/albumbuddy/seller/list",
    heading: "판매처 관리",
    pageName: "판매처 목록",
  },
  "goods.list": {
    path: "/albumbuddy/goods/list",
    heading: "상품 목록",
    pageName: "상품 목록",
  },
  "goods.detail": {
    path: "/albumbuddy/goods/list",
    expectedPath: /^\/albumbuddy\/goods\/[^/]+$/,
    heading: "목록으로 돌아가기",
    pageName: "상품 상세",
    primaryActionText: "정보 추가하기",
    requireHeading: false,
  },
  "report.list": {
    path: "/albumbuddy/report/list",
    heading: "상품 등록 요청처리",
    pageName: "상품 등록 요청처리 목록",
    primaryActionText: "상품 등록",
  },
  "order.list": {
    path: "/albumbuddy/order/list",
    heading: "주문 내역 관리",
    pageName: "주문 목록",
  },
  "purchase.list": {
    path: "/albumbuddy/purchase/list",
    heading: "일반 상품 발주",
    pageName: "일반 상품 발주 목록",
    primaryActionText: "발주 진행하기",
  },
  "bunjang.list": {
    path: "/albumbuddy/bunjang/list",
    heading: "번장 발주 관리",
    pageName: "번장 발주 관리 목록",
  },
  "stock.list": {
    path: "/albumbuddy/stock/list",
    heading: "구매대행 입고관리",
    pageName: "구매대행 입고관리 목록",
    primaryActionText: "패키지 등록",
  },
  "stock.detail": {
    path: "/albumbuddy/stock/123",
    expectedPath: /^\/albumbuddy\/stock\/[^/]+$/,
    heading: "목록으로 돌아가기",
    pageName: "구매대행 입고관리 상세",
    primaryActionText: "수정 완료",
  },
  "stock.create": {
    path: "/albumbuddy/stock/create",
    heading: "목록으로 돌아가기",
    pageName: "구매대행 입고관리 등록",
    primaryActionText: "생성하기",
  },
  "warehouse.list": {
    path: "/albumbuddy/warehouse/list",
    heading: "배송 대행 입고관리",
    pageName: "배송대행 입고관리 목록",
    primaryActionText: "패키지 등록",
  },
  "warehouse.detail": {
    path: "/albumbuddy/warehouse/123",
    expectedPath: /^\/albumbuddy\/warehouse\/[^/]+$/,
    heading: "목록으로 돌아가기",
    pageName: "배송대행 입고관리 상세",
    primaryActionText: "수정 완료",
  },
  "packaging.list": {
    path: "/albumbuddy/packaging/list",
    heading: "패키징 처리",
    pageName: "패키징 처리 목록",
  },
  "packaging.detail": {
    path: "/albumbuddy/packaging/123",
    expectedPath: /^\/albumbuddy\/packaging\/[^/]+$/,
    heading: "목록으로 돌아가기",
    pageName: "패키징 처리 상세",
    primaryActionText: "패키징 완료 처리",
  },
  "delivery-payment.list": {
    path: "/albumbuddy/delivery-payment/list",
    heading: "배송 결제 관리",
    pageName: "해외배송 결제 관리 목록",
  },
  "shipping.list": {
    path: "/albumbuddy/shipping/list",
    heading: "물류 출고 관리",
    pageName: "물류 출고 관리 목록",
  },
  "shipping.detail": {
    path: "/albumbuddy/shipping/123",
    expectedPath: /^\/albumbuddy\/shipping\/[^/]+$/,
    heading: "목록으로 돌아가기",
    pageName: "물류 출고 관리 상세",
    primaryActionText: "수정하기",
  },
  "user.list": {
    path: "/albumbuddy/user/list",
    heading: "회원 목록",
    pageName: "회원 목록",
  },
  "point.manage": {
    path: "/albumbuddy/point/manage",
    heading: "포인트 지급 · 차감",
    pageName: "포인트 지급 · 차감",
    primaryActionText: "지급/차감 완료하기",
  },
  "point.list": {
    path: "/albumbuddy/point/list",
    heading: "포인트 내역 관리",
    pageName: "포인트 내역 관리 목록",
    primaryActionText: "포인트 지급 · 차감",
  },
} as const;

export class AlbumbuddyCorePage extends AdminBasePage {
  readonly config: AlbumbuddyCorePageConfig;

  constructor(
    page: Page,
    readonly key: AlbumbuddyCoreKey,
  ) {
    super(page, ADMIN_TIMEOUTS);
    this.config = ALBUMBUDDY_CORE_PAGE_CONFIG[key];
  }

  getPageUrl(): string {
    return `${this.baseUrl}${this.config.path}`;
  }

  getHeadingText(): string {
    return this.config.heading;
  }

  getCurrentPath(): string {
    return new URL(this.currentUrl).pathname;
  }

  getExpectedPath(): RegExp | string {
    return this.config.expectedPath ?? this.config.path;
  }

  getHeadingLocator(): Locator {
    const headingText = this.getHeadingText();

    return this.page
      .locator(
        [
          `h1:has-text("${headingText}")`,
          `h2:has-text("${headingText}")`,
          `p:has-text("${headingText}")`,
          `a:has-text("${headingText}")`,
          `button:has-text("${headingText}")`,
        ].join(", "),
      )
      .first();
  }

  getPrimaryAction(): Locator | null {
    if (!this.config.primaryActionText) {
      return null;
    }

    return this.page
      .getByRole("button", {
        name: this.config.primaryActionText,
      })
      .first();
  }

  async openTarget(): Promise<void> {
    if (this.key === "goods.detail") {
      await this.navigate();
      await this.waitForReady();

      const editButton = this.page
        .getByRole("button", {
          name: "정보 수정",
        })
        .first();
      await expect(
        editButton,
        "상품 상세 진입 버튼이 보이지 않습니다.",
      ).toBeVisible({ timeout: this.timeouts.medium });
      await editButton.click({ force: true });
      await this.page.waitForLoadState("domcontentloaded").catch(() => {});
      await this.page.waitForLoadState("networkidle").catch(() => {});
      return;
    }

    await this.navigate();
  }

  async waitForReady(): Promise<void> {
    if (this.config.requireHeading !== false) {
      await expect(
        this.getHeadingLocator(),
        `${this.config.pageName} 헤딩이 보이지 않습니다.`,
      ).toBeVisible({ timeout: this.timeouts.long });
    }

    const primaryAction = this.getPrimaryAction();
    const readySignals: Promise<void | null>[] = [
      this.table.waitFor({ state: "visible", timeout: this.timeouts.long }),
      this.noResultMessage.waitFor({
        state: "visible",
        timeout: this.timeouts.long,
      }),
    ];

    if (primaryAction) {
      readySignals.push(
        primaryAction.waitFor({
          state: "visible",
          timeout: this.timeouts.long,
        }),
      );
    }

    await Promise.race(readySignals).catch(() => null);

    await this.waitForContentStable("main", {
      timeout: this.timeouts.long,
      stableTime: 300,
    }).catch(() => {});
  }

  async assertSurface(): Promise<void> {
    await this.assertPageTitle();
    if (this.config.requireHeading !== false) {
      await expect(
        this.getHeadingLocator(),
        `${this.config.pageName} 헤딩이 보이지 않습니다.`,
      ).toBeVisible({ timeout: this.timeouts.medium });
      await expect(this.getHeadingLocator()).toContainText(this.config.heading);
    }

    const currentPath = this.getCurrentPath();
    const expectedPath = this.getExpectedPath();

    if (expectedPath instanceof RegExp) {
      expect(
        currentPath,
        `${this.config.pageName} 경로가 예상 패턴과 다릅니다.`,
      ).toMatch(expectedPath);
      return;
    }

    expect(
      currentPath,
      `${this.config.pageName} 경로가 예상과 다릅니다.`,
    ).toBe(expectedPath);
  }

  async assertPrimaryActionVisible(): Promise<void> {
    const primaryAction = this.getPrimaryAction();
    if (!primaryAction) {
      return;
    }

    await expect(
      primaryAction,
      `${this.config.pageName} 핵심 액션 버튼이 보이지 않습니다.`,
    ).toBeVisible({ timeout: this.timeouts.medium });
  }

  async hasNoResultState(): Promise<boolean> {
    const hasNoResult = await this.noResultMessage
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
    if (hasNoResult) {
      return true;
    }

    const noResultRows = await this.page
      .locator("table tbody tr:visible")
      .filter({ hasText: /검색결과가 없습니다/ })
      .count()
      .catch(() => 0);
    return noResultRows > 0;
  }

  async getMeaningfulRowCount(): Promise<number> {
    return await this.page
      .locator("table tbody tr:visible")
      .evaluateAll((rows) => {
        const normalize = (value: string) => value.replace(/\s+/g, " ").trim();

        return rows.filter((row) => {
          const text = normalize((row as HTMLElement).innerText || "");
          return text.length > 0 && !text.includes("검색결과가 없습니다");
        }).length;
      })
      .catch(() => 0);
  }

  async hasVisiblePrimaryAction(): Promise<boolean> {
    const primaryAction = this.getPrimaryAction();
    if (!primaryAction) {
      return false;
    }

    return await primaryAction.isVisible({ timeout: this.timeouts.short });
  }

  async assertContentVisible(): Promise<void> {
    const hasTable = await this.table
      .isVisible({ timeout: this.timeouts.short })
      .catch(() => false);
    const hasNoResult = await this.hasNoResultState();
    const rowCount = await this.getMeaningfulRowCount();
    const hasPrimaryAction = await this.hasVisiblePrimaryAction();

    expect(
      hasTable || hasNoResult || hasPrimaryAction,
      `${this.config.pageName} 화면의 핵심 영역이 로드되지 않았습니다.`,
    ).toBeTruthy();

    expect(
      rowCount > 0 || hasNoResult || hasPrimaryAction,
      `${this.config.pageName} 화면에서 검증 가능한 콘텐츠를 찾지 못했습니다.`,
    ).toBeTruthy();
  }
}
