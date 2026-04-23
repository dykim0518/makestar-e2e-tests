import { test } from "@playwright/test";
import { assertNoServerError, AlbumbuddyCorePage } from "./pages";
import type { AlbumbuddyCoreKey } from "./pages";
import { applyAdminTestConfig } from "./helpers/admin/test-helpers";

applyAdminTestConfig("앨범버디 확장");

type AlbumbuddyExtendedCase = {
  code: string;
  key: AlbumbuddyCoreKey;
  label: string;
  tag: string;
};

const EXTENDED_CASES: readonly AlbumbuddyExtendedCase[] = [
  {
    code: "AB-EXT-01",
    key: "artist.create",
    label: "아티스트 등록",
    tag: "admin_albumbuddy.artist.create",
  },
  {
    code: "AB-EXT-02",
    key: "goods.detail",
    label: "상품 상세",
    tag: "admin_albumbuddy.goods.detail",
  },
  {
    code: "AB-EXT-03",
    key: "stock.detail",
    label: "구매대행 입고관리 상세",
    tag: "admin_albumbuddy.stock.detail",
  },
  {
    code: "AB-EXT-04",
    key: "stock.create",
    label: "구매대행 입고관리 등록",
    tag: "admin_albumbuddy.stock.create",
  },
  {
    code: "AB-EXT-05",
    key: "warehouse.detail",
    label: "배송대행 입고관리 상세",
    tag: "admin_albumbuddy.warehouse.detail",
  },
  {
    code: "AB-EXT-06",
    key: "packaging.detail",
    label: "패키징 처리 상세",
    tag: "admin_albumbuddy.packaging.detail",
  },
  {
    code: "AB-EXT-07",
    key: "shipping.detail",
    label: "물류 출고 관리 상세",
    tag: "admin_albumbuddy.shipping.detail",
  },
  {
    code: "AB-EXT-08",
    key: "user.list",
    label: "회원 목록",
    tag: "admin_albumbuddy.user.list",
  },
  {
    code: "AB-EXT-09",
    key: "point.manage",
    label: "포인트 지급 · 차감",
    tag: "admin_albumbuddy.point.manage",
  },
  {
    code: "AB-EXT-10",
    key: "point.list",
    label: "포인트 내역 관리 목록",
    tag: "admin_albumbuddy.point.list",
  },
] as const;

test.describe.serial("앨범버디 Admin 확장 검증", () => {
  for (const scenario of EXTENDED_CASES) {
    test.describe(`${scenario.label} @feature:${scenario.tag}`, () => {
      test(`${scenario.code}: ${scenario.label} 화면 기본 요소가 정상 노출된다`, async ({
        page,
      }) => {
        const targetPage = new AlbumbuddyCorePage(page, scenario.key);

        await targetPage.openTarget();
        await targetPage.waitForReady();
        await targetPage.assertSurface();
        await targetPage.assertContentVisible();
        await targetPage.assertPrimaryActionVisible();
        await assertNoServerError(page, scenario.label);
      });
    });
  }
});
