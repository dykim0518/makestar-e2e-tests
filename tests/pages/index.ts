/**
 * Page Object Model 모듈 인덱스
 *
 * 모든 페이지 객체를 한 곳에서 import할 수 있습니다.
 *
 * @example
 * import { MakestarPage, AlbumBuddyPage, SKUListPage } from './pages';
 */

// Base 클래스
export { BasePage, DEFAULT_TIMEOUTS } from "./base.page";
export type {
  TimeoutConfig,
  ImageVerificationResult,
  ApiMonitorResult,
  ElementSearchResult,
} from "./base.page";

// Makestar 페이지
export { MakestarPage, MAKESTAR_TEXT_PATTERNS } from "./makestar.page";
export type { MenuItem, ProductInfo, WebVitalsResult } from "./makestar.page";

// Makestar 결제 페이지
export { MakestarPaymentPage } from "./makestar-payment.page";
export type { MakeOrderResponse } from "./makestar-payment.page";

// AlbumBuddy 페이지
export {
  AlbumBuddyPage,
  ALBUMBUDDY_URLS,
  ALBUMBUDDY_PAGES,
  NAV_BUTTONS,
  HOME_SECTIONS,
  PERFORMANCE_THRESHOLD,
} from "./albumbuddy.page";
export type { PageInfo, PerformanceResult } from "./albumbuddy.page";

// Admin 베이스 페이지
export {
  AdminBasePage,
  ADMIN_TIMEOUTS,
  ADMIN_SELECTORS,
  assertNoServerError,
} from "./admin-base.page";
export type {
  SearchCriteria,
  TableRowData,
  PaginationInfo,
  ResultMetrics,
} from "./admin-base.page";

// Admin SKU 목록 페이지
export { SKUListPage } from "./admin-sku-list.page";
export type { SKUSearchOptions } from "./admin-sku-list.page";

// Admin 포토카드 SKU 작업 현황 페이지
export { PhotocardSkuWorkPage } from "./admin-photocard-sku-work.page";

// Admin 이벤트 목록 페이지
export { EventListPage } from "./admin-event-list.page";
export type { EventSearchOptions } from "./admin-event-list.page";

// Admin 주문 목록 페이지
export { OrderListPage } from "./admin-order-list.page";
export type {
  OrderTabKey,
  OrderStatusKey,
  OrderStatusSnapshot,
  OrderResultMetrics,
  PaymentMethodKey,
  OrderDetailPaymentInfo,
} from "./admin-order-list.page";

// Admin 발주/입고 페이지
export { PurchaseListPage } from "./admin-purchase-list.page";
export type {
  PurchaseTabKey,
  PurchaseAppliedFilter,
  PurchaseSearchSeed,
  PurchaseResultMetrics,
} from "./admin-purchase-list.page";

// Admin 차트 집계 페이지
export { ChartInfoListPage } from "./admin-chart-info-list.page";
export type { ChartResultMetrics } from "./admin-chart-info-list.page";

// Admin 대분류 목록 페이지
export { CategoryListPage } from "./admin-category-list.page";
export type { CategorySearchOptions } from "./admin-category-list.page";

// Admin 대분류 생성 페이지
export { CategoryCreatePage } from "./admin-category-create.page";
export type { CategoryCreateOptions } from "./admin-category-create.page";

// Admin 대분류 상세 페이지
export { CategoryDetailPage } from "./admin-category-detail.page";
export type { CategoryItemCreateOptions } from "./admin-category-detail.page";

// Admin SKU 생성 페이지
export { SkuCreatePage } from "./admin-sku-create.page";

// Admin 상품(이벤트) 생성 페이지
export { EventCreatePage } from "./admin-event-create.page";
export type { EventCreateOptions } from "./admin-event-create.page";
export type { SkuCreateOptions } from "./admin-sku-create.page";

// Admin 전시 카테고리 페이지
export { DisplayCategoryPage } from "./admin-display-category.page";
export type { DisplayCategoryNames } from "./admin-display-category.page";

// POCAAlbum Admin 대시보드 페이지
export {
  PocaDashboardPage,
  POCA_SIDEBAR_MENUS,
  POCA_DASHBOARD_CARDS,
  POCA_TABLE_HEADERS,
  POCA_VALID_STATUSES,
  POCA_SECTIONS,
} from "./admin-poca-dashboard.page";
export type { PocaSidebarMenu } from "./admin-poca-dashboard.page";

// POCAAlbum 앨범 목록 페이지
export { PocaAlbumListPage } from "./admin-poca-album-list.page";

// POCAAlbum 앨범 생성 페이지
export { PocaAlbumCreatePage } from "./admin-poca-album-create.page";
export type { AlbumCreateOptions } from "./admin-poca-album-create.page";

// POCAAlbum Shop 상품 목록 페이지
export { PocaShopListPage } from "./admin-poca-shop-list.page";

// POCAAlbum Shop 상품 생성 페이지
export { PocaShopCreatePage } from "./admin-poca-shop-create.page";
export type { ShopProductCreateOptions } from "./admin-poca-shop-create.page";

// POCAAlbum FAVE 팩 목록 페이지
export { PocaFaveListPage } from "./admin-poca-fave-list.page";

// POCAAlbum FAVE 팩 생성 페이지
export { PocaFaveCreatePage } from "./admin-poca-fave-create.page";
export type { FaveCreateOptions } from "./admin-poca-fave-create.page";

// POCAAlbum BENEFIT 목록 페이지
export { PocaBenefitListPage } from "./admin-poca-benefit-list.page";

// POCAAlbum BENEFIT 생성 페이지
export { PocaBenefitCreatePage } from "./admin-poca-benefit-create.page";
export type { BenefitCreateOptions } from "./admin-poca-benefit-create.page";

// POCAAlbum 당첨자조회 목록 페이지
export { PocaWinnerListPage } from "./admin-poca-winner-list.page";

// POCAAlbum 알림 목록 페이지
export { PocaNotificationListPage } from "./admin-poca-notification-list.page";

// POCAAlbum 알림 생성 페이지
export { PocaNotificationCreatePage } from "./admin-poca-notification-create.page";
export type { NotificationCreateOptions } from "./admin-poca-notification-create.page";

// POCAAlbum 신고내역 목록 페이지
export { PocaReportListPage } from "./admin-poca-report-list.page";

// POCAAlbum 고객관리 목록 페이지
export { PocaCustomerListPage } from "./admin-poca-customer-list.page";

// Admin 회원관리 목록 페이지
export { UserListPage } from "./admin-user-list.page";
export type { UserResultMetrics } from "./admin-user-list.page";

// Admin 회원관리 상세 페이지
export { UserDetailPage } from "./admin-user-detail.page";

// POCAAlbum 시스템관리 목록 페이지
export { PocaSystemListPage } from "./admin-poca-system-list.page";

// Admin 아티스트 목록 페이지
export {
  ArtistListPage,
  ARTIST_TABLE_HEADERS,
  ARTIST_COL,
} from "./admin-artist-list.page";
export type { ArtistRowData } from "./admin-artist-list.page";

// Admin 상품(이벤트) 수정 페이지
export { EventUpdatePage } from "./admin-event-update.page";
export type {
  NoticeCheckboxLabel,
  NoticeCheckboxState,
} from "./admin-event-update.page";
