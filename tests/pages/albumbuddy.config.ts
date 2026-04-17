/**
 * AlbumBuddy 페이지 상수와 순수 헬퍼
 */

export type PageInfo = {
  url: string;
  pattern: RegExp;
  title?: string;
};

export const ALBUMBUDDY_URLS = {
  base: "https://albumbuddy.kr",
  shop: "https://albumbuddy.kr/shop",
  about: "https://albumbuddy.kr/about",
  pricing: "https://albumbuddy.kr/pricing",
  dashboard: "https://albumbuddy.kr/dashboard/purchasing",
  dashboardPurchasing: "https://albumbuddy.kr/dashboard/purchasing",
  dashboardPackage: "https://albumbuddy.kr/dashboard/package",
} as const;

export const ALBUMBUDDY_PAGES: Record<string, PageInfo> = {
  home: { url: ALBUMBUDDY_URLS.shop, pattern: /shop/i, title: "ALBUM BUDDY" },
  about: { url: ALBUMBUDDY_URLS.about, pattern: /about/i },
  pricing: { url: ALBUMBUDDY_URLS.pricing, pattern: /pricing/i },
  dashboard: { url: ALBUMBUDDY_URLS.dashboard, pattern: /dashboard/i },
  dashboardPurchasing: {
    url: ALBUMBUDDY_URLS.dashboardPurchasing,
    pattern: /purchasing/i,
  },
  dashboardPackage: {
    url: ALBUMBUDDY_URLS.dashboardPackage,
    pattern: /package/i,
  },
} as const;

export const NAV_BUTTONS = [
  "About",
  "Pricing",
  "Dashboard",
  "Request item",
] as const;

export const HOME_SECTIONS = [
  "Artist",
  "Recent",
  "Trending",
  "Official",
  "추천",
  "아티스트",
  "트렌딩",
  "공식",
  "파트너",
  "전체",
  "앨범",
] as const;

export const PERFORMANCE_THRESHOLD = {
  pageLoad: 10000,
  apiResponse: 5000,
} as const;

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
