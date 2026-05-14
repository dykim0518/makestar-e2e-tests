/** 메뉴 항목 타입 */
export type MenuItem = {
  name: string;
  texts: readonly string[];
};

/** 상품 정보 타입 */
export type ProductInfo = {
  name?: string;
  price?: string;
  hasOptions: boolean;
};

/** Shop -> 상품 상세 -> 아티스트 페이지 이동 결과 */
export type ArtistProfileNavigationResult = {
  success: boolean;
  productIndex?: number;
  detailUrl?: string;
  artistUrl?: string;
  selector?: string;
  reason?: string;
};

/** Web Vitals 측정 결과 타입 */
export type WebVitalsResult = {
  /** First Contentful Paint (ms) */
  fcp: number;
  /** Largest Contentful Paint (ms) */
  lcp: number;
  /** Time to First Byte (ms) */
  ttfb: number;
  /** DOM Content Loaded (ms) */
  dcl: number;
  /** Load Complete (ms) */
  load: number;
  /** Cumulative Layout Shift */
  cls: number;
};

export const MAKESTAR_TEXT_PATTERNS = {
  ENDED_TAB: [
    "종료된",
    "Ended",
    "Sale Ended",
    "Closed",
    "Past",
    "종료",
  ] as const,
  ONGOING_TAB: [
    "진행중",
    "Ongoing",
    "Now on sale",
    "Now On Sale",
    "on sale",
    "진행",
    "ongoing",
  ] as const,
  OPTION_SELECT: [
    "옵션",
    "Option",
    "option",
    "선택",
    "Select",
    "select",
  ] as const,
  QUANTITY: ["수량", "Quantity", "quantity", "개수"] as const,
} as const;
