import { test } from "@playwright/test";
import { assertNoServerError, AlbumbuddyCorePage } from "./pages";
import type { AlbumbuddyCoreKey } from "./pages";
import { applyAdminTestConfig } from "./helpers/admin/test-helpers";

applyAdminTestConfig("앨범버디 코어");

type AlbumbuddyCoreCase = {
  code: string;
  key: AlbumbuddyCoreKey;
  label: string;
  tag: string;
};

const CORE_CASES: readonly AlbumbuddyCoreCase[] = [
  {
    code: "AB-CORE-01",
    key: "artist.list",
    label: "아티스트 목록",
    tag: "admin_albumbuddy.artist.list",
  },
  {
    code: "AB-CORE-02",
    key: "seller.list",
    label: "판매처 목록",
    tag: "admin_albumbuddy.seller.list",
  },
  {
    code: "AB-CORE-03",
    key: "goods.list",
    label: "상품 목록",
    tag: "admin_albumbuddy.goods.list",
  },
  {
    code: "AB-CORE-04",
    key: "report.list",
    label: "상품 등록 요청처리 목록",
    tag: "admin_albumbuddy.report.list",
  },
  {
    code: "AB-CORE-05",
    key: "order.list",
    label: "주문 목록",
    tag: "admin_albumbuddy.order.list",
  },
  {
    code: "AB-CORE-06",
    key: "purchase.list",
    label: "일반 상품 발주 목록",
    tag: "admin_albumbuddy.purchase.list",
  },
  {
    code: "AB-CORE-07",
    key: "bunjang.list",
    label: "번장 발주 관리 목록",
    tag: "admin_albumbuddy.bunjang.list",
  },
  {
    code: "AB-CORE-08",
    key: "stock.list",
    label: "구매대행 입고관리 목록",
    tag: "admin_albumbuddy.stock.list",
  },
  {
    code: "AB-CORE-09",
    key: "warehouse.list",
    label: "배송대행 입고관리 목록",
    tag: "admin_albumbuddy.warehouse.list",
  },
  {
    code: "AB-CORE-10",
    key: "packaging.list",
    label: "패키징 처리 목록",
    tag: "admin_albumbuddy.packaging.list",
  },
  {
    code: "AB-CORE-11",
    key: "delivery-payment.list",
    label: "해외배송 결제 관리 목록",
    tag: "admin_albumbuddy.delivery-payment.list",
  },
  {
    code: "AB-CORE-12",
    key: "shipping.list",
    label: "물류 출고 관리 목록",
    tag: "admin_albumbuddy.shipping.list",
  },
] as const;

test.describe.serial("앨범버디 Admin 핵심 목록 검증", () => {
  for (const scenario of CORE_CASES) {
    test.describe(
      `${scenario.label} @feature:${scenario.tag}`,
      () => {
        test(`${scenario.code}: ${scenario.label} 화면 기본 요소가 정상 노출된다`, async ({
          page,
        }) => {
          const corePage = new AlbumbuddyCorePage(page, scenario.key);

          await corePage.navigate();
          await corePage.waitForReady();
          await corePage.assertSurface();
          await corePage.assertContentVisible();
          await corePage.assertPrimaryActionVisible();
          await assertNoServerError(page, scenario.label);
        });
      },
    );
  }
});
