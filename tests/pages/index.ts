/**
 * Page Object Model 모듈 인덱스
 * 
 * 모든 페이지 객체를 한 곳에서 import할 수 있습니다.
 * 
 * @example
 * import { MakestarPage, AlbumBuddyPage, SKUListPage } from './pages';
 */

// Base 클래스
export { BasePage, DEFAULT_TIMEOUTS } from './base.page';
export type { TimeoutConfig, ImageVerificationResult, ApiMonitorResult, ElementSearchResult } from './base.page';

// Makestar 페이지
export { MakestarPage, MAKESTAR_TEXT_PATTERNS } from './makestar.page';
export type { MenuItem, ProductInfo } from './makestar.page';

// AlbumBuddy 페이지
export { 
  AlbumBuddyPage, 
  ALBUMBUDDY_URLS, 
  ALBUMBUDDY_PAGES, 
  NAV_BUTTONS, 
  HOME_SECTIONS, 
  PERFORMANCE_THRESHOLD 
} from './albumbuddy.page';
export type { PageInfo, PerformanceResult } from './albumbuddy.page';

// Admin 베이스 페이지
export { AdminBasePage, ADMIN_TIMEOUTS, ADMIN_SELECTORS } from './admin-base.page';
export type { SearchCriteria, TableRowData, PaginationInfo } from './admin-base.page';

// Admin SKU 목록 페이지
export { SKUListPage } from './admin-sku-list.page';
export type { SKUSearchOptions } from './admin-sku-list.page';

// Admin 이벤트 목록 페이지
export { EventListPage } from './admin-event-list.page';
export type { EventSearchOptions } from './admin-event-list.page';

// Admin 주문 목록 페이지
export { OrderListPage } from './admin-order-list.page';
export type { OrderTabKey, OrderStatusSnapshot } from './admin-order-list.page';

// Admin 대분류 목록 페이지
export { CategoryListPage } from './admin-category-list.page';
export type { CategorySearchOptions } from './admin-category-list.page';

// Admin 대분류 생성 페이지
export { CategoryCreatePage } from './admin-category-create.page';
export type { CategoryCreateOptions } from './admin-category-create.page';

// Admin SKU 생성 페이지
export { SkuCreatePage } from './admin-sku-create.page';

// Admin 상품(이벤트) 생성 페이지
export { EventCreatePage } from './admin-event-create.page';
export type { EventCreateOptions } from './admin-event-create.page';
export type { SkuCreateOptions } from './admin-sku-create.page';
