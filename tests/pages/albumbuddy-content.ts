/**
 * AlbumBuddy 페이지 텍스트/카운트 기반 분석 함수
 */

import { escapeRegExp } from "./albumbuddy.config";

export type DashboardSessionIndicators = {
  hasNoItemsRegistered: boolean;
  hasOrderRows: boolean;
  hasMeaningfulCounters: boolean;
};

export type DashboardContentCheck = {
  hasContent: boolean;
  notFound: boolean;
};

export type AboutContentCheck = {
  hasBrandName: boolean;
  hasServiceDescription: boolean;
  hasSponsor: boolean;
};

export type PricingPageContentCheck = {
  hasTitle: boolean;
  hasPriceValues: boolean;
  hasServiceItems: boolean;
  hasShippingCalculator: boolean;
};

export type DashboardDetailContentCheck = {
  hasOrderTabs: boolean;
  hasStatusCounters: boolean;
  hasPaymentSection: boolean;
  notFound: boolean;
};

export type PurchasingDetailContentCheck = {
  hasOrderTable: boolean;
  hasItemColumns: boolean;
  hasCostBreakdown: boolean;
};

export type PackageDetailContentCheck = {
  hasPackageTab: boolean;
  hasPackageContent: boolean;
};

export function analyzeDashboardSessionIndicators(
  pageText: string,
  rowCount: number,
): DashboardSessionIndicators {
  const counterLabels = [
    "Waiting",
    "Pending",
    "Paid",
    "Ordered",
    "Shipment",
    "Canceled",
    "On hold",
  ];

  const hasMeaningfulCounters = counterLabels.some((label) =>
    new RegExp(`\\b([1-9]\\d*)\\s+${escapeRegExp(label)}\\b`, "i").test(
      pageText,
    ),
  );

  return {
    hasNoItemsRegistered: /No items registered\./i.test(pageText),
    hasOrderRows: rowCount > 1,
    hasMeaningfulCounters,
  };
}

export function analyzeDashboardContent(pageText: string): DashboardContentCheck {
  return {
    hasContent: pageText.length > 100,
    notFound: pageText.toLowerCase().includes("not found"),
  };
}

export function hasPurchasingContent(pageText: string): boolean {
  return (
    pageText.includes("Order") ||
    pageText.includes("Purchase") ||
    pageText.includes("구매") ||
    pageText.includes("No ") ||
    pageText.includes("empty")
  );
}

export function hasPackageContent(pageText: string): boolean {
  return (
    pageText.includes("패키지") ||
    pageText.includes("Package") ||
    pageText.includes("패키징") ||
    pageText.includes("Packaging") ||
    pageText.includes("배송")
  );
}

export function analyzeAboutContent(pageText: string): AboutContentCheck {
  return {
    hasBrandName: pageText.includes("AlbumBuddy"),
    hasServiceDescription: /proxy buying|shipping service|구매 대행/i.test(
      pageText,
    ),
    hasSponsor: pageText.includes("MAKESTAR"),
  };
}

export function analyzePricingPageContent(
  pageText: string,
): PricingPageContentCheck {
  const hasPriceValues = /\$\s*\d+\.\d{2}/.test(pageText);
  const serviceItems = [
    "Package Consolidation",
    "Repackaging",
    "Storage",
    "Online shop",
  ];
  const foundServices = serviceItems.filter((item) => pageText.includes(item));

  return {
    hasTitle: pageText.includes("Service Pricing"),
    hasPriceValues,
    hasServiceItems: foundServices.length >= 2,
    hasShippingCalculator: pageText.includes("Shipping fee calculator"),
  };
}

export function analyzeDashboardDetailContent(
  pageText: string,
): DashboardDetailContentCheck {
  const hasOrderTabs =
    pageText.includes("My orders") || pageText.includes("My packages");
  const statusLabels = [
    "Waiting",
    "Pending",
    "Paid",
    "Ordered",
    "Shipment",
    "Canceled",
  ];
  const foundStatuses = statusLabels.filter((status) =>
    pageText.includes(status),
  );
  const hasStatusCounters = foundStatuses.length >= 3;
  const hasPaymentSection =
    pageText.includes("Total") && /\$\s*\d+\.\d{2}/.test(pageText);

  return {
    hasOrderTabs,
    hasStatusCounters,
    hasPaymentSection,
    notFound:
      pageText.toLowerCase().includes("not found") ||
      pageText.toLowerCase().includes("404"),
  };
}

export function analyzePurchasingDetailContent(
  pageText: string,
  productImageCount: number,
  quantityFieldCount: number,
): PurchasingDetailContentCheck {
  const tableHeaders = ["Vendor", "Item", "Quantity", "Price"];
  const foundHeaders = tableHeaders.filter((header) => pageText.includes(header));
  const hasOrderTable = foundHeaders.length >= 2;
  const hasMobileItemCard =
    productImageCount > 0 &&
    quantityFieldCount > 0 &&
    /\$\s*\d+(\.\d+)?/.test(pageText);
  const hasItemColumns =
    pageText.includes("No items registered") || hasOrderTable || hasMobileItemCard;
  const costItems = ["Item cost", "Assisted purchasing fee", "Total"];
  const foundCosts = costItems.filter((item) => pageText.includes(item));

  return {
    hasOrderTable,
    hasItemColumns,
    hasCostBreakdown: foundCosts.length >= 2,
  };
}

export function analyzePackageDetailContent(
  pageText: string,
): PackageDetailContentCheck {
  return {
    hasPackageTab: pageText.includes("My packages"),
    hasPackageContent:
      pageText.includes("Package") ||
      pageText.includes("패키지") ||
      pageText.includes("Shipping") ||
      pageText.includes("배송"),
  };
}
