export type CmrRuntimeEnvironment = "prod" | "stg" | "unknown";

export const CMR_PRICE_OPTION_PRODUCT_ENV_KEYS = {
  generic: "CMR_PRICE_OPTION_PRODUCT_IDS",
  prod: "CMR_PRICE_OPTION_PRODUCT_IDS_PROD",
  stg: "CMR_PRICE_OPTION_PRODUCT_IDS_STG",
} as const;

const DEFAULT_PRICE_OPTION_PRODUCT_IDS = {
  prod: [] as const,
  stg: [] as const,
  unknown: [] as const,
} as const satisfies Record<CmrRuntimeEnvironment, readonly number[]>;

export function getCmrRuntimeEnvironment(
  baseUrl: string,
): CmrRuntimeEnvironment {
  if (/stage|staging|makeuni2026/i.test(baseUrl)) return "stg";
  if (/makestar\.com/i.test(baseUrl)) return "prod";
  return "unknown";
}

export function parseProductIds(value: string | undefined): number[] {
  if (!value) return [];

  return value
    .split(/[,\s]+/)
    .map((token) => Number.parseInt(token.trim(), 10))
    .filter((id) => Number.isInteger(id) && id > 0);
}

export function getPriceOptionProductIds(baseUrl: string): number[] {
  const environment = getCmrRuntimeEnvironment(baseUrl);
  const envSpecificKey =
    environment === "prod"
      ? CMR_PRICE_OPTION_PRODUCT_ENV_KEYS.prod
      : environment === "stg"
        ? CMR_PRICE_OPTION_PRODUCT_ENV_KEYS.stg
        : null;
  const envSpecificIds = envSpecificKey
    ? parseProductIds(process.env[envSpecificKey])
    : [];

  if (envSpecificIds.length > 0) {
    return envSpecificIds;
  }

  const genericIds = parseProductIds(
    process.env[CMR_PRICE_OPTION_PRODUCT_ENV_KEYS.generic],
  );
  if (genericIds.length > 0) {
    return genericIds;
  }

  return [...DEFAULT_PRICE_OPTION_PRODUCT_IDS[environment]];
}
