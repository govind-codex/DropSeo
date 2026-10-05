export const DODO_PLANS = ["pro", "studio"] as const;

export type DodoPlan = (typeof DODO_PLANS)[number];

export function isDodoPlan(value: unknown): value is DodoPlan {
  return typeof value === "string" && DODO_PLANS.includes(value as DodoPlan);
}

function configuredValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value || value.startsWith("replace_with")) return null;
  return value;
}

export function dodoCheckoutConfig(plan: DodoPlan) {
  const bearerToken = configuredValue("DODO_PAYMENTS_API_KEY");
  const productId = configuredValue(plan === "pro" ? "DODO_PRO_PRODUCT_ID" : "DODO_STUDIO_PRODUCT_ID");
  const returnUrl = configuredValue("DODO_PAYMENTS_RETURN_URL");
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";

  if (!bearerToken || !productId || !returnUrl) return null;

  try {
    const parsedReturnUrl = new URL(returnUrl);
    if (parsedReturnUrl.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && parsedReturnUrl.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsedReturnUrl.hostname))) return null;
  } catch {
    return null;
  }

  return { bearerToken, productId, returnUrl, environment } as const;
}

export function isDodoCheckoutUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "dodopayments.com" || url.hostname.endsWith(".dodopayments.com"));
  } catch {
    return false;
  }
}
